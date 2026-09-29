# Snapshot Update

> 状态：设计讨论稿
>
> 目标：为文章、评论、用户等局部展示信息提供统一的 snapshot 刷新机制，避免列表页被实时权威查询拖慢，同时允许详情页按需拿到最新信息。

## Background

Groupher 里很多列表和动态信息不是直接展示完整实体，而是展示某个实体的局部信息。

例如：

- 一篇文章列表项只需要 author 的 `id / login / nickname / avatar`。
- `latestReactedUsers` 只需要几个用户的 simple profile。
- asset 引用详情只需要知道某个 asset 被哪篇 article 使用。
- notification / activity 只需要 actor、article、comment 的局部展示信息。

这些字段有两个特点：

- 它们属于另一个权威实体，例如 user、article、comment。
- 当前业务场景只需要少量展示字段，不需要完整实体。

为了避免列表页产生大量 join / preload / N+1 查询，很多场景会把这些局部信息保存成 snapshot。
这类 snapshot 本质上是 denormalized display data：

```text
relation / event / summary row
  -> stores lightweight snapshot
  -> renders list quickly
  -> does not own the source of truth
```

这带来一个常见问题：snapshot 会过期。

例如：

- user 修改 nickname 后，旧的 `latestReactedUsers` 仍然保存旧 nickname。
- article 修改 title 后，asset refs 里保存的 article title snapshot 可能还是旧 title。
- comment 更新或删除后，notification 里的 comment digest 可能已经不是最新内容。

一种直接做法是每次响应前都去权威表批量查最新值，然后 merge 回 response。但这不适合所有场景：

- 列表页一次可能加载 30 篇文章，每篇都有多个 latest user 字段。
- reaction、view、emotion、report 等字段里可能重复出现同一批 users。
- 每次首屏都 blocking 查询最新 user/article/comment summary，会增加响应延迟。
- 如果逐条发异步任务刷新，又会造成任务数量失控。

因此这里需要一个统一机制：

- 列表页默认使用已有 snapshot 快速返回。
- 对 stale / miss 的 snapshot 进行批量刷新。
- 详情页或后台这类强展示场景可以 blocking 获取最新 summary。
- 刷新只更新展示字段，不改变原业务关系。

这就是 `CMS.Snapshot` 要解决的问题。

## 问题

很多业务数据会保存轻量 snapshot，用于减少查询和方便展示。

典型例子：

- article refs 里保存 article 的局部信息。
- post/comment 上保存 `latestUpvotedUsers`、`latestViewedUsers`、`latestReportedUsers`、`latestReactedUsers`。
- notification / activity 里保存 actor、article、comment 的展示信息。

这些 snapshot 通常只包含少量字段：

- user: `id`、`login`、`nickname`、`avatar`、`bio` / `shortBio`
- article: `id`、`innerId`、`title`、`slug`、`thread`
- comment: `id`、`bodyDigest`、`author`、`articleId`、`thread`

问题是权威数据可能变化，例如：

- user 修改 nickname / avatar。
- article 修改 title / slug。
- comment 被更新或删除。

如果业务 snapshot 不刷新，列表、引用详情、reaction 用户列表就会展示旧信息。

## 边界

snapshot 只用于展示兜底，不作为权威数据。

权威判断仍然来自业务主表：

- user 最新信息来自 `account.users`。
- article 最新信息来自对应 thread 的 article 表 / article document。
- comment 最新信息来自 comments 表。
- asset 删除 guard 仍然来自 refs，不依赖 snapshot。

Snapshot 不负责改变关系集合。

例如请求开始时某篇文章的 `latestReactedUsers` 是：

```text
[user1, user2]
```

如果 resolve 过程中 user3 又 reaction 了，本次 response 仍然只更新 user1 / user2 的展示字段。
Snapshot 不会新增 user3、不删除 user1、不重排数组。

关系集合由原业务查询负责，`CMS.Snapshot` 只刷新数组中已有对象的展示字段。

