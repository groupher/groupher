# Optimistic Read Your Writes：跨刷新写入收敛

> 状态：Article upvote、Comment reaction 与 Comment feed 已有有界 TTL receipt、revision guard 和 private
> reconcile；Article/Comment reaction、Comment entity lifecycle 的服务端 commandId/revision/幂等字段
> 已接通。本文承接
> [Optimistic Operation](./optimistic-operation.md) 的 `reconciled` transition，补充
> [Query Sync Cache](./query-sync-cache.md) 当前允许“刷新后公共 count 短暂旧值”的一致性协议；
> 当前实现已接通该协议的 Article/Comment receipt、revision guard 与 private reconcile；View 已接通稳定
> event identity、accepted receipt 与 worker `views_revision`。跨 tab、浏览器重启和实时 purge 仍属于 R4。
>
> 相关边界：
>
> - [Optimistic Operation](./optimistic-operation.md)：刷新前的 identity、queueKey、inverse、reconcile 与 confirmed handoff；
> - [urql 迁移到 TanStack Query](../../architecture/urql-to-tanstack-query.md)：当前 tab 的 optimistic patch、rollback 与 server reconcile；
> - [Query / Store 边界收口](../../architecture/query-store-boundary.md)：TanStack Query 是 confirmed server state 的唯一客户端 owner；
> - [Interaction V1](../../feature/interaction/v1.md)：reaction 同步 projection、view durable event 与幂等语义；
> - [Interaction V4](../../feature/interaction/v4.md)：Interaction facade、事务和 ReadState owner。

> 公共 Article 的 `views`、`upvotesCount`、`commentsCount` 不再由本文的 Article entity 或
> `articleInteractionRevision` 作为读取 owner；统一以
> [ArticleStats 与公共页面缓存](../../architecture/article-stats-and-public-cache.md) 的完整
> `snapshotAt`/`viewsRevision` 快照收敛。本文剩余的 receipt/reconcile 机制只描述 viewer relation、Comment surface
> 和非公开 reaction projection；`articleInteractionRevision` 若仍保留，只能服务明确的 management/non-public surface。

## 1. 问题

本文不重新定义 mutation 内存期的 apply/rollback。operation 只有达到
[Optimistic Operation](./optimistic-operation.md) 定义的 `reconciled` transition 后，才有资格
生成 confirmed write receipt。

当前 optimistic mutation 能保证同一浏览器内存会话中的即时反馈：

```text
用户操作
  -> optimistic patch TanStack Query
  -> Phoenix mutation
  -> mutation response 覆盖 confirmed count / viewer state
```

页面刷新后，浏览器 QueryClient 会重新创建。SSR/loader 可能从 Cloudflare public cache 得到早于
本次 mutation 的公开快照，因此当前用户会看到已经确认成功的操作短暂倒退：

```text
点赞前                 count=10  viewerHasUpvoted=false
mutation response      count=11  viewerHasUpvoted=true
立即刷新 public CDN    count=10
private viewer query             viewerHasUpvoted=true
```

这里有两个不同问题：

1. 内存 optimistic/confirmed patch 不跨刷新保存；
2. 新返回的公开快照没有可比较的 interaction projection revision，客户端无法判断它是否早于
   已确认 mutation。

只持久化 TanStack Query cache 不能解决第二个问题。SSR hydration 或后台 refetch 仍可能用旧公开
响应覆盖本地值，而且客户端无法区分“旧快照”与“后来真的变回该值”。

## 2. 目标与非目标

### 2.1 目标

- 当前 viewer 的 mutation 已经由 Phoenix 确认成功后，刷新并完成 hydration 后不回退该 viewer
  已观察到的结果；
- public aggregate 与 viewer-private relation 保持不同 owner 和 revision 语义；
- 公开 CDN 继续服务匿名和共享响应，不为每次高频 interaction 立即 purge；
- 只持久化有界的 confirmed write receipt，不持久化整个 Query cache；
- stale public response、private reconcile 和后续 public 收敛具有确定的 merge/清理规则；
- 保持 Post、Blog、Changelog、Doc 和 Comment 的 canonical ref，不向前端暴露数据库 ID。

### 2.2 非目标

- 不引入 TanStack DB；
- 不建立通用 command bus、mutation registry 或 Linear 式全局 Sync Engine；
- 不提供完整离线写入、任意 mutation 重放或长期 operation history；
- 不保证其他用户立即看到高频 interaction；
- 不把 `Article.version`、`ArticleLifecycle.version`、Doc revision 用作 interaction revision；
- 不让 viewer query 长期拥有 public aggregate；
- 不把 confirmed Query data 镜像进 Valtio。

