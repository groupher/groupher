# Query Sync Cache：公共数据、Viewer 状态与主动失效

> 状态：公共 SSR no-user-spec、客户端 `Q.viewer`、theme first-paint、`Q.dsb.config`、
> `DsbEditStore` 和 cache adapter/mutation reconcile 已在本地落地（2026-08-29）。Cloudflare
> 生产 purge 与跨 PoP 验证仍属于发布门。执行清单见
> [`../workflow_query_store_reorg.md`](../../dash/query-store-workflow.md)。
>
> 本文只定义 `frontend/community` 的缓存边界和 revalidation。Dash 通过自己的 TanStack Start
> route/API 调用 Community revalidation，不使用 Next.js cache API。
>
> 当前协议仍允许刷新后 public aggregate 短暂旧值。当前 viewer 跨刷新的 read-your-writes 见
> [Optimistic Read Your Writes](./optimistic-read-your-writes.md)；当前客户端已对 Article upvote 与
> Comment reaction/feed 提供覆盖 public CDN fresh + stale window 的有界 TTL receipt 兜底；Article/Comment reaction 的 commandId/revision
> 字段已接通；Comment create/reply/update/delete 也已绑定 commandId，public revision selector、
> write receipt slot 和 private reconcile 已接通。SSR 首帧仍可能短暂显示旧 public HTML，hydrate 后收敛；
> Cloudflare 生产 purge 与跨 PoP 验证仍属于发布门。
> mutation 刷新前的 identity、inverse rollback、queueKey 与 confirmed handoff 见
> [Optimistic Operation](./optimistic-operation.md)，其中 O1/O3/O4/O5 的客户端接线、后端幂等和 revision
> 阶段已落地。

## 结论

TanStack Router 有自己的 route loader cache，TanStack Query 有 query cache，但它们
主要解决单次请求和浏览器会话内的数据复用，不提供 Next `revalidateTag()` 那种跨
请求、全局 CDN tag purge 原语。TanStack Start 的跨请求缓存使用标准 HTTP
`Cache-Control`，按需失效交给部署平台。

Community 在 Cloudflare 上采用四层模型：

```text
SSR request
  -> Community / Dash getRouter 创建 request-scoped QueryClient
  -> Router context.queryClient + loader.ensureQueryData
  -> SSR Query integration 自动 dehydration / hydration / streaming
  -> TanStack Query cache
  -> Cloudflare public CDN cache
          ^
          |
Dashboard mutation -> Community revalidation endpoint -> purge by Cache-Tag
```

因此迁移目标是保留“哪些数据能缓存、多久、由什么事件失效”，不是复刻
`'use cache'`、`cacheLife()`、`cacheTag()` 或 `revalidateTag()` 的函数形状。

## 缓存层职责

| 层                       | 作用域                         | 适合缓存                                             | 失效方式                                     |
| ------------------------ | ------------------------------ | ---------------------------------------------------- | -------------------------------------------- |
| request cache            | 单次 SSR 请求                  | 同请求重复 GraphQL/fetch                             | 请求结束自动释放                             |
| Router loader cache      | 单浏览器 route 生命周期        | route 调度结果、head projection、非 Query route data | `staleTime`、`gcTime`、`router.invalidate()` |
| TanStack Query           | 单浏览器，SSR 时每请求独立     | 列表、详情、交互后可更新的数据                       | query key invalidation/update                |
| Cloudflare CDN/Cache API | 跨请求、跨实例的公开数据或响应 | community shell、公开列表/详情                       | TTL + 全局 purge by tag                      |

Router `staleTime` 决定 loader result freshness，Query `staleTime` 决定 query data
freshness；二者都不能代替 CDN TTL，也不能保证 Dashboard 改完配置后线上立刻更新。
对由 Query 管理的 server state，Router preload freshness 设为 `0`，由
`ensureQueryData` 和 Query `staleTime` 作唯一的数据 freshness 判断。

SSR 的 QueryClient 必须按请求创建，不能放在 Worker 全局作用域，避免用户数据串请求。
Community 和 Dash 使用相同的 Router Query SSR 初始化模式，但各自拥有独立 Router 和
QueryClient；不使用 Next QueryProvider、`Q.SSR`、手工 `HydrationBoundary` 或 render-time
`setQueryData` 桥接。

## 公共和私有响应边界

