# OAuth Account Link And Unlink

> Status: design proposal; no implementation is implied by this document.
>
> This document covers linking and unlinking external OAuth identities for an
> already authenticated Groupher user. Initial sign-in and Browser Session
> lifecycle remain defined by [`v1.md`](./v1.md). First-party service identity
> and user delegation remain defined by [`v2.md`](./v2.md).

## Objective

Groupher users need to manage more than one external login identity without
creating duplicate Groupher users, allowing an external identity to move
between users, or letting browser-supplied provider data become identity proof.

The target contract must answer five questions explicitly:

1. Who proved the external provider identity?
2. Which authenticated Groupher user requested the change?
3. Which service is allowed to perform the account operation?
4. Which component owns the provider binding and its invariants?
5. How does the user retain at least one usable login method?

The short answer is:

```text
Auth proves the OAuth provider identity and orchestrates the browser flow.
Phoenix owns the Groupher user, provider binding, uniqueness, and unlink rules.
Dashboard/Main/Apply only render account settings and start the Auth flow.
```

## Scope

This document covers:

- Listing external identities linked to the current Groupher user.
- Linking a new OAuth identity to the current user.
- Idempotently handling an identity already linked to the current user.
- Rejecting an identity already linked to another user.
- Unlinking one identity without removing the last usable login method.
- Service Identity and delegated-user requirements for Auth-to-Phoenix calls.
- Browser Session behavior after link and unlink.
- Transaction, concurrency, audit, and failure semantics.

This document does not cover:

- Initial OAuth sign-in and new-user registration.
- Automatic account merging based on email address.
- Merging two existing Groupher users and their content.
- MCP, agent, third-party client, or Groupher-as-OAuth-provider grants.
- Enterprise tenant OIDC/SAML connection administration.
- Provider access-token storage for calling provider APIs after login.

## Terminology

```text
Groupher user
  The Phoenix-owned application account.

External identity
  One provider/provider-account-id pair, for example github/123456.

Provider profile
  Provider-returned display metadata such as login, avatar, and nickname.
  It is not the authority for selecting a Groupher user.

Link intent
  A short-lived, one-time Auth-owned record binding an authenticated Browser
  Session to a requested provider-link flow.

Provider binding
  The Phoenix-owned persistent association between one external identity and
  one Groupher user.

Login method
  A credential or external identity through which a Groupher user can establish
  a new Browser Session. In the first release, OAuth provider bindings are the
  only implemented login-method type.

Account merge
  A separate destructive workflow for combining two existing Groupher users.
  Linking must never perform an implicit merge.
```

## Current Architecture

### Sign-in

`backend/auth` uses `@auth/core` with a JWT Session strategy and no Auth.js
database adapter. Auth.js owns OAuth protocol handling, while Phoenix owns the
actual user and provider rows:

```text
Browser
  -> Auth /api/auth/*
  -> Provider authorization + callback
  -> Auth normalizes account/profile
  -> Phoenix signinOauth
  -> Phoenix creates or resolves User + OauthProvider + BrowserSession
  -> Auth sets its Session Cookie and groupher-auth.token
```

This means Auth.js `Adapter.linkAccount` is not the persistence boundary for
Groupher. There is no Auth.js `User`/`Account` database that can replace
Phoenix's `account.users` and `account.oauth_providers` tables.

### Persistent model

Phoenix stores external identities in `Accounts.Model.OauthProvider`:

```text
oauth_providers
  user_id
  provider
  provider_id
  login
  nickname
  avatar
  email / locale / location metadata
  raw provider profile
```

The database has a global unique index on `(provider, provider_id)`. This is the
correct fundamental identity invariant: one external provider identity may
belong to at most one Groupher user.

The model currently has no opaque public binding reference or timestamps, so it
cannot yet supply the proposed `publicRef` or `linkedAt` projection. It also
permits one Groupher user to have multiple identities from the same provider
because there is no `(user_id, provider)` unique index. The target V1 product
model rejects that case: one Groupher user may bind at most one account from
each provider.

### Current GraphQL operations

The old browser-facing `linkOauth` and `unlinkOauth` fields have been removed.
Phoenix now exposes only the Auth-scoped account-management contract:

```graphql
linkedOauthAccounts: LinkedOauthAccounts!
linkOauthIdentity(identity: VerifiedOauthIdentityInput!): LinkedOauthAccounts!
unlinkOauthIdentity(publicRef: ID!): LinkedOauthAccounts!
```

These operations require:

```text
audience phoenix:auth-api
scope    auth:oauth:read | auth:oauth:link | auth:oauth:unlink
delegated current user
```

Auth is the only intended caller. The remaining incomplete part is the
provider authorization orchestration that obtains a verified identity before
calling `linkOauthIdentity`.

## Current Problems

### 1. The old service contract was wrong (resolved)

Dashboard cannot prove that GitHub, Google, or another provider authenticated a
particular external identity. Only Auth owns provider authorization, callback,
state, PKCE, and normalized provider results.

The old Dashboard-scoped fields were removed. Dashboard no longer calls
Phoenix directly for account linking or unlinking.

Target owner:

```text
service:auth
audience phoenix:auth-api
scope    auth:oauth:link | auth:oauth:unlink | auth:oauth:read
```

### 2. The browser can describe an identity but cannot prove it

`OauthProviderInput` accepts `provider`, `providerId`, `login`, `avatar`, and
arbitrary profile fields. This is acceptable only after Auth has completed the
provider callback and is itself authenticated to Phoenix.

The same input must never become a browser-facing account-management contract.
In particular:

- `providerId` must come from the verified provider callback.
- `login`, `email`, and profile metadata are attributes, not linking authority.
- Matching email addresses must not trigger automatic linking or merging.
- `raw` must not accept arbitrary browser JSON or provider token sets.

### 3. Legacy token issuance was removed

The old GraphQL field and legacy token behavior are gone. Linking an identity
returns the updated provider binding projection and does not mint a Phoenix
bearer token or create a Browser Session.

The target result is the updated provider binding projection, not a credential.

### 4. Link can reassign an identity during a race

The current flow first checks whether `(provider, provider_id)` belongs to a
different user and then calls the generic `ORM.upsert_by/3` helper.

