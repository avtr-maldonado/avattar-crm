import { clsx } from "clsx";

/**
 * La etapa actual como barra de progreso · §11 P-02.
 *
 * Muestra el camino completo, no solo dónde está: un vendedor que ve las cinco
 * etapas sabe cuánto le falta; uno que solo ve «Negociación» no sabe si eso es
 * bueno.
 *
 * ## Por qué no es un `switch` por nombre
 *
 * INV-13 · las etapas son datos. Este componente recibe la lista que trae el
 * pipeline y no conoce ni un nombre: agregar una etapa en Administración se
 * refleja aquí sin tocar código.
 *
 * ## El color de lo alcanzado
 *
 * Azul de marca hasta la etapa actual, no verde. El verde está reservado al
 * margen sobre el piso (§13.1), y usarlo aquí diluiría la señal que más
 * importa: alguien vería verde en el encabezado y creería que hay algo bien
 * cuando solo significa que avanzó de etapa.
 */
export type EtapaDeBarra = {
  id: string;
  name: string;
  position: number;
  /** Ya formateada: «75 %». */
  probabilidad: string;
  isClosing: boolean;
};

export function BarraDeEtapas({
  etapas,
  etapaActualId,
  cerrada,
}: {
  etapas: EtapaDeBarra[];
  etapaActualId: string;
  /** Ganada o perdida: el camino deja de estar en curso. */
  cerrada?: "GANADA" | "PERDIDA";
}) {
  const indiceActual = etapas.findIndex((e) => e.id === etapaActualId);

  return (
    <ol className="flex items-stretch gap-1" aria-label="Avance por etapa">
      {etapas.map((etapa, i) => {
        const alcanzada = i <= indiceActual;
        const esActual = i === indiceActual;

        return (
          <li key={etapa.id} className="min-w-0 flex-1">
            <div
              className={clsx(
                "h-1 rounded-pill",
                cerrada === "PERDIDA" && alcanzada
                  ? "bg-gray-40"
                  : cerrada === "GANADA" && alcanzada
                    ? "bg-exito"
                    : alcanzada
                      ? "bg-acento"
                      : "bg-borde",
              )}
            />
            <p
              className={clsx(
                "mt-1.5 truncate text-xs",
                esActual
                  ? "font-semibold text-texto-titulo"
                  : alcanzada
                    ? "text-texto-cuerpo"
                    : "text-texto-tenue",
              )}
              // El nombre completo, para cuando la columna lo recorta.
              title={`${etapa.name} · ${etapa.probabilidad}`}
            >
              {etapa.name}
            </p>
            <p className="tabular truncate text-xs text-texto-tenue">
              {etapa.probabilidad}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
