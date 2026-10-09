# syntax=docker/dockerfile:1.7
# 9router costruito dal NOSTRO fork, non dall'immagine upstream: il branch `lzc`
# di f-liva/9router e' la release upstream v0.5.99 piu' i quattro fix che upstream
# non ha (ancora) assorbito:
#   #3683  il path Claude su forced-SSE->JSON
#   #3693  l'echo del modello richiesto invece di quello del provider
#   #4078  la strategia cache-affinity che pinna una conversazione su un account
#   (no PR) shouldTreatAsNonStreaming(), vedi sotto
#
# VERIFICATO IL 09/10/2026 su v0.5.99 (commit ce4460ef): nessuno dei quattro e'
# stato assorbito. v0.5.99 e' una release NON TAGGATA: i tag upstream si fermano
# a v0.5.95, la versione vera si legge in package.json su master e nel commit di
# release (subject `# v0.X.YY (data)`). Guardare solo i tag fa perdere release.
# La #3683 resta un caso da ispezionare a mano a ogni upgrade: upstream ha
# reimplementato openAICompletionToClaudeMessage INLINE in
# open-sse/handlers/chatCore/nonStreamingHandler.js, ma senza i nostri due
# pezzi (l'echo di requestModel e `content: []` sulle completion vuote). La
# risoluzione corretta e' tenere il NOSTRO modulo completionToClaude.js e
# lasciare che il merge rimuova l'inline upstream: il conflitto cade sulla sola
# riga di import, e il controllo da fare dopo e'
# `grep -c 'function openAICompletionToClaudeMessage' nonStreamingHandler.js` = 0
# (una doppia definizione non rompe il merge, rompe il bundle a runtime).
#
# Gli altri cinque fix nostri sono stati ASSORBITI da upstream entro v0.5.75
# e non vanno piu' riapplicati: server_tool_use con id estraneo,
# cache_control su tool defer_loading, marker [1m] del contesto 1M, systemPrompt
# top-level che kiro.dev rifiuta, beta flag Anthropic sui provider-node
# anthropic-compatible. Prima di ogni upgrade si ricontrolla quali PR risultano
# ancora aperte: quelle chiuse sono gia' dentro la tag.
#
# Quarto fix nostro (08/10/2026, non ancora in PR upstream): chatCore
# default-streaming guess (stream non impostato dal client -> stream=true)
# combinato con un provider che risponde comunque in application/json rompeva
# i client OpenAI "piatti" (es. Nextcloud integration_openai) che non
# decodificano mai SSE. shouldTreatAsNonStreaming() in nonStreamingHandler.js
# reindirizza quel caso specifico al path non-streaming gia' corretto.
#
# Regola: niente patch a valle sul bundle compilato — il fix sta nel sorgente.
ARG NODE_IMAGE=node:22-alpine
ARG NINEROUTER_REPO=https://github.com/f-liva/9router.git
# Pin sul commit, non sul branch: build riproducibile.
ARG NINEROUTER_REF=c9df14233361d1f9a0174a8ad2b3019df84a948d

FROM ${NODE_IMAGE} AS builder
ARG NINEROUTER_REPO
ARG NINEROUTER_REF
WORKDIR /app
RUN apk --no-cache upgrade && apk --no-cache add git python3 make g++ linux-headers
RUN git init -q . && git remote add origin "${NINEROUTER_REPO}" && \
    git fetch -q --depth 1 origin "${NINEROUTER_REF}" && git checkout -q FETCH_HEAD
RUN --mount=type=cache,target=/root/.npm npm install
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM ${NODE_IMAGE} AS runner
WORKDIR /app

LABEL org.opencontainers.image.title="9router"

ENV NODE_ENV=production
ENV PORT=20128
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATA_DIR=/app/data

# Stesso set di COPY dell'upstream: il tracing di Next omette file fratelli.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/custom-server.js ./custom-server.js
COPY --from=builder /app/open-sse ./open-sse
COPY --from=builder /app/src/mitm ./src/mitm
COPY --from=builder /app/node_modules/node-forge ./node_modules/node-forge
COPY --from=builder /app/node_modules/next ./node_modules/next
COPY --from=builder /app/node_modules/sql.js ./node_modules/sql.js

RUN mkdir -p /app/data && chown -R node:node /app && \
    mkdir -p /app/data-home && chown node:node /app/data-home && \
    ln -sf /app/data-home /root/.9router 2>/dev/null || true

RUN apk --no-cache upgrade && apk --no-cache add su-exec wget

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 20128

HEALTHCHECK --interval=60s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:20128/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "custom-server.js"]