That upsert uses `(provider, provider_id)` as the conflict target and updates all
other changed fields, including `user_id`. Two concurrent link requests can
therefore pass the pre-check and let the conflict update move the external
identity from one Groupher user to another.

This violates the most important account-linking invariant. A provider binding
must never change owner through upsert.

The target write must use insert-only conflict semantics:

```text
insert binding for current user
  conflict, same user      -> idempotent success
  conflict, another user   -> OAUTH_IDENTITY_ALREADY_LINKED
  provider slot occupied   -> OAUTH_PROVIDER_ALREADY_LINKED
  never update user_id on conflict
```

### 5. Link is not one atomic domain transaction

Provider creation and the GitHub-derived `Social` update are executed as
separate steps. If the derived-profile update fails after provider insertion,
the account is linked even though the mutation returns an error.

Binding persistence, required derived-state updates, and the audit event must
share one transaction. The current implicit partial-success contract is not
acceptable.

### 6. Concurrent unlink can remove the last login methods

The current unlink flow counts provider rows and deletes afterward. Two
concurrent requests can both observe a count of two and then delete different
rows, leaving the user with no login method.

The target operation must lock the owning user row inside one transaction before
checking the last-provider invariant and deleting. Link uses the same user-level
serialization point so inserts, deletes, and derived-state writes cannot interleave.

### 7. Unlink accepts too much input

Unlink only needs to identify one existing binding owned by the current user.
It should not accept a complete mutable provider profile.

The browser/API reference is an opaque binding `publicRef`. If Groupher
decides to permit only one identity per provider per user, a provider enum is
also sufficient for internal lookup, but public mutations still use the stable
binding reference. Raw provider account ids are never public mutation identifiers.

### 8. Derived profile state can become stale

Linking GitHub currently writes `Social.github`. Unlinking GitHub removes the
provider row but does not clear or recompute the derived social value.

The product must distinguish:

```text
login identity binding
user-authored social profile link
provider-derived profile suggestion
```

Unlink must not silently delete a user-authored social URL, but it also must not
leave provider-derived state pretending that the identity is still verified.
The source of each derived field therefore needs to be explicit.

### 9. Link orchestration must be separate from sign-in (resolved in Auth)

Auth now uses a dedicated link endpoint and callback. It never reuses the normal
sign-in callback for a link request, and a link callback fails closed when its
intent, Session, provider, or state does not match.

### 10. Test coverage still has a lower-level bypass

Some lower-level Phoenix tests still inject the compile-time-gated wildcard
test service actor and call Phoenix directly. Dedicated Auth and canonical
Phoenix tests now cover the target flow; the remaining bypass is test-only and
does not represent a production caller. The lower-level suite still needs to
be migrated if the bypass is to be removed entirely.

The canonical security contract is covered by tests for:

- Auth-owned link intent and callback binding.
- Provider callback verification.
- Correct `service:auth` audience and scope.
- Delegated current-user proof.
- Cross-user conflict behavior under concurrency.
- Last-provider safety under concurrent unlink.
- Browser Session behavior after link/unlink.

## Business Invariants

The following are required, not optional implementation details:

1. One `(provider, provider_account_id)` belongs to at most one Groupher user.
2. One Groupher user has at most one provider binding for each provider.
3. Linking never changes the owner of an existing provider binding.
4. Linking never merges two Groupher users automatically.
5. Email equality is not proof that two accounts belong to the same person.
6. The target Groupher user always comes from a verified delegated user actor.
7. Provider identity data always comes from an Auth-verified provider callback.
8. A user retains at least one usable login method after unlink.
9. Link and unlink are atomic and concurrency-safe.
10. Link does not create or replace a Browser Session.
11. Link does not return a new legacy access token.
12. An expired or revoked Browser Session cannot complete a stale link intent.
13. A link intent is provider-bound, short-lived, single-use, and replay-safe;
    an atomic server-side record is the consumption authority.
14. Provider tokens and full raw payloads are never written to logs or audit
    metadata.
15. Every link/unlink success and rejection is auditable without storing
    credentials.

## Ownership Decision

### Auth owns

- Account-management HTTP endpoints.
- Current Auth Session and Browser Session continuity.
- Link-intent creation, expiry, one-time consumption, and return URL.
- OAuth provider selection and authorization redirect.
- Provider callback, state, nonce, and PKCE validation.
- Provider account/profile normalization.
- Demand-driven refresh of the current Phoenix user credential when needed.
- Auth-to-Phoenix service identity and user delegation transport.
- Browser-facing redirect and error presentation.

### Phoenix owns

- Groupher users and external provider bindings.
- Stable/opaque binding references.
- Global provider-identity uniqueness.
- Same-user idempotency and cross-user conflict rejection.
- The last-login-method invariant.
- Atomic link/unlink transactions and row locking.
- Account state, blocking, and deletion policy.
- Derived profile-state ownership and cleanup rules.
- Link/unlink audit records.

### Product applications own

- Showing linked providers and their state.
- Sending the browser to canonical Auth to begin link/unlink.
- Rendering success, conflict, cancellation, and error UI.

Product applications do not receive provider credentials and do not call the
Phoenix link/unlink mutations directly.

## Login Methods Model

The first release has one login-method type: a persisted OAuth provider binding.
Groupher has no password, passkey, or provider-disabled state. The exact first-
release predicate is therefore:

```text
usable(binding)
  = the binding exists
  AND its owning Groupher user is active

usable_login_method_count(user)
  = count of that active user's oauth_providers rows
```

Phoenix is the sole owner of `usable_login_method_count` and `canUnlink`:

```text
canUnlink(binding) = usable_login_method_count(binding.user) > 1
```

Phoenix includes `canUnlink` in the canonical linked-account projection. Auth
passes it through and product applications render it; neither independently
recounts methods. The projection is only a UI hint. The unlink transaction must
recompute the predicate under the user lock and reject the last-method deletion
even when a client holds a stale `canUnlink: true` response.

## Provider Binding And Profile Ownership

Provider binding metadata and user-authored profile state are separate models:

```text
OAuth provider binding metadata
  provider account login, nickname, avatar, verified email, locale, location
  owned by the binding and refreshable from an Auth-verified callback

Groupher user/profile state
  Groupher login, nickname, avatar, bio, company, location, social links
  owned by the user and never overwritten merely because a binding is linked
```

