import type { Tool } from 'core';

/**
 * What the wizard remembers between visits. The thresholds are **the text the
 * user typed**, not numbers: the inputs are controlled strings, and an empty
 * field means "use the engine's default", which a number could not express
 * (`0` is a valid threshold, and `''` is not `0`).
 */
export interface WizardPreferences {
  tool: Tool;
  regressionThreshold: string;
  uncoveredThreshold: string;
}

export const DEFAULT_PREFERENCES: WizardPreferences = {
  tool: 'pitest',
  regressionThreshold: '',
  uncoveredThreshold: '',
};

export interface PreferencesStore {
  load(): WizardPreferences;
  save(preferences: WizardPreferences): void;
}

const KEY = 'mutadiff:preferences';

// Declarado como `Record<Tool, true>` para que añadir una herramienta al tipo de
// `core` rompa el typecheck aquí: una lista de strings suelta seguiría
// compilando y rechazaría en silencio la nueva.
const TOOLS: Record<Tool, true> = { pitest: true, stryker: true };

function isTool(value: unknown): value is Tool {
  // Se lee el valor, no solo la clave: con `in` o `hasOwn`, el `true` del mapa
  // sería dato muerto y además `in` daría por buena una propiedad heredada.
  // Indexar sí recorre el prototipo, así que un «toString» guardado devuelve
  // una función, y el `=== true` la rechaza igual que un número o un objeto.
  return (TOOLS as Record<PropertyKey, unknown>)[value as PropertyKey] === true;
}

function asText(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

/**
 * Remembers the tool and thresholds of the comparison wizard, so that whoever
 * uses the app daily does not retype the same values every time.
 *
 * Best-effort on purpose, like `comparisonStore`: private mode or blocked site
 * data make `Storage` throw, and losing a convenience can never stop a
 * comparison. Unlike that store there is no in-memory layer — this is three
 * short strings read once per mount, so a cache would buy nothing — and no
 * storage at all is handled once, up front, instead of method by method.
 *
 * Every field is validated on the way in and falls back on its own. What is
 * stored may come from an older version of the app with a different shape, and
 * one unusable field should not throw away the other two.
 */
export function createPreferencesStore(storage: Storage | undefined): PreferencesStore {
  return {
    load() {
      try {
        // Sin storage y sin nada guardado son el mismo caso —no hay preferencia
        // que recuperar—, así que se juntan en `null` en vez de comprobarse por
        // separado: una sola rama, y ninguna que el `catch` tape por detrás.
        const raw = storage?.getItem(KEY) ?? null;
        if (raw === null) {
          return DEFAULT_PREFERENCES;
        }
        // `JSON.parse('null')` da `null`, y leer una propiedad de ahí lanza: cae
        // en el `catch` con los valores por defecto, que es lo que toca.
        const parsed = JSON.parse(raw) as Partial<WizardPreferences>;
        return {
          tool: isTool(parsed.tool) ? parsed.tool : DEFAULT_PREFERENCES.tool,
          regressionThreshold: asText(
            parsed.regressionThreshold,
            DEFAULT_PREFERENCES.regressionThreshold,
          ),
          uncoveredThreshold: asText(
            parsed.uncoveredThreshold,
            DEFAULT_PREFERENCES.uncoveredThreshold,
          ),
        };
      } catch {
        return DEFAULT_PREFERENCES;
      }
    },

    save(preferences) {
      // `storage?.` y el `try` se solapan, igual que en `comparisonStore`: sin
      // storage el `?.` evita la llamada, y con una que falle la absorbe el
      // `catch`. Quitar el `?.` acaba en el mismo sitio: es equivalente.
      try {
        storage?.setItem(KEY, JSON.stringify(preferences));
      } catch {
        // Quota exceeded, or storage blocked by the browser. The wizard works
        // the same; it just will not remember these values next time.
      }
    },
  };
}

// `localStorage` y no `sessionStorage`: las preferencias tienen que sobrevivir a
// cerrar el navegador, al contrario que la comparación (`comparisonStore`), que
// muere con la pestaña a propósito.
export const preferencesStore = createPreferencesStore(localStorage);
