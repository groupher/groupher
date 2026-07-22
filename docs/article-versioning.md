# Article Versioning Architecture

> Status: accepted for implementation. The project is not live yet, so the
> implementation may use a direct one-time data migration where needed. Runtime
> compatibility branches, legacy aliases, dual-read paths, and dual-write paths
> are explicitly forbidden.

## 1. Goals

Provide one shared foundation for every Article thread:

- stable logical identity;
- draft and public content;
- preview branches;
- immutable snapshots and revision history;
- diff and restore;
- Article-level TimeMachine;
- product extensions such as the Docs Tree and whole-site Docs releases.

The foundation must not merge the product domains. `Post`, `Blog`,
`Changelog`, and `Doc` keep their own tables, APIs, permissions, fields, and
publish side effects.

## 2. Non-goals

- Do not introduce an `ArticleWorkspace` table.
- Do not merge all Article products into one content table.
- Do not make Tree, Release, or Docs site state mandatory for other threads.
- Do not introduce event sourcing or persist pairwise Diff results.
- Do not expose internal database ids through the public GraphQL contract.
- Do not keep runtime compatibility logic. Existing local data may be migrated
  once into the target model.

## 3. Terminology

| Term                | Meaning                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------- |
| physical `id`       | Internal row primary key. Draft and public rows have different ids.                       |
| `article_hash_id`   | Stable UUID of one logical Article across branches, stages, and revisions.                |
| Snapshot `hash_id`  | Public UUID used to fetch, fork, and restore a Revision without exposing its physical id. |
| `branch_id`         | The branch containing the current Article row or Snapshot.                                |
| `stage`             | Current row role: `draft` or `public`.                                                    |
| Snapshot            | Immutable stored copy of the complete versioned Article state.                            |
| Revision            | A Snapshot shown in an ordered history timeline. It is not a separate table.              |
| Diff                | A transient comparison between two current states or Snapshots.                           |
| TimeMachine         | Snapshot history + Diff + Restore + Branch fork. It is not a separate storage model.      |
| `DocPublishRelease` | Docs-only aggregate that binds Article Snapshots to a Tree Snapshot.                      |

`v1`, `v2`, and similar labels are not Article fields. The only numeric Article
history field is `ArticleSnapshot.revision_number`. Docs release numbering is a
separate Docs-only concept.

## 4. Core invariants

1. `article_hash_id` is a random, stable UUID. It is never derived from content.
2. `body_hash` identifies one canonical BodyBag; `version_hash` identifies the
   complete versioned Article state and changes when any versioned field,
   relation, or BodyBag content changes.
3. Public traffic reads only `main` branch + `public` stage.
4. A preview branch contains draft state only. It never owns a public Article row.
5. A public row never moves back to draft. Editing public content creates a draft copy.
6. After the first publish, the main public physical row is the permanent runtime anchor.
7. Publish copies only versioned fields; it preserves public runtime fields and relations.
8. Article Snapshots are append-only. Restore never deletes later history.
9. Core lifecycle operations always use the full coordinate:

   ```text
   thread + article_hash_id + branch_id + stage
   ```

10. Branch defaults are resolved at the product boundary. Core Draft, Publish,
    Snapshot, Diff, and Restore functions receive an explicit branch.
11. Migration is one-way: after existing data is moved to the target fields and
    tables, application code reads and writes only the new model.
12. Except for test modules, every new or changed module has a meaningful
    `@moduledoc`; public functions have `@doc`; lifecycle modules include the
    necessary ASCII flow.
13. Enums and semantic constants are centralized and connected across the
    database, Ecto, `CMS.Const`, GraphQL, and frontend constants/types.
14. Shared behavior is covered once at its owning module and again through
    separate Post, Blog, Changelog, and Doc integration tests. Equal thread
    behavior is not collapsed into one parameterized product test.
15. Every mutation for one logical Article uses the same branch-independent
    lifecycle lock: `community + thread + article_hash_id`. Cross-branch
    Promote/Fork must serialize with Draft autosave, Snapshot, and Publish.

## 5. Mental model

```text
                          official public traffic
                                    |
                                    v
                              main/public
                               ^         |
                      publish |         | start editing
                               |         v
                              main/draft

preview-a/draft -------- promote -------> main/draft

Snapshot ---------------- restore ------> target branch draft
```