Linking an identity to an existing user writes or refreshes binding metadata. It
does not overwrite User, Profile, or Social fields. Same-user idempotent link may
also refresh only the allowlisted binding metadata.

If Groupher chooses to project provider data into user-visible profile fields,
the projection must store field-level provenance sufficient to distinguish:

```text
user-authored
provider-derived(provider, binding publicRef)
system-generated
```

A user edit changes the field to `user-authored`. Unlink clears or recomputes
only values whose current provenance still points to the removed binding. It
must neither delete user-authored data nor leave provider-derived data presented
as verified after its source binding is gone. `Social.github`, `bio`, `company`,
`country`, `city`, `link`, avatar, nickname, and derived fields all follow
this policy; GitHub is not a special one-field exception.

New-user sign-in/registration may use provider metadata to initialize otherwise
empty Groupher fields under a separately documented registration policy. That
does not authorize link-to-existing-user to overwrite those fields.

## Target Persistent Binding Model

Every provider binding receives an opaque, stable `public_ref`. Public Auth and
GraphQL contracts identify a binding only through this reference; raw provider
account ids are not public mutation identifiers.

The target binding also records UTC timestamps so the projection can supply
`linkedAt`:

```text
oauth_providers
  public_ref       unique, not null, opaque
  user_id
  provider
  provider_id
  nullable provider metadata
  inserted_at      UTC
  updated_at       UTC

UNIQUE(provider, provider_id)
UNIQUE(user_id, provider)
```

Phoenix declares `inserted_at` and `updated_at` as `:utc_datetime`; migrations
use `:timestamptz` through the repository's UTC timestamp conventions.

The first index prevents one external identity from belonging to two Groupher
users. The second enforces the V1 product decision that one Groupher user cannot
link two different accounts from the same provider.

## Target Link Flow

```text
Browser                 Auth                  Provider               Phoenix
   |                      |                       |                      |
   | POST link(provider)  |                       |                      |
   |--------------------->| validate Origin/CSRF |                      |
   |                      | validate Session     |                      |
   |                      | create link intent   |                      |
   |                      |---------------------->| authorize + PKCE     |
   |<---------------------| redirect              |                      |
   |---------------------- OAuth ---------------->|                      |
   |                      |<----------------------| verified callback    |
   |                      | validate intent/state |                      |
   |                      | refresh user proof if needed                 |
   |                      | service:auth + delegated user                |
   |                      |--------------------------------------------->|
   |                      |                       | atomic link          |
   |                      |<---------------------------------------------|
   |<---------------------| clear intent + redirect                      |
```

### Link-intent contract

A link intent binds at least:

```text
action: link
target provider
current Phoenix browserSessionRef
random intent nonce
PKCE code verifier
validated return URL
created-at and short expiry
one-time consumption status
```

Every intent is a server-side record. A signed or encrypted stateless Cookie is
not an intent because it cannot enforce one-time consumption and can be replayed
until expiry. The browser may carry only a random opaque `intentRef` in a
host-only, HttpOnly, Secure Auth Cookie or integrity-protected OAuth state; all
provider, user, Session, expiry, nonce, and consumption authority remains in the
server-side record.

The intent state transition is atomic:

```text
pending -> consumed
```

Only one callback may change `pending` to `consumed`. A callback observing any
other state fails closed, and no Cookie deletion or client-side state change is
treated as proof of consumption.

The intent reference, intent nonce, and provider OAuth `state` have distinct
roles:

```text
intentRef
  Opaque reference to exactly one Auth-owned intent.

intentNonce
  Random secret stored with the intent and used to prevent substitution.

OAuth state
  Opaque provider round-trip correlation carrying the intentRef and nonce;
  the server-side record supplies the integrity and replay authority.
```

The callback first validates the OAuth state, then locates exactly one intent
and atomically consumes it before processing the provider result. It verifies the
provider and current `browserSessionRef` against that intent. A state value from
one flow cannot be combined with another intent, and a consumed callback cannot
be replayed. A transient failure starts a new intent rather than reviving a
consumed state.

The normal sign-in callback and link callback must be distinguishable before
Phoenix identity exchange:

```text
no valid link intent -> signinOauth
valid link intent    -> linkOauthIdentity for current delegated user
```

A malformed, expired, consumed, provider-mismatched, or Session-mismatched
intent fails closed and never falls back to sign-in or account creation.

### Link result rules

```text
identity not linked
  -> insert for current user
  -> success

identity already linked to current user
  -> idempotent success
  -> refresh allowed display metadata according to explicit policy

current user already has another identity from this provider
  -> OAUTH_PROVIDER_ALREADY_LINKED
  -> no replacement or ownership change

identity linked to another user
  -> conflict
  -> no ownership change
  -> no account merge

current user blocked/deleted/session revoked
  -> reject
  -> consume or invalidate intent
```

### Provider replacement

`OAUTH_PROVIDER_ALREADY_LINKED` never replaces the existing provider slot. To
link provider account B, the user must first unlink provider account A through
the normal last-login-method rule. The accepted V1 consequence is that a sole
GitHub, Google, or other provider account cannot be replaced by another account
from that provider because A cannot first be unlinked.

## Target Unlink Flow

```text
Browser                 Auth                               Phoenix
   |                      |                                    |
   | POST unlink(ref)     |                                    |
   |--------------------->| validate Origin/CSRF               |
   |                      | validate Session                    |
   |                      | service:auth + delegated user       |
   |                      |----------------------------------->|
   |                      | lock user row, then bindings         |
   |                      | check ownership + remaining method  |
   |                      | delete + derived state + audit      |
   |                      |<-----------------------------------|
   |<---------------------| updated provider list               |
```

Unlink requires a valid current Auth Session, valid Phoenix user credential,
exact Origin, and CSRF proof. V1 does not require recent authentication or
provider reauthentication.

Unlinking a provider does not terminate the current Browser Session or revoke
other Browser Sessions. The response makes the updated provider list immediately
available so every product UI can render the same state.

## Proposed Public Auth HTTP Contract

Canonical Auth is the only browser-facing account-management origin.

### List

```http
GET /api/auth/accounts
```

Response:

