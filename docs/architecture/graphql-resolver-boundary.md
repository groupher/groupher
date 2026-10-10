# GraphQL Resolver 边界与整改策略

> 状态：completed。本文记录 2026-10-06 的现状审计、目标边界和迁移结果；R1-R5 已完成。
>
> 范围：`backend/api/lib/groupher_server_web/resolvers/` 下的 GraphQL resolver、mutation
> payload helper，以及它们调用的 Accounts、CMS、Analysis 和 Content Import 公共入口。
>
> 本文不改变现有 GraphQL schema、字段名、错误码、Command Receipt、Gate 或 Lifecycle 合同。

相关文档：

- [CMS 多入口与领域用例边界](./cms-multi-entry-boundary.md)：GraphQL、CLI、MCP 和 Plugin 只能调用稳定的领域 facade；
- [CMS Query V2](./cms-query-v2.md)：FrontDesk、Domain Query、Store/Facts 和 Projection 的读取所有权；
- [CMS 资源加载与 Canonical Reload 边界](./resource-loading-boundary.md)：transport ref、canonical resource、Gate reload 与异步 reload；
- [CMS Command V3](./cms-command-v3.md)：typed Confirmation、领域 result builder 与首次执行/恢复同形；
- [ArticleStats 与 private state 写后同步](./article-stats-and-viewer-state-sync.md)：public stats、private state 和 owner revision 的写后读取合同；
- [Backend Rules](../rules/be.md)：后端 facade、ErrorCat 和持久化边界。

## 1. 结论

GraphQL resolver 是 transport adapter，不是业务用例 owner。目标调用链固定为：

```text
GraphQL field
  -> Resolver / Middleware
       - 解包 GraphQL 参数
       - 读取认证上下文
       - 转换 transport-only input/output
       - 映射 GraphQL error / null / cursor
  -> Accounts.* / CMS.* / Analysis.* public facade
  -> concrete Query / Command / Result Builder
  -> Gate / Lifecycle / Store / Projection / external provider
```

resolver 不要求每个函数都只有一行，但它不能拥有完整业务动作。只要一个函数开始决定以下任一事项，逻辑就应进入领域 facade 后面的具名 owner：

- 一个业务结果需要读取哪些领域状态；
- 首次执行、completed retry 或资源已消失时走哪条分支；
- Gate、Lifecycle、版本、revision 或 scope 如何判断；
- 写入后如何重新读取 canonical result；
- 多张表或多个 projection 如何组成一个产品 read model；
- provider/domain error 是否应被吞掉、降级或重解释；
- 缺失资源、默认值或 sentinel 对业务意味着什么。

## 2. 当前审计范围

本次审计覆盖当前全部 Web resolver 文件：

| 文件                             |                           当前规模 | 结论                                                         |
| -------------------------------- | ---------------------------------: | ------------------------------------------------------------ |
| `accounts_resolver.ex`           |           审计时 39 个不同公开函数 | R4 后删除；39 个字段实现已迁入 Accounts 领域 resolver        |
| `cms_resolver.ex`                | 审计时 207 个不同公开函数、2069 行 | R4 后删除；207 个字段实现已迁入 CMS 领域 resolver            |
| `content_import_resolver.ex`     |                   8 个不同公开函数 | 整体符合 transport adapter 边界                              |
| `article_interaction_payload.ex` |                       1 个公开函数 | 审计时为纯 mapper；R1 后因无生产调用方删除                   |
| `article_stats_payload.ex`       |                       2 个公开函数 | 审计时拥有 projection read；读取迁入领域后因无生产调用方删除 |

公共 ArticlePath 的纯 parse/validate 由 `CMS.Helper.ArticlePath` 共享；单路径与有界批量的
binding/database lookup 由 `GroupherServer.CMS.FrontDesk`（`article/1`、`articles/1`）负责，
不在 Web GraphQL resolver 内重复实现。

数量和行数只描述审计快照，不是架构判定标准。一个较长的纯 adapter 可以合法存在；一个只有数行、但决定 replay 或授权策略的函数仍然越界。

整改完成后的 Web 层由 20 个 `Resolvers.CMS.*`、5 个 `Resolvers.Accounts.*` 与独立的
`Resolvers.ContentImport` 组成；原 `cms_resolver.ex`、`accounts_resolver.ex` 和两个无调用方
payload helper 均已删除。

