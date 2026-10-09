# Runtime 裸 SQL 盘点

> 盘点日期：2026-10-09
>
> 范围：`backend/api/lib/**/*.ex` runtime 代码中的 `Repo.query/2`、
> `Repo.query!/2` 与同类直接 SQL；不包含 `backend/api/priv/repo/migrations/**` 中的
> `execute/1`，因为 migration 本身就是 schema/backfill 的数据库边界。
>
> 本文是现状清单和迁移排序，不等同于“所有裸 SQL 都必须删除”。是否保留，必须看
> Ecto 等价能力、数据库原语需求、原子性、并发语义和实际查询复杂度。

## 1. 结论

初始盘点发现 25 个 `Repo.query*` 调用，分布在 14 个文件。完成本轮迁移后，当前 runtime
剩余 6 个文件中的 8 个调用；其中 2 个调用已经收口到 `Helper.ORM.*` PostgreSQL
primitive owner，业务侧剩余 6 个调用全部属于已记录的复杂 query owner。

最明确的 Ecto 迁移对象是三类：

1. 使用 `UNNEST` 做逐行不同值的批量排序更新；改用
   [`Ecto.Query.values/2`](https://hexdocs.pm/ecto/Ecto.Query.API.html#values/2)
   join + [`Ecto.Repo.update_all/3`](https://hexdocs.pm/ecto/Ecto.Repo.html#update_all/3)。
2. 普通 join-table 的 insert/delete/copy；优先评估 schema、`insert_all`、
   `delete_all` 和 Ecto query source。
3. 单行动态数值更新；优先评估 changeset 或 Ecto update expression，避免动态拼接表名、
   字段名和操作符。

不应机械改写的主要是：

- PostgreSQL advisory lock；
- transaction-local timeout/lock timeout；
- recursive CTE；
- 动态 handler 生成的 `UNION ALL` activity 查询；
- 需要在一个 statement 内完成复杂原子 upsert 的统计写入。

当前目标合同见 [`orm.md`](./orm.md)：普通领域读写使用 Ecto，PostgreSQL 专属原语集中在
明确的 `Helper.ORM.*` owner 中。

## 2. 现状清单

### P0：与 tags reindex 同形，优先改为 Ecto

#### 2.1 Doc cover 三处批量重排

文件：[`cms/doc_cover/persist.ex`](../../backend/api/lib/groupher_server/cms/doc_cover/persist.ex)，共 4 处 `Repo.query*`

其中 3 处属于本节的批量重排，另 1 处 recursive CTE 见 §2.8。

函数：

- `batch_reindex_groups/2`：`UPDATE ... FROM UNNEST`，更新 `doc_cover_cards.index`。
- `batch_reindex_items/3`：`UPDATE ... FROM UNNEST`，更新 `doc_cover_items.index`。
- `batch_reindex_pinned_docs/2`：`UPDATE ... FROM UNNEST`，更新 pinned document index。

这些查询都是“输入一组 `{id, index}`，按 tenant/scope 限制后逐行更新”，与
`Tags.Persist.batch_reindex_tags/4` 和 `batch_reindex_groups/3` 完全同类。

建议统一为一个可复用的 Ecto 形状：

```text
typed values([%{id, index}, ...])
  -> join target on id
  -> where community/scope
  -> update_all(set: [index, updated_at])
  -> validate updated count
```

不要为此引入第二个通用数据库 wrapper；这里的 owner 仍然应该是各自的 persistence
module，公共部分只复用经过验证的 Ecto query helper（如果确实能保持类型和边界清晰）。

#### 2.2 Doc tree 批量重排

文件：[`cms/doc_tree/writer_impl/index.ex`](../../backend/api/lib/groupher_server/cms/doc_tree/writer_impl/index.ex)

`batch_reindex_nodes!/2` 使用 `UNNEST` 同时更新：

- `parent_node_id`；
- `index`；
- 可选 `updated_at`；
- `community_id`、`branch_id`、`stage`、原 parent scope。

这同样可以使用 `values/2` join。需要特别保留当前的 affected-row 校验，因为它把并发
scope 改变视为失败，而不只是统计信息。

#### 2.3 Mailbox 批量 JSON 更新

文件：[`accounts/mailbox.ex`](../../backend/api/lib/groupher_server/accounts/mailbox.ex)

`batch_update_mailboxes/3` 使用 `jsonb_to_recordset` 批量更新 `users.mailbox`，并通过
`RETURNING` 取回每个 user 的 `updated_at`。

它不是简单的 `UNNEST` 替换，但仍可评估：

- `values/2`，字段类型为 `id: :id`、`mailbox: :map`；
- `update_all` 的 update expression；
- PostgreSQL `RETURNING` 对应的 Ecto `select` 返回值。

迁移时必须保留“每个用户返回自己的 updated_at”以及“受影响行数必须等于输入用户数”这两个
合同，不能只改成不返回结果的 `update_all`。

### P1：有明显维护风险，需单独设计

#### 2.4 动态 Article draft tag join-table 写入

文件：[`cms/articles/draft/store.ex`](../../backend/api/lib/groupher_server/cms/articles/draft/store.ex)，共 4 处 `Repo.query*`

当前有四类直接 SQL：

- `replace_tags/3`：逐个 `INSERT` draft tag；
- `delete_tags/2`：按 article/branch 删除；
- `copy_revision_tags/3`：`INSERT ... SELECT` 复制 revision tags；
- `stored_tag_ids/2`：直接读取 tag ids。

此外，相关 diff 路径还有一处同类实现：

文件：[`cms/articles/draft/diff.ex`](../../backend/api/lib/groupher_server/cms/articles/draft/diff.ex)，共 1 处 `Repo.query*`

- `query_tag_ids/3`：`table` 动态插入表名，`where` 整段动态插入 SQL。

这一处的拼接面比 `draft/store.ex` 更大：不仅动态表名，连完整 where 子句都通过字符串插值
进入 SQL。它必须和 draft tag storage 一起处理，不能只把 `store.ex` 的逐条 insert 改成
`insert_all` 就结束。

维护风险主要不是 SQL 语法，而是：

- table 名由 `thread` 动态拼接；
- doc/non-doc branch 条件分散在多个字符串中；
- replace 路径是逐条 insert，可能产生 N 次 SQL；
- 当前缺少统一的 table/source/schema boundary。

建议顺序：

1. 先确认 `post_draft_tags`、`doc_draft_tags`、revision tables 是否都有稳定 schema 或
   可安全使用的 query source。
2. 用 `insert_all` 一次写入 ids，用 `delete_all` 替代手工 delete。
3. 把 thread/branch scope 统一成一个 query builder，而不是继续拼接 where 字符串。
4. 只有在物理表确实无法由 Ecto 表达时，才保留一个集中 owner，并补充动态表白名单说明。

#### 2.5 Revision tag copy

文件：[`cms/articles/revision.ex`](../../backend/api/lib/groupher_server/cms/articles/revision.ex)

`copy_tags/3` 使用动态 source/target table 的 `INSERT INTO ... SELECT`。

这不是普通单行 CRUD，但可以评估 `insert_all/3` 的 query source；如果 Ecto 无法同时表达
动态表、branch 条件和 source select，应把理由写在 persistence owner 的 `@doc`，不要让
SQL 以匿名字符串散落在 revision workflow 中。

#### 2.6 动态字段数值更新

文件：[`helper/orm_atom.ex`](../../backend/api/lib/helper/orm_atom.ex)

公开入口是 `inc/2`、`dec/2`，实际由私有 `update_counter/4` 执行：

- schema prefix/table；
- field 名；
- `inc/2` 和 `dec/2` 在公开函数中硬编码 `+ 1` / `- 1` 操作；操作符不是外部动态输入；
- 可选 `GREATEST(..., 0)`；
- `RETURNING` 新值。

这里仍然需要安全性和边界审查，但风险应准确描述为：`field` 只经过
`__schema__(:type, field)` 校验为“存在且为 integer”，随后被插入 SQL；它没有更窄的
SQL identifier 白名单。table/prefix 来自 schema 的 `__schema__(:source)` 和
`__schema__(:prefix)`，通常是代码定义值，但自定义 source 理论上扩大了插值边界。
操作符本身不是风险来源，因为 `inc/2`、`dec/2` 已经分别固定了方向。

可选 Ecto 路径：

- 已知字段：`Ecto.Changeset.change/2` + `Repo.update/1`；
- 批量/表达式更新：`update_all` 的 `inc` 或带类型约束的 update expression；
- 必须使用数据库函数时，仅保留最小的 `fragment`，不要拼接整条 UPDATE。

### P1/P2：SQL 复杂，但要先判断是否真的适合 Ecto

#### 2.7 Community tag stats 原子统计 upsert

文件：[`cms/communities/tags/stats.ex`](../../backend/api/lib/groupher_server/cms/communities/tags/stats.ex)

当前有两处：

- 单 tag counter update；
- `UNNEST` + `INSERT ... ON CONFLICT DO UPDATE` 的批量统计 upsert。

这段同时处理：

- 总计数和当天计数；
- 正负 delta；
- 日期 rollover；
- 非负保护；
- 冲突时的原子更新。

不建议直接为了消灭 SQL 改成 Elixir 读-改-写，那会破坏并发原子性。可以评估
`insert_all` + Ecto conflict query，但必须先证明生成 SQL 保留同样的单 statement 原子性，
并补 concurrency test。否则应保留 SQL，并把它集中到 `Tags.Stats` 的明确 persistence
owner，补齐 spec、输入类型和返回值合同。

#### 2.8 Recursive subtree queries

文件：

- [`cms/doc_tree/writer_impl/trash.ex`](../../backend/api/lib/groupher_server/cms/doc_tree/writer_impl/trash.ex)
- [`cms/doc_cover/persist.ex`](../../backend/api/lib/groupher_server/cms/doc_cover/persist.ex)

两处使用 recursive CTE 查询树结构。Ecto 支持 CTE/subquery，但将递归树查询改写成
Ecto 不一定更易读。保留 SQL 是可接受选项，前提是：

- query owner 清晰；
- 所有值使用参数绑定；
- community/branch/stage scope 在 SQL 中不可绕过；
- 结果加载和 schema mapping 有测试；
- `@doc` 说明为什么不用普通 Ecto query。

#### 2.9 Activity community log 动态 UNION

文件：[`activity/community_log.ex`](../../backend/api/lib/groupher_server/activity/community_log.ex)

`page/4` 和 `daily_counts/3` 根据 handler 动态生成多个 stream 的 `UNION ALL`，再执行
count、排序、分页和时间聚合。

这更像 query compiler，而不是普通 persistence CRUD。直接改成一组 Ecto query 再组合可能
会让动态 handler contract 更难理解。当前更重要的是：

- handler 产出的 table/field 必须是受控 metadata；
- filter 参数必须始终走 binding；
- count/page 两条 SQL 的 scope 必须一致；
- 给 `select_sql/2`、`select_occurred_at_sql/2` 补 SQL-shape 测试。

### 明确保留：PostgreSQL 专属 runtime primitive

#### 2.10 Advisory transaction lock

文件：

- [`helper/transaction.ex`](../../backend/api/lib/helper/transaction.ex)
- [`cms/articles/mutation_lock.ex`](../../backend/api/lib/groupher_server/cms/articles/mutation_lock.ex)

使用 `pg_advisory_xact_lock`。这不是 Ecto 普通 CRUD 的替代方案，应收口到现有目标合同中
规划的 `Helper.ORM.AdvisoryLock`，而不是改成伪 Ecto。

#### 2.11 Transaction-local timeout settings

文件：

- [`cms/command/receipt/runner.ex`](../../backend/api/lib/groupher_server/cms/command/receipt/runner.ex)
- [`cms/wallpaper/publisher.ex`](../../backend/api/lib/groupher_server/cms/wallpaper/publisher.ex)

使用 `set_config(..., true)` 设置当前 transaction 的 `statement_timeout` 和 `lock_timeout`。
这是数据库 session/transaction 原语，应集中到 `Helper.ORM.TransactionSettings`，不能用
普通 Ecto changeset 替代。

## 3. 非 Repo.query 的 `fragment` 观察项

本轮没有把所有 `fragment(...)` 当作裸 SQL 计数。当前发现的主要 runtime fragment 包括：

- JSONB 函数：`jsonb_set`、`jsonb_array_elements`；
- 聚合表达式：`count(?)`；
- bitmap/搜索/统计相关数据库表达式；
- schema migration 中的默认值函数。

`fragment` 本身不等于“直接执行整条 SQL”。判断标准是：

1. 是否只表达一个无法由标准 Ecto API 表达的数据库函数/operator；
2. 所有业务值是否仍然通过参数绑定；
3. 是否把 table、column、operator 拼进 fragment；
4. 是否有 owner module 和针对表达式的测试。

本轮扫描中值得单独列出的 fragment 热点是：

- [`cms/article_stats.ex`](../../backend/api/lib/groupher_server/cms/article_stats.ex)：8 处；
- [`cms/search_artiments/capacity.ex`](../../backend/api/lib/groupher_server/cms/search_artiments/capacity.ex)：7 处；
- [`cms/model/interaction/roaring_bitmap.ex`](../../backend/api/lib/groupher_server/cms/model/interaction/roaring_bitmap.ex)：5 处。

这些不是本轮 `Repo.query*` 数量的一部分，但应纳入 Batch 4 的 fragment 审计，尤其要确认
它们只表达数据库函数/operator，而没有隐藏动态 table、column 或完整 SQL。

此外，优先审查 [`helper/orm_atom.ex`](../../backend/api/lib/helper/orm_atom.ex) 和包含动态
JSONB table/field 的 query helper；普通 `count(?)` 或数据库函数表达式不应机械清除。

## 4. 建议迁移批次

### Batch 1：批量排序统一 Ecto

状态：已完成。Doc Cover 的 3 个批量重排和 Doc Tree 的 1 个批量重排已经改为
`values/2` + `update_all/3`；Doc Cover 的 recursive CTE 不在本批次范围内。

范围：

- `cms/doc_cover/persist.ex` 三个 reindex helper；
- `cms/doc_tree/writer_impl/index.ex` reindex helper。

已保留的合同：

- 使用 `values/2` typed relation；
- 显式设置 `updated_at`；
- 保留 tenant/scope predicates；
- 保留 affected-row exact match；
- `doc_tree` 当前还依赖 `node.parent_node_id IS NOT DISTINCT FROM $6::varchar`。Ecto 没有
  对这个 PostgreSQL null-safe equality 的一等 query operator；迁移时要么拆成 `is_nil`
  和普通相等的两条逻辑分支，要么保留最小、参数化的 `fragment`；
- 在函数 `@doc` 链接 Ecto API；
- 针对跨 community/branch/parent scope 的误更新补测试。

### Batch 2：Mailbox batch update

状态：已完成。Mailbox 已使用 Ecto `values/2`、`update_all/3` 和 `select` 返回值，保留
逐用户 `updated_at` 和 affected-row 校验。

范围：`accounts/mailbox.ex`。

验收重点：

- mailbox map 的 Ecto 类型转换；
- `RETURNING` 的 updated_at 映射；
- 全部用户更新或整体失败；
- cache invalidation 时序不变。

### Batch 3：Dynamic article tag storage

状态：已完成。Draft/Revision tag storage 已集中到
`CMS.Articles.Draft.Tags`，使用 schema-less Ecto source、`insert_all`、`delete_all` 和
query select；thread table 由固定白名单选择，不再拼接 where 子串。

范围：draft store、revision tag copy、相关 schemas/query boundary。

验收重点：

- doc/non-doc branch 隔离；
- replace 不产生 N 次 insert；
- copy/delete 的事务语义不变；
- 动态 table 白名单和 schema source 不可被外部输入控制。

### Batch 4：Primitive owner 收口与复杂 SQL 审计

状态：已完成。`ORM.Atom` 已改为 Ecto update expression；advisory lock 和 transaction
timeout 已分别收口到 `Helper.ORM.AdvisoryLock`、`Helper.ORM.TransactionSettings`。

范围：advisory lock、transaction settings、tag stats、recursive CTE、activity UNION、
`ORM.Atom`。

剩余业务 SQL 已确认并保留在明确 owner 中：

- Community activity 的动态 heterogeneous `UNION ALL`；
- tag stats 的批量原子 counter upsert；
- Doc Cover / Doc Tree 的 recursive CTE。

这些路径均已补充保留理由和参数化/scope 验收说明，不做会破坏原子性或查询形状的机械替换。

## 5. 验收规则

每个 runtime 裸 SQL 的最终状态只能是以下之一：

1. **迁移到 Ecto**：使用 schema-aware query、`values/2`、`update_all`、`insert_all`、
   `delete_all` 或 changeset，并保留原有事务/并发/affected-row 合同。
2. **保留但收口**：位于明确的 `Helper.ORM.*` 或专门 persistence/query owner 中，拥有
   参数化输入、`@doc`、`@spec`、测试和保留理由。
3. **只存在于 migration**：使用 migration `execute/1`，注明 rollback 或 irreversible
   语义，不进入 runtime。

不得以以下方式“解决”：

- 用 `fragment` 把整条裸 SQL 藏起来；
- 新增 `Database.*`、`GroupherServer.ORM` 等第二套 wrapper namespace；
- 把逐行 `Repo.update` 当作批量 Ecto 迁移，导致 SQL 数量随输入线性增长；
- 删除 affected-row、scope、锁、原子 upsert 或 `RETURNING` 语义；
- 为了减少扫描结果，把 migration SQL、Ecto fragment 和 runtime raw query 混成同一类。

## 6. 本轮验证范围

本盘点使用 literal search 检查：

- `backend/api/lib/**/*.ex` 中的 `Repo.query/2`、`Repo.query!/2`；
- `Ecto.Adapters.SQL.query` / `SQL.query`：runtime 代码 0 命中；搜索结果只存在于依赖内容，
  不计入本项目清单；
- runtime `fragment(...)` 位置；
- migration `execute(...)` 作为排除项单独观察。

此前 tags reindex 已经迁移到 Ecto，并通过：

- `mix compile --warnings-as-errors`；
- `test/groupher_server/cms/communities/tags/post_tag_test.exs`：27 passed，0 failures。

本文已完成现状梳理并实施 Batch 1–4；当前剩余 SQL 均属于明确记录的 PostgreSQL/query
owner 例外，不是未盘点的散落调用。
