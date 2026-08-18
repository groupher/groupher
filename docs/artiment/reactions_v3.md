# Artiment reactions v3：mutation admission 与可扩展性收口

> 状态：Phase 1–3 的 correctness、Gate context、thread/fact registry 与 emotion bounded decode 已落地并通过 focused regression；Phase 4 仅保留 Audit SQL builder 拆分和 moderation 兼容字段清理等显式债务。

当前实现核对：

- [x] Article interaction 的 Gate admission、Community 五种不可写状态与 archived target 拒绝；
- [x] fact 唯一约束冲突时 projection、achievement、fact 与外部副作用不泄漏；
- [x] projection 写入失败时 fact/projection 同事务回滚；
- [x] Community 不可写状态已走 `CMS.Articles.upvote` 完整 command 链路测试；
- [x] Phase 1–3 的 scope、registry、bounded emotion decode 已落地；
- [ ] Phase 4：Audit SQL builder 拆分、`meta.reported_count` moderation 兼容字段迁移清单。

> 前置文档：[reactions](./reactions.md) 定义 fact、bitmap 和 projection；
> [reactions v2](./reactions_v2.md) 定义 projection count、批量读取和排序；
> 本文只处理 interaction mutation 准入、thread metadata、Audit 和运行时协议的收口。
>
> 跨领域合同：[Gate V2](../community/gate_v2.md) 负责 actor/action 准入，
> [Community Lifecycle](../community/lifecycle.md) 负责 Community 状态能力，
> [Gate V3](../community/gate_v3.md) 负责 Article/Doc Draft、Public 和 Lifecycle 的后续边界。

## 0. 结论

历史上最实质的问题不是 projection count 或 bitmap，而是 Article interaction mutation 没有经过
Gate。Comment 的 upvote、emotion、pin 已调用 `Gate.access_check/3`；Phase 1 已将 Article 的
upvote、emotion、collect 及其撤销路径接入同一 Gate action matrix 和 transaction。目标曾经通过 gated
read 被加载，不等于 mutation 执行时仍然具备写入能力；陈旧 struct、归档 Article 或后来进入不可写
状态的 Community 都不能以 read 结果替代 mutation admission。

因此 v3 的首要目标是：

```text
Article / Comment interaction mutation
  -> 同一 mutation transaction
  -> Gate.access_check(actor, explicit_action, target_ref)
  -> Gate 装配并检查 target + ancestor Lifecycle
  -> 返回 canonical target
  -> 写 fact
  -> Interactions.State 写 projection
  -> commit
```

其余问题分为三类：

1. Gate 合同缺口：Scope context 静默默认、`read_draft` 无锁例外、Access internal seam 未收口；
2. Interaction 扩展债务：thread metadata 重复、Audit raw SQL、emotion 值的部署时序耦合；
3. Lifecycle 维护债务：锁的时刻性语义、Community Lifecycle 职责偏多、Article/Doc 机械重复。

v3 不把这三类职责合并成一个总括模块。Interaction 只消费 Gate/Lifecycle 能力，不自行决定内容
可见性或资源状态。

## 1. 当前边界

### 1.1 权威事实与 projection

以下边界保持不变：

```text
fact tables
  -> interaction membership 的权威事实

reaction_info / emotion_info
  -> bitmap、count、latest users 等可重建 projection

Gate
  -> actor 对目标执行 interaction action 的准入

Lifecycle
  -> actor-independent 的资源状态与可读/可写能力
```

`Interactions.State` 不拥有 Gate、Lifecycle、通知、成就、搜索或 moderation policy。它只在调用方
已经完成权威 fact 变更后，于同一事务内同步 projection。

### 1.2 当前覆盖差异

Comment interaction 已明确使用 action：

```text
upvote / undo upvote -> Gate.access_check(actor, :upvote, comment)
emotion add/remove   -> Gate.access_check(actor, :emotion, comment)
pin / undo pin       -> Gate.access_check(actor, :pin, comment)
```

这里列出 pin 只用于说明 Comment mutation 已统一经过 Gate。pin/undo-pin 修改 Comment 自身字段，
不创建 interaction fact，也不调用 reaction/emotion projection；它不属于 v3 的 fact/projection
事务改造范围。

Article interaction 已接入对应准入：

