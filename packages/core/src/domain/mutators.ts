/**
 * PiTest names mutators by their fully-qualified class
 * (`org.pitest.mutationtest.engine.gregor.mutators.MathMutator`); Stryker by a
 * bare name. The package repeats on every row and says nothing, so the SPA and
 * the report show only the last segment. Lives in `core` so both render the
 * same name for the same mutant.
 */
export function shortMutatorName(mutator: string): string {
  return mutator.slice(mutator.lastIndexOf('.') + 1);
}
