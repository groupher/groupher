# TanStack Query 通用失效能力

> 状态：typed target、通用 executor 和 `scripts/check-query-invalidation-boundary.mjs` 静态门禁已落地；剩余业务 owner
> revision 收敛见 ArticleStats 文档。
>
> 本文定义 `frontend/core/query/invalidation` 的唯一公共合同。它统一执行浏览器 Query cache invalidation，
> 但不拥有领域 key、optimistic mutation、receipt、SSR cache 或 Cloudflare purge。
>
> [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md) 已让成功的 Article 写操作直接
> functional-patch 真实 Detail/Batch query；本文的 invalidation target 继续保留，但不承担正常写后 count 同步。

## 1. 结论

业务代码表达“哪个领域目标已变化”，通用 executor 负责“如何让当前 QueryClient 收敛”：

```text
mutation confirmed / projection receipt
        │
        v
QueryInvalidation.<domain>.<target>(path)
        │
        v
domain resolver
  -> canonical key factory / matcher
        │
        v
generic invalidate(queryClient, targets)
  -> normalize + dedupe
  -> active refetch
  -> inactive stale
  -> await policy + telemetry
```

组件、hook 和 mutation module 不再直接调用 `queryClient.invalidateQueries`，也不手写 key array、batch predicate 或
cache data-shape scan。

## 2. 目录与公共 API

```text
frontend/core/query/invalidation/
├─ index.ts       唯一公共导出
├─ executor.ts    通用执行、去重、refetch policy 与 telemetry
├─ types.ts       target、plan、result 与封闭 policy enum
├─ article.ts     Article、ArticleStats 与 article list targets
├─ comment.ts     Comment list、reply 与 viewer targets
├─ community.ts   Community、Dsb 与导航 targets
└─ viewer.ts      当前 viewer 私有 targets
```

调用示例：

```ts
await invalidate(queryClient, QueryInvalidation.article.stats(articleRef))

await invalidate(queryClient, [
  QueryInvalidation.comment.list(articleRef),
  QueryInvalidation.article.stats(articleRef),
])

await invalidate(queryClient, QueryInvalidation.article.lists({ community, thread }))
```

不提供以下入口：

```text
invalidateByRawKey(...)
invalidateByPredicate(...)
invalidateEverything(...)
invalidateAndPurgeCdn(...)
```

如果一个领域暂时没有 resolver，先补 canonical key owner 和 target，再接入 executor；不能用 escape hatch 绕过类型边界。

## 3. Target 与 plan

公共 target 是封闭 discriminated union，不把 TanStack `QueryFilters` 透传给调用方：

```ts
type TQueryInvalidationTarget =
  | TArticleInvalidationTarget
  | TCommentInvalidationTarget
  | TCommunityInvalidationTarget
  | TViewerInvalidationTarget

type TQueryInvalidationPlan = {
  matches: readonly TQueryMatch[]
  refetch: 'active' | 'none'
  await: 'active-settled' | 'scheduled'
}
```

领域 resolver 把 target 编译为 plan。`executor.ts` 不 import Article/Comment key，不解析 target payload，也不按 cache data
shape 判断实体类型。

`TQueryMatch` 只允许：

- canonical exact key；
- canonical prefix；
- domain cache 或 invalidation resolver 内部的受控 matcher。

matcher 用于 `statsBatch` 等无法只靠 prefix 表达的成员关系。它必须先验证 key family/version，再读取 normalized paths；
`articleQueryKeys` / `viewerQueryKeys` 只生成 key，成员匹配分别由 `articleStatsCache`、`viewer.ts` 或领域 invalidation resolver
私有拥有。resolver 不得在调用点硬编码数组下标，也不得读取 query data 判断是否命中。

## 4. 默认执行策略

默认 policy 固定为：

```text
active query    -> mark stale + immediate refetch
inactive query  -> mark stale, no immediate network
duplicate match -> execute once
empty plan      -> fail closed + development assertion
executor error  -> return typed result + emit telemetry
```

`await: active-settled` 只等待本次已调度的 active refetch 完成；不会等待未来 mount 的 inactive query。业务 UI 是否等待由调用
方选择同步或 fire-and-observe 调用，但不能改变 target 的匹配范围。

如果某个领域确需 `refetch: none`，必须由 resolver 使用封闭 enum 显式声明并有测试；业务调用点不能临时传任意
`refetchType`、`predicate` 或 retry option。

executor 返回便于测试和 telemetry 的结果：

```ts
type TQueryInvalidationResult = {
  matched: number
  deduped: number
  refetched: number
  markedStale: number
  failures: readonly TQueryInvalidationFailure[]
}
```

结果不包含 Query data、用户 token 或完整 query key dump。生产 metric 使用 domain/target/result 等低基数 label。

执行成本以当前 QueryClient 中的 query 数量为上限，不扫描分页 entry data。`statsBatch` path 在 key factory 中已排序去重，
matcher 对 normalized path 使用集合查找。首期不维护全局 entity-to-query 反向索引；只有 production telemetry 证明 cache
规模使 predicate scan 成为热点时，才引入由 key owner 维护且可重建的二级索引，避免为通常几十个 query 的浏览器 cache
提前增加一致性状态。

## 5. 领域 resolver

### 5.1 Article

```text
article.content(path)      detail/preview 中 canonical content identity
article.stats(path)        真实 detail stats query + 所有包含 path 的 statsBatch
article.lists(scope)       community/thread/filter family
article.membership(path)   可能包含该 Article 的列表归属
```

`article.stats(path)` 是公开 count 的唯一失效目标：

