export function buildCandidatePdfPayload(candidate: any) {
  return {
    title: `Dossier candidat ${candidate.user.firstname} ${candidate.user.lastname}`,
    sections: [
      { label: "Résumé", value: `${candidate.city} - étape ${candidate.currentStep}/10` },
      { label: "Documents", value: String(candidate.documents.length) },
      { label: "Historique", value: String(candidate.eventLogs.length) }
    ]
  };
}

export function buildCandidateExcelRows(candidates: any[]) {
  return candidates.map((candidate) => ({
    prenom: candidate.user.firstname,
    nom: candidate.user.lastname,
    email: candidate.user.email,
    ville: candidate.city,
    etape: candidate.currentStep,
    statut: candidate.statusGlobal,
    score: candidate.scoreHeat,
    derniere_activite: candidate.lastActivityAt
  }));
}
