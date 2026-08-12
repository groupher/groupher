# GraphQL Fragment And Typed Document Migration

> Status: v1 contract guardrails and typed-document slices are implemented; all
> Pages and Dashboard operation sources are now bounded static documents. The
> remaining work is SSR consumer/type cleanup and the separate TanStack Query
> migration.

## Objective

Replace Groupher's interpolated GraphQL field strings with standard GraphQL
fragments and make each operation a schema-valid, typed document.

This migration establishes a transport-independent GraphQL layer that can be
used by the current urql client and by a future TanStack Query integration.
Changing the request/cache library is deliberately outside the first migration.

The target separation is:

```text
GraphQL schema
      │
      ▼
fragments + operations + generated types
      │
      ├──────────────┐
      ▼              ▼
current urql     SSR/custom transport
DocumentInput    print(document) at HTTP boundary
      │              │
      └──────┬───────┘
             ▼
       Phoenix GraphQL

Future:

TypedDocumentNode
      │
      ▼
TanStack Query queryFn
      │
      ▼
same GraphQL transport
```

## Scope

This document covers:

- Replacing field-list string interpolation with standard named fragments.
- Representing queries and mutations as `TypedDocumentNode` values.
- Validating every registered operation against `backend/main/schema.graphql`.
- Generating operation result and variable types from the schema and documents.
- Preserving current urql, SSR, and custom GraphQL request behavior during the
  migration.
- Covering GraphQL consumers in the shared `frontend/core` package and the
  independent `frontend/dash` TanStack Start application.
- Establishing conventions that remain valid if the client later moves to
  TanStack Query.
- Running schema/operation compatibility checks at test and CI time without
  adding frontend or SSR runtime schema validation.

This document does not cover:

- Migrating hooks or caches from urql to TanStack Query.
- Designing TanStack Query keys, invalidation, optimistic updates, or hydration.
- Changing Phoenix GraphQL fields or resolver behavior except where a document
  is already invalid against the current schema.
- Introducing a normalized entity cache.
- Reorganizing unrelated frontend domain code.
- Loading `backend/main/schema.graphql` in Main, Dashboard, or Dash at runtime.

**明确边界：本次只实施 GraphQL fragments、typed documents、Codegen 和
schema contract checks。TanStack Query/QueryClient、query key、缓存
invalidation、`/api/posts` 到 `/api/graphql` 的 transport 迁移、Valtio
server-state 替换，以及任何 hook/cache 重构都不属于本次 fragment 迁移，必须
保留在独立的后续方案和实现中。**

## Current State

### Historical field strings

The former `frontend/core/schemas/fragments/` pseudo-fragment registry exported
strings such as:

```ts
export const userSocial = `
  github
  twitter
  company
  blog
`
```

Legacy operations inserted those strings directly into a selection set:

```ts
export const sessionState = `
  query {
    sessionState {
      user {
        ${F.author}
        social {
          ${F.userSocial}
        }
      }
    }
  }
`
```

This produced GraphQL text, but `F.author` and `F.userSocial` were not GraphQL
fragments. They had no fragment name, type condition, spread, or independently
valid AST node. The pseudo-fragment registry and its `~/schemas` runtime export
are now removed; migrated operations use named fragments in their owning
operation modules.

Consequences:

- GraphQL tooling cannot understand a field string on its own.
- Code generation cannot associate it with a schema type.
- A field removed from the backend can remain hidden inside an interpolated
  operation until runtime.
- Dependencies between an operation and its shared selections exist only as
  TypeScript string interpolation.
- Hand-written result types can drift from the operation and schema.

### The runtime accepts more than one document representation

The current frontend is already partly document-aware:

- `frontend/core/hooks/useQuery.ts` accepts urql `DocumentInput`, so a
  `TypedDocumentNode` can be passed directly.
- All migrated Pages and Dashboard operation modules now expose static
  `TypedDocumentNode` values. Some server/custom request paths still serialize
  documents to plain strings at their transport boundary.

The migration therefore does not need to convert every consumer to a new
request library. It needs one canonical document representation and small
adapters only at boundaries that still require serialized query text.

### Schema drift is currently a runtime failure

The recent `User.fromGithub` and `User.githubProfile` failure demonstrates the
problem: a frontend operation referenced fields absent from
`backend/main/schema.graphql`, so Phoenix rejected the complete operation and
the account session query failed.

The primary guardrail is not fragment syntax by itself. It is validating every
operation, including all of its fragments, against the checked-in backend
schema in CI.

### Existing migration blind spots

The migration must account for existing operation construction and transport
patterns, not only replace `F.*` field strings.

#### Computed operation factories

`frontend/core/schemas/fragments/base.ts` previously exported
`getUpvote(thread)` and `getUndoUpvote(thread)`. They computed root fields such
as `upvotePost` with template interpolation and also had a `withLatestUser`
selection branch. Repository-wide inspection found no runtime call sites, so
Phase 0B deletes these obsolete factories and removes their registry exports.

This category is now closed for the pilot: the factories are gone rather than
being placed in a permanent controlled-dynamic layer. The historical handling
rule remains relevant to any newly discovered factory:

1. Delete them if their current lack of callers means they are obsolete.
2. Otherwise enumerate the supported thread/action combinations as named static
   documents and make the selection variants static as well.

There is no permanent "controlled dynamic layer" in the target architecture.
Runtime construction of operation names, root fields, arguments, directives,
or selection sets is prohibited. A temporary exception is migration debt, not
a supported extension point.

#### Codegen plucking and broad globs

Codegen does not treat every ordinary TypeScript string as a GraphQL document.
For code files it plucks recognized `gql` templates, including `gql` imported
from urql, and magic-comment GraphQL strings. During plucking, JavaScript
interpolations are removed rather than evaluated.

Consequently, scanning all of `frontend/core/**/*.{ts,tsx}` during the pilot is
unsafe. Non-operation templates can become invalid or misleading documents:

