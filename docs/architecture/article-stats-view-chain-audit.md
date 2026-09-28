# ArticleStats / View 全链路审计与收口清单

> 状态：全链路收口已实施；Cloudflare/Edge 与低优先级容量优化继续独立跟进
>
> 日期：2026-09-28
>
> 范围：Article view、interaction、comment 写入，ArticleStats，private viewer state，GraphQL 协议，TanStack Query 同步与相关数据库表。
>
> 不包含：Cloudflare crawler evidence、Edge rate limit、origin 收口的具体实施；这些继续由
> [Cloudflare 防滥用待办](../feature/view-tracker/cloudflare-abuse-protection-todo.md)负责。

相关当前合同：

- [Article View 计数写链路](../feature/view-tracker/article-view-counting.md)
- [ArticleStats 与 private state 写后同步](./article-stats-and-viewer-state-sync.md)
- [ArticleStats 与公共页面缓存](./article-stats-and-public-cache.md)
- [RequestActor](./request-actor.md)
- [Gate V5](../feature/gate/v5.md)

本文记录 2026-09-28 的全链路审计、direct cutover 设计和最终实施结果。它不是新的兼容方案，也不改变 Gate、Lifecycle、Interactions、
Comments 或 ViewTracker 的 ownership。本文同时作为已完成边界、保留复杂度和独立后续工作的验收记录。

## 1. 结论

本轮前端重构方向正确，并且已经显著简化公开统计同步：

```text
旧实现
  batch stats cache
    -> seed per-Article entity cache
    -> 每篇一个 disabled observer
    -> mutation 更新 entity
    -> observer 再驱动列表

当前实现
  真实 Detail / Batch stats query
    -> mutation 返回完整 ArticleStats
    -> 按 owner revision patch 所有包含该 Article 的 query
    -> Detail / List 直接重渲染
```

后端同步事务、条件 UPSERT、Gate recheck、删除锁、owner revision 和公开/私有状态分离也总体合理，不应为了表面减少模块数量而合并成
通用 counter service 或通用 Article state。

审计发现的四个优先健壮性问题均已关闭：

1. 每个公网请求都会得到 signed anonymous session，因此 User-Agent crawler 判断在真实 Context 路径中被 anonymous evidence 覆盖；
2. `articleStats` batch 请求包含不存在或不可见的 ID 时使用 `Map.fetch!`，可能抛出 500；
3. Article mutation 会取消所有已加载的 stats query，而不是只取消包含目标 Article 的 query；
4. View mutation 对认证、scope、GraphQL validation 等确定性错误也立即重试一次。

同时已删除 Article content 的 private hydration、receipt 专用的第二条 interaction query、两套 Article path/key helper、过宽的 stats query
cancellation，以及用途未闭合的 View rule-change model/table。

### 1.1 已确认的目标边界

```text
Article Content API
  -> title / body / author / tags
  -> public content query cache

ArticleStats API
  -> views / upvotes / comments / emotions + owner revisions
  -> public stats query cache

ArticleViewerStates API
  -> ViewTracker-owned viewerHasViewed
  -> account-scoped private query cache

ArticleInteractionStates API
  -> Interactions-owned upvote / collect / emotion / interactionRevision
  -> account-scoped private query cache

Mutation payload
  -> operation result
  -> committed ArticleStats
  -> affected private state
  -> patch only existing matching queries
```

本次继续采用 direct cutover：同步修改后端读取、GraphQL schema、生成类型、前端 query/cache、测试和文档；不保留旧字段 alias、
`Ref` 命名 alias、双读、双写或 compatibility wrapper。

## 2. 当前全链路

### 2.1 View 写入

```text
Browser / Service
        |
        v
Phoenix Context
  ├─ account session
  ├─ signed anonymous session
  ├─ service credential
  └─ delegation
        |
        v
RequestActor.classify（每个 request 一次）
        |
        v
ConditionalServiceScope
  browser / anonymous  -> 允许
  service / delegation -> 校验 audience + scope
  verifier failure     -> fail closed
        |
        v
trackArticleView
        |
        v
锁定 physical Article FOR KEY SHARE
+ Gate public-read recheck
        |
        v
Identity.resolve + ViewTracker.Policy
        |
        +---------------- policy excluded ----------------+
        |                                                 |
        |                                                 v
        |                                  tracked=false + current state
        v
conditional UPSERT article_view_dedupe_states
        |
        +-- 去重窗口内重复 --> views 不变
        |
        `-- counted
              ├─ ArticleStats.views + views_revision
              ├─ authenticated human -> ViewerState
              └─ Analysis.MetricEvent
                    同一事务提交
        |
        v
ArticleViewTrackResult
  ├─ tracked
  ├─ complete ArticleStats
  └─ ViewerArticleState（只含 ViewTracker-owned state）
        |
        v
applyViewResult
  ├─ patch 已存在的 Detail / Batch stats query
  ├─ patch 已存在的 viewer query
  └─ tracked=true -> ViewAck
        |
        v
useArticleState / useArticleStates
        |
        v
Detail / Posts / Changelogs / Kanban
```

### 2.2 Interaction / Comment 写入

```text
Mutation + commandId
        |
        v
Gate admission
        |
        v
Command receipt / recovery
        |
        +--------------------+-------------------+
        |                    |                   |
        v                    v                   v
   Interactions          Comments            Collect
   authoritative fact   authoritative fact   folder result
        |                    |
        +------ owner-owned ArticleStats fields ------+
                             |
                             v
专用 mutation payload
  ├─ operation result
  ├─ complete ArticleStats
  └─ affected private state（存在时）
                             |
                             v
frontend owner-wise merge
  ├─ public stats queries
  ├─ corresponding private queries
  └─ confirmed-write receipt（需要时）
```

View 不得因 upvote、emotion、collect 或 comment 隐式增加；这些是独立业务操作。View 不使用 Command receipt，interaction/comment
继续使用 commandId 与 recovery，二者不应重新统一为一套协议。

## 3. 已关闭的优先问题

### 3.1 Anonymous session 覆盖 crawler self-report

当前 Context 在认证前先执行 `AnonymousSession.ensure/1`，并始终把结果放入 context：

```text
HTTP request
  -> AnonymousSession.ensure
  -> context.anonymous_session
  -> request_actor_input chooses anonymous_session
  -> Evidence.SignedAnonymousSession
  -> human / probable
  -> ViewTracker.Policy allows counting
