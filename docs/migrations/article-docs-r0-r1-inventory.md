# Article / Docs 新合同：R0 入口盘点与 R1 历史保留

日期：2026-11-12。范围：当前 `doc-redesign` 工作区；不代表已提交或目标环境已切换。

依据：[Article 基座](../feature/article/working-copy-snapshot-target.md)、[Docs 编排合同](./docs-publish-queue-refactor.md)。本文把本轮合同差异落到入口、迁移与批次；既有隔离验收不覆盖后续批次的新实现。

- R0：入口和迁移清单已落文档。以下是源码实施清单，不是目标数据库逐行清理清单，也不替代 Docs B0 的 `complete: false` 报告。
- R1：移除 Snapshot 按时间清理的调度、Worker（含分页续跑）、领域入口及旧删除测试；增加存量任务取消迁移和回归测试。验证记录见末尾。
- R2：后续已实施 ArticleBody 和保存 / 固定 / fork，见 [独立 R2 记录](./article-body-r2.md)；本页的 R0 / R1 验证不替代它。
- R3：后续已实施 PublicBody、原子发布和公开读取，见 [独立 R3 记录](./article-public-body-r3.md)。
- R4：已实施审批 / 预览计划 / Release 结构化校验，见 [独立 R4 记录](./docs-structured-plan-r4.md)。
- R5：已实施 D 按需保留与显式创建，见 [R5 记录](./docs-default-lifecycle-r5.md)。
- R6：已接入站点预览、审批配置 / 比较 / 通知、Snapshot / Release 历史和显式恢复，见 [R6 记录](./docs-publication-r6.md)。
- R7–R8：旧机制清理、社区历史聚合删除与正式切换仍未交付。

## 1. 依赖与实施边界

```text
R0 入口 / DDL / 消费者清单
  -> R1 停止 Snapshot 时间清理
  -> R2 ArticleBody + 保存 / 固定 / fork
  -> R3 ArticlePublicBody + 发布事务 + 公开消费者
       +-> R4 审批 / 预览 / Release 结构化校验
       +-> R5 D 按需保留与创建（后端 + 前端）
              -> R6 完整预览 / 审批 / 历史体验
              -> R7 去 Branch 等旧入口及社区删除历史清理
              -> R8 目标环境切换 / 全链验收
```

R4、R5 可以分别设计，但上线验收需覆盖它们共同影响的整队发布。R7 的依赖盘点可以提前；删除必须跟随消费者改接。所有批次按空目标聚合切换，不回填旧数据，不保留兼容读写。

## 2. 入口与消费者清单

下列后端路径以 `backend/api/lib/groupher_server/` 为根；具体成组路径中的文件均是后续实施检查项，不代表该组已经改接。

