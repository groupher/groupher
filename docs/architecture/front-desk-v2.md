# FrontDesk V2：单资源读取合同

> 状态：V2 实施基线已落地。本文冻结 FrontDesk V2 的长期资源读取边界、目标 API、
> mode/actor/view 语义和直接切换顺序；完整 locator × mode 测试矩阵和 protected-boundary
> 静态检查仍按 Phase 5/6 持续补齐。
>
> 版本关系：本文取代 [FrontDesk V1](./front-desk.md) 的单资源读取、owning Reader 和
> `public / management / operations` 合同。V1 中已完成的通用 `get/get_by/preload`
> 删除、DBProbe 与 mutation/Gate 边界继续有效，除非本文明确修订。

相关文档：

- [CMS 资源加载与 Canonical Reload 边界](./resource-loading-boundary.md)：transport ref、Gate canonical reload 和 async reload；
- [CMS Command](./cms-command.md)：command receipt、result recovery 和 canonical business result；
- [Gate V4](../feature/gate/v4.md)、[Gate V5](../feature/gate/v5.md)：typed Scope/Access Context、mutation admission 和 canonical reload；
- [ORM](./orm.md)：`Helper.ORM`、Repo 与持久化边界。

## 1. 决策摘要

FrontDesk 是 User、Community、Article 和 Comment 等顶层领域资源的单资源唯一读取入口。
它不是 Ecto schema 的通用查询代理，也不只是面向 GraphQL 的 public projection loader。

```text
Application / GraphQL / Command / Event / cross-domain caller
  -> FrontDesk.<resource>(ref, actor?, mode/view)
  -> resource-owned FrontDesk implementation
  -> Gate Scope / Lifecycle / stable internal lookup
  -> Repo / ORM
  -> mode-specific stable result
```

冻结以下规则：

1. 按稳定标识读取一个顶层资源，无论调用方是 transport、Command、Writer、Event 还是 recovery，都经过 FrontDesk。
2. 不再暴露 `Articles.Reader.article/1`、`Articles.Reader.community/1`、`Comments.Reader.load/1`、`Communities.Reader.load/1` 等单资源入口；保留 `load_article_for_notification/1` 等通知、mentions 和 lifecycle 专属读取。
3. FrontDesk 读取 mode 只有 `:public | :management | :internal`。
4. `mode` 表达读取语义，`actor` 表达调用身份，`view` 表达具名结果形状；三者不得互相代替。
5. `:public` 是默认 mode；普通公开读取不显式传它。
6. `:management` 必须携带 actor；Gate 根据当前资源关系判断 owner、moderator 或其他管理权限。
7. `:internal` 是受信后端读取语义，不伪装成 actor，不得由 GraphQL 或其他外部输入选择。
8. `:owner_management`、`:moderator_management`、`:operations` 和 `:insights_management` 不再是 FrontDesk mode。
9. Mutation admission 仍归 `Gate.access_check`/`with_check`；FrontDesk 读取成功不能代替 action authorization。
10. 不允许调用方传入 Ecto `preload`、query、schema、clauses 或 `fill_meta` 等持久化实现选项。
11. V2 直接切换，不保留旧 Reader 单资源 wrapper、`:operations` FrontDesk overload 或 mode 兼容映射。
12. Reader 是否整体改名为 Query 不在 V2 范围内；本文只冻结它不再暴露单资源读取。

## 2. 资源与内部状态的边界

### 2.1 顶层资源

V2 首批收口四类顶层资源：

```elixir
FrontDesk.user(ref, ...)
FrontDesk.community(ref, ...)
FrontDesk.article(ref, ...)
FrontDesk.comment(ref, ...)
```

它们可以被产品路径、跨领域路径和 owning domain 内部路径共同需要。因此 owning domain
不得以“这是自己的 schema”为由绕过 FrontDesk：

```elixir
# 禁止：顶层资源的第二套单资源入口
Articles.Reader.article(article_id)
Articles.Reader.community(community_id)
Comments.Reader.load(comment_id)
Communities.Reader.load(community_id)
```

### 2.2 Aggregate-owned 内部状态

`ArticleDraft`、`ArticlePublic`、`ArticleRevision`、`ArticleLifecycle`、`DocPublic`、`CommandReceipt`、
Outbox row 等不是顶层业务资源。它们继续归 owning Store、Gate Loader、maintenance owner
或 FrontDesk 资源实现内部，不为形式统一新增同名顶层 API。

