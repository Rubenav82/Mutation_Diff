import { useEffect, useState } from 'react';
import type { Tool } from 'core';

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
    await navigator.clipboard.writeText(help.snippet);
    setCopied(true);
  }

  return (
    <div id={id} role="region" aria-label="Ayuda de configuración">
      <p>{help.description}</p>
      <pre>
        <code>{help.snippet}</code>
      </pre>
      <button type="button" onClick={() => void handleCopy()}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  );
}
