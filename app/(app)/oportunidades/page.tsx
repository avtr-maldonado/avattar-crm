import { requireSession } from "@/lib/auth/session";
import { listOpportunities, sumOpportunityAmounts } from "@/lib/scope";
import { formatPercent, formatUSD, toClient, type Money } from "@/lib/money";
import { weightedTotal } from "@/lib/domain/pipeline";
import { computeRiskFlags, ETIQUETA_BANDERA } from "@/lib/domain/riskFlags";
import { getCommercialPolicy } from "@/lib/policy";
import { BarraSuperior } from "@/components/ui/BarraSuperior";

/**
 * P-01 · Pipeline de oportunidades.
 *
 * **Esta es una versión mínima de E0**, no la pantalla de E1: falta el kanban,
 * la barra de filtros, el arrastre entre etapas y las vistas guardadas. Existe
 * para probar la cadena completa de extremo a extremo —sesión, alcance por rol,
 * selectores por permiso, cálculo de banderas y formateo de dinero— contra los
 * datos reales del seed.
 *
 * Lo que ya cumple y no debe perderse al construir E1:
 *
 *   - Los datos llegan por `lib/scope`, nunca por Prisma directo (INV-01).
 *   - Los indicadores se calculan sobre el conjunto YA acotado: para un
 *     Vendedor son los suyos, nunca el total de la oficina, ni por agregación
 *     (§2.3).
 *   - Las banderas se calculan, no se leen de un campo (INV-11).
 *   - Las cifras van con `tabular` y el margen se pinta verde en o sobre el
 *     piso, coral debajo (§13.1).
 */
export default async function PipelinePage() {
  const session = await requireSession();

  const [oportunidades, agregado, politica] = await Promise.all([
    listOpportunities(session, { orderBy: [{ amount: "desc" }] }),
    sumOpportunityAmounts(session, { status: "ABIERTA" }),
    getCommercialPolicy(session.countryCodes[0] ?? "MX"),
  ]);

  const abiertas = oportunidades.filter((o) => o.status === "ABIERTA");
  const ponderado = weightedTotal(abiertas);
  const ahora = new Date();

  const conBanderas = oportunidades.map((o) => ({
    ...o,
    banderas: computeRiskFlags(o, o.stage, politica, ahora),
  }));
  const enRiesgo = conBanderas.filter((o) => o.banderas.length > 0);

  // §13.5 · el subtítulo lleva conteos y totales: es lo que convierte un título
  // en información. Para un Vendedor son SUS cifras, nunca las de la oficina.
  const subtitulo = [
    `${abiertas.length} abiertas`,
    formatUSD(agregado.total ?? "0"),
    `ponderado ${formatUSD(ponderado)}`,
  ].join(" · ");

  return (
    <>
      <BarraSuperior
        titulo="Pipeline"
        subtitulo={subtitulo}
        usuario={{
          nombre: session.name,
          iniciales: iniciales(session.name),
          rol: session.role,
          paises: session.countryCodes,
        }}
      />

      <div className="flex-1 overflow-y-auto p-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Indicador etiqueta="Valor abierto" valor={formatUSD(agregado.total ?? "0")} />
        <Indicador etiqueta="Ponderado" valor={formatUSD(ponderado)} />
        <Indicador etiqueta="Abiertas" valor={String(abiertas.length)} />
        <Indicador
          etiqueta="En riesgo"
          valor={String(enRiesgo.length)}
          alerta={enRiesgo.length > 0}
        />
      </div>

      {oportunidades.length === 0 ? (
        <EstadoVacio />
      ) : (
        <table className="mt-8 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-borde-fuerte text-left">
              <Th>Folio</Th>
              <Th>Oportunidad</Th>
              <Th>Etapa</Th>
              <Th className="text-right">Importe</Th>
              <Th className="text-right">Margen</Th>
              <Th className="text-right">MEDDIC</Th>
              <Th>Dueño</Th>
              <Th>Riesgo</Th>
            </tr>
          </thead>
          <tbody>
            {conBanderas.map((o) => (
              <tr key={o.id} className="border-b border-borde hover:bg-superficie-sutil">
                <td className="py-2 pr-3 font-mono text-xs text-texto-tenue">{o.folio}</td>
                <td className="py-2 pr-3">
                  <div className="font-medium text-texto-titulo">{o.name}</div>
                  <div className="text-xs text-texto-tenue">{o.organization.name}</div>
                </td>
                <td className="py-2 pr-3 text-texto-cuerpo">{o.stage.name}</td>
                <td className="tabular py-2 pr-3 text-right">{formatUSD(o.amount)}</td>
                <td className="tabular py-2 pr-3 text-right">
                  <Margen valor={o.grossMargin} piso={politica.marginFloor} />
                </td>
                <td className="tabular py-2 pr-3 text-right">
                  <PuntajeMeddic valor={o.meddicScore} />
                </td>
                <td className="py-2 pr-3 text-xs text-texto-tenue">{o.owner.initials}</td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {o.banderas.map((b) => (
                      <span
                        key={b}
                        className="rounded-pill bg-coral/10 px-2 py-0.5 text-xs text-coral"
                      >
                        {ETIQUETA_BANDERA[b]}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      </div>
    </>
  );
}

/** Las iniciales del avatar. Dos letras: nombre y primer apellido. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`eyebrow pb-2 pr-3 font-medium ${className}`}>{children}</th>;
}

function Indicador({
  etiqueta,
  valor,
  alerta = false,
}: {
  etiqueta: string;
  valor: string;
  alerta?: boolean;
}) {
  return (
    <div className="rounded-md border border-borde bg-superficie-tarjeta p-4">
      <p className="eyebrow">{etiqueta}</p>
      <p
        className={`tabular mt-1 text-h4 font-semibold ${alerta ? "text-coral" : "text-texto-titulo"}`}
      >
        {valor}
      </p>
    </div>
  );
}

/**
 * §13.1 · verde en o sobre el piso, coral debajo.
 *
 * «Es la señal más importante de toda la interfaz.» El piso entra por
 * parámetro, desde `CommercialPolicy`: no hay un 0.20 escrito aquí (INV-05).
 */
function Margen({ valor, piso }: { valor: Money | null; piso: Money }) {
  if (valor === null) return <span className="text-texto-tenue">—</span>;
  return (
    <span className={valor.lt(piso) ? "font-semibold text-coral" : "text-exito"}>
      {formatPercent(toClient(valor))}
    </span>
  );
}

/** §7.4 · rojo bajo 50, ámbar 50–69, verde 70 o más. */
function PuntajeMeddic({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-texto-tenue">—</span>;
  const color = valor >= 70 ? "text-exito" : valor >= 50 ? "text-navy-500" : "text-coral";
  return <span className={color}>{valor}</span>;
}

/** §11 · el estado vacío siempre propone la acción siguiente. Nunca en blanco. */
function EstadoVacio() {
  return (
    <div className="mt-8 rounded-md border border-dashed border-borde-fuerte p-12 text-center">
      <p className="font-medium text-texto-titulo">No hay oportunidades que puedas ver</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-texto-tenue">
        Si esperabas ver algo aquí, revisa que tu usuario tenga oportunidades
        asignadas: la visibilidad sigue al propietario, no a quien las creó.
      </p>
    </div>
  );
}
