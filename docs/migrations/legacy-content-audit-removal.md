# 旧内容 Audit 全链路退役

> 状态：2026-10-22 当前工作树已完成 D1–D5 运行时删除与本地 schema 清理；旧链扫描、全套测试和旧数据库 key 断言通过。目标环境停旧 worker/cron、维护窗口迁移仍待 N8 执行。以 [AlertBoard 批次记录](../feature/alert-board/delivery.md) 为当前实现快照。
> 证据基于当前共享工作树，不代表远端分支或生产状态；工作树包含未提交的并行修改。
> 新合同：[AlertBoard / ReviewBot](../feature/alert-board/design.md)；逐文件证据：[扫描清单](./legacy-content-audit-inventory.md)。

## 0. 全链路删除合同（已确认）

旧内容 Audit 是整套删除，不是升级、改名或兼容迁移。`legal / illegal / audit_failed` 的
协议、执行器、写入入口、字段、枚举、过滤、投影算法、对外字段和客户端消费者全部退出运行时。
不保留旧 facade 转发、adapter 包装、字段别名、默认值占位、fallback、shadow read、双读或双写；
不提供“新机制不可用时退回旧审核”的开关，不把旧状态翻译成新状态继续执行。

```text
停旧 producer / cron / 在途任务
 -> 删除旧外部接口、配置与专用依赖
 -> 删除旧 command / 结果解析 / 状态存储
 -> 删除旧 Gate 条件、投影算法、GraphQL 与前端合同
 -> 删除专用测试、生成物中的旧协议与失效设计
 -> 独立验收旧链已清空
 -> 按 AlertBoard / ReviewBot 新合同实现
```

保留的是资源加载、Gate/Lifecycle、公开投影、搜索、缓存、统计、通知等通用基础能力，
不是旧审核实现。一次性 DDL 迁移只把仍限制公开的存量目标写成新的 platform restriction 与待处理 AlertBoard Case，
让旧 Gate 的封锁结果在切换时不意外公开；它不复制 `legal/illegal/audit_failed` 值、理由、provider 结果或旧协议，
也不构成运行时兼容。其余新事实从新配置与权威模型建立，不继承旧状态值或投影分歧。
删除阶段可以独立完成；新审核未实现的中间版本不得作为审核已就绪的生产版本发布。
本轮只更新实施合同，不执行代码、数据库、队列或外部账户删除。

## 1. 实际扫描范围与限制

扫描 backend、frontend、packages、contracts、infra、local、ops、scripts、.github 和 docs，
包含隐藏的仓库配置文件；另外遍历本地 .env/config 示例类文件，仅提取命中键名和路径，不输出值。
排除依赖、构建输出、Git 数据和 crash dump；历史 migration 与生成文件分别分类。
CodeGraph 本次没有返回目标 Elixir 实现，因此使用字面扫描和已定位源码读取核对链路。

已核对外部请求构造、producer/consumer、状态写入、Gate 查询、GraphQL schema、前端消费者和副作用。
静态命中不等于线上调用；没有连接生产数据库、队列、百度控制台或部署平台 secret store。
外部账户、已排队任务数量和生产密钥实际使用情况必须在实施 cutover 时验证，不能声称已清空。

## 2. 当前真实路径

```text
Article / main Doc 发布
 -> Articles.Effects.Publish.run_public_effects
 -> Search enqueue / Press invalidate / sync_mentions
 -> CMS.Events.emit(:audition)
 -> CMS.Events.route -> CMS.Events.Audition.handle
 -> Helper.AuditBot.analysis(:text, ...)
 -> 百度文本审核
 -> Articles.set_illegal / unset_illegal / set_audit_failed
 -> Articles.Commands.Moderate -> Gate :moderate
 -> Articles.Moderation.set_state
 -> Article 或 DocBranchState + Public/Binding + user meta + 派生效果

Comment create / reply / update
 -> RequiredJobs.audition（aggregate transaction 内必需 enqueue）
 -> Jobs.audition -> Jobs.Workflow -> Jobs.Comments
 -> args.type = audition, version = 1, payload.comment_id
 -> Comments.Effects.deliver(:audition)
 -> Events.Audition -> AuditBot
 -> Comments.Audit -> Comments.Commands.Moderate -> Comments.Moderation
 -> Comment.pending / meta + author meta + user cache revalidate

定时补偿
 -> Helper.Scheduler.articles_audition（仅 Post/Blog）
 -> Helper.Scheduler.comments_audition
 -> 失败状态分页 -> emit(:audition)
```

