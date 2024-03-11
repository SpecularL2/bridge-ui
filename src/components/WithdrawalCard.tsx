import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { hostChain, specularChain } from "@/wagmi";
import { tokenPairs } from "@/specular";
import { useEffect } from "react";
import { toast } from "sonner";
import { formatUnits, parseEther, zeroAddress } from "viem";
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

    const amount = parseEther(values.amount.toString());
    const gasLimit = 200_000;

    if (values.token !== undefined && values.token !== zeroAddress) {
      const pair = tokenPairs.find(p => p.specularAddress === values.token)

      if (!pair) {
        throw new Error("token pair not found - token list misconfigured")
      }

      writeContract({
        chainId: hostChain.id,
        abi,
        address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
        value: amount,
        functionName: "bridgeERC20",
        args: [pair.specularAddress, pair.hostAddress, amount, gasLimit, ""],
      });
      return
    }

    writeContract({
      chainId: specularChain.id,
      abi,
      address: import.meta.env.VITE_L2_BRIDGE_ADDRESS,
      value: amount,
      functionName: "bridgeETH",
      args: [gasLimit, ""],
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
