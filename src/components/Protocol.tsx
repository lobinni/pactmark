import { ArrowUpRight, FileLock2, ScanSearch, Scale, Wallet, Wrench } from "lucide-react";

const REPO = "https://github.com/lobinni/pactmark";

const specs = [
  {
    name: "State machine",
    text: "The seventeen lifecycle states, every sanctioned transition and the deadline table the contract enforces.",
    href: `${REPO}/blob/main/docs/STATE_MACHINE.md`,
  },
  {
    name: "Certificate format",
    text: "Canonical JSON, sha256 conventions, grounded quotes, jury commitments and the step-by-step verification procedure.",
    href: `${REPO}/blob/main/docs/CERTIFICATE_FORMAT.md`,
  },
  {
    name: "Escrow model",
    text: "Exact-value funding, pull payments, the rejection rule and the public conservation equation behind get_accounting.",
    href: `${REPO}/blob/main/docs/ESCROW_MODEL.md`,
  },
  {
    name: "Dispute model",
    text: "Challenge windows, bonded disputes, drand-seated juries, commit–reveal voting and the full outcome table.",
    href: `${REPO}/blob/main/docs/DISPUTE_MODEL.md`,
  },
];

const roles = [
  {
    icon: Wallet,
    name: "The buyer",
    text: "Defines measurable requirements, picks the policies and funds exactly the agreed amount. The escrow locks once and can never be topped up or silently withdrawn.",
  },
  {
    icon: Wrench,
    name: "The worker",
    text: "Accepts the frozen terms — title, specification, requirements and policies can no longer change — then delivers and submits evidence references.",
  },
  {
    icon: ScanSearch,
    name: "The validators",
    text: "GenLayer validators judge each requirement against the frozen bytes. A pass must cite quotes that are provably grounded in the evidence, and an adversarial pass hunts for counterexamples.",
  },
  {
    icon: Scale,
    name: "The jury",
    text: "For bonded disputes, staked jurors are seated by drand randomness and vote in two phases — commit, then reveal — so no juror can copy another's vote.",
  },
];

const principles = [
  {
    icon: FileLock2,
    title: "Evidence is frozen before it is judged",
    text: "Evidence is fetched through validator consensus and hashed. Quotes are checked against the frozen bytes, so a source edited after the fact cannot retroactively pass.",
  },
  {
    icon: Wallet,
    title: "Pull payments, never push",
    text: "Settlement credits an internal ledger; parties withdraw their own balance. The contract never sends funds to an address that did not earn them.",
  },
  {
    icon: Scale,
    title: "The contract is the only authority",
    text: "This site, cached views and offline samples are conveniences. Payouts are decided solely by the deployed contract on Studionet.",
  },
];

export function Protocol() {
  return (
    <section id="protocol" className="py-24 sm:py-32">
      <div className="wrap">
        <p className="kicker" data-reveal>
          The protocol
        </p>
        <div className="grid lg:grid-cols-2 gap-10 mt-7 items-end">
          <h2 className="display text-4xl sm:text-[52px]" data-reveal="1">
            An agreement becomes a ledger of proof.
          </h2>
          <p className="lede" data-reveal="2">
            Every run is an exact-value escrow guarded by a seventeen-state machine in the
            contract. Each transition is a signed transaction, each judgment is anchored to
            frozen evidence, and each ending seals a canonical certificate.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-px bg-line border border-line rounded-2xl overflow-hidden mt-14">
          {roles.map((role, i) => (
            <article key={role.name} className="bg-cream/70 p-8 sm:p-10" data-reveal={String(i % 4) as never}>
              <role.icon size={22} strokeWidth={1.8} className="text-wax" />
              <h3 className="font-display text-[22px] font-medium mt-5">{role.name}</h3>
              <p className="mt-3 text-[14px] leading-[1.8] text-ink-2">{role.text}</p>
            </article>
          ))}
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-10">
          {principles.map((item, i) => (
            <div key={item.title} className="border-t border-ink/60 pt-6" data-reveal={String(i) as never}>
              <div className="flex items-center gap-3">
                <item.icon size={17} strokeWidth={1.9} className="text-wax shrink-0" />
                <h3 className="font-semibold text-[15px]">{item.title}</h3>
              </div>
              <p className="mt-3 text-[13.5px] leading-[1.8] text-ink-2">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-16" data-reveal="2">
          <div className="flex items-baseline justify-between gap-6">
            <p className="label">The protocol, in writing</p>
            <p className="hidden sm:block text-[12px] text-ink-3">
              Normative specifications, kept in the repository next to the contract.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-px bg-line border border-line rounded-2xl overflow-hidden mt-5">
            {specs.map((spec) => (
              <a
                key={spec.name}
                href={spec.href}
                target="_blank"
                rel="noreferrer"
                className="group bg-cream/70 p-7 hover:bg-paper transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-display text-[19px] font-medium group-hover:text-wax transition-colors">
                    {spec.name}
                  </h3>
                  <ArrowUpRight
                    size={16}
                    className="text-ink-3 group-hover:text-wax group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all shrink-0"
                  />
                </div>
                <p className="mt-2.5 text-[13px] leading-[1.75] text-ink-2">{spec.text}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