```text
CMS.Articles.upvote / undo_upvote
CMS.Articles.emotion / undo_emotion
CMS.Articles.collect / undo_collect
  -> 同一 transaction 内 Gate.access_check(actor, explicit_action, article)
  -> 使用 Gate 返回的 canonical Article
  -> 写 fact
  -> Interactions.State.write
```

`Gate.Access.Article` 的 action matrix 现在包含 `:upvote`、`:emotion`、`:collect`，并与 Comment
interaction 使用同一套 Lifecycle/Community admission 语义。Gate 的 public 4-arity 对非 `read_draft`
action 也会 fail-closed 返回 `:unknown_action`，不会再落到 FunctionClauseError。

## 2. 问题清单与定级

### 2.1 P0 · Interaction correctness：Article interaction 绕过 Gate（已修复）

影响：

- archived/deleted/destroy Article 的 add/remove 已统一拒绝；
- Community 在 read_only、suspended、archived、pending_destroy、destroy 状态时不再产生 interaction fact；
- Gate 在 command transaction 内重新加载并锁定最新 Lifecycle，旧 Article struct 不再成为准入依据；
- fact、projection、achievement 在事务内一致提交，通知/搜索 enqueue 移到 commit 之后；
- Article 与 Comment 对相同行为使用显式 action matrix。

这个问题属于 correctness 和 authorization boundary，不是代码风格问题。

### 2.2 P1 · Gate contract：Article interaction action matrix 缺失（Phase 1 已修复）

Phase 1 已显式增加 Article action：

```text
:upvote
:emotion
:collect
```

add/remove 共享 action，operation 仍由 interaction command 区分。Phase 1 的明确决策是：只要目标或
祖先 Community 当前不可写，add 和 remove 一律 deny；不能只保护 add 而让 undo 成为 bypass。

未来若产品决定允许用户在某种不可写状态撤销自己的关系，必须作为独立合同变更：operation 进入显式
context、Gate 验证 fact 属于当前 actor、增加稳定 Decision reason，并为允许的 Lifecycle 状态建立
独立矩阵和测试。在该合同落地前，不预留无 Gate remove，也不提前虚构新的公开错误名称。

Phase 1 实际采用的矩阵为：

| Target Lifecycle | Community Lifecycle | `can_write` | add   | remove |
| ---------------- | ------------------- | ----------- | ----- | ------ |
| `published`      | `active`            | yes         | allow | allow  |
| `published`      | `read_only`         | no          | deny  | deny   |
| `published`      | `suspended`         | no          | deny  | deny   |
| `published`      | `archived`          | no          | deny  | deny   |
| `published`      | `pending_destroy`   | no          | deny  | deny   |
| `published`      | `destroy`           | no          | deny  | deny   |
| `draft_only`     | any                 | irrelevant  | deny  | deny   |
| `archived`       | any                 | irrelevant  | deny  | deny   |
| `deleted`        | any                 | irrelevant  | deny  | deny   |
| `destroy`        | any                 | irrelevant  | deny  | deny   |

Interaction 只作用于已公开内容；Draft interaction 不属于 v3。Article emotion 仍需通过现有社区 emotion
配置校验，Gate admission 不能替代 `Allow.emotion`，两者分别回答“资源现在可写吗”和“该 emotion 是否
被产品配置允许”。

Action matrix 还必须区分 target type 和 branch policy：

| Target type             | Lifecycle source       | Branch policy            | `published` interaction |
| ----------------------- | ---------------------- | ------------------------ | ----------------------- |
| Post / Blog / Changelog | `ArticleLifecycle`     | 无 branch                | allow                   |
| Doc main branch         | `DocLifecycle(main)`   | public                   | allow                   |
| Doc non-main branch     | `DocLifecycle(branch)` | Dashboard team read only | deny by default         |

Doc target 的状态判断始终读取对应 branch 的 `DocLifecycle`。非 main branch 的团队可读权限不自动
授予 interaction；如果未来需要允许 branch-internal interaction，必须新增明确的 branch policy 和
action matrix 测试，不能复用 public interaction 准入。

### 2.3 P1 · Gate contract：Scope context 静默默认到 public（已修复）

