import { Badge } from "@/components/ui/badge";
import { CandidatePhotoCard } from "@/components/admin/candidate-photo-card";
import { CandidateSummaryCard } from "@/components/admin/candidate-summary-card";
import { Card } from "@/components/ui/card";
import { CandidateMiniMap } from "@/components/maps/candidate-mini-map";
import { STEP_LABELS } from "@/lib/utils/constants";

export function CandidateFile({ candidate, archived = false }: { candidate: any; archived?: boolean }) {
  const cardClassName = archived ? "border-rose-200 bg-white/90" : undefined;
  const profilePhoto = candidate.documents.find((document: any) => document.type === "photo_profil");
  const topSections = (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
      <Card className={`p-5 ${cardClassName ?? ""}`}>
        <div className="space-y-4">
          <p className="text-base font-bold text-slate-950">Étapes du parcours de candidature</p>
          <div className="relative">
            <div className="absolute left-4 top-2.5 h-[calc(100%-1.1rem)] w-px bg-slate-300" />
            <div className="space-y-5">
              {candidate.steps.map((step: any) => {
                const isCurrent = step.stepNumber === candidate.currentStep;
                const isPast = step.stepNumber < candidate.currentStep || step.status === "COMPLETED";
                const isFuture = step.stepNumber > candidate.currentStep && !["COMPLETED", "REJECTED"].includes(step.status);

                const circleClassName = isCurrent
                  ? archived
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-[#007cbd] bg-[#007cbd] text-white"
                  : isPast
                    ? archived
                      ? "border-rose-300 bg-rose-100 text-rose-700"
                      : "border-[#b6deef] bg-[#e8f5fb] text-[#007cbd]"
                    : "border-slate-300 bg-slate-100 text-slate-400";
                const circleSizeClassName = isCurrent
                  ? "h-8 w-8 text-xs transition-transform duration-200 group-hover:scale-110"
                  : "h-6 w-6 text-[10px] transition-transform duration-200 group-hover:scale-125";

                return (
                  <div key={step.id} className="group relative flex gap-4">
                    <div className="relative w-8 shrink-0">
                      <div
                        className={`absolute left-4 top-0 flex -translate-x-1/2 items-center justify-center rounded-full border-2 font-bold ${circleSizeClassName} ${circleClassName}`}
                      >
                        {step.stepNumber}
                      </div>
                    </div>
                    <div className={isFuture ? "min-w-0 flex-1 opacity-60" : "min-w-0 flex-1"}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-tight text-slate-950">
                            {STEP_LABELS[step.stepNumber - 1] ?? `Étape ${step.stepNumber}`}
                          </p>
                          {step.validationComment ? <p className="mt-0.5 text-[11px] leading-tight text-slate-500">{step.validationComment}</p> : null}
                        </div>
                        {step.status === "LOCKED" ? (
                          <span className="shrink-0 text-base leading-none text-slate-400" aria-label="Verrouillé" title="Verrouillé">
                            🔒
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <CandidatePhotoCard
            candidateId={candidate.id}
            profilePhotoUrl={profilePhoto?.fileUrl}
            candidateName={`${candidate.user.firstname} ${candidate.user.lastname}`}
            archived={archived}
          />
          <Card className={`overflow-hidden p-0 ${cardClassName ?? ""}`}>
            <CandidateMiniMap
              latitude={candidate.latitude}
              longitude={candidate.longitude}
              cityLabel={`${candidate.city}${candidate.zipcode ? ` (${candidate.zipcode})` : ""}`}
            />
          </Card>
        </div>
        <CandidateSummaryCard candidate={candidate} archived={archived} />
      </div>
    </div>
  );
  const tabs = [
    {
      title: "Documents",
      content: (
        <div className="space-y-3">
          {candidate.documents.map((document: any) => (
            <Card key={document.id} className={`flex items-center justify-between ${cardClassName ?? ""}`}>
              <div>
                <p className="font-semibold">{document.fileName}</p>
                <p className="text-sm text-slate-500">
                  Étape {document.stepNumber ?? "-"} · {document.type}
                </p>
              </div>
              <a href={document.fileUrl} target="_blank">
                Ouvrir
              </a>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: "Projets locaux",
      content: (
        <div className="space-y-3">
          {candidate.localProjects.map((project: any) => (
            <Card key={project.id} className={cardClassName}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{project.address}</p>
                  <p className="text-sm text-slate-500">
                    {project.city} · {project.surfaceM2} m²
                  </p>
                </div>
                <Badge>{project.status}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: "Notes internes",
      content: (
        <div className="space-y-3">
          {candidate.notes.map((note: any) => (
            <Card key={note.id} className={cardClassName}>
              <p className="font-semibold">
                {note.author.firstname} {note.author.lastname}
              </p>
              <p className="mt-2 text-sm text-slate-600">{note.noteText}</p>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: "Rappels",
      content: (
        <div className="space-y-3">
          {candidate.reminders.map((reminder: any) => (
            <Card key={reminder.id} className={cardClassName}>
              <p className="font-semibold">{reminder.reminderTitle}</p>
              <p className="text-sm text-slate-500">{reminder.reminderText}</p>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: "Historique",
      content: (
        <div className="space-y-3">
          {candidate.eventLogs.map((log: any) => (
            <Card key={log.id} className={cardClassName}>
              <p className="font-semibold">{log.actionType}</p>
              <p className="text-sm text-slate-500">{new Date(log.createdAt).toLocaleString("fr-FR")}</p>
            </Card>
          ))}
        </div>
      )
    },
    {
      title: "Emails",
      content: (
        <div className="space-y-3">
          {candidate.emailLogs.map((email: any) => (
            <Card key={email.id} className={cardClassName}>
              <p className="font-semibold">{email.subject}</p>
              <p className="text-sm text-slate-500">
                {email.to} · {new Date(email.sentAt).toLocaleString("fr-FR")}
              </p>
            </Card>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-8">
      {topSections}
      {tabs.map((tab) => (
        <section key={tab.title} className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-950">{tab.title}</h2>
          {tab.content}
        </section>
      ))}
    </div>
  );
}
