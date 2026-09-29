# Optimistic Operation：内存期乐观操作合同

> 状态：客户端 O1（Article upvote）与 O3/O4/O5 的通用接线已落地；Article/Comment
> upvote、Comment emotion、Comment create/reply/update/delete 已接通 commandId，reaction
> revision、Comment feed revision、Article/Comment receipt 与 private reconcile 也已落地。完整
> RYW 的 SSR 首帧仍按 §3.1 接受旧 public HTML，hydrate 后由 selector 收敛。
> 本文定义用户操作开始到 Phoenix 确认/拒绝之间的内存期
> optimistic lifecycle。跨刷新后的 confirmed 写入延续由
> [Optimistic Read Your Writes](./optimistic-read-your-writes.md) 定义。
>
> 相关文档：
>
> - [urql 迁移到 TanStack Query](../../architecture/urql-to-tanstack-query.md)：当前 article/comment mutation 的已实现行为；
> - [Query Sync Cache](./query-sync-cache.md)：public Query、viewer Query、SSR/CDN 和 cache effect 边界；
> - [Query / Store 边界收口](../../architecture/query-store-boundary.md)：confirmed owner 与禁止新增通用状态层；
> - [Interaction V4](../../feature/interaction/v4.md)：后端 Interaction facade、事务、changed/unchanged 与 ReadState；
> - [CMS Facade 与实现目录收口](../../architecture/cms-facade-directory.md)：后端 facade API 保持稳定时，
>   Article/Comment command 实现的内部目录归属。

## 1. 为什么需要单独定义 Operation

当前 article/comment mutation 已经分别实现以下能力：

```text
cancel query
  -> snapshot
  -> optimistic patch
  -> GraphQL mutation
  -> server reconcile / rollback
  -> invalidate
```

Article upvote 和 Comment reaction 还实现了串行 mutation lane 与 toggle 连点合并。这些已经构成
乐观操作协议，但 identity、queue、rollback 粒度和状态名称分散在领域 helper/hook 中。

本文的目标不是再包装一层通用 mutation framework，而是冻结所有 optimistic operation 必须回答的
问题：

1. 这次逻辑操作是谁，重试是否仍是同一次操作？
2. 它修改哪个 canonical entity 和哪些 Query projection？
3. 哪些操作与它冲突，必须串行？
4. 客户端可以确定地提前应用什么？
5. 失败时如何只撤销本次修改？
6. 成功时如何用 typed server result 收敛？
7. 哪个 confirmed transition 可以生成跨刷新 write receipt？

## 2. 目标与非目标

### 2.1 目标

- 为 article/comment optimistic mutation 建立一致的 operation identity 和生命周期词汇；
- 保留 TanStack Query 作为 mutation scheduler、observable state 和 confirmed cache owner；
- 以 canonical public ref 定位 entity，不向前端暴露数据库 ID；
- 按实际写入字段定义 `queueKey`，而不是只按 GraphQL operation name 分组；
- 从整片 Query snapshot rollback 收窄到 entity/field 级 inverse patch；
- 统一 public aggregate 与 viewer-private state 的 apply、rollback 和 reconcile 边界；
- 保留 upvote/collect/emotion 等操作的 toggle 连点合并；
- 只有 server-confirmed operation 才向 RYW 阶段生成 receipt。

### 2.2 非目标

- 不替代 `useMutation`、MutationCache 或 TanStack mutation scope；
- 不建立 command bus、全局 mutation registry、通用 transaction engine 或任意操作 DSL；
- 不把 Query data 复制到 Valtio；
- 不实现完整 normalized entity store；
- 不持久化未确认 optimistic operation；
- 不自动重放尚无服务端幂等合同的 create/delete/report；
- 不在客户端重现服务端排序、权限、筛选和业务规则；
- 不承诺跨刷新一致性，跨刷新由 RYW 文档单独负责。

## 3. 两层设计

```text
Layer 1: Optimistic Operation（本文）
  prepared
    -> optimistic applied
    -> executing
    -> confirmed / failed
    -> reconciled / rolled back

Layer 2: Read Your Writes（见关联文档）
  confirmed operation
    -> persist confirmed receipt
    -> reload overlay
    -> private reconcile
    -> public revision catches up
    -> consume receipt
```

Layer 1 可以独立实施并改善并发/rollback 正确性。Layer 2 依赖 Layer 1 的 stable operation identity、
typed confirmed result 和 receipt handoff，不能先于这些合同启用。

## 4. Operation 描述与 execute identity

领域只声明稳定、可读的 operation 描述：

```ts
type TOperationAttempt = {
  operationName: string
  entityKey: string
  queueKey: string
  commandId: string
}
```

完整的泛型 operation 合同见 §6；这里仅说明一次 execute attempt 需要观察的稳定字段。

`commandId` 由通用 executor 在实际 execute attempt 开始时生成，不要求领域 Hook 或组件传入。
当前实现使用 QueryClient 作用域内的 `queueKey` lane 串行，不创建 TanStack MutationCache 记录；因此
`mutationKey`/`scope.id` 不是本阶段公开合同。