- `upvote${titleCase(thread)}` is no longer the runtime field name.
- `${author}` can leave an empty selection set and cause a parse failure.
- A template consisting only of an interpolation can become empty and be
  silently absent from discovery.

The pilot must scan only migrated, statically known documents. The current
Codegen allowlist covers every migrated operation source; the explicit
`pageDocuments`/feature inventory remains the schema-test ownership map, not a
runtime registry or a substitute for document discovery.

#### SSR response unwrapping

`frontend/core/lib/ssr/index.ts` previously called `extractQueryName(schema)`
and used the result as `data[...]`. `extractQueryName` now accepts
`string | DocumentNode` for transition compatibility, but an operation name is
not a GraphQL response key:

```graphql
query PagedPosts {
  pagedPosts {
    entries {
      innerId
    }
  }
}
```

The response key above is `pagedPosts`, not `PagedPosts`. An alias would become
the response key instead. This boundary must therefore either carry an explicit
result key beside each dynamically selected document, or inspect the first root
field and return `alias ?? fieldName`. It must not unwrap data using the
operation definition name.

Two serialization adapters already exist and should be treated as current
state, not future work:

- `frontend/core/lib/graphql/server.ts` accepts `string | DocumentNode` and
  prints documents at the HTTP boundary.
- `frontend/dash/src/server/cms.ts` has the equivalent `toQuery()` adapter.

During the transition, `extractQueryName` keeps its legacy string parser but
reads a `DocumentNode` directly from its AST (operation name, or the first root
field for an anonymous document). SSR uses the shared
`extractRootResponseKey(string | DocumentNode)` helper, which reads the first
root field's `alias ?? name`; it never unwraps by operation name.

#### Shared documents across applications

`frontend/dash` is an independent TanStack Start, Vite, and Cloudflare
application, and its server code imports operation documents owned by
`frontend/core`. It is in migration scope. Whether Dash may later own Dash-local
operation sources or must continue consuming documents owned by `frontend/core`
remains an explicit open decision.

The legacy `frontend/dashboard` Next application follows the same producer /
consumer boundary: its docs editor imports the shared `schema/docs` module
directly. Neither application imports generated implementation files or a
central runtime registry.

Dashboard operation ownership follows route data boundaries rather than the
size of the old registry. The domain schema modules under
`frontend/core/unit/DashboardThread/schema/` are grouped as:

| Route family                          | Facade            |
| ------------------------------------- | ----------------- |
| community shell, overview, workplace  | `shell.ts`        |
| info, header, footer, SEO, domain     | `settings.ts`     |
| appearance subroutes                  | `appearance.ts`   |
| post, changelog, kanban, trash        | `content.ts`      |
| doc tree, editor, publish, cover      | `docs.ts`         |
| tags                                  | `tags.ts`         |
| admins/passport                       | `admins.ts`       |
| assets                                | `assets.ts`       |
| press, third-party, external metadata | `integrations.ts` |

The parent community route owns only shared shell data. Child route loaders and
hooks own their route-specific queries; entering an appearance or docs route
must not implicitly load unrelated assets, moderators, or publishing data. Each
domain module is now an independent source of operation definitions; it can
be migrated to static typed documents without a central Dashboard registry.

The Codegen source globs and per-operation migration must cover both core
consumers and Dash consumers. Generated implementation files are not a package
surface exposed to either application. When a Dash operation is migrated, its
duplicate hand-written operation response type must be removed in the same
slice. References to "Dashboard" in the migration plan must distinguish the
legacy `frontend/dashboard` Next application from `frontend/dash`.

#### Mock schema authority

`frontend/mock-server/schema.graphql` is currently a symbolic link to
`backend/main/schema.graphql`; it is not an independent schema copy. The backend
schema remains the single contract authority for Codegen, contract tests, and
the mock server. CI must preserve this invariant by resolving both paths and
asserting that they identify the same file. If the repository ever stops using a
symbolic link, CI must require byte-identical schema content instead.

## Target Model

### Standard fragment

A reusable selection must be a named GraphQL fragment with an explicit type
condition:

```ts
import { graphql } from '~/graphql/authoring'

export const SessionStateDocument = graphql(`
  fragment SessionUserFields on User {
    login
    nickname
    avatar
    shortbio
    bio
    passport
    social {
      github
      twitter
      company
      blog
    }
    achievement {
      reputation
      articlesUpvotesCount
      articlesCollectsCount
      donateMember
      seniorMember
      sponsorMember
    }
  }

  query SessionState {
    sessionState {
      isValid
      user {
        ...SessionUserFields
        geoCity
        location
        subscribedCommunitiesCount
      }
    }
  }
`)
```

The `graphql()` helper is supplied internally by the GraphQL Code Generator
client preset and exposed only through the stable `~/graphql/authoring` module.
This is an operation-authoring API for `schemas/**` and feature
`graphql/operations.ts` modules, not a general business API. Pages, hooks, SSR,
and Dash import concrete documents from their owning operation modules. No code
outside the authoring boundary imports from a `generated/` path.

The example demonstrates document structure, not an authoritative replacement
field list. Before replacing any `F.*` interpolation, expand the existing field
set, trace real consumer reads and existing result types, and classify every
field as retained, moved to another purpose-specific fragment, or intentionally
removed with evidence. For example, the current `F.author` includes `shortbio`;
the account pilot must not lose it by copying an incomplete example.

Fragments that are genuinely shared may live in separate discovered documents,
but code generation must compose their definitions into every generated
operation that spreads them. Runtime callers must never assemble this
dependency manually.

The server receives one document containing both definitions:

```graphql
query SessionState {
  sessionState {
    isValid
    user {
      ...SessionUserFields
      geoCity
      location
      subscribedCommunitiesCount
    }
  }
}

fragment SessionUserFields on User {
  login
  nickname
  avatar
  shortbio
  bio
  passport
  social {
    github
    twitter
    company
    blog
  }
  achievement {
    reputation
    articlesUpvotesCount
    articlesCollectsCount
    donateMember
    seniorMember
    sponsorMember
  }
}
```

