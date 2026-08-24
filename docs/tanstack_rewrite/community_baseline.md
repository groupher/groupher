# Community V1 baseline

> Generated from the local Community production build on 2026-08-21. Re-run
> `yarn workspace @groupher/frontend-community build` followed by
> `yarn workspace @groupher/frontend-community baseline` when the bundle changes.

## Local build

| scope               | files | raw bytes | per-file gzip sum |
| ------------------- | ----: | --------: | ----------------: |
| client route assets |   149 | 3,412,452 |           969,939 |
| server              |   178 | 7,612,105 |         1,696,215 |

For the same local Main build, the client chunk directory measured 72 files / 4,221,118
raw bytes / 1,193,838 individually gzipped bytes. These totals are directional only because
Next and Vite emit different chunk graphs and include different route sets.

Largest client artifacts:

| artifact      | raw bytes | gzip bytes |
| ------------- | --------: | ---------: |
| `DocThread`   |   931,223 |    280,885 |
| `query`       |   641,923 |     76,989 |
| `ArticleView` |   322,247 |    116,588 |

The largest shared route artifact is 255,268 raw bytes / 81,215 gzip bytes. The revision
worker is measured separately at 266,025 raw bytes / 68,759 gzip bytes.

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
