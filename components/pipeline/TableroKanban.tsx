import { EstadoVacio } from "@/components/ui/primitivas";
import { TarjetaOportunidad, type DatosTarjeta } from "./TarjetaOportunidad";

/**
 * Tablero kanban · §11 P-01.
 *
 * «Una columna por etapa, con conteo, total y ponderado de la columna.»
 *
 * Las columnas vacías **se muestran igual**. Una etapa que desaparece cuando no
 * tiene tarjetas rompe el mapa mental del proceso: el vendedor deja de ver que
 * Propuesta existe y no entiende por qué su negocio saltó de Descubrimiento a
 * Negociación.
 *
 * El arrastre entre etapas llega con el resto de E1: dispara la evaluación de
 * `RN-02` y, según `Stage.gateMode`, o bloquea con el detalle de lo que falta o
 * avanza registrando `gateOverride`. Hasta entonces la tarjeta abre el detalle.
 */
export type ColumnaKanban = {
  etapaId: string;
  nombre: string;
  /** Ya formateado: «75 %». */
  probabilidad: string;
  /** Ya formateados. */
  total: string;
  ponderado: string;
  esCierre: boolean;
  oportunidades: DatosTarjeta[];
};

export function TableroKanban({
  columnas,
  accionVacio,
}: {
  columnas: ColumnaKanban[];
  accionVacio: React.ReactNode;
}) {
  const totalTarjetas = columnas.reduce((n, c) => n + c.oportunidades.length, 0);

  if (totalTarjetas === 0) {
    return (
      <EstadoVacio
        titulo="No hay oportunidades con estos filtros"
        explicacion="Puede que el filtro esté demasiado cerrado, o que todavía no tengas oportunidades asignadas. Recuerda que la visibilidad sigue al propietario, no a quien las creó."
        accion={accionVacio}
      />
    );
  }

  return (
    // Un solo scroll horizontal para todo el tablero: si cada columna tuviera
    // el suyo, arrastrar una tarjeta entre etapas sería imposible.
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columnas.map((c) => (
        <Columna key={c.etapaId} columna={c} />
      ))}
    </div>
  );
}

function Columna({ columna: c }: { columna: ColumnaKanban }) {
  return (
    <section
      aria-label={`Etapa ${c.nombre}`}
      className="flex w-72 shrink-0 flex-col rounded-md bg-superficie-sutil"
    >
      <header className="border-b border-borde px-3 py-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold text-texto-titulo">{c.nombre}</h2>
          <span className="tabular text-xs text-texto-tenue">
            {c.oportunidades.length} · {c.probabilidad}
          </span>
        </div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="tabular text-sm font-semibold text-texto-titulo">{c.total}</span>
          <span className="tabular text-xs text-texto-tenue">pond. {c.ponderado}</span>
        </div>
        {/* La etapa de cierre se marca: es donde el gate es más exigente. */}
        <div
          className={`mt-2 h-0.5 rounded-pill ${c.esCierre ? "bg-exito" : "bg-borde-fuerte"}`}
        />
      </header>

      <div className="flex flex-col gap-2 p-2">
        {c.oportunidades.map((o) => (
          <TarjetaOportunidad key={o.id} o={o} />
        ))}

        {c.oportunidades.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-texto-tenue">
            Sin oportunidades en esta etapa
          </p>
        )}
      </div>
    </section>
  );
}
