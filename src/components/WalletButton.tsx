import { AlertTriangle, Loader2, Wallet } from "lucide-react";
import { useWallet } from "../lib/wallet";
import { short } from "../lib/format";

export function WalletButton() {
  const { available, account, correctNetwork, connecting, connect, switchNetwork } = useWallet();

  if (account && correctNetwork) {
    return (
      <a
        href="#join"
        className="chip border-leaf/40 text-leaf bg-leaf/10 !normal-case !tracking-normal !text-[13px] !py-2.5 !px-5 hover:bg-leaf/15 transition-colors"
        title="Wallet connected on Studionet"
      >
        <span className="relative h-2 w-2 rounded-full bg-leaf pulse" />
        {short(account)}
      </a>
    );
  }

  if (account && !correctNetwork) {
    return (
      <button
        onClick={() => void switchNetwork()}
        className="chip border-wax/40 text-wax bg-wax/10 !normal-case !tracking-normal !text-[13px] !py-2.5 !px-5 hover:bg-wax/15 transition-colors"
      >
        <AlertTriangle size={14} />
        Switch to Studionet
      </button>
    );
  }

  return (
    <button onClick={() => void connect()} className="btn-ink !py-2.5 !px-5 text-[13px]" disabled={connecting}>
      {connecting ? <Loader2 size={15} className="animate-spin" /> : <Wallet size={15} />}
      {connecting ? "Connecting…" : available ? "Connect wallet" : "Install MetaMask"}
    </button>
  );
}
