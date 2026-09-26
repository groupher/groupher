# Article View 计数写链路

> 状态：同步写协议已落地；Edge rate-limit/origin 限制与真实并发压测仍属于发布验收。
>
> 本文定义 Article `views` 的同步写链路。当前实现已经直接替换旧的
> `ViewEvent -> Oban ViewProjection -> ViewSummary -> ArticleStats` 协议，不保留双写、双读、fallback、旧
> projector 或兼容中间层。
>
> 公共读取、SSR hydration、TanStack Query、HTML/CDN TTL 继续遵守
> [`article-stats-and-public-cache.md`](../../architecture/article-stats-and-public-cache.md)；ArticleStats 的长期
> identity 与排序继续遵守 [`article-stats-target.md`](../../architecture/article-stats-target.md)。emotion typed-row
> 迁移是独立 cutover，见 [`article-emotion-counts.md`](../../architecture/article-emotion-counts.md)，不属于本文实施范围。
> 公共缓存文档中关于
> `ViewSummary`、异步 view 投影、tracking 后延迟 refetch 和 views 可重建性的旧描述由本文取代。

## 1. 结论

普通论坛的 Article view 在 tracking 请求内同步完成。一次有效阅读成功返回时，服务端已经原子完成：

```text
viewer/article 去重水位 claim
  + ArticleStats.views UPSERT
  + viewsRevision 推进
  + authenticated ViewerState 写入
  + Analysis.MetricEvent 写入
```

GraphQL 返回提交后的完整 `ArticleStats`；前端按 owner revision vector 接受服务端快照，不本地 `views + 1`，也不
invalidate 后连续 refetch 猜测后台投影时机。

```text
Article 达到当前 actor 的有效阅读条件
        │
        v
trackArticleView(eventId, article)
        │
        v
ViewTracker 同步事务
  ├─ claim viewer/article 水位
  ├─ UPSERT ArticleStats.views
  ├─ UPSERT ViewerState（仅 authenticated human）
  ├─ INSERT Analysis.MetricEvent（仅 counted）
  └─ RETURNING 完整 ArticleStats
        │
        v
TanStack Query 接收服务端快照
  └─ UI 直接显示，无 view 专属 refetch
```

当前系统需要的是可靠的累计计数，不是可按历史规则任意重放的 event-sourced aggregate。统计规则改变时只记录生效
时间，不为旧规则保留运行时分支，也不重算历史累计 views。

## 2. 目标与非目标

### 2.1 目标

- tracking mutation 提交时公开 `views` 已经更新；
- 网络重试不重复增加 views；
- 同一 viewer 在配置窗口内不重复增加 views；
- human、agent、crawler 使用明确且不同的阅读资格；
- human 有效阅读阈值可配置，但只有一份跨语言合同；
- 前端使用服务端返回值收敛，不猜测异步延迟；
- Analysis 聚合可以异步失败和重试，但不能重复公开计数；
- 单次 view 不 purge 公共 HTML/CDN；
- comments、interactions、views 只更新各自拥有的 ArticleStats 列。

### 2.2 非目标

- 不建立通用 rule engine；
- 不为历史规则维护 `policy_version` 兼容执行器；
- 不支持用旧 ViewEvent 重新计算公开 views；
- 不把匿名 Session 当作真实自然人 UV；
- 不为每个 view 创建一个异步任务；
- 不同时维护同步和异步两套 canonical write protocol；
- 不预先实现 sharded counter、compactor 或高流量切换状态机；
- 不通过本地 `+1`、字段级 merge 或旧 Article count fallback 修复写链路。

## 3. 有效阅读资格

“读取内容”和“计入 views”是两个动作。SSR、prefetch、列表曝光和普通 API read 不产生 tracking 副作用。

### 3.1 Actor 使用不同策略

human 和 agent 不能共享“连续可见 N 毫秒”这种浏览器专属条件：

| Actor               | 有效阅读入口                    | 默认资格                                                              | 去重 identity                | 默认结果 |
| ------------------- | ------------------------------- | --------------------------------------------------------------------- | ---------------------------- | -------- |
| authenticated human | 浏览器 Article viewer           | 前台且正文容器连续可见达到配置时长                                    | account id 派生 key          | counted  |
| anonymous human     | 浏览器 Article viewer           | 前台且正文容器连续可见达到配置时长                                    | signed anonymous Session key | counted  |
| verified agent      | 明确的 server-side read adapter | credential 已由 request-boundary verifier 验证，adapter 显式 tracking | credential/delegation key    | counted  |
| verified crawler    | 单独的 crawler adapter          | 本版本不计数                                                          | verified crawler key         | excluded |
| unknown             | 无可信分类                      | 不计                                                                  | 无稳定 key                   | excluded |

