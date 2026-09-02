import type { Prisma } from "@prisma/client";
import type { Session } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

/**
 * El alcance de organizaciones · §5.3.
 *
 * Un Vendedor ve una cuenta si es su propietario **o** si tiene al menos una
 * oportunidad propia en ella. Solo lo primero dejaría a un vendedor con una
 * oportunidad en cuenta ajena sin poder abrir la ficha de esa cuenta.
 *
 * Consecuencia que §5.3 subraya: los indicadores de la ficha —pipeline abierto,
 * ganado 12 meses— se calculan solo sobre las oportunidades que ese usuario
 * puede ver. Si se calcularan sobre el total de la cuenta, un vendedor
 * deduciría el pipeline de su compañero restando.
 */
export function organizationScope(session: Session): Prisma.OrganizationWhereInput {
  const base: Prisma.OrganizationWhereInput = { deletedAt: null };

  switch (session.role) {
    case "VENDEDOR":
    case "PREVENTA":
      return {
        ...base,
        OR: [
          { ownerId: session.userId },
          { opportunities: { some: { ownerId: session.userId, deletedAt: null } } },
        ],
      };
    case "GERENTE_PAIS":
      return { ...base, countryCode: { in: session.countryCodes } };
    case "DIRECCION":
    case "ADMINISTRADOR":
      return base;
  }
}

export function withOrganizationScope(
  session: Session,
  where?: Prisma.OrganizationWhereInput,
): Prisma.OrganizationWhereInput {
  return where ? { AND: [organizationScope(session), where] } : organizationScope(session);
}

export async function listOrganizations(
  session: Session,
  options: { where?: Prisma.OrganizationWhereInput; take?: number; skip?: number } = {},
) {
  return prisma.organization.findMany({
    where: withOrganizationScope(session, options.where),
    select: {
      id: true,
      name: true,
      type: true,
      industry: true,
      city: true,
      countryCode: true,
      isStrategic: true,
      owner: { select: { id: true, name: true, initials: true } },
    },
    orderBy: { name: "asc" },
    take: options.take,
    skip: options.skip,
  });
}

export async function getOrganization(session: Session, id: string) {
  return prisma.organization.findFirst({
    where: { AND: [organizationScope(session), { id }] },
    select: {
      id: true,
      name: true,
      legalName: true,
      taxId: true,
      type: true,
      industry: true,
      city: true,
      countryCode: true,
      employees: true,
      creditDays: true,
      isStrategic: true,
      owner: { select: { id: true, name: true, initials: true } },
      people: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          initials: true,
          jobTitle: true,
          email: true,
          phone: true,
          committeeRole: { select: { id: true, name: true } },
        },
        orderBy: { name: "asc" },
      },
    },
  });
}