公开缓存的响应必须完全与 viewer 无关。只要 SSR 输出确实依赖 cookie、登录用户、权限、
订阅/收藏状态或私有 GraphQL header，就返回：

```http
Cache-Control: private, no-store
```

不能只依赖 `Vary: Cookie` 作为安全边界。更理想的结构是把公开 shell/文章内容与
viewer state 拆开：公开部分可进入 CDN，登录态在 hydration 后或独立私有请求加载。

公开响应由 Community 明确设置 `Cache-Control` 和 `Cache-Tag`。不得让“请求中碰巧有
cookie”改变同一 public cache key 的内容，也不能仅因 cookie 存在就把本可复用的公共响应降级为
private。目标 Community SSR loader 从 GraphQL selection 开始只请求公共 community、article、
comment 和 Dsb 配置；account、subscription 以及全部 `viewerHasXxx` 在 hydration 后由独立客户端
query 获取。

theme 也遵循公共响应边界：SSR 输出稳定的默认 theme；现有 pre-paint script 在 hydration 前读取
浏览器可读的 theme cookie 和 `prefers-color-scheme`，应用用户选择。服务端读取 theme cookie 并
输出不同 HTML 会污染 public response，不能作为例外。

这两组依赖必须原子切换：`Q.viewer.session()` 和登录 UI 就位后，同一实现切片从
`loadCommunity/TCommunityShell` 删除 account；pre-paint 就位后，同一实现切片让 `loadThemeSeed`
停止读取 cookie。在各自切换完成前，不得提前把依赖身份或 theme cookie 的响应标记为 public。

客户端 user-specific query 统一位于 `Q.viewer`：

```text
Q.viewer.session()
Q.viewer.communityState(accountRef, community)
Q.viewer.articleStates(accountRef, articleRefs)
Q.viewer.commentStates(accountRef, articleRef, commentRefs)
```

`accountRef` 是 non-secret、opaque、immutable public account ref，并进入所有用户实体 query key。
session query 负责得到当前账号和 accountRef；它自身不以 accountRef 为参数。当前 authenticated
session、viewer Query、toggle 和 receipt key 已统一使用稳定 accountRef，不暴露数据库 `user_id`，
也不复用 device/session 级 BrowserSession ref。

当前
`frontend/core/stores/account/hooks.tsx` 已通过 `graphqlQueryOptions + useQuery` 请求 session，目标是
把该 generic query 收进 `Q.viewer.session()`，再移除 Community shell 中的 account seed。

article/comment viewer operation 必须按 canonical refs 批量查询，不能继续通过 public list 的
filter、page 或 mode 间接获取。排序、去重后的 refs 同时生成 query key 和 GraphQL variables；响应
再按 `community + thread + innerId` 或 comment id 归一化。

未返回前的 viewer 字段是 `undefined`，不是 `false`。登录、登出和账号切换必须清除全部 viewer
queries；跨 tab 继续通过 session channel/BroadcastChannel 通知后再清除和 refetch。

## Version/revision 边界：当前不新增 Query revision

当前阶段采用“公共数据允许短暂最终一致，viewer/mutation 保证当前用户状态”的方案，
不新增 `publicRevision`、`querySync` 或 `syncKey`，也不复用现有 Article/Doc 的领域
版本字段作为 CDN 同步版本。

后端已有多套独立机制：

| 机制                                                     | 真实职责                              |
| -------------------------------------------------------- | ------------------------------------- |
| `Article.version`                                        | 文章内容/草稿并发版本和发布时版本传递 |
| `ArticleLifecycle.version`                               | Article 生命周期状态转换和冲突控制    |
| `DocSnapshot.revision_number` / `version_hash`           | Doc 不可变快照、diff 和 restore       |
| `DocsSiteState.tree_lock_version`                        | 文档树编辑冲突检测                    |
| `DocsSiteState.site_draft_version` / `published_version` | Docs 草稿与公开树发布状态             |
| interaction projection `updated_at`                      | 点赞、收藏、评论等聚合投影的更新时间  |

它们不能互相替代：Article 内容版本不会因为用户点赞而增加，Doc snapshot revision
也不表示评论列表已经更新。Article `id` 只用于定位同一资源，不用于判断两个缓存是否
来自同一时刻。

### 当前一致性协议