Article 路径是 post-commit effect 中直接 emit，不应误写成所有审核都已经可靠入 Oban。
Doc preview 分支当前 Publish effect 直接返回；main 进入公共 effect。
Comment 则要求 create/reply/update 事务内 enqueue 成功；删除旧 RequiredJobs 及其调用/专用测试；新机制独立建立所需的可靠任务登记，不能通过旧 audition 接口转发。

## 3. 删除与替代矩阵

以下 `cms/...`、`jobs...`、`accounts/...` 路径以 `backend/api/lib/groupher_server/` 为基准；
`helper/...` 以 `backend/api/lib/` 为基准。前端、配置与标明完整前缀的路径均为仓库相对路径。
逐文件行号和测试清单在扫描附录；表内是语义处理决定。

| 链路             | 当前入口/文件                                                                                                               | 删除或替代                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 检测执行         | `helper/audit_bot.ex`；`cms/events/audition.ex`                                                                             | 整体删除，包括 analysis_wrong/handle_edge、样例正文、provider 解析和旧 error map；ReviewBot 重建独立 adapter，不包装旧模块 |
| 事件路由         | `cms/events.ex` 的 `route(:audition)`                                                                                       | 只删旧 route；保留 sync_mentions 等其他事件                                                                                |
| Article producer | `cms/articles/effects/publish.ex`                                                                                           | 删 audition emit；提交事务按模式登记新检查/限制，公开副作用按有效可见性投递                                                |
| 评论 producer    | `cms/comments/commands/create.ex` 两处 create/reply；`commands/update.ex`；`required_jobs.ex`                               | 删除 RequiredJobs.audition 及 create/reply/update 调用和专用模块；新检查的原子登记按新合同另建，不保留旧 wrapper           |
| Jobs             | `jobs.ex`、`jobs/workflow.ex`、`jobs/comments.ex`、`cms/comments/effects.ex`                                                | 删除 audition facade、类型和 deliver 分支；保留共享 worker 中 mentions/notify/subscription/participants 工作               |
| Scheduler        | `helper/scheduler.ex`                                                                                                       | 删除 articles_audition/comments_audition/audit_articles；保留 archive/purge/cache hook                                     |
| Article 写 API   | `cms/articles.ex` 的 set_illegal/unset_illegal/set_audit_failed；`articles/commands/moderate.ex`；`articles/moderation.ex`  | 删除旧协议与实现；领域新 Command 执行 AlertBoard 决定，复用 canonical load/Gate/事务                                       |
| Comment 写 API   | `comments/audit.ex`、`comments/commands/moderate.ex`、`comments/moderation.ex`                                              | 删除旧 API 和 pending/error 混用；评论新 Command 施加/解除对应限制                                                         |
| 失败列表         | `cms.ex`、`articles.ex`、`comments.ex` 的 audit_failed delegates；上述 Moderation 分页                                      | 删除按内容 audit_failed 重试列表；ReviewBot Check/Attempt 拥有执行失败和重试查询                                           |
| 枚举/过滤        | `cms/artiment/const.ex`；`cms/query_builder.ex`                                                                             | 删除旧 moderation enum 与 pending 审核过滤分支；保留 category/status 等非审核逻辑                                          |
| Gate 读写        | `gate/access/policy/article.ex`；`gate/scope/article.ex`、`comment.ex`；`context/scope/article.ex`、`doc.ex`                | 替换 legal/illegal 条件、diagnostic scope/include_illegal；新 typed facts/授权审核读取，不提供无条件 bypass                |
| Gate action      | Article Policy 的 `:moderate -> article_trash` 映射                                                                         | 旧审核 action 与 trash grant 不直接沿用；定义审核动作权限并同步所有调用者/契约，不能删除共享 trash 权限                    |
| Public 投影      | `articles/public.ex`、`binding_persist.ex`、`revision_projection.ex`、`article_view.ex`、`draft/store.ex`、`publish/doc.ex` | 去掉旧状态初始化、旧 meta 映射和 legal -> visible 换算，改成当前限制投影；不删除 Draft/Revision/Public 存储体系            |
| 作者状态         | `accounts/model/embeds/user_meta.ex`                                                                                        | 删除 has_illegal_articles/comments 与 illegal_articles/comments；新事项/决定由 AlertBoard 查询，不继续维护地址数组         |
| 统计/搜索        | `communities/tags/stats.ex`；`search_artiments/capacity.ex`                                                                 | 换成新可见性合同；保留统计/搜索能力，不把旧枚举改名后继续双权威                                                            |
| 当前文档         | Sentinel 草案、计划 CMS.Moderation 设计、domains 总览                                                                       | 本轮已替换为新入口/历史重定向；实际代码删除仍待实施                                                                        |

