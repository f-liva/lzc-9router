#!/bin/sh
set -e

# Patch defer_loading (upstream issue #3567): 9router setta cache_control
# sull'ultimo tool senza guardia; se e' un tool MCP con defer_loading:true,
# Anthropic risponde 400 PRIMA del fallback. Idempotente: skip se gia' patchato.
PATCHED_MARKER='defer_loading&&(m.tools'
for f in /app/.next/server/chunks/*.js; do
  if grep -q 'm\.tools\.length>0&&(m\.tools\[m\.tools\.length-1\]\.cache_control={type:"ephemeral",ttl:"1h"})' "$f" 2>/dev/null; then
    sed -i 's|m.tools.length>0&&(m.tools\[m.tools.length-1\].cache_control={type:"ephemeral",ttl:"1h"})|m.tools.length>0\&\&!m.tools[m.tools.length-1].defer_loading\&\&(m.tools[m.tools.length-1].cache_control={type:"ephemeral",ttl:"1h"})|' "$f"
    echo "[entrypoint] patch defer_loading applicata a $f"
  fi
done

# migration dati WSL: file posati in /migration solo al primo avvio
DATA_DIR="${DATA_DIR:-/app/data}"
if [ -d /migration ] && [ -f /migration/db/data.sqlite ]; then
  if [ ! -f "$DATA_DIR/db/data.sqlite" ]; then
    mkdir -p "$DATA_DIR/db"
    cp -a /migration/db/. "$DATA_DIR/db/"
    cp -a /migration/jwt-secret /migration/machine-id "$DATA_DIR/" 2>/dev/null || true
    echo "[entrypoint] dati migrati da /migration"
  else
    echo "[entrypoint] dati gia' presenti, /migration ignorata"
  fi
fi

exec "$@"
