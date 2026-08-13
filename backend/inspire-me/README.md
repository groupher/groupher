# Inspire Me

`backend/inspire-me` is an internal feedback-research application built with
Vinext and deployed to Cloudflare Workers. It turns a generated local dataset
into a browsable research UI; it is not a Groupher production domain service
and does not own community data.

## Position in the system

```text
Research source data -> generate:data -> generated dataset
                                            |
                                            v
Researcher -> Vinext/Worker routes -> feedback browsing UI
```

The application is intentionally isolated from Main, Dashboard, and Phoenix.
Do not add Next.js-only configuration or scripts: Vinext owns its build and
runtime compatibility boundary.

## Local development and validation

```sh
yarn workspace @groupher/inspire-me generate:data
yarn workspace @groupher/inspire-me dev
yarn workspace @groupher/inspire-me type-check
yarn workspace @groupher/inspire-me format:check
yarn workspace @groupher/inspire-me build
```

Generated research data should be refreshed through `generate:data`; do not
hand-edit generated artifacts.
