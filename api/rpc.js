import { handleRpc } from "../server/rpc.js";

export default function handler(req, res) {
  return handleRpc(req, res);
}
