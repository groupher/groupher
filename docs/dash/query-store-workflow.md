# Query / Store 重组 Workflow

> 状态：Phase 0–9 本地实现与自动验收已完成。confirmed owner、后台 reconcile、ThemePreset/
> Wallpaper projection、compatibility facade 退出和 server-owned CacheEffect 已收口。真实 Cloudflare
> purge、跨 PoP 行为和生产告警仍是独立发布门。
>
> 本文只负责执行顺序、任务依赖和验收入口，不重复设计细节：
>
> - Query、GraphQL transport、SSR hydration 与 public/viewer ownership：
>   [`urql_to_tanstack_query.md`](../architecture/urql-to-tanstack-query.md)
> - TanStack Start / Cloudflare 缓存、公共响应与 viewer 拆分：
>   [`tanstack_rewrite/query_sync_cache.md`](../migrations/tanstack/query-sync-cache.md)
> - Dsb 配置、`DsbEditStore`、SavingBar 和 mutation 拆分：
>   [`dashboard_store_reorg.md`](./store-reorganization.md)
> - owner、projection、兼容层退出和同步正确性收口：
>   [`query_store_boundary_hardening.md`](../architecture/query-store-boundary.md)

本轮内部 mutation/schema 标识沿用 `updateDashboardXxx`，与 GraphQL wire contract 中的
`UpdateDashboardXxx` / `updateDashboardXxx` 保持一致，不额外引入 `updateDsbXxx` 别名。评论 viewer ID helper 使用
`gatherCommentViewerIds`，表示聚合查询 ID，不涉及 article collect/收藏。

## 目标状态

```text
公共 SSR
  -> 只请求 no-user-spec 数据
  -> 可安全共享的 HTML/RSC + dehydrated public Query

浏览器 hydration
  -> Q.viewer 加载 session / viewerHasXxx
  -> 按 canonical entity key 与公共数据组合显示

已确认服务端数据
  -> TanStack Query

本地 UI / Dashboard 未保存编辑值
  -> Valtio（Dsb 使用专用 DsbEditStore）

mutation
  -> TanStack mutation
  -> Query cache reconcile
  -> server proxy 根据 typed CacheEffect 异步传播 Cloudflare cache-tag purge
```

## 本轮执行记录

Phase 0 冻结的 Community 公共入口如下；所有公开 SSR loader 都不读取请求 cookie、auth token
或登录用户 selection。`Q.viewer.session/communityState/articleStates/commentStates` 是 hydration
后的私有 owner，`Q.dsb.config` 是已确认 Dsb 配置的 Query owner。

| Loader           | GraphQL / Query key                                                                               | 公共缓存边界                               |
| ---------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `loadCommunity`  | `PageCommunity(userHasLogin: false)`；`['community', slug]`，Dsb 同时 seed `dsbKeys.config(slug)` | community tag                              |
| `loadPosts`      | `PagedPosts(userHasLogin: false)`；`articleKeys.posts(default filter)`                            | POST articles tag                          |
| `loadPost`       | `Post(userHasLogin: false)`；`articleKeys.detail`                                                 | POST article + articles tag                |
| `loadChangelogs` | `PagedChangelogs(userHasLogin: false)`；`articleKeys.changelogs(default filter)`                  | CHANGELOG articles tag                     |
| `loadChangelog`  | `Changelog(userHasLogin: false)`；`articleKeys.detail`                                            | CHANGELOG article + articles tag           |
| `loadKanban`     | `PagesGroupedKanbanPosts`；`articleKeys.kanban`                                                   | KANBAN articles tag                        |
| `loadDocTree`    | `PageDocPublicTree`；`docTreeClientQuery`                                                         | `community[slug]-doc-tree`                 |
| `loadDoc`        | `PageDoc(userHasLogin: false)`；`articleKeys.detail`                                              | DOC article tag                            |
| `loadComments`   | `PublicPagedComments`；`commentKeys.list`                                                         | comments tag；selection 不含 viewer fields |
| `loadThemeSeed`  | 固定 `PUBLIC_THEME_SEED`                                                                          | 不读取 cookie；pre-paint 负责用户 theme    |

