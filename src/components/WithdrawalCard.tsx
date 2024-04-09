import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { hostChain, specularChain } from "@/wagmi";
import { tokenPairs } from "@/specular";
import { useEffect } from "react";
import { toast } from "sonner";
import { formatUnits, parseAbiItem, parseEther, parseUnits, zeroAddress } from "viem";
import { useAccount, useBalance, useSwitchChain, useWriteContract } from "wagmi";
import * as z from "zod";
import abi from "../../abi/L2StandardBridge.sol/L2StandardBridge.json";
import { InputForm, formSchema } from "./InputForm";
function WithdrawalCard() {
  const { data: hash, error, writeContract } = useWriteContract();
  const { switchChain } = useSwitchChain();
  const account = useAccount();
  const chainId = account.chainId;
  const { data: balance } = useBalance({
    address: account.address,
    chainId: specularChain.id
  })

  let balanceString = "-"
  if (balance) {
    balanceString = formatUnits(balance.value, balance.decimals)
    balanceString = balanceString.substring(0, balanceString.lastIndexOf(".") + 5)
    balanceString += " " + balance.symbol
  }

  // TODO: more detail in toasts, link to explorer etc...
  useEffect(() => {
    if (hash) {
      toast(
        <div>
          <p className="font-bold">successfully initiated withdrawal</p>
          <p className="pb-2">see transactions tab to finalize</p>
          <a className="font-mono">{hash}</a>
        </div>
      );
    } else if (error) {
      console.error({ error });
    }
  }, [hash, error]);

  // TODO: show pending animation
  // TODO: show better success and error notifications
  function onSubmit(values: z.infer<typeof formSchema>) {
    if (chainId !== specularChain.id) {
      switchChain({ chainId: specularChain.id });
      return;
    }

    const gasLimit = 200_000;

    if (values.token !== undefined && values.token !== zeroAddress) {
      const pair = tokenPairs.find(p => p.specularAddress === values.token)

      if (!pair) {
        throw new Error("token pair not found - token list misconfigured")
      }

      const approveTokenAbi = [
        parseAbiItem("function approve(address spender, uint256 amount)")
      ]
      const amount = parseUnits(values.amount.toString(), pair.decimals)

      writeContract({
        chainId: specularChain.id,
        abi: approveTokenAbi,
        address: pair.specularAddress,
        functionName: "approve",
        args: [import.meta.env.VITE_L2_BRIDGE_ADDRESS, amount],
      });

      const bridgeTokenAbi = [
        parseAbiItem("function bridgeERC20(address _localToken,address _remoteToken,uint256 _amount,uint32 _minGasLimit,bytes calldata _extraData)")
      ];

      writeContract({
        chainId: specularChain.id,
        abi: bridgeTokenAbi,
        address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
        functionName: "bridgeERC20",
        args: [pair.specularAddress, pair.hostAddress, amount, gasLimit, "0x"],
      });
      return
    }

    const amount = parseEther(values.amount.toString());

    const bridgeETHAbi = [
      parseAbiItem("function bridgeETH(uint32 _minGasLimit, bytes calldata _extraData) payable")
    ];

    writeContract({
      chainId: specularChain.id,
      abi: bridgeETHAbi,
      address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
      value: amount,
      functionName: "bridgeETH",
      args: [gasLimit, "0x"],
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardDescription>bridge from <b>{specularChain.name}</b> to <b>{hostChain.name}</b></CardDescription>
      </CardHeader>
      <CardContent>
        <InputForm onSubmit={onSubmit} description={"available: " + balanceString} />
      </CardContent>
    </Card>
  );
}

export default WithdrawalCard;
