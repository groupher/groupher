# Platform Links

## Purpose

Dashboard UI is shared by two applications:

- `frontend/dashboard` uses Next.js App Router and `next/link`.
- `frontend/dash` uses TanStack Router and `@tanstack/react-router`'s `Link`.

Shared Core components must not import either router directly. They use the
platform link contract exposed by `PlatformProvider`.

## Link contract

Core uses `frontend/core/platform/Link.tsx`:

```tsx
<PlatformLink
  route={dsbRoutes.section({ community, section: 'appearance' })}
  preserveSearch
>
  Appearance
</PlatformLink>
```

The contract accepts either:

- `route`: an internal typed dashboard route target;
- `href`: an ordinary URL, including an external URL.

The Core component does not decide whether navigation is handled by Next or
TanStack Router. The active platform adapter does that.

## Platform implementations

### Next Dashboard

`frontend/dashboard/src/platform/Link.tsx` resolves the route with the
`dashboard` root segment and renders:

```tsx
<NextLink href={resolvedHref}>...</NextLink>
```

### TanStack Dash

`frontend/dash/src/platform/Link.tsx` resolves the route with the `dash` root
segment and renders:

```tsx
<TanStackLink to={resolvedHref}>...</TanStackLink>
```

The TanStack adapter owns TanStack-specific concerns such as `preload`,
`replace`, and the registered route type. Those details must not leak into
Core components.

## Semantic boundary

Use links for navigation:

```tsx
<PlatformLink route={target}>Settings</PlatformLink>
```

Use buttons for actions:

```tsx
<button type="button" onClick={onCollapse}>
  Collapse
</button>
```

Navigation items must not be implemented as buttons calling `navi.to()`.
Using a real link preserves keyboard navigation, copy-link, open-in-new-tab,
modified-click behavior, browser fallback, and assistive-technology semantics.

`navi.to()` remains appropriate for imperative navigation such as redirects,
post-submit transitions, and back/forward actions.

## Search parameters

Dashboard route builders return a platform-neutral `TRouteTarget`. The adapter
resolves it with the platform's root segment and the current search state when
`preserveSearch` is requested:

```text
Core route target
  -> Next adapter: /community/dashboard/...
  -> Dash adapter: /community/dash/...
```

This keeps the two route trees parallel without making Core know which app is
currently rendering it.

## Adding a new platform

When adding another host or router:

1. Implement the `TPlatformLinkProps` contract.
2. Resolve `route` using that platform's root segment and search rules.
3. Render the router's native link component.
4. Register the implementation in that platform's `PlatformProvider`.
5. Keep Core components on `PlatformLink`; do not add router-specific imports.

The implementation should continue to render a semantic anchor for internal
and external navigation. Only controls that mutate UI state should render as
buttons.
