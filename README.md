# Pactmark

Pactmark is an evidence-based agreement protocol for digital work. A buyer
defines measurable requirements and funds escrow; a worker accepts immutable
terms, delivers work and submits evidence; validators check grounded quotes; a
challenge window or staked jury determines the final payout. The contract seals
a canonical certificate for independent verification.

**Status:** testnet software, not audited. The contract is live on GenLayer
Studionet; interact with test funds only. Evidence-based verification does not
guarantee quality, security or fitness for purpose.

## Live deployment

| | |
|---|---|
| Network | GenLayer Studionet (chain 61999) |
| Contract | `0xbE2Dd3c07322b013244477646977935b4fF21A73` |
| Explorer | https://explorer-studio.genlayer.com/address/0xbE2Dd3c07322b013244477646977935b4fF21A73 |
| Deployment transaction | `0x71d94e1ac278668d6b827b0d7300057a7ab3e9a43e9defabe6d216c6e83ddcd1` |
| Status | live |

The address is recorded in `deployments/studionet.json`, imported directly by
the web app (`src/lib/contract.ts`) and mirrored to the standalone frontend
(`frontend/assets/config.js`). There is **no environment variable to set** —
the contract lives in the repository, so a clone, a Vercel build or a GitHub
Pages export all point at the same deployed contract.

Confirm the deployment answers on-chain (read-only, no key needed):

```bash
node scripts/deploy/verify_deployment.mjs
```

## Architecture

- `contracts/pactmark.py` — the complete GenLayer intelligent contract:
  17-state agreement lifecycle, exact-value escrow, pull payments, evidence
  freezing, validator-grounded verification, adversarial checks, bonded
  disputes, staked jurors, drand seating, commit/reveal voting and canonical
  certificates.
- `src/` — the Vite + React web application: live protocol console,
  agreement explorer and in-browser certificate verifier.
- `frontend/` — standalone static protocol explorer and browser certificate
  verifier.
- `scripts/deploy/` — contract static checks, deployment helper and live
  deployment verification.
- `scripts/verification/` — independent Python certificate verifier.
- `scripts/demo/`, `examples/demo-agreement/` — deterministic offline
  walkthrough and sample certificate bundles with real hashes.
- `scripts/icons/` — zero-dependency PNG icon generator for the brand set.
- `tests/` — manifest invariants, frontend configuration guards and
  canonical-hashing end-to-end tests.
- `docs/` — protocol specifications, escrow/dispute model, security,
  deployment, testing and publishing guides.

## Run the web application

```bash
npm install
npm run dev
```

Open http://localhost:5173. The app reads the live contract immediately with
no wallet. To take part, connect MetaMask from the navigation bar or the
**Join the network** section — the app asks MetaMask to add and switch to
**GenLayer Studionet (chain 61999)** using `https://studio.genlayer.com/api`,
shows your balance and withdrawable credit, and lets you register as a staked
juror with one signed transaction. Test GEN is claimed from the faucet in
GenLayer Studio. The app never stores a private key.

## Build and deploy on Vercel

`vercel.json` is already configured for a static Vite build:

- Framework preset: **Vite**
- Build command: `npm run build` &nbsp;·&nbsp; Output: `dist`
- Environment variables: **none** — no database URL, no contract variable.

```bash
npm run build      # produces dist/ locally, exactly what Vercel builds
```

## Publish changes to GitHub

From a bundle of these files next to your clone:

```bash
git clone https://github.com/lobinni/pactmark.git ~/pactmark
sh scripts/publish.sh ~/pactmark push
```

The runbook with the manual command sequence lives in
[docs/PUBLISHING.md](docs/PUBLISHING.md).

## Test

```bash
python3 scripts/deploy/check_contract.py     # contract + manifest static checks
python3 -m unittest discover -s tests -t .   # manifest, config guards, hashing
python3 scripts/demo/run_demo.py --check     # sample certificates are fresh
node scripts/deploy/verify_deployment.mjs    # live read against the deployment
node scripts/icons/generate-icons.mjs        # regenerate public/icons/*.png
npm exec tsc -- --noEmit                     # typecheck the web app
npm run build                                # production build
```

Verify a sample certificate without trusting any frontend:

```bash
python3 scripts/verification/verify_certificate.py \
  examples/demo-agreement/certificate-settled.json \
  --bundle examples/demo-agreement/bundle-settled.json \
  --onchain-hash @examples/demo-agreement/onchain-hash-settled.txt
```

See [docs/TESTING.md](docs/TESTING.md) for the full guide and scenario table.

## Lifecycle

1. Create an agreement with requirements, policies, parties, amount and deadline.
2. Buyer funds exactly the stated amount; worker accepts the frozen terms.
3. Worker submits evidence references; a party freezes the fetched bytes and hashes.
4. Anyone triggers per-requirement validator checks and aggregation.
5. A challenge window allows grounded objections; a bonded dispute can trigger a staked jury.
6. Settlement or refund credits a withdrawable ledger and seals an offline-verifiable certificate.

The contract remains authoritative. Browser state and offline examples never
determine payouts. Read the [security model](docs/SECURITY.md),
[state machine](docs/STATE_MACHINE.md),
[certificate format](docs/CERTIFICATE_FORMAT.md) and
[architecture](docs/ARCHITECTURE.md) before interacting with funds.

## License

MIT. See `LICENSE` for the applicable attribution and terms.
