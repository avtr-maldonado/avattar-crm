import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { listActivities } from "@/lib/scope";
import {
  contextoDeCompuerta,
  getOpportunityDetail,
  type DetalleOportunidad,
} from "@/lib/scope/opportunityDetail";
import { getCommercialPolicy } from "@/lib/policy";
import { formatPercent, formatUSD, toClient } from "@/lib/money";
import { weightedAmount } from "@/lib/domain/pipeline";
import { computeRiskFlags } from "@/lib/domain/riskFlags";
import { evaluateGate, type GateRequirement } from "@/lib/domain/stageGate";
import { ETIQUETA_BANDERA, ETIQUETA_ESTATUS, iniciales } from "@/lib/etiquetas";
import { BarraSuperior } from "@/components/ui/BarraSuperior";
import { Avatar, Boton, EstadoVacio, Pastilla, StatTile } from "@/components/ui/primitivas";
import { BarraDeEtapas } from "@/components/oportunidad/BarraDeEtapas";
import { Pestanas, type Pestana } from "@/components/oportunidad/Pestanas";
import { ListaDeRequisitos } from "@/components/oportunidad/ListaDeRequisitos";

/**
 * La política, derivada de su lector.
 *
 * Así la pantalla tiene el tipo exacto sin importar `@prisma/client`, que la
 * regla de frontera prohíbe en `app/**` (INV-01), y sin repetir a mano una
 * forma que se desincronizaría al agregar un umbral.
 */
type Politica = Awaited<ReturnType<typeof getCommercialPolicy>>;

/**
 * P-02 · Detalle de oportunidad.
 *
 * En E1 llegan las pestañas Resumen y Actividades; Cotización, MEDDIC, Hitos y
 * Documentos se ven marcadas con el incremento en que aterrizan (E2 y E3).
 *
 * Lo que ya gobierna proceso, y no solo muestra datos: la lista de requisitos
 * para avanzar de etapa, que evalúa `RN-02` con el evaluador genérico y dice
 * exactamente qué falta, con la cifra concreta cuando aplica.
 */
