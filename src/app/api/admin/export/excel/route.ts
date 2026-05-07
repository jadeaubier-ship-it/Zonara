import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { getCandidateList } from "@/lib/services/candidate";
import { buildCandidateExcelRows } from "@/lib/utils/export";

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const candidates = await getCandidateList({});
  const rows = buildCandidateExcelRows(candidates);

  return NextResponse.json(rows);
}
