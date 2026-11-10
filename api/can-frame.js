import { canFrame, publicTarget, queryUrl } from "../server/preview.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  try {
    const target = await publicTarget(queryUrl(req));
    if (!target) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Paste a public http or https link." }));
      return;
    }
    const frame = await canFrame(target);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "private, no-store");
    res.end(JSON.stringify({ frame }));
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = error?.status || 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "The page did not open." }));
  }
}
