# Groupher Local Development

> Status: current local development notes

## Runtime Boundary

Production and local development now use different gateway runtimes for the
same public routing contract.

```text
production
  groupher.com / www.groupher.com
    -> Cloudflare Pages project `groupher-landing`
       -> frontend/landing/public/_worker.js
          -> Landing assets on Cloudflare
          -> Main on Vercel
          -> Dashboard on Vercel
          -> Auth on Cloudflare Workers
          -> Phoenix on api.groupher.com

local development
  https://groupher.localhost
    -> backend/gateway on port 3003
       -> Landing on port 3002
       -> Main on port 3000
       -> Dashboard on port 3001
       -> Auth on port 3004
       -> Phoenix on port 4001
```

`backend/gateway` is the Dev Gateway. It is kept for local routing and Dev Hub
ergonomics. It is not the production `groupher.com` runtime after the
Cloudflare Pages cutover.

## Why Keep Dev Gateway Locally

The local Dev Gateway keeps daily development simpler:

- It works with Dev Hub's existing start chains.
- It uses stable Portless names such as `https://groupher.localhost`.
- It keeps local cookie scope under `.groupher.localhost`.
- It avoids requiring Wrangler, Pages assets, and Cloudflare local runtime for
  every Main or Dashboard change.

The production Cloudflare router and the local Dev Gateway should stay aligned
at the routing-contract level, but they do not need to share the same runtime in
normal local development.

## Daily Local Flow

Use Dev Hub or the existing Makefile commands.

```bash
make dev
```

or start individual services:

```bash
make be.gateway.start
make fe.dev.main
make fe.dev.dashboard
make fe.dev.landing
make be.auth.start
```

Dev Hub models the local entry as `Dev Gateway`, but the stable service id,
workspace name, directory, and Makefile targets remain unchanged:

```text
service id:    gateway
workspace:     @groupher/gateway
directory:     backend/gateway
entry command: make be.gateway.start
```

Keep these stable until there is a deliberate package or directory rename.

## Portless Names

Run Portless setup when a local machine needs the HTTPS development domains:

```bash
yarn portless:setup
```

Current aliases:

```text
groupher.localhost             -> Dev Gateway, port 3003
main.groupher.localhost        -> Dev Gateway, port 3003
dashboard.groupher.localhost   -> Dev Gateway, port 3003
landing.groupher.localhost     -> Dev Gateway, port 3003
auth.groupher.localhost        -> Auth, port 3004
api.groupher.localhost         -> Phoenix, port 4001
assets-hub.groupher.localhost  -> Assets Hub, port 8002
assets.groupher.localhost      -> Assets read Worker, port 8787
```

Frontend product flows should normally enter through
`https://groupher.localhost`, not directly through each frontend listener. Direct
sub-application URLs are useful for isolated debugging.

## Dev Gateway Routing

The Dev Gateway receives the browser request and routes by host/path:

```text
/api/auth/*             -> Auth
/api/graphql            -> Phoenix /graphiql with browser cookie cleanup
/                       -> Landing
/pricing                -> Landing
/book-demo              -> Landing
/:community/dashboard/* -> Dashboard
other product paths     -> Main
```

For browser GraphQL, Dev Gateway preserves the same security boundary as the
production router: browser requests use same-origin `/api/graphql`, and only the
HttpOnly `groupher-auth.token` is forwarded to Phoenix.

## Cloudflare Local Routing Mode

Cloudflare Pages `_worker.js` does not run in the default Dev Hub flow. It runs
in production, Pages previews, and Wrangler Pages dev.

Use Cloudflare local routing only when validating production-router parity:

```bash
yarn workspace @groupher/frontend-landing build:cloudflare

MAIN_SITE=http://127.0.0.1:3000 \
DASHBOARD_SITE=http://127.0.0.1:3001 \
AUTH_SITE=http://127.0.0.1:3004 \
API_SITE=http://127.0.0.1:4001 \
ENVIRONMENT=development \
./node_modules/.bin/wrangler pages dev frontend/landing/out --port 8788
```

Then smoke test:

```bash
curl -i http://127.0.0.1:8788/health
curl -i http://127.0.0.1:8788/pricing
curl -i http://127.0.0.1:8788/home/dashboard
curl -i http://127.0.0.1:8788/api/auth/providers
curl -i http://127.0.0.1:8788/api/graphql
```

This mode is not a replacement for the daily Dev Hub entry yet. A full
replacement would need explicit handling for HTTPS, local cookie domains,
Portless aliases, and Wrangler Pages asset behavior.

## Analysis Service

`analysis.groupher.com` is a Vercel-hosted Umami deployment and can stay
DNS-only:

```text
analysis.groupher.com -> Vercel
Proxy status: DNS only
```

It does not need to pass through the Cloudflare proxy unless Groupher later
needs Cloudflare WAF, Access, Bot Management, or zone-level HTTP rules for that
service.
