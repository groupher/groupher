# TanStack DB 评估 ADR

## 状态

2026-08-20：决定暂不引入 TanStack DB，保持 TanStack Query + 领域 mutation helper。

## 背景

urql 迁移完成后，同一 article 仍可能同时出现在列表、详情和预览中；comment 也可能
存在 root/reply 的嵌套更新。TanStack DB 可以把这些实体正规化为 collection，但会新增
collection hydration、viewer 隔离、logout 清理、Query 同步和 optimistic transaction
等生命周期。

## 结论

当前 fan-out 已集中在 `patchArticleEverywhere` 和 `patchCommentEverywhere`，组件不负责
遍历 cache。现阶段新增 DB 的抽象与 bundle 成本大于收益，因此不进入正式实现。

Query-only 方案不是零维护：Groupher 需要维护 query key、实体定位、public/viewer 字段
所有权、跨 detail/list/preview/page 的 patch、snapshot/rollback、server reconcile、临时
comment/reply、快速 toggle 的最终意图，以及服务端排序/筛选结果的 targeted invalidate。
这些责任必须集中在领域 mutation/cache helper，业务组件不得各自直接修改实体 cache。

产品层采用以下边界：按钮状态、viewer flag、公开 count 和当前可见内容必须即时同步；热度
排序、跨页位置和服务端筛选归属在 optimistic patch 后通过 refetch 校准。Query-only 不复制
完整后端 query builder，因此复杂度保持在有限的业务规则内。

这不表示现有 fan-out 已完整正确：comment optimistic mutation 当前只 patch 公共 comment
cache，没有同步 `viewerKeys.commentStates`；view model merge 时旧 viewer 快照会覆盖
`viewerHasUpvoted`、emotion reaction 和 report 状态。该问题应先在 Query ownership 层修复，
并用 public/viewer 双 cache 的 patch、rollback 和 server reconcile 测试覆盖。单个一致性缺陷
本身不是引入 TanStack DB 的理由。

公共实体与 viewer state 继续使用不同 Query cache：

```text
public article/comment query ─┐
                              ├─> view model
viewer-scoped query ──────────┘
```

账号变化时清除 viewer-scoped query；公共 SSR 数据不包含当前用户状态。这个边界不因
未来采用 DB 而改变。

TanStack Query 只拥有 server state。弹窗、编辑器草稿、折叠和临时选择继续由 Valtio
管理；可由 route/URL 推导的页面形态直接由路由管理。本阶段不会为了替换少量 UI state
而引入 TanStack Store。

## Bundle 评估

基于仓库当前依赖，使用 browser ESM、ES2022、minify、React external 和 gzip `-9` 做隔离
测量：TanStack Query 的 Provider/query/mutation/hydration 切片为 11,580 B gzip；当前 urql
Provider/query/mutation/cache/fetch/retry 切片为 11,471 B gzip，两者处于同一量级。

计划使用的 TanStack DB coherent slice（Query Collection、`useLiveQuery` 和 optimistic
action）在 Query 之上约增加 71 KiB gzip，`useLiveQuery` 的查询引擎是主要来源。包声明支持
tree-shaking，但计划功能之间共享同一套核心引擎，因此不能把 npm 页面显示的 84 KiB 直接
当成必然全量，也不能预期当前计划只留下几 KiB。

这意味着完全用 Query 替换 urql 的最终运行时体积基本持平；引入 DB 则是额外成本。Main 已
退出 urql，但 Dashboard/Dash 仍有 consumer，只有所有 workspace 迁移后才删除 urql 根依赖。
GraphQL typed documents、codegen 和 browser/public/auth transport 不随 urql 一起删除。

## Query-only 中间方案评估

Phase 8 在修正字段所有权和回归测试的同时，落地中间方案的首个垂直切片，而不是继续只写建议。
这里的“shape 注册表”是 Groupher 自有抽象，不是 TanStack Query 官方能力。

建议拆成三步：

1. **纯 selector 先落地。** 把 article + viewer、comment + viewer 的组合写成可单测纯函数。
   comment selector 固定 public aggregate 与 viewer flag 的 merge 规则，这是当前收益最高、风险
   最低的一步；
2. **统一 mutation key 后接 `useMutationState`。** 只有 mutation 真正通过 TanStack mutation
   cache 执行并设置稳定 `mutationKey`，才能按实体读取 pending 状态。当前直接调用的 article
   async helper 和 comments 的 `pendingCommentMutations` Set 不会自动出现在
   `useMutationState` 中，因此不是现状下“一行免费获得”。key 使用
   `['mutation', entityType, entityKey, operation]`；operation 是稳定能力名，toggle 方向放在
   variables。同一 `entity + operation` 使用相同 `scope.id` 串行，`mutationKey` 负责观察，
   `scope.id` 负责调度；最后意图合并仍由业务 intent buffer 完成；
