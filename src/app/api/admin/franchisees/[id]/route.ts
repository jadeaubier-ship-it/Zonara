import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json()) as {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
  };

  const franchisee = await prisma.franchisee.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!franchisee) {
    return NextResponse.json({ error: "Franchisé introuvable." }, { status: 404 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: franchisee.userId },
      data: {
        firstname: body.firstname?.trim() || franchisee.user.firstname,
        lastname: body.lastname?.trim() || franchisee.user.lastname,
        email: body.email?.trim() || franchisee.user.email,
        phone: body.phone?.trim() || null
      }
    });

    return tx.franchisee.update({
      where: { id: params.id },
      data: {
        address: body.address?.trim() || null,
        city: body.city?.trim() || franchisee.city
      },
      include: { user: true, kpis: true }
    });
  });

  return NextResponse.json(updated);
}