### Typed operation

The long-term exported value is a `TypedDocumentNode<Result, Variables>`, not a
raw query string plus unrelated hand-written generic:

```ts
export const SessionStateDocument: TypedDocumentNode<SessionStateQuery, SessionStateQueryVariables>
```

These types should be generated from the checked-in schema and the operation,
not maintained by hand.

For urql consumers:

```ts
const { data, loading, error } = useQuery(SessionStateDocument, {})
```

For a transport that accepts only a string:

```ts
import { print } from 'graphql'

await postGraphQL({
  query: print(SessionStateDocument),
  variables: {},
})
```

`print()` belongs at a legacy HTTP/serialization boundary. It must not be added
to every urql call site.

## Fragment Design Rules

### Name fragments by semantic contract

Use names describing why the selection exists, not merely the schema type:

```text
SessionUserFields
UserCardFields
CommentAuthorFields
ArticleListItemFields
DashboardCommunityFields
```

Avoid a single global `UserFields` fragment that grows into the union of every
screen's needs. That recreates hidden coupling and over-fetching.

### Keep fragments close to their consumers

Default placement:

```text
feature/
  graphql/
    fragments.ts
    operations.ts
```

A fragment should move into a shared GraphQL directory only when multiple
independent features intentionally share the same data contract. Similar field
lists alone are not sufficient reason to create a global fragment.

### One schema type per fragment

The `on Type` clause must match the actual backend schema type. Nested object
selections may remain inside a parent fragment when they are part of one UI
contract. A nested selection should become a separate fragment only when it is
independently reused or independently meaningful.

### Fragment names must be globally unique

Use the domain or feature in the name. Do not define two different
`UserFields` fragments in documents that may be composed together.

### Operations must be named

Do not add anonymous operations:

```graphql
query SessionState { ... }
mutation UpdateUserProfile($profile: UserProfileInput!) { ... }
```

Named operations improve persisted diagnostics, server logs, code generation,
and test output.

### Do not hide authorization-dependent fields

Directives and viewer-dependent fields must remain explicit when that makes the
operation contract clearer:

```graphql
query User($login: String!, $includeViewerState: Boolean!) {
  user(login: $login) {
    ...UserProfileFields
    viewerHasFollowed @include(if: $includeViewerState)
  }
}
```

A broad shared fragment should not silently make an otherwise public query
viewer-specific or uncacheable.

### Never interpolate field-list strings into new documents

Allowed during the temporary urql `gql` migration path:

```ts
gql`
  query User { ... }
  ${UserProfileFragment}
`
```

The canonical generated `graphql()` path uses statically known document text;
do not interpolate arbitrary values into it.

Disallowed for new or migrated code:

```ts
gql`
  query User {
    user(login: $login) {
      ${F.author}
    }
  }
`
```

### Never compute executable documents at runtime

Static discovery applies to the complete operation, not only its fragments.
Do not compute field names or operation structure from a thread, feature flag,
or arbitrary string:

```ts
// Disallowed
const getUpvote = (thread: string) => gql`
  mutation Upvote($article: ArticlePathInput!) {
    upvote${titleCase(thread)}(article: $article) { innerId }
  }
`
```

Use an explicit, finite map of statically generated documents instead:

```ts
const UPVOTE_DOCUMENT = {
  post: UpvotePostDocument,
  changelog: UpvoteChangelogDocument,
  doc: UpvoteDocDocument,
} as const
```

Every value in such a map must be independently discoverable and validated.

### Temporary exception policy

An allowlist is permitted only to unblock an incremental migration. Every entry
must contain all of the following:

```ts
type TGraphQLMigrationException = {
  id: string
  owner: string
  reason: string
  issue: `https://github.com/groupher/groupher/issues/${number}`
  expiresOn: string // ISO date
}
```

CI validates the issue reference syntactically and does not make a network call
or require GitHub credentials. It must reject issue URLs outside the Groupher
repository, non-positive issue numbers, invalid ISO dates, expired entries,
duplicate ids, and empty owner or reason fields. Review is responsible for
confirming that the referenced issue exists and describes the debt.

An exception may identify a document that intentionally targets a different
schema or a bounded legacy operation awaiting conversion. It must not suppress
ordinary validation errors or establish a permanent dynamic-operation API.

## Document ownership and contract inventory

Production callers no longer use a shared `P` lookup registry. They import the
operation from the page or feature module that owns it. The Pages contract
suite keeps an explicit `pageDocuments` inventory for validation only; it is
not exported through `~/schemas` and is not a runtime lookup layer.

During migration, individual legacy boundaries may still accept this union:

```ts
type GraphQLDocument = string | DocumentNode
```

That union is transitional. The target registry contains only typed documents.

Do not annotate the registry as a broad
`Record<string, TypedDocumentNode<unknown, Record<string, unknown>>>`; that
would erase operation-specific result and variable types. Static property
access on an inferred object literal can preserve each document type. Where
truly dynamic indexed lookup or a union of document/variables pairs loses their
correlation, prefer direct imports or an explicitly typed finite map and shrink
the registry over time.

## Schema Contract Validation

### Required CI check

The repository already includes the `graphql` package and has the same pattern
in `frontend/core/unit/DashboardThread/dashboard-mutations.schema.test.ts`.
Phase 0A should add a focused `pages.schema.test.ts` beside the page registry,
using only `graphql` and Vitest:

```ts
import { readFileSync } from 'node:fs'
import { buildSchema, parse, validate } from 'graphql'

const schema = buildSchema(readFileSync('backend/main/schema.graphql', 'utf8'))

const documents = Object.entries(pageDocuments).map(([name, source]) => ({
  name,
  document: typeof source === 'string' ? parse(source) : source,
}))