## 模块命名

使用：

```elixir
CMS.Snapshot
```

它不是权威模型，也不是新的长期存储源。它负责：

- 接收已有 snapshot。
- 批量收集 id。
- 命中短 TTL cache 时用最新 summary 替换 snapshot。
- miss / stale 时默认不阻塞列表，触发异步批量刷新。
- 在 blocking 模式下批量查询权威表并同步返回最新 summary。
- 返回与输入同 shape 的数据，方便业务层 merge。

## 调用位置

`CMS.Snapshot` 应该放在 CMS 领域 read 流程内部调用，不做成 GraphQL 后置中间层。

推荐位置：

```text
CMS read function / resolver
  -> 查询业务数据
  -> 调 CMS.Snapshot.users_in / articles_in / comments_in
  -> 返回已经处理过 snapshot 的结构
  -> GraphQL 只负责序列化字段
```

例如 post list：

```elixir
def paged_posts(args) do
  with {:ok, page} <- Articles.paged(args) do
    posts =
      page.entries
      |> CMS.Snapshot.users_in([
        :latest_upvoted_users,
        :latest_viewed_users,
        :latest_reported_users,
        :latest_reacted_users
      ])

    {:ok, %{page | entries: posts}}
  end
end
```

不建议做 GraphQL after middleware：

- GraphQL response tree 太通用，无法可靠判断字段语义。
- 同样叫 `user` 的字段可能是权威 user，也可能是 simple user snapshot。
- 不同场景的策略不同，列表页默认 stale-first，详情页可能 blocking。
- 全局后置 patch 容易变成隐式魔法，调试和性能分析困难。

GraphQL 层可以传递场景意图，例如详情 resolver 显式使用 blocking，但不负责遍历和 patch response。

如果多个 resolver 重复相同逻辑，可以抽业务 helper：

```elixir
CMS.Snapshot.for_post_list(page)
CMS.Snapshot.for_comment_list(page)
```

这类 helper 仍属于 CMS 业务层，不是 GraphQL 通用中间层。

## 默认策略

默认模式是 stale-first。

也就是说，调用方默认不需要写：

```elixir
mode: :stale_first
```

列表页、feed、搜索页这类首屏场景默认使用 stale-first：

```elixir
CMS.Snapshot.users(simple_users)
CMS.Snapshot.users_in(posts, [:latest_reacted_users])
```

详情页、后台、编辑器或强一致场景才显式使用 blocking：

```elixir
CMS.Snapshot.users(simple_users, mode: :blocking)
CMS.Snapshot.articles(:post, article_snapshots, mode: :blocking)
```

## User Snapshot

`latest[Reaction]Users` 这类结构几乎固定，可以直接把 simple user snapshot array 传进去。

输入：

```elixir
[
  %{id: 1, login: "old", nickname: "old name", avatar: "..."},
  %{id: 2, login: "u2", nickname: "u2", avatar: "..."}
]
```

调用：

```elixir
CMS.Snapshot.users(simple_users)
```

输出保持同样 shape、顺序和长度：

```elixir
[
  %{id: 1, login: "new", nickname: "new name", avatar: "..."},
  %{id: 2, login: "u2", nickname: "u2", avatar: "..."}
]
```

规则：

- 按 `id` 去重。
- 只更新 simple user 展示字段。
- 不改变原数组顺序。
- 不增删 reaction user。
- cache 命中时直接返回新 summary。
- cache miss / stale 时默认返回原 snapshot，并异步刷新。
- `mode: :blocking` 时才等待 DB 批量查询。

## 批量更新嵌套字段

常见列表场景可以使用 `users_in/3`。

例如 posts 中有多个 latest user 字段：

```elixir
posts =
  CMS.Snapshot.users_in(posts, [
    :latest_upvoted_users,
    :latest_viewed_users,
    :latest_reported_users,
    :latest_reacted_users
  ])
```

这个 API 负责：

