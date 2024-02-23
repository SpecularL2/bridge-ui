import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

type submitFunction = (values: { amount: number }) => void;

import * as z from "zod";

export const formSchema = z.object({
  amount: z.coerce.number().positive(),
});

export function InputForm({ onSubmit, description }: { onSubmit: submitFunction; description: string }) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0.1,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <Input
                  inputMode="numeric"
                  {...field}
                  value={field.value || ""}
                  pattern="[0-9.]*"
                  onChange={(e) => e.target.validity.valid && field.onChange(e.target.value)}
                />
              </FormControl>
              <FormDescription>{description}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Bridge</Button>
      </form>
    </Form>
  );
}

export default InputForm;
