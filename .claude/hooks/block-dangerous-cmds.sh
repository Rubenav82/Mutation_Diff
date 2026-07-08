#!/bin/bash
# Hook: Bloquea comandos peligrosos como rm -rf

command=$(jq -r '.tool_input.command' 2>/dev/null || echo "")

if echo "$command" | grep -iE 'rm\s+-rf|rm\s+.*-.*f|:q!|dd\s+if' > /dev/null 2>&1; then
  echo '{"systemMessage": "⚠️ Comando peligroso bloqueado por seguridad", "continue": false}'
  exit 2
fi

exit 0
