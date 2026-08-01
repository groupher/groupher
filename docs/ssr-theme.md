# SSR Theme First Paint

> Status: design note and implementation guide. Wallpaper/renderSpec is out of
> scope here and should be handled separately.

## Problem

Groupher uses CSS variables for theme colors, but dark mode can still flash during
SSR hydration.

The important finding from debugging is:

```text
prePaintThemeDetectScript sets html[data-theme='dark']
first visible frame is dark
Next/React hydration may briefly reconcile <html> back to the SSR attribute shape
html[data-theme] becomes missing/light for a short window
ThemeMonitor mounts and writes dark again
```

That produces the visible sequence:

```text
dark -> light/null -> dark
```

This is not the same as "SSR has no dark CSS". The dark CSS is present. The
problem is that the root selector used by that CSS can become unstable during the
hydration window.

## Why Early Inline Script Usually Works

Static documentation sites such as Rspress and VitePress avoid theme flicker by
running a small inline script very early in `<head>`:

```html
<script>
  // localStorage / matchMedia -> html.classList.add('dark')
</script>
```

A normal inline classic script blocks parsing while it executes. If it is early
enough, the first style calculation and first paint already see `html.dark` or
`html[data-theme='dark']`.

So the browser timing is:

```text
parse <head>
run inline theme script
set root theme selector
calculate styles
first paint
```

Groupher follows the same first-paint direction, but Next hydration adds another
phase after first paint. During that phase, React can reconcile the root `<html>`
attributes and briefly remove the script-written `data-theme`.

## Constraints

- Do not use cookies as the source of truth for theme.
- Keep theme values CSS-driven.
- Do not initialize ThemeStore from `document.documentElement.dataset.theme`
  during the client first render. That makes the client tree differ from the
  server tree and can cause hydration mismatch.
- Do not fix this by making individual widgets own hydration-window hacks.
- Do not treat this as a Dashboard-only issue. Main, Dashboard, Landing, and
  future sub-apps share the same root theme problem.

## Target Model

Use one app-level first-paint mechanism:

```text
color.css
  default light/dark CSS variables

optional community theme preset CSS
  current community effective ThemePreset tokens, if the payload has them

prePaintThemeDetectScript()
  runs before first paint
  detects theme from localStorage or matchMedia
  applies html[data-theme] and color-scheme

injectThemeFirstPaintVars()
  snapshots computed theme CSS variables for the current theme only
  writes them into a temporary head style tag

ThemeFirstPaintScript()
  is server-inserted before <body>
  installs a root fallback snapshot for default color.css vars

CommunityThemePresetStyle()
  is server-inserted by community routes with complete ThemePreset tokens
  emits community preset CSS and then immediately re-runs the snapshot script

ThemeMonitor
  applies runtime theme state
  removes the temporary first-paint style after runtime state has taken over
```

The goal is not to create a second theme system. The temporary style only keeps
computed theme variables stable while React may be reconciling `<html>`.

## Naming

Use generic names. Avoid `Dsb`, `Dashboard`, or `bootstrap` in this layer.

Recommended names:

```ts
prePaintThemeDetectScript()
injectThemeFirstPaintVars()
removeThemeFirstPaintVars()
THEME_FIRST_PAINT_STYLE_ID
THEME_FIRST_PAINT_VAR_NAMES
```

The style id must be const-ized:

```ts
export const THEME_FIRST_PAINT_STYLE_ID = 'groupher-theme-first-paint'
```

Do not inline this id at call sites.

## Variable Source Of Truth

`frontend/core/tailwind/tokens/color.css` and
`frontend/core/tailwind/tokens/shadow.css` are the source of truth for default
first-paint CSS variable names and values.

`color.css` must stay in the synchronous global CSS import chain. Today that
chain is:

```text
frontend/core/tailwind/global.css
  -> frontend/core/tailwind/tokens/index.css
  -> frontend/core/tailwind/tokens/color.css
  -> frontend/core/tailwind/tokens/shadow.css
```

Every sub-app root should import `global.css` as global CSS, not lazy-load
`color.css`, inject it through `next/head`, or add it from client-side CSS-in-JS
after hydration. `injectThemeFirstPaintVars()` depends on the default theme vars
already being in the cascade before protected body content is parsed.

Do not maintain a hand-written variable allowlist such as:

```ts
const VARS = ['--color-title', '--color-card']
```

That becomes a second source of truth and will drift from the token CSS files.

Instead, generate the first-paint variable-name list from `color.css` and
`shadow.css` at build or dev time:

