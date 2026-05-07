import Docusign from "@docusign/esign";

export async function createEnvelope(params: {
  candidateEmail: string;
  candidateName: string;
  stepNumber: number;
  documentBase64: string;
  fileName: string;
}) {
  if (!process.env.DOCUSIGN_INTEGRATION_KEY) {
    return {
      envelopeId: `mock-envelope-step-${params.stepNumber}`,
      status: "SENT"
    };
  }

  const apiClient = new Docusign.ApiClient();
  apiClient.setBasePath(process.env.DOCUSIGN_BASE_PATH!);

  return {
    envelopeId: `todo-real-${params.stepNumber}`,
    status: "SENT"
  };
}
