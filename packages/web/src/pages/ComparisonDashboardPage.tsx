import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ComparisonResult } from 'core';
import { ApiClientError, getComparison, getComparisonReportUrl } from '../api/client';
import { ComparisonContextRail } from '../components/ComparisonContextRail';
import { ErrorMessage } from '../components/ErrorMessage';
import { GlobalSummaryCards } from '../components/GlobalSummaryCards';
import { LoadingIndicator } from '../components/LoadingIndicator';
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
            err instanceof ApiClientError
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

  return (
    // Dos paneles: el rail conserva el contexto a la vista mientras se recorren
    // las tablas (`sticky`), y se apila encima del contenido en pantallas estrechas.
    <div className="rise grid items-start gap-8 lg:grid-cols-[15rem_1fr] lg:gap-10">
      <ComparisonContextRail tool={result.tool} context={result.context} />
      <main className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
          {/* La herramienta ya no se repite aquí: vive en el rail. */}
          <h1>Comparación</h1>
          {/* Plain anchor, not fetch+blob: the endpoint already sends
              Content-Disposition: attachment with the filename. */}
          <a
            href={getComparisonReportUrl(id)}
            download
            className="border-2 border-line-strong px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-deep hover:text-inverse"
          >
            Exportar HTML
          </a>
        </div>
        <GlobalSummaryCards global={result.global} />
        <UnitSection
          title="Regresiones"
          units={result.regressions}
          emptyMessage="No hay regresiones."
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
