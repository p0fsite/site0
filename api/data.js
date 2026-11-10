import { listRecords, saveRecord } from "../server/data.js";
import { readJson } from "../server/sites.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const records = await listRecords(req.query?.slug || url.searchParams.get("slug"), req.query?.collection || url.searchParams.get("collection"));
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      res.end(JSON.stringify({ records }));
      return;
    }
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Send or read a record." }));
      return;
    }
    const body = await readJson(req, 20_000);
    const record = await saveRecord(body.slug, body.collection, body.record);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ record }));
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "The record was not saved.";
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = error?.status || 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