### 4.1 `commandId`

- 绑定一次实际 execute attempt，而不是一次原始点击；identity 至少包含
  `(entityKey, operation name, pendingState/payload identity)`；
- 被 toggle 合并吸收的点击不生成 `commandId`；
- 同一次 execute attempt 的安全 retry 和跨刷新 reconcile 必须复用；
- server confirmed state 与最新 `pendingState` 不同而发起的补偿 execute 是新的 attempt，必须生成新的
  `commandId`；
- `confirmed === pendingState` 的 no-op 不发请求，也不生成 receipt；
- 不等同于 TanStack `mutationKey`；
- 不等同于 entity key；
- 服务端启用幂等时，应按 actor、operation name 与 `commandId` 约束；
- 相同 `commandId` 绑定不同 target、actor 或 payload identity 必须拒绝，而不是静默复用。

首期可使用 UUID。create comment 的 optimistic identity 可以派生为
`pending:${commandId}`，但 server-confirmed 后必须替换为正式 comment ref。

### 4.2 `entityKey`

`entityKey` 表示 canonical product entity：

```text
Article: community + thread + innerId
Comment: Article key + comment innerId
```

它用于 patch 所有已加载 Query shape、日志和 receipt 关联。不能使用列表页码、排序 mode 或
React component instance 作为 entity identity。

### 4.3 观察 identity（可选）

`commandId` 是服务端幂等、日志和 receipt 的稳定 identity。当前 executor 不把每次操作注册进
TanStack MutationCache，也不要求 `mutationKey` 或 `scope.id`；运行期观察直接使用 commandId、
operation name 和 queueKey 日志字段。若未来改用 `useMutation`，可以把同一组不可变字段映射到
`mutation.meta`/`mutationKey`，但不得改变本协议的 commandId 与 queueKey 语义。

### 4.4 `queueKey`

`queueKey` 描述“哪些 operation 会触碰同一逻辑状态，因此必须进入同一串行队列”。它不能机械等于
endpoint 名称。默认可由 `name + entityKey` 生成，只有跨 operation 冲突时才显式覆盖。

示例：

| 场景                                                          | 推荐 queueKey                   | 原因                                                                                                    |
| ------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 同一 Article 下的 Comment create/reply/update/delete/reaction | `article:{articleKey}:comments` | delete 同时触碰 Comment 实体与 Article comments aggregate；首期单 lane 保守串行，patch 仍按实体精确执行 |
| 同一 Article 的 upvote/collect/emotion                        | `article:{key}:reaction`        | 与后端同 Article `MutationLock` 和完整 reaction projection reconcile 对齐                               |
| 同一 Article create/reply/delete 对 commentsCount             | `article:{key}:comments`        | 都会修改 Article comment aggregate；与 Comment reaction/update 共用同一 lane                            |
| Comment delete 与该 Comment reaction/update                   | `article:{articleKey}:comments` | 删除与继续修改同一 entity，同时需要保护 Article comments aggregate                                      |
| 不同 Article 的 reaction                                      | 不共享                          | 不应因全局 snapshot 被迫串行                                                                            |

TanStack mutation scope 当前一次只能表达一个串行 lane。首期不设计多锁协议：跨 projection 的安全性
由精确 patch/inverse、领域约束和必要的单一主 `queueKey` 保证，避免多锁死锁。

Article 的 upvote、collect、emotion 共享 `article:{key}:reaction` 是 deliberate 的保守选择：三者会由
同一后端锁保护，并共同接收完整 reaction domain projection。共享 lane 只约束 execute 顺序，不合并
不同 operation 的点击；每种 toggle 仍按 `accountRef + entityKey + operation name` 维护独立 buffer，
upvote 的连续点击不会改写 collect/emotion 的 `pendingState`。

## 5. 生命周期

### 5.1 状态

```ts
type TOptimisticOperationPhase =
  'prepared' | 'optimistic' | 'executing' | 'confirmed' | 'reconciled' | 'failed' | 'rolled-back'
```

状态含义：

| Phase         | 含义                                                                 |
| ------------- | -------------------------------------------------------------------- |
| `prepared`    | identity、variables 和领域策略已冻结，尚未修改 Query                 |
| `optimistic`  | 客户端可确定的 patch 已应用，并保存本次 inverse                      |
| `executing`   | 请求已发送或在 QueryClient 的 queueKey lane 中等待执行               |
| `confirmed`   | Phoenix 返回已提交的 typed result                                    |
| `reconciled`  | public/viewer Query 已使用 server result 收敛，可向 RYW 生成 receipt |
| `failed`      | 服务端明确拒绝或 transport 未取得成功响应                            |
| `rolled-back` | 本次 optimistic patch 已安全撤销或由 authority refetch 收敛          |

`confirmed` 与 `reconciled` 分开：业务写入成功后，即使客户端 cache patch、receipt storage 或 CDN
purge 失败，也不能把业务结果重新标为失败。

### 5.2 状态承载

