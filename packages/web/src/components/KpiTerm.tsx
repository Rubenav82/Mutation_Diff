import { useId } from 'react';
import type { KpiGlossaryEntry } from 'core';

/**
 * A KPI label wired to its glossary definition. The term is keyboard-focusable
 * and the bubble shows on hover and on visible focus (peer variants), while
 * `aria-describedby` carries the definition to assistive tech regardless of
 * whether the bubble is on screen.
 *
 * The bubble is a sibling of the term, not a child: nested, its text would leak
 * into the term's accessible name and a screen reader would read it twice.
 */
export function KpiTerm({ entry }: { entry: KpiGlossaryEntry }) {
  const id = useId();
  return (
    <span className="relative inline-block">
      <span
        data-kpi="term"
        tabIndex={0}
        aria-describedby={id}
        className="peer cursor-help underline decoration-dotted underline-offset-4"
      >
        {entry.term}
      </span>
      {/* Resets explícitos (normal-case, tracking, font): la burbuja vive dentro
          de un `.eyebrow` y sin ellos heredaría versalitas monoespaciadas. */}
      <span
        role="tooltip"
        id={id}
        className="invisible absolute top-full left-1/2 z-10 mt-2 w-64 -translate-x-1/2 border border-line bg-raised px-3 py-2 text-left font-sans text-xs font-normal tracking-normal normal-case text-ink shadow-lg peer-hover:visible peer-focus-visible:visible"
      >
        {entry.definition}
      </span>
    </span>
  );
}
