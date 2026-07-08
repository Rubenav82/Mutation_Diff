#!/bin/bash
# Hook: Auto-formatea código con Prettier después de editar

file=$(jq -r '.tool_input.file_path // .tool_response.filePath' 2>/dev/null | tr -d '\n')

if [ -n "$file" ] && [ -f "$file" ]; then
  case "$file" in
    *.ts | *.tsx | *.js | *.jsx | *.json | *.md | *.yaml | *.yml)
      npx prettier --write "$file" 2>/dev/null
      ;;
  esac
fi

exit 0