历史上私有 helper `Gate.Scope.Article.policy_mode/2` 对普通 action 的空 map context 默认返回 `:public`。
非 map context 和 `Gate.Scope.ArticleSchema.fetch/1` 缺少有效 thread/schema 时已经使用
`:scope_context_missing`；Phase 2 不新增错误类型，只把 `%{} -> :public` 改为复用该 fail-closed
错误。这通常不会扩大
management 查询结果，反而会把 archived/draft 等管理态静默隐藏；但它让“明确选择 public”和
“调用方忘记传 management mode”不可区分，属于 fail-open direction 的 API 合同。

v3 的依赖要求是：

- 底层 Scope compiler 不猜调用意图，`policy_mode` 缺失返回 `:scope_context_missing`；
- public Reader/facade 显式传 `:public`；
- owner/moderator/operations Reader 显式传对应 management mode；
- Article、Community、Document Scope 一起审计，不能只修一个 compiler；
- interaction enrichment 只消费已经通过 Scope 的 entries，不把 management mode 传入 State。

实现已完成调用方静态审计并切换 compiler 的 fail-closed 行为。覆盖范围包括：

- `CMS.Articles.List` 的普通 thread 和 `:doc` 两条 `scope_context`；
- `CMS.Articles.Reader`、`CMS.FrontDesk` 的公共 Article / Doc 读取；
- `CMS.SearchArtiments.Capacity`、`CMS.SearchArtiments.Indexer` 的搜索读取和索引维护；
- [x] 审计仍引用旧 `CMS.Snapshot` 名称的 Article summary 查询；完成命名迁移后只使用
      `CMS.ShadowSync`，不在现行合同中保留双名称；
- `CMS.DocTree.Reader` 的 Public Doc 查询和 Community scope；
- `CMS.Communities.Reader` 的 Community scope；
- `CMS.Articles.Draft` 的 Draft management scope；
- 其他直接调用 `CMS.Gate.scope/4` 的测试、job、importer 和 maintenance 路径。

普通 public scope 必须显式携带 `policy_mode: :public`；Doc public scope 还必须显式携带
`branch_policy: :main` 或 canonical `branch_id`。不得继续依赖空 context 的默认值。

该问题的 source of truth 仍是 [Gate V2](../community/gate_v2.md)，本文只记录 Interaction 对它的依赖。

### 2.4 P2 · Gate contract：`read_draft` 是无锁 authorization-read 例外

当前 `Gate.Access.access_check(:read_draft, ...)` 编译 Scope 后执行 `Repo.exists?`，不走 mutation
路径的 Article/Lifecycle lock，也不重新加载 canonical Article。这对 read admission 可以成立，但与
“access_check 内部加载、锁定并返回 canonical resource”的笼统合同不同。

Gate 文档需要明确区分：

```text
mutation access_check
  -> load + lifecycle lock + decision + canonical resource

read_draft authorization check
  -> scoped read/existence check
  -> 不提供 mutation serialization 保证
```

不应为了字面统一给普通读取增加 `FOR UPDATE`。如果继续保留 `access_check(:read_draft)`，应说明它是
显式例外；更理想的是直接由 scoped query 返回 canonical Draft，而不是 `exists?` 后返回传入 struct。

### 2.5 P2 · Interaction extensibility：thread metadata 重复

历史上同一映射知识至少分散在：

- `Interactions.State.@article_infos`；
- `Interactions.Audit` 的私有 `target_column/1`；
- Article/Doc Lifecycle 的 thread/table 分派；
- `Gate.Scope.ArticleSchema.fetch/1`。

真正重复的是一组物理元数据：

```text
thread
  -> article schema
  -> lifecycle authority / identity
  -> reaction info schema/table
  -> emotion info schema/table
  -> physical target FK column

interaction type
  -> shared fact schema/table
  -> fact target key / thread discriminator
  -> unique-constraint contract
```

新增 thread 时必须修改多处，编译器也无法证明这些副本一致。v3 已建立纯 metadata registry
`CMS.Interactions.Registry`，
registry 只提供稳定映射，不接管 Gate policy、Lifecycle transition 或 Interaction command。