human 的浏览器状态机：

```text
Article content ready
  + wrapper intersecting
  + document.visibilityState == visible
  + 连续保持 >= humanMinVisibleMs
  -> trackArticleView
```

`humanMinVisibleMs` 是配置，不是固定业务常量。`1_000ms` 可以作为初始值，但列表、Drawer 和详情不得各自声明
一份阈值。

agent 没有 DOM、viewport 或 `visibilityState`，因此不伪造 human 的可见时长：

```text
trusted agent request
  -> agent/delegation credential 通过真实 verifier
  -> 明确调用 Article read adapter
  -> adapter 完成产品定义的读取动作
  -> trackArticleView(read_purpose: public_read, actor: agent)
```

在 verifier 接线完成前，只有 `agent_credential_id`/`delegation_id` 的 presence 不能证明可信身份，必须 fail closed 为
`unknown`。普通抓取、搜索索引和只读取 GraphQL content 的 agent/crawler 都不自动计数。是否调用 tracking adapter 是
producer 的显式决定；RequestActor 只负责分类，不负责决定 counted。

### 3.2 配置归属

跨前后端共享的有效阅读语义只有一个语言无关源：

```text
packages/contracts/view-counting.contract.json
  └─ humanMinVisibleMs
       └─ generate -> TypeScript constant
```

生成物不得手工编辑，CI 必须校验 JSON 与 TypeScript 同步。这个阈值只属于浏览器可见性状态机；Phoenix 不接收也不
信任客户端声明的可见时长，因此不生成未消费的 Elixir mirror。配置变化随一次正常发布整体生效，不在请求期间动态
切换，也不按旧版本执行。

只有后端消费的运行参数继续由 `ViewTracker.Config` 拥有：

```text
ViewTracker.Config
├─ human_dedupe_window_seconds
├─ agent_dedupe_window_seconds
├─ view_count_receipt_ttl_seconds
└─ watermark_retention_seconds
```

约束：

- crawler 和 unknown 在本版本固定 excluded，不增加尚未使用的 crawler window/toggle；
- receipt TTL 必须覆盖客户端和网络重试窗口；
- watermark retention 必须大于所有 actor dedupe window；
- 前端消费方不得各自硬编码 `humanMinVisibleMs`；
- 配置值改变不触发历史重放。

### 3.3 规则变化记录

发布流程在规则实际变化时追加一条记录：

```text
view_counting_rule_changes
├─ effective_at
├─ changed_values
├─ reason
└─ deploy_revision
```

记录由 deployment/release owner 写入，`effective_at` 使用发布生效时间。它只用于解释时间序列口径，不参与 tracking
runtime，不保留旧规则分支，也不要求重新计算既有 views。若 `policy_version` 继续出现在 Analysis 事件中，它只是一项
分析标签，不得控制运行时分支。

## 4. Anonymous Session 与 UV 边界

first-party signed anonymous Session 只提供匿名浏览器的稳定去重 identity：

```text
same browser Session
  + same Article
  + inside dedupe window
  -> one counted view
```

它不是自然人 UV 保证：

```text
同一人使用两个设备       -> 两个 anonymous identities
同一人清除 Cookie        -> 新 identity
隐私窗口重新打开         -> 新 identity
多人共用一个浏览器       -> 一个 identity
登录用户                 -> 使用 account identity
```

因此公开 `views` 的定义是“通过当前有效阅读规则并经过 account/session 窗口去重的阅读次数”。如果未来提供 UV 产品
指标，应使用 `uniqueViewerSessions` 等明确名称，不把 anonymous Cookie 解释成 unique humans。

## 5. 同步写事务

### 5.1 ArticleStats 字段级 owner

`ArticleStats` 继续是公共读取的单行快照。对于 views，它同时保存 ViewTracker 拥有的 canonical current counter；
comments/interactions 列仍是各自领域事实的读取投影：

```text
cms.article_stats
├─ views / views_revision
│    owner: ViewTracker；canonical current counter
├─ upvotes_count / collects_count / reaction_counts / interaction_revision
│    owner: Interactions；公共读取投影
├─ comments_count / comments_participants_count / comments_revision
│    owner: Comments；公共读取投影
└─ snapshot_at
     shared row-order metadata；每个成功 owner 写入都由 DB clock_timestamp() 推进
```

本次只切换 views 写协议。Interactions 当前使用的 `reaction_counts` JSONB 和 GraphQL `reactionCounts` 保持唯一生产
路径；本文不建立 emotion typed 影子表，也不改 GraphQL shape。canonical Article identity 落地后，再按
[`article-emotion-counts.md`](../../architecture/article-emotion-counts.md) 一步切换并删除旧字段。