表内 `cms/...`、`jobs...`、`accounts/...` 均位于 `backend/api/lib/groupher_server/`；
`helper/...` 位于 `backend/api/lib/helper/`。不得按错误 base 拼接路径。

## 4. 外部接口、配置和依赖

实际外部请求是 `POST https://aip.baidubce.com/rest/2.0/solution/v1/text_censor/v2/user_defined`，
通过 query 参数 `access_token` 携带配置，form 参数为去 HTML 的 text。旧实现只发文本，不包含图片审核。
请求由 Tesla 执行，timeout 4000ms、retry delay 300ms/max_retries 3；
`conclusionType` 为 1 或 3 被旧实现当作通过，其他结果解析 subtype/hits/words。
这些返回语义全部退役，不能保留“provider 不确定等于通过”的隐式规则。

| 项目            | 已发现位置                                                | 处理                                                                                   |
| --------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| provider token  | `backend/api/config/prod.exs:84`、`runtime.exs:237`       | 删除 `:audit` 配置和 `AUDIT_TOKEN` 读取；替代 provider 使用 ReviewBot 自己的配置       |
| 测试 token 配置 | `backend/api/config/test.exs:58`                          | 删除专用配置；新测试使用受控 adapter fixture，不依赖外部服务                           |
| 定时任务        | `backend/api/config/config.exs:258,260`                   | 删除 `*/59` Article、`*/29` Comment audition cron；新任务执行状态归 ReviewBot          |
| 调试接口        | AuditBot.analysis_wrong/test、Audition.handle_edge        | 删除错误 token 请求与内嵌大段样例，不保留生产调试外呼                                  |
| 外部平台资源    | 百度 token/订阅/配额与部署 secret                         | 仓库不能证明是否仍在线使用；切换后由运维核实并撤销专用凭据，记录完成，不输出密钥值     |
| 专用依赖        | `backend/api/mix.exs:106`、`mix.lock` 的 html_sanitize_ex | 仅 AuditBot 两处使用；随旧执行器删除直接依赖，用依赖工具清理 lock 及无其他依赖的传递项 |
| 共享依赖        | Tesla                                                     | Umami、Algolia、Assets provider deletion 仍使用，保留 HTTP 基础能力                    |
| 环境与 CI       | 本地 .env*、.github、infra/local/ops 和配置模板扫描       | 本轮未发现额外 Audit 专用配置键；不代表远端 secret store 没有 AUDIT_TOKEN              |

本轮未发现旧审核独立 HTTP callback route，也未发现直接暴露 set_illegal 的 GraphQL mutation；
实际对外残留主要是查询字段、pending 和 meta，不把内部 facade 误称成外部 REST 接口。

## 5. 数据字段与消费者

