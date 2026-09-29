# ArticleStats 与 private state 写后同步

> 状态：后端 payload、owner revision、前端 owner-wise merge、真实 Detail/Batch query 与 SSR 接线已实施并通过本地验收
>
> 日期：2026-09-27
>
> 相关当前合同：
> [ArticleStats 与公共页面缓存](./article-stats-and-public-cache.md)、
> [Article View 计数写链路](../feature/view-tracker/article-view-counting.md)、
> [Article View 计数简化方案](../feature/view-tracker/article-view-counting-simplification.md)

本文定义 Article 的 view、upvote、collect、emotion 和 comment 写入完成后，后端如何返回权威的
`ArticleStats` 与 owner-specific private state，以及前端如何让 Detail、Posts、Changelogs 和 Kanban 立即看到同一结果。

这不是 Gate、Lifecycle、Interactions 或 ViewTracker 的重做。领域事实、准入、事务和计数机制保持不变；改造集中在
GraphQL 写后返回合同与前端 Query cache 同步方式。

## 1. 结论

保留两个清晰的读取维度，但不把所有 private state 合成一个后端大对象：

```text
ArticleStats                 公开、可缓存、所有 viewer 共享
owner-specific private state  私有、按 viewer/owner 隔离、不得进入公共 HTML/CDN
```

每个会改变 Article 公开计数的 mutation，在原业务写入完成后返回完整 `ArticleStats`；只有确实改变某类私有状态时，才返回
该 owner 的 private state：

```text
操作自身结果
+ 完整 ArticleStats
+ 本次操作影响的 private state（如有）
```

前端继续只向页面暴露：

```typescript
useArticleState(article)
useArticleStates(articles)
```

但内部不再建立“batch cache + 单篇 entity cache + 每篇 disabled observer”两套公开统计缓存。页面只订阅真实的
detail/batch query；mutation 返回值按 owner revision 合并到所有包含该 Article 的活跃 query。

### 1.1 与现有合同的关系

本文已完成 direct cutover，并取代旧前端 cache 合同：

```text
旧实现
  -> article-stats-and-public-cache.md “前端 cache identity”
     batch response 归一化为单篇 entity
  -> article-stats-and-public-cache.md “快照顺序与 mutation receipt”
     任一 owner revision 回退时拒绝整份快照

当前实现
  -> “删除 entity cache 和 disabled observers”取代旧 batch -> entity normalization
  -> “按 owner 合并”取代旧 whole-snapshot rejection
  -> detail 与 batch 成为两个真实 consumer query
  -> 所有进入前端的 ArticleStats 按 owner revision 合并
```

[`query-invalidation.md`](./query-invalidation.md) 已同步当前合同：
`article.stats(path)` 仍是 typed invalidation target，其匹配对象是真实 detail query 与所有包含 path 的 batch query；它不再
表示 batch response 必须 seed 一个 entity 中转层。

服务端 `snapshotAt` 仍表示持久化投影行时间；本文只取代前端合成对象对 `snapshotAt` 的解释，见“按 owner 合并”。

## 2. 不改变的后端机制

```text
Gate
  -> 仍负责 Article 是否允许读取或执行操作

Lifecycle
  -> 仍是 publish / trash / delete 等状态的唯一权威

Interactions
  -> 仍写 upvote / collect / emotion 事实
  -> 仍同步维护自己拥有的 ArticleStats 字段

ViewTracker
  -> 仍负责 RequestActor、Policy、identity、窗口去重和原子 views 增量

Comments
  -> 仍负责 comment 事实和 comments 相关投影

ArticleStats
  -> 仍是多 owner 的公开读取投影，不成为新的事实 owner
```

改造不能把这些边界揉成一个通用 counter service，也不能让 GraphQL resolver 直接改计数。

本次唯一的领域写协议扩展是 Collect：`addToCollect/removeFromCollect` 增加 `commandId`，接入 MutationLock、Command receipt
与 replay。其他操作保留现有事实、事务、Gate 和 Lifecycle 机制，只调整专用 mutation payload 与写后状态读取。

虽然正常产品路径中 upvote、emotion、collect 或 comment 通常发生在用户看过 Article 之后，它们仍是独立业务写入：

- 匿名 view 后可能登录再 interaction；
- view 可能命中去重窗口或被 Policy 排除；
- view 请求和 interaction 请求可能并发、重试或乱序返回；
- service/delegation 调用可能没有浏览器 view；
- view tracking 失败不能隐式改变 interaction 的事务语义。

因此 interaction/comment mutation 不得顺手增加 views。若产品未来要求“操作前必须看过”，应由独立 Gate/Policy 明确校验，
不能靠隐藏副作用实现。

## 3. 改造前机制（历史）

