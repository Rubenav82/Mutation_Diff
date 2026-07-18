import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Tool } from 'core';
import { ApiClientError, createComparison } from '../api/client';
import { FileDropZone } from '../components/FileDropZone';
import { ToolHelpPanel } from '../components/ToolHelpPanel';

const HELP_PANEL_ID = 'tool-help-panel';

const EXTENSION_BY_TOOL: Record<Tool, string> = {
  pitest: '.xml',
  stryker: '.json',
};

export function NewComparisonPage() {
  const navigate = useNavigate();
  const [tool, setTool] = useState<Tool>('pitest');
  const [baseFile, setBaseFile] = useState<File | null>(null);
  const [headFile, setHeadFile] = useState<File | null>(null);
  const [regressionThreshold, setRegressionThreshold] = useState('');
  const [uncoveredThreshold, setUncoveredThreshold] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  function handleToolChange(nextTool: Tool) {
    setTool(nextTool);
    setBaseFile(null);
    setHeadFile(null);
  }

  const canSubmit = baseFile !== null && headFile !== null && !isSubmitting;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!baseFile || !headFile) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const { comparisonId } = await createComparison({
        tool,
        baseFile,
        headFile,
        ...(regressionThreshold !== '' ? { regressionThreshold: Number(regressionThreshold) } : {}),
        ...(uncoveredThreshold !== '' ? { uncoveredThreshold: Number(uncoveredThreshold) } : {}),
      });
      navigate(`/comparisons/${comparisonId}`);
    } catch (err) {
      setSubmitError(err instanceof ApiClientError ? err.message : 'Error inesperado al comparar');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Nueva comparación</h1>
      <form onSubmit={(event) => void handleSubmit(event)}>
        <fieldset>
          <legend>Herramienta</legend>
          <label>
            <input
              type="radio"
              name="tool"
              value="pitest"
              checked={tool === 'pitest'}
              onChange={() => handleToolChange('pitest')}
            />
            PiTest
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="stryker"
              checked={tool === 'stryker'}
              onChange={() => handleToolChange('stryker')}
            />
            Stryker
          </label>
          <button
            type="button"
            aria-expanded={isHelpOpen}
            aria-controls={HELP_PANEL_ID}
            onClick={() => setIsHelpOpen((open) => !open)}
          >
            ⓘ<span className="sr-only">Ayuda de configuración</span>
          </button>
        </fieldset>

        {isHelpOpen && <ToolHelpPanel tool={tool} id={HELP_PANEL_ID} />}

        <FileDropZone
          id="baseFile"
          label="Ejecución base"
          acceptedExtension={EXTENSION_BY_TOOL[tool]}
          file={baseFile}
          onFileSelected={setBaseFile}
          onClear={() => setBaseFile(null)}
          onShowHelp={() => setIsHelpOpen(true)}
        />
        <FileDropZone
          id="headFile"
          label="Ejecución nueva"
          acceptedExtension={EXTENSION_BY_TOOL[tool]}
          file={headFile}
          onFileSelected={setHeadFile}
          onClear={() => setHeadFile(null)}
          onShowHelp={() => setIsHelpOpen(true)}
        />

        <label>
          Umbral de regresión (%)
          <input
            type="number"
            value={regressionThreshold}
            onChange={(event) => setRegressionThreshold(event.target.value)}
          />
        </label>
        <label>
          Umbral sin cobertura (%)
          <input
            type="number"
            value={uncoveredThreshold}
            onChange={(event) => setUncoveredThreshold(event.target.value)}
          />
        </label>

        {submitError && <p role="alert">{submitError}</p>}

        <button type="submit" disabled={!canSubmit}>
          {isSubmitting ? 'Comparando…' : 'Comparar'}
        </button>
      </form>
    </main>
  );
}
