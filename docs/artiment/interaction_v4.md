# Artiment Interaction V4：统一 facade、reaction 事务与 Read State

> 状态：主体实现完成，发布准备中。Matcher/Scope、MutationLock、Reactions facade、Report
> admission、ReadState、Article/Comment response assembly、ViewEvents owner 和 report 只读审计
> 已落地；生产存量清理仍待执行。
>
> V4 不保留现有 Interaction 内部模块的兼容入口。实施时以最终 ownership、事务正确性和
> 可读性为准，但必须通过分阶段测试证明行为与公开 GraphQL 合同没有意外变化。

前置文档：

- [Interaction V1](./interaction_v1.md)：fact、bitmap、reaction/emotion info 与 durable view event；
- [Interaction V2](./interaction_v2.md)：物化 count、批量读取和列表排序；
- [Interaction V3](./interaction_v3.md)：Article mutation admission、Gate action 与 metadata 收口；
- [Gate V4](../community/gate_v4.md)：typed Context、`scope/4` 与 `access_check/3`。

当前实施快照：

- 已完成：`CMS.Interactions` facade，upvote/emotion/collect/report/view 命令，changed/unchanged
  幂等合同，Gate canonical reload，`Articles.MutationLock`，Interaction 49xx，Matcher、Const、Scope，
  map-based ReadState、Article/Comment response assembly，以及 `Interactions.ViewEvents` 的收口；
- 已删除：`Interactions.Registry`、Article/Comment 重复 Upvote/Emotion 入口、
  `Articles.Collects` 平行命令、旧 Article/Comment interaction facade、`EmotionToggle`、通用
  `State.write/4` 和旧 `State.read` hydration；
- 已迁移：Article/Comment Reader、List、Resolver、Search、Report List 与 Helper 不再直接依赖
  `Interactions.ReadState`；
- 已收口：`CMS.Interactions` 只委托 `Reactions/ReadState/Scope/ViewEvents`；每个具体 reaction
  完整拥有 Gate、事务、authoritative fact、ReadState 同步与 post-commit effect；
- 已修复：登录 Article page 不再先匿名组装再按 viewer 重组；单条 Comment 的 Article-author
  relation 不再通过 FrontDesk 逐层加载，匿名和登录单条读取都进入同一 response assembly；
- 发布前阻断项：在生产执行 `Interactions.Audit.report_fact_issues/0`，导出并人工确认清单后按
  §1.5/Phase 3 规则清理存量 report，再完成 consumer 联调。

## 0. 背景

Interaction V1–V3 已经依次解决存储、读取性能和 Article mutation admission，但实现结构仍保留了
多轮演进形成的边界：

```text
GraphQL
  ├─ CMS.Articles
  │    ├─ Articles.Upvotes
  │    ├─ Articles.Emotions
  │    └─ Articles.Collects
  ├─ CMS.Comments
  │    ├─ Comments.Upvotes
  │    └─ Comments.Emotion
  └─ CMS.AbuseReports
       └─ AbuseReports.Report

以上模块分别：
  -> Gate 或直接使用调用方传入的资源
  -> 写 Interaction fact
  -> 直接调用 CMS.Interactions.ReadState

Reader / List / Search / Helper
  -> 直接调用 CMS.Interactions.ReadState

Gate / Articles.Lifecycle
  -> 反向调用 CMS.Interactions.Registry 获取 Artiment schema/table

Jobs
  -> 直接调用 CMS.Interactions.ViewEvents / Audit
```

这套结构可以工作，但没有一个能够回答以下问题的稳定产品边界：

> 谁负责对一个 Artiment 执行 upvote、emotion、collect、report 和 view？

当前答案分散在 Articles、Comments、AbuseReports 和 Interactions.ReadState 中。其后果包括：

1. Article 与 Comment 的同类命令复制不同的事务形态；
2. Comment interaction 的 Gate 检查发生在事实写入事务之外；
3. Article/Comment report 没有统一的 Gate admission；
4. Gate 返回的 canonical Artiment 没有成为所有命令的强制输入；
5. 旧 `CMS.Interactions.State` 同时负责写 bitmap/count、批量读取、viewer flag、排序、response
   meta 和兼容刷新；
6. `CMS.Interactions.Registry` 同时保存 Artiment、fact、projection 和 emotion metadata，且被
   Gate、Lifecycle 反向依赖；
7. Reader、Search、Job 直接依赖内部实现模块，使后续拆分等同于全仓迁移。

V4 的目标不是再调整一轮目录，而是让 Interaction 成为有明确 facade、事务和读取合同的 Artiment
子域。

## 1. V4 决策

### 1.1 Interaction 是统一产品边界

不再把同一动作分别定义为 Article helper 和 Comment helper。产品调用统一进入：

```elixir
CMS.Interactions.upvote(artiment, actor)
CMS.Interactions.undo_upvote(artiment, actor)

CMS.Interactions.emotion(artiment, emotion, actor)
CMS.Interactions.undo_emotion(artiment, emotion, actor)

CMS.Interactions.collect(article, actor)
CMS.Interactions.undo_collect(article, actor)

CMS.Interactions.report(artiment, reason, attrs, actor)
CMS.Interactions.undo_report(artiment, actor)

CMS.Interactions.record_view(article, viewer, event_id)

CMS.Interactions.upvoted_users(article, filter)
CMS.Interactions.collected_users(article, filter)

CMS.Interactions.counts(artiments)
```

其中：

- `artiment` 明确指 Post、Blog、Changelog、Doc 或 Comment；
- `article` 明确指 Post、Blog、Changelog 或 Doc，Comment 不支持 collect；
- Account 不是 Artiment，Account report 继续属于 AbuseReports 或 Moderation；
- `upvoted_users/2`、`collected_users/2` 是 Interaction 产品读取，不再由 FrontDesk 代管；
- `counts/1` 接收 Artiment struct 列表并返回 `{artiment_type, physical_id}` keyed 的轻量 fixed counts，
  供 Search、Report List 等不需要完整 viewer read state 的 owner 使用；
- Resolver、service 和 importer 不得直接调用 `Interactions.Reactions.*`、`ReadState.Sync` 或 Ecto model；
- `collect_ifneed` 一类幂等 helper 不进入产品 facade，幂等语义由正式命令定义。

### 1.2 Gate 返回唯一可写资源

所有同步 Interaction 命令遵守同一条事务路径：

```text
CMS.Interactions reaction
  -> 开启 Repo transaction
  -> Gate.access_check(actor, action, input artiment)
  -> canonical artiment
  -> 写权威 Interaction fact
  -> 使用同一个 canonical artiment 更新 Interaction ReadState
  -> commit
  -> 事务后通知、订阅、搜索或其他副作用
```

调用方传入的 struct 或 ref 只用于定位资源。`Gate.access_check/3` 返回后，后续步骤不得再使用原始
资源；事实表 foreign key、作者、Community、通知 target 和 State 更新都必须来自 canonical
Artiment。

