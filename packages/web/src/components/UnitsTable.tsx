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
import { formatPct, formatSignedPct } from '../lib/format';

const KIND_LABELS: Record<UnitChangeKind, string> = {
  improved: 'Mejora ▲',
  regressed: 'Regresión ▼',
  unchanged: 'Igual',
  added: 'Nueva',
  removed: 'Eliminada',
};

const KIND_LABEL_CLASS: Record<UnitChangeKind, string> = {
  improved: 'text-green-700 dark:text-green-400',
  regressed: 'text-red-700 dark:text-red-400',
  unchanged: 'text-gray-500 dark:text-gray-400',
  added: 'text-blue-700 dark:text-blue-400',
  removed: 'text-gray-400 dark:text-gray-500 line-through',
};

function pctCell(value: number | undefined): string {
  return value === undefined ? '—' : formatPct(value);
}

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
    cell: ({ getValue }) => pctCell(getValue<number | undefined>()),
    sortUndefined: 'last',
  },
  {
    id: 'headScore',
    accessorFn: (unit) => unit.head?.score,
    header: 'Score nuevo',
    cell: ({ getValue }) => pctCell(getValue<number | undefined>()),
    sortUndefined: 'last',
  },
  {
    id: 'scoreDelta',
    accessorFn: (unit) => unit.scoreDelta ?? undefined,
    header: 'Δ Score',
    cell: ({ getValue }) => {
      const value = getValue<number | undefined>();
      return value === undefined ? '—' : formatSignedPct(value);
    },
    sortUndefined: 'last',
  },
  {
    id: 'kind',
    accessorKey: 'kind',
    header: 'Estado',
    cell: ({ row }) => (
      <span className={KIND_LABEL_CLASS[row.original.kind]}>{KIND_LABELS[row.original.kind]}</span>
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
      <h2 className="text-lg font-semibold">Todas las unidades</h2>
      <input
        type="search"
        aria-label="Filtrar por clase o paquete"
        placeholder="Filtrar por clase o paquete…"
        value={globalFilter}
        onChange={(event) => setGlobalFilter(event.target.value)}
        className="my-2 w-full max-w-sm rounded border border-gray-300 px-2 py-1 dark:border-gray-600"
      />
      <table className="w-full border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border-b border-gray-300 p-2 text-left">
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    className="font-semibold"
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
              className="border-b border-gray-200 dark:border-gray-700"
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-2 text-gray-500 dark:text-gray-400">
          {units.length === 0 ? 'No hay unidades.' : 'Ninguna unidad coincide con el filtro.'}
        </p>
      )}
    </section>
  );
}
