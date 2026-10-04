#!/usr/bin/env python3
"""Independent Pactmark certificate verifier.

Verifies a canonical Pactmark certificate without trusting any frontend:

    python3 scripts/verification/verify_certificate.py certificate.json \
        --bundle bundle.json \
        --onchain-hash "$(cat onchain-hash.txt)"

Checks performed:
  * structural schema of the certificate (fields, types, formats);
  * internal consistency (settlement sums to the escrowed amount, verdict and
    terminal state agree, identifiers and addresses are well formed);
  * every quote cited by a verifier is grounded in the frozen evidence bundle;
  * each bundle item hash matches sha256 of its content and the evidence root
    is recomputed from the bundle;
  * certificate_hash equals sha256 of the canonical certificate body, and
    optionally matches a hash read from the chain.

Exit code 0 means every check passed; 1 means at least one check failed.
Only the Python standard library is used.
"""

import argparse
import hashlib
import json
import re
import sys
from pathlib import Path

ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
HASH_RE = re.compile(r"^[0-9a-f]{64}$")
REQ_ID_RE = re.compile(r"^REQ-[0-9]{3}$")

TERMINAL_STATES = {"SETTLED", "REFUNDED", "FINALIZED", "CANCELLED"}
VERDICTS = {"PASS", "FAIL", "INSUFFICIENT_EVIDENCE", "CONFLICTING_EVIDENCE", "NOT_VERIFIED"}

TOP_LEVEL_REQUIRED = [
    "protocol", "statement", "agreement_id", "buyer", "worker", "currency",
    "amount", "deadline", "created_at", "agreement_hash", "frozen_hash",
    "specification", "specification_hash", "requirements_hash", "policies",
    "policies_hash", "evidence", "requirements", "challenges",
    "final_verdict", "terminal_state", "settlement", "certificate_hash",
]