### 3.1 历史流程

```text
列表 Article[]
    |
    +--> articleStats batch query -------------------+
    |                                                |
    |     response 同时 seed 每篇 article entity     |
    |                                                v
    +--> N 个 disabled articleStats entity query observers
    |         enabled=false，不发请求，只订阅 entity cache
    |
    +--> ViewerArticleState batch query
    +--> ArticleInteractionState batch query
    +--> ViewAck / interaction receipt overlay
              |
              v
       useArticleStates 合并结果
              |
              v
 Detail / Posts / Changelogs / Kanban
```

旧 `useArticleStates` 对每个 Article 创建一个 `enabled: false` 的 entity query。它不是网络请求，但仍是一个 TanStack
Query observer；用途只是让 batch 页面能响应单篇 entity cache 的更新。

### 3.2 历史写后同步

当时 View mutation 已返回完整 `ArticleStats`，但 private result 只来自 ViewTracker：

```text
trackArticleView
  -> applyViewResult
  -> 写单篇 ArticleStats entity cache
  -> 写 ViewerArticleState cache（只权威拥有 viewerHasViewed）
  -> disabled entity observer 通知所在列表重新渲染
```

当前 `ArticleViewTrackResult.viewerState` 的 GraphQL type 是 `ViewerArticleState`。ViewTracker 的写后 reader 不读取
Interactions projection，因此不能把它描述成包含 collected/emotion/upvote 的完整私有状态。

当时 interaction 主要返回 viewer flags、`reactionOutcome` 和 `interactionRevision`：

```text
upvote / undo upvote
  -> optimistic viewer state
  -> mutation 成功
  -> invalidate 单篇 stats + 所有匹配 batch
  -> 活跃 batch refetch
  -> 新 count 才进入列表
```

comment count 也主要依赖 invalidation/refetch，而不是 mutation 直接携带父 Article 的完整统计。

### 3.3 已解决的问题

#### 两份公开统计缓存

同一份 `ArticleStats` 同时存在于：

```text
articleQueryKeys.statsBatch(...paths)    页面真正拉取的数据
articleQueryKeys.stats(path)             mutation 精确更新的数据
```

两者需要 seed、覆盖优先级、observer 和 invalidation 才能保持一致。entity cache 不是独立后端资源，只是为了补足
batch query 的局部更新能力而建立的第二份前端状态。

#### 每篇一个 disabled observer

一个包含 N 篇 Article 的列表会创建 N 个不取数的 entity observer。它能工作，但调用语义不直观，列表规模增大时 observer
数量也线性增长，并且迫使 `useArticleStates` 同时理解 transport batch 和 entity cache。

#### 不同 mutation 的返回能力不一致

View 可以用服务端结果立即更新 count；当前 upvote/comment 主要依赖 invalidation/refetch，collect/emotion 尚无对应的 Core 前端
operation。相同的公开统计缺少统一写后收敛路径，容易出现 Detail 已更新、List 尚未更新，或反过来的短暂分叉。

#### 整体快照拒绝会丢掉独立 owner 的新值

当前 guard 只要发现任意 revision 回退，就拒绝整个 incoming `ArticleStats`。并发请求可能出现：

```text
response A: viewsRevision=11, interactionRevision=20
response B: viewsRevision=12, interactionRevision=19
```

B 的 views 更新更晚，但 interaction revision 更旧。整体拒绝 B 会把新的 views 一起丢掉。三个 owner 必须分别比较，不能把
`ArticleStats` 当成只有一个版本号的原子对象。

#### receipt/ack 承担了过多“等待 refetch”职责

ViewAck 和 interaction receipt 应保护已确认写入在缓存滞后时不回滚；它们不应成为列表 count 日常同步的主要渠道。正常成功响应
已经携带权威的公开统计和本次操作影响的 private state 时，前端应直接应用结果。

## 4. 当前全链路

```text
Browser mutation
  view / upvote / collect / emotion / comment
                    |
                    v
GraphQL boundary / request context
  RequestActor、scope、认证保持现状
                    |
                    v
Gate + Lifecycle admission
                    |
                    v
现有领域写入
  +-----------------+-------------------+----------------+
  |                 |                   |                |
  v                 v                   v                v
ViewTracker     Interactions         Comments       其他 owner
  |                 |                   |
  +---------- 同步更新各自 ArticleStats 字段 --------+
                    |
                    v
写入成功后的 committed result
  ├─ operation result
  ├─完整 ArticleStats
  └─owner-specific private state（本次操作确实改变时）
                    |
                    v
frontend apply result
  ├─按 owner revision 合并所有包含该 path 的 stats query
  ├─只合并对应 owner 的 private query
  └─维护必要的 ViewAck / confirmed-write receipt
                    |
                    v
Detail / Posts / Changelogs / Kanban 同步重渲染
```

