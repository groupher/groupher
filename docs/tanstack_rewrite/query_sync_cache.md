# Query Sync Cache：公共数据、Viewer 状态与主动失效

> 状态：代码契约已落地；Cloudflare 生产 purge 与跨 PoP 验证仍属于发布门。
>
> 本文只定义 `frontend/community` 的缓存边界和 revalidation。Community 不兼容
> Next.js cache API；现有 Main 继续使用自己的 Next 实现。

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
QueryClient；不复用 Main/Dashboard 的 Next QueryProvider、`Q.SSR`、手工
`HydrationBoundary` 或 render-time `setQueryData` 桥接。

## 公共和私有响应边界

公开缓存的响应必须完全与 viewer 无关。只要 SSR 输出依赖 cookie、登录用户、权限、
订阅/收藏状态或私有 GraphQL header，就返回：

```http
Cache-Control: private, no-store
```

不能只依赖 `Vary: Cookie` 作为安全边界。更理想的结构是把公开 shell/文章内容与
viewer state 拆开：公开部分可进入 CDN，登录态在 hydration 后或独立私有请求加载。

公开响应由 Community 明确设置 `Cache-Control` 和 `Cache-Tag`。不得让“请求中碰巧有
cookie”改变同一 public cache key 的内容。

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
  -> 返回 mutation 后的 viewer 状态和 canonical public counts

TanStack Query
  -> 立即 patch 当前用户的 detail/list/viewer cache

刷新页面
  -> public HTML 可以来自 CDN 旧快照
  -> viewer query 返回当前状态和 canonical counts
  -> 客户端用 viewer 结果修正旧公共计数

其他用户
  -> 允许在 TTL/SWR 或批量 purge 窗口内看到旧公共快照
```

这个协议已经覆盖当前需要解决的“当前用户刚操作后”和“刷新后状态恢复”问题，不需要
为了理论上的快照比较引入新的领域 revision。

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

代价：登录用户每次 SSR 都要回源，Main 当前“公共 SSR + client merge”的 CDN 优势会
减少；也不能解决高频 mutation 的全局即时一致性。

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
和流式输出都会变复杂。它本质上是把 Main 的 client merge 提前到了 Edge，不是消除
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
```

Theme presets 是平台级数据。如果需要主动失效，应新增独立的
`platform-theme-presets` tag；该 tag 不是当前 `CACHE_TAG` 的既有成员，也不能由任一
community tag 代替。

`frontend/core/query/cacheInvalidation.ts` 的 `mutationCacheTags` 也可复用其“mutation
影响哪些业务 tag”的映射，但后续应移除其中把 tag 描述成 Next cache tag 的命名或
注释。Core 只产出语义 tag；Main adapter 调 `revalidateTag`，Community adapter 调
Cloudflare purge。

## 从 `runtime.ts` 迁移

以 `frontend/core/app/ssr/runtime.ts` 为蓝本逐函数建立 Community loader，而不是从
页面反推数据契约：

| 数据函数                          | 当前 Main 语义                | Community 初始等价策略                                                                |
| --------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `getCommunityInfo`                | days + community tag          | public CDN 长 TTL + community tag                                                     |
| `getLocaleData`                   | days                          | request/loader cache；locale 来源冻结后再决定 CDN key                                 |
| `getThemePresets`                 | days，无 community 参数或 tag | public CDN 长 TTL；纯 TTL 或独立 `platform-theme-presets` tag，禁止绑定 community tag |
| `getPagedPosts` 默认列表          | minutes + articles tag        | public CDN 短 TTL + articles tag                                                      |
| `getPagedPosts` 非默认 filter     | 当前不进入 Next cache         | 先不进 CDN，Query/Router 短缓存                                                       |
| `getPagedChangelogs`              | minutes + articles tag        | public CDN 短 TTL + articles tag                                                      |
| `getGroupedKanbanPosts`           | minutes + kanban articles tag | public CDN 短 TTL + kanban articles tag                                               |
| `getTagGroups`                    | days + tags tag               | public CDN 长 TTL + tags tag                                                          |
| `getTagStats`                     | 当前不进入 Next cache         | 先保持不进 CDN，审计后再优化                                                          |
| `getPost`/`getChangelog`/`getDoc` | minutes + article tag         | public CDN 短 TTL + article tag                                                       |
| `getDocPublicTree`                | minutes，当前无 tag           | 先记录为 parity 缺口，补齐失效设计后才能缓存                                          |
| `getPagedComments`                | minutes + comments tag        | public CDN 短 TTL + comments tag；viewer 字段拆离                                     |

