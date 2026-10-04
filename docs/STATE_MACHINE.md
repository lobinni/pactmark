# State machine

The Pactmark contract is a deterministic state machine. Every agreement moves
through a fixed set of lifecycle states, every transition is an on-chain
transaction signed by an authorized actor, and the transition table below is
enforced by the contract itself — no caller can skip states or move backwards.

Live contract: `0xbE2Dd3c07322b013244477646977935b4fF21A73` on GenLayer
Studionet (chain 61999).

## Diagram

```
                 fund
 (skip) ────────────────────────────┐
                                   ▼
CREATED ──► FUNDED ──► ACCEPTED ──► IN_PROGRESS ──► DELIVERED ──► VERIFICATION_PENDING
   │          │           │              │                              │  │  │
   │          │           │              │                    ┌─────────┘  │  └──────────┐
   │          │           │              │                    ▼            ▼             ▼
   ▼          │           │              │              VERIFIED_PASS  VERIFIED_FAIL  INSUFFICIENT_
CANCELLED     │           │              │                 │      ▲          │          EVIDENCE
              │           │              │                 │      └──────────┼─────────────┤
              │           │              ▼                 │    (challenge   │             │
              │           │          TIMEOUT ◄─────────────┘     upheld)     │             │
              │           │              │                                   │             │
              ▼           │              ▼            dispute window          ▼             │
          REFUNDED ◄──────┴──────────── REFUNDED ◄────────────────────────────┴─────────────┘
                          timeout/failure refund         (after 72 h dispute window)

Dispute lane (policy JURY):

VERIFIED_PASS / VERIFIED_FAIL / INSUFFICIENT_EVIDENCE
   └──► DISPUTED ──► CHALLENGE ──► FINAL_REVIEW ──► FINALIZED
                          │                              ▲
                          └────────► FINALIZED ──────────┘
                                   (no-jury fallback)

Terminal: CANCELLED, SETTLED, REFUNDED, FINALIZED — each seals a certificate.
```

## States

| State | Meaning | Who can act next |
|---|---|---|
| `CREATED` | Terms recorded; no escrow locked. | Buyer funds; creator cancels. |
| `FUNDED` | Exact escrow locked once. | Worker accepts; buyer refunds until acceptance. |
| `ACCEPTED` | Worker signed the frozen terms; work window open. | Worker starts work. |
| `IN_PROGRESS` | Worker is executing against the requirements. | Worker delivers; anyone watches the deadline. |
| `DELIVERED` | Evidence references submitted; freeze window open. | Buyer or worker freezes fetched bytes. |
| `VERIFICATION_PENDING` | Evidence frozen; validators judge requirements. | Anyone triggers verification and aggregation. |
| `VERIFIED_PASS` | All requirements passed consensus. | Settle after the challenge window; either party may dispute in time. |
| `VERIFIED_FAIL` | At least one requirement failed. | Buyer refunds after the dispute window; either party may dispute. |
| `INSUFFICIENT_EVIDENCE` | Evidence could not decide one or more requirements. | Same dispute/refund lane as a fail. |
| `DISPUTED` | A bonded dispute is open. | The other party responds within the response window. |
| `CHALLENGE` | Jury seating phase. | Anyone requests seating once the drand round exists; jurors volunteer from the snapshot pool. |
| `FINAL_REVIEW` | Jury seated; votes are committed then revealed. | Seated jurors commit, then reveal. |
| `TIMEOUT` | A stage deadline expired before the required act. | Buyer is refunded. |
| `SETTLED` | Escrow credited to the worker. Terminal. | — |
| `FINALIZED` | A dispute concluded (jury or fallback). Terminal. | — |
| `REFUNDED` | Escrow credited back to the buyer. Terminal. | — |
| `CANCELLED` | Agreement abandoned before funding. Terminal. | — |

## Transitions enforced by the contract