fact 与 projection 不能放进同一张 flat per-thread map：Article fact table 是跨 thread 共享的多态表，
例如 `article_upvotes`、`article_collects`、`articles_users_emotions` 使用 thread discriminator 和多个
`*_id` FK；projection 则按 thread 拆为 `post_reaction_infos`、`post_emotion_infos` 等物理表。registry
必须保留这两个不同作用域。当前实现的 canonical 入口是 `CMS.Interactions.Registry`：

```elixir
Registry.target(:post)
# %{reaction: PostReactionInfo, emotion: PostEmotionInfo,
#   target_id: :post_id, collection?: true, lifecycle: :article}

Registry.fact(:upvote)
# %{schema: ArticleUpvote, table: "article_upvotes",
#   unique_by: [:user_id, :target_id], index_prefix: "article_upvotes"}
```

fact table 和历史 index prefix 由 registry 固定保存；index name 只能由 registry 在编译期/测试装配期按下述固定模板
展开，不能接受运行时请求输入。真实唯一约束仍由
migration 和 changeset constraint 声明；registry 记录的是 Audit/一致性测试必须验证的唯一性维度。
Comment fact 可以作为同一 `facts` 层的独立 target family，不能假装与多态 Article fact 共用相同
FK 形态。

registry 键名直接对齐现有 `Interactions.State.@article_infos`：`collection?` 表示该 target 是否支持
collect，`target_id` 保存真实 FK atom（例如 `:post_id`），不另造 `collections?` / `target_key` 同义
名称。`unique_by` 是 interaction 级模板，其中 `:target_id` 是占位维度，不是数据库真实列名。registry
必须按每个 `targets` entry 展开它：

```text
upvote × post
  -> columns: [:user_id, :post_id]
  -> index: article_upvotes_user_id_post_id_index

emotion × blog
  -> columns: [:user_id, :blog_id, :emotion]
  -> index: article_user_emotions_user_id_blog_id_emotion_index
```

`unique_index_name` 也是编译期模板，`{target_id}` 只能替换为同一 registry 中固定的 FK atom。之所以
显式保存模板，是因为历史 index prefix 不一定能从 fact table 名可靠推导，例如表名
`articles_users_emotions` 与 index prefix `article_user_emotions` 并不完全一致。Phase 1 的约束核对和
§5.4 的一致性测试必须调用同一个展开函数，逐个验证真实 migration/index 和 changeset constraint；
Audit/测试不得各自重新猜列组合或 index name。

每项不可推导知识只保存一次。target 的 article table 不再在 registry 另存一份硬编码字符串，而是从
`article_schema.__schema__(:source)` 派生；这样 Ecto schema source 与 raw SQL identifier 只有一个来源。
fact table 和历史 index prefix 仍是跨 thread 的物理兼容元数据，不能从 target schema 推断，因此保留在
`facts` registry。target/projection 层的 SQL builder 从 registry 中受控的 `target_id`
派生 column string；Audit 再按 interaction type 从 `facts` 层取得 shared fact schema/table 和唯一性维度。
schema module、atom key 和 SQL identifier 必须来自固定编译期列表，不能接受请求输入拼成表名或
动态创建 atom。若历史物理表名无法由 schema/thread 安全推导，registry 可以保存该不可推导表名，
但不得同时再保存等价副本。

这里解决的不是当前生产写入 bug，而是避免统一 registry 内部再次制造同一知识的两个副本。例如：

```elixir
# 禁止：两项都表示同一个数据库列，未来可能只改其中一项
%{target_id: :post_id, target_column: "post_id"}

# 目标：只保存 canonical atom
%{target_id: :post_id}
```

Ecto 查询直接使用 `target_id`；Audit 的 SQL builder 只允许对 registry 中的编译期固定 atom 执行
`Atom.to_string/1` 得到 column identifier。这样未来将目标键改为 `:article_id` 时只有一个修改点，
不会出现 Ecto 使用 `:article_id`、raw SQL 仍使用 `"post_id"` 的内部漂移。

### 2.6 P2 · Interaction extensibility：Interaction Audit 的 raw SQL 维护面过大

`CMS.Interactions.Audit` 使用集中 raw SQL 对 fact 与 bitmap/count projection 做校验和修复。raw SQL
本身合理：bitmap 聚合、CTE 和同事务 repair 不必为了形式统一改写成 Ecto。但当前模块把 thread、
table、column 选择和 SQL construction 混在一起，主要依赖 PostgreSQL integration test 兜底。

