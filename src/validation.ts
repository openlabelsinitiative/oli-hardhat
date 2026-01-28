import { getAddress } from "ethers";
import { ResolvedConfig } from "./types.js";

export const validateCaip2 = (chainId: string) => {
  const idx = chainId.indexOf(":");
  if (idx <= 0 || idx === chainId.length - 1 || chainId.indexOf(":", idx + 1) !== -1) {
    throw new Error(
      `Unsupported chain ID format: ${chainId}. Must be CAIP-2 (e.g., eip155:8453 for Base).`
    );
  }
  const prefix = chainId.slice(0, idx + 1).toLowerCase();
  if (prefix === "eip155:") {
    const rest = chainId.slice(idx + 1);
    if (rest === "any") return true;
    if (/^[0-9]+$/.test(rest)) return true;
    throw new Error(
      `Invalid eip155 chain_id format: ${chainId}. Expected eip155:<number> or eip155:any`
    );
  }
  return true;
};

export const validateAddressForChain = (address: string, chainId: string) => {
  const lower = chainId.toLowerCase();
  if (lower.startsWith("eip155:")) {
    try {
      return getAddress(address);
    } catch {
      throw new Error(`Address must be a valid EVM address: ${address}`);
    }
  }
  if (!address || address.length > 66) {
    throw new Error(
      `Address to be labelled exceeds maximum length of 66 characters or is empty: ${address}`
    );
  }
  if (address.includes(":")) {
    throw new Error(`Address to be labelled must not contain ':' character: ${address}`);
  }
  return address;
};

export const validateRefUid = (refUid?: string) => {
  const value = refUid ?? "0x0000000000000000000000000000000000000000000000000000000000000000";
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`refUid must be a 32-byte hex string. Received: ${refUid}`);
  }
  return value;
};

export const normalizeTags = (
  tags: Record<string, any>,
  tagDefinitions: Record<string, any>,
  valueSets: Record<string, any>
) => {
  const lower = Object.fromEntries(
    Object.entries(tags || {}).map(([k, v]) => [k.toLowerCase(), v])
  );

  for (const key of Object.keys(lower)) {
    const val = lower[key];
    if (typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed === "true") lower[key] = true;
      else if (trimmed === "false") lower[key] = false;
      else lower[key] = trimmed;
    } else if (Array.isArray(val)) {
      lower[key] = val.map((i) => (typeof i === "string" ? i.trim() : i));
    }
  }

  for (const [tagId, value] of Object.entries(lower)) {
    const def = tagDefinitions[tagId];
    if (!def) {
      // Warn-only path for unknown tags.
      continue;
    }

    // Address-like tags (length 42)
    const schema = def.schema || {};
    const isAddress =
      schema.type === "string" && schema.minLength === 42 && schema.maxLength === 42;
    if (isAddress && typeof value === "string") {
      lower[tagId] = getAddress(value);
    }

    // Enum / value set enforcement
    if (valueSets[tagId]) {
      const allowed = valueSets[tagId];
      const isAllowed = Array.isArray(value)
        ? value.every((v) => allowed.includes(String(v).toLowerCase()))
        : allowed.includes(String(value).toLowerCase());
      if (!isAllowed) {
        throw new Error(
          `Tag '${tagId}' must be one of: ${allowed.join(", ")}. Received: ${value}`
        );
      }
    }
  }

  return lower;
};

export const validateTags = (
  tags: Record<string, any>,
  tagDefinitions: Record<string, any>,
  valueSets: Record<string, any>
) => {
  if (!tags || typeof tags !== "object") {
    throw new Error("Tags must be an object of OLI-compliant tag_id -> value pairs.");
  }

  const normalized = normalizeTags(tags, tagDefinitions, valueSets);

  for (const [tagId, value] of Object.entries(normalized)) {
    const def = tagDefinitions[tagId];
    if (!def) continue;
    const schema = def.schema || {};
    const type = schema.type;
    if (type === "boolean" && typeof value !== "boolean") {
      throw new Error(`Tag '${tagId}' must be boolean.`);
    }
    if (type === "string" && typeof value !== "string") {
      throw new Error(`Tag '${tagId}' must be string.`);
    }
    if (type === "integer" && !Number.isInteger(value)) {
      throw new Error(`Tag '${tagId}' must be integer.`);
    }
    if (type === "float" && typeof value !== "number") {
      throw new Error(`Tag '${tagId}' must be number.`);
    }
    if (type === "array" && !Array.isArray(value)) {
      throw new Error(`Tag '${tagId}' must be an array.`);
    }
  }

  return normalized;
};

export const validateLabel = (
  address: string,
  chainId: string,
  tags: Record<string, any>,
  refUid: string | undefined,
  tagDefinitions: Record<string, any>,
  valueSets: Record<string, any>
) => {
  validateCaip2(chainId);
  const normalizedAddress = validateAddressForChain(address, chainId);
  const normalizedTags = validateTags(tags, tagDefinitions, valueSets);
  const ref = validateRefUid(refUid);
  return { normalizedTags, refUid: ref, address: normalizedAddress, chainId };
};

export const validateTrustList = (
  ownerName: string,
  attesters: Array<Record<string, any>>,
  attestations: Array<Record<string, any>>
) => {
  if (!ownerName || typeof ownerName !== "string" || ownerName.length < 3 || ownerName.length > 100) {
    throw new Error("Owner name must be 3-100 ASCII characters.");
  }
  if (!ownerName.split("").every((c) => c.charCodeAt(0) < 128)) {
    throw new Error("Owner name must be ASCII.");
  }
  if (!Array.isArray(attesters)) {
    throw new Error("attesters must be an array.");
  }
  if (!Array.isArray(attestations)) {
    throw new Error("attestations must be an array.");
  }
  return true;
};

export const validateNetworkConfig = (config: ResolvedConfig) => {
  if (!config.easAddress || !config.labelPoolSchema) {
    throw new Error("EAS address and labelPoolSchema must be configured for selected network.");
  }
  return true;
};
