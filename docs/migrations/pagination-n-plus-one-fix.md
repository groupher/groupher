# Pagination N+1 Fix

> 状态：本批修复已落地，分页聚焦回归已通过；后端全量仍受当前 dirty 分支既有的 36 个生命周期/Sandbox 失败影响
> 日期：2026-10-20

本文记录分页 N+1 strict gate 之外的 Press、Assets、AbuseReports 和
SearchArtiments 问题，以及本批修复后的验收合同。scanner-clean 只说明静态
规则未发现直接模式，不等价于所有请求路径都已由 query-count 测试证明。

## 1. 结论和优先级

| 优先级 | 位置                                                                                       | 事实                                                                                                      | 处置                                                                                  |
| ------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| P0     | [`cms/press/query.ex`](../../backend/api/lib/groupher_server/cms/press/query.ex)           | Press service-scoped request path 先分页拿 paths，再逐条 hydrate                                          | 复用 Articles Pagination 选择器，100 条一批调用 `CMS.Articles.locators/1`             |
| P0     | [`cms/press/query.ex`](../../backend/api/lib/groupher_server/cms/press/query.ex)           | `site_manifest` 固定传 500，公共 Pagi 最大值为 100；当前错误会被转成 `[]`，manifest 普通 Article 必然为空 | 最多 5 页、每页 100；错误向上传播，不再静默为空                                       |
| P0     | [`cms/assets/query.ex`](../../backend/api/lib/groupher_server/cms/assets/query.ex)         | draft ref 的逐项 `:edit` Gate 会启动 per-item transaction/lock                                            | draft 可见性下推到一次 page-level SQL；DocDraft 以 branch-aware 条件纳入              |
| P1     | `cms/abuse_reports/query.ex` (removed by D5)                                               | 旧 Report query 曾用 `Enum.find/2` 合并 batch 结果，为 O(rows × targets)                                  | 模块已随 D5 退役；不迁移该查询                                                        |
| P1     | [`scripts/check-pagination-n-plus-one.mjs`](../../scripts/check-pagination-n-plus-one.mjs) | 旧 allowlist 按函数和 symbol 放行，且把 Press 当 background                                               | Press 删除；SearchArtiments 保留唯一 `background` exception，并绑定精确 line identity |

## 2. 当前事实

### 2.1 Scanner 结果

当前 strict gate 预期只保留一条：

```text
SearchArtiments.Indexer.public_article_for/2
  -> FrontDesk.article/1
  -> background_exception / path_kind=background
```

SearchArtiments 是后台 reindex 路径，但“最多 500 roots”只约束 root 数量，
不约束每个 root 的 visible binding fan-out。因此它是 background exception，
不是“每项 bounded”的证明。其 `load_public_articles/2` 复用已经按 500 条批量读取的
Article roots；binding fan-out 仍由唯一 background exception 覆盖。

Scanner 明确排除 import、seed、cover 和 publish workflow；这些是写入/维护路径，
不属于产品分页请求合同，必须由各自 workflow 的 query-count 或事务测试覆盖。

Press 的 GraphQL 入口是 service-scoped request path：

- `press_community_rss_feed`
- `press_thread_rss_feed`
- `press_site_manifest`

它不再进入 N+1 allowlist。

### 2.2 Press 的两个问题必须分开

#### Manifest 功能故障

`PressConfig.feed_count` 的合法范围是 5..50；`feed_count > 100` 不可达。
因此 Pagi 的 100 上限冲突只存在于 manifest，不存在于 feed。

`site_manifest` 对每个 thread 固定传 `@manifest_limit = 500`。当前公共分页
会返回 `size_out_of_range`，而旧的 `current_articles/3` 把所有错误变成 `[]`。
所以当前 manifest 的普通 Article/Doc 条目实际必然被静默丢弃；在当前故障状态
下不是“最多 4 × 500 次读取”，而是 0 次普通 Article hydrate。

#### Feed 的真实 N+1

Feed limit 会被 `bounded_limit/2` clamp 到配置值，最大为 50。原实现仍会对
每个 thread 的每个结果调用 `FrontDesk.article/1`，因此真实上界是：

