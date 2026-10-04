"""The web app and standalone frontend read the contract address from code,
never from environment variables."""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class FrontendConfigTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        manifest = json.loads(
            (ROOT / "deployments" / "studionet.json").read_text(encoding="utf-8")
        )
        cls.address = manifest["contractAddress"]
        cls.frontend = (ROOT / "frontend" / "assets" / "config.js").read_text(encoding="utf-8")
        cls.chain_lib = (ROOT / "src" / "lib" / "contract.ts").read_text(encoding="utf-8")

    def test_standalone_frontend_carries_address(self):
        self.assertIn(self.address, self.frontend)
        self.assertIn('"live"', self.frontend.replace("'", '"'))

    def test_app_imports_manifest_from_code(self):
        self.assertIn('from "../../deployments/studionet.json"', self.chain_lib)

    def test_app_uses_no_environment_overrides(self):
        self.assertNotIn("process.env", self.chain_lib)
        self.assertNotIn("NEXT_PUBLIC", self.chain_lib)
        self.assertNotIn("import.meta.env", self.chain_lib)

    def test_no_address_regex_bypass(self):
        addresses = set(re.findall(r"0x[0-9a-fA-F]{40}", self.chain_lib))
        self.assertTrue(addresses.issubset({self.address}))


if __name__ == "__main__":
    unittest.main()