Gate 必须在包含事实写入的同一个 transaction 中执行。以下结构禁止保留：

```text
Gate.access_check
  -> Gate transaction/lock 结束
  -> 另开 transaction 写 fact
```

### 1.3 Article MutationLock

Gate 的 Article/Comment Access Check 使用 Article aggregate mutation lock。V4 将其正式命名为：

```elixir
CMS.Articles.MutationLock
```

它解决的问题是：两个修改同一个逻辑 Article aggregate 的命令，不能同时基于旧状态作决定并提交
相互冲突的结果。

> **对同一 Article aggregate，进入 callback 的 mutation 命令不会并发执行。**
>
> **MutationLock 只提供串行化，不判断权限、Lifecycle transition，也不执行任何业务写入。**

普通 Article 的逻辑锁 identity 为：

```text
community_id + thread + article_hash_id
```

Doc 的逻辑锁 identity 为：

```text
community_id + branch_id + article_hash_id
```

MutationLock 使用 PostgreSQL transaction-scoped advisory lock。它锁定由逻辑 identity 计算出的
64-bit key，不要求数据库中已经存在一条可 `FOR UPDATE` 的记录。因此创建 Draft、创建 Lifecycle
或恢复 Trash 时，只要 reaction entry 已经持有稳定 `article_hash_id`，就可以先加锁，再创建相应
数据库行。若两个创建请求连共同 identity 都没有，例如争抢同一个 slug，则属于 NamePolicy/Slug
自己的唯一约束或命名锁，不由 Article MutationLock 解决。

API 统一使用 `with_article` / `with_articles`，通过 arity 和模式匹配识别输入，不在函数名中暴露
`article_hash_id`：

```elixir
# 已加载的普通 Article 或 Doc
MutationLock.with_article(community, article, fun)

# 只有普通 Article 逻辑 identity
MutationLock.with_article(community, thread, article_hash_id, fun)

# 只有 Doc 逻辑 identity
MutationLock.with_article(community, :doc, branch_id, article_hash_id, fun)

# 同一个 Doc 跨多个 branch
MutationLock.with_article(community, :doc, branch_ids, article_hash_id, fun)
when is_list(branch_ids)

# 多个普通 Article 或同一 branch 的多个 Doc
MutationLock.with_articles(community, thread, article_hash_ids, fun)
MutationLock.with_articles(community, :doc, branch_id, article_hash_ids, fun)
```

MutationLock 只负责：

1. 定义 Article aggregate 的逻辑锁 identity；
2. 根据普通 Article/Doc 选择正确 key；
3. 对多资源 identity 去重、稳定排序并按相同顺序加锁；
4. 委托 `Helper.Transaction` 获取 advisory transaction lock；
5. 在 lock boundary 中执行 callback。

它不负责加载资源、调用 Gate、判断 Lifecycle、写 fact/ReadState 或执行事务后副作用。

Article 和 Comment 的 upvote/emotion/collect/report 均已在包含 Gate 的 reaction transaction 中运行。
因此同一个 Article 的 Interaction mutation 已经串行，同一父 Article 下不同 Comment 的 interaction
也会共享父 Article lock；后者是 V4 新增的竞争面。

V4 第一阶段接受该 correctness-first 取舍，但必须保证锁内只有 canonical load、Gate policy、fact
和少量 State SQL；response hydration、通知、搜索同步和外部调用全部位于 commit 之后。必须为
Article interaction 和同一父 Article 下的 Comment interaction 增加并发回归测试，并记录 lock
wait/hold telemetry。若热点 Comment 吞吐不可接受，后续应正式设计 Interaction action 专属的
Gate/lock 粒度，不能把 Gate 移回事务外规避竞争。

Comment reaction 获取锁 identity 时允许一次锁外定位读取，但这次读取只回答“应该锁哪一个父
Article”，不作为授权或事实写入依据。固定顺序为：

```text
锁外根据 Comment input 定位 parent Article identity
  -> 进入 reaction transaction
  -> Gate 获取 parent Article MutationLock
  -> Gate Access.Load 在锁内重新加载 canonical Comment、parent Article 与 Lifecycle
  -> policy check
  -> 使用 canonical Comment 写 fact/ReadState
```

两次读取是有意设计，不能假设结果相同，也不能为了省查询把它们合并。若 Comment 在定位后被删除、
移动，或锁内加载出的 parent identity 不一致，Gate 必须 fail closed。Interaction reaction 不再额外
获取第二把锁；Gate 取得的 transaction-scoped lock 持有到外层 reaction transaction 提交或回滚。

### 1.4 Fact 是权威，ReadState 是派生读取状态

权威事实保持为：

- upvote fact；
- collect fact；
- emotion fact；
- report fact；
- durable view event。

Interaction ReadState 保存可重建的读取数据：

- bitmap；
- materialized count；
- bounded latest-user snapshot；
- viewer membership；
- emotion state。

业务代码不得绕过 fact 直接调用一个通用 `write/4` 改变 ReadState。同步接口必须表达已经
发生的事实，例如：

```elixir
ReadState.add_upvote(canonical_artiment, actor)
ReadState.remove_upvote(canonical_artiment, actor)
ReadState.add_emotion(canonical_artiment, emotion, actor)
ReadState.remove_emotion(canonical_artiment, emotion, actor)
ReadState.add_collect(canonical_article, actor)
ReadState.remove_collect(canonical_article, actor)
ReadState.add_report(canonical_artiment, actor)
ReadState.remove_report(canonical_artiment, actor)
ReadState.merge_viewed_users(article_type, physical_id, user_ids)
```

这些函数是具体 reaction 的内部协作者，不是产品 facade。

### 1.5 明确的公开行为与数据变化

V4 不以“完全保持现有行为”为目标。以下变化是经过设计的公开合同变化，Phase 0 基线、GraphQL
联调和发布说明必须把它们标记为 expected change，不能当成回归：

| 场景           | 当前公开行为                                                | V4 行为                                                                   |
| -------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| 重复 `upvote`  | Article/Comment 返回各自的 already-upvoted error            | 幂等成功，fact/ReadState/副作用不变                                       |
| 重复 `collect` | `collect` 可因唯一约束失败，另有 `collect_ifneed`           | 正式 `collect` 幂等成功，删除平行 helper                                  |
| 重复 `report`  | 以 reporter login 判断，返回 AbuseReport 的 `already_exist` | 以 immutable `reporter_user_id` 判断，返回 Interaction `already_reported` |

现有 report 代码的顺序执行意图已经是“同一 login 最多一个 case”；V4 不是把“同一用户可追加多个
case”改成报错，而是把不稳定的 login identity、分散错误码和缺少数据库级并发保证收口成明确合同。

