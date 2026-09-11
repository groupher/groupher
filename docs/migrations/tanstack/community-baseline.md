# Community V1 baseline

> Generated from the local Community production build on 2026-08-29 after Query/Store boundary hardening. Re-run
> `pnpm --filter @groupher/frontend-community run build` followed by
> `pnpm --filter @groupher/frontend-community run baseline` when the bundle changes.

## Local build

| scope               | files | raw bytes | per-file gzip sum |
| ------------------- | ----: | --------: | ----------------: |
| client route assets |    82 | 3,473,653 |           950,178 |
| server              |   102 | 7,714,344 |         1,669,678 |

For the same local Main build, the client chunk directory measured 72 files / 4,221,118
raw bytes / 1,193,838 individually gzipped bytes. These totals are directional only because
Next and Vite emit different chunk graphs and include different route sets.

Largest client artifacts:

| artifact      | raw bytes | gzip bytes |
| ------------- | --------: | ---------: |
| `DocThread`   |   947,579 |    281,716 |
| `useTwBelt`   |   714,340 |     87,609 |
| route `index` |   549,017 |    178,311 |
| `ArticleView` |   272,083 |     94,655 |

The revision worker is measured separately at 281,428 raw bytes / 70,068 gzip bytes.

The largest Main client chunk was 962,735 raw bytes / 291,159 gzip bytes.

The gzip column is the sum of individually compressed files, not a browser transfer
waterfall. It is a stable local comparison signal, not a production RUM result.

## Local HTTP smoke

| route                    | status |                                expected |
| ------------------------ | -----: | --------------------------------------: |
| `/health`                |    200 |                          health.v1 JSON |
| `/`                      |    404 |            bare Community is not a page |
| `/.well-known/jwks.json` |    404 | reserved path never enters `$community` |
| unknown path             |    404 |                      not-found boundary |

Production TTFB/FCP/LCP, concurrent SSR RSS, preview latency, Cloudflare PoP purge
propagation and canary rollback require a deployed Community URL and production
credentials; the repository now includes the repeatable measurement command, but local
build output must not be presented as production evidence.
