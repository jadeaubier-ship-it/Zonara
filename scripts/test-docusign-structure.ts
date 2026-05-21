// @ts-nocheck
import "dotenv/config";
import ApiClient from "docusign-esign/src/ApiClient";
import EnvelopesApi from "docusign-esign/src/api/EnvelopesApi";
import { prisma } from "../src/lib/db/prisma";
import { getDipTemplateDocuments, getDipTemplateSettings } from "../src/lib/services/dip-template";

const candidateId = "cmovlmt1t0004f1rm0li6lk2z";

function extractBase64FromDataUrl(value: string) {
  return value.match(/^data:.*?;base64,(.*)$/)?.[1] ?? "";
}

function buildElmAttachmentName(projectZone: string, index: number) {
  const suffix = projectZone.trim().length ? ` - ${projectZone.trim()}` : "";
  return index === 0
    ? `Annexe 09 - Etat Local de marché${suffix}.pdf`
    : `Annexe 09 - Etat Local de marché${suffix} (${index + 1}).pdf`;
}

function extractAnnexOrder(fileName: string) {
  const match = fileName.match(/annexe\s*0?(\d{1,2})/i) || fileName.match(/\b0?(\d{1,2})\b/);
  return match ? Number(match[1]) : 999;
}

async function main() {
  const [candidate, settings, docs] = await Promise.all([
    prisma.candidate.findUniqueOrThrow({
      where: { id: candidateId },
      include: {
        user: true,
        documents: {
          where: { type: { in: ["elm"] } },
          orderBy: { uploadedAt: "desc" }
        }
      }
    }),
    getDipTemplateSettings(),
    getDipTemplateDocuments()
  ]);

  const apiClient = new ApiClient();
  apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH!);
  const privateKey = (process.env.DOCUSIGN_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  const token = await apiClient.requestJWTUserToken(
    process.env.DOCUSIGN_INTEGRATION_KEY!,
    process.env.DOCUSIGN_USER_ID!,
    ["signature", "impersonation"],
    privateKey,
    3600
  );
  apiClient.addDefaultHeader("Authorization", `Bearer ${token.body?.access_token}`);
  const envelopesApi = new EnvelopesApi(apiClient);

  const attachments = [
    {
      documentBase64: extractBase64FromDataUrl(docs.mainDocument!.fileUrl),
      fileName: docs.mainDocument!.fileName || "dip-principal.pdf",
      order: 0
    },
    ...docs.annexes
      .sort((a, b) => {
        const diff = extractAnnexOrder(a.fileName) - extractAnnexOrder(b.fileName);
        return diff === 0 ? a.fileName.localeCompare(b.fileName, "fr") : diff;
      })
      .map((document) => ({
        documentBase64: extractBase64FromDataUrl(document.fileUrl),
        fileName: document.fileName || "annexe.pdf",
        order: extractAnnexOrder(document.fileName || "")
      })),
    ...candidate.documents.map((document, index) => ({
      documentBase64: extractBase64FromDataUrl(document.fileUrl),
      fileName: buildElmAttachmentName(candidate.projectZone || candidate.city || "", index),
      order: 9
    }))
  ].filter((attachment) => Boolean(attachment.documentBase64));

  const created = await envelopesApi.createEnvelope(process.env.DOCUSIGN_ACCOUNT_ID!, {
    envelopeDefinition: {
      status: "created",
      templateId: settings.docusignTemplateId,
      templateRoles: [
        {
          email: candidate.user.email,
          name: `${candidate.user.firstname} ${candidate.user.lastname}`.trim(),
          roleName: settings.docusignTemplateRoleName
        }
      ]
    }
  });

  const envelopeId = created.envelopeId!;

  const updateResult = await envelopesApi.updateDocuments(process.env.DOCUSIGN_ACCOUNT_ID!, envelopeId, {
    envelopeDefinition: {
      documents: attachments.map((attachment, index) => ({
        documentBase64: attachment.documentBase64,
        name: attachment.fileName,
        fileExtension: "pdf",
        documentId: String(index + 2)
      }))
    }
  });

  const listed = await envelopesApi.listDocuments(process.env.DOCUSIGN_ACCOUNT_ID!, envelopeId, {
    includeDocumentSize: "true"
  });

  console.log(
    JSON.stringify(
      {
        created,
        updateResult,
        documents: listed.envelopeDocuments
      },
      null,
      2
    )
  );

  await envelopesApi.update(process.env.DOCUSIGN_ACCOUNT_ID!, envelopeId, {
    envelope: {
      status: "voided",
      voidedReason: "structure test"
    }
  });

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
