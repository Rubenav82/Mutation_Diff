import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ComparisonResult } from 'core';
import { ApiClientError, getComparison, getComparisonReportUrl } from '../api/client';
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
    <main>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1>Comparación</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Herramienta: {result.tool}</p>
        </div>
        {/* Plain anchor, not fetch+blob: the endpoint already sends
            Content-Disposition: attachment with the filename. */}
        <a
          href={getComparisonReportUrl(id)}
          download
          className="rounded bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
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
  );
}
