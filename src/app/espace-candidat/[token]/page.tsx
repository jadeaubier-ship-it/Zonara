import Link from "next/link";
import { Card } from "@/components/ui/card";
import { CandidatePortalDocumentsCard } from "@/components/public/candidate-portal-documents-card";
import {
  CANDIDATE_STEP_EXPECTATIONS,
  getCandidatePortalContext
} from "@/lib/services/candidate-portal";
import { STEP_LABELS, getStepTheme } from "@/lib/utils/constants";
import { formatPhoneNumber } from "@/lib/utils/formatters";

function formatAppointmentDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export default async function CandidatePortalHomePage({
  params
}: {
  params: { token: string };
}) {
  const { candidate, documents, applicationData, visibleDocumentStep } = await getCandidatePortalContext(params.token);
  const candidateDisplayPhone = candidate.user.phone || applicationData.phone || "";
  const appointments = candidate.appointments
    .filter((appointment) => appointment.status !== "CANCELLED")
    .sort((left, right) => left.startDatetime.getTime() - right.startDatetime.getTime());
  const now = new Date();
  const upcomingAppointments = appointments.filter((appointment) => new Date(appointment.startDatetime) >= now);
  const pastAppointments = appointments.filter((appointment) => new Date(appointment.startDatetime) < now);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <Link
            href={`/espace-candidat/${params.token}/parametres#profil`}
            className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition hover:border-slate-300"
          >
            {candidate.documents.find((document) => document.type === "photo_profil")?.fileUrl ? (
              <img
                src={candidate.documents.find((document) => document.type === "photo_profil")?.fileUrl}
                alt={`${candidate.user.firstname} ${candidate.user.lastname}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-[10px] text-slate-400">Photo</span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link
              href={`/espace-candidat/${params.token}/parametres#profil`}
              className="block text-2xl font-bold text-slate-950 transition hover:text-[#007cbd]"
            >
              {candidate.user.firstname} {candidate.user.lastname}
            </Link>
            <div className="mt-2 space-y-0.5 text-[12px] text-slate-500">
              <Link
                href={`/espace-candidat/${params.token}/parametres#profil`}
                className="block transition hover:text-[#007cbd]"
              >
                {candidate.user.email}
              </Link>
              <Link
                href={`/espace-candidat/${params.token}/parametres#profil`}
                className="block transition hover:text-[#007cbd]"
              >
                {candidateDisplayPhone ? formatPhoneNumber(candidateDisplayPhone) : "Téléphone non renseigné"}
              </Link>
              <p>
                {candidate.projectZone?.trim() || candidate.city}
                {candidate.zipcode ? ` (${candidate.zipcode})` : ""}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="space-y-3 p-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Mon parcours</h2>
          </div>

          <div className="space-y-1.5">
            {STEP_LABELS.map((label, index) => {
              const stepNumber = index + 1;
              const isCurrent = stepNumber === candidate.currentStep;
              const isDone = stepNumber < candidate.currentStep;
              const theme = getStepTheme(stepNumber);

              return (
                <div key={stepNumber} className="group relative">
                  <div
                    className={`rounded-2xl border px-3.5 py-2 text-[12px] transition ${
                      isCurrent
                        ? `${theme.soft} font-semibold`
                        : isDone
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                    }`}
                  >
                    {stepNumber}. {label}
                  </div>

                  <div className="pointer-events-none absolute left-3 top-[calc(100%+6px)] z-20 hidden w-[290px] rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl group-hover:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#007cbd]">
                      Étape {stepNumber}
                    </p>
                    <p className="mt-1 text-[12px] font-semibold text-slate-950">{label}</p>
                    <ul className="mt-2 space-y-1.5 text-[12px] leading-4.5 text-slate-600">
                      {CANDIDATE_STEP_EXPECTATIONS[index].map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-slate-400" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <CandidatePortalDocumentsCard
          token={params.token}
          currentStep={candidate.currentStep}
          visibleDocumentStep={visibleDocumentStep}
          initialDocuments={documents}
        />

        <Card className="space-y-3 p-5">
          <h2 className="text-[16px] font-bold text-slate-950">Mes rendez-vous</h2>
          {appointments.length ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  À venir
                </p>
                {upcomingAppointments.length ? (
                  upcomingAppointments.map((appointment) => (
                    <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2">
                      <p className="text-[12px] font-semibold text-slate-950">
                        {appointment.appointmentType === "DISCOVERY_DAY" ? "Journée découverte" : "Visio"}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-4.5 text-slate-600">
                        {formatAppointmentDate(new Date(appointment.startDatetime))}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-400">Aucun rendez-vous à venir.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Passés
                </p>
                {pastAppointments.length ? (
                  pastAppointments.map((appointment) => (
                    <div
                      key={appointment.id}
                      className="rounded-2xl border border-slate-200 bg-slate-50/70 px-3.5 py-2 opacity-60"
                    >
                      <p className="text-[12px] font-semibold text-slate-700">
                        {appointment.appointmentType === "DISCOVERY_DAY" ? "Journée découverte" : "Visio"}
                      </p>
                      <p className="mt-0.5 text-[12px] leading-4.5 text-slate-500">
                        {formatAppointmentDate(new Date(appointment.startDatetime))}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-[12px] text-slate-400">Aucun rendez-vous passé.</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-slate-500">Aucun rendez-vous enregistré pour le moment.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
