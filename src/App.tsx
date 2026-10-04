import { Nav } from "./components/Nav";
import { Hero } from "./components/Hero";
import { Protocol } from "./components/Protocol";
import { Lifecycle } from "./components/Lifecycle";
import { LiveContract } from "./components/LiveContract";
import { Verify } from "./components/Verify";
import { Join } from "./components/Join";
import { Footer } from "./components/Footer";
import { WalletProvider } from "./lib/wallet";
import { useReveal } from "./hooks/useReveal";

export default function App() {
  useReveal();

  return (
    <WalletProvider>
      <div className="min-h-screen">
        <Nav />
        <main>
          <Hero />
          <Protocol />
          <Lifecycle />
          <LiveContract />
          <Verify />
          <Join />
        </main>
        <Footer />
      </div>
    </WalletProvider>
  );
}
