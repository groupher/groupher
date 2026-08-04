# Backend Module Reorganization

## Background

The backend previously had both `GroupherServer.Statistics` and
`GroupherServer.Analysis`.

That split was misleading:

- `Analysis` only implemented web traffic analytics, but the name should cover
  product-facing analysis as a broader domain.
- `Statistics` mixed unrelated responsibilities: contribution metrics, city
  geo counters, site count status, and publish throttle state.
- Publish throttle was operational policy state, not analytics.
- `onlineStatus`, `citiesGeoInfo`, and `countStatus` were weak or stale GraphQL
  surfaces and did not justify keeping a generic `Statistics` context.

The reorganization removes the ambiguous `Statistics` bucket and moves each
remaining responsibility to the context that owns its product meaning.

## New Boundaries

```text
GroupherServer.Analysis
  product-facing metrics, trends, and analysis DTOs

GroupherServer.Analysis.Web
  web traffic analytics backed by provider adapters such as Umami

GroupherServer.Analysis.Contribution
  user and community contribution aggregates derived from CMS write activity

GroupherServer.CMS.Policy
  CMS operation policy state, such as publish throttle counters

GroupherServer.CMS.Audit
  append-only accountability records for important CMS operations
```

## What Changed

### Web Analysis

Web traffic analytics moved from the root `GroupherServer.Analysis` module into
`GroupherServer.Analysis.Web`.

Provider-specific code now lives under:

```text
backend/main/lib/groupher_server/analysis/web.ex
backend/main/lib/groupher_server/analysis/web/community.ex
backend/main/lib/groupher_server/analysis/web/config.ex
backend/main/lib/groupher_server/analysis/web/provider.ex
backend/main/lib/groupher_server/analysis/web/provider/umami.ex
```

GraphQL fields were renamed from `webAnalysis*` to `analysisWeb*`:

```graphql
analysisWebSummary(community: String!, days: Int): AnalysisWebSummary
analysisWebOverview(community: String!, days: Int): AnalysisWebOverview
```

The passport action was renamed from:

```text
web_analysis.read
```

to:

```text
analysis.web.read
```

This keeps GraphQL aligned with the backend context shape:
`Analysis -> Web`.

### Contribution Analytics

Contribution aggregation moved from `Statistics` into
`GroupherServer.Analysis.Contribution`.

The public facade is:

```elixir
GroupherServer.Analysis.make_contribution(subject)
GroupherServer.Analysis.list_contributions_digest(subject)
```

The models moved to:

```text
backend/main/lib/groupher_server/analysis/contribution/model/user_contribute.ex
backend/main/lib/groupher_server/analysis/contribution/model/community_contribute.ex
```

The GraphQL middleware moved from:

```elixir
M.Statistics.MakeContribute
```

to:

```elixir
M.Analysis.MakeContribution
```

Contribution data is still stored in the same database tables. This was a
module-boundary refactor, not a data migration.

### CMS Policy

Publish throttle moved from `Statistics` into `GroupherServer.CMS.Policy`.

The public facade is:

```elixir
GroupherServer.CMS.Policy.log_publish_action(user)
GroupherServer.CMS.Policy.load_publish_throttle(user)
GroupherServer.CMS.Policy.mock_publish_throttle_attr(scope, user, opts)
```

Publish throttle belongs here because it is mutable rule state used to decide
whether a CMS write operation may proceed. It is not an analysis metric and not
an append-only audit record.

### Removed Statistics Surfaces

The `GroupherServer.Statistics` context was removed.

The following GraphQL fields were also removed:

```graphql
onlineStatus
citiesGeoInfo
countStatus
```

`onlineStatus` returned a fallback value when no realtime data existed, so it
was not a reliable source of truth.

`citiesGeoInfo` depended on a static geo pool and a legacy counter without a
clear product owner or current collection path.

`countStatus` was an admin/status shortcut, not an analysis domain. It can be
reintroduced later under a concrete owner if a real admin status surface needs
it.

## Design Rules Going Forward

- Put product-facing metrics and trend DTOs under `Analysis`.
- Put web traffic data under `Analysis.Web`.
- Put contribution and activity aggregates under `Analysis.Contribution`.
- Put CMS write policy state under `CMS.Policy`.
- Put append-only accountability events under `CMS.Audit`.
- Do not recreate a broad `Statistics` bucket.
- Do not store operational policy state in `Analysis`.
- Do not read `CMS.Audit` as mutable business state.

## Future Work

If platform/admin status is needed again, introduce it with a concrete owner,
for example `Admin.Status` or `Platform.Status`, rather than restoring
`Statistics`.

If geo analytics becomes useful again, attach it to the data source that owns
the signal:

```text
Analysis.Web.Location
Analysis.Contribution.Location
CMS.Audit metadata.geo
```

Do not create a standalone geo context until the collection path and product
surface are clear.
