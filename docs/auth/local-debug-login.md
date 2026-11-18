# Local Auth Debug Login

## Purpose

Use a stable local-only identity to debug browser sessions without completing GitHub OAuth. Auth still asks Phoenix to create the browser session and returns the normal HttpOnly Auth session and Phoenix access-token cookies, so normal session refresh, revocation, Passport, and Gate behavior remains in effect.

The identity is `local-debug`. It is created through the existing E2E OAuth provider and does not impersonate an existing account or receive administrator permissions. Use a real OAuth account when checking role-specific behavior.

## Enablement

Dash's browser session and service identity are separate. Ordinary GraphQL requests forward the
Phoenix cookie and can work with endpoints supplied by Make/Dev Hub, without a Dash env file.
Content Publisher and the Content Import proxy also require a service credential.

### Local Dash service credentials

Initialize matching development credentials once from the repository root:

```bash
pnpm devhub setup-auth
```

This requires an initialized `backend/auth/.env.local`. It generates a random secret into the ignored
`frontend/dash/.env.local`, registers its hash in Auth's local extra client registry, and adds the two
resource mappings used by Dash. Existing provider, session, other client, and resource configuration
is preserved. Both files use private `0600` permissions; the command never prints credential values.
Repeated setup reuses the same secret. It refuses production mode and conflicts with a user-owned
Dash registration instead of replacing it.

The local client has browser Content Publisher capabilities and `docs:import:proxy`. It has no import
history-origin capability or Auth session administration scope. User sessions and Gate permissions
remain independent checks.

Dev Hub loads only the client ID and secret from Dash's file. Issuer and network endpoints stay in
the service definition. The existing precedence is definition > parent env > credential fallback;
reconcile any parent credential override with Auth instead of disabling verification.

After initial setup, restart Auth and Dash through Hub. If Hub predates its Dash credential fallback,
normally restart Hub first and restore the previously active services through default start chains.
Later starts reload the credential file; manual secret entry is not needed. Token issuance verifies
the service channel, not a completed content publishing or import business flow.

### Browser login enablement

The checked-in `backend/auth/.env.development` enables this for local development. Restart the Auth server after changing the flag:

```dotenv
AUTH_LOCAL_LOGIN_ENABLED=true
```

The development config also allowlists the current Dash origin, `http://dash.groupher.localhost:3005`, for the Auth CSRF check. The Node Auth server registers the endpoint only when this flag is exactly `true` and `NODE_ENV` is not `production`. The endpoint accepts requests only on loopback or `*.localhost` Auth hosts. The Cloudflare Worker does not register the local login handler. Keep the example configuration disabled.

## Sign in from a local browser

Open the Dash page, open its browser developer console, and run:

```js
await fetch('http://auth.groupher.localhost:3004/api/auth/test-login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Groupher-CSRF': '1',
  },
  body: '{}',
})
```

The successful response is `204`; the browser stores the usual HttpOnly cookies for `.groupher.localhost`. Reload Dash to load the signed-in account. If Auth returns `404`, confirm the environment flag and restart Auth. If it returns `400`, confirm the request was sent from an allowed local origin with the CSRF header. Phoenix/service-auth configuration must be available as for regular sign-in.

## Local Passport admin acceptance

The ordinary `local-debug` account remains unprivileged. For local P2 browser acceptance, a separate `local-passport-admin` identity is available only when both `AUTH_LOCAL_LOGIN_ENABLED=true` and `AUTH_LOCAL_ADMIN_LOGIN_ENABLED=true` are set in the non-production Node Auth server. This flag is false in the example configuration and must never be enabled in production. Restart Auth after changing it.

From the local Dash origin, use the same request as above with this URL:

```js
await fetch('http://auth.groupher.localhost:3004/api/auth/test-admin-login', {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'X-Groupher-CSRF': '1',
  },
  body: '{}',
})
```

Then provision its lord membership in the existing local `home` community with `cd backend/api && MIX_ENV=dev DB_NAME=groupher_server_dev mix run --no-start scripts/dev/grant_local_passport_admin.exs`. The script rejects any environment/database other than the local development database, is idempotent for an existing lord membership, and refuses to promote a pre-existing ordinary membership.

## Boundaries

- The endpoint ignores a caller-supplied login and always uses `local-debug`.
- It creates a normal revocable browser session; it does not return a long-lived bearer token or bypass Gate checks.
- The identity is for ordinary local session debugging. Do not grant it administrator permissions or use it as evidence for privileged Passport acceptance.
- Production Auth and the deployed Worker do not expose this route.
