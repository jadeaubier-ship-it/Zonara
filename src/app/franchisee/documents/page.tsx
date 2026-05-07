import { Card } from "@/components/ui/card";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

export default async function FranchiseeDocumentsPage() {
  const session = await requireRole(["FRANCHISEE"]);
  const franchisee = await prisma.franchisee.findFirstOrThrow({
    where: { userId: session.user.id }
  });
  const documents = await prisma.document.findMany({
    where: { franchiseeId: franchisee.id },
    orderBy: { uploadedAt: "desc" }
  });

  return (
    <Card className="space-y-4">
      <h2 className="text-2xl font-bold">Manuels et procédures internes</h2>
      {documents.length ? (
        documents.map((document) => (
          <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
            <p className="font-semibold">{document.fileName}</p>
            <p className="text-sm text-slate-500">{document.type}</p>
          </div>
        ))
      ) : (
        <p className="text-sm text-slate-500">Aucun document interne n'est encore disponible pour votre point de vente.</p>
      )}
    </Card>
  );
}
