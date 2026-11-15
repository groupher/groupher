# R6：Docs 预览、审批与历史体验

日期：2026-11-12。当前 `doc-redesign` 工作区，未提交、未正式切换。依据 [Docs 合同](./docs-publish-queue-refactor.md)、[Article 基座](../feature/article/working-copy-snapshot-target.md)与 [批次清单](./article-docs-r0-r1-inventory.md)。本文记录 R6 实现及实际验证，不代表 R7 / R8 或目标环境验收完成。

> **2026-11-14 架构更新：**本文的 `DocsHistoryOwner` 与单社区历史读取属于 R6 实现事实，已被 Article 多社区 Binding 目标 supersede。未来 Docs Release 历史由各自 Release 社区引用读取；非 Release 的 Article 历史保留沿用通用 ArticleHistoryOwner，不保留 Doc 专属唯一 owner。

## 本批实现

```text
Publication drawer
  +-- Preview -> read-only repeatable-read transaction
  |                +-- site Gate + batched Doc / Review scope
  |                +-- public tree + queued operations -> target tree
  |                +-- Q -> ArticleBody; public baseline -> ArticlePublicBody
  |                +-- Cover / FAQ / links + concrete revision fields
  +-- Approval -> public or latest sealed approval comparison
  |                +-- policy command -> revision + Activity
  |                +-- approval command -> fixed Snapshots + structured validation
  |                +-- committed Outbox -> workflow -> per-user status notices
  +-- History -> permanent site ownership -> Release / Snapshot reads
                   +-- explicit restore -> history + edit permissions
                         +-- no D: fork selected Snapshot to a new D
                         +-- existing D: freeze old content, replace with revision check
                         +-- Public and Q remain unchanged
```

- 新增 `CMS.DocTree.Publication` Facade，`Query` 负责只读一致性与读取，`Presentation` 负责 Cover / 设置投影，`Effects` 负责事务内 Outbox，`Notifications` 负责状态投递及接收人读取。Gate 使用批量 `DocsContent` 查询，避免逐篇 edit 检查；预览权与编辑权分离，Review 限制每次重新判断。
- 单次预览使用 PostgreSQL `REPEATABLE READ READ ONLY`。跨请求传递并逐项核对 `public_release_id`、`queue_revision`、`public_presentation_revision`、`approval_policy_revision`、`approval_id`、`planner_version`；拒绝过期版本，前端清空旧内容后显式刷新。读取不创建 Queue / D / Snapshot，不缓存已授权正文。
- 预览只合成公开基线和已入队变更，不混入未入队 D / 工作区目录。目录、完整正文、Cover 卡片 / pinned docs、FAQ 和站内链接同次投影；前端复用 DocCovers，将站内链接导向预览中的 Article。Cover / 相关 Dashboard 设置写入同事务推进 presentation revision。
- 审批配置有独立权限、policy revision、Receipt 与 Activity 审计。比较基线可选择当前公开内容或最近一次已封存审批；即使审批已失效，仍展示其固定内容。界面比较目录、Plate 块（包括顺序、格式与链接属性）、文章字段、tag ID、封面及资产配置；批准仍使用既有整队命令及结构化校验。
- 审批通过与有效审批失效，向队列贡献者、审批时贡献者及审批人发送不含正文的状态通知。事务内写 Outbox，Oban 经 `CMS.deliver_outbox(:docs, job)` 及 Workflow 领取后投递；投递前复核接收人的当前站点权限，接收表以 event / user 唯一键防重复。通知显示在发布抽屉内，每 15 秒更新；未接入站外邮件或通用消息中心。
- Release 列表按 ID 游标，Snapshot 按 captured_at / ID 游标分页。Release 详情使用保存的目录快照及对应有效 ArticleSnapshot，不从当前工作区拼历史。跨站、未授权与非法 Snapshot / 游标拒绝。
- `DocsHistoryOwner` 保存 Doc 的原始社区归属，与活动 binding / Lifecycle 分离。单篇 Trash 永久清理后历史仍可读；不恢复公开入口、不按时间删除 Snapshot。旧 binding 删除 guard 及社区聚合删除仍属 R7，本批没有清理它们。
- 从一个 Snapshot 恢复是显式 Command。创建新 D 或校验现有 D 的 ID / revision；已有保存内容先 Freeze，再写入所选 Snapshot 的完整正文、字段、标签、Cover 和引用。重放返回原始结果，旧身份拒绝；不修改来源 Snapshot、不发布、不入队、不回滚整个 Release。前端有二次确认及未保存编辑保护。

## 迁移与接口

新增迁移：

