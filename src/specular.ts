import specularOracleAbi from "../abi/L1Oracle.sol/L1Oracle.json";
import hostPortalAbi from "../abi/L1Portal.sol/L1Portal.json";
import hostBridgeAbi from "../abi/L1StandardBridge.json";
import specularPortalAbi from "../abi/L2Portal.sol/L2Portal.json";
import specularBridgeAbi from "../abi/L2StandardBridge.sol/L2StandardBridge.json";
import rollupAbi from "../abi/Rollup.sol/Rollup.json";

import { hostChain, specularChain } from "@/wagmi";
import { AbiEvent } from "abitype";
import { Address, PublicClient, encodeAbiParameters, keccak256 } from "viem";
import { getLogs } from "viem/actions";

// @ts-ignore
interface BigInt {
  // Convert to BigInt to string form in JSON.stringify
  toJSON: () => string;
}
// @ts-ignore
BigInt.prototype.toJSON = function () {
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

export async function getDepositStatus(
  publicSpecularClient: PublicClient,
  depositHash: string,
  depositBlockNumber: bigint,
): Promise<MessageStatus> {
  // 1: check L2Portal if its finalized -> DONE
  const isFinalized = await publicSpecularClient.readContract({
    abi: specularPortalAbi,
    address: import.meta.env.VITE_L2_PORTAL_ADDRESS,
    functionName: "finalizedDeposits",
    args: [depositHash],
  });

  if (isFinalized) {
    return MessageStatus.DONE;
  }

  // 2: check L1Oracle if it can be finalized -> READY
  const oracleBlockNumber = (await publicSpecularClient.readContract({
    abi: specularOracleAbi,
    address: import.meta.env.VITE_L1ORACLE_ADDRESS,
    functionName: "number",
  })) as bigint;

  console.log({ depositBlockNumber, oracleBlockNumber });
  if (depositBlockNumber <= oracleBlockNumber) {
    return MessageStatus.READY;
  }

  return MessageStatus.PENDING;
}

export async function getWithdrawalStatus(
  publicHostClient: PublicClient,
  withdrawalHash: string,
  withdrawalBlockNumber: bigint,
): Promise<MessageStatus> {
  // 1: check L2Portal if its finalized -> DONE
  const isFinalized = await publicHostClient.readContract({
    abi: hostPortalAbi,
    address: import.meta.env.VITE_L1_PORTAL_ADDRESS,
    functionName: "finalizedWithdrawals",
    args: [withdrawalHash],
  });

  if (isFinalized) {
    return MessageStatus.DONE;
  }

  // 2: check the latest assertion block number is high enough -> READY
  const lastConfirmedAssertionId = await publicHostClient.readContract({
    abi: rollupAbi,
    address: import.meta.env.VITE_ROLLUP_ADDRESS,
    functionName: "lastConfirmedAssertionID",
  });

  const assertion = await publicHostClient.readContract({
    abi: rollupAbi,
    address: import.meta.env.VITE_ROLLUP_ADDRESS,
    functionName: "getAssertion",
    args: [lastConfirmedAssertionId],
  });

  // @ts-ignore
  const assertionBlockNumber = assertion.blockNum;

  console.log({ withdrawalBlockNumber, assertionBlockNumber });
  if (withdrawalBlockNumber <= assertionBlockNumber) {
    return MessageStatus.READY;
  }

  return MessageStatus.PENDING;
}

// TODO: find correct type for clients here
export async function getBridgeTransactions(
  publicHostClient: any,
  publicSpecularClient: any,
  writeContract: any,
  switchChain: any,
  fromAddress: Address,
): Promise<BridgeTransaction[]> {
  const depositBridgeEvent = hostBridgeAbi.find((e) => e.name === "ETHBridgeInitiated") as AbiEvent;
  const depositPortalEvent = hostPortalAbi.find((e) => e.name === "DepositInitiated") as AbiEvent;
  const withdrawalBridgeEvent = specularBridgeAbi.find((e) => e.name === "ETHBridgeInitiated") as AbiEvent;
  const withdrawalPortalEvent = specularPortalAbi.find((e) => e.name === "WithdrawalInitiated") as AbiEvent;

  const txs = [];

  const lastHostBlockNumber = await publicHostClient.getBlockNumber();

  const depositBridgeLogs = await getLogs(publicHostClient, {
    address: import.meta.env.VITE_L1_BRIDGE_ADDRESS,
    event: depositBridgeEvent,
    args: {
      from: fromAddress,
    },
    fromBlock: max(lastHostBlockNumber - BigInt(import.meta.env.VITE_TRANSACTIONS_WINDOW), 0n),
  });

  for (const log of depositBridgeLogs) {
    const portalLogs = await getLogs(publicHostClient, {
      address: import.meta.env.VITE_L1_PORTAL_ADDRESS,
      event: depositPortalEvent,
      fromBlock: log.blockNumber,
      toBlock: log.blockNumber,
    });

    // TODO: this breaks if two bridge transactions with the same value happen in the same block
    //       mitigate this by also comparing the p.args.data and abi.encodeCall(...)

    // @ts-ignore
    const depositLog = portalLogs.find((p) => p.args.value === log.args.amount);
    // @ts-ignore
    const depositHash = depositLog.args.depositHash;
    // @ts-ignore
    const depositAmount = log.args.amount;
    const depositStatus = await getDepositStatus(publicSpecularClient, depositHash, log.blockNumber);

    const message = {
      version: 0n,
      // @ts-ignore
      nonce: depositLog.args.nonce as bigint,
      // @ts-ignore
      sender: depositLog.args.sender as Address,
      // @ts-ignore
      target: depositLog.args.target as Address,
      // @ts-ignore
      value: depositLog.args.value as bigint,
      // @ts-ignore
      gasLimit: depositLog.args.gasLimit as bigint,
      // @ts-ignore
      data: depositLog.args.data,
    };

    txs.push({
      messageHash: depositHash,
      amount: depositAmount,
      block: log.blockNumber,
      type: MessageType.DEPOSIT,
      action: {
        status: depositStatus,
        message,
        publicHostClient,
        publicSpecularClient,
        writeContract,
        switchChain,
      },
    });
  }

  const lastSpecularBlockNumber = await publicSpecularClient.getBlockNumber();

  const withdrawalBridgeLogs = await getLogs(publicSpecularClient, {
    address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
    event: withdrawalBridgeEvent,
    args: {
      from: fromAddress,
    },
    fromBlock: max(lastSpecularBlockNumber - 500n, 0n),
  });

  for (const log of withdrawalBridgeLogs) {
    const portalLogs = await getLogs(publicSpecularClient, {
      address: import.meta.env.VITE_L2_PORTAL_ADDRESS,
      event: withdrawalPortalEvent,
      fromBlock: log.blockNumber,
      toBlock: log.blockNumber,
    });

    // TODO: this breaks if two bridge transactions with the same value happen in the same block
    //       mitigate this by also comparing the p.args.data and abi.encodeCall(...)

    // @ts-ignore
    const withdrawalLog = portalLogs.find((p) => p.args.value === log.args.amount);

    // @ts-ignore
    const withdrawalHash = withdrawalLog.args.withdrawalHash;
    // @ts-ignore
    const withdrawalAmount = log.args.amount;
    const withdrawalStatus = await getWithdrawalStatus(publicHostClient, withdrawalHash, log.blockNumber);

    const message = {
      version: 0n,
      // @ts-ignore
      nonce: withdrawalLog.args.nonce as bigint,
      // @ts-ignore
      sender: withdrawalLog.args.sender as Address,
      // @ts-ignore
      target: withdrawalLog.args.target as Address,
      // @ts-ignore
      value: withdrawalLog.args.value as bigint,
      // @ts-ignore
      gasLimit: withdrawalLog.args.gasLimit as bigint,
      // @ts-ignore
      data: withdrawalLog.args.data,
    };

    txs.push({
      messageHash: withdrawalHash,
      amount: withdrawalAmount,
      block: log.blockNumber,
      type: MessageType.WITHDRAWAL,
      action: {
        status: withdrawalStatus,
        message,
        publicHostClient,
        publicSpecularClient,
        writeContract,
        switchChain,
      },
    });
  }

  return txs.sort((a, b) => {
    if (a.action.status === MessageStatus.READY) {
      return -1;
    }

    if (a.action.status === MessageStatus.PENDING && b.action.status === MessageStatus.DONE) {
      return -1;
    }

    return 1;
  });
}

export async function finalizeDeposit(
  messageHash: Address,
  message: Message,
  publicSpecularClient: PublicClient,
  publicHostClient: PublicClient,
  switchChain: any,
  writeContract: any,
) {
  const oracleBlockNumber = (await publicSpecularClient.readContract({
    abi: specularOracleAbi,
    address: import.meta.env.VITE_L1ORACLE_ADDRESS,
    functionName: "number",
  })) as bigint;

  const encoded = encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [messageHash, 0n]);

  const storageSlot = keccak256(encoded);

  const proof = await publicHostClient.getProof({
    address: import.meta.env.VITE_L1_PORTAL_ADDRESS,
    storageKeys: [storageSlot],
    blockNumber: oracleBlockNumber,
  });

  const response = await fetch("/finalize", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      oracleBlockNumber,
      message,
      proof,
    }),
  });

  const text = await response.text();
  const status = response.status;
  console.log({ text, status });

  if (status === 200) {
    return;
  }

  await switchChain({ chainId: specularChain.id });
  writeContract({
    chainId: specularChain.id,
    abi: specularPortalAbi,
    address: import.meta.env.VITE_L2_PORTAL_ADDRESS,
    functionName: "finalizeDepositTransaction",
    args: [oracleBlockNumber, message, proof.accountProof, proof.storageProof[0].proof],
  });
}

