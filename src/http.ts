import axios, { AxiosInstance } from "axios";
import { DEFAULT_API_URL } from "./constants.js";
import { ResolvedConfig } from "./types.js";

export class OliHttpClient {
  private client: AxiosInstance;
  private apiKey?: string;

  constructor(config: ResolvedConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: DEFAULT_API_URL,
      timeout: 30_000
    });
  }

  private authHeaders() {
    return this.apiKey ? { "X-API-Key": this.apiKey } : {};
  }

  async postAttestation(attestation: any) {
    return this.client.post("/attestation", attestation);
  }

  async postAttestationsBulk(attestations: any[]) {
    return this.client.post("/attestations/bulk", { attestations });
  }

  async postTrustList(trustList: any) {
    return this.client.post("/trust-list", trustList);
  }

  async getAttestations(params: Record<string, any>) {
    return this.client.get("/attestations", { params });
  }

  async getTrustLists(params: Record<string, any>) {
    return this.client.get("/trust-lists", { params });
  }

  async getLabels(params: Record<string, any>) {
    return this.client.get("/labels", { params, headers: this.authHeaders() });
  }

  async getLabelsBulk(payload: Record<string, any>) {
    return this.client.post("/labels/bulk", payload, { headers: this.authHeaders() });
  }

  async searchAddressesByTag(params: Record<string, any>) {
    return this.client.get("/addresses/search", { params, headers: this.authHeaders() });
  }

  async getAttesterAnalytics(params: Record<string, any>) {
    return this.client.get("/analytics/attesters", { params, headers: this.authHeaders() });
  }
}
