import { CandidateForm } from "@/components/admin/candidate-form";

export default function AdminNewCandidatePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-slate-950">Créer un candidat</h2>
      <p className="text-sm text-slate-600">
        La création du dossier déclenche automatiquement l'envoi du mail de bienvenue avec token d'onboarding.
      </p>
      <CandidateForm />
    </div>
  );
}
