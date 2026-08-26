# Content Import

`backend/content-import` is the Node/Hono execution service for acquiring,
analyzing, normalizing, and applying external content sources. It owns import
execution and diagnostics; Phoenix owns communities, articles, permissions,
persisted import jobs, and final publication state.

## Position in the system

```text
Browser -> Dash server proxy -> Content Import service
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
- `src/service-app.ts`: production handler composition.
- `src/lib/content-import`: import orchestration and shared contracts.
- `src/lib/content-import/threads/docs/analyzer`: framework/source adapters.
- `src/lib/content-import/threads/docs/apply`: canonical apply planning and
  Phoenix-facing batches.
- `src/server.ts`: local Node entrypoint.
- `test/fixtures/frameworks`: checked-in miniature documentation repositories
  and expected trees used by analyzer contract tests. These are backend test
  assets, not frontend applications or installable workspaces.

## Local development and validation

```sh
yarn workspace @groupher/backend-content-import dev
yarn workspace @groupher/backend-content-import test
yarn workspace @groupher/backend-content-import type-check
yarn workspace @groupher/backend-content-import format:check
```

Some document formats are delegated to `backend/document-converter`; install
and run that service when exercising those sources locally.

Framework fixtures must stay self-contained and deterministic. Add a separate
case directory when covering a new framework/configuration shape; do not reuse
live repositories or generate fixture output during tests.

## Related documentation

- [`docs/sub-apps/content_import.md`](../../docs/sub-apps/content_import.md)
- [`docs/bulk-import/README.md`](../../docs/bulk-import/README.md)
- [`docs/bulk-import/content_import_architecture.md`](../../docs/bulk-import/content_import_architecture.md)
- [`docs/bulk-import/import_error_handling.md`](../../docs/bulk-import/import_error_handling.md)