```json
{
  "accounts": [
    {
      "publicRef": "oauth_account_xxx",
      "provider": "github",
      "login": "octocat",
      "avatar": "https://...",
      "canUnlink": false,
      "linkedAt": "2026-08-11T00:00:00Z"
    }
  ]
}
```

### Begin link

```http
POST /api/auth/accounts/:provider/link
Origin: https://groupher.com
X-Groupher-CSRF: 1

{ "returnTo": "https://groupher.com/account/connections" }
```

The endpoint creates the link intent and returns a controlled redirect or a
provider authorization URL. The browser then navigates to that URL. `returnTo`
uses the same strict first-party validation contract as regular sign-in
redirects. The response is:

```json
{ "authorizationUrl": "https://github.com/login/oauth/authorize?..." }
```

The custom CSRF Header intentionally forces a CORS preflight. For every
credentialed account-management endpoint, canonical Auth must allow credentials
and that Header only for an exact allowlist of first-party origins, return
`Vary: Origin`, and reject wildcard, `null`, unknown, and unapproved sibling-
subdomain origins. The Header is not a CSRF boundary without that CORS policy.

### Unlink

```http
POST /api/auth/accounts/:publicRef/unlink
Origin: https://groupher.com
X-Groupher-CSRF: 1
```

The browser never sends `provider_id`, provider profile JSON, or a target user.

## Proposed Phoenix GraphQL Contract

These fields are internal Auth-to-Phoenix operations, not general browser
mutations.

```graphql
input VerifiedOauthIdentityInput {
  provider: OauthProvider!
  providerAccountId: String!
  login: String
  nickname: String
  avatar: String
  email: String
  locale: String
  link: String
  bio: String
  country: String
  city: String
  company: String
  profile: Json
}

type LinkedOauthAccount {
  publicRef: ID!
  provider: OauthProvider!
  login: String
  nickname: String
  avatar: String
  canUnlink: Boolean!
  linkedAt: Datetime!
}

type LinkedOauthAccounts {
  entries: [LinkedOauthAccount!]!
}

query linkedOauthAccounts: LinkedOauthAccounts!

mutation linkOauthIdentity(
  identity: VerifiedOauthIdentityInput!
): LinkedOauthAccounts!

mutation unlinkOauthIdentity(
  publicRef: ID!
): LinkedOauthAccounts!
```

Exact scalar and naming conventions should follow the schema conventions at
implementation time. The important contract changes are:

- Provider proof input is separate from a public binding reference.
- No mutation returns an access token.
- No mutation accepts a target user.
- Unlink does not accept mutable provider profile data.
- Responses return the canonical current binding projection.

## Service Identity And Delegation

Auth requests scoped service tokens for the Phoenix Auth resource:

```text
resource https://api.groupher.com/auth
audience phoenix:auth-api
```

Operation scopes:

```text
auth:oauth:read
auth:oauth:link
auth:oauth:unlink
```

Every request also carries the current user credential through the standardized
delegation transport:

```http
Authorization: Bearer <service:auth token>
X-Groupher-User-Authorization: Bearer <current user access token>
```

Phoenix validates both before constructing `delegated_actor`, using a different
verification profile for each token:

```text
service token
  issuer/signature/type
  audience = phoenix:auth-api
  exact auth:oauth:* operation scope
  service subject and client grant

user token
  issuer/signature/browser-token type
  its own browser-access audience, for example phoenix:browser-api
  expiry, user subject, sid, active user, and active Browser Session
```

The user token is identity and current-Session proof for delegation; it is not
required to have the service token's `phoenix:auth-api` audience. Phoenix must
still validate the user token's own exact audience rather than disabling
audience validation. The user cannot be selected from input fields, provider
email, provider login, Browser Session public ref, or an arbitrary user-ref
Header.

The Auth.js Session is the protected Auth-side carrier of the stable Phoenix
`browserSessionRef`; it is not a second independent account authority. The
short-lived `groupher-auth.token` is derived from that Phoenix Browser Session
and carries the same reference as `sid`. Before link completion:

```text
intent.browserSessionRef
  = current Auth.js Session.browserSessionRef
  = delegated user token.sid
  = an active Phoenix BrowserSession owned by the delegated user
```

Auth.js Cookie validity alone is insufficient because Auth does not learn that a
Phoenix Browser Session was revoked merely by decoding its JWT Session. Phoenix
must check the referenced Browser Session on every link completion, even when
the short-lived user token has not yet expired. A `browserSessionRef` is only a
binding constraint after both credentials have been verified; it never creates
user authority by itself.

The Auth client registry must grant only the three exact OAuth account scopes
in addition to its existing Browser Session scopes. Dashboard, Content Import,
Assets Hub, Press, and Scheduler clients receive none of them.

## Data And Transaction Contract

### User-level serialization and lock order

This is an Accounts-wide transaction rule, not an OAuth-local convention. Every
transaction that writes two or more of these record classes uses the same lock
and write order:

```text
1. current account.users row FOR UPDATE
2. relevant oauth_providers rows
3. derived User/Profile/Social rows
4. audit row
```

The user row is the serialization point even when link inserts a binding that
does not exist yet. Locking only the existing binding set cannot serialize such
an insert against unlink, and locking Social/Profile first on one path creates a
conflicting order. Link, unlink, provider-metadata synchronization, ordinary
profile/social editing, and any other multi-row Accounts transaction must follow
this user-first order. A single-row update need not acquire unrelated locks, but
it must not hold a downstream Profile/Social lock and later acquire an upstream
User or provider-binding lock.

Existing-binding sign-in may remain read-only. Any sign-in or registration path
that writes binding metadata or derived profile state must follow the same lock
order; new-user registration keeps all required writes in one `Ecto.Multi`.
Before implementation, audit existing profile and social update transactions for
reverse or inconsistent multi-row write order.

### Link transaction

One transaction must:

1. Lock the delegated user's `account.users` row `FOR UPDATE`.
2. Validate the delegated user and bound Browser Session are active.
3. Attempt an insert-only provider-binding write.
4. On unique conflict, classify the existing binding: return idempotently for the
   same identity/current user, reject ownership by another user, and reject a
   different identity when the current user already has that provider.
