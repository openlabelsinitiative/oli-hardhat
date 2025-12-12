import { AbiCoder, TypedDataEncoder, getBytes, BytesLike, keccak256 } from "ethers";

const coder = new AbiCoder();

export const encodeLabelData = (chainId: string, tagsJson: Record<string, unknown>): string => {
  const json = typeof tagsJson === "string" ? tagsJson : JSON.stringify(tagsJson);
  return coder.encode(["string", "string"], [chainId, json]);
};

export const encodeTrustListData = (
  ownerName: string,
  attesters: Array<Record<string, unknown>>,
  attestations: Array<Record<string, unknown>>
): string => {
  const attestersJson = JSON.stringify(attesters || []);
  const attestationsJson = JSON.stringify(attestations || []);
  return coder.encode(["string", "string", "string"], [ownerName, attestersJson, attestationsJson]);
};

const attestTypes = {
  Attest: [
    { name: "version", type: "uint16" },
    { name: "schema", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "time", type: "uint64" },
    { name: "expirationTime", type: "uint64" },
    { name: "revocable", type: "bool" },
    { name: "refUID", type: "bytes32" },
    { name: "data", type: "bytes" },
    { name: "salt", type: "bytes32" }
  ]
};

export interface OffchainTypedData {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: string;
  };
  primaryType: "Attest";
  message: Record<string, any>;
  types: typeof attestTypes;
}

export const buildOffchainTypedData = (
  params: {
    schema: string;
    recipient: string;
    time: number;
    expirationTime?: number;
    revocable?: boolean;
    refUID: string;
    data: BytesLike;
    salt: string;
  },
  domain: OffchainTypedData["domain"]
): OffchainTypedData => {
  return {
    domain,
    primaryType: "Attest",
    types: attestTypes,
    message: {
      version: 2,
      recipient: params.recipient,
      time: params.time,
      revocable: params.revocable ?? true,
      schema: params.schema,
      refUID: params.refUID,
      data: params.data,
      expirationTime: params.expirationTime ?? 0,
      salt: params.salt
    }
  };
};

export const calculateUidV2 = (
  schema: string,
  recipient: string,
  attester: string,
  timestamp: number,
  data: BytesLike,
  expirationTime: number,
  revocable: boolean,
  refUID: string,
  salt: BytesLike,
  bump = 0
): string => {
  const version = 2;
  const packed = new Uint8Array([
    ...numberToBytes(version, 2),
    ...toBytes(schema),
    ...toBytes(recipient),
    ...toBytes(attester),
    ...numberToBytes(timestamp, 8),
    ...numberToBytes(expirationTime, 8),
    ...(revocable ? [1] : [0]),
    ...toBytes(refUID),
    ...toBytes(data),
    ...toBytes(salt),
    ...numberToBytes(bump, 4)
  ]);
  return keccak256(packed);
};

const numberToBytes = (num: number, length: number): Uint8Array => {
  const bytes = new Uint8Array(length);
  for (let i = length - 1; i >= 0; i--) {
    bytes[i] = num & 0xff;
    num = num >> 8;
  }
  return bytes;
};

const toBytes = (value: BytesLike | string): Uint8Array => {
  return getBytes(value);
};
