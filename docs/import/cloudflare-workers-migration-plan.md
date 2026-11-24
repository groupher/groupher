# Cloudflare migration and Vercel retirement plan

> Status: Production Cloudflare cutover and authenticated repository Apply/readback
> completed on 2026-10-25 in `home`. The final execution record below is the
> current evidence. Vercel
> inventory found no dedicated service projects or aliases to delete.
>
> Scope: the Cloudflare services in `backend/import` and `backend/converter`. PDF conversion,
> OCR, uploaded HTML conversion, and HTML conversion for online URLs are out of
> scope. Online URL import accepts Markdown only.

## Target architecture and behavior

- Cloudflare Worker resource names and production hostnames are `converter`
  (`converter.groupher.com`) and `import` (`import.groupher.com`). Local
  development uses those service identities under workerd simulation. The
  deployed POC resources have been removed; the production resource URI follows
  the Import hostname while its audience and scopes remain unchanged.
- Production resources use the names `converter` and `import`; the live-state
  section below records the current deployment and remaining verification.
- The `converter` Worker uses server-side
  `@firecrawl/anydoc-wasm` for DOCX, PPTX, and XLSX. It rejects PDF and uploaded
  HTML/HTM with stable client errors. It does not require a Container.
- The `import` Worker runs its HTTP API, durable analysis in Cloudflare
  Workflows, and attempt-scoped immutable artifacts in R2.
- A URL import first requests the original URL with `Accept: text/markdown`. If
  that does not return valid Markdown, it probes the same URL with `.md`
  appended to the path. If neither probe returns valid Markdown, it returns an
  unsupported-source error. It does not fetch HTML for conversion.
- Repository imports download a pinned source revision, analyze a bounded
  archive, persist Preview artifacts, and ask Phoenix to validate the target.
- Phoenix remains authoritative for caller authorization, ImportJob state,
  idempotency, BodyBag staging, Apply, cancellation, and final database writes.
  Workers and R2 do not become a second business-state authority.
- Dashboard is the authenticated product-facing proxy. Its production endpoint
  and service-auth resource now use `https://import.groupher.com` and
  `https://import.groupher.com/internal`. Import calls
  `https://converter.groupher.com`. Auth registers the new resource URI while
  preserving the existing audience and scopes. There is no old-domain alias.
- The connected Cloudflare account is Workers Free. Each Workflow step has a
  10 ms CPU budget. Do not raise the plan or CPU allowance to make a test pass.
  Start with a small documentation repository; reduce the corpus or per-step
  work until the complete flow passes.
- Relevant Free ceilings are 1,024 steps per Workflow, 50 external subrequests
  per Workflow invocation, 3,000 Workflow steps per day, and 100,000 Workflow
  executions per day shared with Workers requests. These are hard platform
  limits; pre-cutover validation proves only that the selected small fixture
  completes within them. Production-volume forecasts and load tests are deferred.
- Cutover is a hard switch. Historical Vercel Preview/Job state is abandoned;
  do not migrate it, dual-read it, drain it, or keep Vercel running as a
  compatibility layer. Historical Phoenix Job/BodyBag cleanup is out of
  migration scope.

## Verified current state — 2026-10-26

| Component | Production target        | Verified release                               |
| --------- | ------------------------ | ---------------------------------------------- |
| Converter | `converter.groupher.com` | `b41439c5-4653-4f26-9718-877fadb47cda`         |
| Import    | `import.groupher.com`    | `3adfbe14-383e-4402-8665-2656e92c9cf6`         |
| Dashboard | `dash.groupher.com`      | `6ec039fb-4a50-4b06-b95e-c7617491c336`         |
| Phoenix   | `api.groupher.com`       | `migration-a5102eace-draftfix-20261025` on Fly |

- Real Dashboard user session, production community `home`, source repository
  `https://github.com/svallory/lightprint-astro`, source commit `55c4bbfe`.
  Preview detected Starlight, 1 tab, 2 groups, 6 pages. Apply completed as job
  `6e7fb0df-7b39-48dc-b06c-68e0b99371b3`; the editor read back all six navigation
  entries and imported body content. Nothing was publicly published.
- Preview reference: `prv_UjMwSej-qV5T-5ixdJW__0F3jQQ70LiWtWVQT_aD`.
  Imported document `28c77c00-fa77-52a8-89ac-6e401bd1c1cb` was read through both
  the real Dashboard and the exact GraphQL tree/draft operations. A persisted
  TOC string-key projection bug was fixed; the regression exercises staging,
  Apply and GraphQL readback including headings.
