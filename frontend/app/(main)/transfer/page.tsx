import { ArrowRight, Send } from "lucide-react";
import { SendForm } from "@/components/features/transfer/send-form";
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
          Send to another user or cash out to your bank account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="size-5 text-primary" />
            Send to Contact
          </CardTitle>
          <CardDescription>
            Send money instantly to any OneCurrency user by email. No platform
            fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SendForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRight className="size-5 text-primary" />
            Cash Out to Bank
          </CardTitle>
          <CardDescription>
            Converts your OneCurrency balance and sends the USD to your bank
            account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashOutForm />
        </CardContent>
      </Card>
    </div>
  );
}