```text
frontend/core/tailwind/tokens/color.css
frontend/core/tailwind/tokens/shadow.css
  -> scripts/generate-theme-first-paint-vars
  -> frontend/core/constant/theme-first-paint.generated.ts
```

Generated output shape:

```ts
export const THEME_FIRST_PAINT_VAR_NAMES = [
  '--color-title',
  '--color-digest',
  '--color-card',
  '--color-divider',
  '--color-pageBg',
] as const
```

The generator should parse source CSS with PostCSS or a structured CSS parser.
Do not parse compiled runtime CSS in the browser.

The first-paint script then snapshots final computed values:

```js
var computed = getComputedStyle(document.documentElement)
var css = ':root{'

for (var i = 0; i < THEME_FIRST_PAINT_VAR_NAMES.length; i += 1) {
  var name = THEME_FIRST_PAINT_VAR_NAMES[i]
  var value = computed.getPropertyValue(name).trim()
  if (value) css += name + ':' + value + ';'
}

css += '}'
```

This means:

- `color.css` owns default token values.
- community theme preset CSS can override those vars before the snapshot.
- `injectThemeFirstPaintVars()` does not know or duplicate token values.
- maintaining first-paint coverage means keeping the generated file up to date.

## Community ThemePreset Tokens

Community routes may receive effective ThemePreset tokens from SSR community
data. These tokens are the current community's final theme result, not the raw
Custom overwrite itself. They may come from a built-in preset, a Custom preset,
or Custom overwrite merged on the backend.

They are still exposed through global CSS var names. "Community" describes
where the values come from, not where the variables may be used.

In the current app, this CSS is generated from:

```ts
serializeCommunityThemePresetCss(dashboard.themeTokens)
```

Current callers:

- `frontend/main/src/app/[community]/layout.tsx`
- `frontend/dashboard/src/app/[community]/dashboard/layout.tsx`

The route gets `dashboard.themeTokens` from the SSR dashboard/community payload
and converts the current community's effective ThemePreset tokens into
long-lived CSS custom properties. This is not the source `color.css` token table;
it is the per-community theme layer on top of `color.css`.

Example resolved shape:

```ts
type TResolvedThemePreset = {
  shared: {
    glowFixed: boolean
  }
  light: {
    pageBg: string
    primaryColor: string
    accentColor: string
    textTitle: string
    textDigest: string
    cardColor: string
    dividerColor: string
    gaussBlur: number
    glowType: string
    glowOpacity: number
  }
  dark: {
    pageBg: string
    primaryColor: string
    accentColor: string
    textTitle: string
    textDigest: string
    cardColor: string
    dividerColor: string
    gaussBlur: number
    glowType: string
    glowOpacity: number
  }
}
```

The long-lived community preset CSS should still emit both theme branches:

```css
:root {
  --color-title: light-value;
}

[data-theme='dark'] {
  --color-title: dark-value;
}
```

The emitted vars are the subset currently represented by resolved preset tokens:

```text
--color-primary-custom
--color-accent-custom
--color-page-custom
--color-page-custom-bg
--color-title
--color-digest
--color-card
--color-divider
```

`--color-page-custom-bg` already includes the resolved `gaussBlur` effect for
the page background. Other first-paint-visible values such as glow/filter should
be moved to CSS vars before this mechanism can protect them.

`injectThemeFirstPaintVars()` does not need to know where a variable came from.
It reads the computed value after `prePaintThemeDetectScript()` has selected the
real theme. Therefore it outputs only the current theme's concrete values.

## Script Injection

Both first-paint scripts must be inline classic scripts. Do not make them
`type="module"`, `defer`, `async`, or client-bundle imports.

`prePaintThemeDetectScript()` should be emitted in `<head>` as early as possible:

```html
<script>
  // detect localStorage/system theme
  // set html[data-theme]
  // set document.documentElement.style.colorScheme
</script>
```

`injectThemeFirstPaintVars()` is also an inline head script, but it needs
`THEME_FIRST_PAINT_VAR_NAMES` serialized into the script text at build/server
render time. It cannot import the generated TS file from a browser bundle after
hydration:

```html
<script>
  var names = ['--color-title', '--color-card']
  var computed = getComputedStyle(document.documentElement)
  // write <style id="groupher-theme-first-paint">...</style>
</script>
```

The intended implementation path is:

```text
theme-first-paint.generated.ts
  exports THEME_FIRST_PAINT_VAR_NAMES

injectThemeFirstPaintVars()
  imports THEME_FIRST_PAINT_VAR_NAMES in the SSR-safe helper module
  embeds JSON.stringify(THEME_FIRST_PAINT_VAR_NAMES) into returned script text
```

