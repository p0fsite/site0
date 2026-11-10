import { gateGenerate, noteGenerated } from "./sites.js";

const MODEL = "grok-4.7";

const SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    html: { type: "string" },
    database: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          fields: { type: "array", items: { type: "string" } },
        },
        additionalProperties: false,
        required: ["name", "fields"],
      },
    },
  },
  additionalProperties: false,
  required: ["title", "html", "database"],
};

const SYSTEM = `You build one website from what the user wrote. Return one finished HTML document in the html field. That document is the site.

The user may write only one sentence. You still ship a finished site.

Rules:
- One page a visitor can read. Keep the facts they stated. When they point at an example, that example supplies the layout.
- Instructions are not page copy. Never print "I want a website", "like the example", "like the link I sent", or "the project name is".
- If the request names the project, that name is the title. It is not the text of every section.
- A URL is an example to follow, not a line to publish, unless they explicitly ask to show that address.
- When a reference page or its screenshot is attached, that picture is the layout. Rebuild the same regions in the same order and at a similar size: navigation, headings, cards, tables, buttons, and the space between them. Swap the reference brand for the user's site name. Keep the reference's section labels. A list or table keeps its columns and a few sample rows. Do not copy wallet addresses, private balances, or account emails. Do not print the request or the URL.
- The site name is the brand in the header and the document title. Do not repeat it in every box, heading, or sentence.
- If the reference is a sign-in screen, build a sign-in screen in that style under the user's site name. Do not pretend a visitor is already signed in.
- If they gave only a name and no reference, ship a finished page for that name. Do not paste their prompt into the page.
- Do not add a second page they did not ask for. A reference that is one long page stays one long page.
- Use colors the prompt names. If it names none, follow the reference colors. If there is no reference, use a dark page (#15161b), near-white type (#f4f4f5), a mint band (#86efac), and a charcoal panel (#1c1d24).
- Do not draw a character, a creature, or a ball. Do not use the word Pokemon. Do not draw a fake browser window, address bar, or close button.
- Write in English. Keep every name, price, time, and place exactly as written.
- If the user describes records, a form, bookings, orders, messages, or a Database block, fill the database array. Each item is one collection: a short lowercase name and the field names visitors type. If nothing is stored, return an empty database array.
- Do not invent a save script. The page runtime saves any form marked data-p0k-save. You may omit those forms; the runtime adds them from the database array.
- A sentence that only refuses something, such as "no phone number", is an instruction. Do not print it.
- The site is one element: <section class="view" id="home">...</section>. Put the whole page inside it.
- html is a complete document: doctype, head, one style tag, and body. No JavaScript. No external stylesheets or scripts.
- Match the reference width. A wide example stays wide. With no reference, the page still reads on a phone.
- title is only the site name.`;

const REVISE = `You already built this site. Revise it and return the full HTML document in the html field.

Rules:
- Change only what the latest note asks for. Leave every other line, color, and fact as it is.
- Do not print the change note itself.
- Keep it one website page. Do not add pages the note did not ask for.
- Keep any database collection the page already stores. Add or remove a collection only when the note asks. If nothing is stored, return an empty database array.
- Keep the site in English. Keep names, prices, times, and places unless the note changes them.
- A sentence that only refuses something is an instruction. Do not print it.
- Stay in this one file. Do not link to /docs, another file, or an empty page.
- html is a complete document: doctype, head, one style tag, and body. No JavaScript. No external stylesheets or scripts.
- title is only the site name.`;

function clip(value, max) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

const VIEW_STYLE =
  '<style id="p0k-views">body .view{display:none !important}body .view.on{display:block !important}body:not(:has(.view.on)) .view:first-of-type{display:block !important}</style>';

