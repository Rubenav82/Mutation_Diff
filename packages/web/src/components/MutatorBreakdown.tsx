import { shortMutatorName } from 'core';
import type { MutatorComparison } from 'core';
import { formatOptionalPct, formatSignedCount, trendVariant } from '../lib/format';

const TITLE = 'Por mutador';

const HEADER_CLASS = 'eyebrow border-b-2 border-ink px-3 py-2.5 text-left';
const CELL_CLASS = 'px-3 py-2 font-mono text-sm tabular-nums';

const VARIANT_CLASS = {
  positive: 'text-gain',
  negative: 'text-loss',
  neutral: 'text-muted',
} as const;

function count(value: number | undefined): string {
  return value === undefined ? '—' : String(value);
}

/**
 * Qué mutadores producen los supervivientes. Es la pregunta de quien ve un
 * score estancado y se plantea excluir alguno de la configuración de
 * PiTest/Stryker. Sin filtro ni orden: la lista es corta (una decena en
 * PiTest, unas pocas decenas en Stryker) y viene ya ordenada de `core` por
 * supervivientes en la ejecución nueva.
 */
export function MutatorBreakdown({ mutators }: { mutators: MutatorComparison[] }) {
  return (
    <section aria-label={TITLE}>
      {/* El espacio explícito importa: sin él el nombre accesible sería
          "Por mutador4" y JSX se come el salto de línea. */}
      <h2 className="mb-3 flex items-center gap-2">
        {TITLE}{' '}
        <span className="bg-deep px-2 py-0.5 font-mono text-xs font-normal text-inverse tabular-nums">
          {mutators.length}
        </span>
      </h2>
      {mutators.length === 0 ? (
        <p className="border-2 border-dashed border-line px-4 py-5 text-sm text-muted">
          No hay mutantes.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse bg-raised text-sm">
            <thead>
              <tr>
                <th className={HEADER_CLASS}>Mutador</th>
                <th className={HEADER_CLASS}>Mutantes</th>
                <th className={HEADER_CLASS}>Survivors base</th>
                <th className={HEADER_CLASS}>Survivors nueva</th>
                <th className={HEADER_CLASS}>Δ Survivors</th>
                <th className={HEADER_CLASS}>Score nueva</th>
              </tr>
            </thead>
            <tbody>
              {mutators.map((entry) => {
                // Más supervivientes es peor: misma polaridad que el KPI «Survivors».
                const variant =
                  entry.survivedDelta === null
                    ? 'neutral'
                    : trendVariant(entry.survivedDelta, 'higher-worse');
                return (
                  <tr
                    key={entry.mutator}
                    className="border-b border-line last:border-0 hover:bg-wash"
                  >
                    <td className={`${CELL_CLASS} break-all`}>
                      <span title={entry.mutator}>{shortMutatorName(entry.mutator)}</span>
                    </td>
                    <td className={CELL_CLASS}>{count(entry.head?.total)}</td>
                    <td className={CELL_CLASS}>{count(entry.base?.survived)}</td>
                    <td className={CELL_CLASS}>{count(entry.head?.survived)}</td>
                    <td
                      className={`${CELL_CLASS} ${VARIANT_CLASS[variant]}`}
                      data-variant={variant}
                    >
                      {entry.survivedDelta === null ? '—' : formatSignedCount(entry.survivedDelta)}
                    </td>
                    <td className={CELL_CLASS}>{formatOptionalPct(entry.head?.score)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