不再保留读取所有 owner 后整行覆盖的通用 `ArticleStats.sync/1`。替代 API 必须按 owner 明确命名：

```text
ArticleStats.initialize(article)
ArticleStats.increment_views(article, ...)
ArticleStats.apply_comment_counts(article, ...)
ArticleStats.apply_interaction_counts(article, ...)
ArticleStats.rebuild_comment_fields(article)
ArticleStats.rebuild_interaction_fields(article)
```

约束：

- publish transaction 使用 `initialize/1` 建立零值行；
- 每个 API 只写自己拥有的 count/revision 加共享 `snapshot_at`；
- `apply_comment_counts/2` 字段级 UPSERT `comments_count/comments_participants_count/comments_revision`；
- `apply_interaction_counts/2` 在本阶段仍字段级 UPSERT
  `upvotes_count/collects_count/reaction_counts/interaction_revision`，不能随 views 切换提前删除 JSONB；
- 两个 owner API 即使遇到历史/mirror ArticleStats 缺行也必须写入 owner 值，并让其他 owner 字段使用数据库零值
  default，不能静默更新零行；
- comments/interactions 的 drift repair 只能调用各自 owner API；
- 不存在一个可以覆盖所有 owner 列的 production API；
- views 删除 ViewSummary/ViewEvent 后没有第二份在线事实源，不宣称可从另一 owner 重建；灾难恢复依赖数据库备份/PITR；
- `snapshot_at` 使用 SQL `clock_timestamp()`，不能使用应用节点时间，也不能使用 transaction-start `now()`。

### 5.2 ViewWatermark

本阶段内部 Article identity 明确使用物理复合键：

```text
cms.article_view_watermarks
├─ thread
├─ article_id
├─ viewer_tracking_key
├─ last_counted_at
└─ updated_at

UNIQUE (thread, article_id, viewer_tracking_key)
```

canonical Article identity 落地时直接迁移为 `(article_id, viewer_tracking_key)`，不保留双 key 查询。

水位 claim 必须由一条 conditional UPSERT 或等价原子 SQL 完成，不能先读再写：

```text
no watermark row
  -> insert last_counted_at = DB clock_timestamp()
  -> counted

existing.last_counted_at <= DB clock_timestamp() - actor_dedupe_window
  -> update last_counted_at
  -> counted

existing.last_counted_at inside actor_dedupe_window
  -> no update
  -> duplicate_in_window
```

服务端使用数据库接收时间，不接受客户端时间决定窗口。

### 5.3 ViewCountReceipt

为了覆盖“数据库已提交但客户端没有收到响应”的传输歧义，保留轻量短期幂等 receipt：

```text
cms.article_view_count_receipts
├─ event_id                         PK
├─ thread
├─ article_id
├─ viewer_tracking_key
├─ state                            PENDING / FINALIZED
├─ counted                          PENDING 时为空
├─ decision_reason                  PENDING 时为空
├─ expires_at                       DB clock_timestamp() + view_count_receipt_ttl_seconds
└─ inserted_at
```

它只负责同一个 `event_id` 的 transport retry，不是 append-only ViewEvent，不包含 projection state、generation、
dead-letter、replay 或长期审计状态。仅当同一 locator 仍能通过 Gate/Lifecycle 解析为公开可读 Article 时，相同
eventId/same identity 返回原 counted 决定和当前完整 stats；相同 eventId/different identity fail closed。Article missing 或
no-longer-public 时 Gate/Lifecycle 结果优先，不查询 receipt，也不承诺幂等 replay。

`expires_at` 是 Retention 最早允许删除该行的时间，不是 claim 逻辑中的回收条件。只要过期行尚未被删除，`ON CONFLICT`
仍命中它并返回原 FINALIZED 决定；Retention 实际删除后，服务端才不再保证能恢复原决定。客户端无论 TTL/清理状态如何
都不得复用旧 eventId。周期性 keyset/batch retention 删除过期行，不为每个 receipt 创建清理 job。

`excluded_by_policy` 没有 count、watermark、MetricEvent 或 ViewerState 副作用，天然可重试，不写持久化 receipt。receipt
只覆盖可能修改状态的合格 public-read 请求。

同一 `event_id` 的并发请求不能使用 SELECT-then-INSERT。事务先用 Ecto
`Repo.insert_all(..., on_conflict: :nothing, returning: [:event_id])` 原子 claim 一条 PENDING receipt：