| 文件                                                       | 用途                                        |
| ---------------------------------------------------------- | ------------------------------------------- |
| `20261112170000_create_docs_publication_notifications.exs` | 持久化 per-user 状态通知                    |
| `20261112180000_add_docs_approval_policy_activity.exs`     | Activity action 约束增加审批策略变更        |
| `20261112190000_create_docs_history_owners.exs`            | 历史社区归属；严格拒绝非空 Doc 聚合，不回填 |

GraphQL 新增 `docsQueuePreview`、`docsApprovalDiff`、`docsQueuePolicy`、`docsReleaseHistory`、`docsReleaseDetail`、`docsSnapshotHistory`、`docsPublicationNotices`、`configureDocsQueue`、`restoreDocsSnapshot`；审批沿用 `approveDocsQueue`。SDL、静态操作清单、generated types 同步。预览与历史返回完整版本化投影 JSON；写命令继续使用 Command Receipt。

## 验证记录

| 检查              | 实际结果                                                                                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 空隔离库完整迁移  | `groupher_docs_b0_r06_final` 通过；目标环境未执行                                                                                                                                                                                                                                                                                                    |
| R6 真实数据库脚本 | `scripts/docs_publication_r6_verify.exs` 通过：Q / Public 与 D 隔离、旧版本拒绝、Cover revision、GraphQL 配置及重放、自批拒绝、审批 / 公开两类 diff、通知重复投递、未授权接收人拒绝与真实 Outbox Workflow 重放、历史分页及跨站拒绝、Snapshot 恢复及旧 D revision、Trash 清理后历史、Review 重新校验、待删除内容比较、config-only 权限与 SQL 只读约束 |
| 后端聚焦套件      | **71 tests / 0 failures**：计划、审批状态、目录操作、锁、内容比较 / 丢弃、PublicBody、WorkingCopy GraphQL 与删除 Pipeline                                                                                                                                                                                                                            |
| 扩大后端回归      | **96 tests / 19 failures**；18 项旧 Docs release / concurrency 测试仍访问已移除的 `docs_site_states`，1 项旧 Assets usage 查询仍 join 旧 Draft / Revision 表，属 R7 待改接；未宣称全量后端通过                                                                                                                                                       |
| 前端聚焦套件      | **58 tests / 14 files 通过**：版本固定、拒绝后清空、迟到请求 / 命令、配置独立读取、Cover 投影、正文 / tag diff，以及既有 Q / 冲突 / D 编辑 hooks 回归                                                                                                                                                                                                |
| 类型与 GraphQL    | Core type-check、repository / static / generated contract 通过（60 source files）                                                                                                                                                                                                                                                                    |
| 架构与编译        | `mix compile --warnings-as-errors`、`mix lint.context` 通过（0 findings）                                                                                                                                                                                                                                                                            |
| 文档检查          | scanner 11 tests 通过；仍被既有 7 个文档覆盖缺口阻断（OneOfValidation 与 Gate snapshot loader），本批新增缺口已修复                                                                                                                                                                                                                                  |

| R5 真实数据库回归 | 干净 D 删除 / 显式初始化 / 冲突与 Receipt、Trash 恢复 / 回滚、两连接保存和发布交错通过 |
| Core lint | 通过（exit 0），保留既有警告 |
| `mix lint.style` | 仍为既有 56 项 module style 问题；本批新增 alias 问题已修复，聚合任务后续 inline-do 检查未执行；本批新模块单独 inline-do 检查通过 |

浏览器 Chrome 在 `/home/xx` 隔离 harness 加载实际 Publication drawer / panes / hooks，模拟 API、宿主 Drawer 与环境 hooks：目录选择、站内正文链接留在预览、版本变化清空旧正文、Release / Snapshot 导航、恢复二次确认与仅一次写入、审批策略显式保存、两类基线切换与批准仅一次写入均通过。该检查不覆盖真实身份认证或完整 Dash 视觉布局。

复跑 R6 脚本（工作目录 `backend/api`，只允许已迁移的可丢弃测试库）：

```sh
TEST_DB_NAME=groupher_docs_b0_r06_final \
DOCS_B0_DISPOSABLE_DATABASE=groupher_docs_b0_r06_final \
MIX_ENV=test mix run scripts/docs_publication_r6_verify.exs
```

## 未覆盖边界

源码格式与 `git diff --check` 已检查；未提交或推送。

本批不执行目标环境迁移、真实服务认证 / 外部 Search / CDN 投递验收，也不删除旧 Branch / Draft / Checklist / Revision API、Import 或 Cover 的旧底层依赖。R7 继续处理这些入口和社区历史聚合删除；R8 负责目标环境切换及完整产品联调。浏览器隔离 harness 使用实际 Publication 组件 / hooks 和模拟传输，不等于真实账号和完整 Dash 宿主验收。
