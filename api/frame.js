import { frameDocument, publicTarget, queryUrl } from "../server/preview.js";

export const maxDuration = 30;

export default async function handler(req, res) {
  try {
    const target = await publicTarget(queryUrl(req));
    if (!target) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.end("Paste a public http or https link.");
      return;
    }
    const framed = await frameDocument(target);
    res.statusCode = 200;
    res.setHeader("Content-Type", framed.type);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(framed.body);
  } catch (error) {
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = error?.status || 502;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.end(error instanceof Error ? error.message : "The page did not open.");
  }
}