首期不建立全局 operation registry。`executeOptimisticOperation` 在一次调用内持有 immutable
`commandId`、目标、effect plan 和当前 phase；`effects.ts` 以 QueryClient + field/entity +
commandId 保存 ownership marker。失败时 executor 统一执行 guarded rollback/refetch，成功时执行
reconcile 并清理 marker。Action adapter 只把 `isSubmitting/error` 投影给 UI；Toggle 直接暴露
`visibleState/toggle`，不额外制造 loading 状态。

因此 `prepared -> reconciled` 是 executor 的局部生命周期，不依赖 TanStack `mutation.meta` 或可变的
全局 registry；若未来迁移到 `useMutation`，只允许把 immutable identity 复制到 `meta`，不能把 phase
更新变成跨领域共享状态。

除了 mutation 入口，public Query 的后台 refetch 也必须经过同一条实体收敛规则。Article 的 detail/list
不再用 `articleInteractionRevision`、`commentsRevision` 或旧 Article 字段保护公开 headline counts；这些字段
没有公共 ArticleStats 的 ownership。公共计数统一使用完整的 `ArticleStats` snapshot：

- `snapshotAt` 是三个公开 count（`views`、`upvotesCount`、`commentsCount`）的整体新旧顺序；较旧快照整份丢弃，不能只保留其中两个字段。
- `viewsRevision` 是 views projection 的次级单调保护；当 `snapshotAt` 不旧且 `viewsRevision` 不下降时，替换整个
  ArticleStats entity。`snapshotAt` 更新但 `viewsRevision` 反而更低属于混合/非法响应，整份丢弃并记录 telemetry。
- 不为 `upvotesCount` 或 `commentsCount` 另造 revision；它们随较新的 `snapshotAt` 整体收敛，不能各自字段级合并。

`commentsRevision` 只保留给 Comment 自己的 feed/surface（如果该 surface 仍使用它），不参与公共 ArticleStats。
`articleInteractionRevision` 只允许存在于仍有明确消费者的非公开/management surface；若没有这样的消费者，随 Article
公共字段清理一并退役。这样即使请求乱序，乐观 marker 也不会被较旧的公共 ArticleStats response 覆盖；guard 不应散落
在各个按钮组件中。

### 5.3 正常流程

```text
prepare
  -> cancel only affected in-flight queries
  -> compute exact inverse
  -> apply optimistic public/viewer patch
  -> execute through the QueryClient queueKey lane
  -> receive typed confirmed result
  -> reconcile public aggregate
  -> reconcile viewer-private state
  -> invalidate only server-owned ordering/filter projections
  -> emit confirmed receipt input when RYW is enabled
  -> settle
```

### 5.4 失败流程

```text
server rejection / transport error
  -> mark failed
  -> apply guarded inverse patch
  -> invalidate authority query when local rollback cannot be proven safe
  -> surface domain error
  -> settle
```

transport error 不总能证明服务端没有提交。例如服务端 commit 后响应丢失，客户端仍可能进入
`onError`。在没有 `commandId` 幂等查询前，当前 `retry: false` 保持不变；对 create 等非幂等操作
不能自动补发。

## 6. Operation contract

通用层统一生命周期，Article/Comment 通过 typed callback 描述领域差异。callback 随 operation 定义
静态声明，不注册到全局 registry，也不要求组件在调用时临时拼装。

```ts
import type { QueryClient, QueryKey } from '@tanstack/react-query'

type TOperationContext = {
  queryClient: QueryClient
  accountRef: string | null
  commandId: string
}

type TReadOperationContext = Omit<TOperationContext, 'commandId'>

type TQueryTarget = {
  queryKey: readonly unknown[]
  exact?: boolean
}

type TOptimisticChange =
  | {
      type: 'field'
      queryKey: QueryKey
      entityKey: string
      field: string
      before: unknown
      optimistic: unknown
      commandId: string
      rollback: 'restore-if-owned' | 'refetch'
      restore: () => void
    }
  | {
      type: 'pending-entity'
      queryKey: QueryKey
      entityKey: `pending:${string}`
      commandId: string
      rollback: 'remove-if-owned'
      restore: () => void
    }

type TAuthorityRefetch = {
  queryKey: QueryKey
  exact: true
}

type TOptimisticPlan = {
  changes: readonly TOptimisticChange[]
  refetchOnFailure: readonly TAuthorityRefetch[]
}

type TOptimisticOperation<TTarget, TInput, TResult> = {
  name: string
  entityKey: (target: TTarget) => string
  queueKey?: (target: TTarget) => string
  queriesToCancel: (
    context: TOperationContext,
    target: TTarget,
    input: TInput,
  ) => readonly TQueryTarget[]
  apply: (context: TOperationContext, target: TTarget, input: TInput) => TOptimisticPlan
  execute: (context: TOperationContext, target: TTarget, input: TInput) => Promise<TResult>
  reconcile: (context: TOperationContext, target: TTarget, input: TInput, result: TResult) => void
}

type TOptimisticToggleOperation<TTarget, TResult> = TOptimisticOperation<
  TTarget,
  boolean,
  TResult
> & {
  read: (context: TReadOperationContext, target: TTarget) => boolean
}
```

