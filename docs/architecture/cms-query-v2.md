# CMS Query V2：Reader、List 与 FrontDesk 读取边界

> 状态：V2 已落地（2026-10-04）。本文定义 CMS `Reader`、`List` 向 `Query`、`Store/Facts`
> 和 `Projection` 收敛的边界；本次迁移保持 `CMS.<Domain>` 公开 facade API 稳定，内部直接切换，
> 不保留 `Reader` 兼容层。
>
> 版本关系：本文承接 [FrontDesk V2](../feature/front-desk/v2.md) 已冻结的单资源读取边界。
> FrontDesk V2 决定“一个顶层资源如何被权威读取”，本文决定列表、批量、聚合、领域内部事实
> 和 read model 分别由谁拥有。本文同时取代
> [CMS Facade 与实现目录收口](./cms-facade-directory.md) §2.2 中“读取模块统一命名为 Reader”
> 的历史命名决策。

相关文档：

- [FrontDesk V2](../feature/front-desk/v2.md)：顶层资源的单资源唯一入口、mode/actor/view 与稳定关系；
- [CMS Facade 与实现目录收口](./cms-facade-directory.md)：公开 facade 与内部实现目录的所有权；
- [CMS 资源加载与 Canonical Reload 边界](./resource-loading-boundary.md)：transport、Gate、Command 与 async reload；
- [Query、Store、Draft 与缓存边界](./query-store-boundary.md)：前端 Query/Store 语义；本文只定义后端 CMS 读取模块；
- [ORM](./orm.md)：`Helper.ORM`、Repo 与持久化边界。

## 1. 问题

迁移前 CMS 有 11 个 `*.Reader` 和 4 个显式 `*.List`。`Reader` 已同时表达以下不同职责：

- 顶层资源单资源读取；
- aggregate-owned Draft、Revision、Lifecycle、Release 等持久化事实；
- page、list、batch、aggregate 和 exists 查询；
- public/editor/admin read model 投影；
- projection refresh、recovery 和 command 所需内部 lookup；
- `ensure_*` 等带写入的状态初始化。

因此把所有 `Reader` 原地改名为 `Query` 只会改变歧义的名字，不会修复所有权。另一方面，
把通用列表入口加入 FrontDesk，会让 FrontDesk 同时承担 locator、filter、sort、page、cursor、
aggregate 和 viewer hydration，破坏其单资源合同。

目标不是消灭所有读取 helper，而是让模块名准确表达其稳定职责。

## 2. 冻结决策

### 2.1 FrontDesk 只拥有单资源与稳定关系

FrontDesk 继续拥有：

- User、Community、Article、Comment 等顶层领域资源的 canonical single-resource read；
- `:public | :management | :internal` mode；
- 由 owner 枚举的 named view；
- 从一个已知资源稳定确定另一个资源的一对一关系，例如 `article_author/1`、
  `article_of/1`、`thread_of/1`。

以下入口不得进入 FrontDesk：

- page、list、search、cursor；
- count、aggregate、exists；
- 按一组 id/path 进行的 bounded batch；
- reaction users、review queue、history 等产品集合；
- backfill、GC、reconciliation 和 maintenance scan。

集合是否有分页不是唯一判断标准。只要调用方可以选择 filter/order，或结果表达一个产品集合、
统计集合、批量 read model，它就属于 Domain Query，而不是 FrontDesk relationship。

### 2.2 Domain Query 拥有业务读取用例

`CMS.<Domain>.Query` 拥有领域内可命名的读取用例：

- Gate-scoped page/list/batch/search；
- filter、sort、page、cursor 的领域语义；
- count、aggregate、exists；
- viewer state 和 read-model hydration；
- 将多张权威表组合为一个只读产品结果。

Query 可以使用 Repo/Ecto，但不得写数据库、创建缺省 row、修复状态或触发领域副作用。
Query 不是 transport facade；GraphQL、Job 和跨领域调用方仍优先调用稳定的 `CMS.<Domain>` facade。

### 2.3 Store/Facts 拥有 aggregate-owned 持久化事实

以下对象不是顶层 FrontDesk 资源，也通常不是产品 Query：

- ArticleDraft、ArticlePublic、ArticleRevision、ArticleLifecycle；
- DocPublic、DocBranchVersion、DocRevision、DocPublishRelease；
- command/recovery、projection materialization 所需 owned row；
- transaction 内的 invariant lookup 和 lock query。

它们进入 owning domain 的 `Store`、`Facts`、Gate Loader 或具名状态 owner。调用方必须请求明确事实，
不得重新建立一个接受任意 schema、preload 或 clauses 的通用 lookup facade。

### 2.4 Projection/Response 只负责结果组装

纯 map/struct 转换、树构建、response hydration 和 output formatting 进入 `Projection`、`Response`
或已有具名 projector。它们不拥有资源可见性，不单独决定 Gate policy，也不通过 Repo 修复状态。