保留的 viewer 领域只返回当前用户拥有的字段：article 为 viewed/upvoted，comment 为 upvoted、
reported 和 emotion reaction；未知值保持 `undefined`。所有 refs 先排序去重，超过 100 条自动分片，
且 immutable `accountRef` 进入实体 query key。评论 viewer 请求的 ID 必须由
`gatherCommentViewerIds` 递归遍历 entries、全部 replies 和 replyToComment 后产生；该 helper
只是收集查询 ID，不涉及 article collect/收藏功能。无有效 session 时服务端返回空数组。
Phase 0 的 Dsb 基线同时覆盖 `Q.dsb.config`、`DsbEditStore`、SavingBar、Dsb 领域请求函数、
tag CRUD/reindex 以及 cache-tag revalidation。

本地基线验收证据：仓库全量前端测试 194 个文件、792 个用例通过；全仓类型检查
和 Community/Dash/Landing production build 通过；GraphQL repository/static/generated 契约、theme
first-paint 检查、后端格式与 warnings-as-errors 编译均通过。本轮 source 在并行 `vgpu-poc` 文件
出现前通过全仓文档检查；当前 dirty worktree 的剩余文档/格式问题仅来自该实验目录及其 `.tmp`
产物，合并前仍须由对应改动清理并重跑。Cloudflare zone/套餐、
跨 PoP purge、生产 hit/miss/purge metrics 尚未配置凭据，单独保留为发布门。

2026-08-29 复核项已完成：nested comment viewer ID、匿名 resolver 空数组、CreatePost 的 POST
articles tag、按领域 response normalizer，以及 Dsb editor 临时状态 owner 均已补齐实现和回归测试。

## Phase 0：冻结现状与测试基线

- [x] 列出 Community 每个 SSR loader 的 GraphQL selection、auth/token 依赖、Query key、
      response cache header 和 dehydration 内容。
- [x] 清单以 `frontend/community/src/server/community.ts` 的
      `loadCommunity/loadPosts/loadPost/loadChangelogs/loadChangelog/loadKanban/loadDocTree/loadDoc/loadComments`
      及 `server/theme.ts` 的 `loadThemeSeed` 为准。
- [x] 列出全部 `viewerHasXxx`、account、subscription、emotion 等 user-specific 字段及当前 reader。
- [x] 列出 `articleStates/changelogStates/articleState/commentStates` 的实际 query key、request
      variables 和 reader，确认四者改为 canonical refs batch operation；单独记录保留的
      `commentSummary` consumer。
- [x] 列出全部 `CACHE_TAG` constructor 和 revalidation validator，保证 vocabulary 一一对应。
- [x] 列出 Dsb 配置 reader、`stores/dsb` 字段、SavingBar 字段组和
      `frontend/core/unit/DsbThread/logic/useMutation.ts` 的所有 mutation 分支。
- [x] 为 public response、viewer unknown state、logout/account switch、SavingBar、字段组保存、
      取消编辑、请求失败恢复和 pending 期间继续编辑建立回归基线。
- [x] 记录 Community/Dash/非 Dash route 的 production bundle 基线，确认后续编辑 runtime 是否退出
      非 Dash 依赖图。

完成标准：每个待迁移字段都有当前 owner、目标 owner 和 consumer；现有产品行为可以被测试或明确
的手工步骤验证。

## Phase 1：统一 GraphQL transport

