// Pactmark standalone frontend configuration.
// Source of truth: deployments/studionet.json
// This file is rewritten by scripts/deploy/deploy.mjs after each deployment.
window.PACTMARK_CONFIG = {
  network: "studionet",
  chainId: 61999,
  chainName: "GenLayer Studionet",
  rpcUrl: "https://studio.genlayer.com/api",
  explorerUrl: "https://explorer-studio.genlayer.com",
  currency: { name: "GEN", symbol: "GEN", decimals: 18 },
  contractAddress: "0xbE2Dd3c07322b013244477646977935b4fF21A73",
  deploymentTransaction:
    "0x71d94e1ac278668d6b827b0d7300057a7ab3e9a43e9defabe6d216c6e83ddcd1",
  status: "live",
  explorerAddressUrl:
    "https://explorer-studio.genlayer.com/address/0xbE2Dd3c07322b013244477646977935b4fF21A73",
};
