# Import

`backend/import` is the Cloudflare Worker/Hono service for acquiring,
analyzing, normalizing, and applying external content sources. It owns import
execution and diagnostics; Phoenix owns communities, articles, permissions,
persisted import jobs, and final publication state.

## Position in the system

```text
Browser -> Dash server proxy -> Import service
                                      |
                      +---------------+---------------+
                      |                               |
                      v                               v
             source adapters                 Document Converter
                      |                               |
                      +------------+------------------+
                                   v
                          canonical import plan
                                   |
                                   v
                     Phoenix internal apply boundary -> Repo
```

The service must not write the Phoenix database directly. Source-specific
Markdown/MDX/config differences end at analyzer adapters; the apply boundary
consumes canonical files, tree nodes, diagnostics, and stable source IDs.

## Source layout

- `src/app.ts`: Hono service and health/API routes.
- `cf-worker.ts`: production HTTP composition and Apply Workflow.
- `workers/importWorkflow.ts`: durable repository analysis using R2 artifacts.
- `cloudflare.config.ts`: Worker, Workflow, R2 and custom-domain bindings.
- `src/lib/import`: import orchestration and shared contracts.
- `src/lib/import/threads/docs/analyzer`: framework/source adapters.
- `src/lib/import/threads/docs/apply`: canonical apply planning and
  Phoenix-facing batches.
- `test/fixtures/frameworks`: checked-in miniature documentation repositories
  and expected trees used by analyzer contract tests. These are backend test
  assets, not frontend applications or installable workspaces.

## Local development and validation

```sh
pnpm --filter @groupher/import run dev
pnpm --filter @groupher/import run test
pnpm --filter @groupher/import run type-check
pnpm --filter @groupher/import run format:check
```

Document conversion is delegated to `backend/converter` on port 8000. Start
`pnpm dev:converter` and `pnpm dev:import` from the repository root. Dev Hub
uses the same commands through `make be.converter.start` and `make be.import.start`.
The local Portless hostname is `import.groupher.localhost`; the production
hostname is `import.groupher.com`.

Dev Hub supplies service credentials and the preview signing secret. Managed
development uses the pinned Wrangler engine with the existing programmatic
`cloudflare.config.ts`, an explicit Hub-generated environment file and private
Worker state directory. This avoids implicit project `.env` / `.dev.vars`
loading; deployment continues to use `cf deploy`. See
[central local configuration](../../docs/architecture/dev-hub-local-config.md).

Framework fixtures must stay self-contained and deterministic. Add a separate
case directory when covering a new framework/configuration shape; do not reuse
live repositories or generate fixture output during tests.

## Production deployment

Worker `import` serves `https://import.groupher.com`. R2 stores previews
and source artifacts; `import-analysis` and `import-apply` run durable steps.
Phoenix remains the authority for user permissions, jobs and final writes.
The default `dev` command runs the same Worker entrypoint in workerd on port
8001, with locally simulated R2 and Workflows. The local service does not run a
standalone Node API server. Its name is `import`, matching production.

```sh
pnpm --filter @groupher/import run test:worker
pnpm --filter @groupher/import run type-check:workers
pnpm --filter @groupher/import run deploy
```

## Related documentation

- [`docs/import/app-boundary.md`](../../docs/import/app-boundary.md)
- [`docs/import/README.md`](../../docs/import/README.md)
- [`docs/import/import-architecture.md`](../../docs/import/import-architecture.md)
- [`docs/import/import-error-handling.md`](../../docs/import/import-error-handling.md)
