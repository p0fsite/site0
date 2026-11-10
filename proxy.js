import { next, rewrite } from "@vercel/functions";

function hostName(request) {
  return (request.headers.get("x-forwarded-host") || request.headers.get("host") || "")
    .split(",")[0]
    .trim()
    .split(":")[0]
    .toLowerCase();
}

export default function proxy(request) {
  const url = new URL(request.url);
  const host = hostName(request);
  const root = host.endsWith(".p0k.site") ? ".p0k.site" : host.endsWith(".p0f.site") ? ".p0f.site" : "";
  const tenant = root ? host.slice(0, -root.length) : "";
  const published = url.pathname.match(/^\/s\/([a-z0-9-]+)\/?$/)?.[1];
  const slug = tenant && tenant !== "www" && !tenant.includes(".") ? tenant : published;
  if (slug && slug !== "www") {
    url.pathname = "/api/site";
    url.search = `?slug=${encodeURIComponent(slug)}`;
    return rewrite(url);
  }
  if (url.pathname.startsWith("/api/") || url.pathname.includes(".")) return next();
  if (url.pathname !== "/") {
    url.pathname = "/index.html";
    url.search = "";
    return rewrite(url);
  }
  return next();
}