## 3. Resolver 允许与禁止的职责

### 3.1 允许保留

resolver 可以负责：

- 从 Absinthe `root`、`args`、`info.context` 取值；
- 将 `cur_user`、service actor、anonymous session 或 delegation 传给领域入口；
- 将 GraphQL `ID`、enum、one-of input 转换为公开 facade 接受的 transport-neutral 参数；
- 调用 Root `FrontDesk` 将尚未由 middleware 处理的 public ref/path 解析为 canonical resource；
- 将稳定领域错误映射为 GraphQL error code、extensions 或 nullable field；
- 构造 Relay edge、cursor 和 `pageInfo`；
- 执行没有 Repo、Gate 或业务分支的纯 DTO 映射；
- 为旧 schema 做局部字段名适配，但不得借适配重新计算领域状态。

FrontDesk 的区分标准是输入所表达的业务问题：top-level field argument 中的单个 public
resource ref/path 可以由 middleware 或 resolver 解析一次，再把 canonical resource 交给 facade；
filter、search、batch 或 aggregate 中携带的 public ref 则是 Query 输入的一部分，应由 Domain
Query 统一归一化并定义 not-found 语义。resolver 不得遍历或改写这类 filter，再用
`FrontDesk.user/1` 等单资源 API 将其翻译成内部 ID。

合法示例：

```elixir
def one_comment(_root, %{comment: comment}, %{context: context}) do
  CMS.Comments.one_comment(comment, Map.get(context, :cur_user))
end
```

```elixir
defp application_result({:error, reason}) do
  # 只把领域错误转换成 GraphQL extensions。
end
```

### 3.2 禁止新增

resolver 不得新增：

- `Repo`、`Ecto.Query`、`Helper.ORM` 调用；
- `CMS.<Domain>.Store`、`Writer`、`Commands` 或内部 `Query` 的直接调用；
- 自行进行 Gate/Lifecycle/admission 判断；
- query field 中的隐式业务写入；
- mutation 后的多 owner 查询与 payload 编排；
- command replay、receipt fallback 或资源消失恢复策略；
- 伪造 `%Community{slug: ...}`、`%Category{id: ...}` 等 partial schema struct；
- 通过修改调用前 struct 模拟 canonical mutation result；
- 以 `0`、`-1`、空 map 或 `nil` 表达未由领域 API 明确定义的业务 fallback；
- 因 provider/domain error 而静默返回 `nil`，除非该 nullable 语义由公开领域 API 明确保证。

GraphQL caller 应优先调用 `CMS.<Domain>` facade。即使内部已经存在合适的 `Query`、`Store` 或 `Response` 模块，也不能为了少写一层转发让 resolver 直接依赖实现模块。

## 4. 当前明确问题

### 4.1 P0：必须迁出 Resolver

P0 表示当前 resolver 已拥有业务用例、幂等恢复、授权或跨 owner 结果编排。迁移时应先保持 GraphQL 合同不变，再改变内部所有权。

