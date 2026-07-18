import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, createComparison, getComparison, getComparisonReportUrl } from './client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createComparison', () => {
  it('posts a multipart form with the base/head files and tool to /api/comparisons', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(200, { comparisonId: 'abc-123', result: { tool: 'pitest' } }),
    );

    const baseFile = new File(['<mutations/>'], 'base.xml', { type: 'text/xml' });
    const headFile = new File(['<mutations/>'], 'head.xml', { type: 'text/xml' });

    const response = await createComparison({ tool: 'pitest', baseFile, headFile });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/comparisons');
    expect(init?.method).toBe('POST');
    const body = init?.body as FormData;
    expect(body.get('tool')).toBe('pitest');
    expect(body.get('baseFile')).toBe(baseFile);
    expect(body.get('headFile')).toBe(headFile);
    expect(response).toEqual({ comparisonId: 'abc-123', result: { tool: 'pitest' } });
  });

  it('includes optional thresholds in the form when provided', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(200, { comparisonId: 'id', result: {} }));

    await createComparison({
      tool: 'stryker',
      baseFile: new File([''], 'base.json'),
      headFile: new File([''], 'head.json'),
      regressionThreshold: 5,
      uncoveredThreshold: 90,
    });

    const [, init] = fetchMock.mock.calls[0]!;
    const body = init?.body as FormData;
    expect(body.get('regressionThreshold')).toBe('5');
    expect(body.get('uncoveredThreshold')).toBe('90');
  });

  it('throws an ApiClientError with the code/message from a 422 error response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(422, { error: { code: 'INVALID_REPORT', message: 'Invalid PiTest report' } }),
    );

    await expect(
      createComparison({
        tool: 'pitest',
        baseFile: new File([''], 'base.xml'),
        headFile: new File([''], 'head.xml'),
      }),
    ).rejects.toMatchObject({
      status: 422,
      code: 'INVALID_REPORT',
      message: 'Invalid PiTest report',
    });
    await expect(
      createComparison({
        tool: 'pitest',
        baseFile: new File([''], 'base.xml'),
        headFile: new File([''], 'head.xml'),
      }),
    ).rejects.toBeInstanceOf(ApiClientError);
  });
});

describe('getComparison', () => {
  it('fetches the comparison result by id', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(200, { tool: 'pitest' }));

    const result = await getComparison('abc-123');

    expect(fetchMock).toHaveBeenCalledWith('/api/comparisons/abc-123');
    expect(result).toEqual({ tool: 'pitest' });
  });

  it('URL-encodes the comparison id', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await getComparison('id with spaces');

    expect(fetchMock).toHaveBeenCalledWith('/api/comparisons/id%20with%20spaces');
  });

  it('throws an ApiClientError with the code/message from a 404 error response', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      jsonResponse(404, {
        error: { code: 'COMPARISON_NOT_FOUND', message: 'No comparison found for id "x"' },
      }),
    );

    await expect(getComparison('x')).rejects.toMatchObject({
      status: 404,
      code: 'COMPARISON_NOT_FOUND',
      message: 'No comparison found for id "x"',
    });
  });
});

describe('getComparisonReportUrl', () => {
  it('builds the report download URL for a comparison id', () => {
    expect(getComparisonReportUrl('abc-123')).toBe('/api/comparisons/abc-123/report');
  });

  it('URL-encodes the comparison id', () => {
    expect(getComparisonReportUrl('id with spaces')).toBe(
      '/api/comparisons/id%20with%20spaces/report',
    );
  });
});
