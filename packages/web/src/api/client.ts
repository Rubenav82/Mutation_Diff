import type { ComparisonResult, Tool } from 'core';

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface CreateComparisonInput {
  tool: Tool;
  baseFile: File;
  headFile: File;
  regressionThreshold?: number;
  uncoveredThreshold?: number;
}

export interface CreateComparisonResponse {
  comparisonId: string;
  result: ComparisonResult;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

async function throwApiError(res: Response): Promise<never> {
  const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
  throw new ApiClientError(
    res.status,
    body?.error?.code ?? 'UNKNOWN_ERROR',
    body?.error?.message ?? 'Unexpected error',
  );
}

export async function createComparison(
  input: CreateComparisonInput,
): Promise<CreateComparisonResponse> {
  const formData = new FormData();
  formData.set('tool', input.tool);
  formData.set('baseFile', input.baseFile);
  formData.set('headFile', input.headFile);
  if (input.regressionThreshold !== undefined) {
    formData.set('regressionThreshold', String(input.regressionThreshold));
  }
  if (input.uncoveredThreshold !== undefined) {
    formData.set('uncoveredThreshold', String(input.uncoveredThreshold));
  }

  const res = await fetch('/api/comparisons', { method: 'POST', body: formData });
  if (!res.ok) {
    return throwApiError(res);
  }
  return (await res.json()) as CreateComparisonResponse;
}

export async function getComparison(id: string): Promise<ComparisonResult> {
  const res = await fetch(`/api/comparisons/${encodeURIComponent(id)}`);
  if (!res.ok) {
    return throwApiError(res);
  }
  return (await res.json()) as ComparisonResult;
}

export function getComparisonReportUrl(id: string): string {
  return `/api/comparisons/${encodeURIComponent(id)}/report`;
}