| 当前入口                                   | 当前问题                                                                                              | 目标 owner                                       | 状态                  |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------- |
| `Accounts.session_state/3`                 | session query 内调用 `subscribe_default_ifnot/1`，读取入口隐式产生订阅写入                            | Accounts session/bootstrap use case              | ✅ R3 Accounts 已迁出 |
| `Accounts.present_collect/3`               | collect 写入后加载 Community、匹配 Artiment、读取 ArticleStats 和 viewer state，再拼 mutation payload | `Accounts.CollectFolders` command result builder | ✅ R3 Accounts 已迁出 |
| `CMS.community_application_state/3`        | 分别调用 `current`、`latest_failed`、`can_apply` 组成一个产品状态                                     | `CMS.CommunityApplications.state/1` Query        | ✅ R3 已迁出          |
| `CMS.move_doc_to_draft/3`                  | 写入后在 resolver 硬编码 `publish_state`                                                              | DocTree command result builder                   | ✅ R3 已迁出          |
| `CMS.cover_edit_info/3`                    | resolver 判断作者、直调 `Articles.Store`、选择 Draft/Revision 并构造 presentation                     | `CMS.Articles.CoverEdit` Query/Projection        | ✅ R3 已迁出          |
| `CMS.publish_article_draft/3`              | publish 后再次经 FrontDesk 读取 public Article                                                        | Articles publish result builder                  | ✅ R3 已迁出          |
| `CMS.trash_article/3`                      | trash 后按 `hash_id` 再次 hydrate                                                                     | Articles trash result builder                    | ✅ R2 已迁出          |
| `CMS.restore_trashed_article/3`            | resolver 决定普通读取、scope 校验和 command-id fallback                                               | Articles trash Command/facade                    | ✅ R2 已迁出          |
| `CMS.permanently_delete_trashed_article/3` | resolver 决定资源存在/消失时的 replay 分支                                                            | Articles trash Command/facade                    | ✅ R2 已迁出          |
| `CMS.permanently_delete_trash_action/3`    | resolver 加载 action、校验 Community/thread 后执行删除                                                | `CMS.Trash` concrete use case                    | ✅ R2 已迁出          |
| `CMS.article_viewer_states/3`              | resolve paths、批量读状态、匹配 Artiment identity 并组装 read model                                   | ViewTracker facade + Query                       | ✅ R1 已迁出          |
| `CMS.article_interaction_states/3`         | resolve paths、读取 private interaction、匹配 identity 并组装 payload                                 | Interactions facade + ReadState Query            | ✅ R1 已迁出          |
| `CMS.comment_viewer_states/3`              | resolve Article、读 Comments、抽取 viewer flags/emotions                                              | Comments facade + Query                          | ✅ R1 已迁出          |
| `CMS.comment_reconcile_states/3`           | 组合 Comments 和 ArticleStats、恢复输入顺序、定义 missing/null 语义                                   | `CMS.Comments.Reconciliation` Query              | ✅ R1 已迁出          |
| `CMS.hydrate_interaction/2`                | reaction 写入后加载 Community、private state、ArticleStats 和 outcome                                 | Interactions command result builder              | ✅ R1 已迁出          |
| `CMS.present_comment_write/1`              | Comment 写入后匹配 thread、读取 ArticleStats 并拼 payload                                             | Comments command result builder                  | ✅ R1 已迁出          |

### 4.2 P1：应随对应领域收口

P1 不一定立即导致错误，但边界已经含有领域策略、内部存储形状或明显的查询风险。

| 当前入口                                  | 当前问题                                                           | 目标处理                                                                                             | 状态                   |
| ----------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------- |
| `CMS.article_insights/3`                  | resolver 自行计算 viewer 的 Passport-granted Community scope       | Insights facade 只接收 viewer 和公开 filter，自行推导 scope                                          | ✅ R3 已迁出           |
| `CMS.paged_community_applications/3`      | public actor ref 被解析为内部 ID；not-found 被转换为 `-1` sentinel | CommunityApplications Query 接收 public filter 并定义 not-found 语义；Relay connection 留在 resolver | ✅ R3 已迁出           |
| `CMS.with_doc_tree_actor/2`               | actor struct 和 actor ID 被混入 attrs                              | DocTree facade 显式接收 actor                                                                        | ✅ R3 已迁出           |
| `CMS.create_article_draft/3`              | `Map.from_struct(draft)` 暴露持久化结构并手工挂 Article            | Articles draft result builder 返回稳定 payload                                                       | ✅ 已迁出              |
| `CMS.set_post_cat/3`、`set_post_status/3` | 忽略领域返回值，直接修改调用前 Article                             | Articles facade 返回 canonical updated state                                                         | ✅ 已迁出              |
| `CMS.article_state_result/2`              | lock/sink 后手工把少量字段 merge 回旧 Article                      | Articles state command 返回完整结果或稳定 result DTO                                                 | ✅ 已迁出并删除 helper |
| `CMS.analysis_active_visitors/3`          | 所有 provider/domain error 都静默降级为 `nil`                      | Analysis facade 明确区分 unavailable、empty 和 error                                                 | ✅ R3 已迁出           |
| `CMS.mentions/3`、`mentioned_by/3`        | resolver 解析 Article/Comment/User 并转换内部 ID                   | one-of 校验可留在 resolver；资源解析和 mention locator 进入 ArtimentMentions facade                  | ✅ 已迁出              |
| `CMS.community_tag_group_title/3`         | field resolver 按 `group_id` 单条读取，存在 N+1                    | 上游 Query preload、batch loader 或 payload projection                                               | ✅ 已改为 batch loader |
| Category/Tag mutation                     | 多处用 slug/id 构造 partial Ecto struct                            | facade 接收 locator，Gate/FrontDesk 加载 canonical resource                                          | ✅ 已迁出              |
| `ArticleStatsPayload.load/3`              | Web payload helper 实际执行 projection read                        | 读取已迁入领域 result builder；模块及孤立测试删除                                                    | ✅ R1 已删除           |