export async function finalizeWithdrawal(
  messageHash: Address,
  message: Message,
  publicSpecularClient: PublicClient,
  publicHostClient: PublicClient,
  switchChain: any,
  writeContract: any,
) {
  const lastConfirmedAssertionId = await publicHostClient.readContract({
    abi: rollupAbi,
    address: import.meta.env.VITE_ROLLUP_ADDRESS,
    functionName: "lastConfirmedAssertionID",
  });

  const assertion = await publicHostClient.readContract({
    abi: rollupAbi,
    address: import.meta.env.VITE_ROLLUP_ADDRESS,
    functionName: "getAssertion",
    args: [lastConfirmedAssertionId],
  });
  // @ts-ignore
  const assertionBlockNumber = assertion.blockNum;

  const encoded = encodeAbiParameters([{ type: "bytes32" }, { type: "uint256" }], [messageHash, 0n]);

  const storageSlot = keccak256(encoded);

  const proof = await publicSpecularClient.getProof({
    address: import.meta.env.VITE_L2_PORTAL_ADDRESS,
    storageKeys: [storageSlot],
    blockNumber: assertionBlockNumber,
  });

  const block = await publicSpecularClient.getBlock({ blockNumber: assertionBlockNumber });

  await switchChain({ chainId: hostChain.id });
  writeContract({
    chainId: hostChain.id,
    abi: hostPortalAbi,
    address: import.meta.env.VITE_L1_PORTAL_ADDRESS,
    functionName: "finalizeWithdrawalTransaction",
    args: [
      message,
      lastConfirmedAssertionId,
      block.hash,
      block.stateRoot,
      proof.accountProof,
      proof.storageProof[0].proof,
    ],
  });
}