- Live converter requests for DOCX/PPTX/XLSX returned 200 with expected text.
  PDF/HTML/HTM rejection remains 415. No Container is used.
- The real URL-import UI rejected `https://example.com/` as not exposing
  Markdown and generated an editable preview for the source repository's
  `README.md`. The URL content was appended to an imported draft, saved, and verified
  after a full page reload. A title edit also persisted and survived reload.
- Auth now has matching Auth, Content Import and Dash clients. Dash supports
  `docs:import:proxy` plus the existing content publisher's Doc/Article/Comment
  write scopes; Phoenix verifies delegated user credentials and permissions.
  Dashboard does not hold the Phoenix HMAC signing secret.
- Production R2 is `groupher-content-import`; Workflow names are
  `import-analysis` and `import-apply`. Temporary `content-import/` objects have
  a three-day lifecycle expiry in addition to application Preview expiry.
- Removed all four old POC Workers (`content-import-poc`,
  `content-import-workers-poc`, `converter-poc`, `md-converter-poc`), their three
  Workflows, and the POC R2 bucket after deleting its 248 temporary objects.
  Fresh inventory shows no POC Workers and only the two production Workflows.
- Vercel inventory covered all 12 projects and all 79 aliases across four
  pages. Neither migrated hostname remains there and no dedicated converter
  or importer project exists. Shared projects are preserved.
- Removed Vercel Workflow SDK orchestration and Vercel Blob adapter/dependency.
  Local repository development now uses `cf dev --mode development --port 8001`.
  Both local and production entrypoints explicitly supply R2/Workflow runtime
  dependencies. The Node comparison adapter has been removed.
- Validation: Import 148 passed / 1 skipped; real workerd HTTP smoke and both
  Import type checks passed. Phoenix import/readback and draft-mutation suites 27 passed in their own test
  database; previous combined Auth/import backend suites 35 passed. Dashboard
  route/proxy tests 28 passed and type check passed. `pnpm docs:check` passed.
- Real browser DOCX upload also passed through the native macOS file picker:
  `sample.docx` → editable preview → append to the `home` Introduction draft →
  Saved → reload. Both `POC Heading` and its body remained after reload.
  Evidence: `.playwright/import-docx-preview.png` and
  `.playwright/import-docx-saved-reloaded.png`.
- This browser check exposed an actual Worker runtime bug: converter forwarding
  used `redirect: 'error'`, which workerd rejects before sending the request.
  Changed it to `manual`; non-success responses, including redirects, remain
  rejected. Reproduced the original TypeError in workerd, verified the corrected
  multipart Request there, and passed both upload/redirect regression tests and
  Import type checking before the production UI retest.
- Capacity, CPU profiling, large inputs and concurrency remain deferred per the
  accepted scope.

The production `home` run replaces the earlier proposed isolated POC acceptance
by explicit user decision. Historical Vercel state, compatibility, drain,
rollback/observation periods and production-scale performance are excluded.

## Production domain unification — 2026-10-26

The user confirmed `converter.groupher.com` and `import.groupher.com` as the
production names. Both domains are now attached to their matching Workers.
Cloudflare DNS inventory confirms the two retired domain records are absent;
no redirects, aliases or compatibility endpoints were retained.

Updated Converter and Import domain bindings, Import's converter endpoint,
Dashboard's Import endpoint/resource/default, Auth resource registry and all
repository references. Auth deployed as `5014c17b-d853-48e4-b322-eb5c034e5a69`;
current service/Dashboard versions are listed above. Phoenix did not change.

Validation after these releases:

- Both new domains return HTTPS 200 health and the correct production identity.
- Converter returns the expected Markdown for DOCX, PPTX and XLSX.
- Import rejects unauthenticated preview and file-import requests with 401.
- Actual Dash client credentials obtain a token for the new resource, with
  `service:dash` subject and the existing audience. The retired resource returns
  400, proving there is no authorization-resource compatibility alias.
- The real authenticated Dashboard user generated the source README's editable
  Markdown preview through the new domain. Evidence:
  `.playwright/import-new-domain-preview.png`. This check did not append another
  copy or repeat Apply; the earlier complete production Apply evidence remains
  the migration acceptance for unchanged business logic.