export default async function DetalleOportunidadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const oportunidad = await getOpportunityDetail(session, id);

  // 404 tanto si no existe como si no la alcanza: distinguirlas le confirmaría
  // a un vendedor que la oportunidad de su compañero existe.
  if (!oportunidad) notFound();

  // Las dos dependen de la oportunidad, pero no entre sí. En secuencia costaban
  // dos viajes; medido contra us-east-1, cada uno son ~287 ms de pura red
  // (docs/latencia.md).
  const [politica, actividades] = await Promise.all([
    getCommercialPolicy(oportunidad.pipeline.countryCode),
    listActivities(session, { where: { opportunityId: oportunidad.id }, take: 30 }),
  ]);

  const pestanaActiva = typeof sp.p === "string" ? sp.p : "resumen";
  const hrefDe = (clave: string) => `/oportunidades/${oportunidad.id}?p=${clave}`;

  const pestanas: Pestana[] = [
    { clave: "resumen", etiqueta: "Resumen" },
    { clave: "actividades", etiqueta: "Actividades", contador: actividades.length },
    { clave: "cotizacion", etiqueta: "Cotización", llegaEn: "E2, cotización y margen" },
    { clave: "meddic", etiqueta: "MEDDIC", llegaEn: "E3, MEDDIC y cierre" },
    { clave: "hitos", etiqueta: "Hitos", llegaEn: "E3, MEDDIC y cierre" },
    {
      clave: "documentos",
      etiqueta: "Documentos",
      contador: oportunidad.documents.length,
      llegaEn: "E2, carga de archivos",
    },
  ];

  const banderas = computeRiskFlags(oportunidad, oportunidad.stage, politica, new Date());
  const congelada = oportunidad.quotes[0];

  return (
    <>
      <BarraSuperior
        titulo={oportunidad.name}
        subtitulo={`${oportunidad.folio} · ${oportunidad.organization.name}`}
        usuario={{
          nombre: session.name,
          iniciales: iniciales(session.name),
          rol: session.role,
          paises: session.countryCodes,
        }}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <Encabezado o={oportunidad} banderas={banderas} politica={politica} />

        <div className="mt-6">
          <Pestanas pestanas={pestanas} activa={pestanaActiva} hrefDe={hrefDe} />
        </div>

        <div className="mt-6">
          {pestanaActiva === "actividades" ? (
            <TabActividades actividades={actividades} />
          ) : (
            <TabResumen o={oportunidad} politica={politica} congeladaExiste={congelada != null} />
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────── Encabezado

function Encabezado({
  o,
  banderas,
  politica,
}: {
  o: DetalleOportunidad;
  banderas: ReturnType<typeof computeRiskFlags>;
  politica: Politica;
}) {
  const etapas = o.pipeline.stages.map((e) => ({
    id: e.id,
    name: e.name,
    position: e.position,
    probabilidad: formatPercent(toClient(e.probability), 0),
    isClosing: e.isClosing,
  }));

  const congelada = o.quotes[0];
  // `grossMargin` solo viene si el usuario tiene VER_MARGEN: el selector lo
  // omite del `select`, no lo oculta después (INV-02).
  const margen = "grossMargin" in o ? o.grossMargin : null;
  const margenBajoElPiso = margen ? margen.lt(politica.marginFloor) : false;

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2">
        <Pastilla tono={o.status === "GANADA" ? "exito" : o.status === "PERDIDA" ? "neutro" : "acento"}>
          {ETIQUETA_ESTATUS[o.status]}
        </Pastilla>
        <Pastilla>{o.pipeline.name}</Pastilla>
        {o.organization.isStrategic && <Pastilla tono="acento">Cuenta estratégica</Pastilla>}
        {banderas.map((b) => (
          <Pastilla key={b} tono={b === "MARGEN_BAJO" ? "peligro" : "alerta"}>
            {ETIQUETA_BANDERA[b]}
          </Pastilla>
        ))}

        <div className="ml-auto flex gap-2">
          {/* Las acciones llegan con sus reglas: cambiar etapa y marcar ganada
              exigen validación de dominio (INV-07), no un botón que escriba. */}
          <Boton variante="secundario" href={`/contactos/organizaciones/${o.organization.id}`}>
            Ver cuenta
          </Boton>
        </div>
      </div>

      <div className="mt-5 max-w-3xl">
        <BarraDeEtapas
          etapas={etapas}
          etapaActualId={o.stage.id}
          cerrada={o.status === "ABIERTA" ? undefined : o.status}
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile
          etiqueta={congelada ? "Valor neto" : "Valor estimado"}
          valor={formatUSD(congelada?.netSubtotal ?? o.amount)}
          subtexto={congelada ? `Cotización v${congelada.version}` : "Sin cotización congelada"}
        />
        <StatTile
          etiqueta="Ponderado"
          valor={formatUSD(weightedAmount(o.amount, o.stage.probability))}
          subtexto={`${formatPercent(toClient(o.stage.probability), 0)} · ${o.stage.name}`}
          tono="acento"
        />
        {margen ? (
          <StatTile
            etiqueta="Margen"
            valor={formatPercent(toClient(margen))}
            subtexto={`Piso ${formatPercent(toClient(politica.marginFloor), 0)}`}
            tono={margenBajoElPiso ? "peligro" : "exito"}
          />
        ) : (
          <StatTile
            etiqueta="Margen"
            valor="—"
            subtexto="Aún sin cotizar"
          />
        )}
        <StatTile
          etiqueta="MEDDIC"
          valor={o.meddicScore === null ? "—" : String(o.meddicScore)}
          subtexto={`Mínimo de cierre ${politica.meddicMinToClosing}`}
          tono={
            o.meddicScore === null
              ? "neutro"
              : o.meddicScore >= politica.meddicMinToClosing
                ? "exito"
                : "peligro"
          }
        />
      </div>
    </section>
  );
}

// ──────────────────────────────────────────────────────────── Tab Resumen

function TabResumen({
  o,
  politica,
  congeladaExiste,
}: {
  o: DetalleOportunidad;
  politica: Politica;
  congeladaExiste: boolean;
}) {
  // La etapa siguiente es la accionable: los requisitos de la actual ya se
  // cumplieron al entrar (§8.3).
  const siguiente = o.pipeline.stages.find((e) => e.position === o.stage.position + 1);
  const requisitos = (siguiente?.gateRequires ?? []) as GateRequirement[];
  const evaluacion = evaluateGate(requisitos, contextoDeCompuerta(o, politica));

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Tarjeta titulo="Datos de la oportunidad">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Dato etiqueta="Folio" valor={o.folio} mono />
            <Dato etiqueta="Cuenta" valor={o.organization.name} />
            <Dato etiqueta="Tipo de negocio" valor={ETIQUETA_TIPO[o.businessType]} />
            <Dato etiqueta="Pronóstico" valor={ETIQUETA_PRONOSTICO[o.forecastCategory]} />
            <Dato
              etiqueta="Cierre estimado"
              valor={FECHA.format(o.expectedCloseDate)}
              tabular
            />
            <Dato etiqueta="Origen" valor={o.source?.name ?? "Sin registrar"} />
            <Dato etiqueta="Propietario" valor={o.owner.name} />
            <Dato etiqueta="Creada por" valor={o.createdBy.name} />
            <Dato etiqueta="En esta etapa desde" valor={FECHA.format(o.stageEnteredAt)} tabular />
          </dl>
        </Tarjeta>

        <Tarjeta titulo="Comité de compra">
          {o.organization.people.length === 0 ? (
            <p className="text-sm text-texto-tenue">
              La cuenta todavía no tiene personas registradas. El comité de compra es
              lo que ancla el decisor económico y el campeón en MEDDIC.
            </p>
          ) : (
            <ul className="space-y-3">
              {o.organization.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar iniciales={p.initials} titulo={p.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-texto-titulo">
                      {p.name}
                      {p.id === o.primaryPerson?.id && (
                        <span className="ml-2 text-xs font-normal text-texto-tenue">
                          contacto principal
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-texto-tenue">
                      {[p.jobTitle, p.committeeRole?.name].filter(Boolean).join(" · ") ||
                        "Sin rol declarado"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>

      <div className="space-y-6">
        <Tarjeta titulo={null}>
          {siguiente ? (
            <ListaDeRequisitos
              etapaDestino={siguiente.name}
              requisitos={requisitos}
              faltantes={evaluacion.missing}
              modo={siguiente.gateMode}
            />
          ) : (
            <div>
              <h3 className="text-sm font-semibold text-texto-titulo">Última etapa</h3>
              <p className="mt-2 text-sm text-texto-tenue">
                Desde aquí la oportunidad se marca ganada o perdida. Las condiciones
                de cierre —hitos cuadrados, MEDDIC sobre el mínimo y documento de
                respaldo— se validan al marcarla, y llegan con E3.
              </p>
            </div>
          )}
        </Tarjeta>

        <Tarjeta titulo="Historial de etapas">
          {o.stageHistory.length === 0 ? (
            <p className="text-sm text-texto-tenue">
              Sin transiciones registradas. Se anotan a partir del primer cambio de
              etapa hecho desde el sistema.
            </p>
          ) : (
            <ol className="space-y-3">
              {o.stageHistory.map((t) => (
                <li key={t.id} className="text-sm">
                  <p className="text-texto-cuerpo">
                    {t.fromStage ? `${t.fromStage.name} → ` : ""}
                    <span className="font-medium">{t.toStage.name}</span>
                    {t.gateOverride && (
                      <span className="ml-2">
                        <Pastilla tono="alerta">Avanzó con advertencia</Pastilla>
                      </span>
                    )}
                  </p>
                  <p className="tabular text-xs text-texto-tenue">
                    {FECHA.format(t.atDate)} · {t.byUser.name}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Tarjeta>

        {!congeladaExiste && (
          <p className="text-xs text-texto-tenue">
            El importe mostrado es el estimado. Se reemplaza por el neto de la
            cotización cuando exista una congelada.
          </p>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────── Tab Actividades

function TabActividades({
  actividades,
}: {
  actividades: Awaited<ReturnType<typeof listActivities>>;
}) {
  if (actividades.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin actividades registradas"
        explicacion="Toda oportunidad abierta debería tener una próxima actividad agendada. Sin ella, el negocio depende de que alguien se acuerde."
        accion={
          <Boton variante="secundario" href="/actividades">
            Ir a la agenda
          </Boton>
        }
      />
    );
  }

  return (
    <ol className="space-y-3">
      {actividades.map((a) => (
        <li
          key={a.id}
          className="rounded-md border border-borde bg-superficie-tarjeta p-4"
        >
          <div className="flex flex-wrap items-baseline gap-2">
            <Pastilla>{a.type.name}</Pastilla>
            <p className="text-sm font-medium text-texto-titulo">{a.subject}</p>
            <span className="tabular ml-auto text-xs text-texto-tenue">
              {FECHA.format(a.startsAt)}
            </span>
          </div>
          {a.notes && <p className="mt-2 text-sm text-texto-cuerpo">{a.notes}</p>}
          <p className="mt-2 text-xs text-texto-tenue">
            {a.user.name}
            {a.completedAt ? " · realizada" : " · pendiente"}
          </p>
        </li>
      ))}
    </ol>
  );
}

// ──────────────────────────────────────────────────────────────── Auxiliares

function Tarjeta({
  titulo,
  children,
}: {
  titulo: string | null;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-borde bg-superficie-tarjeta p-5">
      {titulo && <h2 className="mb-4 text-sm font-semibold text-texto-titulo">{titulo}</h2>}
      {children}
    </section>
  );
}

function Dato({
  etiqueta,
  valor,
  mono = false,
  tabular = false,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
  tabular?: boolean;
}) {
  return (
    <div>
      <dt className="eyebrow">{etiqueta}</dt>
      <dd
        className={`mt-0.5 text-sm text-texto-cuerpo ${mono ? "font-mono text-xs" : ""} ${tabular ? "tabular" : ""}`}
      >
        {valor}
      </dd>
    </div>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const ETIQUETA_TIPO: Record<string, string> = {
  NUEVO: "Cliente nuevo",
  EXPANSION: "Expansión",
  RENOVACION: "Renovación",
};

const ETIQUETA_PRONOSTICO: Record<string, string> = {
  PIPELINE: "Pipeline",
  MEJOR_CASO: "Mejor caso",
  COMPROMISO: "Compromiso",
  OMITIDA: "Omitida",
};