Arrows mean copying versioned content. They do not mean moving the same physical
row between branches or repeatedly changing one row between draft and public.

This mental model also appears in the shared Draft/Preview lifecycle module
`@moduledoc` diagrams.

## 6. ArticleBranch

`ArticleBranch` is shared infrastructure. It scopes Article draft state without
owning any product-specific content.

```text
ArticleBranch
├─ id
├─ community_id
├─ thread
├─ slug
├─ title
├─ type              main | preview
├─ status            active | archived
├─ source_branch_id  optional
├─ created_by_id
├─ inserted_at
└─ updated_at
```

The field is named `type`, never `kind`.

Required constraints:

```text
UNIQUE (community_id, thread, slug)
UNIQUE (community_id, thread) WHERE type = 'main'
```

One branch belongs to a Community and one Article thread. A branch may contain
one or many changed Articles. Branch creation is lazy: it does not copy every
Article in the Community.

### 6.1 Enum and constant chain

Branch type must be defined consistently across the full stack:

```text
Database check constraint
        |
        v
Ecto.Enum
        |
        v
CMS.Const.article_branch_type(...)
        |
        v
GraphQL ArticleBranchType
        |
        v
frontend ARTICLE_BRANCH_TYPE
```

No business module should contain scattered raw `"main"` or `"preview"`
strings.

Suggested values:

```text
Backend atoms:   :main | :preview
Database values: main  | preview
GraphQL values:  MAIN  | PREVIEW
Frontend values: ARTICLE_BRANCH_TYPE.MAIN | ARTICLE_BRANCH_TYPE.PREVIEW
```

The same full-chain rule applies to `stage`, branch `status`, and Snapshot
actions.

## 7. Product Article rows

Every product table participating in the lifecycle adds the same routing fields:

```text
article_hash_id
branch_id
stage             draft | public
```

Example current state:

```text
Changelog(article_hash_id=A, branch=main,      stage=public)
Changelog(article_hash_id=A, branch=main,      stage=draft)
Changelog(article_hash_id=A, branch=preview-a, stage=draft)
```

There must never be:

```text
Changelog(article_hash_id=A, branch=preview-a, stage=public)
```

Row uniqueness:

```text
UNIQUE (branch_id, article_hash_id, stage)
```

The Branch service and product changesets must also validate that the Branch
belongs to the same Community and thread as the Article model.

## 8. Field ownership

Article fields are divided into four responsibilities.

### 8.1 Routing fields

```text
physical id
article_hash_id
branch_id
stage
```

These identify a row. They are not copied as editable content and do not
participate in content Diff.

### 8.2 Versioned fields

These fields move through Draft, Publish, Snapshot, Diff, Restore, and Promote.

Common examples:

```text
title
digest
document JSON
link address
cover
tags
```

Product examples:

```text
Doc:       subtitle, slug, template_key
Post:      category, copyright, other publishable configuration
Changelog: copyright, release metadata
Blog:      blog-specific publishable configuration
```

Each product model must explicitly declare its versioned fields. Publish must
never rely on copying an entire Ecto struct.

### 8.3 Derived fields

These are generated from versioned content:

```text
markdown
markdown_toc
html
xml
rss
plain_text
body_hash
document asset refs
```

Restore writes versioned source content and reruns the content pipeline. Derived
fields are regenerated rather than treated as independent user-owned state.

### 8.4 Runtime fields

These belong only to the official main/public runtime row:

```text
inner_id
views
comments
upvotes
collects
reactions
active_at
published counters
runtime moderation and notification state
```

Runtime fields are not copied to Draft or Preview, are not restored from an
Article Snapshot, and are preserved across republish.

### 8.5 Field flow matrix

