import type { ComparisonResult, UnitChangeKind, UnitComparison } from '../domain/types.js';

const KIND_LABELS: Record<UnitChangeKind, string> = {
  improved: 'Mejora ▲',
  regressed: 'Retroceso ▼',
  unchanged: 'Igual',
  added: 'Nueva',
  removed: 'Eliminada',
};

/**
 * Modernist, el mismo sistema visual que la SPA: radio 0, reglas de 2px,
 * monoespaciada para toda medida y el par verde/rojo emparejado en contraste
 * (6.67:1 y 6.41:1 sobre el fondo) para que una mejora no cante más que una
 * retroceso.
 *
 * Los valores están duplicados a mano desde `packages/web/src/index.css`, y no
 * hay forma de evitarlo: `core` no puede importar de `web` (regla de
 * dependencias) y el informe debe ser un fichero único sin hojas externas
 * (CA-HU-07). Si cambia la paleta, hay que tocar los dos sitios.
 *
 * Sin banda oscura, a diferencia del dashboard: esto es un documento para
 * compartir o imprimir.
 */
const STYLE = `
  :root { color-scheme: light; }
  body {
    font-family: 'Segoe UI Variable Text', 'Segoe UI', -apple-system, system-ui, sans-serif;
    background: #f3f2f2; color: #201e1d; margin: 0; padding: 2.5rem 2rem; line-height: 1.5;
  }
  h1, h2 { font-weight: 800; letter-spacing: -0.015em; line-height: 1.12; }
  h1 { font-size: 2rem; margin: 0 0 0.75rem; }
  h2 { font-size: 1.25rem; margin: 0 0 0.75rem; }
  header { border-bottom: 2px solid #201e1d; padding-bottom: 1.25rem; margin-bottom: 2rem; }
  .meta { font-family: ui-monospace, Consolas, monospace; font-size: 0.8125rem; color: #605d5d; margin: 0.35rem 0 0; }
  .meta .file { color: #201e1d; }
  section { margin: 2.5rem 0; }
  /* Grid, no flex-wrap: con flex, la última tarjeta de una fila incompleta se
     estira a lo ancho y rompe la retícula. */
  .cards {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
    gap: 1px; background: #d7d3d3; border-top: 2px solid #201e1d;
  }
  .card { background: #fff; padding: 0.75rem 1rem; }
  .card .label {
    display: block; font-family: ui-monospace, Consolas, monospace; font-size: 0.6875rem;
    letter-spacing: 0.14em; text-transform: uppercase; color: #605d5d;
  }
  .card .value {
    display: block; font-family: ui-monospace, Consolas, monospace; font-size: 1.5rem;
    font-weight: 600; font-variant-numeric: tabular-nums; margin-top: 0.25rem;
  }
  .card.positive .value { color: #14622f; }
  .card.negative .value { color: #ae1800; }
  table { border-collapse: collapse; width: 100%; background: #fff; }
  th {
    font-family: ui-monospace, Consolas, monospace; font-size: 0.6875rem; font-weight: 500;
    letter-spacing: 0.14em; text-transform: uppercase; color: #605d5d;
    border-bottom: 2px solid #201e1d;
  }
  th, td { padding: 0.5rem 0.75rem; text-align: left; }
  /* Cabecera de grupo (Score / Mutantes cubiertos): centrada sobre sus columnas. */
  th[colspan] { text-align: center; }
  td { border-bottom: 1px solid #d7d3d3; font-family: ui-monospace, Consolas, monospace; font-size: 0.8125rem; font-variant-numeric: tabular-nums; }
  tbody tr:last-child td { border-bottom: 0; }
  tr.kind-regressed td:last-child { color: #ae1800; }
  tr.kind-improved td:last-child { color: #14622f; }
  .empty { color: #605d5d; font-style: italic; }

  /* El PDF se obtiene imprimiendo este mismo documento, así que la paginación
     es responsabilidad del informe. Con miles de unidades la tabla completa
     ocupa decenas de páginas, y sin estas reglas cada una llegaría sin
     cabecera y con filas partidas por la mitad. */
  @media print {
    @page { margin: 1.5cm; }
    /* Chrome descarta los fondos al imprimir: las tarjetas del resumen se
       separan con un "background" (el hueco de 1px de la retícula), no con un
       "border", así que sin esto se funden en un bloque. */
    body {
      background: #fff; padding: 0;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    .card { break-inside: avoid; }
    h2 { break-after: avoid; }
    section { margin: 1.5rem 0; break-before: auto; }
  }
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

/**
 * Which metric a table puts next to each unit. Each section shows the one that
 * explains why its units are there: score for the regressions, covered mutants
 * for the uncovered ones. Only the full table shows both.
 */
type TableMetric = 'score' | 'covered' | 'both';

function scoreCells(unit: UnitComparison): string {
  const base = unit.base ? formatPct(unit.base.score) : '—';
  const head = unit.head ? formatPct(unit.head.score) : '—';
  return `<td>${base}</td><td>${head}</td><td>${formatDelta(unit.scoreDelta)}</td>`;
}

function coveredCells(unit: UnitComparison): string {
  const base = unit.base ? formatPct(unit.base.coveredPct) : '—';
  const head = unit.head ? formatPct(unit.head.coveredPct) : '—';
  return `<td>${base}</td><td>${head}</td><td>${formatDelta(unit.coverageDelta)}</td>`;
}

function renderUnitRow(unit: UnitComparison, metric: TableMetric): string {
  const score = metric === 'covered' ? '' : scoreCells(unit);
  const covered = metric === 'score' ? '' : coveredCells(unit);
  return `<tr class="kind-${unit.kind}"><td>${escapeHtml(unit.key)}</td>${score}${covered}<td>${escapeHtml(KIND_LABELS[unit.kind])}</td></tr>`;
}

const SCORE_HEAD =
  '<thead><tr><th>Clase / fichero</th><th>Score base</th><th>Score nuevo</th><th>&Delta; Score</th><th>Estado</th></tr></thead>';

const COVERED_HEAD =
  '<thead><tr><th>Clase / fichero</th><th>Cubiertos base</th><th>Cubiertos nuevos</th><th>&Delta; Cubiertos</th><th>Estado</th></tr></thead>';

/**
 * Two header rows so eight columns read as two groups of three instead of a wall
 * of similar labels. Only the full table uses it.
 */
const GROUPED_HEAD =
  '<thead><tr><th rowspan="2">Clase / fichero</th><th colspan="3">Score</th><th colspan="3">Mutantes cubiertos</th><th rowspan="2">Estado</th></tr><tr><th>Base</th><th>Nueva</th><th>&Delta;</th><th>Base</th><th>Nueva</th><th>&Delta;</th></tr></thead>';

const HEADS: Record<TableMetric, string> = {
  score: SCORE_HEAD,
  covered: COVERED_HEAD,
  both: GROUPED_HEAD,
};

/**
 * Only the full table shows both metrics: the sections are short lists focused on
 * one reason each, and three more cells on every row of all four tables would eat
 * most of the 2 MB budget of CA-HU-07 (a report where every unit regressed renders
 * each row twice).
 */
function renderTable(
  title: string,
  units: UnitComparison[],
  emptyMessage: string,
  metric: TableMetric = 'score',
): string {
  if (units.length === 0) {
    return `<section><h2>${escapeHtml(title)}</h2><p class="empty">${escapeHtml(emptyMessage)}</p></section>`;
  }
  const rows = units.map((unit) => renderUnitRow(unit, metric)).join('');
  return `<section><h2>${escapeHtml(title)} (${units.length})</h2><table>${HEADS[metric]}<tbody>${rows}</tbody></table></section>`;
}

function renderSummary(result: ComparisonResult): string {
  const { global } = result;
  return `<section><h2>Resumen</h2><div class="cards">
    <div class="card"><span class="label">Score base</span><span class="value">${formatPct(global.base.score)}</span></div>
    <div class="card"><span class="label">Score nuevo</span><span class="value">${formatPct(global.head.score)}</span></div>
    <div class="card ${deltaCardClass(global.scoreDelta)}"><span class="label">&Delta; Score</span><span class="value">${formatDelta(global.scoreDelta)}</span></div>
    <div class="card"><span class="label">Cubiertos base</span><span class="value">${formatPct(global.base.coveredPct)}</span></div>
    <div class="card"><span class="label">Cubiertos nuevos</span><span class="value">${formatPct(global.head.coveredPct)}</span></div>
    <div class="card ${deltaCardClass(global.coverageDelta)}"><span class="label">&Delta; Cubiertos</span><span class="value">${formatDelta(global.coverageDelta)}</span></div>
  </div></section>`;
}

/**
 * Header block, not a `<section>`: CA-HU-07 fixes the report at exactly four
 * sections, and the context is a caption for the whole document rather than a
 * fifth one.
 */
function renderContext(result: ComparisonResult): string {
  const { baseLabel, headLabel, regressionThreshold, uncoveredThreshold } = result.context;
  const base = escapeHtml(baseLabel ?? 'Sin nombre');
  const head = escapeHtml(headLabel ?? 'Sin nombre');
  return `<p class="meta">Herramienta: ${escapeHtml(result.tool)}</p>
<p class="meta"><span class="file">${base}</span> &rarr; <span class="file">${head}</span></p>
<p class="meta">Umbral de retroceso: ${regressionThreshold}% &middot; Umbral sin cobertura: ${uncoveredThreshold}%</p>`;
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
<header>
<h1>Informe de comparación MutaDiff</h1>
${renderContext(result)}
</header>
${renderSummary(result)}
${renderTable('Retrocesos', result.regressions, 'No hay retrocesos.')}
${renderTable('Sin cobertura', result.uncovered, 'No hay clases/ficheros sin cobertura.', 'covered')}
${renderTable('Todas las unidades', result.units, 'No hay unidades.', 'both')}
</body>
</html>`;
}
