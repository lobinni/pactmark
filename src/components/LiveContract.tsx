import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight, Check, Copy, Download, Loader2, RefreshCw, Search, Wallet,
} from "lucide-react";
import {
  contractUrl, deploymentTxUrl, explorerAddress, network, readContract,
} from "../lib/contract";
import { useWallet } from "../lib/wallet";
import { formatDate, formatGen, formatHours, short } from "../lib/format";
import { useReveal } from "../hooks/useReveal";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

type ReadState = "loading" | "ok" | "error";

function statusTone(status: string): string {
  if (/SETTLED|VERIFIED_PASS|PASS/i.test(status)) return "border-leaf/40 text-leaf bg-leaf/10";
  if (/DISPUT|CHALLENGE|FINAL_REVIEW/i.test(status)) return "border-wax/40 text-wax bg-wax/10";
  if (/REFUNDED|CANCELLED|TIMEOUT/i.test(status)) return "border-ink-3/40 text-ink-3 bg-ink/5";
  return "border-ink/25 text-ink-2 bg-ink/5";
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3.5 hairline first:border-t-0">
      <span className="label pt-1 shrink-0">{label}</span>
      <div className="text-right">{children}</div>
    </div>
  );
}

export function LiveContract() {
  const [state, setState] = useState<ReadState>("loading");
  const [readError, setReadError] = useState("");
  const [info, setInfo] = useState<Json | null>(null);
  const [count, setCount] = useState<string>("0");
  const [accounting, setAccounting] = useState<Json | null>(null);

  const wallet = useWallet();

  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [agreement, setAgreement] = useState<Json | null>(null);
  const [requirements, setRequirements] = useState<Json[]>([]);
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "error">("idle");
  const [lookupError, setLookupError] = useState("");
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setReadError("");
    try {
      const [protocolInfo, agreementCount, totals] = await Promise.all([
        readContract("get_protocol_info"),
        readContract("agreement_count"),
        readContract("get_accounting"),
      ]);
      setInfo(protocolInfo as Json);
      setCount(String(agreementCount));
      setAccounting(totals as Json);
      setState("ok");
    } catch (error) {
      setReadError(error instanceof Error ? error.message : String(error));
      setState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useReveal(state + String(Boolean(agreement)));

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(network.contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }



  async function onLookup() {
    const id = query.trim();
    if (!id) return;
    setLookupState("loading");
    setLookupError("");
    setAgreement(null);
    try {
      const found = (await readContract("get_agreement", [id])) as Json;
      const reqs = (await readContract("get_requirements", [id])) as Json[];
      setAgreement(found);
      setRequirements(Array.isArray(reqs) ? reqs : []);
      setLookupState("idle");
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : String(error));
      setLookupState("error");
    }
  }

  async function downloadCertificate() {
    if (!agreement) return;
    setDownloading(true);
    try {
      const raw = await readContract("get_certificate", [agreement.agreement_id]);
      let pretty = String(raw);
      try {
        pretty = JSON.stringify(JSON.parse(String(raw)), null, 2);
      } catch {
        /* keep raw */
      }
      const blob = new Blob([pretty], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `pactmark-certificate-${agreement.agreement_id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const windows = (info?.windows ?? {}) as Record<string, number>;

  return (
    <section id="live" className="py-24 sm:py-32">
      <div className="wrap">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <p className="kicker" data-reveal>
              Live console
            </p>
            <h2 className="display text-4xl sm:text-[52px] mt-7" data-reveal="1">
              The contract, on the record.
            </h2>
            <p className="lede mt-6" data-reveal="2">
              Everything below is read from the deployed contract at{" "}
              {short(network.contractAddress, 10, 8)} on GenLayer Studionet. Reading is free and
              needs no wallet.
            </p>
          </div>
          <div className="flex items-center gap-3" data-reveal="2">
            <button onClick={() => void load()} className="btn-line !px-4" aria-label="Refresh on-chain reads">
              <RefreshCw size={15} className={state === "loading" ? "animate-spin" : ""} />
            </button>
            {wallet.account ? (
              <a
                href="#join"
                className="chip border-leaf/40 text-leaf bg-leaf/10 !normal-case !tracking-normal !text-[13px] !py-2.5 !px-5 hover:bg-leaf/15 transition-colors"
              >
                <span className="h-2 w-2 rounded-full bg-leaf" />
                {short(wallet.account)}
              </a>
            ) : (
              <button onClick={() => void wallet.connect()} className="btn-ink" disabled={wallet.connecting}>
                {wallet.connecting ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
                {wallet.connecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </div>
        {wallet.error && (
          <p className="mt-4 text-[13px] text-wax">{wallet.error}</p>
        )}

        <div className="grid lg:grid-cols-2 gap-6 mt-14">
          {/* deployment record */}
          <div className="card p-8" data-reveal="1">
            <div className="flex items-center justify-between">
              <p className="label">Deployment</p>
              <span className="chip border-leaf/40 text-leaf bg-leaf/10">
                <span className="relative h-1.5 w-1.5 rounded-full bg-leaf pulse" />
                Live
              </span>
            </div>
            <div className="mt-5">
              <Row label="Contract">
                <button
                  onClick={() => void copyAddress()}
                  className="group inline-flex items-center gap-2 value !text-[13.5px] hover:text-wax transition-colors"
                  title="Copy the contract address"
                >
                  {short(network.contractAddress, 12, 10)}
                  {copied ? <Check size={14} className="text-leaf" /> : <Copy size={14} className="text-ink-3 group-hover:text-wax" />}
                </button>
              </Row>
              <Row label="Explorer">
                <a href={contractUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-wax hover:underline">
                  Open the contract page
                  <ArrowUpRight size={14} />
                </a>
              </Row>
              <Row label="Deploy transaction">
                <a href={deploymentTxUrl} target="_blank" rel="noreferrer" className="num text-[13.5px] font-medium text-ink hover:text-wax transition-colors">
                  {short(network.deploymentTransaction, 10, 8)}
                </a>
              </Row>
              <Row label="Network">
                <span className="value !text-[13.5px]">{network.chainName} · chain {network.chainId}</span>
              </Row>
              <Row label="RPC">
                <span className="value !text-[13.5px]">{network.rpcUrl}</span>
              </Row>
              <Row label="Currency">
                <span className="value !text-[13.5px]">{network.currency.name} · {network.currency.decimals} decimals</span>
              </Row>
            </div>
          </div>

          {/* protocol reads */}
          <div className="card p-8" data-reveal="2">
            <div className="flex items-center justify-between">
              <p className="label">Protocol, read live</p>
              {state === "ok" && <span className="text-[11px] text-ink-3">just now</span>}
            </div>
            {state === "loading" && (
              <div className="mt-5 space-y-3.5">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="skeleton h-5 w-full" />
                ))}
              </div>
            )}
            {state === "error" && (
              <div className="mt-6">
                <p className="text-[13.5px] text-ink-2 leading-relaxed">
                  The Studionet RPC did not answer. The network is a testnet — retry in a moment.
                </p>
                <p className="mt-2 text-[12.5px] text-wax">{readError}</p>
                <button onClick={() => void load()} className="btn-line mt-5 !py-2.5 !px-5 text-[13px]">
                  Retry the read
                </button>
              </div>
            )}
            {state === "ok" && info && (
              <div className="mt-5">
                <Row label="Protocol">
                  <span className="value !text-[13.5px]">{String(info.protocol)}</span>
                </Row>
                <Row label="Owner">
                  <a href={explorerAddress(String(info.owner))} target="_blank" rel="noreferrer" className="num text-[13.5px] font-medium hover:text-wax transition-colors">
                    {short(String(info.owner))}
                  </a>
                </Row>
                <Row label="Juror pool">
                  <span className="value !text-[13.5px]">
                    {String(info.juror_pool_size)} registered · stake {formatGen(String(info.juror_stake))} GEN
                  </span>
                </Row>
                <Row label="Jury">
                  <span className="value !text-[13.5px]">{String(info.jury_size)} seats · quorum {String(info.jury_quorum)}</span>
                </Row>
                <Row label="Windows">
                  <span className="value !text-[13.5px]">
                    verify {formatHours(Number(windows.verify ?? 0))} · challenge {formatHours(Number(windows.challenge_standard ?? 0))}–{formatHours(Number(windows.challenge_adversarial ?? 0))}
                  </span>
                </Row>
                <Row label="Agreements">
                  <span className="num value !text-[13.5px]">{count}</span>
                </Row>
                <Row label="Escrow locked">
                  <span className="num value !text-[13.5px]">{formatGen(String(accounting?.escrow_locked ?? 0))} GEN</span>
                </Row>
                <Row label="Withdrawable">
                  <span className="num value !text-[13.5px]">{formatGen(String(accounting?.claimable_total ?? 0))} GEN</span>
                </Row>
              </div>
            )}
          </div>
        </div>

        {/* agreement lookup */}
        <div className="card p-8 mt-6" data-reveal="2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="label">Look up an agreement</p>
              <p className="mt-2 text-[13px] text-ink-3">
                Paste an agreement id you created on-chain to read its live state.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void onLookup()}
                placeholder="Agreement id"
                className="w-full sm:w-72 rounded-full border border-line bg-cream/80 px-5 py-3 text-[13.5px] placeholder:text-ink-3 focus:border-wax"
              />
              <button onClick={() => void onLookup()} className="btn-ink !px-5" disabled={lookupState === "loading"}>
                {lookupState === "loading" ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
              </button>
            </div>
          </div>

          {lookupState === "error" && (
            <p className="mt-5 text-[13px] text-wax">{lookupError}</p>
          )}

          {agreement && (
            <div className="mt-8">
              <div className="flex flex-wrap items-center gap-4 justify-between hairline pt-7">
                <div>
                  <p className="font-display text-[22px] font-medium">{String(agreement.title || agreement.agreement_id)}</p>
                  <p className="text-[12.5px] text-ink-3 mt-1">{String(agreement.agreement_id)}</p>
                </div>
                <span className={`chip ${statusTone(String(agreement.status))}`}>
                  {String(agreement.status).replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 mt-4">
                <Row label="Buyer">
                  <a href={explorerAddress(String(agreement.buyer))} target="_blank" rel="noreferrer" className="num text-[13px] hover:text-wax">{short(String(agreement.buyer))}</a>
                </Row>
                <Row label="Worker">
                  <a href={explorerAddress(String(agreement.worker))} target="_blank" rel="noreferrer" className="num text-[13px] hover:text-wax">{short(String(agreement.worker))}</a>
                </Row>
                <Row label="Escrow">
                  <span className="num text-[13px] font-semibold">{formatGen(String(agreement.amount))} GEN</span>
                </Row>
                <Row label="Created">
                  <span className="text-[13px]">{formatDate(Number(agreement.created_at))}</span>
                </Row>
                <Row label="Deadline">
                  <span className="text-[13px]">{formatDate(Number(agreement.deadline))}</span>
                </Row>
                <Row label="Result">
                  <span className="text-[13px] font-semibold">{String(agreement.protocol_result || "—")}</span>
                </Row>
              </div>

              {Boolean(agreement.description) && (
                <p className="mt-4 text-[13.5px] leading-[1.8] text-ink-2 max-w-[70ch]">
                  {String(agreement.description)}
                </p>
              )}

              {requirements.length > 0 && (
                <div className="mt-6">
                  <p className="label">Requirements</p>
                  <ul className="mt-3 space-y-3">
                    {requirements.map((req) => (
                      <li key={String(req.requirement_id)} className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line bg-paper/60 px-5 py-4">
                        <div className="max-w-[64ch]">
                          <span className="num text-[12px] font-semibold text-wax">{String(req.requirement_id)}</span>
                          <p className="text-[13.5px] leading-relaxed text-ink mt-1">{String(req.description)}</p>
                          {Boolean(req.detail) && (
                            <p className="text-[12px] text-ink-3 mt-1">{String(req.detail).replace(/_/g, " ")}</p>
                          )}
                        </div>
                        <span className={`chip ${statusTone(String(req.status))}`}>{String(req.status).replace(/_/g, " ")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {Boolean(agreement.certificate_hash) && (
                <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-leaf/30 bg-leaf/5 px-5 py-4">
                  <div>
                    <p className="label !text-leaf">Sealed certificate</p>
                    <p className="num text-[12.5px] text-ink-2 mt-1.5 break-all">{String(agreement.certificate_hash)}</p>
                  </div>
                  <button onClick={() => void downloadCertificate()} className="btn-line !py-2.5 !px-5 text-[13px]" disabled={downloading}>
                    {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    Download certificate
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