it.each(documents)('$name matches the current GraphQL schema', ({ name, document }) => {
  const errors = validate(schema, document)

  expect(errors, `${name}: ${errors.map(({ message }) => message).join('; ')}`).toEqual([])
})
```

The parameterized cases are test granularity, not one new test file or CI job per
operation. One suite may iterate the complete inventory, but it validates each
executable document independently and reports the operation id on failure. This
avoids both an opaque all-or-nothing assertion and false conflicts caused by
combining unrelated operations into one artificial GraphQL document.

For Phase 0A, the explicit `documents` value inside the schema test is the
concrete inventory artifact. It covers the Pages operations immediately and makes no claim of
full-repository coverage. Feature-local registries and finite operation maps add
explicit imports to their nearest schema contract test during Phase 0B or when
their product slice migrates. Do not add the inventory to production runtime
code.

`dashboard-mutations.schema.test.ts` already validates `user` and
`sessionState`. When `pages.schema.test.ts` takes ownership of the Pages inventory, remove those
two entries and the `userSchema` import from the Dashboard suite in the same
change. Coverage moves to the page-registry owner; it is not duplicated. The
Dashboard suite continues to own only Dashboard feature-local documents.

Source guards must also find computed operation factories that cannot enter the
inventory. Each factory must be deleted, converted to static documents, or
temporarily recorded under the exception policy. A simple `${F.*}` search is
useful but insufficient on its own because it misses other executable template
interpolation.

The check must fail on:

- Unknown fields or arguments.
- Unknown schema types.
- Invalid fragment type conditions.
- Missing fragment definitions.
- Duplicate or conflicting fragment names in one document.
- Invalid variables and directive usage.

### Build-time only, client-library independent

Main, Dashboard, and Dash do not load the SDL or call `validate()` at runtime.
The contract suite runs before application build and browser E2E:

```text
Phoenix Absinthe
      │ make be.gen.schema
      ▼
backend/main/schema.graphql
      │
      ├── git diff: SDL freshness
      ├── validate Main operations
      ├── validate Dashboard operations
      ├── validate Dash operations
      └── Codegen
```

The validation layer imports neither urql nor TanStack Query. Legacy runtime-
composed strings are parsed in the test; migrated `DocumentNode` or
`TypedDocumentNode` values are validated directly. Replacing urql with TanStack
Query therefore changes request/cache orchestration, not the schema contract.

The minimum Phase 0A CI sequence is:

1. Run `make be.gen.schema`.
2. Fail on a diff to `backend/main/schema.graphql`.
3. Run the Pages GraphQL schema contract suite.

The repository workflow at `.github/workflows/graphql-contract.yml` is the
executable form of this gate. It also asserts that
`frontend/mock-server/schema.graphql` remains a symbolic link to the backend
SDL; broader mock-server and repository source invariants remain Phase 0B.

This is the smallest credible guardrail: the schema test alone would only prove
compatibility with a possibly stale checked-in SDL. Phase 0B adds repository-
level source and mock-schema invariants. Phase 1 then adds Codegen/type checks
for migrated documents. CI grows by composing those checks; Phase 0A does not
wait for the complete contract infrastructure.

### Repository contract boundaries

`backend/main/schema.graphql` is the only GraphQL schema authority. The mock
server, frontend contract tests, and Codegen consume it; none keeps a copy.

`@groupher/contracts` remains the framework-free TypeScript projection for
shared protocol identifiers such as auth cookies, headers, and health payload
types. Its own package boundary explicitly excludes GraphQL queries and
mutations, so GraphQL documents, generated operation types, and schema-test
inventories do not move into `packages/contracts`.

When Phase 0B establishes repository-wide hardening, GraphQL contract ownership
is split by scope:

| Location                                  | Owns                                                                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contracts/graphql/`                      | Repository-level policy, any required exception manifest and validator, mock-schema realpath assertion, SDL freshness orchestration, computed-operation/source guards, and shared failure fixtures. |
| App- or registry-local `*.schema.test.ts` | Validation of that owner's executable operations against the backend SDL.                                                                                                                           |
| Codegen configuration                     | Static document discovery and generated type/document output.                                                                                                                                       |
| CI commands                               | Ordering these checks without duplicating their implementations.                                                                                                                                    |

The repository-level layer does not maintain a second operation inventory.
Pages and Dashboard each keep their explicit owner-local contract inventory;
Dash currently consumes core-owned documents. Each operation has one explicit
schema-test owner.

`contracts/graphql/` may reference the backend SDL, but it must not contain a
second `schema.graphql`. Moving the existing `contracts/services/health/`
directory to `contracts/health/` remains a separate contract-layout cleanup and
does not block Phase 0A schema-drift protection or the Phase 1 pilot.

### Registry coverage is not sufficient long term

CI should discover documents from feature-local sources rather than rely on a
runtime registry. GraphQL Code Generator can scan configured `.ts`, `.tsx`, and
`.graphql` document locations and validate them against the schema as part of
generation.

The explicit contract test should remain until document discovery demonstrably
covers all runtime registries and every document in statically selected
operation maps. Dynamic operation construction is not a long-term coverage
category; it must reach zero.

### Generated files must not become the schema authority

`backend/main/schema.graphql` remains the checked-in contract for frontend
validation. Generated TypeScript types are derived artifacts. Regenerating
types must fail when an operation is invalid; it must not silently edit or
weaken the backend schema.

## Code Generation

Adopt GraphQL Code Generator after the first contract test is in place. The
recommended output is the client preset or an equivalent configuration that
produces typed documents without coupling operations to one request library.

Conceptual configuration:

```ts
import type { CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: 'backend/main/schema.graphql',
  documents: [
    'frontend/core/schemas/pages/user.ts',
    'frontend/core/schemas/pages/user.fragments.ts',
  ],
  pluckConfig: {
    globalGqlIdentifierName: [],
    modules: [
      {
        name: '~/graphql/authoring',
        identifier: 'graphql',
      },
    ],
  },
  generates: {
    'frontend/core/lib/graphql/generated/': {
      preset: 'client',
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
}

export default config
```

This is a pilot allowlist, not the final repository glob. Expand it only with
real source paths as product slices move to static documents. There is no new
`frontend/core/graphql/` source directory in this plan. Do not point Codegen at
all of `frontend/core` while legacy interpolated urql templates remain.

The checked-in allowlist currently includes the account documents, all fixed
Pages documents (including the bounded public tree), and all Dashboard domain
operations and fragments. The product limit for the tree is three visible
levels (root, child, grandchild), represented by explicit static fragments
rather than runtime recursion. The allowlist remains intentionally explicit so
ordinary non-GraphQL TypeScript strings cannot become false-positive documents.

The pilot disables client-preset fragment masking because current urql
consumers still read fragment fields directly. This is a compatibility choice
for the migration boundary; it does not expose generated implementation paths
to business modules.

The generated output lives under the existing `~/graphql` alias at
`frontend/core/lib/graphql/generated/`, but that path is private implementation
detail. The existing `frontend/core/lib/graphql/index.ts` aggregates runtime
client, proxy, document, and server exports and must not depend on generated
files. A separate authoring-only module isolates that dependency:

```ts
// frontend/core/lib/graphql/authoring.ts
export { graphql } from './generated'
```

Operation definition modules import `graphql` from `~/graphql/authoring`.
Feature code, pages, hooks, SSR, and Dash import concrete documents from their
owning operation modules. They must not import `~/graphql/generated`, generated
file paths, or generated implementation types directly. When a generated
result or variables type must cross a feature boundary, the owning operation
module re-exports it under a stable feature-facing name.

The authoring facade is a technical hypothesis until the pilot proves document
discovery. The explicit `pluckConfig.modules` entry tells Codegen to recognize
that import source; Codegen is not expected to follow the re-export module on
its own. The first pilot run must assert that generated outputs contain the
`User` and `SessionState` operation types/documents rather than silently
producing schema-only artifacts. It must also type-check the authoring import and
prove an unknown-field fixture exits non-zero.

That smoke check is executable as `yarn contract:graphql:generated`; CI runs it
immediately after Codegen and before the generated-directory diff.
The CI job also requires every generated file to be tracked before regeneration;
an untracked output directory cannot satisfy the freshness gate.

If that falsifiable check fails with the chosen Codegen version, operation
definition modules may import the generated helper directly as a narrowly
scoped fallback. That exception applies only to operation authoring files; it
does not expose generated paths to pages, hooks, SSR, or Dash. Optimizer-specific
options such as artifact directories or external document mode are configured
separately if an optimizer is adopted; they are not substitutes for proving CLI
document discovery.

Providing `pluckConfig.modules` may replace the plucker's default module list
rather than append to it. The current allowlist contains only authoring
documents, so its configuration intentionally lists only that module. Before
an allowlist expansion includes legacy urql files, add both `urql` and
`@urql/core` entries (or keep those files on the contract inventory) and prove
their discovery. It also sets
`globalGqlIdentifierName: []`: omitting this option leaves the plucker's default
global `graphql`/`gql` name matching active, so unrelated local functions or
variables can still be treated as document sources as the glob expands. This
repository does not inject a global GraphQL tag; import provenance is part of
the discovery contract, not an optional optimization.

A smoke check with GraphQL Code Generator CLI 7.2.0 and client preset 6.1.2
confirmed both sides of this contract: `graphql()` imported from
`~/graphql/authoring` produced a typed `SmokeSessionState` document, while the
same identifier imported from an unconfigured local module was ignored only
after `globalGqlIdentifierName` was explicitly set to an empty array.

Before expanding the documents glob, verify discovery coverage for both an
authoring `graphql()` document and any legacy urql `gql` document that enters
the scan. A negative fixture must also prove that the same identifier names from
an unconfigured local module, or declared locally, are not plucked. Legacy files
that are not yet proven discoverable stay on the explicit schema-test inventory.
A glob expansion must never reduce the known operation count silently.

During Phase 1, core produces the pilot documents and Dash only consumes them;
no Dash-local operation source is introduced. If the ownership decision later
allows Dash-local documents, their exact source paths enter the same Codegen
discovery while output remains behind the `~/graphql/authoring` boundary.

### Generated artifact lifecycle is a Phase 1 gate

The generated directory is a compile-time dependency of authoring modules. This
pilot resolves that lifecycle by committing generated artifacts. Normal build
and type-check commands therefore work from a clean checkout; CI reruns
`yarn graphql:codegen` and fails on a generated diff. Codegen must run before a
change to a source document is accepted, but it is not a hidden runtime import
dependency for the existing `~/graphql` transport exports.

Regardless of the generated artifact, unrelated imports such as
`~/graphql/server`, `~/graphql/document`, and `~/graphql/proxy` remain loadable
without traversing the authoring or generated modules.

Generated artifacts should provide:

- Operation result types.
- Operation variable types.
- Fragment result types where consumed independently.
- Typed document values.

Once generated types cover an operation, remove its duplicate hand-written
query response type rather than maintaining two authorities.

## Migration Plan

### Phase 0A: Install the minimum schema-drift guardrail

Deliver this as a small, dedicated change before converting any fragment:

1. Add `pages.schema.test.ts` using `buildSchema`, `parse`, and `validate`.
2. Give that test an explicit parameterized `pageDocuments` inventory; move the existing
   `user` and `sessionState` cases out of
   `dashboard-mutations.schema.test.ts` so those operations have one test owner.
3. Add `make be.gen.schema` plus
   `git diff --exit-code -- backend/main/schema.graphql` before the Pages schema
   test in CI.