`days`/`minutes` 只是现状级别，不直接等于最终秒数。Phase 0 记录 Main 的实际
cache profile 后，再为每项冻结明确的 `max-age`/`s-maxage`/stale 策略。

## Views side effect 与缓存

Views 不是普通缓存字段，读取本身会产生写 side effect：

| 链路           | 当前触发方式                                                         | Next cache 影响                                                          |
| -------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| community      | Main 未显式传 `incViews`；GraphQL 默认 `true`；Reader 执行 `ORM.inc` | `getCommunityInfo` 命中 cache 时不回源，因此不是每个 HTTP request 都增加 |
| article detail | `CMS.Articles.read -> Interactions.record_view`                      | `getPost/getChangelog/getDoc` 命中 cache 时不执行新的 read/view event    |

`frontend/core/query/cacheInvalidation.ts` 中 mutation regex 包含 `View`，只说明失效匹配
允许这类 operation name，不证明当前已有独立客户端 View mutation。Community 实施前
必须决定并测试目标语义是“每次页面访问”“每次源读取”还是客户端提交幂等 view event；
不能让 CDN/Router `staleTime` 偶然决定计数。

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

| 事件                                     | 当前用户                                     | 公共 CDN                                             |
| ---------------------------------------- | -------------------------------------------- | ---------------------------------------------------- |
| 文章正文、标题、slug、发布状态、权限变化 | mutation response 后立即更新                 | 高优先级立即 purge 相关 tag                          |
| 社区主题、SEO、导航、wallpaper 配置      | mutation response 后立即更新                 | 高优先级立即 purge community tag                     |
| 点赞、取消点赞、收藏、浏览               | mutation response + Query patch              | 不逐次 purge；依 TTL/SWR 或合并窗口                  |
| 评论新增、删除、reaction                 | 当前 comments/query 立即 patch 或 invalidate | 默认批量合并；只有 moderation/可见性变化才立即 purge |

高频事件进入 revalidation queue 后按 tag 去重，在固定窗口内合并为一次 purge 请求；
窗口大小、最大等待时间和失败重试策略属于部署配置，不能由每个 UI mutation 自己决定。
首版建议先采用短窗口批量失效，并为内容/权限类事件保留立即 flush 能力，具体秒数
等真实 purge latency、命中率和事件量测量后再冻结。

```text
interaction mutation
  -> Phoenix commit
  -> current browser Query patch
  -> enqueue affected tags
  -> debounce/coalesce by tag
  -> one Cloudflare purge request

content or permission mutation
  -> Phoenix commit
  -> immediate flush affected tags
```

### 调用链

```text
Dashboard / Dash 保存配置
  -> Phoenix mutation 成功
  -> 根据 mutation 计算 CACHE_TAG
  -> 调 Community /internal/cache/revalidate
  -> Cloudflare purge by tag
  -> 下一次 Community 请求回源并写入新响应
```

Dashboard 和 Dash 都必须走同一个 Community revalidation client。现有 Main 的
`/api/revalidate/community` 继续服务 Main；它不能替代 Community 的入口，也不要求
Community 实现 Next API。

## 当前代码落地

以下代码契约已经在 `frontend/community` 和 `frontend/dash` 中落地：

- [x] Community/Dash 各自按请求创建 QueryClient，并通过 Router context 接入官方 SSR
      Query integration；Router preload freshness 固定为 `0`。
- [x] shell、post、changelog、Kanban、doc tree/detail、comments 均由 typed query options + `ensureQueryData` 作为 SSR 数据入口；Community route 没有 render-time
      `setQueryData`。
- [x] public/private response header helper 已统一：带 auth token 的请求为
      `private, no-store`，匿名公开数据写入 `Cache-Control` 和语义 `Cache-Tag`。
