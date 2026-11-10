import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, list, put } from "@vercel/blob";
import { TOKEN_MINT } from "../src/content.js";
import { assertBurned } from "./history.js";

const MAX_HTML = 500_000;

export function cleanSlug(value) {
  const slug = String(value || "").toLowerCase().trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)) return "";
  if (slug === "www") return "";
  return slug;
}

const INDEX = "sites/index.json";

function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

function pathname(slug) {
  return `sites/${slug}.html`;
}

function cleanTitle(title, html, slug) {
  const given = String(title || "").replace(/\s+/g, " ").trim().slice(0, 80);
  if (given) return given;
  const match = String(html || "").match(/<title[^>]*>([^<]{1,80})/i);
  const fromHtml = match ? match[1].replace(/\s+/g, " ").trim() : "";
  return fromHtml || slug;
}

function cleanWallet(value) {
  const wallet = String(value || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet) ? wallet : "";
}

async function readIndex() {
  if (blobReady()) {
    const file = await get(INDEX, { access: "private", useCache: false });
    if (!file || file.statusCode !== 200 || !file.stream) return [];
    try {
      const data = JSON.parse(await new Response(file.stream).text());
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), ".data", INDEX), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeIndex(rows) {
  const body = JSON.stringify(rows);
  if (blobReady()) {
    await put(INDEX, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const file = path.join(process.cwd(), ".data", INDEX);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

async function storedPages() {
  if (blobReady()) {
    const found = [];
    let cursor;
    do {
      const page = await list({ prefix: "sites/", limit: 1000, cursor });
      for (const blob of page.blobs || []) {
        const match = String(blob.pathname || "").match(/(?:^|\/)sites\/([a-z0-9-]+)\.html$/);
        if (!match || !cleanSlug(match[1])) continue;
        const uploaded = blob.uploadedAt instanceof Date ? blob.uploadedAt.toISOString() : "";
        found.push({ slug: match[1], title: match[1], wallet: "", publishedAt: uploaded });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }
  try {
    const dir = path.join(process.cwd(), ".data", "sites");
    const names = await readdir(dir);
    const found = [];
    for (const name of names) {
      const match = name.match(/^([a-z0-9-]+)\.html$/);
      if (!match) continue;
      const info = await stat(path.join(dir, name));
      found.push({
        slug: match[1],
        title: match[1],
        wallet: "",
        publishedAt: info.mtime.toISOString(),
      });
    }
    return found;
  } catch {
    return [];
  }
}

async function rememberSite(entry) {
  const rows = (await readIndex()).filter((row) => row && row.slug !== entry.slug);
  rows.unshift(entry);
  await writeIndex(rows.slice(0, 100));
}

export async function saveSite(slug, html, meta = {}) {
  if (html.length > MAX_HTML) {
    throw Object.assign(new Error("That page is too large to publish."), { status: 400 });
  }
  if (blobReady()) {
    await put(pathname(slug), html, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/html; charset=utf-8",
    });
  } else {
    const dir = path.join(process.cwd(), ".data", "sites");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${slug}.html`), html);
  }
  try {
    await rememberSite({
      slug,
      title: cleanTitle(meta.title, html, slug),
      wallet: cleanWallet(meta.wallet),
      publishedAt: new Date().toISOString(),
      burnSignature: String(meta.signature || ""),
    });
  } catch (error) {
    console.error("site index:", error instanceof Error ? error.message : error);
    if (meta.signature) throw error;
  }
}

export async function listSites() {
  const index = await readIndex();
  const known = new Set(index.map((row) => row.slug));
  const rows = index.filter((row) => row && cleanSlug(row.slug));
  for (const page of await storedPages()) {
    if (!known.has(page.slug)) rows.push(page);
  }
  rows.sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  return rows.slice(0, 50).map((row) => ({
    slug: row.slug,
    title: cleanTitle(row.title, "", row.slug),
    wallet: cleanWallet(row.wallet),
    publishedAt: String(row.publishedAt || ""),
    burnSignature: String(row.burnSignature || ""),
  }));
}

const BURNS = "sites/burns.json";
const GENERATE_USES = 4;

function mintOn() {
  return Boolean(String(TOKEN_MINT || "").trim());
}

async function readBurns() {
  if (blobReady()) {
    const file = await get(BURNS, { access: "private", useCache: false });
    if (!file || file.statusCode !== 200 || !file.stream) return [];
    try {
      const data = JSON.parse(await new Response(file.stream).text());
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), ".data", BURNS), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeBurns(rows) {
  const body = JSON.stringify(rows.slice(0, 400));
  if (blobReady()) {
    await put(BURNS, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const file = path.join(process.cwd(), ".data", BURNS);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

async function siteRow(slug) {
  const rows = await readIndex();
  return rows.find((row) => row?.slug === slug) || null;
}

async function burnRow(signature, wallet) {
  const sig = await assertBurned(signature, wallet);
  const burns = await readBurns();
  const found = burns.find((row) => row.signature === sig);
  if (found && found.wallet !== wallet) {
    throw Object.assign(new Error("That burn was already used."), { status: 402 });
  }
  if (found && found.uses >= GENERATE_USES) {
    throw Object.assign(new Error("That burn was already used. Approve a new one."), { status: 402 });
  }
  return { sig, burns, found };
}

export async function gateGenerate({ wallet, signature, slug }) {
  if (!mintOn()) return;
  const owner = cleanWallet(wallet);
  const site = cleanSlug(slug);
  if (site) {
    const existing = await siteRow(site);
    if (existing?.wallet && existing.wallet === owner) return;
    if (existing?.wallet && existing.wallet !== owner) {
      throw Object.assign(new Error("Only the wallet that published this site can change it."), { status: 403 });
    }
  }
  await burnRow(signature, owner);
}

export async function noteGenerated({ wallet, signature, slug }) {
  if (!mintOn()) return;
  const owner = cleanWallet(wallet);
  const site = cleanSlug(slug);
  if (site) {
    const existing = await siteRow(site);
    if (existing?.wallet && existing.wallet === owner) return;
  }
  const sig = String(signature || "").trim();
  if (!sig || !owner) return;
  const burns = await readBurns();
  const found = burns.find((row) => row.signature === sig);
  if (found && found.wallet !== owner) return;
  if (found) found.uses += 1;
  else burns.unshift({ signature: sig, wallet: owner, uses: 1 });
  await writeBurns(burns);
}

async function requireFreshBurn(signature, wallet, slug) {
  if (!mintOn()) return "";
  const sig = await assertBurned(signature, wallet);
  const rows = await readIndex();
  const reused = rows.find((row) => row?.burnSignature === sig && row.slug !== slug);
  if (reused) {
    throw Object.assign(new Error("That burn was already used for another site."), { status: 402 });
  }
  const burns = await readBurns();
  const found = burns.find((row) => row.signature === sig);
  if (found?.slug && found.slug !== slug) {
    throw Object.assign(new Error("That burn was already used for another site."), { status: 402 });
  }
  if (found && found.wallet !== wallet) {
    throw Object.assign(new Error("That burn was already used."), { status: 402 });
  }
  if (found) found.slug = slug;
  else burns.unshift({ signature: sig, wallet, uses: 1, slug });
  await writeBurns(burns);
  return sig;
}

export async function publishPage(body) {
  const slug = cleanSlug(body?.slug);
  const html = typeof body?.html === "string" ? body.html : "";
  if (!slug) throw Object.assign(new Error("That address cannot be used."), { status: 400 });
  if (!html.trim()) throw Object.assign(new Error("Write the page before publishing."), { status: 400 });
  const owner = cleanWallet(body?.wallet);
  if (!owner) throw Object.assign(new Error("Connect a Solana wallet, then publish."), { status: 401 });
  const existing = await siteRow(slug);
  if (existing?.wallet && existing.wallet !== owner) {
    throw Object.assign(new Error("Only the wallet that published this site can change it."), { status: 403 });
  }
  const ownerUpdate = Boolean(existing?.wallet && existing.wallet === owner);
  const burn = mintOn() && !ownerUpdate
    ? await requireFreshBurn(body?.signature, owner, slug)
    : existing?.burnSignature || "";
  await saveSite(slug, html, { title: body.title, wallet: owner, signature: burn });
  return { slug, url: `/s/${slug}` };
}

export async function readSiteHtml(slug) {
  if (blobReady()) {
    const file = await get(pathname(slug), { access: "private", useCache: false });
    if (!file || file.statusCode !== 200 || !file.stream) return "";
    return new Response(file.stream).text();
  }
  try {
    return await readFile(path.join(process.cwd(), ".data", "sites", `${slug}.html`), "utf8");
  } catch {
    return "";
  }
}

export function readJson(req, limit = MAX_HTML) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  if (typeof req.body === "string") {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve({});
    }
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error("That page is too large to publish."), { status: 400 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}