5. Never update `user_id` through an upsert or conflict update.
6. Refresh only allowlisted binding metadata under the profile-ownership policy.
7. Apply any required derived-state changes in the same transaction.
8. Insert an audit event.
9. Return the canonical current provider list, including Phoenix-computed
   `canUnlink`.

The unique database index remains the final arbiter. Application pre-checks are
for error quality, not concurrency correctness.

The migrations give both indexes stable constraint names, for example:

```text
oauth_providers_provider_provider_id_index
oauth_providers_user_id_provider_index
```

Phoenix handles both PostgreSQL constraint names explicitly, then re-queries the
external-identity key and user/provider slot under the user lock before
classifying the result. Constraint name alone is insufficient because a same-
identity/current-user retry may satisfy both unique keys, and PostgreSQL's choice
of reported constraint must not change idempotent success into a provider-slot
conflict.

### Unlink transaction

One transaction must:

1. Lock the delegated user's `account.users` row `FOR UPDATE`.
2. Validate the delegated user and bound Browser Session are active.
3. Resolve the opaque binding ref and verify ownership.
4. Count usable login methods using the centralized first-release predicate:
   the active user's `oauth_providers` rows.
5. Reject deletion of the last usable method.
6. Delete exactly one binding.
7. Clear or recompute only profile fields still derived from that binding.
8. Insert an audit event.
9. Return the canonical remaining provider list.

### Unlink retry semantics

The Phoenix mutation does not treat a missing binding as an idempotent success.
After one unlink commits, a second request for the same `publicRef` returns
`404 OAUTH_BINDING_NOT_FOUND`, using the same non-disclosing response as any
binding not visible to the current user.

Auth must not blindly replay unlink after an ambiguous network failure. It
refetches the canonical linked-account list first:

```text
publicRef absent  -> the desired state is reached; report unlink success
publicRef present -> retry unlink once under the normal authorization checks
```

This keeps the Phoenix ownership/error contract precise while preventing the UI
from reporting a false failure when the first deletion committed but its response
was lost.

Auth implements this reconciliation for network/5xx failures: it refetches the
canonical account list, treats an absent `publicRef` as success, and retries
Phoenix unlink once when the binding is still present. An explicit Phoenix
`OAUTH_BINDING_NOT_FOUND` remains a normal 404 and is not retried.

### Current Phoenix implementation boundaries

The first implementation slice has the user-row lock, insert-only binding
writes, conflict classification, and last-login-method check. Two contract
steps remain explicitly deferred rather than silently implied:

- Link/unlink audit events are not emitted yet. The Accounts domain has no
  suitable append-only audit sink; adding one is a follow-up transaction step,
  not something this code pretends to have completed.
- Field-level provenance is not persisted yet. GitHub Social cleanup currently
  uses a conservative value-equality check as a temporary V1 fallback. It must
  be replaced before additional provider-derived fields are projected, because
  equal user-authored values cannot be distinguished from provider-derived
  values without provenance.

The implementation now exposes the internal Phoenix canonical projection plus
Auth account list, unlink, and GitHub begin-link/callback endpoints. Link
intents are persisted in a per-intent Durable Object and consumed atomically;
there is no production in-process fallback. The current Auth provider set has
GitHub configured, so the endpoint rejects providers that are not configured.
The callback performs one demand-driven Phoenix-token refresh and retry, OAuth
account operations use the dedicated rate-limit buckets, and Auth reconciles
ambiguous unlink failures against the canonical account list before retrying.

## TODO

These are the remaining follow-ups from the current implementation; they are
not prerequisites for the V1 link/unlink flow already described above:

- Add an Accounts-owned append-only audit sink, then implement transaction step
  8 so link and unlink persist audit events.
- Add persisted field-level provenance before projecting any new provider data
  into Profile/Social. Replace the current GitHub value-equality cleanup
  fallback once provenance exists; GitHub is the only provider-derived field in
  the current V1 slice.
- Finish the product UI: account-connections entry point, canonical linked
  account list, nullable login/avatar fallback, Auth-based link/unlink actions,
  cancellation/conflict/last-method feedback, and the sole-provider
  replacement limitation.

### Account merge is not supported

When an identity is linked to another Groupher user, the link endpoint returns a
conflict. It must not move provider ownership, choose one user by activity, or
merge content.

## Provider Profile Policy

Auth normalizes an allowlisted DTO from the verified callback. It does not send
the provider token set or an unbounded raw callback object to Phoenix.

Recommended initial fields:

```text
provider
providerAccountId
login
nickname
avatar
verified email when available
locale/location display hints
bounded provider-profile metadata required for debugging
```

Only `provider` and `providerAccountId` are identity-required. Provider `login`,
`nickname`, `avatar`, email, and other profile fields are nullable because not
every OAuth/OIDC provider supplies a stable username or display profile. Their
absence never prevents linking to an existing Groupher user.

Initial registration still requires a unique Groupher `User.login`, but that is
a separate account-creation concern rather than a provider-binding requirement.
The registration normalizer derives a candidate from provider login, then
nickname/name, then verified email local-part, and finally a provider/account-id
based fallback; Phoenix applies its normal login normalization and uniqueness
allocation before creating the user.

Provider callback refresh updates only the allowlisted binding metadata. It does
not overwrite user-authored User/Profile/Social fields. Retention of bounded raw
metadata remains an explicit product decision, but provider tokens and complete
callback payloads are never part of that metadata.

Explicitly excluded:

```text
access_token
refresh_token
id_token
authorization code
client secret
full HTTP callback payload
```

Provider credentials are outside this design and never stored in
`OauthProvider.raw`.

The cutover clears every existing `OauthProvider.raw` value instead of trying to
preserve or denylist unknown keys. After the cutover, only the bounded allowlisted
provider-profile metadata defined above may be written.

The cleanup is ordered after the writer change, not merely bundled into an
unordered release:

```text
1. Auth stops sending the complete provider profile.
2. Phoenix accepts and persists only bounded allowlisted profile metadata.
3. All old Auth and Phoenix instances are drained.
4. Operations confirms no unbounded raw writer remains.
5. An operator explicitly runs the one-time data cleanup that sets every
   existing oauth_providers.raw to null.
```

Running the cleanup while an old writer is still live is invalid because a new
registration or Link could write unbounded `raw` again after the cleanup.