调用方需要的是一个 Article command context 或 publish recovery result 时，应请求具名资源 view，
不应自行逐行读取 Article、Public、Revision 和 Lifecycle：

```elixir
FrontDesk.article(article_id, mode: :internal, view: :command_context)
FrontDesk.article(article_id, mode: :internal, view: :publish_result)
```

FrontDesk 内部可以把这些 view 交给资源 owner 的私有 helper/Store 组装，但不得重新形成可被
Command、Resolver 或跨领域模块直接调用的 `Reader.xxx` 单资源 surface。

### 2.3 列表与业务查询

FrontDesk 只拥有单资源及稳定业务关系。以下查询不进入 FrontDesk：

- page、list、search；
- count、aggregate、exists；
- reaction users 等独立产品集合；
- backfill、GC、reconciliation 和 maintenance scan。

这些查询继续通过领域 Facade 与当前 Reader/Store/maintenance owner 完成。Reader 是否改名为
Query 留待后续独立讨论。

### 2.4 现有 facade surface 处置

V2 不只约束新 API，还必须穷举处置当前 `CMS.FrontDesk` 的非通用入口。未列入下表的新入口
不得以“资源专属”为由默认进入 FrontDesk；必须先判定它是单资源、稳定业务关系、
独立产品查询还是写用例。

| 现有入口                                          | V2 处置             | 目标边界                                                                                 | 所属 Phase   |
| ------------------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------- | ------------ |
| `load_reaction_users/3`                           | 迁移后删除          | `CMS.Interactions.upvoted_users/2` / `collected_users/2`；Interaction 产品集合读取       | Phase 3      |
| `article_paths/1`                                 | 迁移后删除          | `CMS.Articles` bounded batch query；保留一次 Gate-aware batch，不退化为逐 path FrontDesk | Phase 2      |
| `article_stats/3`                                 | 迁移后删除          | `CMS.ArticleStats` batch projection read                                                 | Phase 2      |
| `article_stats_for_articles/2,3`                  | 迁移后删除          | `CMS.ArticleStats` 已授权 Article batch projection read                                  | Phase 2      |
| `full_comment/1`                                  | 收敛后删除          | `FrontDesk.comment(comment_id, mode: :internal, view: :article_context)`                 | Phase 3      |
| `sync_embed_replies/1`                            | 删除 FrontDesk 转发 | `CMS.Comments.Replies` 或 Comments 写用例；不属于读 facade                               | Phase 3      |
| `article_for_view_tracking/1`                     | 保留                | ViewTracker 专属 public Article admission                                                | Phase 1 冻结 |
| `lock_article_for_view_tracking/1`                | 保留                | ViewTracker 事务内 physical Article 锁定与 Gate revalidation                             | Phase 1 冻结 |
| `article_insights/3`                              | 保留                | Article 专属 `:read_insights` action/view；不新增 FrontDesk mode                         | Phase 1/4    |
| `community_tags/1`                                | 删除                | 无生产调用方的 batch relation read；不在 FrontDesk 保留兼容入口                          | Phase 3      |
| `community_tag/1,3`                               | 保留                | CommunityTag 稳定 relation lookup；Tags/TagStats owning code 使用                        | Phase 1      |
| `community_tag_group/1`                           | 保留                | CommunityTagGroup 稳定 relation lookup；GraphQL title projection 使用                    | Phase 1      |
| `revalidate_user/1`                               | 删除                | cache invalidation 统一走 Root `FrontDesk.revalidate().user/1`，不属于 CMS read facade   | Phase 3      |
| `article_author/1`、`article_of/1`、`thread_of/1` | 保留                | Article/Comment 稳定业务关系                                                             | Phase 1      |

`load_reaction_users/3` 的迁移必须遵守 Interaction 已有产品 facade，不在 FrontDesk 增加豁免。
`community_tags/1` 没有生产调用方，直接删除而不新增替代 wrapper。CommunityTag 和
CommunityTagGroup 是稳定关系 lookup，不应被误列为顶层 User/Community/Article/Comment 资源。
ArticleStats 迁移只改变 facade ownership：必须保留 batch read、post-commit loader、revision/snapshot
观察语义和 missing-row 错误，不新增 singular stats wrapper，也不合成 zero counts。

`full_comment/1` 当前返回的是 Comment 的父 Article、thread 和 Article author context，不是
“更完整的 Comment”。V2 因此使用具名 `:article_context` view，不引入含混的 `:full` view。