## 3. 一致性分层

不同 interaction 不能使用同一种跨刷新保证：

| 操作                                     | 后端写入                                            | 当前 viewer 跨刷新目标                           | public 传播                                                                 |
| ---------------------------------------- | --------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- |
| upvote / collect / emotion               | fact、bitmap、count、latest snapshot 同事务同步提交 | viewer flag 和已确认 public aggregate 不倒退     | TTL/SWR，必要时后续 coalesced purge                                         |
| create / reply / update / delete comment | Comment 与 Article comments aggregate 同步提交      | 已确认实体不消失，已删除实体不复活，count 不倒退 | 当前 cache effect 保持 immediate，但不能把 purge 当作 read-your-writes 证明 |
| report                                   | fact 与 viewer membership 同步提交                  | viewer flag 不倒退                               | public moderation 结果按独立权限/内容策略传播                               |
| view                                     | durable event 先提交，worker 异步 projection        | event 不重复；登录 viewer 可显示已浏览           | `views` 允许最终一致，不盲目本地 `+1`                                       |

本文保证的是当前 viewer 的 causal/read-your-writes consistency，不是所有用户的线性一致性。

### 3.1 SSR 首帧边界

receipt 存在浏览器 `sessionStorage`，服务端渲染共享 public HTML 时无法也不应读取它。因此本文首期
保证的是 hydration 后的 render model，不承诺原始 SSR HTML 第一帧已经包含当前 viewer 的写入。

首期明确接受“旧 public SSR 首帧 -> hydration 后 receipt overlay”的短窗口，并记录该窗口时长和
可见 flash。若产品验证不可接受，再增加 R1b：在 hydration 前只读取无敏感信息的 receipt existence
marker，让受影响 count/relation 暂时显示中性 skeleton，直到领域 merge 完成。不得把 viewer data
注入共享 SSR/dehydration，也不把旧值伪装成已收敛值。

## 4. 三类状态必须分离

### 4.1 Public projection

公开 Query/CDN 拥有可共享字段：

```text
upvotesCount
collectsCount
emotion.count
commentsCount
public comment entity/list
views
latest users
```

每个需要跨刷新比较的读模型返回自己的 projection revision。revision 必须表示该响应中 public
projection 的水位，不得借用内容或 Lifecycle 版本。

### 4.2 Viewer relation

private、`no-store` viewer query 拥有：

```text
viewerHasUpvoted
viewerHasCollected
viewerHasReacted
viewerHasReported
viewerHasViewed
```

这些字段与具体 viewer 相关，不属于 public `ArticleStats.snapshotAt`。mutation 可以在同一事务结果中
同时返回 public aggregate 和 viewer relation，但两者的读取、缓存与版本语义仍然分离。

默认情况下 viewer relation 不需要单独 revision。若未来必须处理同一 viewer 多设备乱序写入，再按
`viewer + artiment + relation` 引入独立 `viewerRelationRevision` 或 `lastOperationRef`，不能复用
public revision。

### 4.3 Confirmed write receipt

write receipt 是当前客户端对“Phoenix 已经确认此写入”的短期证据，不是第二份长期 confirmed
server-state cache。它只在公开 projection 尚未追上时参与 render overlay 和按需 reconcile。

首期存储在 `sessionStorage`：

- 覆盖同一 tab 的立即刷新；
- tab 关闭后自然释放；
- 按 `accountRef` 隔离；
- logout/account switch 时清除；
- 使用 schema version、与 public CDN 最长传播窗口对齐的 TTL 和容量上限做有界清理。

当前 public HTML cache 合同由
[ArticleStats.CachePolicy](../../architecture/article-stats-and-public-cache.md) 统一提供：默认
`s-maxage=600, stale-while-revalidate=300`。confirmed receipt TTL 不是任意的 30 秒经验值，而是共享常量计算出的
`600 + 300 + 60 safety margin = 960` 秒，并满足：

```text
confirmed receipt TTL >= public fresh window + public stale window + reconcile margin
```

Community cache header 与 receipt TTL 共同消费 `ArticleStats.CachePolicy` 的输出；前端常量若存在只能作为
传输层镜像，不能成为第二个 owner。修改 public cache 窗口时必须同步改变这一合同。private reconcile 或 public
snapshot/revision 追上后仍会提前清理 receipt；960 秒是
故障/传播迟滞时的最大遮蔽窗口，不是固定展示时长。Comment feed/reaction 每个 Article 各最多保留 100
个 active refs，超出时保留最新 confirmation，避免 sessionStorage 和 reconcile 输入无界增长。