- 从所有 posts 的指定字段收集 simple user snapshot。
- 按 user id 去重。
- 批量 resolve。
- 把更新后的 simple user 按原位置写回。
- 返回更新后的 posts。

调用方不需要手写 collect ids、resolve map、merge path。

## Article Snapshot

文章也使用类似模式，但需要 thread。

```elixir
CMS.Snapshot.articles(:post, article_snapshots)
CMS.Snapshot.articles(:doc, article_snapshots, mode: :blocking)
```

批量嵌套更新：

```elixir
refs = CMS.Snapshot.articles_in(:post, refs, [:article])
```

文章 snapshot 推荐字段：

```elixir
%{
  id: article_id,
  inner_id: inner_id,
  title: title,
  slug: slug,
  thread: :post
}
```

对于 asset refs 场景，refs 表里的 `title` 不应该作为 article title 的权威来源。
后续如果要展示“具体是哪篇文章”，可以把 refs 中的 article snapshot 交给
`CMS.Snapshot.articles/3` 刷新。

## Comment Snapshot

评论可以按 thread + comment ids/snapshots 解析。

```elixir
CMS.Snapshot.comments(:post, comment_snapshots)
CMS.Snapshot.comments(:post, comment_snapshots, mode: :blocking)
```

comment snapshot 推荐只保留展示需要的轻量字段：

```elixir
%{
  id: comment_id,
  body_digest: "...",
  article_id: article_id,
  thread: :post,
  replying_to: %{
    id: parent_comment_id,
    body_digest: "...",
    article_id: article_id,
    thread: :post
  }
}
```

`replying_to` 是 nested comment snapshot，使用同一套 comment snapshot 规则。列表页可以 stale-first
返回，详情页可以 blocking 刷新。

## Cache 与刷新

Snapshot 内部使用现有 Cachex 体系维护短 TTL cache，但 cache 不是权威源。

项目已经通过 `Helper.Cache` 封装 Cachex，`CMS.Snapshot` 应复用该封装，不在业务代码里散落
`Cachex.get/put`。

新增独立 cache pool：

```elixir
config :groupher_server, :cache,
  pool: %{
    snapshot: %{
      name: :snapshot,
      size: 50_000,
      seconds: 5 * 60
    }
  }
```

pool 名使用 `:snapshot`，与模块 `CMS.Snapshot` 对齐。

不要混用现有 pool：

- `:common` 太泛，难以观测 snapshot 命中和容量。
- `:frontdesk_user` 缓存的是 FrontDesk user 读取结果，不负责 business snapshot stale-first。
- `:user_login` 是 login -> id 映射，语义完全不同。

推荐 key：

```text
snapshot:user:{id}
snapshot:article:{thread}:{id}
snapshot:comment:{thread}:{id}
```

Cache value 存标准化 summary：

```elixir
%{
  id: user_id,
  login: login,
  nickname: nickname,
  avatar: avatar,
  bio: bio,
  updated_at: updated_at
}
```

article / comment 使用对应的轻量 summary，不缓存完整 Ecto schema。

建议策略：

- request 内去重，避免同一请求重复 resolve。
- 短 TTL Cachex cache，适合 nickname/avatar/title 这类展示字段。
- stale-first 默认不阻塞列表。
- stale/miss 聚合成批量异步 refresh，不要逐条发 job。
- mutation 后可以事件驱动失效或刷新相关 snapshot。

标准 stale-first 链路：

```text
resolve snapshot
  -> request cache hit: 返回 cached summary
  -> Cachex ttl cache hit: 返回 cached summary
  -> cache miss / stale: 返回原 snapshot
  -> 收集 miss / stale refs
  -> enqueue async batch refresh
  -> job 批量查询权威表
  -> 回写 Cachex，必要时回写业务 snapshot
  -> 下次请求命中新 summary
```

mutation 事件链路：

```text
user/article/comment updated
  -> invalidate related Cachex summary
  -> enqueue targeted batch refresh if needed
```

mutation 后不必等待 TTL 到期。字段变化明确时，可以主动 invalidate 或 refresh。