ViewTracker 两个入口是明确的单资源 use-case API，不是 list/batch 例外。`lock_article_for_view_tracking/1`
还携带事务锁和 canonical revalidation 语义，不得为了形式统一改成
`FrontDesk.article(..., view: :locked)`。

以下相邻 Reader/owning-facade surface 也属于 V2 收口范围，不能因为它们不在
`CMS.FrontDesk` 模块中就遗漏：

| 残留入口                                                                                                     | V2 处置                                                                                                                       | 所属 Phase |
| ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `CMS.Comments.one_comment/1,2` 依赖 `Comments.Reader.one_comment/1,2`                                        | 保留 `CMS.Comments` 的 viewer-hydration 产品用例；改由 FrontDesk Comment load，删除 Reader 单资源实现                         | Phase 3    |
| `Communities.Reader.fetch/2,3` 的 `:operations` overload                                                     | 删除 Reader 与 `CMS.Communities` 的 operations 转发；command result/recovery 改用 `FrontDesk.community(..., mode: :internal)` | Phase 4    |
| `Communities.Writer.create/2` 与 `Communities.Moderator` 的 post-write `Reader.fetch(..., inc_views: false)` | 改为明确 internal Community reload；保留 post-write 不增加 views 的语义                                                       | Phase 4    |
| `CMS.Communities.fetch/1,2,3` 的 public/viewer read                                                          | 暂保留为 owning product read；它承载 `inc_views` 与 viewer state，不再接受 operations policy                                  | Phase 2/4  |

## 3. 统一调用形状

### 3.1 Actor 优先，mode 默认

FrontDesk 保留项目现有的 actor-first 调用习惯。`:public` 是默认 mode，普通读取不写出它：

```elixir
# public，无 actor
FrontDesk.article(article_path)

# public，携带 viewer actor
FrontDesk.article(article_path, user)

# management，actor 必填
FrontDesk.article(article_path, user, mode: :management)

# internal，没有伪 actor
FrontDesk.article(article_id, mode: :internal)

# internal 具名 view
FrontDesk.article(article_id, mode: :internal, view: :command_context)
```

目标 facade 支持两种显式形状：

```elixir
resource(ref, actor)
resource(ref, actor, opts)
resource(ref, opts) when is_list(opts)
```

实现必须通过 pattern matching/guard 区分 User actor、keyword opts 与非法输入，不使用会产生歧义的
多组默认参数。

`resource(ref, opts)` 只用于选择非默认 mode 或非默认 view。生产代码不显式传
`mode: :public`；默认 public 必须使用 `resource(ref)` 或 `resource(ref, actor)`。

### 3.2 Keyword 顺序

`mode:` 和 `view:` 是同一 keyword list 的元素，Elixir 语法不要求它们的先后顺序。V2 统一书写为：

```elixir
mode: :internal, view: :command_context
```

先表达读取语义，再表达结果形状。同一 keyword list 不得重复 `mode` 或 `view` key。

## 4. 读取 mode

### 4.1 Public

`:public` 返回 canonical public projection，是所有资源 API 的默认 mode。

它必须遵守：

- Community Lifecycle 公开可见性；
- Article/Comment lifecycle、moderation、thread 和 Doc main-branch 可见性；
- public locator 合同；
- 需要 actor 时的 viewer state 或明确 owner preview 规则。

actor 可选，但 actor 的存在不会自动把 mode 升级为 management。

### 4.2 Management

`:management` 返回 actor-aware management projection。actor 必填，Gate 根据 actor 与当前资源的真实
关系判断它是 owner、moderator 还是其他管理角色。

```elixir
FrontDesk.community(ref, user, mode: :management)
FrontDesk.article(path, user, mode: :management)
FrontDesk.comment(path, user, mode: :management)
```

调用方不得选择 `:owner_management` 或 `:moderator_management` 来声称自己的角色。这些差异属于
Gate policy 内部的关系判定，不是 FrontDesk mode。

Management read 只证明 actor 可以读取该管理视图，不证明它可以执行 publish、trash、destroy
或其他 mutation action。

User 是例外：Accounts 当前没有独立的 actor-aware management projection，因此 User 只暴露
public-compatible lookup 与 trusted internal lookup，不接受 `mode: :management`。

### 4.3 Internal

`:internal` 返回受信后端用例需要的稳定 domain entity 或具名 internal view，用于：

- Command target load；
- Event/effect 资源恢复；
- Receipt result recovery；
- projection rebuild；
- owning domain 中不应受 public visibility 限制的单资源读取。

