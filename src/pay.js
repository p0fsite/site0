import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createSolanaRpc,
  createTransactionMessage,
  getBase64Encoder,
  getTransactionEncoder,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
} from "@solana/kit";
import {
  TOKEN_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getBurnCheckedInstruction,
} from "@solana-program/token";
import { getBase58Decoder } from "@solana/codecs-strings";
import { GENERATE_TOKENS, TOKEN_MINT } from "./content.js";

const TOKEN_2022 = address("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const RPC = createSolanaRpc(`${window.location.origin}/api/rpc`);

const paid = new Map();
let inflight = null;

export function tokenCharges() {
  return TOKEN_MINT.length > 0;
}

function failed(cause) {
  const message = cause instanceof Error ? cause.message : "";
  if (/reject|cancel|denied|closed/i.test(message)) return "The wallet did not send the tokens.";
  if (/Solana error|8100002|network did not answer/i.test(message)) {
    return "The network did not answer. Try again.";
  }
  return message.slice(0, 180) || "The wallet did not send the tokens.";
}

export function payForGenerate({ wallet, account, key }) {
  if (!tokenCharges()) return Promise.resolve("");
  if (!wallet || !account?.address) {
    return Promise.reject(new Error("Connect a wallet, then try again."));
  }
  if (paid.has(key)) return Promise.resolve(paid.get(key));
  if (inflight?.key === key) return inflight.promise;

  const promise = sendTokens(wallet, account).then((signature) => {
    paid.set(key, signature);
    if (inflight?.promise === promise) inflight = null;
    return signature;
  }).catch((cause) => {
    if (inflight?.promise === promise) inflight = null;
    throw new Error(failed(cause));
  });
  inflight = { key, promise };
  return promise;
}

export function paidSignature(key) {
  return paid.get(key) || "";
}

export function forgetPayment(key) {
  paid.delete(key);
}

async function sendTokens(wallet, account) {
  const mint = address(TOKEN_MINT);
  const owner = address(account.address);
  const signer = createNoopSigner(owner);
  const info = await RPC.getAccountInfo(mint, { encoding: "base64" }).send();
  const encoded = info.value?.data?.[0];
  if (!encoded) throw new Error("That contract is not on Solana yet.");
  const bytes = getBase64Encoder().encode(encoded);
  if (bytes.length < 45) throw new Error("That contract is not a token.");
  const decimals = bytes[44];
  const tokenProgram = info.value.owner === TOKEN_2022 ? TOKEN_2022 : TOKEN_PROGRAM_ADDRESS;
  const amount = BigInt(GENERATE_TOKENS) * 10n ** BigInt(decimals);
  const [source] = await findAssociatedTokenPda({ owner, mint, tokenProgram });
  const burn = getBurnCheckedInstruction(
    {
      account: source,
      mint,
      authority: signer,
      amount,
      decimals,
    },
    { programAddress: tokenProgram },
  );
  const { value: blockhash } = await RPC.getLatestBlockhash().send();
  const message = appendTransactionMessageInstructions(
    [burn],
    setTransactionMessageLifetimeUsingBlockhash(
      blockhash,
      setTransactionMessageFeePayer(owner, createTransactionMessage({ version: 0 })),
    ),
  );
  const transaction = getTransactionEncoder().encode(compileTransaction(message));
  const chain = account.chains?.find((item) => item.startsWith("solana:")) || "solana:mainnet";
  const feature = wallet.features?.["solana:signAndSendTransaction"];
  let sent;
  if (feature?.signAndSendTransaction && account.publicKey) {
    sent = await feature.signAndSendTransaction({ account, chain, transaction });
  } else if (typeof wallet.signAndSendTransaction === "function") {
    sent = await wallet.signAndSendTransaction({ transaction, chain });
  } else {
    throw new Error("This wallet cannot send a transaction.");
  }
  return signatureOf(sent);
}

function signatureOf(sent) {
  const result = Array.isArray(sent) ? sent[0] : sent;
  const value = result?.signature ?? result;
  if (typeof value === "string" && value.length > 32) return value;
  const bytes = value instanceof Uint8Array ? value : ArrayBuffer.isView(value) || Array.isArray(value) ? Uint8Array.from(value) : null;
  if (!bytes?.length) throw new Error("The wallet did not return the burn.");
  return getBase58Decoder().decode(bytes);
}