`accountRef` 必须是登录账号的 opaque、immutable public ref。当前实现已从 authenticated session 读取该
字段，并同步用于 viewer Query、toggle 与 receipt key。登录名、数据库 `user_id` 和 device/session 级的
BrowserSession ref 都不能作为替代；账号改 login 后 `accountRef` 必须保持不变。

跨 tab 若成为明确需求，使用现有 Session/BroadcastChannel 边界传播 receipt 通知；不要因此持久化
全部 Query cache。

## 5. 协议

### 5.1 Mutation response

Article reaction domain 是有界 projection，因此 upvote/undo、collect/undo、emotion/undo 的 mutation
response 都必须从同一已提交事务返回完整 public projection 与完整 viewer relation：

```ts
type ArticleReactionProjection = {
  articleStats: {
    snapshotAt: string
    views: number
    viewsRevision: number
    upvotesCount: number
    commentsCount: number
  }
  collectsCount: number
  emotions: Array<{ type: string; count: number; latestUsers: TAccountSummary[] }>
  latestUpvotedUsers: TAccountSummary[]
}

type ArticleViewerRelations = {
  viewerHasUpvoted: boolean
  viewerHasCollected: boolean
  viewerEmotion: string | null
}

type ArticleReactionMutationPayload = {
  commandId: string
  outcome: 'changed' | 'unchanged'
  publicState: ArticleReactionProjection
  viewerState: ArticleViewerRelations
}
```

语义：

- `commandId` 标识一次逻辑 mutation，为服务端幂等、诊断和 receipt 关联提供稳定 identity；
- `articleStats` 是公共 headline count 的完整快照；`snapshotAt`/`viewsRevision` 按 ArticleStats 合同收敛，不能拆成
  Article 字段或 reaction revision；
- `viewerState` 是该 Article 当前 viewer 的完整 reaction relation snapshot；
- response 中两部分来自同一次已提交事务，但不共享 owner。

receipt 必须完全由这次 typed response 构造，不能再从可能较旧的 public Query、viewer Query 或组件
闭包拼接缺失字段。`unchanged` 也返回完整 snapshot 供当前 tab reconcile，但按 §5.2 不写/续 public
receipt。

`commandId` 的生成、retry 复用、identity mismatch 和内存期 phase 由
[Optimistic Operation](./optimistic-operation.md) 定义。本文只消费已经 reconciled 的 typed
result，不把未确认 optimistic operation 写入持久 receipt。

### 5.2 Write receipt

当前存储合同是 `schemaVersion: 2`。storage 层只处理 namespace、版本、TTL、JSON 异常和清理；每个
领域模块拥有自己的 typed shape，不再保留 v1 的 `projectionDomain/operation/publicPatch/viewerPatch`
兼容字段：

```ts
type ArticleUpvoteReceipt = {
  schemaVersion: 2
  commandId: string
  accountRef: string
  entityKey: string
  publicProjection: ArticleReactionProjection
  viewerState: ArticleViewerRelations
  confirmedAt: number
  expiresAt: number
}

type CommentReactionReceipt = {
  schemaVersion: 2
  commandId: string
  accountRef: string
  articleKey: string
  commentRef: string
  publicProjection: CommentReactionProjection
  viewerState: CommentViewerRelations
  confirmedAt: number
  expiresAt: number
}

type CommentFeedEffect = {
  commandId: string
  type: 'create' | 'update' | 'delete'
  commentRef: string
  comment?: TConfirmedComment
  tombstone?: true
  parentId?: string
  publicProjection: {
    commentsRevision?: number
    commentsCount?: number
  }
  confirmedAt: number
  expiresAt: number
}

type CommentFeedSlot = {
  schemaVersion: 2
  accountRef: string
  articleKey: string
  effects: Record<string, CommentFeedEffect> // keyed by commentRef
  expiresAt: number
}
```

Article collect 与 Article emotion 当前不实施；未来接入时必须复用完整 Article reaction projection，
而不是新增稀疏 patch。View acceptance 使用独立的 `schemaVersion: 2` receipt，不参与 reaction/feed
revision 比较。所有领域 receipt 都禁止退回 `Record<string, unknown>` 后在消费端猜字段。