```text
INSERT PENDING receipt ON CONFLICT(event_id) DO NOTHING RETURNING event_id
  -> 若存在未提交冲突，PostgreSQL 先等待 winner transaction
       ├─ winner rolled back -> INSERT 成功并 returned event_id
       │    └─ 当前事务拥有 claim；继续 watermark/count，提交前 finalize
       └─ winner committed -> returned zero rows
            └─ SELECT receipt FOR UPDATE，读取 FINALIZED 决定
```

同一 transaction 必须在 commit 前把 PENDING 更新为 FINALIZED；禁止正常返回时提交 PENDING receipt。冲突请求读取后先校验
`thread/article_id/viewer_tracking_key`，不同 identity fail closed；相同 identity 返回原 counted 决定和当前完整 stats。
`PENDING/FINALIZED` 由 ViewTracker 自己的 Const/Ecto.Enum 封闭词表拥有，不能在调用方散落字符串。

### 5.4 完整事务

```text
resolve public Article through Gate/Lifecycle
  + consume verified RequestActor classification
        │
        ├─ unknown / crawler / non-public-read
        │    └─ return counted=false, EXCLUDED_BY_POLICY,
        │       current ArticleStats + empty ViewerState
        │
        v
BEGIN
  │
  ├─ SELECT physical Article FOR KEY SHARE
  │    ├─ missing / no longer public -> rollback counting path; create no state
  │    └─ exists -> revalidate Gate/Lifecycle and continue
  │
  ├─ INSERT PENDING ViewCountReceipt ON CONFLICT DO NOTHING RETURNING
  │    ├─ inserted -> own eventId claim, continue
  │    └─ conflict -> SELECT receipt FOR UPDATE after winner transaction
  │         ├─ same identity + FINALIZED -> return prior decision/current stats
  │         └─ different identity / invalid state -> fail closed
  │
  ├─ claim ViewWatermark using actor-specific window
  │
  ├─ counted
  │    ├─ UPSERT ArticleStats views/views_revision
  │    ├─ authenticated human -> UPSERT ViewerState
  │    └─ Analysis.MetricEvent.append(event_id, ...)
  │
  ├─ duplicate
  │    └─ SELECT current ArticleStats; no count/MetricEvent mutation
  │
  ├─ finalize ViewCountReceipt decision
  └─ RETURN complete ArticleStats + ViewerState
COMMIT
```

所有路径使用固定锁顺序：

```text
physical Article FOR KEY SHARE
  -> ViewCountReceipt
  -> ViewWatermark
  -> ArticleStats
  -> ViewerState
  -> Analysis.MetricEvent
```

`FOR KEY SHARE` 允许同一 Article 的 view transactions 并发进入，但会与物理 Article 的 `DELETE`/key-changing update
冲突。它保留旧 EventProcessor `FOR UPDATE` 曾提供的 delete-vs-view 保护：

```text
view 先持 Article key-share lock
  -> permanent delete 等待
  -> view commit
  -> permanent delete 在同一事务内：
       1. 锁定并删除 physical Article
       2. 删除 ArticleStats / ViewWatermark / ViewCountReceipt / ViewerState
       3. commit

delete 先提交
  -> view 的 key-share SELECT 返回 missing
  -> 不创建 receipt/watermark/ArticleStats
```

permanent delete 必须先取得 physical Article 的删除行锁并删除该行，再清理 ArticleStats、watermark、receipt 和 viewer state；
禁止先清理投影/去重状态、再反向等待或删除 physical Article。这样 delete 与 view 都从同一 physical Article lock root 开始，
不会形成反序锁，也不会让 view 在投影清理后重新 UPSERT orphan。

该行锁只解决物理删除完整性，不代表它会阻止所有非 key lifecycle update。Gate/Lifecycle 状态仍须在事务内重新验证，并
遵守 Lifecycle owner 自己的锁协议；BEGIN 前的 resolve 只是 admission hint，不能作为提交时存在性证明。

首次 view 或异常缺行时，views 更新必须是字段级 UPSERT，而不是可能更新零行的普通 UPDATE。生产实现使用 Ecto
`Repo.insert/2` 与 `on_conflict`，不在领域模块拼接或执行裸 SQL：

```elixir
on_conflict =
  from(stats in ArticleStats,
    update: [
      inc: [views: 1, views_revision: 1],
      set: [
        snapshot_at: fragment("date_trunc('second', clock_timestamp())"),
        updated_at: fragment("date_trunc('second', clock_timestamp())")
      ]
    ]
  )

%ArticleStats{}
|> ArticleStats.create_changeset(%{
  thread: thread,
  article_id: article_id,
  views: 1,
  views_revision: 1
})
|> Repo.insert(
  conflict_target: [:thread, :article_id],
  on_conflict: on_conflict,
  returning: true
)
```

