import type { BusinessType, CountryCode, ForecastCategory } from "@prisma/client";
import { falla, ok, type ResultadoAccion } from "@/lib/acciones";
import { can, type Session } from "@/lib/auth/permissions";
import { prisma } from "@/lib/db";
import { iniciales } from "@/lib/etiquetas";
import { evaluateGate, type GateContext, type GateFailure, type GateResult } from "./stageGate";
import { nextFolio } from "./folio";

export type DecisionDeTransicion = {
  avanza: boolean;
  gateOverride: boolean;
  faltantes: GateFailure[];
};

/**
 * Decide si una transición procede. Pura: sin base, sin sesión, sin umbrales.
 *
 * `BLOQUEANTE` no se salta. `ADVERTENCIA` se salta solo con confirmación
 * explícita, y entonces queda sellada en `StageTransition.gateOverride`, que es
 * lo que alimenta el reporte semanal de incumplimiento de §8.3.
 */
export function decidirTransicion(input: {
  gateMode: "ADVERTENCIA" | "BLOQUEANTE";
  resultado: GateResult;
  omitirCompuerta: boolean;
}): DecisionDeTransicion {
  if (input.resultado.ok) {
    // No hubo nada que omitir: marcar el override aquí ensuciaría el reporte de
    // §8.3 con incumplimientos que nunca ocurrieron.
    return { avanza: true, gateOverride: false, faltantes: [] };
  }

  if (input.gateMode === "BLOQUEANTE" || !input.omitirCompuerta) {
    return { avanza: false, gateOverride: false, faltantes: input.resultado.missing };
  }

  return { avanza: true, gateOverride: true, faltantes: input.resultado.missing };
}

/**
 * La etapa de entrada de un pipeline: la de `position` menor.
 *
 * INV-13 · no se busca por nombre. «Calificación» es el nombre en México y no
 * tiene por qué serlo en el pipeline de renovaciones.
 */
export function etapaInicial<T extends { id: string; position: number }>(
  stages: readonly T[],
): T {
  const primera = [...stages].sort((a, b) => a.position - b.position)[0];
  if (!primera) throw new Error("El pipeline está sin etapas: revisa la configuración.");
  return primera;
}

/**
 * El contexto de compuerta de una oportunidad **que todavía no existe**.
 *
 * No es un atajo: una oportunidad recién nacida genuinamente no tiene
 * documentos, ni cotización congelada, ni hitos, ni evaluaciones MEDDIC. Lo
 * único que puede traer de entrada es una persona con rol en el comité, porque
 * eso se captura en el mismo formulario.
 *
 * La consecuencia es honesta y visible: crear directamente en Propuesta o más
 * allá va a fallar la compuerta, y el vendedor verá exactamente qué le falta.
 */
export function contextoDeCompuertaNueva(input: {
  tienePersonaConRol: boolean;
  meddicMinToClosing: number;
}): GateContext {
  return {
    tienePersonaConRol: input.tienePersonaConRol,
    tienePropuestaCargada: false,
    tieneContratoOrdenCompra: false,
    tieneCotizacionCongelada: false,
    cantidadHitos: 0,
    diferenciaHitos: null,
    meddicScore: 0,
    meddicDecisorConfirmado: false,
    autorizacionesPendientes: 0,
    meddicMinToClosing: input.meddicMinToClosing,
  };
}

/**
 * A quién se le puede reasignar —o asignar al crear— una oportunidad de este
 * país · `Q-14`.
 *
 * Solo usuarios activos que operan en él. Sin esta condición **AC-05 se rompe
 * por la puerta de atrás**: darle a un vendedor de Colombia una oportunidad de
 * México le daría acceso a ella; el alcance por país se habría aplicado
 * correctamente en cada consulta y el dato habría cruzado igual. La fuga no
 * está en el filtro, está en la escritura.
 */
export async function destinatariosValidos(countryCode: CountryCode) {
  return prisma.user.findMany({
    where: { active: true, deletedAt: null, countryCodes: { has: countryCode } },
    select: { id: true, name: true, initials: true },
    orderBy: { name: "asc" },
  });
}

export type OrganizacionNueva = {
  name: string;
  type: "CLIENTE" | "PROSPECTO" | "PARTNER" | "FABRICANTE" | "PROVEEDOR";
  city?: string;
  industry?: string;
};

export type PersonaNueva = {
  name: string;
  jobTitle?: string;
  email?: string;
  committeeRoleId?: string;
};

