import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Seal } from "./Seal";
import { WalletButton } from "./WalletButton";
import { contractUrl } from "../lib/contract";

const links = [
  { href: "#protocol", label: "Protocol" },
  { href: "#lifecycle", label: "Lifecycle" },
  { href: "#live", label: "Live contract" },
  { href: "#verify", label: "Verify" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 transition-all duration-500 ${
        scrolled ? "bg-paper/90 backdrop-blur-md border-b border-line" : ""
      }`}
    >
      <div className="wrap flex items-center justify-between py-4">
        <a href="#top" className="flex items-center gap-3 group">
          <Seal size={32} className="transition-transform duration-500 group-hover:rotate-[8deg]" />
          <span className="font-display text-[22px] font-medium tracking-tight">Pactmark</span>
        </a>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[13px] font-medium text-ink-2 hover:text-wax transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={contractUrl}
            target="_blank"
            rel="noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-wax transition-colors"
          >
            Explorer
            <ArrowUpRight size={13} />
          </a>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