存量 `AbuseReport.report_cases` 必须在 Phase 3 前审计：同一 Artiment 多个 AbuseReport row、同一
`reporter_user_id` 多个 case、缺失 user id，以及 `report_cases_count`、Interaction `reported_count`
和 bitmap 不一致。若同一 immutable reporter 存在多个 case，迁移固定保留 `inserted_at` 最早的
case；被折叠 case 先输出为 migration audit artifact，再重建 count 与 bitmap。无法映射到 immutable
user id 的 case 不得静默丢弃，必须进入人工处理清单并阻断该批迁移。

`Interactions.Audit.report_fact_issues/0` 是只读入口，固定输出 multiple report row、duplicate
reporter case、orphan reporter identity、empty report 和 `report_cases_count` mismatch。它不自动折叠或删除 case；
生产清理必须先持久化该清单，确保被折叠内容可追溯，再执行一次性迁移与 State rebuild。

## 2. Facade 合同

### 2.1 Mutation commands

顶层 `CMS.Interactions` 只暴露稳定产品动作，不包含 SQL、bitmap、分组或 Ecto model 选择逻辑：

```elixir
defdelegate upvote(artiment, actor), to: Reactions
defdelegate undo_upvote(artiment, actor), to: Reactions

defdelegate emotion(artiment, emotion, actor), to: Reactions
defdelegate undo_emotion(artiment, emotion, actor), to: Reactions

defdelegate collect(article, actor), to: Reactions
defdelegate undo_collect(article, actor), to: Reactions

defdelegate report(artiment, reason, attrs, actor), to: Reactions
defdelegate undo_report(artiment, actor), to: Reactions

defdelegate viewer_state(artiment, viewer, opts), to: ReadState
defdelegate viewer_states(artiments, viewer, opts), to: ReadState
defdelegate counts(artiments), to: ReadState
defdelegate upvoted_users(article, filter), to: Reactions
defdelegate collected_users(article, filter), to: Reactions
```

内部 facade 固定为：

```text
CMS.Interactions
  -> Interactions.Reactions    # upvote/emotion/collect/report routing
  -> Interactions.ReadState    # viewer state/counts routing
  -> Interactions.Scope        # queryable compiler
  -> Interactions.ViewEvents   # durable view-event routing

Interactions.Reactions.*
  -> Gate + transaction
  -> authoritative fact insert/delete, changed/unchanged
  -> Interactions.ReadState    # derived state sync
  -> post-commit effects
```

不存在 `index.ex`。`reactions.ex`、`read_state.ex` 与 `view_events.ex` 是明确的 namespace facade，
只允许 delegate 或模式匹配路由，不包含 Repo、transaction、Gate、Ecto query 或 bitmap 更新。

所有同步 reaction 固定返回：

```elixir
{:ok, canonical_artiment} | {:error, domain_error}
```

Reaction 不返回“Read State 或 canonical Artiment”二选一。Commit 后由 Resolver/Reader 调用
`viewer_state/2` 组装保持现有 GraphQL shape 的结果。这样 response hydration 不延长 mutation
transaction，也不会扩大 MutationLock 的持有时间。

`upvoted_users/2` 与 `collected_users/2` 第一阶段只支持 Article。它们读取权威 fact 并返回分页用户；
Comment 虽然存在 CommentUpvote fact，但 V4 不提前新增尚无产品入口的 Comment upvoter list。

这两个用户列表属于公开读取，不单独执行 Gate admission。Article 是否可见、允许进入哪一个列表范围，
由所属 Article Reader 的 read scope 保证；Interaction 只在已经准入的 query/resource 范围内分页读取
fact users。实现时既不能绕过所属 Reader 直接扩大资源范围，也不能为每个用户列表重复执行一次 Gate。

Facade 不重导出：

- Audit 和 repair；
- Config；
- bitmap 类型与 SQL macro；
- ReadState 同步函数；
- worker retry/retention 函数；
- ReactionInfo/EmotionInfo models。

### 2.2 Viewer-facing Read State

读取一个或一批 Artiment 时，产品需要得到当前 viewer 视角的 Interaction 状态：

```elixir
CMS.Interactions.viewer_state(artiment, viewer)
CMS.Interactions.viewer_states(artiments, viewer)
```

返回按 Artiment 分型的普通 map，不再由旧 `State.read` 隐式修改 Article/Comment struct，也不为字段
组合创建 Article/Comment/Report/Emotion struct 层级。

所有零值由单文件 `DefaultViewerState` 提供：`article/0`、`comment/0`、`emotions/1` 与 `report/0`。
`ReadState.Query` 只把查询结果合并到这些默认片段；不存在 `viewer_state/` 目录，也不按 response
组合拆文件。

Article read state：

```elixir
%{
  upvotes_count: 12,
  collects_count: 3,
  latest_upvoted_users: [],
  latest_collected_users: [],
  emotions: [],
  viewer_has_upvoted: true,
  viewer_has_collected: false,
  viewer_has_reported: false,
  viewer_has_viewed: true
}
```

Comment read state：

```elixir
%{
  upvotes_count: 12,
  latest_upvoted_users: [],
  emotions: [],
  viewer_has_upvoted: true,
  viewer_has_reported: false
}
```

Comment 不定义 collect/view 字段。每一项 emotion 使用固定结构：

```elixir
%{
  emotion: :heart,
  count: 5,
  latest_users: [],
  viewer_has_reacted: true
}
```

`emotions` 覆盖当前 Artiment 允许展示的完整 bounded vocabulary；没有 fact/ReadState 行时仍返回 count
0、空 latest users 和 false，而不是缺少该 emotion。

`reported_count` 不是普通公开 read state。只有明确的 report surface 才合并 report fragment：

```elixir
CMS.Interactions.viewer_state(artiment, viewer, surface: :report)

%{
  # Article read-state fields
  reported_count: 3
}

%{
  # Comment read-state fields
  reported_count: 3
}
```

普通 surface 不查询、填充或泄露真实 `reported_count`。

Article/Comment Reader 负责把 read state 组装进公开 API response。以下责任不属于
Interactions.ReadState：

- 修改原始 Ecto struct；
- Article/Comment response meta 拼装；
- embedded reply 重组；
- `ShadowSync.refresh_*`；
- 为了获取 Article 作者而跨域调用 FrontDesk。

具体 owner 为 `Articles.InteractionResponse` 与 `Comments.InteractionResponse`。它们只负责把
ReadState map 映射到现有 Article/Comment GraphQL shape；`Comments.AuthorRelationState` 单独批量计算
Article 作者与 Comment upvote 的关系。这三个模块都不拥有 fact、bitmap 或 Interaction SQL。

`is_article_author_upvoted` 不是当前 viewer 的状态，不进入 Interaction ReadState。Comment response 的组装
合同为：

```text
Comment row
  + Interactions.ReadState map
  + Comments.AuthorRelationState.is_article_author_upvoted
  -> Comment API response
```

Comments Reader 负责按一页 Comment 批量计算 AuthorRelationState；不能让通用 Interaction ReadState
隐式反查父 Article，也不能逐 Comment 查询。

