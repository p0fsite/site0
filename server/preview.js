import { existsSync } from "node:fs";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import puppeteer from "puppeteer-core";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const cache = new Map();
const inflight = new Map();
let browser;
let queue = Promise.resolve();

function ipPrivate(address) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
    return false;
  }
  if (isIP(address) === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    if (lower.startsWith("fe80:") || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("ff")) {
      return true;
    }
    const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) return ipPrivate(dotted[1]);
    const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const hi = Number.parseInt(hex[1], 16);
      const lo = Number.parseInt(hex[2], 16);
      const v4 = [(hi >> 8) & 255, hi & 255, (lo >> 8) & 255, lo & 255].join(".");
      return ipPrivate(v4);
    }
    return false;
  }
  return true;
}

function decimalIp(host) {
  if (!/^\d+$/.test(host)) return "";
  const value = Number(host);
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return "";
  return [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join(".");
}

async function hostIsPublic(hostname) {
  const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host === "metadata.google.internal"
  ) {
    return false;
  }
  if (host.split(".").some((part) => /^0\d+$/.test(part))) return false;
  const dotted = decimalIp(host);
  if (dotted) return !ipPrivate(dotted);
  if (isIP(host)) return !ipPrivate(host);
  let records;
  try {
    records = await lookup(host, { all: true, verbatim: true });
  } catch {
    return false;
  }
  return records.length > 0 && records.every((record) => !ipPrivate(record.address));
}

export async function publicTarget(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!(await hostIsPublic(url.hostname))) return null;
  return url.toString();
}

async function fetchPublic(start, init) {
  let current = await publicTarget(start);
  if (!current) {
    const error = new Error("Paste a public http or https link.");
    error.status = 400;
    throw error;
  }
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, { ...init, redirect: "manual" });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel();
      if (!next) {
        const error = new Error("That page did not open.");
        error.status = 502;
        throw error;
      }
      const resolved = await publicTarget(new URL(next, current).toString());
      if (!resolved) {
        const error = new Error("That link left the public web.");
        error.status = 400;
        throw error;
      }
      current = resolved;
      continue;
    }
    return { response, url: current };
  }
  const error = new Error("That page redirected too many times.");
  error.status = 502;
  throw error;
}

function blocksFrames(headers) {
  const xfo = (headers.get("x-frame-options") || "").toLowerCase();
  if (xfo.includes("deny") || xfo.includes("sameorigin")) return true;
  const csp = (headers.get("content-security-policy") || "").toLowerCase();
  const match = csp.match(/frame-ancestors\s+([^;]+)/);
  if (!match) return false;
  const value = match[1];
  if (value.includes("*")) return false;
  return true;
}

const BROWSER_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

export async function canFrame(target) {
  const { response } = await fetchPublic(target, {
    headers: BROWSER_HEADERS,
    signal: AbortSignal.timeout(12000),
  });
  await response.body?.cancel();
  return !blocksFrames(response.headers);
}

async function getBrowser() {
  if (browser?.connected) return browser;
  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--hide-scrollbars"],
  });
  browser.on("disconnected", () => {
    browser = null;
  });
  return browser;
}

function remember(target, buffer) {
  cache.set(target, buffer);
  if (cache.size > 8) cache.delete(cache.keys().next().value);
}

async function arm(page) {
  await page.setUserAgent(BROWSER_HEADERS["user-agent"]);
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    const dest = request.url();
    if (dest.startsWith("data:") || dest.startsWith("blob:")) {
      await request.continue().catch(() => {});
      return;
    }
    const allowed = await publicTarget(dest);
    if (!allowed) await request.abort().catch(() => {});
    else await request.continue().catch(() => {});
  });
}

async function shoot(target) {
  const chrome = await getBrowser();
  const page = await chrome.newPage();
  try {
    await arm(page);
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(target, { waitUntil: "networkidle2", timeout: 25000 }).catch(async () => {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 25000 });
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const height = await page.evaluate(() => {
      const body = document.body;
      const full = Math.max(
        document.documentElement?.scrollHeight || 0,
        body?.scrollHeight || 0,
        900,
      );
      return Math.min(full, 3600);
    });
    if (height > 900) await page.setViewport({ width: 1440, height, deviceScaleFactor: 1 });
    return Buffer.from(await page.screenshot({ type: "png" }));
  } finally {
    await page.close().catch(() => {});
  }
}

function visibleText(html) {
  return String(html || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3500);
}

async function textReference(target) {
  const { response, url } = await fetchPublic(target, {
    headers: { ...BROWSER_HEADERS, accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(12000),
  });
  const type = response.headers.get("content-type") || "";
  if (!response.ok || !/text\/html|application\/xhtml|text\/plain/i.test(type)) {
    await response.body?.cancel();
    return { url, text: "", image: "" };
  }
  const html = (await response.text()).slice(0, 400000);
  return { url, text: visibleText(html), image: "" };
}

async function look(target) {
  const chrome = await getBrowser();
  const page = await chrome.newPage();
  try {
    await arm(page);
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.goto(target, { waitUntil: "networkidle2", timeout: 20000 }).catch(async () => {
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 20000 });
    });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const seen = await page.evaluate(() => {
      const bits = [];
      const title = (document.title || "").replace(/\s+/g, " ").trim();
      if (title) bits.push(title);
      document.querySelectorAll("h1,h2,h3,button,a,label").forEach((node) => {
        const line = (node.innerText || "").replace(/\s+/g, " ").trim();
        if (line && line.length < 80 && bits.length < 48) bits.push(line);
      });
      const body = (document.body?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 2500);
      return `${bits.join("\n")}\n\n${body}`.slice(0, 3500);
    });
    const jpeg = Buffer.from(await page.screenshot({ type: "jpeg", quality: 42 }));
    return {
      url: target,
      text: seen,
      image: jpeg.length <= 1_600_000 ? jpeg.toString("base64") : "",
    };
  } finally {
    await page.close().catch(() => {});
  }
}

