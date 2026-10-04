#!/usr/bin/env python3
"""Deterministic offline walkthrough of the Pactmark protocol.

Reads examples/demo-agreement/agreement-input.json and regenerates the sample
certificate bundles:

    python3 scripts/demo/run_demo.py            # write the sample files
    python3 scripts/demo/run_demo.py --check    # verify checked-in samples

Two scenarios are produced with real sha256 hashes:

  * settled               - every requirement passes, escrow goes to the worker
  * refunded-after-jury   - a bonded dispute seats a jury, the buyer prevails
                            and the escrow is refunded

The samples are illustrative: the on-chain contract remains the only authority
on payouts. Use --check in CI to detect drift between the generator and the
checked-in files.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "verification"))
import verify_certificate as vc  # noqa: E402

EXAMPLES = ROOT / "examples" / "demo-agreement"
HOUR = 3600


def load_input() -> dict:
    return json.loads((EXAMPLES / "agreement-input.json").read_text(encoding="utf-8"))


def build_common(data: dict) -> dict:
    specification = {
        "title": data["title"],
        "description": data["description"],
        "specification": data["specification"],
    }
    policies = data["policies"]
    requirement_defs = [
        {
            "id": r["id"],
            "description": r["description"],
            "method": r["method"],
            "evidence_requirements": r["evidence_requirements"],
        }
        for r in data["requirements"]
    ]
    agreement_core = {
        "agreement_id": data["agreement_id"],
        "buyer": data["buyer"].lower(),
        "worker": data["worker"].lower(),
        "currency": data["currency"],
        "amount": data["amount"],
        "deadline": data["deadline"],
        "created_at": data["created_at"],
        "requirements_hash": vc.sha(vc.canon(requirement_defs)),
        "specification_hash": vc.sha(vc.canon(specification)),
        "policies_hash": vc.sha(vc.canon(policies)),
    }
    agreement_hash = vc.sha(vc.canon(agreement_core))
    accepted_at = data["created_at"] + HOUR
    return {
        "specification": specification,
        "policies": policies,
        "requirement_defs": requirement_defs,
        "agreement_hash": agreement_hash,
        "frozen_hash": vc.sha(agreement_hash + ":" + str(accepted_at)),
        "accepted_at": accepted_at,
    }


def build_bundle(data: dict) -> dict:
    items = []
    for entry in data["evidence"]:
        content = entry["content"]
        items.append(
            {
                "item_id": entry["item_id"],
                "kind": entry.get("kind", "text"),
                "source": "text:" + vc.sha(content)[:16],
                "content": content,
                "content_hash": vc.sha(content),
                "length": len(content.encode("utf-8")),
                "mutable": 0,
            }
        )
    return {
        "agreement_id": data["agreement_id"],
        "evidence_root": vc.evidence_root(data["agreement_id"], items),
        "items": items,
    }


def requirement_result(req: dict, verdict: str) -> dict:
    if verdict == "PASS":
        verification = {
            "verdict": "PASS",
            "quotes": [{"evidence_id": req["evidence_ref"], "quote": req["expect_quote"]}],
            "reason": "The frozen evidence shows the requirement is met by the cited passage.",
        }
    else:
        verification = {
            "verdict": "FAIL",
            "quotes": [],
            "reason": "The frozen evidence does not demonstrate the behaviour the requirement demands.",
        }
    return {
        "requirement_id": req["id"],
        "definition": {
            "id": req["id"],
            "description": req["description"],
            "method": req["method"],
            "evidence_requirements": req["evidence_requirements"],
        },
        "status": verdict,
        "detail": "",
        "verification": verification,
        "verification_hash": vc.sha(vc.canon(verification)),
        "challenge_count": 0,
        "requirement_hash": vc.sha(vc.canon({
            "id": req["id"],
            "description": req["description"],
            "method": req["method"],
            "evidence_requirements": req["evidence_requirements"],
        })),
    }


def certificate(data: dict, common: dict, bundle: dict, scenario: str) -> dict:
    aggregated_at = data["created_at"] + 8 * HOUR
    settled = scenario == "settled"
    amount = int(data["amount"])

    requirements = []
    for req in data["requirements"]:
        verdict = "PASS" if settled else req["scenario_b_verdict"]
        result = requirement_result(req, verdict)
        if not settled and verdict == "FAIL":
            result["challenge_count"] = 1
        requirements.append(result)

    evidence_items = [
        {k: it[k] for k in ("item_id", "kind", "source", "content_hash", "length", "mutable")}
        for it in bundle["items"]
    ]

    challenges = []
    dispute = None
    if not settled:
        ch = data["challenge"]
        body = {
            "challenge_id": "CH-001",
            "requirement_id": ch["requirement_id"],
            "side": ch["side"],
            "claim": ch["claim"],
            "evidence_id": ch["evidence_id"],
            "quote": ch["quote"],
            "reasoning": ch["reasoning"],
            "original_status": "FAIL",
            "status": "REJECTED",
            "resolved_status": "FAIL",
        }
        body["challenge_hash"] = vc.sha(vc.canon(body))
        challenges.append(body)
        jurors = data["jurors"]
        votes_worker = sum(1 for j in jurors if j["vote"] == "WORKER")
        votes_buyer = sum(1 for j in jurors if j["vote"] == "BUYER")
        bond = max(10**17, amount // 20)
        dispute = {
            "opened_by": data["worker"].lower(),
            "side": "WORKER",
            "requirement_ids": ch["requirement_id"],
            "bond": str(bond),
            "result": "BUYER_PREVAILED",
            "votes_worker": votes_worker,
            "votes_buyer": votes_buyer,
            "revealed": len(jurors),
            "jurors": [j["address"].lower() for j in jurors],
            "pool_size": len(jurors),
            "beacon_round": 1_900_000 + data["created_at"] % 1000,
            "beacon": vc.sha("drand-demo:" + data["agreement_id"]),
            "statement_hash": vc.sha(ch["statement"]),
            "response_hash": vc.sha(ch["response"]),
            "commitments": [
                {
                    "juror": j["address"].lower(),
                    "commit": vc.sha(
                        data["agreement_id"] + ":" + j["address"].lower()
                        + ":" + j["vote"] + ":" + j["salt"]
                    ),
                    "vote": j["vote"],
                    "salt": j["salt"],
                }
                for j in jurors
            ],
        }

    final_verdict = "PASS" if settled else "FAIL"
    cert = {
        "protocol": "Pactmark",
        "statement": (
            "This certificate establishes that the submitted evidence, frozen at the recorded "
            "evidence root, satisfied or failed to satisfy the declared requirements under the "
            "declared verification protocol, as judged by GenLayer validator consensus and, "
            "where applicable, a staked jury. It is not a guarantee that the deliverable is "
            "correct, secure or fit for any purpose beyond those requirements."
        ),
        "agreement_id": data["agreement_id"],
        "buyer": data["buyer"].lower(),
        "worker": data["worker"].lower(),
        "currency": data["currency"],
        "amount": data["amount"],
        "deadline": data["deadline"],
        "created_at": data["created_at"],
        "accepted_at": common["accepted_at"],
        "agreement_hash": common["agreement_hash"],
        "frozen_hash": common["frozen_hash"],
        "specification": common["specification"],
        "specification_hash": vc.sha(vc.canon(common["specification"])),
        "requirements_hash": vc.sha(vc.canon(common["requirement_defs"])),
        "policies": common["policies"],
        "policies_hash": vc.sha(vc.canon(common["policies"])),
        "evidence": {
            "root": bundle["evidence_root"],
            "items": evidence_items,
            "any_mutable_source": 0,
        },
        "requirements": requirements,
        "challenges": challenges,
        "final_verdict": final_verdict,
        "result_note": (
            "All requirements passed validator consensus; settled after the challenge window."
            if settled else
            "A bonded jury upheld the failed verdict and the escrow was returned to the buyer."
        ),
        "terminal_state": "SETTLED" if settled else "FINALIZED",
        "dispute": dispute,
        "settlement": (
            {"to_worker": data["amount"], "to_buyer": "0"}
            if settled else
            {"to_worker": "0", "to_buyer": data["amount"]}
        ),
        "verification_timestamp": aggregated_at,
        "finalized_at": aggregated_at + (25 * HOUR if settled else 76 * HOUR),
    }
    cert["certificate_hash"] = vc.sha(vc.canon(cert))
    return cert


def write_scenario(data: dict, common: dict, bundle: dict, name: str) -> list[Path]:
    cert = certificate(data, common, bundle, name)
    paths = [
        (EXAMPLES / f"certificate-{name}.json", json.dumps(cert, indent=2) + "\n"),
        (EXAMPLES / f"bundle-{name}.json", json.dumps(bundle, indent=2) + "\n"),
        (EXAMPLES / f"onchain-hash-{name}.txt", cert["certificate_hash"] + "\n"),
    ]
    written = []
    for path, content in paths:
        path.write_text(content, encoding="utf-8")
        written.append(path)
    return written


def main(argv: list[str]) -> int:
    check = "--check" in argv
    data = load_input()
    common = build_common(data)
    bundle = build_bundle(data)

    scenarios = ["settled", "refunded-after-jury"]
    if not check:
        for name in scenarios:
            for path in write_scenario(data, common, bundle, name):
                print("wrote", path.relative_to(ROOT))
        print()
        print("Sample certificates regenerated. Verify them with:")
        for name in scenarios:
            print(
                f"  python3 scripts/verification/verify_certificate.py "
                f"examples/demo-agreement/certificate-{name}.json "
                f"--bundle examples/demo-agreement/bundle-{name}.json "
                f"--onchain-hash @examples/demo-agreement/onchain-hash-{name}.txt"
            )
        return 0

    failures = 0
    for name in scenarios:
        cert_path = EXAMPLES / f"certificate-{name}.json"
        bundle_path = EXAMPLES / f"bundle-{name}.json"
        hash_path = EXAMPLES / f"onchain-hash-{name}.txt"
        for path in (cert_path, bundle_path, hash_path):
            if not path.exists():
                print(f"  FAIL  missing generated file: {path.relative_to(ROOT)}")
                failures += 1
        if failures:
            continue
        regenerated = vc.canon(json.loads(vc.canon(certificate(data, common, bundle, name))))
        on_disk = vc.canon(json.loads(cert_path.read_text(encoding="utf-8")))
        if regenerated != on_disk:
            print(f"  FAIL  {cert_path.relative_to(ROOT)} is stale; rerun scripts/demo/run_demo.py")
            failures += 1
        code = vc.main([
            str(cert_path), "--bundle", str(bundle_path), "--onchain-hash", "@" + str(hash_path),
        ])
        failures += code
    print()
    if failures:
        print("demo check FAILED.")
        return 1
    print("demo check passed: samples are fresh and internally consistent.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