- Auth 66 tests/type check and Dashboard proxy/delegation 12 tests passed.

## Current development and deployment commands

```sh
pnpm dev:converter
pnpm dev:import
pnpm test:converter
pnpm test:import
pnpm --filter @groupher/import run test:worker
pnpm --filter @groupher/import run type-check
pnpm --filter @groupher/import run type-check:workers
pnpm --filter @groupher/converter run type-check
pnpm --filter @groupher/converter run deploy:dry-run
pnpm --filter @groupher/import run deploy:dry-run
pnpm docs:check
```

Local ports are Converter `8000` and Import `8001`. Both use the same Worker
entrypoints as production, under `cf dev` with locally simulated storage and
Workflows. Production deployment uses `pnpm --filter @groupher/converter run deploy`
followed by `pnpm --filter @groupher/import run deploy`. Existing production
secrets remain attached to the existing Worker names.

Only `development` and `production` configuration modes exist. No POC, staging,
Python server, native Node converter, compatibility fallback or second runtime
is required. Public domains and service-auth audience/scope/resource identifiers
remain the existing contracts; directory/package/Dev Hub identities are
`converter` and `import`.

## Production incident fixes and acceptance (2026-10-25)

The Auth production registry was missing its own `serviceName: auth` client.
GitHub returned successfully, but Auth could not acquire the
`auth:session:signin` service token. Auth's public-hostname self-fetch also
returned 522. The deployed repair uses the existing credential-validated issuer
in process and registers matching Auth credentials with only `phoenix:auth-api`
and the seven scopes used by the Auth module. Code version:
`b382974e-75a9-4a0c-bc66-207954f6cf6f` (subsequent secret updates create new versions).

Verified against production: all seven grants and JWKS signature validation;
unrelated scopes/audiences rejected; Auth → Phoenix reserved-session probe 200;
real browser GitHub callback 302 back to Dashboard. The temporary service probe
was removed and `/health/service-auth` returns 404 again. Auth tests: 66 passed;
type check and documentation checks passed.

Phoenix was still running source commit
`b244c6fdacc4e39421af6dd5bd9e2148fe30b18a` (2026-09-08), which lacked
`User.accountRef`. The current Phoenix release has now been deployed as
`registry.fly.io/groupher-api:migration-a5102eace-activityfix-20261025`.
The deployment required a pagination signing key and a forward migration
`20261018080000_complete_deployed_activity_contract.exs` to repair the actual
legacy Activity table shape before subsequent migrations. The repair was tested
against a separate database reproducing the deployed legacy columns and a
historical record; the full migration chain completed and preserved that record.
A separate clean database passed 35 focused Auth/content-import tests.

Production startup then revealed missing cache-purge configuration. A token
restricted to Cache Purge on the Groupher zone was created and injected with
`CLOUDFLARE_ZONE_ID` and `CLOUDFLARE_API_TOKEN` through Fly secrets. Public API
health returned 200, introspection confirmed `User.accountRef`, and a cache-tag
purge request returned Cloudflare `success: true`. No secret values are stored
in this repository.

The previous Dashboard release also queried the removed
`Community.moderators` field. Dashboard was rebuilt from the same checkout as
Phoenix and deployed to its original custom domain. Its Import service client
was missing a secret; a distinct `serviceName: dash` client was registered with
only audience `content-import:internal-api` and scope `docs:import:proxy`, and
the matching secret was injected into the Dashboard Worker.

The first real Analyze request then exposed four stale proxy routes using
`getPhoenixToken`, which requires the Phoenix HMAC signing secret on the
frontend. Those routes now follow the existing GraphQL/Publisher contract:
`readPhoenixTokenCookie` forwards the opaque user credential; Import and Phoenix
verify it before admission or writes. No signing key is copied to Dashboard.
Twelve route/proxy regression tests passed, including all methods rejecting
missing cookies and forwarding opaque credentials. Full production Apply and
readback remain the completion criterion below.

## Follow-up defects found by actual production writes

The first URL preview inserted correctly but editing the imported draft exposed
two independent defects. The Publisher called `options.fetcher(...)`, giving
Workers' native fetch the wrong receiver (`Illegal invocation`). It now calls a
standalone function. A regression mock asserts an undefined receiver: it failed
before the fix and passed after it.