```text
Phoenix mutation response
  -> 返回该 operation 能确认的 viewer 状态和 public aggregate

TanStack Query
  -> 当前 mutation tab 立即 patch detail/list/viewer cache

刷新页面
  -> public HTML 可以来自 CDN 旧快照
  -> viewer query 立即恢复当前用户 flags
  -> public count 继续按 TTL/SWR、purge 或 public refetch 收敛

其他用户
  -> 允许在 TTL/SWR 或批量 purge 窗口内看到旧公共快照
```

viewer query 当前只应拥有 viewer fields，不能假定它总会返回 canonical public counts，更不能
用它覆盖 public query。若某个 mutation payload 已明确返回确认后的 aggregate，当前 tab 可以 patch；
刷新后公共 count 允许短暂旧值。只有产品明确要求刷新后也同步校准公开计数时，才为对应 read model
增加 public aggregate/sync token，而不是悄悄扩大 viewer query 所有权。

跨刷新 read-your-writes 的具体提案采用 projection-domain revision、短期 confirmed write receipt
和 receipt-triggered private reconcile，见
[Optimistic Read Your Writes](./optimistic-read-your-writes.md)。其中 public revision 与
viewer-private relation 保持分离；这不是持久化整个 TanStack Query cache。

### 后续触发条件

只有出现以下真实需求时，才重新评估 API 层的 opaque sync token：

- public query 和 viewer query 无法判断是否来自同一份读快照；
- 需要使用 ETag/条件请求减少公共数据重传；
- 公共 projection 已经有稳定、原子、可递增的版本来源；
- 产品要求跨内容、互动、权限和发布状态进行严格一致性校验。

届时应先定义 `querySyncToken` 的 read-projection 语义，再决定是否需要持久化公共
projection version；不能直接把 Article `version` 或 Doc `revision` 改作通用缓存版本。

## 备选方案：当前不采用

以下方案保留为后续演进路径。它们不是当前方案一的隐含实现，也不应在没有真实一致性
需求和线上证据时提前引入。

### 方案 A：Query sync token / ETag

公共 query 和 viewer query 同时返回一个 API 层的 opaque token，或使用公共响应的
ETag 做条件校验：

```text
public response  -> syncToken / ETag A
viewer response  -> latest public token / ETag B

A != B
  -> viewer 状态立即可用
  -> public query 后台重新验证
```

适用场景：

- 公共数据和 viewer 数据经常出现无法判断的错位；
- 需要减少整份公共 payload 的重新传输；
- 后端已经有稳定的 read-projection 时间戳或版本来源。

代价：它只能检测或确认快照关系，不能让 CDN 立即产生新数据；如果 token 由多个
独立 projection 的时间戳拼成，还不能宣称是原子快照版本。

### 方案 B：持久化 public projection version

为公共读模型建立独立、单调递增的版本：

```text
public_article_projection.version
```

所有会影响公共投影的事件都推进该版本，包括：

- Article 内容、slug、发布状态和权限变化；
- upvote/collect/comment count 变化；
- moderation 和可见性变化；
- 需要出现在公共列表或详情中的聚合字段变化。

公共 query、viewer query、Cache-Tag 和 mutation response 都携带这个版本。

适用场景：

- 产品要求严格判断公共内容是否为同一读快照；
- 多个异步 projection 需要统一水位；
- 需要按版本做审计、重放或增量同步。

代价：需要新的后端投影边界、事务/事件顺序、失败重放和一致性测试。它不能复用
`Article.version`、`DocSnapshot.revision_number` 或 `DocsSiteState.tree_lock_version`。

### 方案 C：登录用户 private SSR

匿名请求继续使用公共 CDN，登录请求直接返回 private SSR：

```text
anonymous  -> public CDN HTML
logged-in  -> private SSR HTML + viewer state
```

适用场景：

- viewer 状态必须在首个 HTML 中出现；
- 权限、账户导航或个性化内容不能等待客户端请求；
- 登录用户流量相对较小，可以接受失去共享 CDN。

代价：登录用户每次 SSR 都要回源，并失去“公共 SSR + client merge”的 CDN 优势；也不能解决
高频 mutation 的全局即时一致性。

### 方案 D：Edge assembly / private fragment

Cloudflare Worker 缓存公共 HTML 或公共数据，再在边缘读取私有 viewer endpoint，最后
组合响应：

```text
public HTML/data cache
  + private viewer fragment
  -> edge assembled response
```

