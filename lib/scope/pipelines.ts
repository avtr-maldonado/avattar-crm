import type { Session } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";

/**
 * Pipelines y etapas.
 *
 * Son **configuración**, no datos de negocio: no llevan alcance por propietario
 * y no están en la lista de INV-01. Pero se leen desde aquí igual, porque
 * `app/**` no puede importar `lib/db` y porque el pipeline sí se acota por
 * país: un gerente de México no tiene por qué ver el tablero de Colombia.
 *
 * El kanban necesita **todas** las etapas del pipeline, incluidas las vacías.
 * Una columna que desaparece cuando no tiene tarjetas rompe el mapa mental del
 * proceso: el vendedor deja de ver que Propuesta existe.
 */
export async function listPipelines(session: Session) {
  const dePais =
    session.role === "DIRECCION" || session.role === "ADMINISTRADOR"
      ? {}
      : { countryCode: { in: session.countryCodes } };

  return prisma.pipeline.findMany({
    where: { active: true, ...dePais },
    select: {
      id: true,
      name: true,
      countryCode: true,
      isRenewal: true,
      stages: {
        select: {
          id: true,
          name: true,
          position: true,
          probability: true,
          staleAfterDays: true,
          gateMode: true,
          gateRequires: true,
          isClosing: true,
        },
        orderBy: { position: "asc" },
      },
    },
    orderBy: [{ isRenewal: "asc" }, { name: "asc" }],
  });
}

export type PipelineConEtapas = Awaited<ReturnType<typeof listPipelines>>[number];
export type EtapaDePipeline = PipelineConEtapas["stages"][number];

/**
 * El pipeline que la pantalla debe mostrar por omisión.
 *
 * El de ventas del primer país del usuario, no el de renovaciones: es donde
 * está el trabajo diario.
 */
export function pipelinePorOmision(
  pipelines: PipelineConEtapas[],
  session: Session,
): PipelineConEtapas | undefined {
  const delUsuario = new Set<string>(session.countryCodes);
  const delPais = pipelines.filter((p) => !p.isRenewal && delUsuario.has(p.countryCode));
  return delPais[0] ?? pipelines.find((p) => !p.isRenewal) ?? pipelines[0];
}
