interface ErrorMessageProps {
  message: string;
  /** Omitted where the surrounding UI already offers a way to retry (e.g. a form's submit button). */
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-lg border border-loss/40 bg-raised p-4 text-sm text-loss"
    >
      <span aria-hidden="true" className="text-base">
        ⚠
      </span>
      <p className="flex-1">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-loss/40 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-loss hover:text-inverse"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}
