# Comments、Replies 与 Reaction 快照和计数收口

> 状态：本地实施与验收中，未发布
>
> 2026-11-05：固定输入只读审计已完成；用户后续明确授权进入共享评论业务实现。B1–B4 与 B6 已集成到当前 `fix/todo` 工作区，独立新 schema 验收见 [实施记录](comment-reaction-snapshot-counts-implementation.md)。B5 的真实发布、旧环境处置和目标 URL 验收尚未执行。
>
> 不考虑旧数据或旧逻辑兼容；未操作既有生产/开发库，未提交或发布，也未干预另一个 session。历史审计正文与 SHA 保留。

## 1. 范围与交付原则

覆盖文章评论参与者、根评论回复参与者，以及 Article/Comment 常规 upvote、emotion 的有限用户快照和持久化 count。普通 Article 包含现有支持评论的 Post、Blog、Changelog；不为 Ticket 新增评论。**同一稳定 Doc 只有一个 owner Community、一个评论区，列表、回复、参与者和 count 均不随 branch 分裂，不跨社区。** Doc 不支持 mirror/move，正文仍保留 branch 的发布、访问和审核边界，公开正文入口仍只开放 main branch。

已确定原则：

1. `Embeds.User` 是用户快照的 Ecto 表达，JSONB 是持久化形式，不是两套机制。
2. 写入业务事实时维护有限快照；普通读取直接取摘要，不扫描完整参与关系生成头像。
3. Count 使用具体数据库字段，优先复用 `ORM.inc/2`、`ORM.dec/2` 或同等原子 SQL；禁止应用读旧值后计算覆盖。
4. 事实、count、快照、owner revision 和失效意图在同一事务内一致；缓存不承担计数正确性。
5. 资料刷新只修补响应，不改变参与者成员、顺序或数量，不回写快照；允许过时头像、昵称兜底。
6. 回复摘要最多 **4 位去重用户**；文章评论摘要统一最多 **10 位去重用户**。`commentsState` 同步改为 10 人，不保留旧 20 人行为。需要完整用户列表的消费者使用关系分页。
7. Count 统计完整有效集合，不是头像数组长度；一个人多条回复分别计数，头像只出现一次。
8. 普通文章与 Doc 的评论身份统一为 `article_id`，回复归根 `comment_id`；评论不保存 branch 归属。正文的发布/切换分支不复制、迁移或重置评论。修改请求的审阅讨论是另一个未来产品能力，不进入公开评论模型，本轮不实现。

### 1.1 不兼容切换边界

- 新 schema、新 writer、新 DTO/GraphQL、前端 guard 和新 reader 按同一合同交付，不支持新旧版本混跑。
- 删除 legacy/persisted 双读开关、旧源 fallback、旧 embed 双写、历史 marker、lazy initialization 和旧协议适配，不将它们改名后保留。
- 不提供历史数据回填、格式转换、旧 count 修补、`apply/repair` 命令或兼容性迁移脚本；旧数据不属于本次验收输入。
- 验证基于按新 schema 初始化的独立数据库与新 fixtures/seed。新运行环境的数据准备必须遵守新写入合同；读取不能现场修复或补齐摘要。
- 不兼容不代表当前获得删除数据的授权。业务实现授权不包含旧环境处置；任何旧环境重建、删除数据库或丢弃数据均不是本文可自动执行的步骤。没有符合新合同的目标运行库时，发布阻断，不暗中转换旧数据，也不伪造零值。
- 保留删除占位、完整参与者分页等仍需要的产品能力，使用新逻辑实现；它们不是旧实现兼容层。

后续授权补充：未受控的账号物理 DELETE/TRUNCATE 已采用 [数据库拒绝方案](comment-account-physical-deletion-block.md) 封闭，并加入 fresh-generation 指纹校验。账号删除/匿名化产品策略仍不在本批；旧无 guard 库不受当前工作区实现自动保护，B5 必须核验新 guard 与新 schema SHA。

不包含 ViewTracker、collect/report 产品重构、常驻 Audit/Repair、账号删除策略重写、物理 Comment destroy 新能力。公共 helper 仍需回归 collect 共享调用者。

相关合同：

- [Interaction 当前入口](../feature/interaction/README.md)、[V5 同步事务与 Audit 退役](../feature/interaction/v5.md)。不恢复常驻 repair。
- [ArticleStats 与公共缓存](../architecture/article-stats-and-public-cache.md)。保留 count/content/viewer 分离及 owner revision。
- [Article/Comment 社区解耦](../feature/article/article-lifecycle-comment-decoupling.md)。普通评论跨 binding 共享一次统计。
- [MentionsGraph 执行合同](../feature/article/mentions-graph-refactor.md)。Doc/Comment 稳定 endpoint 与真实正文 token 的同步修订见 4.9，相关实现是删 Comment.branch_id 的前置依赖。
- [Gate](../feature/gate/README.md)、[FrontDesk](../feature/front-desk/README.md)。摘要模块不成为另一套授权系统。

## 2. B0 捕获时实现证据与删改落点

本节 A01–A11 是实施前证据，不描述当前运行代码；当前变更及对应测试见实施记录。

以下是源码结论，不是生产数据报告。旧实现只用于确定替换清单，不构成兼容承诺。

| 编号 | 当前事实与证据                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | 目标落点                                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01  | [ArticleStats](../../backend/api/lib/groupher_server/cms/model/article_stats.ex) 有持久化 count；[apply_comment_counts/record_comment_change](../../backend/api/lib/groupher_server/cms/article_stats.ex) 重新 COUNT/COUNT DISTINCT 后覆盖                                                                                                                                                                                                                                                                                                                                                                                      | 正常写入原子 delta，普通读取不聚合；删除旧全量重算 writer                                                                                          |
| A02  | [Article](../../backend/api/lib/groupher_server/cms/model/article.ex) 无参与者字段；[Create.add_participant](../../backend/api/lib/groupher_server/cms/comments/commands/create.ex) 是 no-op；`Participants`（已删除） 残留旧 embed writer                                                                                                                                                                                                                                                                                                                                                                                      | 当前 stats owner 新增快照，删除旧 Participants/no-op，不恢复旧 Article/meta 字段                                                                   |
| A03  | [RevisionProjection](../../backend/api/lib/groupher_server/cms/articles/revision_projection.ex) 全量查评论、preload 作者、内存去重取 10，没有 Lifecycle/Review 过滤；[comments_state](../../backend/api/lib/groupher_server/cms/comments/query.ex) 另走 Gate，按 User ID 取 20                                                                                                                                                                                                                                                                                                                                                  | 统一读取持久化 10 人摘要，按最近有效参与排序                                                                                                       |
| A04  | [Comment](../../backend/api/lib/groupher_server/cms/model/comment.ex) 保存 count 和完整 replies embed；[Persist](../../backend/api/lib/groupher_server/cms/comments/persist.ex) 原子加 count、写最早 3 条 embed；[PageProjection](../../backend/api/lib/groupher_server/cms/comments/page_projection.ex) 又查询预览并聚合覆盖 count                                                                                                                                                                                                                                                                                             | 删除旧完整 embed 存储/写入，根摘要持久化；实际回复正文仅从 canonical Comment 分页读取                                                              |
| A05  | [Comment Lifecycle](../../backend/api/lib/groupher_server/cms/comments/lifecycle.ex) 经 [ReviewBlocks.recompute](../../backend/api/lib/groupher_server/cms/review_blocks.ex) 重算文章 stats；fold/unfold 只改 is_folded，当前回复查询排除 folded                                                                                                                                                                                                                                                                                                                                                                                | Comments owner 维护状态 delta；fold 只影响展示，不改变 count/成员/最后回复，但推进列表版本                                                         |
| A06  | record_comment_change 递增版本，apply_comment_counts 却将版本设为评论行数                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | 独立递增 revision，不从 count 推导                                                                                                                 |
| A07  | [Upvote](../../backend/api/lib/groupher_server/cms/interactions/reactions/upvote.ex)、[Emotion](../../backend/api/lib/groupher_server/cms/interactions/reactions/emotion.ex)、[Persist](../../backend/api/lib/groupher_server/cms/interactions/persist.ex) 依事实唯一约束/影响行数区分 changed/unchanged；[Sync](../../backend/api/lib/groupher_server/cms/interactions/projection/sync.ex) 锁投影行并原子更新                                                                                                                                                                                                                  | 保留正确的幂等、bitmap/count/snapshot 组合 SQL，不拆散事务                                                                                         |
| A08  | Sync 新增去重截断、撤销只移除头像不补位；[Config](../../backend/api/lib/groupher_server/cms/interactions/config.ex) 默认 reaction 头像上限 5                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | 共用数组能力，撤销按有效事实补位；不把所有 reaction 改为 4 人                                                                                      |
| A09  | [ShadowSync](../../backend/api/lib/groupher_server/cms/shadow_sync.ex) 已经接入 [Snapshot.Projection](../../backend/api/lib/groupher_server/cms/snapshot/projection.ex) 的 stale-first；[Snapshot.Query](../../backend/api/lib/groupher_server/cms/snapshot/query.ex) 直接批量查用户                                                                                                                                                                                                                                                                                                                                            | 复用编排，用户权威摘要读取委托 Accounts FrontDesk 批量入口，不逐头像调用完整 User loader                                                           |
| A10  | ShadowSync fixed users 只处理顶层，递归只处理 emotion；参与者未接入，按条目/字段重复刷新                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 整页收集 fixed/emotion/comments/replies 用户，去重一次刷新，再按路径还原                                                                           |
| A11  | Doc 评论的 [Scope](../../backend/api/lib/groupher_server/cms/gate/scope/comment.ex)、[Access Loader](../../backend/api/lib/groupher_server/cms/gate/access/load/query.ex)、[RequestCommunity](../../backend/api/lib/groupher_server/cms/comments/request_community.ex) 和 [审核目标](../../backend/api/lib/groupher_server/cms/review/target.ex) 均依赖 Comment.branch_id；[分支 FK](../../backend/api/priv/repo/migrations/20260930160000_add_stable_article_runtime_identity.exs) 为 ON DELETE CASCADE；[Doc Trash](../../backend/api/lib/groupher_server/cms/docs/trash.ex) 最后一个分支 membership 清理后可删除稳定 Article | 一并解除评论 branch 存储、授权上下文、审核定位、置顶和级联依赖；仍校验当前正文入口，分支删除不能隐式删除共享讨论                                   |
| A12  | [Effects.capture_comment_body](../../backend/api/lib/groupher_server/cms/comments/effects.ex) pattern match Comment.branch_id；Mentions Parser/Store/Query/NodeStatus/初始化扫描据此生成身份；Review.Notice/Threshold/Recheck 据此解析社区/标题                                                                                                                                                                                                                                                                                                                                                                                 | 删除字段前所有生产者、消费者及合同必须同一集成变更收敛；Comment endpoint/source 和父 Doc endpoint 改稳定身份，正文 source token 仍保留真实选版信息 |
| A13  | [BindingPersist](../../backend/api/lib/groupher_server/cms/articles/binding_persist.ex) 已拒绝 Doc mirror/move；[Articles.States](../../backend/api/lib/groupher_server/cms/articles/states.ex) 的 Doc 评论活动写 DocBranchState.active_at；[RevisionProjection](../../backend/api/lib/groupher_server/cms/articles/revision_projection.ex) 读取 branch 的评论锁和序号，而 Numbering 已原子写稳定 Article                                                                                                                                                                                                                       | 固化 Doc 单 owner/binding invariant；评论运行态统一稳定 Article；正文 branch 活动仍独立，列表有效活动时间按 4.8 合成                               |

