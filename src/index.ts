import { task } from "hardhat/config";
import fs from "fs";
import yaml from "js-yaml";
import { resolveConfig } from "./config.js";
import { OliClient } from "./client.js";

const parseMaybeJsonFile = (input: string) => {
  if (fs.existsSync(input)) {
    const content = fs.readFileSync(input, "utf-8");
    try {
      return JSON.parse(content);
    } catch {
      return yaml.load(content);
    }
  }
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
};

const extractTagsInput = (raw: any) => {
  if (raw && typeof raw === "object" && "tags" in raw) {
    return {
      tags: (raw as any).tags,
      refUid: (raw as any).refUid || (raw as any).refuid
    };
  }
  return { tags: raw, refUid: undefined };
};

const looksLikeCaip2 = (value: string) => {
  const idx = value.indexOf(":");
  if (idx <= 0 || idx === value.length - 1 || value.indexOf(":", idx + 1) !== -1) {
    return false;
  }
  const prefix = value.slice(0, idx + 1).toLowerCase();
  if (prefix === "eip155:") {
    const rest = value.slice(idx + 1);
    return rest === "any" || /^[0-9]+$/.test(rest);
  }
  return true;
};

const resolveChainIdAndTags = (chainIdArg: string, tagsArg: string) => {
  let chainId = chainIdArg;
  let tags = tagsArg;
  if (!tags) {
    const candidate = chainIdArg;
    const isPlaceholder = !candidate || candidate === "auto" || candidate === "-" || candidate === "_";
    if (isPlaceholder || looksLikeCaip2(candidate)) {
      throw new Error(
        "Tags are required. If using CAIP-10, pass tags as the second argument and omit chainId."
      );
    }
    tags = candidate;
    chainId = "auto";
  }
  return { chainId, tags };
};

const asLazyAction = (fn: any) => async () => ({ default: fn });

const getClient = async (hre: any) => {
  const userConfig = (hre.config as any).oli || {};
  const resolved = resolveConfig(userConfig);
  const signer =
    hre.ethers && hre.ethers.getSigner
      ? await hre.ethers.getSigner()
      : undefined;
  const client = new OliClient(hre.config.paths.root, resolved, signer);
  await client.init();
  return client;
};

const validateTask = task("oli:validate-label", "Validate a label against OLI schema")
  .addPositionalArgument({
    name: "address",
    description: "Address to label"
  })
  .addPositionalArgument({
    name: "chainId",
    description: "Chain ID in CAIP-2 format (e.g., eip155:8453). Defaults to auto for CAIP-10 input",
    defaultValue: "auto"
  })
  .addPositionalArgument({
    name: "tags",
    description: "JSON string or path to JSON/YAML with tags",
    defaultValue: ""
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const { chainId, tags: tagsInput } = resolveChainIdAndTags(args.chainId, args.tags);
      const parsed = parseMaybeJsonFile(tagsInput);
      const { tags } = extractTagsInput(parsed);
      const validated = await client.validateLabel({
        address: args.address,
        chainId,
        tags
      });
      console.log("Valid label ✅", validated);
    })
  );

const submitLabelTask = task("oli:submit-label", "Submit a single label")
  .addPositionalArgument({
    name: "address",
    description: "Address to label"
  })
  .addPositionalArgument({
    name: "chainId",
    description: "Chain ID in CAIP-2 format (e.g., eip155:8453). Defaults to auto for CAIP-10 input",
    defaultValue: "auto"
  })
  .addPositionalArgument({
    name: "tags",
    description: "JSON string or path to JSON/YAML with tags",
    defaultValue: ""
  })
  .addFlag({
    name: "onchain",
    description: "Set true to submit onchain"
  })
  .addOption({
    name: "ref",
    description: "Reference UID",
    defaultValue: ""
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const { chainId, tags: tagsInput } = resolveChainIdAndTags(args.chainId, args.tags);
      const parsed = parseMaybeJsonFile(tagsInput);
      const { tags, refUid: refFromFile } = extractTagsInput(parsed);
      const response = await client.submitLabel(
        {
          address: args.address,
          chainId,
          tags,
          refUid: args.ref || refFromFile || undefined
        },
        { onchain: args.onchain }
      );
      console.log("Submitted label:", response);
    })
  );