失败仍由现有 Gate、Lifecycle、scope 和领域事务决定。为了拼响应不得绕过 admission，也不得在失败后伪造 stats/viewer state。

## 5. 后端改造

### 5.1 GraphQL 返回合同

不新增 `ArticleStatsStore`、`ArticleStatsIndex`、`ArticleModel` 或笼统的 `ArticleState` 类型，也不把 private state 字段加到
`Post`、`Doc`、`Changelog` 等公共 content type。所有写操作使用专用 mutation payload。

现有 GraphQL 名称保持不变：

```graphql
type ArticleViewTrackResult {
  tracked: Boolean!
  articleStats: ArticleStats!
  viewerState: ViewerArticleState!
}
```

`ViewerArticleState` 只保证 ViewTracker-owned 的 `viewerHasViewed`。它不为了字段对称额外读取 Interactions private projection。

Interaction 使用专用 payload：

```graphql
type ArticleReactionResult {
  commandId: ID!
  reactionOutcome: String!
  articleStats: ArticleStats!
  interactionState: ArticleInteractionState!
}

type ArticleCollectResult {
  commandId: ID!
  folder: CollectFolder!
  articleStats: ArticleStats!
  interactionState: ArticleInteractionState!
}
```

`upvote*`、`undoUpvote*`、emotion/undo emotion 返回 `ArticleReactionResult`。`reactionOutcome` 位于专用 payload 上，不再要求
调用方对 `Article` interface 做 `Post`/`Doc`/`Changelog` inline fragment。

Collect 单独返回 folder 与 interaction 状态：

```graphql
addToCollect(article: $article, folderId: $folderId, commandId: $commandId) {
  commandId
  folder { ...CollectFolderFields }
  articleStats { ...ArticleStatsFields }
  interactionState { ...ArticleInteractionStateFields }
}
```

`addToCollect/removeFromCollect` 已增加 `commandId` 并纳入 Command recovery：folder membership、Interaction fact 和
ArticleStats projection 是同一用户命令，响应丢失后不能把
`already_collected`/不存在错误当作可靠恢复结果。

Comment 使用专用 payload，但只返回实际改变的状态：

```graphql
type ArticleCommentResult {
  commandId: ID!
  comment: Comment
  articleStats: ArticleStats!
}
```

create/update/delete comment 不改变 Article-level private state，因此不为结构对称额外返回 `ViewerArticleState` 或
`ArticleInteractionState`。comment reaction 返回 comment-owned private state。若未来 moderation、batch delete 等操作开始改变
父 Article 的 comment 计数，则必须返回受影响 Article 的完整 stats，或明确触发 documented invalidation；当前 moderation 不属于
本次可验收 mutation 范围。

所有包含公开计数的 payload 复用同一个 `ArticleStatsFields` fragment；所有 private fragment 按 owner 分开，不建立一个横跨
ViewTracker、Interactions 和 Comments 的 GraphQL `ViewerState`。

所有 command-backed payload 必须原样返回 non-null `commandId`：Reaction、Collect、Comment 的 pending entity、confirmed
receipt 和 replay 都以它关联同一个 command。`ArticleViewTrackResult` 不使用 `commandId`，继续由 ViewDedupeState 保证业务幂等。

### 5.2 写后状态来源

正确顺序：

```text
1. Gate / Lifecycle admission
2. 原领域事务写事实
3. 同一领域事务同步自己的 ArticleStats owner 字段与 revision
4. 事务成功
5. 从已提交结果组装完整 ArticleStats + 本次操作影响的 private state
6. GraphQL 返回
```

第 5 步可以复用事务返回的 projection，也可以在提交后通过统一 reader 读取；关键约束是：

- 返回值必须反映本次成功写入，不能返回写入前快照；
- command replay 用 receipt 恢复已经提交的 outcome，再重新读取当前权威 ArticleStats/private state；返回状态可以包含更新的
  并发写入，但不能早于已提交 command；
- 并发发生了更新时，允许返回比本次操作更新的状态，但不能返回更旧状态；
- post-commit ArticleStats 与 private state reader 不共享事务快照；两者各自保留实际观察到的 owner revision，resolver 不要求它们
  严格相等，也不合成或复制 revision；
- resolver 不得自行计算 `views + 1`、`upvotesCount + 1` 或 comments count；
- account private state 必须来自当前认证 viewer，并且只能进入对应 owner 的 private cache；匿名 view 只返回本次请求结果，
  前端不建立 anonymous private query，由 ViewAck 提供短期确认。

### 5.3 owner revision 保持不变

