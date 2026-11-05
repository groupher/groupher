> 2026-11-05 当前状态：MentionsGraph 已完成 Doc Comment 本地联合验收；Sandbox 单例行冲突已通过 TestMate 默认串行和显式 async 写入用例调整处理，本轮联合393项、并发/摘要/账号 guard 与准入28项通过，见[测试隔离与联合验收](comment-test-isolation.md)。[原因与因果证据](comment-pending-concurrency-audit.md)及下文“尚未查清/尚未修复”的阶段记录保留为历史。业务全局热点风险仍需独立评估，真实 B5 发布仍未执行。

# 共享评论：实施与本地验收记录

> 2026-11-05，`fix/todo` 工作区。本轮已获用户明确授权进入共享评论业务实现。未 commit、push 或部署，未改造/删除既有数据库，也未联系、停止或接管另一个 session。
>
> [执行计划](comment-reaction-snapshot-counts.md) 是产品合同；[inventory](comment-reaction-snapshot-counts-inventory.md) 是 B0 的读写/case 设计；[原审计输入](comment-reaction-snapshot-counts-audit/20261105T074802Z/manifest.json) 的正文和 SHA 保持不变。本记录描述随后实施，不覆盖历史静态结论，不继承另一个 session 的测试通过记录。

## 1. 交付与边界

B1–B4、B6 已在当前工作区集成并完成下列本地验收。B5 仅完成私有新库准入、只读事实核对和本地真实页面验证；真实发布未执行，仍受 §6 的准入清单约束。

| Ledger / case                                                 | 实施落点与最终行为                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| W01–W06、W10；CNT-01–04、REP-01/02、REV-01                    | `Comments.Summary.with_change` 在调用方事务内锁定稳定 Article、ArticleStats 和相关 root，比较变更前后贡献。事实、SQL inc、头像、时间、revision 与 `comment.changed` 持久意图同提交；嵌套生命周期/多个审核 block 合并在一个外层变化内。计数下溢失败并回滚，不钳零                                                                                                |
| W02/W09、R02/R03；SNAP-01、REP-01                             | ArticleStats：持久 comments count、去重人数、10 位 Embeds.User、revision 从1开始。根 Comment：replies_count、reply_entries_count、4 位 Embeds.User、last_reply_at、replies_revision。删除完整 replies embed、Comment/PinnedComment 的 branch 字段及孤立 Participants 模块；canonical reply preview 仍可查询，和旧持久化 embed 不同                              |
| W07/W08、R01/R05；READ-01、REPAIR-01                          | 读取不扫描评论表生成摘要，不 enqueue repair、不 lazy init；旧参与者 reconciliation Job/facade/rebuild API 已退出。完整参与者分页保留有效事实集合与 user.id DESC，不以有限快照替代分页                                                                                                                                                                           |
| W13–W18/W23、R01/R04；DOC-01、GATE-01/02、OWNER-01–06、DEL-01 | Doc 唯一 owner binding；评论身份、摘要、锁/序号按稳定 Article。请求 CommentContext 强制 canonical Community，Doc 根据 owner 当前 main 做正文准入；preview 权限不能授权公开讨论。all_public 是显式批量入口。最后正文 branch purge 保留 Article/讨论；manifest 授权的 production seed 可显式传 `purge_stable_article: true`，且无剩余 DocLifecycle 时才删稳定聚合 |
| W11/W12、R06/R07；ACT-01–04                                   | 评论活动只更新稳定 Article。Doc 的 display/sort/cursor 以及 Article/ArticleLite Flop 共用 `COALESCE(GREATEST(article.active_at,state.active_at),public.published_at,article.inserted_at)`；同方向 binding tie-break。DocBranchState 删除评论锁与两个编号字段；重复发布不重置                                                                                    |
| W19–W22；RX-01–04                                             | Article/Comment 的 upvote、每种 emotion 及共用 collect helper：稳定用户去重、最大5位、撤销按有效事实补位；count/bitmap/revision 保持同一 SQL/事务。各 emotion 仍是独立集合，不新增独占 emotion 切换命令                                                                                                                                                         |
| R08、SNAP-02                                                  | Snapshot.Members 共用有界数组能力；Accounts 提供一次窄字段批量读取，Snapshot/ShadowSync 整页去重刷新根、回复及 reaction。失败保留快照，不改变成员/顺序/count/revision，不回写 JSON；不增加第二缓存。GraphQL 用 purpose-separated HMAC `ref` 表达稳定成员身份，不暴露内部数字账号 ID                                                                             |
| R01–R12；READ-02/03、REV-02                                   | schema、SDL/codegen、SSR、reconcile/mutation result 同源；ArticleStats 和 root summary 各自按 owner revision 合并，允许同版本资料叶子刷新，拒绝同版本成员冲突。新 article/comment/deep-link/viewer-summary Query namespace。移除 isViewerJoined。搜索直接读 ArticleStats，并在有效 count 变化后 enqueue metrics                                                 |
| M01–M10；MENT-01–04、MSG-01–03                                | 复用在途稳定 Doc/Comment endpoint 实现并在本轮独立运行联合测试。Comment mention/notification 不保存正文 branch，正文事件保留 branch/version；消息后台准入使用显式 all_public，Ticket 通知传已有 Community。盘点脚本改为通过 stable Article 的 main DocPublic 找正文，不再引用 c.branch_id；不改 Mention 初始化/重建的权限或静默边界                             |
| R02；FOLD-01、B6                                              | folded 与其他回复同页，replyTo 保持真实身份，默认收起/本地展开。摘要展示4位头像、有效条数、最后回复相对时间；有效 count=0、仍有删除占位时提供“查看回复记录”。本地展开不写 DB。窄屏去掉 ArticleView 的固定横向留白，摘要允许整体换行                                                                                                                             |

