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
- `src/link-intent.ts`: one-shot OAuth link intent contract; production state is
  stored server-side, not in process memory or a signed browser payload.
- `src/worker.ts` / `src/server.ts`: Worker and local Node entrypoints.

## Local development and validation

```sh
yarn auth:env:bootstrap
yarn workspace @groupher/backend-auth dev
yarn workspace @groupher/backend-auth test
yarn workspace @groupher/backend-auth type-check
yarn workspace @groupher/backend-auth format:check
```

The browser and Phoenix sides must be running for end-to-end Session tests.
Use `.env.example` as the public configuration inventory.

## Related documentation

- [`docs/auth/v1.md`](../../docs/auth/v1.md)
- [`docs/auth/v2.md`](../../docs/auth/v2.md)
- [`docs/auth/link_unlink_oauth.md`](../../docs/auth/link_unlink_oauth.md)
- [`docs/auth/service_token.md`](../../docs/auth/service_token.md)
- [`docs/sub-apps/auth.md`](../../docs/sub-apps/auth.md)
