# Passport P0：旧调用方和通知切换清单（源码盘点）

此清单记录源码命中及负责批次，不代表批次已完成。逐键目标见 [Action 对照表](passport-p0-action-mapping.md)；实际存量值、未知类型、外部 SQL / 消费者仍需在目标环境只读核对。这里不记录账号授权内容。代码中的动态调用、宏展开、拼接名称及间接 producer 须随实现再次追踪；不能将字符串扫描当作全覆盖证明。

## 关键路径和批次

| 范围                                                                         | 源码依据                                                                                                                                                                                     | 实施归属                                                                                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 唯一目录及 Global / Community 事实、actor 绑定                               | `packages/contracts/gate.contract.json`、`cms/passport/{catalog,store}.ex`、`gate_action.ex`                                                                                                 | P1；SQL 关系过滤与实际消费者验证尚需验收                                                                                                                                                                                                                          |
| 旧 Registry / requirement、middleware、FrontDesk owner 注入和 `cur_passport` | `helper/permission_{config,registry}.ex`、`cms/passport/{registry,authorization,assignment}.ex`、`groupher_server_web/middleware/{passport,front_desk}.ex`、`groupher_server_web/context.ex` | 逐消费方 P2 / P2B / C3 / D1 / D2 切换；P4 最终移除，不能仅删映射                                                                                                                                                                                                  |
| Moderator 创建、授权与 Community 管理                                        | `cms/communities/moderators/{setup,persist,query}.ex`、`commands/update_passport.ex`、`cms/communities/passport.ex`、Community schema / resolver / Dashboard Admin                           | P2；本地普通 Article 下线 / 恢复为 P2B                                                                                                                                                                                                                            |
| 旧 Doc 编辑与 Trash                                                          | `gate/access/policy/article.ex`、`gate/scope/docs_content.ex`、DocTree 读写及 Dashboard Docs                                                                                                 | 正文 D1；`doc.trash` 所有读写、旧 GraphQL 字段和 UI 同批 D2，不能提供旧 alias                                                                                                                                                                                     |
| Insights、Review、Ticket、Comment、限流                                      | `analysis/article_insights/query.ex`、`cms/insights/query.ex`、`gate/scope/{review_read,ticket}.ex`、`gate/access/policy/comment.ex`、`gate/rate_limit/`                                     | P2 处理 Community scope；Article 关系 C3、Doc 正文 D1；逐实际入口核对范围，P4 查漏                                                                                                                                                                                |
| 平台审核及举报                                                               | `cms/review/commands/{decide,recheck}.ex`、`alert_wall/{query,commands/resolve}.ex`                                                                                                          | 平台审核 action 通过 `Passport.Authorization.check` 使用 P1 Global 事实；同文件社区审核 action 属 P2，需按已定位 Community 切换                                                                                                                                   |
| 资产权限冲突                                                                 | `assets/commands/{register,archive,restore,delete}.ex`、`schema/cms/mutations/community.ex`、`schema/cms/cms_queries.ex`                                                                     | P2：命令当前 Gate 使用 Global `community.update`；注册 GraphQL 也是 update，但 upload intent、delete GraphQL 和资产查询使用 Community `asset.upload`。逐入口核对目标权限并同批统一领域 Gate / middleware；以跨 scope 正反例验收，不能给测试账号全局 root 掩盖差异 |
| 生产 seed 和清理                                                             | `cms/production_seed/{bootstrap,cleanup,content,references}.ex`、`cms/seeds/{articles,lite_home}.ex`                                                                                         | 随被调用授权入口 P1/P2/C3/D1 同步改造，P4 确认无旧写 / 临时旧 root；清理仍需保留真实数据保护                                                                                                                                                                      |
| Community Application 后台任务                                               | `jobs/{create_community,expire_community_application_logo_uploads,expire_community_applications,release_expired_community_slug_claims}.ex`                                                   | 任务与 application / setup 的调用链、系统 actor 和重试归 P1 Global 准入及 P2；P3 同批核对通知，P4 查漏                                                                                                                                                            |
| 前端认证、权限编辑与 GraphQL 生成                                            | `frontend/core/hooks/useGate/`、`unit/PassportEditor/`、`stores/account/`、`schemas/pages/user.ts`、Account / CMS GraphQL schema 和 resolver                                                 | P1 事实与目录；P2 编辑与管理，C3 / D1 分别接 Article / Doc；P4 清除 passportString 和旧生成类型                                                                                                                                                                   |
| 支持工具及测试                                                               | `support/{factory,conn_simulator}.ex`，相关测试及 GraphQL fixtures                                                                                                                           | 随各批次切换，P4 再检查；fixture 内旧 root 不得当作新授权证据                                                                                                                                                                                                     |

