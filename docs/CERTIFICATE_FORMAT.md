# Certificate format

When an agreement reaches a paying terminal state (`SETTLED`, `REFUNDED` or
`FINALIZED`), the contract seals a canonical certificate and stores its JSON
and hash on-chain. (`CANCELLED` agreements, which never locked escrow, seal
nothing.) Anyone can recompute the
hash independently — with the Python verifier in `scripts/verification/`, or
directly in the browser on the app's Verify page — and compare it with
`get_certificate_hash`. If one byte differs, verification fails.

## Canonicalization and hashing

Two primitives define everything:

```
canon(x)  = json.dumps(x, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
sha256(x) = hex digest of sha256 over the UTF-8 bytes of canon(x)
```

- Keys are sorted at every depth; there is no whitespace anywhere;
  non-ASCII characters are escaped as `\uXXXX` (surrogate pairs outside the
  BMP). The JavaScript implementation in `src/lib/canon.ts` is byte-identical.
- `certificate_hash` is `sha256` of the canonical certificate **without** the
  `certificate_hash` field itself. The hash is computed first, then attached.

## The statement

Every certificate embeds this disclaimer verbatim; verifiers must display it:

> This certificate establishes that the submitted evidence, frozen at the
> recorded evidence root, satisfied or failed to satisfy the declared
> requirements under the declared verification protocol, as judged by
> GenLayer validator consensus and, where applicable, a staked jury. It is
> not a guarantee that the deliverable is correct, secure or fit for any
> purpose beyond those requirements.

A certificate proves *what the evidence showed to validators and a jury*. It
is not a warranty about the deliverable.

## Top-level fields

| Field | Type | Meaning |
|---|---|---|
| `protocol` | string | Always `Pactmark`. |
| `protocol_version` | string | Certificate schema marker. |
| `statement` | string | The disclaimer above. |
| `agreement_id` | string | Agreement identifier assigned at creation. |
| `buyer`, `worker` | address | Parties, lowercase 0x-prefixed 20-byte hex. |
| `currency` | string | Escrow currency, `GEN` on Studionet. |
| `amount` | string | Escrowed amount in wei (decimal string). |
| `deadline` | int | Work deadline, Unix seconds. |
| `created_at`, `accepted_at`, `finalized_at` | int | Unix seconds. |
| `verification_timestamp` | int | Aggregation time; 0 when never aggregated. |
| `terminal_state` | string | One of the four terminal states. |
| `final_verdict` | string | `PASS`, `FAIL`, `INSUFFICIENT_EVIDENCE` or `NOT_VERIFIED`. |
| `result_note` | string | Short human-readable closure note. |
| `certificate_hash` | hash | See canonicalization above. |

## Specification, policies and root hashes

| Field | Meaning |
|---|---|
| `specification` | Object with `title`, `description`, `specification` — the frozen prose. |
| `specification_hash` | `sha256(canon(specification))`, frozen at acceptance. |
| `requirements_hash` | `sha256(canon(requirement_definitions))`. |
| `policies` | `evidence` (`STRICT`/`PERMISSIVE`), `verification` (`STANDARD`/`ADVERSARIAL`), `dispute` (`JURY`/`NONE`). |
| `policies_hash` | `sha256(canon(policies))`. |
| `agreement_hash` | Hash of the core agreement record at funding. |
| `frozen_hash` | Hash binding the accepted terms to the acceptance timestamp. |

These let a verifier re-derive that the prose being argued about is exactly
the prose the worker accepted.

## Evidence

```
"evidence": {
  "root": "<sha256>",
  "items": [
    { "item_id": "E1", "kind": "github_file" | "github_diff" | "github_pr"
      | "url" | "text" | "artifact_hash" | "tx_reference",
      "source": "<origin string>", "content_hash": "<sha256 of bytes>",
      "length": <utf-8 byte count>, "mutable": 0 | 1 }
  ],
  "any_mutable_source": 0 | 1
}
```

- `content_hash` is `sha256` of the **frozen bytes** fetched through
  validator consensus at freeze time — not a hash of whatever the URL serves
  today.
- `root` is `sha256(canon({agreement_id, items}))` over the item rows in
  order. Recomputing the root requires the bundle (bytes included), which the
  contract exposes through `get_evidence_bundle`.