This cleanup is an explicitly-run post-deploy data operation. It must not be
placed in `priv/repo/migrations` or any automatic boot-time or release migration
set. Starting the first new instance must never trigger it while old instances
may still be serving traffic.

## Session Semantics

### Link

- The existing Auth Session remains the current browser authority.
- The existing Phoenix Browser Session remains active.
- No new Browser Session is created.
- No legacy Phoenix access token is returned by GraphQL.
- Auth may refresh the short-lived Phoenix access Cookie if it expires during
  the provider round trip, using the normal V1 refresh contract. The callback
  refreshes once, updates the Cookie, and retries the Phoenix link operation;
  a second expiry fails closed.
- Successful link updates account settings but does not change the current user.
- V1 does not require recent authentication. If step-up authentication is added,
  protect Link before Unlink because Link adds a persistent login credential.

### Unlink

- The current Session remains active.
- Removing the provider used for the current login is allowed only if another
  usable login method remains.
- Other Browser Sessions remain active.
- V1 does not provide an “unlink and revoke sessions” combined operation.

## Error Contract

Suggested machine-readable errors:

```text
OAUTH_LINK_INVALID_INTENT
OAUTH_LINK_REPLAYED
OAUTH_PROVIDER_CANCELLED
OAUTH_PROVIDER_UNAVAILABLE
OAUTH_IDENTITY_ALREADY_LINKED
OAUTH_PROVIDER_ALREADY_LINKED
OAUTH_BINDING_NOT_FOUND
OAUTH_BINDING_NOT_OWNED
OAUTH_LAST_LOGIN_METHOD
SESSION_MISSING
SESSION_EXPIRED
SESSION_REVOKED
ACCOUNT_BLOCKED
SERVICE_TOKEN_INVALID
PERMISSION_DENIED
```

V1 callback behavior uses `OAUTH_LINK_INVALID_INTENT` for malformed, expired,
or mismatched intent/state input, and `OAUTH_LINK_REPLAYED` when an already
consumed intent is submitted again. Provider cancellation is represented by
the controlled `oauthLink=cancelled` redirect result.

Status semantics:

```text
400  malformed provider/action/input
401  missing, expired, or revoked user/Session proof
403  wrong service actor or scope
404  binding ref not found for the current user where non-disclosure is needed
409  provider identity belongs to another user, the user already has another
     identity for that provider, or a concurrent state conflict occurred
400  invalid, expired, or consumed one-time link intent in the V1 Auth callback
429  rate limited
502/503 provider or Auth/Phoenix dependency unavailable
```

The browser error page must not reveal the login, email, or user identity of the
other account holding a conflicting provider binding.

## UI Contract

Account settings display:

```text
provider icon/name
linked provider display label/avatar
linked time
link action for unlinked providers
unlink action when canUnlink=true
why the final provider cannot be removed
```

Because provider login and avatar are nullable, every product uses the canonical
display fallback:

```text
display label
  provider login
  -> provider nickname
  -> localized "Connected <provider> account"

avatar
  provider avatar
  -> provider icon
```

Email is not a display-label fallback because it may expose more identity data
than the account-connections UI needs.

The UI starts all mutations at canonical Auth. It never sends provider profile
data to Phoenix and never embeds provider credentials in URLs or client state.

Provider cancellation returns to account settings with a stable, non-fatal
state. Cross-user conflict explains that the external identity is already in
use but does not identify the other Groupher account.

## Observability And Audit

Record non-sensitive events for:

```text
link intent created / expired / consumed / rejected
provider callback success / cancellation / failure category
link idempotent success
cross-user binding conflict
same-user provider-slot conflict
unlink success
unlink retry reconciled from canonical state
last-login-method rejection
service audience/scope rejection
concurrent database conflict
correlation/request id
```

Audit records may contain stable Groupher user id, provider name, binding public
ref, service subject, and result category. They must not contain provider
tokens, service tokens, browser credentials, full profile JSON, authorization
codes, or arbitrary provider error bodies.

## Rate Limits

Auth applies independent logical buckets through `AUTH_OAUTH_RATE_LIMITER` to:

- Link-intent creation per user, Session, provider, and source IP.
- Provider callback attempts per intent and source IP, including failures.
- Unlink attempts per user and Session.
- Account-list and Auth-to-Phoenix account operations per Auth client and user.

Rate limiting must not become the only replay defense. Link intents are still
single-use, provider-bound, Session-bound, and short-lived.

## Migration Plan

### Phase 1: Freeze the unsafe path

- Remove the obsolete `linkOauth`/`unlinkOauth` fields and their
  `dashboard:oauth:write` authorization contract.
- Do not add a Dashboard proxy for the existing mutations.
- Add tests documenting the current global unique provider identity index.
- Enforce the accepted V1 product rule that one user may link at most one account
  from each provider.

### Phase 2: Correct Phoenix domain operations

- Add nullable `public_ref` and UTC timestamps to `oauth_providers`.
- Backfill every existing binding with a unique opaque `public_ref`, verify no
  nulls or duplicates, create the unique index, then make the column not null.
- Populate `inserted_at` for existing rows using an explicitly documented
  migration timestamp because the legacy table has no historical linked time;
  do not present the backfill value as the original provider-link event time.
- Before creating `UNIQUE(user_id, provider)`, query and report every duplicate
  group with its binding ids and provider ids. Production is expected to have no
  duplicates; this is a defensive assertion, not a compatibility workflow.
- If the assertion fails, abort the migration and deployment. Do not delete or
  rewrite any provider binding to make the index pass.
- Report the conflicting rows for an explicit human review. Deployment may resume
  only after a separate, product-approved data migration resolves the incident;
  this document does not authorize deletion, archival, merge, or another repair
  algorithm.
- Create and enforce `UNIQUE(user_id, provider)` after the assertion passes.
- Change Auth and Phoenix to stop sending and accepting unbounded `raw`, drain all
  old instances, confirm no unbounded writer remains, then have an operator
  explicitly clear every existing `oauth_providers.raw` value. This data cleanup
  is not part of `priv/repo/migrations` or any automatic boot/release migration.
  Do not preserve unknown keys or scrub through a denylist.
- Replace tests that expect `raw` to mirror the complete provider profile with
  bounded allowlist and credential-exclusion assertions.
