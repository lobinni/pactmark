# Escrow model

Pactmark's money handling is deliberately boring: exact-value escrow, an
internal credit ledger, and pull payments. The contract never pushes funds to
an address that did not earn them, and every wei is accounted for in a public
conservation equation.

## Exact-value escrow

- An agreement declares `amount` at creation, bounded between
  `10^15` wei (0.001 GEN) and `10^30` wei.
- Funding succeeds only with the **exact** amount attached. Underpaying or
  overpaying is rejected and handled by the rejection rule below.
- Escrow locks exactly once (`escrow_locked += amount`). It cannot be topped
  up, partially released or redirected: the whole pot goes to the worker, the
  whole pot back to the buyer, or a bonded dispute decides between them.
- Funding before acceptance risk is symmetric: until the worker accepts, the
  buyer can refund unconditionally; after acceptance, the buyer can only
  recover funds through a fail, an insufficiency, a timeout or a jury.

## Pull payments

Settlement never transfers native GEN directly. Instead the contract credits
an internal ledger:

```
balances[address]   # withdrawable credit, readable via get_balance
```

`withdraw()` pays the caller's full credited balance in one transaction and
zeroes the entry. There is no partial withdrawal and no withdrawal on behalf
of others — only the earning address can move its money. This design removes
reentrancy-style push failures from the settlement path entirely.

## The rejection rule

Payable entry points validate the attached value first. On any mismatch —
wrong amount, duplicate funding, a bond arriving after the window — the
attached value is **credited to the sender's withdrawable ledger** and the
call reports `REJECTED: <reason>`. Nothing is ever burned or silently
absorbed; the caller simply withdraws the credited amount. The frontend
surfaces the rejection reason and reminds the user the funds are withdrawable.

## Accounting totals

`get_accounting()` exposes the conservation buckets, all in wei:

| Field | Meaning |
|---|---|
| `total_in` | Every wei ever attached to a call. |
| `total_out` | Every wei ever paid out via `withdraw` and owner treasury payout. |
| `escrow_locked` | Active agreement escrows awaiting settlement. |
| `stakes_locked` | Juror stakes currently held. |
| `bonds_locked` | Dispute bonds awaiting resolution. |
| `claimable_total` | Sum of all withdrawable ledger credits. |
| `treasury` | Fees and unrecoverable dust assigned to the contract owner. |

Conservation invariant, checkable at any height:

```
total_in = total_out + escrow_locked + stakes_locked + bonds_locked
         + claimable_total + treasury
```

The Python tests and the live console both read these; a violation would mean
a contract bug, and Studionet history is there to be inspected.

## Stakes, bonds, fees and slashing

- **Juror stake:** registration locks exactly `0.1 GEN`. Stakes back honest
  voting: a juror who skips the reveal, or votes with the losing side of a
  decisive panel, is slashed — the stake is cut and the juror is marked
  removed. Slashed stakes pool into the fee/reward distribution of that
  dispute and otherwise fall to the treasury.
- **Dispute bond:** `max(0.1 GEN, amount / 20)`. It prices frivolous disputes
  without pricing out legitimate ones. Half the bond is a fee distributed to
  the deciding majority; the remainder is collateral returned to whoever the
  bond rules favor (see `docs/DISPUTE_MODEL.md` for the outcome table).
- **Treasury:** accumulates only fractions that belong to no party (slashed
  remainder, undistributed pools). The owner withdraws the treasury alone —
  never escrow, stakes, bonds or credits.

## Settlement matrix

| Terminal path | Worker | Buyer | Jury / treasury |
|---|---|---|---|
| Settle after pass | `amount` credited | — | — |
| Refund (fail / insufficient / timeout) | — | `amount` credited | — |
| Worker prevails at jury | `amount` | bond collateral if respondent-opener rules apply | majority share of fee + slashed pool |
| Buyer prevails at jury | — | `amount` | same distribution |
| Fallbacks (deadlock, no jury) | per recorded protocol result | remainder | per fallback rule |

## Why pull, why exact, why lazy timeouts

- **Exact values** make escrow accounting trivially auditable: one lock, one
  release, invariant preserved.
- **Pull payments** isolate payout failures from consensus work: a payment
  only fails in a plain transfer the recipient can retry forever.
- **Lazy timeouts** keep the contract free of cron assumptions; any observer
  can advance a stalled agreement, so neither party can warehouse the other's
  money by going quiet — deadlines always resolve to a refund path, never to
  a locked perdition.

## Reading it live

The console on the app shows `escrow_locked` and `claimable_total` from
`get_accounting`, and each agreement view renders its escrow and settlement
reads from `0xbE2Dd3c07322b013244477646977935b4fF21A73` directly.
