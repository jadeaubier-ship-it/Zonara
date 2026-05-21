import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json(
      {
        error: "Le consentement DocuSign a été refusé ou a échoué.",
        docusignError: error
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message:
      "Le consentement DocuSign semble avoir été accordé. Vous pouvez revenir dans Zonara pour poursuivre la configuration."
  });
}