```

`Evidence.Unknown/self_reported` 只在没有任何 trusted evidence 时产生。由于匿名请求总有 signed anonymous session，真实 HTTP 路径中的
`User-Agent: Googlebot`、普通 crawler 或脚本不会进入 unknown/self_reported，而会成为 probable human。

直接影响：

- 自报 crawler 会被计入 views；
- 不保存 cookie 的脚本每次获得新 identity，可绕过去重窗口；
- 每次请求都可能增加 `article_view_dedupe_states` 和 `analysis_metric_events`；
- 在 Cloudflare rate limit/origin 收口完成前，仍存在 count inflation 和数据库写放大风险。

目标分类优先级：

```text
verified Edge crawler evidence
  > verified service / delegation
  > verified account
  > self-reported automation signal
  > signed anonymous session
  > unknown
```

对应语义：

```text
verified Edge crawler evidence
  -> verified crawler / 不计数

verified service / delegation
  -> verified agent / 按 service policy 处理

verified account
  -> verified human

self-reported automation User-Agent + anonymous session
  -> unknown / probable / self_reported / 不计数

ordinary signed anonymous session
  -> human / probable / 计数
```

Signed anonymous session 只提供稳定的匿名 identity，不是 human 证明。未登录请求即使已有 anonymous session，crawler User-Agent
仍必须参与分类；已验证 account/service/delegation 则不被不可信 User-Agent 降级。

`crawler` kind 只属于 verified crawler evidence；本次不新增 self-reported crawler kind。现有 User-Agent 正则中的 `agent` 匹配较宽，
此前在真实 Context 路径不可达，切流后必须同时验证常见 bot 正例和浏览器、WebView、SDK、合法包含 `agent` 文本的反例；出现误杀时收窄正则。

这只能排除诚实 self-reported automation，不能阻止伪装成浏览器的自动化。完整防滥用仍依赖 Edge evidence、rate limit、origin 收口或 challenge，
不能把 signed cookie 当作真人证明。

验收要求：

- 覆盖真实 Phoenix Context，而不是只测 `RequestActor.classify(user_agent: ...)`；
- `bot UA + 自动创建 anonymous session` 不写 dedupe、stats 或 metric；
- 普通匿名浏览器仍稳定使用 signed session 去重；
- self-reported automation 仍输出 `unknown / probable / self_reported`，由 Policy 排除；
- User-Agent 正则覆盖 bot 正例和合法 UA 反例；
- verified service/delegation 的分类和 scope 行为不变。

### 3.2 `articleStats` batch 的 missing-ID 500

当前 batch reader 先通过 Gate 查询可见 Article，再按原始 `inner_ids` 顺序执行 `Map.fetch!`。当任一 ID 不存在、被删除或不可见时，
会抛 `KeyError`，而不是返回稳定的 GraphQL 结果。

当前 `read_article_stats/3` 还会在外层 `else` 把包括 `projection_not_updated` 在内的所有内部错误折叠成 `article_not_found`。目标实现必须
区分 path 缺失与可见 Article 的 projection 损坏，不能让后者失去可观测错误码。

推荐将 batch 合同定义为：

```text
输入同一 Community/thread 下最多 100 个 innerId
  -> Gate 返回其中当前可见、存在的 Article
  -> 返回这些 Article 的 stats
  -> 保持可见结果在原始请求中的相对顺序
  -> 不暴露某个缺失 path 是不存在还是不可见
```

前端 batch 本身已经允许某篇 Article 没有 stats，并会把该项表示为 `stats: null`。单篇 detail query 可以继续在空结果时抛明确的
`ArticleStats unavailable`，无需让一个消失的列表项拖垮整批统计。

验收要求：

- 全部存在且可见时保持输入映射正确；
- 混合存在/缺失 ID 不抛异常；
- 不可见和不存在不形成可区分的信息泄露；
- 可见 Article 的 projection row 缺失时保留 `projection_not_updated`，不能折叠为 `article_not_found` 或静默伪造零值。

### 3.3 Stats query cancellation 误伤无关请求

当前 mutation 在 optimistic 阶段会选择所有已加载的 stats detail/batch query；upvote 还会按 account prefix 选择该账号的全部
interaction-state query。对 `home/POST/101` 的操作可能取消另一个 Article、thread 或 Community 的在途请求，造成无关页面延迟收敛。

取消范围必须只包含：目标 path 的 stats detail query、包含目标 innerId 的 stats batch query，以及当前 account 下包含目标
`articlePathKey` 的 interaction-state query。具体统一 matcher 见“ArticleStats cache 操作收口并精确到 Article path”。

### 3.4 View retry 不区分确定性错误

View tracking 当前对所有异常立即 retry 一次。服务端 dedupe 能避免同一 identity 重复计数，但认证、scope、GraphQL validation、not found 和
policy rejection 等确定性错误不应再次发送。当前 GraphQL client 已经提供可靠分类：业务、认证、scope 和 GraphQL validation failure 会成为
`GraphQLRequestError`，非法响应会成为 `GraphQLResponseError`，`fetch` transport failure 才是 `TypeError`；QueryClient 的
`shouldRetry` 当前也只重试 `TypeError`，但 `failureCount >= 2` 在 TanStack Query 的调用语义下会分别在 `failureCount = 0` 和 `1` 时放行，
即最多重试两次、总共尝试三次。

本次不借 View 改造收紧所有 Query 的全局 retry budget。目标是提取共享的 `isRetryableTransportError(error)` 分类，只让 `TypeError`
进入 retry；QueryClient 保持现有最多重试两次，imperative `trackArticleView` 最多重试一次，并删除当前无条件的
`request().catch(request)`。不要在本文中笼统承诺 timeout/5xx retry：当前 `AbortError`、HTTP 5xx 和 `GraphQLResponseError` 都不属于该
分类；若以后要扩展，必须先扩展明确的错误分类和测试，不能重新退回“所有错误重发一次”。

## 4. 已删除或收口的重复层

### 4.1 删除 Article content 的 private hydration

当前前端已经把 private state 拆为：

```text
articleViewerStates       -> viewerHasViewed
articleInteractionStates  -> upvoted / collected / emotion / interactionRevision
```

但普通 Article Reader 仍调用：

```text
CMS.Interactions.viewer_state(s)
CMS.ViewTracker.viewer_state(s)
```

并把结果写回 Article 虚拟字段。GraphQL content type 仍暴露：

```text
viewerHasViewed
viewerHasUpvoted
viewerHasCollected
viewerEmotion
viewerHasReported
reactionOutcome
```

新页面随后又请求两个专用 private query，因此一次内容读取会重复装配 private state，即使 GraphQL selection 没有选择这些字段。

目标结构：

```text
Article content reader
  -> public content
  -> public interaction presentation（例如 latest users，确有消费者时）
  -> 不读取 current viewer private state

