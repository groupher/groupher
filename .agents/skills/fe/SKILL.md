---
name: fe
description: Apply Groupher frontend conventions when building or reviewing components, Salon files, Tailwind styles, constants, types, routing and queries across Core and its product hosts.
---

# Groupher Frontend

Apply repository conventions before generic React patterns. Unless the user says `go` or otherwise authorizes changes, keep the work read-only and discuss the design, impact, and tradeoffs first.

## Locate the change

Start at the affected host route. Use the [directory guide](../../../docs/rules/fe.md#目录归属) to locate the owning UI, query, authored operation or server handler. For a Core change, identify the consuming hosts and exercise the shared behavior in the relevant host. For a Widget change, check the embedded runtime.

## Review the component

Review the changed component together with its Salon and immediate consumers. Apply the [component conventions](../../../docs/rules/fe.md#组件拆分), [style rules](../../../docs/rules/fe.md#class-书写), and [constant and spec ownership](../../../docs/rules/fe.md#constant-与-spec). Check accessible names, keyboard operation, visible focus and reduced motion when changing interactions.

## Routing and Semantics

- Ordinary navigation is a link. Use a button for state changes, mutation controls, or flows that must intercept navigation.
- Keep route params and search values typed and owned by the route. Use the current host adapter/route-scope boundary for shared Core navigation rather than importing router internals into Core.
- Do not edit generated route trees manually or make business code depend on their internal node layout.
- Use [TanStack Query](../../../docs/architecture/urql-to-tanstack-query.md) for GraphQL server state and the appropriate store or route boundary for local state; do not add another state layer without a demonstrated need.

## Runtime and Bundle Boundaries

- Keep heavy editor, Widget, and product-only runtime code behind the route or interaction that needs it.
- The default host must not load Widget loader/runtime/CSS. Widget owns its Lit/Shadow DOM runtime and dedicated CSS build; it may consume only narrow shared contracts or utilities from Core.
- Rich Editor runtime and CSS remain lazy at their editor boundary, including inside Widget.
- Check server/client boundaries, initial render stability, and bundle impact when changing providers, time-dependent UI, dynamic imports, or shared exports.

## Validation

- Use the [dev-hub skill](../dev-hub/SKILL.md) when local services or browser acceptance are needed.
- Run the owning workspace's type-check and focused unit tests first; add broader Core checks when a shared contract changed.
- Regenerate and type-check route output when route definitions changed, but do not stage unrelated generated churn.
- Use browser validation for meaningful interaction, routing, responsive, or visual behavior. Test data-dependent flows in the `/home/xx` community.
- Put any Playwright screenshots under `.playwright/`, never at the repository root.
- Report existing unrelated failures separately from failures introduced by the change.