适用场景：

- 必须保留公共内容的边缘缓存；
- 又必须在首屏生成个性化状态；
- 团队愿意维护边缘组合、超时、失败降级和可观测性。

代价：组合后的完整响应仍不能作为所有用户共享的公共 HTML；缓存、Cookie、失败降级
和流式输出都会变复杂。它本质上是把浏览器 client merge 提前到了 Edge，不是消除
公共/私有边界。

### 方案 E：按用户维度缓存 HTML

以用户或会话为缓存 key：

```text
/post/23 + user-A
/post/23 + user-B
```

适用场景极少，只适合页面高度个性化且用户数量、缓存生命周期和隐私边界都可控的
系统。Community 的公开文章和互动页面不采用该方案，因为缓存基数、失效成本和隐私
风险都过高。

### 备选方案决策顺序

```text
方案一：public CDN + private viewer + canonical mutation response
  ↓ 只有出现无法判断的错位
方案 A：sync token / ETag
  ↓ 只有需要跨 projection 严格统一水位
方案 B：public projection version
  ↓ 只有首屏必须包含个性化状态
方案 C：private SSR 或方案 D：Edge assembly
  ↓ 极特殊的高度个性化系统
方案 E：per-user HTML cache
```

当前 Community 停留在方案一，不实现以上备选方案。

## 语义 tag

继续复用 `frontend/core/constant/cache.ts` 的 tag vocabulary，因为它描述的是业务
依赖关系，不是 Next.js 专属 API：

```text
community[slug]
community[slug]-thread[thread]-tags
community[slug]-thread[thread]-articles
community[slug]-thread[thread]-article[id]
community[slug]-thread[thread]-article[id]-comments
community[slug]-doc-tree
```

tag constructor 与 revalidation validator 必须共享一个合同：`frontend/core/constant/cache.ts`
同时提供 `CACHE_TAG` 和 `isCacheTag`，Community endpoint 直接使用该 validator，
不再维护独立 `TAG_PATTERN`。新增或修改 tag 时，同一提交更新 constructor、validator 和覆盖全部
constructor 的契约测试；不保留旧 vocabulary 或兼容分支。

`frontend/core/query/cacheInvalidation.ts` 的 `mutationCacheEffect` 统一回答“mutation 是否产生公共
缓存副作用、以什么模式执行、影响哪些语义 tag”。Core 只产出 typed effect；Community 和 Dash
GraphQL server proxy 都在 Phoenix mutation 成功后解释该 effect。浏览器 mutation hook 不调用
CDN revalidation，也不等待 purge。

## 当前 Community SSR loader

Community loader 位于 `frontend/community/src/server/community.ts`，theme 位于同目录的
`theme.ts`：

| Loader                                        | 公开数据                         | Cache tag / 目标边界                                        |
| --------------------------------------------- | -------------------------------- | ----------------------------------------------------------- |
| `loadCommunity`                               | community、Dsb config、wallpaper | community tag；移除 account、auth token 和 viewer selection |
| `loadPosts` / `loadChangelogs` / `loadKanban` | 默认公开列表                     | 对应 thread articles tag                                    |
| `loadPost` / `loadChangelog`                  | 公开详情                         | article + articles tag                                      |
| `loadDocTree`                                 | 公开 Doc tree                    | `community[slug]-doc-tree`                                  |
| `loadDoc`                                     | 公开 Doc detail                  | doc article tag                                             |
| `loadComments`                                | 公开 comments                    | comments tag；写入 cache 前裁剪 viewer fields               |
| `loadThemeSeed`                               | 公共默认 theme seed              | 不读取 cookie；用户 theme 由 pre-paint 应用                 |

不在这份清单中的 locale、theme presets、tag groups 和 tag stats 不伪造成现有 SSR loader；将来确实
接入时再建立对应 Query、cache policy 和 tag。

## Views side effect 与缓存

Views 不是普通缓存字段，读取本身会产生写 side effect：

| 链路           | 当前触发方式                                           | CDN cache 影响                                      |
| -------------- | ------------------------------------------------------ | --------------------------------------------------- |
| community      | `loadCommunity` 调用 community GraphQL read            | 命中 CDN 时不回源，因此不是每个 HTTP request 都增加 |
| article detail | `loadPost/loadChangelog/loadDoc` 触发对应 GraphQL read | 命中 CDN 时不执行新的 read/view event               |

