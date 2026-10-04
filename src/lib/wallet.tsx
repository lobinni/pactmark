import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from "react";
import { ensureNetwork, network } from "./contract";

type WalletState = {
  available: boolean;
  account: string;
  chainId: string;
  correctNetwork: boolean;
  connecting: boolean;
  error: string;
  connect: () => Promise<void>;
  switchNetwork: () => Promise<void>;
};

const WalletContext = createContext<WalletState | null>(null);

export function describeWalletError(error: unknown): string {
  const code = (error as { code?: number })?.code;
  if (code === 4001) return "The request was rejected in MetaMask.";
  const message = error instanceof Error ? error.message : String(error);
  const match = message.match(/REJECTED: [^"\\]*/);
  if (match) return match[0] + ".";
  return message.length > 220 ? message.slice(0, 220) + "…" : message;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const wanted = useMemo(() => `0x${network.chainId.toString(16)}`.toLowerCase(), []);

  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    setAvailable(true);
    provider
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        const list = accounts as string[];
        if (list?.[0]) setAccount(list[0]);
      })
      .catch(() => undefined);
    provider
      .request({ method: "eth_chainId" })
      .then((id) => setChainId(String(id).toLowerCase()))
      .catch(() => undefined);

    const onAccounts = (...args: unknown[]) => {
      const list = args[0] as string[];
      setAccount(list?.[0] ?? "");
    };
    const onChain = (...args: unknown[]) => setChainId(String(args[0]).toLowerCase());
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = window.ethereum;
    if (!provider) {
      window.open("https://metamask.io/download/", "_blank", "noreferrer");
      return;
    }
    setConnecting(true);
    setError("");
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      if (!accounts?.[0]) throw new Error("No account was selected.");
      setAccount(accounts[0]);
      let id = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
      if (id !== wanted) {
        await ensureNetwork();
        id = String(await provider.request({ method: "eth_chainId" })).toLowerCase();
      }
      setChainId(id);
    } catch (cause) {
      setError(describeWalletError(cause));
    } finally {
      setConnecting(false);
    }
  }, [wanted]);

  const switchNetwork = useCallback(async () => {
    setError("");
    try {
      await ensureNetwork();
      const id = await window.ethereum?.request({ method: "eth_chainId" });
      setChainId(String(id).toLowerCase());
    } catch (cause) {
      setError(describeWalletError(cause));
    }
  }, []);

  const value: WalletState = {
    available,
    account,
    chainId,
    correctNetwork: chainId === wanted,
    connecting,
    error,
    connect,
    switchNetwork,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