Do not read token CSS from the request path, and do not rely on a client bundle
import to provide the variable list. The generated TS file is the server-render
input; `check:theme-first-paint-vars` is what keeps it in sync with `color.css`
and `shadow.css`.

`injectThemeFirstPaintVars()` should not be emitted as a raw route body script. A
raw body script becomes part of the React hydration tree and can cause warnings
or mismatches. Emit it through `useServerInsertedHTML`, so the real HTML lands in
`<head>` before `<body>`.

Community layouts should emit long-lived community preset CSS:

```tsx
<CommunityThemePresetStyle cssText={serializeCommunityThemePresetCss(dashboard.themeTokens)} />
```

`CommunityThemePresetStyle` intentionally emits both pieces in one server-inserted
fragment:

```text
<style>community preset CSS</style>
<script>injectThemeFirstPaintVars()</script>
```

This is the CSS-in-JS-style helper used here. It is not runtime client CSS-in-JS.
It uses Next `useServerInsertedHTML()` to place HTML in `<head>` during server
rendering:

```text
React component tree

RootLayoutShell
  body
    children
      [community layout]
        CommunityThemePresetStyle
          useServerInsertedHTML:
            1. <style>community preset CSS</style>
            2. <script>community preset snapshot</script>

    ThemeFirstPaintScript
      useServerInsertedHTML:
        1. <script>fallback snapshot</script>

Rendered HTML

head
  prePaintThemeDetectScript
  ThemeFirstPaintScript output
  CommunityThemePresetStyle output
body
  React content
```

The important detail is that the helper's returned `<style>` and `<script>` are
not left at the JSX call site in `<body>`. Next inserts them into `<head>`.

This ordering was validated in the rendered dashboard HTML:

```text
prePaintThemeDetectScript()
ThemeFirstPaintScript fallback snapshot
CommunityThemePresetStyle community preset CSS
CommunityThemePresetStyle community preset snapshot
<body>
ThemePresetScope runtime style
```

The first snapshot protects pages that do not have community preset CSS. The
second snapshot overwrites the same temporary style after community preset CSS is
in the cascade, still before body content is parsed. Because both scripts run
while the browser is parsing `<head>`, there is no visible intermediate frame
between the fallback snapshot and the community preset snapshot.

The snapshot script itself stays simple:

- it reads computed custom properties once;
- if a fallback snapshot already exists, it disables that temporary style while
  reading so the community preset snapshot sees the underlying cascade;
- it writes them to `style#groupher-theme-first-paint`;
- it updates the existing style if a previous fallback snapshot already created
  it;
- it writes `!important` temporary custom properties so later SSR/runtime styles
  cannot expose a light-frame fallback while React reconciles `html[data-theme]`.

## Color Scheme

Root theme selection should also update browser color-scheme:

```js
document.documentElement.setAttribute('data-theme', theme)
document.documentElement.style.colorScheme = theme
```

This does not replace app CSS variables. It only tells the browser how to render
native surfaces such as scrollbars, form controls, and built-in backgrounds.

`<meta name="color-scheme" content="light dark">` can declare both supported
schemes, but the pre-paint script should still set the current `colorScheme`
when the user has a resolved light/dark preference.

## Script Order

There are two timing requirements:

```text
prePaintThemeDetectScript()
  should run as early as possible
  does not need theme CSS to be loaded
  decides theme and writes html[data-theme] / color-scheme

injectThemeFirstPaintVars()
  is installed after prePaintThemeDetectScript()
  snapshots once from the currently available cascade
  reads computed CSS variables for the already-selected theme
```

The practical order is:

```text
1. prePaintThemeDetectScript() sets html[data-theme] before first paint
2. optional community preset CSS is emitted
3. ThemeFirstPaintScript snapshots the available color/shadow/community vars
4. React/Next hydration starts
5. ThemeFirstPaintScript or ThemeMonitor cleans temporary vars
```

The key requirement is that the temporary first-paint vars are installed before
hydration can produce a visible light-frame fallback. Community routes with
complete ThemePreset CSS must emit the preset CSS before the single
`ThemeFirstPaintScript` snapshot runs.

Full timing flow:

```text
Server render
-------------
RootLayoutShell
  emits early head script:
    prePaintThemeDetectScript()

CommunityThemePresetStyle, only when cssText exists
  server-inserts:
    <style>community theme preset CSS</style>

ThemeFirstPaintScript
  server-inserts:
    <script>theme snapshot</script>


Browser parses HTML
-------------------
head script: prePaintThemeDetectScript()
  localStorage / matchMedia -> html[data-theme]
  documentElement.style.colorScheme = theme

head style: community theme preset CSS
  add current community preset values to the cascade

head script: theme snapshot
  read computed vars from color.css + shadow.css + community preset CSS
  write style#groupher-theme-first-paint

body content parses
  first visible frame already has protected theme vars


Hydration window
----------------
Next/React may temporarily reconcile html[data-theme]
style#groupher-theme-first-paint keeps CSS vars stable

ThemeMonitor
  applies runtime theme state
  removes style#groupher-theme-first-paint on handoff
```

## Cleanup

First Paint Vars are temporary. Runtime theme state must take ownership after
hydration.

Cleanup should be centralized:

```ts
export const removeThemeFirstPaintVars = () => {
  document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
}
```

`ThemeMonitor` should:

```text
1. read persisted/system mode
2. apply runtime theme through changeMode(mode, { keepFirstPaintVars: true })
3. wait until ThemeStore has rerendered to the resolved runtime theme
4. remove first-paint style on a next-paint handoff
```

Prefer deleting on the next `requestAnimationFrame`:

```ts
changeMode(mode, { keepFirstPaintVars: true })
scheduleRemoveThemeFirstPaintVars()
```

This avoids a same-task cascade gap where temporary vars are removed before
React/Valtio consumers have rerendered from the SSR-safe light store state to
the resolved runtime dark state.

Runtime theme-changing actions should apply `data-theme` / `color-scheme` first
and then defensively remove first-paint vars, so a failed or delayed
`ThemeMonitor` cannot pin the initial theme forever. Only the initial
`ThemeMonitor` handoff should pass `keepFirstPaintVars: true`.

## Generated File Integration

The generated first-paint variable list should be committed, but it must not be
allowed to drift from `color.css` or `shadow.css`.

Use two scripts:

```text
yarn gen:theme-first-paint-vars
yarn check:theme-first-paint-vars
```

Expected behavior:

- `gen:theme-first-paint-vars` parses
  `frontend/core/tailwind/tokens/color.css` and
  `frontend/core/tailwind/tokens/shadow.css`, then writes
  `frontend/core/constant/theme-first-paint.generated.ts`.
- `check:theme-first-paint-vars` regenerates in memory or in a temp file and
  fails when the checked-in generated file is stale.
- The implementation lives in `scripts/generate-theme-first-paint-vars.mjs`.
- CI should run `yarn check:theme-first-paint-vars` before this is considered
  fully enforced.

If a sub-app uses runtime CSS-in-JS that injects theme variables only after its JS
bundle loads, those values cannot be protected by first-paint vars. First-paint
visible theme CSS must be emitted as static CSS or a server-inserted `<style>`
before the relevant snapshot script runs.

## What This Covers

This mechanism covers values that are expressed as CSS variables:

- foreground colors such as title and digest
- card, divider, border, fill, and surface colors
- page background variables, including `--color-page-custom-bg`, the final page
  background after `gaussBlur` has been applied
- community ThemePreset color overrides
- any future theme-dependent visual value that is moved into CSS vars

It does not automatically cover:

- React markup branches based on `useTheme()`
- inline styles computed from ThemeStore during the first render
- `dark:*` utility classes that are not represented by CSS vars
- wallpaper/renderSpec and image-resource selection
- glow/filter values while they are still computed through React hooks instead
  of CSS vars

For those areas, the rule is:

```text
first-paint visible theme-dependent values should be CSS-var consumers;
React store should not decide SSR/client first-render structure or critical
inline styles.
```

## Remaining Work

1. Wire `yarn check:theme-first-paint-vars` into CI.
2. Move first-paint-visible glow/filter values to CSS vars before expecting this
   mechanism to cover them.
3. Audit `dark:*` usage:
   - colors should move to semantic CSS vars;
   - visual corrections such as brightness, saturation, and opacity should become
     semantic filter/opacity vars if they are visible during first paint.
4. Handle wallpaper/renderSpec separately.

## Validation

Use browser timeline sampling, not only static tests.

Track at least:

```js
document.documentElement.getAttribute('data-theme')
getComputedStyle(document.documentElement).getPropertyValue('--color-title')
getComputedStyle(document.documentElement).getPropertyValue('--color-pageBg')
getComputedStyle(document.querySelector('main')?.firstElementChild).getPropertyValue(
  'background-color',
)
getComputedStyle(document.documentElement).getPropertyValue('color-scheme')
```

Expected result:

```text
data-theme may briefly become missing/light during hydration
critical computed vars remain on the first-paint theme value
ThemeMonitor restores runtime data-theme
first-paint style is removed
no hydration mismatch overlay
```
