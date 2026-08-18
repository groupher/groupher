# Groupher Mock Server

`frontend/mock-server` is a local-only GraphQL fixture server for frontend
development. It provides deterministic API-shaped responses when Phoenix is not
the subject of the current UI task.

## Position in the system

```text
Main / Dashboard development -> GraphQL client -> Mock Server -> fixtures
Production applications ------> Gateway -------> Phoenix
```

The mock server is not a production backend, authorization authority, or schema
source of truth. Fixtures must follow the generated GraphQL contract closely
enough to expose frontend drift instead of inventing a second API.

## Local development

```sh
yarn workspace @groupher/mock-server dev
```

Prefer real Phoenix when validating permissions, mutations, Session behavior,
or persistence. Use the mock boundary for isolated rendering and interaction
work only.
