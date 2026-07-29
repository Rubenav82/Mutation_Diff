import { afterEach, describe, expect, it, vi } from 'vitest';
import { newComparisonId } from './id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newComparisonId', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when the page runs in a secure context', () => {
    const randomUUID = vi.fn(() => '11111111-1111-4111-8111-111111111111');
    vi.stubGlobal('crypto', { ...globalThis.crypto, randomUUID });

    expect(newComparisonId()).toBe('11111111-1111-4111-8111-111111111111');
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it('falls back to getRandomValues when randomUUID is missing', () => {
    // Servido por HTTP plano no hay contexto seguro y `randomUUID` no existe,
    // pero `getRandomValues` sí. El id debe seguir saliendo con formato v4.
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = i * 7;
        return bytes;
      },
    });

    expect(newComparisonId()).toMatch(UUID_V4);
  });

  it('sets the version and variant bits of the fallback id', () => {
    // Con todos los bytes a cero, lo único que puede hacer que el id case con
    // v4 son los bits que fija la propia función.
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(0),
    });

    expect(newComparisonId()).toBe('00000000-0000-4000-8000-000000000000');
  });

  it('produces a different id on each call', () => {
    expect(newComparisonId()).not.toBe(newComparisonId());
  });
});
