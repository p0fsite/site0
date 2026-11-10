const UPSTREAMS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

function readBody(req) {
  if (req.body) {
    const text = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    return Promise.resolve(Buffer.from(text));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 20_000) {
        reject(new Error("That request is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export async function handleRpc(req, res) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end("POST a Solana request.");
    return;
  }
  const body = await readBody(req);
  let lastStatus = 502;
  let lastText = '{"jsonrpc":"2.0","error":{"code":-32000,"message":"The network did not answer."}}';
  for (const url of UPSTREAMS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const text = await response.text();
      if (response.ok && !text.includes('"error"')) {
        res.statusCode = 200;
        res.setHeader("content-type", "application/json");
        res.end(text);
        return;
      }
      lastStatus = response.status;
      lastText = text;
    } catch {
      continue;
    }
  }
  res.statusCode = lastStatus === 200 ? 502 : lastStatus;
  res.setHeader("content-type", "application/json");
  res.end(lastText);
}