只在 mutation 成功并取得 typed confirmed response 后写 receipt。尚未确认的 optimistic operation
不跨刷新恢复；在服务端幂等和安全 retry 合同完成前，也不把 receipt 当作离线重放队列。

receipt 存储不是 append-only operation history。同一 account、entity 与 projection domain 只有一个
active slot。具体 domain 由 typed storage namespace 决定，不再作为 receipt 字符串字段重复存储。每次 changed reconcile 分配本地单调
`confirmedAt` 并替换旧 slot；若异步回调携带的 projection revision 反而更低，则视为乱序结果拒绝
覆盖。receipt 的 `publicProjection` 是该 domain 在该 revision 的完整 typed projection，而不是只含本次
字段的稀疏 map；`viewerState` 同样是该 domain 的完整 typed viewer relation。因此新 slot 不会丢掉同
domain 较早 operation 已确认的 aggregate/relation。Article upvote
R=42 后 undo R=43，刷新时只允许 R=43 的最终 projection 参与 overlay。

Comment feed 是同一 domain 内可能同时存在多个实体 effect 的例外形状：slot 仍只有一个，但包含按
`commentRef` keyed 的 typed `effects` map；每条 effect 携带其确认时的 aggregate/revision。create/update/delete
分别覆盖同一 ref 的旧 effect，不丢失其他尚未收敛的 confirmed comment。

幂等 response 必须区分 `changed` 与 `unchanged`。`unchanged` 不推进 public revision，也不得新建、
替换 public receipt，或刷新已有 receipt 的 `confirmedAt/expiresAt`；否则重复 upvote 会让 `P < R` 的
overlay 被无意义续期。若已有 changed receipt，继续保留到 public revision 追上或原 TTL 到期。被
toggle 合并吸收的点击没有 execute response；`confirmed === pendingState` 的 no-op 也不发请求，因此都不
写 receipt。

同一 `commandId` 的 transport retry 是另一种情况：服务端幂等层返回首次 execute 已存下的原始
changed/unchanged outcome 与 revision。当前 UI 每次 execute attempt 都生成新的 `commandId`，mutation
也没有 transport retry，因此正常客户端路径不会主动重放同一 ref；客户端对
Receipt 恢复状态的判断曾是防御边界；当前只 reconcile authority Query，不把恢复当成新
confirmation 刷新 `confirmedAt/TTL`。使用新 `commandId` 重复请求一个已经成立的 set-state，才属于
projection 未变化的 `unchanged` 成功。

### 5.3 Public response

相关 public detail/list entry 返回对应 projection revision：

```ts
type ArticlePublicInteraction = {
  articleStats: {
    snapshotAt: string
    views: number
    viewsRevision: number
    upvotesCount: number
    commentsCount: number
  }
  collectsCount: number
  emotions: Array<{ type: string; count: number; latestUsers: TAccountSummary[] }>
  latestUpvotedUsers: TAccountSummary[]
}
```

revision 应为目标读模型中单调递增、可比较的整数。`updated_at` 可以用于诊断，但不直接充当严格
revision：多个同事务/同时间写入、多个 projection row 和时间精度都会削弱比较语义。

### 5.4 按需 private reconcile

仅当当前 viewer 存在未收敛 receipt 时，客户端请求 private、`no-store` reconcile：

```graphql
query ReconcileArticleInteractions($refs: [ArticleRefInput!]!) {
  articleInteractionStates(refs: $refs) {
    community
    thread
    innerId
    articleStats {
      snapshotAt
      views
      viewsRevision
      upvotesCount
      commentsCount
    }
    collectsCount
    emotions {
      type
      count
      latestUsers {
        login
      }
    }
    viewerHasUpvoted
    viewerHasCollected
    viewerEmotion
  }
}
```

Comment receipt 使用单次、最多 100 refs 的私有批量查询；响应为每个请求 ref 保留 entry，已删除的
Comment 显式返回 `comment: null`，Article aggregate 只返回一次：

```graphql
query ReconcileComments($article: ArticleRefInput!, $commentInnerIds: [ID!]!) {
  commentReconcileStates(article: $article, commentInnerIds: $commentInnerIds) {
    article {
      innerId
      commentsCount
      commentsRevision
    }
    entries {
      commentInnerId
      comment {
        ...CommentFields
      }
    }
  }
}
```

客户端先按最新 `confirmedAt` 选择最多 100 个 ref，再稳定排序形成 query key 与 variables；服务端用一条
Article-scoped Comment 查询读取存在的实体并批量 hydrate interaction，不再按 receipt 发 N 条
`oneComment` HTTP 请求。

