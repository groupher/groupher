# Local Auth Debug Login

## Purpose

Use a stable local-only identity to debug browser sessions without completing GitHub OAuth. Auth still asks Phoenix to create the browser session and returns the normal HttpOnly Auth session and Phoenix access-token cookies, so normal session refresh, revocation, Passport, and Gate behavior remains in effect.

The identity is `local-debug`. It is created through the existing E2E OAuth provider and does not impersonate an existing account or receive administrator permissions. Use a real OAuth account when checking role-specific behavior.

## Enablement

Dash's browser session and service identity are separate. Ordinary GraphQL requests forward the
Phoenix cookie and can work with endpoints supplied by Make/Dev Hub, without a Dash env file.
Content Publisher and the Content Import proxy also require a service credential.

### Local Dash service credentials

Dev Hub prepares the service credential from the single private state at
`local/dev-hub/.data/local-environment/state.json`. It registers the matching hash with local Auth
and injects only Dash's credential when Dash starts. It does not write either
`backend/auth/.env.local` or `frontend/dash/.env.local`.

Start and restart Auth and Dash through Dev Hub so both processes receive the same identity:

```bash
pnpm devhub start auth
pnpm devhub start dash
```

The compatibility command `pnpm devhub setup-auth` runs the same idempotent preparation path; it
is not a separate credential writer. Existing credentials in legacy files must be imported with the
explicit migration `--check`/`--apply` flow before first initialization. Ordinary starts do not
rewrite application env files.

The Dash service has browser Content Publisher capabilities and `docs:import:proxy`. It has no
import history-origin capability or Auth session administration scope. User sessions and Gate
permissions remain independent checks.

### Browser login enablement

Dev Hub resolves `AUTH_LOCAL_LOGIN_ENABLED=true` for the local Auth service. The Node Auth server
registers the endpoint only with that flag outside production; the endpoint accepts only loopback or
`*.localhost` Auth hosts. The Cloudflare Worker does not register the local login handler. Managed
Auth does not load application dotenv files, so no per-app `.env` edit is needed. Start or restart
Auth through Dev Hub after changing its resolved local configuration.

## Sign in from a local browser

Open the Dash page, open its browser developer console, and run:

```js
await fetch('https://auth.groupher.localhost/api/auth/test-login', {
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

The ordinary `local-debug` account remains unprivileged. For local P2 browser acceptance, a separate `local-passport-admin` identity is available only when the non-production Dev Hub process is launched with `DEV_HUB_LOCAL_ADMIN_LOGIN_ENABLED=true`; the Hub resolves `AUTH_LOCAL_ADMIN_LOGIN_ENABLED=true` for Auth, and the Auth endpoint also requires `AUTH_LOCAL_LOGIN_ENABLED=true`. The opt-in is false by default and has no effect on production or the Cloudflare Worker. Restart Hub with the opt-in, then restart Auth through Hub.

From the local Dash origin, use the same request as above with this URL:

```js
await fetch('https://auth.groupher.localhost/api/auth/test-admin-login', {
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