const VIEW_SCRIPT = `<script id="p0k-switch">
(function () {
  function show(view) {
    document.querySelectorAll(".view").forEach(function (item) {
      item.classList.toggle("on", item === view);
    });
    window.scrollTo(0, 0);
  }
  var first = document.querySelector(".view");
  if (first && !document.querySelector(".view.on")) first.classList.add("on");
  document.addEventListener("click", function (event) {
    var node = event.target.closest("a, button");
    if (!node || node.closest("form")) return;
    var href = node.getAttribute("href") || "";
    if (/^(mailto:|tel:|https?:)/i.test(href)) return;
    var id = "";
    if (href.charAt(0) === "#") {
      var rawId = href.slice(1).split("?")[0];
      try { id = decodeURIComponent(rawId); } catch (e) { id = rawId; }
    }
    if (!id && node.tagName === "BUTTON") {
      id = (node.textContent || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    }
    var view = id && document.getElementById(id);
    if (!view) return;
    event.preventDefault();
    if (view.classList.contains("view")) show(view);
    else view.scrollIntoView({ block: "start" });
  }, true);
})();
</script>`;

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\.html?$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function knownId(name, ids) {
  if (!name) return "";
  if (ids.has(name)) return name;
  const folded = [...ids].find((item) => item.toLowerCase() === name.toLowerCase());
  return folded || "";
}