`queriesToCancel` 只声明本 operation 可能 patch 的 Query filter；executor 必须先等待这些 in-flight query
取消完成，再调用 `apply`。`apply` 返回的 `TAuthorityRefetch` 则是已经实际改写过的具体 Query key，
必须使用 `exact: true`：失败时只 refetch 这些 authority owner，不用整个 Article/Comment domain 的
宽泛 invalidate。

`TOptimisticChange` 是 mutation context 中记录的 optimistic change，不是全局 registry。field change
同时保存精确 inverse、operation marker 和 rollback policy；public count 因 ABA 使用 `refetch`，
viewer set-state 使用 `restore-if-owned`。pending entity 只能由创建它的同一 `commandId` 删除。

Action 没有 `read` 合同：create/update/delete/report 的 input 来自 `submit/remove` 调用，executor 不会
猜测当前状态。只有 Toggle 扩展 `read`，用于通用层内部读取 canonical state；进行中的最后意图保存在
`pendingState`，组件渲染值是 `visibleState = pendingState ?? currentState`，每次点击计算 `nextState`。

通用层执行前调用 `entityKey/queueKey` resolver，将 operation definition 解析成 `TOptimisticOperation`；未显式
提供 `queueKey` 时使用 `name + entityKey` 默认值。组件和领域 Hook 不自行构造 descriptor。

通用层执行固定流程：

```text
useOptimisticAction / useOptimisticToggle
  -> 取得 QueryClient 与 accountRef
  -> 生成 commandId
  -> 按 accountRef + queueKey 进入 QueryClient 内部 lane
  -> resolve operation.queriesToCancel
  -> await cancel only affected in-flight queries
  -> operation.apply
  -> operation.execute
       |
       +-> success: operation.reconcile -> operation.receipt?
       |
       +-> failure: rollback recorded changes -> refetch authority queries
```

领域 callback 只返回 typed `TOptimisticPlan`；ownership 判断、rollback/refetch 调度、phase cleanup 和
receipt handoff 都由通用层执行，上层不重复写 `try/catch/onError`。

这里有一项明确的方向调整：早期方案主张先完成首个竖切、出现重复后再抽 executor；当前方案在 O1
直接建立薄的 Action/Toggle 通用层，因为两种调用形状和共同生命周期已经明确。它仍不是任意 mutation
framework：O3 的 Comment reaction 必须原样复用 Toggle 公开合同，O4 的 create/delete 必须原样复用
Action 公开合同；任一阶段若要求修改通用层公开 API，必须暂停实施并重新评审这次提前抽取是否成立。

推荐实现边界：

```text
frontend/core/query/mutation/optimistic/
  types.ts                    # TOptimisticOperation、phase、effect plan
  execute.ts                  # 非 React 的统一 executor，便于独立测试
  effects.ts                  # optimistic field、pending entity、authority refetch
  useOptimisticAction.ts      # React/TanStack adapter，普通 create/update/delete/report
  useOptimisticToggle.ts      # 在 Action 上增加 current read 与 toggle 连点合并

frontend/core/query/mutation/
  article.ts                  # 稳定 public re-export facade
  article/cache.ts            # Article Query selector 与 typed patch
  article/schema.ts           # Article reaction GraphQL documents
  article/upvote.ts           # Article upvote operation 与 reconcile
  comment.ts                  # 稳定 public re-export facade
  comment/cache.ts            # Comment tree/viewer Query selector 与 typed patch
  comment/lifecycle.ts        # create/reply/update/delete Action definitions
  comment/reaction.ts         # upvote/emotion Toggle definitions
  comment/moderation.ts       # report Action definition
  useArticleUpvote.ts         # 只把 target 绑定到 useOptimisticToggle
  use*.ts                     # 其他领域 Hook 与 UI feedback
```

不引入名为 `runtime` 的上层概念。React 场景由 `useOptimisticAction/useOptimisticToggle` 从现有
`QueryClientProvider` 取得 QueryClient；纯 executor 只在内部和测试中显式注入 QueryClient，避免全局
singleton 污染 SSR 和测试。

`accountRef` 是 authenticated session 返回的 opaque、immutable account ref。通用 React adapter 内部读取
它，用于 viewer Query、toggle 与 receipt 隔离；组件和领域 Hook 调用参数均不暴露它。登录名、数据库
`id` 和 device/session ref 都不能作为降级 account key；缺少 `accountRef` 时只按匿名处理，不写 viewer
receipt。

### 6.1 Action 与 Toggle

普通 Action：

```text
create / reply / update / delete / report
  -> useOptimisticAction
```

Toggle：

```text
upvote / collect / emotion
  -> useOptimisticToggle
  -> 内部读取 current state
  -> 内部维护 pendingState，派生 visibleState
  -> 连续 toggle 合并为最终目标
```

