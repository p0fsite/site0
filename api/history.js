import { burnsWithSites } from "../server/history.js";
import { listSites } from "../server/sites.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "GET the history." }));
    return;
  }
  const sites = await listSites().catch(() => []);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "public, max-age=20");
  res.end(JSON.stringify({
    sites,
    burns: burnsWithSites(sites, []),
    burnsReady: true,
  }));
}