| 数据位置                                              | 旧字段                                                                                                                  | 处理                                                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `cms/model/article.ex`                                | moderation_state、illegal_reason、illegal_words                                                                         | 删除旧列、changeset 默认值与 enum；不删除 stable Article                                                                                   |
| `cms/model/doc_branch_state.ex`                       | 同上，reason 类型与 Article 不同                                                                                        | 平台检测限制接管，保持 branch 隔离；其他运行状态字段保留                                                                                   |
| `cms/model/comment.ex`                                | pending 整数字段                                                                                                        | 删除 Comment.pending 字段和全部旧审核读写；保留 is_folded、Lifecycle 等独立字段                                                            |
| `cms/model/embeds/article_meta.ex`、`comment_meta.ex` | is_legal、illegal_reason、illegal_words                                                                                 | 删除 Ecto embed 与旧 JSON 键；新 DTO 提供必要审核提示，不泄露内部证据                                                                      |
| `accounts/model/embeds/user_meta.ex`                  | has_illegal__、illegal__ 地址数组                                                                                       | 删除字段和残留 JSON；不删除整个 user meta                                                                                                  |
| ArticlePublic                                         | visible                                                                                                                 | 删除列；Gate 由 ArticleLifecycle + ArticleReviewRestriction 即时判断普通 Article 可见性                                                    |
| ArticleBinding                                        | visible                                                                                                                 | 删除列；Binding 只保留 Article–Community 关联和 locator                                                                                    |
| DocPublic                                             | visible                                                                                                                 | 保留 branch-scoped 发布投影；Doc Gate 同时检查 DocLifecycle 与 DocReviewRestriction                                                        |
| 历史 migration                                        | `20260930090000_create_article_revision_draft_target.exs`、`20260930150000_normalize_stable_article_illegal_reason.exs` | 保留历史；新增 migration 删除旧列/索引/约束与 JSON 残留，按 delivery D3 在临时重建库验证 DDL，并在维护窗口核对实际约束；不改运行时删除合同 |

旧审核列和 embed JSON 键最终删除，不建立旧值到新值的兼容解释器，也不保留旧 provider 结果作为新审核依据。
真实环境的数据删除需在受控维护窗口执行并保留必要备份；已有受限内容不能因删字段而意外公开。
如需重新评估，使用当前内容执行全新的检查，不搬运旧 verdict/payload。环境切换不等于授权本轮删除数据。

### 5.1 后端对外字段

- Article.pending：删除 `groupher_server_web/schema/helper/fields.ex:128` 的共享字段、
  `schema/cms/cms_metrics.ex:29` 的 Article interface 字段，以及 `cms/articles/revision_projection.ex:178`
  的 `pending: 0` 占位和 `article_view.ex:48` 的透传；不保留恒定 0 的兼容字段。
  `backend/api/lib/support/factory/articles.ex:371` 的 article_base `pending: 0` 同步删除，属于本次 fixture 清理范围。
- Comment GraphQL 类型没有 pending；其数据库 pending 与 GraphQL meta 是不同删除项。
- `schema/cms/cms_types.ex:1755` 是 Community.pending，不属于此次内容 Audit 删除，不能误碰。
  同文件 Article/Comment meta 的 is_legal/illegal_reason/illegal_words 删除；
  `schema/account/account_types.ex` 的作者违规信息同步删除。
- `backend/api/schema.graphql`：Article.pending 定位为 2621、2655、2684、2714、3706；
  对应类型/interface 字段与旧审核 meta 从 schema 来源删除后重新导出。3225 为 Community.pending，保留。
- `frontend/mock-server/schema.graphql` 是共享 schema 链接，跟随真实 schema，不维护另一份旧协议。
- `contracts/graphql`、`packages/contracts` 及 MCP/HTTP/service 边界已做字面扫描；未发现额外独立旧审核端点。
  GraphQL 生成检查和 schema-link 检查仍需在切换时跑，不能用“未命中”代替运行验证。

### 5.2 前端已发现消费者

