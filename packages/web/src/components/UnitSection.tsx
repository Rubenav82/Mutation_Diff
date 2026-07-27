import type { UnitComparison } from 'core';
import { formatOptionalPct, formatOptionalSignedPct } from '../lib/format';

interface UnitSectionProps {
  title: string;
  units: UnitComparison[];
  emptyMessage: string;
}

export function UnitSection({ title, units, emptyMessage }: UnitSectionProps) {
  return (
    <section aria-label={title}>
      {/* El espacio explícito importa: sin él el nombre accesible sería
          "Regresiones(2)" y JSX se come el salto de línea. */}
      <h2 className="mb-3">
        {title}{' '}
        <span className="font-mono text-sm font-normal text-muted tabular-nums">
          ({units.length})
        </span>
      </h2>
      {units.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-5 text-sm text-muted">
          {emptyMessage}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-raised">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="eyebrow border-b border-line bg-surface px-3 py-2.5 text-left">
                  Clase / fichero
                </th>
                <th className="eyebrow border-b border-line bg-surface px-3 py-2.5 text-left">
                  Score base
                </th>
                <th className="eyebrow border-b border-line bg-surface px-3 py-2.5 text-left">
                  Score nuevo
                </th>
                <th className="eyebrow border-b border-line bg-surface px-3 py-2.5 text-left">
                  Δ Score
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr
                  key={unit.key}
                  data-kind={unit.kind}
                  className="border-b border-line last:border-0 hover:bg-accent-soft/50"
                >
                  <td className="px-3 py-2 font-mono text-sm break-all">{unit.key}</td>
                  <td className="px-3 py-2 font-mono text-sm tabular-nums">
                    {formatOptionalPct(unit.base?.score)}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm tabular-nums">
                    {formatOptionalPct(unit.head?.score)}
                  </td>
                  <td className="px-3 py-2 font-mono text-sm tabular-nums">
                    {formatOptionalSignedPct(unit.scoreDelta)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
