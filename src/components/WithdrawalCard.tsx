import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { specularChain } from "@/wagmi";
import { useEffect } from "react";
import { toast } from "sonner";
import { parseEther } from "viem";
import { useSwitchChain, useWriteContract } from "wagmi";
import * as z from "zod";
import abi from "../../abi/L2StandardBridge.sol/L2StandardBridge.json";
import { InputForm, formSchema } from "./InputForm";

function WithdrawalCard() {
  const { data: hash, error, writeContract } = useWriteContract();
  const { switchChain } = useSwitchChain();

  // TODO: more detail in toasts, link to explorer etc...
  useEffect(() => {
    if (hash) {
      toast(hash);
    } else if (error) {
      console.log({ error });
      toast(error.message);
    }
  }, [hash, error]);

  // TODO: show pending animation
  // TODO: show better success and error notifications
  function onSubmit(values: z.infer<typeof formSchema>) {
    const amount = parseEther(values.amount.toString());
    const gasLimit = 200_000;

    switchChain({ chainId: specularChain.id });
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
        <CardTitle>Withdraw</CardTitle>
        <CardDescription>Withdraw funds from the Specular network</CardDescription>
      </CardHeader>
      <CardContent>
        <InputForm onSubmit={onSubmit} description={"The amount you want to bridge in ETH"} />
      </CardContent>
    </Card>
  );
}

export default WithdrawalCard;