组件不传 `currentState`，也不出现 `desired/expect/setDesiredState`。内部状态统一使用
`currentState/pendingState/visibleState/nextState`；领域 Hook 对外只提供业务命名后的渲染值和
`toggle()`（必要时支持 `toggle(value)`）。

### 6.2 Article upvote 领域定义

`articleUpvoteOperation` 是定义在 `frontend/core/query/mutation/article/upvote.ts`、并由
`article.ts` 稳定导出的内部领域合同，不是组件
参数：

```ts
const articleUpvoteOperation: TOptimisticToggleOperation<TArticle, TArticleReactionResult> = {
  name: 'article.upvote',
  entityKey: getArticleKey,
  queueKey: (article) => `article:${getArticleKey(article)}:reaction`,
  queriesToCancel: getArticleReactionQueryTargets,
  read: readArticleUpvote,
  apply: applyArticleUpvote,
  execute: executeArticleUpvote,
  reconcile: reconcileArticleReaction,
}
```

领域 Hook 只绑定 operation 与 target：

```ts
export default function useArticleUpvote(article: TArticle | null) {
  return useOptimisticToggle(articleUpvoteOperation, article)
}
```

QueryClient、`accountRef`、current state、commandId、queue、phase、rollback 和 receipt 均由通用层
内部处理。

### 6.3 理想的组件调用

Article upvote：

```tsx
const { count, isUpvoted, toggle } = useArticleUpvote(article)

<button type='button' aria-pressed={isUpvoted} onClick={toggle}>
  <UpvoteIcon />
  {count}
</button>
```

`toggle()` 立即 patch public count 与 viewer relation；Hook 从 canonical public Query、viewer Query、
active operation 和 confirmed receipt 派生 `count/isUpvoted`，避免组件持有旧 Article 副本。
`isUpvoted` 是业务状态；ARIA 使用标准 `aria-pressed`，不创建 `ariaActive` 字段。

```text
toggle()
  -> QueryClient optimistic patch
  -> Query subscribers notified
  -> Hook 重新派生 count/isUpvoted
  -> 进入 TanStack/React 的立即批次更新，组件随后 re-render
```

这里承诺的是同一次交互后的及时反馈，不承诺与事件处理函数处于同一个 React render cycle；TanStack
Query 的订阅通知仍由 React 批次调度。

当前 `useOptimisticToggle` 订阅 QueryCache 后会先比较该 operation 的 entity selector；无关 Query
事件仍会执行一次廉价 `read`，但 selector 未变化不会触发 re-render。因此当前成本是每个 cache event
最多执行 mounted toggles 数量级的 selector read，而不是让全部按钮重渲染。若列表规模 profiling 显示
这一步本身成为热点，再把 operation 的相关 query keys 纳入订阅合同并在读取 selector 前过滤 event；
在没有数据前不为通用层增加另一套 observer registry。

Article collect 与 emotion：

以下是与 `useOptimisticToggle` 对齐的目标调用形状；当前竖切只实现了 Article upvote，Article
collect/emotion 尚无现存前端 mutation 接线，接入时必须复用同一合同与 `article:{key}:reaction`
lane，不能另起一套 helper。

```tsx
const { count, isCollected, toggle } = useArticleCollect(article)
const { emotions, selectedEmotion, toggle: toggleEmotion } = useArticleEmotion(article)

toggle()
toggleEmotion('HEART') // 再点同一个值即清除，换值即切换
```

Comment reaction 当前按动作拆成两个领域 Hook；Hook 名称使用 `useCommentUpvote` /
`useCommentEmotion`，返回的操作统一使用 `toggle`，不把事件回调命名为 `handle...`：

```tsx
const { count, isUpvoted, toggle: toggleUpvote } = useCommentUpvote(comment)
const { emotions, toggle: toggleEmotion } = useCommentEmotion(comment)

<Upvote count={count} viewerHasUpvoted={isUpvoted} onAction={toggleUpvote} />
<EmotionSelector emotions={emotions} onAction={(name) => toggleEmotion(name)} />
```

`EmotionSelector` 提供的旧 `hasReacted` 参数不再由上层传回；`toggleEmotion` 从 canonical
Query、viewer state 和 active intent 读取当前状态，避免组件副本或事件参数过期。

Comment create/reply/delete：

```tsx
const { submit, isSubmitting } = useCreateComment(article)
const { submitReply, isSubmitting: isReplying } = useCommentReply(comment)
const { remove, isRemoving } = useCommentDelete(comment)

await submit({ body })
await submitReply({ body })
remove()
```

`isSubmitting/isRemoving` 可用于防止重复提交或显示 loading。optimistic toggle 已立即响应且允许继续
点击，默认不暴露 `isPending/isSyncing`，也不能因请求仍在执行而禁用 toggle。

Report：

```tsx
const { submitReport, isSubmitting } = useCommentReport(comment)

await submitReport({ reason: 'SPAM', detail: '' })
```

Report 是普通 Action，不进入 toggle buffer，也不自动补偿重发。

View：

```tsx
useTrackArticleView(article)
```

Hook 内部生成/复用 `viewEventId`，不向组件返回公开 `views + 1`。