reaction 当前用 `{:array, :map}` 保存由 `Embeds.User` 生成的元素。新代码使用统一内容和算法，不为了 Ecto 容器形式一致而额外重建全部 reaction 表，也不兼容缺少稳定用户 ID 的历史快照。

旧 repair 要逐入口区分：[reconcile_comment_participants_count](../../backend/api/lib/groupher_server/cms/article_stats.ex) 调用 apply_comment_counts，会写入行数版本；同文件 `%Article{}` 的 rebuild_comment_fields 则调用 record_comment_change，并非所有 rebuild 都回退版本。本计划删除这些运行时自愈路径，不将其包装为新的永久 repair 服务。

## 3. 已收敛的统计、folded 与关系分页合同

### 3.1 有效集合

| 状态/操作                         | Count、参与者、最后回复                                      | 分页/交互                                                          |
| --------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ |
| visible 且没有本 scope 的有效隐藏 | 计入                                                         | 正常读取                                                           |
| deleted                           | 不计入                                                       | 保留删除占位，可以查看其仍有效的后代；不得把占位作者重新塞入参与者 |
| destroy                           | 不计入                                                       | Gate 排除，不新增 destroy 产品入口                                 |
| 审核隐藏/恢复                     | 仅在整体有效性跨边界时减/加                                  | 作者/审核者的额外读取不改变公共摘要                                |
| 后端 is_folded                    | 仍计入；fold/unfold 的 count、快照、lastReplyAt delta 都为 0 | **进入同一公开分页，默认收起，点击可展开**                         |
| 前端本地收起                      | 不影响                                                       | 只更新本地状态，不 mutation、不失效业务计数                        |
| 删除/隐藏中间回复                 | 仅改变目标的贡献                                             | 不级联抹除有效后代，replyTo 不可读可为空                           |
| 删除/隐藏根评论                   | 只移除根自身对文章的贡献，不抹除其回复/reaction              | 根不可读时不披露根摘要；删除占位可继续作为对话容器                 |

统计主体为匿名公开读者的资源自身有效事实。父 Article/Community 暂时不可读由 Gate 阻止披露，不将所有子资源计数清零。普通公开集合不采用审核者特权；不新增私有审核数量字段。

### 3.2 folded 的公开访问方式

本轮不新增 folded 专属 GraphQL/SSR 入口，不依赖当前仅内部/测试调用的 `paged_folded_comments`。

1. 根列表、timeline 和根下回复分页取消 `not is_folded` 集合过滤，folded 行与其他行按相同排序/分页返回。
2. GraphQL Comment 暴露 `isFolded`，表示服务端默认展示状态；初次渲染用已有 FoldLayout/等价收起组件展示可点击入口，避免数到了却找不到。
3. 点击收起行只展开本地显示，不修改 DB 的 `is_folded`。本地明确展开/收起优先于服务端默认；分页/refetch 不应无条件覆盖该本地选择。
4. 若 root 本身 folded，也在根列表中保留可展开行。嵌套回复、真实 replyTo 身份和现有分页边界保持。
5. 删除旧 `paged_folded_comments` 的 facade、内部实现和只验证分集合的测试；将仍有价值的用例迁到统一分页。fold/unfold 写入口保留为服务端展示状态操作。
6. fold/unfold 不改业务摘要值，但行的公开展示状态发生改变，必须推进所属 commentsRevision；若目标为回复，还推进根 repliesRevision，发出既有列表/内容失效意图。

fold/unfold 当前仅有内部 Command，没有公开 GraphQL mutation。本轮保留具名内部 set-state 能力，供已授权内部调用/seed 使用；Gate 继续验证 `:edit` 及 canonical 资源，事务内比较状态，重复设置返回 unchanged、不推进版本。不得因为没有 receipt 就重复推进，也不为普通用户点击展开新增公开 mutation。若另需产品中的服务端折叠管理 UI，应独立提出，不作为本轮已存在能力。

同步修改 [PaginationTest](../../backend/api/test/groupher_server/cms/comments/pagination_test.exs) 和 `write/{post,blog,changelog,doc}_comment_test.exs` 中 folded 分集合用例。根查询、PageProjection.descendants 的回复过滤、many 中 replyTo parent 的过滤必须同时去掉 `not is_folded`；删除 preview_batch 实时 count 和旧预览来源。新断言必须证明 folded 在同一页中可到达、真实 replyTo 保持、默认收起、展开不写库，不能只删掉旧测试。

### 3.3 删除占位与零有效回复

`repliesCount` 不包含删除占位，因此不能再用 `repliesCount > 0` 唯一决定是否提供回复入口。

根上另存内部 `reply_entries_count`：统计本 scope 下可公开分页的 visible/deleted 条目，排除 destroy 和审核隐藏，包含 folded。GraphQL 仅返回 `hasReplyEntries = reply_entries_count > 0`；它不是第二个业务回复数，不显示为“有效回复条数”。

- visible -> deleted：repliesCount 减 1，entries count 不变；隐藏/destroy 则按前后是否进入公共分页集合增减 entries count。
- 两个字段都在同一事务原子维护，不在读取时执行 EXISTS/COUNT。
- `repliesCount=0 && hasReplyEntries=true`：展示“查看回复记录”，可展开删除占位和对话；无头像、无 lastReplyAt。
- `repliesCount>0`：展示设计中的头像、有效回复数与最新有效回复时间。

分页 pageInfo 的 totalCount 是分页集合条数，允许包含占位；它不等于有效 repliesCount。Pagi offset 合法 COUNT 不属于禁止的摘要实时计算。

### 3.4 有限摘要与完整关系分页

- 文章摘要固定最多 10 人，回复固定最多 4 人，upvote/emotion 保持 Config 限额。
- `paged_comments_participants` 保留完整关系分页，按与摘要一致的有效 Comment 集合筛选用户；只剩删除占位的作者不能进入。总人数不取快照长度。
- 完整关系分页明确按 `user.id DESC`，cursor 用稳定用户 ID；它不承诺与最近参与的 10 人头像顺序相同。相同的是有效集合，不能因为头像限额缩减完整分页。
- 完整参与者分页可以查询权威关系和 Pagi totalCount，但不再 enqueue reconciliation，不写 stats、不修 revision。
- 原 commentsState 的 20 人读取直接替换成 10 人快照；需要更多用户的调用方同步改用完整关系分页，无 20 人 fallback。
- `isViewerJoined` 当前仅见查询/类型/hook 返回，未发现实际 UI 消费，不作为本次需要新建的产品能力。B0 列全消费者，确认没有产品依赖后由 B3 同步移除 GraphQL 字段、计算、query/hook/type 和测试；若发现实际产品消费，先报告其用途，不为保留字段臆造新机制。

