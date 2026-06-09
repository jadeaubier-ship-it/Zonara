type DocusignRuntime = {
  ApiClient: new () => {
    setBasePath: (value: string) => void;
    requestJWTUserToken: (
      integrationKey: string,
      userId: string,
      scopes: string[],
      privateKey: string,
      expiresIn: number
    ) => Promise<{ body?: { access_token?: string } }>;
    addDefaultHeader: (key: string, value: string) => void;
  };
  EnvelopesApi: new (apiClient: unknown) => {
    createEnvelope: (
      accountId: string,
      payload: { envelopeDefinition: Record<string, unknown> }
    ) => Promise<{ envelopeId?: string; status?: string }>;
    getEnvelope: (
      accountId: string,
      envelopeId: string,
      options?: Record<string, unknown>
    ) => Promise<{ envelopeId?: string; status?: string; completedDateTime?: string; statusChangedDateTime?: string }>;
    updateDocuments: (
      accountId: string,
      envelopeId: string,
      payload: { envelopeDefinition: Record<string, unknown> }
    ) => Promise<{ envelopeDocuments?: Array<{ documentId?: string; name?: string; type?: string }> }>;
    listDocuments: (
      accountId: string,
      envelopeId: string,
      options?: Record<string, unknown>
    ) => Promise<{ envelopeDocuments?: Array<{ documentId?: string; name?: string; type?: string }> }>;
    getDocument: (
      accountId: string,
      envelopeId: string,
      documentId: string,
      options?: Record<string, unknown>
    ) => Promise<unknown>;
    update: (
      accountId: string,
      envelopeId: string,
      payload: { envelope?: Record<string, unknown>; resendEnvelope?: string; advancedUpdate?: string },
      options?: { resendEnvelope?: string }
    ) => Promise<{ envelopeId?: string; status?: string }>;
  };
};

function inspectDocusignError(error: unknown) {
  try {
    const candidate = error as Record<string, unknown> | undefined;
    return JSON.stringify(
      {
        name: candidate?.name,
        message: candidate?.message,
        body: candidate?.body,
        response: candidate?.response,
        status: candidate?.status,
        statusCode: candidate?.statusCode,
        errorCode: (candidate?.body as Record<string, unknown> | undefined)?.errorCode,
        errorMessage: (candidate?.body as Record<string, unknown> | undefined)?.message,
        keys: candidate ? Object.getOwnPropertyNames(candidate) : []
      },
      null,
      2
    );
  } catch {
    return String(error);
  }
}

type DocusignErrorShape = Error & {
  response?: {
    body?: {
      errorCode?: string;
      message?: string;
    };
    text?: string;
  };
  body?: {
    errorCode?: string;
    message?: string;
  };
};

function loadDocusignRuntime(): DocusignRuntime {
  const runtimeRequire = eval("require") as NodeRequire;

  return {
    ApiClient: runtimeRequire("docusign-esign/src/ApiClient"),
    EnvelopesApi: runtimeRequire("docusign-esign/src/api/EnvelopesApi")
  };
}

const DOCUSIGN_SCOPES = ["signature", "impersonation"];

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variable d'environnement DocuSign manquante : ${name}`);
  }
  return value;
}

function getPrivateKey() {
  const direct = process.env.DOCUSIGN_PRIVATE_KEY?.trim();
  if (direct) {
    return direct.includes("\\n") ? direct.replace(/\\n/g, "\n") : direct;
  }

  throw new Error("Clé privée DocuSign manquante : DOCUSIGN_PRIVATE_KEY");
}

function formatDocusignError(error: unknown, fallback: string) {
  const candidate = error as DocusignErrorShape | undefined;
  const bodyMessage = candidate?.response?.body?.message || candidate?.body?.message;
  const bodyCode = candidate?.response?.body?.errorCode || candidate?.body?.errorCode;

  if (bodyMessage && bodyCode) {
    return `DocuSign : ${bodyCode} - ${bodyMessage}`;
  }

  if (bodyMessage) {
    return `DocuSign : ${bodyMessage}`;
  }

  if (candidate?.response?.text?.trim()) {
    return `DocuSign : ${candidate.response.text.trim()}`;
  }

  if (candidate instanceof Error && candidate.message.trim()) {
    return candidate.message;
  }

  return fallback;
}

function normalizeEnvelopeStatus(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.toUpperCase();
  }

  if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const nestedStatus = candidate.status;
    if (typeof nestedStatus === "string" && nestedStatus.trim()) {
      return nestedStatus.toUpperCase();
    }
  }

  return "SENT";
}

function pdfResponseToBase64(value: unknown) {
  if (Buffer.isBuffer(value)) {
    return value.toString("base64");
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value).toString("base64");
  }

  if (ArrayBuffer.isView(value)) {
    return Buffer.from(value.buffer).toString("base64");
  }

  if (value instanceof ArrayBuffer) {
    return Buffer.from(value).toString("base64");
  }

  if (typeof value === "string") {
    return Buffer.from(value, "binary").toString("base64");
  }

  throw new Error("Réponse PDF DocuSign invalide.");
}

