import { publishPage, readJson } from "../server/sites.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "POST the page." }));
    return;
  }
  try {
    const page = await publishPage(await readJson(req));
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(page));
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : "The page did not go live.";
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = error?.status || 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  }
}