```text
feed_count (5..50) × 已选择 thread 数
```

这仍是请求路径上的逐项读取，不能因为数量有上限就登记为 background exception。

## 3. Press 修复合同

实现位于 [`cms/press/query.ex`](../../backend/api/lib/groupher_server/cms/press/query.ex)
和 [`cms/articles/pagination.ex`](../../backend/api/lib/groupher_server/cms/articles/pagination.ex)。

1. Press 通过 Articles Pagination 读取 ArticleLite identity，不复制公开可见性、
   lifecycle、thread enable 和排序规则。
2. manifest 最多读取 5 页，每页 100；feed 使用同一选择器，feed_count=50
   时仍只需一页/thread。
3. Doc 的 public tree 使用 SQL `exists` 过滤，并发生在 Pagi limit 之前；不再
   对 page 结果做事后 tree 过滤。
4. 每 100 条 locator 调用一次 `CMS.Articles.locators/1`。随后用
   `CMS.Articles.Pagination.legacy_entries/2` 携带
   `include_public_projection: true` 做 page-level body projection，不恢复
   `FrontDesk.article/1` 逐条读取。
5. 每 thread 内仍按 Articles Pagination 的 `active_at desc`（Doc 为
   `doc_active_at desc`）和 binding identity 选择；pinned 首页先加入候选集，
   候选集在最终按 `updated_at || published_at desc` 排序后统一截断，保持旧的
   pinned 选择语义。
6. Pagination、batch hydrate 或 body projection 的错误均向上传播；Press 不再
   把失败伪装成正常空列表。

## 4. Assets usage visibility 合同

`usages/3` 入口已经存在一次 community-level `:read` Gate；这不是本批新增。
本批移除的是列表 filter 内对每个 draft ref 的
`CMS.Gate.with_community_check/5` 调用，因此不会再经由
`Articles.MutationLock.transact_article/3` 为每行启动事务和 advisory lock。

当前 SQL page-level 条件保持 `:edit` 的生命周期语义：

- Community 必须为 `:active`；
- ordinary Article 的 lifecycle 必须为 `:draft_only` 或 `:published`；
- Doc ref 必须通过 `DocDraft -> DocBranch -> DocLifecycle -> DocBranchState`
  的 branch-aware 条件；
- 非 draft 的 live、historical、trashed ref 仍按原分类返回；Trash membership 是
  顶层显式豁免，draft ref 即使缺少目标 Community 的 `ArticleBinding` 也仍返回
  `:trashed`，不再被已删除的 ArticleLifecycle 过滤掉。
- 普通 draft ref 的可见性分支必须存在目标 Community 的 `ArticleBinding`；缺 binding
  时 fail closed，与原 Gate loader 的 `article_in_community` 身份检查一致。也就是说，
  draft 的 binding 校验适用于普通 draft，Trash 分类优先于该校验。

`usage_query/2` 现在包含 `DocDraft`，因此本批选择修复而不是保留 DocDraft
遗漏/`doc_branch_required` 过滤的旧语义。DocDraft 回归必须覆盖 branch 身份和
缺少 branch state 时的 fail-closed 行为。

当前分页读取的 ArticleAssetRef SQL 次数是：

```text
floor(refs / 100) + 1
```

这是现有 sentinel empty page 的精确预算，0 refs 也会执行一次查询。draft
可见性不再产生 per-ref Gate/transaction/lock；若未来改成单条 page-level query，
才可以把预算收紧为 1。

## 5. AbuseReports

`public_article_lites/1` 的 DB projection 已经是 batch。合并阶段现在建立：

```elixir
Map.new(targets, &{{&1.id, &1.community_id}, &1})
```

随后用 key lookup，不再对每个 binding row 线性扫描 targets；不可匹配 row
仍被忽略。

## 6. Scanner 合同

scanner 仍是 report-only，不宣称替代运行时 query-count 测试。它现在：

- 识别 `Enum.filter` 等 collection 入口；
- 识别同文件命名 helper 中的 `Gate.with_community_check` 和
  `MutationLock.transact_*` capture，包括 `&helper/arity` 和
  `&helper?(&1, ...)` 形式；跨模块 helper 仍不由此静态规则证明；
