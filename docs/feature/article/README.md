# Article

> 状态：current

- [Doc 共享评论与计数收口计划](../../migrations/comment-reaction-snapshot-counts.md)：本地实现及验收已完成，真实发布仍未执行；同一稳定 Doc 的评论、回复、参与者和统计不随正文 branch 分裂，正文准入仍按 Gate 验证。证据见 [实施记录](../../migrations/comment-reaction-snapshot-counts-implementation.md)。

- [`revision-draft-target.md`](./revision-draft-target.md)：Article Revision / Draft 目标架构与 `CMS.Articles` 全链路改造方案。
- [ReviewBot / AlertWall V2](../alert-wall/v2.md)：Article/Comment 提交审核、scope 限制、人工处理和 AI 结果应用的当前合同。
- [`article-community.md`](./article-community.md)：Article 与 Community 的平级关系、Community-local 数据和当前实现偏差。
- [`article-lifecycle-comment-decoupling.md`](./article-lifecycle-comment-decoupling.md)：ArticleLifecycle 解耦、Comment 全局审核与跨 Community 真实数据库验收的下一轮可执行重构合同（未实施）。
- [`article-community-inner-id-fix.md`](./article-community-inner-id-fix.md)：公共 `inner_id` 从 stable Article 收敛到关系记录的迁移合同，以及后续 `ArticleBinding` 命名重构边界。
- [`reference-map.md`](./reference-map.md)：旧 ReferenceMap 历史合同；2026-11-06 已由 MentionsGraph 运行时取代。
- [`mentions-graph-sync-contract.md`](./mentions-graph-sync-contract.md)：简化后当前关系的工作区实现合同；尚未发布生产。
- [`mentions-graph-simplification-plan.md`](./mentions-graph-simplification-plan.md)：当前关系、模块收口、Comment 定点访问和单资源一跳图已在工作区实现；跨链路与发布验收仍待完成。目标为全新空库，Doc 仅公开 main 参与 Mention。
- [`mentions-graph-design-review.md`](./mentions-graph-design-review.md)：旧实现问题、阶段性方案与全链路复核；第 1–12 节为阶段记录，第 13 节描述当前工作区边界。
- [`mentions-graph-refactor.md`](./mentions-graph-refactor.md)：首次 MentionsGraph B0–B4 的历史执行合同；当时的新 API/Community Worker 已切换，后续同步版本以当前合同为准。
- [`mentions-graph-b2-performance-acceptance.md`](./mentions-graph-b2-performance-acceptance.md)：旧 B2 性能证据；首次成功率与正式 PG17 容量出口须按新当前关系实现重新验证。
- [`mentions-graph-b23-independent-acceptance.md`](./mentions-graph-b23-independent-acceptance.md)：B2 一跳/SQL、完整计划和 B3 六类真实宿主、取消、缓存与 Activity/Ticket 的独立验收；后续 Doc Comment 联合已补齐；目标性能仍保留。
- [`mentions-graph-doc-comment-joint-acceptance.md`](./mentions-graph-doc-comment-joint-acceptance.md)：Replies 完成后的独立联合验收；稳定 Doc/Comment 身份、通知/恢复、六类预算、真实 Community/Phoenix 浏览器及构建证据。
- [`mentions-graph-b0-inventory.md`](./mentions-graph-b0-inventory.md)：B0 盘点及旧 B1–B4 阶段证据；顶部说明其 text URL 与异步投影验收不覆盖当前同步输入合同。
- [`../../migrations/article-binding-naming-and-storage.md`](../../migrations/article-binding-naming-and-storage.md)：Article Binding 运行时命名、FrontDesk 路径边界和物理表重命名计划。
- [`versioning-history.md`](./versioning-history.md)：已被 Gate V3 取代的版本控制历史方案。
- [`trash-audit-refactor.md`](./trash-audit-refactor.md)：Article Trash 与 CMS Audit 重构。