| 入口 / 实现                                                                                                                               | 当前差异与动作                                                                                    | 批次 / 验收边界                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `cms/model/article_working_copy.ex`、`article_snapshot.ex`；`cms/articles/working_copy/store.ex`、`snapshotter.ex`、`query.ex`、`diff.ex` | 正文内联；拆为独占 ArticleBody，分类字段 `type`；保存更新可变正文，固定和 fork 复制完整文档       | R2；完整格式原子保存、快照不可变、重复 Freeze、revision 冲突、失败回滚                                             |
| `cms/articles/working_copy/deleter.ex`、`cms/assets/refs.ex`                                                                              | 删除 WorkingCopy 时清自身正文 / refs；不能误删 Snapshot 正文、Cover 或历史资产引用                | R2 / R7；owner 隔离与外键约束                                                                                      |
| `cms/articles/public.ex`、`working_copy/publisher.ex`、`publish/target.ex`、`publishable.ex`、`snapshot_projection.ex`                    | Public 选 Snapshot；公开正文当前仍取快照；增加独立 ArticlePublicBody，与 Public 指向同一 Snapshot | R3；公开投影和指针同事务、失败不出现混合版本                                                                       |
| `cms/press/query.ex`、`cms/search_artiments/capacity.ex`                                                                                  | 公开消费仍有 Snapshot 正文依赖；公开数据改读 PublicBody                                           | R3；详情、搜索容量 / 分发、Press 读同一公开版本                                                                    |
| `cms/review/commands/recheck.ex`、`cms/review/media.ex`                                                                                   | Snapshot 身份审核需读取不可变 ArticleBody                                                         | R2 / R3；不能误改为读取当前 PublicBody                                                                             |
| `cms/tickets/mentions.ex`、`persist.ex`、`query.ex`                                                                                       | 也有 Snapshot 正文消费者；逐入口区分历史引用与公开读取                                            | R2 / R3；保持 Ticket 独立产品边界，不按正文关键词批量替换                                                          |
| `cms/doc_tree/publish/content_state.ex`、`content_merge.ex`                                                                               | D / Q 内容读取和比较含内联正文                                                                    | R2；完整内容 diff / 合入，不引入 body_hash 身份                                                                    |
| `cms/doc_tree/publish/plan.ex`、`approval.ex`、`approval_status.ex`、`release.ex`、`queue_release.ex`                                     | R4 已移除摘要生成、存储和比较，保留格式版本和确定性排序                                           | R4；在锁内校验队列 revision、成员 / 来源版本、审批 Snapshot、目录及公开基线的结构化事实；revision 不能替代完整校验 |
| `cms/doc_tree/publish/align_default.ex`、`resolve_conflict.ex`、`queue/`                                                                  | R5 已按完整内容比较删除干净 D、保留编辑 / 冲突                                                    | R5；Q 已发布而 D 有后续改动、冲突、重放、并发保存与发布                                                            |
| `cms/doc_tree/workspace_read.ex`、`workspace_trash_purge.ex`、`cms/model/docs_lifecycle.ex`                                               | R5 已允许公开 Doc 无 D；编辑显式按需创建，Trash 删除发布前补恢复 D                                | R5；列表读取不创建 D，旧 workingCopyId 保存拒绝，Trash 缺 D 时按合同先创建恢复 D                                   |
| `cms/articles/commands/publish_article.ex`；Web `schema/cms/mutations/operation.ex`                                                       | 仍有 expected_public_snapshot_id 等命名                                                           | R2–R5 随对应命令改名；所有 wire / generated 消费者同批修改，不做别名兼容                                           |
| `cms/communities/lifecycle.ex`；`cms/articles/revision/persist.ex`                                                                        | 社区销毁并不等于已证明历史聚合清理完整；旧 Revision 的 retention 字段另属旧模型                   | R7；明确社区销毁时历史与资产引用处置，不触碰其他社区引用                                                           |

前端与跨服务入口：

| 路径                                                                                                                        | 待实施动作                                                                                                  | 批次               |
| --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------ |
| `packages/contracts/src/content-publish.ts`、`packages/content-publisher/`；`frontend/core/lib/server/content-publisher.ts` | parser、固定 action adapter、BodyBag 保存参数与 revision 命名一起改接；保留服务认证与 delegated user 双边界 | R2–R5 对应命令     |
| `frontend/dash/src/routes/api/content/publish.ts`、`frontend/community/src/routes/api/content/publish.ts`                   | host route 与共享 adapter 联调；不引入浏览器生成 BodyBag 的路径                                             | R2–R5              |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftAutoSave.ts`                                            | R5 已加入显式开始编辑、会话 workingCopyId 校验、过期 ID 拒绝与本地未保存内容保留                            | R5                 |
| `frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/usePublishQueue.ts`                                           | R5 已由 editor loader 按 D / Public 切换；发布后重读沿用本地 dirty 保护，不自动重建                         | R5                 |
| Docs Editor loader / store、Q 抽屉、合入及冲突界面                                                                          | 正文 DTO、D 可缺省及各 revision 同步；服务认证和真实浏览器验收                                              | R2 / R5 / R6       |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/SideTree/useLogic.ts`                                                         | duplicateDocTreeNode、moveDocToDraft 等仍使用旧接口；跟随新目录 / Trash 替换后删除                          | R7                 |
| GraphQL schema / generated operations / types，Import、Cover 的调用端                                                       | 随字段 / 命令改接生成，覆盖实际消费者；外部 Git source branch 不属于退役目标                                | R2–R7 按消费者归属 |

锁与命令边界：R2 不改变 WorkingCopy revision / Freeze 幂等身份；R3 公开元数据和正文必须同事务；R4 / R5 按 Docs 合同的站点、队列、目录、Article / WorkingCopy 锁序执行。Receipt 重放不能依赖已删除的 D / Q 再构造成功结果。具体锁序与身份校验沿用主合同，后续实现时补逐命令交错测试，不在 R0 宣称通过。