async function getJwtAuthorizedApiClient() {
  const { ApiClient } = loadDocusignRuntime();
  const apiClient = new ApiClient();
  apiClient.setBasePath(getRequiredEnv("DOCUSIGN_BASE_PATH"));

  let tokenResponse: { body?: { access_token?: string } };

  try {
    tokenResponse = await apiClient.requestJWTUserToken(
      getRequiredEnv("DOCUSIGN_INTEGRATION_KEY"),
      getRequiredEnv("DOCUSIGN_USER_ID"),
      DOCUSIGN_SCOPES,
      getPrivateKey(),
      3600
    );
  } catch (error) {
    throw new Error(
      formatDocusignError(error, "DocuSign n'a pas accepté la demande de jeton JWT.")
    );
  }

  const accessToken = tokenResponse?.body?.access_token;
  if (!accessToken) {
    throw new Error("DocuSign n'a pas retourné de jeton JWT.");
  }

  apiClient.addDefaultHeader("Authorization", `Bearer ${accessToken}`);
  return apiClient;
}

export function buildDocusignConsentUrl() {
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY?.trim();
  const userId = process.env.DOCUSIGN_USER_ID?.trim();
  const basePath = process.env.DOCUSIGN_BASE_PATH?.trim();

  if (!integrationKey || !userId || !basePath) {
    return null;
  }

  const oauthHost = basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com";

  return `https://${oauthHost}/oauth/auth?response_type=code&scope=${encodeURIComponent(
    DOCUSIGN_SCOPES.join(" ")
  )}&client_id=${encodeURIComponent(integrationKey)}&redirect_uri=${encodeURIComponent(
    "http://localhost:3000/api/docusign/callback"
  )}`;
}

export async function createEnvelope(params: {
  candidateEmail: string;
  candidateName: string;
  templateId: string;
  templateRoleName: string;
  attachments: Array<{
    documentBase64: string;
    fileName: string;
  }>;
}) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return {
      envelopeId: "mock-envelope-from-template",
      status: "SENT"
    };
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);

  const documents = params.attachments.map((attachment, index) => ({
    documentBase64: attachment.documentBase64,
    name: attachment.fileName,
    fileExtension: "pdf",
    documentId: String(index + 2)
  }));

  let summary: { envelopeId?: string; status?: string };

  try {
    summary = await envelopesApi.createEnvelope(getRequiredEnv("DOCUSIGN_ACCOUNT_ID"), {
      envelopeDefinition: {
        status: "created",
        templateId: params.templateId,
        templateRoles: [
          {
            email: params.candidateEmail,
            name: params.candidateName,
            roleName: params.templateRoleName
          }
        ]
      }
    });

    if (!summary.envelopeId) {
      throw new Error("DocuSign n'a pas retourné d'identifiant d'enveloppe.");
    }

    if (documents.length > 0) {
      await envelopesApi.updateDocuments(getRequiredEnv("DOCUSIGN_ACCOUNT_ID"), summary.envelopeId, {
        envelopeDefinition: {
          documents
        }
      });
    }

    summary = await envelopesApi.update(getRequiredEnv("DOCUSIGN_ACCOUNT_ID"), summary.envelopeId, {
      envelope: {
        status: "sent"
      }
    });
  } catch (error) {
    console.error("[DocuSign] createEnvelope raw error", inspectDocusignError(error));
    throw new Error(formatDocusignError(error, "Impossible de créer l'enveloppe DocuSign."));
  }

  return {
    envelopeId: summary.envelopeId,
    status: normalizeEnvelopeStatus(summary.status)
  };
}

function countPdfPagesFromBase64(documentBase64: string) {
  try {
    const pdfText = Buffer.from(documentBase64, "base64").toString("latin1");
    const matches = pdfText.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches?.length ?? 1);
  } catch {
    return 1;
  }
}

function buildInitialTabs(pageCount: number) {
  return Array.from({ length: pageCount }, (_, index) => ({
    documentId: "1",
    pageNumber: String(index + 1),
    xPosition: "500",
    yPosition: "742"
  }));
}

function buildContractSignatureTabs(pageCount: number) {
  const signPage = String(pageCount);
  return {
    initialHereTabs: buildInitialTabs(pageCount),
    signHereTabs: [
      {
        documentId: "1",
        pageNumber: signPage,
        xPosition: "110",
        yPosition: "685"
      }
    ]
  };
}