```text
ViewTracker   owns views, viewsRevision
Interactions owns upvotesCount, collectsCount, emotionCounts, interactionRevision
Comments     owns commentsCount, commentsParticipantsCount, commentsRevision
```

每个 owner 只推进自己的 revision。目标返回结构不会改变事实表、投影 owner 或现有同步事务。

客户端 owner-wise merge 依赖以下后端硬约束：

```text
任何客户端可见的 owner 字段变化
  -> 对应 owner revision 必须严格前进
```

该约束覆盖正常 writer、undo、delete，也覆盖 projection repair、rebuild 和 drift correction。修复已经对客户端可见的 owner 字段时，
必须推进对应 revision；不能只改 count 而保留原 revision，否则客户端会把同 revision 的不同字段判为 contract violation，反复
标 stale 仍无法收敛。若未来 repair 不能满足该约束，必须另立显式 repair version 合同，不能绕过 merge 规则。

### 5.4 读取合同保持分离

读取 API 继续分开：

```text
articleStats(paths)          public / cacheable / SSR-safe
articleViewerStates(paths)   private / ViewTracker-owned / viewer-scoped / no-store
articleInteractionStates(paths)
                            private / Interactions-owned / viewer-scoped / no-store
commentViewerStates(...)    private / Comments-owned / viewer-scoped / no-store
```

不能为了让 hook 调用更短，把 public stats 和多个 private state 合成一个可被 CDN/SSR 共享的 query。mutation 同时返回公开统计和
某个 owner 的私有状态，不代表它们具有相同缓存边界。

`ViewerArticleState` 在 direct cutover 中删除 `viewerHasUpvoted`，不保留恒 `null` 字段。`articleViewerStates` 继续执行现有
公开 path 解析与 Gate admission；只移除会合并 Interaction state 的 `CMS.Articles.Response` hydration，改由 ViewTracker-owned
batch reader 生成 `viewerHasViewed`。GraphQL schema、前端 operation 与 generated types 在同一发布边界更新；
upvote/collect/emotion 只从 `articleInteractionStates` 读取。

## 6. 前端改造

### 6.1 保留的页面 API

```typescript
const article = useArticleState(articleQuery.data)
const articles = useArticleStates(listQuery.data?.entries)
```

返回结构继续明确：

```typescript
type TArticleState<T> = {
  content: T
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}
```

调用方不接触 path key、Map、query key、revision merge 或 receipt。

### 6.2 删除 entity cache 和 disabled observers

目标只保留页面实际读取的 query：

```text
Detail                    单篇 stats query
Posts/Changelogs/Kanban   按 community/thread 分组的 stats batch query
ViewerArticleState        按 viewer + paths 的 ViewTracker private batch query
ArticleInteractionState   按 viewer + paths 的 Interactions private batch query
```

删除：

- `articleQueryKeys.stats(...)` 作为 batch response 和 mutation 的中转 entity；
- batch response seed 单篇 entity 的逻辑；
- `useArticleStates` 中 N 个 `enabled: false` entity queries；
- `canonical entity > batch snapshot` 的双层优先级；
- 为保持 entity/batch 一致而存在的常规 invalidation/refetch。

`articleQueryKeys.stats(path)` 不删除：它继续作为 Detail/Drawer 的真实单篇 query key。删除的是列表 batch 对它的 seed，以及列表为了
订阅它而创建的 disabled observer。单篇 detail query 和 batch query 仍是不同 transport/cache entry，但它们都是实际消费者，
不再引入第三种“单篇 entity 中转层”。

两个 Article private query 首期继续按 owner 分开。`ViewerArticleState.viewerHasUpvoted` 与
`ArticleInteractionState.viewerHasUpvoted` 当前重复；direct cutover 后前者只保留 `viewerHasViewed`，interaction flags 只由
`ArticleInteractionState` 提供。`useArticleState/useArticleStates` 在 selector 层组合二者，不向页面暴露两套 query。

receipt reconcile 直接复用页面已经请求的完整 `articleInteractionStates(paths)` 数据，不建立 receipt subset query 或第二个 cache key。
普通 mutation 成功响应返回 `interactionState` 时直接 patch 主 query；reload/mount 由同一主 query 收敛并清理 receipt。

### 6.3 统一应用 mutation 结果

内部提供两个职责明确的函数；名称可以按现有 query 模块风格最终确定，不对页面暴露：

```typescript
articleStatsCache.apply(queryClient, articleStats)
cacheViewerArticleState(queryClient, viewerState)
cacheArticleInteractionState(queryClient, interactionState)
```

`articleStatsCache.apply`：

