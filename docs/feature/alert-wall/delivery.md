# AlertBoard / ReviewBot 实施批次与验收

> 版本说明：本文只记录 V1 的 D/N 批次；[V2：ReviewBot / AlertWall](./v2.md) 使用独立 R0–R7 批次；当前实现状态和验证结果以 V2 文档为准。

> 状态：运行时代码与自动化验证记录见本轮 PR；2026-10-23 移除了普通 Article 的 Binding/Public 可见性投影列。真实浏览器验收、生产部署、目标环境维护切换和真实 provider/数据验收仍未完成，当前不能视为已上线。
> 业务与数据合同见 [implementation.md](./implementation.md)；每批必须满足退出条件才进入下一依赖批次。

## 0.1 当前实现快照

以下仅记录当前工作树中已落地并通过的片段，不能替代各批完整验收：

- 已删除 Article/Comment 的旧 `isLegal` / `illegalReason` / `illegalWords` 前端消费、旧评论非法提示及账号 `has_illegal_*` GraphQL/模型字段；SDL 与 GraphQL TS 已重新生成。
- Migration `20261022140000_drop_legacy_user_audit_meta` 已清除 `account.users.meta` 中旧账号内容审核键；测试库迁移成功。
- 已删除内容审核预留 Activity actions `moderation_review_started/resolved`、对应模型枚举/分类/文案/测试；migration `20261022150000_drop_legacy_content_review_activity` 清除历史行并收紧四类 Article log 的 action 约束。
- 普通 Article 的发布准入由 Gate 根据 ArticleLifecycle 与 ArticleReviewRestriction 事实即时过滤；ArticleBinding 只保存关系与 locator，ArticlePublic 只保存公开版本和查询投影。Doc 继续使用 branch-scoped DocPublic 发布投影。Mention 写入已具备 Gate 公开资格检查、target/content token/recipient 幂等和已读状态保留。
- 新 Report submit/withdraw GraphQL command 已接入 Article/Comment 举报入口；`contentReview.viewerReportId` 只暴露当前 actor 自己的 active report，前端可跨刷新撤回。SubmitReport 失败重试复用 commandId。
- 验证快照（2026-10-22）：D5 runtime scanner 扫描 4,439 个源码文件通过；后端 2,410 passed / 1 excluded、Core 1,023 passed、Assets Hub Worker 16 passed；全仓类型检查、GraphQL source/generated 契约、文档与边界检查通过。真实浏览器和生产 provider 未作为本地验证冒充通过。

D1–D5 的运行时代码和本地迁移合同已通过仓库扫描、数据库断言和全套测试；N1–N7 功能代码已落地，但本轮全套验证仍需重跑。N8 的停旧 worker/cron、目标环境迁移、存量内容重检与生产验收属于部署操作，未在本地 PR 中执行；没有这些证据时不得启用生产审核。

## 1. 批次依赖与文件落点

D1–D5 是一个不可单独上线的运行时清理交付单元；可分提交，不能在中间提交恢复旧服务。
D5 后旧举报 GraphQL、facade、query/report 模块、阈值 fold 调用点、旧事实写入和旧存储均已删除；不存在举报 worker 或历史导入入口。
随后 N1 -> N2；N4 依赖 N1/N2；N3 依赖 N2；N5 依赖 N3/N4；N6 依赖 N5；N7 依赖 N6；N8 最终部署。
下面新增路径是确定的施工落点；文件不存在时创建，不能以“不存在”为由跳过。

### D1 停止并删除任务生产/消费

- `cms/articles/effects/publish.ex`：删除 audition emit。
- `cms/comments/commands/create.ex`、`update.ex`：删除 RequiredJobs 调用；删除 `comments/required_jobs.ex` 及专用测试。
- `cms/events.ex`、`comments/effects.ex`、`jobs.ex`、`jobs/comments.ex`、`jobs/workflow.ex`：删除 audition route/type/deliver/facade。
- `helper/scheduler.ex`、`config/config.exs`：删除文章/评论 audition cron 与失败补偿函数。
- 门槛：全仓生产代码无 `:audition`/`"audition"` 业务引用，非审核 Jobs 类型测试仍通过。
- 运维先停止相关写入口、旧 cron 和旧部署 worker；只取消 Comments worker 且 args.type=audition 的任务；
  executing 必须终止并确认无旧进程回写。执行证据记录 job ID/count，不记录正文和 token。

### D2 删除执行器、旧 API 与配置