异步刷新必须是批量任务，首选 Oban job：

```elixir
CMS.Snapshot.refresh_async(:user, user_ids)
CMS.Snapshot.refresh_async(:article, %{thread: :post, ids: article_ids})
```

不要为 30 篇文章里的每个 reaction user 单独发任务，也不要在 resolver 中随手 `Task.start/1`
启动不可观测的刷新。

推荐约束：

- `users/2`、`users_in/3` 只负责收集本次 resolve 中发现的 miss/stale refs。
- 同一次 resolve 内按 kind/id 去重。
- refresh enqueue 前做 batch 聚合，避免每个 item 单独入队。
- Oban job 负责 retry、去重、观测和失败记录。
- job 里批量查询权威表，再批量回写 Cachex / snapshot。

Cachex 只是单节点进程内 cache，不是跨节点事实源。多节点场景默认接受短 TTL 的最终一致性：

- 本节点 cache 命中时直接使用。
- 其他节点可能短时间仍返回旧 snapshot。
- mutation 后可以主动 invalidate 当前节点，并通过 refresh job 让后续请求逐步收敛。
- 如果未来需要跨节点强一致失效，再引入 PubSub/broadcast invalidation，而不是把 Cachex 当分布式 cache。

## Missing Entity

如果 snapshot 中的 id 对应实体已经不存在，例如 user 注销、article 删除、comment 删除，默认不要直接
过滤掉该元素，也不要返回 `nil` 替换。

原因是 snapshot 所在关系通常仍然存在：

- reaction 关系曾经由该 user 产生。
- notification 曾经指向该 actor。
- asset ref 曾经指向该 article。

默认策略：

```elixir
%{
  id: user_id,
  login: "deleted",
  nickname: "Deleted user",
  avatar: nil,
  unavailable: true
}
```

article / comment 也使用类似字段：

```elixir
%{
  id: article_id,
  title: "Unavailable article",
  unavailable: true
}
```

只有业务明确要求隐藏时，才在业务 adapter 层过滤。

Snapshot 的默认职责是：

- 保留原数组顺序和长度。
- 用 unavailable summary 替换已删除实体的展示字段。
- 不改变关系集合。

## 推荐 API

```elixir
CMS.Snapshot.users(simple_users, opts \\ [])
CMS.Snapshot.users_in(items, fields, opts \\ [])

CMS.Snapshot.articles(thread, article_snapshots, opts \\ [])
CMS.Snapshot.articles_in(thread, items, fields, opts \\ [])

CMS.Snapshot.comments(thread, comment_snapshots, opts \\ [])
CMS.Snapshot.comments_in(thread, items, fields, opts \\ [])

CMS.Snapshot.refresh_async(kind, refs, opts \\ [])
```

默认 `opts`：

```elixir
[
  mode: :stale_first
]
```

可选：

```elixir
[
  mode: :blocking,
  fields: [:login, :nickname, :avatar],
  ttl: :timer.minutes(5)
]
```

## 场景建议

列表页：

```elixir
posts =
  posts
  |> CMS.Snapshot.users_in([
    :latest_upvoted_users,
    :latest_viewed_users,
    :latest_reported_users,
    :latest_reacted_users
  ])
```

详情页：

```elixir
article = CMS.Snapshot.articles(:post, [article], mode: :blocking) |> List.first()
comments = CMS.Snapshot.comments_in(:post, comments, [:replying_to], mode: :blocking)
```

asset refs：

```elixir
refs = CMS.Snapshot.articles_in(:post, refs, [:article])
```

## 设计原则

- 通用 resolve，场景化 merge。
- simple user / article / comment snapshot shape 可以标准化，减少业务重复代码。
- 默认不阻塞列表页。
- blocking 只用于详情页、后台、编辑器、强一致场景。
- snapshot 只更新展示字段，不改变业务关系。
- 异步刷新必须批量化。
- cache 是优化，不是事实来源。