设计依据见 [`urql_to_tanstack_query.md#graphql-transport`](../architecture/urql-to-tanstack-query.md#graphql-transport)。

- [x] 以现有 `graphql-request` 依赖实现薄的 `browserGraphQLRequest` adapter。
- [x] 保留 same-origin endpoint、credentials、CSRF、demand-driven auth refresh/单次 replay、
      TypedDocumentNode、统一错误和 `AbortSignal`。
- [x] 保持 server `publicQuery` 与 request-aware `authQuery` 分离；浏览器 adapter 不复用于 SSR。
- [x] 将现有 `browserQuery` callers 按领域迁移；retry、pending、error、cache 由 TanStack Query
      options/mutation 管理。
- [x] 删除旧 `browserQuery` 及重复 transport 代码，并验证业务源码无回流。

完成标准：transport 只负责 GraphQL 请求和 Groupher 鉴权协议，不拥有 Query 生命周期，也不引入
Apollo/urql/Graffle 或新的 client framework。

## Phase 2：Session、Theme 与公共 SSR 同步切换

缓存规则见
[`tanstack_rewrite/query_sync_cache.md#公共和私有响应边界`](../migrations/tanstack/query-sync-cache.md#公共和私有响应边界)。

- [x] 在 `frontend/core/stores/account/hooks.tsx` 的现有 TanStack session query 基础上建立
      `Q.viewer.session()`，统一 session key、client probe、logout/account switch 清理逻辑。
- [x] 切换登录导航和账户 UI 读取 `Q.viewer.session()`；在同一实现切片从 `loadCommunity` 和
      `TCommunityShell` 删除 account seed、auth token、subscription 和 viewer selection。
- [x] 将 `loadThemeSeed` 改为固定公共默认 seed，并在同一实现切片确认 pre-paint script 在 hydration
      前从浏览器 theme cookie 和 `prefers-color-scheme` 应用用户 theme。
- [x] 由 `frontend/core/constant/cache.ts` 同时提供 `CACHE_TAG` 和 `isCacheTag`，
      Community revalidation endpoint 删除独立 `TAG_PATTERN`；constructor、validator 和契约测试
      在同一切片更新，并覆盖 `community[slug]-doc-tree`。
- [x] public loader 不读取 cookie/header/auth token；入站请求带 cookie 不改变公共 response 内容和
      cacheability。
- [x] 将确实需要身份/权限的 SSR route 留在明确的 `private, no-store` 边界，禁止混入 public loader。
- [x] 审计 dehydration，保证公共 Query cache 不含 viewer/account 数据。
- [x] 对匿名/登录请求验证相同 URL 的公共 HTML、Cache-Control、Cache-Tag 和 hydration shape。

完成标准：session client query 就位后才删除 SSR account；theme pre-paint 就位后才删除服务端 cookie
读取。最终登录用户也命中相同公共响应，且首屏账户 UI、theme 和 hydration 均正确。

## Phase 3：建立 `Q.viewer` 与安全组合层

数据所有权及组合规则见
[`urql_to_tanstack_query.md#文章与当前用户状态的组合`](../architecture/urql-to-tanstack-query.md#文章与当前用户状态的组合)。

- [x] 在后端增加按 canonical refs 批量查询 article/comment viewer state 的 GraphQL operation；
      operation、返回 shape、100 条 batch 上限和匿名语义严格遵守
      [`urql_to_tanstack_query.md#viewer-batch-graphql-合同`](../architecture/urql-to-tanstack-query.md#viewer-batch-graphql-合同)。
- [x] 建立 `Q.viewer.communityState(accountRef, community)`、
      `Q.viewer.articleStates(accountRef, articleRefs)` 和
      `Q.viewer.commentStates(accountRef, articleRef, commentRefs)`。
- [x] 对 refs 排序、去重，并让同一组 refs 同时决定 query key 和 GraphQL variables；所有用户实体
      query key 必须包含非 secret、opaque、immutable 的 `accountRef`。
- [x] queryFn 将超过 100 条的完整 refs 自动分片并行请求后合并；任一分片失败则整个 Query 失败，
      组件不处理分片或部分结果。
- [x] hydration 后加载当前页面可见实体的 viewer state；未知字段保持
      `undefined`，UI 不提前解释为 `false`。
- [x] viewer response 归一化为 keyed record，实体身份至少包含对应领域所需的 community、thread、
      `innerId`/comment id；不使用列表 offset。
- [x] 实现纯 selector/hook 组合 public entity 与 viewer state：校验完整 identity，只覆盖
      viewer-owned 字段，不创建第三份持久 ViewModel cache。
- [x] 登录、登出、账号切换时清除全部 viewer queries；接通现有跨 tab session 通知后的
      clear/refetch。
- [x] 将 `viewerHasXxx` readers 从 Valtio/公共 Query response 切到 `Q.viewer`。
- [x] `gatherCommentViewerIds` 递归收集 entries、replies 和 replyToComment 的 innerId，确保
      nested reply 的 upvote/emotion viewer flags 能够加载；此项不实现 article collect。
- [x] consumer 切换后直接删除 `articleStates/changelogStates/articleState/commentStates` 及其旧
      query key、GraphQL documents，不保留两套 operation。
- [x] `ArticleQueryProvider` 使用单 ref 的 `Q.viewer.articleStates` 并按 articleKey 读取 record；
      `commentSummary` 及其 `isViewerJoined`、total/participants summary consumer 保持可用。
- [x] Article viewer state 只落地 viewed/upvoted；不实现 collect、commented 或 article emotions。

完成标准：分页、排序、筛选和后台 refetch 后 viewer flag 不错配；用户 A 的 viewer cache 不会在
用户 B 或公共 SSR 中出现。

## Phase 4：Dsb 已确认配置进入 Query

Store 边界见 [`dashboard_store_reorg.md#2-核心结论`](./store-reorganization.md#2-核心结论)。

- [x] 建立 `Q.dsb.config` 的 key、query options、SSR prefetch/hydration 和 cache-tag 映射。
- [x] Community 和只读 Demo 直接读取 Query；Landing 使用静态配置，不创建 Dsb Valtio store。
- [x] 将 `useDsb()` 收敛为 Query 的薄读取 hook，或让 consumer 直接使用领域 Query hook。
- [x] 显式迁移 `frontend/dash/src/components/DsbShell.tsx` 的 Provider/init 组合；不再创建通用
      `DsbStoreProvider`。
- [x] 将 CommunityDigest、展示 hooks 等确认配置 reader 切到 `Q.dsb.config`。
- [x] 将 `SubMenuContentLayout`、`createCmsSectionLayout` 使用的 `submenuCollapsed` 切到 Dash shell
      UI state，不能跟随配置 reader 迁入 Query。
- [x] 切走 overview、CMS list、tag groups 等仍残留在 Dsb store 的独立 server state。
- [x] 保证 Community/Landing/只读 Demo 不静态导入 Dsb 编辑、SavingBar 和 save modules。

完成标准：`Q.dsb.config` 是已确认 Dsb 配置的唯一客户端 owner，非 Dash route 不再创建通用
`DsbStore`。

## Phase 5：按产品语义建立 DsbEditStore

详细合同见
[`dashboard_store_reorg.md#4-dsbeditstore为-dsb-编辑而设计`](./store-reorganization.md#4-dsbeditstore为-dsb-编辑而设计)
和 [`dashboard_store_reorg.md#6-保存成功后的-reconcile`](./store-reorganization.md#6-保存成功后的-reconcile)。

- [x] 仅在可编辑 Dash route 中，以 `Q.dsb.config` confirmed data 创建 `DsbEditStore`。
- [x] 当前编辑字段直接放 store 顶层；保留 `original`、touched、`edit`、`editMany`、`rollback`、
      `reconcile`、`isTouched`、`anyTouched`，不增加 `.draft`。
- [x] 将现有字段级/字段组 dirty helper 收敛到 Dsb 领域实现；删除过度泛化且无其他消费者的
      `createDraftFieldActions`。
- [x] SavingBar 从 DsbEditStore 读取 current/original/touched，从 TanStack mutation 读取
      pending/error。
- [x] 实现 submitted/confirmed/current 三方 reconcile，确保请求 pending 期间的新输入不被成功
      response 覆盖。
- [x] 将 link、tag、alias、DocFAQ、media、admin、submenu 的临时状态按 owner 下沉到对应
      editor hook、`DsbEditorUi` context 或 Dash shell；`useDsbEdit` 不再合并 UI state，旧
      `debug()` facade 已删除；Tag 等独立服务端资源继续归 Query。

完成标准：现有单字段、多字段、取消、失败重试行为不变；保存 B 期间继续输入 C 后，confirmed
baseline 为 B、当前值仍为 C 且保持 touched。

## Phase 6：把巨大保存 hook 拆成 TanStack mutations

拆分原则见
[`dashboard_store_reorg.md#7-保存层改为-tanstack-mutation`](./store-reorganization.md#7-保存层改为-tanstack-mutation)。

- [x] 建立 `useDsbSaveRunner`，负责 immutable submitted snapshot、mutation 生命周期、Query 更新、
      DsbEditStore reconcile、toast 和错误呈现。
- [x] 按 baseInfo、layout、links、integrations、tags、themePreset 等领域拆出普通 save 函数；保留
      现有字段组、序列化、权限，并将 response 归一化下放到各领域，移除 runner 的递归
      同名字段查找。
- [x] 保存成功以服务端 confirmed response 调用 `queryClient.setQueryData`；response 不完整时使用
      精确 `invalidateQueries`，然后执行编辑 store reconcile。
- [x] 将 tag CRUD/reindex 等独立 operation 建成各自 TanStack mutation，不塞入通用 Dsb save。
- [x] 补齐 `CreatePost + community -> POST articles tag` 的 typed 失效映射；当前 checkout 尚未
      启用可执行的 Dash 发帖调用点，因此由 cache contract test 锁定映射，路径启用时直接复用。
- [x] 删除旧巨大 `useMutation.ts` 和 Store 内网络/saving 状态，禁止引入 command bus、class 或
      registry。
- [x] 业务 mutation 成功后由 Community/Dash server proxy 解释 typed cache effect，并以 Worker
      `waitUntil` 执行；Dash 调用具备超时、一次重试和结构化日志，purge 失败不回滚业务保存。

完成标准：每个 save module 都有窄 `TDsbXxx` input/result；DsbEditStore 不发请求，组件不直接操作
QueryClient，业务成功与 purge 成功是两个独立状态。

## Phase 7：清理旧边界与 bundle

- [x] 删除通用 `DsbStore`、demo localStorage config/snapshot/subscribe 和无调用者 adapters。
- [x] 删除 Query -> Valtio confirmed mirror、公共 response 中 viewer 字段读取和 offset merge；
      Community/ThemePreset/Wallpaper Valtio 状态只保留可重建 projection、draft 或 preview 语义。
- [x] 直接删除旧 `browserQuery`、旧 Dashboard mutation hook 和旧命名；内部统一 `dsb`、`TDsbXxx`。
- [x] 检查静态依赖图，保证 Community、Landing 和其他非 Dash route 不包含 Dsb 编辑 runtime。
- [x] 保留 Valtio 作为 UI 与 Dsb 编辑 store 依赖；本轮不以移除 Valtio 为目标。

完成标准：每份服务端数据只有一个 Query owner，每份本地编辑/UI state 只有一个本地 owner；旧
reader、旧 key 和旧 store 入口全部删除。

## Phase 8：完整验收与发布门

- [x] 类型检查、Query/store 单元测试、Community/Dash production build 全部通过。
- [x] 覆盖 public SSR 无身份数据、viewer unknown/loaded、canonical identity merge、logout/account
      switch、跨 tab 和 hydration 测试。
- [x] 补充 nested reply/replyToComment viewer flags 的 ID 收集与合并测试，并验证匿名
      `commentViewerStates` resolver 返回空数组。
- [x] 覆盖 Dsb 单字段、多字段、取消编辑、失败恢复、pending 中继续编辑、server normalization 和
      Query reconcile 测试。
- [x] 覆盖 mutation 成功但 purge 失败、重试 purge、cache-tag 映射测试。
- [x] 对 Community/Dash/非 Dash route 复测请求数、hydration、首屏 theme 和 bundle 差异。
- [ ] 使用真实 Cloudflare 凭据验证 public cache hit、purge by tag、跨 PoP 失效和告警；详细发布门
      见 [`tanstack_rewrite/query_sync_cache.md#phase-c3验证`](../migrations/tanstack/query-sync-cache.md#phase-c3验证)。

## Phase 9：Query / Store 边界收口

完整问题登记、目标数据流、禁止引入的抽象和 Phase B0–B5 见
[`query_store_boundary_hardening.md`](../architecture/query-store-boundary.md)。本阶段不是框架重写，按
“先正确性、再唯一 owner、再退出兼容层、最后分离 CacheEffect”的顺序实施。

- [x] 冻结 community/dashboard/themePreset/wallpaper/viewer/baseInfo 的真实 owner、reader 和 writer；
- [x] 接通 `Q.dsb.config` 后台更新与 `DsbEditStore.reconcileConfirmed`；
- [x] 复验并收口 ThemePreset confirmed、preview 和 CSS projection；
- [x] 验证父子 loader 最终 response-context `Cache-Tag` 聚合；
- [x] 消除 shell/Query/Valtio confirmed duplicate，不新增 Query → Valtio confirmed mirror；
- [x] 删除 Dsb compatibility facade、宽 snapshot 订阅和无生产 caller 的 viewer helper；
- [x] 将保存层拆为窄 `useDsbSaveRunner` 与领域 field orchestrator，各领域返回 typed confirmed patch；
- [x] 将 CDN CacheEffect 移到 server proxy，高频 interaction 不逐次 purge；
- [x] 完成边界验收矩阵并重新核对 Phase 4、6、7、8 的完成状态。

完成标准：每份 confirmed server state 只有一个 Query owner，所有后台刷新和 mutation response 使用
同一 reconcile 规则；业务保存与 CDN propagation 独立；compatibility caller 为零；文档状态与真实
实现一致。

## 提交建议

按 Phase 1-7 的领域切片提交，不把 transport、SSR ownership、viewer、Dsb read、Dsb edit 和
mutation 压进一个提交。每个切片直接切到目标实现并删除旧入口，不保留双读、旧 key、旧 tag 或
兼容分支。Phase 8 是整体验收，不应以“本地 adapter 已完成”替代真实 Cloudflare 发布证据。