- 删除 `helper/audit_bot.ex`、`cms/events/audition.ex`、Article/Comment `moderation.ex`、旧 Commands.Moderate、`comments/audit.ex`。
- 删除 cms/articles/comments facade 的 set/unset_illegal、set_audit_failed、audit_failed 查询；同步所有调用与测试。
- 删除 prod/runtime/test 的 :audit/AUDIT_TOKEN；移除 mix.exs html_sanitize_ex 和 lock 的孤立依赖，保留 Tesla。
- 删除 `mix/tasks/cms.command.pipeline.ex` 的 `CMS.Comments.Audit` internal entry 注册；生成图不能引用已删除模块。
- 门槛：旧 endpoint、provider parser、旧 API/任务重试无引用，无接受旧 payload 的空 handler。
- 撤销专用部署 secret 与百度 token；记录平台、变量名、撤销结果，不输出值。

### D3 删除旧存储、条件与消费者

- `20261022110000_add_content_review_restrictions` 为现有 Article/Comment/Doc Lifecycle 建立新模型所需的 review token 基线；它不读取、解释或迁移旧 Audit 状态。
- 最终 migration `20261023110000_drop_legacy_content_audit_fields` 删除 Article/DocBranchState 的 moderation_state/illegal_reason/illegal_words、
  Comment.pending 和 Comment.meta 内旧 is_legal/illegal_reason/illegal_words。删除时不读取旧值、不创建 Case/Check/ReviewRestriction，也不将旧状态翻译成新状态；历史回填与旧数据兼容均不属于本次迁移。
  ArticleMeta 的运行时投影/嵌入声明单独删除；不存在存储列时不臆造 UPDATE，历史存储 JSON 的位置由 migration 清单逐项列出。
- migration 通过 Ecto schema 实际 source 定位表；生成 SQL 清单含每个 drop column/constraint/index 和旧 JSON 清理。它排在 `20261023100000` 之后；不改其他已部署 migration。
- Gate/Scope、query_builder、Public/Binding/RevisionProjection/ArticleView、tags/stats、search_artiments/capacity：按逐文件清单删除旧条件。
- 删除 Article.pending GraphQL 字段（fields.ex/cms_metrics.ex）、对应 meta 字段、作者违规数组，禁止 pending: 0 占位。
- 前端所有旧 query/type/UI/salon/i18n 消费者同批删除；默认值 isLegal=true 也删除。
- 保留 Community.pending、Activity 操作日志、非审核 fold、Moderator 和通用 Lifecycle。
- 门槛：应用代码不读取任何旧字段；生成 SDL/TS 无旧字段；数据库 information_schema/JSON 断言均为零。

### D4 删除闭环

- 删除专用测试、fixture、旧 provider mock；明确删除 `backend/api/lib/support/factory/articles.ex:371` 的 pending: 0。
  混合测试只删除审核断言，保留无关用例。
- 重新生成 pipeline_contracts.json、pipeline_graph.json、schema.graphql、GraphQL TS；不手工维持旧形状。
- 新增 `scripts/check-legacy-content-audit-removal.mjs`，按 removal/inventory 的符号和字段语义检查；
  例外清单只允许历史 migration/明确的操作审计/历史文档，不能豁免运行时旧审核模块。
- 本地与 CI 统一运行 `pnpm check:legacy-content-audit-removal`；扫描范围含 backend runtime/config/生成 SDL、Frontend Core 与 Contracts，不扫描历史 migration 和历史说明。
- 门槛：scanner、编译、现有受影响测试、生成契约检查全部通过；没有新审核实现也能证明旧链已消失。
- D4 产物是干净基础，不宣称具备审核能力，不部署为正常服务版本。

### D5 清除旧 Report 运行时全链路

- 删除 `cms/abuse_reports.ex` 的全部 facade（含 paged_reports）、`cms/abuse_reports/query.ex`、`cms/abuse_reports/report.ex`、`cms/model/abuse_report.ex` 和 `interactions/reactions/report.ex`；
  在同批 migration 直接 DROP `cms.abuse_reports`（连同其索引和嵌入列），不保留历史导入、archive 或运行时 fallback；
  清理真实存储位置：`cms.comments.meta.report_count`、`account.users.meta.reported_count/reported_user_ids`、`account.users.contributes.reported_count`，以及五张 `cms.{post,blog,changelog,doc,comment}_reaction_infos.reported_user_ids` bitmap 列。
  统一 `cms.articles` 当前没有 `meta` 列，不为其生成 JSON UPDATE；已不存在的历史 `cms_posts/cms_blogs/...` 物理表也不伪造清理 DDL。
  删除 `CMS.Interactions.report/undo_report` delegates 及旧 ReportConfirmation，不保留旧 facade 转发。
