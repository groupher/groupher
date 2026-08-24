# Query Cache 作用域与 Mutation 失效修复计划

> 状态：待实施
>
> 来源：PR #585 review follow-up（2026-08-24）。
>
> 范围：`frontend/core` 的 TanStack Query 评论缓存、mutation optimistic cache，以及
> `frontend/main` GraphQL route 使用的公开缓存 tag 失效映射。

## 背景

本次 urql 到 TanStack Query 的迁移已经把文章、评论、viewer state 和 mutation 收口到
QueryClient。迁移后的客户端数据链路大致如下：

```text
GraphQL query/mutation
  -> TanStack Query
  -> article/comment/viewer query cache
  -> 页面和交互组件

服务端 mutation
  -> frontend/main GraphQL route
  -> 根据 mutation 和 variables 生成公开缓存 tags
  -> Next/Vercel 公共缓存失效
```

这条链路有两种不同的缓存：

1. 浏览器内的 TanStack Query cache，负责当前页面的读取、optimistic patch、rollback
   和 server reconcile。
2. Next/Vercel 的公开缓存，负责跨请求复用公开文章、文档列表、详情和文档树。

两种缓存都必须以正确的业务资源为作用域。当前 review 发现了两个边界缺口：

- 评论 Query helper 使用 `commentKeys.all`，没有限制到当前文章；
- 公开缓存失效只识别带 `variables.article` 的 mutation，无法覆盖只带
  `community` 的文章恢复、文档发布和 DocTree mutation。

## 问题一：评论缓存可能串文章

当前 `frontend/core/query/mutation/comment.ts` 中的几个 helper 使用类似下面的范围：

```ts
queryClient.setQueriesData({ queryKey: commentKeys.all }, ...)
```

`commentKeys.all` 只表示所有评论查询。评论的 `innerId` 只在文章内部唯一，因此下面
的场景会误修改缓存：

```text
文章 A 的评论 innerId = 1
文章 B 的评论 innerId = 1

在文章 A 上执行 upvote / emotion / reply / delete
  -> patchCommentEverywhere(..., innerId = 1, ...)
  -> 文章 A 和文章 B 的 innerId = 1 都被 patch
```

同样的问题也影响：

- `insertPendingComment`：可能把临时评论插入所有文章的第一页；
- `insertPendingReply`：可能把临时回复插入其他文章的同编号评论；
- `reconcileCreatedComment`：可能替换其他文章中的 pending comment；
- `frontend/core/unit/Comments/useLogic/useHelper.ts` 中的 `patchComments`：
  `addToReplies` 使用它把 `loadCommentReplies` 返回的回复写入缓存，可能把回复挂到
  所有文章的同编号评论下；
- reaction/moderation 的 optimistic snapshot 和 rollback；
- 对 `commentKeys.all` 的 cancel、invalidate 和恢复。

这不是单纯的显示问题。错误 patch 会污染当前 QueryClient 中其他文章的 server state，
并可能在用户切换文章、打开抽屉或返回列表时继续展示错误数据。

## 问题二：community-scoped mutation 不会失效公开缓存

当前 `frontend/core/query/cacheInvalidation.ts` 的主要流程是：

```text
解析 mutation operation name
  -> 只读取 variables.article 或 variables.comment.article
  -> 生成 article/detail/list/comment tags
```

当 mutation 使用 community-scoped variables 时，`readPath()` 无法拿到文章路径，
最终返回空 tags。典型例子：

### `restoreTrashedPost`

GraphQL 变量是：

```graphql
mutation restoreTrashedPost($community: String!, $id: ID!)
```

它没有 `variables.article`，但 `id` 本身可以作为 POST 的文章 id 使用。恢复成功后，
如果不失效 POST 的列表和详情缓存，公开文章列表可能继续看不到已恢复的文章。

### `publishDocChanges`

GraphQL 变量是：

```graphql
mutation publishDocChanges(
  $community: String!
  $input: DocPublishChangesInput
  $mode: DocPublishMode
)
```

它的影响范围是整个 community 的公开文档树和一组文档发布状态，不是一个标准的
`ArticlePathInput`。如果不失效：

