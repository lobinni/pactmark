import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BadgeCheck, Check, Copy, Coins, Gavel,
  Loader2, RefreshCw, Wallet,
} from "lucide-react";
import { explorerTx, network, readContract, writeContract } from "../lib/contract";
import { describeWalletError, useWallet } from "../lib/wallet";
import { formatGen, short } from "../lib/format";
import { useReveal } from "../hooks/useReveal";

/* eslint-disable @typescript-eslint/no-explicit-any */

const STUDIO_URL = "https://studio.genlayer.com";
const METAMASK_URL = "https://metamask.io/download/";

const steps = [
  {
    title: "Install MetaMask",
    text: "Any modern browser or phone works. Your keys stay in MetaMask — this app only ever asks it to sign.",
    link: METAMASK_URL,
    linkText: "metamask.io/download",
  },
  {
    title: "Connect and add Studionet",
    text: `One click grants access. If the network is missing, MetaMask offers to add ${network.chainName} — chain ${network.chainId}, RPC studio.genlayer.com/api, currency GEN — and switches to it.`,
  },
  {
    title: "Claim test GEN",
    text: "GenLayer Studio funds test accounts from its faucet. Studionet GEN has no monetary value and costs nothing to experiment with.",
    link: STUDIO_URL,
    linkText: "studio.genlayer.com",
  },
];

const roles = [
  { name: "Buyer", text: "creates agreements and funds exact-value escrow." },
  { name: "Worker", text: "accepts frozen terms, delivers and submits evidence." },
  { name: "Juror", text: "stakes GEN, sits on drand-drawn panels and votes commit–reveal to settle disputes." },
];

type ActionState = "idle" | "working" | "done" | "error";