v3 的收口方向：

1. 表名和列名只从固定 metadata registry 获取；
2. SQL construction 拆为可直接验证的纯 builder；
3. 保留真实 PostgreSQL integration tests 验证 bitmap、count、空 report payload 和原子 repair；
4. Audit 继续是 repair-only safety net，不进入正常 mutation/read 路径；
5. State 与 Audit 消费同一 registry，但分别读取 target/projection metadata 与 interaction/fact
   metadata，不引入两套独立映射。

### 2.7 P2 · Interaction extensibility：emotion 字符串到 atom 的部署时序耦合

历史实现的 `String.to_existing_atom(row.emotion)` 不会无限创建 atom，但数据库出现当前 release 未加载的
emotion 值时会直接 raise。v3 已改为 bounded registry lookup，未知值被跳过、发出 telemetry，并不会让
读取路径无上下文崩溃。

v3 禁止改用 `String.to_atom/1`。应使用 canonical emotion registry：

```text
DB string
  -> registry lookup
  -> known atom
     or explicit unknown_emotion error + telemetry
```

部署和 migration 检查应验证数据库不存在 registry 之外的 emotion。社区动态配置只能从 canonical
vocabulary 中选择，不能把任意字符串写入 fact/projection。

### 2.8 P2 · Interaction extensibility：`meta.reported_count` 是 moderation 兼容投影

`meta.reported_count` 不属于常规 reaction v2 count，也不是排序权威。它目前仍从 report bitmap
投影，服务尚未迁走的 moderation response。v3 只登记债务，不顺手改变 report 产品协议。

删除它之前必须明确：

- 当前 GraphQL/Dashboard 消费者；
- moderation case/count 的替代读取边界；
- Gate threshold 是否存在以及由谁拥有；
- response 字段的废弃与删除窗口。

### 2.9 P3 · Lifecycle debt：Community Lifecycle 职责偏多

Community Lifecycle 同时包含状态机、Blocker、回收窗口、Audit、operation ref 和 bootstrap。与
Interaction v3 直接相关的是 `can_write` 和锁内状态事实，不能为了整理 Interaction 顺手重写状态机。

后续可优先抽出 operation-ref validation 和 Audit persistence adapter；状态矩阵、Blocker 解析、
transition/version guard 保持在 Lifecycle 边界。详见 [Community Lifecycle](../community/lifecycle.md)。

### 2.10 P3 · Lifecycle contract：Gate 准入锁是时刻性保证

Gate 加载 Community Lifecycle 时使用 `FOR SHARE`，资源 transition 使用更强的 `FOR UPDATE` 和
version/allowed-transition guard。这里的正确心智模型是：

```text
Gate admission
  -> 在当前 transaction snapshot/lock 下确认祖先能力

Lifecycle transition
  -> 对目标状态变化做最终 lock + version + transition guard
```

它不应被描述为 Gate 一次准入便冻结整个聚合直到所有未来写入结束。interaction fact 与 projection
必须在调用 Gate 的同一事务内完成，才能消费这项时刻性保证；不能 Gate 完成后另开事务写 fact。

### 2.11 P3 · Lifecycle debt：Article/Doc Lifecycle 的机械重复

Article/Doc Lifecycle 的 identity、状态语义和 branch 边界正在分化，不引入通用
`GenericLifecycle`。可以共享 `state_time`、version changeset、通用 transition result 等纯 helper，
但不能用可选 branch 或总括 transition 抹平两条链路。Interaction registry 只标记目标由哪类
Lifecycle 管理，不执行 Lifecycle transition。

### 2.12 P3 · Gate debt：Gate Access internal seam 未收口

`evaluate/3-4`、`evaluate_result/3-4`、`decision/4` 并存，测试直接消费这些 internal seam。它不影响
公开 facade 只有 `scope` 和 `access_check` 的方向，但会增加 action matrix 演进成本。

收口建议：

- 资源 Access 模块以 `evaluate_result/4` 作为唯一核心；
- `decision/4` 只在 Gate 内部把结果转换为 `Decision`；
- 测试 helper 负责构造 context，不在生产模块保留只为测试存在的 arity；
- Article interaction 的新增测试同时覆盖公共 `access_check` 和少量 priority seam，不扩大 seam 面。

