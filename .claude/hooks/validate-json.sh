#!/bin/bash
# Hook: Valida que archivos JSON sean sintácticamente correctos

file=$(jq -r '.tool_input.file_path // .tool_response.filePath' 2>/dev/null | tr -d '\n')

if [ -n "$file" ] && [ -f "$file" ] && [[ "$file" == *.json ]]; then
  if jq empty "$file" 2>/dev/null; then
    echo '{"systemMessage": "✅ JSON válido"}'
    exit 0
  else
    error=$(jq empty "$file" 2>&1)
    echo "{\"systemMessage\": \"❌ JSON inválido: $error\", \"continue\": false}"
    exit 2
  fi
fi

exit 0
