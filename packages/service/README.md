# @groupher/service

Small runtime helpers for independently deployed Groupher Node services.

This package may depend on `@groupher/contracts` and browser-standard request
types. It should stay thin and backend-oriented. It must not depend on
`frontend/core`, Dashboard modules, Phoenix business code, or any product
workflow implementation.

## Belongs Here

- Health response builders.
- JSON response helpers with no-store defaults.
- Request auth parsing helpers such as bearer token readers.
- Cron secret checks.
- Future Hono middleware that is generic to backend services.

## Does Not Belong Here

- Dashboard proxy routes.
- Content import workflows or handlers.
- Gateway routing tables.
- Auth OAuth flow details.
- Phoenix GraphQL operations.
- Frontend hooks, components, stores, or styles.

Keep protocol constants and types in `@groupher/contracts`; keep runtime helpers
here.
