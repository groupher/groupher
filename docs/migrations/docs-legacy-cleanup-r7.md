# Docs R7 旧机制与入口清理

状态：**R7 实现与本地全量回归完成；生产部署见 [R8 记录](docs-production-cutover-r8.md)，真实身份验收尚未完成**。普通 Article 永久删除保留 Article 身份和正式 Snapshot；历史归属由 Binding 插入及跨社区移动建立，社区 destroy 在最后一位归属者退出时清理历史。新空隔离库的单并发全量回归为 2,574 通过、0 失败、1 排除。下文部分阶段性“尚未完成”保留为当时证据，以本段和 R8 记录判断当前状态。

2026-11-12 后续复核：原有 20 项失败包含旧物理删除断言、直接删除 Community / Article 的旧清理路径，以及清理失败污染的全局统计。正式清理改接 Lifecycle；临时 Seed 删除和完整社区种子删除共用社区销毁流程，避免跨社区 Article 被直接删除。新增普通 Article 历史归属迁移 `20261112234000`；`article_history_owners` 对 Article / Community 均使用 RESTRICT，并在 Binding INSERT 或跨社区 UPDATE 时登记归属，归属在 Community destroy 前不可删除。新空隔离库 `groupher_docs_history_full_20261112` 的并行全量结果为 2,573 通过、1 项 Press 100 篇分页用例超时、1 排除；该用例单独重跑 10.1 秒通过，同库单并发全量为 2,574 通过、0 失败、1 排除，耗时 695.6 秒。并行套件当时卡在发布更新社区计数的数据库读取，尚未单独定位锁持有者；不能将它描述成已修复的性能问题。

本批按最新 Article / Docs 合同执行：不转换历史数据，不保留旧 Branch / Draft / Revision 兼容接口；外部 Git source branch 不属于删除范围。Docs Queue 仍负责正文的 Enqueue、Save、Merge、Dequeue、Release 与 Approval；D0 盘点只用于识别历史 Queue 正文及其引用，不能据此认定 Queue 正文已退役。

## 已改接的路径

- 目录复制：独立 Article / D / ArticleBody；新 `duplicateDocsWorkspaceNode` 命令带 revision、Gate 和 Receipt。
- Import：应用到工作区目录和 D；不会自动入队或发布；以结构化目录、队列和正文版本检查 staged 计划。
- Cover：读取新目录与 Public；拒绝将存在未发布内容的 Doc 固定为公开卡片。
- Assets：WorkingCopy / Snapshot 资产成员读取与写入；移除旧正文 Draft / Revision 成员入口。
- 评论锁定、状态命令、审核状态读取、公开 Mention、种子发布：转向稳定 Article 与站点边界。
- Docs 内容标签经 D 保存和队列发布更新；Community Binding 标签继续通过 Binding 命令管理，不属于内容 Snapshot。
- 前端目录复制改用新命令；移除旧“移回 Draft”和 Revision 抽屉。
- 旧服务、GraphQL 入口、旧模型与 Branch 字段已清理；相关生成结果和测试已同步。
- 社区销毁新增 Docs 历史聚合清理；个人 Doc Trash 永久清理保留历史身份，通过专属 HistoryOwner 归属社区。隔离数据库已验证；生产已部署新模型，真实社区销毁操作未作为生产冒烟执行。

## 已有聚焦证据

以下是本批前半段结果，不代表后续删除已完成回归：

- Assets WorkingCopy / Snapshot：7 个测试通过。
- `scripts/docs_import_r7_verify.exs`：新建、重复应用、staged revision 过期拒绝、发布后重新创建 D、Public 保持不变通过。
- `scripts/docs_duplicate_r7_verify.exs`：正文独立、完整格式复制、重放、过期 revision、无权限拒绝、从 Public 复制且不创建源 D 通过。
- `scripts/docs_cover_r7_verify.exs`：无 D / 干净 D / dirty D、公开 Cover 与审核限制通过。
- Content Publish 合同 10 个测试、Core Publisher 4 个测试通过。
- Core 类型检查通过；后端去旧代码后的完整聚焦回归和 GraphQL 重新生成尚未完成。

## 去旧模型后的隔离回归（2026-11-12）

隔离库 `groupher_docs_b0_r06_final` 已迁移至 `20261112220000`，旧 Branch 表已移除。

- ArticleBody / PublicBody / WorkingCopy / Snapshot：21 个测试通过。
- Doc owner 数据库约束和稳定评论：11 个测试通过，包括拒绝跨社区归属、拒绝提前删除历史身份、删除后隐藏讨论、永久清理保留评论和 HistoryOwner。
- 目录计划、内容合入、审批状态、锁及新命令输入边界：54 个测试通过。
- Import、Duplicate、Cover 脚本在去旧表后重跑通过；Import 补充不同社区相同源路径的身份隔离，修正跨站点 UUID 冲突。
- `scripts/docs_history_r7_verify.exs` 通过：单 Doc 永久清理保留 Snapshot / ArticleBody / 资产引用 / 历史身份；社区 destroy 清除 Release / 审批 / 正文历史，其他文章和共享资产对象不变。
- 新增历史保留数据库约束：允许有 HistoryOwner 的已清理 Doc 解除活动 binding，禁止迁移历史归属；社区 destroy 前禁止删除 HistoryOwner。

