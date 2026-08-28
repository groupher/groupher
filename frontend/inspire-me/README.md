# Inspire Me

`frontend/inspire-me` is an internal feedback-research application built with
TanStack Start and deployed to Cloudflare Workers. It turns a generated local
dataset into a browsable research UI; it is not a Groupher production domain
service and does not own community data.

## Position in the system

```text
Research source data -> generate:data -> generated dataset
                                            |
                                            v
Researcher -> TanStack Start/Worker routes -> feedback browsing UI
```

The application is intentionally isolated from Main, Dashboard, and Phoenix.
The route tree is generated and committed at `src/routeTree.gen.ts`. Do not
add Next.js or Vinext configuration, runtime imports, or scripts.

Research data follows this boundary:

```text
data/feedback-platforms/*.md
  -> generate:data
  -> public/feedback-platforms/*.json
  -> Cloudflare ASSETS binding
  -> TanStack server function / route loader
```

The generated JSON must not be imported into the Vite module graph. Both Vite
development and production Workers load it through `env.ASSETS.fetch(...)`.

## Local development and validation

```sh
pnpm --filter @groupher/inspire-me run generate:data
pnpm --filter @groupher/inspire-me run dev
pnpm --filter @groupher/inspire-me run type-check
pnpm --filter @groupher/inspire-me run format:check
pnpm --filter @groupher/inspire-me run build
pnpm --filter @groupher/inspire-me run deploy:dry-run
```

Generated research data should be refreshed through `generate:data`; do not
hand-edit generated artifacts.

`/health` follows the shared `health.v1` contract. Deploy commands inject
`VITE_GIT_COMMIT_SHA`; uptime is measured from the Worker module start rather
than Node process APIs.
