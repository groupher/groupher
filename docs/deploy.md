# Groupher Deployment

> Status: current deployment notes

## Public Entry

Groupher keeps a path-first public URL contract:

```text
groupher.com/                         Landing
groupher.com/pricing                  Landing
groupher.com/book-demo                Landing
groupher.com/:community/...           Main
groupher.com/:community/dashboard/... Dashboard
groupher.com/api/graphql              same-origin browser GraphQL facade
api.groupher.com/graphiql             Phoenix GraphQL origin
```

The current public entry is hosted by the Cloudflare Pages project
`groupher-landing`.

```text
Cloudflare Pages project: groupher-landing
  production custom domains:
    groupher.com
    www.groupher.com
  internal/default domain:
    groupher-landing.pages.dev
  preview/debug domains:
    <deployment>.groupher-landing.pages.dev
    <branch>.groupher-landing.pages.dev
```

`groupher-landing.pages.dev` is Cloudflare Pages' built-in project domain. It is
kept for preview, direct deployment smoke tests, and custom-domain debugging; it
is not the user-facing production URL.

## Cloudflare Applications

```text
Cloudflare Pages
  groupher-landing
    prod:
      groupher.com
      www.groupher.com

Cloudflare Workers
  auth
    prod route:
      auth.groupher.com/*
  assets-hub
    prod route:
      assets.groupher.com/*
  inspire-me
    prod route:
      inspire-me.groupher.com/*
```

Use product-scoped names for Cloudflare projects. The `groupher-` prefix is not
technically required by Cloudflare, but it keeps generic project names such as
`landing` clear inside a shared Cloudflare account.

## Environment Boundaries

```text
production
  groupher.com
  www.groupher.com

preview/debug
  groupher-landing.pages.dev
  <deployment>.groupher-landing.pages.dev
  <branch>.groupher-landing.pages.dev

local development
  Dev Hub / local Gateway / portless routes
```

Do not treat `*.pages.dev` as production user-facing URLs. If a public staging
environment is needed later, add an explicit custom domain such as
`staging.groupher.com` or `dev.groupher.com` and bind it to the intended Pages
branch.

## DNS Records

For the Landing Pages project, both apex and `www` should point to the Pages
project:

```text
groupher.com      CNAME  groupher-landing.pages.dev
www.groupher.com  CNAME  groupher-landing.pages.dev
```

Cloudflare flattens the apex CNAME, so using a CNAME at `groupher.com` is valid
inside Cloudflare DNS.

Prefer orange-cloud proxied records for these production custom domains. Orange
cloud means the hostname is routed through Cloudflare's HTTP proxy layer, where
Cloudflare can apply certificates, WAF/rules, caching, redirects, and edge
observability. Gray cloud means DNS-only: Cloudflare returns the DNS target and
does not apply the zone's HTTP proxy features for that DNS record.

For a CNAME that points to `groupher-landing.pages.dev`, gray-cloud DNS-only can
still resolve to Cloudflare Pages because the target itself is on Cloudflare.
That makes it functional, but keeping `groupher.com` and `www.groupher.com`
both proxied is the clearer production posture.

CAA records for certificate authorities should stay in place:

```text
groupher.com CAA 0 issue "sectigo.com"
groupher.com CAA 0 issue "pki.goog"
groupher.com CAA 0 issue "letsencrypt.org"
```

## Deployment Command

Build and upload the Landing Pages output with Wrangler direct upload:

```bash
yarn workspace @groupher/frontend-landing build:cloudflare
./node_modules/.bin/wrangler pages deploy frontend/landing/out \
  --project-name groupher-landing \
  --branch main
```

After deploying, smoke test the custom domains:

```bash
curl -i https://groupher.com/health
curl -i https://www.groupher.com/health
curl -i https://www.groupher.com/api/auth/providers
curl -i https://www.groupher.com/home/dashboard
curl -i https://www.groupher.com/home/dashboard/appearance
```

The health endpoint should return `service: "landing-cloudflare-router"` from
Cloudflare.
