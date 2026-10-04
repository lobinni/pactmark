# Testing guide

Requirements: Python 3.10+, Node 18+, npm dependencies installed.

## Fast suite

```bash
python3 scripts/deploy/check_contract.py     # contract structure + manifest invariants
python3 -m unittest discover -s tests -t .   # manifest, config guards, hashing end-to-end
python3 scripts/demo/run_demo.py --check     # sample certificates fresh and consistent
npm exec tsc -- --noEmit                     # web app typecheck
npm run build                                # production build (same as Vercel)
```

What each layer covers:

| Layer | Coverage |
|---|---|
| `check_contract.py` | 17 lifecycle states, transition tables, required view/write methods, consensus and escrow primitives, manifest correctness, frontend/address parity. |
| `tests/test_manifest.py` | Network identity, currency, recorded live address, transaction format, explorer link consistency. |
| `tests/test_frontend_config.py` | The app imports the manifest from code; no `process.env` / `NEXT_PUBLIC` / `import.meta.env` bypass. |
| `tests/test_canonical_hash.py` | Canonical JSON, sha256 vectors, evidence roots, generator ↔ verifier agreement, jury commitments, tamper detection. |
| `run_demo.py --check` | Checked-in certificates regenerate byte-identically and pass the independent verifier. |

## Live deployment checks

```bash
node scripts/deploy/verify_deployment.mjs
```

Read-only against `0xbE2Dd3c07322b013244477646977935b4fF21A73`. Expect the
protocol identity, owner, juror pool, window lengths, agreement count and
accounting totals. A non-zero exit means the address or network is wrong.

## Independent certificate sample

```bash
python3 scripts/demo/run_demo.py             # (re)generate samples with real hashes
python3 scripts/verification/verify_certificate.py \
  examples/demo-agreement/certificate-settled.json \
  --bundle examples/demo-agreement/bundle-settled.json \
  --onchain-hash @examples/demo-agreement/onchain-hash-settled.txt
```

Flip any byte in the certificate or the trusted hash and the verifier must
exit non-zero.

## Brand assets

```bash
node scripts/icons/generate-icons.mjs
```

Regenerates `public/icons/icon-*.png`, the maskable variant and
`public/site.webmanifest` with zero dependencies. The build does not require
this step; run it when the mark changes.

## Manual Studionet scenarios

Use distinct funded buyer and worker MetaMask accounts on chain 61999. The
app connects through the live contract at
`0xbE2Dd3c07322b013244477646977935b4fF21A73`.

| Scenario | Expected observation |
|---|---|
| Open the app | Live console shows protocol identity, juror pool and accounting read from the deployed contract. No wallet needed. |
| Connect from another chain | MetaMask prompts to add/switch to Studionet 61999. |
| Read an agreement id | Agreement view renders status, escrow, deadlines and the sealed certificate hash when finalized. |
| Download a certificate | The exported JSON matches `get_certificate` on-chain; its hash equals `get_certificate_hash`. |
| Verify a certificate in the app | The browser recomputes the canonical hash and every evidence hash; tampering flips the result to failed. |
| Create and fund an agreement | CREATED with the entered parties, amount and deadline; FUNDED locks escrow exactly once. |
| Worker accepts and delivers | Terms hash freezes; status moves ACCEPTED → IN_PROGRESS → DELIVERED. |
| Verify and aggregate | Requirement verdicts reflect validator consensus on grounded quotes. |
| Settle / refund after windows | Ledger credits the winner; certificate sealed. Withdraw pays out. |
| Bonded dispute with jury | Only eligible staked jurors commit/reveal before enforced deadlines. |

Never claim a successful live scenario without retaining the real transaction
hashes and a matching contract read.