| 位置（仓库相对路径）                                                                                    | 当前用途                                | 处理                                                                             |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `frontend/core/unit/Comments/fragments.ts`                                                              | 请求 isLegal/illegalReason/illegalWords | 改成新公开审核提示 DTO                                                           |
| `frontend/core/unit/ArticleEditor/schema.ts`                                                            | 编辑器两处请求违规原因/词               | 成对修改 query 与编辑提示                                                        |
| `frontend/core/spec/article.d.ts`                                                                       | 共享 meta 类型                          | 删除旧字段，使用新合同                                                           |
| `frontend/core/unit/Comments/Comment/DesktopView/DefaultLayout.tsx`、`FoldLayout.tsx`、`IllegalBar.tsx` | 正文/折叠布局的违规判断与提示           | 改成当前内容审核提示，不保留旧版展示；关联 salon 同步处理                        |
| `frontend/core/unit/Comments/Comment/Actions.tsx`、`Footer.tsx`                                         | isLegal 决定动作/页脚                   | 使用新 capability/状态合同，不只换文案                                           |
| `frontend/core/unit/EmotionSelector/index.tsx`                                                          | 违规内容交互控制                        | 对齐 Gate action 能力，服务端仍权威                                              |
| `frontend/core/unit/ChangelogThread/ChangelogItem/ClassicLayout/index.tsx`、`SimpleLayout/index.tsx`    | 向 EmotionSelector 硬编码 isLegal=true  | 新可见性/状态 DTO 接管                                                           |
| `frontend/core/ui/IllegalWarning/index.tsx` 及 salon                                                    | 旧违规词组件                            | 本轮只发现声明/自身 export，无外部调用命中；删除整组，实施时连同动态注册引用清除 |
| `frontend/core/lib/i18n/en/main.ts`、`zh/main.ts`                                                       | comment.illegal.* 文案                  | 与新提示同步替换，删除无消费者的旧 key                                           |
| `frontend/core/lib/graphql/generated/graphql.ts`、`gql.ts`                                              | 生成 schema 与查询                      | 修改来源后 codegen，不手工补生成文件                                             |

### 5.3 不能丢失的派生效果

Articles.Moderation 当前还负责：ArticlePublic/ArticleBinding/DocPublic 可见性、作者 meta 与用户缓存、
标签统计重建、Algolia upsert/delete、`article.visibility_changed` durable cache invalidation。
Comments.Moderation 当前负责 pending/meta/作者 meta 和用户缓存；未发现同等完整的搜索/统计一致性编排，
新实现需按新公开语义验收，不可宣称旧链已覆盖。

Publish effect 当前在 audition 前 enqueue search、invalidate Press、sync mentions；新“先审后发”模式
必须避免提前把正文推送到公开索引、Feed、通知、缓存或图片访问路径。删除旧审核不等于删除这些业务能力。

### 5.4 旧条件逐点清除，不继承旧行为差异

| 源码（相对 backend/api/lib/groupher_server/） | 实际旧行为                                                                               | 处理                                                                                              |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `cms/query_builder.ex:94-98`                  | pending 非 illegal / 等于 audit_failed                                                   | 删除两个旧 filter 分支及调用参数                                                                  |
| `cms/gate/scope/comment.ex:138,144`           | pending 非 illegal，作者例外                                                             | 删除旧条件；新限制由 Gate 新合同计算                                                              |
| `cms/communities/tags/stats.ex:374`           | visible? 读取 pending                                                                    | 删除旧 predicate，统计使用新可见性事实                                                            |
| `cms/search_artiments/capacity.ex:84`         | Comment.pending 等于 legal                                                               | 删除旧枚举过滤，容量口径按新公开读取定义                                                          |
| `cms/articles/public.ex:41`                   | visible = state == legal                                                                 | 删除旧换算                                                                                        |
| `cms/articles/binding_persist.ex:242`         | visible = state != illegal                                                               | 删除旧换算                                                                                        |
| `cms/articles/moderation.ex:183,187,195`      | 分别写 ArticlePublic、ArticleBinding、DocPublic，均使用 state == legal；181 仅是函数起点 | 随旧模块删除                                                                                      |
| `cms/articles/draft/store.ex:812`             | insert_community_binding 使用 visible: true 初始化                                       | 非旧枚举换算；保留 binding 创建，在 N2 改为按 Lifecycle 与有效限制计算初始投影，draft_only 不公开 |

