import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listOrganizationsConIndicadores } from "@/lib/scope/organizationIndicators";
import { formatUSD } from "@/lib/money";
import { iniciales, NOMBRE_PAIS } from "@/lib/etiquetas";
import { BarraSuperior } from "@/components/ui/BarraSuperior";
import { Avatar, Boton, EstadoVacio, Pastilla, StatTile } from "@/components/ui/primitivas";

/**
 * P-03 · Contactos.
 *
 * «Columnas de organización: nombre, tipo, oportunidades abiertas, pipeline,
 * ganado 12 meses, propietario, última actividad (en rojo si pasó del umbral).»
 *
 * ## La sutileza que decide si esta pantalla filtra información
 *
 * §5.3 · «Para `VENDEDOR`, las cifras se calculan solo sobre oportunidades
 * visibles.» No basta con acotar qué cuentas aparecen: un total agregado sobre
 * la cuenta completa dejaría que un vendedor dedujera, por resta, el pipeline
 * de su compañero en un cliente compartido. Los agregados pasan por
 * `opportunityScope` igual que las filas.
 *
 * ## «Sin histórico» no es «cero»
 *
 * C-02 · el sistema arrancó en limpio, sin migrar Pipedrive. Mientras no exista
 * ninguna oportunidad cerrada, «ganado 12 meses» no vale cero: no tiene dato.
 * Un cero afirmaría que la cuenta no compró, y eso es falso.
 *
 * La pestaña de Personas llega con P-05, en un incremento posterior.
 */
const DIAS_SIN_ACTIVIDAD = 30;

export default async function ContactosPage() {
  const session = await requireSession();
  const { organizaciones, hayHistoricoDeCierres } =
    await listOrganizationsConIndicadores(session);

  const ahora = new Date();
  const conPipeline = organizaciones.filter((o) => o.indicadores.abiertas > 0);
  const frias = organizaciones.filter((o) =>
    esCuentaFria(o.indicadores.ultimaActividad, ahora),
  );

  return (
    <>
      <BarraSuperior
        titulo="Contactos"
        subtitulo={`${organizaciones.length} cuentas visibles · ${conPipeline.length} con pipeline abierto`}
        usuario={{
          nombre: session.name,
          iniciales: iniciales(session.name),
          rol: session.role,
          paises: session.countryCodes,
        }}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            etiqueta="Cuentas"
            valor={String(organizaciones.length)}
            subtexto="que puedes ver"
          />
          <StatTile
            etiqueta="Con pipeline abierto"
            valor={String(conPipeline.length)}
            subtexto="tienen al menos una oportunidad"
            tono="acento"
          />
          <StatTile
            etiqueta="Estratégicas"
            valor={String(organizaciones.filter((o) => o.isStrategic).length)}
            subtexto="marcadas por Dirección"
          />
          <StatTile
            etiqueta="Sin actividad"
            valor={String(frias.length)}
            subtexto={`más de ${DIAS_SIN_ACTIVIDAD} días`}
            tono={frias.length > 0 ? "peligro" : "neutro"}
          />
        </div>

        {organizaciones.length === 0 ? (
          <div className="mt-6">
            <EstadoVacio
              titulo="No hay cuentas que puedas ver"
              explicacion="Ves una cuenta si eres su propietario o si tienes al menos una oportunidad propia en ella. Si esperabas ver alguna, revisa a quién está asignada."
              accion={
                <Boton href="/oportunidades" variante="secundario">
                  Ir al pipeline
                </Boton>
              }
            />
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-md border border-borde">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-superficie-sutil">
                <tr className="text-left">
                  <Th>Cuenta</Th>
                  <Th>Tipo</Th>
                  <Th alineacion="derecha">Abiertas</Th>
                  <Th alineacion="derecha">Pipeline</Th>
                  <Th alineacion="derecha">Ganado 12 meses</Th>
                  <Th>Propietario</Th>
                  <Th alineacion="derecha">Última actividad</Th>
                </tr>
              </thead>
              <tbody>
                {organizaciones.map((o) => (
                  <tr
                    key={o.id}
                    className="border-t border-borde transition-colors duration-rapido hover:bg-superficie-sutil"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/contactos/organizaciones/${o.id}`}
                        className="font-medium text-texto-titulo hover:text-acento"
                      >
                        {o.name}
                      </Link>
                      <div className="flex items-center gap-1.5 text-xs text-texto-tenue">
                        <span>
                          {[o.industry, o.city].filter(Boolean).join(" · ") ||
                            NOMBRE_PAIS[o.countryCode]}
                        </span>
                        {o.isStrategic && <Pastilla tono="acento">Estratégica</Pastilla>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <Pastilla>{ETIQUETA_TIPO[o.type]}</Pastilla>
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      {o.indicadores.abiertas || <span className="text-texto-tenue">—</span>}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-medium">
                      {o.indicadores.abiertas > 0 ? (
                        formatUSD(o.indicadores.pipelineAbierto)
                      ) : (
                        <span className="font-normal text-texto-tenue">—</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      {hayHistoricoDeCierres ? (
                        formatUSD(o.indicadores.ganado12Meses)
                      ) : (
                        <span
                          className="text-texto-tenue"
                          title="El sistema arrancó sin migrar el histórico de Pipedrive. No hay cierres contra los cuales medir todavía."
                        >
                          sin histórico
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <Avatar iniciales={o.owner.initials} titulo={o.owner.name} />
                    </td>
                    <td className="tabular px-3 py-2.5 text-right">
                      <UltimaActividad fecha={o.indicadores.ultimaActividad} ahora={ahora} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** §11 · en rojo si pasó del umbral. Una cuenta fría es una cuenta en riesgo. */
function UltimaActividad({ fecha, ahora }: { fecha: Date | null; ahora: Date }) {
  if (fecha === null) {
    return (
      <span className="text-coral" title="Sin ninguna actividad registrada">
        nunca
      </span>
    );
  }

  const dias = Math.floor((ahora.getTime() - fecha.getTime()) / 86_400_000);
  const fria = dias > DIAS_SIN_ACTIVIDAD;

  return (
    <span
      className={fria ? "font-medium text-coral" : "text-texto-cuerpo"}
      title={FECHA.format(fecha)}
    >
      {dias === 0 ? "hoy" : `hace ${dias} d`}
    </span>
  );
}

function esCuentaFria(fecha: Date | null, ahora: Date): boolean {
  if (fecha === null) return true;
  return (ahora.getTime() - fecha.getTime()) / 86_400_000 > DIAS_SIN_ACTIVIDAD;
}

function Th({
  children,
  alineacion = "izquierda",
}: {
  children: React.ReactNode;
  alineacion?: "izquierda" | "derecha";
}) {
  return (
    <th
      className={`eyebrow px-3 py-2 font-medium ${alineacion === "derecha" ? "text-right" : ""}`}
    >
      {children}
    </th>
  );
}

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const ETIQUETA_TIPO: Record<string, string> = {
  CLIENTE: "Cliente",
  PROSPECTO: "Prospecto",
  PARTNER: "Partner",
  FABRICANTE: "Fabricante",
  PROVEEDOR: "Proveedor",
};