Private query
  -> 唯一读取 current viewer state 的入口
```

实施时需要：

1. 删除 Article GraphQL content type 上的 private viewer 字段；
2. 删除无调用方的 `PostThreadFresh` query；
3. 将 `Articles.Response` 拆出只服务公共 presentation 的读取，不再调用 ViewTracker viewer state；
4. interaction public metadata 与 private bitmap 判断分开，避免为了 latest users 继续加载 current viewer state；
5. 删除 Article schema 中只服务旧 reaction 返回的 `reactionOutcome`；
6. 保留 management 场景仍在使用的 `articleStats` content 字段，除非 Trash/abuse payload 同步改为专用 stats 字段。

private hydration 删除后，内容 query 的旧 mutation helper 也应同批清理：

- 删除只有 barrel export、无运行时调用方的 `patchArticleChanges` / `patchArticleEverywhere`；
- 删除只服务这些 helper 的 `articleQueryTargets` 及对应 legacy content-cache export；
- `selectArticleFromCache` 当前只服务 `useArticleUpvote`，切为 path 驱动后删除，upvote 不再从 content cache 寻找所谓 canonical entity。

`TOptimisticChange`、`TQueryTarget` 和 `TOperationContext` 仍由 Comment、Upvote 与通用 optimistic executor 使用，不属于 legacy content
helper，必须保留。不能因为它们当前位于相邻目录或被旧 helper 引用就一起删除。

这是一处直接切换，不需要保留旧字段 alias 或 fallback。

### 4.2 Receipt reconcile 复用现有 interaction query

`useArticleState` 和 `useArticleStates` 已经请求完整的 `articleInteractionStates(paths)`，但随后
`useArticleInteractionReconcile` 又为 active receipt subset 创建同类 query：

```text
main interaction query      paths = page Articles
receipt reconcile query     paths = Articles with receipt
```

单篇场景可能只增加 observer；列表 subset 不同则会产生第二次网络读取和第二个 cache entry。

目标：

- 删除 reconcile hook 内部的 `useQuery`；
- 同时删除 `mergePrivateState` 及其 `cacheArticleInteractionState` 写入分支，不能留下无 query data 来源的 private 写路径；
- 直接使用主 `interactionQuery.data` 清理已追上的 receipt；
- 删除 `useArticleUpvote` 自己重复的 receipt cleanup effect；
- 由 `useArticleState` / `useArticleStates` 共用的内部 effect 成为唯一 receipt clearer；
- 本地 Ack/receipt map 在 stats、viewer 或 interaction query data 变化时重新读取，确保 mount 后写入也能进入 composer 和 clearer；
- `composeArticleState` 必须保持纯函数，不读取或清理 sessionStorage；如需共享逻辑，只保留无网络请求的纯 helper 或小型 effect；
- confirmed-write receipt 继续只承担 read-replica/cache 尚未追上时的保护，不承担日常 stats 同步。

收敛语义明确为：mutation success 直接 patch 主 interaction query，并触发共享 hook 重读本地 receipt；reload/mount 时主 query 以
`staleTime: 0` refetch；返回 revision 仍落后时继续使用 receipt overlay，后续权威 query 更新、window focus 或 remount 会再次读取，最终由
revision 或 TTL 清理 receipt。`staleTime: 0` 只保证挂载读取，不是轮询；若产品要求当前页面再次主动追赶，只允许 refetch 同一个主
query，不能重新建立 subset query/cache key。

### 4.3 Article path/key 只保留一套

当前同时存在：

```text
articleRefOf / articleRefKey
articlePath  / articleKeyFor
```

`Ref` 在前端还会与 React ref / `useRef` 混淆，`articleKeyFor` 也仍是重复手拼字符串。直接切换后统一为：

```text
ArticleRefInput -> ArticlePathInput
TArticleRef     -> TArticlePath
articleRefOf    -> articlePathOf
articleRefKey   -> articlePathKey
refs / ref      -> paths / path
```

`TArticlePath` 表示 `community + thread + innerId` 组成的公开业务坐标，不是 URL 字符串。GraphQL、Core query、mutation cache
只保留一份 canonical 定义，不保留 `Ref` alias。

当前 `article_ref_input` 与 `article_path_input` 字段完全一致，hard rename 的已知范围包括两个 input object、四个 query argument、前端
`viewer`/Comments operations 与生成物；不需要数据迁移或兼容 input。

Invalidation 同样复用该类型：删除重复的 `TArticleInvalidationRef`，将 target 字段从 `ref` 改为 `path`；`TArticleListScope` 表示列表范围，
不是单篇 ArticlePath，因此继续保留。

完整命名边界如下：

| 当前名                                                   | 目标名/处理                                                                              |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `articleRef.ts`                                          | `articlePath.ts`                                                                         |
| `TArticleRef`                                            | `TArticlePath`                                                                           |
| `TViewerArticleRef`                                      | 删除，直接复用 `TArticlePath`                                                            |
| `articleRefOf`                                           | `articlePathOf`                                                                          |
| `articleRefKey`                                          | `articlePathKey`                                                                         |
| `ArticleRefInput` / `article_ref_input`                  | 删除，统一 `ArticlePathInput` / `article_path_input`                                     |
| ArticlePath 语义的 `ref` / `refs`                        | `path` / `paths`                                                                         |
| `TArticleInvalidationRef`                                | 删除，复用 `TArticlePath`                                                                |
| invalidation target 的 `ref`                             | `path`                                                                                   |
| `viewerKeys`                                             | `viewerQueryKeys`；明确它是 TanStack private query key factory                           |
| viewer query key 参数 `articleKeys`                      | `articlePathKeys`                                                                        |
| `matchesArticleState` / `matchesArticleInteractionState` | 从 key factory 移出，成为 `viewer.ts` 私有 cache matcher                                 |
| ViewAck payload 的 `articleRef`                          | `articleKey`；该字段保存的是编码后的字符串，不是 path 对象；`ACK_VERSION` 从 1 bump 到 2 |

GraphQL 中只有 `articleViewerStates` / `articleInteractionStates` 的复数参数需要从 `refs` 改为 `paths`。`commentViewerStates` /
`commentReconcileStates` 的单数参数可以继续叫 `article`，但输入类型必须切为 `ArticlePathInput`。后端 resolver 局部变量、batch validation
错误信息以及 `read_state_query_test.exs` / `view_events_test.exs` 同步使用 `paths`。

所有 `${community}:${thread}:${innerId}` 手拼都必须收口到 `articlePathKey(path)`，已知调用点包括 `useArticleUpvote`、
`useCommentReceiptReconcile`、Comments `queryState` / `useQuery`、`useCmsArticles`、`useCommentTarget` 和 mutation article cache；telemetry
需要该字符串时也调用 helper，不能保留另一份编码规则。`viewer.ts` 的 `normalizeArticleRefs` 同步改为 `normalizeArticlePaths`，GraphQL
变量 `$refs` / `refs` 改为 `$paths` / `paths`；`useArticleSettingMutation` 中解析 mutation variables 的局部 `articleRef` 也属于
ArticlePath，应改名并复用 canonical type。

`articleRef.ts` 改名不能只建立新文件再留 alias。Slice 2 必须同批更新其全部 importer：`viewer.ts`、`articleStats.ts`、
`useArticleInteractionReconcile.ts`、`ArticleQueryProvider.tsx`、`viewTracker.ts`、`useArticleState`、`useArticleStates` 和
`useTrackArticleView.ts`；完成后直接删除 `articleRef.ts`，运行时代码中不再保留 `TArticleRef` / `articleRefOf` / `articleRefKey`。

private query key factory 同批从 `viewerKeys` 改为 `viewerQueryKeys`，所有 importer 直接切换，不保留 alias。其
`articleStates` / `articleInteractionStates` 参数名从 `articleKeys` 改为 `articlePathKeys`，因为它们接收的是一组
`articlePathKey(path)` 结果。当前 `matchesArticleState` / `matchesArticleInteractionState` 分别只被 `viewer.ts` 的
`cacheArticleViewedState` / `cacheArticleInteractionState` 使用，应下沉为同文件私有 cache matcher；单个 matcher 参数 `articleKey` 可以保留，
因为它确实是编码后的字符串。

`viewerQueryKeys` 最终与 `articleQueryKeys` 遵循同一原则：只生成 TanStack QueryKey，不包含 cache 匹配或写入策略。`viewer.ts` 继续拥有
viewer state 的 fetch、normalize、cache membership 判断、写入和 revision conflict 处理；当前只有两个单一消费者，无需新建
`viewerStateCache`、`viewerQueryMatchers` 或新的 store。

以下 `Ref` 不属于本次 locator rename，必须保留：Search/Press/Trash 中表示 `article_hash_id` 或逻辑文章标识的 `articleRef`、Assets 的
article refs、Comment 的 `commentRef`、`accountRef` / `commandRef`、React/DOM ref，以及已执行历史 migration 中的名字。不能做全仓字符串替换。

ViewAck 字段改名属于 sessionStorage schema 变更。direct cut 时必须同时将 `ACK_VERSION` 从 1 bump 到 2；旧 V1 ack 由 session receipt
version guard 忽略并清理，不增加 `articleRef` fallback 或旧字段兼容读取。

### 4.4 ArticleStats cache 操作收口并精确到 Article path

当前 mutation 的 `articleStatsQueryTargets(queryClient)` 返回所有已加载的 stats detail/batch query。一次 Article interaction 可能取消其他
Article 或其他 Community 正在进行的请求。

TanStack Query key factory 明确命名为：

```text
articleKeys -> articleQueryKeys
```

`articleQueryKeys` 只生成 query key；读取和修改缓存由 `articleStatsCache` 负责：

```typescript
articleStatsCache.contains(queryKey, path)
articleStatsCache.find(queryClient, path)
articleStatsCache.apply(queryClient, stats)
articleStatsCache.queries(queryClient, path)
```

这是长期职责边界，不是为了完成本次迁移临时移动函数：

| 逻辑                                                    | 长期归属                              |
| ------------------------------------------------------- | ------------------------------------- |
| `stats()` / `statsBatch()` 等 QueryKey constructor      | `articleQueryKeys`                    |
| 某个 stats query 是否包含指定 Article                   | `articleStatsCache.contains`          |
| 查找、更新指定 Article 的 stats                         | `articleStatsCache`                   |
| 某个 Article 列表是否属于失效范围                       | `invalidation/article.ts` 私有 helper |
| 某个 stats batch 是否属于整个 Community/thread 失效范围 | `invalidation/article.ts` 私有 helper |
| 识别旧 content entity query                             | 随旧机制删除，不保留 matcher          |

因此当前 `articleKeys` 中的 `isStats` / `isStatsBatch` / `matchesStatsBatch` 必须随匹配规则进入 `articleStatsCache`，由 `contains` 对外提供
单篇 Article 的统一判断；`matchesArticleList` 和 `matchesStatsBatchScope` 只服务 invalidation，应下沉为 `invalidation/article.ts` 的私有
helper。`isArticleEntity` 在 `articleQueryTargets` 删除后没有调用方，应在 Slice 2 同批删除。`articleQueryKeys` 最终只保留 key constructor，
不为 matcher 设置例外，也不新增笼统的 `articleQueryMatchers` 中间层。

测试必须随职责一起迁移：`key.test.ts` 中对 `matchesStatsBatch` 的断言迁到 `articleStats.test.ts`，通过
`articleStatsCache.contains` 的公开行为覆盖；`matchesStatsBatchScope` / `matchesArticleList` 的断言迁到 `invalidation.test.ts`，分别通过
`QueryInvalidation.article.statsBatch` / `QueryInvalidation.article.lists` 的公开行为覆盖。下沉后的 invalidation matcher 保持私有，不能为了
延续旧测试而重新 export。`key.test.ts` 最终只验证 QueryKey 的结构、规范化、排序、去重、稳定性和 scope 隔离。

`contains` 的匹配语义：

```text
detail query
  -> path 完全相同