1. 根据 `community + thread + innerId` 找到所有包含该 Article 的 stats query；
2. 对单篇 query 直接合并；
3. 对 batch query 只替换数组中的目标元素；
4. 按 owner revision 合并，任何 owner 都不能被旧响应回滚；
5. 不改变数组顺序，不制造不存在的 Article；
6. mutation patch 不延长 detail 或 batch 的网络新鲜期，原 query 仍按自己的 stale/refetch 策略运行。

第 2、3 步必须对每个已存在 query 使用 functional `setQueryData`，禁止先 `getQueryData` 再写回：

```typescript
queryClient.setQueryData(query.queryKey, (current) => mergeArticleStats(current, incoming), {
  updatedAt: query.state.dataUpdatedAt,
})
```

保留原 `dataUpdatedAt` 是硬约束。TanStack Query 默认会在 `setQueryData` 时刷新 `dataUpdatedAt`；不显式传回旧值会让 mutation
错误地重置 ArticleStats 的 600 秒 `staleTime`。没有现存 detail/batch query 时不创建不可见页面的 cache。

private state apply：

1. 后端匿名请求不返回可缓存的 private state；前端不得为 view mutation 写 anonymous private query，ViewAck 是唯一匿名确认；
2. `ViewerArticleState` 只更新 view-owned query；
3. `ArticleInteractionState` 只更新 interaction-owned query；
4. comment private state 只更新对应 Article/comment query；
5. 更新所有包含目标 path 的对应 owner batch；
6. 使用 functional `setQueryData`，不得覆盖同一 query 中其他 path；
7. 不写入 public ArticleStats、SSR payload 或公共 HTML；
8. 登出、换账号或匿名 session 轮换后不能复用旧 private state。

所有相关 mutation 成功后走同一入口：

```typescript
applyArticleWriteResult(queryClient, result)
  -> applyArticleStats(queryClient, result.articleStats)
  -> apply owner-specific private state（若 result 携带）
  -> apply operation-specific comment/list result
  -> maintain confirmed-write ack/receipt when needed
```

这里的 `applyArticleWriteResult` 只是内部路由函数，不引入新的 store、index 或页面可见概念。

Mirror 只更新 mutation 返回 locator 对应的 query：

```text
mutation: community-a / POST / 10
  -> patch community-a / POST / 10 的 detail/batch
  -> 不 fan-out 到共享同一物理 Article 的 community-b mirror
```

其他公开 locator 在下一次后端读取时自然收敛。前端不维护 physical Article 到全部 mirror locator 的反向映射。

### 6.4 按 owner 合并

目标 merge：

```typescript
views owner:
  incoming.viewsRevision > current.viewsRevision
    -> 接受 views + viewsRevision

interaction owner:
  incoming.interactionRevision > current.interactionRevision
    -> 接受 upvotesCount + collectsCount + emotionCounts + interactionRevision

comments owner:
  incoming.commentsRevision > current.commentsRevision
    -> 接受 commentsCount + commentsParticipantsCount + commentsRevision

任一 owner revision == current
  -> owner 字段必须完全相同
  -> 相同则保留 current
  -> 不同则保留 current、记录 contract violation 并将 query 标 stale

任一 owner revision < current
  -> 只拒绝该 owner，其他 owner 继续独立比较
```

示例：

```text
current    viewsRev=11, interactionRev=20, views=100, upvotes=8
incoming   viewsRev=12, interactionRev=19, views=101, upvotes=7

merged     viewsRev=12, interactionRev=20, views=101, upvotes=8
```

`snapshotAt` 不能代替 revision 决定字段新旧。合并后的对象可能来自多个合法响应，因此：

- owner 字段顺序只看对应 revision；
- 首次初始化时接受完整 incoming；已有数据时，incoming 没有任何 owner revision 前进则保留 current `snapshotAt`；
- incoming 至少有一个 owner revision 前进时，`snapshotAt = max(current.snapshotAt, incoming.snapshotAt)`；
- 服务端 response 的 `snapshotAt` 仍是持久化投影行时间；前端合成对象的 `snapshotAt` 只用于 stale/refetch 提示和诊断，
  不再证明整个客户端对象曾作为一行完整快照存在；
- mutation patch 不应把 batch query 当成刚完成一次完整网络刷新；
- 下一次完整 query response 仍按三个 owner revision 合并，不能整体覆盖。

### 6.5 ViewAck 与 interaction receipt

ViewAck 保留现有职责：`tracked=true` 后确认当前 tab/session 已完成有效 tracking，直到服务端 `ViewerArticleState` 收敛；
`tracked=false` 不写 Ack。

Interaction receipt 继续保护 confirmed write 和 command replay 期间的 interaction-owned private state。mutation 返回
`ArticleInteractionState` 后，它不再负责公开 count 的日常同步。replay 只恢复原 command outcome，随后重新读取当前权威
ArticleStats/private state；返回值可新不可旧，不保存或恢复第一次响应时的完整 stats 快照。