- 清除旧 command identity 协议：删除 `cms/command/intent_codec.ex` 中 `report_add/report_remove` entries、旧 ReportConfirmation 模块及其生成的 `pipeline_graph.json` / `pipeline_contracts.json` 节点；不继续识别或恢复旧 operation 的 receipt。
- 删除 `schema/helper/mutations.ex` 与 `schema/cms/mutations/{post,blog,changelog,doc}.ex` 中旧 report mutations；
  删除 `resolvers/cms/interactions.ex`、`resolvers/cms/comments.ex` 的旧 resolver 分支。
- 旧 GraphQL 查询入口和 resolver 分开清理：删除 `backend/api/lib/groupher_server_web/schema/cms/cms_queries.ex` 的 `paged_abuse_reports` field；删除 `backend/api/lib/groupher_server_web/resolvers/cms/reporting.ex` 的 `Reporting` resolver。
- 旧 GraphQL contract 按定义位置清理，避免只删 query 而留下孤儿类型：删除 `backend/api/lib/groupher_server_web/schema/cms/cms_metrics.ex:280` 的 `report_filter`；删除 `backend/api/lib/groupher_server_web/schema/cms/cms_types.ex:1889` 的 `abuse_report_case`、`:1895` 的 `abuse_report`、`:2008` 的 `report_page`。其中 `abuse_report_case` 也是旧类型，不能因名称与新的 ReviewCase 相似而保留。
- 旧账号举报投影按存储与 GraphQL 两层清理：删除 `backend/api/lib/groupher_server/accounts/model/embeds/user_meta.ex:83-84` 的 `reported_count` / `reported_user_ids`；删除 `backend/api/lib/groupher_server/accounts/model/embeds/user_contribute.ex` 中 `@optional_fields` 的 `reported_count`；删除 `backend/api/lib/groupher_server_web/schema/account/account_types.ex:51` 暴露的旧 `reported_count` 字段。
  D5 不迁移旧计数。若新账号视图仍需 `reported_count`，N5 必须从 `AlertBoard.Reports` 事实聚合派生，并由新 resolver 显式暴露；不得继续读取或回写 `UserMeta` / `UserContribute`，也不得把旧 GraphQL 字段当成新字段的实现。
- 删除 `maybe_fold_comment -> fold_for_report` 的阈值自动折叠调用；独立手动 fold 能力保留。
- 删除旧 AbuseReport 对 viewer_has_reported 的事实写入调用点；保留通用 `CMS.Interactions.Projection.add_report/remove_report` mechanics，N4 仅接入新举报事实。
  report 列表不再通过旧 query 暴露。前端移除 `Comments/schema.ts`、`Comments/Comment/Actions.tsx`、
  `query/mutation/comment/moderation.ts`、`comment.ts`、`useCommentModeration.ts` 里的旧 report operation，
  不留 GraphQL alias 或旧 operation name。N5/N7 再接新合同。
- `report_cases` 旧存储不作为迁移输入；D5 直接清除旧表和 JSON embed。D5 后所有应用模块、HTTP/GraphQL、Jobs、cron 均无旧举报读取或写入。
- D5 与 D1–D4 使用同一维护窗口，清理阶段整体不可部署。退出条件：旧 mutation/query、resolver、facade、Query/Report 模块、阈值 fold 调用点和前端 operation 全部不存在；
  `rg` 运行时扫描不允许任何旧 AbuseReport model/table 引用。旧 Projection 调用点移除，通用 `Projection.add_report/remove_report` 函数保留，N4 接入新事实后复用。

### N1 新数据与领域结构