## 3. 迁移清单

现有迁移位于 `backend/api/priv/repo/migrations/`。以下列出新合同直接影响的迁移族；不修改已存在的迁移来掩盖实现差异。

| 现有迁移                                                                                                                                         | 后续目标 DDL / 处置                                                                                                                    | 批次            |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `20261110100000_create_article_working_copies`、`20261110110000_create_article_snapshots`                                                        | 新建 ArticleBody；owner 独占、type、不可变 Snapshot body 约束；退役两表内联正文                                                        | R2              |
| `20261110120000_create_article_working_copy_thread_fields`、`20261110130000_extend_article_asset_refs_to_content_owners`                         | 核对 thread fields、tags、Cover、asset refs 的 owner / FK；不是全部迁往 body                                                           | R2              |
| `20261110140000_link_article_public_to_snapshot`、`20261110150000_remove_legacy_article_public_projection`                                       | 新建 ArticlePublicBody，单 Article 一行、Snapshot 身份一致，公开 projection 原子更新                                                   | R3              |
| `20261111100000_create_docs_publish_queue`、`20261111110000_create_docs_queue_tree_changes`、`20261111120000_create_docs_post_publish_conflicts` | 核对队列消费、目录事实、冲突与历史引用；D 清理不能破坏历史 FK                                                                          | R4 / R5         |
| `20261112100000_create_docs_publish_approvals`、`20261112110000_cutover_docs_publish_queue`                                                      | 已由 `20261112150000_remove_docs_plan_digests` 在空表门禁后删除摘要列；保留结构化计划与 Snapshot 引用，非空拒绝，不转换历史            | R4 已实施       |
| `20261112110000_cutover_docs_publish_queue` 的 lifecycle                                                                                         | R5 追加迁移已允许无 D，保留归属 FK 并要求从未发布的 Doc 必须有 D                                                                       | R5              |
| `20261112000000_retire_ordinary_draft_revision_tables` 与更早 body_draft / body_snapshot / Revision 存储                                         | 普通 Article 已有退役门禁不代表 Docs / Ticket / Cover 所有引用清零；按依赖验证后退役                                                   | R7              |
| **`20261112120000_cancel_article_snapshot_cleanup`**                                                                                             | 仅取消指定 Worker 的 available / scheduled / retryable / executing 任务；不删除业务历史，不修改其他 worker 或终态记录；down 不重启任务 | **R1 本次新增** |

后续新 DDL 需先在空隔离库演练，并保留非空旧数据拒绝证据。目标环境清理与切换由 R8 执行，R0 清单不授权运行现有 destructive cutover。

## 4. R1 删除范围与部署顺序

已删除：

- `cms/articles/snapshot_cleanup.ex`：7 天筛选与删除、分页 cursor、资产 / Cover 清理实现。
- `jobs/article_snapshot_cleanup.ex`：Oban Worker 与续页入队。
- `cms/articles.ex` 和 `cms.ex` 的 cleanup_expired_snapshots / page 入口。
- `config/config.exs` 的每日 Cron；旧 `snapshot/cleanup_test.exs` 改为 `snapshot/retention_test.exs`。

未改：旧 Revision retention、Trash retention、其他 jobs、正文存储、D 行为、plan_hash、GraphQL 参数及生成产物。本次停止一个历史删除链路，不等于完整社区删除聚合已验收。

部署必须按以下顺序；本次没有在目标环境执行：

1. 停止所有旧实例的 Cron 与消费者，等待已执行的 ArticleSnapshotCleanup 退出；同时停止所有可能手动调用旧 CMS 入口的维护进程。不能让新旧实例混跑。
2. 记录该 Worker 按 queue / state 的数量及执行中任务 ID；确认没有存活执行器再迁移。SQL 把 executing 改为 cancelled **不会中断正在执行的 Elixir 代码**。
3. 发布移除代码的构建，执行 `20261112120000_cancel_article_snapshot_cleanup`（以及部署本身要求且已经批准的前置迁移）。不要为了执行本条盲目对未盘点的旧库运行全部 cutover 迁移。
4. 再查该 Worker 可运行状态数量必须为 0，然后启动新实例；旧 Cron 和分页续跑均不得重新创建任务。
5. 不回滚到含该删除逻辑的旧构建。迁移 down 不恢复任务；如果必须回退其他功能，仍须保持此 Worker 停用。

