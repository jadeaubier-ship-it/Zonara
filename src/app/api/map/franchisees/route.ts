import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const franchisees = await prisma.franchisee.findMany({
    select: {
      id: true,
      city: true,
      latitude: true,
      longitude: true
    }
  });

  return NextResponse.json(franchisees);
}
