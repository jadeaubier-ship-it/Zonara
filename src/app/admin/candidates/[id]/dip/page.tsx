import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { DipPreparationPanel } from "@/components/admin/dip-preparation-panel";
import { getDipTemplateDocuments, getDipTemplateSettings } from "@/lib/services/dip-template";

export default async function CandidateDipPreparationPage({
  params
}: {
  params: { id: string };
}) {
  await requireRole(["ADMIN", "DEV"]);

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      user: true,
      documents: {
        where: {
          type: { in: ["elm"] }
        },
        orderBy: { uploadedAt: "desc" }
      },
      eventLogs: {
        where: {
          actionType: { in: ["DIP_PREPARATION_UPDATED", "DIP_PREPARATION_FROZEN"] }
        },
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!candidate) {
    notFound();
  }

  const [templateSettings, templateDocuments] = await Promise.all([
    getDipTemplateSettings(),
    getDipTemplateDocuments()
  ]);

  const frozenLog = candidate.eventLogs.find((log) => log.actionType === "DIP_PREPARATION_FROZEN");
  const latestDraft = candidate.eventLogs.find((log) => log.actionType === "DIP_PREPARATION_UPDATED");
  const draftData =
    ((frozenLog?.detailsJson as Record<string, unknown> | undefined) ??
      (latestDraft?.detailsJson as Record<string, unknown> | undefined) ??
      {}) as {
      version?: string;
    };

  return (
    <div className="space-y-6 pt-10">
      <DipPreparationPanel
        candidateId={candidate.id}
        candidateName={`${candidate.user.firstname} ${candidate.user.lastname}`.trim()}
        projectZone={candidate.projectZone || candidate.city || ""}
        frozenAt={frozenLog?.createdAt.toISOString() ?? null}
        sentEnvelopeId={null}
        version={String(draftData.version ?? templateSettings.version)}
        docusignTemplateId={templateSettings.docusignTemplateId}
        docusignTemplateRoleName={templateSettings.docusignTemplateRoleName}
        mainDipDocument={
          templateDocuments.mainDocument
            ? {
                id: templateDocuments.mainDocument.id,
                fileName: templateDocuments.mainDocument.fileName,
                fileUrl: templateDocuments.mainDocument.fileUrl,
                mimeType: templateDocuments.mainDocument.mimeType,
                uploadedAt: templateDocuments.mainDocument.uploadedAt.toISOString()
              }
            : null
        }
        templateAnnexes={templateDocuments.annexes.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          fileUrl: document.fileUrl,
          mimeType: document.mimeType,
          uploadedAt: document.uploadedAt.toISOString()
        }))}
        elmFiles={candidate.documents
          .filter((document) => document.type === "elm")
          .map((document) => ({
            id: document.id,
            fileName: document.fileName,
            fileUrl: document.fileUrl,
            mimeType: document.mimeType,
            uploadedAt: document.uploadedAt.toISOString()
          }))}
      />
    </div>
  );
}