Phase 0A is complete when CI proves both that the checked-in SDL matches the
backend and that every operation listed in `pageDocuments` validates against
it. Its claim is deliberately limited to the Pages inventory; it does not claim that
feature-local registries or computed factories are already covered. This
minimum guardrail, rather than the complete repository contract system, is the
gate for starting Phase 1.

### Phase 0B: Harden repository-wide contract coverage

Phase 0B may proceed alongside or after the account pilot, but it must complete
before Phase 2 broadens document discovery or the project claims that every
production operation is protected:

1. Extend adjacent schema tests with feature-local registries and finite
   operation maps, preserving one test owner per operation. The current core
   inventory is explicit in `frontend/core/schemas/feature.schema.test.ts` and
   validates 149 feature-local documents in addition to the Pages registry.
2. Delete unused computed factories or enumerate their supported variants as
   named static documents; the known upvote/undo-upvote factory is an explicit
   exit condition, not an invisible deferred risk.
3. Establish `contracts/graphql/` only as repository-level checks acquire a
   real home: policy, schema freshness orchestration, source guards, mock-schema
   realpath assertion, and genuinely shared failure fixtures.
4. Require `frontend/mock-server/schema.graphql` to resolve to the backend schema
   authority; this is mandatory before relying on mock-backed E2E as a contract
   signal.
5. Introduce an exception manifest only if a source guard has a real temporary
   exception. Every entry requires owner, reason, issue, and expiry, and CI
   rejects expired or incomplete entries.

The independent `contracts/services/health/` to `contracts/health/` cleanup may
land later in a separate commit or PR. It belongs to neither Phase 0A nor the
Phase 1 gate.

### Phase 1: Prove and extend the typed-document pattern

Start with `frontend/core/schemas/pages/user.ts` because `sessionState` and
`user` exposed the current schema drift. The same v1 pattern is now applied to
all fixed-shape Pages documents and Dashboard feature slices; no executable
operation remains in a runtime-generated or interpolated GraphQL form.

Before changing those operations, use TypeScript operation modules with the
generated `graphql()` helper for this migration. The artifact lifecycle is
already resolved: generated files are committed and checked by CI. Dash
document ownership is not an account-pilot gate; Phase 1 keeps Dash as a
consumer of core-owned documents.

1. Give both operations stable names.
2. Remove fields absent from the backend schema.
3. Commit the generated artifacts under
   `frontend/core/lib/graphql/generated/`; `yarn graphql:codegen` followed by a
   clean git diff is the reproducibility check.
4. Add the Codegen client preset with a pilot-only documents allowlist and expose
   its helper through `~/graphql/authoring`. The pilot must configure that
   authoring import explicitly. Add and test `urql` or `@urql/core` module
   entries before legacy files using those tags enter the documents glob; the
   account-pilot smoke check alone cannot prove their discovery.
5. Run the authoring-discovery smoke check immediately: generated output must
   contain the `User` and `SessionState` documents/types, the pilot must
   type-check, and an unknown-field fixture must fail Codegen/validation. If the
   facade cannot be made discoverable with the selected version, use a direct
   generated-helper import only inside operation authoring modules.
6. Expand `F.author`, `F.userSocial`, and `F.achievement`; trace real consumer
   reads and types; then replace them with purpose-specific standard fragments
   without silently dropping fields such as `shortbio`.
7. Export generated typed documents from their owning operation module.
8. Pass the document directly to the existing urql-based `useQuery`.
9. Reuse the existing core `gqFetch` and Dash `toQuery()` serialization
   adapters rather than duplicating `print()` at call sites.
10. Keep `extractQueryName`'s string parser as temporary compatibility while
    handling `DocumentNode` inputs from the AST, and use
    `extractRootResponseKey` for SSR response lookup.
11. Keep the compatibility `gqFetch` signature as
    `variables?: Record<string, unknown>` and its raw `Response` result for
    legacy callers. The new `gqFetchTyped(TypedDocumentNode, variables)` helper
    now provides variable/result inference for migrated SSR call sites; migrate
    the remaining runtime functions incrementally rather than rewriting all of
    `runtime.ts` at once.
12. Add validation and consumer tests.

Do not begin with a global mechanical conversion of every unrelated TypeScript
template string. GraphQL documents are now migrated slice by slice, with the
explicit Codegen allowlist preventing non-GraphQL strings from entering
discovery.

### Phase 2: Convert by product slice

Suggested order:

1. Account and public user profile.
2. Article/post/changelog/doc read paths.
3. Comments and reactions.
4. Dashboard read paths, explicitly separating `frontend/dashboard` from
   `frontend/dash` and including both where they consume migrated documents.
5. Mutations and editor flows.
6. Remaining low-traffic and legacy registries.

For each slice:

```text
identify operation consumers
        │
        ▼
define purpose-specific fragments
        │
        ▼
convert operations to typed documents
        │
        ▼
validate against schema
        │
        ▼
remove replaced field strings and hand-written types
```

### Phase 3: Retire pseudo fragments

The former shared pseudo-fragment registry has now been removed. For any
remaining legacy field-list string discovered outside the current allowlist:

- Delete that field string.
- Remove it from the fragment registry.
- Prevent new `${F.*}` selection interpolation through a lint check or focused
  source test.

Do not recreate a runtime registry or keep dead pseudo fragments as a
compatibility catalog. A focused source guard is the remaining follow-up for
this phase.

### Phase 4: Make typed documents canonical

**当前已完成的 cleanup slice：Core SSR 的固定文档已通过 `gqFetchTyped`，Dash
和 Dashboard 的 server loaders 已直接传递 typed documents，并删除了对应的
手写 operation envelope。domain model 与 generated result 之间仍保留显式
adapter；这不是重新引入运行时 schema check。**

The current Codegen allowlist now contains static documents for all known Pages
and Dashboard operation sources. The remaining Phase 4 work is consumer and
transport cleanup:

- Remove `string` from GraphQL client input types where it is no longer needed.
- Remove repeated `gql\`${stringOperation}\`` wrappers.
- Keep serialization inside SSR/custom HTTP transports.
- Replace the Phase 1 SSR compatibility signature with a typed data helper that
  accepts `TypedDocumentNode<TResult, TVariables>`, checks `TVariables`, and
  returns `TResult`; SSR must not permanently retain
  `Record<string, unknown>` as its canonical document API.
- Remove hand-written operation response interfaces replaced by generated
  types.
- Make code generation and schema validation required checks.

### Phase 5: Prepare, but do not perform, TanStack Query migration

**本阶段只有兼容性说明，不引入 TanStack Query，也不修改当前 urql、SSR 或
浏览器 transport。所有 QueryClient、query key、hydration、mutation cache
和 `/api/posts` 生命周期工作都必须在独立文档中完成。**

At this point GraphQL operations are independent of urql. A later migration can
reuse the same typed documents:

```ts
useQuery({
  queryKey: ['user', variables],
  queryFn: () => graphQLRequest(UserDocument, variables),
})
```

That later project must separately decide:

- Query-key factories and canonical variable serialization.
- SSR prefetch, dehydration, and hydration boundaries.
- Authenticated versus anonymous cache ownership.
- Mutation invalidation and optimistic updates.
- Cancellation and request deduplication.
- Whether any existing urql normalized-cache behavior must be replaced.

Those concerns must not leak into fragment names or operation definitions.

## TanStack Query Compatibility

Standard fragments and `TypedDocumentNode` are not tied to urql, Apollo, or
TanStack Query. They describe the GraphQL protocol document.

TanStack Query does not execute GraphQL. Its `queryFn` calls a transport:

```ts
async function graphQLRequest<TResult, TVariables>(
  document: TypedDocumentNode<TResult, TVariables>,
  variables: TVariables,
): Promise<TResult> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: print(document),
      variables,
    }),
  })

  const payload = await response.json()
  if (payload.errors?.length) throw toGraphQLError(payload.errors)
  return payload.data
}
```

The portable asset is the typed document. What changes during a future client
migration is lifecycle and cache orchestration, not the GraphQL query.

Important distinction:

```text
GraphQL fragment
  Reuses a typed field selection.

TypedDocumentNode
  Carries result and variable types with the executable document.

TanStack Query
  Caches a queryFn result by queryKey and manages request lifecycle.

Normalized GraphQL cache
  Optionally stores and updates entities by GraphQL identity.
```

Moving to TanStack Query does not automatically provide normalized entity
caching. Mutations will normally update or invalidate query-keyed results
explicitly.

## Test Plan

### Contract tests

- Every production operation validates against `backend/main/schema.graphql`.
- A single parameterized suite may own many operation cases; the required
  granularity is one independently validated executable document with its own id
  and failure message, not one file or CI job per operation.
- Each legacy operation has one explicit schema-test owner. The Pages suite owns
  `pageDocuments`; Dashboard tests do not retain duplicate `user` or
  `sessionState` cases.
- Every fragment spread resolves to a definition in the final document.
- Every fragment type condition exists and is compatible with its spread site.
- Document discovery covers both central registries and feature-local schemas.
- Every finite operation map contains only independently discovered static
  documents.
- A source inventory fails on an unlisted computed operation factory.
- Temporary exceptions fail when owner, reason, issue, or expiry is missing;
  issue URLs or ISO dates are malformed; ids are duplicated; or the expiry date
  has passed. The test performs no network request.
- The mock-server schema path resolves to the backend schema authority.
- A fixture containing an unknown field proves the check fails.
- No Main, Dashboard, or Dash runtime path loads the SDL or performs client-side
  schema validation.

### Type tests

- The authoring facade is discovered through the configured `pluckConfig` and
  produces non-empty artifacts for every operation and fragment in the
  Codegen allowlist; the account pilot markers remain a smoke subset.
- Before each documents-glob expansion, fixtures prove both the authoring
  `graphql()` tag and every legacy urql `gql` tag entering the glob remain
  discoverable; uncovered legacy files stay in the explicit contract inventory.
- A negative pluck fixture proves locally declared `graphql`/`gql` identifiers
  and imports from unconfigured modules are not treated as GraphQL documents.
- An unknown-field fixture proves Codegen/validation exits non-zero.
- Variables required by the schema are required by TypeScript.
- Nullable response fields remain nullable in generated types.
- A consumer cannot read a field absent from its operation.
- A mutation result and variables are inferred from its document.

### Runtime tests

- urql accepts migrated documents without serialization at the hook call site.
- SSR/custom transports serialize documents exactly once.
- SSR response unwrapping uses the root field or alias, never the operation name.
- Auth headers and anonymous/authenticated request boundaries are unchanged.
- GraphQL errors preserve the current client-facing error behavior.

### Regression tests

- `sessionState` successfully returns the current account state.
- Public `user` queries succeed against the checked-in schema.
- A schema field removal produces a CI failure before browser E2E.
- No operation sends an unresolved fragment spread.

## Acceptance Criteria

The fragment migration is complete when:

- No production operation interpolates pseudo-fragment field strings.
- Shared selections use named standard GraphQL fragments.
- Every production operation has a stable operation name.
- Every production operation validates against the checked-in backend schema.
- Schema compatibility is enforced before build/E2E and remains independent of
  urql, TanStack Query, and the runtime transport.
- Every production operation belongs to an auditable static discovery set; no
  executable document is assembled dynamically at runtime.
- There are no expired GraphQL migration exceptions, and the exception manifest
  is empty when the migration is complete.
- Operations and variables are represented by generated typed documents.
- urql consumers accept documents directly.
- String serialization exists only at actual transport boundaries.
- Replaced hand-written response types and pseudo-fragment entries are removed.
- CI fails on schema drift before application or E2E execution.
- Repository-level GraphQL invariants live in `contracts/graphql/`; app-local
  schema suites own operation validation and do not duplicate repository checks
  or another app's operation inventory.