新增 `alert_board/{model,commands,authorization,policy,query,error_cat}`、`review_bot/{model,adapters,jobs,error_cat}`，
各自顶层 facade；保留仓库 concrete Commands/Query/Persist 约定，不新增 Reader 或通用 Workflow 引擎。
新增 migration `create_alert_board_review_bot`、`create_content_review_restrictions`、`pin_review_mode_on_checks` 与 `use_integer_review_restriction_ids`，逐项实现 implementation §3；每个 Check 固定本次提交实际生效的 publish/edit mode，配置版本变更不会错误复用旧模式结果。Decision 的 `restriction_ids` 必须使用与 CMS restriction 主键一致的整数数组；新字段仍为空时才能转换，非空则中止迁移，不伪造 UUID 映射。
配置初始化：平台与现有社区分别创建 article/comment 默认记录，平台另有 doc；RuleSet 可空，不能假装有 AI。
直接创建社区时在 Create transaction 创建默认配置；社区申请创建时在 Setup 激活 transaction、active transition 之前创建 Article/Comment 默认配置。不存在配置行必须返回配置错误，不能运行时静默插入。
注册 ErrorCat、DBPrefix 与必要编译目录；新增 schema 只由所属 Context 查询。

验收：约束拒绝非法 scope/target/关联；同 token 同规则的重复任务不能重复插入；active restriction 唯一；
删除后的旧字段不在新 DDL 出现。新增测试 `test/groupher_server/alert_board/model_test.exs`、`review_bot/model_test.exs`。

### N2 权限与资源限制

- 修改 `packages/contracts/gate.contract.json`，运行 action generator；Passport Registry parity 验证新 action。
- 新增 `CMS.{Articles,Comments,Docs}.Commands.ApplyReviewDecision` 及对应 Lifecycle apply/end/recompute 接口。
- typed Access Context 装载 restrictions/epoch；Scope Article/Comment/Doc 增加组合限制 SQL，所有读取入口共用。
- Public/Binding/DocPublic 统一派生；包括 `articles/draft/store.ex:812` 的 binding 创建初始化，draft_only 初始投影不可公开。
  该处不是旧枚举换算，不在 D 批次机械删除 binding 创建；N2 消除无条件 visible: true，禁止把 Board Case 当可见性权威。
- 对应测试位于 `test/groupher_server/cms/gate/g1_surface_consistency_test.exs`、
  `test/groupher_server/cms/gate/scope/comment_test.exs`、Article/Comment restriction tests 与
  `test/groupher_server/cms/docs/platform_review_test.exs`；范围 SQL 查询数另由 Gate surface consistency 用例覆盖。

验收：平台/社区/作者/审核员矩阵；跨社区 binding 隔离；限制单独解除；删除资源不复活；自批拒绝；
平台限制不可被社区管理员穿透。所有动作复用 canonical load，不在 Command 内按 ID 再查另一份资源。

### N3 提交与 ReviewBot

- 新增 ReviewBot.register_in_transaction、Jobs.Check、Adapters.Word/Adapters.JudgeHTTP/Adapters.OpenAI。
- Article publish、Comment create/reply/update 接入社区/平台 UGC 审核模式；Doc main/preview 发布只接平台级 branch/token 检测，配置强制 immediate，命中后限制对应 branch，不接入 ai_first/human_first。Doc 发布权仍由管理员与 DocLifecycle/DocPublic 决定。
- 新增 AlertBoard.Policy 的纯函数：输入配置/检查/现有事实，输出动作和明确 restriction IDs。
- provider 配置、queue 并发/重试、payload 清理按 implementation §7；fixture adapter 无网络。
- 对应测试位于 `test/groupher_server/review_bot/{registration,execution,check_contract,word_rules,media}_test.exs`、
  `test/groupher_server/cms/comments/review_submission_test.exs`、`cms/articles/review_submission_test.exs` 与
  `cms/docs/platform_review_test.exs`。

验收：T01–T12（含 T01a 子用例）、T16–T20；Oban 插入失败回滚内容；AI 调用不在数据库事务内；
相同 Job 重放无重复决定；crash/retry 丢失结果后不会写入过期内容。

### N4 建立全新的 AlertBoard 举报写入

- 新增 AlertBoard.Commands.SubmitReport/WithdrawReport，包含 USER 与 CMS content 的 typed target。
- 新增 SubmitReport/WithdrawReport 命令只写新 `alert_board.reports` 与 Case；不读取旧表、不转换或推导历史事实。
- 从新事实驱动通用 `Projection.add_report/remove_report` mechanics；AlertBoard 是唯一举报事实 owner。
- 新增 `alert_board/reports_test.exs`，覆盖并发重复、撤销、权限与投影事务；不新增历史迁移任务。

验收：旧 report 表/embed/Meta 皆已删除；新数据不包含旧 row/状态；同一 reporter 并发只一个 active report；改名不影响身份；撤销不撤销决定；
目标隐藏后仍可撤销本人报告；撤销他人报告拒绝；新增举报不自动 fold；账号举报不修改账号状态。