export function Join() {
  const wallet = useWallet();
  const [balance, setBalance] = useState<string | null>(null);
  const [credit, setCredit] = useState<string | null>(null);
  const [stake, setStake] = useState<string>("100000000000000000");
  const [juror, setJuror] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [action, setAction] = useState<ActionState>("idle");
  const [actionError, setActionError] = useState("");
  const [txHash, setTxHash] = useState("");

  const refresh = useCallback(async () => {
    if (!wallet.account) return;
    setLoading(true);
    try {
      const provider = window.ethereum;
      if (provider) {
        const hex = (await provider.request({
          method: "eth_getBalance",
          params: [wallet.account, "latest"],
        })) as string;
        setBalance(BigInt(hex).toString());
      }
    } catch {
      setBalance(null);
    }
    try {
      setCredit(String(await readContract("get_balance", [wallet.account])));
    } catch {
      setCredit(null);
    }
    try {
      const info = (await readContract("get_protocol_info")) as Record<string, any>;
      if (info?.juror_stake) setStake(String(info.juror_stake));
    } catch {
      /* keep fallback stake */
    }
    try {
      const entry = (await readContract("get_juror", [wallet.account])) as Record<string, any>;
      setJuror(entry && entry.address ? entry : null);
    } catch {
      setJuror(null);
    }
    setLoading(false);
  }, [wallet.account]);

  useEffect(() => {
    if (wallet.account && wallet.correctNetwork) void refresh();
    if (!wallet.account) {
      setBalance(null);
      setCredit(null);
      setJuror(null);
    }
  }, [wallet.account, wallet.correctNetwork, refresh]);

  useReveal(wallet.account + action);

  async function copyAccount() {
    try {
      await navigator.clipboard.writeText(wallet.account);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function registerJuror() {
    setAction("working");
    setActionError("");
    setTxHash("");
    try {
      const { hash } = await writeContract(wallet.account, "register_juror", [], BigInt(stake));
      setTxHash(hash);
      setAction("done");
      await refresh();
    } catch (cause) {
      setActionError(describeWalletError(cause));
      setAction("error");
    }
  }

  const balanceBig = balance !== null ? BigInt(balance) : null;
  const stakeBig = BigInt(stake);
  const insufficient = balanceBig !== null && balanceBig < stakeBig;

  return (
    <section id="join" className="py-24 sm:py-32">
      <div className="wrap grid lg:grid-cols-[0.95fr_1.05fr] gap-14">
        <div>
          <p className="kicker" data-reveal>
            Join the network
          </p>
          <h2 className="display text-4xl sm:text-[52px] mt-7" data-reveal="1">
            Bring a wallet. Take a side.
          </h2>
          <p className="lede mt-6" data-reveal="2">
            Participation is a MetaMask connection away. Every agreement, evidence submission and
            jury vote is signed by you on {network.chainName} — the app never sees a private key.
          </p>

          <ol className="mt-10 space-y-7">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-5" data-reveal={String(i % 3 + 1) as never}>
                <span className="step-no shrink-0 pt-1">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <h3 className="font-semibold text-[15px]">{step.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-[1.8] text-ink-2 max-w-[52ch]">
                    {step.text}
                  </p>
                  {step.link && (
                    <a
                      href={step.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-medium text-wax hover:underline"
                    >
                      {step.linkText}
                      <ArrowUpRight size={13} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 border-t border-ink/60 pt-6" data-reveal="3">
            <p className="label mb-3">Pick your side</p>
            {roles.map((role) => (
              <p key={role.name} className="text-[13.5px] leading-[1.9] text-ink-2">
                <span className="font-semibold text-ink">{role.name}</span> {role.text}
              </p>
            ))}
          </div>
        </div>

        {/* wallet panel */}
        <div className="card p-8 lg:sticky lg:top-28 self-start" data-reveal="2">
          <div className="flex items-center justify-between">
            <p className="label">Your seat</p>
            {wallet.account && wallet.correctNetwork && (
              <button
                onClick={() => void refresh()}
                className="text-ink-3 hover:text-wax transition-colors"
                aria-label="Refresh wallet reads"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            )}
          </div>

          {!wallet.available && (
            <div className="mt-6 text-center">
              <Wallet size={26} strokeWidth={1.6} className="mx-auto text-wax" />
              <p className="mt-4 font-display text-xl font-medium">MetaMask not detected</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2 max-w-[38ch] mx-auto">
                Install the extension, then return here — the connect button will add Studionet for
                you automatically.
              </p>
              <a href={METAMASK_URL} target="_blank" rel="noreferrer" className="btn-ink mt-6 w-full justify-center">
                Install MetaMask
                <ArrowUpRight size={15} />
              </a>
            </div>
          )}

          {wallet.available && !wallet.account && (
            <div className="mt-6 text-center">
              <Wallet size={26} strokeWidth={1.6} className="mx-auto text-wax" />
              <p className="mt-4 font-display text-xl font-medium">Connect to take your seat</p>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-2 max-w-[40ch] mx-auto">
                MetaMask will ask for account access, then offer to add and switch to{" "}
                {network.chainName} (chain {network.chainId}).
              </p>
              <button onClick={() => void wallet.connect()} className="btn-ink mt-6 w-full justify-center" disabled={wallet.connecting}>
                {wallet.connecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {wallet.connecting ? "Waiting for MetaMask…" : "Connect wallet"}
              </button>
              {wallet.error && <p className="mt-3 text-[12.5px] text-wax">{wallet.error}</p>}
            </div>
          )}

          {wallet.account && (
            <div className="mt-5">
              <div className="flex items-center justify-between gap-4">
                <button
                  onClick={() => void copyAccount()}
                  className="group inline-flex items-center gap-2 hover:text-wax transition-colors"
                  title="Copy your address"
                >
                  <span className="font-display text-[19px] font-medium num">{short(wallet.account, 8, 6)}</span>
                  {copied ? <Check size={14} className="text-leaf" /> : <Copy size={14} className="text-ink-3 group-hover:text-wax" />}
                </button>
                {wallet.correctNetwork ? (
                  <span className="chip border-leaf/40 text-leaf bg-leaf/10">
                    <span className="relative h-1.5 w-1.5 rounded-full bg-leaf pulse" />
                    Studionet · {network.chainId}
                  </span>
                ) : (
                  <button
                    onClick={() => void wallet.switchNetwork()}
                    className="chip border-wax/40 text-wax bg-wax/10 hover:bg-wax/15 transition-colors"
                  >
                    <AlertTriangle size={12} />
                    Switch to Studionet
                  </button>
                )}
              </div>

              <div className="mt-6">
                <div className="flex items-baseline justify-between py-3.5 hairline first:border-t-0">
                  <span className="label">Wallet balance</span>
                  {balance === null ? (
                    <span className="skeleton h-5 w-24 inline-block" />
                  ) : (
                    <span className="num text-[15px] font-semibold">{formatGen(balance)} GEN</span>
                  )}
                </div>
                <div className="flex items-baseline justify-between py-3.5 hairline">
                  <span className="label">Credit in contract</span>
                  {credit === null ? (
                    <span className="skeleton h-5 w-20 inline-block" />
                  ) : (
                    <span className="num text-[15px] font-medium">{formatGen(credit)} GEN</span>
                  )}
                </div>
              </div>

              {/* juror registration */}
              <div className="mt-6 rounded-xl border border-line bg-paper/60 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Gavel size={16} className="text-wax" />
                    <p className="text-[13.5px] font-semibold">Juror seat</p>
                  </div>
                  {juror && Number(juror.exit_at) === 0 && (
                    <span className="chip border-leaf/40 text-leaf bg-leaf/10">
                      <BadgeCheck size={12} />
                      Registered
                    </span>
                  )}
                  {juror && Number(juror.exit_at) !== 0 && (
                    <span className="chip border-ink-3/40 text-ink-3 bg-ink/5">Exiting</span>
                  )}
                </div>

                {juror ? (
                  <div className="mt-4 text-[13px] text-ink-2 space-y-1.5">
                    <p>
                      Stake locked: <span className="num font-semibold text-ink">{formatGen(String(juror.stake))} GEN</span>
                      {"  "}· open seats: <span className="num">{String(juror.open_seats)}</span>
                    </p>
                    <p className="leading-relaxed">
                      You can be drawn onto dispute panels by drand randomness. Request an exit
                      on-chain and withdraw the stake after the delay window.
                    </p>
                  </div>
                ) : (
                  <div className="mt-4">
                    <p className="text-[13px] leading-relaxed text-ink-2">
                      Stake <span className="num font-semibold text-ink">{formatGen(stake)} GEN</span> once.
                      Jurors vote on disputes and honest majority voters share fees and slashed
                      stakes.
                    </p>
                    {action === "done" ? (
                      <div className="mt-4 rounded-lg border border-leaf/40 bg-leaf/10 px-4 py-3.5">
                        <p className="text-[13px] font-semibold text-leaf flex items-center gap-2">
                          <BadgeCheck size={15} />
                          Seat recorded on Studionet
                        </p>
                        <a href={explorerTx(txHash)} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] num text-ink-2 hover:text-wax">
                          {short(txHash, 12, 10)}
                          <ArrowUpRight size={12} />
                        </a>
                      </div>
                    ) : (
                      <button
                        onClick={() => void registerJuror()}
                        disabled={action === "working" || !wallet.correctNetwork || insufficient}
                        className="btn-ink mt-4 w-full justify-center disabled:opacity-50 disabled:pointer-events-none"
                      >
                        {action === "working" ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Coins size={16} />
                        )}
                        {action === "working"
                          ? "Sign and wait for consensus…"
                          : `Register as juror — stake ${formatGen(stake)} GEN`}
                      </button>
                    )}
                    {!wallet.correctNetwork && action !== "done" && (
                      <p className="mt-2.5 text-[12.5px] text-wax">
                        Switch to Studionet above before registering.
                      </p>
                    )}
                    {insufficient && action !== "done" && (
                      <p className="mt-2.5 text-[12.5px] text-wax">
                        Not enough test GEN for the stake — claim some from the Studio faucet below.
                      </p>
                    )}
                    {action === "error" && (
                      <p className="mt-2.5 text-[12.5px] text-wax">{actionError}</p>
                    )}
                  </div>
                )}
              </div>

              <a
                href={STUDIO_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-wax/30 bg-wax/5 px-5 py-4 hover:bg-wax/10 transition-colors"
              >
                <span className="text-[13px]">
                  <span className="font-semibold text-wax">Need test GEN?</span>{" "}
                  <span className="text-ink-2">Claim it from the Studio faucet.</span>
                </span>
                <ArrowUpRight size={15} className="text-wax shrink-0" />
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