batch query
  -> community/thread 相同
  -> innerIds 包含目标 innerId
```

cancel、apply、receipt find 和 invalidation 使用同一个 matcher，避免四处复制匹配规则。`articleStatsCache` 只操作已有的 TanStack
Query cache，不保存第二份状态，也不演变成包含 content/private state 的全局 `articleCache`。

`articleStatsCache.apply` 必须使用 functional `setQueryData`，并把 query 原有 `dataUpdatedAt` 传回写入选项。mutation patch 不能覆盖并发
network commit，也不能把本地写入时间误当成网络快照新鲜期。

Private interaction cancellation 使用对应的 path matcher，只选择当前 account 下包含目标 `articlePathKey` 的 query，不再取消该账号所有
interaction-state query。

### 4.5 Private state path resolver 必须批量化

`articleViewerStates` 与 `articleInteractionStates` 当前逐 path 调用完整 `CMS.FrontDesk.article/2`；该 reader 会解析 Community、执行
Gate scope，并经过完整 Article response presentation。随后两个 resolver 才分别执行批量 ViewTracker/Interactions reader，形成结构性
N+1，并重复加载本次 private query 根本不需要的 public/private presentation。

Comment 侧只有 `commentViewerStates` 存在同类问题：在已经给定 ArticlePath 和 comment inner IDs 的情况下，仍在
`resolve_comment_viewer_batch` 中逐 comment 调用 `CMS.FrontDesk.comment/1`。`commentReconcileStates` 已经是正确的批量实现：只解析一次
Article，调用一次 `CMS.Comments.reconcile_comments/4`，随后按原始输入恢复 nullable entries。实施时应以 reconcile 路径为参照，只把
`commentViewerStates` 切到同一个批量 reader，不能重写已经正确的 reconcile 流程。

目标读取：

```text
paths
  -> 按 community + thread 分组
  -> 每组解析 Community 一次
  -> 每组构造 Gate.scope 一次
  -> WHERE inner_id IN (...)
  -> 建立授权后的 Article map
  -> ViewTracker.viewer_states / Interactions.viewer_states 批量读取
  -> 缺失或不可见 path 从结果省略

