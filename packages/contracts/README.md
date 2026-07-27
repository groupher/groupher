# @groupher/contracts

Shared protocol contracts for Groupher runtimes.

This package is intentionally framework-free. It may be imported by frontend apps,
Node backend services, local tools, and tests without pulling in React, Hono,
Next.js, filesystem code, or product business logic.

## Belongs Here

- Cookie names shared across Auth, Gateway, and browser clients.
- Service-to-service header names.
- Health response schema names and TypeScript types.
- Stable protocol-level error and endpoint names when they become shared.

## Does Not Belong Here

- Hono handlers or middleware.
- Fetch clients with runtime behavior.
- GraphQL queries or mutations.
- Dashboard, content-import, or Phoenix business logic.
- Frontend hooks, components, styles, or stores.

If a contract needs runtime dependencies or side effects, put the protocol type
here and the runtime helper in `@groupher/service`.
