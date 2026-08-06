/**
 * Cinco primero y por defecto: en un proyecto grande, cada tabla del dashboard
 * llenaba varias pantallas y llegar a la siguiente costaba scroll. Cinco filas
 * dejan la comparación entera recorrible de un vistazo, y quien necesite más lo
 * sube aquí mismo.
 */
export const PAGE_SIZES = [5, 25, 50, 100] as const;

export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/**
 * «Todas» como tamaño de página en vez de un modo aparte: así la tabla sigue
 * gobernando la paginación ella sola —incluido el volver a la primera página al
 * filtrar— en lugar de tener que replicar esa lógica para un caso especial.
 */
export const ALL_ROWS = Number.MAX_SAFE_INTEGER;

const PAGE_BUTTON_CLASS =
  'border border-line px-3 py-1 text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-50';

interface TablePaginationProps {
  /**
   * Nombre de la tabla a la que pertenecen estos controles. El dashboard monta
   * cinco tablas, así que sin él habría cinco «Página siguiente» indistinguibles
   * para quien navegue por teclado o con lector de pantalla.
   */
  label: string;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  /** Filas que hay en la tabla, para decidir si estos controles aportan algo. */
  totalRows: number;
  onPageSizeChange: (pageSize: number) => void;
  onPreviousPage: () => void;
  onNextPage: () => void;
}

export function TablePagination({
  label,
  pageIndex,
  pageSize,
  pageCount,
  totalRows,
  onPageSizeChange,
  onPreviousPage,
  onNextPage,
}: TablePaginationProps) {
  // Por debajo del tamaño de página más pequeño no hay nada que paginar ni motivo
  // para cambiarlo: todas las filas están ya a la vista. La condición mira las
  // filas de la tabla y no el tamaño elegido, así que los controles no aparecen y
  // desaparecen mientras se escribe en un filtro.
  if (totalRows <= DEFAULT_PAGE_SIZE) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
      <label className="flex items-center gap-2">
        Filas por página
        {/* `appearance-none` para que el select no traiga el cromo nativo del
            sistema —bordes redondeados incluidos— dentro de un diseño de radio
            0; la flecha se repone al lado, decorativa. */}
        <span className="relative inline-flex items-center">
          <select
            aria-label={`Filas por página · ${label}`}
            value={pageSize === ALL_ROWS ? 'all' : String(pageSize)}
            onChange={(event) => {
              const { value } = event.target;
              onPageSizeChange(value === 'all' ? ALL_ROWS : Number(value));
            }}
            className="appearance-none border border-line bg-raised py-1 pr-7 pl-2 font-mono text-sm text-ink transition-colors hover:border-line-strong"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
            <option value="all">Todas</option>
          </select>
          <span aria-hidden="true" className="pointer-events-none absolute right-2 text-xs">
            ▾
          </span>
        </span>
      </label>

      {/* Con una sola página no hay navegación que ofrecer, pero el selector se
          queda: es la única forma de volver a «Todas» después. */}
      {pageCount > 1 && (
        <div className="flex items-center gap-3">
          <span className="font-mono tabular-nums">
            Página {pageIndex + 1} de {pageCount}
          </span>
          <button
            type="button"
            aria-label={`Página anterior · ${label}`}
            onClick={onPreviousPage}
            disabled={pageIndex === 0}
            className={PAGE_BUTTON_CLASS}
          >
            Anterior
          </button>
          <button
            type="button"
            aria-label={`Página siguiente · ${label}`}
            onClick={onNextPage}
            disabled={pageIndex >= pageCount - 1}
            className={PAGE_BUTTON_CLASS}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