该响应是一次有界校准输入：

- viewer fields 合并进 canonical viewer Query；
- public aggregate 通过 revision guard 合并进 canonical public Query 或 render projection；
- response 中的 public/viewer 字段与 §5.1 使用同一完整 domain shape，不能由多个不同水位的 Query
  拼成一个 receipt；
- 不创建长期并行的 private-public aggregate cache；
- 没有 receipt 时不发送此请求。

服务器应从 Phoenix 当前 authority/read projection 读取，不经过 public CDN。批量 refs 必须排序、
去重并限制大小，复用现有 viewer batch 的 canonical-ref 规则。

## 6. Merge 规则

### 6.1 Article reaction

设 public response revision 为 `P`，`R` 为同一
同一 account、entity 与 projection domain active slot 中最新 changed confirmation 的 revision：

```text
P < R
  -> public response 早于当前 viewer 已确认写入
  -> render 使用 receipt publicProjection
  -> 保留 receipt 并触发 private reconcile

P >= R
  -> public projection 已到达或越过本次写入水位
  -> 接受 public response
  -> 删除对应 public receipt overlay
```

viewer flag 独立处理：

```text
private viewer query 已返回
  -> 以 private viewer state 为权威

private viewer query 未返回或暂时失败
  -> 以同 accountRef 的 confirmed receipt 临时 overlay
```

不能通过 `public count === confirmed count` 判断收敛，因为其他用户可能在本次 mutation 后继续操作。

revision guard 不只处理整页刷新。它必须收在 public Query 的统一写入口或领域 selector，覆盖 SSR
hydration、同 tab 的 background/focus refetch 和显式 refetch；不能散落到点赞按钮、Comment item 等
组件里，也不能依赖当前 `staleTime` 碰巧减少 refetch。

### 6.2 并发写入

假设：

```text
当前用户确认       count=11 revision=42
其他用户随后点赞   count=12 revision=43
刷新命中旧 CDN     count=10 revision=41
```

receipt 先保证当前页面不退回 10；private reconcile 随后返回当前 authority 的 12/43。不能长期把
receipt 的 11 当作最新全局值。

### 6.3 Comment create/reply

confirmed receipt 保存正式 comment ref、必要的 render fields、`commentsCount` 和
`commentsRevision`。刷新命中较旧 comment feed 时：

- top-level comment 进入当前 collection 顶部的确定性 `confirmed-write` slot；reply 进入对应父 Comment
  replies 顶部的同名 slot，并按正式 `commentRef` 去重；
- receipt active 期间 slot 位置稳定，不因旧 feed refetch 或分页结果跳动；
- 不恢复 `pending:*` identity；
- private reconcile 或 public `commentsRevision >= receipt.commentsRevision` 后删除 slot，实体再按服务端
  排序、筛选和分页归属回到 canonical 位置。

create/reply 已完成 `commandId` 服务端幂等；receipt 仍只是有界 TTL 的 confirmed overlay，不是离线
重放队列。

### 6.4 Comment update/delete

update effect 在旧 public comment 上 overlay server-confirmed fields。delete 不创建独立 per-comment
receipt，而是更新同一 `(accountRef, article entityKey, comment-feed)` slot 中对应 `commentRef` 的 typed
effect：

```ts
type DeleteCommentEffect = CommentFeedEffect & {
  type: 'delete'
  tombstone: true
}

commentFeedSlot.effects[effect.commentRef] = {
  ...effect,
  publicProjection: {
    commentsRevision: response.commentsRevision,
    commentsCount: response.commentsCount,
  },
}
```

若旧 CDN/SSR 再次返回已删除 comment，且 public revision 较旧，当前 viewer 继续隐藏它。这样避免
“删除成功后刷新又复活”。delete mutation response 必须返回同事务确认的 Article
`commentsCount/commentsRevision`，不能只返回 comment id。每条 effect 自己保存
`commandId/commentRef/confirmedAt/expiresAt` 与 typed `publicProjection`；effect 到期或 public feed
收敛后只删除该 map entry，map 为空才删除 slot。

### 6.5 View

view 不复用同步 reaction 的 count merge：

```text
一次逻辑浏览
  -> 客户端生成稳定 viewEventId
  -> 重试/刷新复用同一 ID
  -> 服务端 durable event 幂等接受并记录 accepted receipt
  -> worker 异步推进 views/viewed membership projection + views_revision
```