### 2.5 共享的是查询机制，不是资源语义

以下机械能力可以继续由 `CMS.QueryBuilder`、`Helper.QueryBuilder` 或后续具名 `CMS.Query.*`
helper 共享：

- 通用 filter clauses；
- page/size/cursor normalization；
- paginator；
- 与领域无关的排序构造。

Article pin、Kanban status、Comment solution、Community subscription、AbuseReport target shape 等规则
必须留在 owning Domain Query。不得为了复用把资源语义提升到 FrontDesk 或通用 QueryBuilder。

## 3. 目标结构

```text
GraphQL / Job / domain caller
  -> CMS.<Domain> facade
       -> FrontDesk.<resource>        single canonical resource
       -> <Domain>.Query.*            list/batch/search/aggregate read use case
       -> <Domain>.Store/Facts        aggregate-owned persistence fact
       -> <Domain>.Projection         pure read-model shaping
       -> Writer / State              ensure/repair/write
```

公开 facade 保持调用合同，例如：

```elixir
CMS.Articles.page(thread, filter)
CMS.Comments.paged_comments(thread, article_id, filter, mode)
CMS.Communities.paged(filter)
CMS.Press.site_manifest(community)
```

调用方不因内部迁移而直接依赖 `Articles.Query.Page` 或 `Comments.Query.Replies`。

## 4. 现有 Reader 处置

| 当前模块                       | 当前职责                                                                                           | 目标处置                                                                                                                                                    |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Articles.Reader`              | Draft、Public、Revision、Lifecycle、cover edit 等 owned facts；少量 public projection/relationship | owned row 迁入 `Articles.Store/Facts`；顶层 Article 与稳定关系进入 FrontDesk；不整体改名为 Query                                                            |
| `Docs.Reader`                  | DocPublic、branch version、revision、body、release 等 materialization facts                        | 迁入 `Docs.Store/Facts`                                                                                                                                     |
| `Comments.Reader`              | FrontDesk 单资源 wrapper、author lookup、reconcile batch                                           | 删除单资源 wrapper；reconcile 与内部 author lookup 收口到 `Comments.Query.Reconcile`；稳定关系仍由 FrontDesk 提供                                           |
| `Communities.Reader`           | detail、Gate scope、viewer state、views 记账、缺省 dashboard 写入、category page                   | detail 收敛 FrontDesk；category page 迁入 `Communities.Query`；记账/初始化交还写 owner，最终删除 Reader                                                     |
| `Assets.Reader`                | page、stats、usage、refs、visibility classification、active asset lookup                           | 直接改名为 `Assets.Query`；写入继续由 `Assets.Writer`、`Upload`、`Deletion` 等具名 owner 负责；本次未新增 `Assets.Store`                                    |
| `CommunityApplications.Reader` | current、history、review queue、events、detail，以及关联 User/Community/logo lookup                | 产品读取迁入 `CommunityApplications.Query`；顶层 User/Community 走 FrontDesk；内部 logo row 进入 Store/Query 的具名 owner                                   |
| `DocCover.Reader`              | 带授权的完整 Docs cover read model                                                                 | 改为 `DocCover.Query`                                                                                                                                       |
| `DocTree.Reader`               | tree 查询、状态计算、序列化和 `ensure_*` 写入                                                      | 收口为 `DocTree.Query`（读取与投影）及 `DocTree.State/Writer`（状态初始化与写入）；本次未新增独立 `Projection` 模块                                         |
| `Press.Reader`                 | config、Article、RSS、site manifest 查询和投影                                                     | 直接改名为 `Press.Query`；Community lookup 走 FrontDesk，配置写入继续由现有 `ConfigWriter`/`PressConfig` owner 负责                                         |
| `Snapshot.Reader`              | visibility-safe batch summaries                                                                    | 改为 `Snapshot.Query`                                                                                                                                       |
| `Wallpaper.Reader`             | public/editor projection、history、snapshot/state helper                                           | 直接改名为 `Wallpaper.Query`；发布、上传、设置、保留继续由 `Publisher`、`Upload`、`Settings`、`Retention` 负责；本次未新增 `Wallpaper.Store` 或 `Validator` |

迁移完成后不要求每个 domain 都同时拥有 Query、Store 和 Projection；只创建该 domain 实际需要的 owner。

## 5. 现有 List 处置

现有 `Articles.List`、`Comments.List`、`Communities.List`、`AbuseReports.List` 统一进入 Query 语义，
但不迁入 FrontDesk。

较小模块可以直接收口：

```text
Communities.List  -> Communities.Query
AbuseReports.List -> AbuseReports.Query
```

`Articles.List` 和 `Comments.List` 已包含多个独立 read use case，应按产品查询拆分：

```text
Articles.Query.Page
Articles.Query.Kanban
Articles.Query.Published

