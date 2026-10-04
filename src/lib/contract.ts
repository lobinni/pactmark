import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import manifest from "../../deployments/studionet.json";

// The deployed contract is a property of this repository. It is imported from
// the deployment manifest above — never from environment variables — so every
// build (local, CI, Vercel) talks to the same on-chain contract.

export const network = manifest;
export const contractAddress = manifest.contractAddress.trim();
export const contractUrl = manifest.explorerAddressUrl;
export const deploymentTxUrl = `${manifest.explorerUrl}/tx/${manifest.deploymentTransaction}`;
export const explorerTx = (hash: string) => `${manifest.explorerUrl}/tx/${hash}`;
export const explorerAddress = (address: string) => `${manifest.explorerUrl}/address/${address}`;
export const validAddress = (value: string) => /^0x[a-fA-F0-9]{40}$/.test(value);

type Provider = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Provider;
  }
}

export async function ensureNetwork(): Promise<void> {
  const wallet = window.ethereum;
  if (!wallet) throw new Error("MetaMask is required to sign transactions.");
  const chainId = `0x${network.chainId.toString(16)}`;
  if (String(await wallet.request({ method: "eth_chainId" })).toLowerCase() === chainId) return;
  try {
    await wallet.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if ((error as { code?: number }).code !== 4902) throw error;
    await wallet.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId,
          chainName: network.chainName,
          nativeCurrency: network.currency,
          rpcUrls: [network.rpcUrl],
          blockExplorerUrls: [network.explorerUrl],
        },
      ],
    });
  }
}

export async function connectWallet(): Promise<string> {
  const wallet = window.ethereum;
  if (!wallet) throw new Error("MetaMask was not found. Install MetaMask to join the network.");
  const accounts = (await wallet.request({ method: "eth_requestAccounts" })) as string[];
  if (!accounts?.[0]) throw new Error("No account was selected.");
  await ensureNetwork();
  return accounts[0];
}

export function toPlain(value: unknown): unknown {
  if (value instanceof Map) {
    return Object.fromEntries([...value].map(([k, v]) => [k, toPlain(v)]));
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "bigint") return value.toString();
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toPlain(v)]));
  }
  return value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readContract(functionName: string, args: any[] = []) {
  const client = createClient({ chain: studionet });
  return toPlain(
    await client.readContract({
      address: contractAddress as `0x${string}`,
      functionName,
      args,
    })
  );
}

export async function writeContract(
  account: string,
  functionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[] = [],
  value?: bigint
) {
  await ensureNetwork();
  const client = createClient({
    chain: studionet,
    account: account as `0x${string}`,
    provider: window.ethereum as never,
  });
  const hash = await client.writeContract({
    address: contractAddress as `0x${string}`,
    functionName,
    args,
    value: value ?? BigInt(0),
  });
  const receipt = toPlain(
    await client.waitForTransactionReceipt({
      hash,
      status: TransactionStatus.ACCEPTED,
      interval: 5000,
      retries: 120,
    })
  ) as Record<string, unknown>;
  const status = String(receipt?.status_name || receipt?.statusName || receipt?.status || "");
  if (status && !/ACCEPTED|FINALIZED/i.test(status)) {
    throw new Error(`Transaction was not accepted (${status}).`);
  }
  return { hash, receipt };
}
