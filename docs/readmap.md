# Documentation Readmap

本页只维护文档工作的全局状态和入口，不承载具体方案。状态变化时更新 checklist，
原文继续保留在所属主题目录。

## Todo

- [x] [Article View 同步计数](./feature/view-tracker/article-view-counting.md) — `ViewDedupeState`、字段级 ArticleStats 与 MetricEvent 同事务，View transport receipt/客户端幂等 ID 已删除，前端四个 surface 已统一；Cloudflare 防滥用另列部署待办。
- [x] [Article emotion counts direct cutover](./architecture/article-emotion-counts.md) — 保留现有 `(thread, article_id)` identity，typed rows、GraphQL `emotionCounts` 与前端 consumer 已在本地一步切换；生产维护窗口、CDN purge 和线上 smoke test 待发布验收。
- [ ] [ORM 与数据库原语边界](./architecture/orm.md) — 待将重复 advisory-lock SQL 直接收口到 `Helper.ORM.AdvisoryLock`，补齐 API 注释、示例和 runtime `Repo.query*` 静态门禁；不建立 `Database.*` 或兼容 wrapper。
- [ ] [AI](./ai) — 首期应用仍处于规划阶段。
- [ ] [Assets Hub V4](./assets-hub/v4.md) — thread 归属、stats 与 quota 方案待实施。
- [ ] [OAuth 帐户链接与取消链接](./auth/link-unlink-oauth.md) — 设计方案尚未实施。
- [ ] [Post Merge](./feature/post/merge.md) — relation-based merge 仍为草案。
- [x] [Docs Snapshot Update](./feature/docs/snapshot-update-proposal.md) — Doc 内容历史已由 ArticleRevision + DocBranchVersion 取代；本文仅保留 display snapshot 讨论，旧 DocSnapshot 方案 superseded。
- [x] [Article Revision / Draft 目标架构](./feature/article/revision-draft-target.md) — stable Article、mutable Draft、immutable Revision、ArticlePublic Projection 与 Doc LocalDraftHistory 已在本地落地；生产 cutover、全量重建和线上验收待完成。
- [ ] [About 访客分布地图](./feature/community/about-visitor-map.md) — 方案已确认，尚未实现。
- [ ] [Posthouse](./posthouse) — 应用仍处于规划阶段。
- [ ] [Risk Center](./risk-center) — 应用仍处于规划阶段。

## WIP

- [ ] [Assets Hub V3](./assets-hub/v3.md) — 设计已确认，实施中。
- [ ] [Content Import](./content-import) — 本地切换已完成，仍有生产验收门槛。
- [ ] [Web Analysis V2](./umami/web-analysis-v2.md) — 本地能力已有，等待部署与后续阶段。
- [ ] [Article ViewTracker / Insights V1](./feature/view-tracker/v1.md) — 核心实现完成，发布前必须完成真实浏览器 tracking 与 Insights GraphQL 授权 e2e。
- [x] [Article ViewTracker V2](./feature/view-tracker/v2.md) — 历史异步协议已由 Article View 同步计数取代；文档保留为历史设计记录。
- [ ] [ArticleStats 与公共页面缓存](./architecture/article-stats-and-public-cache.md) — 同步 views、owner revision DTO 与 Query/cache owner 已落地；当前剩余生产 telemetry、真实 CDN purge 与边缘验收。
- [x] [ArticleStats 目标架构](./architecture/article-stats-target.md) — ArticleStats、typed emotion rows、排序索引和 owner revision 已落地；canonical Article registry 已由 Article Revision / Draft 目标架构吸收，不再作为独立候选方案。
- [ ] [TanStack Query 通用失效](./architecture/query-invalidation.md) — typed domain target、通用 executor、active/inactive policy、静态门禁和 CDN 边界已落地；剩余各业务 mutation 的 owner revision 收敛与生产观测。
- [ ] [RequestActor 公共分类](./architecture/request-actor.md) — typed evidence、account/anonymous/service/delegation request context 与 View conditional scope 已直接切换；剩余 signed crawler evidence、Edge/origin 收口和生产分类观测。
- [ ] [公共缓存可靠失效](./architecture/public-cache-invalidation.md) — Phoenix `PublicCache` outbox、Oban、Cloudflare adapter、跨语言 tag contract 与已识别领域写入接线已落地；剩余真实 purge、purge health 与生产验收。
- [ ] [Interaction V4](./feature/interaction/v4.md) — 主体实现完成，仍需生产存量清理。
- [ ] [Interaction V5](./feature/interaction/v5.md) — ViewTracker 迁出与 Audit 退役已落地，ReportFact/Moderation 仍在实施。
- [ ] [Gate V5](./feature/gate/v5.md) — 下一阶段 Gate 设计。
- [ ] [Dashboard TanStack V3](./migrations/tanstack/dash/v3.md) — 当前实施版本。

## Done

- [x] [ArticleStats / View 全链路收口](./architecture/article-stats-view-chain-audit.md) — correctness、content/private GraphQL 边界、批量 reader、mutation payload、前端 Query cache/hooks/types 与数据库残留清理均已完成并通过全链路验收；Cloudflare/Edge 防滥用继续作为独立待办。
- [x] [ArticleStats 与 private state 写后同步](./architecture/article-stats-and-viewer-state-sync.md) — mutation 返回完整公共 ArticleStats 与 owner-specific private state；前端按 owner revision patch 真实 Detail/Batch query，已删除 batch -> entity seed 与 per-article disabled observers。
- [x] [Activity V1](./feature/activity/v1.md) — 统一 Activity 写入和读取边界已实现。
- [x] [Activity V2](./feature/activity/v2.md) — Dashboard Community Activity 已完成。
- [x] [Gate V4](./feature/gate/v4.md) — typed Access/Scope context 已落地。
- [x] [Post Solution V2](./feature/post/solution-v2.md) — 已实施并完成验收。
- [x] [Press V1](./press/v1.md) — 已部署并完成线上冒烟验收。
