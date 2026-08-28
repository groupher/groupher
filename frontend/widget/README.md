# Groupher Widget

`frontend/widget` builds the framework-neutral embeddable Groupher Widget. A
small classic-script loader boots a hashed ES-module runtime, registers the
`<groupher-widget>` custom element, and renders an isolated Lit UI inside Shadow
DOM.

## Position in the system

```text
External host page -> stable /widget/v1.js loader
                              |
                              v
                     hashed Widget runtime
                              |
                              v
                 <groupher-widget> ShadowRoot
                              |
                              +-> Widget API/DTO boundary
```

Widget owns its loader/runtime protocol, custom element, Shadow DOM lifecycle,
styles, compact content views, and installation demo. It must not import Main or
Dashboard route trees, stores, page layouts, or host CSS. Production API and
persistent feedback work remain separate milestones where the design says so.

## Local development and validation

```sh
pnpm --filter @groupher/widget run dev
pnpm --filter @groupher/widget run test
pnpm --filter @groupher/widget run type-check
pnpm --filter @groupher/widget run format:check
pnpm --filter @groupher/widget run verify:build
```

Runtime CSS is loaded only with the Widget route/runtime and is injected into
the ShadowRoot. The stable loader must remain classic-script compatible.

## Related documentation

- [`docs/embed-widget/v1.md`](../../docs/embed-widget/v1.md)
- [`docs/sub-apps/health.md`](../../docs/sub-apps/health.md)