以上代码表达目标语义，最终函数签名和 changeset 名称遵守实现时的 ArticleStats 模块边界。数据库 migration 为
`snapshot_at` 提供同一个 `date_trunc('second', clock_timestamp())` default，使 insert path 也只使用 DB 时间；其他
non-null count/revision 使用数据库零值 default；create changeset 不写入应用节点生成的 `snapshot_at`。`on_conflict`
只能增加 views owner 字段并更新共享 `snapshot_at`，不能
覆盖 comments/interactions 字段。`RETURNING` 由 Ecto `returning: true` 获取完整提交行。

`MetricEvent.append/1` 已是同库事务型 Analysis outbox：append 失败回滚整个 counted transaction；提交后的 Aggregator
retry/retention 只影响分析投影，绝不能再次更新 ArticleStats。

成功返回时：

- `counted=true` 表示 `ArticleStats.views/viewsRevision` 已经提交；
- `counted=false, reason=DUPLICATE_IN_WINDOW` 表示请求成功但数字未变化；
- `counted=false, reason=EXCLUDED_BY_POLICY` 表示请求没有进入任何计数状态；
- mutation 不再存在“accepted 但不知道是否 counted/projected”的中间状态。

### 5.5 Retention

旧 `Maintenance` 的 projection reconcile/replay/drop 随异步投影删除；短期幂等状态仍需要一个职责单一的
`CMS.ViewTracker.Retention`：

```text
periodic singleton retention job
  -> ViewTracker.Retention
       ├─ keyset/batch delete expired ViewCountReceipt
       └─ keyset/batch delete ViewWatermark older than watermark_retention_seconds
```

它是周期性、可重试、批量有上限的 housekeeping，不为每个 view/receipt 创建 Oban job，不投影公开 count，也不提供
reconcile/replay/drop。删除 watermark 的 cutoff 必须晚于所有 actor dedupe window；任务失败只延迟空间回收，不能改变
counted 决策。

Retention 先删除、claim 后到达时依赖 PostgreSQL 行锁和唯一约束串行化：Retention 删除事务持锁期间，claim 的
`INSERT ... ON CONFLICT` 等待；删除提交后 claim 插入新 PENDING receipt 并取得 ownership，删除回滚时 claim 命中原
FINALIZED receipt，随后 `SELECT ... FOR UPDATE` 读取旧决定。

反向顺序没有同样的锁保证。对一条已经提交、已过期的 receipt 执行
`INSERT ... ON CONFLICT DO NOTHING`，冲突分支返回后**不会**为当前 transaction 保留该 tuple 的行锁；Retention 可以在
conflict 返回与紧接的 `SELECT ... FOR UPDATE` 之间删除该行。此时 replay fail closed 为 `receipt_invalid_state`，当前 tracking
transaction 回滚且不会修改 watermark/views；receipt 已被实际删除后，后续请求按上文 TTL 合同不再享有原决定恢复保证。
这里有意不使用 no-op `DO UPDATE` 为每次正常 replay 强制取得行锁，因为它会为每次 replay 产生新 tuple。该亚毫秒窗口是
当前协议明确接受的边界，不得在文档或测试中声称所有顺序都无缝 replay。

ViewWatermark 清理与 conditional UPSERT 同样由 PostgreSQL 行锁串行化：删除提交后 UPSERT 插入新 watermark，删除回滚时
UPSERT 基于旧 watermark 判断。由于 retention cutoff 严格晚于所有 actor dedupe window，两种顺序看到的旧水位都已在窗口
外，因此 counted 决策一致；清理竞态不能额外增加一次 views。

## 6. GraphQL 与前端收敛

### 6.1 Mutation payload

```graphql
enum ArticleViewDecisionReason {
  COUNTED
  DUPLICATE_IN_WINDOW
  EXCLUDED_BY_POLICY
}

type ArticleViewTrackResult {
  counted: Boolean!
  decisionReason: ArticleViewDecisionReason!
  eventId: ID!
  articleStats: ArticleStats!
  viewerState: ViewerArticleState!
}
```

使用现有 `ViewerArticleState` 命名。旧 `accepted` 字段直接删除，不保留 alias。响应中的 `articleStats` 是事务提交后
从 `cms.article_stats` `RETURNING`/读取的完整快照，不是只含 `views` 的 patch。

### 6.2 ArticleStats cache 顺序

客户端以三个 owner revision 组成的偏序为第一判断，`snapshotAt` 只在 revisions 相等时决定顺序：

