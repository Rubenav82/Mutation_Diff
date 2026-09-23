import { useState } from 'react';
import { isUndetected, shortMutatorName } from 'core';
import type { MutantChangeKind, MutantComparison, MutantStatus } from 'core';

/** Mismos términos que los KPI del resumen (`kpiGlossary`), para no nombrar un estado de dos formas. */
const STATUS_LABELS: Record<MutantStatus, string> = {
  killed: 'Killed',
  survived: 'Survived',
  no_coverage: 'Sin cubrir',
  timeout: 'Timeout',
  error: 'Error',
  ignored: 'Ignorado',
};

const KIND_LABELS: Record<MutantChangeKind, string> = {
  'newly-survived': 'Nuevo superviviente',
  'newly-killed': 'Ahora detectado',
  'newly-uncovered': 'Sin cobertura ahora',
  changed: 'Cambio de estado',
  added: 'Nuevo',
  removed: 'Eliminado',
};

/**
 * El color es del dato, como en el resto de tablas: perder un mutante (sobrevive,
 * o deja de estar cubierto) va en `loss`, detectarlo en `gain`, y el resto —sin
 * lectura buena o mala— en neutro. Misma forma de tag que el estado de la unidad.
 */
const KIND_CLASS: Record<MutantChangeKind, string> = {
  'newly-survived': 'border-loss text-loss',
  'newly-killed': 'border-gain text-gain',
  'newly-uncovered': 'border-loss text-loss',
  changed: 'border-line text-muted',
  added: 'border-line-strong text-ink',
  removed: 'border-line text-muted line-through',
};

const HEADER_CLASS = 'eyebrow border-b border-line px-3 py-2 text-left';
const CELL_CLASS = 'px-3 py-1.5 font-mono text-sm tabular-nums';

interface MutantChangesToggleProps {
  unitKey: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * Botón que abre el panel desde una fila. El nombre accesible lleva la clave de
 * la unidad: en una tabla hay uno por fila y «botón, contraído» no dice cuál.
 */
export function MutantChangesToggle({
  unitKey,
  count,
  expanded,
  onToggle,
}: MutantChangesToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-label={`Cambios de mutantes · ${unitKey}`}
      onClick={onToggle}
      className="inline-flex items-center gap-1 border border-line px-2 py-0.5 font-mono text-xs text-ink transition-colors hover:border-line-strong"
    >
      <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      {count}
    </button>
  );
}

interface MutantChangesPanelProps {
  unitKey: string;
  changes: MutantComparison[];
}

/**
 * Los mutantes de una unidad cuyo estado cambió entre las dos ejecuciones, en el
 * orden en que llegan de `core` (por línea). Es la respuesta a «qué dejó de
 * matarse y dónde», que el score de la fila no puede dar.
 */
export function MutantChangesPanel({ unitKey, changes }: MutantChangesPanelProps) {
  const [onlyUndetected, setOnlyUndetected] = useState(false);
  // `isUndetected` vive en `core` y lo comparten el panel y el informe exportado:
  // qué cuenta como una bajada de detección se define en un solo sitio.
  const visible = onlyUndetected ? changes.filter(isUndetected) : changes;

  return (
    <div className="border-l-2 border-ink bg-surface px-4 py-3">
      <label className="mb-2 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          aria-label={`Solo mutantes sin detectar · ${unitKey}`}
          checked={onlyUndetected}
          onChange={(event) => setOnlyUndetected(event.target.checked)}
        />
        Solo mutantes sin detectar
      </label>
      {visible.length === 0 ? (
        <p className="py-2 text-sm text-muted">Ningún mutante queda sin detectar.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className={HEADER_CLASS}>Línea</th>
              <th className={HEADER_CLASS}>Mutador</th>
              <th className={HEADER_CLASS}>Antes</th>
              <th className={HEADER_CLASS}>Ahora</th>
              <th className={HEADER_CLASS}>Cambio</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((change, index) => (
              <tr
                // Línea + mutador no es única (varios mutantes de un mutador en una
                // línea), y el orden es estable, así que el índice es la clave.
                key={index}
                data-change-kind={change.kind}
                className="border-b border-line last:border-0"
              >
                <td className={CELL_CLASS}>{change.line}</td>
                <td className={CELL_CLASS}>
                  <span title={change.mutator}>{shortMutatorName(change.mutator)}</span>
                  {change.description !== undefined && (
                    <span className="block font-sans text-xs text-muted">{change.description}</span>
                  )}
                </td>
                <td className={CELL_CLASS}>
                  {change.base === undefined ? '—' : STATUS_LABELS[change.base]}
                </td>
                <td className={CELL_CLASS}>
                  {change.head === undefined ? '—' : STATUS_LABELS[change.head]}
                </td>
                <td className={CELL_CLASS}>
                  <span
                    className={`inline-block border px-2 py-0.5 text-xs whitespace-nowrap ${KIND_CLASS[change.kind]}`}
                  >
                    {KIND_LABELS[change.kind]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
