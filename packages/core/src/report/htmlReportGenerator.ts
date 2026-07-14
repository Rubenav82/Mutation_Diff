import type { ComparisonResult, UnitChangeKind, UnitComparison } from '../domain/types.js';

const KIND_LABELS: Record<UnitChangeKind, string> = {
  improved: 'Mejora ▲',
  regressed: 'Regresión ▼',
  unchanged: 'Igual',
  added: 'Nueva',
  removed: 'Eliminada',
};

const STYLE = `
  :root { color-scheme: light dark; }
  body { font-family: system-ui, sans-serif; margin: 2rem; line-height: 1.4; }
  h1 { margin-bottom: 0.25rem; }
  .tool-badge { color: #666; margin-top: 0; }
  section { margin: 2rem 0; }
  .cards { display: flex; flex-wrap: wrap; gap: 1rem; }
  .card { border: 1px solid #ccc; border-radius: 8px; padding: 0.75rem 1rem; min-width: 8rem; }
  .card .label { display: block; font-size: 0.8rem; color: #666; }
  .card .value { display: block; font-size: 1.4rem; font-weight: 600; }
  .card.positive .value { color: #2e7d32; }
  .card.negative .value { color: #c62828; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; }
  tr.kind-regressed td:last-child { color: #c62828; }
  tr.kind-improved td:last-child { color: #2e7d32; }
  .empty { color: #666; font-style: italic; }
`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatDelta(value: number | null): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

function deltaCardClass(value: number): string {
  if (value > 0) return 'positive';
  if (value < 0) return 'negative';
  return '';
}

function renderUnitRow(unit: UnitComparison): string {
  const baseScore = unit.base ? formatPct(unit.base.score) : '—';
  const headScore = unit.head ? formatPct(unit.head.score) : '—';
  return `<tr class="kind-${unit.kind}"><td>${escapeHtml(unit.key)}</td><td>${baseScore}</td><td>${headScore}</td><td>${formatDelta(unit.scoreDelta)}</td><td>${escapeHtml(KIND_LABELS[unit.kind])}</td></tr>`;
}

function renderTable(title: string, units: UnitComparison[], emptyMessage: string): string {
  if (units.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="empty">${escapeHtml(emptyMessage)}</p></section>`;
  }
  const rows = units.map(renderUnitRow).join('');
  return `<section><h2>${escapeHtml(title)} (${units.length})</h2><table><thead><tr><th>Clase / fichero</th><th>Score base</th><th>Score nuevo</th><th>&Delta; Score</th><th>Estado</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderSummary(result: ComparisonResult): string {
  const { global } = result;
  return `<section><h2>Resumen</h2><div class="cards">
    <div class="card"><span class="label">Score base</span><span class="value">${formatPct(global.base.score)}</span></div>
    <div class="card"><span class="label">Score nuevo</span><span class="value">${formatPct(global.head.score)}</span></div>
    <div class="card ${deltaCardClass(global.scoreDelta)}"><span class="label">&Delta; Score</span><span class="value">${formatDelta(global.scoreDelta)}</span></div>
    <div class="card"><span class="label">Cobertura base</span><span class="value">${formatPct(global.base.coveredPct)}</span></div>
    <div class="card"><span class="label">Cobertura nueva</span><span class="value">${formatPct(global.head.coveredPct)}</span></div>
    <div class="card ${deltaCardClass(global.coverageDelta)}"><span class="label">&Delta; Cobertura</span><span class="value">${formatDelta(global.coverageDelta)}</span></div>
  </div></section>`;
}

export function generateHtmlReport(result: ComparisonResult): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>MutaDiff — Informe de comparación (${escapeHtml(result.tool)})</title>
<style>${STYLE}</style>
</head>
<body>
<h1>Informe de comparación MutaDiff</h1>
<p class="tool-badge">Herramienta: ${escapeHtml(result.tool)}</p>
${renderSummary(result)}
${renderTable('Regresiones', result.regressions, 'No hay regresiones.')}
${renderTable('Sin cobertura', result.uncovered, 'No hay clases/ficheros sin cobertura.')}
${renderTable('Todas las unidades', result.units, 'No hay unidades.')}
</body>
</html>`;
}