```text
没有 current ArticleStats cache
  -> counts/revisions/locator 结构合法时直接接受
  -> snapshotAt 非法则记录 invalid_snapshot，并把 Query 视为立即 stale

任一 incoming owner revision < current owner revision
  -> mixed/stale response
  -> 丢弃整份 ArticleStats，记录 telemetry

没有 revision 倒退，且至少一个 owner revision 严格前进
  -> 接受整份 ArticleStats
  -> snapshotAt 非法时记录 invalid_snapshot；反常时记录 clock_skew
  -> timestamp 不能否定已提交的新 revision

所有 owner revisions 相等
  ├─ incoming timestamp 非法                -> 丢弃并记录 invalid_snapshot
  ├─ current timestamp 非法、incoming 合法  -> 接受修正后的快照
  ├─ incoming.snapshotAt >= current.snapshotAt -> 接受整份
  └─ incoming.snapshotAt < current.snapshotAt  -> 丢弃整份
```

禁止逐字段拼接不同响应。`snapshotAt` 由数据库 `clock_timestamp()` 写入；revision vector 仍提供 clock correction、跨节点
响应乱序和 mixed response 的 fail-closed 保护。

`viewerState` 是独立的私有单调事实。ArticleStats 被 revision guard 拒绝时，合法且更新的 ViewerState 仍照常应用，不能
把“丢弃整份 ArticleStats”误读成丢弃整个 GraphQL payload。

禁止：

```text
accepted -> local views + 1
accepted -> immediate invalidate/refetch
accepted -> setTimeout -> second refetch
response.views -> patch only views into an older ArticleStats
```

如果 transport retry 都失败，浏览器保留当前公开 stats；不能因为不知道服务端是否提交就本地修改 count。下一次正常
ArticleStats freshness refresh 会自然收敛。

### 6.3 ViewerState 和本地 receipt

authenticated human 的 `viewerHasViewed` 在同一事务写入并随 mutation 返回，可以直接更新 private ViewerState cache。

anonymous human 没有跨设备 ViewerState。若 UI 需要在同一 tab 显示“已阅读”，可以保留 sessionStorage receipt，但它：

- 只覆盖 `viewerHasViewed`；
- 不包含公开 count；
- 不包含旧 `accepted` 语义；
- 不参与 ArticleStats 生命周期；
- 不触发额外 refetch。

## 7. Analysis 边界

`Analysis.MetricEvent` 本身就是事务型 outbox/fact table，不增加第二张 outbox 表或“outbox worker 再 append
MetricEvent”的额外 hop：

```text
ViewTracker transaction
  ├─ ArticleStats.views committed
  └─ Analysis.MetricEvent committed
              │
              v
        Analysis.Aggregator
          ├─ hourly aggregation
          └─ retry / retention belongs to Analysis
```

`event_id` 作为 MetricEvent 的下游幂等 operation id。Aggregator 失败不回滚已提交 views；重试只能影响分析投影，不能
再次更新 ArticleStats。

## 8. Rate Limit

Rate Limit 是入站保护，不是 views 语义：

```text
untrusted request
  -> Edge/Cloudflare Rate Limit
  -> Phoenix endpoint admission
  -> database watermark defines business dedupe
```

目标链路删除 per-instance ETS view rate limit。它会产生实例间额度不一致、重启清零和“设施故障是否改变 counted”歧义，
却不能证明 duplicate 或 unique viewer。Edge 负责粗粒度 abuse protection，数据库 watermark 始终是业务去重 authority；
origin 必须限制为可信 Edge/内部入口，不能暴露一个绕过 admission 的等价公网 endpoint。

删除 ETS guard 是有前置条件的部署动作，不是先合并代码再补 Edge：

```text
Cloudflare/Edge tracking rate-limit rule 已启用并命中验证
  + origin allowlist / authenticated origin path 已验证无法绕过 Edge
  + tracking DB write budget 与告警已压测
  -> 才允许删除 per-instance ETS guard
```

任何一项未满足都阻止同步写链路发布。短期保留 ETS 到 Edge 验收完成只是 admission rollout 顺序，不是 views 业务协议的
双写或兼容层。

如果未来确实需要 Phoenix 内第二道保护，必须另行定义分布式或三态协议：

```text
:allow       -> 继续
:limited     -> 429，不进入业务事务
:unavailable -> fail open，由 watermark 保证计数正确性
```

不能使用一个 boolean 同时表达超限和设施不可用，也不能让 guard 故障隐式改变 counted 决策。

## 9. CDN 与公共读取

单次 view 只更新数据库和当前浏览器 Query cache，不 purge HTML：

```text
counted view
  ├─ current browser receives committed ArticleStats immediately
  ├─ ArticleStats GraphQL subsequent reads see committed value
  └─ cached public HTML keeps existing hydration snapshot until
       ├─ content operation explicitly purges page
       └─ normal HTML TTL / SWR revalidation
```

