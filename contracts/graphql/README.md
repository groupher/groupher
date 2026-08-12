# GraphQL repository contract checks

This directory owns repository-wide GraphQL invariants. Application-local
schema tests remain beside their registries and validate executable documents;
these checks validate shared policy and repository wiring.

`scripts/assert-graphql-contract.mjs` currently enforces:

- the temporary exception manifest shape and expiry policy;
- a reachable issue URL or issue number for every exception; and
- the mock-server schema symlink resolving to
  `backend/main/schema.graphql`.

`scripts/assert-static-graphql.mjs` additionally checks that every Codegen
allowlist path exists and contains neither legacy `gql` templates nor runtime
interpolation inside `graphql()` documents. It also scans the core schema and
unit trees in the opposite direction, failing when an authoring document is
missing from `codegen.ts`.

SDL freshness is still orchestrated by `make be.gen.schema` in CI because it
requires the backend Elixir toolchain. The Pages and feature-local suites own
operation validation and are intentionally not duplicated here.
