import type { Signer } from "ethers";

export type SupportedNetwork = "base" | "arbitrum" | "custom";

export interface NetworkPreset {
  key: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  easAddress: string;
  labelPoolSchema: string;
  labelTrustSchema: string;
}

export interface OliPluginUserConfig {
  network?: SupportedNetwork;
  rpcUrl?: string;
  chainId?: number;
  easAddress?: string;
  labelPoolSchema?: string;
  labelTrustSchema?: string;
  apiKey?: string;
  privateKey?: string;
  tagDefinitionsUrl?: string;
  valueSetUrls?: Record<string, string>;
  loggerLevel?: "silent" | "info" | "debug";
  cacheTtlMinutes?: number;
}

export interface ResolvedConfig {
  network: SupportedNetwork;
  preset: NetworkPreset;
  rpcUrl: string;
  chainId: number;
  easAddress: string;
  labelPoolSchema: string;
  labelTrustSchema: string;
  apiKey?: string;
  privateKey?: string;
  tagDefinitionsUrl: string;
  valueSetUrls: Record<string, string>;
  loggerLevel: "silent" | "info" | "debug";
  cacheTtlMinutes: number;
}

export interface LabelPayload {
  address: string;
  chainId: string;
  tags: Record<string, unknown>;
  refUid?: string;
}

export interface TrustListPayload {
  ownerName: string;
  attesters: Array<Record<string, unknown>>;
  attestations: Array<Record<string, unknown>>;
}

export interface SubmitOptions {
  onchain?: boolean;
  gasLimit?: bigint | number;
}

export interface RevocationOptions {
  onchain?: boolean;
  gasLimit?: bigint | number;
}

export interface OliTaskContext {
  config: ResolvedConfig;
  signer?: Signer;
}

export interface CachedDefinitions {
  fetchedAt: string;
  tagDefinitions: Record<string, any>;
  valueSets: Record<string, any>;
}

export interface LabelPostResponse {
  success: boolean;
  onchain: boolean;
  transaction_hash?: string;
  uid?: string;
  uids?: string[];
  eas_schema_chain?: number;
  eas_schema?: string;
  status?: string;
  accepted?: number;
  duplicates?: number;
  failed_validation?: any;
  error?: string;
}

