import { NetworkPreset } from "./types.js";

// Base preset comes from the Python SDK (oli/core.py).
const BASE_PRESET: NetworkPreset = {
  key: "base",
  chainId: 8453,
  name: "Base",
  rpcUrl: "https://mainnet.base.org",
  easAddress: "0x4200000000000000000000000000000000000021",
  labelPoolSchema: "0xcff83309b59685fdae9dad7c63d969150676d51d8eeda66799d1c4898b84556a",
  labelTrustSchema: "0x6d780a85bfad501090cd82868a0c773c09beafda609d54888a65c106898c363d"
};

// Arbitrum preset: RPC + chainId wired. EAS and schemas can be overridden in config if they differ.
const ARBITRUM_PRESET: NetworkPreset = {
  key: "arbitrum",
  chainId: 42161,
  name: "Arbitrum One",
  rpcUrl: "https://arb1.arbitrum.io/rpc",
  // Arbitrum One EAS contract (from provided frontend config).
  easAddress: "0xbD75f629A22Dc1ceD33dDA0b68c546A1c035c458",
  labelPoolSchema: "0xcff83309b59685fdae9dad7c63d969150676d51d8eeda66799d1c4898b84556a",
  labelTrustSchema: "0x6d780a85bfad501090cd82868a0c773c09beafda609d54888a65c106898c363d"
};

export const NETWORK_PRESETS: Record<string, NetworkPreset> = {
  base: BASE_PRESET,
  arbitrum: ARBITRUM_PRESET
};

export const DEFAULT_TAG_DEFINITIONS_URL =
  "https://raw.githubusercontent.com/openlabelsinitiative/OLI/refs/heads/main/1_label_schema/tags/tag_definitions.yml";

export const DEFAULT_VALUESET_URLS = {
  owner_project: "https://api.growthepie.com/v1/labels/projects.json",
  usage_category: "https://raw.githubusercontent.com/openlabelsinitiative/OLI/refs/heads/main/1_label_schema/tags/valuesets/usage_category.yml"
};

export const DEFAULT_API_URL = "https://api.openlabelsinitiative.org";

export const HARDHAT_ATTESTATION_RECIPIENT =
  "0x0000000000000000000000000000000000000003";

export const CACHE_FILE = ".oli-cache.json";