view receipt 只记录 `viewEventId + articleRef + accepted`：

- `viewerHasViewed` 可以由 pending ViewEvent/private viewer read overlay 为 true；
- `views` 在 projection 完成前允许旧值；
- 不因刷新再次生成 event，也不对公开 `views` 盲目 `+1`；
- event processed 或 viewer private state 确认已浏览后清理 receipt；receipt 到期也会有界清理。

## 7. Revision 边界

首期不创建 workspace/global `syncId`，按真正的 projection owner 划分：

```text
Article public headline    -> ArticleStats.snapshotAt + viewsRevision
Article management reaction projection -> articleInteractionRevision (if retained)
Article comment feed       -> commentsRevision
Comment public reactions   -> commentInteractionRevision
  View worker projection     -> event processed / views_revision
```

revision 的最小要求：

1. 在负责 public projection 的同一事务中推进；
2. mutation response 与随后 authority read 返回同一语义；
3. list/detail 中同一 entity 的 revision 可比较；
4. 客户端只拒绝覆盖对应 projection domain，不跨域比较；
5. revision 前移但 projection 写失败时整个事务回滚；
6. view 的异步 revision 由 worker 成功提交时推进，而不是 event 入队时伪装完成。

### 7.1 首期物理落点与推进规则

R0 必须冻结并迁移以下物理水位，后续 O2b/R1 只能按此实施：

公共 GraphQL/API 不再把 `articleInteractionRevision` 放进 Article 或 ArticleStats；公共 headline 使用
`ArticleStats.snapshotAt`/`viewsRevision`。如果 Article reaction projection 仍需要
`articleInteractionRevision`，它只能出现在明确的 management/non-public API；Comment surface 的
`commentInteractionRevision` 可继续保留，不得与 ArticleStats 或 `commentsRevision` 跨域比较。

| Projection domain                      | 物理落点                                                                | 推进操作                                                                                                                 | 不推进                                       |
| -------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Article management reaction projection | 对应 `<thread>_reaction_infos.interaction_revision :bigint, default: 0` | 仅 management/non-public surface 明确需要时，changed upvote/undo、collect/undo、emotion/undo 与其 projection 同事务 `+1` | unchanged 幂等成功；公共 ArticleStats 不读取 |
| Comment public reactions               | `comment_reaction_infos.interaction_revision :bigint, default: 0`       | changed Comment upvote/emotion/undo；与 reaction projection 同事务 `+1`                                                  | unchanged；普通 Comment feed 变更            |
| Article comment feed                   | Article 主表 `comments_revision :bigint, default: 0`                    | create/reply/update/delete，以及会改变 public feed 的 moderation；与 entity、`comments_count` 同事务 `+1`                | Comment reaction                             |
| View projection                        | Article 对应 read projection 的 `views_revision :bigint, default: 0`    | worker 成功提交 `views`/viewed projection 的同一事务                                                                     | event accepted/enqueued                      |

Article emotion 的事实仍可位于独立 emotion info 表；若保留 `<thread>_reaction_infos` 的
`articleInteractionRevision`，它只作为 management/non-public reaction projection 的 waterline。公共 headline
不读取该 revision，而由 ArticleStats 快照负责。Comment reaction
不推进 `commentsRevision`；public comment entry 单独返回 `commentInteractionRevision`，从而解除 feed
revision 与 reaction revision 的张力。

`viewerHasUpvoted: false -> true` 是特定账号的 viewer relation，不属于
`articleInteractionRevision`。一次 upvote 若同时改变 ArticleStats 的公开 count，使用 ArticleStats 的完整
`snapshotAt` 收敛；不能用 management reaction revision 给 viewer flag 排序。`commentsRevision` 放在 Article 主表，是因为 Comment
lifecycle 本来就原子更新 `comments_count`；它不允许 reaction/emotion 再去触碰 Article 主记录。

所有 revision 都只在 projection 实际 changed 时推进，并和对应 projection update 原子提交；不能在
事务外自增，也不能让 revision 前进而 projection 回滚。

如果后端暂时不能提供可比较 revision，receipt + TTL 只能作为体验优化，不能宣称提供严格
read-your-writes：客户端无法安全判断何时接受新的 public response。

## 8. 客户端 owner 与生命周期

目标读取链：

```text
public Query data
      +
viewer Query data
      +
active confirmed receipts
      -> domain merge/reconcile
      -> render model
```

约束：