### N5 管理接口

- 新增 AlertBoard.Commands.UpdateConfig/Decide/Recheck 与 Query；范围先过滤再分页。
- 新增 `groupher_server_web/schema/alert_board/{types,queries,mutations}.ex` 和 `resolvers/alert_board.ex`，在根 schema import。
- 删除旧 CMS reporting query/mutation、旧 helper 分支与 DTO；实现 §8 的严格输入与错误。
- 新账号举报视图的 `reported_count` 从 AlertBoard reports 聚合派生并在此批暴露；不从 `UserMeta` 读取或回写旧计数。
- AlertBoard 自有 pipeline adapter，内容决定委托资源 pipeline；不嵌套 Receipt，不引入跨 Context 直写。
- GraphQL 集成验收位于 `test/groupher_server_web/query/alert_board/{report_mutation,management}_test.exs`；
  领域 command/query 验收位于 `test/groupher_server/alert_board/`。

验收：并发批准、编辑冲突、权限撤销、同 commandId replay；返回的决定与资源状态永远同事务一致。
匿名或无权限列表不暴露存在性、reporter、provider 错误；非法 input fail closed。

### N6 公开传播与媒体

- 既有 CMS Outbox article/comment workflow 接收新 review_changed；search/Press/Feed/通知读取最新有效可见性。
- 评论 embedded replies、引用摘要、标签计数及搜索容量不泄露受限正文。
- 缓存返回前 Gate 判定；作者/审核员响应禁止共享缓存。
- Assets 受限图片使用授权读取；公开前不得生成无权限永久 URL；外部 adapter 使用短期签名 URL。
- 对应测试位于 `test/groupher_server/cms/review_visibility_effects_test.exs`、
  `test/groupher_server/review_bot/media_test.exs` 和 `backend/assets-hub/src/worker.test.ts`；后两者验证图片资源按社区/活动状态解析、签名读取与过期 capability 拒绝。版本绑定由签名 payload 携带 immutableVersion，worker 测试不单独模拟替换对象后的版本不匹配。

验收：隐藏后旧 publish event 无法重建公开索引；多社区隐藏只影响对应范围；
严格先审模式匿名无法获得图片字节；不能只验证 UI 不显示图片。

Mention 与通知的现有调用路径必须按职责保留并收口。Article publish 的 `Articles.Effects.Publish` 发出 `:sync_mentions`，Comment Outbox 的 `sync_mentions` job 最终也发出同一事件；`CMS.Events.SyncMentions` 只调用 `CMS.ArtimentMentions.sync/1`，维护内容中的提及关系事实，不创建收件箱记录。`Messaging.Commands.SendMention` 写入 `messaging.mentions` 并更新 Mention mailbox 投影；现在 Article/Comment 的 `review_changed` consumer 已在内容满足 Gate 公开条件后调用它。`sync_mentions` 仍是关系事实刷新，不能删掉，也不能当成 inbox delivery。

N6 建立唯一的公开状态投递消费者：消费内容当前 token 的 `review_changed`/公开转变事件，重新加载 canonical 内容并按当前 Gate 判断；隐藏时不写 Mention inbox 或正文活动通知。公开时，消费者先对当前 canonical 内容幂等执行 `CMS.ArtimentMentions.sync/1`，再读取当前 mention recipients，最后调用 `SendMention`。不能假设 Article publish 的同步 `sync_mentions` emit、Comment Outbox 的 `sync_mentions` job 与 `review_changed` 消费之间存在先后顺序，否则并发或重试可能读到旧的提及集合。CMS 提及关系事实允许在隐藏期间同步，因为 outgoing/incoming 读取仍受 Gate Scope 限制；收件箱投递只在 Gate 确认当前内容公开后执行。旧 publish/comment Outbox 不得再以另一条生产路径投递同一版本的 Mention 或受限正文通知。消费者按至少一次执行，使用 target + content token + recipient 唯一身份幂等；审批和编辑期间发生多次事件时，只投递当前公开 token。

Doc 的发布权威仍由 DocLifecycle/DocPublic 与 branch 决定。Doc 不注册普通 UGC 的 ReviewBot 首次发布检查；Doc restriction 在同一资源事务内重算对应 `DocPublic.visible`，并以既有 Article Outbox 写入 `article.visibility_changed`，按 community/thread/inner_id 清理 Doc 页面与列表缓存。Doc 走独立 branch Gate 和发布合同，不复用普通 Article/Comment 的 Mention 投递路径。

