import { EAS } from "@ethereum-attestation-service/eas-sdk";
import {
  JsonRpcProvider,
  Wallet,
  ContractTransactionResponse,
  Signer,
  Signature,
  keccak256,
  getBytes,
  Interface
} from "ethers";
import { randomBytes } from "crypto";
import { buildOffchainTypedData, encodeLabelData, encodeTrustListData } from "./encoding.js";
import { buildCaip10, isCaip10, parseCaip10 } from "./caip.js";
import { loadDefinitions } from "./definitions.js";
import { OliHttpClient } from "./http.js";
import { buildLogger } from "./logger.js";
import { HARDHAT_ATTESTATION_RECIPIENT } from "./constants.js";
import {
  LabelPayload,
  LabelPostResponse,
  ResolvedConfig,
  SubmitOptions,
  TrustListPayload,
  RevocationOptions
} from "./types.js";
import {
  validateLabel,
  validateCaip2,
  validateNetworkConfig,
  validateRefUid,
  validateAddressForChain,
  validateTrustList
} from "./validation.js";
import axios, { AxiosError } from "axios";

const formatAxiosError = (err: unknown) => {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const body = err.response?.data;
    return `HTTP ${status ?? "unknown"}: ${body ? JSON.stringify(body) : err.message}`;
  }
  return String(err);
};

export class OliClient {
  private config: ResolvedConfig;
  private signer?: Signer;
  private http: OliHttpClient;
  private logger: ReturnType<typeof buildLogger>;
  private projectRoot: string;
  private tagDefinitions: Record<string, any> = {};
  private valueSets: Record<string, any> = {};

  constructor(projectRoot: string, config: ResolvedConfig, signer?: Signer) {
    this.config = config;
    this.signer = signer ?? this.defaultSigner();
    this.http = new OliHttpClient(config);
    this.logger = buildLogger(config);
    this.projectRoot = projectRoot;
  }

  private defaultSigner(): Signer | undefined {
    if (!this.config.privateKey) return undefined;
    const provider = new JsonRpcProvider(this.config.rpcUrl);
    return new Wallet(this.config.privateKey, provider);
  }

  async init() {
    const { tagDefinitions, valueSets } = await loadDefinitions(
      this.projectRoot,
      this.config,
      this.logger
    );
    this.tagDefinitions = tagDefinitions;
    this.valueSets = valueSets;
    validateNetworkConfig(this.config);
  }

  private requireSigner() {
    if (!this.signer) {
      throw new Error("No signer configured. Provide a privateKey or use Hardhat signer.");
    }
    return this.signer;
  }

  private resolveLabelInput(payload: LabelPayload): LabelPayload {
    let address = payload.address;
    let chainId = payload.chainId;
    const chainIdPlaceholder =
      !chainId || chainId === "auto" || chainId === "-" || chainId === "_";

    if (isCaip10(address)) {
      const parsed = parseCaip10(address);
      if (!chainIdPlaceholder && chainId && chainId !== parsed.chainId) {
        throw new Error(
          `Conflicting chainId inputs. Provided ${chainId} but CAIP-10 uses ${parsed.chainId}.`
        );
      }
      chainId = parsed.chainId;
      address = parsed.address;
    } else if (chainIdPlaceholder) {
      throw new Error("chainId is required unless the address is provided in CAIP-10 format.");
    }

    return { ...payload, address, chainId: chainId as string };
  }

  private resolveReadAddress(addressInput: string, params: Record<string, any>) {
    let address = addressInput;
    let chainId = params.chain_id || params.chainId;
    const chainIdPlaceholder =
      !chainId || chainId === "auto" || chainId === "-" || chainId === "_";

    if (chainIdPlaceholder) {
      chainId = undefined;
    }

    if (isCaip10(addressInput)) {
      const parsed = parseCaip10(addressInput);
      if (chainId && chainId !== parsed.chainId) {
        throw new Error(
          `Conflicting chainId inputs. Provided ${chainId} but CAIP-10 uses ${parsed.chainId}.`
        );
      }
      chainId = parsed.chainId;
      address = parsed.address;
    }

    if (chainId) {
      validateCaip2(chainId);
      address = validateAddressForChain(address, chainId);
      return { address, chainId };
    }

    address = validateAddressForChain(address, "eip155:any");
    return { address, chainId: undefined };
  }