存储形式：新增 article/root participants 使用 `embeds_many Embeds.User`，PostgreSQL 是一个 JSONB 数组值（`jsonb` 列，默认 `[]`）；既有 reaction latest-users 是 `jsonb[]` 列。共用的是有界成员与资料刷新规则，不把两种物理列类型混为一谈，也不把 Embeds.User 和 JSON 快照说成两套数据。

折叠写入保留既有受 Gate 约束的内部 fold/unfold command，重复 set 返回 unchanged；本轮不新增公开 GraphQL fold mutation。界面的本地展开/收起不等同于持久化审核操作。

## 2. 新 schema 与严格准入

新增迁移从 `20261105190000` 到 `20261105233000`：

- 新摘要字段、非负/数组上限/entries 不小于有效 count、revision 约束及查询索引。
- canonical ArticleBinding.thread/FK、Doc partial unique、不可变身份、membership owner/branch guards、Community 删除 guard、CommentReviewBlock owner guard。
- deferred `require_doc_owner_at_commit` 保证不能提交零 binding 的稳定 Doc；合法 Article 删除级联仍可完成。
- 删除评论 branch、完整回复 embed、branch 评论锁/编号字段；reaction 数组/count 约束及 Comment delivery 无 branch 约束。
- 迁移遇到既有 Article/Comment 数据会拒绝，未加入回填或兼容读取。历史 Mention facts 迁移仅修正了 PostgreSQL timestamptz 的 precision 参数，其余稳定 endpoint 改造沿用另一个 session 的工作。

`SchemaGeneration` 的凭证只能由空库 bootstrap 建立，普通 migration 不能伪造：

```text
明确命名的空库 -> bootstrap generation + DB name/OID + source/build
  -> Release 先验证 provenance -> migrations
  -> 校验外部批准的 schema SHA -> ready
  -> API/worker startup 再核验同一 DB/generation/fingerprint
```

指纹包括目标列、约束、索引、触发器、8个身份 guard 函数正文和 Messaging delivery guards。旧库补默认列、缺 provenance、未 ready、错误 DB/generation/指纹均不能准入。缺 stats 行会报错并回滚创建，不靠读取初始化零值。

[真实空库验证结果](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-cutover-validation.json)：

| 坐标          | 本地验证值                                                         |
| ------------- | ------------------------------------------------------------------ |
| database      | `groupher_comments_20261105_cutover_validation`                    |
| generation    | `9a6be54e-c745-4bdc-a7ea-531e61c06017`                             |
| schema SHA256 | `dc181bea607252628bef669ef3fa89809f475e9489c9eb11ec93085a42d6bdad` |
| 结果          | ready 校验成功，未 ready/错误 DB 拒绝                              |

这是私有本地库证据，不能用于生产 manifest 的 DB 身份或新库声明。

