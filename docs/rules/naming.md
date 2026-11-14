# 命名规则

本文记录适用于整个 Groupher 仓库的命名约束。新代码、数据库字段、GraphQL schema、类型定义和文档都应
使用同一术语；不为未发布设计保留旧字段或 alias。

## 使用 `type`，禁止 `_kind`

项目统一使用 `type` 表示封闭分类，不新增以 `_kind` 结尾的命名：

```text
正确                          禁止
actor_type                    actor_kind
viewer_type                   viewer_kind
resource_type                 resource_kind
actor_types                   actor_kinds
```

该规则覆盖变量、函数参数、结构字段、数据库列、GraphQL 字段/enum、TypeScript 类型和文档术语。仓库中
已有的 `snapshot_kind`、`body_kind` 等存量命名不要求发起独立的全仓迁移；当功能改动实际触及其所属
模型、协议或字段时，在同一改动中收敛为 `type`。仅修改同模块的无关代码不应被迫扩大成命名迁移。
实施尚未发布的设计时直接替换旧命名，不保留 alias、双写或兼容读取。

`type` 表示分类，boolean 表示相互独立的二元事实。不要为了把多个维度塞进一个 enum 而制造组合类型。
例如访问者协议使用：

```text
actor_type
  human / agent / crawler / unknown

is_authenticated
  true / false
```

来源或验证方式使用独立字段表达，例如 `classified_by = account_session | signed_anonymous_id |
agent_credential | delegation_credential | verified_crawler | self_reported | fallback`。

## GraphQL operation 与前端 Query 命名

GraphQL operation 名描述资源和读取形态，不描述页面、加载过程或缓存实现。先确定资源，再判断是否为
分页集合。

### 单资源与领域查询

单资源或领域查询直接使用资源名，GraphQL operation 使用 PascalCase：

```graphql
query Community($slug: String!) {
  community(slug: $slug) {
    ...CommunityFields
  }
}
query Doc($article: ArticlePathInput!) {
  doc(article: $article) {
    ...DocFields
  }
}
query CommunityTagGroups($community: String!, $thread: Thread) {
  communityTagGroups(community: $community, thread: $thread) {
    id
  }
}
query Categories {
  categories {
    id
  }
}
```

`Community` 的响应包含页面所需的 dashboard、wallpaper 等字段，不改变 operation 名；这些是响应字段，
不是新的资源或“页面查询”。禁止新增 `Page*`、`Bootstrap`、`Shell` 等页面或加载实现前缀：

```text
禁止新增：PageCommunity、PageDoc、CommunityPageShell、CommunityBootstrap
```

分页查询统一使用 `PagedXxx`；`PostPage`、`DocPage`、`ChangelogPage`、`CommentPage` 等
`*Page` 查询已完成收敛，新代码不得再使用 `*Page` 作为分页查询名。

### 分页集合

只有带 `pagi` 输入或明确分页语义的集合查询使用 `PagedXxx`：

```graphql
query PagedCommunities($filter: CommunitiesFilter, $pagi: PagiInput) {
  pagedCommunities(filter: $filter, pagi: $pagi) {
    ...PagedCommunitiesPageInfo
  }
}
query PagedSubscribedCommunities($login: String!, $filter: UserListFilter, $pagi: PagiInput) {
  subscribedCommunities(login: $login, filter: $filter, pagi: $pagi) {
    ...PagedCommunitiesPageInfo
  }
}
```

非分页集合使用资源或领域名，例如 `Categories`、`CommunityTagGroups`。不要同时叠加 `Page` 和
`Paged`（如 `PagePagedCommunities`）。

### Fragment

Fragment 使用 `<Resource>Fields`、`<Resource>DetailFields`；分页列表信息使用
`<PagedXxx>PageInfo`，列表专用字段可使用 `<Resource>ListFields`。不使用 `Page*` 前缀。

```graphql
fragment CommunityFields on Community {
  slug
}
fragment CommunityListFields on Community {
  slug
  title
}
fragment PagedCommunitiesPageInfo on CommunityPage {
  pageInfo {
    hasNextPage
  }
}
```

### TypeScript 导出、取数函数和 Query key

- GraphQL operation `Community` 的 TypeScript 导出使用 `community`，不保留 `pageCommunity`、
  `communityPage` 等别名。
- 取数函数使用 `fetch<Resource>`，例如 `fetchCommunity`；不要使用 `fetchCommunitySnapshot`
  等缓存或实现术语。
- TanStack Query key 保持在 `Q.<domain>.<query>` 命名空间，例如 `Q.community.slug`、
  `Q.dsb.slug`；Query key 不是网络请求，GraphQL operation 名也不描述 cache key。
- codegen 类型跟随 operation 名，例如 `CommunityQuery`、`PagedCommunitiesQuery`；不手写旧名称
  别名或兼容类型。
