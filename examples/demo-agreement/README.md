# Demo agreement samples

Deterministic, offline certificate bundles that mirror what the deployed
Pactmark contract on GenLayer Studionet seals on-chain for real agreements.

- Live contract: `0xbE2Dd3c07322b013244477646977935b4fF21A73`
- Explorer: https://explorer-studio.genlayer.com/address/0xbE2Dd3c07322b013244477646977935b4fF21A73
- Network: GenLayer Studionet (chain 61999)

## What is here

| File | Content |
|---|---|
| `agreement-input.json` | The deterministic input: parties, requirements, evidence, challenge and jury seed. |
| `certificate-settled.json` | Sealed certificate where every requirement passes and the worker is paid. |
| `bundle-settled.json` | Evidence bundle satisfying the settled certificate. |
| `onchain-hash-settled.txt` | Certificate hash as the contract would record on-chain. |
| `certificate-refunded-after-jury.json` | Certificate for a bonded dispute the buyer wins; escrow is refunded. |
| `bundle-refunded-after-jury.json` | Evidence bundle for the disputed run. |
| `onchain-hash-refunded-after-jury.txt` | Matching certificate hash. |

All hashes are real sha256 digests over the canonical JSON the contract uses.

## Regenerate

```bash
python3 scripts/demo/run_demo.py
```

## Verify without trusting any frontend

```bash
python3 scripts/verification/verify_certificate.py \
  examples/demo-agreement/certificate-settled.json \
  --bundle examples/demo-agreement/bundle-settled.json \
  --onchain-hash @examples/demo-agreement/onchain-hash-settled.txt
```

The same verification runs inside the web app: drop a certificate JSON file
onto the Verify section and it recomputes everything in your browser. For a
live agreement, compare the printed hash with `get_certificate_hash` read from
the contract address above — the independent check only passes when they match.