comment path + commentInnerIds
  -> 解析 Article 一次
  -> 一次 Comment Gate/scope query
  -> WHERE article_id = ... AND inner_id IN (...)
  -> InteractionResponse.many 批量 viewer state
```

Comment 的缺失语义必须按 query 分开：

```text
commentViewerStates
  -> 可以只返回存在且可见的 Comment 子集

commentReconcileStates（保持现状）
  -> Reader 返回存在且可见的 Comment 子集
  -> resolver 按原始 commentInnerIds 逐项恢复 entry
  -> 缺失、已删除或不可见项返回 comment: null
```

`commentReconcileStates` 的 nullable entry 是 delete receipt 收敛信号，不能为了统一 batch shape 而省略。现有
`Reader.reconcile_comments/4` 已经执行一次 Article-scoped Gate query 和 `InteractionResponse.many/3`；`commentViewerStates` 直接复用该
reader 并返回可见子集，reconcile resolver 则继续负责把结果重新映射成与输入一一对应的 entries。不存在和不可见继续不可区分。

不能只新增一个“轻量但逐 path”的 reader；验收必须包含 query-count 或 SQL-shape 测试。

### 4.6 写后 payload 使用明确 loader 和具体 mapper

Upvote、collect、comment 和 private batch 当前重复拼 path、ArticleStats 和 interaction state，`viewer_emotion` 也存在多份实现。
目标是让 Interactions read state 直接给出 `viewer_emotion`。ArticleStats 不新增命名冗长的 singular FrontDesk wrapper，继续使用当前统一入口：

```elixir
ArticleStatsPayload.load(thread, article, community)
ArticleInteractionPayload.from(path, interaction)
```

`ArticleStatsPayload.load/3` 明确包含一次 post-commit stats 读取、目标 row 提取和 GraphQL payload 映射；内部继续复用现有
`FrontDesk.article_stats_for_articles/3`，不新增 `article_stats_for_article` wrapper。`ArticleInteractionPayload.from/2` 是纯映射，不执行查询。
二者都不负责 Gate、业务写入、事务或 command replay。各 operation 继续显式拥有自己的 payload：

```text
Upvote  = commandId + reactionOutcome + ArticleStats + InteractionState
Collect = commandId + folder          + ArticleStats + InteractionState
Comment = commandId + comment         + ArticleStats
View    = tracked                     + ArticleStats + ViewerState
```

Comment create/update/delete 的领域结果统一携带所属 canonical Article，避免 presenter 通过 Comment 额外回查父 Article。Interaction mutation
提交后的 public stats 与 private state 由两个独立 reader 读取，各自保留实际观察到的 revision：

```text
articleStats.interactionRevision      = public projection reader 观察到的 revision
interactionState.interactionRevision = private state reader 观察到的 revision
```

两个 post-commit 读取不共享事务快照，遇到并发 interaction 时 revision 可以不同。resolver 不得把严格相等作为 payload admission，也不得取
`max` 或把一个 revision 复制给另一个。Upvote receipt 保护 private viewer state，因此必须记录
`interactionState.interactionRevision`。

不建立按 kind/options 分支的万能 Article presenter。

### 4.7 `useArticleState(s)` 共享内部能力，不合成巨型 hook

页面 API 继续只暴露：

```typescript
useArticleState(article)
useArticleStates(articles)
```

两者共享 private viewer/interaction query、ViewAck、receipt reconcile、snapshot stale 检查和 `composeArticleState` 纯函数；只保留真实的
stats 读取差异：Detail 使用单篇 query，List 按 Community/thread 使用 batch query。不新增 `ArticleStatsStore`、`StateIndex`、
single/batch mode 配置化大 hook 或新的全局状态层。

两类 hook 的返回形状统一为：

```typescript
type TArticleState<T extends TArticle = TArticle> = {
  content: T
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}
```

统一使用 `content`，删除 hooks 返回 `article`、列表再转换为 `content` 的双重形状；同步更新 Detail、Posts、Changelogs、Kanban 和 article
store 消费者。

具体 ripple 包括 `ArticleQueryProvider`、`usePagedPosts`、`usePagedChangelogs`、`useKanbanPosts` 和 `useArticleStates` 测试。Provider 可以继续
维持其对外 context 字段 `article`，但边界映射必须改为 `article: state?.content`；这样读取 provider context 的 article store hooks 不需要
为了内部 hook 返回字段改名而发生无意义的连锁修改。Kanban 当前还以 `state.article` 作为 Map key，必须随同更新，不能只改类型定义。

### 4.8 SSR、浏览器和 mutation 统一 normalize

所有写入相同 stats query key 的入口必须使用同一个纯 `normalizeArticleStats`：browser fetch、SSR loader、hydration 和 mutation payload。
不得让 Community server function 返回原始 GraphQL DTO，而 Core browser query 写入另一种 normalized shape。

### 4.9 明确 `view_counting_rule_changes` 的归属

`cms.view_counting_rule_changes` 当前只有历史 migration seed 和无调用方 Ecto model，没有 Analysis reader、查询合同或 runbook。本次决定通过
新的 migration drop table，并同批删除 model；不修改已经执行的 migration body，历史 seed 随表删除自然失效。

在没有消费方、查询合同或运维入口的情况下长期保留，属于未闭合的未来抽象。

## 5. 协议与类型收紧

当前 GraphQL 分层应保留：

```text
ArticleStats              public / cacheable
ViewerArticleState        ViewTracker-owned private state
ArticleInteractionState   Interactions-owned private state
ArticleViewTrackResult    view 专用写后结果
ArticleReactionResult     reaction 专用写后结果
ArticleCollectResult      collect 专用写后结果
ArticleCommentResult      comment 专用写后结果
```

不应建立笼统的 `ArticleState`、`ArticleModel`、`ArticleStatsStore`，也不应把全部 private state 合成一个后端大对象。

公共 locator 输入统一命名为 `ArticlePathInput`；`articleViewerStates` 与 `articleInteractionStates` 的参数统一命名为 `paths`。
这是 schema breaking direct cut，必须同步 codegen 和所有 operation，不保留 `ArticleRefInput`。

可继续收紧：

- `reactionOutcome: String!` 改为只有合法值的 enum；
- GraphQL Codegen 将 `DateTime` 映射为 `string`，删除 `snapshotAt: unknown` 与运行时 `String(...)` 补洞；
- normalized `TArticleStats.innerId` 固定为 `string`；
- `emotionCounts.type` 与 `viewerEmotion` 使用已有 emotion union；
- `viewer.ts` 与 `spec/article.d.ts` 不再分别维护相似的组合 viewer type；
- `TArticleViewModel` / `TArticleListViewModel` 与 hooks 的重复结果类型统一为字段名固定为 `content` 的 `TArticleState`；
- `ViewerArticleState` 与 `ArticleInteractionState` 保持 owner-specific，不为了名字对称执行 breaking rename。

## 6. 数据库评估

| 表                               | 结论 | 原因                                          |
| -------------------------------- | ---- | --------------------------------------------- |
| `cms.article_stats`              | 保留 | 单个 physical Article 的公共聚合读模型        |
| `cms.article_emotion_counts`     | 保留 | typed emotion、排序和局部更新需要独立行       |
| `cms.article_view_dedupe_states` | 保留 | sliding-window 去重 authority                 |
| `cms.article_viewer_states`      | 保留 | authenticated human 的持久化已读状态          |
| `cms.analysis_metric_events`     | 保留 | Insights 事实输入，已有 aggregation/retention |
| `cms.view_counting_rule_changes` | 删除 | 当前没有 reader、执行入口或 runbook           |

### 6.1 必须保留的字段

`article_stats` 的三个 revision 不应合并：

```text
views_revision        ViewTracker owner
interaction_revision  Interactions owner
comments_revision     Comments owner
```

三个 owner 可以独立并发推进。单一全局 revision 会迫使无关写入争用同一版本，并重新引入整份快照覆盖问题。

`snapshot_at` 与 `updated_at` 在存储上接近重复，但 `snapshotAt` 是公开投影协议和前端 freshness hint。当前不建议为了少一个字段删除它。

`article_emotion_counts.interaction_revision` 不参与公开读取合并，owner revision authority 已在 `article_stats`。当前没有一致性检查或运维读取，
本次 direct cut 删除该冗余字段，不保留仅用于假设性审计的兼容数据。

该字段仍存在写入和 rebuild 代码，不是只删数据库列：同一 Slice 必须同步修改 `ArticleEmotionCount` schema/required fields/changeset、
`apply_emotion_count` attrs 与 conflict update、`emotion_owner_facts` select/result、`rebuild_emotion_rows` 的间接路径，以及 emotion tests 中的
revision 断言。删除后 emotion owner facts 只向 typed row 提供 count；Article 级 revision 继续由 `article_stats.interaction_revision` 管理。

### 6.2 建议补充的约束

- `article_stats`、`article_view_dedupe_states`、`article_viewer_states` 增加合法 thread CHECK；
- dedupe state 增加 `expires_at >= last_counted_at`；
- `viewer_tracking_key` / `tracking_key` 按实际列名增加固定 32 字节约束；
- 视需要增加 `article_id > 0`；
- 将 `article_viewer_states_target_user_index` 等旧索引名改为 article 语义。

### 6.3 不增加多态伪 FK

这些 projection 同时引用 Post、Blog、Changelog 和 Doc 的物理行，单一 `article_id` 无法建立正确的跨表 FK。当前方案：

```text
physical Article key-share lock
  + permanent delete 同事务显式 cleanup
  + PostgreSQL 并发锁测试