- `mutable = 1` marks evidence whose origin can change (plain URLs under the
  permissive policy); the frozen bytes still govern every verdict.
- `source` pins origins immutably: GitHub references carry full 40-character
  commit SHAs, artifacts carry sha256 digests, text evidence is embedded.

## Requirements

Each entry:

| Field | Meaning |
|---|---|
| `requirement_id` / `definition` | Identifier (`REQ-nnn`) and the frozen definition (description, method, evidence demands). |
| `requirement_hash` | Hash of the frozen definition. |
| `status` | `PASS`, `FAIL` or `INSUFFICIENT_EVIDENCE`. |
| `detail` | Flag such as `UNGROUNDED_PASS` or `RED_TEAM_MISSING`, empty when clean. |
| `disputed` | 1 while the requirement is inside an open dispute. |
| `verification` | Validator verdict object: `verdict`, `quotes`, `reason`. |
| `verification_hash` | `sha256(canon(verification))`. |
| `redteam`, `redteam_hash` | Adversarial pass result and its hash; `null` under the standard policy. |
| `challenge_count` | Objections raised against this verdict. |

Quotes are the heart of grounding: each is `{"evidence_id", "quote"}` with a
6–400 character excerpt that must appear verbatim (after whitespace
normalization) inside the referenced frozen evidence item. A verifier does
not trust the verdict text — it re-checks every quote against the bundle.

## Challenges

Grounded objections recorded during the challenge window:

| Field | Meaning |
|---|---|
| `challenge_id`, `requirement_id`, `side`, `challenger` | Identity. |
| `claim`, `evidence_id`, `quote`, `reasoning` (hash only in `challenge_hash`) | The objection content. |
| `original_status`, `resolved_status` | Verdict before/after adjudication. |
| `status` | `UPHELD` or `REJECTED`. |
| `challenge_hash` | `sha256(canon(challenge_record))` at resolution. |

An upheld challenge replaces the requirement status with `resolved_status`
and sets detail `CHALLENGE_UPHELD`; if the overall result no longer passes,
the agreement state follows (see `docs/STATE_MACHINE.md`).

## Dispute record

`null` unless a bonded dispute ran. When present:

| Field | Meaning |
|---|---|
| `opened_by`, `side`, `requirement_ids` | Who disputed which verdicts. |
| `bond` | Wei posted; recovered per the rules in `docs/DISPUTE_MODEL.md`. |
| `result` | `WORKER_PREVAILED`, `BUYER_PREVAILED`, `DEADLOCK_FALLBACK` or `NO_JURY_FALLBACK`. |
| `votes_worker`, `votes_buyer`, `revealed` | Tally after reveal. |
| `jurors` | Seated juror addresses. |
| `pool_size` | Snapshot size of the juror pool at dispute opening. |
| `beacon_round`, `beacon` | drand round and randomness used for seating. |
| `statement_hash`, `response_hash` | Hashes of both parties' statements (never trusted as instructions). |

Jury commitments off-chain follow the contract's formula:
`commit = sha256(agreement_id + ":" + juror + ":" + vote + ":" + salt)` with
8–64 character salts, verified at reveal. The demo generator in
`scripts/demo/run_demo.py` emits matching sample commitments.

## Settlement

```
"settlement": { "to_worker": "<wei>", "to_buyer": "<wei>" }
```

`to_worker + to_buyer == amount` always. Terminal-state rules:
`SETTLED ⇒ to_buyer = 0`; `REFUNDED ⇒ to_worker = 0`; `FINALIZED` follows the
dispute result or fallback.

## Verifying a certificate

1. Check structure, verdicts, addresses and terminal-state legality.
2. Check settlement sums to the amount and obeys the terminal rules.
3. With the bundle: re-hash every item's bytes, compare with `content_hash`
   and `length`; re-quote every verdict quote against the bytes; recompute
   the evidence `root`.
4. Recompute `certificate_hash` from the canonical body; compare with the
   stated hash and, for live agreements, with `get_certificate_hash` read
   from the contract.

Any single mismatch fails the whole verification. Reference implementations:
`scripts/verification/verify_certificate.py` and `src/lib/verify.ts`;
end-to-end fixtures regenerate via `python3 scripts/demo/run_demo.py`.