- receipt 读取和 merge 集中在 Article/Comment query boundary 或领域 selector，业务按钮组件不直接
  操作 `sessionStorage`；
- canonical Query 继续是 confirmed server state 的唯一长期 owner；
- Article/Comment public Query 写入统一经过 revision guard（TanStack `structuralSharing`）；即使
  receipt 已被消费，较低 revision 的后台 CDN refetch 也不能覆盖较新的 projection；
- receipt overlay 不写入 Valtio；
- SSR 仍只包含 no-user public data，不能把 receipt/viewer 数据写入共享 dehydration；
- account switch/logout 按 accountRef 清除 receipt 和 viewer Query；
- malformed、过期或 schema version 不匹配的 receipt 直接丢弃；每次写 receipt 时顺带 sweep 过期项，
  每次读取/启动/account switch 时再次丢弃，避免只写不读或只读不写形成残留；
- receipt 不持久化 token、权限数据或无必要的完整用户资料；
- comment body 若为跨刷新 overlay 所必需，只保存在 sessionStorage，并受 960 秒 TTL 与每 Article
  100 refs 容量限制。

## 9. 失败与降级

| 场景                           | 行为                                                                      |
| ------------------------------ | ------------------------------------------------------------------------- |
| mutation 未确认/网络结果未知   | 保持现有 rollback/error；不写 confirmed receipt，不自动重放非幂等 create  |
| mutation 成功，写 receipt 失败 | 当前 tab 仍使用 Query confirmed response；刷新后降级为现有最终一致语义    |
| public response revision 较旧  | 保留 overlay，触发 private reconcile                                      |
| private reconcile 失败         | 保留未过期 confirmed receipt；UI 可展示弱“同步中”状态，不把业务显示为失败 |
| public response revision 追上  | 接受 public data，清理 receipt                                            |
| receipt 到期仍未收敛           | 清理本地 receipt，记录可观测事件；不得无限遮蔽服务端结果                  |
| accountRef 不匹配              | 不读取、不合并，并清理不再有效的 receipt                                  |
| public revision 回退           | 拒绝覆盖较新 projection，并记录 cache/projection regression telemetry     |

CDN purge 和业务成功仍是两个状态机。purge 失败不能回滚已经成功的 mutation 或删除 receipt；receipt
正是用来覆盖这一传播窗口。

## 10. 分阶段实施

### Phase R0：冻结协议

R0-R3 已完成；以下保留原执行顺序和验收边界。R4 仍坚持按真实产品证据再评估。

- 先完成 [Optimistic Operation](./optimistic-operation.md) Phase O0、O1、O2a；
- 定义 read-your-writes 产品范围：同 tab refresh，还是同时包含跨 tab/browser restart；
- 冻结 §7.1 的所有 revision domain、物理列、推进事务、changed/unchanged 和 GraphQL fields；
- authenticated session contract 增加 opaque immutable `accountRef`，并冻结 viewer Query、toggle、
  receipt 的迁移规则；禁止继续以可变 login 作为账号 key；
- 冻结 receipt schema、TTL、容量上限、accountRef 清理和 telemetry；当前 TTL 必须覆盖 60 秒 fresh、
  300 秒 stale window 与 60 秒 reconcile margin。

### Phase R1：Article upvote 竖切

- 先由 [Optimistic Operation](./optimistic-operation.md) Phase O2b 按 R0 冻结协议实现 revision；
- 复用 O1/O2a 产出的 stable identity、typed confirmed result 和后端幂等字段；
- upvote/undo mutation 返回 public/viewer 分区 payload 与 revision；
- public article detail/list entry 返回 revision；
- mutation 成功写入 session receipt；
- Article query boundary 实现 revision-aware overlay；
- receipt 存在时执行 private batch reconcile；
- public revision 追上后清理 receipt。

若首帧 flash 的实测不可接受，R1 完成后再单独进入 R1b 的 pre-hydration existence marker + skeleton；
它不是 R1 correctness 的前置条件。

### Phase R2a：Comment reaction

- 先完成 [Optimistic Operation](./optimistic-operation.md) Phase O3；
- Comment reaction mutation/public entry 接入 `commentInteractionRevision`；
- 复用 latest receipt slot、typed patch 与统一 Query write guard，不借用 `commentsRevision`。

### Phase R2b：Comment entity/feed

- 先完成 [Optimistic Operation](./optimistic-operation.md) Phase O4，取得 create/reply 幂等
  `commandId`、`pending:*` identity 与 entity lifecycle；