export async function createContractEnvelope(params: {
  ceoEmail: string;
  ceoName: string;
  candidateEmail: string;
  candidateName: string;
  ccEmail?: string;
  ccName?: string;
  documentBase64: string;
  fileName: string;
  emailSubject?: string;
  emailBlurb?: string;
}) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return {
      envelopeId: "mock-contract-envelope",
      status: "SENT"
    };
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);
  const pageCount = countPdfPagesFromBase64(params.documentBase64);

  try {
    const summary = await envelopesApi.createEnvelope(getRequiredEnv("DOCUSIGN_ACCOUNT_ID"), {
      envelopeDefinition: {
        status: "sent",
        emailSubject:
          params.emailSubject ||
          `Signature du contrat Atome3D - ${params.candidateName}`.trim(),
        emailBlurb:
          params.emailBlurb ||
          "Merci de parapher chaque page du contrat et de signer à l’emplacement prévu.",
        documents: [
          {
            documentBase64: params.documentBase64,
            name: params.fileName,
            fileExtension: "pdf",
            documentId: "1"
          }
        ],
        recipients: {
          signers: [
            {
              email: params.ceoEmail,
              name: params.ceoName,
              recipientId: "1",
              routingOrder: "1",
              tabs: buildContractSignatureTabs(pageCount)
            },
            {
              email: params.candidateEmail,
              name: params.candidateName,
              recipientId: "2",
              routingOrder: "2",
              tabs: buildContractSignatureTabs(pageCount)
            }
          ],
          carbonCopies: params.ccEmail
            ? [
                {
                  email: params.ccEmail,
                  name: params.ccName || params.ccEmail,
                  recipientId: "3",
                  routingOrder: "3"
                }
              ]
            : []
        }
      }
    });

    if (!summary.envelopeId) {
      throw new Error("DocuSign n'a pas retourné d'identifiant d'enveloppe.");
    }

    return {
      envelopeId: summary.envelopeId,
      status: normalizeEnvelopeStatus(summary.status)
    };
  } catch (error) {
    console.error("[DocuSign] createContractEnvelope raw error", inspectDocusignError(error));
    throw new Error(formatDocusignError(error, "Impossible de créer l'enveloppe contrat DocuSign."));
  }
}

export async function resendEnvelope(params: { envelopeId: string }) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return {
      envelopeId: params.envelopeId,
      status: "SENT"
    };
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);

  let summary: { envelopeId?: string; status?: string };

  try {
    summary = await envelopesApi.update(
      getRequiredEnv("DOCUSIGN_ACCOUNT_ID"),
      params.envelopeId,
      {
        envelope: {
          envelopeId: params.envelopeId
        },
        resendEnvelope: "true"
      }
    );
  } catch (error) {
    throw new Error(formatDocusignError(error, "Impossible de relancer l'enveloppe DocuSign."));
  }

  return {
    envelopeId: summary.envelopeId || params.envelopeId,
    status: normalizeEnvelopeStatus(summary.status)
  };
}

export async function getEnvelopeStatus(params: { envelopeId: string }) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return {
      envelopeId: params.envelopeId,
      status: "COMPLETED",
      completedDateTime: new Date().toISOString(),
      statusChangedDateTime: new Date().toISOString()
    };
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);

  try {
    const envelope = await envelopesApi.getEnvelope(
      getRequiredEnv("DOCUSIGN_ACCOUNT_ID"),
      params.envelopeId,
      {}
    );

    return {
      envelopeId: envelope.envelopeId || params.envelopeId,
      status: normalizeEnvelopeStatus(envelope.status),
      completedDateTime: envelope.completedDateTime || null,
      statusChangedDateTime: envelope.statusChangedDateTime || null
    };
  } catch (error) {
    throw new Error(formatDocusignError(error, "Impossible de récupérer le statut de l'enveloppe DocuSign."));
  }
}

export async function downloadCombinedEnvelopePdf(params: { envelopeId: string }) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    throw new Error("DocuSign n'est pas configuré.");
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);

  try {
    const pdf = await envelopesApi.getDocument(
      getRequiredEnv("DOCUSIGN_ACCOUNT_ID"),
      params.envelopeId,
      "combined",
      {
        certificate: "false",
        watermark: "false"
      }
    );

    return `data:application/pdf;base64,${pdfResponseToBase64(pdf)}`;
  } catch (error) {
    throw new Error(formatDocusignError(error, "Impossible de télécharger le PDF signé DocuSign."));
  }
}

export async function listEnvelopeDocuments(params: { envelopeId: string }) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return [];
  }

  const apiClient = await getJwtAuthorizedApiClient();
  const { EnvelopesApi } = loadDocusignRuntime();
  const envelopesApi = new EnvelopesApi(apiClient);

  try {
    const result = await envelopesApi.listDocuments(
      getRequiredEnv("DOCUSIGN_ACCOUNT_ID"),
      params.envelopeId,
      {
        includeDocumentSize: "true"
      }
    );

    return result.envelopeDocuments ?? [];
  } catch (error) {
    throw new Error(formatDocusignError(error, "Impossible de lister les documents de l'enveloppe DocuSign."));
  }
}