列表 Reader 已知同一 Article 的 author id 时，将它传给 `AuthorRelationState.upvoted_ids/2`；单条
读取或 mutation response 没有该参数时，`AuthorRelationState.upvoted_ids/1` 必须按 thread 用一条
join query 同时解析 parent Article author 和 bitmap membership。禁止回退成
`FrontDesk.article_of/1 -> FrontDesk.author_of/1` 的逐层加载。

### 2.3 匿名读取必须走轻量路径

统一 facade 接受 `nil` viewer，但内部必须分成两条查询路径：

```elixir
viewer_state(artiment, nil)
  -> ReadState.Query public fields

viewer_state(artiment, %User{} = viewer)
  -> ReadState.Query public fields + bitmap membership
```

匿名路径只读取产品展示所需的 count、emotion count 和 latest users，并直接返回：

```elixir
viewer_has_upvoted: false
viewer_has_collected: false
viewer_has_reported: false
viewer_has_viewed: false
```

匿名请求禁止执行：

- bitmap membership SQL；
- pending ViewEvent 查询；
- viewer view overlay；
- 任何只为了计算 `false` 而执行的数据库函数或额外查询。

批量匿名读取同样只按实际 Artiment model 批量读取公开状态，不得出现随列表长度增长的查询。
登录 viewer 才计算 bitmap membership；只有 durable view 尚未投影时，才增加一次批量 pending view
查询。

匿名与登录路径的 fixed/emotion 基础查询数必须一致；登录 Article 允许因 pending view overlay 最多
增加一次批量查询，因此不能断言两条路径的总 SQL 数始终相同。必须通过 SQL inspection 证明匿名
SELECT 不包含 bitmap membership 表达式，且匿名总查询数不大于登录路径。

### 2.4 Interaction query scope

`scope` 是“接受 queryable，返回经过该领域范围编译的 queryable”的通用约定；Gate 只拥有
Gate 自己的 actor/action/read-policy Scope 语义。Interaction 提供自己的 query compiler：

```elixir
CMS.Interactions.scope(queryable, opts)
```

第一阶段支持现有产品排序 atom：

```elixir
{:ok, query} = CMS.Interactions.scope(Post, order: :upvotes)
{:ok, query} = CMS.Interactions.scope(existing_doc_query, order: :collects)
```

第一阶段只接受 Article queryable，即 Post、Blog、Changelog 和 Doc；Comment 没有 Interaction 排序
产品入口，也没有对应的 ReactionInfo 列表排序合同。即使 Comment 存在 upvote/emotion fact，传入
Comment queryable 也必须 fail closed 为 `unsupported_artiment_query`，不能根据 fact 存在与否猜测
支持范围。

合同为：

```elixir
@spec scope(Ecto.Queryable.t(), keyword()) ::
        {:ok, Ecto.Query.t()} | {:error, term()}
```

排序 vocabulary 由 `CMS.Interactions.Const` 唯一维护：

```elixir
interaction_order_values()
# [:upvotes, :collects]

passthrough_order_values()
# [:publish, :comments, :views]

order_values()
# [:publish, :comments, :views, :upvotes, :collects]
```

`nil` 表示未指定 order，不进入 enum，但 validator 明确允许。GraphQL enum、filter parser、
QueryBuilder、Articles.List、Interactions.Scope 和测试不得各自维护一份 atom list。

各 atom 的职责固定为：

| order       | Owner                  | `Interactions.scope/2` 行为                                                  |
| ----------- | ---------------------- | ---------------------------------------------------------------------------- |
| `nil`       | Articles.List 默认排序 | 原样返回 query                                                               |
| `:publish`  | Article 主表发布时间   | passthrough                                                                  |
| `:comments` | Article/Comments 聚合  | passthrough                                                                  |
| `:views`    | Article 主表 `views`   | passthrough                                                                  |
| `:upvotes`  | Interaction ReadState  | LEFT JOIN ReactionInfo，按 `upvotes_count DESC NULLS LAST, article.id DESC`  |
| `:collects` | Interaction ReadState  | LEFT JOIN ReactionInfo，按 `collects_count DESC NULLS LAST, article.id DESC` |
| 其他值      | 无                     | fail closed：`unsupported_order`                                             |

当 order 为 `:upvotes` 或 `:collects` 时，Interaction scope 会先清除 queryable 已有的 `order_by`，
再写入自己的主排序和稳定的 `article.id DESC` tie-breaker。Interaction 排序必须成为主排序，不能因
上游 query 已带默认发布时间排序而退化成永远不会生效的次级条件。passthrough order 则完全保留原 query。

`:comments` 不属于 Interaction；`:views` 虽然来自 view event，但当前排序字段位于 Article 主表，
Interaction 不为它 JOIN ReactionInfo。合法 passthrough 使 Articles.List 可以把同一 order 依次交给
base query compiler 与 Interaction scope；未知值不能静默返回原 query。

`scope/2` 只编译，不执行 Repo 查询：

```text
queryable
  -> Ecto.Queryable.to_query/1
  -> 提取主 schema
  -> Artiment.Matcher.match_interaction/1
  -> 找到 ReactionInfo model 和 foreign key
  -> LEFT JOIN reaction info
  -> 添加 order
  -> 返回 Ecto.Query
```

Artiment 类型必须从 queryable 推断，调用方不得重复传 `:post`、`:doc` 等第二事实源：

```elixir
# 禁止
CMS.Interactions.scope(Post, :post, order: :upvotes)

# 更禁止：schema 与声明冲突
CMS.Interactions.scope(Post, :doc, order: :upvotes)
```

无法从主查询源识别出 Artiment schema 时 fail closed：

```elixir
{:error, Interactions.ErrorCat.unsupported_artiment_query(...)}
```

`LEFT JOIN` 继续保证没有 State 行的 Artiment 以 0 count 参与列表。V4 不提前加入尚无产品需求的
viewer filter 或 count range filter。

## 3. Artiment Matcher ownership

V4 删除 `CMS.Interactions.Registry`。它当前混合了四类不同信息：

1. Artiment thread/schema/table；
2. ReactionInfo/EmotionInfo model 和 foreign key；
3. fact table、唯一列和索引名；
4. emotion vocabulary decode。

Artiment 与 Interaction model 的确定性映射统一进入现有 `CMS.Artiment.Matcher`，新增明确接口：

```elixir
CMS.Artiment.Matcher.match_interaction(artiment)
CMS.Artiment.Matcher.match_interaction(schema)
CMS.Artiment.Matcher.match_interaction(:post)
```

返回完整且唯一的 Interaction metadata：

```elixir
{:ok,
 %{
   artiment: :post,
   model: CMS.Model.Post,
   foreign_key: :post_id,
   reaction_info_model: CMS.Model.PostReactionInfo,
   emotion_info_model: CMS.Model.PostEmotionInfo,
   collection?: true
 }}
```

