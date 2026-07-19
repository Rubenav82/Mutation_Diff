import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { ComparisonResult } from 'core';
import { ApiClientError, getComparison } from '../api/client';
import { GlobalSummaryCards } from '../components/GlobalSummaryCards';
import { UnitsTable } from '../components/UnitsTable';

export function ComparisonDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<ComparisonResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
  }, [id]);

  if (isLoading) {
    return <p>Cargando comparación…</p>;
  }
  if (error) {
    return <p role="alert">{error}</p>;
  }
  if (!result) {
    return null;
  }

  return (
    <main>
      <h1>Comparación</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400">Herramienta: {result.tool}</p>
      <GlobalSummaryCards global={result.global} />
      <UnitsTable units={result.units} />
    </main>
  );
}
