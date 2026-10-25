# Documentation Roadmap

> 状态：current

本页只记录尚未完成的跨文档工作和生产验收，不承载具体设计，也不重复保存已经完成的历史清单。
当前合同由所属应用或 Feature 的 `README.md` 指向；迁移完成记录保留在 `migrations/`。

## In progress

- [Assets Hub V3](./assets-hub/v3.md)：资源管理、stats/quota 与删除链路继续实施；后续目标见 V4/V5。
- [Import](./import/README.md)：Cloudflare 生产迁移与 `home` 小样本 Preview/Apply 已验收；生产规模容量验证另行安排。
- [Web Analysis V2](./umami/web-analysis-v2.md)：本地能力已实现，等待部署与后续阶段。
- [Interaction V5](./feature/interaction/v5.md)：ViewTracker 迁出与 Audit 退役已落地，ReportFact/Moderation
  继续按独立设计推进。
- [Dashboard TanStack V3](./migrations/tanstack/dash/v3.md)：当前迁移批次。
- [Widget V1](./widget/v1.md)：mock-first runtime 与 embedding protocol 已完成；生产 API、持久化和部署路由继续推进。

## Planned

- [AI](./ai/README.md)：首期应用仍处于规划阶段。
- [OAuth 帐户链接与取消链接](./auth/link-unlink-oauth.md)：设计尚未实施。
- [Post Merge](./feature/post/merge.md)：relation-based merge 仍为草案。
- [About 访客分布地图](./feature/community/about-visitor-map.md)：方案已确认，尚未实施。
- [Gate V5](./feature/gate/v5.md)：下一阶段 Gate 设计。
- [Posthouse](./posthouse/README.md)：应用仍处于规划阶段。
- [Risk Center](./risk-center/README.md)：应用仍处于规划阶段。

## Production validation

- [Article View 计数](./feature/view-tracker/article-view-counting.md)：完成 Cloudflare crawler evidence、
  Edge rate limit、origin 收口、生产观测和真实并发压测。
- [Profile View 计数](./feature/view-tracker/profile-view-counting.md)：接入真实 Profile 产品页面，并验证
  “成功可见后触发”和 committed views reconciliation。
- [Article Insights V1](./feature/analysis/article-insights-v1.md)：完成生产调度、权限和 GraphQL E2E。
- [ArticleStats 与公共页面缓存](./architecture/article-stats-and-public-cache.md)：完成生产 telemetry、真实
  Cloudflare purge 和跨 PoP 验收。
- [Article Revision / Draft](./feature/article/revision-draft-target.md)：完成生产 cutover、全量重建与线上验收。
- [RequestActor](./architecture/request-actor.md)：补齐 signed crawler evidence、Edge/origin 收口和分类观测。
- [Press V1](./press/v1.md)：持续验证 Phoenix-to-Press invalidation、Feed、Markdown、ETag 和 metrics。

## Architecture cleanup

- [Interaction V4](./feature/interaction/v4.md)：完成生产数据清理、旧表/旧字段删除与最终验收。
- [PublicCache historical facility](./architecture/public-cache-invalidation.md)：确认没有新的非 CMS 生产调用方后，
  删除独立 `PublicCache.Invalidation`、`PublicCache.Workflow` 和 `Jobs.PublicCachePurge`，避免长期维护两套
  durable delivery 状态机。
- [ORM 与数据库原语](./architecture/orm.md)：收口重复 advisory-lock SQL，补 runtime `Repo.query*` 门禁。
- [TanStack Query 通用失效](./architecture/query-invalidation.md)：继续把业务 mutation 收敛到 owner revision，
  并补生产观测。
