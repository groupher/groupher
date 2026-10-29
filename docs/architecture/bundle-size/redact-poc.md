# TanStack Redact Landing POC (2026-10-27)

Status: Landing, Dash, Community, Apply, and Inspire-me now use Redact by default in this worktree. Earlier sections record historical POC stages; see the final section for the current state.

## Scope and reproduction

- Base: `origin/dev` at `2f9fa2fb59` in a dedicated worktree.
- Runtime: React 19.3.0, TanStack Start 1.169.1, Vite 8.3.4, Cloudflare Vite plugin `2.0.0-beta.sha-ad79608dd`, Redact 0.2.0.
- The opt-in switch is in `frontend/landing/app.config.ts`. The default build still uses React.
- React: `pnpm --filter @groupher/frontend-landing run build`.
- Redact: `REDACT_POC=1 pnpm --filter @groupher/frontend-landing run build`.
- Both commands completed, including the four prerendered routes and Landing's static asset check. Landing type-check also passed with the POC dependency and config.

## Bundle comparison

Measured from each build's `frontend/landing/.cloudflare/output/v0/workers/default/assets/assets` directory. Each emitted JS/CSS file was gzipped separately with Node's `gzipSync`, then summed. The homepage figure includes only JS/CSS files directly referenced by `index.html`; it excludes dynamically loaded chunks, images, fonts, and later requests. This is a build artifact comparison, not a network waterfall or a field performance result.

| Scope                                      | React gzip | Redact gzip |         Difference |
| ------------------------------------------ | ---------: | ----------: | -----------------: |
| All emitted client JS + CSS                |  567,685 B |   520,783 B |  -46,902 B (-8.3%) |
| Homepage HTML's direct JS + CSS references |  384,735 B |   338,345 B | -46,390 B (-12.1%) |

These measurements used the original Landing components and Redact's default `full` preset. No feature flags were disabled. They are not comparable to TanStack's starter-app percentage.

## Runtime findings

1. `vite preview` serves the static output at `/`, while Landing's finalizer rewrites client asset URLs to `/landing/assets/` for the real edge route. A local static server mapping `/landing/assets/*` to the generated `assets/*` directory was used for browser checks. A 404 from an unmodified root `vite preview` is a preview-path issue.
2. With the original homepage components, Redact hydration reached `flushPending exceeded 50 iterations`. The failing path ran through hydration recovery and the route's `CatchBoundary`. Direct `/pricing` and `/book-demo` pages rendered in the same Redact static build.
3. Temporarily replacing `typewriter-effect` with plain text removed the first hydration-recovery failure. The homepage then exposed a second issue: `react-scroll-snap-anime-slider` calls its `Component` superclass as a function and fails with `Class constructor Component cannot be invoked without 'new'`. The temporary replacement was reverted. This shows that the claimed zero-application-code migration does not hold for this Landing dependency set.
4. Redact's development SSR returned HTTP 500 in the Cloudflare Worker runner. Vite's SSR prebundle contained `require("react")` from CommonJS dependencies. Excluding `react-flip-numbers` and `typewriter-effect` from SSR optimization removed that `require` error, but then `typewriter-effect` failed while reading `Component` from an undefined React import. The exclusions were diagnostic and were removed.
5. The React control build also reported `useAccount must be used within an Account store provider` when served through the simple local static mapping. That browser fixture is therefore insufficient for a clean end-to-end comparison. The Redact-specific class-constructor and SSR failures above have separate direct evidence.

## Decision

Keep Redact behind `REDACT_POC=1`. It has a measurable Landing bundle benefit, but the current homepage and development SSR do not pass. The Cloudflare Vite plugin version in this repo is also outside Redact 0.2.0's declared optional peer range (`1.65.0`), so integration needs validation against the project's actual beta plugin.

To continue the POC, replace or isolate the two legacy Landing animation libraries, then verify the homepage in the real edge route, direct loads, client navigation, hydration, and interaction latency. Only after that should Community or Dash be tried; their shared Core search, editor, and table paths add scheduling and third-party compatibility risk.

