interface ThresholdHelpPanelProps {
  id: string;
}

/**
 * Las dos reglas, con la frontera y el valor por defecto explícitos. Nacen de una
 * duda real del usuario, y cada afirmación sale de `compareRuns` en `core`:
 * `Δ < −umbral` (estricto, así que una caída igual al umbral se tolera) y
 * `noCoverage / total × 100 >= umbral` sobre las métricas de head. El denominador
 * es `total`, no los válidos que usa el score — está así en CA-HU-05. Si cambia
 * cualquiera de las dos fórmulas, este texto pasa a mentir.
 */
export function ThresholdHelpPanel({ id }: ThresholdHelpPanelProps) {
  return (
    // `text-left` propio, igual que `ToolHelpPanel`: son explicaciones con
    // fórmulas, y la página que las contiene va centrada.
    <div
      id={id}
      role="region"
      aria-label="Ayuda de umbrales"
      className="rise space-y-5 rounded-lg border border-line bg-raised p-5 text-left text-sm leading-relaxed text-muted"
    >
      <p>
        Los dos son opcionales y actúan solo sobre cómo se clasifica cada clase o fichero: no
        cambian el score ni los conteos. Son independientes entre sí, así que una clase puede
        aparecer a la vez como <span className="text-ink">Mejora</span> y en{' '}
        <span className="text-ink">Sin cobertura</span>.
      </p>

      <section>
        <h3 className="eyebrow">Umbral de retroceso (%)</h3>
        <p className="mt-2">
          Cuánto puede bajar el score de una clase antes de contarla como retroceso. Son{' '}
          <span className="text-ink">puntos de score, no un porcentaje relativo</span>: con 5 se
          tolera una caída de hasta 5 puntos.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-surface px-3 py-2">
          <code className="font-mono text-xs text-ink">
            Δ = score nuevo − score base{'\n'}Δ &gt; 0 → Mejora · Δ &lt; −umbral → Retroceso · resto
            → Igual
          </code>
        </pre>
        <p className="mt-2">
          Con umbral 5: de 80 a 76 (−4) sigue siendo <span className="text-ink">Igual</span>; de 80
          a 75 (−5) también, porque la frontera se tolera; de 80 a 74,9 (−5,1) ya es{' '}
          <span className="text-ink">Retroceso</span>. Por defecto 0, así que cualquier bajada
          cuenta.
        </p>
        <p className="mt-2">
          Ojo con las clases pequeñas: con 8 mutantes válidos cada mutante vale 12,5 puntos, así que
          subir el umbral para quitar ruido silencia también retrocesos reales de un solo mutante.
        </p>
      </section>

      <section>
        <h3 className="eyebrow">Umbral sin cobertura (%)</h3>
        <p className="mt-2">
          Qué porción de mutantes que ningún test ejecuta marca una clase como «sin cobertura». Aquí
          no hay comparación: se mira <span className="text-ink">solo la ejecución nueva</span>, y
          el denominador son todos sus mutantes.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-md border border-line bg-surface px-3 py-2">
          <code className="font-mono text-xs text-ink">NO_COVERAGE / total × 100 ≥ umbral</code>
        </pre>
        <p className="mt-2">
          Por defecto 100: solo las clases que no tienen ni un test que las roce. Con 75 entra
          también una clase con 3 de sus 4 mutantes sin cubrir. Con 0 se marcan todas, incluso las
          cubiertas al 100 %, porque <span className="font-mono text-ink">0 ≥ 0</span> es cierto.
        </p>
      </section>
    </div>
  );
}
