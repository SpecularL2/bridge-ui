import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BridgeTransaction, getBridgeTransactions } from "@/specular";
import { hostChain, specularChain } from "@/wagmi";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAccount, usePublicClient, useSwitchChain, useWalletClient, useWriteContract } from "wagmi";
import { columns } from "./Columns";
import { DataTable } from "./DataTable";

function TransactionsCard() {
  const publicHostClient = usePublicClient({ chainId: hostChain.id });
  const publicSpecularClient = usePublicClient({ chainId: specularChain.id });
  const { data: hash, error, writeContract } = useWriteContract();


  if (!publicHostClient || !publicSpecularClient) {
    throw new Error("could not get public clients");
  }

  const { switchChain } = useSwitchChain();
  const { address } = useAccount();
  const walletClient = useWalletClient({ account: address });

  walletClient


  const [txs, setTxs] = useState<BridgeTransaction[]>([]);

  useEffect(() => {
    if (!address) {
      return;
    }

    getBridgeTransactions(publicHostClient, publicSpecularClient, writeContract, switchChain, address).then((txs) =>
      setTxs(txs),
    );

    const interval = setInterval(
      () =>
        getBridgeTransactions(publicHostClient, publicSpecularClient, writeContract, switchChain, address).then((txs) =>
          setTxs(txs),
        ),
      2000,
    );

    return () => clearInterval(interval);
  }, [switchChain, address, publicSpecularClient, publicHostClient, writeContract]);

  // TODO: more detail in toasts, link to explorer etc...
  useEffect(() => {
    if (hash) {
      toast(
        <div>
          <p className="font-bold pb-2">successfully finalized transaction</p>
          <a className="font-mono">{hash}</a>
        </div>
      )
    } else if (error) {
      console.error({ error });
    }
  }, [hash, error]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>Overview of your bridging transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable columns={columns} data={txs} />
      </CardContent>
    </Card>
  );
}

export default TransactionsCard;