export type EntradaDeAlta = {
  /** Una de las dos: la organización existente, o los datos de la nueva. */
  organizationId?: string;
  organizacionNueva?: OrganizacionNueva;
  /** Igual para la persona principal, que además es opcional del todo. */
  primaryPersonId?: string;
  personaNueva?: PersonaNueva;

  name: string;
  pipelineId: string;
  /** Si no viene, la de posición menor. Se evalúa su compuerta igual (RN-02). */
  stageId?: string;
  omitirCompuerta?: boolean;
  estimatedAmount: string;
  expectedCloseDate: Date;
  businessType: BusinessType;
  forecastCategory?: ForecastCategory;
  sourceId?: string;
  ownerId?: string;
};

/**
 * Da de alta una oportunidad. `INV-12` y `RN-20`.
 *
 * ## Todo en una transacción, incluidas la organización y la persona
 *
 * «La organización y la persona se pueden crear aquí mismo sin perder lo
 * capturado.» Si se crearan por separado y la oportunidad fallara después, cada
 * cancelación a media captura dejaría una empresa huérfana en el catálogo. Esa
 * es la basura que nadie limpia nunca. Aquí, o se crean las tres o no se crea
 * ninguna.
 *
 * El folio se reserva con `nextFolio`, que hace un `INSERT … ON CONFLICT DO
 * UPDATE … RETURNING` atómico dentro de esa misma transacción. **Nunca
 * `count() + 1`**: ese era el defecto del esquema archivado, que además no
 * reiniciaba en enero.
 */
