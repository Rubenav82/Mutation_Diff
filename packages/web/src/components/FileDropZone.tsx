import { useState, type ChangeEvent, type DragEvent } from 'react';

interface FileDropZoneProps {
  id: string;
  label: string;
  acceptedExtension: string;
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
}

export function FileDropZone({
  id,
  label,
  acceptedExtension,
  file,
  onFileSelected,
  onClear,
}: FileDropZoneProps) {
  const [error, setError] = useState<string | null>(null);

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
    const candidate = event.dataTransfer.files?.[0];
    if (candidate) {
      acceptOrReject(candidate);
    }
  }

  return (
    <div>
      <label htmlFor={id} onDragOver={(event) => event.preventDefault()} onDrop={handleDrop}>
        <span>{label}</span>
        <span>
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
        <button type="button" onClick={onClear}>
          Quitar
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
