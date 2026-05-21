// @ts-nocheck
import "dotenv/config";
import ApiClient from "docusign-esign/src/ApiClient";
import EnvelopesApi from "docusign-esign/src/api/EnvelopesApi";
import { prisma } from "../src/lib/db/prisma";
import { syncCandidateDipEnvelopeState } from "../src/lib/services/docusign-sync";

const candidateId = "cmovlmt1t0004f1rm0li6lk2z";

async function main() {
  await syncCandidateDipEnvelopeState(candidateId);

  const candidate = await prisma.candidate.findUniqueOrThrow({
    where: { id: candidateId },
    include: {
      user: true,
      docusignEnvelopes: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  const envelope = candidate.docusignEnvelopes[0];
  if (!envelope) {
    throw new Error("Aucune enveloppe DocuSign trouvée pour ce candidat.");
  }

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

  const [summary, documents, recipients] = await Promise.all([
    envelopesApi.getEnvelope(process.env.DOCUSIGN_ACCOUNT_ID!, envelope.envelopeId, {}),
    envelopesApi.listDocuments(process.env.DOCUSIGN_ACCOUNT_ID!, envelope.envelopeId, {
      includeDocumentSize: "true"
    }),
    envelopesApi.listRecipients(process.env.DOCUSIGN_ACCOUNT_ID!, envelope.envelopeId, {})
  ]);

  console.log(
    JSON.stringify(
      {
        candidate: {
          id: candidate.id,
          email: candidate.user.email,
          name: `${candidate.user.firstname} ${candidate.user.lastname}`.trim()
        },
        envelopeDb: envelope,
        summary,
        documents: documents.envelopeDocuments,
        recipients
      },
      null,
      2
    )
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await prisma.$disconnect();
  } catch {}
  process.exit(1);
});
