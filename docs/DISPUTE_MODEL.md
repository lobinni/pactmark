# Dispute model

Validator consensus is strong but not infallible. Pactmark layers two
escalation paths on top of it: an open **challenge window** for grounded
objections, and a **bonded dispute** that seats a staked, drand-drawn jury.
Both are on-chain, both are priced, and both terminate in a certificate.

## Layer 1 — the challenge window

After aggregation, a window opens before money moves: 24 hours for the
standard verification policy, 72 hours for the adversarial policy. During the
window anyone — not only the parties — can file a challenge against any
requirement verdict.

A challenge is only admissible when it is *grounded*:

- it names the requirement and cites a frozen evidence item;
- it carries a verbatim quote (6–400 characters) from that item;
- it states a claim and reasoning within the contract's length bounds.

A validator panel re-judges the objection under consensus. Outcomes:

- `UPHELD` — the requirement status is replaced by the resolved status and
  flagged `CHALLENGE_UPHELD`. If the overall result no longer passes, the
  agreement demotes `VERIFIED_PASS → VERIFIED_FAIL` or
  `INSUFFICIENT_EVIDENCE` and a fresh 72-hour dispute window opens — the only
  sanctioned backward transition in the state machine.
- `REJECTED` — the verdict stands; the challenge remains on the record with
  its hash in the certificate.

Untrusted-content discipline: the contract prompts validators to treat
evidence, statements and reasoning strictly as data, never as instructions.

## Layer 2 — the bonded dispute

Either party may escalate their own losing verdicts by posting a bond while
the dispute window (72 hours) lasts:

| | |
|---|---|
| Bond | `max(0.1 GEN, amount / 20)` wei, exactly |
| Buyer disputes | only requirements currently passing |
| Worker disputes | only requirements currently failing or insufficient |
| Statement | 20–2000 characters, recorded and hashed |

A wrong bond value is not lost — the rejection rule credits it to the
sender's withdrawable ledger (`docs/ESCROW_MODEL.md`). A valid bond marks the
cited requirements disputed, locks the bond and opens a 24-hour response
window for the other party's counter-statement.

If the dispute policy is `NONE`, this layer is disabled for the agreement;
settlement follows the validator verdict after the challenge window.

## Jury selection — drand-seated, snapshot-drawn

When the response window closes the run moves to jury seating:

1. **Snapshot.** The dispute records the juror-pool size at opening, so late
   registrations cannot tilt a draw.
2. **Beacon.** Seating waits for a drand round published *after* the dispute
   opened (chain `8990e7a9…2ce`, 30-second rounds, fetched through validator
   consensus with a 60-second margin). Nobody can know the randomness when
   deciding to dispute or registering as a juror.
3. **Draw.** Seats fill deterministically:
   `index = sha256(beacon : agreement_id : k) mod pool_size` for successive
   `k`, skipping ineligible accounts: the parties themselves, jurors
   registered after the snapshot, exiting or removed jurors, and repeats.
   Up to 64 draws attempt to fill 3 seats.
4. **Fallback.** If 48 hours of challenge phase plus a 24-hour grace pass
   without a full panel, the dispute closes as `NO_JURY_FALLBACK`: the bond
   returns to its owner and settlement follows the recorded protocol result.

Panel size 3, quorum 2 — a single honest juror cannot be outvoted silently.

## Commit–reveal voting

Seated jurors vote in two phases, each 24 hours:

```
commit  = sha256(agreement_id : juror : vote : salt),   salt 8–64 chars
reveal  = (vote, salt) matching the stored commitment
```

- Commitments are opaque, so votes cannot be copied or strategized against.
- Only seated jurors may act, only within their windows, and exactly once —
  the contract enforces identity and deadlines.
- Missing the reveal forfeits the protection of one's stake: no-shows are
  slashed.

## Outcomes and money

After all reveals — or the reveal deadline with fewer than quorum reveals —
anyone triggers finalization:

| Result | Condition | Escrow | Bond and stakes |
|---|---|---|---|
| `WORKER_PREVAILED` | worker votes × 2 > seated count | all to worker | decisive: collateral to the winning side's backer; majority jurors split the fee plus slashed stakes |
| `BUYER_PREVAILED` | buyer votes × 2 > seated count | all to buyer | same distribution |
| `DEADLOCK_FALLBACK` | no strict majority | per recorded protocol result | collateral returns to the opener; revealers split the fee |
| `NO_JURY_FALLBACK` | panel never filled | per protocol result | full bond returns to the opener |

Bond accounting is exact: half the bond is the fee, the remainder is
collateral; slashed stakes join the reward pool; any undistributable
remainder falls to the treasury — the conservation equation in
`docs/ESCROW_MODEL.md` always balances.

The run ends `FINALIZED` and the certificate seals the tally, juror set,
pool snapshot, beacon round and randomness (see `docs/CERTIFICATE_FORMAT.md`).

## Juror lifecycle

| Stage | Rule |
|---|---|
| Register | Lock exactly 0.1 GEN via `register_juror`; the app's Join section performs this directly from MetaMask. |
| Seated | Eligible draws require registration before the dispute snapshot and no pending exit. |
| Vote | Commit and reveal in time; honest majority voters share fees, no-shows and decisive-minority voters are slashed. |
| Exit | `request_juror_exit` blocks future draws; the stake withdraws after the 96-hour delay, subject to the minimum membership age. |

## Safety properties and honest limitations

- **No bribery channel in-protocol.** Votes are sealed until cast, and the
  panel is unknowable at dispute time.
- **Skin in the game everywhere.** Disputes cost bonds; wrong or absent
  jurors lose stakes; lies cost the loser real collateral.
- **Fail-safe money.** Every dispute path — deadlock, empty pool, missed
  reveal — converges to a defined settlement, never to locked funds.
- **What a jury is not.** Three strangers judge outcomes recorded by
  validator consensus over frozen evidence; they are not auditors of the
  deliverable, and a certificate never claims they are. Studionet behavior is
  best-effort testnet behavior, and the protocol is unaudited.