## 7. 精确 patch 与 inverse

### 7.1 为什么不能长期使用整片 snapshot

整片 snapshot rollback 会恢复一组 Query 在 operation 开始时的完整值：

```text
A: Article 1 upvote，snapshot 全部 article queries
B: Article 2 comment count 成功更新
A: upvote 失败，恢复旧 snapshot
结果：B 的成功更新可能被覆盖
```

entity-level serial lane 只能阻止同一 lane 内的并发，不能保护同一 Query object 中其他 entity/field
被独立 operation 更新。

### 7.2 Inverse patch

inverse 只记录本次 operation 实际修改的 projection。它直接使用 §6 中
`TOptimisticChange.type = 'field'` 的字段形状；若实现需要单独命名，可使用：

```ts
type TFieldInverse = Extract<TOptimisticChange, { type: 'field' }>
```

rollback 必须是 guarded rollback：

```text
set-state / viewer flag 仍带有本 operation 的 ownership marker
  -> 恢复 before 并移除 marker

marker 已被更新的 operation 或 server reconcile 替换
  -> 不直接恢复旧值
  -> authority refetch 收敛
```

ownership marker 存在本次 mutation context 对应的 Query patch 中；reconcile 或后续 operation 写入同一
字段时必须替换/清除 marker。仅比较 `current === optimistic` 不能证明 ownership。

count 类字段存在 ABA：本次 `+1` 后，其他写入可能让 count 恰好回到同一个数值。因此 public count
失败时原则上不做 guarded restore，而是移除本 operation 的 ownership 并触发 authority refetch；
set-state/viewer boolean 才能在 marker 匹配时恢复。`pending:${commandId}` 临时 entity 只能由同一
operation 删除；update/delete 的 entity restore 同样要求 marker 匹配，否则走 authority refetch。

### 7.3 Public 与 viewer 必须共同撤销

一次 reaction operation 通常同时修改：

```text
public Query       upvotesCount / emotion.count
viewer Query       viewerHasUpvoted / viewerHasReacted
```

它们属于不同 cache owner，但属于同一次用户操作。apply、reconcile 和 rollback 必须覆盖两侧；不能
出现 count 回滚但按钮仍点亮，或 viewer flag 回滚而 count 保留 optimistic `+1`。

## 8. Server reconcile

mutation response 必须返回当前阶段可以权威确认的字段（O2b 起升级为完整 domain projection/relation），不依赖立即
refetch。O2b 的目标合同如下：

```ts
type TArticleReactionResult = {
  commandId: string
  outcome: 'changed' | 'unchanged'
  publicState: {
    articleStats: {
      snapshotAt: string
      views: number
      viewsRevision: number
      upvotesCount: number
      commentsCount: number
    }
    collectsCount: number
    emotions: Array<{ type: string; count: number; latestUsers: TAccountSummary[] }>
  }
  viewerState: {
    viewerHasUpvoted: boolean
    viewerHasCollected: boolean
    viewerEmotion: string | null
  }
}
```

Article/Comment mutation payload 返回 `commandId`。首次 execute 与同一 commandId 的 transport retry
都返回原始 changed/unchanged
结果并标记为 `true`。当前客户端 mutation 固定 `retry: false`，每次正常 execute attempt 也生成新 ref，
所以 replay 主要由服务端幂等/transport 边界触发；客户端判断属于防御处理，看到 replay 时只重新
reconcile 当前 Query，不新增或续期 confirmed receipt。