这保留当前正确边界：count 高频变化不能导致每次阅读都触发 Cloudflare purge。

## 10. 高流量演进边界

本版本只有同步 ArticleStats 协议。是否需要高流量模型由生产指标决定：

- ArticleStats 行锁等待时间；
- tracking mutation P95/P99；
- 单篇 Article 每秒 counted writes；
- PostgreSQL WAL、CPU、连接和 autovacuum 压力；
- `(thread, views, article_id)` 排序索引的写放大。

没有这些证据时，不创建 Queue、每事件 job、projector、generation、replay、counter shard 或 compactor。

如果真实热点证明同步行更新不可接受，必须新建后续版本完整定义：

- canonical count 的 base/shard/cutover 公式；
- mutation 在最终一致阶段返回什么；
- `viewsRevision` 的推进时机；
- compaction 幂等、故障恢复和观测；
- 从同步协议直接切换的迁移步骤。

在该版本落地前，不预埋双模式 runtime 分支，也不在本文使用不完整的 `max(current, shard total)` 公式。

## 11. 旧链路与当前链路对比

| 维度              | 已删除的旧异步实现                  | 当前同步实现                                        |
| ----------------- | ----------------------------------- | --------------------------------------------------- |
| public count 提交 | Oban 异步投影                       | tracking transaction 同步提交                       |
| 每次 counted view | ViewEvent + MetricEvent + Oban job  | watermark + ArticleStats UPSERT + MetricEvent       |
| views owner       | ViewSummary                         | ArticleStats 的 views 列，由 ViewTracker 字段级拥有 |
| ArticleStats 更新 | 读取所有 owner 后整行重建           | 每个 owner 只更新自己的列                           |
| mutation 结果     | accepted，不保证 counted/projected  | 明确 counted/duplicate/excluded，counted 即已提交   |
| 前端收敛          | 立即 refetch + 延迟 refetch         | 直接接受 mutation 返回的完整 snapshot               |
| retry 幂等        | 长期 ViewEvent                      | 短期 ViewCountReceipt                               |
| 投影失败          | retry/generation/dead-letter/replay | public count 无投影；Analysis 独立聚合重试          |
| 规则变化          | policy version 进入事件             | 只记录生效时间和 deploy revision                    |
| 高流量            | 所有流量预先走异步                  | 有生产证据后另立完整版本                            |

## 12. 直接切换记录与删除清单

本次已使用一次直接切换，不保留兼容层。

新增或替换：

```text
├─ ArticleStats.initialize / increment_views
├─ ArticleStats.apply_comment_counts
├─ ArticleStats.apply_interaction_counts
├─ ArticleStats.rebuild_comment_fields / rebuild_interaction_fields
├─ ArticleStats views 字段级 UPSERT + DB clock_timestamp()
├─ physical Article FOR KEY SHARE delete barrier
├─ ViewWatermark 明确复合唯一键
├─ short-lived ViewCountReceipt
├─ ViewTracker.Retention 周期批量清理
├─ ArticleViewTrackResult GraphQL payload
├─ packages/contracts/view-counting.contract.json + TypeScript 生成物
└─ revision-vector-first frontend cache guard
```

删除：

```text
├─ ViewEvent 表及 projection state/generation/retry deadline
├─ Jobs.ViewProjection 与 Jobs.Config.view_projection
├─ EventProcessor public count projection
├─ ViewSummary 表、Model 与 Query.summaries/2
├─ Maintenance reconcile/replay/drop
├─ view projection dead-letter/replay/drop
├─ ArticleStats.sync/1 全 owner 重建入口
├─ frontend accepted 语义
├─ frontend view accepted 后的两次 invalidate/refetch
└─ per-instance ETS view RateLimit
```

已完成的落地顺序：

```text
0. 验证 Edge tracking rate-limit、origin 限制、DB write budget 与告警；未通过则停止发布
1. 建立 ViewCountReceipt；将现有 dedupe state 直接迁移/重建为 ViewWatermark
2. 增加字段级 ArticleStats owner API，将所有 owner 的 snapshot_at 迁移到 DB clock，迁移 comments/interactions/publish 调用方
3. 落地 physical Article key-share、views UPSERT、MetricEvent append 和新 GraphQL payload
4. 同一发布边界切换前端 mutation/cache 接收
5. 停止并清空旧 projection job
6. 删除 ViewEvent、ViewSummary、EventProcessor、旧 Maintenance 与旧测试；启用 focused Retention
7. 删除 per-instance ETS guard，并复验 Edge 命中和 origin 不可绕过
```