Comment 返回 `collection?: false`。Account、CommunityTag 和未知 schema 必须返回 error，不能返回
缺少字段的半完整 map。

`match_interaction/1` 内部直接使用模式匹配，不再创建 `ProjectionTarget`、`Catalog` 或第二套
Registry：

```elixir
def match_interaction(%Post{}), do: match_interaction(:post)
def match_interaction(Post), do: match_interaction(:post)
def match_interaction(:post), do: {:ok, post_interaction_info()}
```

其他 metadata 回归真正 owner：

- emotion vocabulary/decode 归 `CMS.Interactions.Emotion`；
- Audit 需要的 fact source 作为 Audit 私有映射；
- migration index name/column helper 不进入运行时 facade；
- Gate 和 Articles.Lifecycle 通过 Artiment.Matcher 认识 Article，不再依赖 Interactions。

删除 Registry 的迁移面必须完整覆盖：

- `Interactions.ReadState`；
- `Interactions.Audit`；
- `Gate.Scope.ArticleSchema.fetch/1` 与 `thread_for/1`；
- `Articles.Lifecycle` 的 Article table lookup；
- Registry、constraint 与 migration helper tests；
- 所有生产 alias/import 和文档引用。

`Gate.Scope.ArticleSchema` 是现存的第二套 thread/schema 事实源。优先直接改为使用
`Artiment.Matcher.match_interaction/1`；如果 Gate 为错误转换保留薄 wrapper，也只能显式模式匹配
Matcher 返回值。禁止继续用 `Map.fetch!` + `rescue KeyError` 处理未知 thread，未知输入必须沿正常
返回值 fail closed。

Phase 1 完成时，全仓静态扫描以下残留必须为零：

```text
Interactions.Registry
Registry.article_schema
Registry.thread_for
Registry.article_table
```

### 3.1 Interaction ErrorCat

V4 新建 `CMS.Interactions.ErrorCat`，namespace 为 `{:cms, :interaction}`。47xx 已被 CollectFolders
占用，48xx 已由 Accounts.Fans 使用，因此 Interaction 预留当前未使用的 49xx 段；实施时由 ErrorCat
全局唯一性检查锁定该分配。

首批稳定 reason 至少包括：

```text
unsupported_artiment
unsupported_artiment_query
unsupported_order
emotion_not_allowed
already_reported
view_event_identity_mismatch
interaction_state_conflict
view_event_insert_failed
target_not_found
unknown_emotion
invalid_event_id
projection_not_updated
```

Gate admission 失败继续返回 Gate 46xx，不包装成 Interaction error。Interaction fact/ReadState 约束在
reaction 边界转换为稳定 Interaction reason；Resolver 只负责 GraphQL 序列化和本地化文案，不重新
解释业务错误。由于 upvote/emotion/collect 的 set-state reaction 在 V4 中幂等成功，不再保留
Article/Comment 两套 `already_upvoted` 错误。

## 4. Reaction 事务合同

### 4.1 Upvote、Emotion、Collect

所有同步命令使用同一骨架：

```text
Repo.transaction / Ecto.Multi
  1. Gate.access_check(actor, action, input)
  2. 从 Gate 结果取得 canonical Artiment
  3. create/delete authoritative fact，返回 changed/unchanged
  4. 仅 changed 时执行 ReadState.add_*/remove_*
  5. 返回 canonical Artiment
commit
  6. 仅 changed 时 emit notification/subscription
  7. 仅 changed 时 enqueue search metric refresh
  8. Resolver/Reader 调用 viewer_state 组装 GraphQL result
```

Comment 命令在 step 1 前只做 parent Article identity 定位；step 1 内由 Gate 在 MutationLock 中重新
加载 canonical Comment 与父链。定位读取不得直接传给 step 3，也不得取代 canonical reload。

V4 的 membership 命令统一为幂等 set-state 操作。内部 fact writer 固定返回：

```elixir
{:ok, :changed}
{:ok, :unchanged}
{:error, reason}
```

逐动作语义固定为：

| 动作           | fact 当前状态  | Facade 结果 | ReadState/副作用 |
| -------------- | -------------- | ----------- | ---------------- |
| `upvote`       | 已存在         | 幂等成功    | 不变             |
| `undo_upvote`  | 不存在         | 幂等成功    | 不变             |
| `emotion`      | 已处于目标状态 | 幂等成功    | 不变             |
| `undo_emotion` | 不存在         | 幂等成功    | 不变             |
| `collect`      | 已存在         | 幂等成功    | 不变             |
| `undo_collect` | 不存在         | 幂等成功    | 不变             |

因此 V4 不再保留 `collect_ifneed`、`undo_collect_ifneed` 等平行入口，也不保留 Article/Comment 两套
重复 upvote 错误。旧 add 路径主要依赖唯一约束阻止重复 fact；旧 remove 路径则依赖删除前预读
record，无法用实际受影响行数证明 ReadState 是否应变化。V4 删除 `EmotionToggle` 和这些隐式分支，
统一由 fact writer 的实际 `INSERT` / `DELETE` 结果决定 changed/unchanged。

V4 要求 fact writer 根据实际 `INSERT` / `DELETE` 结果返回 `:changed | :unchanged`；尤其 remove
必须以受影响行数决定结果，不能以删除前读到过 record 为依据。这样 ReadState 与事务后副作用只响应
实际 fact 变化，并显式消除并发 remove 的 double-decrement 风险。

### 4.2 Report 与 Moderation

提交 report 属于 Interaction fact，因此使用：

```elixir
CMS.Interactions.report(artiment, reason, attrs, actor)
```

V4 必须为 Article/Doc/Comment 建立明确的 Gate `:report` admission，至少保证：

- canonical Artiment；
- Community 与父资源 identity 一致；
- Lifecycle 允许读取和 Interaction；
- actor 不得通过 raw struct 绕过资源加载；
- duplicate report 遵守一个稳定合同。

当前物理模型是一条 Artiment `AbuseReport` 行聚合多个 reporter case，不是每次 report 一行。V4 将
权威概念事实键固定为：

```text
{artiment_type, artiment_id, reporter_user_id}
```

每个 reporter 对同一个 Artiment 最多一个 case；identity 使用不可变 `reporter_user_id`，不再使用
login 判断重复。

`report` 的行为固定为：

1. 没有 AbuseReport 行：创建行和一个 reporter case；
2. 已有行、当前 reporter 不存在：追加一个 case；
3. 当前 reporter 已存在：返回 `already_reported`，因为新的 reason/attrs 不能被静默丢弃；
4. 只有新增 case 才执行 `ReadState.add_report` 和后续副作用。

`undo_report` 的行为固定为：

1. 删除当前 `reporter_user_id` 对应的 case；
2. 删除后仍有 case：更新 AbuseReport；
3. 删除后为空：删除 AbuseReport 行；
4. 当前 reporter 没有 case：幂等成功；
5. 只有实际删除 case 才执行 `ReadState.remove_report`。

