# Groupher Auth

`backend/auth` is the system-wide browser Session and OAuth protocol boundary.
It runs on Hono in Node or Cloudflare Workers, integrates Auth.js/provider
protocols, and delegates persisted Session and account authority to Phoenix.

## Position in the system

```text
Browser -> Gateway -> Auth/Hono -> OAuth provider
                     |    |
                     |    +-> link intent / rate-limit bindings
                     v
              Phoenix Accounts
                     |
                     v
          persisted Session + access token
                     |
                     v
             host/parent-domain cookies -> Browser
```

Auth owns host-only Session-cookie handling, OAuth redirects, CSRF/origin
checks, service-token issuance, and demand-driven browser-token refresh.
Phoenix owns users, OAuth identities, authorization, persisted Sessions, and
revocation. Gateway only routes requests and forwards the access cookie.

## Important boundaries

- `src/app.ts`: public HTTP routes, origin checks, rate limits, and error
  projection.
- `src/auth.ts`: Auth.js/provider integration.
- `src/phoenix.ts`: trusted Phoenix protocol client.
- `src/service-token.ts` and `src/jwks.ts`: service identity issuance and public
  verification material.
- `src/link-intent.ts`: state and PKCE helpers. Phoenix stores the active link
  flow and consumes the confirmed binding transactionally.
- `src/worker.ts` / `src/server.ts`: Worker and local Node entrypoints.

## Local development and validation

```sh
pnpm run auth:env:bootstrap
pnpm --filter @groupher/backend-auth run dev
pnpm --filter @groupher/backend-auth run test
pnpm --filter @groupher/backend-auth run type-check
pnpm --filter @groupher/backend-auth run format:check
```

The browser and Phoenix sides must be running for end-to-end Session tests.
Use `.env.example` as the public configuration inventory.

## Related documentation

- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/auth/v2.md`](../../docs/auth/v2.md)
- [`docs/auth/link-unlink-oauth.md`](../../docs/auth/link-unlink-oauth.md)
- [`docs/auth/service-token.md`](../../docs/auth/service-token.md)
- [`docs/auth/README.md`](../../docs/auth/README.md)

## Local OAuth verification

The Groupher Local GitHub OAuth application has two exact redirect URIs with wildcard matching disabled. The login URI is `https://auth.groupher.localhost/api/auth/callback/github` and the link URI is `https://auth.groupher.localhost/api/auth/accounts/github/callback`. Both completed authorization and token exchange in the local browser on 2026-11-25. A separate local link attempt with a deliberately wrong verifier failed, left no identity awaiting confirmation, and a new authorization subsequently succeeded; the provider response was not captured, so the rejection reason was not independently confirmed.

Linux DO Connect exposes one callback field for the development application. Its registered URI is `https://auth.groupher.localhost/api/auth/callback/linuxdo`. Ordinary sign-in uses Auth.js state and PKCE; Link uses a separate state prefix, nonce and server-side claim on the same callback. On 2026-11-25 both flows completed authorization and S256 token exchange. Both normal and youth minimum levels are configured to 0. When the stored verifier was deliberately changed before the callback, the exchange failed and no binding or confirmation was created. The provider response was not captured, so the reason for rejection is not independently confirmed. Two real-browser cross-tab cases were exercised: a pending normal Linux DO login was superseded by a GitHub login while a separate Linux DO link reached confirmation; in the reverse order, logging out invalidated the pending link while an independent Linux DO login reached username selection. Neither case created an unintended binding. Failed or invalid callbacks show a retry page.

The local `OAUTH_GITHUB_STATE` and `OAUTH_LINUXDO_STATE` values are `open`, `existing`, or `closed`. Linux DO defaults to closed in production until its deployment credentials, service scopes, callbacks and acceptance are ready.

Production deployment must grant the Auth service identity `auth:oauth:flow` and `auth:oauth:register` for `phoenix:auth-api`, and configure the production Linux DO callback and secrets before enabling the provider. The local Dev Hub grants are not production grants. Update the existing Auth client registration in its authoritative `SERVICE_AUTH_CLIENTS_JSON*` secret while preserving its credential hashes, audiences and other scopes. The service token endpoint chooses the first matching `clientId` across its registries; appending a second entry with the same ID does not extend the first entry's permissions. Verify each new scope separately against the production token and Phoenix field before opening the provider, without printing the credentials or bearer tokens. The current Link runtime uses Phoenix `oauth_flows` and does not call `LINK_INTENTS`. Check deployed versions and other Worker references before cleaning up the residual binding and class; namespace deletion is a separate, destructive decision. Follow [OAuth V2 section 4](../../docs/auth/multi-provider-oauth-v2.md#4-执行顺序).

OAuth concurrency coverage uses committed transactions and must run only against a disposable database. Create a dedicated local test database first, then from `backend/api` run:

```sh
MIX_ENV=test TEST_DB_NAME=<isolated-oauth-db> TEST_OAUTH_ISOLATED=1 mix test test/groupher_server/accounts/profiles/oauth_concurrency_test.exs
```

The database name must contain `oauth`. Drop that dedicated database after the run; these tests intentionally commit their fixtures so independent connections can contend for the same locks.

The local Phoenix tests exercise registration with an under-scoped service actor, a discarded completion response, and session-row creation failures after both direct and completed registration. Reauthorization resolves the committed identity. Auth tests separately cover session-cookie issuance failure and revocation.

A real browser check exercised a taken suggested username and cancellation: the form remained editable after the conflict, cancellation returned to the original Community page, and reopening registration without its cleared flow cookie was rejected.

The Auth E2E suite exercises registration through a mock GitHub authorization and token exchange, Auth callback, mock Phoenix registration flow and the modal on the originating Dash or Community page. It checks successful cookie issuance, cancellation after a taken username and expired registration. The mock stack does not prove real-provider behavior or Phoenix transaction semantics; those checks are recorded separately above. On 2026-11-25, the full Auth browser suite passed 16 tests; two subsequently added focused tests passed for taken-name retry and missing flow cookie.

On 2026-11-25 the full named Auth browser suite passed 14 tests against the local mock stack. The Auth Worker dry-run built successfully; this does not verify production secrets, scope grants or deployment.

A Phoenix integration test verifies both bound identities resolve to the same user and do not create Browser Sessions during link verification or confirmation. After unlink, it verifies the existing Linux DO session remains usable; a taken suggested name requires registration completion, while an available name creates a separate user. This is a database integration test, not an additional real-provider run.