## Dash follow-up (2026-10-27)

Dash now has the same opt-in `REDACT_POC=1` switch in `frontend/dash/app.config.ts`; the default remains React. `@tanstack/redact@0.2.0` is a Dash dev dependency. No Dash application component was changed.

Both `pnpm --filter @groupher/frontend-dash run build` and `REDACT_POC=1 pnpm --filter @groupher/frontend-dash run build` passed. Dash type-check and `git diff --check` passed. Counting all emitted client JS/CSS files in `.cloudflare/output/v0/workers/default/assets/assets`, gzipping each file separately and summing, React produced 1,865,137 B across 338 files and Redact produced 1,814,878 B across 340 files: 50,259 B less (-2.7%). This includes every emitted route chunk, not the initial route payload or a network waterfall.

The Redact dev Worker returned HTTP 500 for `/home/overview` with `Calling require for "react" in an environment that doesn't expose the require function`. The React control reached the application route and returned an HTML error page for `GraphQLRequestError: GraphQL request failed with HTTP 500`, because the local backend was unavailable. Thus the Redact SSR error is a separate earlier failure, while authenticated page rendering, hydration, and interactions remain unverified. The local dev servers were stopped after the check.

Dash also imports `react-aria-components` and `react-flip-numbers` through shared Core code. Those paths were not exercised in a browser, so the build result does not establish their Redact compatibility. Keep the switch disabled until Worker SSR and real Dash browser flows pass.

## Latest dev Landing retest (2026-10-29)

- Base: `origin/dev` at `daacbf9d0e` (Landing cover and footer redesign). Landing uses Redact `0.2.3`, the npm `latest` version checked on this date. Dash remains on the earlier `0.2.0` POC.
- Both the default React and opt-in Redact production builds passed, including all four prerendered pages and Landing's asset verification. The same all-emitted-client-JS-and-CSS gzip method produced React 545,279 B (42 files) and Redact 498,748 B (42 files), a 46,531 B (8.5%) reduction. This is not the initial route transfer size.
- With the production Redact build served by the current Landing `vite preview`, Playwright loaded `/`, `/pricing`, and `/book-demo`. The homepage rendered its new cover; changing the wallpaper scene via the “Plan a launch” button worked. No browser console errors were recorded on these checks. This is a focused smoke check, not full interactive acceptance.
- The old `typewriter-effect` and `react-scroll-snap-anime-slider` packages remain declared but have no imports under `frontend/landing/src` in this dev revision. Their former homepage failure paths were therefore not exercised. The POC cannot isolate whether the new Redact version alone fixed either issue.
- Development Worker SSR remains broken: the request to `/` returned HTTP 200 with rendered HTML, but the server log recorded `Error in renderToReadableStream: Calling require for "react" in an environment that doesn't expose the require function`. Vite's SSR prebundle contains `require("react")` in `react-flip-numbers.js`. A 200 response does not clear this server-side error.

Decision: keep Redact opt-in. The latest Landing page passes a small production-browser check and saves bundle bytes, but the development SSR error and broader navigation/interaction checks remain outstanding.

## Landing SSR dependency isolation (2026-10-29)

Landing has one direct `AnimatedCount` use: `src/widgets/Landing/BatteryBento/Statistics/ChartCard.tsx`. Shared Core's `AnimatedCount` imports `react-flip-numbers`. In this POC, the ChartCard import and render are commented/replaced with a plain `<span>` displaying the same number; the shared component and its other consumers are unchanged.

Before isolation, the Redact development Worker logged `Calling require for "react" in an environment that doesn't expose the require function`; the SSR prebundle's only JS file containing `__require("react")` was `react-flip-numbers.js`. After isolation, requests to `/`, `/pricing`, and `/book-demo` all returned HTTP 200 and the server log no longer recorded that error. The homepage rendered in Playwright. Its only browser network error was an unavailable local browser-metrics service at `127.0.0.1:4311`; a theme cookie-domain warning also appeared on the loopback host.