const submitLabelBulkTask = task("oli:submit-label-bulk", "Submit labels in bulk (<=1000)")
  .addPositionalArgument({
    name: "file",
    description: "Path to JSON/YAML array of labels"
  })
  .addFlag({
    name: "onchain",
    description: "Set true to submit onchain"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const labels = parseMaybeJsonFile(args.file);
      if (!Array.isArray(labels)) {
        throw new Error("Bulk file must contain an array of labels");
      }
      const response = await client.submitLabelBulk(labels, { onchain: args.onchain });
      console.log("Bulk submitted:", response);
    })
  );

const submitTrustTask = task("oli:submit-trust-list", "Submit a trust list")
  .addPositionalArgument({
    name: "file",
    description: "Path to YAML/JSON trust list file"
  })
  .addFlag({
    name: "onchain",
    description: "Set true to submit onchain"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const data = parseMaybeJsonFile(args.file);
      const response = await client.submitTrustList(
        {
          ownerName: data.owner_name || data.ownerName,
          attesters: data.attesters || [],
          attestations: data.attestations || []
        },
        { onchain: args.onchain }
      );
      console.log("Trust list submitted:", response);
    })
  );

const revokeTask = task("oli:revoke", "Revoke an attestation by UID")
  .addPositionalArgument({
    name: "uid",
    description: "UID to revoke (0x...)"
  })
  .addFlag({
    name: "onchain",
    description: "Set true to revoke onchain"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const response = await client.revoke(args.uid, { onchain: args.onchain });
      console.log("Revoke result:", response);
    })
  );

const getLabelsTask = task("oli:get-labels", "Fetch labels for an address")
  .addPositionalArgument({
    name: "address",
    description: "Address to fetch (EVM or CAIP-10)"
  })
  .addOption({
    name: "chainId",
    description: "Chain filter",
    defaultValue: ""
  })
  .addOption({
    name: "limit",
    description: "Limit",
    defaultValue: "100"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const res = await client.getLabels(args.address, {
        chain_id: args.chainId || undefined,
        limit: Number(args.limit)
      });
      console.log(JSON.stringify(res, null, 2));
    })
  );

const searchTask = task("oli:search", "Search addresses by tag")
  .addPositionalArgument({
    name: "tagId",
    description: "Tag ID"
  })
  .addPositionalArgument({
    name: "tagValue",
    description: "Tag value"
  })
  .addOption({
    name: "chainId",
    description: "Chain filter",
    defaultValue: ""
  })
  .addOption({
    name: "limit",
    description: "Limit",
    defaultValue: "1000"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const res = await client.searchAddressesByTag(args.tagId, args.tagValue, {
        chain_id: args.chainId || undefined,
        limit: Number(args.limit)
      });
      console.log(JSON.stringify(res, null, 2));
    })
  );

const attesterAnalyticsTask = task("oli:attester-analytics", "Get attester analytics")
  .addOption({
    name: "chainId",
    description: "Chain filter",
    defaultValue: ""
  })
  .addOption({
    name: "limit",
    description: "Limit",
    defaultValue: "100"
  })
  .setAction(
    asLazyAction(async (args: any, hre: any) => {
      const client = await getClient(hre);
      const res = await client.getAttesterAnalytics({
        chain_id: args.chainId || undefined,
        limit: Number(args.limit)
      });
      console.log(JSON.stringify(res, null, 2));
    })
  );

const oliPlugin = {
  id: "oli",
  tasks: [
    validateTask.build(),
    submitLabelTask.build(),
    submitLabelBulkTask.build(),
    submitTrustTask.build(),
    revokeTask.build(),
    getLabelsTask.build(),
    searchTask.build(),
    attesterAnalyticsTask.build()
  ],
  npmPackage: "@openlabels/oli-hardhat"
} as any;

export default oliPlugin;
