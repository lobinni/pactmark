const steps = [
  {
    title: "Create and fund",
    text: "The buyer records requirements, policies, parties, amount and deadline, then funds exactly the stated sum. The agreement holds no more and no less.",
  },
  {
    title: "Accept the frozen terms",
    text: "The worker signs acceptance. From that moment the specification, requirements and policies are immutable for the life of the agreement.",
  },
  {
    title: "Deliver and freeze evidence",
    text: "Evidence references are submitted, fetched through validator consensus and hashed. The frozen bytes are what every later judgment must quote.",
  },
  {
    title: "Validator verification",
    text: "Each requirement is judged independently: a pass needs quotes grounded in the frozen evidence, and an adversarial review tries to disprove it.",
  },
  {
    title: "Challenge or bonded dispute",
    text: "A window opens for grounded objections. Either party can post a bond and force the run in front of a drand-seated, staked jury.",
  },
  {
    title: "Settlement and the sealed certificate",
    text: "The escrow credits the winner's withdrawable ledger and the contract seals a canonical certificate — verifiable offline, byte for byte.",
  },
];

const policies = [
  { name: "Evidence", values: "Strict or permissive sources" },
  { name: "Verification", values: "Standard or adversarial review" },
  { name: "Dispute", values: "Staked jury or none" },
];

const windows = [
  ["Freeze evidence", "24 h"],
  ["Verification", "24 h"],
  ["Challenge window", "24 – 72 h"],
  ["Dispute response", "24 h"],
  ["Commit and reveal", "24 h each"],
  ["Juror membership", "30 days minimum"],
];

export function Lifecycle() {
  return (
    <section id="lifecycle" className="py-24 sm:py-32 bg-paper-2/60">
      <div className="wrap grid lg:grid-cols-[1fr_340px] gap-16">
        <div>
          <p className="kicker" data-reveal>
            The lifecycle
          </p>
          <h2 className="display text-4xl sm:text-[52px] mt-7" data-reveal="1">
            Six movements, one growing ledger.
          </h2>

          <ol className="mt-14">
            {steps.map((step, i) => (
              <li
                key={step.title}
                className="grid sm:grid-cols-[88px_1fr] gap-3 sm:gap-8 py-8 hairline first:border-t-0"
                data-reveal={String(i % 3) as never}
              >
                <span className="step-no">
                  {String(i + 1).padStart(2, "0")}
                  <span className="text-ink-3"> / 06</span>
                </span>
                <div>
                  <h3 className="font-display text-[24px] font-medium">{step.title}</h3>
                  <p className="mt-2.5 text-[14px] leading-[1.85] text-ink-2 max-w-[58ch]">
                    {step.text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className="lg:pt-32">
          <div className="card p-8 lg:sticky lg:top-28" data-reveal="2">
            <p className="label">Policy knobs, frozen at acceptance</p>
            <ul className="mt-5 space-y-4">
              {policies.map((policy) => (
                <li key={policy.name} className="flex items-baseline justify-between gap-4">
                  <span className="text-[13.5px] font-semibold">{policy.name}</span>
                  <span className="text-[12.5px] text-ink-3 text-right">{policy.values}</span>
                </li>
              ))}
            </ul>
            <div className="hairline mt-7 pt-7">
              <p className="label">Windows enforced on-chain</p>
              <ul className="mt-5 space-y-3">
                {windows.map(([name, value]) => (
                  <li key={name} className="flex items-baseline justify-between gap-4">
                    <span className="text-[13px] text-ink-2">{name}</span>
                    <span className="num text-[13px] font-semibold">{value}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-7 text-[12.5px] leading-relaxed text-ink-3">
              Deadlines are seconds since the Unix epoch, read from the deployed contract —
              never from this page.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
