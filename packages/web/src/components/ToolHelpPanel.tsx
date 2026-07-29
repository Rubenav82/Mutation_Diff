import { useEffect, useState } from 'react';
import type { Tool } from 'core';
import { copyText } from '../lib/clipboard';

interface ToolHelp {
  description: string;
  snippet: string;
}

const TOOL_HELP: Record<Tool, ToolHelp> = {
  pitest: {
    description:
      'Debes activar el reporte XML en tu build. Maven/Gradle: outputFormats = XML (puedes mantener también HTML). El fichero a subir es target/pit-reports/**/mutations.xml.',
    snippet: 'outputFormats = XML',
  },
  stryker: {
    description:
      'Debes activar el reporter JSON en stryker.config.json. El fichero a subir es reports/mutation/mutation.json.',
    snippet: '"reporters": ["json", ...]',
  },
};

interface ToolHelpPanelProps {
  tool: Tool;
  id: string;
}

export function ToolHelpPanel({ tool, id }: ToolHelpPanelProps) {
  const [copied, setCopied] = useState(false);
  const help = TOOL_HELP[tool];

  useEffect(() => {
    setCopied(false);
  }, [tool]);

  async function handleCopy() {
    await copyText(help.snippet);
    setCopied(true);
  }

  return (
    // `text-left` propio: son instrucciones y un snippet de código, que se leen
    // alineados a la izquierda aunque la página que los muestra vaya centrada.
    <div
      id={id}
      role="region"
      aria-label="Ayuda de configuración"
      className="rise rounded-lg border border-line bg-raised p-5 text-left"
    >
      <p className="text-sm leading-relaxed text-muted">{help.description}</p>
      <div className="mt-3 flex items-center gap-3">
        <pre className="flex-1 overflow-x-auto rounded-md border border-line bg-surface px-3 py-2">
          <code className="font-mono text-sm text-ink">{help.snippet}</code>
        </pre>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="shrink-0 rounded-md border border-line px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-ink"
        >
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}