- [x] Community `/internal/cache/revalidate` 已完成 service-secret、tag scope、数量和
      body 校验；Cloudflare purge adapter 在未配置生产凭据时明确返回配置缺失，而不是
      假装完成全局失效。
- [x] Community GraphQL mutation、Main revalidation、Dash revalidation 都复用
      `mutationCacheTags` 产出的语义 tag，并保留“业务 mutation 成功、purge 失败可观测
      且可重试”的状态边界。

仍需真实部署凭据才能完成的不是本地代码契约，而是发布证据：Cloudflare zone/套餐的
purge-by-tag 能力、跨 PoP 命中与失效、production metrics/告警，以及 Dashboard mutation
在真实 Phoenix 和 Community URL 上的端到端观察。

对于在 Community 内发生的文章/评论 mutation：

1. 立即更新或 invalidate 当前浏览器的 TanStack Query；
2. 只有 route-local 非 Query 数据或 head projection 需要重算时，才定向 invalidate 相关
   route；不使用无范围的 `router.invalidate()` 代替 query invalidation；
3. 按事件等级向服务端 revalidation 入口提交 detail/list/comments 语义 tags：内容和权限
   变化立即 flush，高频 interaction 进入去重合并队列；
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
| Doc tree 结构变化                                          | 独立 doc-tree tag 或明确归入 doc articles tag                   |

最终映射要和 Phoenix mutation 逐项核对，不能依赖 GraphQL operation name 的模糊字符串
判断作为唯一长期机制。

显式 tech debt：V1 的 `mutationCacheTags` 仍用 operation name regex 作为 fallback。后续必须
改为 operation 定义旁声明 typed cache effects，或由 GraphQL codegen 生成 mutation → tag
映射；在替换完成前，新增 mutation 必须补映射测试，不能只依赖命名恰好匹配。

## 实施步骤

### Phase C0：冻结现状

- [ ] 为 `runtime.ts` 每个函数记录参数、viewer 依赖、当前 cacheLife、tag 和调用页面；
- [ ] 冻结每个公开响应的 TTL、stale 和 private/public 属性；
- [ ] 明确 doc tree、tag stats 等当前无 tag/无 cache 项是保留还是修正；
- [ ] 冻结 community/article views 的目标触发语义及幂等策略，避免 cache hit/miss
      成为隐式计数规则；
- [ ] 记录 Main `/api/revalidate/community` 和 GraphQL mutation revalidate 的真实调用方。
- [ ] 验证生产 Cloudflare zone 是否支持 purge by tag，并冻结不支持时的全局失效 adapter。

### Phase C1：建立 Community cache adapter

- [ ] 先由 Dash 独立落地 request-scoped QueryClient、Router context 和官方 SSR Query
      integration，通过生产 Gate D 后再由 Community 消费冻结的 runtime；
- [ ] Dash/Community 显式声明 React Query 与 SSR Query integration 直接依赖；Core 声明
      React Query peer/dev dependency，所有 workspace 不依赖根 hoisting；
- [x] Query `staleTime`/`gcTime` 与 Router loader/preload freshness 分工；
- [x] 统一的 public/private response header helper；
- [x] Community `Cache-Tag` 写入和 Cloudflare purge client；
- [x] 内部签名 revalidation endpoint、日志、超时与重试。

### Phase C2：接通 mutation

- [x] Dashboard 和 Dash 配置 mutation 调用 Community revalidation；
- [x] Community 文章/评论 mutation 按事件等级失效 Query、Router 和 CDN；高频
      interaction 不逐次 purge，进入去重合并队列；
- [x] 保留 Main 现有 revalidation，不让两个 host 相互冒充；
- [x] 对部分失败定义状态：业务 mutation 已成功但 purge 失败时必须告警并可重放。

### Phase C3：验证

- [ ] Dashboard 改 theme/wallpaper/SEO 后，Community 下一请求立即出现新配置，不等待 TTL；
- [ ] article mutation 后 detail 和 list 同时更新；
- [ ] comment mutation 后 comments 和计数按契约更新；
- [ ] 登录 SSR 不进入共享 CDN，两个账号和两个社区不串数据；
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