本文把两种“delivery”分开称呼：CMS.Outbox 的事件消费负责可靠唤醒副作用；`Messaging.Notifications.Delivery` 仅为 Notification 提供去重 claim，不是通用消息投递层。Article/Comment 直接提及写 `messaging.mentions`，不 claim `messaging.notification_deliveries`；回复/评论等独立活动通知经 `Messaging.Commands.SendNotification` 写 `messaging.notifications`，只有传入 `delivery_key` 时才 claim Notification Delivery key。该 claim、通知 upsert、key attach 和 mailbox 聚合更新在同一个 SendNotification 命令事务中；Mention 行写入与自己的 mailbox 更新则在 SendMention 命令事务中完成。两种 inbox 记录没有共享表、键或状态，机制本身不冲突。调用路径必须唯一：Comment 的评论/回复活动通知随 Gate 公开判断由 `review_changed` consumer 发出；`Jobs.notify_comment/reply` 及 `CMS.Comments.Effects.deliver(:notify_comment/:notify_reply)` 旧路径删除，避免与审核后通知重复。不同原因可以产生不同 inbox 项（例如直接提及与回复活动）；同一次直接提及只产生 Mention。

N6 的投递恢复按至少一次处理。当前 Comment consumer 的固定顺序是先写 Mention inbox，再写评论/回复活动 Notification；两项各自在自己的命令事务中完成“写 inbox 行 + 更新 mailbox projection”，不使用跨域事务。若 Mention 已提交而 Notification 失败，consumer 返回可重试错误且不确认 Outbox；重试时 Mention 的 target + content token + recipient 唯一键会幂等跳过并保留 read state，再继续 Notification。Notification 的 delivery key 与通知写入在同一命令事务内提交；失败时 claim 一并回滚，重试可重新执行，已成功时重复 claim 则阻止重复创建/合并。Outbox consumer 必须等当前事件约定的全部副作用成功后才确认事件。Notification Delivery 只为独立活动通知提供幂等 claim；它不去重 `messaging.mentions`。最终 Account mailbox 是聚合投影，`unread_total_count = unread_mentions_count + unread_notifications_count`；列表和 read state 仍按 Mention/Notification 各自管理。

结论：机制上兼容，但“Delivery”不是 Mention 的替代机制，也不会替 Mention 去重。真正的冲突风险是调用策略：同一提及如果同时触发 `SendMention` 和 `SendNotification`，用户会收到重复内容；而只用 Notification Delivery 也会丢失 Mention 专属列表、已读状态和版本身份。用户可以因两个不同原因同时收到两类项目（例如被直接提及，同时作为父评论作者收到回复活动通知）；仅“被提及”这一原因只产生 Mention。消费者确认 Outbox 前必须确保所有约定副作用完成；重复消费不能重复计数、重置已读状态或产生重复 inbox 内容。

必须覆盖：受限期间无法通过 `Messaging.send_mention` 创建收件箱 Mention；审批后能创建；同一 target + content token 的 Outbox 重试不重复投递且保留 read 状态。Mention 身份按内容版本区分：新 token 的编辑可为仍在 Mention 集合中的收件人生成一条新版本 Mention；同一 token 的重放不能产生第二条或重置已读状态。若产品以后要求编辑只通知新增 Mention 对象，需另定收件人差量规则，不能通过复用 Notification Delivery key 隐式实现。

### N7 前端与生成契约

实现 core/unit/AlertBoard、ReviewSettings、ReviewNotice、ReportAction、MyReports；挂载社区 Dash 和平台管理入口。ReportAction 使用新 submitReport/withdrawReport commands，并从 `contentReview.viewerReportId` 读取当前 actor 的 active report；账号菜单的 MyReports 独立读取本人举报，因此即使目标已隐藏仍可撤回。两处撤回均使用 receipt-safe commandId；不复用旧 Comment viewer projection 或 mutation。
作者视图使用 review DTO；旧 IllegalBar/IllegalWarning/isLegal/硬编码 true 已在 D 批次清除，不包装回来。
GraphQL SDL/TS/action 完整生成，旧 mutation/query 无别名。新增中英文文案、commandId 冲突/replay UI。

