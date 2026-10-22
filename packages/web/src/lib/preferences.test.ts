import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_PREFERENCES,
  createPreferencesStore,
  preferencesStore,
  type WizardPreferences,
} from './preferences';

/** Storage en memoria, para no depender del localStorage real de jsdom. */
function fakeStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
    clear: () => entries.clear(),
    key: (index) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
}

const saved: WizardPreferences = {
  tool: 'stryker',
  regressionThreshold: '5',
  uncoveredThreshold: '75',
};

/** Lo que habría guardado una versión anterior, para probar la carga sin `save`. */
function storageWith(value: unknown): Storage {
  const storage = fakeStorage();
  storage.setItem('mutadiff:preferences', JSON.stringify(value));
  return storage;
}

describe('createPreferencesStore', () => {
  it('reads back the three preferences it saved', () => {
    const storage = fakeStorage();
    createPreferencesStore(storage).save(saved);

    expect(createPreferencesStore(storage).load()).toEqual(saved);
  });

  it('defaults to PiTest and both thresholds empty when nothing was saved', () => {
    // Vacío es lo correcto, no «0» y «100»: el campo vacío significa «usa el
    // valor por defecto del motor», que es lo que indica el placeholder.
    expect(DEFAULT_PREFERENCES).toEqual({
      tool: 'pitest',
      regressionThreshold: '',
      uncoveredThreshold: '',
    });
    expect(createPreferencesStore(fakeStorage()).load()).toEqual(DEFAULT_PREFERENCES);
  });

  it('keeps an empty threshold as empty instead of turning it into a number', () => {
    const storage = fakeStorage();
    createPreferencesStore(storage).save({ ...saved, regressionThreshold: '' });

    expect(createPreferencesStore(storage).load().regressionThreshold).toBe('');
  });

  it('falls back to the defaults when the stored value is not an object', () => {
    expect(createPreferencesStore(storageWith(null)).load()).toEqual(DEFAULT_PREFERENCES);
    expect(createPreferencesStore(storageWith('stryker')).load()).toEqual(DEFAULT_PREFERENCES);
  });

  it('falls back to the defaults when the stored text is not JSON', () => {
    const storage = fakeStorage();
    storage.setItem('mutadiff:preferences', '{ not json');

    expect(createPreferencesStore(storage).load()).toEqual(DEFAULT_PREFERENCES);
  });

  // Cada campo por separado: lo guardado puede venir de una versión anterior con
  // otra forma, y un campo roto no debería tirar los otros dos.
  it('ignores a tool it does not know, keeping the thresholds', () => {
    const store = createPreferencesStore(storageWith({ ...saved, tool: 'infection' }));

    expect(store.load()).toEqual({ ...saved, tool: 'pitest' });
  });

  it('ignores a tool that is an inherited property name, not a real tool', () => {
    // `'toString' in TOOLS` sería `true`: la comprobación tiene que ser de
    // propiedad propia, no de la cadena de prototipos.
    expect(createPreferencesStore(storageWith({ ...saved, tool: 'toString' })).load().tool).toBe(
      'pitest',
    );
  });

  it.each(['regressionThreshold', 'uncoveredThreshold'] as const)(
    'ignores a %s that is not text, keeping the rest',
    (field) => {
      const store = createPreferencesStore(storageWith({ ...saved, [field]: 75 }));

      expect(store.load()).toEqual({ ...saved, [field]: '' });
    },
  );

  it('survives a storage that refuses to save, and keeps serving the defaults', () => {
    // Modo privado o almacenamiento bloqueado: perder la comodidad de recordar
    // los valores no puede impedir comparar.
    const storage = fakeStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    const store = createPreferencesStore(storage);

    expect(() => store.save(saved)).not.toThrow();
    expect(store.load()).toEqual(DEFAULT_PREFERENCES);
  });

  it('survives having no storage at all', () => {
    const store = createPreferencesStore(undefined);

    expect(() => store.save(saved)).not.toThrow();
    expect(store.load()).toEqual(DEFAULT_PREFERENCES);
  });
});

describe('preferencesStore', () => {
  it('is backed by localStorage, so it survives closing the browser', () => {
    // Es la diferencia con `comparisonStore`, que usa `sessionStorage` a
    // propósito: la comparación muere con la pestaña, las preferencias no.
    preferencesStore.save(saved);

    expect(JSON.parse(localStorage.getItem('mutadiff:preferences') ?? 'null')).toEqual(saved);
    localStorage.clear();
  });
});
