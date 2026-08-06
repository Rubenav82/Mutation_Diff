import { useState } from 'react';
import type { UnitComparison } from 'core';
import { formatOptionalPct, formatOptionalSignedPct } from '../lib/format';
import { DEFAULT_PAGE_SIZE, TablePagination } from './TablePagination';

/**
 * Métrica que la sección pone junto a cada unidad: la que explica por qué esas
 * unidades están ahí. Score para los retrocesos, cubiertos para las que no
 * tienen cobertura.
 */
type SectionMetric = 'score' | 'covered';

const HEADERS: Record<SectionMetric, [string, string, string]> = {
  score: ['Score base', 'Score nuevo', 'Δ Score'],
  covered: ['Cubiertos base', 'Cubiertos nuevos', 'Δ Cubiertos'],
};

interface UnitSectionProps {
  title: string;
  units: UnitComparison[];
  emptyMessage: string;
  metric?: SectionMetric;
}

export function UnitSection({ title, units, emptyMessage, metric = 'score' }: UnitSectionProps) {
  const [baseHeader, headHeader, deltaHeader] = HEADERS[metric];
  const valueOf = (unit: UnitComparison, side: 'base' | 'head') =>
    metric === 'covered' ? unit[side]?.coveredPct : unit[side]?.score;
  const deltaOf = (unit: UnitComparison) =>
    metric === 'covered' ? unit.coverageDelta : unit.scoreDelta;

  // Paginación propia y no una `UnitsTable` reutilizada: las secciones no llevan
  // filtro ni orden —el orden que traen es el que explica por qué están ahí, y
  // reordenarlas lo rompería—, así que un `useState` y un `slice` bastan.
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(units.length / pageSize));
  // Recortado en vez de reajustado con un efecto: volver a comparar puede traer
  // menos unidades y dejar la página actual fuera de rango, y una tabla vacía con
  // datos que sí están es peor que un render de más.
  const currentPage = Math.min(pageIndex, pageCount - 1);
  const visibleUnits = units.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return (
    <section aria-label={title}>
      {/* El espacio explícito importa: sin él el nombre accesible sería
          "Retrocesos2" y JSX se come el salto de línea. */}
      <h2 className="mb-3 flex items-center gap-2">
        {title}{' '}
        <span className="bg-deep px-2 py-0.5 font-mono text-xs font-normal text-inverse tabular-nums">
          {units.length}
        </span>
      </h2>
      {units.length === 0 ? (
        <p className="border-2 border-dashed border-line px-4 py-5 text-sm text-muted">
          {emptyMessage}
        </p>
      ) : (
        <>
          {/* Los controles van fuera del contenedor que scrollea: con una clave
              larga, dentro se irían de la vista junto con la tabla. */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse bg-raised text-sm">
              <thead>
                <tr>
                  <th className="eyebrow border-b-2 border-ink px-3 py-2.5 text-left">
                    Clase / fichero
                  </th>
                  <th className="eyebrow border-b-2 border-ink px-3 py-2.5 text-left">
                    {baseHeader}
                  </th>
                  <th className="eyebrow border-b-2 border-ink px-3 py-2.5 text-left">
                    {headHeader}
                  </th>
                  <th className="eyebrow border-b-2 border-ink px-3 py-2.5 text-left">
                    {deltaHeader}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleUnits.map((unit) => (
                  <tr
                    key={unit.key}
                    data-kind={unit.kind}
                    className="border-b border-line last:border-0 hover:bg-wash"
                  >
                    <td className="px-3 py-2 font-mono text-sm break-all">{unit.key}</td>
                    <td className="px-3 py-2 font-mono text-sm tabular-nums">
                      {formatOptionalPct(valueOf(unit, 'base'))}
                    </td>
                    <td className="px-3 py-2 font-mono text-sm tabular-nums">
                      {formatOptionalPct(valueOf(unit, 'head'))}
                    </td>
                    <td className="px-3 py-2 font-mono text-sm tabular-nums">
                      {formatOptionalSignedPct(deltaOf(unit))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            label={title}
            pageIndex={currentPage}
            pageSize={pageSize}
            pageCount={pageCount}
            totalRows={units.length}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
            onPreviousPage={() => setPageIndex(currentPage - 1)}
            onNextPage={() => setPageIndex(currentPage + 1)}
          />
        </>
      )}
    </section>
  );
}
