import Link from "next/link";
import { Lock, CheckCircle2, Clock3 } from "lucide-react";
import { Card } from "@/components/ui/card";

export function StepsTimeline({ steps }: { steps: any[] }) {
  return (
    <div className="grid gap-4">
      {steps.map((step) => {
        const icon =
          step.status === "COMPLETED" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          ) : step.status === "LOCKED" ? (
            <Lock className="h-5 w-5 text-slate-400" />
          ) : (
            <Clock3 className="h-5 w-5 text-brand-600" />
          );

        return (
          <Link key={step.id} href={`/candidat/etape/${step.stepNumber}`}>
            <Card className="flex items-center gap-4">
              <div className="rounded-2xl bg-slate-100 p-3">{icon}</div>
              <div className="flex-1">
                <p className="font-semibold">Étape {step.stepNumber}</p>
                <p className="text-sm text-slate-500">{step.status}</p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
