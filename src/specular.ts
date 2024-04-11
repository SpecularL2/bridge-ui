import { hostChain, specularChain } from "@/wagmi";
import { parseAbiItem } from "abitype";
import { Address, PublicClient, TransactionReceipt, WalletClient } from "viem";
import { getLogs } from "viem/actions";
import { getWithdrawals, publicActionsL1, publicActionsL2, walletActionsL1 } from 'viem/op-stack';

import tokenList from "../specular.tokenlist.json"
import { Withdrawal } from "node_modules/viem/_types/chains/opStack/types/withdrawal";

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
  receipt: TransactionReceipt,
  address: Address,
  withdrawal: Withdrawal,
  walletHostClient: WalletClient,
  publicHostClient: PublicClient,
  publicSpecularClient: PublicClient,
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
  publicSpecularClient: PublicClient,
  publicHostClient: PublicClient,
  walletHostClient: WalletClient,
  address: Address,
): Promise<BridgeTransaction[]> {
  const withdrawalEventETH = parseAbiItem("event ETHBridgeInitiated(address indexed from, address indexed to, uint256 amount, bytes extraData)")

  // TODO: 
  //  - create a type for finalizations: Withdrawal + L1 wallet client
  //  - on click of finalize button: generate proof + finalize
  //  - maybe: simulate finalization -> get status this way?
  const txs: BridgeTransaction[] = [];

  const lastSpecularBlockNumber = await publicSpecularClient.getBlockNumber();

  // TODO: eventually we should use an indexer here
  const withdrawalBridgeLogs = await getLogs(publicSpecularClient, {
    address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
    event: withdrawalEventETH,
    args: {
      from: address,
    },
    fromBlock: max(lastSpecularBlockNumber - 2000n, 0n),
  });

  for (let log of withdrawalBridgeLogs) {
    const receipt = await publicSpecularClient.getTransactionReceipt({ hash: log.transactionHash });

    // @ts-ignore
    const status = await publicHostClient.extend(publicActionsL1()).getWithdrawalStatus({
      receipt,
      l2OutputOracleAddress: import.meta.env.VITE_L1_OUTPUT_ORACLE_ADDRESS,
      portalAddress: import.meta.env.VITE_L1_PORTAL_ADDRESS,
    })

    console.log({ status })

    const withdrawals = getWithdrawals(receipt).map(w => {
      return {
        receipt,
        address,
        withdrawal: w,
        walletHostClient,
        publicHostClient,
        publicSpecularClient,
      }
    })
    txs.push(...withdrawals)
  }
  return txs
}

export async function proveAndFinalize(arg: BridgeTransaction) {
  const { receipt, address, withdrawal, publicHostClient, publicSpecularClient, walletHostClient } = arg;

  console.log({ receipt })

  // @ts-ignore
  const output = await publicHostClient.extend(publicActionsL1()).getL2Output({
    l2BlockNumber: receipt.blockNumber,
    l2OutputOracleAddress: import.meta.env.VITE_L1_OUTPUT_ORACLE_ADDRESS,
  })

  // @ts-ignore
  const args = await publicSpecularClient.extend(publicActionsL2()).buildProveWithdrawal({
    account: address,
    output,
    withdrawal,
  })

  // @ts-ignore
  await walletHostClient.extend(walletActionsL1()).proveWithdrawal(args)

  // @ts-ignore
  await walletHostClient.extend(walletActionsL1()).finalizeWithdrawal({
    account: address,
    withdrawal,
    portalAddress: import.meta.env.VITE_L1_PORTAL_ADDRESS,
  })

  console.log({ output })

}
