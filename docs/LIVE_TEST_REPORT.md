# Live test report

Subject: the Pactmark deployment on GenLayer Studionet.

| | |
|---|---|
| Contract | `0xbE2Dd3c07322b013244477646977935b4fF21A73` |
| Explorer | https://explorer-studio.genlayer.com/address/0xbE2Dd3c07322b013244477646977935b4fF21A73 |
| Deployment transaction | `0x71d94e1ac278668d6b827b0d7300057a7ab3e9a43e9defabe6d216c6e83ddcd1` |
| Network | Studionet, chain 61999, RPC `https://studio.genlayer.com/api` |

## Verified

| Check | Result | How to reproduce |
|---|---|---|
| Contract answers as Pactmark | `get_protocol_info` returns the protocol identity, owner, juror settings and window table | `node scripts/deploy/verify_deployment.mjs` |
| Deployment recorded in code | Address, transaction and explorer link committed; app and standalone frontend read them without environment variables | `python3 -m unittest discover -s tests -t .` |
| Offline verification path | Sample certificates regenerate deterministically and pass the independent verifier, including tamper detection | `python3 scripts/demo/run_demo.py --check` |
| Static contract checks | States, transitions, methods, consensus and escrow primitives present in `contracts/pactmark.py` | `python3 scripts/deploy/check_contract.py` |

## Reproduction checklist for interactive writes

The following involve funded test accounts and are executed ad hoc through
MetaMask on chain 61999; outcomes are tracked per scenario rather than cached
here, because every run spends test GEN and changes on-chain state.

| Scenario | Expected |
|---|---|
| Create + fund + accept + deliver + freeze | Reaches DELIVERED with frozen evidence bytes and hashes. |
| Validator verification + aggregation | Per-requirement verdicts with grounded quotes; overall result matches the evidence. |
| Settle after the challenge window | Worker credited; certificate sealed; hash matches the downloaded certificate. |
| Refund path (fail or timeout) | Buyer credited; certificate sealed. |
| Bonded dispute with jury | drand-seated jurors, enforced commit/reveal windows, bond and stake accounting consistent. |

## Known boundaries

- Studionet is a test network; liveness and validator behaviour are best-effort.
- The protocol is unaudited. Use test funds only.
- Evidence-based verification does not guarantee quality, security or fitness
  for purpose of any deliverable.