  async validateLabel(payload: LabelPayload) {
    const resolved = this.resolveLabelInput(payload);
    const { normalizedTags, refUid, address, chainId } = validateLabel(
      resolved.address,
      resolved.chainId,
      payload.tags,
      payload.refUid,
      this.tagDefinitions,
      this.valueSets
    );
    return { ...resolved, address, chainId, tags: normalizedTags, refUid };
  }

  async validateTrustList(payload: TrustListPayload) {
    return validateTrustList(payload.ownerName, payload.attesters, payload.attestations);
  }

  async submitLabel(
    payload: LabelPayload,
    options: SubmitOptions = {}
  ): Promise<LabelPostResponse> {
    await this.init();
    const validated = await this.validateLabel(payload);
    if (options.onchain) {
      const { txHash, uid } = await this.submitOnchainLabel(validated, options);
      return {
        success: true,
        onchain: true,
        transaction_hash: txHash,
        uid,
        eas_schema_chain: this.config.chainId,
        eas_schema: this.config.labelPoolSchema
      };
    }
    const { uid } = await this.submitOffchainLabel(validated);
    return {
      success: true,
      onchain: false,
      uid,
      eas_schema: this.config.labelPoolSchema
    };
  }

  async submitLabelBulk(
    labels: LabelPayload[],
    options: SubmitOptions = {}
  ): Promise<LabelPostResponse> {
    await this.init();
    const normalized = labels.map((l: any) => {
      const addressInput = l.address || l.caip10 || l.caip_10;
      if (!addressInput) {
        throw new Error("Each label must include an address or caip10 field.");
      }
      return {
        address: addressInput,
        chainId: l.chainId || l.chain_id || l.chainID,
        tags: l.tags,
        refUid: l.refUid || l.refuid || l.ref_uid
      } as LabelPayload;
    });
    const validated = await Promise.all(normalized.map((l) => this.validateLabel(l)));
    if (options.onchain) {
      const { txHash, uids } = await this.submitOnchainLabelBulk(validated, options);
      return {
        success: true,
        onchain: true,
        transaction_hash: txHash,
        uids,
        eas_schema_chain: this.config.chainId,
        eas_schema: this.config.labelPoolSchema
      };
    }
    const { uids } = await this.submitOffchainLabelBulk(validated);
    return {
      success: true,
      onchain: false,
      uids,
      eas_schema: this.config.labelPoolSchema
    };
  }

  async submitTrustList(
    payload: TrustListPayload,
    options: SubmitOptions = {}
  ): Promise<LabelPostResponse> {
    await this.init();
    validateTrustList(payload.ownerName, payload.attesters, payload.attestations);
    if (options.onchain) {
      const { txHash, uid } = await this.submitOnchainTrustList(payload, options);
      return {
        success: true,
        onchain: true,
        transaction_hash: txHash,
        uid,
        eas_schema_chain: this.config.chainId,
        eas_schema: this.config.labelTrustSchema
      };
    }
    const { uid } = await this.submitOffchainTrustList(payload);
    return {
      success: true,
      onchain: false,
      uid,
      eas_schema: this.config.labelTrustSchema
    };
  }

  private async submitOnchainLabel(
    payload: LabelPayload,
    options: SubmitOptions
  ): Promise<{ txHash: string; uid: string }> {
    const signer = this.requireSigner();
    const eas = new EAS(this.config.easAddress);
    eas.connect(signer as any);
    const encodedData = encodeLabelData(buildCaip10(payload.chainId, payload.address), payload.tags);
    const tx = await eas.attest({
      schema: this.config.labelPoolSchema,
      data: {
        recipient: HARDHAT_ATTESTATION_RECIPIENT,
        expirationTime: 0n,
        revocable: true,
        refUID: validateRefUid(payload.refUid),
        data: encodedData,
        value: 0n
      }
    });
    const uid = await tx.wait();
    return { txHash: tx.tx.hash, uid };
  }

  private async submitOnchainLabelBulk(
    labels: LabelPayload[],
    options: SubmitOptions
  ): Promise<{ txHash: string; uids: string[] }> {
    const signer = this.requireSigner();
    const eas = new EAS(this.config.easAddress);
    eas.connect(signer as any);
    const multiRequests = [
      {
        schema: this.config.labelPoolSchema,
        data: labels.map((label) => ({
          recipient: HARDHAT_ATTESTATION_RECIPIENT,
          expirationTime: 0n,
          revocable: true,
          refUID: validateRefUid(label.refUid),
          data: encodeLabelData(buildCaip10(label.chainId, label.address), label.tags),
          value: 0n
        }))
      }
    ];
    const tx = await eas.multiAttest(multiRequests);
    const uids = await tx.wait();
    return { txHash: tx.tx.hash, uids };
  }