```elixir
FrontDesk.community(community_id, mode: :internal)
FrontDesk.article(article_id, mode: :internal)
FrontDesk.comment(comment_id, mode: :internal)
FrontDesk.user(user_id, mode: :internal)
```

Internal 不是“跳过一切校验”：

- 它不应用终端用户的 public/management 可见性过滤；
- 但仍必须校验 locator 类型、资源存在性、关联完整性和 view 前置条件；
- 它不替代 mutation Gate、事务锁、optimistic version guard 或 Writer invariant；
- 它不接收一个伪造的 `:operations` actor。

GraphQL schema/resolver/middleware、HTTP/CLI/MCP public adapter 不得根据外部参数选择 `:internal`。
这一限制应由 API 边界、protected-boundary 静态检查和测试共同保证，不依赖调用者约定。

### 4.4 Insights 是 action/view，不是 mode

Article Insights 等特定产品读取应由 `:read_insights` Gate action 与具名 API/view 表达，不新增
`:insights_management` FrontDesk mode。mode 只回答 public、management 或 trusted internal 三类读取语义。

## 5. Locator 与 mode 矩阵

V2 使用 pattern matching 显式限制 locator 与 mode 的合法组合。不得因为底层可以 `Repo.get`
就允许 public 读取通过物理 ID 绕过正式可见性链。

| 资源      | Public locator                                                | Management locator              | Internal locator                                |
| --------- | ------------------------------------------------------------- | ------------------------------- | ----------------------------------------------- |
| User      | login 或 integer id（兼容 locator，返回同一 User projection） | 不提供独立 User management mode | stable user id；必要时可接受 login              |
| Community | slug/aka                                                      | slug/aka                        | stable community id；必要时可接受 slug          |
| Article   | `ArticlePath`                                                 | `ArticlePath`                   | stable article UUID；必要时可接受 `ArticlePath` |
| Comment   | `CommentPath`                                                 | `CommentPath`                   | stable comment id；必要时可接受 `CommentPath`   |

例如，Article 和 Comment 的物理 ID 只允许 internal：

```elixir
FrontDesk.article(article_id, mode: :internal)
FrontDesk.comment(comment_id, mode: :internal)
```

以下调用必须 fail closed：

```elixir
FrontDesk.article(article_id)
FrontDesk.article(article_id, user, mode: :management)
FrontDesk.comment(comment_id, mode: :public)
```

## 6. View 合同

### 6.1 View 只决定 shape

`view` 是资源专属的具名结果形状，它不是 Ecto preload alias，不得改变 mode 和授权范围。

```elixir
FrontDesk.article(article_id, mode: :internal, view: :default)
FrontDesk.article(article_id, mode: :internal, view: :with_community)
FrontDesk.article(article_id, mode: :internal, view: :with_author)
FrontDesk.article(article_id, mode: :internal, view: :command_context)
```

每个 view 必须在资源 FrontDesk 的 typespec、`@doc` 和测试中枚举。未知 view fail closed；不接受调用方
传入的任意 preload tree。

### 6.2 资源实现拥有 shape

FrontDesk 的资源实现决定一个 view 需要哪些 join/preload、返回 domain entity 还是 projection、
以及如何填充 meta。调用方只声明稳定业务意图，不声明持久化细节。

一个 view 只有单一调用方且纯属 owning domain 事务实现时，可以由 FrontDesk 的私有 helper
完成，不必为它新增公开 view。

## 7. 各资源目标合同

### 7.1 Community

```elixir
FrontDesk.community(ref)
FrontDesk.community(ref, actor)
FrontDesk.community(ref, actor, mode: :management)
FrontDesk.community(ref, mode: :internal)
```

V2 删除 `FrontDesk.community(ref, :operations)` 和 `Articles.Reader.community/1`。内部 Article
Command/Writer 需要 Community 时使用：

```elixir
FrontDesk.community(article.community_id, mode: :internal)
```

### 7.2 Article

```elixir
FrontDesk.article(article_path)
FrontDesk.article(article_path, actor)
FrontDesk.article(article_path, actor, mode: :management)
FrontDesk.article(article_id, mode: :internal)
FrontDesk.article(article_id, mode: :internal, view: :command_context)
```

Public/management Article 通过 ArticlePath 完成 Community、thread、branch、lifecycle 和 moderation
可见性。Internal Article 通过稳定 UUID 加载 command/event/recovery 需要的 domain entity 或具名 view。

Post、Blog、Changelog 和 Doc 继续共享 `FrontDesk.article`，不新增 thread-specific FrontDesk facade。

