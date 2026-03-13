# Preview Framework

This directory contains the shared client-side preview framework used by thread
routes that open article detail in a Drawer while keeping intercepted-route
navigation semantics.

## Responsibilities

- `helper.ts`
  - Stores browser-memory preview snapshots keyed by `community:id`
  - Tracks whether the current key is still waiting for the real route payload
  - Exposes a small external-store bridge for client hosts
- `PreviewCacheSync.tsx`
  - Writes the resolved route payload back into browser memory
  - Marks the key as `ready` so the host can stop showing cached content
- `PreviewHost.tsx`
  - Owns the single Drawer instance for a thread layout
  - Chooses between `cached-lite`, `cached-full`, and `real` content
  - Keeps cache-first behavior out of `loading.tsx`
- `spec.d.ts`
  - Defines the shared preview cache entry contract

## Design Rules

- The intercepted route remains the source of truth
- Cache stores provider init snapshots, not mounted React trees
- `loading.tsx` stays a plain route fallback; it does not read cache state
- Drawer only resets the scroll container; content-level top alignment happens in
  the preview runtime (`ArticleViewer` for post)
- Thread-specific UI stays outside this folder

## Thread Adapter Pattern

Each thread should provide a thin client adapter around the shared host.

For `post`, that adapter is `post/PostPreviewAdapter.tsx` and it supplies:

- `resolvePreviewKey(community, id)`
- `renderCachedPreview(entry, mode)`

That keeps the shared host generic while allowing each thread to decide:

- how preview keys are derived
- how cache entries are rendered in `lite` and `full` mode
- which runtime tree is the thread's single UI source of truth

## Adding a New Thread

1. Keep the thread's route/layout structure unchanged
2. Create a thin `<ThreadName>PreviewAdapter.tsx>` client wrapper next to the
   thread route
3. Reuse `PreviewHost` from this directory
4. Provide thread-specific `resolvePreviewKey` and `renderCachedPreview`
5. Build the thread's cache entry from its own route data builder
6. Reuse `PreviewCacheSync` to mark the route payload as ready
7. Verify:
   - first open
   - cached reopen
   - back/forward
   - top alignment
   - loading fallback

## Current Scope

The shared framework is currently validated only by `post`. Other threads such
as `changelog`, `kanban`, and `doc` should be migrated one at a time after
their preview/detail semantics are confirmed.
