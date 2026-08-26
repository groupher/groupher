# Health Contract

Machine-readable contract for `GET /health` responses across Groupher HTTP services.

Human-facing design notes live in `docs/contract/health.md`.

## Layout

```text
schemas/v1.schema.json
fixtures/ok.json
fixtures/limited.json
fixtures/down.json
scripts/assert-health.mjs
```

Run the local fixture check with:

```bash
node contracts/services/health/scripts/assert-health.mjs
```

Check a running service with:

```bash
node contracts/services/health/scripts/assert-health.mjs --url http://127.0.0.1:3007/health --service community
```