views 已存在于 ArticleStats，不伪造不存在的 count backfill。切换前只需验证 ArticleStats 行完整性、watermark/receipt migration
和新事务；旧 worker、表、Query 和 tests 随切换直接删除，不能在运行时判断新旧版本。

## 13. 验收条件

- `humanMinVisibleMs` 来自语言无关合同生成物，详情和 Drawer 共用同一状态机；
- agent 使用真实 verifier 和明确 server-side adapter；verifier 未接线时 fail closed 为 unknown；
- crawler/unknown 默认不计数、不写 receipt/watermark/MetricEvent；
- 每次实际配置/规则变化的发布都写入一条带 `effective_at`、changed values、reason 和 deploy revision 的记录，runtime
  没有旧版本兼容分支；
- publish 初始化 ArticleStats 零值行，首次 view 缺行时字段级 UPSERT 仍不会丢计数；
- comment/interaction owner API 在 ArticleStats 缺行时也通过 Ecto UPSERT 写入，不静默更新零行；
- 同一 viewer/Article 在窗口内并发请求最多一个成功 claim；
- 同一 eventId 的 claim 使用独立 Postgrex 连接覆盖 winner commit、winner rollback 和 loser 等待；再由领域行为测试验证
  committed receipt replay 返回原 counted 决策且不重复增加 views；正常 transaction 不提交 PENDING receipt；
- 相同 eventId/different identity fail closed；
- receipt `expires_at` 由 DB clock 计算；到期但 Retention 尚未删除时仍返回原决定，删除后不再承诺恢复；
- counted response 返回时 `ArticleStats.views/viewsRevision` 已提交；
- duplicate response 不改变 views，并返回当前完整 ArticleStats；
- excluded response 不创建任何计数状态，并返回当前 stats/empty viewer state；
- ViewTracker 只更新 ArticleStats 的 views owner 字段；
- Comments/Interactions/Publish 已迁移到明确字段级 API，不再调用全 owner `sync/1`；
- 本切换不改变 emotion 存储/GraphQL shape，也不创建 typed 影子表；后续迁移只遵守独立 emotion cutover 文档；
- mutation response 可以直接写入 ArticleStats entity，无 view 专属 refetch；
- 任一 owner revision 倒退时整份 ArticleStats 被拒；revision 前进时不会仅因应用节点时钟偏差丢弃；
- 无 current cache 时结构合法的 ArticleStats 直接接受；无效 `snapshotAt` 会触发 telemetry 和立即 stale，而不是空白 UI；
- revision 前进且 `snapshotAt` 非法时仍接受并记录 telemetry；revisions 相等且 incoming timestamp 非法时拒绝；
- ArticleStats 被拒时，合法的 ViewerState 仍独立应用；
- `snapshot_at` 只由数据库 `clock_timestamp()` 写入；
- CDN HTML 不因单次 view purge；
- MetricEvent 与 count 同事务写入，Aggregator 失败或重试不会改变公开 views；
- 公开写链路不存在 ViewSummary fallback、双写、异步 projector 或兼容 alias；
- Retention 使用有上限的 keyset/batch 清理过期 receipt/watermark；失败重试不改变 counted 决策；
- receipt Retention-vs-claim 使用独立 Postgrex 连接覆盖 delete-first 的 commit/rollback，以及 claim-first 的
  `DO NOTHING -> delete -> SELECT` 无锁窗口；无锁窗口必须 fail closed 且当前事务不修改 watermark/views；
- watermark Retention-vs-conditional UPSERT 使用独立 Postgrex 连接覆盖 delete commit 与 delete rollback：UPSERT 正确
  等待，两种结果的 counted 决策一致且不额外增加 views；
- ETS guard 删除前 Edge rate-limit、origin 限制、DB write budget 和告警均有部署证据；
- 数据库锁语义必须由独立 Postgrex 连接测试；Ecto Sandbox shared-owner 测试只验证领域结果和 query shape，禁止用
  `Task.yield` 的阻塞结果证明 tuple/row lock；
- physical Article key-share 的真实多连接测试覆盖 view 先持锁与 delete 先提交两种顺序；领域测试另行验证 permanent
  delete 与 projection cleanup 同事务后不留下 ArticleStats、watermark 或 receipt orphan；
- query capture 行为测试验证固定锁顺序、ArticleStats UPSERT 和 `snapshot_at = clock_timestamp()`，不冒充并发锁测试；
- 使用真实浏览器测试验证可见阈值、后台标签页、快速关闭和配置变化；
- 使用故障测试验证事务提交后响应丢失时，相同 eventId retry 不重复计数；
- 引入任何异步/sharded counter 前，必须另立完整协议并提供同步路径的真实 `lock wait/P99` 基线。