### 7.3 Comment

```elixir
FrontDesk.comment(comment_path)
FrontDesk.comment(comment_path, actor)
FrontDesk.comment(comment_path, actor, mode: :management)
FrontDesk.comment(comment_id, mode: :internal)
```

CommentPath 与 integer ID 必须进入同一组 pattern-matched facade clauses。不允许继续存在
“path 先校验 public Article，integer ID 直接 `ORM.find`”的隐式双语义。

### 7.4 User

```elixir
FrontDesk.user(ref)
FrontDesk.user(user_id, mode: :internal)
FrontDesk.fresh_user(ref)
```

`user` 的 mode 与 `fresh_user` 的缓存一致性是两个维度。V2 不允许用 `view` 或 mode
伪装 `preload`/`fill_meta` 选项。`fresh_user` 是否在实施阶段并入 internal view，必须以缓存
与 revalidation 合同审计为准；在此之前保留其现有稳定语义。

当前冻结选择 1：public 继续接受 integer id，返回 Accounts 的同一 User projection；
`mode: :internal` 只表达受信后端读取语义，不改变 User projection 的字段合同。User 不接受
`mode: :management`，未知 mode fail closed。

## 8. Mutation、Gate 与 canonical reload

FrontDesk 统一单资源入口，不意味着 mutation 只需读取一次：

```text
transport public ref/path
  -> FrontDesk public/management read
  -> loaded resource
  -> CMS Facade / Command
  -> Gate action admission
  -> aggregate lock
  -> Gate/Store canonical reload
  -> Writer
```

必须区分：

- Gate 前为解析同一资源重复读取：应删除；
- Gate aggregate lock 内为得到当前事务快照的 canonical reload：必须保留；
- Writer/Store 中与写入共享事务的 invariant query：不迁入 FrontDesk；
- Command/Event 在事务外按 stable identity 读取一个顶层资源：进入 FrontDesk internal。

## 9. GraphQL 与受信边界

GraphQL 对 FrontDesk mode 的选择是服务端静态决策，不是 schema argument：

- 公开 field 使用默认 public；
- 管理 field 由 resolver/middleware 固定选择 management，并传入已认证 actor；
- 任何 GraphQL variable/input 都不得映射为 `mode: :internal`；
- public adapter 不得接收通用 `mode` 字符串并转为 atom；
- CLI/MCP/service adapter 即使受信，也应调用具体用例，不向外部暴露任意 FrontDesk internal read。

## 10. 实施边界

### Phase 1：冻结 facade 和 mode（已落地）

- 为 Community、Article、Comment、User 冻结 ref/actor/opts clauses；
- 冻结 `:public | :management | :internal`；
- 冻结 §2.4 现有 facade surface 的保留/迁移/删除结果，不留未分类入口；
- 冻结 `FrontDesk.user(integer)` 为 public-compatible locator，并记录其与 login lookup 的 projection 合同；
- 显式保留 ViewTracker 的 admission 与 transaction-lock 两个具名入口；
- 为未知 mode、非法 actor/mode 组合和非法 locator/mode 组合 fail closed；
- 禁止 GraphQL/transport 透传 internal；
- 不保留 `:operations` compatibility branch。

### Phase 2：Community 与 Article 单资源迁移（已落地）

- `Articles.Reader.community/1` 的调用迁到 `FrontDesk.community(..., mode: :internal)`；
- `Articles.Reader.article/1` 及 `article_with_*` 调用迁到 Article internal/default/named view；
- publish/update/create/trash/replace-asset 的 command target 和 recovery 迁移；
- Article 的 Draft/Public/Revision/Lifecycle 逐行读取收敛为私有组装或具名 internal view；
- `article_paths/1` 迁到 `CMS.Articles` bounded batch query，保留批量 Gate/SQL shape；
- `article_stats/3` 和 `article_stats_for_articles/2,3` 迁到 `CMS.ArticleStats`，保留 batch 与 post-commit 读取合同；
- 删除对应 Reader 单资源 surface。

### Phase 3：Comment、Community 与 User 其余迁移（已落地）

- `Comments.Reader.load/1` 迁到 `FrontDesk.comment(..., mode: :internal)`；
- Comment path/id 读取收敛为同一组 mode-aware clauses；
- `full_comment/1` 收敛为 Comment internal `:article_context` view；
- `sync_embed_replies/1` 从 FrontDesk 删除，调用方进入 Comments 写 owner；
- `load_reaction_users/3` 迁到 `CMS.Interactions.upvoted_users/2` 和 `collected_users/2`；
- `Communities.Reader.load/1` 迁到 Community internal；
- CommunityApplication 等跨聚合的 User/Community 单资源读取迁到 FrontDesk；
- 审计 Root/Accounts/CMS 三层 FrontDesk 的转发语义，不保留绕过 mode 的快捷入口。