## 3. 可重复的验收命令与结果

工作目录为 `backend/api`，全部命令使用独立 build 与显式私有 DB：

```bash
export MIX_ENV=test
export MIX_BUILD_PATH=/private/tmp/groupher-comments-build-20261105
export TEST_DB_NAME=groupher_comments_20261105_implementation
mix test test/groupher_server/cms/comments test/groupher_server/cms/articles/doc_owner_constraints_test.exs test/groupher_server/cms/articles/doc_owner_concurrency_test.exs test/groupher_server/cms/articles/comment_summary_initialization_test.exs test/groupher_server/cms/articles/doc_activity_test.exs test/groupher_server/cms/articles/pagination_test.exs test/groupher_server/cms/interactions test/groupher_server/cms/gate test/groupher_server/cms/production_seed/acceptance_test.exs test/groupher_server/cms/articles/trash_test.exs test/groupher_server/cms/communities/lifecycle_test.exs test/groupher_server/jobs/comments_test.exs test/groupher_server/cms/snapshot_test.exs test/groupher_server/cms/shadow_sync_test.exs test/groupher_server/cms/snapshot/members_test.exs --max-cases 4
```

| 验证组                                                                                                                                          | 结果与证据                                                                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 上述整合回归                                                                                                                                    | [535 passed](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-integrated-tests.log)                                                  |
| 新私有 identity 库：Activity、mention_version_facts、mentions_b1_acceptance、mentions_map_query、Doc Tree trash、Messaging mention/notification | [151 passed](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-identity-fresh-tests.log)；本轮自己运行，未复用他处通过数              |
| Bindings、content_import_flow、全部 Doc Tree、Tickets                                                                                           | [139 passed](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-parent-tests.log)                                                      |
| Summary、SchemaGeneration、Release 最终 focused                                                                                                 | [19 passed](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-final-contract-tests.log)；包括 SQL 预算、实际 GraphQL ref 和缺行不补写 |
| GraphQL 评论读写与 Mentions 查询（四 thread，串行）                                                                                             | [192 passed](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-transport-verified-tests.log)；完整 transport 重跑成功                 |
| 前端展示、真实中英文词典、revision/namespace/cache/mutation guards                                                                              | [81 passed / 15 files](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-frontend-final-tests.log)                                    |
| 类型、协议与编译                                                                                                                                | Core/Community type-check、SDL/codegen、`mix compile --warnings-as-errors` 成功；日志在同一证据目录                                                                          |

这些数字是各命令执行数，存在重复用例，不能相加宣称独立用例总数。42个 case ID 是验收设计索引，也不等于“恰好42个 ExUnit test”或全部发布场景已通过。

联合身份组必须在全新、尚未运行 unboxed 并发夹具的私有测试库执行。此前在复用 implementation 库运行时有3个全库绝对数量断言受已提交并发夹具影响；没有通过清空旧库或改写另一个 session 的断言掩盖问题。切换全新 identity 库后151个测试全部通过。并发 owner 用例使用独立连接/barrier，分别覆盖 READ COMMITTED/REPEATABLE READ 与首事务提交/回滚，不是共享 Sandbox connection 上的假并发。

新/扩展的具名测试实际落点：

- PUB-01：`articles/comment_summary_initialization_test.exs`（四个 thread 首次/重复发布）。
- CNT/REP/FOLD/REV/SNAP/READ/REL：`comments/summary_test.exs`、`comments/shared_doc_test.exs`、`comments/concurrency_test.exs`、`comments/schema_generation_test.exs`。
- OWNER：`articles/doc_owner_constraints_test.exs`、`articles/doc_owner_concurrency_test.exs`；ACT：`articles/doc_activity_test.exs` 与 shared_doc。
- RX：`interactions/snapshot_members_test.exs` 与既有 projection/reaction/emotion suites；SNAP：`snapshot/members_test.exs`、snapshot/shadow_sync。
- MSG-02：`activity/artiment_event_test.exs`；MENT/MSG 其余边界使用本轮上述151测试联合组。
- 前端：`ReplySummary`、`ReplySummary.locale`、`RepliesList`、Facepile、revisionGuard、articleStats、key 等15个 focused 文件。

原 B0 设计中的新建 publish 子目录路径改为实际已存在的 `articles/comment_summary_initialization_test.exs`；不保留空的预期路径作为已完成证据。

