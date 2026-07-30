import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { generateHtmlReport, type ComparisonResult } from 'core';
import { ComparisonError, getComparison } from '../lib/comparisons';
import { ComparisonContextRail } from '../components/ComparisonContextRail';
import { ErrorMessage } from '../components/ErrorMessage';
import { KpiRow } from '../components/KpiRow';
import { LoadingIndicator } from '../components/LoadingIndicator';
import { SummaryBand } from '../components/SummaryBand';
import { UnitSection } from '../components/UnitSection';
import { UnitsTable } from '../components/UnitsTable';

export function ComparisonDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // Bumped by the retry button; re-runs the effect without duplicating the fetch.
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    getComparison(id)
      .then((res) => {
        if (!cancelled) setResult(res);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof ComparisonError
              ? err.message
              : 'Error inesperado al cargar la comparación',
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadToken]);

  if (isLoading) {
    return <LoadingIndicator label="Cargando comparación…" />;
  }
  if (error) {
    return <ErrorMessage message={error} onRetry={() => setReloadToken((token) => token + 1)} />;
  }
  if (!result || !id) {
    return null;
  }

  // Built on click rather than up front: nobody should pay for rendering a
  // report they never export, and there is no blob URL left dangling.
  const handleExport = () => {
    const blob = new Blob([generateHtmlReport(result)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `mutadiff-report-${id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    // Dos paneles: el rail conserva el contexto a la vista mientras se recorren
    // las tablas (`sticky`), y se apila encima del contenido en pantallas estrechas.
    <div className="rise grid items-start gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <ComparisonContextRail context={result.context} />
      {/* `min-w-0`: un hijo de grid vale por defecto `min-width: auto`, así que
          no encoge por debajo de su contenido. Sin esto, la tabla ancha estira
          la columna y desborda la página entera en vez de scrollear dentro de su
          propio contenedor. */}
      <main className="flex min-w-0 flex-col gap-10">
        <SummaryBand
          tool={result.tool}
          global={result.global}
          regressionCount={result.regressions.length}
          onExport={handleExport}
        />
        <KpiRow global={result.global} />
        <UnitSection
          title="Retrocesos"
          units={result.regressions}
          emptyMessage="No hay retrocesos."
        />
        <UnitSection
          title="Sin cobertura"
          units={result.uncovered}
          emptyMessage="No hay clases/ficheros sin cobertura."
        />
        <UnitSection title="Nuevas" units={result.added} emptyMessage="No hay unidades nuevas." />
        <UnitSection
          title="Eliminadas"
          units={result.removed}
          emptyMessage="No hay unidades eliminadas."
        />
        <UnitsTable units={result.units} />
      </main>
    </div>
  );
}
