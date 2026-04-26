import { ArrowRight, Send } from "lucide-react";
import { CashOutForm } from "@/components/features/withdrawal/cash-out-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TransferPage() {
  return (
    <div className="fade-in mx-auto flex w-full max-w-2xl animate-in flex-col gap-6 duration-300 ease-out">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Send Money</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Cash out your balance to a bank account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="size-5 text-primary" />
            Cash Out to Bank
          </CardTitle>
          <CardDescription>
            Burns your ONE tokens and sends the equivalent USD to your bank
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashOutForm />
        </CardContent>
      </Card>

      <Card className="border-dashed opacity-60">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Send className="size-5 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Send to Contact</h3>
            <p className="text-muted-foreground text-xs">Coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
