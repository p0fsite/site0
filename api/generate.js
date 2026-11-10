import { clientIp, generatePage, guardGenerate } from "../server/generate.js";
import { gateGenerate, noteGenerated } from "../server/sites.js";

export const maxDuration = 120;

function readBody(req) {
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
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "POST a prompt." }));
    return;
  }
  let done = () => {};
  try {
    done = guardGenerate(clientIp(req));
    const body = await readBody(req);
    await gateGenerate({ wallet: body.wallet, signature: body.signature, slug: body.slug });
    const page = await generatePage(body.prompt, process.env.XAI_API_KEY, body.html, body.brief);
    await noteGenerated({ wallet: body.wallet, signature: body.signature, slug: body.slug });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ page }));
  } catch (error) {
    const message = error instanceof Error && error.message
      ? error.message
      : "The page did not get written.";
    console.error("generate:", message);
    if (res.headersSent || res.writableEnded) return;
    res.statusCode = error?.status || 502;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: message }));
  } finally {
    done();
  }
}
