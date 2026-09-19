# Documentation Readmap

本页只维护文档工作的全局状态和入口，不承载具体方案。状态变化时更新 checklist，
原文继续保留在所属主题目录。

## Todo

- [ ] [AI](./ai) — 首期应用仍处于规划阶段。
- [ ] [Assets Hub V4](./assets-hub/v4.md) — thread 归属、stats 与 quota 方案待实施。
- [ ] [OAuth 帐户链接与取消链接](./auth/link-unlink-oauth.md) — 设计方案尚未实施。
- [ ] [Post Merge](./feature/post/merge.md) — relation-based merge 仍为草案。
- [ ] [Docs Snapshot Update](./feature/docs/snapshot-update-proposal.md) — 仍为设计讨论稿。
- [ ] [About 访客分布地图](./feature/community/about-visitor-map.md) — 方案已确认，尚未实现。
- [ ] [Posthouse](./posthouse) — 应用仍处于规划阶段。
- [ ] [Risk Center](./risk-center) — 应用仍处于规划阶段。

## WIP

- [ ] [Assets Hub V3](./assets-hub/v3.md) — 设计已确认，实施中。
- [ ] [Content Import](./content-import) — 本地切换已完成，仍有生产验收门槛。
- [ ] [Web Analysis V2](./umami/web-analysis-v2.md) — 本地能力已有，等待部署与后续阶段。
- [ ] [Article ViewTracker / Insights V1](./feature/view-tracker/v1.md) — 核心实现完成，发布前必须完成真实浏览器 tracking 与 Insights GraphQL 授权 e2e。
- [ ] [Article ViewTracker V2](./feature/view-tracker/v2.md) — 独立当前 views Summary、统一实体缓存、阅读资格、dead-letter 与级联清理已实现；待真实浏览器 tracking 与 Insights GraphQL 授权 e2e 验收。
- [ ] [ArticleStats 与公共页面缓存](./architecture/article-stats-and-public-cache.md) — V1 主链路已落地；当前剩余 owner revision/receipt、空 community sentinel、EventProcessor 命名收敛、生产 telemetry 与 purge health 补强。
- [ ] [ArticleStats 目标架构](./architecture/article-stats-target.md) — 本次改造直接落地 canonical Article identity、可排序 ArticleStats 读取投影、owner revision vector、emotion 扩展和 drift repair；不保留兼容层。
- [ ] [TanStack Query 通用失效](./architecture/query-invalidation.md) — typed domain target、通用 executor、active/inactive policy、静态门禁和 CDN 边界；待实施。
- [ ] [RequestActor 公共分类](./architecture/request-actor.md) — 抽出无业务策略的 human/agent/crawler/unknown 请求主体分类，直接删除旧 Actor/ViewTracker 分类入口；待实施。
- [ ] [公共缓存可靠失效](./architecture/public-cache-invalidation.md) — `PublicCache.Invalidation` Const、transactional outbox、Oban 直连 Cloudflare、跨语言 tag contract 和可观测性；待实施。
- [ ] [Interaction V4](./feature/interaction/v4.md) — 主体实现完成，仍需生产存量清理。
- [ ] [Interaction V5](./feature/interaction/v5.md) — ViewTracker 迁出与 Audit 退役已落地，ReportFact/Moderation 仍在实施。
- [ ] [Gate V5](./feature/gate/v5.md) — 下一阶段 Gate 设计。
- [ ] [Dashboard TanStack V3](./migrations/tanstack/dash/v3.md) — 当前实施版本。

## Done

- [x] [Activity V1](./feature/activity/v1.md) — 统一 Activity 写入和读取边界已实现。
- [x] [Activity V2](./feature/activity/v2.md) — Dashboard Community Activity 已完成。
- [x] [Gate V4](./feature/gate/v4.md) — typed Access/Scope context 已落地。
- [x] [Post Solution V2](./feature/post/solution-v2.md) — 已实施并完成验收。
- [x] [Press V1](./press/v1.md) — 已部署并完成线上冒烟验收。