Comment feed receipt 遵守同一边界。正常 create/update/delete mutation 已直接 patch 完整 ArticleStats；
`useCommentReceiptReconcile` 只恢复 comment feed projection、comment-owned private state 并清理 receipt，删除当前无条件调用的
`QueryInvalidation.article.stats(...)`。Receipt 不保证刷新后公共 comment count 立即 read-your-writes，公共 count 按
ArticleStats query 的正常 freshness 收敛。

若未来产品要求 receipt reconcile 同时恢复刷新后的公共 count，reconcile response 必须返回完整 `ArticleStats` 并走 owner-wise
patch；不能重新加入无条件 stats invalidation/refetch，也不能根据 receipt 中的 revision 本地猜 count。

### 6.6 invalidation 的新边界

成功且返回完整 ArticleStats/owner private state 的常规操作：

```text
直接 patch stats/viewer query
不立即 refetch 同一份 stats
```

仍需要 invalidation 的情况：

- mutation 改变 Article 是否应出现在列表中；
- 排序依据改变，且当前页需要重新排序/重新分页；
- 一次服务端操作影响的 Article 集合无法完整返回；
- 未来会改变 ArticleStats 的 moderation、bulk operation 或外部副作用没有逐 Article committed result；
- 响应字段缺失或 revision 合同被违反，此时 fail loud 并 refetch，而不是静默猜值。

### 6.7 SSR 与 hydration

删除 batch -> entity seed 后，SSR loader 必须预取页面真正消费的 query key：

```text
Detail / Drawer SSR
  -> prefetch articleQueryKeys.stats(path)

Posts / Changelogs / Kanban SSR
  -> prefetch articleQueryKeys.statsBatch(paths)
```

两个 public query 都保留 `meta: { hydration: 'public' }`，继续进入 QueryClient dehydrate allowlist。`ViewerArticleState`、
`ArticleInteractionState` 和 comment private state 不得标记为 public，也不得出现在 dehydrated payload。

hydration 后的任何 ArticleStats response 与 mutation response 一样经过 owner-wise merge。服务端预取不能依赖
`cacheArticleStatsEntities` 的副作用让另一个 key 获得数据；Detail 与 List 各自必须使用和客户端 hook 完全一致的 key。

## 7. 前后对比

| 维度                               | 当前                                                         | 目标                                                                  |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| View 写后返回                      | 完整 stats + view-owned state                                | 保持，不读取 Interaction private state                                |
| Interaction 写后返回               | content type + viewer flags + outcome + interaction revision | 专用 payload：完整 stats + interaction state + outcome                |
| Collect 写后返回                   | CollectFolder，无 commandId/receipt                          | folder + 完整 stats + interaction state，并纳入 Command recovery      |
| Comment 写后返回                   | create/update/delete 结果，父统计靠 invalidation             | operation result + 完整父 Article stats；不伪造 Article private state |
| Stats cache                        | batch + entity 两份                                          | 只保留真实 detail/batch query                                         |
| 列表响应单篇更新                   | N 个 disabled entity observers                               | 直接 patch 所有包含该 path 的 query                                   |
| 数据收敛                           | 部分直接写，部分 invalidate/refetch                          | 所有成功 mutation 走统一 apply                                        |
| 并发响应                           | 任一 revision 回退则整体拒绝                                 | 三个 owner 分别比较并合并                                             |
| Private state                      | 两个 Article query + receipt reconcile                       | 按 owner 保留 query，由 hook 组合并统一 patch                         |
| Receipt/Ack                        | 同时补偿缓存收敛                                             | 只保护 confirmed write/private state                                  |
| Gate/Lifecycle                     | 当前机制                                                     | 不变                                                                  |
| Interaction/ViewTracker 事实与事务 | 当前机制                                                     | 不变                                                                  |

## 8. 并发与失败语义

### 8.1 前端乱序响应

```text
T1 view 写入完成        viewsRevision=12
T2 upvote 写入完成      interactionRevision=21

网络先返回 T2，再返回携带旧 interaction 快照的 T1
```

owner merge 必须保留 T2 的 interaction 字段，同时接收 T1 的新 views 字段。

同一个 interaction mutation 的 public ArticleStats 与 private InteractionState 也可能因两次 post-commit 读取之间发生并发写入而携带
不同的 `interactionRevision`。这不是 mutation failure：两个 cache 分别按自己的 revision 合并，confirmed-write receipt 使用 private
state 的 revision。

所有 query patch 必须在 functional `setQueryData(current => ...)` 回调内完成 revision 比较与合并，避免两个响应同时读取旧值后
互相覆盖。

### 8.2 mutation 成功但响应丢失

