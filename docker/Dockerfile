# syntax=docker/dockerfile:1.7
# 9router costruito dal NOSTRO fork, non dall'immagine upstream: il branch `lzc`
# di f-liva/9router e' v0.5.59 piu' i quattro fix aperti come PR su
# decolua/9router (#3683 fallback non-streaming, #3686 server_tool_use con id
# estraneo, #3687 cache_control su tool defer_loading, #3691 marker [1m] del
# contesto 1M di Claude Code). Quando le PR vengono mergiate il
# branch si riallinea a monte e questo file non cambia.
# Regola: niente patch a valle sul bundle compilato — il fix sta nel sorgente.
ARG NODE_IMAGE=node:22-alpine
ARG NINEROUTER_REPO=https://github.com/f-liva/9router.git
# Pin sul commit, non sul branch: build riproducibile.
ARG NINEROUTER_REF=18a8daf3863a27b683018cbfe80fb719ecd6d6d8

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