### 4.3 Schema 与 presentation 味道

以下问题不需要先阻塞边界迁移，但应在后续 schema 版本中处理：

- `get_passport_string/3`、`all_passport_rules/3` 使用 `Jason.encode!` 将结构塞进 GraphQL String；长期应改为 typed object 或明确 JSON scalar；
- `comment_reconcile_states/3` 当前构造 `comments_count`，但 `comment_mutation_article` GraphQL type 只暴露 `inner_id` 和 `comments_revision`；该字段只在直接调用 resolver 的测试中可见；
- 审计时 `cms_resolver.ex` 同时覆盖多个领域；R4 已按映射表拆分并删除该文件。

### 4.4 当前可作为正例保留的代码

- `ContentImport` resolver：参数解包、auth context 和跨 Node/Phoenix string-key 转换后调用公开 facade；
- browser session 与 Community Application 的 GraphQL error extensions 映射；
- Relay connection/cursor 生成；
- `community_asset_origin_info/3` 将领域 not-found 明确映射为 nullable GraphQL field；
- 简单 `CMS.<Domain>`/`Accounts.<Domain>` 单调用转发。

## 5. 目标所有权

### 5.1 Query read model

一个 GraphQL field 如果需要多个表、projection 或 viewer state 才能表达完整产品读取，应由 Domain Query 拥有：

```text
Resolver
  -> CMS.Comments.reconcile_states(article_path, comment_refs, viewer)
  -> Comments.Query.Reconciliation.read(...)
       - bounded input
       - Gate scope
       - Comment projection
       - Article comments revision
       - missing entry semantics
  -> stable read model
  -> GraphQL-only field mapping
```

GraphQL batch 上限如果只是 transport 防滥用，可以留在 resolver/middleware；如果所有入口都必须遵守相同产品上限，则由 facade/Query 再执行权威校验。不能只依赖 Web 层限制来保护共享 API。

### 5.2 Mutation result builder

写入后的结果重读和 payload 组装属于领域 command result builder：

```text
Resolver
  -> CMS.Interactions.upvote(article, actor, command_id)
  -> Interaction Command
       - first execution / completed retry
       - typed Confirmation
       - canonical result builder
           - ArticleStats
           - private InteractionState
           - outcome
  -> stable domain result
  -> GraphQL field-name mapping
```

首次执行和 completed retry 必须调用同一 result builder，或通过字段级 parity test 证明完全同形。resolver 不得根据 `commandId`、资源是否仍存在或某个读取是否失败来重新实现 replay 分支。

result builder 可以执行可重复的只读加载和 projection 组装，但不能补写缺失状态、触发外部 effect 或把最新 head 冒充 immutable command result。

### 5.3 Transport presentation

领域 result 不应依赖 Absinthe 类型，但可以返回具名 struct/map：

```elixir
%Comments.Reconciliation{
  article: %Comments.ArticleState{},
  entries: [%Comments.ReconciliationEntry{}]
}
```

resolver 只负责：

- snake_case field 与 GraphQL field 的自然解析；
- Relay edge/cursor；
- GraphQL error/null；
- 旧 schema 需要的局部字段重命名。

不要为了追求“一行 resolver”把 GraphQL DTO 反向放进领域层；目标是业务语义由领域 owner 决定，协议表现仍留在 Web 层。

## 6. 分阶段改进策略

### Phase R0：冻结行为基线

在移动代码前，为每个 P0 use case 固定：

- GraphQL operation 和当前 response shape；
- anonymous/authenticated/service actor 行为；
- success、not-found、forbidden、invalid input、provider unavailable；
- first execution 与 completed retry 的 shape parity；
- revision、missing/null、排序和 batch 上限；
- 查询次数基线，特别是 field resolver N+1 和批量状态读取。