- The GraphQL document layer has no dependency on a future TanStack Query API.

## Risks And Controls

### Over-shared fragments

Risk: one global fragment accumulates unrelated fields and makes every query
larger or authorization-sensitive.

Control: name fragments by use case and colocate them with consumers.

### Partial document composition

Risk: a spread is sent without its fragment definition.

Control: export complete operation documents and validate the final AST. Do not
export a query string that expects callers to remember additional fragments.

### Duplicate fragment names

Risk: independently authored fragments collide when documents are composed.

Control: use domain-qualified names and validate composed documents.

### Computed operation factories

Risk: a factory builds a valid runtime operation that Codegen and the contract
inventory cannot discover, or plucking its source produces a different invalid
document.

Control: delete unused factories and replace active factories with explicit
maps of named static documents. Do not retain a permanent dynamic allowlist.

### Permanent migration exceptions

Risk: an allowlist silently becomes a second, weaker contract system.

Control: require owner, reason, issue, and expiry on every entry; fail CI on
expired entries; require the manifest to be empty at migration completion.

### Big-bang migration

Risk: converting every operation simultaneously obscures runtime and type
regressions.

Control: migrate one product slice at a time, beginning with account queries.

### Generated-code churn

Risk: unstable configuration produces noisy diffs or duplicate authorities.

Control: settle the pilot configuration first, keep generated output in one
directory, and remove replaced hand-written types in the same slice.

### Premature TanStack Query coupling

Risk: query keys, invalidation rules, and hydration concerns distort the
GraphQL document migration.

Control: keep typed documents transport- and cache-client-independent; design
TanStack Query in a separate follow-up document and implementation.

## Decisions And Remaining Gates

1. **Resolved for this migration:** source operations remain in `.ts` files
   using the generated `graphql()` helper. Dedicated `.graphql` files are not
   part of the pilot, so the documents allowlist and pluck tests target
   TypeScript operation modules.
2. **Resolved for the account pilot:** generated artifacts are checked into git
   under `frontend/core/lib/graphql/generated/`; CI regenerates them and rejects
   any diff. The runtime `~/graphql` facade remains independent of that private
   generated directory.
3. **Resolved:** production callers use direct feature imports; the former `P`
   registry is deleted. Pages contract tests use an explicit inventory only.
4. **Resolved for the SSR compatibility boundary:** use the shared
   `extractRootResponseKey(string | DocumentNode)` helper; it returns
   `alias ?? rootField` and never uses the operation definition name.
5. **Resolved for v1:** keep the explicit Codegen allowlist. The operation
   sources are static, but broad repository globs still contain ordinary
   TypeScript strings and are not a safe discovery boundary.
6. Which current hand-written frontend types are domain models and should stay,
   versus operation response types that should be generated?
7. Should a lint rule prohibit new `${F.*}` interpolation immediately after
   the pilot, or only after the corresponding registry is fully migrated?
8. **Deferred until the first Dash-owned migration slice:** may
   `frontend/dash` own Dash-local `graphql()` operation sources discovered by
   the shared Codegen run, or must it remain a consumer of documents owned by
   `frontend/core`? This does not block the core account pilot.

## Recommended Decisions

For the initial implementation:

- Keep source documents in TypeScript and let only operation definition modules
  import `graphql()` through `~/graphql/authoring`; never expose or import the
  generated directory from business code.
- Use purpose-specific, colocated fragments.
- Land the Phase 0A SDL freshness check and `pages.schema.test.ts` before bulk
  conversion; do not make the account pilot wait for all Phase 0B infrastructure.
- Pilot `sessionState` and `user` together.
- Pass typed documents directly through urql.
- Reuse the existing core and Dash serialization adapters; serialize only in
  SSR/custom transports that require strings.
- Keep production callers on direct operation imports; do not reintroduce a
  cross-application runtime registry.
- Adopt the GraphQL Code Generator client preset for the explicit v1 allowlist;
  expand it only after each dynamic boundary has a static document design.
- Use a narrow pilot documents allowlist and expand it slice by slice.
- Configure `~/graphql/authoring` explicitly in `pluckConfig.modules` and make
  non-empty pilot artifact generation a Phase 1 smoke check, not an assumption.
- Explicitly preserve discovery of current urql tags when overriding pluck
  modules, explicitly disable global identifier matching with
  `globalGqlIdentifierName: []`, and require positive and negative discovery
  smoke tests before each glob expansion.
- Generate privately into `frontend/core/lib/graphql/generated/`, matching the
  existing `~/graphql` alias. Keep the runtime index independent and expose only
  the authoring helper through `frontend/core/lib/graphql/authoring.ts`.
- Commit generated artifacts and verify them with `yarn graphql:codegen` in CI;
  do not make the runtime transport facade depend on a prebuild side effect.
- Build `contracts/graphql/` incrementally in Phase 0B as repository-level
  checks acquire a real home, while keeping operation validation beside each
  owner. Complete dynamic-factory coverage and the mandatory mock-schema link
  assertion before broad Phase 2 discovery or any full-coverage claim.
- Keep the existing `contracts/services/health/` taxonomy unchanged in this
  migration; flattening it is an independent repository cleanup, not a GraphQL
  contract prerequisite.
- Keep Phase 1 Dash as a consumer of core-owned documents until the Dash
  ownership decision is resolved.
- Prohibit computed executable documents; keep any temporary exception
  manifest owner-bound, issue-bound, expiring, and empty at completion.
- Treat `backend/main/schema.graphql` as the schema authority shared by Codegen,
  contract tests, and the mock-server symlink.
- Keep schema validation in tests/CI only and implement it with `graphql`, not
  urql or TanStack Query APIs.
- Defer TanStack Query hooks, query keys, and cache behavior to a separate
  migration.