function resolveId(href, label, ids) {
  const raw = String(href || "").trim();
  if (raw.startsWith("#")) {
    const hash = decodeURIComponent(raw.slice(1).split(/[?#]/)[0]);
    return knownId(hash, ids) || slug(hash) || slug(label) || "page";
  }
  const last = raw.split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
  const base = last.replace(/\.html?$/i, "");
  const pick = base && base.toLowerCase() !== "index" ? slug(base) : slug(label);
  return knownId(pick, ids) || pick || "page";
}

const FINISH_STYLE = `<style id="p0k-finish">
html { font-size: 17px; }
body { margin: 0; line-height: 1.45; text-rendering: optimizeLegibility; }
body :where(button, input, textarea, select) { font: inherit; }
body :where(button, [type="submit"]) { min-height: 44px; padding: 0 16px; cursor: pointer; }
body :where(input, textarea, select) { width: 100%; min-height: 44px; padding: 10px 12px; border: 2px solid currentColor; background: transparent; color: inherit; }
body :where(textarea) { min-height: 96px; }
.p0k-data { display: block; }
.p0k-data-card { max-width: 680px; margin: 48px auto; padding: 28px 24px 32px; border: 1px solid color-mix(in srgb, currentColor 16%, transparent); border-radius: 24px; }
.p0k-kicker { margin: 0 0 8px; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; opacity: 0.62; }
form[data-p0k-save] { display: grid; gap: 14px; margin: 18px 0 28px; }
form[data-p0k-save] label { display: grid; gap: 6px; font-size: 14px; }
.p0k-list { display: grid; gap: 12px; }
.p0k-list article { padding: 14px 16px; border-radius: 16px; background: color-mix(in srgb, currentColor 6%, transparent); }
.p0k-list dt { font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.6; }
.p0k-list dd { margin: 0 0 8px; }
.p0k-status { min-height: 1.2em; font-size: 14px; }
.p0k-empty { opacity: 0.62; }
</style>`;

const DATA_SCRIPT = `<script id="p0k-data">
(function () {
  function slug() {
    var host = location.hostname || "";
    if (/^[a-z0-9-]+\\.(p0k|p0f)\\.site$/.test(host) && host !== "www.p0k.site" && host !== "www.p0f.site") return host.split(".")[0];
    var match = (location.pathname || "").match(/\\/s\\/([a-z0-9-]+)/);
    return match ? match[1] : "";
  }
  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }
  function paint(node, records) {
    if (!records.length) {
      node.innerHTML = '<p class="p0k-empty">No records yet.</p>';
      return;
    }
    node.innerHTML = records.map(function (record) {
      var rows = Object.keys(record).filter(function (key) { return key !== "savedAt"; }).map(function (key) {
        return "<dt>" + esc(key) + "</dt><dd>" + esc(record[key]) + "</dd>";
      }).join("");
      return "<article><dl>" + rows + "</dl></article>";
    }).join("");
  }
  function load(name) {
    var site = slug();
    var lists = document.querySelectorAll('[data-p0k-list="' + name + '"], [data-p0f-list="' + name + '"]');
    if (!site) {
      lists.forEach(function (node) { node.innerHTML = '<p class="p0k-empty">Records appear on the published site.</p>'; });
      return;
    }
    fetch("/api/data?slug=" + encodeURIComponent(site) + "&collection=" + encodeURIComponent(name))
      .then(function (response) { return response.json(); })
      .then(function (data) { lists.forEach(function (node) { paint(node, data.records || []); }); })
      .catch(function () { lists.forEach(function (node) { node.innerHTML = '<p class="p0k-empty">The records did not load.</p>'; }); });
  }
  document.querySelectorAll("[data-p0k-list], [data-p0f-list]").forEach(function (node) { load(node.getAttribute("data-p0k-list") || node.getAttribute("data-p0f-list")); });
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form || !form.matches || !form.matches("[data-p0k-save], [data-p0f-save]")) return;
    event.preventDefault();
    var name = form.getAttribute("data-p0k-save") || form.getAttribute("data-p0f-save");
    var status = form.querySelector("[data-p0k-status], [data-p0f-status]");
    var site = slug();
    if (!site) {
      if (status) status.textContent = "Publish the site before saving a record.";
      return;
    }
    var record = {};
    new FormData(form).forEach(function (value, key) { record[key] = value; });
    if (status) status.textContent = "Saving.";
    fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: site, collection: name, record: record })
    }).then(function (response) {
      if (!response.ok) throw new Error("save");
      form.reset();
      if (status) status.textContent = "Saved.";
      load(name);
    }).catch(function () {
      if (status) status.textContent = "That record was not saved.";
    });
  });
})();
</script>`;

function cleanDatabase(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const rows = [];
  for (const item of value.slice(0, 4)) {
    const name = String(item?.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const fields = [];
    for (const field of (Array.isArray(item.fields) ? item.fields : []).slice(0, 8)) {
      const key = String(field || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
      if (key && !fields.includes(key)) fields.push(key);
    }
    rows.push({ name, fields: fields.length ? fields : ["note"] });
  }
  return rows;
}

function fieldLabel(name) {
  return name.replace(/-/g, " ").replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function databaseBlock(collection) {
  const fields = collection.fields.map((name) => {
    const control = name === "note" || name === "message"
      ? `<textarea name="${name}" required maxlength="400"></textarea>`
      : `<input name="${name}" required maxlength="80">`;
    return `<label>${fieldLabel(name)}${control}</label>`;
  }).join("");
  return `<section class="p0k-data" id="p0k-${collection.name}">
<div class="p0k-data-card">
<p class="p0k-kicker">Database</p>
<h2>${fieldLabel(collection.name)}</h2>
<form data-p0k-save="${collection.name}">
${fields}
<button type="submit">Save</button>
<p class="p0k-status" data-p0k-status></p>
</form>
<div class="p0k-list" data-p0k-list="${collection.name}"></div>
</div>
</section>`;
}

function attachDatabase(html, database) {
  const missing = database.filter((item) => !new RegExp(`data-p0[fk]-save\\s*=\\s*["']${item.name}["']`, "i").test(html));
  if (!missing.length) return html;
  const block = missing.map(databaseBlock).join("");
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : `${html}${block}`;
}

function finishPage(html, database) {
  let next = attachDatabase(sealPage(html), database);
  next = next.replace(/<style id="p0[fk]-finish">[\s\S]*?<\/style>/i, "");
  next = next.replace(/<script id="p0[fk]-data">[\s\S]*?<\/script>/i, "");
  next = /<\/head>/i.test(next) ? next.replace(/<\/head>/i, `${FINISH_STYLE}</head>`) : `${FINISH_STYLE}${next}`;
  next = /<\/body>/i.test(next) ? next.replace(/<\/body>/i, `${DATA_SCRIPT}</body>`) : `${next}${DATA_SCRIPT}`;
  return next;
}

function escapeReg(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markView(html, id) {
  const pattern = new RegExp(`<(?!a\\b)([a-z0-9]+)\\b([^>]*\\sid\\s*=\\s*["']${escapeReg(id)}["'][^>]*)>`, "i");
  return html.replace(pattern, (full, tag, attrs) => {
    if (/\bclass\s*=\s*["'][^"']*\bview\b/.test(attrs)) return full;
    if (/\bclass\s*=/.test(attrs)) {
      return `<${tag}${attrs.replace(/\bclass\s*=\s*(["'])([\s\S]*?)\1/, (match, quote, names) => `class=${quote}${names} view${quote}`)}>`;
    }
    return `<${tag}${attrs} class="view">`;
  });
}

export function sealPage(html) {
  const ids = new Set();
  for (const match of html.matchAll(/\sid\s*=\s*["']([^"']+)["']/gi)) ids.add(match[1]);
  const linked = [];

  html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (full, attrs, inner) => {
    const hrefMatch = attrs.match(/\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    let next = attrs.replace(/\starget\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+)/gi, "");
    if (!hrefMatch) return `<a${next}>${inner}</a>`;
    const href = (hrefMatch[1] ?? hrefMatch[2] ?? hrefMatch[3] ?? "").trim();
    if (/^(mailto:|tel:|https?:)/i.test(href)) return `<a${next}>${inner}</a>`;
    const label = inner.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const id = resolveId(href, label, ids);
    linked.push(id);
    next = hrefMatch[0].includes("href")
      ? next.replace(hrefMatch[0], ` href="#${id}"`)
      : `${next} href="#${id}"`;
    return `<a${next}>${inner}</a>`;
  });

  for (const id of linked) {
    if (knownId(id, ids)) html = markView(html, knownId(id, ids));
  }

  html = html.replace(/<style id="p0[fk]-views">[\s\S]*?<\/style>/i, "");
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${VIEW_STYLE}</head>`)
    : `${VIEW_STYLE}${html}`;
  html = /<\/body>/i.test(html)
    ? html.replace(/<\/body>/i, `${VIEW_SCRIPT}</body>`)
    : `${html}${VIEW_SCRIPT}`;
  return html;
}

function stripMarkup(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\/?>/gi, "")
    .replace(/<(iframe|object|embed|base)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(iframe|object|embed|base)\b[^>]*\/?>/gi, "")
    .replace(/<link\b[^>]*rel\s*=\s*["']?[^"'>]*stylesheet[^>]*>/gi, "")
    .replace(/<meta\b[^>]*http-equiv\s*=\s*["']?\s*(?:refresh|content-security-policy|x-frame-options)\b[^>]*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src|action|formaction)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[\s\S]*?\2/gi, " $1=$2#$2")
    .replace(/\s(href|src|action|formaction)\s*=\s*(?:javascript|data|vbscript):[^\s>]*/gi, "");
}

export function sanitizePage(raw, prompt = "") {
  let html = stripMarkup(raw?.html || "")
    .trim()
    .slice(0, 120000);
  if (html && !/<html[\s>]/i.test(html)) {
    html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${html}</body></html>`;
  }
  if (!html) {
    const error = new Error("Grok did not return a page.");
    error.status = 502;
    throw error;
  }
  let database = cleanDatabase(raw?.database);
  if (!database.length && /database\s*:/i.test(prompt)) {
    database = [{ name: "records", fields: ["name", "note"] }];
  }
  return {
    title: clip(raw?.title, 80) || "Your page",
    html: finishPage(html, database),
    database,
  };
}

function pageText(data) {
  const message = data?.choices?.[0]?.message;
  return String(message?.content || message?.refusal || "").trim();
}

function publicError(status, message) {
  if (status === 429 || /quota|credit|billing|exhausted/i.test(message)) {
    return "Grok is out of credits. Try again after the xAI balance is topped up.";
  }
  if (status === 503 || /high demand|unavailable/i.test(message)) {
    return "Grok is busy right now. Try that sentence again.";
  }
  if (/api key|permission|unauthenticated|incorrect/i.test(message)) {
    return "The writing service rejected its key.";
  }
  if (/timeout|aborted/i.test(message)) {
    return "Grok is slow right now. Try that sentence again.";
  }
  return "Grok did not write the page.";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const inflight = new Map();
const recent = new Map();

function fingerprint(value) {
  let hash = 2166136261;
  const text = String(value);
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function clientIp(req) {
  const remote = req.socket?.remoteAddress || "";
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded && remote && remote !== "::1" && remote !== "127.0.0.1") {
    return forwarded.split(",")[0].trim() || remote;
  }
  return remote || "local";
}

export function guardGenerate(ip) {
  const now = Date.now();
  const bucket = recent.get(ip) || { active: 0, times: [] };
  bucket.times = bucket.times.filter((stamp) => now - stamp < 10 * 60 * 1000);
  if (bucket.active >= 2 || bucket.times.length >= 20) {
    recent.set(ip, bucket);
    const error = new Error("Too many pages at once. Wait a minute and try again.");
    error.status = 429;
    throw error;
  }
  bucket.active += 1;
  recent.set(ip, bucket);
  return () => {
    bucket.active = Math.max(0, bucket.active - 1);
    bucket.times.push(Date.now());
  };
}

export async function generatePage(prompt, apiKey, html = "", brief = "") {
  const text = String(prompt || "").trim();
  const current = String(html || "").trim().slice(0, 80000);
  const history = String(brief || "").trim().slice(0, 4000);
  if (text.length < 3) {
    const error = new Error(current ? "Write what to change." : "Write one sentence about the site.");
    error.status = 400;
    throw error;
  }
  const key = current ? `${text}\n${fingerprint(current)}` : text;
  if (inflight.has(key)) return inflight.get(key);
  const job = writePage(text, apiKey, current, history).finally(() => inflight.delete(key));
  inflight.set(key, job);
  return job;
}

const URL_IN_PROMPT = /https?:\/\/[^\s<>"')\]]+/gi;

export function interpretPrompt(text) {
  const urls = [];
  for (const match of String(text || "").matchAll(URL_IN_PROMPT)) {
    const url = match[0].replace(/[.,;:!?]+$/g, "");
    if (url && !urls.includes(url)) urls.push(url);
  }
  const named = String(text || "").match(
    /\b(?:project|site|brand|business|shop|restaurant|page)\s+name\s+(?:is\s+|called\s+)?["“']?([A-Za-z0-9][A-Za-z0-9 ._-]{0,48})/i,
  );
  const called = String(text || "").match(/\b(?:called|named)\s+["“']?([A-Za-z0-9][A-Za-z0-9_-]{0,40})/i);
  const name = (named?.[1] || called?.[1] || "").replace(/[.\s]+$/g, "").slice(0, 80);
  return { name, urls: urls.slice(0, 1) };
}

function nameStamp(html, name) {
  const brand = String(name || "").trim().toLowerCase();
  if (brand.length < 3) return false;
  const words = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (words.length < 8) return false;
  const hits = words.filter((word) => word === brand).length;
  return hits >= 4 && hits / words.length > 0.2;
}

function printsInstructions(html, prompt) {
  const plain = String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
  const source = String(prompt || "").toLowerCase();
  const markers = [
    "i want make a website",
    "i want make site",
    "i want to make a website",
    "like example that i sent",
    "like the example",
    "like the link",
    "project name called",
    "the project name",
  ];
  return markers.some((marker) => source.includes(marker) && plain.includes(marker));
}

function userMessage(text, html, brief, reference = null, extra = "") {
  if (html) {
    const history = brief ? `Brief so far:\n${brief}\n\n` : "";
    return `${history}Current HTML:\n${html}\n\nApply this change. Keep everything the note does not mention.\n${text.slice(0, 2000)}`;
  }
  const read = interpretPrompt(text);
  const instructional = Boolean(read.urls.length || read.name || /\b(i want|make a website|like the|like this|like example)\b/i.test(text));
  if (!instructional && !reference) return text.slice(0, 2000);
  const lines = ["Build one new site from this request. Do not print the instructions."];
  if (read.name) {
    lines.push(`Site name: ${read.name}. Put that name in the header. Do not use it as the text of every section.`);
  }
  if (reference?.url) {
    lines.push(`Reference page: ${reference.url}`);
    lines.push(
      reference.image
        ? "The attached screenshot is the page to rebuild. Copy its structure, spacing, and colors. Replace only the brand with the site name. Do not collapse it into a title and two boxes."
        : "Use the visible text below as the example. Rebuild those sections in that order. Replace only the brand with the site name.",
    );
    lines.push("Do not copy account emails, balances, or private data. Do not print this request or the reference URL.");
    if (reference.text) lines.push(`Visible text from the reference:\n${reference.text}`);
  } else if (read.urls.length) {
    lines.push(
      `The user pointed at ${read.urls[0]} as an example. That page could not be opened. Use the site name, and do not print the instructions or the URL.`,
    );
  }
  if (extra) lines.push(extra);
  lines.push(`Request:\n${text.slice(0, 2000)}`);
  const content = lines.join("\n\n");
  if (!reference?.image) return content;
  return [
    { type: "text", text: content },
    {
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${reference.image}`, detail: "high" },
    },
  ];
}

async function loadReference(url) {
  try {
    const { readReference } = await import("./preview.js");
    return await Promise.race([
      readReference(url),
      new Promise((resolve) => setTimeout(() => resolve(null), 22000)),
    ]);
  } catch {
    return null;
  }
}

async function complete(apiKey, html, message) {
  let response;
  try {
    response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: html ? REVISE : SYSTEM },
          { role: "user", content: message },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "page",
            strict: true,
            schema: SCHEMA,
          },
        },
      }),
    });
  } catch (cause) {
    const error = new Error("Grok is slow right now. Try that sentence again.");
    error.status = 502;
    error.retry = true;
    console.error("Grok generate failed:", cause instanceof Error ? cause.name : "error");
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data?.error?.message || "";
    console.error("Grok generate failed:", response.status, detail.slice(0, 180));
    const error = new Error(publicError(response.status, detail));
    error.status = 502;
    error.vision = response.status === 400 && Array.isArray(message);
    error.retry = response.status === 503 || response.status === 429;
    throw error;
  }
  return data;
}

async function requestPage(text, apiKey, html = "", brief = "", reference = null, extra = "") {
  let message = userMessage(text, html, brief, reference, extra);
  let data;
  try {
    data = await complete(apiKey, html, message);
  } catch (error) {
    if (!error.vision) throw error;
    message = userMessage(text, html, brief, reference ? { ...reference, image: "" } : null, extra);
    data = await complete(apiKey, html, message);
  }

  const written = pageText(data).replace(/^```json\s*|```$/g, "").trim();
  try {
    const page = sanitizePage(JSON.parse(written), text);
    const read = html ? { name: "" } : interpretPrompt(text);
    if (read.name) page.title = read.name;
    return page;
  } catch {
    const error = new Error("The page came back in a shape we could not use.");
    error.status = 502;
    throw error;
  }
}

async function writePage(text, apiKey, html = "", brief = "") {
  if (!apiKey) {
    const error = new Error("The writing service has no key yet.");
    error.status = 503;
    throw error;
  }

  const example = html ? "" : interpretPrompt(text).urls[0] || "";
  const reference = example ? await loadReference(example) : null;
  let last;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const page = await requestPage(text, apiKey, html, brief, reference);
      const stamped = !html && nameStamp(page.html, interpretPrompt(text).name);
      if (!html && (printsInstructions(page.html, text) || stamped)) {
        return requestPage(
          text,
          apiKey,
          html,
          brief,
          reference,
          stamped
            ? "The last draft repeated the site name in every region. Rebuild the reference layout. The name appears as the brand, not as every heading."
            : "The last draft printed the user's instructions. Delete those sentences. Keep the site name and the layout.",
        );
      }
      return page;
    } catch (error) {
      last = error;
      if (!error.retry) throw error;
      await wait(700 * (attempt + 1));
    }
  }
  throw last;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 200_000) {
        reject(Object.assign(new Error("That prompt is too long."), { status: 400 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(Object.assign(new Error("The prompt did not arrive."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

export async function handleGenerate(req, res, apiKey) {
  let done = () => {};
  try {
    done = guardGenerate(clientIp(req));
    const body = await readJson(req);
    await gateGenerate({ wallet: body.wallet, signature: body.signature, slug: body.slug });
    const page = await generatePage(body.prompt, apiKey, body.html, body.brief);
    await noteGenerated({ wallet: body.wallet, signature: body.signature, slug: body.slug });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ page }));
  } finally {
    done();
  }
}