基线必须成为可执行、随代码提交的产物，不能只写在迁移说明中：

- 在现有 `backend/api/test/groupher_server_web/query/` 或 `mutation/` 目录增加 GraphQL
  contract test；
- 每个测试保存完整 GraphQL operation、variables 和规范化后的 expected response/error；
- 大型 payload 可以使用同目录 fixture，但测试必须对完整公开 shape 做断言，不能只断言一个字段；
- command-backed mutation 使用同一 operation 分别覆盖 first execution 与 completed retry，并断言
  response shape 和关键 revision 完全同形；
- 查询次数基线作为 focused test 断言提交，不能只记录人工观测值。

本阶段不修改 schema，不把已有业务 fallback 当成正确合同；发现含糊语义时先在对应领域文档中作决策。

### Phase R1：Comments 与 Interactions

状态：2026-10-06 已完成。已增加 R1 GraphQL contract test，Comments/Interactions/ViewTracker
公开 facade 与 Query 接管 batch read model，Comments/Interactions 各自的 command result builder
接管写后结果；`CMS.ArticleStats.for_article/1` 成为共享 post-commit reader，private-state 纯映射归
`CMS.Interactions.ReadState.article_state/2`。无生产调用方的两个 Web payload helper 已删除。

优先迁移：

1. `article_viewer_states`、`article_interaction_states`、`comment_viewer_states`；
2. `comment_reconcile_states`；
3. `hydrate_interaction`、`present_comment_write`；
4. 稳定 ArticleStats 与 private-state 的共享读取合同和纯 mapper，供后续 Accounts result builder 复用。

R1 不迁移 `Accounts.present_collect/3`，也不建立跨领域共享 result builder。Comments、Interactions
和 Accounts 各自拥有自己的 command result builder；它们只复用 ArticleStats/private-state 的公开
读取合同与纯映射能力。collect payload 的完整迁移仍属于 R3。

原因：这些入口共享 owner revision、confirmed receipt 和写后读取语义，但 command result 的产品合同
分别归 owning domain。共享 reader 可以避免重复读取协议，共享 result builder 会重新制造跨领域耦合。

验收：

- resolver 只调用公开 facade；
- reconciliation 的 Article revision 与 Comment projection 有明确一致性合同；
- first/retry 返回同形；
- Web 层不再存在 `ArticleStatsPayload` / `ArticleInteractionPayload`，也不直接调用 Interactions 内部 read module；
- `Accounts.present_collect/3` 可以暂时继续使用稳定后的公开 reader，但不得被描述为 R1 已完成；
- frontend confirmed receipt 行为保持不变。

### Phase R2：Trash、恢复与 command replay

状态：2026-10-06 已完成。Trash hydration、Community/thread scope、资源已消失时的 receipt
replay 与 action-level scope 已进入 Articles/Trash use case；resolver 只传递 middleware 已解析的
Community、thread、actor 和 command ID。first/replay 完整结果 parity 与 scope mismatch 已有 focused test。

本批次同时有意归一化了既有 wire response：restore 与 permanent-delete 的成功结果现在回填 receipt
中的 `commandId`，不再保留历史上的 `null`；`trash_article` 的结果 hydration 归 Articles trash
use case 所有，无 command 路径不再由 resolver 做第二次 hydration。GraphQL schema 未改变，这些差异由
R2 contract test 固定为当前合同。

迁移 `trash_article`、restore、permanent delete 和 TrashAction scope 校验：

- facade 接收 transport 已解析的 resource/locator、actor 和 command ID；
- concrete use case 决定首次资源存在、completed retry、资源已消失和 scope mismatch；
- result builder 使用 Receipt/Confirmation 的稳定 identity；
- resolver 不再调用 `get_trashed`、`verify_trash_scope` 或选择 fallback。

验收重点是 ambiguous commit 后使用相同 command ID 重试，而不是只覆盖普通成功路径。

### Phase R3：Accounts、Docs 与 Community Applications

状态：2026-10-06 已完成。Accounts session bootstrap、CollectFolders command result builder、Docs
result/query、CommunityApplications state/public filter 与 Analysis nullable/error 合同均已迁入领域 owner。
session query 的默认 Community 订阅保持既有 best-effort 语义；collect add/remove 的 first/replay
统一经过 Accounts-owned result builder。

