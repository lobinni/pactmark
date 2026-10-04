#!/usr/bin/env python3
"""Static checks for the Pactmark intelligent contract and deployment manifest.

Run from the repository root:

    python3 scripts/deploy/check_contract.py

The script fails (exit code 1) when a required contract structure or a
deployment manifest invariant is broken. It uses only the Python standard
library so it can run anywhere, including CI.
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = ROOT / "contracts" / "pactmark.py"
MANIFEST = ROOT / "deployments" / "studionet.json"
FRONTEND_CONFIG = ROOT / "frontend" / "assets" / "config.js"

ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
TX_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")

STATES = [
    "CREATED", "FUNDED", "ACCEPTED", "IN_PROGRESS", "DELIVERED",
    "VERIFICATION_PENDING", "VERIFIED_PASS", "VERIFIED_FAIL",
    "INSUFFICIENT_EVIDENCE", "DISPUTED", "CHALLENGE", "FINAL_REVIEW",
    "FINALIZED", "SETTLED", "TIMEOUT", "CANCELLED", "REFUNDED",
]

TERMINAL = ["SETTLED", "FINALIZED", "REFUNDED", "CANCELLED"]

REQUIRED_VIEWS = [
    "get_protocol_info", "agreement_count", "list_agreements", "get_juror",
    "get_agreement", "get_requirements", "get_evidence_bundle",
    "get_challenges", "get_dispute", "get_certificate",
    "get_certificate_hash", "get_balance", "get_accounting",
]

REQUIRED_WRITES = [
    "register_juror", "request_juror_exit", "withdraw_juror_stake",
    "seat_jury", "commit_vote", "reveal_vote", "finalize_dispute",
    "respond_dispute", "settle", "open_dispute",
]

EXPECTED_WRITES = [
    "create_agreement", "fund", "accept_terms", "submit_evidence",
    "freeze_evidence", "run_verification", "aggregate", "challenge",
    "refund", "withdraw",
]

failures: list[str] = []
warnings: list[str] = []


def ok(message: str) -> None:
    print(f"  PASS  {message}")


def fail(message: str) -> None:
    failures.append(message)
    print(f"  FAIL  {message}")


def warn(message: str) -> None:
    warnings.append(message)
    print(f"  WARN  {message}")


def check_contract_source() -> None:
    print("Contract source")
    if not CONTRACT.exists():
        fail(f"missing contract file: {CONTRACT.relative_to(ROOT)}")
        return
    text = CONTRACT.read_text(encoding="utf-8")
    if len(text) < 40_000:
        fail("contract source is unexpectedly small; the file may be truncated")
    else:
        ok(f"contract source present ({len(text):,} bytes)")

    if "from genlayer import *" not in text:
        fail("contract must import genlayer")
    if 'PROTOCOL = "Pactmark"' not in text:
        fail("PROTOCOL constant must be Pactmark")
    else:
        ok("genlayer import and protocol identity present")

    for name in STATES:
        if f'"{name}"' not in text:
            fail(f"lifecycle state {name} is not defined")
    if "ALLOWED_EDGES" not in text:
        fail("ALLOWED_EDGES transition table is missing")
    if "TERMINAL_STATES" not in text:
        fail("TERMINAL_STATES is missing")
    for name in TERMINAL:
        if f'"{name}"' not in text:
            fail(f"terminal state {name} is not referenced")
    if not any(m.startswith("lifecycle states") for m in failures):
        ok(f"all {len(STATES)} lifecycle states and transition tables present")

    methods = set(re.findall(r"def (\w+)\(self", text))
    for name in REQUIRED_VIEWS + REQUIRED_WRITES:
        if name not in methods:
            fail(f"required public method {name} is missing")
    if not any(m.startswith("required public method") for m in failures):
        ok(f"{len(REQUIRED_VIEWS)} view and {len(REQUIRED_WRITES)} write methods present")

    for name in EXPECTED_WRITES:
        if name not in methods:
            warn(f"expected lifecycle method {name} not found by static scan")

    if "_issue_certificate" not in methods or "certificate_hash" not in text:
        fail("certificate issuance is missing")
    else:
        ok("certificate issuance and certificate hash present")

    for token in ("gl.eq_principle", "gl.nondet.web", "gl.message.value"):
        if token not in text:
            fail(f"consensus primitive {token} is not used")
    if not any(m.startswith("consensus primitive") for m in failures):
        ok("validator consensus and payable escrow primitives present")


def check_manifest() -> None:
    print("Deployment manifest")
    if not MANIFEST.exists():
        fail(f"missing manifest: {MANIFEST.relative_to(ROOT)}")
        return
    try:
        data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"manifest is not valid JSON: {exc}")
        return

    if data.get("network") != "studionet":
        fail("manifest network must be studionet")
    if data.get("chainId") != 61999:
        fail("manifest chainId must be 61999")
    if data.get("rpcUrl") != "https://studio.genlayer.com/api":
        fail("manifest rpcUrl is not the Studionet RPC")
    if data.get("explorerUrl") != "https://explorer-studio.genlayer.com":
        fail("manifest explorerUrl is not the Studionet explorer")
    currency = data.get("currency") or {}
    if currency.get("symbol") != "GEN" or currency.get("decimals") != 18:
        fail("manifest currency must be GEN with 18 decimals")
    if not any(m.startswith("manifest ") for m in failures):
        ok("network, chain id, RPC, explorer and currency are correct")

    address = str(data.get("contractAddress") or "")
    if not ADDRESS_RE.match(address):
        fail("manifest contractAddress is not a 20-byte hex address")
    else:
        ok(f"contract address recorded: {address}")
    tx = str(data.get("deploymentTransaction") or "")
    if not TX_RE.match(tx):
        fail("manifest deploymentTransaction is not a 32-byte hash")
    else:
        ok("deployment transaction hash recorded")
    if data.get("status") not in {"live", "deployed"}:
        fail(f"manifest status must be live or deployed, got {data.get('status')!r}")
    else:
        ok("deployment status is live")
    expected_url = f"{data.get('explorerUrl')}/address/{address}"
    if data.get("explorerAddressUrl") != expected_url:
        fail("manifest explorerAddressUrl does not match address + explorerUrl")
    else:
        ok("explorer address link is consistent")


def check_frontend_config() -> None:
    print("Standalone frontend configuration")
    if not FRONTEND_CONFIG.exists():
        warn(f"missing frontend config: {FRONTEND_CONFIG.relative_to(ROOT)}")
        return
    try:
        address = json.loads(MANIFEST.read_text(encoding="utf-8"))["contractAddress"]
    except Exception:
        return
    text = FRONTEND_CONFIG.read_text(encoding="utf-8")
    if address not in text:
        fail("frontend/assets/config.js does not carry the manifest contract address")
    else:
        ok("standalone frontend carries the live contract address")
    if '"live"' not in text and "'live'" not in text:
        warn("frontend config does not record the live status")


def main() -> int:
    check_contract_source()
    check_manifest()
    check_frontend_config()
    print()
    if failures:
        print(f"{len(failures)} check(s) failed, {len(warnings)} warning(s).")
        return 1
    print(f"All checks passed ({len(warnings)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