`reported_count` 是有效 reporter case 数。Audit 继续展开 `report_cases`，按 reporter user id 重建
`reported_user_ids` bitmap；这与概念事实键一致。将 case 正规化为独立表可以是后续 Moderation
演进，但不是 V4 facade 重构的前置条件。

Account 不是 Artiment，它的 reported meta 继续由 AbuseReports 的 `update_report_meta` 按 account
report case 数维护。V4 不把这条路径迁入 Interaction，也不把 Account meta 与 ReactionInfo 中的
`reported_count` / `reported_user_ids` 统一；§1.5 的审计只校验两套派生数据各自与所属 fact 一致。

后续审核不属于 Interaction：

```text
Interaction report fact
  -> ReviewCase
  -> ModerationDecision
  -> resource command / Lifecycle
```

自动 fold Comment 如果保留，必须是同一 Reaction 的显式步骤，不能在一个 Ecto.Multi 中再次调用
会自行开启事务和副作用的公共 facade。

### 4.3 ViewEvents

ViewEvents 继续采用 durable event + async ReadState merge：

```text
Articles.Reader
  -> CMS.Interactions.record_view(canonical article, viewer, event_id)
  -> view_events fact
  -> ViewEvents worker
  -> ReadState.merge_viewed_users
```

View request 不同步锁 ReactionInfo，不在请求事务中递增 bitmap/count。Worker、retry、metrics 和
retention 是 `Interactions.ViewEvents` 的内部运行 API，不从顶层 facade 重导出。

`record_view/3` 不进入 Article `MutationLock`。它是高频事件写入，幂等边界是 durable ViewEvent 的
`event_id` 唯一性；同步获取 aggregate lock 既不增加正确性，也会让 page view 与 upvote、emotion、
collect 争抢同一把锁。View worker 仍必须以 event/fact 的实际变化结果保证 retry 不重复投影。

ViewEvent insert 与对应 Oban enqueue 位于同一个数据库 transaction：enqueue 失败时 event 一并回滚，
不会留下没有 worker 的孤儿事件。测试环境允许在该 transaction 内同步投影；生产请求仍只负责 durable
event 与 job，实际 ReadState merge 由 worker 执行。

`record_view/3` 的 viewer 和 event id 都允许为空：

```elixir
record_view(article, User.t() | nil, Ecto.UUID.t() | nil)
```

- 匿名 view 仍增加 Article 总 views，但不进入 viewed-user bitmap；
- 显式 `event_id` 是业务幂等键；
- 相同 event id + 相同 Article/viewer：幂等成功；
- 相同 event id + 不同 Article 或 viewer：`view_event_identity_mismatch`；
- event id 为 nil：服务端生成 UUID，每次调用视为新事件，不保证跨重试幂等。

## 5. 目录与 model 边界

V4 目标目录保持直接业务命名，不引入 `Catalog`、`Storage`、`Projection` 或
`ProjectionTarget`：

```text
cms/interactions.ex
cms/interactions/
  reactions.ex
  reactions/
    upvote.ex
    emotion.ex
    collect.ex
    report.ex

  read_state.ex
  read_state/
    query.ex
    sync.ex

  default_viewer_state.ex

  view_events.ex
  view_events/
    record.ex
    project.ex
    maintenance.ex

  audit.ex
  audit/
    projection.ex
    report.ex

  scope.ex
  config.ex
  const.ex
  error_cat.ex
```

职责：

| 模块                                      | 负责                                                            | 不负责                                        |
| ----------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| `CMS.Interactions`                        | 产品 facade 与稳定合同                                          | SQL、分组、model dispatch、worker maintenance |
| `Reactions`                               | upvote/emotion/collect/report 路由                              | SQL、事务、ReadState 更新                     |
| `Reactions.Upvote/Emotion/Collect/Report` | Gate、事务、authoritative fact、ReadState、post-commit 完整流程 | GraphQL response 拼装                         |
| `ReadState`                               | derived state 的 read/sync 路由                                 | SQL、bitmap 更新、事实写入                    |
| `ReadState.Query`                         | viewer state、批量 counts、匿名轻量查询                         | reaction fact 写入、response 拼装             |
| `ReadState.Sync`                          | bitmap/count/latest users 同步                                  | Gate、事实写入、公开查询                      |
| `DefaultViewerState`                      | Article/Comment/emotion/report 默认字段片段                     | Ecto query、独立 response struct              |
| `Scope`                                   | Interaction query 编译                                          | 执行 Repo 查询、Gate 权限                     |
| `ViewEvents`                              | durable view event 的 record/project/maintenance 路由           | 同步 reaction 命令                            |
| `Audit`                                   | projection repair 与 report issue audit 路由                    | 正常请求写路径、SQL                           |
| `Const`                                   | Interaction order 等 bounded vocabulary                         | 运行时配置、错误文案                          |
| `ErrorCat`                                | 稳定 Interaction domain error                                   | Gate error、Resolver 文案选择                 |

`CMS.Articles.MutationLock` 留在 Articles aggregate 内，不放入 Interactions。具体 reaction
只是它的消费者；MutationLock 同时服务 Draft、Publish、Trash、Doc Tree、Comment Writer 和 Gate。

`Interactions.Config` 仅由 owner 内部消费：ReadState 使用 `latest_users_limit`，ViewEvents 使用
`view_batch_size` 和 `view_event_retention_days`。Facade 不重导出 Config，其他域也不直接读取其
application env。

Interaction 内部跨模块协作函数仍是 Elixir public function，因此必须具有明确 `@doc`、`@spec` 和
`## Examples`；`@doc false` 不能充当可见性控制。只在同一模块使用的 ReadState helper 必须改成 `defp`，
不能为了省文档扩大公开面。

公开 response assembly 位于 Interaction 目录之外：

```text
cms/articles/interaction_response.ex
cms/comments/interaction_response.ex
cms/comments/author_relation_state.ex
```

这不是 facade 兼容层，而是 Article/Comment Reader 对各自公开 response shape 的 ownership。

ReactionInfo、EmotionInfo 和 RoaringBitmap 是 Ecto model 基础设施，不放在 reactions 目录：

```text
cms/model/interaction/
  reaction_info.ex
  emotion_info.ex
  roaring_bitmap.ex
```

具体持久化 model 继续位于 `CMS.Model`：

```text
CMS.Model.PostReactionInfo
CMS.Model.PostEmotionInfo
CMS.Model.CommentReactionInfo
CMS.Model.CommentEmotionInfo
...
```

共享 model macro 只生成 schema/changeset，不拥有 Interaction 产品动作。

## 6. 读取与查询预算

### 6.1 单个 Artiment

匿名读取：

```text
1 fixed State query
1 emotion State query
0 bitmap membership query
0 pending ViewEvent query
```

登录 viewer：