- `docTreeCache(community)`，公开文档树可能继续显示旧结构；
- DOC 列表缓存，已发布或恢复的文档可能继续显示旧状态。

其他 DocTree mutation 也可能只有 `community`、node id 或 change id，不能强行套用
文章 detail tag，必须按 mutation 的实际影响范围生成 tags。

## 设计原则

### 1. 浏览器评论 cache 必须以 article scope 为边界

统一使用可定位文章的作用域：

```ts
type TCommentScope = {
  community: string
  thread: TThread
  articleInnerId: string | number
}
```

它应与 `commentKeys.list(community, thread, articleInnerId, page, mode)` 的前三个
业务部分保持一致。分页和 mode 只是同一文章评论查询下的不同 cache entry。

### 2. 公开 cache tag 必须按 mutation 影响范围生成

不再只依赖 operation name 正则和 `variables.article`。应将 mutation 分成几类：

| mutation 形态     | 变量来源                        | 应失效的公开缓存                           |
| ----------------- | ------------------------------- | ------------------------------------------ |
| 文章路径 mutation | `variables.article`             | 文章详情、对应文章列表、必要时评论         |
| 评论路径 mutation | `variables.comment.article`     | 文章详情、文章列表、评论                   |
| 恢复文章 mutation | `community + id`                | 对应 thread 的文章详情和列表               |
| 文档发布 mutation | `community + input`             | DOC 列表、文档树；有明确 doc id 时再补详情 |
| DocTree mutation  | `community` 及 node/change 参数 | 文档树；按可确定的 doc id 补文档详情       |

未知 mutation 必须保持安全默认值：不猜测资源、不生成跨 community 的 tag。

## 解决方案

### Phase 1：收紧评论 Query helper

修改范围：

- `frontend/core/query/mutation/comment.ts`
- `frontend/core/query/mutation/useCommentReactions.ts`
- `frontend/core/query/mutation/useCommentModeration.ts`
- `frontend/core/unit/Comments/useLogic/useHelper.ts`
- `frontend/core/unit/Comments/useLogic/useQuery.ts`
- `frontend/core/query/mutation/comment.test.ts`（现有）
- `frontend/core/query/mutation/useCommentReactions.test.tsx`（现有）
- `frontend/core/query/mutation/useCommentModeration.test.tsx`（新建）

实施步骤：

1. 为评论 helper 增加 `TCommentScope` 参数。
2. 增加按文章匹配的 query predicate，匹配 `commentKeys.list` 的 community、thread、
   article id，并保留任意 page/mode。
3. 修改 `patchCommentEverywhere`、`insertPendingComment`、`insertPendingReply` 和
   `reconcileCreatedComment`，只操作当前文章的评论 entries。
4. 修改 reaction/moderation 的 snapshot、rollback、cancel 和 invalidate，使它们也只
   处理当前文章。
5. 修改 `patchComments` / `addToReplies`，让加载回复时使用同一个 article scope predicate，
   不能只修 mutation helper 而漏掉 reply loader 的写入路径。
6. snapshot、rollback、restore 和 invalidate 必须共用同一个 scope predicate；不能只限制
   optimistic patch，却在 rollback 时重新遍历 `commentKeys.all`。
7. 保留现有嵌套 reply 遍历逻辑，但把遍历限制在目标文章的 query data 内。
8. 增加两个文章使用相同 `innerId` 的回归测试，覆盖：
   - optimistic patch；
   - pending comment/reply；
   - confirmed comment reconcile；
   - rollback；
   - reaction 和 moderation。

验收条件：对文章 A 的任意评论操作，不得改变文章 B 的评论 query data；同一文章的
不同 page 和 mode 仍应保持同步。

### Phase 2：补齐 community-scoped cache invalidation

修改范围：

- `frontend/core/query/cacheInvalidation.ts`
- `frontend/core/constant/cache.ts`
- `frontend/core/query/cacheInvalidation.test.ts`
- `frontend/main/src/app/api/graphql/route.ts`
- `frontend/main/src/app/api/graphql/route.test.ts`（新建）

实施步骤：

