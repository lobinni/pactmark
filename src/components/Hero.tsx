import { ArrowUpRight, MoveDown } from "lucide-react";
import { contractUrl, network } from "../lib/contract";
import { short } from "../lib/format";

const stats = [
  { value: `Chain ${network.chainId}`, label: "GenLayer Studionet, currency GEN" },
  { value: "17 states", label: "agreement lifecycle, enforced by the contract" },
  { value: "3 seats", label: "staked jury panels, drand seating, commit–reveal votes" },
  { value: "Exact escrow", label: "funded once, paid by pull, never overdrawn" },
];

export function Hero() {
  return (
    <section id="top" className="relative pt-32 sm:pt-40 pb-20 overflow-hidden">
      <div className="wrap grid lg:grid-cols-[1.15fr_0.85fr] gap-14 items-start">
        <div>
          <p className="kicker" data-reveal>
            Live on GenLayer Studionet
          </p>
          <h1 className="display text-[13.5vw] sm:text-[64px] lg:text-[76px] mt-7" data-reveal="1">
            Work, agreed.
            <br />
            Evidence, <em className="not-italic text-wax">sealed.</em>
          </h1>
          <p className="lede mt-8" data-reveal="2">
            Pactmark turns a digital work agreement into an enforceable protocol run. The buyer
            locks payment in escrow, the worker delivers against measurable requirements,
            independent validators judge grounded evidence, and a staked jury settles disputes.
            Every finished run seals a certificate that anyone can verify offline — without
            trusting this site or any server.
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-10" data-reveal="3">
            <a href={contractUrl} target="_blank" rel="noreferrer" className="btn-ink">
              Inspect the live contract
              <ArrowUpRight size={16} strokeWidth={2.2} />
            </a>
            <a href="#protocol" className="btn-line">
              How the protocol works
              <MoveDown size={16} strokeWidth={2.2} />
            </a>
          </div>
          <p className="mt-6 text-[13px] text-ink-3" data-reveal="4">
            Deployed at {short(network.contractAddress, 10, 8)} — recorded in the repository, no
            environment configuration needed.
          </p>
        </div>

        <figure className="relative lg:pt-6" data-reveal="2">
          <div className="card overflow-hidden shadow-[0_30px_80px_-30px_rgba(24,19,16,0.45)]">
            <img
              src="/brand/seal.jpg"
              alt="A wax seal pressed onto parchment — the mark of a sealed Pactmark certificate"
              className="w-full aspect-[4/3] object-cover"
            />
            <figcaption className="px-6 py-5 border-t border-line">
              <p className="text-[13px] leading-relaxed text-ink-2">
                The seal is the protocol: once a run finalizes, the certificate hash is fixed
                on-chain. Change one byte of the evidence and the hash no longer matches.
              </p>
            </figcaption>
          </div>
          <a
            href={contractUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute -bottom-5 left-6 card flex items-center gap-3 pl-3 pr-5 py-3 shadow-[0_18px_50px_-20px_rgba(125,31,15,0.5)] hover:-translate-y-1 transition-transform duration-300"
          >
            <span className="relative flex h-2.5 w-2.5 rounded-full bg-leaf text-leaf pulse" />
            <span className="text-[13px] font-semibold">
              Contract live · {short(network.contractAddress)}
            </span>
            <ArrowUpRight size={14} className="text-ink-3" />
          </a>
        </figure>
      </div>

      <div className="wrap mt-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-line bg-line">
          {stats.map((stat, i) => (
            <div key={stat.value} className="bg-cream/70 px-6 py-6" data-reveal={String(i) as never}>
              <p className="font-display text-xl sm:text-2xl font-medium">{stat.value}</p>
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-3">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