- View 由服务端 dedupe window 保证 retry 不重复计数；
- interaction/comment 继续使用现有 command/receipt 恢复语义，collect 在本次 direct cutover 中补齐 `commandId`；
- retry/replay 恢复原 outcome，并重新读取当前权威 ArticleStats/private state 后走相同 apply 入口；
- 前端不得在超时后直接本地永久 `+1`。

### 8.3 projection 同步失败

各领域继续遵守现有事务：事实写入和对应 ArticleStats owner 更新必须一起成功或一起回滚。GraphQL 不得返回“操作成功但 stats
未知”的半成功结果。

### 8.4 stale public response

SSR/CDN 或较慢 query 可能晚于 mutation 返回。任何进入前端的 `ArticleStats` 都必须经过相同 owner merge；旧 public response
不能回滚刚确认的 mutation。

## 9. 已完成实施切片

按 hard cut 实施，不保留长期双协议：

1. 后端建立专用 mutation payload，复用完整 `ArticleStats` 与各 owner private-state fragments；
2. 调整 `ViewerArticleState/articleViewerStates` 为 view-only，删除 `viewerHasUpvoted`，绕开合并 Interaction state 的 response
   hydration，并重新生成前端 GraphQL 类型；
3. upvote/undo 与 emotion/undo 返回 `commandId + articleStats + interactionState + reactionOutcome`；
4. collect/undo collect 返回 `commandId + folder + articleStats + interactionState`，接入 MutationLock、Command receipt 与 replay；
5. comment create/update/delete 保留 `commandId` 并返回受影响 Article 的完整 stats；update 即使不改变 count，也必须返回已经
   前进的 `commentsRevision`；删除 `useCommentReceiptReconcile` 中无条件 stats invalidation，reconcile 只恢复 comment/private
   projection；未来会改变 stats 的 moderation/bulk operation 再按同一合同接入；
6. 新增前端 collect/undo collect、emotion/undo emotion operations，并与 upvote/comment 一起接入统一 apply；
7. 前端实现 owner-wise `ArticleStats` merge，并让 query/mutation/SSR hydration response 共用；
8. 前端实现 stats 与 owner-specific private query fan-out patch，强制 functional update 并保留 `dataUpdatedAt`；
9. 保留 `articleQueryKeys.stats(path)` 作为真实 Detail query，删除 batch -> entity seed 和 disabled entity observers；
10. 简化 `useArticleState/useArticleStates`，保留两个 Article private query 并由共享 effect 使用主 query 清理 receipt；
11. 调整 SSR loader 直接 prefetch Detail/Batch 的真实 key，并验证 public hydration allowlist；
12. 审计正常 writer、repair、rebuild 和 drift correction，保证 owner 字段变化必然推进对应 revision；
13. 删除已经不再需要的常规 stats invalidation/refetch，保留列表成员/排序等真正 invalidation；
14. 补齐并发乱序、Mirror、跨 surface、SSR/hydration 和匿名/登录 viewer 测试；
15. 更新本文明确取代的 ArticleStats/query-invalidation 条款状态。

不需要数据库 migration，也不改变 Cloudflare backlog。GraphQL 是 direct cutover：后端 schema、前端 operation、generated types 和
消费方在同一发布边界切换，不保留旧字段 fallback。

## 10. 测试合同

### 10.1 Backend

- view 返回写后完整 ArticleStats 与 view-owned `ViewerArticleState`，不额外读取 Interaction private projection；
- `ViewerArticleState` schema 不再暴露 `viewerHasUpvoted`，`articleViewerStates` 不调用或依赖 Interactions reader；
- `trackArticleView.viewerState` 与 `articleViewerStates` 共用同一个 view-only GraphQL type；
- upvote/undo、emotion/undo 返回 non-null `commandId`、写后完整 ArticleStats、`ArticleInteractionState` 与 outcome；
- collect/undo 返回 non-null `commandId`、folder、完整 ArticleStats 与 `ArticleInteractionState`，并恢复 ambiguous commit；
- comment create/update/delete 保留 non-null `commandId` 并返回完整 ArticleStats；update 即使 count 不变也返回前进后的
  `commentsRevision`；
- 若未来 moderation/bulk operation 改变 ArticleStats，则返回全部受影响 Article，或显式走 documented invalidation；
- Gate 拒绝、Lifecycle 不允许、scope 不足时不返回伪成功状态；
- projection 更新失败时事实写入一起回滚；
- command replay 恢复原 outcome 后重新读取当前权威状态，允许更新但不允许早于已提交 command；
- 正常 writer、undo、delete、repair、rebuild 和 drift correction 中，任何 owner 字段变化都伴随对应 revision 严格前进；
- anonymous、account、service 和 delegation 沿用当前 RequestActor/authorization 结果；
- `ViewerArticleState`、`ArticleInteractionState` 和 comment private state 不出现在 public read query type 或 hydration allowlist。

