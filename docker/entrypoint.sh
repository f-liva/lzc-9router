#!/bin/sh
set -e

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

# come l'entrypoint upstream: i volumi montati arrivano con owner sbagliato
chown -R node:node /app/data /app/data-home 2>/dev/null || true
exec su-exec node "$@"
