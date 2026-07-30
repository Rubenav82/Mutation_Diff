import { useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import type { UnitChangeKind, UnitComparison } from 'core';
import { formatOptionalPct, formatOptionalSignedPct } from '../lib/format';

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

const COLUMNS: ColumnDef<UnitComparison>[] = [
  {
    id: 'key',
    accessorKey: 'key',
    header: 'Clase / fichero',
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

export function UnitsTable({ units }: { units: UnitComparison[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const table = useReactTable({
    data: units,
    columns: COLUMNS,
    state: { sorting, globalFilter },
    // First click sorts ascending on every column: for Δ Score that surfaces
    // the most severe drop first, mirroring how core orders `regressions`.
    sortDescFirst: false,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue) =>
      row.original.key.toLowerCase().includes(String(filterValue).toLowerCase()),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  return (
    <section aria-label="Todas las unidades">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2>Todas las unidades</h2>
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
    </section>
  );
}
