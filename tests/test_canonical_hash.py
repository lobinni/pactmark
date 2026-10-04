"""Canonical hashing and end-to-end generator/verifier agreement tests.

These cover the exact serialization the contract uses, the known sha256
vectors, and the demo generator producing certificates that the independent
verifier accepts without ever writing files.
"""

import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


vc = load_module("verify_certificate", ROOT / "scripts" / "verification" / "verify_certificate.py")
demo = load_module("run_demo", ROOT / "scripts" / "demo" / "run_demo.py")


class CanonicalJsonTest(unittest.TestCase):
    def test_canon_sorts_keys_and_compacts(self):
        self.assertEqual(vc.canon({"b": 1, "a": {"d": 2, "c": 3}}), '{"a":{"c":3,"d":2},"b":1}')

    def test_canon_escapes_non_ascii(self):
        self.assertEqual(vc.canon({"note": "café"}), '{"note":"caf\\u00e9"}')

    def test_canon_is_order_independent(self):
        left = {"x": [1, 2], "y": {"m": 1, "n": 2}}
        right = {"y": {"n": 2, "m": 1}, "x": [1, 2]}
        self.assertEqual(vc.canon(left), vc.canon(right))

    def test_sha_known_vector(self):
        self.assertEqual(
            vc.sha("abc"),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        )


class EvidenceRootTest(unittest.TestCase):
    def test_root_is_stable(self):
        items = [
            {"item_id": "E1", "kind": "text", "source": "text:" + "0" * 16,
             "content_hash": "a" * 64, "length": 10, "mutable": 0}
        ]
        again = json.loads(json.dumps(items))
        self.assertEqual(vc.evidence_root("AGR-1", items), vc.evidence_root("AGR-1", again))
        self.assertRegex(vc.evidence_root("AGR-1", items), r"^[0-9a-f]{64}$")


class DemoGeneratorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = demo.load_input()
        cls.common = demo.build_common(cls.data)
        cls.bundle = demo.build_bundle(cls.data)

    def run_verifier_stages(self, cert, bundle):
        report = vc.Report()
        vc.verify_structure(cert, report)
        vc.verify_consistency(cert, report)
        vc.verify_bundle(cert, bundle, report)
        vc.verify_hash(cert, cert["certificate_hash"], report)
        return report.failures

    def test_settled_scenario_verifies(self):
        cert = demo.certificate(self.data, self.common, self.bundle, "settled")
        failures = self.run_verifier_stages(cert, self.bundle)
        self.assertEqual(failures, [])
        self.assertEqual(cert["terminal_state"], "SETTLED")
        self.assertEqual(cert["settlement"]["to_buyer"], "0")

    def test_jury_scenario_verifies(self):
        cert = demo.certificate(self.data, self.common, self.bundle, "refunded-after-jury")
        failures = self.run_verifier_stages(cert, self.bundle)
        self.assertEqual(failures, [])
        self.assertEqual(cert["terminal_state"], "FINALIZED")
        self.assertEqual(cert["dispute"]["result"], "BUYER_PREVAILED")
        self.assertGreater(cert["dispute"]["votes_buyer"], cert["dispute"]["votes_worker"])

    def test_jury_commitments_recompute(self):
        cert = demo.certificate(self.data, self.common, self.bundle, "refunded-after-jury")
        for juror in self.data["jurors"]:
            expect = vc.sha(
                self.data["agreement_id"] + ":" + juror["address"]
                + ":" + juror["vote"] + ":" + juror["salt"]
            )
            found = [c for c in cert["dispute"]["commitments"] if c["juror"] == juror["address"]]
            self.assertEqual(len(found), 1)
            self.assertEqual(found[0]["commit"], expect)

    def test_quotes_are_grounded(self):
        contents = {e["item_id"]: e["content"] for e in self.data["evidence"]}
        for req in self.data["requirements"]:
            self.assertIn(req["expect_quote"], contents[req["evidence_ref"]])
        self.assertIn(
            self.data["challenge"]["quote"],
            contents[self.data["challenge"]["evidence_id"]],
        )

    def test_tampering_is_detected(self):
        cert = demo.certificate(self.data, self.common, self.bundle, "settled")
        cert["settlement"]["to_worker"] = str(int(cert["amount"]) * 2)
        report = vc.Report()
        vc.verify_consistency(cert, report)
        self.assertTrue(report.failures)


if __name__ == "__main__":
    unittest.main()