export function readReference(target) {
  const job = queue.then(async () => {
    const safe = await publicTarget(target);
    if (!safe) return null;
    if (existsSync(CHROME)) {
      try {
        return await look(safe);
      } catch {
        // A public HTML fetch still gives the model the example's words.
      }
    }
    try {
      return await textReference(safe);
    } catch {
      return null;
    }
  });
  queue = job.then(
    () => {},
    () => {},
  );
  return job;
}

export function capture(target) {
  if (cache.has(target)) return Promise.resolve(cache.get(target));
  if (inflight.has(target)) return inflight.get(target);
  const job = queue.then(() => shoot(target));
  queue = job.then(
    () => {},
    () => {},
  );
  const tracked = job.then((buffer) => {
    remember(target, buffer);
    inflight.delete(target);
    return buffer;
  });
  tracked.catch(() => inflight.delete(target));
  inflight.set(target, tracked);
  return tracked;
}

const FRAME_HOOK = `<script>
(function () {
  function hop(next) {
    var url;
    try { url = new URL(next, document.baseURI); }
    catch (e) { return; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    var here = "";
    try { here = new URL(location.href).searchParams.get("url") || ""; }
    catch (e) { here = ""; }
    try {
      var now = new URL(here);
      if (url.origin === now.origin && url.pathname === now.pathname && url.search === now.search) {
        if (url.hash) location.hash = url.hash;
        return;
      }
    } catch (e) {}
    location.assign(location.origin + "/api/frame?url=" + encodeURIComponent(url.href));
  }
  document.addEventListener("click", function (event) {
    var link = event.target && event.target.closest && event.target.closest("a[href]");
    if (!link) return;
    var href = link.getAttribute("href") || "";
    if (/^(mailto:|tel:|javascript:)/i.test(href)) return;
    event.preventDefault();
    event.stopPropagation();
    hop(link.href);
  }, true);
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || form.tagName !== "FORM") return;
    event.preventDefault();
    event.stopPropagation();
    var action = form.getAttribute("action") || document.baseURI;
    var url = new URL(action, document.baseURI);
    if ((form.getAttribute("method") || "get").toLowerCase() !== "post") {
      var data = new FormData(form);
      data.forEach(function (value, key) { url.searchParams.append(key, String(value)); });
    }
    hop(url.href);
  }, true);
})();
</script>`;

function escapeAttr(value) {
  return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

export function prepareFrameHtml(html, pageUrl) {
  const cleaned = String(html)
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*content-security-policy\b[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*x-frame-options\b[^>]*>/gi, "")
    .replace(/<base\b[^>]*>/gi, "");
  const head = `<base href="${escapeAttr(pageUrl)}">${FRAME_HOOK}`;
  if (/<head[^>]*>/i.test(cleaned)) return cleaned.replace(/<head[^>]*>/i, (tag) => `${tag}${head}`);
  if (/<html[^>]*>/i.test(cleaned)) {
    return cleaned.replace(/<html[^>]*>/i, (tag) => `${tag}<head>${head}</head>`);
  }
  return `<!doctype html><html><head>${head}</head><body>${cleaned}</body></html>`;
}

export async function frameDocument(target) {
  const { response, url } = await fetchPublic(target, {
    headers: {
      ...BROWSER_HEADERS,
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = new Error("That page did not open.");
    error.status = 502;
    throw error;
  }
  const type = response.headers.get("content-type") || "";
  const length = Number(response.headers.get("content-length") || 0);
  if (length > 2_000_000) {
    await response.body?.cancel();
    const error = new Error("That page is too large to preview.");
    error.status = 502;
    throw error;
  }
  if (!/text\/html|application\/xhtml/i.test(type)) {
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 2_000_000) {
      const error = new Error("That page is too large to preview.");
      error.status = 502;
      throw error;
    }
    return { type: type || "application/octet-stream", body };
  }
  const html = prepareFrameHtml(await response.text(), url).slice(0, 2_000_000);
  return { type: "text/html; charset=utf-8", body: html };
}

export async function warm() {
  return;
}

function send(res, status, body, type) {
  res.statusCode = status;
  if (type) res.setHeader("Content-Type", type);
  res.end(body);
}

export function queryUrl(req) {
  const given = req.query?.url;
  if (typeof given === "string" && given) return given;
  try {
    return new URL(req.url || "/", "http://127.0.0.1").searchParams.get("url") || "";
  } catch {
    return "";
  }
}

export async function handlePreviewApi(req, res) {
  const parsed = new URL(req.url || "/", "http://127.0.0.1");
  const target = await publicTarget(queryUrl(req));
  if (!target) {
    send(res, 400, "Paste a public http or https link.");
    return;
  }
  if (parsed.pathname === "/api/can-frame") {
    const frame = await canFrame(target).catch(() => false);
    send(res, 200, JSON.stringify({ frame }), "application/json");
    return;
  }
  if (parsed.pathname === "/api/warm") {
    await warm(target);
    send(res, 204, "");
    return;
  }
  if (parsed.pathname === "/api/frame") {
    const framed = await frameDocument(target);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    send(res, 200, framed.body, framed.type);
    return;
  }
  if (parsed.pathname === "/api/capture") {
    const png = await capture(target);
    res.setHeader("Cache-Control", "private, max-age=120");
    send(res, 200, png, "image/png");
  }
}
