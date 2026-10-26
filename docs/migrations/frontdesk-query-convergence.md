# FrontDesk 与 Query 读取边界收口

> 状态：当前源码已在普通 Article 与 Docs main branch 发布路径补上 Binding 可见性同步；G1 + locator 定向测试 6/6 通过。串行全量的最近一次结果（2380/2444 passed、64 failures）早于该修复，尚未复跑；整体验收仍待全量与 docs gate。细项见 [基础模块执行记录](./backend-foundation-cleanup-and-codedoc.md#6-2026-10-22-实施与验证记录)。

当前合同见 [FrontDesk](../feature/front-desk/README.md)、[CMS Query V2](../architecture/cms-query-v2.md)
和 [Resource Loading Boundary](../architecture/resource-loading-boundary.md)。本文记录这些合同在实际调用链中的收口工作，
不另建通用读取框架。读取准入统一遵守 [Gate 收口计划](./gate-admission-convergence.md)。

## 1. 已确认的职责

| 请求                                                   | 入口与实现 owner                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| 按 path/ref 获取一个 Article、Community、Comment、User | Root FrontDesk 委托所属 Context 的单资源实现                        |
| 已知一组 ID，获取对应资源                              | 领域批量 Query；跨 Context 可以由 Root FrontDesk 只做转发           |
| list、filter、sort、page、cursor、count、search        | Context 公开查询接口委托领域 Query，不经 FrontDesk 组装查询         |
| Draft、Revision、Binding、Lifecycle 等聚合自有事实     | 具名 owner 的 Store/Facts 或已有合适模块，不建立顶层资源通用 lookup |
| Gate 锁内、异步执行、replay 所需重载                   | 保留明确用途的 canonical/recovery loader，不机械删除必要查询        |

```text
“给我这一篇文章”
  -> Root FrontDesk -> Context facade -> internal FrontDesk -> Gate -> resource

“给我这 20 个 ID 对应的文章”
  -> Root FrontDesk（可选转发）-> Context facade -> batch Query -> Gate scope
  -> 一次或有界批量查询，不循环单资源加载

“给我社区最新的 20 篇文章”
  -> Context 查询 facade -> Query
                           +-> Gate scope：允许读取的集合
                           +-> filter：业务筛选
                           +-> sort：稳定顺序
                           +-> page/count：同一授权、筛选集合
```

FrontDesk 不接收任意 filter/sort/pagination，不拥有集合查询、统计或独立可见性规则。
批量转发不是必经中间层；领域调用者可以通过 Context 公开查询接口直接消费批量能力。

## 2. 统一查询合同

每个查询 surface 必须明确以下合同，并让 GraphQL 参数适配与领域入口校验共享权威定义，避免两套枚举漂移：

- 允许的 filter、字段类型、组合/互斥规则及未知参数的错误；
- 允许的 sort、默认顺序、唯一 tie-breaker、空值顺序；
- offset/cursor 模式、页大小上限、cursor 与 filter/sort 的绑定；
- count 是筛选后总量、估算量还是不提供，不能把当前页长度当 total；
- actor/mode、父资源/Docs branch 范围以及 Gate scope；
- 批量的去重、输入顺序、缺失项与不可见项、部分返回及数量上限。

共享参数验证、排序和分页机械能力；资源语义与权限仍归 owner/Gate。不要把全部领域查询吞入通用 Query 框架。
正式迁移前为每个 surface 列出实际调用者和上述选项；本文不擅自为所有批量接口选择同一种缺失项返回协议。

例：`sort=latest` 的翻页需要稳定的时间字段加唯一 ID；普通访客的 total 不能计入其看不到的待审文章。
`MOST_STARS`、`LEAST_STARS` 等确认废弃的选项应连同 schema、调用方、实现、测试清理，不保留兼容别名。

## 3. 已发现的迁移点

以下为最终目标；Audit 业务规则不在本批改动，但 Moderate 的资源读取也迁回 FrontDesk/Docs owner，避免为冻结业务保留 Query lookup。

- 删除 `Articles.Query.article/1`、`Articles.Query.community/1`、`Communities.Query.get/1` 这类顶层通用 lookup，
  逐调用点归回 FrontDesk 或明确的 canonical/recovery loader；保留必要的提交后结果重载。
- `Articles.Query.branch_community/1` 拆开：Docs owner 提供分支归属事实；Community 资源复用已加载值，
  确需加载时经规定入口。不能只把隐藏的 Community lookup 整体搬到 Docs.Query。
- FrontDesk 中 Article 批量读取实现归回 Article Query；保持有界批量能力及既有调用者需要的结果语义。
- 删除 `FrontDesk.Relation.thread_of/1` 中“只有 article_id 就默认为 doc”的猜测；明确类型、查证或返回领域错误。
- FrontDesk 详情、Article 分页/路径批量等入口移除自有的可见性判断，统一消费 Gate。
- 同步迁移 caller 与 ErrorCat；分支不存在不能再误报 article binding 不存在。

## 4. lint 必须补齐的语义

目前 `check-cms-query-boundary.mjs` 主要禁止 Reader 命名；`NoDirectRepoInBoundaries` 禁止 Command 等边界直接
访问 Repo，但没有禁止 `Command -> Query -> 顶层 Repo.get`。不能把这些检查通过解释为读取所有权已正确。

新增或扩展规则应识别顶层资源通用加载、允许 owner、调用关系及 alias，而非只封禁函数名：

- 负例：Command 通过 Query 转发加载顶层 Article/Community；换名或 alias 后也应被发现；
- 正例：FrontDesk 实现、Gate canonical loader、具名 replay/async reload；
- 正例：Query 的列表/批量查询、Store 的聚合自有事实读取；
- 禁止把整个 Query/Store 目录列入无限制白名单；每个例外应有具体用途。

## 5. 实施与验收

1. 列出所有单体/批量/集合入口、调用者及查询能力合同；先完成 report 和规则反例测试。
2. 按资源逐批迁移实现和调用者，删除旧入口，不增加兼容层。
3. 同批验证列表、详情、批量、count 的 Gate 一致性及稳定分页；核对批量查询数量，避免 N+1。
4. 清零已确认违规后启用严格 lint，并更新当前合同的实施状态。

验收包括非法 filter/sort、互斥字段、同时间排序、跨页重复/遗漏、cursor 参数变化、批量缺失/不可见项、
跨社区与 Docs 分支，以及 actor/mode 差异。不能只测试函数搬家或目录结构。

## 6. 可执行批次（2026-10-21 源码复核）

跨文档批次依赖与源码文档整改见 [基础模块执行顺序](./backend-foundation-cleanup-and-codedoc.md)。

以下路径除特别注明外相对 `backend/api/lib/groupher_server/`。新增 API 名是本计划的目标接口，不是已存在接口。
每批同时修改调用方、测试和源码注释；不得先删除入口再留下调用方等待后续迁移。Audit/Sentinel 相关执行不在本轮。

### F1：单资源 lookup 与关系归属

| 源模块/函数                                             | 已核实调用者                                                                                                                                                                                                                                           | 具体修改                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cms/articles/query.ex` `community/1`                   | Articles Commands 的 `publish`、`state_change`、`comment_lock`、`moderate`                                                                                                                                                                             | 现有 struct 直接传递；稳定 ID 经 `CMS.FrontDesk.community(id, mode: :internal)` 取得候选资源，Gate 保留锁内重载。所有调用方消费 FrontDesk tagged tuple；删除 Query lookup，不改变 Moderate 的审核规则                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 同文件 `branch_community/1`                             | Docs Commands `update_draft`、`publish_branch`；Articles `state_change`、`comment_lock`、`moderate`                                                                                                                                                    | 在 `cms/docs/store.ex` 增加具名 `branch_context(branch_id)`，仅返回 branch 与 community_id；调用方经 FrontDesk 取得 Community，并向 Gate 传明确 branch_id；删除 Article Query helper，不改变 Moderate 的审核规则                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 同文件 `article/1`                                      | Communities Tags Commands `set`、`unset`，以及 `cms/comments/commands/create.ex:160` 的 projection-map 分支                                                                                                                                            | 已含 Article struct 则直接复用；只有 article_id 时经 internal FrontDesk 加载，保留 branch_id；不得把 projection 当 canonical Article                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `cms/communities/query.ex` `get/1`                      | Communities Commands `create`、`update`；Categories/Moderators/Subscriptions Commands `support`；Tags Commands `tag_support`；`cms/comments/commands/create.ex:309` 的 `replay_created` 与 `:394` 的 `reply_new_from_canonical`（别名 CommunityQuery） | support 的 identity 入口与 confirmation 结果恢复归 FrontDesk；所有 presentation/replay 保留提交后重载及缺失错误映射；Create/Update 的 `present_result` 仍做提交后重载，经 FrontDesk 取得当前值；缺失映射 `command_result_unavailable`，不改成重复执行写入                                                                                                                                                                                                                                                                                                                                                                                                   |
| `cms/articles/query.ex` `binding/2`、`pinned_binding/2` | Article Commands `create`、`update`、`binding_support`                                                                                                                                                                                                 | 新增 `Articles.Bindings.fetch_binding(article_id, community_id)` -> `{:ok, %ArticleBinding{}}`，及 `fetch_pin(article_id, community_id)` -> `{:ok, %PinnedArticle{}}`；在 `cms/articles/error_cat.ex` **新增** `binding_not_found` / `pin_not_found`，在 `{:cms, :article}` 已注册 range 内分别分配未占用 code 并通过 validator；当前两者都不是已有 catalog reason。缺失分别返回 `{:error, Articles.ErrorCat.binding_not_found()}` / `{:error, Articles.ErrorCat.pin_not_found()}`，不得沿用裸 `:article_binding_not_found` 或 `:pin_not_found`。保留现有 `get/2` 的 context-map 合同，不复用或改义；presentation 将真实缺失映射 command_result_unavailable |
| 同文件 `article_with_author/1`、`reload_with_author/1`  | Comments Commands `create` 的首次返回与 replay                                                                                                                                                                                                         | preload 留在具名结果组装 owner；replay 重载使用 Article FrontDesk 的明确 author view。删除接受任意 schema 的 `reload_with_author`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `cms/comments/query.ex` `comment/1`                     | Comments Commands `state_change`、`solution_change` 的 presentation，`create` 的 replay                                                                                                                                                                | 经已有 `FrontDesk.comment(id, mode: :internal, view: :with_author)` 恢复结果；保持 reply author preload；删除裸 Repo lookup                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 同文件 `stable_article/2`                               | Comment page/reply/统计内部读取                                                                                                                                                                                                                        | 入口尽量接收已解析 Article；确需 ID 加载经 internal FrontDesk，检查 thread 一致；随后仍需 Comment Gate scope，internal load 不等于可读                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `cms/front_desk/relation.ex` `thread_of/1`              | Article/Comment 关系解析                                                                                                                                                                                                                               | 删除 article_id-only 推断 Doc；显式 thread、Article struct 或领域错误，不添加新 fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Moderate 的审核状态、授权和写入语义保持不变；仅把它的 Community 读取迁到 FrontDesk，把 Docs 分支归属迁到 `Docs.Store.branch_context/1`。
F1 删除 `Articles.Query.community/1`、`Articles.Query.branch_community/1`、`Articles.Query.article/1` 和 `Communities.Query.get/1`，不留 Audit 豁免。

F1 验收：缺失资源、错误 thread、branch 与 community 不匹配均拒绝；Create/Update/Comment replay 仍恢复当前 payload；
已持有 struct 的正常路径没有新增通用预加载。扩展现有 `cms/front_desk_test.exs`、
`cms/communities/commands/tag_commands_test.exs` 及对应 Command receipt/replay 测试。必须覆盖 Comment projection-map create、reply_new_from_canonical（新回复）、reply_result（回复重放）、首次返回和重复 command_id 的 replay：
Article/Community 重载正确、thread/branch 保留、reply author preload 不丢失；社区/评论缺失的 replay 返回 command_result_unavailable。
新增 `test/groupher_server/cms/comments/commands/create_loading_contract_test.exs` 承载这组场景，不能只跑 Tag 测试。

F1 最小验证（以下 mix 命令均在 `backend/api`；新增测试先随本批创建）：

```sh
mix test test/groupher_server/cms/front_desk_test.exs test/groupher_server/cms/communities/commands/tag_commands_test.exs test/groupher_server/cms/comments/commands/create_loading_contract_test.exs
```

### F2：批量实现归 Query，保持现有协议

1. 将 Article locator 批量解析实现放在 `cms/articles/query/locator.ex`（`Articles.Query.Locator`），由 `CMS.Articles.locators/1` 暴露；统一称为 `locators`，不再使用 `PublicPaths` 或 `resolve_locators`；Query 子模块拥有 Gate scope 和分组 SQL。
2. 删除 `CMS.FrontDesk.Article.read_many/1`、`CMS.FrontDesk.articles/1`、`CMS.front_desk_articles/1` 和 Root `FrontDesk.articles/1`。它们只形成转发链，仓库内没有生产 caller；CMS FrontDesk 仅保留单资源读取和关系查询。
3. `cms/interactions/projection/query.ex`、`cms/view_tracker/query.ex`、`cms/press/query.ex` 直接调用 `CMS.Articles.locators/1`；批量筛选和分页始终经所属 Context 的 Query，不经 Root FrontDesk。
4. Gate 批量 scope 的迁移与 G1 同批；不能仅搬迁旧 `public_articles` 的重复权限条件。

当前批量合同已核实：最多 100 个输入路径；无效/不可见/禁用路径省略；输出保持有效输入顺序，重复有效输入会重复返回；
返回 path/article/binding/branch_id。F2 保持这些语义，内部 SQL ID 可去重；不要擅自把返回值变成去重后的集合。
`Pagination.lite_paths/1` 当前会去重，属于不同 surface，不强行改成相同重复项合同。

101 项的目标错误为新增 `Articles.ErrorCat.batch_limit_exceeded(%{limit: 100, actual: 101})`，reason 为 `:batch_limit_exceeded`，非重试错误；不得继续报 article_not_found。按 E1 分配 catalog code。

验收：空数组、101 项（断言上述 reason）、重复路径、同文章不同 binding、跨社区、Doc main、无效路径混排；
对 1/20/100 个同组路径统计 SQL，查询次数不随项数线性增长；按 community/thread 分组增加查询是允许的。
扩展 `cms/articles/revision_target_test.exs`、`cms/front_desk_test.exs`，并验证 Projection/ViewTracker/Press 调用结果。

F2 最小验证：

```sh
mix test test/groupher_server/cms/articles/revision_target_test.exs test/groupher_server/cms/front_desk_test.exs
```

### F3：查询能力合同与排序清理

新增各 owner 的 `Query.Contract`（例如 `Articles.Query.Contract`），只负责本领域允许键、枚举和参数验证；
通过 Context facade 输出 schema 所需枚举。GraphQL 不跨 Context 直接引用实现模块。`Pagi`/`Helper.ORM.Pagi.Order`
继续拥有分页算法、cursor 和 Order，不另建 Query engine。

| surface / 修改点                                                            | 目标合同与执行要求                                                                                                                                                                                                                                                                          |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Article `articles/pagination.ex` `validate_filter/apply_filter/order_for`   | 白名单覆盖 community、author_id、community_tag(s)、when、cat、status(es)、order、sort；未知字段拒绝。status/statuses、单/多 tag、order/sort 同时出现时拒绝歧义输入；领域内部 author_id 不必对 GraphQL 开放                                                                                  |
| Article sort/order                                                          | 保留当前实际支持的 publish/upvotes/comments/views 及时间、views 方向；逐值复用 `order_for` 的字段与 tie-breaker。COLLECTS 在 Article list surface 尚未接线，该 surface 的 schema 不再宣告可用；`Interactions.Scope` 的 `:collects` 支持保持不变，不能全局删除；不在本轮悄悄增加产品排序能力 |
| Community `communities/query.ex`                                            | 仅 category、sort；sort 为 desc_inserted/asc_inserted/most_views/least_views，默认 desc_inserted；复用现有 null 顺序和 id tie-breaker                                                                                                                                                       |
| Comment `comments/query.ex` `comment_order`                                 | sort 仅 asc_inserted/desc_inserted，默认 asc_inserted；非法 sort 返回 Pagi 错误，不再落入默认分支。page/reply/published/folded 共用此验证                                                                                                                                                   |
| `backend/api/lib/groupher_server_web/schema/cms/cms_metrics.ex`（仓库相对） | 用资源专属 sort enum 替换过宽的共享 sort_enum；删除 MOST_STARS/LEAST_STARS。GraphQL 接受的值必须是领域 Contract 支持集，补集合等价测试                                                                                                                                                      |
| `backend/api/lib/helper/query_builder.ex`（仓库相对）                       | 删除 most_stars/least_stars 分支；保留其他仍有调用者的排序机制                                                                                                                                                                                                                              |
| 前端 generated GraphQL                                                      | 执行根目录 `pnpm graphql:codegen` 重生成；修正类型消费者，不手改生成文件、不保留旧值别名                                                                                                                                                                                                    |
| count                                                                       | ArticleLite 页面按 distinct binding identity 计数；`count_published` 与 profile published 列表对齐为可见 binding 数。不能把 Article ID 数与路径条目数混用；独立“作品数”须另命名，不复用本接口                                                                                               |
| pagination                                                                  | filter 不含 page/size/first/after；通过 PagiInput 选择 offset 或 cursor。保留社区配置 revision 校验；pinned_entries 独立于 live cursor 序列，不改变现有分页含义                                                                                                                             |

步骤：先提取 Contract 并加纯参数测试，再让 Query 与 GraphQL 共同消费，最后删除旧枚举/分支和静默 fallback。
F3 不依赖 Sentinel；现有审核语义由 Gate 统一消费，不在参数改造中重定义。

验收：每个允许 sort 均能从 GraphQL 到 SQL 完成；不支持值明确报错；同时间/同分值跨页无重复遗漏；
cursor 跨 filter/sort/配置 revision 复用拒绝；筛选后 count 与全部页的唯一 binding 集合一致。
运行 `groupher_server_web/query/pagination_contract_test.exs`、`cms/articles/pagination_test.exs`、
`cms/comments/pagination_test.exs`，以及 `cms/communities/query/page_categories_test.exs`。

F3 最小验证：

```sh
mix test test/groupher_server/cms/articles/pagination_test.exs test/groupher_server/cms/comments/pagination_test.exs test/groupher_server/cms/communities/query/page_categories_test.exs test/groupher_server_web/query/pagination_contract_test.exs
# 仓库根目录
pnpm graphql:codegen
pnpm contract:graphql:generated
```

### F4：门禁

扩展 `backend/api/credo_checks/no_direct_repo_in_boundaries.ex` 或增加同级具名资源加载检查，增加
`test/groupher_server/credo/` 正反例；`scripts/check-cms-query-boundary.mjs` 继续负责 Reader 命名，不伪装成语义证明。
先报告现存违规，按 F1/G1 清理后启用严格规则。Audit 业务链保持不变，但不为其保留资源 lookup 豁免。

命令（除 pnpm 外在 `backend/api` 执行）：

```sh
mix compile --warnings-as-errors
mix test test/groupher_server/cms/front_desk_test.exs test/groupher_server/cms/articles/revision_target_test.exs
mix test test/groupher_server/cms/articles/pagination_test.exs test/groupher_server/cms/comments/pagination_test.exs test/groupher_server_web/query/pagination_contract_test.exs
mix lint.style
pnpm docs:check
```

以上是 F1–F4 的验收命令；历史实施与最新 Review 验证结果见基础模块执行记录，未复跑项不视为当前通过。严格 lint 必须证明已删除的顶层资源 lookup 没有调用方或目录豁免。