验收：在有数据的 `/home/xx` 社区完成三种模式、两种编辑、举报、管理员批准/拒绝/释放；
截图如需保存放 `.playwright/`，不得放根目录。匿名、作者和管理员分别验证，不能只用管理员会话。

### N8 上线验收与维护切换

1. 在边缘层启用维护隔离，阻断普通用户读取和所有内容写入；停止旧 Audit/Report worker、cron 与 producer，确认无旧 Job 可回写，撤销旧 provider 凭据。
2. 先执行截至 `20261023100000` 的新表/新约束迁移；不要执行最终删列迁移。部署本 PR 的最终代码并关闭部署系统自动执行“全部待迁移”的钩子；新代码不读取或写入旧列。
3. 维护隔离保持开启，用 `AlertBoard.recheck/4` 按新配置重检每个现存可发布目标的所有有效 scope：Article 对 platform 和每个 Binding 社区分别检查，Comment 对 platform 和所属社区分别检查，Doc 按每个发布 branch 的 platform 配置检查。使用管理员 actor、每个 target/scope 稳定且唯一的 commandId；记录 target 数、scope 数、已完成/待人工/失败数，不输出正文、token 或 provider 凭据。旧字段值不参与选目标、判定或生成新状态。
4. 只有当清单中每个 target/scope 都有新系统的确定结果（无规则、completed Check、或 open Case/active restriction），且没有 queued/running/failed Check，才执行 `MIX_ENV=prod mix ecto.migrate --to 20261023110000` 删除旧列。该 migration 不做状态转换，也不改可见性投影。
5. 运行 T01–T25（T01a 作为 T01 子用例，单独记录结果）与真实 provider contract fixtures；确认旧字段/JSON/GraphQL/Job 扫描为零、Check backlog 为零、Outbox backlog 已清空，再验证匿名读取、作者读取和管理员 Board 读取。
6. 解除维护隔离并核验新内容入口。回退时重新启用维护隔离并修复新实现；不启动旧 Audit，不恢复旧 token、字段或协议。

本地实现、迁移与测试不等于生产切换。本轮 PR 不停生产 worker/cron、不撤销部署凭据、不执行目标环境 DDL 或存量内容重检；N8 是合并后的维护窗口操作，必须按以上命令和证据逐项留存，不能用静态扫描代替。

## 2. 可执行行为验收矩阵

每条至少断言数据库事实、返回值与相应读取；成功不以“HTTP 200”作为唯一标准。

| ID                 | 前置 / 操作                                                      | 必须结果                                                                       |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| T01                | immediate，平台/社区均未配置词库或模型规则，提交 Article/Comment | 当前内容可见；无 Check/Attempt/等待限制/Case；基本权限照常                     |
| T01a（T01 子用例） | immediate，仅配置词库且无命中，模型关闭                          | 当前内容可见；只有 completed deterministic Check，无 queued Check/Attempt/Case |
| T02                | immediate，配置词条命中                                          | 同事务 rule_hit + Case；作者可见，普通/匿名不可见                              |
| T03                | ai_first，Check queued                                           | awaiting_ai；内容提交成功；作者 CHECKING；公众 detail/list/count 无正文        |
| T04                | T03 完整 pass                                                    | 仅同范围等待项结束；公开投影更新；一次公开通知                                 |
| T05                | human_first，AI pass                                             | awaiting_human 仍有效；人工批准当前 token 才公开                               |
| T06                | human_first 首次已批准，立即编辑模式提交 B                       | B 为唯一当前内容；不恢复首次人工待审；按新规则检查                             |
| T07                | 已公开 A，ai_first 编辑 B                                        | 普通用户既看不到 A 也看不到 B；作者看到 B                                      |
| T08                | 人工待审 B 后编辑 C，再批准 B                                    | content_changed；C 待审保留，无成功 Decision                                   |
| T09                | rule_hit 后编辑通过                                              | 只解除匹配规则的 policy 限制；manual_hold 不解除                               |
| T10                | manual_hold + AI pass                                            | 仍 RESTRICTED；人工 release 必须指定 restrictionIds                            |
| T11                | 平台限制 + 社区限制，社区批准                                    | 只解除社区项；仍不可公开；社区不能读平台证据                                   |
| T12                | Article 在 A/B 两社区，A 命中社区规则                            | A 不公开，B 按自身配置；平台索引不泄露 A 私有范围                              |
| T13                | Doc preview 命中，main 未命中                                    | 只 preview 限制；Doc 评论仍按 Comment 发布模式                                 |
| T14                | 提交事务 Oban/Outbox 插入失败                                    | 内容、epoch、限制、Case、Receipt 全回滚                                        |
| T15                | Case 批准中强制失败（Decision/投影/Outbox 任一）                 | 无“已批准但未公开”；相同 commandId 可恢复/重试                                 |
| T16                | worker 开始 B，编辑 C 后 B 返回                                  | B superseded；C 状态不变，无公开事件                                           |
| T17                | worker 开始后管理员 restrict                                     | 旧结果失效，manual_hold 不被 pass 清除                                         |
| T18                | 同 Attempt 重复执行/结果重复提交                                 | 唯一 Decision；无重复 Case/限制/通知                                           |
| T19                | 超时 3 次 / 认证错误 / payload 过期                              | 有界失败；ai_first 转人工；immediate 不自动判违规                              |
| T20                | 文本 pass，图片 unsupported / 缺 ruleId                          | 不能 pass；ai_first 不公开，生成人工事项                                       |
| T21                | 删除/销毁后结果到达                                              | 不恢复资源；Comment tombstone 不含正文                                         |
| T22                | 两次并发举报、改名、撤销、隐藏后撤销                             | 单 active fact；身份按 ID；投影正确；无阈值 fold                               |
| T23                | 自己批准自己 / 跨社区操作 / 社区解除平台项                       | 拒绝；没有 Decision、状态或 Outbox 写入                                        |
| T24                | 隐藏前公开事件延迟投递；缓存已命中                               | 不能重新公开正文/摘要/图片；匿名读取仍 Gate 拒绝                               |
| T25                | 同 commandId 重放，或不同输入复用 commandId                      | 原结果恢复；输入冲突按 Receipt 合同拒绝，不再执行                              |

