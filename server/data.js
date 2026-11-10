import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { get, put } from "@vercel/blob";
import { cleanSlug } from "./sites.js";

const MAX_RECORDS = 80;

export function cleanCollection(value) {
  const name = String(value || "").toLowerCase().trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(name) ? name : "";
}

function cleanRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = {};
  for (const [key, raw] of Object.entries(value).slice(0, 8)) {
    const name = cleanCollection(key);
    const text = String(raw ?? "").replace(/\s+/g, " ").trim().slice(0, 400);
    if (name && text) record[name] = text;
  }
  return Object.keys(record).length ? record : null;
}

function fileFor(slug, collection) {
  return `data/${slug}/${collection}.json`;
}

function blobReady() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

async function readRows(slug, collection) {
  if (blobReady()) {
    const file = await get(fileFor(slug, collection), { access: "private", useCache: false });
    if (!file || file.statusCode !== 200 || !file.stream) return [];
    try {
      const data = JSON.parse(await new Response(file.stream).text());
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
  try {
    const data = JSON.parse(await readFile(path.join(process.cwd(), ".data", fileFor(slug, collection)), "utf8"));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeRows(slug, collection, rows) {
  const body = JSON.stringify(rows);
  if (blobReady()) {
    await put(fileFor(slug, collection), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return;
  }
  const file = path.join(process.cwd(), ".data", fileFor(slug, collection));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function listRecords(slug, collection) {
  const site = cleanSlug(slug);
  const name = cleanCollection(collection);
  if (!site || !name) return [];
  return (await readRows(site, name)).slice(-MAX_RECORDS).reverse();
}

export async function saveRecord(slug, collection, value) {
  const site = cleanSlug(slug);
  const name = cleanCollection(collection);
  const record = cleanRecord(value);
  if (!site || !name || !record) {
    throw Object.assign(new Error("That record needs a site and at least one field."), { status: 400 });
  }
  const rows = await readRows(site, name);
  rows.push({ ...record, savedAt: new Date().toISOString() });
  await writeRows(site, name, rows.slice(-MAX_RECORDS));
  return record;
}
