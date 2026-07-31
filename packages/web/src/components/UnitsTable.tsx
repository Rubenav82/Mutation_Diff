import { useMemo, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { Tool, UnitChangeKind, UnitComparison } from 'core';
import { formatOptionalPct, formatOptionalSignedPct, splitUnitKey } from '../lib/format';

const KIND_LABELS: Record<UnitChangeKind, string> = {
  improved: 'Mejora ▲',
  regressed: 'Retroceso ▼',
  unchanged: 'Igual',
  added: 'Nueva',
  removed: 'Eliminada',
};

/** Tag rectangular: borde del color del dato, sin relleno que compita con la fila. */
const KIND_LABEL_CLASS: Record<UnitChangeKind, string> = {
  improved: 'border-gain text-gain',
  regressed: 'border-loss text-loss',
  unchanged: 'border-line text-muted',
  added: 'border-line-strong text-ink',
  removed: 'border-line text-muted line-through',
};

/**
 * Nombre completo de cada columna, para el `aria-label` del botón de ordenar.
 * Dentro de un grupo el encabezado visible es «Base»/«Nueva»/«Δ», que fuera de
 * su columna no dice nada: un lector de pantalla anunciaría «botón Δ».
 */
const SORT_LABELS: Record<string, string> = {
  key: 'Clase / fichero',
  baseScore: 'Score base',
  headScore: 'Score nuevo',
  scoreDelta: 'Δ Score',
  baseCovered: 'Cubiertos base',
  headCovered: 'Cubiertos nuevos',
  coverageDelta: 'Δ Cubiertos',
  kind: 'Estado',
};

const PAGE_SIZES = [25, 50, 100] as const;

/**
 * «Todas» como tamaño de página en vez de un modo aparte: así la tabla sigue
 * gobernando la paginación ella sola —incluido el volver a la primera página al
 * filtrar— en lugar de tener que replicar esa lógica para un caso especial.
 */
const ALL_ROWS = Number.MAX_SAFE_INTEGER;

const PAGE_BUTTON_CLASS =
  'border border-line px-3 py-1 text-ink transition-colors hover:border-line-strong disabled:cursor-not-allowed disabled:border-line disabled:text-muted disabled:opacity-50';

const buildColumns = (tool: Tool): ColumnDef<UnitComparison>[] => [
  {
    id: 'key',
    accessorKey: 'key',
    header: 'Clase / fichero',
    // Solo se recorta el paquete, que se repite fila tras fila; el nombre simple
    // —lo que distingue una fila de otra— se mantiene entero. Sin tope, un FQCN
    // largo estira la tabla y obliga a scrollear en horizontal para ver el score.
    cell: ({ getValue }) => {
      const key = getValue<string>();
      const { prefix, name } = splitUnitKey(key, tool);
      return (
        <span title={key} className="flex max-w-88">
          {prefix !== '' && (
            // `direction: rtl` recorta por la izquierda: entre dos clases del
            // mismo proyecto, lo que las distingue es el final del paquete, no
            // el `es.example.` que comparten todas.
            <span className="truncate text-left text-muted [direction:rtl]">{prefix}</span>
          )}
          <span className="shrink-0">{name}</span>
        </span>
      );
    },
  },
  {
    id: 'score',
    header: 'Score',
    columns: [
      {
        id: 'baseScore',
        accessorFn: (unit) => unit.base?.score,
        header: 'Base',
        cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
      {
        id: 'headScore',
        accessorFn: (unit) => unit.head?.score,
        header: 'Nueva',
        cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
      {
        id: 'scoreDelta',
        accessorFn: (unit) => unit.scoreDelta ?? undefined,
        header: 'Δ',
        cell: ({ getValue }) => formatOptionalSignedPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
    ],
  },
  {
    // «Mutantes cubiertos», nunca «Cobertura»: es
    // (válidos − sin cubrir) / válidos, no el Line Coverage de PiTest, que no
    // está en el informe. Etiquetarlo «Cobertura» junto a una columna de score
    // invita justo a esa comparación equivocada.
    id: 'covered',
    header: 'Mutantes cubiertos',
    columns: [
      {
        id: 'baseCovered',
        accessorFn: (unit) => unit.base?.coveredPct,
        header: 'Base',
        cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
      {
        id: 'headCovered',
        accessorFn: (unit) => unit.head?.coveredPct,
        header: 'Nueva',
        cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
      {
        id: 'coverageDelta',
        accessorFn: (unit) => unit.coverageDelta ?? undefined,
        header: 'Δ',
        cell: ({ getValue }) => formatOptionalSignedPct(getValue<number | undefined>()),
        sortUndefined: 'last',
      },
    ],
  },
  {
    id: 'kind',
    accessorKey: 'kind',
    header: 'Estado',
    cell: ({ row }) => (
      <span
        className={`inline-block border px-2 py-0.5 text-xs whitespace-nowrap ${KIND_LABEL_CLASS[row.original.kind]}`}
      >
        {KIND_LABELS[row.original.kind]}
      </span>
    ),
  },
];

export function UnitsTable({ units, tool }: { units: UnitComparison[]; tool: Tool }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  // El separador de la clave depende de la herramienta, así que las columnas se
  // rehacen solo cuando esta cambia.
  const columns = useMemo(() => buildColumns(tool), [tool]);

  const table = useReactTable({
    data: units,
    columns,
    state: { sorting, globalFilter },
    // First click sorts ascending on every column: for Δ Score that surfaces
    // the most severe drop first, mirroring how core orders `regressions`.
    sortDescFirst: false,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.key.toLowerCase().includes(String(filterValue).toLowerCase()),
    // Con miles de unidades, montarlas todas de golpe cuesta caro y no hay
    // quien las recorra. La tabla se queda con el estado de paginación, así que
    // filtrar u ordenar vuelve a la primera página sin código propio.
    initialState: { pagination: { pageIndex: 0, pageSize: PAGE_SIZES[0] } },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const rows = table.getRowModel().rows;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <section aria-label="Todas las unidades">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {/* El espacio explícito importa: sin él el nombre accesible sería
            "Todas las unidades4" y JSX se come el salto de línea. */}
        <h2 className="flex items-center gap-2">
          Todas las unidades{' '}
          <span className="bg-deep px-2 py-0.5 font-mono text-xs font-normal text-inverse tabular-nums">
            {table.getFilteredRowModel().rows.length}
          </span>
        </h2>
        <input
          type="search"
          aria-label="Filtrar por clase o paquete"
          placeholder="Filtrar por clase o paquete…"
          value={globalFilter}
          onChange={(event) => setGlobalFilter(event.target.value)}
          className="w-full max-w-xs border border-line bg-raised px-3 py-1.5 font-mono text-sm text-ink transition-colors hover:border-line-strong"
        />
      </div>
      <div className="overflow-x-auto">
        {/* `min-w-max`: con ocho columnas, repartir un ancho fijo parte los
            nombres de clase a mitad de palabra. Las columnas se dimensionan por
            su contenido y, si no caben, scrollea el contenedor de arriba. */}
        <table className="w-full min-w-max border-collapse bg-raised text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup, groupIndex, groups) => {
              // La regla de 2px cierra la cabecera entera, así que va solo en la
              // última fila; la de arriba separa los grupos con una línea fina.
              const isLastRow = groupIndex === groups.length - 1;
              return (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      className={`p-0 text-left ${
                        isLastRow ? 'border-b-2 border-ink' : 'border-b border-line'
                      }`}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          aria-label={`Ordenar por ${SORT_LABELS[header.column.id] ?? ''}`}
                          className="eyebrow w-full px-3 py-2.5 text-left whitespace-nowrap transition-colors hover:text-ink"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc'
                            ? ' ↑'
                            : header.column.getIsSorted() === 'desc'
                              ? ' ↓'
                              : ''}
                        </button>
                      ) : (
                        // Cabecera de grupo: rotula, no ordena. Centrada sobre
                        // las tres columnas que abarca.
                        <span className="eyebrow block px-3 py-2.5 text-center whitespace-nowrap">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              );
            })}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                data-kind={row.original.kind}
                className="border-b border-line last:border-0 hover:bg-wash"
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    className="px-3 py-2 font-mono text-sm whitespace-nowrap tabular-nums"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-muted">
            {units.length === 0 ? 'No hay unidades.' : 'Ninguna unidad coincide con el filtro.'}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <label className="flex items-center gap-2">
          Filas por página
          {/* `appearance-none` para que el select no traiga el cromo nativo del
              sistema —bordes redondeados incluidos— dentro de un diseño de radio
              0; la flecha se repone al lado, decorativa. */}
          <span className="relative inline-flex items-center">
            <select
              aria-label="Filas por página"
              value={pageSize === ALL_ROWS ? 'all' : String(pageSize)}
              onChange={(event) => {
                const { value } = event.target;
                table.setPageSize(value === 'all' ? ALL_ROWS : Number(value));
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
              aria-label="Página anterior"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={PAGE_BUTTON_CLASS}
            >
              Anterior
            </button>
            <button
              type="button"
              aria-label="Página siguiente"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={PAGE_BUTTON_CLASS}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