```

比引入 canonical compatibility table 或不可验证的多态 FK 更合理。后续仍应通过 orphan detection telemetry/maintenance 检测实现缺陷，
但不把 repair fallback 放进正常读写路径。

## 7. 必须保留的复杂度

以下机制解决的是真实问题，不属于过度抽象：

- Gate 持锁后的 public-read recheck；
- conditional UPSERT 完成原子去重和窗口推进；
- dedupe state 与 authenticated viewer state 分表；
- 三个 owner revision 与前端 owner-wise merge；
- public stats 与 private viewer state 分离；
- View 不使用 Command receipt；
- interaction/comment 使用 commandId 和 recovery；
- 匿名 ViewAck；
- mutation 只 patch 已存在 query，不重新建立 entity cache；
- structural sharing 检测 equal-revision conflict 后标 stale；
- permanent delete 与 view tracking 的 physical row lock 串行；
- cleanup delete-time `expires_at` recheck；
- counted view 与 MetricEvent 同事务，Analysis aggregation/retention 独立。

`articleStatsStructuralSharing(queryClient, queryKey)` 需要显式接收 `QueryClient`，主要是 TanStack success commit 会覆盖同步 invalidation，必须在
commit 后标 stale。这个签名不漂亮，但比全局 side channel 或新的 store 更透明，当前保留。

## 8. 次要优化

### 8.1 Cleanup SQL 的规模优化

当前 cleanup 先选择最多 500 个复合 key，再构造大型 OR predicate 删除；结束时还会精确 `COUNT` 所有 expired rows。当前预算下正确，
但高流量时 SQL planning 和全量 count 会变贵。

后续可改为单条 CTE/`DELETE ... USING` bounded batch，并将 backlog telemetry 改为 capped count 或 `exists + estimate`。这是容量优化，
不影响当前业务语义，优先级低于正确性和兼容层清理。

### 8.2 Upvote receipt 的边界

当前 receipt 名为 upvote，但保存完整 interaction viewer state。短期可以将其严格缩回 upvote-only；等 collect/emotion 有真实 UI consumer 和
confirmed-write overlay 需求后，再一次性切为 `ArticleInteractionReceipt`。不要长期维持“名字是 upvote、结构是通用 interaction、生产者却只有
upvote”的半泛化状态。

### 8.3 Session receipt 批量读取

列表 compose 当前逐 Article 调用 `readArticleViewAck` 和 `readArticleUpvoteReceipt`，会重复执行 sessionStorage `getItem` / JSON parse。
可在共享 hook/effect 中一次建立 ViewAck map 和 receipt map，随后按 `articlePathKey` 做内存查找，再将对应值作为参数传给纯
`composeArticleState`；composer 不直接读取或修改 sessionStorage。这是低优先级性能优化，不为此新增响应式 store，也不阻塞主切流。

### 8.4 Optimistic target 类型去重

`TAuthorityRefetch` 与 `TQueryTarget` 结构相似，但只有在 cancellation target 与 failure authority refetch 的业务语义也完全一致时才合并。
不要仅因字段形状相同而抽象，保持低优先级。

## 9. 测试评估

### 9.1 已有关键覆盖

后端：

- 同 actor/Article retry 与并发最多计数一次；
- 窗口过期后再次计数；
- human/agent window；
- signed anonymous session；
- unknown/policy excluded；
- service/delegation failure fail closed；
- cleanup 多批 drain、预算退出和续跑；
- cleanup delete 与 UPSERT 的真实 PostgreSQL 锁；
- permanent delete 两种并发顺序；
- owner projection repair 推进 revision；
- mutation payload 返回完整 ArticleStats/private state。

前端：

- owner-wise merge 和 owner regression；
- equal-revision conflict；
- Detail/Batch functional patch；
- mutation 不创建 stats entity cache；
- ViewAck；
- upvote/collect/emotion payload reconcile；
- 多 batch 分组和输入顺序。

### 9.2 本次补齐的覆盖

1. 真实 Context 的 `bot UA + automatic anonymous session`；
2. self-reported automation 保持 `unknown/probable/self_reported`，UA regex 包含 bot 正例和合法 UA 反例；
3. `articleStats` batch 混合存在、缺失、不可见 ID，并保留可见 Article 缺 projection 时的 `projection_not_updated`；
4. Article public reader 不再调用 private ViewTracker/Interactions reader；
5. receipt reconcile 复用主 interaction query，不产生第二个 query key 或遗留 `mergePrivateState` 写路径；
6. mutation 只取消包含目标 path 的 stats 和当前 account interaction queries；
7. Article 与 `commentViewerStates` private resolver 批量读取的 query-count / SQL-shape；`commentViewerStates` 可省略缺失项，现有
   `commentReconcileStates` 继续对每个输入保留 entry 并以 `comment: null` 表示缺失/不可见；
8. mutation payload 的 stats/private `interactionRevision` 各自保留权威读取值，两个 post-commit snapshot skew 时仍返回成功；
9. `articleStatsCache.contains/find/apply/queries` 覆盖 detail、batch、其他 Article 和其他 Community；`articleQueryKeys` 只保留 key
   constructor，list/batch-scope invalidation matcher 留在 invalidation 私有边界；原 `key.test.ts` matcher 断言分别迁入
   `articleStats.test.ts` 和 `invalidation.test.ts`，不导出 private matcher；
10. `viewerQueryKeys` 只保留 key constructor；两个 Article viewer cache matcher 下沉到 `viewer.ts`，view/interaction cache 写入与
    revision conflict 行为保持不变；
11. `articleStatsCache.apply` 使用 functional update 并保留 `dataUpdatedAt`；
12. `useArticleState` detail 与 `useArticleStates` list 都返回 `content/stats/viewerState`；
13. SSR/hydration/browser/mutation 使用相同 normalize；
14. QueryClient 与 View 共用 transport error 分类：确定性错误不 retry；QueryClient 对 `TypeError` 保持最多 retry 两次，View 最多
    retry 一次，并分别覆盖 budget 边界；
15. DB thread/key/expiry constraints 及 emotion revision 完整删除面；
16. 删除旧 content viewer fields 后的 generated schema 静态断言；
17. `DateTime`、emotion 和 reaction outcome 的 codegen 类型不依赖 `as never` 等补洞；
18. `ArticleRefInput` / `TArticleRef` / `articleRefOf` / `articleRefKey` 与所有 ArticlePath 手拼 key 已退出运行时代码和生成物，同时 Search、
    Press、Trash、Assets、Comment ref 与 React ref 未被误改；
19. `useArticleUpvote` 不再单独清 receipt，共享内部 effect 是唯一 clearer，`composeArticleState` 保持纯函数。

## 10. 文档收口

本次已同步修正 `article-view-counting.md` 主流程和测试清单中的 canonical entity 表述，并完成以下文档收口：

- `article-stats-and-viewer-state-sync.md` 将 entity seed、disabled observer 和整体快照拒绝明确标成历史机制；
- 当前流程示例统一为 `articleQueryKeys`、`viewerQueryKeys`、`ArticlePathInput` 与 `paths`；
- `query-invalidation.md` 使用当前真实 Detail/Batch query 与 path 级 matcher 边界；
- `article-stats-and-public-cache.md` 将共享 entity 归一化保留为已取代的历史合同；
- `Articles.Response` 只描述 public presentation，不再承诺 current-viewer hydration；
- 已删除 mutation article legacy cache helper，不保留注释或 alias。

历史 migration 文件本身不是运行时兼容层。除非所有环境都确认尚未应用并决定 squash，否则不要为了清理名词修改已经执行过的 migration body；
最终 schema 的删除和约束应通过新的 direct-cutover migration 表达。

## 11. 已完成实施切片

```text
Slice 1  correctness / concurrency                              [done]
  -> 修正 anonymous + self-reported automation 分类优先级，保持 unknown/probable/self_reported
  -> 补真实 Context 与 User-Agent 正例/反例测试
  -> 修复 articleStats batch missing-ID，并保留 projection_not_updated
  -> stats + interaction query cancellation 精确到 Article path
  -> QueryClient / View 共用 isRetryableTransportError 分类；QueryClient 保持两次 budget，View 只 retry 一次

