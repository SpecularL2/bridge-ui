import { BridgeTransaction, MessageStatus, MessageType, finalizeDeposit, finalizeWithdrawal } from "@/specular";
import { ColumnDef } from "@tanstack/react-table";
import { Loader2 } from "lucide-react";
import { Address, formatUnits } from "viem";
import { Button } from "../ui/button";

export const columns: ColumnDef<BridgeTransaction>[] = [
  {
    accessorKey: "action",
    header: "Status",
    cell: ({ row }) => {
      // @ts-ignore
      const { status, message, publicHostClient, publicSpecularClient, writeContract, switchChain } =
        row.getValue("action");
      const messageHash: Address = row.getValue("messageHash");
      const type = row.getValue("type");

      if (status === MessageStatus.READY && type === MessageType.DEPOSIT) {
        return (
          <Button
            onClick={async () =>
              await finalizeDeposit(
                messageHash,
                message,
                publicSpecularClient,
                publicHostClient,
                switchChain,
                writeContract,
              )
            }
            variant="outline"
            className="w-28"
          >
            Finalize
          </Button>
        );
      }

      if (status === MessageStatus.READY && type === MessageType.WITHDRAWAL) {
        return (
          <Button
            onClick={async () =>
              await finalizeWithdrawal(
                messageHash,
                message,
                publicSpecularClient,
                publicHostClient,
                switchChain,
                writeContract,
              )
            }
            variant="outline"
            className="w-28"
          >
            Finalize
          </Button>
        );
      }

      if (status === MessageStatus.PENDING) {
        return (
          <Button disabled className="w-28">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Pending
          </Button>
        );
      }

      if (status === MessageStatus.DONE) {
        return (
          <Button disabled className="w-28 bg-green-600">
            Done
          </Button>
        );
      }
    },
  },
  {
    accessorKey: "type",
    header: "Type",
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = BigInt(row.getValue("amount"));
      const amountEth = formatUnits(amount, 18);
      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "ETH",
      }).format(Number(amountEth));

      return <div className="font-medium">{formatted}</div>;
    },
  },
  {
    accessorKey: "messageHash",
    header: "Hash",
    cell: ({ row }) => {
      const fullHash: string = row.getValue("messageHash");

      return <div className="font-mono">{fullHash.slice(2, 10)}</div>;
    },
  },
];