## 3. v3 目标写路径

### 3.1 Article interaction

```text
GraphQL / service command
  -> CMS.Articles.upvote | emotion | collect
  -> Repo.transaction
      -> Gate.access_check(actor, action, article_ref)
          -> load Community + Article + Lifecycle
          -> lock required lifecycle state
          -> Decision
          -> canonical Article
      -> validate interaction-specific config
      -> insert/delete authoritative fact
      -> Interactions.State.write(canonical_article, interaction, actor, operation)
      -> 必要的事务内持久化步骤
  -> transaction commit 后触发非事务型外部副作用
```

`access_check` 不使用单一 ArticleLifecycle 来源。Post、Blog、Changelog 通过
`community_id + thread + article_hash_id` 加载并锁定 `ArticleLifecycle`；Doc target 必须通过
`community_id + branch_id + article_hash_id` 加载并锁定对应的 `DocLifecycle`。Doc 的 target、lock
和 policy decision 必须使用同一个 canonical `branch_id`，不能默认回退到 main。

Gate 必须位于 interaction command 内部，resolver 预先检查不能代替它。所有后续步骤只使用 Gate 返回的
canonical Article。

### 3.2 错误协议与客户端变化

Gate 拒绝的内部和 API 合同固定为：

```text
Gate.access_check
  -> {:error, %Gate.Decision{}}

Article interaction command
  -> 原样保留 Decision
  -> 不压扁为裸 atom、字符串或通用 permission_denied

GraphQL GqlResultFmt middleware
  -> Decision.graphql_error/1
  -> 稳定的 code、message、actions、retryable
```

`source` 只属于内部 violation，用于 Decision 组合和诊断，不进入 `Decision.public_error/1` 或
GraphQL extensions；公共 payload 固定为 `code`、`message`、`actions`、`retryable`。

`:unknown_action` 表示 action matrix/调用方配置错误，不是正常客户端业务拒绝；Phase 1 上线前必须通过
测试确保三个新增 action 均已注册。`article_archived`、`article_deleted`、
`ancestor_community_not_writable`、`permission_denied` 等是正常 Decision reason，由既有
`Decision.graphql_error/1` 映射，不在 resolver 中另造 interaction 专属字符串错误。

`State.write` 的 `:projection_not_updated` 是基础设施失败，不属于 Gate Decision。它在
`Helper.GQLError` 边界映射为稳定的 update-failure code 和通用重试文案；GraphQL 不向客户端暴露该
内部 atom，也不在 test/dev 环境因未知 error reason raise。

Phase 1 会改变 archived、deleted、stale target 等场景的客户端可见行为：它们此前可能错误成功，
上线后将返回 GraphQL error。前端 mutation 必须在失败时回滚 optimistic count/viewer state，或重新
获取 canonical interaction state；不得永久保留本地先加减后的结果。add/remove 是否重复请求的
幂等/domain error 语义保持现有协议，不能被 Gate 错误映射意外改写。

### 3.3 Comment interaction

Comment 已有 Gate 路径，但 v3 验收仍需确认：

- add/remove 都在同一 transaction 内调用相同 action；
- Gate 组合 Comment、父 Article、Community Lifecycle；
- archived/deleted/destroy 父 Article 会拒绝 Comment interaction；
- Community 不可写时拒绝 fact 和 projection；
- Writer 不在 Gate 后重新加载另一份 Comment。

### 3.4 事务与副作用边界

拒绝准入时必须满足：

```text
no fact row change
no bitmap/count/latest-users change
no achievement change
no notification/event emission
no search metric enqueue
```

Phase 1 必须先盘点 achievement、notification、subscription、search enqueue 和 `Later.run` 的真实
执行时刻：

```text
transaction 内
  -> Gate
  -> authoritative fact
  -> projection
  -> 已存在且真正 durable 的 event/outbox row（若有）

commit 后
  -> notification dispatch
  -> search enqueue
  -> 其它非事务型外部副作用
```

只有写入数据库并与 fact/projection 同事务提交的 durable event/outbox row 才称为 transactional
intent。内存 callback 或仅名为 `Later.run` 的调用不能在未核对机制前获得该称谓。没有 durable
intent 时，Phase 1 不顺手虚构 outbox；验收要求是 Gate、fact 或 projection 失败时不派发外部副作用。

