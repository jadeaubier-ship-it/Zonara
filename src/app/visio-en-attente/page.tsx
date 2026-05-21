export default function VisioPendingPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-2xl items-center justify-center">
        <div className="w-full rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Visio candidat</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-950">Lien de réservation en cours de configuration</h1>
          <p className="mt-4 text-sm leading-relaxed text-slate-600">
            Votre lien Google Agenda n&apos;est pas encore configuré. Notre équipe vous le communiquera très prochainement.
          </p>
        </div>
      </div>
    </main>
  );
}