## 4. SQL 与真实页面

[REPEATABLE READ READ ONLY 核对](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-readonly-validation.json) 在本次新库 fixtures 上比较 Article count/去重人数、root count/entries/lastReplyAt，以及10/4位快照的有效成员和顺序、Article revision 与持久失效意图最高版本，差异为零。root 版本直接记录观察值，不按评论行数推算。另保存首末参与 EXISTS、DISTINCT ON 有界补位和最后有效回复时间的写侧查询计划。附实际 `EXPLAIN (ANALYZE, BUFFERS)`：摘要查询只读 ArticleStats；小样本计划不能据此声称生产规模性能已测完。

READ-01 telemetry 对空历史与8条评论的 commentsState 查询验证相同 SQL 次数、没有 Comment 关系读取或 COUNT；合法完整关系分页/补位写入/离线只读核对仍可以查询真实关系。

私有 API `4195` + Community dev server `3009`，使用 `home` 测试社区及 `xx` 夹具账号，真实 `/home/post/1` GraphQL/SSR：

- 确认5条有效回复只展示4位头像，且有最后回复时间。
- 点击/键盘 Enter 展开回复，server folded 回复默认收起，可本地展开；父列表收起再展开保留本地状态，未发 mutation。
- 全部有效回复删除后“View reply history”仍可打开删除占位。
- 320px 摘要换行且不超出容器。中文使用真实词典组件测试；当前 Community server locale 固定 English，本轮未新增站点语言切换能力。

截图位于根目录 `.playwright/shared-comments-{expanded,keyboard,deleted-history,mobile}.png`。浏览器有既有静态资源缺失（pattern 404、static.groupher.com DNS、fixture avatar URL 失败）及本地 host-only theme 警告；头像 fallback 正常，不能把这次联调称为零 console error。未替换真实接口或将 mock 截图当作协议验收。

## 5. 固定证据与并行工作区

[实施后源码哈希](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/source-hashes.json) 记录此时5716个相关源码/测试/协议文件。其后 Effects owner/facade 和重复资料刷新收口的指纹及正文差异另见同目录 `source-hashes-final.json` / `post-validation-differences.json`；最终 transport 输入追加到 `source-hashes-transport.json` / `transport-input-differences.json`，5717项指纹中22项相对初次实施观察发生变化，均保存稳定双读正文和 ledger/case 映射。它们是工作区指纹，不声称每条先前命令都运行在同一个不可变 checkout；另一个 session 仍可继续修改文件。审计输入的正文/哈希由原49项固定快照负责，测试日志明确绑定本轮命令及私有库，不用“current”覆盖历史。

F01–F10 的后续归属：唯一 owner/准入→OWNER/GATE；publish→PUB-01；最后 branch 保留→DEL-01；init/rebuild→MENT-03/04；Comment delivery branch→MSG；盘点脚本稳定父→M04；旧 endpoint 证据不复用→151测试联合组；新 schema/fresh generation→REL-01。未删除 Mentions 合法的 rebuild/init 或正文 branch 逻辑。

## 6. B5 真实发布仍阻断

以下均未执行，必须由发布负责人填入并核验；开发实现完成不授权处置旧数据：

| 必填证据                                                                            | 当前状态                                                                        |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Release executor / data owner / 产品验收人真实姓名、应用构建 ID                     | 待分配                                                                          |
| 明确目标新 DB name/OID、generation UUID、空库 bootstrap source、批准的 schema SHA   | 仅本地样例，不能用于生产                                                        |
| 旧库保留/归档/丢弃的明确决定与授权                                                  | 未授权；不自动删除、不回填                                                      |
| 旧 API/worker 停止、请求 drain、旧 comments participant repair Job 清理及 running=0 | 未执行；旧 payload 为 `reconcile_comments_participants`，新 worker 不兼容执行它 |
| backend/GraphQL/frontend 一次发布；SSR/content/CDN 缓存失效与旧页面更新             | 未执行；新 Query namespace 已实现                                               |
| 实际目标 URL 的权限、隐藏、占位、摘要版本及缓存来源验证                             | 未执行；本地 URL 不替代发布验收                                                 |

发布顺序（显式选定并记录全新空库之后）：