## 4. Doc 共享评论、正文准入与存储合同

### 4.1 稳定评论身份与正文入口分离

当前 [DocBranch](../../backend/api/lib/groupher_server/cms/model/doc_branch.ex) 持有 community_id；[CommunityChain.comment_parent](../../backend/api/lib/groupher_server/cms/gate/scope/community_chain.ex) 用它约束 Doc 的 binding 社区。这是当前 branch-owned Comment 实现，不能继续当作共享评论的存储规则。

目标统一为：

- 普通文章和 Doc 评论聚合身份都是稳定 `article_id`；根回复聚合身份都是 `comment_id`。移除 Comment.branch_id、对应 FK/索引及相关 identity check，不以 NULL/sentinel branch 保留双重模型。
- Doc 是单 owner Community 资源。[BindingPersist](../../backend/api/lib/groupher_server/cms/articles/binding_persist.ex) 已拒绝其 mirror/move；已发布/可评论 Doc 必须恰有一个 ArticleBinding，全部 Doc branch membership 属于该 owner。草稿未建立公开 binding 时不得创建公开评论；不能从多个 binding 中任取一个。新增绑定、导入、seed、内部写入与 DB 约束都要强制此不变量。
- **不新增 doc_comment_stats 或 doc_reply_stats。** 全部评论 count/人数/头像/版本由既有 ArticleStats 的 Comments-owned 字段提供；根摘要存在 Comment 行。
- 请求 Community 仍由可信 article path/context 传入，校验当前 ArticleBinding；Doc 的正文准入在该社区解析 canonical main DocPublic/DocLifecycle/Review 状态，不能从评论旧 branch 或任意 binding 推导入口。
- 内部普通 Comment 操作须显式携带可信请求 Community/管理 context，缺失则 fail closed。内部 Doc Comment 可通过明确的 `Bindings.doc_owner(article_id)` 能力取得唯一 owner（待实现，缺失/多重绑定返回领域错误），再验证管理 actor/context；这是稳定归属查找，不是任取 binding 的 fallback。删除 RequestCommunity 从 Comment.branch_id 猜社区的路径。公开请求仍须显式携带并匹配 owner Community。
- 所有获准展示同一 Doc 讨论区的正文视图返回相同 Comment ID/集合/摘要；branch 不是评论 Query key、cursor fingerprint 或 revision 的身份维度。
- 公开正文仍只读取 main。预览编辑器若展示共享公开评论，也必须通过公开讨论区的准入；只有 draft/preview 权限不能读取受限公开评论或在未发布 Doc 下开一个公开讨论。未来修改请求审阅讨论独立建模，本轮不创建。

```text
request Community + Doc path
  -> canonical binding + public main Doc access / write capability
  -> stable article_id
  -> one shared Comment collection + ArticleStats
```

### 4.2 待实施字段

| owner                     | 字段与约束                                                                                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全部 ArticleStats，含 Doc | 既有 comments_count、comments_participants_count、comments_revision；新增 comments_participants（最多 10 位 Embeds.User 快照），沿用既有 snapshot_at；身份为 thread + article_id |
| 所有根 Comment，含 Doc    | 既有 replies_count；新增 reply_entries_count、reply_participants（最多 4）、last_reply_at、replies_revision；身份为根 Comment ID，不保存 branch                                  |
| ReactionInfo              | 保留 upvotes_count、latest_upvoted_users、bitmap、interaction_revision                                                                                                           |
| EmotionInfo               | 保留 users_count、latest_users、bitmap；Article 侧仍同步 ArticleEmotionCount                                                                                                     |

不增加 summary_version、initialized marker、旧源开关或历史用户 ID 全集。新 aggregate 创建事务初始化真实空集合、count=0、revision=1；首个事实写入后按正常 delta 更新。缺少应有摘要行是写入不变量失败，返回领域错误并回滚；不得读时伪造零值/自动初始化。

整数 count 非空、默认 0、CHECK >= 0；保留稳定 Article/Comment 的唯一约束与 FK；根新字段非空值在新 schema/seed 中直接满足。Ecto 时间为 `:utc_datetime`，迁移普通时间列为 `:timestamptz`，timestamps() 遵循 Repo 默认。评论置顶也按 article_id/comment_id 统一，移除 PinnedComment 的 branch 分组和级联归属，不能切换正文分支就切换置顶集合。

索引在 B0 EXPLAIN 中确认：文章/作者、根/作者、根/时间/ID、Lifecycle/Review 有效事实检查；Doc 共用相同索引，不加 branch 统计索引。服务于存在性判断、最近作者补位和 LIMIT 1，不预建所有排列组合。

### 4.3 公开 DTO 的组装

普通文章与 Doc 都直接返回同一 ArticleStats 的 Comments-owned 字段和既有 snapshotAt，不再从正文或分支临时聚合。Doc 不引入 commentsBranchId 或 scoped commentsRevision；版本身份都是稳定 article_id。公开 locator/query key 仍包含请求社区用于准入/缓存隔离，不代表复制一份计数。

列表显示、ArticleLite 的 comments 排序字段、Articles.Pagination 的排序/游标值、搜索 indexer/projection 指标必须使用同一 ArticleStats.comments_count；Doc 不保留第二个跨 branch 汇总，也不新增 Doc 排序 join。正文换版/换分支不能重置或重复初始化该行。

根 DTO 统一返回 `repliesCount/replyParticipants/lastReplyAt/repliesRevision/hasReplyEntries/isFolded`，不借用仅属于 reaction 的 commentInteractionRevision。

### 4.4 访问、写入与评论锁

| 事件/能力              | 正文 branch 的职责                                                                     | 共享评论的职责                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 读取正文               | 验证所访问正文的 Community、branch、Lifecycle/Review 及 actor                          | 通过讨论区准入后取同一 article_id 集合，不附带预览正文或审阅讨论                                                      |
| 新建评论/回复/reaction | 请求须具备公开讨论区对应的当前父级写能力；未发布、归档、隐藏等按既有 Gate 动作明确处理 | 校验 Comment 自身及 actor 权限，再修改全局事实/摘要；不写入 branch_id                                                 |
| 发布/切换正文分支      | 正文发布、正文缓存按 branch 变化                                                       | 不复制评论、不重置 Count/评论版本；不因每次发布再次创建摘要                                                           |
| 评论锁定               | branch state 不作为各自独立的评论锁权威                                                | 同一评论区只有一个 comments_locked，使用稳定 Article 运行状态；DocBranchState 中相应锁字段及 writer/reader 要同步退出 |
| 父正文隐藏/恢复        | 当前入口不可读/可读；禁止通过评论 API 绕过                                             | 评论事实和统计保留，不逐条隐藏/清零；入口失效和 Comments owner 的内容变化分开                                         |

Gate Access 的 Doc 父上下文不再根据 Comment.branch_id 加载。它验证显式请求入口后构造 canonical main 父能力；Scope、单条 FrontDesk、列表、profile/all_public、回复分页、参与者、reconcile 必须覆盖同一父准入规则，不能只保护一个公开 URL。共享统计行本身不授予访问权限。

### 4.5 正文审核与评论审核分离

- DocReviewBlock 仍以 article_id + branch_id 限制对应正文；预览分支受限不应改变 main 入口的共享评论 count。main 受限时阻断对应入口的公开评论披露，但不删除评论或清零摘要。
- CommentReviewBlock 以稳定 comment_id 为目标。共享评论隐藏/恢复必须是同一结果，不能在不同 branch 返回不同有效集合；公开 count/头像/时间同事务维护。
- 替换 Review.Target.lock_comment_scope、ReviewBlocks 中从 Comment.branch_id 推导 scope 的路径；逐项调整相关数据库约束，保留普通评论全局 block 校验，并新增/加强 Doc owner 校验；保留 Doc 正文本身 branch-level 审核，不把 DocReviewBlock 改成全局正文隐藏。
- **审核权限按单 owner invariant 收敛，不再默认改成普通评论的仅平台全局审核。** 保留当前 Doc owner Community 的既有审核主体/Passport 权限和 community-scoped CommentReviewBlock，以及既有平台限制；block 的 owner 改由唯一稳定 binding 取得，不由 Comment branch 推导。所有正文分支在同一 owner 社区下看到同一隐藏结果，其他社区的 block/审核动作拒绝，不能获得跨社区处置权。
- Doc 参与统计使用“visible 且没有 platform block 或 owner Community block”的同一集合；普通评论继续平台全局 block 合同。Review.Notice、Threshold、Recheck、Target、Restrictions/ReviewBlocks 和相关数据库校验同批替换，不只改 Target。
- B0 记录现有权限到新 owner 解析的等价矩阵；同权限、同 owner 的决定不能因去 branch 失效或扩大。若发现 Doc 实际存在多 owner/binding，则 fail closed 并阻断本方案，而非临时创建多份 count。未来开放 Doc mirror 必须先另订评论可见性/审核合同，不属于本轮。

### 4.6 分支删除与稳定 Doc 删除

