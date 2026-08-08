# Shared Frontend Alias Rename

> Status: implemented.
>
> Scope: rename the shared `frontend/core/widgets` namespace to `ui`, move
> application shell components to `shell`, move rendering components to
> `render`, and update the corresponding TypeScript aliases and imports.

## Motivation

The current `~/widgets` alias points to the shared frontend component
collection under `frontend/core/widgets`. The collection contains mostly UI
and interaction components, but its name now conflicts with the product
concept **Groupher Widget**.

The same word currently describes two different things:

```text
~/widgets/Tooltip
  shared frontend UI component

frontend/widget
@groupher/widget
<groupher-widget>
  external product runtime
```

The rename makes the distinction explicit:

```text
~/ui/Tooltip
  shared UI

frontend/widget
  Groupher Widget product
```

The current snapshot contains approximately 423 files under
`frontend/core/widgets` and approximately 508 frontend files importing
`~/widgets`. These counts are planning estimates; the migration must use the
actual import graph at implementation time.

## Target Namespaces

```text
frontend/core/ui/
~/ui
  shared UI and interaction components

frontend/core/shell/
~/shell
  application root, theme bootstrap, and SSR shell components

frontend/core/render/
~/render
  content, background, and visual rendering components
```

The namespaces are all part of `@groupher/frontend-core`. They are import
organization boundaries, not separate packages.

## Ownership Rules

### `ui`

`ui` owns reusable presentation and interaction components that can be
consumed by Main, Dashboard, Dash, Landing, or another frontend surface.

Examples:

```text
Buttons
Cards
CheckLabel
Checker
ColorSelector
ColorsPresetBall
CustomScroller
Drawer
Facepile
IconHub
Img
ImgFallback
Input
Loading
Modal
NoticeBar
Pagi
Portal
RangeInput
Select
Switcher
Toaster
Tooltip
UserList
WordsCounter
```

`ui` does not need to be a strict design-system package in this migration.
Components with small Groupher-specific assumptions may remain here when they
are still shared presentation or interaction primitives.

### `shell`

`shell` owns components responsible for the application root, global layout,
critical theme initialization, and server-inserted styles.

Initial candidates:

```text
GlobalLayout
RootLayoutShell
ThemeFirstPaintScript
ServerInsertedStyle
ResolvedThemeStyle
CommunityThemePresetStyle
```

These components are not ordinary controls. Their placement should communicate
that they participate in application startup and document-level rendering.

### `render`

`render` owns components that turn content or rendering specifications into
visual output.

Initial candidates:

```text
ArtimentBody
Markdown
BgRenderer
WallpaperRenderer
MarkerRender
```

The following remain outside `render`:

```text
MarkdownEditor
  editor interaction, not read-only rendering

MarkerPicker
  user interaction, keep under ui
```

The split is based on responsibility, not merely on component names.

## Explicitly Out Of Scope

This migration must not rename or move the following:

```text
frontend/landing/app/widgets
  Landing page-local composition directory

/dashboard/widgets
  Groupher Widget product management route

frontend/widget
@groupher/widget
<groupher-widget>
  Groupher Widget product runtime
```

`frontend/landing/app/widgets` is an application-local directory and is
unrelated to the shared Core alias. `/dashboard/widgets` is a product route
and must continue to use the plural `Widgets` label.

This migration also does not split every domain-specific shared component into
new packages or introduce a design-system package.

## Alias Changes

Current aliases:

```json
{
  "~/widgets": ["./widgets"],
  "~/widgets/*": ["./widgets/*"]
}
```

Target aliases:

```json
{
  "~/ui": ["./ui"],
  "~/ui/*": ["./ui/*"],
  "~/shell": ["./shell"],
  "~/shell/*": ["./shell/*"],
  "~/render": ["./render"],
  "~/render/*": ["./render/*"]
}
```

The exact relative path is adjusted per consumer configuration. At minimum,
review:

```text
frontend/core/tsconfig.json
frontend/core/tsconfig.app.json
frontend/core/jsconfig.json
frontend/dash/tsconfig.json
```

The application configurations that consume Core aliases must also resolve the
new paths through their existing Core/Dash configuration mechanism.

The old `~/widgets` alias should be removed after all imports have migrated.
Do not keep a permanent compatibility alias. A monorepo-wide migration can
update all consumers in one change, and retaining the old alias would allow
new ambiguous imports to reappear.

## Migration Shape

The intended final structure is:

```text
frontend/core/
  ui/
  shell/
  render/
  unit/
```

The migration should preserve component internals and behavior. It is a path
and ownership refactor, not a visual or runtime redesign.

Recommended sequence:

```text
1. inventory current imports and path aliases
2. create ui, shell, and render directories
3. move the agreed component directories
4. update internal and external imports
5. update TypeScript and JavaScript path aliases
6. remove the old widgets alias
7. search for stale widgets imports and paths
8. run focused validation
```

Do not use a broad text replacement without checking the following cases:

- imports inside a moved directory;
- type-only imports;
- dynamic imports;
- test and story/demo files;
- comments that document a real path;
- aliases in Dash and application-specific configs;
- files under `frontend/landing/app/widgets` that must remain unchanged;
- `/dashboard/widgets` route and product naming.

## Verification

Required checks for the rename:

```text
rg -n "from ['\"]~/widgets|import\\(['\"]~/widgets" frontend
rg -n "frontend/core/widgets|~/widgets" frontend docs
rg -n "frontend/landing/app/widgets|/dashboard/widgets" frontend

yarn workspace @groupher/frontend-core type-check
frontend/core focused tests
frontend/dash type-check
frontend/dashboard type-check
git diff --check
```

The first search should return no active `~/widgets` imports after migration.
References to `frontend/landing/app/widgets` and `/dashboard/widgets` are
expected and should remain intentional.

Validation must prove:

- Core resolves `~/ui`, `~/shell`, and `~/render`;
- Dash resolves the shared aliases;
- Main and Dashboard retain their existing root and loading shells;
- shared components retain their exports and behavior;
- no Groupher Widget product path was renamed accidentally;
- no stale `frontend/core/widgets` path remains.

## Commit Boundary

This should be a standalone frontend refactor commit. It must not be combined
with Groupher Widget feature implementation, backend API work, or unrelated UI
changes.

Suggested commit title:

```text
refactor(fe): rename shared widgets aliases to ui
```