1. 设置 `MIGRATION_EXPECTED_DATABASE`、`SHARED_COMMENTS_EXPECTED_DATABASE` 为同一批准 DB；填 `SHARED_COMMENTS_GENERATION`、`SHARED_COMMENTS_BOOTSTRAP_SOURCE`、`SHARED_COMMENTS_BUILD`。
2. 用 release eval 执行 `GroupherServer.Release.bootstrap_shared_comments()`。非空库必须失败，禁止为了通过而删表或伪造凭证。
3. 设置由新 schema 验收环境批准的 `SHARED_COMMENTS_SCHEMA_SHA256`。若相关 Mention legacy-drop migration 仍 pending，同时满足其独立 `MENTIONS_GRAPH_CUTOVER_CONFIRMATION` 合同；不能绕过另一个模块的发布准入。
4. 执行 `GroupherServer.Release.migrate()`：DDL 前 provenance 校验，DDL 后指纹相等才 ready。失败不启动新 API/worker；不得回落旧读源。
5. API/worker 启动再次校验 ready，整体切换并收集上表证据。回退只能整体应用/schema/manifest 协调，不能将旧 writer 接到新 schema，也不能用 down migration 伪装兼容。

### 最后静态 review

Effects/facade 和窄成员读取收口后，另行运行 [50个 focused 回归](comment-reaction-snapshot-counts-audit/implementation-20261105T111200Z/groupher-comments-effects-boundary-tests.log) 全部通过；最终 `mix compile --warnings-as-errors`、owned 文件格式检查和 `git diff --check` 均通过。

- 将摘要失效意图从 Summary 移到 `Comments.Effects.summary_changed`；调用仍在同一事务，未增加异步计数。Release 和 GraphQL 经 CMS facade 进入领域能力。
- RevisionProjection 仅读取 ArticleStats 的存储成员，把资料刷新留给最终整页 Response；不提前刷新一遍再刷新整页。详情仍是恒定的窄摘要读取，不扫描 Comment 事实。
- 最初 `pnpm docs:check` 停在本轮未修改的 `test/groupher_server_web/query/cms/artiment_mentions_test.exs` 测试标题命名；该文件随后随并行工作区更新，完整 `pnpm docs:check` 已重跑通过。没有为通过检查改动该在途文件，后续查询回归单独纳入本轮验证。
- 最终完整 `pnpm docs:check` 通过；source manifest 同时保留该文件在实施期间发生变化的记录，不宣称工作区无漂移。

### GraphQL 回归同步

Transport 测试沿用新鲜私有库 `groupher_comments_20261105_transport`。旧测试的初始 revision=0 断言已同步为1，commentsState helper/四组查询删除 isViewerJoined 并验证稳定 ref；Doc 锁断言改读稳定 Article。首轮 `--max-cases 4` 在这些旧断言之外还出现夹具创建的 command_resolution_pending，已停止该次运行，不列通过；最终 transport 命令使用 `--max-cases 1`，其结果另列，不据此声称并行 transport 夹具已修复。

最终 transport 命令：

```bash
TEST_DB_NAME=groupher_comments_20261105_transport mix test test/groupher_server_web/query/cms/comments test/groupher_server_web/mutation/cms/comments test/groupher_server_web/query/cms/artiment_mentions_test.exs --max-cases 1
```

沿用 §3 的 MIX_ENV/MIX_BUILD_PATH。最终192个测试全部通过；首轮串行的191/192只剩旧 branch 锁断言，修正为稳定 Article 后完整重跑，并纳入 ref 验证。没有修复或隐去先前并行运行中观察到的夹具创建 pending，发布团队不能把串行结果当作该并行现象已解决。

最终验收结束后再次只读比较5717项 transport 输入指纹，差异为0（`after-transport-differences.json`）；这是该观察时点的证据，不锁定后续共享工作区。私有 API、前端 dev server 和本轮浏览器 session 均已关闭，私有测试库保留供复核。

## Review 收尾：占位、折叠记录提示与时间戳（2026-11-05）

