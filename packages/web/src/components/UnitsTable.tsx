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
  regressed: 'Regresión ▼',
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

const COLUMNS: ColumnDef<UnitComparison>[] = [
  {
    id: 'key',
    accessorKey: 'key',
    header: 'Clase / fichero',
  },
  {
    id: 'baseScore',
    accessorFn: (unit) => unit.base?.score,
    header: 'Score base',
    cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
    sortUndefined: 'last',
  },
  {
    id: 'headScore',
    accessorFn: (unit) => unit.head?.score,
    header: 'Score nuevo',
    cell: ({ getValue }) => formatOptionalPct(getValue<number | undefined>()),
    sortUndefined: 'last',
  },
  {
    id: 'scoreDelta',
    accessorFn: (unit) => unit.scoreDelta ?? undefined,
    header: 'Δ Score',
    cell: ({ getValue }) => formatOptionalSignedPct(getValue<number | undefined>()),
    sortUndefined: 'last',
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
        <table className="w-full border-collapse bg-raised text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="border-b-2 border-ink p-0 text-left first:w-1/2">
                    <button
                      type="button"
                      onClick={header.column.getToggleSortingHandler()}
                      className="eyebrow w-full px-3 py-2.5 text-left whitespace-nowrap transition-colors hover:text-ink"
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'
                        ? ' ↑'
                        : header.column.getIsSorted() === 'desc'
                          ? ' ↓'
                          : ''}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
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
                    className="px-3 py-2 font-mono text-sm tabular-nums first:break-all"
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