ReviewBot worker 在 claim 后终止时，后续 Oban attempt 接管仍为 running 的 Attempt；若最后一次 worker 仍未恢复，`ReviewBotCheckRecovery` 每分钟把超过 240 秒的孤儿 Attempt 原子转交人工审核。

覆盖要求：T01/T01a–T12 适用于 Post/Blog/Changelog 与 Comment（创建/回复）；T01a 作为 T01 子用例独立执行并记录；T13 独立覆盖 Doc main/preview。
Scope 用列表含 1/20/100 条的查询计数测试证明无逐行准入；授权矩阵覆盖匿名、作者、普通成员、社区 reviewer、平台 reviewer。
配置另测并发 expectedVersion、无 profile 的 ai_first 拒绝、在途规则固定、新内容采用新版本。
provider fixture 必须包含中文词、Unicode 变体、纯图片、图文混合、超限、prompt injection、缺字段/错 token。

## 3. 命令与证据

文档阶段仅运行文档/链接检查。代码阶段每批执行对应 focused tests，N8 再跑以下完整集合。
仓库根：

```sh
node packages/contracts/scripts/generate-gate-contract.mjs
make be.gen.schema
pnpm graphql:codegen
pnpm contract:graphql
pnpm contract:graphql:generated
pnpm docs:check
node scripts/check-legacy-content-audit-removal.mjs
git diff --check
```

`backend/api`：

```sh
mix compile --warnings-as-errors
mix cms.pipeline.check
mix cms.command.pipeline
mix cms.pipeline.check --check
mix cms.command.pipeline --check
MIX_ENV=test mix run -e 'GroupherServer.ErrorCat.validate!()'
mix test test/groupher_server/alert_board test/groupher_server/review_bot
mix test test/groupher_server/cms/gate test/groupher_server/cms/articles test/groupher_server/cms/comments test/groupher_server/cms/docs
mix test test/groupher_server/cms/review_visibility_effects_test.exs test/groupher_server/review_bot/media_test.exs
mix test test/groupher_server_web/query/alert_board
```

Assets Hub 的 ReviewBot 受限图片读取测试在仓库根执行 `pnpm --filter @groupher/assets-hub test:worker`；它覆盖短期有效签名读取、`no-store` 响应与过期 capability 在对象读取前被拒绝。

新增目录/测试只在对应批次创建后运行；删除专用测试不能代替新行为测试。
生成命令必须连续运行两次产生零差异；schema-link 与 mock server 随来源更新。
每批证据包含 commit/worktree、实际命令、退出码、测试数、失败明细、DDL 数量核对和适用 T 编号。
有失败就记录失败，不把“设计已完成”写成“系统已可上线”。
