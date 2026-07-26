interface ErrorMessageProps {
  message: string;
  /** Omitted where the surrounding UI already offers a way to retry (e.g. a form's submit button). */
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded border border-red-300 bg-red-50 p-3 text-red-800 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
    >
      <span aria-hidden="true">⚠</span>
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-red-400 px-2 py-1 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