- Introduce field-level source tracking before any provider data is projected
  into user-visible Profile/Social fields.
- Replace ownership-changing upsert with insert/conflict classification.
- Make concurrent first-time sign-ins recover a unique `create_user` or
  `create_profile` race by re-querying the committed external identity and
  reusing its owner for Browser Session creation.
- Name both unique constraints explicitly and classify conflicts using the
  PostgreSQL constraint name followed by canonical key re-query under lock.
- Make link and unlink lock the user row first and share one lock order.
- Audit ordinary profile/social multi-row transactions and align them with the
  Accounts-wide User -> binding -> Profile/Social -> audit order.
- Centralize the first-release usable-login-method predicate and `canUnlink`.
- Separate verified provider DTO from unlink reference input.
- Make non-authoritative provider profile fields nullable.
- Remove legacy token generation from link.
- Add canonical linked-account projections and machine-readable errors.

### Phase 3: Add Auth orchestration

- Account list/link/unlink HTTP endpoints are implemented in canonical Auth.
- Short-lived, single-use link intents are persisted in a Durable Object and
  atomically consumed; browser state carries only an opaque reference.
- OAuth state is bound to one intent nonce, provider, and the intent-bound
  Phoenix `browserSessionRef`; callback replay fails closed.
- Verified GitHub callbacks call Phoenix through the
  `auth:oauth:link` delegation contract and return controlled success,
  cancellation, or error redirects.
- Auth-to-Phoenix delegation forwards only the standardized user credential and
  validates it separately from the service token.
- Remaining Phase 3 work is adding any future provider adapters and production
  smoke coverage for the configured provider.

### Phase 4: Product UI

- Add account connections UI in the selected product surface.
- Render linked accounts from the canonical projection.
- Apply the canonical nullable login/avatar display fallback.
- Start link/unlink only through Auth endpoints.
- Explain conflicts, last-provider protection, and provider cancellation.
- Explain that V1 cannot replace a sole provider account.

### Phase 5: Remove obsolete contracts

- The old `dashboard:oauth:write` schema contract is removed.
- The old `linkOauth: TokenInfo` and `unlinkOauth(provider profile)` fields are
  removed; `OauthProviderInput` remains only for sign-in.
- The `service:test-suite` wildcard actor remains only as a compile-time,
  test-environment compatibility helper for lower-level Phoenix tests. It is
  not a production identity, is not available in production configuration, and
  is not part of the browser/Auth link contract. Removing it is a separate
  test-suite cleanup, not a prerequisite for the completed Auth flow.
- Verify no browser or product server calls Phoenix link/unlink directly.

## Cutover Runbook

The version-controlled [OAuth V1 cutover runbook](./link_unlink_oauth_runbook.md)
and reviewed execution artifacts define these operations. They must not exist
only as an operator's local SQL file or an undocumented once script.

The runbook covers two separate operations:

```text
required
  Explicit post-deploy cleanup of oauth_providers.raw.

conditional
  Independently approved data migration after the duplicate assertion blocks
  deployment. The runbook does not define a generic delete or repair algorithm.
```

Scripts and operator commands are checked into the repository, reviewed, and
identified by version or checksum. They are not placed in `priv/repo/migrations`
and are never executed automatically during application boot or release startup.

The execution checklist records at least:

```text
release and commit
operator and approver
reviewed script version or checksum
dry-run queries and expected affected-row counts
duplicate groups and exact conflicting binding ids, when applicable
proof that the new Auth and Phoenix versions are fully deployed
proof that all old instances and unbounded raw writers are drained
transaction, timeout, and failure-handling settings
actual affected-row counts
post-run duplicate count
post-run non-null raw count
registration, Link, Unlink, and sign-in smoke results
monitoring results, execution time, and final status
```

The `raw` cleanup is intentionally forward-only: do not copy unbounded raw data
into a backup table or restore it during rollback. If the duplicate assertion
fails, the operator stops after producing the report; only a separately reviewed
and product-approved data migration may change those bindings.

## Test Plan

### Auth protocol tests

- Frontend Auth helpers cover account list, begin-link `authorizationUrl`
  navigation, opaque-ref unlink, and machine-readable error propagation.
- Link requires current Auth Session, exact Origin, and CSRF proof.
- Unlink requires current Auth Session, exact Origin, CSRF proof, and a valid
  Phoenix user credential; it does not require recent authentication or provider
  reauthentication.
- The intentRef Cookie is host-only; its server-side intent is short-lived,
  provider-bound, Session-bound, and one-time.
- Replaying a signed/encrypted browser value cannot consume a server-side intent
  more than once.
- Concurrent callbacks allow exactly one `pending -> consumed` transition.
- OAuth state from one flow cannot consume or be combined with another intent.
- Invalid/expired/consumed intent never falls back to sign-in.
- Provider cancellation returns a controlled result.
- Callback provider mismatch fails closed.
- Expired Phoenix user credential uses the V1 demand-refresh path once.
- Callback refresh writes the refreshed Phoenix access Cookie before the
  controlled success redirect.
- Ambiguous unlink failures reconcile against the canonical account list and
  retry at most once.
- Revoked Browser Session cannot complete link.
- `returnTo` cannot escape approved first-party origins.
- Credentialed CORS preflight allows only exact first-party origins and the
  account-management CSRF Header; wildcard, `null`, and sibling origins fail.

### Phoenix authorization tests

- Missing service proof is rejected.
- Wrong service subject, audience, or scope is rejected.
- A valid browser user token is checked against its own audience and is not
  required to carry the service token's Auth API audience.
- A user token with the wrong token type or browser audience is rejected.
- Service proof without a delegated user is rejected.
- User proof without Auth service proof is rejected.
- Auth link scope cannot unlink; Auth unlink scope cannot link.
- Dashboard/Content Import/Press/Assets Hub tokens cannot manage providers.

### Link domain tests

- New identity links to the current user.
- Same identity/current user is idempotent.
- Identity owned by another user returns conflict without ownership change.
- Concurrent links from two users never move `user_id`.
- Link and unlink for the same user serialize on the user row and preserve both
  binding ownership and the final-login-method invariant.
- Concurrent link/unlink paths acquire User, binding, derived-profile, and audit
  locks in the documented order.