按领域分别迁移：

- session/bootstrap 将默认订阅写入移出 query resolver，并明确它发生在登录、账号初始化还是独立 command；
- CollectFolders 建立 Accounts-owned result builder，复用 R1 稳定的 ArticleStats/private-state reader，
  并完成 `present_collect/3` 的迁移；
- Docs 的 move-to-draft、publish 和 cover edit 使用 Query/result builder；
- CommunityApplications 提供完整 state Query，并接管 public actor filter；
- Analysis 明确 nullable/unavailable/error 合同。

### Phase R4：拆分 Web resolver 模块

状态：2026-10-06 已完成。207 个 CMS resolver 函数拆入 20 个 `Resolvers.CMS.*` 模块，39 个
Accounts resolver 函数拆入 `Profiles`、`Sessions`、`Relationships`、`Mailbox`、`Passport`；schema
直接引用目标模块，不保留兼容 wrapper。原两个单体 resolver 文件均已删除。

业务逻辑迁出后，再按稳定 GraphQL 领域拆分。以下映射覆盖当前 resolver 中的函数家族；小型纯转发
模块可以在实施时合并，但不得重新回到一个跨领域 CMS 总入口：

| 现有函数家族                                                                                          | 目标 resolver module                                         |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `me`、profile、publish、search                                                                        | `Resolvers.Accounts.Profiles`                                |
| browser session、OAuth identity                                                                       | `Resolvers.Accounts.Sessions`                                |
| fans、collect folders/entries                                                                         | `Resolvers.Accounts.Relationships`                           |
| mailbox                                                                                               | `Resolvers.Accounts.Mailbox`                                 |
| `get_passport`、`get_passport_string`、`get_all_rules`                                                | `Resolvers.Accounts.Passport`                                |
| `all_passport_rules`                                                                                  | `Resolvers.CMS.Passport`                                     |
| Content Import，包括其 scoped Passport check                                                          | `Resolvers.ContentImport`                                    |
| `command_id` 等通用 command payload field                                                             | `Resolvers.CMS.CommandPayload`                               |
| Article logs、Community Activity                                                                      | `Resolvers.CMS.Activity`                                     |
| Article Insights、Web Analysis                                                                        | `Resolvers.CMS.Analysis`                                     |
| ArticleStats fields/read                                                                              | `Resolvers.CMS.ArticleStats`                                 |
| `track_article_view`、`article_viewer_states`                                                         | `Resolvers.CMS.ViewTracker`                                  |
| Community Application query/mutation/field                                                            | `Resolvers.CMS.CommunityApplications`                        |
| Community core、moderator、subscription、Category、Tag                                                | `Resolvers.CMS.Communities`                                  |
| Asset                                                                                                 | `Resolvers.CMS.Assets`                                       |
| Dashboard config/theme                                                                                | `Resolvers.CMS.Dashboard`                                    |
| Wallpaper                                                                                             | `Resolvers.CMS.Wallpaper`                                    |
| Press config/article/feed/manifest                                                                    | `Resolvers.CMS.Press`                                        |
| DocTree、DocCover、Doc Draft/Version/Publish                                                          | `Resolvers.CMS.Docs`                                         |
| Article read/write/draft/trash/Kanban，以及 `sink_article`、`lock_article_comments` 等 Article action | `Resolvers.CMS.Articles`                                     |
| Comment read/write/replies/solution/pin/reconcile                                                     | `Resolvers.CMS.Comments`                                     |
| Article/Comment upvote、emotion、report、private state                                                | `Resolvers.CMS.Interactions`                                 |
| `paged_reports` 及相关 projection                                                                     | `Resolvers.CMS.Reporting`                                    |
| `mentions`、`mentioned_by`、trashed mention fields                                                    | `Resolvers.CMS.ArtimentMentions`                             |
| CMS Community/Artiment search                                                                         | `Resolvers.CMS.Search`                                       |
| OpenGraph info                                                                                        | `Resolvers.CMS.OpenGraph`，或后续确认的 platform Web adapter |

原 `ArticleInteractionPayload` 与 `ArticleStatsPayload` 已在 R1 删除；R4 不为它们创建兼容 wrapper。

