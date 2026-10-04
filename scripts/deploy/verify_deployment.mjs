// Read-only verification of the live Pactmark deployment on Studionet.
//
// Usage (from the repository root, no private key required):
//
//   node scripts/deploy/verify_deployment.mjs
//
// The contract address is taken from deployments/studionet.json, which is the
// single source of truth committed to this repository. The script performs
// read-only contract calls against the public Studionet RPC and exits with a
// non-zero code when the deployed contract is unreachable or does not answer
// as Pactmark.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const manifest = JSON.parse(readFileSync(resolve(root, "deployments/studionet.json"), "utf8"));
const address = process.argv[2] || manifest.contractAddress;

if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
  console.error("No valid contract address configured in deployments/studionet.json.");
  process.exit(2);
}

const toPlain = (value) => {
  if (value instanceof Map) return Object.fromEntries([...value].map(([k, v]) => [k, toPlain(v)]));
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
};

const hours = (seconds) => `${Number(seconds) / 3600}h`;

console.log("Pactmark live deployment check");
console.log("  network           ", `${manifest.chainName} (chain ${manifest.chainId})`);
console.log("  rpc               ", manifest.rpcUrl);
console.log("  contract          ", address);
console.log("  explorer          ", `${manifest.explorerUrl}/address/${address}`);
console.log("");

const client = createClient({ chain: studionet });

let info;
try {
  info = toPlain(await client.readContract({ address, functionName: "get_protocol_info", args: [] }));
} catch (error) {
  console.error("FAILED: could not read get_protocol_info from the deployed contract.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

if (info?.protocol !== "Pactmark") {
  console.error(`FAILED: the contract at ${address} answered as ${info?.protocol ?? "an unknown protocol"}, not Pactmark.`);
  process.exit(1);
}

const count = toPlain(await client.readContract({ address, functionName: "agreement_count", args: [] }));
const accounting = toPlain(await client.readContract({ address, functionName: "get_accounting", args: [] }));

console.log("  protocol           ", info.protocol);
console.log("  owner              ", info.owner);
console.log("  currency           ", info.currency);
console.log("  juror pool         ", `${info.juror_pool_size} registered, stake ${info.juror_stake} wei`);
console.log("  jury               ", `${info.jury_size} seated, quorum ${info.jury_quorum}`);
console.log(
  "  windows            ",
  `freeze ${hours(info.windows.freeze)}, verify ${hours(info.windows.verify)}, dispute ${hours(info.windows.dispute)}, response ${hours(info.windows.response)}`
);
console.log("  agreements on chain", String(count));
console.log("  escrow locked      ", `${accounting.escrow_locked} wei`);
console.log("  withdrawable total ", `${accounting.claimable_total} wei`);
console.log("");
console.log("OK: the live contract at", address, "answers as Pactmark on Studionet.");
