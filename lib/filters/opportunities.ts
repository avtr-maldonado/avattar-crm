import type { Prisma } from "@prisma/client";
import type { Session } from "@/lib/auth/permissions";
import { money } from "@/lib/money";
import { opportunityScope } from "@/lib/scope/opportunities";
import {
  CAMPO_PRISMA,
  resolvePeriod,
  type DateField,
  type DatePreset,
  type Periodo,
} from "./dates";

/**
 * Los filtros de oportunidades · §9, INV-10.
 *
 * El estado vive en `searchParams`: una vista filtrada es una URL que se puede
 * pegar en un correo, y el botón de regresar funciona (AC-22).
 *
 * ## La regla que no se negocia
 *
 * `toWhere` construye siempre `{ AND: [alcance, ...cláusulas] }`. **Primero el
 * alcance del rol, después los filtros del usuario.** `buildClauses` no se
 * exporta, así que no existe forma de armar un `where` que omita el alcance
 * (AC-25).
 */

const ESTADOS = ["ABIERTA", "GANADA", "PERDIDA"] as const;
const CATEGORIAS = ["PIPELINE", "MEJOR_CASO", "COMPROMISO", "OMITIDA"] as const;
const PAISES = ["MX", "CO", "CL"] as const;
const BANDERAS = ["SIN_ACTIVIDAD", "ESTANCADA", "MARGEN_BAJO"] as const;
const CAMPOS_FECHA = [
  "CIERRE_ESTIMADO",
  "CIERRE_REAL",
  "CREACION",
  "ULTIMA_ACTIVIDAD",
] as const;
const PREAJUSTES = [
  "ESTE_TRIMESTRE",
  "TRIMESTRE_ANTERIOR",
  "PROXIMO_TRIMESTRE",
  "ESTE_ANIO",
  "ANIO_ANTERIOR",
  "ULTIMOS_30_DIAS",
  "ULTIMOS_90_DIAS",
  "VENCIDAS",
  "PERSONALIZADO",
] as const;

export type ParsedFilters = {
  q: string | null;
  org: string[];
  owner: string[];
  pipeline: string | null;
  stage: string[];
  status: (typeof ESTADOS)[number][];
  forecast: (typeof CATEGORIAS)[number][];
  country: (typeof PAISES)[number][];
  amountMin: string | null;
  amountMax: string | null;
  meddicMin: number | null;
  meddicMax: number | null;
  risk: (typeof BANDERAS)[number][];
  dateField: DateField;
  period: DatePreset;
  from: string | null;
  to: string | null;
  /**
   * Qué controles debe pintar la barra de filtros, según el rol.
   *
   * `dateField` está SIEMPRE, se haya elegido o no: AC-23 exige que el campo
   * sobre el que aplica el rango nunca quede implícito, porque un rango de
   * fechas sin decir sobre qué campo aplica produce reportes irreproducibles.
   *
   * `owner` y `country` se recortan por rol (AC-24).
   */
  visibles: string[];
};

/** Toma un valor de enum de la URL, o `null` si no es de la lista. */
function unEnum<T extends readonly string[]>(
  valor: string | null,
  permitidos: T,
): T[number] | null {
  return valor !== null && (permitidos as readonly string[]).includes(valor)
    ? (valor as T[number])
    : null;
}

/** Toma los valores válidos de una lista repetida en la URL. */
function variosEnum<T extends readonly string[]>(
  valores: string[],
  permitidos: T,
): T[number][] {
  return valores.filter((v): v is T[number] => (permitidos as readonly string[]).includes(v));
}

