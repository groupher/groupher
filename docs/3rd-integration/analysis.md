# Third-party Analytics Integration

> Status: planning.
>
> Scope: community-admin configured third-party analytics scripts for public
> community pages.

## Product Boundary

This document covers Dashboard `Integrations / Third-party / Analytics` only.
It does not define or change Groupher's built-in Web Analysis implementation.

Third-party analytics is a community-owned integration surface:

- Community admins choose a supported analytics provider.
- Community admins enter the provider's normal public tracking identity, such as
  a Google Analytics measurement ID or a Fathom site ID.
- Groupher stores the configuration and injects the provider script only on that
  community's public pages when the configuration is enabled and valid.

The v1 provider set is:

- Google Analytics
- Google Tag Manager
- Microsoft Clarity
- Plausible
- Fathom

Do not include Umami in the default v1 provider list. If user-owned Umami is
needed later, expose it as an advanced "custom Umami" integration instead of
mixing it into the default analytics choices.

Provider availability and config-field definitions should come from the
backend. Treat them like editor templates: Dashboard asks the backend which
analytics providers are supported, which fields each provider needs, and which
validation hints should be shown. Avoid maintaining the same provider list in
Dashboard UI, backend validation, and public script loading separately.

## Runtime Scope

Third-party analytics scripts should be injected from the public community
layout:

```text
frontend/main/src/app/[community]/layout.tsx
  -> ThirdPartyAnalyticsScripts
  -> Client
```

Do not inject these scripts from Dashboard layouts. Dashboard is the management
surface where integrations are configured; it should not be tracked by a
community admin's third-party analytics account.

Do not put third-party analytics in the root `frontend/main/src/app/layout.tsx`
for v1. The feature is community-scoped, and `[community]/layout.tsx` already
has the community dashboard data needed to decide which scripts may be rendered.

### Content Security Policy

If Groupher sends a CSP header in production, the third-party analytics rollout
must update it before enabling the feature. At minimum, check script/connect
permissions for the v1 provider hosts:

```text
www.googletagmanager.com
www.google-analytics.com
www.clarity.ms
scripts.clarity.ms
plausible.io
cdn.usefathom.com
```

Keep the exact CSP directives close to the deployment/header implementation.
This document only records the provider domains that must be considered.

## Loading Rules

Scripts must be conditional and provider-specific.

```text
community has no third-party analytics config
  -> render nothing

provider config exists but enabled is false
  -> render nothing

provider config is enabled but invalid
  -> render nothing

provider config is enabled and valid
  -> render only that provider's script
```

Supporting five providers must not make every community download five analytics
libraries. Do not use third-party npm SDKs for v1. Render small Next `Script`
tags and inline bootstraps only when a provider is enabled.

The intended no-config path is:

```text
SSR community layout
  -> no valid enabled third-party analytics configs
  -> <ThirdPartyAnalyticsScripts /> returns null
  -> no third-party analytics network requests
```

## Provider Identities

These values are not secrets. They are normal public tracking identities that
analytics providers expect websites to place in browser-visible scripts.

| Provider | User-provided value | Example |
| --- | --- | --- |
| Google Analytics | Measurement ID | `G-1234567` |
| Google Tag Manager | Container ID | `GTM-ABC1234` |
| Microsoft Clarity | Project ID | `abc123xyz` |
| Plausible | Site domain | `docs.example.com` |
| Fathom | Site ID | `ABCDE` |

Do not store or expose provider admin credentials, API tokens, OAuth secrets, or
server-side access keys in this integration model. v1 only needs the browser
tracking identities above.

## Provider Registry

The backend owns the provider registry. It should expose a GraphQL query that
Dashboard can use to render cards and settings forms.

Suggested shape:

```text
thirdPartyAnalyticsProviders: [
  {
    provider: "ga",
    title: "Google Analytics",
    desc: "Pageviews, traffic sources, user paths, and events.",
    docsUrl: "https://developers.google.com/analytics",
    icon: "/integrations/ga.png",
    configFields: [
      {
        key: "measurementId",
        label: "Measurement ID",
        placeholder: "G-XXXXXXXX",
        requiredWhenEnabled: true,
        pattern: "^(G|GT)-[A-Za-z0-9-]+$"
      }
    ]
  }
]
```

Backend registry responsibilities:

- Own the supported provider keys for v1.
- Own provider card metadata that does not depend on frontend runtime behavior.
- Own config field definitions and validation hints.
- Reuse the same registry for Dashboard save validation.

Frontend responsibilities:

- Render Dashboard cards and forms from the backend provider registry.
- Keep provider icons under `frontend/dashboard/public/integrations` when the
  icon is only used by Dashboard.
- Keep script-rendering implementation in frontend code because it depends on
  Next `Script`, CSP/runtime behavior, and avoiding backend-delivered
  executable script strings.