- Ordinary profile/social multi-row edits follow the same Accounts-wide order
  and do not introduce a reverse-lock deadlock with link/unlink.
- Link never creates a Browser Session or returns a legacy token.
- Required derived-state changes are transactionally consistent.
- Same-user idempotent link refreshes binding metadata without overwriting
  user-authored profile fields.
- Providers without `login`, nickname, or avatar can link to an existing user.
- Linking a second account from the same provider to one user is rejected without
  replacing the existing binding.
- Violations of the external-identity and user/provider constraints are
  recognized by their stable names and canonically re-queried into distinct
  machine errors.
- A same-identity/current-user retry remains idempotent regardless of which
  unique constraint PostgreSQL reports.
- Provider token fields are not persisted in profile JSON or logs.

### Unlink domain tests

- Owned binding can be unlinked when another usable method remains.
- Foreign binding cannot be unlinked.
- Last usable method cannot be unlinked.
- Concurrent unlink cannot remove all login methods.
- Provider-derived profile state follows the selected cleanup policy.
- Unlink preserves user-authored fields and clears only values sourced from the
  removed binding.
- Current Session behavior matches the documented policy.
- Unlink leaves the current and other Browser Sessions active.
- Repeating a committed unlink returns `OAUTH_BINDING_NOT_FOUND` from Phoenix.
- After an ambiguous unlink response, Auth refetches the binding list and treats
  an absent `publicRef` as successful completion.

### Migration tests

- Every existing provider binding receives a unique non-null `publicRef`.
- The global `(provider, provider_id)` identity invariant survives the migration.
- The duplicate assertion reports exact conflicting rows and aborts without
  deleting or rewriting bindings.
- A failed assertion requires an explicitly approved independent data migration
  before retry; the Link/Unlink release performs no automatic repair.
- The migration creates and enforces one binding per `(user_id, provider)` after
  the assertion passes.
- Old writers are drained before the post-deploy `raw` cleanup runs.
- Automatic boot-time and release migrations never execute the `raw` cleanup;
  an operator invokes it explicitly after rollout verification.
- The checked-in cutover runbook records the reviewed artifact version, dry-run
  counts, rollout/drain proof, affected rows, post-run verification, and smoke
  results.
- Every existing `oauth_providers.raw` value is cleared, and subsequent
  registration/Link writes contain only bounded allowlisted metadata.
- New bindings expose UTC `linkedAt`; legacy backfill timestamps are handled as
  migration-time values rather than claimed historical link events.

### Browser E2E

- Signed-in user links a different provider and remains the same Groupher user.
- Refresh and a new sign-in can use the newly linked provider.
- Unlink updates every product account menu consistently.
- Last-provider UI is disabled and the server independently rejects it.
- Missing provider login/avatar uses nickname/localized provider label and the
  provider icon without exposing email.
- Provider cancellation and conflict do not log the user out.
- Cross-user conflict never exposes the other account.

## Acceptance Criteria

- Auth is the only browser-facing link/unlink protocol owner.
- Phoenix remains the only persistent provider-binding authority.
- Product applications never forward browser-asserted provider profiles.
- Only `service:auth` with exact Auth audience/scope can call the mutations.
- Phoenix independently verifies the delegated current user.
- Service and user credentials use separate exact audience-verification profiles.
- Link completion revalidates the intent-bound Phoenix Browser Session even when
  the delegated access token has not expired.
- Provider identity ownership cannot change through upsert or a race.
- Link and unlink serialize on the user row and share one lock order.
- Concurrent unlink cannot remove the final usable login method.
- In the first release, usable login methods are exactly the active user's OAuth
  provider rows; Phoenix alone computes `canUnlink` and rechecks it under lock.
- Email equality never links or merges users automatically.
- Link does not mint a legacy token or create a Browser Session.
- Unlink accepts an opaque owned binding reference, not a provider profile.
- Every binding has a backfilled opaque `publicRef` and UTC timestamps; provider
  profile attributes other than provider/account id are nullable.
- Provider metadata refresh does not overwrite user-authored profile fields, and
  unlink clears only fields still sourced from the removed binding.
- Provider tokens and unbounded callback payloads are not persisted or logged.
- Existing unbounded `oauth_providers.raw` values are cleared at cutover; new
  values contain only bounded allowlisted profile metadata.
- The `raw` cleanup runs only after all unbounded writers are replaced and old
  instances are drained.
- The cleanup is an explicitly-run data operation, never an automatic boot-time
  or release migration.
- Required and conditional cutover operations use reviewed, version-controlled
  artifacts and a completed execution checklist; no undocumented once script is
  accepted.
- OAuth state is bound to exactly one intent; replay, provider mismatch, Session
  mismatch, substitution, and expiry fail closed.
- One-time intent consumption is enforced by an atomic server-side record, never
  by a stateless Cookie.
- One Groupher user cannot bind two accounts from the same provider.
- Unexpected duplicate bindings stop deployment and require a separately
  approved data migration; this release never repairs them automatically.
- V1 never replaces an existing provider slot; a sole provider account cannot be
  self-service replaced by another account from that provider.
- V1 requires no recent authentication; any later step-up hardening protects Link
  before Unlink because Link adds a persistent login credential.
- Unlink requires no recent authentication and revokes no Browser Sessions.
- All multi-row Accounts writes follow the shared user-first lock order.
- Unlink retry behavior distinguishes Phoenix's missing-binding response from
  Auth's post-failure desired-state reconciliation.
- Account settings can list bindings and render `canUnlink` consistently.
- Old Dashboard-scoped and direct GraphQL account-management paths are removed.

## Open Decisions

1. Which normalized provider profile fields are retained, and for how long?
2. Where does the account-connections UI live while Main, Dashboard, Dash, and
   Apply coexist?

## Related Documents

- [`docs/auth/v1.md`](./v1.md): Browser Auth and Session lifecycle.
- [`docs/auth/v2.md`](./v2.md): Service Identity and user delegation.
- [`docs/oauth/overview.md`](../oauth/overview.md): OAuth scenario boundaries.
- [Auth.js database models](https://authjs.dev/concepts/database-models): Auth.js
  User/Account adapter semantics and account-linking context.
- [Auth.js provider reference](https://authjs.dev/reference/core/providers):
  provider callback data and automatic email-linking security warning.
