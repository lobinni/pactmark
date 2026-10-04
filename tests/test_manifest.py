"""Deployment manifest invariants for the live Studionet deployment."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "deployments" / "studionet.json"

ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
TX_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


class ManifestTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = json.loads(MANIFEST.read_text(encoding="utf-8"))

    def test_network_identity(self):
        self.assertEqual(self.data["network"], "studionet")
        self.assertEqual(self.data["chainId"], 61999)
        self.assertEqual(self.data["chainName"], "GenLayer Studionet")
        self.assertEqual(self.data["rpcUrl"], "https://studio.genlayer.com/api")
        self.assertEqual(self.data["explorerUrl"], "https://explorer-studio.genlayer.com")

    def test_currency(self):
        currency = self.data["currency"]
        self.assertEqual(currency["symbol"], "GEN")
        self.assertEqual(currency["decimals"], 18)

    def test_deployment_recorded(self):
        self.assertRegex(self.data["contractAddress"], ADDRESS_RE)
        self.assertRegex(self.data["deploymentTransaction"], TX_RE)
        self.assertIn(self.data["status"], {"live", "deployed"})

    def test_known_live_address(self):
        self.assertEqual(
            self.data["contractAddress"],
            "0xbE2Dd3c07322b013244477646977935b4fF21A73",
        )

    def test_explorer_address_url_consistent(self):
        expected = f"{self.data['explorerUrl']}/address/{self.data['contractAddress']}"
        self.assertEqual(self.data["explorerAddressUrl"], expected)

    def test_deployed_at_format(self):
        deployed = self.data.get("deployedAt", "")
        self.assertTrue(deployed.endswith("Z") and "T" in deployed)


if __name__ == "__main__":
    unittest.main()
