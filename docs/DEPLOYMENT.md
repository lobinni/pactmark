# Deployment guide

Pactmark runs on **GenLayer Studionet (chain 61999)**.

## Current deployment

| | |
|---|---|
| Contract | `0xbE2Dd3c07322b013244477646977935b4fF21A73` |
| Explorer | https://explorer-studio.genlayer.com/address/0xbE2Dd3c07322b013244477646977935b4fF21A73 |
| Deployment transaction | `0x71d94e1ac278668d6b827b0d7300057a7ab3e9a43e9defabe6d216c6e83ddcd1` |
| RPC | `https://studio.genlayer.com/api` |
| Currency | GEN (18 decimals) |
| Status | live |

The deployment record lives in `deployments/studionet.json` and is the single
source of truth. The web app imports it from `src/lib/contract.ts`; the
standalone frontend mirrors it in `frontend/assets/config.js`. No application
reads the address from an environment variable.

## Verify the live deployment

Read-only, no key required:

```bash
node scripts/deploy/verify_deployment.mjs
```

The script calls `get_protocol_info`, `agreement_count` and `get_accounting`
against the committed address and fails if the contract does not answer as
Pactmark. You can also open the explorer link above and inspect the code and
state directly.

## Deploy a fresh instance

Only test funds. The deploying account must hold Studionet GEN.

```bash
python3 scripts/deploy/check_contract.py
PRIVATE_KEY=0x... node scripts/deploy/deploy.mjs
```

- `PRIVATE_KEY` belongs to a funded Studionet test account and is used only to
  sign the deployment. It is never written to disk and must never appear in a
  client-exposed variable.
- The helper waits for an accepted receipt, reads `get_protocol_info` from the
  fresh address, then rewrites `deployments/studionet.json`
  (`status: live`, new address, transaction, explorer link) and
  `frontend/assets/config.js`. Commit both files and push — the Vercel build
  picks the new address up from code on the next deploy.

## Manual deployment from GenLayer Studio

1. Open https://studio.genlayer.com and load the contents of
   `contracts/pactmark.py` into a new intelligent contract.
2. Deploy from a funded test account.
3. Copy the resulting address into `deployments/studionet.json`
   (`contractAddress`, `deploymentTransaction`, `explorerAddressUrl`,
   `status: live`) and mirror it into `frontend/assets/config.js`.
4. Run `node scripts/deploy/verify_deployment.mjs` to confirm the read path.

## After any deployment

```bash
python3 -m unittest discover -s tests -t .
```

The suite checks the manifest invariants and guarantees the app still reads
the address from code rather than the environment.