Slice 2  GraphQL hard cut / 后端批量读取                         [done]
  -> 删除 Article content private fields
  -> Articles.Response 只保留 public presentation
  -> 删除 PostThreadFresh
  -> 删除 dead content mutation helpers / selectArticleFromCache
  -> 删除 patchArticleChanges / patchArticleEverywhere / articleQueryTargets 及无调用方 isArticleEntity，保留仍在使用的 optimistic shared types
  -> ArticleRefInput / refs 直接切为 ArticlePathInput / paths，并建立 canonical articlePath.ts、TArticlePath、articlePathOf、articlePathKey
  -> 原子更新 articleRef.ts 的 8 个 importer 后删除旧文件，不保留 alias
  -> viewerKeys 改名为 viewerQueryKeys，参数 articleKeys 改为 articlePathKeys，并同步所有 importer
  -> viewerQueryKeys 只保留 constructor；matchesArticleState / matchesArticleInteractionState 下沉为 viewer.ts 私有 cache matcher
  -> 不新增 viewerStateCache、viewerQueryMatchers 或 store
  -> 同步 resolver、operations、tests 和 codegen
  -> Article private state resolver 批量读取
  -> commentViewerStates 复用 Reader.reconcile_comments/4；reconcile 现有 nullable entry 语义保持并补测试
  -> codegen + consumer 静态审计

