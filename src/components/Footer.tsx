import { ArrowUpRight } from "lucide-react";
import { Seal } from "./Seal";
import { contractUrl, deploymentTxUrl, network } from "../lib/contract";
import { short } from "../lib/format";

const REPO = "https://github.com/lobinni/pactmark";

const columns = [
  {
    title: "Protocol",
    links: [
      { label: "State machine", href: `${REPO}/blob/main/docs/STATE_MACHINE.md` },
      { label: "Certificate format", href: `${REPO}/blob/main/docs/CERTIFICATE_FORMAT.md` },
      { label: "Escrow model", href: `${REPO}/blob/main/docs/ESCROW_MODEL.md` },
      { label: "Dispute model", href: `${REPO}/blob/main/docs/DISPUTE_MODEL.md` },
    ],
  },
  {
    title: "Operate",
    links: [
      { label: "Deployment guide", href: `${REPO}/blob/main/docs/DEPLOYMENT.md` },
      { label: "Testing guide", href: `${REPO}/blob/main/docs/TESTING.md` },
      { label: "Live test report", href: `${REPO}/blob/main/docs/LIVE_TEST_REPORT.md` },
      { label: "Publishing", href: `${REPO}/blob/main/docs/PUBLISHING.md` },
    ],
  },
  {
    title: "Network",
    links: [
      { label: "Contract on the explorer", href: contractUrl },
      { label: "Deployment transaction", href: deploymentTxUrl },
      { label: "Repository", href: REPO },
      { label: "Security model", href: `${REPO}/blob/main/docs/SECURITY.md` },
    ],
  },
];

export function Footer() {
  return (
    <footer className="pt-24 pb-12">
      <div className="wrap">
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-16">
          <div data-reveal>
            <div className="flex items-center gap-3">
              <Seal size={36} />
              <span className="font-display text-2xl font-medium">Pactmark</span>
            </div>
            <p className="mt-6 max-w-[46ch] text-[14px] leading-[1.85] text-ink-2">
              Evidence-based agreements for digital work. Fund the escrow, freeze the evidence,
              let validators and a staked jury decide — and keep the certificate to prove it.
            </p>
            <p className="mt-5 text-[12.5px] text-ink-3">
              Live on {network.chainName} at {short(network.contractAddress, 12, 10)}.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-10" data-reveal="1">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="label">{column.title}</p>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-center gap-1 text-[13px] text-ink-2 hover:text-wax transition-colors"
                      >
                        {link.label}
                        <ArrowUpRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="hairline mt-16 pt-8 flex flex-wrap items-center justify-between gap-4">
          <p className="text-[12px] text-ink-3">
            Testnet software, not audited. Use test funds only — the contract remains the only
            authority on payouts.
          </p>
          <p className="text-[12px] text-ink-3">MIT licensed.</p>
        </div>
      </div>
    </footer>
  );
}
