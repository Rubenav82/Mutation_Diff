#!/bin/bash
# Hook: Ejecuta tests automáticamente al editar archivos TypeScript

file=$(jq -r '.tool_input.file_path // .tool_response.filePath' 2>/dev/null | tr -d '\n')

if [ -n "$file" ] && [ -f "$file" ]; then
  case "$file" in
    *.ts | *.tsx)
      npm run test:run -- "$file" 2>/dev/null
      ;;
  esac
fi

exit 0