| Operation                 | Routing fields                        | Versioned fields                     | Derived fields          | Runtime fields                  |
| ------------------------- | ------------------------------------- | ------------------------------------ | ----------------------- | ------------------------------- |
| Start editing main/public | Create main/draft coordinate          | Copy public to draft                 | Regenerate/copy cache   | Do not copy                     |
| Autosave draft            | Unchanged                             | Update draft                         | Regenerate              | Unchanged/unused                |
| First main publish        | Draft becomes first public            | Keep draft values                    | Regenerate              | Initialize public runtime       |
| Republish                 | Keep existing main/public coordinate  | Draft overwrites public              | Regenerate public cache | Preserve existing public values |
| Create preview            | Create preview/draft coordinate       | Copy selected source Snapshot/public | Regenerate              | Do not copy                     |
| Promote preview           | Create/update main/draft coordinate   | Preview draft overwrites main draft  | Regenerate              | Do not copy                     |
| Restore Snapshot          | Create/update target draft coordinate | Snapshot overwrites target draft     | Regenerate              | Do not copy                     |

Versioned relations such as tags and covers belong to their Draft row while
editing. Publish replaces the public versioned relations, while comments,
reactions, and other runtime relations stay attached to the main/public row.

## 9. Lifecycle flows

### 9.1 New Article

```text
Docs Dashboard                       direct-publish products

create/save                          create Post/Blog/Changelog
    |                                          |
    v                                          v
main/draft                         create main/draft inside transaction
    |                                          |
    | explicit publish                         | publish before commit
    v                                          v
main/public + Snapshot             main/public + Snapshot
```

The first publish may promote the first draft row because no runtime public row
exists yet. From that point forward, its physical id becomes the permanent
runtime anchor. The temporary Draft used by a direct-publish command is an
internal transaction step and is never observable after a successful commit.

Product APIs express intent with separate commands rather than accepting a raw
client-controlled `stage`:

```text
Docs:                  create/update Draft -> publishDocChanges
Post/Blog/Changelog:   createX (publish now) | createXDraft -> publishXDraft
```

Core does not infer these defaults from `thread`; product resolvers choose an
explicit shared command.

### 9.2 Edit and republish

```text
main/public
  |
  | copy versioned fields
  v
main/draft -- edit/autosave --> main/draft
  |
  | publish versioned fields
  v
main/public -- preserve runtime fields
  |
  +--> ArticleSnapshot(action=publish)
  +--> delete main/draft and its derived caches/relations
```

### 9.3 Preview branch

```text
main/public or selected Snapshot
  |
  | fork versioned fields
  v
preview/draft -- edit/autosave --> preview/draft
```

A Preview URL reads the explicit preview branch's draft. Preview does not create
a public row or trigger official publish side effects.

### 9.4 Promote preview to main

```text
preview/draft
  |
  | promote versioned fields
  v
main/draft
  |
  | explicit official publish
  v
main/public
```

Promote never changes the Preview row's `branch_id`. It copies versioned fields
into main/draft so official publish has exactly one path.

If main/public changed after the Preview fork point, Promote must report a
conflict by comparing the Preview base Snapshot with the current main/public
Snapshot. Automatic three-way merge is not required by this foundation.

### 9.5 Restore

```text
Snapshot r3
  |
  | restore versioned fields
  v
target branch draft
```

Restore never writes directly to main/public. An official change still requires
an explicit main publish.

## 10. ArticleSnapshot and Revision

`ArticleSnapshot` is the single immutable Article history table.

```text
ArticleSnapshot
├─ id
├─ hash_id
├─ community_id
├─ thread
├─ article_hash_id
├─ branch_id
├─ revision_number
├─ stage
├─ action
├─ parent_snapshot_id
├─ source_snapshot_id
├─ author_id
├─ title
├─ digest
├─ document_json
├─ body_bag
├─ data
├─ version_hash
├─ schema_version
├─ message
└─ inserted_at
```

Suggested Snapshot actions:

```text
checkpoint | publish | fork | promote | restore
```

`revision_number` increases within:

```text
thread + article_hash_id + branch_id
```

Draft and public Snapshots share one revision sequence. They do not maintain
separate draft/public numbering.

### 10.1 Snapshot data

There is no separate `payload` domain model. Snapshot storage is split into:

- explicit common columns such as title, digest, document JSON, restorable
  `body_bag`, and the complete-state `version_hash`;
- `data`, which stores product-specific versioned fields and restorable
  versioned relations.

Example Changelog Snapshot data:

```json
{
  "linkAddr": "https://example.com/release",
  "copyRight": "CC BY 4.0",
  "tags": ["release", "frontend"],
  "cover": {
    "light": "https://cdn.example/light.png",
    "dark": "https://cdn.example/dark.png"
  }
}
```

