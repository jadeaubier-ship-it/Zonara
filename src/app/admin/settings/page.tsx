import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";

export default async function AdminSettingsPage() {
  const [steps, templates, trainings] = await Promise.all([
    prisma.stepConfig.findMany({ orderBy: { stepNumber: "asc" } }),
    prisma.emailTemplate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.trainingSession.findMany({ orderBy: { startDate: "asc" } })
  ]);

  return (
    <div className="grid gap-6">
      <Card className="space-y-3">
        <h2 className="text-2xl font-bold">Configuration des étapes</h2>
        {steps.map((step) => (
          <div key={step.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">
              Étape {step.stepNumber} · {step.name}
            </p>
            <p className="mt-1 text-sm text-slate-500">{step.descriptionAdmin}</p>
          </div>
        ))}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl font-bold">Templates email</h2>
        {templates.map((template) => (
          <div key={template.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">{template.slug}</p>
            <p className="text-sm text-slate-500">{template.subject}</p>
          </div>
        ))}
      </Card>
      <Card className="space-y-3">
        <h2 className="text-2xl font-bold">Sessions de formation</h2>
        {trainings.map((training) => (
          <div key={training.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">{training.location}</p>
            <p className="text-sm text-slate-500">
              {new Date(training.startDate).toLocaleDateString("fr-FR")} - {new Date(training.endDate).toLocaleDateString("fr-FR")}
            </p>
          </div>
        ))}
      </Card>
    </div>
  );
}
