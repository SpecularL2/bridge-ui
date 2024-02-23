import { defaultWagmiConfig } from "@web3modal/wagmi/react";
import { type Chain } from "viem";

export const hostChain = {
  id: 1337,
  name: "Local L1",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] },
  },
  testnet: true,
} as const satisfies Chain;

export const specularChain = {
  id: 13527,
  name: "Local Specular",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:4011"] },
  },
  testnet: true,
  sourceId: 1337,
} as const satisfies Chain;

export const chains: [Chain, ...Chain[]] = [hostChain, specularChain];

export const projectId = "30b22d20189ccd0e22450aeaeb4d724b";

const metadata = {
  name: "Web3Modal",
  description: "Web3Modal Example",
  url: "https://web3modal.com",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
  verifyUrl: "",
};

export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