  private async submitOnchainTrustList(
    payload: TrustListPayload,
    options: SubmitOptions
  ): Promise<{ txHash: string; uid: string }> {
    const signer = this.requireSigner();
    const eas = new EAS(this.config.easAddress);
    eas.connect(signer as any);
    const encodedData = encodeTrustListData(
      payload.ownerName,
      payload.attesters,
      payload.attestations
    );
    const tx = await eas.attest({
      schema: this.config.labelTrustSchema,
      data: {
        recipient: HARDHAT_ATTESTATION_RECIPIENT,
        expirationTime: 0n,
        revocable: true,
        refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
        data: encodedData,
        value: 0n
      }
    });
    const uid = await tx.wait();
    return { txHash: tx.tx.hash, uid };
  }

  private async submitOffchainLabel(payload: LabelPayload) {
    const signer = this.requireSigner();
    const address = await signer.getAddress();
    const now = Math.floor(Date.now() / 1000);
    const salt = "0x" + randomBytes(32).toString("hex");
    const typed = buildOffchainTypedData(
      {
        schema: this.config.labelPoolSchema,
        recipient: HARDHAT_ATTESTATION_RECIPIENT,
        time: now,
        refUID: validateRefUid(payload.refUid),
        data: encodeLabelData(buildCaip10(payload.chainId, payload.address), payload.tags),
        expirationTime: 0,
        revocable: true,
        salt
      },
      {
        name: "EAS Attestation",
        version: "1.2.0",
        chainId: this.config.chainId,
        verifyingContract: this.config.easAddress
      }
    );
    // Ethers v6 signTypedData
    // @ts-ignore
    const signature = await (signer as any).signTypedData(
      typed.domain,
      typed.types,
      typed.message
    );
    const split = Signature.from(signature);
    const uid = keccak256(getBytes(signature));
    const attestation = {
      sig: {
        domain: {
          ...typed.domain,
          chainId: String(typed.domain.chainId)
        },
        primaryType: typed.primaryType,
        types: typed.types,
        message: {
          ...typed.message,
          time: String(typed.message.time),
          expirationTime: String(typed.message.expirationTime ?? 0)
        },
        uid,
        version: 2,
        signature: {
          r: split.r,
          s: split.s,
          v: split.v
        }
      },
      signer: address
    };
    try {
      await this.http.postAttestation(attestation);
    } catch (err) {
      throw new Error(`Failed to post attestation: ${formatAxiosError(err)}`);
    }
    return { uid };
  }

  private async submitOffchainLabelBulk(labels: LabelPayload[]) {
    const signer = this.requireSigner();
    const address = await signer.getAddress();
    const attestations = [];
    const uids: string[] = [];
    for (const payload of labels) {
      const now = Math.floor(Date.now() / 1000);
      const salt = "0x" + randomBytes(32).toString("hex");
      const typed = buildOffchainTypedData(
        {
          schema: this.config.labelPoolSchema,
          recipient: HARDHAT_ATTESTATION_RECIPIENT,
          time: now,
          refUID: validateRefUid(payload.refUid),
          data: encodeLabelData(buildCaip10(payload.chainId, payload.address), payload.tags),
          expirationTime: 0,
          revocable: true,
          salt
        },
        {
          name: "EAS Attestation",
          version: "1.2.0",
          chainId: this.config.chainId,
          verifyingContract: this.config.easAddress
        }
      );
      // @ts-ignore
      const signature = await (signer as any).signTypedData(
        typed.domain,
        typed.types,
        typed.message
      );
      const split = Signature.from(signature);
      const uid = keccak256(getBytes(signature));
      uids.push(uid);
      attestations.push({
        sig: {
          domain: {
            ...typed.domain,
            chainId: String(typed.domain.chainId)
          },
          primaryType: typed.primaryType,
          types: typed.types,
          message: {
            ...typed.message,
            time: String(typed.message.time),
            expirationTime: String(typed.message.expirationTime ?? 0)
          },
          uid,
          version: 2,
          signature: {
            r: split.r,
            s: split.s,
            v: split.v
          }
        },
        signer: address
      });
    }
    try {
      await this.http.postAttestationsBulk(attestations);
    } catch (err) {
      throw new Error(`Failed to post bulk attestations: ${formatAxiosError(err)}`);
    }
    return { uids };
  }

