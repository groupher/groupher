# 后端模块重组

## 背景

后端之前同时存在 `GroupherServer.Statistics` 和 `GroupherServer.Analysis`。

这种拆分有误导性：

- `Analysis` 只实现了 web 流量分析，但这个名称本应涵盖更广义的产品侧分析。
- `Statistics` 混杂了不相关的职责：贡献指标、城市地理计数、站点状态计数和发布限流状态。
- 发布限流是运营策略状态，不属于分析。
- `onlineStatus`、`citiesGeoInfo` 和 `countStatus` 是薄弱或过时的 GraphQL 表面，不足以支撑保留一个泛化的 `Statistics` context。

本次重组移除了含义模糊的 `Statistics` 桶，并把剩下的每个职责迁到拥有其产品语义的 context。

## 新边界

```text
GroupherServer.Analysis
  产品侧指标、趋势和分析 DTO

GroupherServer.Analysis.Web
  由 Umami 等 provider adapter 支撑的 web 流量分析

GroupherServer.Analysis.Contribution
  从 CMS 写活动派生的用户和社区贡献聚合

GroupherServer.CMS.Policy
  CMS 操作策略状态，例如发布限流计数器

GroupherServer.CMS.Audit
  重要 CMS 操作的 append-only 责任记录
```

## 变更内容

### Web Analysis

Web 流量分析从根 `GroupherServer.Analysis` 模块迁移到 `GroupherServer.Analysis.Web`。

Provider 相关代码现在位于：

```text
backend/api/lib/groupher_server/analysis/web.ex
backend/api/lib/groupher_server/analysis/web/community.ex
backend/api/lib/groupher_server/analysis/web/config.ex
backend/api/lib/groupher_server/analysis/web/provider.ex
backend/api/lib/groupher_server/analysis/web/provider/umami.ex
```

GraphQL 字段从 `webAnalysis*` 重命名为 `analysisWeb*`：

```graphql
analysisWebSummary(community: String!, days: Int): AnalysisWebSummary
analysisWebOverview(community: String!, days: Int): AnalysisWebOverview
```

Passport action 由：

```text
web_analysis.read
```

重命名为：

```text
analysis.web.read
```

这使得 GraphQL 与后端 context 形状保持一致：`Analysis -> Web`。

### Contribution Analytics

贡献聚合从 `Statistics` 迁移到 `GroupherServer.Analysis.Contribution`。

公共 facade 为：

```elixir
GroupherServer.Analysis.make_contribution(subject)
GroupherServer.Analysis.list_contributions_digest(subject)
```

模型迁移到：

```text
backend/api/lib/groupher_server/analysis/contribution/model/user_contribute.ex
backend/api/lib/groupher_server/analysis/contribution/model/community_contribute.ex
```

GraphQL middleware 由：

```elixir
M.Statistics.MakeContribute
```

迁移到：

```elixir
M.Analysis.MakeContribution
```

贡献数据仍然存放在相同的数据库表中。这是模块边界重构，不是数据迁移。

### CMS Policy

发布限流从 `Statistics` 迁移到 `GroupherServer.CMS.Policy`。

公共 facade 为：

```elixir
GroupherServer.CMS.Policy.log_publish_action(user)
GroupherServer.CMS.Policy.load_publish_throttle(user)
GroupherServer.CMS.Policy.mock_publish_throttle_attr(scope, user, opts)
```

发布限流放在这里是因为它是可变规则状态，用来决定一个 CMS 写操作是否可以继续。它不是分析指标，也不是 append-only 的审计记录。

### 移除的 Statistics 表面

`GroupherServer.Statistics` context 已删除。

以下 GraphQL 字段也一并删除：

```graphql
onlineStatus
citiesGeoInfo
countStatus
```

`onlineStatus` 在没有实时数据时返回兜底值，不是可靠的真值来源。

`citiesGeoInfo` 依赖一个静态地理池和一份没有明确产品负责人或当前采集路径的遗留计数器。

`countStatus` 是后台/状态快捷字段，不属于分析领域。如果以后确实需要后台状态面，可以在具体的 owner 下重新引入。

## 后续设计规则

- 产品侧指标和趋势 DTO 放在 `Analysis` 下。
- Web 流量数据放在 `Analysis.Web` 下。
- 贡献和活动聚合放在 `Analysis.Contribution` 下。
- CMS 写策略状态放在 `CMS.Policy` 下。
- append-only 责任事件放在 `CMS.Audit` 下。
- 不要重建一个泛化的 `Statistics` 桶。
- 不要把运营策略状态存进 `Analysis`。
- 不要把 `CMS.Audit` 当作可变业务状态读取。

## 后续工作

如果以后需要 platform/admin 状态，引入一个具体 owner，例如 `Admin.Status` 或 `Platform.Status`，而不是恢复 `Statistics`。

如果地理分析再次变得有用，把它挂到拥有该信号的数据源上：

```text
Analysis.Web.Location
Analysis.Contribution.Location
CMS.Audit metadata.geo
```

在采集路径和产品表面清晰之前，不要新建独立的地理 context。