当前 Article detail query 已通过稳定的 `viewEventId` 记录客户端 durable view event；它不是
独立 GraphQL mutation。服务端按 event identity 幂等接受，再由 worker 推进 `views`/viewer
projection。`frontend/core/query/cacheInvalidation.ts` 中 mutation regex 包含 `View`，只说明
失效匹配允许这类 operation name，不能把它当作已有 View mutation。页面访问、源读取和
客户端 event 的计数语义仍必须分别测试，不能让 CDN/Router `staleTime` 偶然决定计数。

## Dashboard → Community 主动失效

### 协议

Community 提供内部签名入口，例如：

```http
POST /internal/cache/revalidate
Authorization: Bearer <service-secret>
Content-Type: application/json

{
  "tags": ["community[home]"],
  "reason": "dashboard.community.update"
}
```

入口必须：

- 只接受服务间认证，拒绝浏览器 cookie 作为授权；
- 校验 tag 格式、数量和 community scope，禁止任意 purge；
- 幂等；单个 tag 不存在也返回成功；
- 记录 actor、reason、tags、耗时和 Cloudflare purge result；
- 调用 Cloudflare 全局 purge-by-tag API，不把 `cache.delete()` 当成全局失效；
- purge 失败返回非 2xx，让 Dashboard mutation 流程可观测并可重试。

Cloudflare purge by tag 的可用性取决于实际 zone/套餐。Phase C0 必须先验证能力；若
不可用，revalidation endpoint 仍接收同一套语义 tag，但 adapter 改用可控的版本化
cache namespace，或维护精确 URL 清单执行 purge。不能在不具备全局 purge 能力时用
当前 PoP 的 `cache.delete()` 冒充对等实现。

### Purge 频率与合并策略

Cloudflare purge 不是每次点赞、收藏或浏览都触发。高频 interaction 不需要让公共 CDN
立即更新，因为当前用户由 mutation response/Query patch 保证，其他用户允许在短 TTL
或 stale-while-revalidate 窗口内看到旧计数。

默认分层：

| 事件                                     | 当前用户                                     | 公共 CDN                                           |
| ---------------------------------------- | -------------------------------------------- | -------------------------------------------------- |
| 文章正文、标题、slug、发布状态、权限变化 | mutation response 后立即更新                 | 高优先级立即 purge 相关 tag                        |
| 社区主题、SEO、导航、wallpaper 配置      | mutation response 后立即更新                 | 高优先级立即 purge community tag                   |
| 点赞、取消点赞、emotion、浏览            | mutation response + Query patch              | `none`：不逐次 purge，依 TTL/SWR                   |
| 评论新增、删除、内容或 moderation        | 当前 comments/query 立即 patch 或 invalidate | `immediate`：立即 purge 相关 comments/article tags |

当前首版对高频 interaction 明确返回 `none`，没有伪装成已实现的合并队列。只有后续确有实时传播
需求，并接通真实 queue、按 tag 去重、最大等待和失败策略后，才能把相应 operation 改为
`coalesced`。内容、权限和配置 mutation 保持 `immediate`。

```text
interaction mutation
  -> Phoenix commit
  -> current browser Query patch
  -> CacheEffect mode=none
  -> TTL/SWR 自然收敛

content or permission mutation
  -> Phoenix commit
  -> immediate flush affected tags
```

### 调用链

```text
Dash 保存配置
  -> Phoenix mutation 成功
  -> Dash GraphQL proxy 计算 typed CacheEffect
  -> Worker waitUntil（不阻塞业务 response）
  -> Community /internal/cache/revalidate
  -> Cloudflare purge by tag
  -> 下一次 Community 请求回源并写入新响应
```

`frontend/dash/src/server/community-revalidation.ts` 是 Dash 的服务端传播边界；GraphQL proxy 和
手工 revalidation route 都复用它。它使用 service secret 调用 Community
`/internal/cache/revalidate`，包含超时、一次重试和结构化日志。当前 Tab 仍先通过 mutation response
更新 Query；传播失败不会改变已经返回的业务结果。

## 当前代码落地

以下主线代码契约已经在 `frontend/community` 和 `frontend/dash` 中落地。typed CacheEffect、
server proxy 传播和最终 response-context tag 聚合已按
[`../query_store_boundary_hardening.md`](../../architecture/query-store-boundary.md) 收口：