def canon(obj) -> str:
    """Canonical JSON exactly as the contract serializes it."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def evidence_root(agreement_id: str, items: list[dict]) -> str:
    rows = [
        {
            "item_id": it["item_id"],
            "kind": it["kind"],
            "source": it["source"],
            "content_hash": it["content_hash"],
            "length": it["length"],
            "mutable": it["mutable"],
        }
        for it in items
    ]
    return sha(canon({"agreement_id": agreement_id, "items": rows}))


class Report:
    def __init__(self) -> None:
        self.failures: list[str] = []

    def check(self, condition: bool, label: str) -> None:
        print(("  PASS  " if condition else "  FAIL  ") + label)
        if not condition:
            self.failures.append(label)


def load_json(path: str):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except OSError as exc:
        print(f"error: cannot read {path}: {exc}")
        sys.exit(2)
    except json.JSONDecodeError as exc:
        print(f"error: {path} is not valid JSON: {exc}")
        sys.exit(2)


def verify_structure(cert: dict, report: Report) -> None:
    print("Structure")
    for field in TOP_LEVEL_REQUIRED:
        report.check(field in cert, f"field present: {field}")
    if not all(f in cert for f in TOP_LEVEL_REQUIRED):
        return
    report.check(cert.get("protocol") == "Pactmark", "protocol is Pactmark")
    report.check(isinstance(cert["statement"], str) and len(cert["statement"]) > 40,
                 "disclaimer statement is present")
    report.check(bool(ADDRESS_RE.match(str(cert["buyer"]))), "buyer is a valid address")
    report.check(bool(ADDRESS_RE.match(str(cert["worker"]))), "worker is a valid address")
    report.check(cert["buyer"].lower() != cert["worker"].lower(),
                 "buyer and worker differ")
    report.check(cert["terminal_state"] in TERMINAL_STATES, "terminal state is valid")
    report.check(cert["final_verdict"] in VERDICTS, "final verdict is valid")


def verify_consistency(cert: dict, report: Report) -> None:
    print("Internal consistency")
    try:
        amount = int(cert["amount"])
        to_worker = int(cert["settlement"]["to_worker"])
        to_buyer = int(cert["settlement"]["to_buyer"])
    except (KeyError, TypeError, ValueError):
        report.check(False, "amount and settlement parse as integers")
        return
    report.check(amount > 0, "escrowed amount is positive")
    report.check(amount == to_worker + to_buyer,
                 "settlement splits exactly the escrowed amount")
    if cert["terminal_state"] == "SETTLED":
        report.check(to_buyer == 0, "a settled agreement pays the worker in full")
    if cert["terminal_state"] == "REFUNDED":
        report.check(to_worker == 0, "a refunded agreement repays the buyer in full")
    if cert["final_verdict"] == "PASS":
        report.check(cert["terminal_state"] in {"SETTLED", "FINALIZED"},
                     "a passing verdict ends settled or jury-finalized")
    report.check(int(cert["deadline"]) > int(cert["created_at"]),
                 "deadline follows creation")
    report.check(int(cert.get("finalized_at", 0)) >= int(cert["created_at"]),
                 "finalization follows creation")
    for name in ("agreement_hash", "frozen_hash", "specification_hash",
                 "requirements_hash", "policies_hash", "certificate_hash"):
        report.check(bool(HASH_RE.match(str(cert.get(name, "")))),
                     f"{name} is a sha256 hex digest")
    root = cert.get("evidence", {}).get("root", "")
    report.check(bool(HASH_RE.match(str(root))), "evidence root is a sha256 hex digest")
    ids = [r.get("requirement_id", "") for r in cert["requirements"]]
    report.check(all(REQ_ID_RE.match(rid) for rid in ids), "requirement ids are REQ-nnn")
    report.check(len(ids) == len(set(ids)), "requirement ids are unique")
    for req in cert["requirements"]:
        report.check(req.get("status") in {"PASS", "FAIL", "INSUFFICIENT_EVIDENCE"},
                     f"{req.get('requirement_id')} carries a concrete verdict")
        verification = req.get("verification") or {}
        for quote in verification.get("quotes", []):
            report.check(6 <= len(str(quote.get("quote", ""))) <= 400,
                         f"{req.get('requirement_id')} quote length within bounds")


def verify_bundle(cert: dict, bundle: dict, report: Report) -> None:
    print("Evidence bundle")
    report.check(bundle.get("agreement_id") == cert.get("agreement_id"),
                 "bundle belongs to the certificate agreement")
    items = bundle.get("items", [])
    cert_items = {it["item_id"]: it for it in cert.get("evidence", {}).get("items", [])}
    bundle_items = {it["item_id"]: it for it in items}
    report.check(cert_items.keys() == bundle_items.keys(),
                 "certificate and bundle list the same evidence items")
    for item in items:
        content = str(item.get("content", ""))
        report.check(sha(content) == item.get("content_hash"),
                     f"{item['item_id']} content hash matches sha256 of the bytes")
        report.check(len(content.encode("utf-8")) == item.get("length"),
                     f"{item['item_id']} recorded length matches the bytes")
    for req in cert["requirements"]:
        for quote in (req.get("verification") or {}).get("quotes", []):
            source = bundle_items.get(str(quote.get("evidence_id", "")))
            grounded = source is not None and str(quote.get("quote", "")).strip() in source["content"]
            report.check(grounded,
                         f"{req['requirement_id']} quote grounded in {quote.get('evidence_id')}")
    if bundle_items:
        recomputed = evidence_root(cert["agreement_id"], items)
        report.check(recomputed == cert["evidence"]["root"],
                     "evidence root recomputed from the bundle")


def verify_hash(cert: dict, onchain: str | None, report: Report) -> None:
    print("Canonical hash")
    stated = str(cert.get("certificate_hash", ""))
    body = {k: v for k, v in cert.items() if k != "certificate_hash"}
    recomputed = sha(canon(body))
    report.check(HASH_RE.match(stated) is not None,
                 "stated certificate hash is well formed")
    report.check(recomputed == stated, "certificate hash recomputes from the body")
    if onchain is not None:
        report.check(onchain.lower().strip() == stated.lower(),
                     "certificate hash matches the on-chain hash")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Verify a Pactmark certificate offline.")
    parser.add_argument("certificate", help="path to the certificate JSON file")
    parser.add_argument("--bundle", help="path to the matching evidence bundle JSON")
    parser.add_argument("--onchain-hash",
                        help="expected on-chain certificate hash, or @file to read it from a file")
    args = parser.parse_args(argv)

    cert = load_json(args.certificate)
    if not isinstance(cert, dict):
        print("error: the certificate must be a JSON object")
        return 2

    report = Report()
    verify_structure(cert, report)
    if all(f in cert for f in TOP_LEVEL_REQUIRED):
        verify_consistency(cert, report)
        if args.bundle:
            bundle = load_json(args.bundle)
            verify_bundle(cert, bundle, report)
        onchain = None
        if args.onchain_hash:
            onchain = (Path(args.onchain_hash[1:]).read_text(encoding="utf-8").strip()
                       if args.onchain_hash.startswith("@") else args.onchain_hash)
        verify_hash(cert, onchain, report)

    print()
    if report.failures:
        print(f"verification FAILED: {len(report.failures)} check(s) did not pass.")
        return 1
    print("verification passed: the certificate is structurally valid and self-consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
