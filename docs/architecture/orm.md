# ORM 与数据库原语边界

> 状态：当前合同；普通 CRUD 和可表达的批量写入已直接使用 Ecto，少量 PostgreSQL/query
> owner 例外保留参数化 SQL。
>
> 当前普通领域读写主要使用 Ecto；PostgreSQL advisory transaction lock 仍分别实现在
> `Helper.Transaction` 与 `CMS.Articles.MutationLock`。实施时直接收口到 `Helper.ORM.AdvisoryLock`，删除旧实现，
> 不保留 delegate、alias 或兼容 wrapper。

## 1. 命名与归属

仓库不建立 `Database`、`DB` 或 `Persistence` 这类平行的通用模块。数据库访问基础设施统一位于
`Helper.ORM` namespace：

```text
Helper.ORM
├─ 现有通用 Ecto 查询与行锁 helper
├─ AdvisoryLock          PostgreSQL transaction advisory lock
└─ TransactionSettings   transaction-local PostgreSQL settings（需要时建立）
```

`ORM` 在调用点可以是 `alias Helper.ORM` 后的短名；完整模块名始终是 `Helper.ORM.*`。文档和代码不得把它写成
不存在的 `Database.*`，也不得新增 `GroupherServer.Database`、`GroupherServer.ORM` 等第二套 owner。

边界如下：

```text
Business Context
  ├─ 决定 resource identity、锁顺序、授权和业务事务
  └─ 调用 Helper.ORM.*
             │
             ├─ Ecto query / changeset / Multi
             └─ 必要且封装后的 PostgreSQL primitive
                         │
                         v
                    GroupherServer.Repo
                         │
                         v
                      PostgreSQL
```

业务 Context 不能散落执行 `Repo.query/2` 或 `Repo.query!/2`。PostgreSQL 专属原语必须集中在职责明确的
`Helper.ORM.*` 模块；无法由 Ecto 清晰表达的 recursive CTE、异构 UNION query 和原子 counter
upsert 可以留在专门的 persistence/query owner 中。普通 CRUD、counter UPSERT、排序和关联查询
继续使用 Ecto，不因“可能更快”改写成手工 SQL。

## 2. AdvisoryLock

### 2.1 职责分层

`Helper.ORM.AdvisoryLock` 只拥有数据库原语：

- 将稳定的业务 lock key 规范化为 PostgreSQL signed 64-bit key；
- 在当前 transaction connection 上执行参数化的 `pg_advisory_xact_lock`；
- 提供“开启事务并持锁执行 callback”和“在既有事务内加锁”两种明确入口；
- 保证 transaction 结束时由 PostgreSQL 自动释放锁；
- 统一数据库错误和 callback 返回值合同。

它不拥有 Article、Community、Doc branch 等业务 identity，不决定多锁顺序，不做 Gate/Lifecycle 授权，也不定义领域
telemetry 名称。这些语义留在 `CMS.Articles.MutationLock` 等业务模块。

```text
Article command
  -> CMS.Articles.MutationLock
       ├─ build stable Article lock key
       ├─ sort multiple keys deterministically
       ├─ measure domain wait/hold telemetry
       └─ Helper.ORM.AdvisoryLock.transact(key, callback)
              │
              v
          Repo.transact
              │
              v
          AdvisoryLock.acquire!(key)
              │
              v
          SELECT pg_advisory_xact_lock($1)
              │
              v
          callback -> commit / rollback -> lock released
```

### 2.2 公共 API

目标 API 只保留两个入口：

```elixir
@spec transact(lock_key(), (-> {:ok, result()} | {:error, term()})) ::
        {:ok, result()} | {:error, term()}
def transact(lock_key, fun)

@spec acquire!(lock_key()) :: :ok
def acquire!(lock_key)
```

- `transact/2` 开启一个 strict transaction，在同一 checked-out connection 上 acquire 后执行 callback；callback 必须返回
  `{:ok, result}` 或 `{:error, reason}`。
- `acquire!/1` 只供已经由 `Repo.transact/2`、`Ecto.Multi` 或等价 owner transaction 包裹的代码使用；它不能偷偷开启
  nested transaction。实现使用 `Repo.in_transaction?/0` fail fast；transaction 外调用必须抛出带操作建议的错误。
- `transact/2` 是 top-level transaction 入口；已经位于 owner transaction 内的调用方必须显式选择 `acquire!/1`，不能
  依赖 Ecto nested transaction 的隐式行为。
- `lock_key()` 接受 integer 或稳定 binary identity；binary 的 hash/截断算法只在本模块存在一份。
- 多 key 排序属于调用方拥有的业务 identity 协议；调用方必须先去重并稳定排序，再按序调用 `acquire!/1`。

### 2.3 必须保留的注释与示例

实现不是“只有一行 SQL 所以无需文档”的 helper。模块必须包含：

- `@moduledoc`：说明 transaction-scoped、connection ownership、自动释放和不承载业务 identity；
- 每个 public function 的 `@doc` 与 `@spec`；
- 一张与上文等价的 ASCII business-position flow；
- 至少一个 `transact/2` 示例和一个既有事务内 `acquire!/1` 示例；
- 明确 warning：不得在 transaction 外调用 `acquire!/1`，不得使用 session-level `pg_advisory_lock`；
- binary key 如何稳定映射到 signed 64-bit integer 的说明。

