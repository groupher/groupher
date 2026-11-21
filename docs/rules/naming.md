# 命名规则

本文记录适用于整个 Groupher 仓库的命名约束。新代码、数据库字段、GraphQL schema、类型定义和文档都应
使用同一术语；不为未发布设计保留旧字段或 alias。

## 分类字段统一使用 `type`

`type` 是分类字段名的基础词，不要求字段只能叫 `type`。允许使用领域限定的 `<domain>_type` 及对应集合 `<domain>_types`；字段名任何位置都禁止出现 `kind`：

```text
允许：type、target_type、actor_type、asset_type、event_type、node_type、change_type
允许集合：types、target_types、actor_types、asset_types
```

该规则覆盖变量、函数参数、结构字段、数据库列、GraphQL 字段/enum、TypeScript 类型和文档术语。存量字段若违反此规则也必须迁移，不能以“已经存在”为由豁免；可按明确批次完成，但不得在新设计、新协议或触及该字段的改动中继续使用旧名。重命名直接切换，不保留 alias、双写或兼容读取。仅修改无关代码时不要求顺带扩大迁移范围。

`type` 及领域限定的 `<domain>_type` 表示分类，boolean 表示相互独立的二元事实。不要为了把多个维度塞进一个 enum 而制造组合类型。
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

## GraphQL enum runtime map

`graphql:codegen` 同时生成 `frontend/core/lib/graphql/generated/enums.ts`：每个 enum 都有 `as const`
运行时对象和对应 type。前端常量不再手写枚举值，而是用 `valueKeyedEnum` 或显式 alias 从生成对象派生：

```ts
export const ARTICLE_CAT = valueKeyedEnum(ArticleCatEnum)
export type TArticleCat = ArticleCatEnum
```

- 类型直接 alias 生成 type
- 运行时值从生成对象派生
- UI 需要小写 key 时用 `lowerEnumValue` 在展示层派生
- 不手写第二份 enum 值，也不在组件里散落大小写转换

### 尚存的协议边界

- `packages/contracts` 的 pagination fallback 仍使用小写 HTTP 值；当前只在
  `frontend/core/lib/pagination/params.ts` 映射一次。若要彻底统一，需要同步修改 backend contract 测试和
  HTTP DTO。
- CMS Review 的 `state` 和部分 opinion/notice 字段在 GraphQL 中仍是 `string`；需要先补 backend enum
  和 schema SDL，再生成前端类型。
- Wallpaper 的 render profile/theme 使用小写 UI key，但 wire enum 已由生成对象提供；只允许在
  wallpaper adapter 中做大小写派生。

## GraphQL enum 单一词汇

GraphQL enum 的 schema 值是前端数据层的 canonical 值。前端不要为同一语义再维护一套大小写不同、
成员相同的 enum；能直接复用生成类型时直接复用：

```ts
import type { PagiMode } from '~/lib/graphql/generated/graphql'

export type TPaginationMode = PagiMode
```

`TDsbRaw` / `TDsb` 这类 wire 与 parsed 分层只用于结构差异（嵌套、默认值、规范化），不用于复制
同一组 enum。

只有外部协议确实使用不同字面值时，才允许在唯一的 transport adapter 转换，例如：

- `packages/contracts` 的 HTTP pagination fallback 仍使用小写；在 `lib/pagination/params.ts`
  集中映射到前端 `PagiMode`。
- Wallpaper render profile 使用小写 UI key；只在 GraphQL publish/upload adapter 转成
  `WallpaperProfile`。
- Doc tree 本地模型使用小写；`DOC_TREE_NODE_TYPE_WIRE` 只承担 GraphQL boundary 映射。

禁止在组件、query 和测试里散落 `.toLowerCase()` / `.toUpperCase()` 来处理 enum。

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