- create/reply/update/delete 返回正式 entity、`commentsCount` 与 `commentsRevision`；
- 实现确定性 `confirmed-write` slot、typed entity effects 和 delete tombstone；
- 保持服务端决定的排序、筛选和分页归属通过 refetch 收敛。

### Phase R3：View 接线

- 先完成 [Optimistic Operation](./optimistic-operation.md) Phase O5；
- article read 的一次逻辑浏览生成并复用 `viewEventId`；
- detail query 成功后写入同一有界 TTL accepted receipt；logout/account switch 清理 event identity 与 receipt；
- viewer query 确认 `viewerHasViewed` 后清理 receipt，不伪造同步 views count；
- view worker 与 Article 同事务推进 `views_revision`，覆盖 retry、reload、target/viewer identity mismatch 和 worker lag。

### Phase R4：按证据扩展

- 只有跨 tab 成为明确需求时接 BroadcastChannel；
- 只有关闭 tab/浏览器后仍需恢复时评估 IndexedDB；
- 只有其他用户也需要低延迟公共传播时实施真实 `coalesced` cache purge 或 realtime event；
- 只有多个 projection 需要统一水位时重新评估 API-level sync token，仍不直接升级为全局 Sync Engine。

## 11. 验收矩阵

| 场景                                     | 必须结果                                                                                                                                 |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 任一 Article reaction mutation/reconcile | 同一 response 返回完整 public reaction projection 与完整 viewer relation，receipt 不从旧 Query 拼接                                      |
| upvote 成功后立即刷新                    | hydration 后 viewer flag 与 count 不低于该客户端已确认 revision；首期允许 SSR 首帧短暂旧值并测量 flash                                   |
| undo 成功后立即刷新                      | hydration 后不重新显示为已点赞，旧公开 count 不覆盖 confirmed result                                                                     |
| upvote R42 后 undo R43 再刷新            | 同 domain 只应用 R43 receipt，R42 不得重新覆盖                                                                                           |
| unchanged 幂等成功                       | 不推进 revision、不创建/替换 receipt、不续期旧 receipt                                                                                   |
| stale SSR 后 background refetch 仍旧     | receipt overlay 不被较低 revision 覆盖                                                                                                   |
| 其他用户随后操作                         | private reconcile 返回更高 revision/aggregate，不长期固定在 receipt count                                                                |
| create comment 后刷新                    | 正式 comment 不消失，不出现 `pending:*` entity；收敛前保持在确定性 slot，不因旧 refetch 跳位                                             |
| delete comment 后刷新                    | 旧 CDN comment 不复活，Article count 使用 confirmed/reconciled 值                                                                        |
| 同一 Article 连续修改多个 Comment        | 保留一个 comment-feed slot，按 commentRef 合并 typed effects；delete 是 tombstone effect，不创建独立 receipt                             |
| mutation response 丢失                   | 非幂等 create 不自动重发；有 commandId 后服务端可返回原结果                                                                              |
| 后端/transport 以同一 commandId 重放     | 服务端返回原始结果；客户端只做 authority reconcile，不新增或续期 receipt                                                                 |
| logout/account switch                    | 前一 viewer receipt 和 viewer Query 不泄漏到新账号                                                                                       |
| view retry/reload                        | 相同逻辑 view 复用 event ID，只计一次                                                                                                    |
| view worker lag                          | viewer 可显示 pending viewed，公开 views 不虚假递增                                                                                      |
| public revision 回退                     | 较旧响应被 guard，产生可观测告警                                                                                                         |
| Article/Comment reaction 同时加载        | Article headline 只比较 `ArticleStats.snapshotAt/viewsRevision`；Comment reaction 只比较 `commentInteractionRevision`，不得跨 owner 比较 |
| receipt TTL 到期                         | 960 秒上限内仍未收敛则清理并观测，不形成永久第二 owner                                                                                   |

## 12. 决策摘要

若产品继续接受刷新后的短暂公共旧值，保持 [Query Sync Cache](./query-sync-cache.md) 当前协议即可，
不实施本文。

若产品要求当前 viewer 跨刷新 read-your-writes，推荐最小充分方案是：

```text
typed mutation response
  + confirmed write receipt in sessionStorage
  + projection-domain revision
  + receipt-triggered private reconcile
  + revision-aware render overlay
```

不要以全量 TanStack Query persistence、立即 purge 每次 interaction、viewer query 长期拥有 public
aggregate，或固定 TTL 猜测替代 revision-aware merge。