If the backend registry contains a provider whose script renderer is not yet
implemented in the frontend, public pages must skip script injection for that
provider. Dashboard may show it as unsupported by the current frontend renderer,
or the backend may avoid returning it until the renderer ships.

## Data Model

Add a community dashboard section dedicated to third-party analytics. Keep it
separate from built-in analysis configuration.

Persist the config as part of `community_dashboards`, not on the `communities`
table and not as a separate v1 table. It belongs to the community Dashboard
configuration surface and should follow the same replace-style dashboard
section update path.

Suggested persisted shape:

```text
third_party_analytics: [
  {
    provider: "ga",
    enabled: true,
    config: {
      measurement_id: "G-1234567"
    }
  }
]
```

Use provider-specific config keys rather than a single generic `id` everywhere.
This keeps validation and future UI labels clear:

| Provider | Config field |
| --- | --- |
| `ga` | `measurement_id` |
| `gtm` | `container_id` |
| `clarity` | `project_id` |
| `plausible` | `domain` |
| `fathom` | `site_id` |

The persisted shape uses snake_case because it is stored and validated by the
backend. GraphQL and frontend public shapes use camelCase through the normal
Absinthe field conversion boundary.

The public page renderer should receive only normalized, loadable configs:

```text
enabledThirdPartyAnalytics: [
  { provider: "ga", measurementId: "G-1234567" },
  { provider: "clarity", projectId: "abc123xyz" }
]
```

Disabled, invalid, and draft values should stay in Dashboard configuration
responses and should not be rendered into public page HTML.

Prefer a backend-resolved public field such as `enabledThirdPartyAnalytics` for
`[community]/layout.tsx`. It should return only enabled and valid configs, and
the frontend script renderer should still defensively validate before rendering.

## Script Registry

Centralize script rendering in one frontend registry. The layout should not
contain provider-specific branches, and the frontend should not duplicate
provider metadata already returned by the backend registry.

Suggested location:

```text
frontend/core/lib/thirdPartyAnalytics/
  validators.ts
  ThirdPartyAnalyticsScripts.tsx
```

Responsibilities:

- `validators.ts` defensively validates persisted configs before rendering.
- `ThirdPartyAnalyticsScripts.tsx` receives normalized configs and renders the
  enabled scripts.
- A local `SCRIPT_RENDERERS` const maps provider keys to renderer functions.
  This is intentionally frontend-owned; do not let the backend send executable
  script strings.

High-level shape:

```tsx
const SCRIPT_RENDERERS = {
  ga: renderGoogleAnalytics,
  gtm: renderGoogleTagManager,
  clarity: renderClarity,
  plausible: renderPlausible,
  fathom: renderFathom,
} as const

export function ThirdPartyAnalyticsScripts({ configs }) {
  const renderableConfigs = configs.filter(isRenderableAnalyticsConfig)

  if (renderableConfigs.length === 0) return null

  return renderableConfigs.map((config) => SCRIPT_RENDERERS[config.provider]?.(config) ?? null)
}
```

Provider scripts should have stable IDs so duplicate injection is avoided:

```text
third-party-analytics-ga-loader
third-party-analytics-ga-init
third-party-analytics-gtm
third-party-analytics-clarity
third-party-analytics-plausible
third-party-analytics-fathom
```

Recommended Next `Script` strategy:

| Provider | Strategy | Reason |
| --- | --- | --- |
| Google Analytics | `afterInteractive` | Standard analytics bootstrap without blocking first paint. |
| Google Tag Manager | `afterInteractive` | Avoid making the community page critical path heavier in v1. |
| Microsoft Clarity | `afterInteractive` | Session tooling should start after hydration is available. |
| Plausible | `lazyOnload` | Lightweight page analytics can wait until browser idle. |
| Fathom | `lazyOnload` | Lightweight page analytics can wait until browser idle. |

## Provider Rendering Notes

### Google Analytics

Render `gtag.js` only when `measurement_id` is valid.

Expected browser-visible output:

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1234567"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-1234567');
</script>
```

### Google Tag Manager

Render the GTM bootstrap only when `container_id` is valid.

Expected browser-visible output:

```html
<script>
  (function(w,d,s,l,i){/* GTM bootstrap */})(window,document,'script','dataLayer','GTM-ABC1234');
</script>
```

v1 intentionally skips the GTM `noscript` iframe because Groupher public
community pages rely on JavaScript for the normal runtime path. If a noscript
fallback is required later, add it deliberately in the public body surface.

### Microsoft Clarity

Render the Clarity bootstrap only when `project_id` is valid.

Expected browser-visible output:

```html
<script>
  (function(c,l,a,r,i,t,y){/* Clarity bootstrap */})(window, document, "clarity", "script", "abc123xyz");