旧目录 / Checklist / Draft API 专属测试已退场；混合消费者测试、Schema 生成、全量后端及生产验收仍未完成，不能据此标记 R7 完成。

## 收口要求（R7 执行前清单，历史记录）

1. 完成残留消费者、旧测试、Schema / codegen 和静态检查。
2. 验证 `20261112210000_retire_docs_legacy_models`：拒绝非空旧模型；新模型可迁移和正常读写。
3. 验证社区销毁：Release / 审批 / Snapshot / 正文 / 资产成员均清除，其他社区、共享资源保持不变；单 Doc 清理仍保留历史。
4. 重跑 Article、发布、审批、Import、Cover、目录与 Trash 回归并记录实际结果。
5. R8 按 [生产切换记录](docs-production-cutover-r8.md) 执行；实际执行结果以该记录为准。

## 收尾验证进度（2026-11-12，尚未最终放行）

- GraphQL SDL 与客户端生成产物已更新；`contract:graphql`、`contract:graphql:generated`、Core 类型检查通过。
- `docs:check` 聚合门禁通过；清除了依赖旧命令的扫描规则、失效的现行链接，并将历史引用明确标记为已退场。
- 社区历史清理故障注入：删除 Release 时故意抛错，确认整个 destroy 回滚；解除故障后重试成功，其他 Article 保持不变。该测试与 Activity / Assets / Review GraphQL 共 49 项通过。
- 额外回归：Import 19 项、Doc 评论及 BodyBag 43 项、Assets / Snapshot Activity 49 项、Gate / Review 30 项、归属并发与 Doc 资产 3 项、完整社区 seed 创建和删除 1 项通过。
- 删除旧阶段报告脚本 `docs_cutover_root_report.exs`、`mentions_graph_b0_report.exs`、`verify_ordinary_article_retirement.exs`。R8 的新清理工具直接校验目标数据库与明确清单，不引入业务兼容层；历史迁移 SQL 仍保留。
- 评论启动 Schema 校验已按无 Branch 结构更新，不再要求随 `branch_id` 删除的旧 delivery CHECK；账号物理删除与稳定身份保护继续纳入指纹。
- 扩大回归修正 Docs 发布作者 / 社区计数遗漏；Community Binding 标签与 Snapshot 内容标签分别按原合同管理。
- 首轮全量运行因 20 项失败阈值停止：1,094 通过、20 失败、1 排除；修正后正在重跑，不将其描述为全量通过。

- 第二轮全量后端运行完成：2,562 通过、10 失败、1 排除。失败涉及旧 Pipeline 图、seed 批量发布限流、Binding 标签计数、重复目录标题与全局测试计数；修正后继续聚焦回归，尚未声明全量通过。
- LocalDraftHistory 改为独立 v2 命名空间；不再读取 Branch key，启动请求删除旧数据库（旧标签页占用时不阻塞新库）。恢复基线使用 WorkingCopy ID / revision / Public Snapshot ID；本地历史及编辑器 26 项通过，新增旧库退场验证与历史测试共 9 项通过。
- Core / Dash / Community 类型检查、两个 Worker 生产 dry-run 构建通过；后续本地历史退场补丁尚需重新构建。

## 最终实现与全量回归（2026-11-12）

- 全量后端 `TEST_DB_NAME=groupher_docs_b0_r7_clean MIX_ENV=test mix test --no-compile`：**2,573 通过、0 失败、1 排除**，耗时 702.4 秒。上文失败记录保留为阶段证据，已由本结果覆盖。
- 旧 Draft / Revision facade、CreateStableDraft / DraftResult 和对应动态分析白名单退场；旧前端 Mention 失效操作名、Revision worker 构建入口退场。
- Docs 发布 Activity 使用稳定 Article 和实际 Snapshot；首次 / 再次发布、作者与社区计数、Binding 标签计数均纳入回归。迁移 `20261112233000` 同步退场旧 Draft Activity 动作 CHECK，不转换历史事件。
- 新空隔离库 `groupher_docs_r7_guard_20261112_final` 验证：非空旧正文拒绝、DDL 回滚与迁移版本不落库；清除探针后完成新模型迁移。
- LocalDraftHistory v2 删除旧命名空间、不读取旧 Branch 数据；WorkingCopy ID / revision / Snapshot ID 共同识别恢复基线。前端 GraphQL transport 23 项、恢复历史退场 9 项通过。
- 生产清理和部署、真实服务身份、外部投递及默认浏览器验收均以 R8 实际记录为准。
