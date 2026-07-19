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
      <h2 className="text-lg font-semibold">
        {title} ({units.length})
      </h2>
      {units.length === 0 ? (
        <p className="p-2 text-gray-500 dark:text-gray-400">{emptyMessage}</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-gray-300 p-2 text-left font-semibold">
                Clase / fichero
              </th>
              <th className="border-b border-gray-300 p-2 text-left font-semibold">Score base</th>
              <th className="border-b border-gray-300 p-2 text-left font-semibold">Score nuevo</th>
              <th className="border-b border-gray-300 p-2 text-left font-semibold">Δ Score</th>
            </tr>
          </thead>
          <tbody>
            {units.map((unit) => (
              <tr
                key={unit.key}
                data-kind={unit.kind}
                className="border-b border-gray-200 dark:border-gray-700"
              >
                <td className="p-2">{unit.key}</td>
                <td className="p-2">{formatOptionalPct(unit.base?.score)}</td>
                <td className="p-2">{formatOptionalPct(unit.head?.score)}</td>
                <td className="p-2">{formatOptionalSignedPct(unit.scoreDelta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
