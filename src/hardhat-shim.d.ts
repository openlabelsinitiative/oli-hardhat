declare module "hardhat/config" {
  export const task: any;
}

declare module "hardhat/types" {
  export interface HardhatRuntimeEnvironment {
    config: any;
    ethers?: any;
  }
}
