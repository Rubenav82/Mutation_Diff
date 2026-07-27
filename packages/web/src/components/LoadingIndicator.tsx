/**
 * `role="status"` already implies a polite, atomic live region, so the label is
 * announced without an explicit `aria-live`. The spinner is decorative.
 */
export function LoadingIndicator({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2.5 text-sm text-muted">
      <span
        aria-hidden="true"
        className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      {label}
    </p>
  );
}