export async function crearOportunidad(
  session: Session,
  input: EntradaDeAlta,
  umbrales: { meddicMinToClosing: number },
): Promise<ResultadoAccion<{ id: string; folio: string; gateOverride: boolean }>> {
  if (!input.organizationId === !input.organizacionNueva) {
    return falla("VALIDACION", {
      campo: "organizationId",
      mensaje: "Elige una organización de la lista o escribe el nombre de una nueva.",
    });
  }

  // ── El país: sale de la organización, nunca del formulario ────────────────
  // Que un vendedor pudiera elegirlo sería darle una llave a otro país por la
  // puerta de atrás (AC-05).
  let countryCode: CountryCode;
  let organizationId: string | null = null;
  let nombreDeOrganizacion: string;

  if (input.organizationId) {
    const existente = await prisma.organization.findFirst({
      where: { id: input.organizationId, deletedAt: null },
      select: { id: true, name: true, countryCode: true },
    });
    if (!existente) {
      return falla("VALIDACION", { campo: "organizationId", mensaje: "Esa organización no existe." });
    }
    organizationId = existente.id;
    countryCode = existente.countryCode;
    nombreDeOrganizacion = existente.name;
  } else {
    // Una organización nueva nace en el país de quien la da de alta. Un usuario
    // con más de un país tendría que elegir, y por eso se toma el del pipeline
    // más abajo cuando hay ambigüedad.
    countryCode = session.countryCodes[0];
    nombreDeOrganizacion = input.organizacionNueva!.name;
  }

  if (!session.countryCodes.includes(countryCode)) {
    return falla("AUTORIZACION", `No operas en ${countryCode}.`);
  }

  // ── El pipeline: del mismo país que la organización ───────────────────────
  const pipeline = await prisma.pipeline.findFirst({
    where: { id: input.pipelineId, active: true },
    select: {
      id: true,
      name: true,
      countryCode: true,
      stages: {
        select: { id: true, name: true, position: true, gateRequires: true, gateMode: true },
        orderBy: { position: "asc" },
      },
    },
  });
  if (!pipeline) {
    return falla("VALIDACION", { campo: "pipelineId", mensaje: "Ese pipeline no existe." });
  }

  // Una organización mexicana con el pipeline de Colombia produciría una
  // oportunidad que ninguna pantalla filtra bien y cuyas etapas no son las que
  // su gerente administra.
  if (pipeline.countryCode !== countryCode) {
    return falla("VALIDACION", {
      campo: "pipelineId",
      mensaje: `«${nombreDeOrganizacion}» es de ${countryCode} y «${pipeline.name}» es de ${pipeline.countryCode}.`,
    });
  }

  // ── La etapa y su compuerta · RN-02 ──────────────────────────────────────
  const destino = input.stageId
    ? pipeline.stages.find((e) => e.id === input.stageId)
    : etapaInicial(pipeline.stages);

  if (!destino) {
    return falla("VALIDACION", {
      campo: "stageId",
      mensaje: "Esa etapa no pertenece al pipeline elegido.",
    });
  }

  // Solo una persona con rol declarado puede satisfacer una compuerta al nacer.
  const rolDeclarado = input.personaNueva
    ? Boolean(input.personaNueva.committeeRoleId)
    : input.primaryPersonId
      ? await prisma.person
          .findFirst({
            where: { id: input.primaryPersonId, deletedAt: null },
            select: { committeeRoleId: true },
          })
          .then((p) => Boolean(p?.committeeRoleId))
      : false;

  const decision = decidirTransicion({
    gateMode: destino.gateMode,
    resultado: evaluateGate(
      destino.gateRequires as Parameters<typeof evaluateGate>[0],
      contextoDeCompuertaNueva({
        tienePersonaConRol: rolDeclarado,
        meddicMinToClosing: umbrales.meddicMinToClosing,
      }),
    ),
    omitirCompuerta: input.omitirCompuerta ?? false,
  });

  if (!decision.avanza) {
    return falla(
      "COMPUERTA",
      ...decision.faltantes.map((f) => ({ mensaje: `«${destino.name}» — ${f.message}` })),
    );
  }

  // ── El propietario · Q-13 aplicado al alta ───────────────────────────────
  // Si un vendedor pudiera dar de alta a nombre de otro, tendría reasignación
  // disfrazada de creación.
  const ownerId =
    input.ownerId && can(session, "VER_OPORTUNIDADES_OFICINA") ? input.ownerId : session.userId;

  if (ownerId !== session.userId) {
    const validos = await destinatariosValidos(countryCode);
    if (!validos.some((u) => u.id === ownerId)) {
      return falla("VALIDACION", {
        campo: "ownerId",
        mensaje: `Ese usuario no está activo o no opera en ${countryCode}.`,
      });
    }
  }

  const ahora = new Date();

  const creada = await prisma.$transaction(async (tx) => {
    if (!organizationId) {
      const nueva = await tx.organization.create({
        data: {
          name: input.organizacionNueva!.name,
          type: input.organizacionNueva!.type,
          city: input.organizacionNueva!.city || null,
          industry: input.organizacionNueva!.industry || null,
          countryCode,
          // La empresa que un vendedor da de alta es suya: es quien la trabaja.
          ownerId: session.userId,
        },
        select: { id: true },
      });
      organizationId = nueva.id;
    }

    let primaryPersonId = input.primaryPersonId ?? null;
    if (input.personaNueva) {
      const persona = await tx.person.create({
        data: {
          organizationId,
          name: input.personaNueva.name,
          initials: iniciales(input.personaNueva.name),
          jobTitle: input.personaNueva.jobTitle || null,
          email: input.personaNueva.email || null,
          committeeRoleId: input.personaNueva.committeeRoleId || null,
        },
        select: { id: true },
      });
      primaryPersonId = persona.id;
    }

    const folio = await nextFolio(tx, ahora.getFullYear());

    const oportunidad = await tx.opportunity.create({
      data: {
        folio,
        name: input.name,
        organizationId,
        primaryPersonId,
        pipelineId: pipeline.id,
        stageId: destino.id,
        countryCode,
        estimatedAmount: input.estimatedAmount,
        // Mientras no hay cotización, el estimado ES el valor vigente. El
        // comentario del esquema lo dice: `amount` es espejo de la cotización
        // activa, y todavía no hay ninguna.
        amount: input.estimatedAmount,
        // `grossMargin` queda en null a propósito: no hay costo del cual
        // derivarlo, e inventar un margen sería peor que no tenerlo, porque las
        // banderas de riesgo lo leen.
        expectedCloseDate: input.expectedCloseDate,
        businessType: input.businessType,
        forecastCategory: input.forecastCategory ?? "PIPELINE",
        sourceId: input.sourceId || null,
        ownerId,
        createdById: session.userId,
        // RN-03 · el reloj de estancamiento empieza a correr desde el alta.
        stageEnteredAt: ahora,
      },
      select: { id: true, folio: true },
    });

    // Nacer en una etapa avanzada es una transición como cualquier otra, y su
    // `gateOverride` alimenta el mismo reporte de §8.3. Sin esta fila, la
    // oportunidad aparecería en Negociación sin que nada explique cómo llegó.
    if (destino.position > etapaInicial(pipeline.stages).position) {
      await tx.stageTransition.create({
        data: {
          opportunityId: oportunidad.id,
          fromStageId: null,
          toStageId: destino.id,
          byUserId: session.userId,
          gateOverride: decision.gateOverride,
        },
      });
    }

    return oportunidad;
  });

  // `gateOverride` sale con el resultado porque quien creó la oportunidad tiene
  // que enterarse: quedó registrada como incumplimiento y alimenta el reporte
  // semanal de §8.3. Enterarse por el reporte, una semana después, es tarde.
  return ok({ ...creada, gateOverride: decision.gateOverride });
}