  private async submitOffchainTrustList(payload: TrustListPayload) {
    const signer = this.requireSigner();
    const address = await signer.getAddress();
    const now = Math.floor(Date.now() / 1000);
    const salt = "0x" + randomBytes(32).toString("hex");
    const typed = buildOffchainTypedData(
      {
        schema: this.config.labelTrustSchema,
        recipient: HARDHAT_ATTESTATION_RECIPIENT,
        time: now,
        refUID: "0x0000000000000000000000000000000000000000000000000000000000000000",
        data: encodeTrustListData(payload.ownerName, payload.attesters, payload.attestations),
        expirationTime: 0,
        revocable: true,
        salt
      },
      {
        name: "EAS Attestation",
        version: "1.2.0",
        chainId: this.config.chainId,
        verifyingContract: this.config.easAddress
      }
    );
    // @ts-ignore
    const signature = await (signer as any).signTypedData(
      typed.domain,
      typed.types,
      typed.message
    );
    const split = Signature.from(signature);
    const uid = keccak256(getBytes(signature));
    const attestation = {
      sig: {
        domain: {
          ...typed.domain,
          chainId: String(typed.domain.chainId)
        },
        primaryType: typed.primaryType,
        types: typed.types,
        message: {
          ...typed.message,
          time: String(typed.message.time),
          expirationTime: String(typed.message.expirationTime ?? 0)
        },
        uid,
        version: 2,
        signature: {
          r: split.r,
          s: split.s,
          v: split.v
        }
      },
      signer: address
    };
    try {
      await this.http.postTrustList(attestation);
    } catch (err) {
      throw new Error(`Failed to post trust list: ${formatAxiosError(err)}`);
    }
    return { uid };
  }

  async revoke(uid: string, options: RevocationOptions = {}) {
    await this.init();
    const refUid = validateRefUid(uid);
    if (options.onchain) {
      const signer = this.requireSigner();
      const eas = new EAS(this.config.easAddress);
      eas.connect(signer as any);
      // @ts-ignore
      const tx = await eas.revoke({
        schema: this.config.labelPoolSchema,
        data: { uid: refUid, value: 0n }
      });
      const receipt = await tx.wait();
      return { transaction_hash: tx.tx.hash, receipt };
    }
    // Offchain revoke
    const signer = this.requireSigner();
    const interfaceFragments = ["function revokeOffchain(bytes32 uid)"];
    const iface = new Interface(interfaceFragments);
    const data = iface.encodeFunctionData("revokeOffchain", [refUid]);
    // Offchain revoke calls the EAS contract, but many clients choose onchain. For now, route to onchain.
    const provider = signer.provider ?? new JsonRpcProvider(this.config.rpcUrl);
    const tx = await signer.sendTransaction({
      to: this.config.easAddress,
      data,
      gasLimit: options.gasLimit
    });
    const receipt = await tx.wait();
    return { transaction_hash: tx.hash, receipt };
  }

  async getLabels(address: string, params: Record<string, any> = {}) {
    await this.init();
    const resolved = this.resolveReadAddress(address, params);
    const chainIdParam = resolved.chainId ?? params.chain_id ?? params.chainId;
    return (
      await this.http.getLabels({
        address: resolved.address,
        ...params,
        chain_id: chainIdParam
      })
    ).data;
  }

  async getLabelsBulk(addresses: string[], params: Record<string, any> = {}) {
    await this.init();
    addresses.forEach((address) => validateAddressForChain(address, "eip155:any"));
    return (await this.http.getLabelsBulk({ addresses, ...params })).data;
  }

  async getTrustedLabels(address: string, params: Record<string, any> = {}) {
    await this.init();
    const resolved = this.resolveReadAddress(address, params);
    const chainIdParam = resolved.chainId ?? params.chain_id ?? params.chainId;
    const resp = await this.http.getLabels({
      address: resolved.address,
      ...params,
      chain_id: chainIdParam
    });
    return resp.data;
  }

  async searchAddressesByTag(tagId: string, tagValue: string, params: Record<string, any> = {}) {
    await this.init();
    return (await this.http.searchAddressesByTag({ tag_id: tagId, tag_value: tagValue, ...params }))
      .data;
  }

  async getAttesterAnalytics(params: Record<string, any> = {}) {
    await this.init();
    return (await this.http.getAttesterAnalytics(params)).data;
  }
}