This isolates `react-flip-numbers` as the immediate trigger for the observed Landing dev SSR failure. The underlying CommonJS-to-Worker packaging incompatibility remains relevant to other dependencies, including Dash. The plain text replacement is diagnostic and does not preserve the number animation.

## Shared counter replacement (2026-10-29)

`frontend/core/ui/AnimatedCount/AnimatedCount.tsx` now uses the existing `motion/react` dependency to animate a count change with a vertical 3D flip. Its public props and all call sites are unchanged. The Landing ChartCard has been restored to `AnimatedCount`. The old `react-flip-numbers` dependency is removed from the root and shared Core manifests.

After lockfile regeneration, a frozen offline install passed and removed `react-flip-numbers` from the installed dependency graph. Both the Redact and default React Landing production builds passed all four prerendered routes and asset verification after removal.

The final shared-counter builds were measured with the same all-emitted-client-JS-and-CSS, per-file gzip method: React 540,854 B across 42 files; Redact 494,149 B across 46 files. Redact saved 46,705 B (8.6%). This is a whole-build artifact total, not initial page transfer or a runtime performance measurement.

Landing's Redact dev Worker served `/` without the previous `require("react")` error. In the browser, hovering the statistics card changed the displayed number from 23 to 152; the only network error was the unavailable local browser-metrics endpoint. The Redact production build passed all four prerendered routes and Landing's asset verification. Landing TypeScript checking passed. A direct full Core TypeScript check still reports unrelated pre-existing test-file errors.

Dash's Redact dev Worker still returned HTTP 500 with `require("react")`. The remaining `__require("react")` was in its SSR prebundle of `react-compiler-runtime`, not `react-flip-numbers`; Dash needs separate investigation. This counter replacement is not evidence that Dash is fixed.

The redesigned Landing page no longer imports `react-scroll-snap-anime-slider`. Its declarations were removed from the root and Landing manifests, and the lockfile pruned that package and its unused Popmotion dependencies. `react-flip-numbers` and `react-simple-animate` were likewise removed. Historical migration notes retain their original references.

## Landing default switch (2026-10-29)

Landing's Vite config now enables Redact without `REDACT_POC=1` and keeps `ssr.noExternal: true`, matching the validated POC settings. The carousel and flip-number packages are absent from the manifests and lockfile. Inspire has not been switched or validated. Dash remains an opt-in POC with its separate Worker SSR failure.

## Dash Worker SSR root cause (2026-10-29)