拆分只改变 schema 中的 resolver module 引用，不创建兼容 wrapper，也不改变 GraphQL 字段。不要先拆文件再迁业务逻辑，否则只会把越界代码分散到更多位置。

### Phase R5：静态门禁与长期规则

状态：2026-10-06 已完成。可机检存量违规已清零，`scripts/check-resolver-boundary.mjs` 对完整
resolver 目录执行检查，并由 `scripts/check-resolver-boundary.test.mjs` 固定正反例；门禁已接入
`pnpm docs:check`，不是 diff-only 检查。

R5 上线门禁前，先清零所有可机器识别的存量违规，包括当前未使用的
`import Ecto.Query`、Repo/ORM 调用、Store/Writer/Commands 依赖、internal Query 依赖和 partial schema
struct 构造。清零应随 R1-R4 对应批次完成；最后残留在 R5 preparation 中删除。

清零后增加面向 `groupher_server_web/resolvers` 的全目录静态检查：

- 禁止 `Repo`、`Ecto.Query`、`Helper.ORM`；
- 禁止直接调用 `CMS.*.Store`、`Writer`、`Commands`；
- 默认禁止直接调用 domain internal `Query`，公开 facade 或明确 allowlist 除外；
- 禁止构造 CMS Ecto schema partial struct 作为 facade 参数；
- 禁止 resolver helper 执行业务写入；
- 新增例外必须说明为什么它是 transport-only，并有 focused test。

门禁检查整个 resolver 目录，不采用只检查 diff 的方式长期容忍基线违规。静态检查只阻止明显依赖。
多 owner 编排、fallback 和状态合成仍需 review checklist 判断，不能依赖正则完整识别。

## 7. 实施规则

每个迁移批次必须遵守：

1. 先建立或扩展稳定 facade API，再迁 resolver；
2. Query、Command、Result Builder 和 Projection 使用产品词汇命名，不创建 `ResolverService`、`Manager`、`Handler` 等模糊层；
3. 不增加只做转发的兼容 facade；旧内部 API 无真实调用方时直接删除；
4. middleware 已解析的 canonical resource 不得降级为 ID；Gate 锁内 canonical reload 仍必须保留；
5. schema 与 generated GraphQL artifacts 必须保持同步；未计划 schema 变更时，codegen 后不得出现 contract diff；
6. resolver test 只验证协议映射，领域分支进入 Query/Command focused test；
7. mutation 必须覆盖 first execution、completed retry 和 result-builder failure；
8. batch Query 必须验证固定查询数量或无 N+1；
9. 不因重构吞掉既有 ErrorCat；GraphQL 格式化只在 Web 协议边界执行；
10. 每批独立验证，不一次性重写当前 CMS resolver 单体模块。

## 8. 完成标准

完成全部整改后应满足：

- GraphQL resolver 不直接依赖 Repo/ORM、Store、Writer、Commands 或内部 Query；
- 每个 resolver 的业务调用可指向一个明确的公开 facade/use case；
- query resolver 不产生未在字段合同中声明的业务写入；
- 写后多 owner 状态由领域 result builder 返回；
- first execution 与 completed retry 的产品结果同形；
- reconciliation、missing/null、revision 和 fallback 语义由领域 owner 测试覆盖；
- 不再通过 partial Ecto struct 或修改旧 struct 构造 mutation 结果；
- `community_tag_group_title` 等字段读取不存在 N+1；
- CMS resolver 已按 GraphQL 领域拆分，schema contract 保持稳定；
- 原 `cms_resolver.ex` 不再存在；若迁移期必须保留，则只能包含有删除期限的纯转发，不能继续承载字段实现；
- Architecture 索引、Readmap、Backend Rules 和静态门禁与实现一致。

## 9. 非目标

本文不要求：

- 建立通用 Command Bus 或万能 Query framework；
- 把所有 resolver 强制压缩为一行；
- 将 GraphQL DTO、Relay cursor 或 error extensions 移入领域层；
- 为了“纯粹”删除必要的 post-commit read；正确做法是让领域 result builder 拥有它；
- 将所有内部模块公开成 facade；
- 在同一批次修改前端缓存架构、GraphQL schema 和全部 CMS 目录。

本文的目标是恢复所有权：resolver 负责协议，facade 暴露业务入口，Query/Command/Result Builder 拥有完整用例，Store/Writer 只服务领域内部。
