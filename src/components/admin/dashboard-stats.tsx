"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { STEP_LABELS } from "@/lib/utils/constants";

type ReminderCandidate = {
  id: string;
  firstname: string;
  lastname: string;
  city: string;
  currentStep: number;
  inactivityDays: number;
  deadlineDays: number;
};

export function DashboardStats({
  franchiseesCount,
  activeCandidatesCount,
  archivedCandidatesCount,
  dipInProgressCount,
  contractsPendingSignatureCount,
  reminderCandidates
}: {
  franchiseesCount: number;
  activeCandidatesCount: number;
  archivedCandidatesCount: number;
  dipInProgressCount: number;
  contractsPendingSignatureCount: number;
  reminderCandidates: ReminderCandidate[];
}) {
  const [showReminders, setShowReminders] = useState(false);
  const orderedReminderCandidates = [...reminderCandidates].sort(
    (a, b) => a.currentStep - b.currentStep || (b.inactivityDays - b.deadlineDays) - (a.inactivityDays - a.deadlineDays)
  );

  return (
    <Card className="flex h-[420px] flex-col overflow-hidden p-0">
      <div className="flex h-full min-h-0 flex-col p-2.5">
        <div className="grid gap-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/admin/franchisees" className="rounded-2xl bg-slate-50 p-2.5 transition hover:bg-slate-100">
            <p className="text-xs text-slate-500">Franchisés ouverts</p>
            <p className="mt-1 text-2xl font-black leading-none text-slate-950">{franchiseesCount}</p>
          </Link>
          <Link href="/admin/candidates" className="rounded-2xl bg-slate-50 p-2.5 transition hover:bg-slate-100">
            <p className="text-xs text-slate-500">Candidats en cours</p>
            <p className="mt-1 text-2xl font-black leading-none text-slate-950">{activeCandidatesCount}</p>
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setShowReminders((value) => !value)}
          className="w-full rounded-2xl bg-[#e8f5fb] p-2.5 text-left transition hover:bg-[#d7edf8]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-[#007cbd]">Candidats à rappeler</p>
              <p className="mt-1 text-2xl font-black leading-none text-slate-950">{reminderCandidates.length}</p>
              <p className="mt-1 text-xs text-slate-600">
                Tout candidat ayant dépassé le délai estimé de son étape.
              </p>
            </div>
            {showReminders ? <ChevronUp className="mt-1 h-5 w-5 text-[#007cbd]" /> : <ChevronDown className="mt-1 h-5 w-5 text-[#007cbd]" />}
          </div>
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="rounded-2xl bg-slate-50 p-2.5">
            <p className="text-xs text-slate-500">DIP en cours</p>
            <p className="mt-1 text-2xl font-black leading-none text-slate-950">{dipInProgressCount}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-2.5">
            <p className="text-xs text-slate-500">Contrats en attente de signature</p>
            <p className="mt-1 text-2xl font-black leading-none text-slate-950">{contractsPendingSignatureCount}</p>
          </div>
        </div>
        <div className="mt-auto flex items-end justify-end flex-1 pt-1">
          <Link
            href="/admin/candidates/archived"
            className="w-[48%] rounded-2xl bg-slate-50/70 px-3 py-2 transition hover:bg-slate-100"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-slate-400">Candidats archivés</p>
              <p className="text-base font-semibold leading-none text-slate-500">{archivedCandidatesCount}</p>
            </div>
          </Link>
        </div>
      </div>
      </div>
      {showReminders ? (
        <div className="border-t border-slate-100 p-3">
          <div className="space-y-3">
            {orderedReminderCandidates.length ? (
              orderedReminderCandidates.map((candidate) => (
                <Link
                  key={candidate.id}
                  href={`/admin/candidates/${candidate.id}`}
                  className="block rounded-2xl border border-slate-100 p-3 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {candidate.firstname} {candidate.lastname}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">{candidate.city}</p>
                    </div>
                    <Badge variant="orange">+{candidate.inactivityDays - candidate.deadlineDays} j</Badge>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">
                    {STEP_LABELS[candidate.currentStep - 1] ?? `Étape ${candidate.currentStep}`}
                  </p>
                </Link>
              ))
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
