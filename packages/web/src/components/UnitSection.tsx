import type { UnitComparison } from 'core';
import { formatOptionalPct, formatOptionalSignedPct } from '../lib/format';

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
              {units.map((unit) => (
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
      )}
    </section>
  );
}