Slice 3  写后 payload 收口                                      [done]
  -> Interactions read state 直接提供 viewerEmotion
  -> ArticleStatsPayload.load 保持唯一 stats 读取+映射入口，不新增 singular FrontDesk wrapper
  -> ArticleInteractionPayload.from 保持纯 mapper
  -> 各 mutation 保留专用 payload，不建立万能 presenter
  -> Comment 领域结果统一携带 Article
  -> stats/private interactionRevision 独立来源与 post-commit snapshot skew 测试

Slice 4  前端 Query cache / hooks / types                       [done]
  -> reconcile 复用主 interaction query，删除 subset query、mergePrivateState 写路径和 useArticleUpvote 重复 clearer
  -> 共享内部 effect 成为唯一 receipt clearer；composeArticleState 保持纯函数
  -> 删除 mutation/article/cache.ts 中重复的 TArticlePath / articlePath / articleKeyFor，不删除 canonical articlePath.ts
  -> 将所有手拼 path key 收口到 Slice 2 建立的 articlePathKey
  -> ViewAck articleRef 改为 articleKey，同时 bump ACK_VERSION 到 2，不读旧字段
  -> invalidation 删除 TArticleInvalidationRef，target 统一使用 path
  -> articleKeys 改名为 articleQueryKeys
  -> articleQueryKeys 只保留 key constructor
  -> isStats / isStatsBatch / matchesStatsBatch 收口到 articleStatsCache.contains
  -> matchesArticleList / matchesStatsBatchScope 下沉为 invalidation/article.ts 私有 helper
  -> key.test.ts 的 matcher 断言迁到 articleStats.test.ts / invalidation.test.ts，通过公开行为覆盖，不为测试导出私有 helper
  -> articleStatsCache 统一 contains/find/apply/queries，不新增 articleQueryMatchers 中间层
  -> apply 使用 functional setQueryData 并保留 dataUpdatedAt
  -> useArticleState(s) 共享 private/effect/composer，不合成巨型 hook
  -> TArticleState 统一 content/stats/viewerState，并更新 Provider、Posts、Changelogs、Kanban 与测试 ripple
  -> browser/SSR/hydration/mutation 统一 normalize
  -> 收紧 normalized types 和 GraphQL scalar/enum

Slice 5  数据库与文档                                           [done]
  -> 新 migration drop view_counting_rule_changes，同批删除 model；不修改历史 seed migration
  -> 删除 article_emotion_counts.interaction_revision 及 schema/write/rebuild/test 全部引用
  -> 补 CHECK / rename index
  -> 更新过期流程图和测试合同

Slice 6  全链路验收                                             [done]
  -> Context、Gate subset、query-count、payload revision
  -> cache targeting、Detail/List、SSR/hydration、codegen
  -> backend/frontend focused tests + frontend-core type-check

独立后续  容量与 Edge
  -> cleanup CTE batch
  -> backlog telemetry 成本优化
  -> Cloudflare/Edge 待办独立实施和验收
```

每个 Slice 都是直接切换；不增加旧字段 alias、双读、双写、fallback repair 或 compatibility wrapper。

## 12. 最终验收结果

2026-09-28 direct cutover 完成后执行了以下全量门禁：

- 后端全量测试：`2239 passed, 0 failures, 1 excluded`；
- 后端 test migration 与 `mix compile --warnings-as-errors`：通过；
- Frontend Core 全量 Vitest：`238 files, 1016 tests passed`；
- Frontend Core / Community type-check：通过；
- Frontend Core / Community lint 与 format check：通过；lint 只保留仓库既有 warning，无新增 error；
- GraphQL repository contract、static source、generated source 与 urql migration gate：通过；
- GraphQL codegen、Query invalidation boundary 与 `docs:check`：通过；
- `git diff --check`：通过；
- 运行时代码与生成物中不存在 `ArticleRefInput`、`TArticleRef`、`articleRefOf`、`articleRefKey`、旧
  `view_counting_rule_changes` model 或 `article_emotion_counts.interaction_revision` 引用。

因此本轮主链路已经收口。Cloudflare/Edge 防滥用和低优先级 cleanup/telemetry 容量优化仍是明确隔离的独立后续，不属于本次实现缺口。