目标 moduledoc 中的最小示例：

```elixir
alias Helper.ORM.AdvisoryLock

# API 自己创建事务；相同 key 的 callback 串行执行。
AdvisoryLock.transact("article:42", fn ->
  with {:ok, article} <- publish_article() do
    {:ok, article}
  end
end)

# command 已经拥有 transaction 时，只 acquire，不另开兼容 wrapper。
Repo.transact(fn ->
  :ok = AdvisoryLock.acquire!("article:42")
  update_article()
end)
```

多个资源必须在业务 owner 中明确顺序：

```elixir
Repo.transact(fn ->
  ["article:18", "article:42"]
  |> Enum.uniq()
  |> Enum.sort()
  |> Enum.each(&AdvisoryLock.acquire!/1)

  merge_articles()
end)
```

示例只表达调用合同；真实 doctest 使用 repository fixture 或可独立执行的值，不能依赖未定义的示意函数。

### 2.4 直接切换（已完成）

```text
Helper.Transaction / CMS.Articles.MutationLock
  ├─ identity/order/domain telemetry
  └─ Helper.ORM.AdvisoryLock
       ├─ transact/2
       ├─ acquire!/1
       └─ 唯一 SQL/key normalization owner
```

已迁移所有 runtime 调用方；`Helper.Transaction.lock_global/2` 保留为业务兼容入口，但不再拥有
SQL 或 key normalization。不得新增 `Database.AdvisoryLock` alias。

## 3. Ecto 与裸 SQL

### 3.1 默认规则

以下能力使用 Ecto：

- changeset validation 与普通 insert/update/delete；
- `Repo.insert(..., on_conflict: ...)` counter UPSERT；
- `Ecto.Multi` 与领域 transaction；
- association、scope、排序、批量 read 和 row lock；
- `update_all`、`insert_all`、`delete_all` 等批量操作；
- 可由 `fragment/1` 安全表达的 PostgreSQL function/operator。

`ArticleStats.views += 1`、固定 count 写入和 `ArticleEmotionCount` UPSERT 都属于上述 Ecto 路径，不在业务模块执行裸 SQL。

### 3.2 允许的 SQL 边界

只有以下情况可以使用 `Repo.query*` 或 migration `execute/1`：

| 场景                                                        | 位置                             | 要求                                                                    |
| ----------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------- |
| Ecto 没有等价 API 的 PostgreSQL primitive                   | 专门的 `Helper.ORM.*` 模块       | 参数化、注释、spec、示例、集中测试                                      |
| transaction-local setting                                   | `Helper.ORM.TransactionSettings` | 使用 `set_config(..., true)`，不泄漏到 connection session               |
| schema migration / one-off backfill                         | migration                        | 可回滚或明确 irreversible，不能成为 runtime 读写路径                    |
| PostgreSQL custom operator/function                         | Ecto query `fragment`            | 输入仍通过 parameter binding；封装到 owner query module                 |
| recursive CTE / heterogeneous UNION / atomic counter upsert | 专门 persistence/query owner     | 说明无法直接使用 Ecto 的原因，参数化、scope 测试、affected-row/并发合同 |

`unsafe_fragment` 不能成为长期 runtime contract。当前 Interactions 为多态 partial conflict target 使用的
`unsafe_fragment` 应随 canonical Article identity 与 `cms.article_emotion_counts` direct cutover 删除，而不是复制到新模型。

### 3.3 静态边界

目标门禁检查：

```text
backend/api/lib/** Repo.query*
  ├─ Helper.ORM.*             allow
  └─ 其他 runtime module      fail

backend/api/priv/repo/migrations/** execute/query
  └─ allow，按 migration review
```

门禁只约束原语归属，不禁止 Ecto `fragment`；但业务模块中的每个 fragment 都必须有无法用标准 Ecto API 表达的理由，并有
对应测试。

## 4. 验收条件

- runtime 中不存在 `Database.*`、`GroupherServer.ORM` 或其他平行数据库基础设施 namespace；
- `pg_advisory_xact_lock` 的 runtime SQL 只存在于 `Helper.ORM.AdvisoryLock`；
- transaction-local timeout SQL 只存在于 `Helper.ORM.TransactionSettings`；
- `Helper.Transaction.lock_global/2`、MutationLock 重复 SQL 和重复 key normalization 已删除；
- 相同 key 的并发 transaction 串行，不同 key 不互相阻塞；
- commit、rollback、callback error 和进程退出后 transaction lock 都会释放；
- 多 key 调用方使用确定顺序，并有逆序输入的并发测试；
- `acquire!/1` 在既有 transaction connection 上执行，没有隐藏 nested transaction；
- public API 有完整 moduledoc、ASCII business flow、`@doc`、`@spec` 和可执行示例；
- ArticleStats 与 ArticleEmotionCount 的普通写入使用 Ecto，不在领域模块新增裸 SQL；
- runtime 裸 SQL 只存在于 primitive owner 或有明确查询形状/原子性理由的 persistence/query owner；
- 不存在旧 API delegate、命名 alias、双实现或兼容中间层。
