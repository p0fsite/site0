import { GENERATE_TOKENS, TOKEN_MINT } from "../src/content.js";

const UPSTREAMS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];

async function rpc(method, params) {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  let last = "The network did not answer.";
  for (const url of UPSTREAMS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      const data = await response.json();
      if (data.result !== undefined) return data.result;
      last = data.error?.message || last;
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
  }
  throw new Error(last);
}

function tokenAmount(row) {
  const shown = row?.uiTokenAmount?.uiAmountString ?? row?.uiTokenAmount?.uiAmount;
  if (shown !== null && shown !== undefined && shown !== "") {
    const value = Number(shown);
    if (Number.isFinite(value)) return value;
  }
  const decimals = Number(row?.uiTokenAmount?.decimals);
  const raw = Number(row?.uiTokenAmount?.amount);
  if (Number.isFinite(decimals) && Number.isFinite(raw)) return raw / 10 ** decimals;
  return 0;
}

function burnInfos(tx) {
  const infos = [];
  const take = (ix) => {
    const type = ix?.parsed?.type;
    if (type === "burnChecked" || type === "burn") infos.push(ix.parsed.info || {});
  };
  for (const ix of tx?.transaction?.message?.instructions || []) take(ix);
  for (const group of tx?.meta?.innerInstructions || []) {
    for (const ix of group.instructions || []) take(ix);
  }
  return infos;
}

function shownAmount(info) {
  const shown = info?.tokenAmount?.uiAmountString ?? info?.tokenAmount?.uiAmount;
  if (shown !== null && shown !== undefined && shown !== "") {
    const value = Number(shown);
    if (Number.isFinite(value)) return value;
  }
  const decimals = Number(info?.tokenAmount?.decimals);
  const raw = Number(info?.tokenAmount?.amount ?? info?.amount);
  if (Number.isFinite(decimals) && Number.isFinite(raw)) return raw / 10 ** decimals;
  return 0;
}

function burnedBy(tx, wallet) {
  for (const info of burnInfos(tx)) {
    if (info.mint !== TOKEN_MINT) continue;
    const authority = info.authority || info.owner || "";
    if (wallet && authority !== wallet) continue;
    const amount = shownAmount(info);
    if (amount + 0.000001 >= GENERATE_TOKENS) return amount;
  }
  const pre = balances(tx?.meta?.preTokenBalances);
  const post = balances(tx?.meta?.postTokenBalances);
  const dropped = (pre.get(wallet) || 0) - (post.get(wallet) || 0);
  if (dropped + 0.000001 < GENERATE_TOKENS) return 0;
  let moved = 0;
  for (const owner of new Set([...pre.keys(), ...post.keys()])) {
    if (owner === wallet) continue;
    moved += Math.max(0, (post.get(owner) || 0) - (pre.get(owner) || 0));
  }
  const destroyed = dropped - moved;
  return destroyed + 0.000001 >= GENERATE_TOKENS ? destroyed : 0;
}

export async function assertBurned(signature, wallet) {
  const sig = String(signature || "").trim();
  const owner = String(wallet || "").trim();
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(sig) || !owner) {
    throw Object.assign(new Error("Burn 10,000 tokens before this site can be posted."), { status: 402 });
  }
  let last = "The burn is not confirmed yet.";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    let tx = null;
    try {
      tx = await rpc("getTransaction", [sig, {
        encoding: "jsonParsed",
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      }]);
    } catch (error) {
      last = error instanceof Error ? error.message : last;
    }
    if (tx?.meta?.err) {
      throw Object.assign(new Error("That burn failed on the network."), { status: 402 });
    }
    if (tx?.meta && burnedBy(tx, owner) > 0) return sig;
    const settled = Array.isArray(tx?.meta?.preTokenBalances) || Array.isArray(tx?.meta?.postTokenBalances);
    const loggedBurn = (tx?.meta?.logMessages || []).some((line) => /Instruction:\s*Burn/i.test(line));
    if (tx?.meta && settled && !loggedBurn) {
      throw Object.assign(new Error("That transaction did not burn 10,000 tokens."), { status: 402 });
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw Object.assign(new Error(last), { status: 402 });
}

export function burnsWithSites(sites, burns) {
  const list = Array.isArray(burns) ? burns.slice() : [];
  const seen = new Set(list.map((item) => item.signature));
  for (const site of sites || []) {
    const signature = site?.burnSignature;
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    const time = Math.floor(Date.parse(site.publishedAt) / 1000);
    list.push({
      signature,
      time: Number.isFinite(time) ? time : 0,
      amount: GENERATE_TOKENS,
      wallet: site.wallet || "",
    });
  }
  return list.sort((a, b) => b.time - a.time);
}

function balances(rows) {
  const map = new Map();
  for (const row of rows || []) {
    if (row?.mint === TOKEN_MINT && row.owner) map.set(row.owner, tokenAmount(row));
  }
  return map;
}

