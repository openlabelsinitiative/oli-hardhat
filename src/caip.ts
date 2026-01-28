export interface Caip10Parts {
  chainId: string;
  address: string;
}

const CAIP10_REGEX = /^([^:]+):([^:]+):([^:]+)$/;

export const isCaip10 = (value: string) => CAIP10_REGEX.test(value);

export const parseCaip10 = (value: string): Caip10Parts => {
  const match = CAIP10_REGEX.exec(value);
  if (!match) {
    throw new Error(
      `Invalid CAIP-10 format: ${value}. Expected <namespace>:<reference>:<address>.`
    );
  }
  const [, namespace, reference, address] = match;
  return {
    chainId: `${namespace}:${reference}`,
    address
  };
};

export const buildCaip10 = (chainId: string, address: string) => `${chainId}:${address}`;