只读核对 SQL（任务表位于 public）：

```sql
SELECT queue, state, count(*)
FROM public.oban_jobs
WHERE worker = 'GroupherServer.Jobs.ArticleSnapshotCleanup'
GROUP BY queue, state ORDER BY queue, state;
```

未结束任务取消迁移可重复执行且不会改写已取消的时间；completed / cancelled / discarded 原记录保持不变。原来已经被删除的历史不会由本次变更恢复。

## 5. 验证记录

本次验证使用新建隔离库 `groupher_r01_20261112`，未操作目标环境数据库。

| 检查                                                                                                                                    | 结果                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TEST_DB_NAME=groupher_r01_20261112 MIX_ENV=test mix test test/groupher_server/cms/articles/snapshot/retention_test.exs`（backend/api） | 空库全部迁移成功，2 tests / 0 failures；测试随后再次通过。覆盖取消所有可运行状态（含分页 args）、其他 worker / 终态不变、重复执行、down 不恢复、入口和 Cron 不存在 |
| `MIX_ENV=test mix compile --warnings-as-errors`                                                                                         | 通过                                                                                                                                                               |
| `mix format --check-formatted`（本次 5 个新增 / 修改 Elixir 文件）                                                                      | 通过                                                                                                                                                               |
| `MIX_ENV=test mix lint.context`                                                                                                         | 14 个检查测试通过，0 findings                                                                                                                                      |
| `MIX_ENV=test mix lint.style`                                                                                                           | 未通过：62 项既有样式问题，涉及其他 Article Commands、Docs 模型等；本次新增 retention 测试和取消迁移未被报告。首步失败，后续 inline-do 子检查未运行                |
| `pnpm run docs:check`                                                                                                                   | scanner 11 个测试通过；文档覆盖检查未通过，7 项位于未修改的 one_of_validation、Gate access/load 与 queries；后续聚合边界检查因此未运行（context 已单独通过）       |
| 清理符号扫描（backend/api 的 lib/config/priv/test/scripts 及根 scripts）                                                                | 旧 Worker / cleanup 入口仅剩取消迁移与否定性回归测试引用；lib/config 无可调用清理路径                                                                              |
| `git diff --check`                                                                                                                      | 通过                                                                                                                                                               |

目标环境任务排空、真实浏览器和全量后端套件未运行。这里的“R1 完成”指实现与上述聚焦验证；仓库级检查未全绿，目标环境部署仍须按 §4 执行。隔离库空数据迁移成功不代表真实旧库通过切换门禁。

## R5 实施增量

D 按需保留、显式初始化和 Trash 恢复副本已改接；新增 `DefaultCopy`、`BeginEdit` 及 Receipt confirmation，`docsEditor` 只读入口、`beginDocsEdit` 命令和冲突解决的 D ID 校验同步到 GraphQL 与前端。验证、迁移和未覆盖边界见 [R5 记录](./docs-default-lifecycle-r5.md)。R6 后续实现见下一节；R7–R8 未实施，本表其余入口不因本批完成而视为交付。

## R6 后续实施更新

Publication 只读版本化投影、独立审批策略 Command / Activity、两类比较基线、状态 Outbox / Workflow、历史归属与分页、单 Snapshot 恢复已接入。入口、三个迁移、前后端验证与未覆盖边界见 [R6 记录](./docs-publication-r6.md)。预览 / 历史读取不创建编辑副本；恢复才执行显式写命令。

R7 继续处理旧目录 / Branch / Draft / Checklist / Revision、Import / Cover 旧依赖、旧 binding 删除约束和社区历史聚合清理。扩大回归发现的旧表测试失败归于该批，不以恢复兼容表消除。R8 的真实账号、目标环境与外部投递验收尚未执行。

## R7 完成更新

旧模型与消费者退场、社区历史聚合删除及全量后端回归已完成（2,573 通过、0 失败、1 排除）；旧阶段的样式 / 文档失败已修正，最终结果见 [R7](./docs-legacy-cleanup-r7.md)。[R8](./docs-production-cutover-r8.md) 已在生产克隆库完成旧内容清理和新模型 DDL，生产库尚未执行切换。