- 单 canonical query 的 domain 使用 `.slug`（`Q.community.slug`、`Q.dsb.slug`、
  `Q.wallpaper.slug`、`Q.wallpaperEditor.slug`、`Q.press.slug`）；多 query domain 使用语义方法
  （`Q.article.posts`、`Q.ticket.page`、`Q.activity.config`）。真正的 config 资源可以保留
  `.config`，但不要为同一个 canonical query 同时保留 `.config` 和 `.slug`。
- mutation key 由 domain 的 `*MutationKeys` 提供，例如 `dsbMutationKeys.save`、
  `pressMutationKeys.update`、`wallpaperMutationKeys.publish`；不要在组件里手写 mutation key
  数组。
- GraphQL mutation operation 不使用 `Query*` 前缀，例如 `UpvotePost`、`EmotionToDoc`、
  `AddToCollect`，不要命名为 `QueryUpvotePost`。
- 独立领域使用自己的 query 域和 invalidation 域；例如 Press 使用 `Q.press.slug` /
  `pressKeys` / `QueryInvalidation.press`，不要挂在 `communityKeys.pressConfig` 下。

### 一个 operation，多个 Query key

一个 GraphQL operation 可以被投影到多个 TanStack Query key。例如 `Community` operation 的同一
响应 seed `Q.community.slug`、`Q.dsb.slug`、`Q.wallpaper.slug`。命名时分别按资源
（operation）和缓存所有权（Query key）判断，不要把 Query key 数量当作网络请求数量。

### 存量命名清理

触及相关查询时按以下方向收敛，不做长期 alias：

| 当前                                      | 目标                           |
| ----------------------------------------- | ------------------------------ |
| `PageCommunity`                           | `Community`                    |
| `PagePagedCommunities`                    | `PagedCommunities`             |
| `PageSubscribedCommunities`               | `PagedSubscribedCommunities`   |
| `PageCommunityFields`                     | `CommunityFields`              |
| `PageCommunityPageInfo`                   | `PagedCommunitiesPageInfo`     |
| `PageDoc`                                 | `Doc`                          |
| `PageDocPublicTree`                       | `DocPublicTree`                |
| `PageCommunityTagGroups`                  | `CommunityTagGroups`           |
| `PageCategories`                          | `Categories`                   |
| `Page*Fields`                             | `*Fields`                      |
| `PostPage`                                | `PagedPosts`                   |
| `ChangelogPage`                           | `PagedChangelogs`              |
| `DocPage`                                 | `PagedDocs`                    |
| `CommentPage`                             | `PagedComments`                |
| `CommentReplyPage`                        | `PagedCommentReplies`          |
| `TicketPage`                              | `PagedTickets`                 |
| `TicketPageInternal`                      | `PagedTicketsInternal`         |
| `DashboardModeratorPage`                  | `PagedCommunityModerators`     |
| `ArticleLogsPage`                         | `PagedArticleLogs`             |
| `MentionsGraphPage`                       | `PagedMentionsGraph`           |
| `CommentPagiInfo`                         | `CommentPageInfo`              |
| `communityKeys.pressConfig`               | `pressKeys.slug`               |
| `DashboardPressConfig`                    | `PressConfig`                  |
| `UpdateDashboardPressConfig`              | `UpdatePressConfig`            |
| `QueryInvalidation.community.pressConfig` | `QueryInvalidation.press.slug` |
| `Q.community.config`                      | `Q.community.slug`             |
| `Q.dsb.config`                            | `Q.dsb.slug`                   |
| `Q.wallpaper.config`                      | `Q.wallpaper.slug`             |
| `Q.wallpaperEditor.config`                | `Q.wallpaperEditor.slug`       |
| `projectCommunityConfig`                  | `pickCommunityFields`          |
| `patchCommunityConfig`                    | `patchCommunity`               |
| `fetchCommunitySnapshot`                  | `fetchCommunity`               |

主要落点：`frontend/core/schemas/pages/{community,doc,misc,blog,post,changelog,press}.ts`、
`frontend/core/schemas/pages/{article,doc}.fragments.ts`、`frontend/core/query/press.ts` 和
`frontend/core/query/communitySource.ts`。

重命名 operation 时同批运行 `pnpm run graphql:codegen`，并更新
`frontend/core/lib/graphql/generated/**`；不要手改生成文件。GraphQL operationName 会出现在服务端
日志和指标中，operation 重命名应作为独立、可回滚的清理提交。

## Elixir 折行使用完整 block

Elixir 的 inline `do:` 只用于完整表达式能放在同一物理行的情况。`def`、`defp`、`defmacro`、
`defmacrop`、`if`、`unless`、`case` 或 `with` 一旦折行，统一改用完整的 `do ... end`：

```elixir
# 正确：单行 inline
def published?(article), do: article.stage == :published

# 正确：折行 block
def publish(article, actor, opts) do
  Commands.Publish.execute(article, actor, opts)
end
```

禁止把表达式在逗号后折行，再在下一行书写 `do:` 或 `else:`。该规则由
`GroupherServer.Credo.Check.NoWrappedInlineDo` 在 CI 中强制执行。
