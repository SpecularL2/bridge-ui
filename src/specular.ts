import specularOracleAbi from "../abi/L1Oracle.sol/L1Oracle.json";
import hostPortalAbi from "../abi/L1Portal.sol/L1Portal.json";
import hostBridgeAbi from "../abi/L1StandardBridge.json";
import specularPortalAbi from "../abi/L2Portal.sol/L2Portal.json";
import specularBridgeAbi from "../abi/L2StandardBridge.sol/L2StandardBridge.json";
import rollupAbi from "../abi/Rollup.sol/Rollup.json";

import { hostChain, specularChain } from "@/wagmi";
import { AbiEvent, parseAbiItem } from "abitype";
import { Address, Chain, Client, PublicClient, TransactionReceipt, Transport, encodeAbiParameters, keccak256 } from "viem";
import { getLogs } from "viem/actions";
import { optimismSepolia, publicActionsL1, walletActionsL1, walletActionsL2 } from 'viem/op-stack';

import tokenList from "../specular.tokenlist.json"

// @ts-ignore
interface BigInt {
  // Convert to BigInt to string form in JSON.stringify
  toJSON: () => string;
}
// @ts-ignore
BigInt.prototype.toJSON = function() {
  return this.toString();
};

export enum MessageStatus {
  DONE = "Done",
  PENDING = "Pending",
  READY = "Ready",
}

export enum MessageType {
  DEPOSIT = "Deposit",
  WITHDRAWAL = "Withdrawal",
}

export type Message = {
  version: bigint;
  nonce: bigint;
  sender: Address;
  target: Address;
  value: bigint;
  gasLimit: bigint;
  data: string;
};

export type BridgeTransaction = {
  messageHash: string;
  block: bigint;
  amount: bigint;
  type: MessageType;
  action: {
    status: MessageStatus;
    message: Message;
    publicHostClient: PublicClient;
    writeContract: any;
    switchChain: any;
  };
};

function max(a: bigint, b: bigint) {
  if (a > b) {
    return a;
  }
  return b;
}

export type TokenPair = {
  symbol: String,
  hostAddress: Address,
  specularAddress: Address,
  decimals: number,
}

const specularTokens = tokenList.tokens.filter(t => t.chainId === specularChain.id)
const hostTokens = tokenList.tokens.filter(t => t.chainId === hostChain.id)

export const tokenPairs: TokenPair[] = []
// TODO: make this less terrible
for (let s of specularTokens) {
  for (let h of hostTokens) {
    if (s.name === h.name) {
      tokenPairs.push({
        hostAddress: h.address as Address,
        specularAddress: s.address as Address,
        symbol: s.symbol,
        decimals: s.decimals,
      })
    }
  }
}

export async function getBridgeTransactions(
  publicHostClient: PublicClient,
  publicSpecularClient: PublicClient,
  _writeContract: any,
  _switchChain: any,
  fromAddress: Address,
): Promise<BridgeTransaction[]> {
  const withdrawalEventETH = parseAbiItem("event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)")

  const txs: BridgeTransaction[] = [];

  const lastSpecularBlockNumber = await publicSpecularClient.getBlockNumber();

  const withdrawalBridgeLogs = await getLogs(publicSpecularClient, {
    address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
    event: withdrawalEventETH,
    args: {
      from: fromAddress,
    },
    fromBlock: max(lastSpecularBlockNumber - 500n, 0n),
  });

  console.log({ withdrawalBridgeLogs })

  for (let log of withdrawalBridgeLogs) {
    const receipt: TransactionReceipt = await publicSpecularClient.getTransactionReceipt({ hash: log.transactionHash });

    // TODO:
    // - use specularChain definition instead of `optimismSepolia`
    // - add source chain and required contracts to 

    // @ts-ignore
    const status = await publicHostClient.extend(publicActionsL1()).getWithdrawalStatus({
      receipt,
      targetChain: optimismSepolia,
    })

    // @ts-ignore
    const { seconds, timestamp } = await publicHostClient.extend(publicActionsL1()).getTimeToProve({
      receipt,
      targetChain: optimismSepolia,
    })

    console.log({ status, seconds })
  }
  return txs
}