function unEntero(valor: string | null, min: number, max: number): number | null {
  if (valor === null) return null;
  const n = Number.parseInt(valor, 10);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function unDecimal(valor: string | null): string | null {
  return valor !== null && /^-?\d+(\.\d+)?$/.test(valor) ? valor : null;
}

/**
 * Qué filtros se ofrecen a este usuario · §9.1, AC-24.
 *
 * Las opciones se recortan **por permiso**, no por estilo: si el usuario es
 * `VENDEDOR`, el filtro «Vendedor» no se muestra porque solo hay una opción
 * posible y desplegarlo revelaría la lista de compañeros.
 */
export function filtrosVisibles(session: Session): string[] {
  const todos = [
    "q",
    "org",
    "owner",
    "pipeline",
    "stage",
    "status",
    "forecast",
    "country",
    "amountMin",
    "amountMax",
    "meddicMin",
    "meddicMax",
    "risk",
    "dateField",
    "period",
  ];

  return todos.filter((f) => {
    if (f === "owner") return session.role !== "VENDEDOR" && session.role !== "PREVENTA";
    // Un solo país no es una elección: es información redundante en la barra.
    if (f === "country") return session.countryCodes.length > 1;
    return true;
  });
}

export type OpcionesParseo = { fiscalYearStartMonth: number; ahora?: Date };

/**
 * Lee los filtros de la URL. Lo que no es válido se descarta, no revienta:
 * la URL es entrada del usuario y puede venir editada a mano.
 *
 * **No recorta `owner` ni `country` por rol.** Los parsea tal cual, y deja que
 * `toWhere` los combine con el alcance. Eso es lo que AC-25 pide: un vendedor
 * que envía `owner=<otro id>` obtiene **cero resultados**, no los del otro
 * vendedor ni los suyos como si nada hubiera pasado.
 */
export function parseFilters(searchParams: URLSearchParams, session: Session): ParsedFilters {
  const dateField =
    unEnum(searchParams.get("dateField"), CAMPOS_FECHA) ?? "CIERRE_ESTIMADO";

  const period = unEnum(searchParams.get("period"), PREAJUSTES) ?? "ESTE_TRIMESTRE";

  const status = variosEnum(searchParams.getAll("status"), ESTADOS);

  return {
    q: searchParams.get("q")?.trim() || null,
    org: searchParams.getAll("org"),
    owner: searchParams.getAll("owner"),
    pipeline: searchParams.get("pipeline"),
    stage: searchParams.getAll("stage"),
    // Abierta por omisión (§9.2): la pregunta diaria es sobre lo vivo.
    status: status.length > 0 ? status : ["ABIERTA"],
    forecast: variosEnum(searchParams.getAll("forecast"), CATEGORIAS),
    country: variosEnum(searchParams.getAll("country"), PAISES),
    amountMin: unDecimal(searchParams.get("amountMin")),
    amountMax: unDecimal(searchParams.get("amountMax")),
    meddicMin: unEntero(searchParams.get("meddicMin"), 0, 100),
    meddicMax: unEntero(searchParams.get("meddicMax"), 0, 100),
    risk: variosEnum(searchParams.getAll("risk"), BANDERAS),
    dateField,
    period,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    visibles: filtrosVisibles(session),
  };
}

/**
 * Traduce los filtros a cláusulas de Prisma.
 *
 * **No se exporta.** Es lo que impide construir un `where` sin el alcance: la
 * única puerta de salida es `toWhere`, que antepone `opportunityScope`.
 */
function buildClauses(
  parsed: ParsedFilters,
  opciones: OpcionesParseo,
): Prisma.OpportunityWhereInput[] {
  const clauses: Prisma.OpportunityWhereInput[] = [];

  if (parsed.q) {
    clauses.push({
      OR: [
        { name: { contains: parsed.q, mode: "insensitive" } },
        { folio: { contains: parsed.q, mode: "insensitive" } },
        { organization: { name: { contains: parsed.q, mode: "insensitive" } } },
      ],
    });
  }

  if (parsed.org.length) clauses.push({ organizationId: { in: parsed.org } });
  if (parsed.owner.length) clauses.push({ ownerId: { in: parsed.owner } });
  if (parsed.pipeline) clauses.push({ pipelineId: parsed.pipeline });
  if (parsed.stage.length) clauses.push({ stageId: { in: parsed.stage } });
  if (parsed.status.length) clauses.push({ status: { in: parsed.status } });
  if (parsed.forecast.length) clauses.push({ forecastCategory: { in: parsed.forecast } });
  if (parsed.country.length) clauses.push({ countryCode: { in: parsed.country } });

  if (parsed.amountMin || parsed.amountMax) {
    clauses.push({
      amount: {
        ...(parsed.amountMin ? { gte: money(parsed.amountMin) } : {}),
        ...(parsed.amountMax ? { lte: money(parsed.amountMax) } : {}),
      },
    });
  }

  if (parsed.meddicMin !== null || parsed.meddicMax !== null) {
    clauses.push({
      meddicScore: {
        ...(parsed.meddicMin !== null ? { gte: parsed.meddicMin } : {}),
        ...(parsed.meddicMax !== null ? { lte: parsed.meddicMax } : {}),
      },
    });
  }

  const rango = rangoDeFechas(parsed, opciones);
  if (rango) {
    const columna = CAMPO_PRISMA[parsed.dateField];
    clauses.push({
      [columna]: {
        ...(rango.from ? { gte: rango.from } : {}),
        lte: rango.to,
      },
    } as Prisma.OpportunityWhereInput);
  }

  return clauses;
}

/** El preajuste manda, salvo en PERSONALIZADO, donde mandan `from` y `to`. */
function rangoDeFechas(parsed: ParsedFilters, opciones: OpcionesParseo): Periodo | null {
  const ahora = opciones.ahora ?? new Date();
  const resuelto = resolvePeriod(parsed.period, opciones.fiscalYearStartMonth, ahora);
  if (resuelto) return resuelto;

  if (parsed.from || parsed.to) {
    return {
      from: parsed.from ? new Date(parsed.from) : null,
      to: parsed.to ? new Date(parsed.to) : ahora,
    };
  }
  return null;
}

/**
 * Los filtros como `where` de Prisma, con el alcance del rol antepuesto.
 *
 * El orden importa y por eso está aquí, en una sola línea legible: un filtro no
 * puede ampliar lo que el rol permite ver.
 */
export function toWhere(
  parsed: ParsedFilters,
  session: Session,
  opciones: OpcionesParseo = { fiscalYearStartMonth: 1 },
): Prisma.OpportunityWhereInput {
  return { AND: [opportunityScope(session), ...buildClauses(parsed, opciones)] };
}