```text
1 fixed State query，同时计算 viewer bitmap membership
1 emotion State query，同时计算 viewer emotion membership
最多 1 pending ViewEvent query，仅 Article view overlay 需要
```

Article page 必须把 viewer 直接传给同一次 response assembly。登录 `page/3` 不得调用已执行匿名
assembly 的 `page/2`；无论匿名还是登录，fixed/emotion 基础查询都只能各出现一次。

### 6.2 一页 Artiment

对同一物理 Artiment 类型的一页 N 条数据：

```text
1 fixed State batch query WHERE artiment_id IN (...)
1 emotion State batch query WHERE artiment_id IN (...)
登录 viewer 最多增加 1 pending ViewEvent batch query
```

查询数不得随 N 增长。混合 Artiment 列表按实际 schema 分组，返回 key 使用
`{artiment_type, physical_id}`，不能只用不同表之间可能重复的数据库 ID。

Comment response 需要 `is_article_author_upvoted` 时，Comments Reader 允许增加一条按页批量的
AuthorRelationState 查询；它不计入 Interaction ReadState 的 fixed/emotion 查询，也不得随 N
增长。单条 Comment 在未提供 `article_author_id` 时同样只允许一条 relation join query，不允许额外
执行 parent Article/Author/User 的逐层查询。只有 report surface 才允许在 fixed State 查询中选择
`reported_count`。

## 7. 实施阶段

### Phase 0：合同与基线

1. 将本文作为 V4 source of truth；
2. 固定现有 GraphQL response、错误码、排序和 query-count 基线，并把 §1.5 三项标记为 expected
   change；
3. 列出所有直接调用旧 `Interactions.State/Registry/ViewEvents/Audit` 的生产模块；
4. 通过 `Interactions.Const` 固定完整 order vocabulary；
5. 在 ErrorCat 全局目录中预留 Interaction 49xx；
6. 固定 membership changed/unchanged、report case 和 `record_view` 幂等语义；
7. 建立 Article/Comment Interaction lock wait/hold 性能基线；
8. 与 GraphQL consumer/前端确认重复 upvote、collect、report 的新成功/错误合同。

### Phase 1：Matcher 与 Scope

1. 增加 `Artiment.Matcher.match_interaction/1`；
2. `Interactions.scope/2` 从 queryable 推断 schema；
3. `Interactions.scope/2` 使用 Const 验证全部 order atom，未知值 fail closed；
4. `Gate.Scope.ArticleSchema.fetch/thread_for` 改用 Matcher，并删除 `rescue KeyError` 正常分支；
5. Gate Scope 和 Articles.Lifecycle 改用 Artiment.Matcher；
6. Interaction ReadState/Audit 改用 Matcher；
7. 静态扫描 Registry 依赖归零后删除 `Interactions.Registry`，不保留兼容 delegate。

### Phase 2：统一 Reactions facade

1. 建立 `CMS.Interactions` 和 `Interactions.ErrorCat`；
2. 将 `Articles.Lock` 收口为 `Articles.MutationLock.with_article/with_articles`；
3. 先并行加入 facade 实现，不建立长期 compatibility delegate；
4. 迁移 Article/Comment upvote；
5. 迁移 Article/Comment emotion；
6. 迁移 Article collect；
7. 迁移 `upvoted_users/collected_users`，从 FrontDesk 移除 fact 分页 ownership；
8. 将 Comment Gate 移入事实写入的同一事务；
9. 所有步骤只使用 Gate 返回的 canonical Artiment；
10. 迁移 Resolver、service、job、importer；
11. 静态扫描旧 alias/调用归零后删除 Articles/Comments 旧入口。

### Phase 3：Report admission

1. 增加 Gate `:report` action；
2. Article、Doc、Comment report 进入 Interaction Reactions；
3. Account report 与 `update_report_meta` 留在 AbuseReports，不迁入 Interaction `reported_count`；
4. 在目标环境执行 `Audit.report_fact_issues/0`，输出 collision/orphan/count mismatch 清单；
5. 按“保留最早 case、先输出被折叠 case、orphan 阻断迁移”的规则清理存量数据；
6. reporter case identity 从 login 收口为 `reporter_user_id`；
7. 实现 append/remove/last-case-delete 与 changed/unchanged State 合同；
8. 从清理后的 fact 重建 `report_cases_count`、`reported_count` 与 bitmap；
9. 自动 fold 从嵌套 facade 调用改为同一 Reaction 的显式事务步骤；
10. 明确 Interaction fact 与未来 ReviewCase/ModerationDecision 的边界。

### Phase 4：Viewer State

1. 建立 `DefaultViewerState` 的 Article/Comment/Emotion/Report 默认字段片段；
2. `viewer_state/2` 与 `viewer_states/2` 返回按 Artiment 分型的 map，替代修改 struct 的旧 `State.read`；
3. Comments Reader 接管 AuthorRelationState 批量查询；
4. Reader 接管 response/meta/embedded reply/ShadowSync 组装；
5. 匿名和登录查询路径彻底分离；
6. mutation commit 后由 Resolver/Reader 组装 ReadState；
7. Search、Report List、Helper 改用明确 facade 或 owner query；
8. 删除通用 `State.write/4` 与旧 hydrate API。

### Phase 5：View、Audit 与 model cleanup

1. `ViewEvents` 收口为 `Interactions.ViewEvents` facade；
2. request、worker、retry、retention 接口按调用者分层；
3. 固定匿名 view 和 event id identity mismatch 测试；
4. Audit 的 fact mapping 成为私有实现；
5. shared schema macro 与 RoaringBitmap 移到 model/interaction；
6. 删除所有旧 module alias、文档和测试名称残留。

## 8. 测试矩阵

### 8.1 Facade 与 Gate

- Resolver 只调用 `CMS.Interactions`；
- Article/Comment 命令都在同一事务内调用 Gate；
- 原始 struct 与 canonical Artiment 不一致时只使用 canonical 资源；
- Lifecycle/Community/parent identity 缺失时 fail closed；
- Comment 锁外 locator 与锁内 canonical parent 不一致时 fail closed；
- Comment fact writer 只使用锁内 canonical Comment，不使用 locator 读取结果；
- Comment 不支持 collect；
- Account 不被识别为 Interaction Artiment。
- `upvoted_users/collected_users` 只通过 Interaction facade 读取 fact 分页；
- `upvoted_users/collected_users` 不单独调用 Gate，资源可见性由所属 Reader scope 保证；
- Interaction 49xx 与全仓 ErrorCat code 不冲突；
- 生产代码不存在对 Articles/Comments 旧 interaction 入口的残留调用。

### 8.2 MutationLock