### 动态入口与当前迁移状态

此节记录本次源码核对，不代表全部 Action 的调用链已证明覆盖。实施对应批次时仍须核对实际资源定位、授权和生成产物，并补充新发现的调用方。

| 入口 / 调用链                                                                                                                           | 当前状态与后续归属                                                                                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema/helper/mutations.ex` 的 Article 宏                                                                                              | 动态拼接 `<thread>.pin`、`undo_pin`、`sink`、`undo_sink`、`lock_comment`、`undo_lock_comment` 并注入 Passport middleware；字面 Action 搜索不能展开这些调用。P2 按实际 thread 与 Community 管理动作切换，Article 身份路径随 C3、Doc 路径随 D1 核对；不能把旧字符串映射当成新合同。 |
| `middleware/passport.ex`、`passport/authorization.ex`                                                                                   | Catalog 已识别的 Global Action 读取新 Global scope；其余及未识别 Action 仍走旧 Registry / `cur_passport`。P2、P2B、C3、D1、D2 分别切换其资源入口，P4 删除旧分支和 CMS facade 中 Registry / Authorization 转发。                                                                   |
| `gate/access/policy/application.ex`、`community_applications/review_auth.ex`                                                            | Application reviewer 通过 `Passport.check` 使用新 Global 事实；仍须逐 Action 测试 Gate、middleware、任务和 facade，不能以单一路径通过代表全部调用方已迁移。                                                                                                                       |
| `gate/scope/{review_read,ticket}.ex`、`review/commands/{decide,recheck}.ex`、Article / Community policy                                 | 平台审核 Global 判断与社区审核是不同范围；仍有 Registry / Authorization 旧读取。P2 按已定位 Community 切换社区审核、Ticket 和 Comment；Article 及 Doc 对应 C3 / D1，权限判断与 Lifecycle 保持分离。                                                                               |
| `resolvers/content_import_resolver.ex:check_passport`                                                                                   | 直接调用旧 `Registry.allowed?` 和 `cur_passport`；D1 随 Doc 导入的正文准入一起切换，不能只改 start / apply 的 middleware。                                                                                                                                                        |
| `frontend/core/hooks/useGate/`、`frontend/apply`                                                                                        | 使用生成的 Action metadata 与当前 actor Global / Community facts；Article 授权尚未在 hook 启用，C3 / D1 接入时补对应事实与缓存失效。                                                                                                                                              |
| `frontend/core/unit/PassportEditor/`、`stores/account/provider.tsx`、`frontend/dash/src/server/community.ts`、Account Passport resolver | 编辑器仍读取 `passportString` 和账户旧 passport，并调用旧 Moderator 写接口；账户 / SSR 仍携带旧投影。P2 用成员与新授权事实替换编辑器和管理入口，P4 核查剩余账户投影 / GraphQL / codegen 并退役旧协议。                                                                            |
| `production_seed/{bootstrap,content,references,cleanup}.ex`、`cms/seeds/articles.ex`                                                    | 仍有旧 get / stamp 或临时旧 root 调用；P1 seed 依照下方所有权边界完成新事实及失败回滚验证，后续 P2 / C3 / D1 检查各自入口，不能将新 DDL 本身当成 seed 完成。                                                                                                                      |
| `helper/permission_config.ex` 的 `system_notification.publish`                                                                          | 旧配置与前端文案仍有该键；当前源码搜索未发现对应生产写入口。P3 盘点真实通知生产者并确定去留，未定位入口不得视为新合同已消费。                                                                                                                                                     |

### P1 可执行验收清单

以下是验收步骤，不是已通过声明；测试数据库与构建目录须与其他并发工作隔离。旧键逐项范围见 [Action 对照表](passport-p0-action-mapping.md)，grant-only 及动态入口见本清单和 [盘点基线](passport-p0-inventory.md)。目标环境旧值、未定位的动态调用与外部消费者仍须在对应批次核对，不能把源码关键字命中当成全部 producer 的证明。

1. 在 `packages/contracts` 执行 `node --test scripts/validate-gate-contract.test.mjs` 和 `node scripts/generate-gate-contract.mjs --check`，检查重复生成名、未知 / 跨 scope 依赖、循环及 thread 元数据；同时验证 Gate 的 TS / Elixir 产物来自同一合同。
2. 在隔离测试库运行 `mix test test/groupher_server/cms/passport/gate_action_contract_test.exs test/groupher_server/cms/passport/catalog_parity_test.exs`：逐 Action 核对 JSON 的 scope、grantable、静态 / thread 依赖与 Catalog，并核对 GraphQL `PassportAction` 值集合及 Article thread；再执行 GraphQL codegen freshness 检查和前端 `useGate` 测试，验证生成枚举与 `GATE_ACTION` 一致。
3. 在全新隔离库执行完整迁移，验证非空 Community ref 回填 / 重跑 / 冲突和不可变约束、Global / Admin 授权 DDL、root / lord、非法权限失败关闭、actor / scope 绑定和 CAS 竞争；不能用手工修补的旧库代替迁移验收。须显式启用隔离测试标记后运行对应 ref 并发用例。
4. 验证本批 Global 消费者及 self facts 的匿名、跨 actor、root 和脏权限负例；按上表登记 Community、Article、Doc 与旧 Registry / middleware、宏、seed / job 的后续归属。P1 不要求 P2 / C3 / D1 / D2 的旧消费者提前切换，但未切换的开发中间态不可发布。
5. 验证 production seed bootstrap / 重跑 / retain / purge、临时 root 的异常回滚和跨事务并发、授权行身份 / revision 保护以及 Mention 目标预锁。seed 相关测试及当前运行结果单独记录；未全部通过前不标记 P1 完成。

### Production seed 特权迁移边界

`production_seed/workflow.ex`、`content.ex`、`references.ex` 和 `cleanup.ex` 各自拥有事务；bootstrap 当前以 manifest 记录旧 Passport 快照，cleanup 校验快照后删除旧行。新 Global / Community 行不能绕开同一所有权检查：manifest 应记录受控行的 scope、主体、行身份、revision 和 seed 写入后的预期事实；遇到未知既存行、额外授权或 revision 改变必须阻断，不能把整行覆盖或删除。cleanup 在持锁后重验这些事实，只撤销明确由 seed 创建且未被外部修改的权限和成员关系；保留模式、失败回滚及重跑都须验证，不能因旧 manifest 缺新字段而猜测所有权。

`content.ex` / `references.ex` 目前对 publisher 使用进程内临时旧 root，并明确承诺不持久化角色。切换新事实时不得直接给真实 author 留下全局 root；必须在受控的同一数据库事务中取得规定顺序的用户 / Passport 锁，校验已有事实和并发版本，临时授权后在提交前恢复原事实（首次建行则删除临时行），任一失败整体回滚。不能把临时 root 提交后再异步删除；也不能回滚他人的并发更改。若命令本身独立提交或需要更早的锁，该方案不成立，须调整领域入口而不是增加长期 root。该方案尚需逐路径验证事务嵌套、锁序、外部读取与测试；目前不能声称 seed 切换完成。

## 通知生产者、投递及消费者（P3 同批直切）

| 源码                                                                                                               | 当前路径 / 核对点                                                                                              |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `cms/events/notify.ex`                                                                                             | comment、reply、upvote、collect 及撤销；含变量 action，追踪事件分发，保留聚合和撤销                            |
| `accounts/events/notify.ex`                                                                                        | follow 与撤销；保留聚合和已读状态                                                                              |
| `cms/outbox/workflow/interaction.ex`                                                                               | interaction 变化向 Events 分发，delivery key 与重试保持一致                                                    |
| `cms/tickets/{persist,effects/notifications}.ex`、`cms/outbox/workflow/ticket.ex`                                  | ticket 活动投递，action 包含 ticket_status、ticket_visibility、ticket_update；核对所有 event_type 与去重       |
| `cms/artiment_mentions/{capture,effects, effects/notifications}.ex`、`cms/outbox/workflow/mention_notification.ex` | Mention 捕获和异步投递，仍属独立 Mention 流，不将 Mention 当作普通活动通知                                     |
| `cms/doc_tree/{publish/approval,publish/queue/store,publication/notifications}.ex`、`cms/outbox/workflow/docs.ex`  | 审批状态事务事实与异步投递，不能丢失重试和状态边界                                                             |
| `cms/articles/effects/publish.ex`、`accounts/profiles/effects.ex`、`messaging/notify.ex`                           | 当前 Notify.dispatch 是空壳；新 Article、注册 / 欢迎事件须核对真实业务意图并接入明确入口，不能假定已有实际投递 |
| `messaging/{commands,notifications,inbox}.ex` 及其子目录                                                           | 创建 / 聚合 / 撤销、Delivery claim、模型、读取和已读迁移；唯一索引与 FK、现有 SQL / 外部消费者另行盘点         |
| `accounts/mailbox/`、Account GraphQL schema / resolver、Inbox UI / codegen                                         | 两物理流的未读投影、读状态与字段整体切换；不得留下旧公开字段 alias                                             |

P3 的 Notice 合同必须包括源码所有合法活动和请求分支；代码里 `action` 有动态传入，不应把上表有限实例当成穷尽枚举。历史大小写和实际存量值需只读统计；未知值阻断迁移。请求通知在 P2 基座上由 P3 闭环，C1 消费该闭环。

## 源码命中索引

以下文件基于本次 `rg` 字面搜索；它包括新实现、测试辅助和间接引用，因此命中不是“仍未迁移”的结论。漏掉动态引用仍需补查；变更时以文件内实际入口和上述批次为准。

### 权限 / Passport 命中

- `backend/api/lib/groupher_server/accounts/model/user.ex`
- `backend/api/lib/groupher_server/analysis/article_insights/query.ex`
- `backend/api/lib/groupher_server/cms.ex`
- `backend/api/lib/groupher_server/cms/article_path.ex`
- `backend/api/lib/groupher_server/cms/communities.ex`
- `backend/api/lib/groupher_server/cms/communities/moderators/commands/update_passport.ex`
- `backend/api/lib/groupher_server/cms/communities/moderators/persist.ex`
- `backend/api/lib/groupher_server/cms/communities/moderators/query.ex`
- `backend/api/lib/groupher_server/cms/communities/moderators/setup.ex`
- `backend/api/lib/groupher_server/cms/communities/passport.ex`
- `backend/api/lib/groupher_server/cms/communities/setup.ex`
- `backend/api/lib/groupher_server/cms/community_applications.ex`
- `backend/api/lib/groupher_server/cms/community_applications/review.ex`
- `backend/api/lib/groupher_server/cms/community_applications/review_auth.ex`
- `backend/api/lib/groupher_server/cms/gate.ex`
- `backend/api/lib/groupher_server/cms/gate/access/load/query.ex`
- `backend/api/lib/groupher_server/cms/gate/access/policy/application.ex`
- `backend/api/lib/groupher_server/cms/gate/access/policy/article.ex`
- `backend/api/lib/groupher_server/cms/gate/access/policy/comment.ex`
- `backend/api/lib/groupher_server/cms/gate/access/policy/community.ex`
- `backend/api/lib/groupher_server/cms/gate/context/access/article.ex`
- `backend/api/lib/groupher_server/cms/gate/context/access/comment.ex`
- `backend/api/lib/groupher_server/cms/gate/context/access/community.ex`
- `backend/api/lib/groupher_server/cms/gate/context/access/doc.ex`
- `backend/api/lib/groupher_server/cms/gate/context/scope/article.ex`
- `backend/api/lib/groupher_server/cms/gate/rate_limit/publish.ex`
- `backend/api/lib/groupher_server/cms/gate/rate_limit/publish/workflow.ex`
- `backend/api/lib/groupher_server/cms/gate/scope/docs_content.ex`
- `backend/api/lib/groupher_server/cms/gate/scope/review_read.ex`
- `backend/api/lib/groupher_server/cms/gate/scope/ticket.ex`
- `backend/api/lib/groupher_server/cms/gate_action.ex`
- `backend/api/lib/groupher_server/cms/insights/query.ex`
- `backend/api/lib/groupher_server/cms/model/community.ex`
- `backend/api/lib/groupher_server/cms/model/community_admin.ex`
- `backend/api/lib/groupher_server/cms/model/global_passport.ex`
- `backend/api/lib/groupher_server/cms/model/passport.ex`
- `backend/api/lib/groupher_server/cms/passport.ex`
- `backend/api/lib/groupher_server/cms/passport/assignment.ex`
- `backend/api/lib/groupher_server/cms/passport/authorization.ex`
- `backend/api/lib/groupher_server/cms/passport/catalog.ex`
- `backend/api/lib/groupher_server/cms/passport/error_cat.ex`
- `backend/api/lib/groupher_server/cms/passport/legacy_conversion.ex`
- `backend/api/lib/groupher_server/cms/passport/legacy_plan.ex`
- `backend/api/lib/groupher_server/cms/passport/registry.ex`
- `backend/api/lib/groupher_server/cms/passport/scope/article.ex`
- `backend/api/lib/groupher_server/cms/passport/scope/community.ex`
- `backend/api/lib/groupher_server/cms/passport/scope/community_grant.ex`
- `backend/api/lib/groupher_server/cms/passport/scope/global.ex`
- `backend/api/lib/groupher_server/cms/passport/scope/global_grant.ex`
- `backend/api/lib/groupher_server/cms/passport/store.ex`
- `backend/api/lib/groupher_server/cms/production_seed/bootstrap.ex`
- `backend/api/lib/groupher_server/cms/production_seed/cleanup.ex`
- `backend/api/lib/groupher_server/cms/production_seed/content.ex`
- `backend/api/lib/groupher_server/cms/production_seed/references.ex`
- `backend/api/lib/groupher_server/cms/review/commands/decide.ex`
- `backend/api/lib/groupher_server/cms/review/commands/recheck.ex`
- `backend/api/lib/groupher_server/cms/review/decisions.ex`
- `backend/api/lib/groupher_server/cms/review/notice.ex`
- `backend/api/lib/groupher_server/cms/seeds/articles.ex`
- `backend/api/lib/groupher_server/cms/seeds/lite_home.ex`
- `backend/api/lib/groupher_server/error_cat/workflow.ex`
- `backend/api/lib/groupher_server/review_bot/authorization.ex`
- `backend/api/lib/groupher_server_web/context.ex`
- `backend/api/lib/groupher_server_web/middleware/passport.ex`
- `backend/api/lib/groupher_server_web/resolvers/accounts/passport.ex`
- `backend/api/lib/groupher_server_web/resolvers/cms/passport.ex`
- `backend/api/lib/groupher_server_web/resolvers/content_import_resolver.ex`
- `backend/api/lib/groupher_server_web/schema/account/account_queries.ex`
- `backend/api/lib/groupher_server_web/schema/account/spec.ex`
- `backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex`
- `backend/api/lib/groupher_server_web/schema/cms/content_import.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/comment.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/community.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/dashboard.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/operation.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/post.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/ticket.ex`
- `backend/api/lib/groupher_server_web/schema/cms/press/mutations.ex`
- `backend/api/lib/groupher_server_web/schema/helper/fields.ex`
- `backend/api/lib/groupher_server_web/schema/helper/mutations.ex`
- `backend/api/lib/helper/permission_config.ex`
- `backend/api/lib/helper/permission_registry.ex`
- `backend/api/lib/mix/tasks/passport.legacy_report.ex`
- `backend/api/lib/support/conn_simulator.ex`
- `backend/api/lib/support/factory/factory.ex`
- `frontend/core/hooks/useGate/index.test.tsx`
- `frontend/core/hooks/useGate/index.ts`
- `frontend/core/lib/i18n/en/passport.ts`
- `frontend/core/lib/i18n/zh/passport.ts`
- `frontend/core/lib/signal.ts`
- `frontend/core/schemas/feature.schema.test.ts`
- `frontend/core/schemas/pages/user.ts`
- `frontend/core/spec/account.d.ts`
- `frontend/core/stores/account/provider.test.tsx`
- `frontend/core/unit/DsbThread/Admin/List.tsx`
- `frontend/core/unit/DsbThread/Admin/index.tsx`
- `frontend/core/unit/DsbThread/schema/admins.ts`
- `frontend/core/unit/PassportEditor/Selects.tsx`
- `frontend/core/unit/PassportEditor/StackedRuleItem.tsx`
- `frontend/core/unit/PassportEditor/index.tsx`
- `frontend/core/unit/PassportEditor/schema.ts`
- `frontend/core/unit/PassportEditor/spec.d.ts`
- `frontend/core/unit/PassportEditor/useLogic.test.tsx`
- `frontend/core/unit/PassportEditor/useLogic.ts`

### Notification / Inbox 命中

- `backend/api/lib/groupher_server/accounts.ex`
- `backend/api/lib/groupher_server/accounts/mailbox.ex`
- `backend/api/lib/groupher_server/accounts/mailbox/effects.ex`
- `backend/api/lib/groupher_server/accounts/mailbox/projection.ex`
- `backend/api/lib/groupher_server/accounts/mailbox/query.ex`
- `backend/api/lib/groupher_server/accounts/mailbox/workflow.ex`
- `backend/api/lib/groupher_server/accounts/model/embeds/user_mailbox.ex`
- `backend/api/lib/groupher_server/accounts/model/user.ex`
- `backend/api/lib/groupher_server/accounts/profiles/effects.ex`
- `backend/api/lib/groupher_server/accounts/profiles/persist.ex`
- `backend/api/lib/groupher_server/accounts/publish/comments.ex`
- `backend/api/lib/groupher_server/cms.ex`
- `backend/api/lib/groupher_server/cms/articles/effects/publish.ex`
- `backend/api/lib/groupher_server/cms/artiment_mentions/effects.ex`
- `backend/api/lib/groupher_server/cms/artiment_mentions/effects/notifications.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/publication/notifications.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/publish/approval.ex`
- `backend/api/lib/groupher_server/cms/doc_tree/publish/queue/store.ex`
- `backend/api/lib/groupher_server/cms/model/docs_publication_notification.ex`
- `backend/api/lib/groupher_server/cms/outbox/workflow.ex`
- `backend/api/lib/groupher_server/cms/outbox/workflow/docs.ex`
- `backend/api/lib/groupher_server/cms/outbox/workflow/mention_notification.ex`
- `backend/api/lib/groupher_server/cms/outbox/workflow/ticket.ex`
- `backend/api/lib/groupher_server/cms/tickets/effects.ex`
- `backend/api/lib/groupher_server/cms/tickets/effects/notifications.ex`
- `backend/api/lib/groupher_server/cms/tickets/notifications.ex`
- `backend/api/lib/groupher_server/cms/tickets/persist.ex`
- `backend/api/lib/groupher_server/messaging.ex`
- `backend/api/lib/groupher_server/messaging/commands/revoke_notification.ex`
- `backend/api/lib/groupher_server/messaging/commands/send_mention.ex`
- `backend/api/lib/groupher_server/messaging/commands/send_notification.ex`
- `backend/api/lib/groupher_server/messaging/inbox.ex`
- `backend/api/lib/groupher_server/messaging/inbox/persist.ex`
- `backend/api/lib/groupher_server/messaging/mentions/persist.ex`
- `backend/api/lib/groupher_server/messaging/mentions/query.ex`
- `backend/api/lib/groupher_server/messaging/model/mention.ex`
- `backend/api/lib/groupher_server/messaging/model/notification.ex`
- `backend/api/lib/groupher_server/messaging/notifications.ex`
- `backend/api/lib/groupher_server/messaging/notifications/delivery.ex`
- `backend/api/lib/groupher_server/messaging/notifications/persist.ex`
- `backend/api/lib/groupher_server/messaging/notifications/query.ex`
- `backend/api/lib/groupher_server_web/resolvers/accounts/mailbox.ex`
- `backend/api/lib/groupher_server_web/schema/account/account_metrics.ex`
- `backend/api/lib/groupher_server_web/schema/account/account_mutations.ex`
- `backend/api/lib/groupher_server_web/schema/account/account_queries.ex`
- `backend/api/lib/groupher_server_web/schema/account/spec.ex`
- `backend/api/lib/helper/orm.ex`
- `frontend/core/assets/icons/raw/lucide/mailbox.svg`
- `frontend/core/ui/IconHub/icons.ts`