上述 Public/Binding 在 audit_failed 时按写路径产生不同结果，这是待删除的旧实现事实，
不是兼容要求。新投影按发布模式和有效限制统一计算，不沿用这些旧写路径的可见性规则。
默认可见模式下单纯检测失败不判违规；AI 初审模式未通过不公开；人工模式保留待审限制。
这里描述的是新合同，不是新旧状态映射。

## 6. 举报与保留边界

`CMS.AbuseReports`、ReportFact 方向、viewer_has_reported、举报投影和管理员身份不是旧检测垃圾代码。
举报业务迁入 AlertBoard，但提交/撤销事实保留，不凭 AI 结果生成假举报。
补充源码核对：`interactions/reactions/report.ex` 的 maybe_fold_comment 确实按举报阈值调用 fold_for_report。
该路径随旧 Report 运行时在 D5 批次删除；旧举报事实不迁移，N4 从零建立新事实。具体入口、数据与投影切换见 [实施合同 §11](../feature/alert-board/implementation.md#11-举报归属切换与历史边界)。

保留：Community Moderator/Passport、通用 Activity 与 Lifecycle 操作审计、Interactions.Audit 投影校验、
Assets/Trash/Command 的其他审计记录、非内容审核的 pending 状态、共用 Scheduler/Jobs/HTTP client。
删除旧内容审核预留的 Activity actions `moderation_review_started/resolved`、对应模型枚举、社区日志分类、Dashboard 文案和历史行；这些 contract-only actions 没有新实现用途。
明确保留 `Activity.log` 通用操作记录、`audit.read`（社区操作日志权限）、`cms/docs/trash.ex:360` 的 opts[:audit]（Activity.log 开关）与
`cms/communities/lifecycle.ex:271` 的 :audit_action（Lifecycle 操作审计，缺失会回滚）。
分类必须以调用目标和字段语义为准，禁止按 audit 字样批量删除。
`accounts/front_desk/query.ex` 和对应测试的 `:audit` 是非法 read-mode 测试语义，非旧 provider，保留。
百度网站统计 `frontend/core/lib/analytics/baidu.ts`、`spec/index.ts` 的 _hmt 以及 Landing 的百度 SEO logo 均保留，
`NEXT_PUBLIC_BAIDU_TRACING_ID` 与旧审核 AUDIT_TOKEN 无关。外部参考资料中的 moderation/illegal、crash dump、历史说明不作为运行时消费者处理。

详细施工文件、测试和命令见 [实施批次](../feature/alert-board/delivery.md)。

## 7. Audit 删除批次与新实现分界

旧 Report 运行时按 [AlertBoard D5](../feature/alert-board/delivery.md#d5-清除旧-report-运行时全链路) 全链路删除；旧举报事实不迁入新表，N4 从零建立 AlertBoard reports，不构成 Audit verdict 或兼容机制。

| 批次                    | 删除工作                                                                                                     | 退出条件                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| D1 断开旧执行链         | producer、cron、audition job type、emit/route/deliver、失败分页与重试                                        | 无旧任务产生；在途任务已停，不能继续回写                                                                             |
| D2 删除检测与写入       | AuditBot/Audition、百度请求、AUDIT_TOKEN、html_sanitize_ex、旧 Moderate/Audit API                            | 旧 endpoint/config/handler/facade 无运行时消费者，无兼容 wrapper                                                     |
| D3 删除状态与全部消费者 | 旧列/JSON/enum、Gate 条件、投影、GraphQL pending/meta、前端 query/type/UI/文案                               | 不存在旧字段占位或 fallback；新 migration 后旧存储已移除                                                             |
| D4 Audit 清理收尾       | 旧审核专用测试、fixtures、生成契约与失效文档                                                                 | 编译与契约完整，残留命中仅为逐项确认的非旧审核内容                                                                   |
| D5 Report 运行时清理    | 举报旧 facade/Query/Report/model/resolver/GraphQL/前端调用、旧表/embed/JSON/账号投影及同步阈值 fold 全部删除 | 旧 Report 不可读写；无 worker、旧 model、迁移输入或兼容接口；projection 旧调用点清零，通用 Projection mechanics 保留 |
| N1–N8 独立新实现        | 按 AlertBoard/ReviewBot 合同建立新配置、检查、事项、决定与限制；N4 从新提交开始写入 AlertBoard reports       | 新模式/权限/并发/传播测试通过，不调用或迁移任何旧举报/审核协议                                                       |

D1–D5 是为新实现清理基础的完整删除任务，不要求为了临时可运行而保留旧审核兼容层。
生产部署以受控维护/停止相关入口隔离中间状态，新机制验收前不能将中间态当作完成版本上线。
这是部署约束，不是让旧代码长期驻留或双轨运行。

Oban 清理只处理 worker=`GroupherServer.Jobs.Comments` 且 args.type=`audition` 的
available/scheduled/retryable/executing 任务，不清空共享队列；同时停止 cron 和同步 Article emit。
不新增“接受旧 payload 后转发新任务”的 handler；新检查只从当前内容按新协议创建。
备份和既有历史 migration 不构成运行时兼容，应用代码不得读取旧协议事实。

## 8. 验收与命令

本轮执行的是文档检查，不执行下列数据库或外部行为测试。

### 8.1 D1–D5 删除完成标准

- 旧 producer、任务类型、cron、provider endpoint、配置读取和写 API 无运行时引用；在途旧任务不能回写。
- 旧 enum、列、embed JSON、GraphQL 字段、查询参数、DTO/UI、fixture 和专用依赖均移除，生成契约同步清理。
- 不存在旧值到新值映射、别名、转发入口、默认值占位、fallback、双读或双写。
- Gate/Lifecycle、Activity、Moderator、共享 Jobs/HTTP 及非审核功能仍通过对应检查。
- 仓库残留逐项归类，仅允许不可执行的历史说明/历史 migration 或明确无关的同名项；远端凭据与队列清理单独记录执行证据。

这些标准单独验收，不以“新功能暂未完成”为理由留下旧协议；也不把删除完成报告为新审核已上线。

### 8.2 N 新实现验收

新实现另按新合同验证：

- 帖子/评论三种首次发布模式、两种编辑模式、Doc 平台检查与 Doc 评论。
- actor × parent/community × current restriction 的 detail/list/batch/count 一致性。
- 旧 B 结果到达已改 C、重复回调、人工决定后迟到结果、删除后迟到结果。
- provider timeout/未覆盖图片/重试耗尽；失败不写内容违规状态。
- 评论登记任务失败导致 aggregate transaction rollback；共享 Jobs 其余类型正常。
- 搜索/Press/Feed/缓存/通知/资产不提前公开；解除一项限制不覆盖其他限制。
- 新 migration 后旧列与 embed JSON 不再被读取；作者违规数组不再维护。
- 旧百度 endpoint 无调用，旧 cron 不注册，远端专用 token 完成撤销核实。

实施时从 `backend/api` 执行 `mix compile --warnings-as-errors`，并运行 gate、comments、articles、
events、jobs、web query 受影响测试（逐文件附录列出当前测试）。新测试文件与 T01–T25 断言（含独立记录的 T01a 子用例）已在 [批次验收](../feature/alert-board/delivery.md)指定，
不能仅删除旧断言来通过测试。

仓库根执行：

```sh
pnpm graphql:codegen
pnpm contract:graphql:generated
pnpm docs:check
git diff --check
```

GraphQL codegen 前执行仓库已在 CI 使用的 `make be.gen.schema`，更新 schema.graphql 与 mock-schema 链接。
切换后复跑附录扫描表达式，逐项分类历史 migration/历史说明等保留命中；
不能用全仓 `Audit`/`pending` 零命中作为验收，也不能仅检查 AuditBot 文件已删除。
