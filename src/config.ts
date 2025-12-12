import { NETWORK_PRESETS, DEFAULT_TAG_DEFINITIONS_URL, DEFAULT_VALUESET_URLS } from "./constants.js";
import { OliPluginUserConfig, ResolvedConfig, SupportedNetwork } from "./types.js";

export const resolveConfig = (user?: OliPluginUserConfig): ResolvedConfig => {
  const network: SupportedNetwork = (user?.network as SupportedNetwork) || "base";
  const preset = NETWORK_PRESETS[network] || NETWORK_PRESETS.base;
  const rpcUrl = user?.rpcUrl || process.env.OLI_RPC_URL || preset.rpcUrl;
  const chainId = user?.chainId || preset.chainId;
  const easAddress = user?.easAddress || process.env.OLI_EAS_ADDRESS || preset.easAddress;
  const labelPoolSchema =
    user?.labelPoolSchema || process.env.OLI_LABEL_POOL_SCHEMA || preset.labelPoolSchema;
  const labelTrustSchema =
    user?.labelTrustSchema || process.env.OLI_LABEL_TRUST_SCHEMA || preset.labelTrustSchema;

  return {
    network,
    preset,
    rpcUrl,
    chainId,
    easAddress,
    labelPoolSchema,
    labelTrustSchema,
    apiKey: user?.apiKey || process.env.OLI_API_KEY,
    privateKey: user?.privateKey || process.env.OLI_PRIVATE_KEY,
    tagDefinitionsUrl: user?.tagDefinitionsUrl || DEFAULT_TAG_DEFINITIONS_URL,
    valueSetUrls: user?.valueSetUrls || DEFAULT_VALUESET_URLS,
    loggerLevel: user?.loggerLevel || "info",
    cacheTtlMinutes: user?.cacheTtlMinutes ?? 60
  };
};