O1 的首个纯前端 slice 曾允许暂不携带 revision；当前 O2b/R1 已落地，Article reaction response 必须按
[Optimistic Read Your Writes](./optimistic-read-your-writes.md#51-mutation-response) 返回完整 domain
projection/relation，receipt 不得从其他 Query 拼装。response 的 public/viewer 分区从协议设计开始
保持清晰。

reconcile 规则：

- server absolute count 覆盖 optimistic `+/- 1`；
- server viewer state 覆盖客户端期望值；
- server-normalized entity 替换 pending/edited entity 的可确认字段；
- 排序、筛选归属、跨页位置通过精确 invalidate/refetch 收敛；
- mutation success 后的 CDN CacheEffect 是独立状态机，不延长 UI mutation pending；
- reconcile 完成后，不再使用 mutation 开始前的 snapshot。

## 9. Toggle 连点合并

`useOptimisticToggle` 只用于具备明确 set-state/幂等语义的 toggle：

```text
server/applied state = false
user clicks           true -> false -> true
pendingState          true

execute false -> true
request pending期间只更新 pendingState
confirmed true == pendingState true
不再发送中间请求
```

约束：

- React render 中的旧 `viewerHasXxx` 不能作为连续点击的唯一真值；
- active toggle 按 QueryClient + accountRef + entity + operation 隔离；
- commandId/name 用于观察，`queueKey` 用于串行，toggle buffer 用于合并最终 `pendingState`；
- `pendingState` 变化不创建新的 create/delete/report 操作；
- server confirmed state 与 `pendingState` 不同才发送一次补偿 set-state；
- 每次实际 execute 才生成 `commandId`；补偿 execute 使用新 key，no-op 不生成 key/receipt；
- execute 失败后，`pendingState` 重置为最后一次已知 server-confirmed state，执行 guarded
  rollback/refetch；不自动重放失败期间累积的 target，下一次真实点击再创建新的 attempt；
- unmount 不得让已进入 mutation scheduler 的 authority result 无人 reconcile。

## 10. 不同 operation 的策略

| Operation              | Optimistic apply                            | Inverse                                    | Confirmed reconcile                   | 自动 retry                    |
| ---------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------------- | ----------------------------- |
| Article upvote/undo    | public count + viewer flag                  | marker-owned viewer restore；count refetch | server count/state                    | 仅完成 commandId 幂等后       |
| Comment upvote/emotion | comment aggregate + viewer flags            | marker-owned viewer restore；count refetch | server comment projection/state       | 同上                          |
| Create comment/reply   | 插入 `pending:${commandId}` + commentsCount | 只删除自己的 pending；count refetch        | 正式 entity + server count            | commandId 幂等后              |
| Update comment         | 可确定字段立即 patch                        | marker-owned 原字段，否则 refetch          | server-normalized comment             | commandId 幂等后              |
| Delete comment         | 移除 entity + commentsCount                 | marker-owned entity restore；count refetch | tombstone/result + server count       | commandId 幂等后              |
| Report                 | 首期可只显示 pending                        | 领域决定                                   | viewer reported state                 | 禁止盲重试                    |
| View                   | viewer pending overlay；不盲目 `views + 1`  | 移除 pending overlay                       | durable event acceptance/worker state | 使用稳定 viewEventId 安全重试 |

## 11. 与 Read Your Writes 的交接

只有达到 `reconciled` 的 operation 才能产生 confirmed receipt input：

```ts
type TConfirmedOperation<TPublic, TViewer> = {
  commandId: string
  accountRef: string
  entityKey: string
  operationName: string
  publicState: TPublic
  viewerState: TViewer
  confirmedAt: number
}
```

交接顺序不可反转：

```text
optimistic applied
  X 不写 confirmed receipt

server confirmed
  -> reconcile Query
  -> persist confirmed receipt
  -> mutation UI success
```

receipt 写入失败不改变已经成功的业务结果。当前 tab 继续使用 Query 中的 confirmed response；刷新后
降级为现有最终一致语义，并记录 receipt persistence telemetry。

跨刷新文档负责把 `TConfirmedOperation` 编码为有 schema version、TTL、accountRef 和 projection
revision 的 receipt，本文不重复定义其存储与消费规则。

## 12. 可观测性

每个 operation 至少记录：

```text
commandId
operationName
entityKey（公开 ref，可按日志策略脱敏）
queueKey
phase
queued duration
request duration
confirmed / failed
rollback applied / skipped / refetch fallback
toggle compensation count
receipt persisted / failed（RYW 启用后）
```

不记录 comment body、token 或完整 viewer data。服务端日志使用同一 `commandId`，使浏览器失败、
Phoenix transaction 和后续 reconcile 可以关联。

## 13. 分阶段实施

当前 O0-O5 均已完成；以下保留依赖顺序和每阶段验收边界，供后续 operation 按同一合同接入。

### Phase O0：冻结现状与合同

- 盘点 Article upvote、Comment reaction、create/reply/update/delete/report 的实际 patch shape；
- 为每个 operation 列出 `TOptimisticOperation`、Query owner、server response 和 effect plan；
- 冻结 `commandId` 生成/复用/identity mismatch 语义；
- 为整片 snapshot 的交叉覆盖建立回归测试。

### Phase O1：Article upvote 竖切

- 保留现有 toggle 连点合并体验；
- 建立 `execute/useOptimisticAction/useOptimisticToggle` 通用层，并以 `articleUpvoteOperation` 描述
  Article 领域差异；
- 引入明确 operation identity/phase；
- viewer set-state 收窄为 marker-owned guarded inverse；public count 失败移除 ownership 后走 authority
  refetch，避免 ABA；
- 保留 server absolute count/state reconcile；
- 验证 list/detail 同时存在、快速 toggle 和其他 Article 并发更新。
- 将 O0 的“整片 snapshot 交叉覆盖”用例改写为 guarded-inverse/authority-refetch 回归测试；测试继续
  证明不会覆盖其他成功写入，但不能固化恢复整片 snapshot 的旧行为。

### Phase O2a：接通后端幂等

- mutation 接收并返回 `commandId`；
- 服务端相同 identity 重试返回同一逻辑结果；
- identity mismatch 返回稳定领域错误；
- Article reaction response 先完成 public/viewer 分区，但不抢跑 revision 字段；
- 本阶段只冻结/实现 execute-attempt identity 与幂等，不依赖尚未冻结的 RYW revision 协议。

### Phase O2b：按 R0 协议接入 revision

- 必须在 [Optimistic Read Your Writes](./optimistic-read-your-writes.md) Phase R0 冻结 revision 的
  domain、物理落点、推进事务和 GraphQL fields 后开始；
- mutation response 与 authority/public read 按冻结协议返回对应 projection revision；
- unchanged 幂等成功不推进 revision，也不产生新的 public receipt 水位。

### Phase O3：Comment reaction

- 必须原样接入 O1 的 `useOptimisticToggle` 公开合同；若需要改通用层 API，先触发抽象重评审；
- 保留 operation-level mutation key 与 `queueKey` 的区别；
- viewer flags 使用 marker-owned inverse；public comment aggregate 失败时 authority refetch，避免 count
  ABA；
- 覆盖同一 Comment upvote/emotion 快速交错和失败 rollback。

### Phase O4：Comment entity lifecycle

- create/delete 必须原样接入 O1 的 `useOptimisticAction` 公开合同；若需要改通用层 API，先触发抽象
  重评审；
- create/reply 使用 `pending:${commandId}`；
- update/delete 增加可逆 entity/list patch；
- delete 与 reaction/update 进入一致的 Comment 冲突边界；
- response 返回 server-confirmed Comment entity；Comment surface 如仍需要 aggregate，可返回该 surface 自己的
  `commentsRevision`，但不得把 `commentsCount/commentsRevision` 写回公共 Article。公共 ArticleStats 的
  `commentsCount` 只能通过完整 `ArticleStats.snapshotAt` 收敛；delete success 的 count authority refetch 只作为
  失败或无法安全回滚时的兜底；
- create/reply/update/delete 已具备 commandId identity fence，自动重试仍由上层明确控制，默认保持 `retry: false`。

### Phase O5：View operation identity

- 一次逻辑浏览生成稳定 `viewEventId`，retry/reload 继续绑定同一 event identity；
- viewer 侧只建立 pending viewed overlay，不盲目修改公开 `views`；
- durable event acceptance 与 worker projection 明确分阶段；
- RYW receipt 仍只从 `reconciled` handoff 构造，不反向扩展成未确认 operation queue。

### 13.1 跨文档执行主链

```text
O0 -> O1 -> O2a -> R0 -> O2b -> R1
                         |
                         +-> O3 -> R2a（Comment reaction）
                         +-> O4 -> R2b（Comment entity/feed）
                         +-> O5 -> R3（View）

R4 只在以上竖切产生证据后评估
```

- R0 负责先冻结所有 revision/accountRef 协议，O2b 只能照协议实施，因此不存在 O2/R0/R1 循环；
- O3 先稳定 Comment reaction operation，再由 R2a 接入 comment interaction receipt；
- O4 先稳定 create/reply 的 pending identity、幂等和 entity lifecycle，再由 R2b 接入 Comment
  feed receipt；
- O5 完成 view event identity/pending 语义后，R3 才接 durable event receipt。

## 14. 验收矩阵

| 场景                                    | 必须结果                                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| 单次 upvote 成功                        | UI 立即变化，最终使用 server absolute count/state                                                                 |
| Article upvote 组件调用                 | 只使用 `useArticleUpvote(article)` 返回的 `count/isUpvoted/toggle`，不传 QueryClient、accountRef 或 current state |
| 单次 upvote 失败                        | 只撤销目标 Article/viewer 字段，不覆盖其他 entity 更新                                                            |
| 同一 Article 快速 toggle                | 最终收敛到最后期望状态，中间意图不逐个发送                                                                        |
| 不同 Article 并发                       | 一个失败 rollback 不恢复另一个成功结果                                                                            |
| Comment upvote/emotion 交错             | public/viewer cache 不被跨 operation rollback 覆盖                                                                |
| create response 丢失                    | 不自动盲重发；接通 commandId 后服务端可查询/复用结果                                                              |
| create 成功                             | `pending:*` 被正式 comment 替换，count 使用 server result                                                         |
| delete 失败                             | marker 仍归本 operation 时恢复 entity；count 由 authority refetch 收敛，不覆盖期间无关更新                        |
| mutation success + cache effect failure | 业务仍为 confirmed，不 rollback，不延长 pending                                                                   |
| receipt storage failure                 | 当前 tab confirmed 正常；跨刷新降级且可观测                                                                       |
| logout/account switch                   | viewer operation/receipt 不进入另一 accountRef                                                                    |

## 15. 决策摘要

本文推荐的是“薄合同 + 领域实现”，不是新的状态管理框架：

```text
TanStack Query
  -> 继续负责 Query cache、取消/刷新和订阅通知；通用 executor 在 QueryClient 内维护 queueKey lane

optimistic operation contract
  -> 统一 identity、phase、queue、inverse 和 confirmed handoff

Article/Comment modules
  -> 继续拥有具体 patch、server response normalize 和业务 reconcile

Read Your Writes
  -> 只接收 reconciled operation，负责跨刷新 receipt/revision
```

实施顺序以 Article upvote 的单个纵向闭环证明合同，再扩展到 Comment；通用层只抽取已明确的
Action/Toggle 生命周期，不建立覆盖任意 mutation 的通用 DSL。