### Phase 4：Gate mode 收口（已落地）

- FrontDesk 对外不再接受 owner/moderator/operations/insights mode；
- Gate policy 内部根据 actor-resource relation 区分 owner/moderator；
- 将 Insights 保留为 action/专用读取合同；
- 旧 operations 使用点已按“FrontDesk internal / mutation system actor / maintenance”分类，
  不再通过 Community Reader overload 暴露。

### Phase 5：静态约束与测试（持续补齐）

- protected-boundary 检查禁止 Resolver/Command/Event 调用 Reader 单资源 API；
- 检查 GraphQL/transport 不得透传 internal；
- 覆盖 locator x mode x actor x view 合法性矩阵；
- 覆盖 public/management/internal 在 Lifecycle/moderation 上的差异；
- 覆盖未知 mode/view 和 actor/mode mismatch 的 fail-closed 错误；
- 保留 DBProbe 对物理行、事务副作用和约束的测试读取。

### Phase 6：验证与直接切换（本次基线已验证）

- 删除旧 Reader 单资源 API 和 `:operations` FrontDesk overload；
- 不保留 deprecated wrapper 或双路径 fallback；
- 运行聚焦 FrontDesk/Gate/Command 测试；
- `mix compile --warnings-as-errors`；
- `pnpm docs:check`；
- 通过 CodeGraph/rg 确认生产调用方不再依赖旧 surface。
- 对照 §2.4 逐项确认所有现有 facade 入口已保留、迁移或删除，无未分类 surface。

## 11. 测试矩阵

| Locator                | Actor             | Mode                    | 期望                                       |
| ---------------------- | ----------------- | ----------------------- | ------------------------------------------ |
| public path/ref        | nil               | default/public          | 公开 canonical projection                  |
| public path/ref        | User              | default/public          | 公开 projection + 允许的 viewer state      |
| public path/ref        | User              | management              | Gate 关系判定后的 management projection    |
| public path/ref        | nil               | management              | actor/mode mismatch，fail closed           |
| stable physical id     | nil               | internal                | stable domain entity/default internal view |
| stable physical id     | nil               | public                  | invalid locator，fail closed               |
| stable physical id     | User              | management              | invalid locator，fail closed               |
| any                    | external-selected | internal                | boundary violation，不进入 FrontDesk       |
| any valid internal ref | nil               | internal + unknown view | unknown view，fail closed                  |

测试产品可见性时必须调用真实 FrontDesk。测试 Draft、Revision、Lifecycle、Receipt、Outbox、
事务回滚或 row count 时继续使用 test-only DBProbe，不新增 `mode: :test`。

## 12. 非目标

V2 不处理：

- Reader 整体改名为 Query；
- 列表、分页、搜索和 aggregate API 的全局重命名；
- 将 Draft、Revision、Lifecycle、Receipt 提升为顶层 FrontDesk 资源；
- 用 FrontDesk 取代 Gate mutation admission、canonical reload 或 Writer invariant；
- 为了 API 形式统一而返回通用 envelope/DTO；
- 保留 V1 operations/Reader 单资源 compatibility layer。

## 13. 完成定义

FrontDesk V2 满足以下条件后才能标记 completed：

- User、Community、Article、Comment 的生产单资源读取都经过 FrontDesk；
- 不存在可被上层调用的 Reader 单资源入口；
- FrontDesk 只接受 `:public | :management | :internal`；
- public 默认、management actor-required、internal trusted-only 都有 fail-closed 测试；
- owner/moderator 由 Gate 根据关系判定，调用方不再选择角色 mode；
- GraphQL 和其他 public adapter 无法透传 internal；
- 资源 view 全部具名且不接受任意 preload/fill_meta/query 选项；
- Gate canonical reload、Store/Writer transaction query 与 aggregate-owned row 边界仍然清晰；
- §2.4 存量处置表已逐项完成，`CMS.FrontDesk` 不存在未分类的单资源、batch、集合或写入口；
- 旧 `:operations` FrontDesk overload 和 Reader 单资源 wrapper 已删除；
- 聚焦测试、protected-boundary 检查、warnings-as-errors 编译与 docs check 通过。