当前 [Doc Trash.purge_branch](../../backend/api/lib/groupher_server/cms/docs/trash.ex) 删除分支内容后，若无剩余 DocLifecycle 会继续删除 Article；[Comment.branch FK](../../backend/api/priv/repo/migrations/20260930160000_add_stable_article_runtime_identity.exs) 另有 branch row 删除级联。这是两种不同清理路径，都需要测试。

目标：删除/清空某个正文 branch 只处理其正文、发布、树与审核对象，不删除共享评论、置顶、reaction 或 ArticleStats；恢复/再发布同一稳定 Doc 后继续原讨论。仅明确的稳定 Doc 永久删除可以清理整个讨论区及其派生关系。删除最后一个正文 branch 不得隐式等价为整篇 Doc 永久删除；若产品动作确属后者，必须进入明确的整文档删除用例及授权，而非藏在 branch purge 中。

owner Community 的直接物理删除在 stable Doc 存活时拒绝；明确授权的整社区永久清理先按 UUID 排序锁定并永久删除所属 stable Docs，再删 Community。保留逻辑 destroy、branch purge 与 stable Doc 永久删除的区别；数据库 guard、seed 边界和 Article 合法级联用 OWNER-06 验收，详见 [inventory §4.4](comment-reaction-snapshot-counts-inventory.md#44-community-物理删除与授权清理)。

本轮无旧数据兼容：直接按新 schema 删除评论 branch FK/字段和错误级联，不提供历史评论搬迁脚本；正文 branch 自身合法的 FK/生命周期保留。

### 4.7 Gate CommentContext 的具体变化

Gate.scope/4 的函数签名保持，变化发生在 typed Comment Context 和调用点：

- 单一请求入口使用 `CommentContext.for_thread(thread, community_id: canonical_community.id)`（目标接口）；Context 保存 thread、policy_mode、community_id，删除 Comment 的 branch_policy/branch_id。缺 Community、不匹配 Context/资源或非法 thread 均 fail closed。
- Doc 的 Community 必须等于稳定 Doc owner，Scope 从该 owner 的当前 main DocPublic/DocLifecycle 构造父准入 join，不再 join comment.branch_id。main 不可读时对应入口不得披露评论；正文 branch 仍由 Doc 专属 Context 处理。
- commentsState、paged_comments_participants、PageProjection、InteractionResponse 及其 embedded replies、FrontDesk.Comment、reconcile、MentionsGraph 的具名请求路径传递同一 canonical Community。禁止 resolver 只留下 thread + article.id 后丢掉入口。
- `CommentContext.all_public()` 继续作为 profile/跨 thread 批量公开读取的显式构造器，不能伪装成缺 Community 的 for_thread。该 Scope 在 SQL 中逐资源解析有效 binding；Doc 只允许唯一 owner 及其 main 入口，普通评论按当前可读 binding 去重，不逐行执行 Gate/Repo。
- 内部 owner 查询、公共准入和审核视图是不同职责；知道唯一 owner 不等于获得访问或审核权限。B0 ledger 必须列出 for_thread/all_public 的完整调用点，不能只迁移 GraphQL resolver。

### 4.8 评论运行态、活动时间和序号

具体表达式、NULL/UTC/排序 tie-break 和数据库约束方案见 [B0 inventory §3–4](comment-reaction-snapshot-counts-inventory.md#3-活动时间与序号的确定合同)。

| 字段/能力                                                | 目标权威与读写规则                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| comments_locked                                          | 稳定 Article 唯一评论锁；移除 DocBranchState 的评论锁和从 branch state 回读的路径                                                                                                                                                                                                                                                                                                                                                |
| next_floor / next_comment_inner_id                       | 稳定 Article 唯一原子分配；Numbering 现已写该行，保留其原子行为；删除 DocBranchState 中重复字段及读写映射                                                                                                                                                                                                                                                                                                                        |
| 评论引起的 active_at                                     | 更新稳定 Article，沿用现有活动时间窗口规则；Comments.Commands.Create 不再走依赖临时 branch 的 Doc 更新分支。现有此函数不写 last_active_at，不凭字段名新增写入，详见 inventory §3.2                                                                                                                                                                                                                                               |
| 正文分支的 active_at / last_active_at                    | 可保留 DocBranchState 对正文发布/编辑的活动事实，但不再作为评论活动权威，不反向覆盖稳定 Article 评论活动                                                                                                                                                                                                                                                                                                                         |
| 列表 activeAt / active_at / doc_active_at、排序与 cursor | 三者均使用同一 effective_active_at：已准入 main 上 `COALESCE(CASE WHEN state.is_sunk THEN state.active_at ELSE GREATEST(article.active_at, state.active_at) END, public.published_at, article.inserted_at)`；UTC、秒精度，普通分支不进入 max。ArticleLite.select_content(:doc) 的两个字段、Pagination 输出、Article/ArticleLite Flop 配置及 cursor 全部同源；升/降序均以 binding_id 同方向作唯一 tie-break。详见 B0 inventory §3 |
| RevisionProjection.stable_meta / revision_meta           | 评论锁/序号和评论运行态从稳定 Article 组装，不从 DocBranchState 读取，也不提供旧字段 fallback；is_edited、正文选版等真正 branch 状态保留 branch 来源                                                                                                                                                                                                                                                                             |

Doc 发布/重复发布初始化共享 stats 时不得重置这些运行字段。B0 必须点名 Articles.States.update_active_timestamp、Comments Create、Numbering、Article/ArticleLite 的 Flop 配置、Pagination 的 activeAt/doc_active_at、RevisionProjection 及 DocBranchState 模型/迁移/seed 的生产者和消费者。

### 4.9 MentionsGraph 身份与在途合同同步

> 以下为 2026-11-05 共享评论迁移时的 MentionsGraph 在途依赖记录。2026-11-07 已移除 set／初始化／正文 token 运行时；当前发布边界见[当前关系合同](../feature/article/mentions-graph-sync-contract.md)。本节旧要求不能用于简化版验收。

本计划与 [MentionsGraph 执行合同](../feature/article/mentions-graph-refactor.md)、[Article/Comment 解耦合同](../feature/article/article-lifecycle-comment-decoupling.md) 的 Doc Comment branch 例外冲突。本次同时修订目标合同，不等业务完成后才解释；初次审计的旧实现与当前在途改动须分层理解。固定快照 20261105T074802Z 的 49 项输入已静态复核并分类，见 [snapshot review](comment-reaction-snapshot-counts-snapshot-review.md)；六文件记录仅作历史证据；这不证明共享评论存储、通用 Gate 或本计划 B1–B3 已完成。

统一目标：

- Comment endpoint/source identity 始终为稳定 comment_id；parent 为稳定 `(parent thread, article_id)`，Doc parent 是稳定 `(doc, article_id)`，不存 branch。Doc endpoint 同样以 `(doc, article_id)` 唯一；不新增另一种伪 Doc 节点或可空 branch 双身份。
- **endpoint 身份与正文选版分开。** Doc 正文的 source_token 仍包含真实 `branch_id:branch_version_id:publication_version`；当前公开 projection 只能选择唯一 owner 的 canonical main token，preview 发布不覆盖 main，不把多个正文分支混成一个 source set。保留各真实版本 set，但不开放非 main 图。
- Effects.capture_comment_body 的 Comment struct pattern、Parser、Store 的 identity/CHECK/unique/parent 校验、MentionsGraph.Query/NodeStatus 和 initialize_source_scan 一起删除评论 branch 依赖；Doc main 是查询/选版时解析的上下文，不固化为 Comment parent 身份。
- Graph focus/locator、node identity 和当前邻接关系不携带 Comment branch；NodeStatus 仍经请求 Community 的完整 Gate，不能因改稳定身份而绕过 main 正文限制。Doc 单 owner 决定合法社区；普通 Article mirror 规则不受影响。
- 在途 MentionsGraph 的模型、DB CHECK/partial unique、扫描与新测试已有部分稳定身份改动；B1–B3 先按固定快照复核核对并复用符合目标的实现，再补剩余依赖并重跑联合身份矩阵；不能沿用“Doc/Doc Comment branch 必填”的已通过结论。双方在相关模块/发布切换前有同一个身份合同，不允许新 Comment schema 配旧 parser/source handler。
- Mentions 已有受控 saved-set rebuild 和通知恢复路径须纳入 M08/M09 的联合边界验收；不作为评论 count/snapshot 回填或常驻 repair，不因名称相似误删。
- 本计划不执行 Mentions 历史关系转换或当前正文初始化。MentionsGraph 自身的 report/preflight/当前正文初始化边界仍由其合同负责；新 Doc/Comment 身份必须先纳入其来源/幂等/版本验收，不能借其初始化工具兼容旧 Comment.branch_id。

### 4.10 Messaging 与 Activity 元数据

| 内容种类                         | 稳定身份与版本                                                                                                     | branch 元数据与定位                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Doc Comment 的 mention/通知/活动 | comment_id + stable article_id；评论正文版本/token；当前 Messaging.Mentions.Persist 已有的 comment:<id> 去重键保留 | 不保存评论 branch；关联唯一 owner Community，链接按当前可读 main 和 comment innerId 解析。正文切换分支不得再次投递同一评论版本 |
| Doc 正文发布/修改事件            | 稳定 Doc 身份 + 实际正文 source token                                                                              | 仍记录真实正文 branch/version，不能把文档发布事件的 branch 也一并清空                                                          |

Review.Notice/Threshold 取唯一 owner，Recheck 的评论标题取该 owner 当前公开 main 正文（仍遵守已有管理权限），不从 Comment branch 取；无可用标题按现有错误/不可用策略处理，不猜其他 Community。Messaging 的 mention/notification 模型保留供正文事件使用的 branch 字段，但 Comment 事件明确不写该字段。Activity.ArtimentEvent 的 Comment clause 已按 comment/article 身份描述，需验证生产者/投影不再补入 branch；不是所有通用 branch helper 都应删除。

## 5. 原子写入、版本与资料刷新

### 5.1 正常事务

```text
Command transaction + existing Gate admission
  -> lock canonical aggregate / root / reaction projection
  -> change authoritative fact or visibility
  -> determine before -> after effective contribution
  -> atomic count delta + bounded snapshots + lastReplyAt
  -> advance owner revision + persisted timestamp
  -> persist existing Outbox/invalidation intent
commit -> deliver effects and invalidate caches
```

- 锁顺序统一：既有 transaction/advisory 与 Community admission 锁 -> 稳定 Article aggregate -> 根 Comment 按 ID 升序 -> reaction projection 按稳定 key。若准入还需 main DocLifecycle/正文锁，在同一 Gate owner 核实并统一取得顺序；不能只锁用户正在编辑的 preview branch 就修改共享评论。核对现有 Gate/Review 所有入口，不增加相反顺序的锁，也不新增 Doc 评论 aggregate 锁。
- 复用 ORM.inc/dec；reaction 一次 SQL 同步 bitmap/count/snapshot 的组合原子更新保留。防负数不是幂等替代，异常必须回滚，不能靠 clamp 掩盖双减。
- reaction 的唯一约束、ON CONFLICT DO NOTHING、受影响行数 changed/unchanged 保留；Comment command 重放不得重复加减。
- 人数首末次参与在同一 aggregate lock 内用有索引的 EXISTS/NOT EXISTS 判断，不在普通读取中查询，也不全量 COUNT DISTINCT。
- 多个审核 block 只在整体有效性转换时加减；解除一个但仍有其他 block 时 delta=0。entries 集合与有效业务集合分别计算 delta。
- Command、Lifecycle/Review 回调只能由一个 Comments owner 维护一次；删除重复全量重算链路。
- 最近参与排序按每用户最新有效事实的 `(inserted_at, id)` 倒序；编辑和用户资料刷新不改变顺序。恢复采用原事实时间。
- 删除/隐藏最新贡献时，在写入事务内有界查询剩余最近去重用户补位、替换 lastReplyAt；没有有效回复则 NULL。禁止读取时从 3 条预览推导。
- 普通 mirror 共享一次；解绑某 Community 不减共享普通评论数。清理、seed、maintenance 都遵循同一事实/投影合同。

### 5.2 版本推进规则：不再作为开放项

| 事件                                            | Comments owner revision                         | 根 repliesRevision                                  | reaction revision                 |
| ----------------------------------------------- | ----------------------------------------------- | --------------------------------------------------- | --------------------------------- |
| aggregate 创建                                  | 初始化 1                                        | 根初始化 1                                          | 按既有创建规则                    |
| 新建/删除/隐藏/恢复有效内容，或公开占位集合改变 | 原子 +1，每次有效 Command 内同 owner 只推进一次 | 若影响根下条目，原子 +1                             | 不因目标 Comment 隐藏而清空/重置  |
| 纯正文编辑、fold/unfold                         | 原子 +1，保护公开列表内容/状态                  | 若为根下回复，原子 +1；根自身 fold 不改变其后代版本 | 不改                              |
| upvote/emotion 事实 changed                     | 不改                                            | 不改                                                | 原子推进既有 interaction revision |
| 重放/重复设置且状态 unchanged                   | 不改                                            | 不改                                                | 不改                              |
| 响应中刷新头像/昵称                             | 不改                                            | 不改                                                | 不改                              |

时间字段职责：根回复摘要的新鲜度只以 `repliesRevision` 判断。`update_root` 的摘要更新不保证推进根 `Comment.updated_at`，后续缓存/SSR/客户端不得用该字段判断是否存在新回复；根行其他状态写入仍可更新它。`lastReplyAt` 只表示最新有效回复的原始创建时间，编辑/fold/资料刷新不改变它。ArticleStats 的 `snapshot_at` 由同一 owner 事务使用 DB 时钟推进；正文版本与时间归 CommentBody，不能把根摘要变化当成根正文编辑。

版本只原子递增，不等于行数；没有回填版本策略，因为本轮没有历史回填。新数据初始化在创建事务完成，不能通过可选“初始化后再决定是否 bump”制造同版本不同摘要。

B5 不扫描所有行额外加版本，不使用清缓存代替业务版本。切换通过新合同完整发布、清理旧缓存/请求和 B3 的版本 guard 实现。新合同同一 owner 身份下，Count、参与者 ID 顺序、时间或条目集合若改变，必须有更高版本。

guard 对参与者比较的是成员 ID/顺序等业务摘要。相同 revision 下仅头像/昵称刷新允许按 Snapshot 策略修补资料，不能把资料字段变化误报为计数冲突；刷新也不能借机换成员。

### 5.3 共用能力与唯一资料读取入口

在 CMS.Snapshot 既有边界复用纯数组操作：规范化、按稳定 ID 去重、前移、截断、移除、按有效参与事实重建。Comments/Interactions 各自负责事实过滤、锁、count 和补位来源，纯 helper 不执行 Gate/Repo，不建立万能 target registry。

ShadowSync 收集整页所有顶层/嵌套 fixed、emotion、ArticleStats.comments_participants、Comment.reply_participants 路径的用户 ID，去重一次刷新，再按原路径/顺序还原。

保留 Snapshot 缓存与 stale-first 编排；Snapshot.Query 的用户批量权威读取委托 Accounts FrontDesk 的批量 display summary 入口，不循环调用完整 FrontDesk.user。批量读取入口不再增加第二套摘要缓存。miss/刷新失败保留当前快照，缺失账号使用现有 unavailable placeholder，不回写、不篡改参与关系。此处的旧快照兜底是正常资料新鲜度策略，不是历史数据兼容。

这里的 unavailable 合同针对已有快照成员的资料不可用：响应保留其稳定 ID/ref、顺序和数量。新评论提交必须有真实合法账号；不通过占位账号绕过写入授权。当前 Comment.author_id 外键物理删除账号时级联删除事实，后续摘要重建应依据仍存在的有效参与关系，不能为已删除事实制造占位成员。物理账号删除引起的摘要同步问题单独见 [账号删除核查](comment-account-deletion-audit.md)，不由 left_join 或资料刷新补偿。

## 6. B0–B6 执行计划

依赖：`B0 -> [B1 + B2 + B3 集成变更] -> B4/B6 本地验证 -> B5 整体发布`。B1–B3 是 schema/公共能力、writer、reader/协议的任务分工，须作为一个可编译、可测试的集成变更验收，不承诺删除一半后的中间提交能独立部署，也不增加临时兼容代码。B1–B4 在新 schema 隔离环境完成，B6 与协议集成一同在本地验证，B5 放行后整体发布。每批保留无关脏工作区，不自动 commit/push。

### B0：源码清单与执行基线

**B0 执行设计已收口并进入实施。** 静态输入与历史复核继续绑定冻结 SHA；随后用户明确授权业务实现。inventory 的42个 case、owner/锁/删除合同和发布准入均已具体化，本地运行证据见实施记录；不把生产 owner 尚未填名误写为已获得发布授权。

- [x] 建立 B0 inventory，记录源码版本/脏文件指纹、读写入口、表/索引、正文准入和评论 branch 依赖、具名测试、约束方案及锁顺序；新增消费者继续更新 ledger。
- [x] 将第 3–5 节变成具名 case，尤其 4/10 人、folded 同页可到达、删除占位、Doc 单 owner/binding、跨正文分支共享一次、错入口拒绝、隐藏正文不清零、分支删除不删评论。统计和 owner 归属已确定，不再作为开放项。
- [x] 按 4.5 节记录 Doc owner Community 审核权限的等价映射；Notice/Threshold/Recheck/Target 等均从稳定 owner 解析，不增加权限。新库中构造第二个 Doc binding 或异 owner branch membership 必须被命令及数据库层拒绝（并发也不能绕过）；draft 无公开 binding 时不能建公开评论。列出 isViewerJoined 的实际产品消费，执行 3.4 节清理约定。
- [x] 列全 Command、动态 Lifecycle/Review dispatch、Comments.States、清理/seed、Job、maintenance 和现有 destroy/FK 级联路径；literal grep 无结果不等于无调用。
- [x] 列出 `reconcile_comments_participants` Job 的 enqueue/perform、offset participants reconciliation、ArticleStats.rebuild_comment_fields/reconcile_comment_participants_count 及完整调用者，逐项标明删除/替换。
- [x] 设计新数据 fixture 和只读校验清单，EXPLAIN 首末参与/补位/时间查询；使用已知新 fixture，不为历史库建立 report/apply 链路。
- [x] 完成下表逐入口 ledger，含调用者、当前 Gate、目标事实/统计源、删除归属和 case ID；补齐发布级 fresh-DB preflight 与执行 owner，不能只记录“使用新库”。

退出：inventory、测试 case、schema/锁/索引、权限决策与发布准入落点齐全；B1–B3 不依赖尚不存在的历史报告或 manifest。B0 不对旧数据做兼容验收。

必须具名核对的读写 ledger：

| 入口/消费者                                                                                                                                                                      | 目标要求                                                                                                                                                                  | 实施归属                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Comments resolver 的 comments_state、paged_comments_participants 及 CMS facade/Query                                                                                             | 保留完整 article path/显式 Community，校验正文入口后按 article_id 读取；不继续丢掉 Community 只传 thread + ID                                                             | B3                                             |
| FrontDesk.Comment、Gate.Scope.Comment/CommunityChain、Gate.Access.Query/Load/Check、RequestCommunity、MutationLock 的评论调用链                                                  | 删除评论 branch identity；仍按当前可信入口校验正文与 actor；覆盖单条、列表、profile/all_public                                                                            | B2/B3                                          |
| Comments Create/Reply、Persist、Numbering、PinnedComment/States                                                                                                                  | 评论/根/置顶/锁均归稳定 Article；不从请求 Article 临时 branch 字段或 canonical root.branch 派生归属                                                                       | B1/B2                                          |
| Review.Target/ReviewBlocks、Comment/DocReviewBlock、scope trigger                                                                                                                | 正文审核留在 branch；评论 target 无 branch，权限按 4.5 决策，不自动扩大社区权限                                                                                           | B1/B2                                          |
| Review.Notice、Review.Threshold、Review.Commands.Recheck                                                                                                                         | Doc Comment 社区/阈值 scope 由唯一 owner 得到，标题通过 owner 的当前 main；保留正文审核 branch token，不再 pattern match comment.branch_id                                | B2/B3                                          |
| Comments.Effects.capture_comment_body/current/deleted、Outbox 捕获及 handler                                                                                                     | 创建/回复/编辑/删除都捕获稳定 Comment/source/parent；唯一 owner 代替 comment_community_id 从 branch 解析，失败仍回滚捕获事务                                              | B2                                             |
| ArtimentMentions.Parser、Store、MentionsGraph.Query/NodeStatus、initialize_source_scan、Endpoint 模型/CHECK/unique                                                               | 按 4.9 统一稳定 Doc/Comment endpoint；Comment source 无 branch，Doc 正文 token 保留实际 main 选版；相关在途合同同步、矩阵重验                                             | B1–B3 与 MentionsGraph 相关 owner 同一集成变更 |
| Messaging.Mentions.Persist、Messaging.Model.Mention/Notification、Events.Notify.parent_article_for_notification、Activity.ArtimentEvent 及其生产/投影者                          | 保留 comment:<id> 去重；评论元数据不填 branch、取 owner/main 定位，正文事件仍带真实 branch；分支切换不重复投递                                                            | B2/B3                                          |
| Articles.States、Comments Create、Numbering、RevisionProjection.stable_meta/revision_meta、DocBranchState、Article/ArticleLite 的 Flop doc_active_at、Pagination.activeAt/cursor | 评论锁/序号/活动写稳定 Article；分支正文活动独立；effective active select/排序/cursor 同表达式，删除评论字段 branch fallback                                              | B1–B3                                          |
| Publish.Target（普通文章）、Publish.Doc、Doc branch/Trash、Community/Article 清理                                                                                                | 普通/Doc 首次发布初始化 count=0、空 comments snapshot、comments_revision=1；重复发布不重置；分支 purge 不隐式删 Article/评论；owner Community 物理删除遵循 inventory §4.4 | B2                                             |
| ArticleStats.for_article/for_articles/read_public 及所有调用者                                                                                                                   | 相同 Article 始终同一份 comments 字段；公开披露前仍验证请求入口，不引入 Doc branch 统计覆盖                                                                               | B3                                             |
| Comments.Query.Reconcile.reconcile_states、Comments.CommandResult、Interactions.CommandResult、CollectFolders.CommandResult                                                      | mutation/重放/reconcile 的 stats 与页面同源，保留可信请求上下文；不能返回未准入的正文或另一入口数据                                                                       | B3                                             |
| ArticleLite、Articles.Pagination 的 comments 排序/游标、SearchArtiments.Indexer/Projection                                                                                       | Doc 与普通文章统一使用 ArticleStats.comments_count，排序/显示/索引同口径                                                                                                  | B3                                             |
| SSR、Press/公开 stats、DTO/normalizer、Query key/revision guard、评论摘要视觉                                                                                                    | 不再含 commentsBranchId/branch 版本域；Community 继续用于公开入口隔离；资料刷新不改变成员                                                                                 | B3；新视觉 B6                                  |
| 旧 Participants、完整 replies embed、reconcile enqueue/Job/rebuild、paged_folded_comments                                                                                        | 各自的唯一删除 owner 见下一节；B5 只核验无残留                                                                                                                            | B1–B3                                          |

删除归属固定：B1 删除旧 schema 字段/FK/模型声明和孤立 Participants 模块，B2 删除相关 writer/repair API/Job 实现及 enqueue，B3 删除旧 reader/公开协议字段/folded 专属接口与对应测试。跨文件调用必须在 B1–B3 同一集成变更内一起修改；B5 不再实施遗漏删除。

### B1：最小 schema 与公共快照

- [x] 实施第 4 节：Doc 与普通文章共用 ArticleStats 快照和根 Comment 摘要；不建任何 Doc 专属评论统计表。
- [x] 新 aggregate 创建路径初始化零 count、空数组、revision=1；覆盖 Publish.Target（Post/Blog/Changelog）与 Publish.Doc 的 ArticleStats.initialize，PUB-01 验证首次/重复发布；seed 按新合同创建，缺行是错误。
- [x] 实施纯数组公共能力、Accounts 批量摘要入口及 Snapshot/ShadowSync 整页刷新，包括新增参与者字段和嵌套 fixed users。
- [x] 删除旧完整 replies embed、Comment.branch_id 及相关 FK/索引/约束、PinnedComment branch 归属和孤立 Participants 模块；writer/reader 调用由 B2/B3 在同一集成变更删除，不做临时双写。
- [x] 同步稳定 Doc/Comment Mentions endpoint 的 schema/CHECK/unique，删除 endpoint branch 身份；正文版本 token 保留 branch。Doc 单 owner/binding 和 branch membership 同 owner 通过数据库约束/trigger 与 aggregate lock 强制，不能只依赖 mirror facade 的拒绝。具体采用 inventory §4 的 binding thread 判别 + canonical FK + Doc partial unique + membership/不可变性 guards；逻辑迁移名和约束名已具名，B1 才创建迁移文件。扩展 enforce_comment_review_block_scope 校验 Doc block owner，配套 Comment 父身份不可变 guard；OWNER-02 验证裸 SQL 绕过被拒绝。
- [x] 删除 DocBranchState 重复评论锁/序号字段；稳定 Article 保持唯一分配器。全部 Effects/Review/Mentions/Messaging/Activity 消费者由 B2/B3 同一集成修改后才验收，不把编译失败推给未来批次。
- [x] 新 schema 直接建立非负/唯一/FK 约束；只支持新数据，不加 nullable 初始化 marker 或旧数据转换脚本。

退出：新库初始化、约束、公共 helper 和缓存资料刷新测试通过；所有根统一字段，不含兼容分支。

### B2：业务 writer、旧 repair 退出

- [x] Comments Create/Update/Delete、Lifecycle/Review、States、清理/seed 通过唯一 owner 按 before/after 原子维护文章、根摘要及 entries count；Doc 同样按稳定 article_id 维护，不按 branch 分片。
- [x] Gate/RequestCommunity/Review 显式传递可信请求入口，按 4.4/4.5/4.7 处理正文准入、共享评论锁和 owner 审核；Publish.Doc 不重置评论，branch purge 不删共享讨论。落实普通 Article 与 Doc 相同的初始化 owner，first/repeated publish 都有测试。
- [x] Effects 创建/回复/编辑/删除捕获、Notice/Threshold/Recheck、Mentions source/store、消息活动生产者按 ledger 全部替换；稳定 owner 缺失/冲突报错，不在 branch 上找退路。
- [x] 评论活动更新稳定 Article，锁/序号与 Numbering 保持同一权威；DocBranchState 只保留正文活动。正文版 token/正文事件 branch 不因评论重构被清掉。
- [x] 覆盖多 block、首末次参与、最近用户补位、lastReplyAt；不因编辑/fold 改业务 count，但按第 5.2 节推进列表版本。
- [x] 删除 apply_comment_counts 的正常全量重算及版本行数逻辑，保留必要的初始化零行和原子字段维护 API。
- [x] 删除 participants offset reconciliation enqueue、reconcile Job 的旧处理、旧 rebuild/reconcile API 及调用者；完整关系分页保留为纯读取。
- [x] 删除旧完整 embed writer、update_replies_embed、reply 同步旧快照及已去除字段的写入；States.fold/unfold 在锁内区分 changed/unchanged，重复 set 不推进版本。
- [ ] 交付清单列明旧持久 Job payload 类型；发布前在旧 worker 停止后移除/取消对应排队任务并确认没有 running 实例。不给新 worker 加“读旧 payload 修旧数据”的兼容分支。
- [x] 保留 reaction 的事实唯一约束、受影响行数、锁和组合 SQL；所有失败回滚，无后台补齐投影。

退出：状态、并发、重放、回滚、普通 mirror 和 Doc 单 owner 通过；Effects/审核/通知/活动/提及捕获没有剩余 Comment.branch_id 依赖；没有旧 Job 或读取副作用能覆盖新计数/版本。

### B3：读取合同、folded 访问与前端 guard（切读前必须完成）

- [x] 根列表/timeline/回复分页返回 folded 行，暴露 isFolded；现有界面接入默认收起/本地展开。删除内部 folded 专属集合接口，保留展示状态 mutation。
- [x] 所有摘要读取直接取字段；删除 PageProjection 实时 count 覆盖、完整 embed 读取、RevisionProjection 全量参与者查询；保留 canonical 正文分页和 Gate 检查。
- [x] commentsState 统一 10 人摘要；paged_comments_participants 仍提供完整有效用户分页，无修复副作用。
- [x] 同步 GraphQL/schema/fragment、TComment/ArticleStats、codegen、normalizer、SSR、reconciliation、mutation 结果、有限/无限分页及 Query 缓存。
- [x] 将 ArticleStats comments_participants 成员顺序纳入 Comments owner 合并；根新增 repliesRevision guard，保护 count/participants/time/hasReplyEntries；reaction guard 仍只保护 reaction。
- [x] Doc 评论版本按稳定 article_id 比较，不引入 commentsBranchId；正文的 branch metadata 留在正文协议。错误 Community/不可读正文响应不能进入正确评论缓存。
- [x] 按 B0 ledger 逐个替换 commentsState、完整参与者分页、所有 CommandResult/reconcile/ArticleStats 消费者和排序/游标/搜索指标；不要只改 UI 字段。
- [x] CommentContext 的 for_thread 强制 canonical community_id，all_public 独立批量构造；InteractionResponse/嵌套回复/PageProjection/MentionsGraph 同步，正文 main 按 owner 解析。RevisionProjection 从稳定 Article 读评论运行态，Doc effective active 的 activeAt 展示、select、排序/cursor 及 Article/ArticleLite 两套 Flop 配置一致。
- [x] Parser/Store/NodeStatus/初始化扫描和 Messaging/Activity 投影按稳定身份验收；Doc 正文 source_token 仍验证真实 main 版本，不将 preview 选版写成当前公开 projection。
- [x] 一次性采用新的 comment-summary Query key 合同命名空间，旧命名空间删除，不做并行读取或字段 fallback；旧版本页面不作为受支持运行时。
- [x] 用延迟旧响应、同版本业务冲突、同 Doc 不同可读正文视图仍共享、错入口拒绝、资料刷新、refetch 本地展开状态验证；Count=0 的占位对话有可用入口。

- [x] 同步 Gate README、V4 §4 的 Comment Context/constructor 与验收条款、V5 的关联说明；更新 scope/comment_test、scope_test、access_test、check_in_transaction_test 和 all_public 调用者。Doc/Document branch selector 合同不变，禁止把旧 Comment constructor 保留为兼容入口。

退出：所有读取/客户端字段和 guard 已集成并有真实响应测试。B5 不能等 B6 才补 DTO/guard；B6 仅负责新的摘要视觉。

### B4：常规 upvote / emotion 快照补齐

- [x] Article/Comment upvote、每种 emotion 共用数组能力，撤销后按有效事实时间/ID 补位。
- [x] 重复新增不前移头像或加 count，重复撤销不双减；撤销非快照用户仍保持有界最新集合。
- [x] 公共读取只取 ReactionInfo/EmotionInfo/ArticleEmotionCount；“全部点赞用户”分页保留事实关系查询。
- [x] 目标 Comment 隐藏/删除不清空既有反应事实，Gate 拒绝不允许的后续操作；恢复可读不需要重建 reaction。
- [x] 验证 collect 共享调用者没有退化，不扩展其产品范围。

退出：所有 reaction 的并发、幂等、补位、投影失败回滚与嵌套资料刷新通过；Count 和 bitmap 仍同事务一致。

### B5：新合同集成验收、发布准入与切读

- [ ] B1–B4 全部通过；已有界面具备 folded 和删除占位访问能力；新 DTO、guard、scope/query key 已完成。下面任何前置项缺失均阻断发布。
- [ ] 在明确命名的新 schema 数据库运行新 seed/fixtures，覆盖所有状态与 upvote/emotion；通过只读查询核对 count/成员顺序/最新时间/版本。
- [ ] 只读核对仅服务本次新实现验收，不能写 DB/缓存、enqueue、自动 repair；一批 REPEATABLE READ READ ONLY 快照内比较事实与持久化字段。不增加产品运行时扫描 Job。
- [ ] 核验 B1–B3 删除项已清零：Participants、完整 embed、评论 branch 依赖（含 Effects/Review/Mentions/Messaging/Activity）、聚合覆盖、旧 reconciliation、兼容开关/marker/lazy initialization/回填脚本；B5 只核对，发现残留退回对应 owner，不在发布批次补实现。保留正文合法 branch、分页 COUNT、完整参与者/点赞用户分页。
- [ ] Doc 单 owner/binding 的数据库负向/并发用例、审核权限等价矩阵、两份关联合同及在途 MentionsGraph 身份新验收齐全；不能拿旧 branch endpoint 的已通过记录放行。若相关 Mentions handler 仍按旧 Comment struct 工作，则整个切换阻断。
- [ ] 发布清单记录目标 DB/schema 和应用版本；旧服务/worker 停止、旧请求 drain、旧 repair Job 不再执行，禁止新旧 writer 混跑。
- [ ] 同一发布切换 backend/schema、GraphQL contract 和前端构建；采用新 Query key 命名空间并失效旧 content/SSR/CDN 缓存。旧 HTML/旧页面通过发布版本更新流程刷新，不由新接口兼容旧协议。
- [ ] 目标库每个 aggregate 都满足新写入合同，缺行立即阻断；本轮不扫描/转换旧库后宣称兼容。
- [ ] 在实际目标 URL 验证折叠内容可展开、摘要一致、隐藏不泄露、旧响应不回盖；记录缓存来源与实际返回版本。

退出：源码/构建/schema/数据库身份、测试/只读核对、查询预算、缓存失效及 URL 验收证据齐全。未发布只可标记本地完成；没有旧数据回填完成项。

### B6：新 replies 摘要视觉

- [x] 新建 ReplySummary 和独立 Salon：最多 4 个重叠头像、有效回复条数、最后回复相对时间；复用头像 fallback、时间和 i18n。
- [x] 默认显示摘要，整行点击展开已有分页；有删除占位且无有效回复显示“查看回复记录”。folded 回复位于同一分页，默认收起、可点击展开。
- [x] 这批只调整视觉/交互，不补 B3 应已完成的协议和 guard；零有效回复不展示无效头像或时间。
- [x] 验证中文/英文、窄屏、键盘焦点、无头像及新增/删除/隐藏后的收敛；浏览器使用 `/home/xx`，截图放 `.playwright/`。

退出：真实接口和状态转换下设计成立，不以 mock 截图代替；B5 已提供的 folded 访问能力不能因摘要视觉重构丢失。

## 7. 发布及失败处理合同

### 7.1 必须同时具备的切读前置条件

1. Doc 单 owner/binding invariant、共享评论身份、正文准入/owner 审核等价映射、新 schema、全部 writer、旧 repair 删除完成。
2. 新数据创建即完整初始化，无历史库转换、无读时修补。
3. 公共/私有集合分离、完整关系分页、folded 同页访问与删除占位入口完成。
4. GraphQL/codegen/normalizer/SSR/mutation/reconcile/Query key 和 owner guard 完成。
5. 用新 fixtures 验证原子事务、版本、查询预算、同 Doc 跨正文分支共享及请求权限隔离，不以清缓存代替任何一项。
6. 发布级 fresh-DB preflight、版本更新与旧缓存失效步骤可执行；旧服务、请求、worker 和 repair Job 不再参与新运行环境。

不存在“先切后补 guard”“先新 writer/旧 reader”“靠 lazy initialization 跑旧数据”的发布阶段。B0–B4 只是开发拆分，不能据此部署半套合同。

### 7.2 版本、资料及错误

- 新初始化 revision=1，真实业务变化按第 5.2 节原子递增；资料刷新不改业务版本。
- 同版本不同 count/成员/时间是写入或协议错误，测试和验收必须失败，不用 snapshotAt 更新绕过 guard。
- 摘要缺失、错误 branch、负数或事实/投影不一致时，领域错误回滚/阻断，不返回旧逻辑结果、不把异常修成 0。
- 新数据只读核对发现差异即修实现和 fixture，从正确创建流程重测，不增加 apply/repair 工具遮蔽 writer 缺陷。

### 7.3 失败和回退

本轮不提供旧读源开关或旧数据逆向迁移。发布前失败留在隔离环境修复；发布后出现故障可停止新流量并修复后重发。若采用平台整环境快照回退，必须恢复匹配的应用/schema/数据库整体并单独评估新写入处理，不能只回退代码连接新 schema；该环境操作另属发布决定，本文不执行。

未获得对应数据操作授权时，不重建当前数据库、不取消实际队列任务；本文件列的是未来发布准入项，不是已执行结果。

### 7.4 fresh-DB 发布准入与执行责任

只写“新库”不是机器可验证前提。发布级数据库代际记录是环境准入证据，不是逐行 summary marker、数据转换或 lazy initialization。以下均待实施：

- bootstrap/provision owner 在新库无业务数据时核验空库前提，生成唯一 generation，记录数据库身份、目标合同/schema 指纹、初始化来源及构建版本。普通 migration 不得自动给已有业务数据的库签发 fresh 记录；schema 相同也不能代替初始化来源证明。
- Release owner 在 DDL 前复用当前 `Release.verify_migration_database!` 的数据库名核验，并校验预期 generation、bootstrap 来源和允许的初始化 schema 阶段；缺失/不匹配返回非零，不能 DDL 后才发现连错库。DDL 完成后、seed/开放服务前再核验目标合同/schema 指纹并将代际标为 ready；不要求空库提前具有目标完整 schema。服务/worker 启动验证同一 ready 代际和目标指纹，不能绕过发布 preflight 接入旧库。
- 发布 manifest 记录服务实例、实际 database/role（不记凭据）、generation、API/worker/前端构建、bootstrap/preflight 输出和具名执行负责人。新库创建/seed、连接切换、权限审核确认、旧 Job 停止与旧库保留/处置分别指定 owner；不得用一句“Release blocked”代替这些证据。
- 旧库处置未获明确授权时只记录保留和隔离方案，不自动删除或导入数据。本计划不提供旧库转换路径。

实现归属：B0 固定 manifest/preflight 接口及 owner 清单，B1–B3 集成时完成 bootstrap/Release/启动检查，B5 仅执行并收集准入证据。fresh-generation gate 已在独立私有新库验证；生产 manifest/具体责任人、旧 writer drain 和部署动作仍是 B5 前置条件，数据库名检查本身不构成准入。

## 8. 验证矩阵与命令

| 用例组              | 必须覆盖                                                                                                                                                                                                 | 批次                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| C01 Count           | 新建、同用户多条、首末次参与、删除、0 边界、重放                                                                                                                                                         | B2                              |
| C02 状态/访问       | visible/deleted/destroy、多 block 隐藏恢复、folded 同页默认收起/可展开、本地展开不写 DB                                                                                                                  | B2/B3                           |
| C03 共享与准入      | 先断言稳定 Doc 单 owner/binding（C12）；同一 Doc 不同可读正文视图同评论/count/版本；preview-only 权限不能读写公开讨论；错 Community/受限正文入口拒绝；正文隐藏不清零                                     | B1–B3                           |
| C04 快照            | 回复 4 人/文章 10 人、稳定 ID、最近顺序、撤销补位、缺失账号、整页去重、资料刷新不改成员                                                                                                                  | B1/B4                           |
| C05 时间/版本       | 编辑/fold 不改 lastReplyAt、删除最新替换、空 NULL；列表变化推进对应版本；重复 unchanged 不推进                                                                                                           | B2/B3                           |
| C06 原子性          | 并发新增/撤销/隐藏/恢复，事实唯一、失败全回滚、统一锁顺序、无后台补写                                                                                                                                    | B2/B4                           |
| C07 读取预算        | 摘要无 COUNT/全量作者 preload；正文/完整关系分页仍合法；历史量增加不改变摘要查询次数                                                                                                                     | B3/B5                           |
| C08 发布            | 新 schema/seed、fresh generation/schema/DB preflight，旧库加默认值也不能通过；无旧 fallback/Job、合同整体切换、旧请求/缓存不能覆盖新结果                                                                 | B1–B3/B5                        |
| C09 UI              | 中英文/窄屏/键盘、4 头像、0 count 占位入口、folded 可展开、新增删除隐藏收敛                                                                                                                              | B6                              |
| C10 删除与审核      | 删除 preview/最后正文 branch 不隐式删评论；明确稳定 Doc 永久删除才清理；DocReviewBlock 限制正文、Comment 隐藏对共享集合生效；唯一 owner 的社区权限保留、错社区拒绝，Notice/Threshold/Recheck 同源（C12） | B1–B3                           |
| C11 全读链路        | Doc 列表显示/comments 排序/cursor/搜索、commentsState、完整参与者、各 CommandResult/reconcile 同源；参与者分页 cursor 排序及删除作者过滤                                                                 | B3/B5                           |
| C12 Owner invariant | Doc mirror/move/第二个 binding 拒绝；导入/seed/直接写/并发不能建异 owner membership；仅 owner 社区与平台现有权限能审核，Notice/Threshold/Recheck 同源                                                    | B1–B3                           |
| C13 运行态          | 跨分支评论锁/楼层/innerId 唯一；评论活动只更新稳定 Article；activeAt 与 doc_active_at 展示/select/排序/cursor 一致（含 Article/ArticleLite Flop）；发布不重置，projection 不回读 branch 评论字段         | B1–B3                           |
| C14 跨合同身份      | 评论创建/回复/编辑/删除捕获完整；Doc/Comment endpoint 稳定且父唯一；正文 main token 正确、preview 不覆盖；初始化扫描/NodeStatus 同身份且保持 Gate/删除披露边界                                           | B1–B3 与 MentionsGraph 联合验收 |
| C15 消息/活动       | 同一评论版本换正文分支不重复投递；评论去重键/owner/main 链接正确且无 branch 归属；正文发布事件保留真实 branch；缺 owner fail closed                                                                      | B2/B3                           |

扩展既有测试：Comments 的 pagination_test、review_blocks_test、collection_pagi_test 和 write/；Interactions 的 projection_test、projection_query_test、emotion_test；snapshot_test、shadow_sync_test。旧 folded 排除测试迁成同页可到达测试，旧 repair 测试删除或改为验证读取无副作用，不保留旧行为分支。

以下是实施时命令，本文交付不执行 DB 测试或迁移：

```bash
# cwd: backend/api；先核实使用新 schema 的独立测试 DB
# mix test alias 会创建/迁移测试库，不得指向当前业务数据库
mix compile --warnings-as-errors
mix format --check-formatted
mix test test/groupher_server/cms/comments/pagination_test.exs test/groupher_server/cms/comments/review_blocks_test.exs test/groupher_server/cms/comments/collection_pagi_test.exs
mix test test/groupher_server/cms/interactions/projection_test.exs test/groupher_server/cms/interactions/projection_query_test.exs test/groupher_server/cms/interactions/emotion_test.exs
mix test test/groupher_server/cms/snapshot_test.exs test/groupher_server/cms/shadow_sync_test.exs

# cwd: repository root；接口和 schema 变更批次
pnpm graphql:codegen
pnpm contract:graphql
pnpm contract:graphql:generated
pnpm --filter @groupher/frontend-core run type-check
pnpm --filter @groupher/frontend-community run type-check
pnpm docs:check
git diff --check
```

B0 inventory 列出新增测试实际路径，执行时追加到上述 focused 命令；记录命令、退出码、测试数量、数据库身份和构建版本。既有脏工作区导致无关失败时单独记录，不写成通过，也不顺手扩大修复范围。

## 9. 完成定义与当前状态

| 项目                                              | 当前状态                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 源码审计、Review 修订、无兼容执行方案             | 已建立文档；固定输入复核与捕获后差异分开记录，原哈希基线的历史逐行 diff 不可还原；未证明生产状态 |
| B0 inventory 与具名用例/索引锁清单                | 固定输入与静态基线已冻结；执行设计已推进到集成验收，历史证据不覆盖后续工作区                     |
| B1–B4 新 schema、writer、读取协议/guard、reaction | 当前工作区已集成；私有新库回归与边界证据见实施记录                                               |
| B5 新数据集成验证、发布切读/缓存验收              | 本地准入/只读核对已执行；真实发布仍阻断，具体剩余项见实施记录                                    |
| B6 replies 摘要视觉                               | 4 位头像、条数/时间与占位入口已实现；真实接口/键盘/320px 本地验证                                |

全链路完成要求：四类业务符合持久化/原子写入合同，Doc 单 owner 下共享评论而正文准入不扩大，保留 owner 社区审核权限且分支删除不隐式删讨论；评论运行态、Effects/Review/Mentions/Messaging/Activity 及关联合同同步完成，版本/guard 与发布代际检查在切读前完成，folded/占位可访问，全读链路同源，旧 repair/旧逻辑已删除，真实接口/UI 验收通过。旧数据转换、兼容读写和回填不是交付项。

完成后将稳定合同同步到 Interaction 当前入口、ArticleStats 文档和Gate README、Gate V4/V5 及分页产品说明；本文保留有限删改清单与实际验收证据，不成为第二份 current 合同。