### 10.2 Frontend

- `useArticleStates` 不再创建 per-article disabled query observer；
- 一个列表只按 community/thread 创建必要的 stats batches；
- `articleQueryKeys.stats(path)` 继续作为 Detail/Drawer 的真实 query；
- view 成功后 Detail、Posts、Changelogs、Kanban 中已挂载的同一 Article 立即显示新 views；
- upvote、collect、emotion 和 comment 成功后所有已挂载 surface 立即显示新 count；
- updateComment 直接应用返回的完整 ArticleStats；即使 comments count 不变，也接受前进后的 `commentsRevision`，不再依赖
  stats invalidation/refetch；
- comment feed receipt reconcile 只恢复 comment/private projection 并清理 receipt，不触发 ArticleStats invalidation/refetch；
- 新增的 collect/undo collect、emotion/undo emotion 前端 operations 应用完整返回值；
- GraphQL generated types 中 `ViewerArticleState` 不再包含 `viewerHasUpvoted`，该字段只存在于 `ArticleInteractionState`；
- Reaction、Collect 与 Comment lifecycle 使用 payload 返回的同一个 `commandId` 关联 pending、receipt 和 replay；
- view/interaction/comment private state 只更新当前 viewer 的对应 owner cache；
- `tracked=false` 不写 ViewAck、不改变 views；
- 同 path 的并发 view + interaction 响应任意顺序返回都不回滚任一 owner；
- 相同 owner revision 携带不同 owner 字段时保留 current、记录 telemetry 并标记 query stale；
- stats/private query patch 使用 functional update，并保留已有 query 的 `dataUpdatedAt`；
- 旧 SSR/batch response 不能覆盖更新后的 owner；
- mutation patch 不改变列表顺序或凭空插入 Article；
- mutation 只更新返回 locator；不把一个 community 的结果 fan-out 到其他 Mirror locator；
- 登出/换账号后不泄漏上一 viewer 的状态；
- 网络失败、ambiguous commit 和 command replay 继续满足现有 receipt 合同。

### 10.3 SSR / hydration

- Detail SSR 直接 prefetch/dehydrate `articleQueryKeys.stats(path)`；
- List SSR 直接 prefetch/dehydrate `articleQueryKeys.statsBatch(paths)`；
- 删除 batch -> entity seed 后，首屏不出现空 stats 再闪烁；
- public stats 仍进入 hydration allowlist，所有 private state 均不进入；
- hydration 后的旧 response 经过 owner-wise merge，不能回滚 mutation 已确认字段；
- mutation patch 不刷新 detail/batch 的 `dataUpdatedAt`。

### 10.4 性能与观测

- observer 数量与 stats batch 数量相关，不再与 Article 数量一比一增加；
- 一次 mutation patch 只扫描 ArticleStats 与对应 owner private-state query，不扫描整个无关 Query cache；
- 开发环境对 revision 回退、缺字段和非法 locator 输出可定位 telemetry；
- 大列表测试覆盖多 community/thread 分组与多 batch 更新。

## 11. 完成定义

- 所有会改变 Article headline stats 的 mutation 返回完整写后 `ArticleStats`；
- mutation 只返回本次操作影响的 owner-specific private state；View 不读取 Interactions，Comment 不伪造 Article private state；
- `ViewerArticleState/articleViewerStates` 只拥有 `viewerHasViewed`，`viewerHasUpvoted` 已从该 GraphQL type 删除；
- 所有 command-backed 专用 payload 保留 non-null `commandId`；Collect 接入明确的 Command recovery；
- 后端 Gate、Lifecycle、Interactions、Comments 和 ViewTracker 的事实/事务边界没有被绕过或合并；
- 所有 runtime/repair/rebuild owner 字段变化都会推进对应 revision；
- 前端保留真实 Detail key，但没有 batch -> entity seed、stats 中转 cache 或 disabled entity observers；
- `useArticleState/useArticleStates` 是 Detail 与列表唯一的 Article 状态组合入口；
- mutation 与 query response 共用 owner-wise revision merge；
- stats patch 使用 functional update、保留 `dataUpdatedAt`，Mirror 只更新返回 locator；
- 正常写后同步不依赖 stats refetch；
- SSR Detail/Batch 直接 hydrate 真实 consumer key，private state 不进入 hydration；
- public ArticleStats 与各 owner private state 的缓存边界保持分离；
- ViewAck/interaction receipt 只承担确认写入与私有状态保护，不承担公开 count 同步；
- 并发乱序、缓存滞后、匿名/登录 viewer 和四种 surface 均有回归测试。