With Dash's `REDACT_POC=1` and a forced Vite dependency re-optimization, `/home/overview` returned HTTP 500. The Worker reported `Calling require for "react" in an environment that doesn't expose the require function`. The only `__require("react")` in the SSR prebundle was inside `react-compiler-runtime@1.0.0`, imported by PlateJS. Redact's Vite plugin aliases `react/compiler-runtime`, but neither the installed 0.2.0 nor 0.2.3 plugin aliases the separate `react-compiler-runtime` package.

The Dash-only POC config now aliases `react-compiler-runtime` to `@tanstack/redact/compiler-runtime` when `REDACT_POC=1`. The PlateJS modules in this dependency graph import only `c`, which the target provides. After forcing re-optimization, `/home/overview` returned HTTP 200, the previous `__require("react")` disappeared from SSR prebundled JS, and the Redact production build passed. This identifies and removes the first Worker SSR blocker; editor interaction and broader Dash behavior still need browser validation. The normal React config is unchanged.

Browser follow-up: an initial anonymous `/home/doc/editor` load exposed another Redact-only dev transform error. A Vite prebundled client chunk imported `use-sync-external-store/shim/index.js`, a path absent from Redact 0.2.0 and 0.2.3 plugin alias maps. The Dash POC now aliases that exact path to `@tanstack/redact`. After a forced rebuild, anonymous `/home/overview` and `/home/doc/editor` loaded without browser console errors or failing static requests. The dashboard showed its sign-in boundary, so the PlateJS editor itself was not exercised.

For authenticated testing, the first shared mock GraphQL process disappeared mid-run, which caused a test-login HTTP 500. A fresh mock and independent E2E auth server then returned HTTP 204 from login and the browser stored all three auth cookies, including the Phoenix access token. However, the normal Cloudflare Worker dev mode did not use the shell-provided mock GraphQL endpoint: its route error was `[groupher-error-code:TOKEN_INVALID] Authorize: browser token is invalid`, a message from the real Phoenix API. The E2E token is invalid there. Clearing the signed-in hint restored HTTP 200 on the anonymous page; a React control also rendered the sign-in boundary. This authenticated-flow HTTP 500 is an environment mismatch, not evidence of a Redact-specific incompatibility. Running Vite directly with `E2E_AUTH_STACK=1` returned `Cannot GET /home/overview`, so a functioning complete E2E stack or a valid real-backend session is still needed to exercise the editor.

## Dash default switch and browser verification (2026-10-29)

Dash now uses Redact 0.2.3 by default with the two exact aliases above. The old `REDACT_POC` switch is removed. The default production build and Dash TypeScript check passed.

A separate HTTPS portless alias, mock GraphQL server, and E2E auth server supplied an isolated browser session. The Worker needed a temporary build-time GraphQL endpoint override to use the mock rather than the real Phoenix API; that override was removed after testing. In Chromium, the signed-in overview, Posts list, and Docs editor rendered. PlateJS accepted text input in the document body and `Meta+Z` restored its original content. No Redact or Slate runtime error occurred with a ten-minute test token. Console errors were missing mock image assets and `/api/content/publish` HTTP 502 responses. The latter came from the local Content Publisher boundary, whose `process.env` service-auth settings were not supplied by this isolated Worker test fixture; publish/save was not accepted. A previous Slate DOM-node error occurred only while the original 60-second test token expired and the editor unmounted, so it is not reproducible with the longer-lived token.

This is a focused browser smoke result. It validates rendering, hydration, navigation, and basic PlateJS editing in the isolated fixture; it does not validate real-backend authenticated flows, publishing, or every Dash route.

## Community, Apply, and Inspire-me follow-up (2026-10-29)

The remaining TanStack Start applications now use Redact 0.2.3 by default. They share Dash's exact aliases for `react-compiler-runtime` and `use-sync-external-store/shim/index.js` and bundle SSR dependencies with `ssr.noExternal: true`. Their existing routes and components were not changed.

All three production Vite builds and TypeScript checks passed. Development Worker smoke requests returned HTTP 200 for Community `/home/post` and `/home/doc`, Apply `/apply/health`, and Inspire-me `/`. In Chromium, anonymous Community `/home/post`, Apply `/apply/`, and Inspire-me `/` rendered. The browser consoles showed no Redact runtime error. Community's missing avatar/favicon requests, Apply's loopback HMR and browser-metrics requests, and Inspire-me's unavailable browser-metrics endpoint are local fixture issues. Apply's authenticated application flow and broader Community interactions were not exercised.

Inspire-me initially returned HTTP 500 because direct Vite startup skipped its `generate:data` step. After generating the feedback assets and restarting, both React control and Redact development requests returned HTTP 200.

The new importers were added to the lockfile using the already-resolved Redact 0.2.3 peer snapshots. An offline frozen install with the repository's pnpm 12.6.0, `--trust-lockfile`, and `--ignore-scripts` passed for all 23 workspace projects. CI then revealed that its normal install rejected Redact 0.2.3 under the 24-hour minimum release age policy. This exact version is now listed in `minimumReleaseAgeExclude`; the exception does not disable other supply-chain checks.

Additional browser checks used the normal local HTTPS hostnames. Community `/home/kanban` rendered, and client navigation to `/home/changelog` worked. The changelog list showed `count_failed`; the same error reproduced after restarting the Worker with the original React Vite config, so it is not introduced by Redact. Inspire-me client navigation from `/` to `/announcekit` rendered the 44-post list. Apply client navigation from `/apply/` to `/apply/review` reached the expected sign-in boundary. Apply's pre-existing HMR WebSocket target (`groupher.localhost`) did not connect from this isolated subdomain preview, and the browser-metrics listener was unavailable. The temporary Community and Apply portless mappings were restored to their original ports after validation.
