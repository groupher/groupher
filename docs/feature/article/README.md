# Article

> 状态：current

- [`revision-draft-target.md`](./revision-draft-target.md)：Article Revision / Draft 目标架构与 `CMS.Articles` 全链路改造方案。
- [ReviewBot / AlertWall V2](../alert-board/v2.md)：Article/Comment 提交审核、scope 限制、人工处理和 AI 结果应用的当前合同。
- [`article-community.md`](./article-community.md)：Article 与 Community 的平级关系、Community-local 数据和当前实现偏差。
- [`article-lifecycle-comment-decoupling.md`](./article-lifecycle-comment-decoupling.md)：ArticleLifecycle 解耦、Comment 全局审核与跨 Community 真实数据库验收的下一轮可执行重构合同（未实施）。
- [`article-community-inner-id-fix.md`](./article-community-inner-id-fix.md)：公共 `inner_id` 从 stable Article 收敛到关系记录的迁移合同，以及后续 `ArticleBinding` 命名重构边界。
- [`reference-map.md`](./reference-map.md)：Article / User Ticket / Comment 引用 Map 实施合同；覆盖事实与同步水位、发布/异步更新、批量图查询、默认 MiniMap、类型支持和迁移验收。本地隔离环境已完成 M0–M5 验收，生产尚未切换。
- [`../../migrations/article-binding-naming-and-storage.md`](../../migrations/article-binding-naming-and-storage.md)：Article Binding 运行时命名、FrontDesk 路径边界和物理表重命名计划。
- [`versioning-history.md`](./versioning-history.md)：已被 Gate V3 取代的版本控制历史方案。
- [`trash-audit-refactor.md`](./trash-audit-refactor.md)：Article Trash 与 CMS Audit 重构。
