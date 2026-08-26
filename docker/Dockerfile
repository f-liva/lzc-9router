FROM docker.io/decolua/9router:latest
USER root
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
# HEALTHCHECK: dashboard risponde (anche redirect SSO) purche' il server sia su
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:20128/api/health || exit 1
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