```text
ArticleStats mutation receipt
  -> article.stats(path)
  -> exact articleQueryKeys.stats(path)
  -> matcher articleStatsCache.contains(queryKey, path)
  -> active detail/list/Drawer stats refetch once
```

它不命中 Article content，也不把 receipt 写入 ArticleStats cache。`article.lists(scope)` 只覆盖匹配 scope，不清空
`articleQueryKeys.all`；服务端排序/筛选通过 refetch 收敛，客户端不复制 query builder。

当前实现中 `articleQueryKeys.stats(path)` 是 Detail/Drawer 的真实 query key；已删除 batch response 对它的 seed 和列表中的
disabled observer。成功且返回完整 `ArticleStats` 的 mutation 直接 patch detail/batch，只有缺少完整结果、列表成员/排序变化或
恢复异常时才使用本 target invalidation。

### 5.2 Comment

```text
comment.list(articleRef)
comment.replies(commentRef)
comment.entity(commentRef)
comment.viewerState(accountRef, commentRef)
```

create/reply/update/delete mutation 可以组合多个 target。pending entity、rollback、tombstone 和
`ArticleCommentsReceipt` 属于 comment mutation domain，不进入 invalidation executor。

### 5.3 Community 与 viewer

Community/Dsb/wallpaper 等 target 必须保持各自 confirmed owner，不借 invalidation 重新建立聚合 store。viewer target 强制
包含 immutable `accountRef`；resolver 不允许 prefix 命中另一个账号的私有 Query。

## 6. 与 mutation、receipt 和 SSR 的边界

```text
optimistic mutation domain
  -> cancel/snapshot/patch/rollback
  -> Phoenix mutation
  -> server-confirmed reconcile
  -> confirmed receipt（如需要）
  -> QueryInvalidation target

query invalidation executor
  -> 只 mark stale / refetch
```

executor 不负责：

- mutation queue、command id、optimistic patch 或 rollback；
- ArticleStats snapshot/revision 比较；
- receipt storage、overlay 或 TTL；
- SSR prefetch、dehydrate allowlist 或 QueryClient 生命周期；
- BroadcastChannel、实时订阅或跨 tab 同步。

这些能力可以触发 invalidation，但不能被塞进 executor 形成 mutation DSL。

## 7. 与公共 CDN 失效的边界

浏览器 Query invalidation 与 Cloudflare cache-tag purge 共享“某项数据已变化”的业务背景，但不共享 API、queue 或 executor：

```text
TanStack Query invalidation
  owner: frontend/core/query/invalidation
  target: 当前浏览器 QueryClient
  input: typed frontend target

Public CDN invalidation
  owner: Phoenix PublicCache
  target: Cloudflare 公共 HTML/hydration object
  input: domain transaction 中的 PublicCache.Invalidation
```

浏览器不能提交 cache tag，Phoenix 也不能操纵某个浏览器 QueryClient。upvote/view/comment count 通常只执行 Query
invalidation 并依赖 HTML TTL；content/publish/visibility/config 变化由 Phoenix outbox 可靠 purge。完整协议见
[`public-cache-invalidation.md`](./public-cache-invalidation.md)。

## 8. 直接切换

本次不保留兼容中间层：

1. 建立目录、types、executor 和领域 resolver；
2. 迁移所有生产 `invalidateQueries`、手写 key/predicate 和旧 cache invalidation helper；
3. mutation module 只构造 typed target；
4. 删除旧 helper、alias、barrel export 和重复 batch predicate；
5. 增加静态门禁：只有 `invalidation/executor.ts` 和基础测试可以调用底层 `invalidateQueries`；
6. 证明 frontend invalidation 不再调用 revalidation endpoint、Cloudflare 或任意 CDN facade。

迁移必须按领域一次完成。不能让同一 mutation 同时执行旧 helper 和新 executor，也不能在新 API 中包装旧 helper 作为
fallback。

## 9. 测试与验收

- exact、prefix 与受控 matcher 只命中声明的 key family；
- 重复/重叠 target 在一次执行中去重，active query 不重复 refetch；
- 1、20、100 个 batch paths 的 matcher 不扫描 query data，执行次数不随页面 entry 嵌套层级增长；
- active 立即 refetch、inactive 只 stale，await 语义稳定；
- `article.stats(path)` 命中单篇 key 和所有包含 path 的 normalized `statsBatch`，不命中其他 Article；
- list scope 覆盖 community/thread/filter family，但不清空无关列表；
- accountRef 不匹配时 viewer target 不跨账号失效；logout/account switch 有独立清理测试；
- 空 community、非法 thread/innerId、未知 target/version fail closed；
- mutation rollback 不执行 success invalidation；confirmed/no-op/replayed response 的策略有明确测试；
- executor failure 进入 production telemetry，不吞掉原 mutation 的业务成功结果；
- `scripts/check-query-invalidation-boundary.mjs` 阻止领域代码直接调用 `invalidateQueries`；key owner 测试阻止 resolver
  重建 key 或绕过 canonical matcher；
- executor 不修改 Query data，不推进 snapshot/revision，不触发 CDN purge。

## 10. 明确禁止

```text
组件直接 queryClient.invalidateQueries
手写 ['article', ...] key
按 query data shape 猜测类型
解析 query key 数组下标
一次 mutation invalidate 整个 QueryClient
把 optimistic patch 或 receipt 放进 executor
从浏览器提交 Cloudflare cache tag
Query invalidation 顺便调用 CDN revalidation
新旧 helper 双执行或保留 fallback
```