Snapshot `data` contains only versioned state. It never stores views, comments,
upvotes, or other runtime state.

`data` is optional in changeset input because an Article may have no
product-specific fields. Its persisted value is always a non-null map with
database and Ecto defaults of `%{}`.

### 10.2 Append-only history

Snapshots must not be updated or deleted by Restore.

```text
r1 -> r2 -> r3 -> r4
                  |
                  | restore r2
                  v
                  r5(action=restore, source_snapshot_id=r2)
```

`r3` and `r4` remain available. Restore creates new history instead of trimming
the old timeline.

## 11. Diff and TimeMachine

Diff is a pure, on-demand comparison. It owns no source-of-truth storage.

Supported comparisons:

```text
current draft      <-> latest main/public Snapshot
Snapshot A         <-> Snapshot B
preview draft      <-> fork source Snapshot
preview draft      <-> current main/public Snapshot
Doc release N      <-> Doc release N-1
```

Comparison order:

1. compare canonical `version_hash`;
2. compare ordinary versioned fields;
3. compare versioned relations;
4. run editor AST Diff only when document JSON changed.

Do not persist every pairwise Diff. With `R` revisions, stored Snapshot history
must remain `O(R)`, not `O(R^2)`.

Article TimeMachine is a use-case facade over:

```text
Snapshot.list/get
Diff.compare
Restore.apply
Branch.fork
```

It does not require an `article_time_machines` table.

Current Article rows are normalized into the same transient comparable state as
Snapshots. Reading a current Diff never inserts a checkpoint or changes history.

### 11.1 Frontend Revision Diff pipeline

The frontend has one editor Diff engine:

```text
Groupher                              @groupher/rich-editor
----------------------------------    --------------------------------
query and order Snapshots             define Plate Diff semantics
select comparison baselines           compute one complete Diff result
schedule Worker tasks                 derive stats and hasChanges
cache results                         produce diffValue
render Revision product UI            render diffValue
restore a Snapshot
```

Groupher must not implement LCS, Myers, LIS, block signatures, inline segments,
or a second Revision Diff renderer. There is no compatibility path for the old
Groupher-specific Diff model.

#### Button and history have different comparison semantics

The action button answers one product question:

```text
"How much has the current document changed since the latest publish?"

latest public Snapshot
          |
          | direct comparison
          v
     current body
          |
          +-- stats -------> button +n/-n
          `-- hasChanges --> button state
```

It never adds the stats of intermediate draft Snapshots. Summing adjacent
history entries does not produce a net Diff:

```text
published -> r1     +1/-0
r1        -> r2     +0/-1
--------------------------------
summed history      +1/-1    wrong answer for net change
direct comparison   +0/-0    current equals published
```

The Revision drawer answers a different question: what changed between two
adjacent checkpoints?

```text
current body  <-> latest draft Snapshot       "Now"
draft r3      <-> draft r2
draft r2      <-> draft r1
draft r1      <-> latest public Snapshot
public p3     <-> public p2
public p2     <-> public p1
```

These two semantics remain separate. The button uses one direct publish pair;
the drawer uses an ordered timeline of adjacent pairs.

#### History is lazy

Entering the editor does not calculate every historical pair:

```text
Editor mounted
      |
      +-- query Snapshot metadata
      |
      `-- debounce current body
             |
             v
         calculate only
         latest public -> current body

Drawer closed
      |
      `-- no historical Diff calculation
```

History work starts only when the user opens the drawer:

```text
Open Drawer
      |
      v
construct ordered pairs
      |
      +-- staged tab pairs
      `-- published tab pairs
             |
             v
calculate stats needed by the active tab
```

While the staged tab remains open, only its live `Now` pair follows editor
input. It shares the same debounce window as the publish pair; immutable
Snapshot pairs are not restarted on every keystroke:

```text
bodyValue changed
      |
      v
200 ms debounce
      |
      +-- latest public -> current body ------> button
      |
      `-- staged tab active?
              |
              `-- latest draft -> current body -> "Now"

historical Snapshot pairs
      `-- unchanged; keep cached results
```

Selecting an entry requests its complete result:

```text
Select Revision pair
      |
      v