- allowlist 同时要求 `source + function + line + symbol`；
- allowlist 记录 `path_kind=background`，不以“bounded”字样自动放行 request path；
- `CMS.Articles.locators/1` 批量解析 locator，不作为 per-item read；
- Press 不在 allowlist，SearchArtiments 是唯一登记项。

## 7. 验收矩阵

| 场景                                              | 必须证明                                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Press manifest，普通 Article 超过 100             | 不返回 `size_out_of_range`；普通 Article 不再静默为空；错误继续向上传播                                                 |
| Press feed，`feed_count = 50`，多 thread          | 结果按 thread 合并、按 `updated_at                                                                                      |     | published_at desc`排序；不出现逐条`FrontDesk.article/1` |
| Press Doc manifest                                | public tree 过滤先于 limit；非 tree page 不进入结果；active/pinned 选择语义不变                                         |
| Press public projection                           | `published_at`/`updated_at` 来自 `ArticlePublic`/`DocPublic`，不回退到稳定 Article 根表                                 |
| Press Doc canonical URL                           | manifest 使用 `DocPublic.slug` 后缀，保留 stable public projection 语义                                                 |
| Press batch hydrate                               | 每个 `CMS.Articles.locators/1` 输入最多 100 条；manifest 500 条最多 5 个 hydrate batch                                  |
| Press API 错误传播                                | `CMS.Press.site_manifest/1` 和 `thread_rss_feed/3` 原样返回 batch hydration/body projection 错误，不转为空列表          |
| Press pinned + 超过 limit                         | pinned 先进入 thread 候选集，最终排序后再截断；pinned 不直接占用 limit 名额                                             |
| Press 101 条跨页                                  | 选择器跨页取数、batch hydrate 和最终 projection 均保持结果完整                                                          |
| Assets，100/101 个 draft refs                     | draft filter 不启动 per-ref Gate/transaction/lock；ArticleAssetRef SQL 不超过 `floor(refs / 100) + 1`；101 refs 为 2 次 |
| Assets，trashed draft ref                         | Trash membership 豁免生命周期过滤，仍返回 `:trashed`                                                                    |
| Assets，普通 draft 缺少目标 ArticleBinding        | 查询 fail closed，不把不属于目标社区的 ref 当作可见 usage                                                               |
| Assets，非 draft ref 缺少目标 ArticleBinding      | live、historical、trashed ref 仍按原分类返回，不被 draft-only binding 校验误过滤                                        |
| Assets，trashed draft ref 缺少目标 ArticleBinding | Trash membership 优先于 draft binding 校验，仍返回 `:trashed`                                                           |
| Assets，DocDraft ref                              | branch 匹配时返回 draft；缺 branch state 时 fail closed；不丢失合法 DocDraft                                            |
| AbuseReports                                      | 合并结果正确，lookup 为 map，不再出现 `Enum.find(targets, ...)`                                                         |
| AbuseReports 顺序                                 | 明确采用稳定 newest-first 的 `id desc`，并有顺序回归断言                                                                |
| N+1 strict gate                                   | findings 数为 1；Press 不存在；SearchArtiments 为 `background_exception` 且 `path_kind=background`                      |

当前 Press 自动化 fixture 覆盖了 101 条 Article 的跨页路径；500 条 manifest 上限由
固定 `@manifest_limit`、每页 100 和最多 5 页的实现合同保持。由于现有文章工厂每次
创建都会执行完整 publish workflow，本批不把 500 条重型 fixture 伪装成已完成的运行时回归。

## 8. 验证命令

```bash
node --test scripts/check-pagination-n-plus-one.test.mjs
node scripts/check-pagination-n-plus-one.mjs --check --strict

cd backend/api
mix compile --warnings-as-errors
mix test test/groupher_server/cms/press_test.exs
mix test test/groupher_server/cms/assets_test.exs
mix test test/groupher_server/cms/abuse_reports
```

本文只覆盖本批 Press、Assets、AbuseReports、SearchArtiments 和 scanner 的
事实与合同；其他路径如未配套 query-count 测试，仍应称为 scanner-clean，不能
升级为“已证明无 N+1”。
