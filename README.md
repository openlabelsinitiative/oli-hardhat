# OLI Hardhat Plugin (Quick Guide)

Hardhat v3 plugin for submitting OLI labels and trust lists (on/off-chain), validating inputs, revoking attestations, and reading/searching labels. EIP-712 signing, ABI encoding, and network presets (Base/Arbitrum) are handled for you.

## Install

```bash
npm install --save-dev @openlabels/oli-hardhat
```

## Configure (Hardhat v3)

```ts
import { defineConfig } from "hardhat/config";
import oliPlugin from "@openlabels/oli-hardhat";

export default defineConfig({
  plugins: [oliPlugin],
  networks: {
    hardhat: { type: "edr-simulated", chainId: 8453 },
    // Base mainnet defaults; Arbitrum optional (add if needed)
    base: {
      type: "http",
      chainType: "l1",
      url: process.env.OLI_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.OLI_PRIVATE_KEY ? [process.env.OLI_PRIVATE_KEY] : []
    }
    // arbitrum: { type: "http", chainType: "op", url: "https://arb1.arbitrum.io/rpc", accounts: [...] }
  },
  oli: {
    // Defaults: Base (chainId 8453, EAS 0x4200…0021). Arbitrum optional via overrides.
    privateKey: process.env.OLI_PRIVATE_KEY,
    apiKey: process.env.OLI_API_KEY, // required for reads/search/analytics
    rpcUrl: process.env.OLI_RPC_URL,
    easAddress: process.env.OLI_EAS_ADDRESS,
    labelPoolSchema:
      process.env.OLI_LABEL_POOL_SCHEMA ||
      "0xb763e62d940bed6f527dd82418e146a904e62a297b8fa765c9b3e1f0bc6fdd68",
    labelTrustSchema:
      process.env.OLI_LABEL_TRUST_SCHEMA ||
      "0x6d780a85bfad501090cd82868a0c773c09beafda609d54888a65c106898c363d",
    tagDefinitionsUrl:
      process.env.OLI_TAG_DEFINITIONS_URL ||
      "https://raw.githubusercontent.com/openlabelsinitiative/OLI/refs/heads/main/1_label_schema/tags/tag_definitions.yml",
    valueSetUrls: {
      owner_project:
        process.env.OLI_VALUESET_OWNER_PROJECT ||
        "https://api.growthepie.com/v1/labels/projects.json",
      usage_category:
        process.env.OLI_VALUESET_USAGE_CATEGORY ||
        "https://raw.githubusercontent.com/openlabelsinitiative/OLI/refs/heads/main/1_label_schema/tags/valuesets/usage_category.yml"
    }
  }
});
```

## Tasks

Validate (no side effects):
```bash
npx hardhat oli:validate-label <address> <chainId> <tags.json|jsonString>
```

Submit a label (off-chain default; add `--onchain` for on-chain):
```bash
npx hardhat oli:submit-label <address> <chainId> <tags.json|jsonString> [--onchain] [--ref <uid>]
```

Bulk labels (off-chain default):
```bash
npx hardhat oli:submit-label-bulk <file>
```
- File can be an array of objects with `address`, `chain_id`/`chainId`, `tags`, optional `ref_uid`/`refUid`.
- If the file wraps tags in a `tags` field, the plugin unwraps automatically.

Trust list (off-chain default):
```bash
npx hardhat oli:submit-trust-list <file>
```

Revoke:
```bash
npx hardhat oli:revoke <uid> [--onchain]
```

Reads/search/analytics (API key required):
```bash
npx hardhat oli:get-labels <address> [--chainId <chainId>] [--limit N]
npx hardhat oli:search <tagId> <tagValue> [--chainId <chainId>] [--limit N]
npx hardhat oli:attester-analytics [--chainId <chainId>] [--limit N]
```

## Input shape

- Single submit can take:
  - Tags as the third argument (JSON string/file), or
  - An envelope file `{ address, chain_id, tags, refUid }` (plugin unwraps `tags` and uses `refUid` if present).
- Bulk: array of envelopes `{ address, chain_id/chainId, tags, ref_uid/refUid? }`.
- `refUid` is optional (defaults to zero).

## Notes

- The attestation is signed against the configured EAS (Base/Arbitrum). The `chainId` argument you pass describes the labeled contract’s chain (CAIP-2), not the EAS network.
- Validators match the OLI Python SDK: CAIP-2 check, tag normalization, enum/value-set enforcement when tag definitions are fetched.
- Errors surface HTTP status/body from the API (e.g., validation issues) or DNS/connectivity errors if unreachable.

## Examples

Validate:
```bash
npx hardhat oli:validate-label 0xE592427A0AEce92De3Edee1F18E0157C05861564 eip155:42161 ./label.json
```

Submit off-chain:
```bash
npx hardhat oli:submit-label 0xE592427A0AEce92De3Edee1F18E0157C05861564 eip155:42161 '{"contract_name":"OnChainGM V2","owner_project":"onchaingm","usage_category":"community"}'
```

Bulk:
```bash
npx hardhat oli:submit-label-bulk ./bulk-labels.json --show-stack-traces
```
