import { cleanSlug, readSiteHtml } from "../server/sites.js";

function missing(slug) {
  const name = slug || "w00w";
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f6f4ef;color:#1a1814;font:16px/1.5 Geist,ui-sans-serif,system-ui,sans-serif">
  <p>This site is not published.</p>
</body>
</html>`;
}

export default async function handler(req, res) {
  const slug = cleanSlug(req.query?.slug);
  const html = slug ? await readSiteHtml(slug) : "";
  res.statusCode = html ? 200 : 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.end(html || missing(slug));
}