- **折叠根**：FoldLayout 在有效 repliesCount=0、hasReplyEntries=true 时直接显示“查看回复记录”。仍是原折叠行按钮，点击/键盘展开根后通过现有摘要进入历史；不是一步直接打开回复分页的新交互。无嵌套按钮，无 mutation，未增加公开 fold 写接口。
- **资料缺失**：新增 ShadowSync SNAP-02 回归：已有快照用户的 User 行缺失时，用 unavailable 展示资料保留 article/root/reaction 的 ID/ref、顺序、数量及全部摘要字段。不改 Summary 新写入的合法账号要求，也不为已被删除的事实捏造参与者。
- **时间戳**：根回复摘要以 repliesRevision 判断新鲜度，不保证修改 Comment.updated_at；lastReplyAt 是有效回复的原始创建时间。ArticleStats.snapshot_at 是 DB 时钟的摘要时间戳，正文仍按 CommentBody 版本/时间管理。主计划 §5.2 已明确，未新增 updatedAt 缓存判断或改写根时间戳。
- **独立发现**：[直接物理删除账号会级联删评论但不维护 ArticleStats](comment-account-deletion-audit.md)，已在私有 Sandbox 证实并记录为未修复。账号删除策略不属于本批，未改 FK/删除流程；本次占位测试通过不等于删除一致性已通过。

本轮 focused：前端4文件16项通过（含实际中英文词典、无历史/有有效回复对照）；后端 Snapshot/ShadowSync 19项通过；Core 与 Community type-check 通过。另1项临时诊断只负责记录账号删除结果，不计入一致性通过数。

真实页面 `/home/post/1` 使用私有 API/新 schema 夹具验证：根折叠后提示可见，键盘 Enter 展开，现有历史按钮可打开删除占位，捕获到的 mutation 请求为0。截图 `.playwright/comments-review-folded-history.png`；仍有既有静态资源/fixture avatar 失败及本地 theme 警告，未声称零 console error。

[本轮源码、SHA、测试与浏览器记录](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/manifest.json)。此前审计与运行证据不覆盖，未提交、未发布。

本轮补充：320px 下折叠历史提示完整可见，折叠行内嵌套按钮数为0。完整 `pnpm docs:check`、前后端 scoped 格式检查与 `git diff --check` 通过；本轮私有 API、Vite 和浏览器已关闭，未发布。

## 账号物理删除 blocker 的封闭（2026-11-05）

用户后续授权实施数据库拒绝方案：[当前合同、完整 root/读取/搜索输入验收与新 schema SHA](comment-account-physical-deletion-block.md)。新增 `20261105234500`，拒绝任意现存账号的 DELETE 与 TRUNCATE，ALWAYS trigger 在 replica 模式也生效，缺失/禁用/篡改均不能通过批准指纹校验。31项定向、143项回归及全新私有库 ready 验证通过；不提供账号删除/匿名化命令。

早先未修复的诊断仍是历史证据，新构建的删除路径已在本地封闭；旧环境未安装 guard 前仍有原风险。本轮未发布、未改旧库、未回填。原 `dc181...` 仅作旧验证证据，新本地验证 SHA 为 `fbc51ba8c1750dfd6205d144c79ac6aa2e90af46563fe44a0b9e463d9cacb5ae`，实际 B5 manifest 必须使用对应目标新库的批准坐标。

## 本地提交边界（2026-11-05）

本次本地提交收录共享评论 schema/writer/reader、reaction 成员摘要、replies 界面、账号物理删除 guard、测试及原始审计证据。共享文件按差异拆分；GraphQL schema 和生成文件只包含评论合同的变化。MentionsGraph 内部、Article Activity、请求取消、部署和认证的在途改动不整体纳入。

Comments.Effects、评论命令和 Doc 清理中的稳定身份适配依赖当前共享工作区的 MentionsGraph 实现。该功能已完成[Doc Comment 本地联合验收](../feature/article/mentions-graph-doc-comment-joint-acceptance.md)，不再列为“等待实现”；是否已提交全部依赖及是否可发布需分别核验。既有后端运行结果来自集成工作区，不能据此声称仅检出本提交即可独立构建或发布。临时导出的暂存快照仅用于生成 GraphQL 产物及运行提交前静态检查，不改变另一会话的源码或工作目录。冻结证据按原始字节保存，保留日志和 patch 中已有的空白。

## 测试隔离后续

用户授权后调整测试调度并重跑联合组合，见[共享评论集成测试隔离与 MentionsGraph 联合验收](comment-test-isolation.md)。原串行通过数和 pending 诊断仍绑定原时点；本轮结果单列，不能反写历史证据，也不能替代 B5 的目标库、writer drain、缓存切换和 URL 验收。