</script>
```

### Plausible

Render the Plausible script only when `domain` is valid.

Expected browser-visible output:

```html
<script defer data-domain="docs.example.com" src="https://plausible.io/js/script.js"></script>
```

For self-hosted Plausible support, add an advanced origin field later. Do not
include a custom script origin in v1 unless there is a concrete product need.

### Fathom

Render the Fathom script only when `site_id` is valid.

Expected browser-visible output:

```html
<script src="https://cdn.usefathom.com/script.js" data-site="ABCDE" defer></script>
```

## Validation

Use strict-enough validation to avoid accidental script injection while keeping
the product simple.

Suggested validation:

| Provider | Validation |
| --- | --- |
| Google Analytics | `measurement_id` matches `/^G-[A-Za-z0-9-]+$/` |
| Google Tag Manager | `container_id` matches `/^GTM-[A-Za-z0-9-]+$/` |
| Microsoft Clarity | `project_id` is non-empty and contains only letters, numbers, underscores, and hyphens |
| Plausible | `domain` matches `/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/` |
| Fathom | `site_id` is non-empty and contains only letters, numbers, underscores, and hyphens |

All user-provided provider values should have a practical max length. Use 255
characters for provider identity fields and domains unless a provider has a
stricter documented limit. Provider keys should be much shorter, for example 32
or 64 characters.

Validation should run in two places:

- Dashboard save path: reject invalid enabled config and show a useful field
  error.
- Public render path: defensively skip invalid configs even if bad data already
  exists.

## Dashboard UX

Each provider card opens a settings modal with:

- Enable switch.
- One required provider identity field.
- Provider-specific help text and docs link.
- Save button.
- Current status: enabled, disabled, or invalid.

For v1, use one config field per provider. Avoid advanced event mapping,
consent-mode settings, custom domains, or provider API validation until the
basic load path is proven.

## Implementation Phases

### Phase 1: Provider List Cleanup

- Remove Umami, Matomo, Hotjar, and Facebook Pixel from the default Analytics
  provider list.
- Keep Google Analytics, Google Tag Manager, Microsoft Clarity, Plausible, and
  Fathom.
- Remove or stop referencing the unused provider i18n keys, settings metadata,
  and Dashboard icons for removed providers in the same implementation slice.
- Keep provider icons under `frontend/dashboard/public/integrations` only for
  providers still rendered by Dashboard.
- No compatibility migration is required because the unsupported providers were
  never shipped as a public feature.

### Phase 2: Backend Provider Registry

- Add a backend provider registry module for v1 analytics providers.
- Add GraphQL types/query for Dashboard provider definitions.
- Move provider titles, descriptions, docs URLs, config field names,
  placeholders, and validation hints out of frontend constants.
- Use the same backend registry for Dashboard save validation.

### Phase 3: Persistence and GraphQL Contract

- Add a `third_party_analytics` dashboard section or equivalent persisted
  community dashboard config.
- Add provider-specific input types or a normalized input shape aligned with the
  backend provider registry.
- Add GraphQL fields/mutations for Dashboard read/write.
- Add a public GraphQL field such as `enabledThirdPartyAnalytics` so community
  SSR can receive only enabled and valid configs.

### Phase 4: Script Registry

- Add the centralized frontend script renderer registry.
- Add validators.
- Add `ThirdPartyAnalyticsScripts`.
- Wire it into `frontend/main/src/app/[community]/layout.tsx`.

### Phase 5: Dashboard Settings

- Query backend provider definitions.
- Wire provider cards to persisted config.
- Replace the placeholder modal action with real save behavior.
- Show enabled/disabled/invalid status on cards.

### Phase 6: Verification

Local verification should prove script-loading behavior, not third-party
dashboard reporting.

Required checks:

```text
disabled provider
  -> no provider script in HTML
  -> no provider network request

invalid enabled provider
  -> no provider script in HTML
  -> Dashboard shows validation error on save

valid enabled provider
  -> correct provider script is rendered
  -> only that provider's network request appears

multiple valid providers
  -> each enabled provider renders once
  -> disabled providers render nothing

production CSP
  -> required provider hosts are allowed
  -> no browser CSP violations for enabled providers
```

Use Playwright network assertions for public community pages. For visual
Dashboard checks, use the `/home` community because local dashboard test data is
available there.

## Non-goals

- Do not change built-in Web Analysis.
- Do not load community third-party analytics scripts in Dashboard.
- Do not add provider API calls or provider credential storage in v1.
- Do not add consent-management UI in v1.
- Do not support custom script origins in v1.
- Do not add event mapping or conversion configuration in v1.
- Do not add concurrency conflict detection in v1.
- Do not add dashboard config audit logs in v1.
