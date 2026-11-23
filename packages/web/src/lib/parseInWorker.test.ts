import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseInWorker } from './parseInWorker';
import type { ParseRequest, ParseResponse } from './reportParser';

const REQUEST: ParseRequest = {
  tool: 'pitest',
  file: new File(['<mutations/>'], 'mutations.xml'),
  createdAt: '2026-11-23T10:00:00.000Z',
};

const RESPONSE: ParseResponse = { ok: false, reason: { code: 'missing-unit' } };

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ParseResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  posted: unknown[] = [];
  terminate = vi.fn();

  constructor(
    public readonly url: URL,
    public readonly options: WorkerOptions,
  ) {
    FakeWorker.instances.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  reply(data: ParseResponse) {
    this.onmessage?.({ data } as MessageEvent<ParseResponse>);
  }

  fail() {
    this.onerror?.({ message: 'boom' } as ErrorEvent);
  }
}

function startedWorker(): FakeWorker {
  const worker = FakeWorker.instances.at(-1);
  if (!worker) throw new Error('no worker was started');
  return worker;
}

describe('parseInWorker', () => {
  afterEach(() => {
    FakeWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it('sends the request to a module worker and resolves with its answer', async () => {
    vi.stubGlobal('Worker', FakeWorker);

    const promise = parseInWorker(REQUEST);
    const worker = startedWorker();
    worker.reply(RESPONSE);

    await expect(promise).resolves.toEqual(RESPONSE);
    expect(worker.posted).toEqual([REQUEST]);
    expect(worker.options).toEqual({ type: 'module' });
    expect(String(worker.url)).toMatch(/\/parseWorker\.ts\b/);
  });

  it('starts one worker per call, so the two sides parse at the same time', () => {
    vi.stubGlobal('Worker', FakeWorker);

    void parseInWorker(REQUEST);
    void parseInWorker(REQUEST);

    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('stops the worker once it has answered', async () => {
    vi.stubGlobal('Worker', FakeWorker);

    const promise = parseInWorker(REQUEST);
    const worker = startedWorker();
    expect(worker.terminate).not.toHaveBeenCalled();
    worker.reply(RESPONSE);
    await promise;

    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it('rejects, and stops the worker, when the worker itself fails', async () => {
    // Solo pasa si el script del worker no carga: `parseReportFile` no lanza.
    vi.stubGlobal('Worker', FakeWorker);

    const promise = parseInWorker(REQUEST);
    const worker = startedWorker();
    worker.fail();

    await expect(promise).rejects.toThrow('El análisis en segundo plano no pudo arrancar: boom');
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });
});