| From | Allowed next states |
|---|---|
| `CREATED` | `FUNDED`, `CANCELLED` |
| `FUNDED` | `ACCEPTED`, `REFUNDED`, `TIMEOUT` |
| `ACCEPTED` | `IN_PROGRESS`, `TIMEOUT` |
| `IN_PROGRESS` | `DELIVERED`, `TIMEOUT` |
| `DELIVERED` | `VERIFICATION_PENDING`, `INSUFFICIENT_EVIDENCE` |
| `VERIFICATION_PENDING` | `VERIFIED_PASS`, `VERIFIED_FAIL`, `INSUFFICIENT_EVIDENCE` |
| `VERIFIED_PASS` | `SETTLED`, `VERIFIED_FAIL`, `INSUFFICIENT_EVIDENCE`, `DISPUTED` |
| `VERIFIED_FAIL` | `DISPUTED`, `REFUNDED` |
| `INSUFFICIENT_EVIDENCE` | `DISPUTED`, `REFUNDED` |
| `DISPUTED` | `CHALLENGE` |
| `CHALLENGE` | `FINAL_REVIEW`, `FINALIZED` |
| `FINAL_REVIEW` | `FINALIZED` |
| `TIMEOUT` | `REFUNDED` |
| `SETTLED`, `FINALIZED`, `REFUNDED`, `CANCELLED` | terminal, no outgoing edges |

A challenge upheld against a passing run demotes `VERIFIED_PASS` back to
`VERIFIED_FAIL` or `INSUFFICIENT_EVIDENCE` and re-opens the dispute window —
the only sanctioned backward move, because new information legitimately
changes the outcome.

## Windows (all enforced on-chain, in seconds since the Unix epoch)

| Window | Length | Purpose |
|---|---|---|
| Deadline bounds | 1 h – 8760 h | Legal delivery deadlines at creation. |
| Freeze | 24 h | Fetch and freeze evidence bytes after delivery. |
| Verification | 24 h | Validator checks and aggregation. |
| Challenge (standard) | 24 h | Grounded objections to a verdict. |
| Challenge (adversarial) | 72 h | Objections when the adversarial policy applies. |
| Dispute | 72 h | Window to post a bond before a plain refund/settle. |
| Dispute response | 24 h | Counter-statement to the dispute statement. |
| Challenge phase | 48 h | Seating phase before the no-jury fallback. |
| Seat grace | 24 h | Extra time after beacon availability for seating. |
| Commit / reveal | 24 h each | Sealed then published jury votes. |
| Juror exit delay | 96 h | Stake becomes withdrawable after the delay. |
| Minimum juror membership | 720 h | Membership age enforced by the contract. |

Timeouts are lazy: the contract flips to `TIMEOUT` when any call observes an
expired `stage_deadline`, then the buyer refund path opens.

## Requirement-level verdict machina

Alongside agreement state, each requirement carries its own status:

| Status | Reachable when |
|---|---|
| `UNVERIFIED` | Before validator consensus on that requirement. |
| `PASS` | Verdict pass with at least one quote grounded in frozen evidence. |
| `FAIL` | Verdict fail, or a pass overturned for missing grounding. |
| `INSUFFICIENT_EVIDENCE` | The frozen evidence cannot decide the requirement. |

Derived overall results: `PASS` only when every requirement passes and no
conflict flag is raised; `FAIL` when any requirement fails;
`CONFLICTING_EVIDENCE` when validators report conflict; otherwise
`INSUFFICIENT_EVIDENCE`. A finalized agreement whose run never reached
aggregation records `NOT_VERIFIED`.

Detail flags recorded next to verdicts: `UNGROUNDED_PASS`,
`CONFLICTING_EVIDENCE`, `UNGROUNDED_CONFLICT`, `TIMEOUT`,
`RED_TEAM_COUNTEREXAMPLE`, `RED_TEAM_MISSING`, `CHALLENGE_UPHELD`,
`EVIDENCE_NOT_FROZEN`.

## Invariants

1. All transitions appear in the table above and are checked against the
   current state and the caller's role.
2. Terminal states are irreversible; exactly one certificate is sealed per
   agreement, at the moment it becomes terminal.
3. Escrow leaves its locked bucket only into a party's withdrawable balance —
   never directly to another address (see `docs/ESCROW_MODEL.md`).
4. Deadline flips are monotonic: every stage records `stage_deadline`, and an
   expired deadline can only move the agreement forward, never backward.