RevisionDiffClient.getOrCompute(pair)
      |
      +-- cache hit --------------------------+
      |                                       |
      `-- cache miss                          |
             |                                |
             v                                |
        Worker.compute(before, after)         |
             |                                |
             v                                |
         complete result ---------------------+
             |
             v
       RichEditorDiff(diffValue)
```

Cache eviction is an optimization detail, never a visible state. A miss always
recomputes from the pair's `before` and `after` values; it must not render a
silently empty Diff.

#### Worker and cache boundary

Complete Plate Diff calculation stays off the main thread because large block
sets and large text replacement can exceed one frame budget.

```text
Main thread                            Worker
----------------------------------     -------------------------------
debounce input                         receive before/after
allocate request id      postMessage   computeRichEditorDiff
discard stale response  <-----------   return complete result
cache result
update UI
```

The Worker is stateless. It has one operation:

```text
compute(before, after)
      |
      v
{
  stats,
  hasChanges,
  diffValue
}
```

The main-thread client owns the single bounded result cache. Current-body keys
replace their previous value; immutable Snapshot pairs use stable version-hash
keys. A cache miss follows the same compute path, so eviction cannot change
behavior.

When no draft Snapshot exists, the button and `Now` have the same baseline.
They use one live-pair key, so in-flight work and the cached complete result are
shared instead of running the same Plate Diff twice.

Every current-body request has a monotonically increasing id:

```text
input A ---- request 41 --------------------------x stale
input B ------- request 42 -------------------x stale
input C ---------- request 43 ---------------> accepted
```

Only the latest response may update current button state. Worker scheduling,
debounce, cache lifetime, and stale-response handling belong to Groupher; they
do not change the rich-editor Diff contract.

#### Stats are not change detection

`stats` is presentational data. Revision visibility uses `hasChanges`:

```text
mark change           stats=+0/-0   hasChanges=true
link attribute change stats=+0/-0   hasChanges=true
empty block insertion stats=+0/-0   hasChanges=true
```

The final output routing is:

```text
computeRichEditorDiff(before, after)
      |
      +-- stats --------------------> exact +n/-n display
      +-- hasChanges ---------------> visibility and empty state
      `-- diffValue ----------------> RichEditorDiff renderer
```

#### Temporary Worker build adapter

The current Dashboard Turbopack build copies a `new URL(...worker.ts)` target as
raw TypeScript instead of producing an executable Worker bundle. Until the
bundler handles this entry correctly, the Dashboard uses an isolated adapter:

```text
diff.worker.ts
      |
      | temporary Vite build
      v
public/worker-revision-diff.js
      |
      v
Dashboard Worker URL
```

This adapter is build infrastructure only. It must not own Diff behavior or
cache policy, and should be deleted when the Dashboard bundler can emit the
Worker directly. The generated JavaScript is not committed.

## 12. Snapshot growth policy

Autosave updates the mutable Draft row; it does not create a Snapshot every few
seconds.

Snapshots are created for meaningful events:

```text
explicit checkpoint
publish
fork
promote
restore
session/inactivity checkpoint under a bounded policy
```

Ordinary checkpoints are deduplicated by canonical `version_hash`. Publish and
other explicit product events may still create an audit entry when required.

Retention categories:

| Snapshot category                 | Retention                                              |
| --------------------------------- | ------------------------------------------------------ |
| Main public publish               | Permanent                                              |
| Referenced by `DocPublishRelease` | Permanent                                              |
| Fork/restore source               | Protected while referenced                             |
| Explicit user checkpoint          | Long-term                                              |
| Automatic draft checkpoint        | May be thinned by age/count                            |
| Abandoned preview history         | May be removed after branch archival when unreferenced |

The foundation is a version checkpoint system, not keystroke-level CRDT/oplog
history.

## 13. Doc extension

Docs reuse the Article foundation without moving Tree concepts into Article
Core.

```text
ArticleBranch(thread=doc)
├─ Doc rows
├─ ArticleSnapshot
├─ DocTreeNode
├─ DocTreeEvent
├─ DocTreeSnapshot
├─ DocsSiteState
└─ DocPublishRelease
```

The Docs product keeps two independent history lines:

```text
Article content line
Doc draft/public -> ArticleSnapshot