fact table 的唯一约束是并发和漏网重复请求的最后防线，不替代 command 幂等语义。Gate 通过后若
fact 写入因唯一约束失败，或 fact 写入成功后 projection 更新失败，整个 transaction 必须回滚；不能
留下单边 fact、bitmap/count drift、achievement 或外部事件。

## 4. 实施阶段

### Phase 1：封闭 correctness bypass（已完成）

1. 为 Article 增加 `:upvote`、`:emotion`、`:collect` action；
2. 定义并测试 Article/Community Lifecycle matrix；
3. Article interaction add/remove 全部在自身事务内调用 `access_check`；
4. 只使用 canonical Article；
5. 验证拒绝时 fact、projection 和副作用均不变化；
6. 保留 `Gate.Decision` 到既有 GraphQL middleware，补齐前端 optimistic rollback 行为；
7. 核对 fact table 唯一约束，并验证 fact/projection 任一步失败时同事务回滚（已完成，见 §5.1）；
8. 盘点所有副作用的真实执行时刻，不把内存 callback 描述为 transactional intent；
9. 静态审计 GraphQL、service、importer 和 job，不允许无 actor overload。

Phase 1 已完成；Audit 的 SQL builder 拆分仍作为 Phase 4 的独立维护债务。

### Phase 2：收紧 Gate 合同（已完成）

1. Scope compiler 缺失 `policy_mode` 时 fail closed；
2. 先完成所有 `Gate.scope/4` 调用方的静态审计，并为 public、management、Doc branch scope 补齐显式 context；
3. public 与 management facade 全部显式选择 mode；
4. 明确 `read_draft` 是 scoped authorization-read 例外；
5. 记录 Community `FOR SHARE` 与资源 `FOR UPDATE` 的时刻性语义；
6. 收口 Access internal seam，但不改变 Gate 公共 facade。

### Phase 3：集中 thread 与 emotion 协议（已完成）

1. 建立唯一 thread metadata registry；
2. State、Audit、ArticleSchema 和 Lifecycle 分派消费同一 metadata；
3. emotion DB string 通过 registry 解码；
4. 未知 emotion 返回明确错误并发 telemetry；
5. 新增 thread/emotion 的一致性测试从 registry 自动生成。

### Phase 4：整理 repair 与兼容尾项

1. 拆分 Audit metadata、SQL builder 和 executor；
2. 保留 PostgreSQL repair integration tests；
3. 为 `meta.reported_count` 建立消费者和删除清单；
4. 仅提取 Lifecycle 的纯机械 helper，不引入总括状态机；
5. 更新 v1/v2 文档的实现状态，不保留双协议。

## 5. 测试矩阵

### 5.1 Article interaction admission

每个 `upvote/emotion/collect × add/remove` 至少覆盖：

- published Article + writable Community：允许，fact/projection 同事务变化；
- draft_only/archived/deleted/destroy Article：拒绝；
- read_only/suspended/archived/pending_destroy/destroy Community：add/remove 均拒绝；
- anonymous actor：拒绝；
- stale Article struct：按数据库最新 Lifecycle 拒绝；
- Gate 拒绝后 fact count、bitmap、materialized count、latest users 均不变；
- 每个 fact table 的用户/目标唯一约束存在并作为并发最后防线；
- Gate 通过但 fact insert 唯一约束失败：projection、achievement 和副作用均不变化；
- fact insert/delete 成功但 projection 更新失败：fact 与 projection 一起回滚；
- remove 找不到 fact：保持既定幂等/domain error，projection 不减一且 count 不得为负；
- 重复 add/remove 保持既定幂等或稳定 domain error；
- emotion 同时满足 Gate 和 community emotion config。

以上两条原子性要求和 Community 不可写的完整 command 链路已由
`CMS.Interactions.StateTest` 覆盖：唯一 fact 冲突测试在第一次成功写入后比较 projection、fact 和
作者 achievement；projection 失败测试通过数据库 trigger 验证 fact/projection 回滚；Community
状态测试逐个调用 `CMS.Articles.upvote`，而非只调用 Gate 内部 seam。唯一索引的物理存在性则由
registry constraint test 按 target/FK 展开核对。