3. **以 tagGroups 为压力测试增加 typed shape routing。** `Q.article.tagGroups` 加入
   `articleKeys.all` 后，`patchArticleEverywhere` 不再对整个前缀下的未知 data 猜 shape；为
   article direct/detail、paged entries 等 article-bearing query 声明 adapter，并把
   `tagGroups`/`tagStats` 显式分类为 non-entity query。后续新增 shape 时优先新增 adapter，不在
   mutation 中增加分支。dispatch 必须先匹配 query key，再调用 adapter，不能只看 data shape。

shape adapters 能集中实体定位规则，但不会把 Query cache 变成 normalized central store，也
不会消除对已加载 matching queries/entries 的扫描。`tagGroups` 本身不包含 article entity，
因此不为它伪造 locator；它的价值是迫使 routing 显式区分 entity/non-entity shape。article、
comment、viewer 应保留各自类型和字段所有权，不能为了一个全局 generic updater 而允许 viewer
数组覆盖 public aggregate。

不做第 4 步“订阅 QueryCache 并维护跨查询派生 Map/store”。它会制造第二份长期实体副本，引入
hydration、logout、账号切换和 cache eviction 生命周期，并违反当前“Query 是 server state
唯一 owner”的边界。现阶段 join 都可以在 view selector 中完成；只有 join 成为核心产品能力
且现场测量证明 selector 不够用时再讨论索引。

能力判断：

| 需求                              | Query-only 中间方案                          | 与 TanStack DB 的实际差距                           |
| --------------------------------- | -------------------------------------------- | --------------------------------------------------- |
| 同一实体跨已加载 shape 更新       | typed shape adapters + `setQueriesData`      | 依赖约束和测试，不是结构性 normalized collection    |
| article/comment + viewer 派生视图 | 纯 selector/useMemo                          | 当前产品范围内足够，没有增量 live-query engine      |
| optimistic rollback               | cancel + snapshot + patch + restore          | 需要手工列出事务涉及的 Query cache                  |
| 每实体 pending                    | 统一 `mutationKey` 后使用 `useMutationState` | mutation 入口必须先统一                             |
| 临时 comment/reply                | pending ID + replace/remove                  | temp-to-server reconcile 仍是业务规则               |
| 快速 toggle 意图合并              | 每实体 queue 保存最后期望状态                | DB transaction 也不会自动理解 Groupher toggle 意图  |
| 服务端分页/排序/筛选              | patch 可确定字段后 invalidate/refetch        | 不提供谓词下推和增量查询，但当前 20/30 条分页不需要 |

结论是：该三步可以在不增加运行时依赖、不新建账号/hydration/logout 生命周期的前提下，达到
当前产品所需的 Query Collection 子集效果；不能宣称与 TanStack DB 整体能力等价。实现规模
预计是低数百行，但必须以 spike 的类型复杂度和测试数量为准，不能把 200-300 行当作承诺。

## 重新评估条件

满足以下任一实际信号时重新 spike，而不是为使用 TanStack 全家桶提前引入：

- typed shape adapters 无法表达新 shape，导致每次新增 Query 都必须修改多个 mutation 的遍历
  和回滚逻辑；
- 单次操作出现跨实体原子事务，例如同时修改 comment、parent reply count 和 author state，
  Query-only 需要手工 snapshot/restore 越来越多独立 key；
- article、comment、author 与 viewer state 出现跨 collection join 需求；
- 通知中心、搜索聚合等多集合 join 成为核心产品交互，而不是页面局部 selector；
- 数据量和本地查询复杂度增长到需要谓词下推或增量重查询，现有分页 refetch 无法满足；
- 现有 Query fan-out 出现无法通过集中 helper 和测试可靠控制的一致性缺陷。

单个漏 patch 不构成上述信号。例如 comment mutation 同步更新 comment list 的 public-owned
aggregate 与 `viewerKeys.commentStates`，并覆盖 REPLIES/TIMELINE 两种 shape，即可解决当前
stale viewer 覆盖问题，无需为此引入 DB。

重新评估必须同时比较客户端体积、SSR/hydration、账号切换、tab focus、测试成本和故障
可观察性。没有可量化收益时继续保持 Query-only。