- [x] Community/Dash 各自按请求创建 QueryClient，并通过 Router context 接入官方 SSR
      Query integration；Router preload freshness 固定为 `0`。
- [x] shell、post、changelog、Kanban、doc tree/detail、comments 均由 typed query options + `ensureQueryData` 作为 SSR 数据入口；Community route 没有 render-time
      `setQueryData`。
- [x] public/private response header helper 已统一：当前实现仍把带 auth token 的请求标记为
      `private, no-store`，匿名公开数据写入 `Cache-Control` 和语义 `Cache-Tag`。
- [x] Community `/internal/cache/revalidate` 已完成 service-secret、tag scope、数量和
      body 校验；Cloudflare purge adapter 在未配置生产凭据时明确返回配置缺失，而不是
      假装完成全局失效。
- [x] Community GraphQL mutation 与 Dash revalidation 使用同一 `CACHE_TAG` vocabulary，并保留
      “业务 mutation 成功、purge 失败可观测且可重试”的状态边界。

仍需真实部署凭据才能完成的不是本地代码契约，而是发布证据：Cloudflare zone/套餐的
purge-by-tag 能力、跨 PoP 命中与失效、production hit/miss/purge metrics/告警，以及 Dash
mutation 在真实 Phoenix、Community 和 Dash URL 上的端到端观察。以下是已经收口的主线边界：

- `loadCommunity` 只请求 no-user-spec community/Dsb/wallpaper；带 cookie 不改变公共内容与 TTL；
- `loadThemeSeed` 使用固定公共 seed，用户 theme 由 hydration 前 pre-paint 逻辑应用；
- session、community/article/comment viewer state 统一进入 `Q.viewer`，并按 accountRef 隔离；
- article/comment viewer operation 使用 canonical refs，排序去重，超过 100 条自动分片并合并；
- `Q.dsb.config` 是确认配置 owner，`DsbEditStore` 只持有可编辑 working copy，旧 Dsb runtime 和
  confirmed duplicate 已删除；
- `mutationCacheEffect` 使用显式 operation 集合和精确 tag 规则，不使用 regex fallback；高频
  upvote/emotion 为 `none`，内容、权限和配置变化为 `immediate`。

`CreatePost` 是一个需要单独登记的例外：它的 variables 只有 `community`，没有 article path，
因此不能依赖通用 article-path 解析。发帖成功后必须失效
`CACHE_TAG.articlesCache(community, POST)`，并 invalidate 当前 Tab 的 posts Query。当前
checkout 尚未发现可执行的 Dash `CreatePost` 调用点；typed effect 已显式映射并由 contract test
锁定，路径启用后 Dash GraphQL proxy 会自动执行该映射。

对于在 Community 内发生的文章/评论 mutation：

1. 立即更新或 invalidate 当前浏览器的 TanStack Query；
2. 只有 route-local 非 Query 数据或 head projection 需要重算时，才定向 invalidate 相关
   route；不使用无范围的 `router.invalidate()` 代替 query invalidation；
3. server proxy 按 typed effect 处理语义 tags：内容和权限变化立即执行；高频 interaction 返回
   `none` 并依 TTL/SWR，不逐次 purge；
4. CDN purge 成功后，其他浏览器和后续 SSR 才能看到新数据。

只做前两步会导致“当前浏览器看起来更新了，其他用户仍命中旧 CDN”。只做 CDN purge
则会让当前页面继续显示旧的 Router/Query cache。

## 失效映射最低要求

| 事件                                                       | 必须失效                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------- |
| Dashboard 社区基础信息、主题、wallpaper、SEO、导航配置变更 | community tag                                                   |
| Post/Changelog/Kanban 新增、删除、发布状态或排序变化       | 对应 articles tag，必要时 article tag                           |
| 文章内容或 slug 更新                                       | article tag + 对应 articles tag                                 |
| 评论新增、删除、reaction 或 moderation                     | comments tag；若列表展示评论计数，同时失效 article/articles tag |
| tag 配置变化                                               | tags tag + 受影响 articles tag                                  |
| Doc tree 结构变化                                          | `community[slug]-doc-tree`                                      |

其中 `CreatePost + community` 必须显式映射到
`CACHE_TAG.articlesCache(community, THREAD.POST)`；不能要求 `readPath(variables)` 从不存在的
`variables.article` 推导该 tag。