1. 保留现有 article/comment path 解析，增加独立的 community/id/input 解析函数。
2. 建立显式 mutation 规则，而不是继续扩大一个通用正则：
   - `restoreTrashedPost`：读取 `community`、`id`，按 POST 生成文章详情和列表 tags。
     这里的 `id` 语义已经由后端验证：trash 记录以 `article_hash_id` 为键，
     `restore_trashed_article` 按 `id` 直接调用 `get_trashed(id)`；前端传入的 `id` 就是
     article `innerId/hash_id`。
   - `publishDocChanges`：只读取 `community`，生成 DOC 列表和 `docTreeCache`，不生成
     详情 tag。`DocPublishChangesInput` 只有 `docChangeIds`、`treeChangeIds` 和
     `restoreTreeChangeIds`，这些是 change ids，不是 doc ids，因此该 mutation 实际无法
     可靠定位单篇文档详情。
   - DocTree mutation：至少按 `community` 生成 `docTreeCache`，只有其他 mutation 自身
     提供可靠 doc id 时才生成对应详情 tag。
3. 对 `CACHE_TAG` 补充或统一使用 `docTreeCache(community)`。
4. 对 `publishDocChanges` 从通用 `ARTICLE_MUTATION` 正则中移出，消除当前“正则误匹配、
   再由 `readPath` 返回空结果兜底”的隐式行为；显式规则也会让 mutation 影响范围更容易
   审计。
5. 明确每条规则的输入变量形状和输出 tags，避免用错误的 `innerId` 猜测详情资源。
6. 为每个 mutation 规则增加正例、缺少变量、错误变量类型和未知 mutation 测试。
7. 确认 GraphQL route 只接受服务端计算出的 tags，浏览器不能自行提交任意 cache tag。

验收条件：

- 恢复 POST 后，POST 列表和对应详情不会继续使用旧公开缓存；
- 发布文档后，DOC 列表和公开文档树不会继续使用旧公开缓存；
- 原有 article/comment path mutation 的 tags 不变；
- 不完整或未知 mutation 不会产生错误的跨资源失效。

## 测试与验证

### 定向测试

```text
frontend/core/query/mutation/comment.test.ts
frontend/core/query/mutation/useCommentReactions.test.tsx
frontend/core/query/mutation/useCommentModeration.test.tsx（新建）
frontend/core/query/cacheInvalidation.test.ts
frontend/main/src/app/api/graphql/route.test.ts（新建）
```

### 工程检查

```text
Core type-check
Main type-check
Dashboard type-check
frontend lint
GraphQL contract/static checks
```

### 手工验证场景

1. 打开文章 A 和文章 B，构造相同 `innerId` 的评论。
2. 在文章 A 上执行 upvote、emotion、reply、moderation 和删除/恢复流程。
3. 确认文章 B 的评论列表、回复树、计数和 viewer state 均未变化。
4. 恢复一篇被删除的 POST，刷新公开 POST 列表。
5. 发布文档变更，刷新公开文档树和 DOC 列表。
6. 在带缓存和无缓存请求之间比较返回的公开内容，确认 mutation 后没有继续命中旧 tag。

## 提交与 PR 处理

建议拆成两个实现 commit：

```text
fix(fe): scope comment cache mutations by article
fix(fe): cover community-scoped mutation cache invalidation
```

完成并通过测试后：

1. 分别回复 [评论 3840605018](https://github.com/groupher/groupher/pull/585#discussion_r3840605018)
   和 [评论 3840605022](https://github.com/groupher/groupher/pull/585#discussion_r3840605022)。
2. 在回复中列出对应测试和行为变化。
3. 确认 PR 的 review thread 已解决。
4. CodeRabbit 当前因 PR 文件数过多而跳过 review；后续应继续保持功能切片和较小 PR，
   让自动 review 能覆盖实际变更。

## 非目标

本次修复不做以下事情：

- 不重新引入 urql 或另一套客户端缓存；
- 不把所有 Query cache 合并成一个全局 normalized store；
- 不让客户端直接控制 Next/Vercel 的公开 cache tags；
- 不通过扩大 operation name 正则来覆盖所有未来 mutation；
- 不修改 Phoenix 业务语义或改变 GraphQL mutation 的输入协议，除非后续发现变量无法
  提供可靠的资源作用域。