Comments.Query.Thread
Comments.Query.Replies
Comments.Query.Participants
Comments.Query.Published
```

拆分以业务合同为准，不以控制文件行数为目标；两个 use case 如果共享完全相同的 policy、query shape
和 response hydration，可以继续同模块实现。

本次迁移结果：四个旧 `*.List` 已收口为对应 `*.Query`；需要持久化事实的 Article/Docs
读取已收口为 `Store`，Comments 的 bounded reconcile 已进入 `Comments.Query.Reconcile`。
这些 Query 用例仍共享相同的 policy、分页和 response hydration，因此不再人为拆出空的
`Page`/`Thread` wrapper。

## 6. 与现有 Query 的关系

现有 Query 名称已经表达三类局部语义，允许保留：

- `Gate.Scope.Query`：根据 root/context 分发 Scope query builder；
- `Interactions.ReadState.Query`、`ViewTracker.Query`：批量读取派生状态；
- `SearchArtiments.Query`：validated query value object。

Query 不被定义成一种固定 Ecto 实现形态，而被定义成“无写入的具名读取合同”。同一 domain 内不得
同时用 `Reader` 和 `Query` 表达同类产品读取，也不得用模糊 `Query` 吞并 Store/Facts 或 Projection。

## 7. 直接切换顺序

### Phase 1：文档与静态边界（已完成）

- 冻结本文和 FrontDesk V2 的互补关系；
- 更新 facade 目录文档，标记 Reader 统一命名决策已被本文取代；
- 增加 CMS Query boundary 检查：禁止新增 CMS `*.Reader` 模块、alias、调用和 `reader.ex` 文件；
- 禁止 FrontDesk 新增 `page/list/search/count/aggregate` surface。

### Phase 2：清理重复单资源入口（已完成）

- 删除 Comments Reader 对 FrontDesk 的单资源 wrapper；
- 将 Communities detail 完整收敛到 FrontDesk；
- 将跨聚合 User/Community 单资源读取迁到 Root/CMS FrontDesk；
- 不保留旧 Reader compatibility wrapper。

### Phase 3：迁移简单 Query（已完成）

- Snapshot、DocCover、Press、CommunityApplications；
- Communities.List、AbuseReports.List；
- 保持顶层 facade、GraphQL schema 和返回值不变。

### Phase 4：混合 Reader/List 的职责收口（已完成）

- Assets Reader 直接改名为 Query，写入继续由现有 Writer/Upload/Deletion owner 负责；
- Wallpaper Reader 直接改名为 Query，写入与校验继续由 Publisher/Upload/Settings/Retention owner 负责；
- Articles、Docs Reader 收敛为 Store/Facts 与 FrontDesk view；
- Articles.List、Comments.List 拆为具名 Query use case。

### Phase 5：DocTree 收口（已完成）

- 将 read、projection、ensure/write 分开；
- Writer、Publish、Import 等内部调用改用对应 owner；
- 删除最后的 Reader 模块与 alias。

## 8. 静态规则与测试

已通过 Credo/protected-boundary、编译和测试共同保证：

- 生产代码不新增 `defmodule ...Reader`；
- Resolver、Command、Event 不直接调用 Query/Store 获取一个顶层资源；
- Query 不调用 `Repo.insert/update/delete`、`ORM.upsert/inc` 或 `ensure_*` 写入；
- FrontDesk 不暴露任意 filter/query/schema/preload，也不暴露通用 batch/list；
- Gate mutation admission 和 canonical reload 不因 Query/FrontDesk 重构而减少；
- list/batch 测试覆盖匿名、viewer、management policy、空 projection、分页和排序稳定性；
- facade contract test 证明迁移前后公开函数、错误和 response shape 不变。

## 9. 非目标

- 不把所有读取都塞进一个全局 `CMS.Query`；
- 不为每张 Ecto schema 创建 FrontDesk API；
- 不把 Query 变成任意 schema/query/preload 的 ORM facade；
- 不用 FrontDesk 取代 Gate mutation admission 或 Store transaction invariant；
- 不在本次命名迁移中修改 GraphQL API；
- 不保留 Reader/Query 双轨兼容层。

## 10. 完成定义

Query V2 当前完成定义：

- CMS 生产代码不再定义或引用 `*.Reader`；
- 顶层资源单资源读取只有 FrontDesk 一条路径；
- page/list/search/batch/aggregate 均由 owning Domain Query 或具名能力拥有；
- aggregate-owned 持久化事实由 Store/Facts/Gate Loader 拥有；
- Query 中不存在状态初始化或写入副作用；DocTree 状态初始化由 `DocTree.State`/facade 拥有；
- 四个旧 `*.List` 已迁入 Query 语义；
- `CMS.<Domain>` 公开 facade、GraphQL schema 和 response shape 保持稳定；
- 静态检查、聚焦测试、warnings-as-errors 编译与 docs check 通过。
