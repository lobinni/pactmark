// Deploy the Pactmark intelligent contract to GenLayer Studionet.
//
// Usage (from the repository root):
//
//   python3 scripts/deploy/check_contract.py
//   PRIVATE_KEY=0x... node scripts/deploy/deploy.mjs
//
// The private key must belong to a funded Studionet test account and is used
// only for signing the deployment. It is never written to any file and must
// never be placed in a NEXT_PUBLIC_* or other client-visible variable.
//
// On success the helper waits for an accepted receipt, verifies the protocol
// read against the fresh address and updates both deployments/studionet.json
// and frontend/assets/config.js. The web app reads the address from the
// repository, so a redeploy only requires recommitting these files.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const contractFile = resolve(process.env.CONTRACT || resolve(root, "contracts/pactmark.py"));
const key = process.env.PRIVATE_KEY;

if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("Set PRIVATE_KEY to a funded 0x-prefixed 32-byte Studionet account key.");
  process.exit(2);
}

const code = readFileSync(contractFile, "utf8");
if (!code.includes("from genlayer import *")) {
  throw new Error("contracts/pactmark.py does not look like a GenLayer intelligent contract.");
}

const account = createAccount(key);
const client = createClient({ chain: studionet, account });
console.log("Deploying Pactmark to Studionet from", account.address);

const hash = await client.deployContract({ code, args: [], leaderOnly: false });
console.log("Deployment transaction:", hash);

const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.ACCEPTED,
  interval: 5000,
  retries: 120,
});

const status = String(receipt?.status_name || receipt?.statusName || receipt?.status || "");
if (status && !/ACCEPTED|FINALIZED/i.test(status)) {
  throw new Error("Deployment was not accepted: " + status);
}

const address =
  receipt?.data?.contract_address ??
  receipt?.txDataDecoded?.contractAddress ??
  receipt?.to_address;
if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
  console.error("The receipt did not contain an address. Inspect the transaction before configuring the app.");
  process.exit(1);
}

const info = await client.readContract({ address, functionName: "get_protocol_info", args: [] });
console.log("Protocol read:", info instanceof Map ? Object.fromEntries(info) : info);

const manifestPath = resolve(root, "deployments/studionet.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.contractAddress = address;
manifest.deploymentTransaction = hash;
manifest.status = "live";
manifest.explorerAddressUrl = `${manifest.explorerUrl}/address/${address}`;
manifest.deployedAt = new Date().toISOString();
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const configPath = resolve(root, "frontend/assets/config.js");
const config = {
  network: manifest.network,
  chainId: manifest.chainId,
  chainName: manifest.chainName,
  rpcUrl: manifest.rpcUrl,
  explorerUrl: manifest.explorerUrl,
  currency: manifest.currency,
  contractAddress: address,
  deploymentTransaction: hash,
  status: "live",
  explorerAddressUrl: manifest.explorerAddressUrl,
};
writeFileSync(
  configPath,
  "// Pactmark standalone frontend configuration.\n" +
    "// Source of truth: deployments/studionet.json\n" +
    "// This file is rewritten by scripts/deploy/deploy.mjs after each deployment.\n" +
    `window.PACTMARK_CONFIG = ${JSON.stringify(config, null, 2)};\n`
);

console.log("Contract address:", address);
console.log("Explorer:", manifest.explorerAddressUrl);
console.log("Updated deployments/studionet.json and frontend/assets/config.js. Commit both files.");