最终映射要和 Phoenix mutation 逐项核对，不能依赖 GraphQL operation name 的模糊字符串
判断作为唯一长期机制。

当前 `mutationCacheEffect` 使用显式 operation-name 集合映射到 mode 和精确业务 tag；这已移除原先的 regex
fallback。后续若 mutation 数量继续增长，再评估由 operation 定义或 GraphQL codegen 生成 typed
cache effects，不在本轮引入通用 registry。

## 实施步骤

### Phase C0：冻结现状

- [x] 为 `server/community.ts` 的 `loadCommunity/loadPosts/loadPost/loadChangelogs/loadChangelog/loadKanban/loadDocTree/loadDoc/loadComments`
      和 `server/theme.ts` 的 `loadThemeSeed` 记录 selection、viewer 依赖、header、tag 和调用页面；
- [x] 冻结每个公开响应的 TTL、stale 和 private/public 属性；
- [x] 将 `CACHE_TAG` constructor 与 revalidation validator 收敛到同一 vocabulary，并覆盖 doc-tree；
- [x] 冻结 community/article views 的目标触发语义及幂等策略，避免 cache hit/miss
      成为隐式计数规则；
- [ ] 验证生产 Cloudflare zone 的 purge-by-tag 能力。

### Phase C1：建立 Community cache adapter

- [x] Dash/Community 显式声明 React Query 与 SSR Query integration 直接依赖；Core 通过现有 workspace
      依赖提供 React Query，文档检查所需的 `@babel/parser` 已补入 root devDependency；
- [x] Query `staleTime`/`gcTime` 与 Router loader/preload freshness 分工；
- [x] 统一的 public/private response header helper；
- [x] Community `Cache-Tag` 写入和 Cloudflare purge client；
- [x] 内部签名 revalidation endpoint、日志、超时与重试。

### Phase C2：接通 mutation

- [x] Dashboard 和 Dash 配置 mutation 调用 Community revalidation；
- [x] Community 文章/评论 mutation 按事件等级处理 Query 和 CDN；高频 interaction 为 `none`，
      内容 mutation 为 `immediate`，不再逐次 purge interaction；
- [x] 对部分失败定义状态：业务 mutation 已成功但 purge 失败时记录结构化错误并有限重试，不回滚
      业务。durable replay 不是当前 `immediate` adapter 的能力，若产品要求必须另建队列合同。

### Phase C3：验证

- [x] Dashboard 改 theme/wallpaper/SEO 后的 Query update/invalidation 与 revalidation 调用链通过本地测试；
- [x] article mutation 后 detail 和 list 的精确更新/失效映射通过本地测试；
- [x] comment mutation 后 comments 和计数的契约映射通过本地测试；
- [x] 匿名和登录用户使用同一份 no-user-spec 公共 SSR；viewer state 仅在客户端私有请求出现；
- [x] 两个账号和两个社区的 viewer query key 隔离，logout/account switch 清理逻辑通过本地测试；
- [x] theme pre-paint 在 hydration 前应用用户选择，SSR seed 与 theme cookie 无关；
- [x] public/viewer 合并按 community + thread + innerId 等 canonical identity 校验，无 offset 错配；
- [ ] purge 在不同 Cloudflare PoP 生效，而不是只删除当前数据中心缓存；
- [ ] 记录 hit/miss/purge metrics，并对 purge 失败建立告警。

## 官方能力边界

- [TanStack Router data loading](https://tanstack.com/router/latest/docs/guide/data-loading)：
  loader SWR cache、`staleTime`、`gcTime` 和 preload 行为；
- [TanStack Router data mutations](https://tanstack.com/router/latest/docs/guide/data-mutations)：
  `router.invalidate()` 负责 loader cache，Router 本身不管理 mutation state；
- [TanStack Query SSR](https://tanstack.com/query/latest/docs/framework/react/guides/ssr)：
  SSR QueryClient 必须按请求创建；
- [TanStack Start ISR](https://tanstack.com/start/latest/docs/framework/react/guide/isr)：
  跨请求缓存通过 HTTP/CDN，按需 revalidation 调 CDN API；
- [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/) 和
  [purge by tags](https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/)：
  本地 Cache API delete 与全局 tag purge 的职责不同。
