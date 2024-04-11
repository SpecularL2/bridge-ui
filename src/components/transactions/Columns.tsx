import { ColumnDef } from "@tanstack/react-table";
import { formatUnits } from "viem";
import { Button } from "../ui/button";
import { BridgeTransaction, proveAndFinalize } from "@/specular";

export const columns: ColumnDef<BridgeTransaction>[] = [
  {
    accessorKey: "action",
    header: "",
    cell: ({ row }) => {
      return (
        <Button
          onClick={async () => proveAndFinalize(row.original)}
          variant="outline"
          className="w-28"
        >
          Finalize
        </Button>
      );
    },
  },
  {
    accessorKey: "amount",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.original.withdrawal.value;
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
      const fullHash = row.original.withdrawal.withdrawalHash;

      return < div className="font-mono" > {fullHash.slice(2, 10)}</div >;
    },
  },
];
