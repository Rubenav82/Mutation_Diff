/**
 * `role="status"` already implies a polite, atomic live region, so the label is
 * announced without an explicit `aria-live`. The spinner is decorative.
 */
export function LoadingIndicator({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
      <span
        aria-hidden="true"
        className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600"
      />
      {label}
    </p>
  );
}