- `with_article` 能从 Post/Blog/Changelog/Doc struct 模式匹配正确 lock identity；
- 尚无数据库行时，具有相同 `article_hash_id` 的并发创建命令仍串行；
- Doc lock key 包含 branch，同一 Doc 不同 branch 互不误锁；
- `with_articles` 去重并按稳定顺序加锁；
- 同一 Article 的并发 upvote/emotion/collect fact 与 State 一致；
- 同一父 Article 下不同 Comment 的并发 interaction 无 deadlock、无丢失更新；
- lock wait/hold telemetry 带 `aggregate: :article | :doc` 与不可逆 `lock_key_hash`；Comment 使用父
  Article 的同一逻辑锁，因此不伪造第三种 `comment_parent_article` lock identity；
- reaction transaction observer 在 transaction 返回后才发出 hold telemetry，使 duration 覆盖
  Gate、fact、State 直到 commit/rollback，而不是只覆盖 callback 返回前的局部时间；
- 通知、搜索同步、ReadState response assembly 不发生在 lock boundary 内。

### 8.3 Fact 与 State

- fact 成功变化后 bitmap/count/latest users 同事务变化；
- fact 未变化时 State 不重复增减；
- upvote/emotion/collect 重复 add 与 remove 返回幂等成功；
- 并发 remove 中只有实际删除 fact 的事务返回 changed 并减少 State；
- unchanged 不更新 State、不通知、不触发搜索同步；
- duplicate report 返回 `already_reported`，不吞掉新的 reason/attrs；
- undo missing report 幂等成功；
- report case 最后一个被删除时删除 AbuseReport 行；
- Audit 按 `{artiment_type, artiment_id, reporter_user_id}` 重建 report bitmap；
- report migration 对重复 immutable reporter 固定保留最早 case，并输出被折叠 case；
- 无 immutable reporter id 的存量 case 阻断迁移，不静默丢弃；
- Account `update_report_meta` 只按 Account report fact 重建，不写 Interaction ReactionInfo；
- 任一步失败时 fact 与 State 一起 rollback；
- Audit 可以从 fact 重建相同 State；
- 不存在任意生产调用方直接执行通用 State write。

### 8.4 Viewer State 性能

- 匿名 viewer 不执行 bitmap membership；
- 匿名 viewer 不查询 pending ViewEvent；
- 匿名 viewer flag 全部为 false；
- 匿名与登录路径的 fixed/emotion 基础查询数一致；
- 匿名 SELECT 中不含 bitmap membership 表达式；
- 匿名总查询数不大于登录路径；
- 登录 viewer 在批量 SQL 中计算 membership；
- 一页 N 条数据不出现 N+1；
- Article/Comment ReadState 字段严格分型；
- emotion vocabulary 零值项完整且结构稳定；
- 普通 surface 不查询或返回 `reported_count`；
- Comment AuthorRelationState 按页批量加载；
- 登录 Article page 只组装一次，fixed/emotion query 不因复用匿名 `page/2` 而翻倍；
- 匿名与登录单条 Comment 都执行 response assembly；
- 单条 Comment fallback 用一条 join query 解析 Article author relation，不调用 FrontDesk 逐层加载；
- mixed Artiment 使用 `{artiment_type, id}`，不会发生跨表 ID 冲突。

### 8.5 Scope

- `scope(Post, order: :upvotes)` 推断 PostReactionInfo；
- `scope(Doc, order: :collects)` 推断 DocReactionInfo；
- `scope(Comment, order: :upvotes)` 返回 `unsupported_artiment_query`；
- `nil/:publish/:comments/:views` 是经过 Const 验证的 passthrough；
- 未知 order 返回稳定 Interaction ErrorCat；
- GraphQL、QueryBuilder、Articles.List 与 Interactions.Scope 使用同一 Const vocabulary；
- `Gate.Scope.ArticleSchema` 和 `Articles.Lifecycle` 不再引用 Interactions.Registry；
- 已有 query 的 filter、Gate scope 与 Interaction scope 可以组合；
- Interaction order 会替换已有 `order_by` 并成为主排序，passthrough 不修改原 query；
- 无 State 行的 Artiment 仍以 0 count 出现在结果中；
- 无 schema、非 Artiment schema 和非法 order fail closed；
- scope 只返回 query，不执行 Repo 查询。

### 8.6 View 与 post-commit effects

- transaction rollback 不发送通知、不订阅、不更新搜索指标；
- 成功 commit 后每个副作用只执行一次；
- reaction 固定返回 canonical Artiment，ReadState 在 commit 后组装；
- 匿名 view 增加总 views，但不进入 viewed-user bitmap；
- `record_view/3` 不获取 Article MutationLock；
- 相同 event id + 相同 identity 幂等成功；
- 相同 event id + 不同 Article/viewer 返回 identity mismatch；
- view worker retry 不重复增加物理 view count；
- report 自动 fold 不通过嵌套公共 facade 启动第二套业务流程。

## 9. 完成标准

V4 完成必须同时满足：

1. GraphQL/service 的 Artiment interaction 只进入 `CMS.Interactions`；
2. upvote、emotion、collect、report 全部消费 Gate 返回的 canonical Artiment；
3. Gate check 与 fact/ReadState mutation 位于同一 transaction；
4. Article aggregate mutation 统一进入 `MutationLock.with_article/with_articles`；
5. `Interactions.Registry`、`ProjectionTarget` 和通用 `State.write/4` 不存在；
6. Artiment interaction model 映射只有 `Artiment.Matcher.match_interaction/1` 一个事实源；
7. `scope/2` 从 queryable 推断 Artiment，不接受重复类型参数；
8. 全部 order atom 来自 `Interactions.Const`，未知值 fail closed；
9. membership reaction 重复执行幂等成功，ReadState/副作用只响应 changed；
10. report 使用 `{artiment_type, artiment_id, reporter_user_id}` 概念事实键；
11. reaction 固定返回 canonical Artiment；
12. Viewer State 按 Article/Comment/Report 分型，不再修改 Artiment struct；
13. 匿名读取不执行任何 viewer membership 或 pending view 计算；
14. `upvoted_users/collected_users` 由 Interaction facade 拥有；
15. State、Audit、View、Config 和 Ecto model 的内部入口不从产品 facade 泄漏；
16. `CMS.Interactions` 只委托 Reactions/ReadState/Scope/ViewEvents；具体 reaction 完整拥有 fact SQL 与事务编排；
17. Interaction 目录公开函数都有 `@doc/@spec/Examples`，不存在 `@doc false`；
18. Article/Comment response assembly 满足 §6 的单次组装与查询预算；
19. §1.5 的预期公开行为变化已完成 consumer 联调和存量 report 审计/迁移；
20. Interaction V1–V4、Gate 和 Lifecycle 文档全部指向一致的现行合同。

V4 最终业务位置：

```text
Artiment
  -> Gate 决定 actor 是否可以执行 Interaction
  -> Interaction fact 记录已经发生的行为
  -> Interaction ReadState 提供高效 count 与 viewer-facing 状态
  -> Audit 证明 State 可由 fact 重建
  -> Moderation 消费 report fact，但拥有审核与裁决
```
