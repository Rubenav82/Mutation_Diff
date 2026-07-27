import { useState, type ChangeEvent, type DragEvent } from 'react';

interface FileDropZoneProps {
  id: string;
  label: string;
  acceptedExtension: string;
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  onShowHelp?: () => void;
}

export function FileDropZone({
  id,
  label,
  acceptedExtension,
  file,
  onFileSelected,
  onClear,
  onShowHelp,
}: FileDropZoneProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  function acceptOrReject(candidate: File) {
    if (!candidate.name.toLowerCase().endsWith(acceptedExtension)) {
      setError(`El fichero debe tener extensión ${acceptedExtension}`);
      return;
    }
    setError(null);
    onFileSelected(candidate);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const candidate = event.target.files?.[0];
    if (candidate) {
      acceptOrReject(candidate);
    }
    event.target.value = '';
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const candidate = event.dataTransfer.files?.[0];
    if (candidate) {
      acceptOrReject(candidate);
    }
  }

  // `dragleave` also fires when the pointer crosses into a child, so the state is
  // only cleared when the pointer really left the zone.
  function handleDragLeave(event: DragEvent<HTMLLabelElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragging(false);
    }
  }

  const stateClass = isDragging
    ? 'border-accent bg-accent-soft'
    : file
      ? 'border-line-strong border-solid bg-raised'
      : 'border-line hover:border-line-strong hover:bg-raised';

  return (
    <div>
      <label
        htmlFor={id}
        onDragOver={(event) => event.preventDefault()}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex cursor-pointer flex-col gap-2 rounded-lg border-2 border-dashed px-5 py-7 transition-colors duration-150 ${stateClass}`}
      >
        <span className="eyebrow">{label}</span>
        <span
          className={
            file
              ? 'font-mono text-sm break-all text-ink'
              : 'text-sm leading-snug text-balance text-muted'
          }
        >
          {file
            ? file.name
            : `Arrastra un fichero ${acceptedExtension} aquí o haz clic para seleccionarlo`}
        </span>
        <input
          id={id}
          type="file"
          accept={acceptedExtension}
          onChange={handleChange}
          className="sr-only"
        />
      </label>
      {file && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1.5 text-xs text-muted underline underline-offset-2 hover:text-ink"
        >
          Quitar
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 flex flex-wrap items-center gap-2 text-sm text-loss">
          {error}
          {onShowHelp && (
            <button
              type="button"
              onClick={onShowHelp}
              className="underline underline-offset-2 hover:text-ink"
            >
              Ver instrucciones
            </button>
          )}
        </p>
      )}
    </div>
  );
}
