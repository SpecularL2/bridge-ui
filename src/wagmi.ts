import { defaultWagmiConfig } from "@web3modal/wagmi/react";
import { type Chain } from "viem";
import { sepolia } from "viem/chains";

export const hostChain = {
  id: Number(import.meta.env.VITE_L1_CHAIN_ID),
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_L1_RPC_URL] },
  },
  testnet: true,
} as const satisfies Chain;

export const specularChain = {
  id: Number(import.meta.env.VITE_SPECULAR_CHAIN_ID),
  name: "Specular",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [import.meta.env.VITE_SPECULAR_RPC_URL] },
  },
  testnet: true,
  sourceId: import.meta.env.VITE_SPECULAR_CHAIN_ID,
} as const satisfies Chain;

export const chains: [Chain, ...Chain[]] = [sepolia, hostChain, specularChain];

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