Once requests reached Phoenix, a blank subtitle caused `put_doc_digest` to inject
an empty digest, which Ecto cast to null despite the database's required column.
Blank subtitles no longer override the digest; the existing BodyBag summary
fallback now applies, with title/`untitled` as nonempty fallback. The combined
Import/readback and draft mutation suites passed 27 tests in an isolated database.
The production image is `migration-a5102eace-draftfix-20261025`; production save and reload now pass. Both an edited title and appended URL
content were verified after full page reloads. Evidence is saved under
`.playwright/import-production-complete.png`,
`.playwright/import-production-readback.png`,
`.playwright/import-save-reload-verified.png` and
`.playwright/import-url-saved-reloaded.png` in this worktree.

## Cleanup verification — 2026-10-25

- Import: 140 tests passed / 1 skipped; both TypeScript projects and workerd HTTP
  smoke passed. The retired Node URL comparison suite is removed; production URL
  behavior remains covered by Worker platform tests and the prior UI acceptance.
- Converter: 9 Worker tests and TypeScript check passed. Root `pnpm dev:converter`
  actually starts workerd through Vite on port 8000; the port belongs in Vite's
  server config because this CF CLI version cannot forward `--port` to Vite.
- Root `pnpm dev:import` actually starts workerd on port 8001 with R2 and both
  Workflows in local mode. Local health reports `converter` / `import` with
  `environment: development`. Authenticated local writes require development
  credentials in the gitignored Import `.env`; health/auth-rejection smoke does
  not claim a configured local Auth/Phoenix full Apply.
- Local converter HTTP smoke passed DOCX/PPTX/XLSX, unsupported PDF/HTML,
  malformed/oversize inputs, health after errors and a tiny six-request burst.
- Dev Hub: 54 tests, TypeScript check and production build passed. Regression
  locks service IDs, Make entrypoints, ports, Cloudflare links and package names.
- Both production deployments completed under their existing Worker names and
  domains. Converter's three formats returned expected Markdown; PDF/HTML returned 415. Import health and unauthenticated route boundaries are checked after deploy.
- Documentation gate, Import formatting gate and whitespace checks passed.

## Repository retirement cleanup

The old Python converter directory, its deployment configuration and Python
installation/start/test entrypoints are removed. Runtime directories are
`backend/converter` and `backend/import`; packages are `@groupher/converter`
and `@groupher/import`. Dev Hub IDs, local aliases, Make targets and root scripts
use those names. Their deployment links point to Cloudflare. The root Workflow
SDK allowlist was removed after checking no remaining workspace consumes it.

The isolated Node comparison servers/adapters and POC modes are removed. Files
SDK's filesystem adapter remains only for isolated PreviewStore unit tests;
local product development uses R2 simulation through `cf dev`.

## Completion checklist for the accepted production scope

Acceptance uses the explicitly authorized production `home` small-sample flow.
Performance work is deferred.

- [x] Production `converter` and `import` serve the unified `converter.groupher.com` / `import.groupher.com` domains.
- [x] Auth, Phoenix and Dashboard releases/configuration agree on user and service contracts.
- [x] Real user Preview → R2/Workflow → Phoenix Job → staging → Apply completed for six Docs.
- [x] Editor and exact GraphQL queries read back the imported tree, bodies and TOC.
- [x] Live DOCX/PPTX/XLSX converter requests return expected Markdown.
- [x] Real URL UI accepts Markdown and rejects a site that exposes only HTML.
- [x] Vercel Workflow and Blob runtime/dependencies removed from Content Import.
- [x] POC Workers, Workflows and bucket removed; production R2 temporary-artifact retention configured.
- [x] Full Vercel project/alias inventory completed; no dedicated migrated-service project exists.
- [x] Relevant unit, workerd smoke, type and documentation gates pass.
- [x] Post-import editor save and reload accepted after the final Phoenix digest fix.
- [x] Native browser DOCX file selection, conversion preview, insertion, save and
      reload readback passed in the production `home` draft.

CPU/capacity, large input and concurrency acceptance remain future work. Alert
notification delivery has not been tested; no operational alert acceptance is
claimed by the functional migration evidence.

## Temporary deployment credential cleanup

The account/zone-scoped deployment token used to avoid CLI OAuth expiry has
expiry `2026-10-26T06:27:32Z`. Cloudflare rejected both owner-OAuth
and self-revocation with error 9109; it is not claimed revoked. Its local token
value was removed after deployment. The separate zone-only Cache Purge token
is a required Phoenix production secret and remains active.