当前 Article interaction GraphQL mutation 只有 `Authorize :login` 和 `FrontDesk`，没有 Passport action；
登录拒绝由 Authorize middleware 处理，不产生 `Gate.Decision`。Phase 1 不增加无法落地的 Passport
测试，也不把 Passport middleware error 描述为 Decision。

账号全局 suspended、Community membership ban/mute 与 Community Lifecycle suspended 是三种不同事实。
若 Gate V2 已有前两类 actor policy，应在对应 Gate 测试中覆盖并由 interaction 复用；若当前没有明确
事实来源和 Decision，它们属于 Gate V2 的独立产品合同，Reactions V3 不临时发明 banned-user policy。

### 5.2 Comment inheritance

- visible Comment + published Article + writable Community：允许；
- deleted/destroy Comment：拒绝 interaction；
- archived/deleted/destroy Article：拒绝子 Comment interaction；
- Community 不可写：拒绝；
- root/reply 使用相同祖先能力，不出现 reply bypass。

### 5.3 Scope 与 read exception

- public Reader 显式传 `:public`；
- owner/moderator/operations Reader 显式传对应 mode；
- compiler 缺 mode 返回 `:scope_context_missing`；
- `read_draft` 只允许 management mode 和 draft stage；
- `read_draft` 测试不宣称取得 mutation lock；
- public list 在 Gate Scope 后才做 Interaction enrichment，不逐行 access check。

### 5.4 Metadata、Audit 与 emotion

- 每个 registry target 都能解析 article/reaction/emotion projection schema 和唯一 `target_id`；
  SQL column string 由该编译期 atom 派生；
- 每个 interaction type 都能解析 shared fact schema/table 和唯一性维度；Article 多态 fact 与
  per-thread projection 的作用域不会混淆；
- `unique_by` 和 `unique_index_name` 对每个 target 展开为真实 FK 列组合与 index name；约束核对、
  changeset constraint 测试和 Audit 使用同一展开函数；
- State 与 Audit 不存在 registry 之外的 thread case；
- SQL identifier 不能来自用户输入；
- Audit 能发现并修复 missing row、bitmap/count drift、emotion drift 和空 report payload；
- 未知 emotion 不创建 atom、不 raise 无上下文异常，并产生可观测错误；
- registry 新增一个测试 thread fixture 时，遗漏任一必需映射会在编译或测试阶段失败。

## 6. 完成标准

v3 完成必须同时满足：

1. Article 和 Comment 的所有同步 interaction mutation 都经过显式 Gate action；
2. interaction command、Gate、fact 和 projection 位于同一 transaction；
3. archived/deleted/destroy Article 或不可写 Community 不产生 interaction 写入和副作用；
4. Scope compiler 不再把缺失的 management context 静默解释为 public；
5. `read_draft` 的无 mutation-lock 语义在 Gate 文档和测试中明确；
6. thread 到 schema/table/FK/Lifecycle 的 target/projection 映射只有一个 source of truth；
7. interaction type 到 shared fact schema/table/唯一性维度有明确归属，State 与 Audit 使用同一分层
   metadata registry；
8. DB emotion 值通过 bounded registry 解码，未知值可观测且不会动态创建 atom；
9. Audit 仍能以 fact 为准原子修复 projection，但 SQL construction 可独立验证；
10. `meta.reported_count` 有明确迁移清单，不再被描述为常规 reaction count；
11. 不引入 `GenericLifecycle`、interaction 自有可见性 policy 或第二套 Gate；
12. reactions v1/v2、Gate 和 Lifecycle 文档互相指向同一现行合同。
13. Gate Decision 经既有 GraphQL middleware 暴露稳定错误，前端失败时回滚 optimistic state；
14. fact 唯一约束、fact/projection 原子回滚和副作用不泄漏均有真实事务测试；
15. Phase 1 对不可写状态的 add/remove 一律 deny，未来 undo-own-relation 必须另立显式合同。

本文最终边界：Reactions v3 修复 interaction mutation admission，并降低新增 thread/interaction 的
扩展成本；Gate 仍是 actor/action 准入权威，Lifecycle 仍是资源状态权威，fact 仍是 interaction
membership 权威，projection 仍是可重建读取模型。