Tree line
DocTreeNode/Event -> DocTreeSnapshot
```

`DocPublishRelease` aggregates them:

```text
DocPublishRelease
├─ branch_id
├─ release_number
├─ version_slug
├─ ArticleSnapshot[]
├─ DocTreeSnapshot
└─ published TreeEvent[]
```

`DocPublishRelease` is Docs-only. A normal Post, Blog, or Changelog publish
creates an Article Snapshot but does not create a Release wrapper.

`DocPublishRelease` includes a module-level ASCII flow describing this aggregate
boundary.

### 13.1 Docs preview

A Docs preview branch contains draft Docs and a draft Tree. Preview rendering
reads that explicit branch directly.

Promote copies the selected preview Article and Tree draft state into main draft
state. Official publication then follows the single main publish path and
creates a new `DocPublishRelease`.

### 13.2 Docs TimeMachine

An Article Snapshot restores one Doc's versioned content. A
`DocPublishRelease` restores the whole Docs site composition:

```text
selected DocPublishRelease
├─ ArticleSnapshots -> new main Doc drafts
└─ DocTreeSnapshot  -> new main Tree draft
                         |
                         v
                explicit official publish
                         |
                         v
                new DocPublishRelease
```

Old releases and Snapshots remain immutable.

## 14. Proposed module boundaries

Shared Article foundation:

```text
CMS.Articles.Branch
CMS.Articles.Draft
CMS.Articles.Publish
CMS.Articles.Preview
CMS.Articles.Snapshot
CMS.Articles.Diff
CMS.Articles.VersionedRelations
CMS.Model.ArticleBranch
CMS.Model.ArticleSnapshot
```

Docs extension:

```text
CMS.DocPublishRelease
CMS.Model.DocPublishRelease
CMS.Model.DocPublishReleaseArticle
CMS.Model.DocPublishReleaseTreeEvent
CMS.DocTree.*
```

The shared modules may use `Artiment.Matcher`, per-thread version-field lists,
and a small number of explicit thread cases. This proposal does not require a
protocol, behaviour, adapter registry, or dynamic plugin system.

## 15. Transaction boundary

Single-Article products use the normal lifecycle entry:

```text
Publish.publish / Publish.create
├─ acquire Article lock
├─ open transaction
├─ apply Draft to main/public
├─ update document and versioned relations
├─ create ArticleSnapshot
├─ delete Draft state
└─ run official main-publish effects
```

`Snapshot` owns immutable checkpoint construction and history operations.
`Publish` owns the orchestration and is the only public transition into
`main/public`; there is no public apply-without-Snapshot entry.

Docs requires a composable inner entry because Article and Tree publication must
be atomic:

```text
Doc publish transaction
├─ publish selected Docs through Article Publish core
├─ project selected Tree events
├─ create/reuse DocTreeSnapshot
├─ create DocPublishRelease
└─ update DocsSiteState
```

Any failure rolls back the whole Docs publish.

## 16. Public API language

The infrastructure name `article_hash_id` does not force every product API to
expose `articleHashId`.

```text
Article Core: article_hash_id
Docs product: doc_id / docId
Changelog:    changelog path
Post:         post path
Blog:         blog path
```

Resolvers translate product language into the internal lifecycle coordinate.
GraphQL must continue to avoid exposing raw physical database ids.

Docs exposes no Main content create/update mutation. Dashboard Tree/Doc Draft
mutations are the only editing surface, and `publishDocChanges` is the only
official Docs publication entry. Post, Blog, and Changelog keep immediate
publish mutations while exposing separate Draft commands for an explicit
"save as draft" choice.

## 17. Implementation checklist

1. Model, enum, constant, and module naming are centralized and locked.
2. `ArticleBranch` provides explicit per-thread main/preview coordinates.
3. Shared Article identity is `article_hash_id`; Docs translates it to `doc_id`
   only at its product boundary.
4. `ArticleSnapshot` is branch-aware and append-only with one revision timeline.
5. Scalar fields, versioned relations, derived content, and runtime state have
   separate owners.
6. Draft, Publish, Preview, Diff, and Restore work across all Article threads.
7. Docs-only release composition is named `DocPublishRelease` throughout.
8. DocTree remains a Docs extension attached to the shared Branch coordinate.
9. Post, Blog, Changelog, and Doc each have independent lifecycle tests, with
   additional relation, conflict, migration, GraphQL, and frontend checks.
