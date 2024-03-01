import specularPortalAbi from "../abi/L2Portal.sol/L2Portal.json";
import specularBridgeAbi from "../abi/L2StandardBridge.sol/L2StandardBridge.json";
import { Address, createPublicClient, createWalletClient, decodeFunctionData, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { type Chain } from "viem";

// if users are bridging to specular for the first time, 
// we want to finalize the transaction for them
//
// the following has to be true for a transaction to be finalized
// - ETH is bridged via the StandardBridge
// - the recipient hash less than the threshold amount on the specular chain
export async function onRequestPost(context: any) {
  const { oracleBlockNumber, message, proof } = await context.request.json()

  if (!context.env.ONBOARDING_PRIVATE_KEY) {
    return new Response("onboarding service is disabled", { status: 403 })
  }

  const specularChain = {
    id: Number(context.env.VITE_SPECULAR_CHAIN_ID),
    name: "Specular",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [context.env.VITE_SPECULAR_RPC_URL] },
    },
    testnet: true,
    sourceId: context.env.VITE_SPECULAR_CHAIN_ID,
  } as const satisfies Chain;

  const account = privateKeyToAccount(context.env.ONBOARDING_PRIVATE_KEY) 
  const publicClient = createPublicClient({ chain: specularChain, transport: http() })
  const walletClient = createWalletClient({
    account,
    chain: specularChain,
    transport: http()
  })

  const { functionName, args } = decodeFunctionData({ abi: specularBridgeAbi, data: message.data })
  if (!args || functionName !== "finalizeBridgeETH") {
    return new Response("won't finalize this transaction", { status: 403 })
  }
  const recipientBalance = await publicClient.getBalance({ address: args[1] as Address })

  console.log({
    recipientBalance, 
    threshold: context.env.DEPOSIT_FUNDING_THRESHOLD, 
    address: args[1] 
  })

  if (recipientBalance > BigInt(context.env.DEPOSIT_FUNDING_THRESHOLD)) {
    return new Response("won't finalize this transaction", { status: 403 })
  }

  const { request } = await publicClient.simulateContract({ 
    account,
    chain: specularChain,
    abi: specularPortalAbi,
    address: context.env.VITE_L2_PORTAL_ADDRESS,
    functionName: "finalizeDepositTransaction",
    args: [oracleBlockNumber, message, proof.accountProof, proof.storageProof[0].proof],
  })
  const hash = await walletClient.writeContract(request)

  return new Response(hash)
}
