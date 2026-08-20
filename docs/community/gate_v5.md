# Gate V5：Scope Query 命名与分发边界

本文定义 Gate Scope 内部查询构造模块的命名和职责收口。V5 默认是一次内部结构重构，不改变 `CMS.Gate` 的公开接口、Scope Context、action、Lifecycle 规则、SQL 可见性语义或 Repo 执行边界。ErrorCat 目录合并是本版本唯一明确的错误协议迁移例外，必须按本文的错误码、namespace、message key 和调用方迁移方案执行。

相关文档：

- [Gate V2：统一读取范围与操作准入](./gate_v2.md)
- [Gate V3：Article Core 与 Doc Release 边界](./gate_v3.md)
- [Gate V4：资源级强类型 Context](./gate_v4.md)

## 1. 背景与问题

当前调用链是：

```text
CMS.Gate.scope/4
  -> Gate.Scope
  -> Scope.Registry
  -> resource Scope compiler
  -> Ecto.Query
```

其中有两个命名问题：

1. `Scope.Registry` 并不提供运行时注册、查找或进程管理能力。它只是通过函数模式匹配，根据 root schema 和 Scope Context 选择查询实现，因此 `Registry` 不能准确表达职责。
2. `compiler` 容易被理解成 Elixir 或 SQL 编译器。实际行为是把已有的 `Ecto.Query` 加上资源可见性条件，并返回新的 `Ecto.Query`。

仓库已有 `Helper.QueryBuilder`，负责通用过滤、排序、分页和时间条件。Gate Scope 也构造 Query，但它属于 CMS 读取边界，负责资源生命周期、社区可见性、actor 条件和 Doc branch 等领域规则。两者不能合并为一个通用 helper，也不应因为名称相似而改变 ownership。

## 2. V5 结论

将：

```text
Gate.Scope.Registry
Registry.compile/5
resource Scope compiler
```

收口为：

```text
Gate.Scope.Query
Query.build/5
resource Scope query implementation
```

目标调用链：

```text
CMS.Gate.scope/4
  -> Gate.Scope.scope/4
  -> Scope.Query.build/5
  -> Scope.Article.scope/4
  -> Ecto.Query
```

资源实现继续使用 `scope/4`，因为它们实现的是“将资源限制在指定 Scope 内”的语义；只有负责统一选择实现的模块使用 `Query.build/5`，表达“构造最终查询”。

## 3. 目标模块职责

```text
CMS.Gate
  对外公开 scope/4；不暴露内部资源查询模块

Gate.Scope
  接收 Ecto.Queryable
  转换为 Ecto.Query
  提取 root schema
  调用 Scope.Query

Gate.Scope.Query
  根据 root schema + typed Scope Context 做模式匹配分发
  校验 root schema 与 Context 是否匹配
  对未知资源、错误 Context、错误组合 fail closed
  不拥有任何资源生命周期或 actor policy 规则

Gate.Scope.Article
Gate.Scope.Comment
Gate.Scope.Community
Gate.Scope.Document
  构造各自资源的 joins、wheres 和 actor 条件
  实现 Gate.Scope.Policy behavior
  不执行 Repo，不加载资源，不解析外部标识
```

`Gate.Scope.Query` 不是运行时 Registry，也不是另一个领域 Policy 层。它只是 Gate Scope 内部的查询分发边界。

## 4. 模式匹配分发合同

`Scope.Query` 使用函数模式匹配，不引入 `case`、`cond`、动态注册表或通用反射分发。示例省略具体 policy body，但列出所有 root/context 映射：

```elixir
alias GroupherServer.CMS.Gate
alias Gate.Context.Scope.{Article, Comment, Community, Doc, Document}
alias Gate.ErrorCat
alias GroupherServer.CMS.Model.{ArticleDocument, Blog, Changelog, Post}
alias GroupherServer.CMS.Model.Comment, as: CommentModel
alias GroupherServer.CMS.Model.Community, as: CommunityModel
alias GroupherServer.CMS.Model.Doc, as: DocModel

def build(query, actor, action, CommunityModel, %Community{} = context),
  do: Gate.Scope.Community.scope(query, actor, action, context)

def build(query, actor, action, root, %Article{} = context)
    when root in [Post, Blog, Changelog] do
  Gate.Scope.Article.scope(query, actor, action, context)
end

def build(query, actor, action, DocModel, %Doc{} = context),
  do: Gate.Scope.Article.scope(query, actor, action, context)

def build(query, actor, action, CommentModel, %Comment{} = context),
  do: Gate.Scope.Comment.scope(query, actor, action, context)

def build(query, actor, action, ArticleDocument, %Document{} = context),
  do: Gate.Scope.Document.scope(query, actor, action, context)

def build(_query, _actor, _action, _root, context) when not is_struct(context),
  do: {:error, ErrorCat.scope_context_missing()}

def build(_query, _actor, _action, _root, _context),
  do: {:error, ErrorCat.scope_root_mismatch()}
```

实际实现可以继续使用当前的完整 root schema 名称；上例只展示职责和匹配方向。

必须保留的行为：

- `Post`、`Blog`、`Changelog` 只能使用 Article Scope Context；
- `Doc` 继续复用 Article Scope 查询实现，但必须使用 Doc Context；
- `Community`、`Comment`、`ArticleDocument` 只能使用对应 Context；
- root schema 与 Context 错配必须返回 `scope_root_mismatch`；
- 非 struct 的 raw map、空 map 或缺失 Context 必须继续返回 `scope_context_missing`；
- 未知的 Context struct（例如误传 `%User{}`）视为 root/Context 错配，返回 `scope_root_mismatch`；
- 空 Context、未知 thread、缺失 branch 等非法输入继续 fail closed；
- 不得把 Context 转回无结构 map 再猜测资源类型。

## 5. 与 `Helper.QueryBuilder` 的边界

两者均操作 `Ecto.Query`，但 ownership 不同：

| 模块                        | 负责                                       | 不负责                        |
| --------------------------- | ------------------------------------------ | ----------------------------- |
| `Helper.QueryBuilder`       | 通用过滤、排序、分页、时间窗口             | CMS 资源可见性和 actor 授权   |
| `CMS.Gate.Scope.Query`      | Scope 实现分发和 root/Context 校验         | 具体生命周期与业务策略        |
| `CMS.Gate.Scope.Article` 等 | 资源 Scope 条件、生命周期 join、actor 条件 | 通用分页、Repo 执行、资源加载 |

典型组合仍然是：

```elixir
Post
|> CMS.Gate.scope(actor, :list, ArticleScope.public(:post))
|> Helper.QueryBuilder.filter_pack(filter)
|> Repo.all()
```

Gate 先建立不可绕过的可见性边界，调用方再追加普通列表过滤和排序。两者都不执行 Repo。

## 6. 不改变的公开合同

V5 不改变以下接口：

```elixir
CMS.Gate.scope(queryable, actor, action, scope_context)
CMS.Gate.access_check(actor, action, resource)
```

也不改变：

- `Gate.Context.Scope.*` 的资源专属类型；
- `:read`、`:list`、`:read_draft` 的既有归属；
- Community、Article、Doc、Comment、Document 的生命周期条件；
- Scope 的错误语义，包括非法或非 struct Context 返回 `scope_context_missing`，未知 Context struct 和 root 与 typed Context 错配返回 `scope_root_mismatch`；
- `policy_mode` 仍只是读取语义，不能提升 actor 权限；
- Scope 仍只构造 Query，不执行查询；
- Reader 仍拥有 branch、slug 等外部输入的解析；
- 调用方仍拥有分页、preload 和 Repo 执行。

ErrorCat 目录合并、namespace 变化、错误码迁移和默认 message key 变化是本版本唯一明确的公开错误协议例外，具体以第 9 节为准。

## 7. 实施步骤

### Phase 1：内部模块改名

1. 将 `scope/registry.ex` 改为 `scope/query.ex`。
2. 将模块名 `Gate.Scope.Registry` 改为 `Gate.Scope.Query`。
3. 将 `Registry.compile/5` 改为 `Query.build/5`。
4. 更新 `Gate.Scope` 的 alias 和调用。
5. 将模块文档、调用链注释和相关源码注释中的 `Registry`、`compiler` 改为 `Query`、`query implementation`。

### Phase 2：行为与文档收口

1. 保留 `Gate.Scope.Policy` behavior 的 `scope/4`，不为命名重构引入新的抽象层。
2. 统一 Scope 实现和 behavior 文档，包含 `scope/policy.ex`、`scope/article.ex`、Community、Comment、Document 等模块，使用“resource Scope query implementation”或“资源 Scope 查询实现”，不再使用容易误导的“compiler”。
3. 更新 Gate V2、V3、V4 中仍作为当前实现描述的 `Scope.Registry` 和 `resource compiler` 表述；历史迁移记录可保留原称谓，但应标记为历史名称。
4. 更新测试名称和模块引用；测试行为而不是内部模块名。

### Phase 3：验证与清理

至少验证：

```text
mix compile --warnings-as-errors
mix test test/groupher_server/cms/gate/scope_test.exs
mix test test/groupher_server/cms/gate/scope/
```

并检查：

- 仓库内不再存在当前代码对 `Gate.Scope.Registry` 的引用；
- `Registry.compile` 不再出现在当前调用路径；
- `Helper.QueryBuilder` 未被误改名或挪动；
- SQL join、where、参数和 query count 行为没有变化；
- 业务调用方仍只使用 `CMS.Gate.scope/4`，不直接调用 `Scope.Query` 或资源 Scope 模块。
- 仓库内不再存在 `GroupherServer.CMS.Gate.RateLimit.ErrorCat` 的引用；
- `GroupherServer.ErrorCat.validate!/0` 或等价的应用启动校验通过。

## 8. Gate 命名空间 alias 规范

V5 同时收口 Gate 内部模块的 alias 写法。Gate 目录下的模块应先建立根命名空间 alias，再从 `Gate.*` 引用子模块，避免在每一行重复完整的 `GroupherServer.CMS.Gate...` 路径：

```elixir
alias GroupherServer.{Accounts, CMS}
alias Accounts.Model.User
alias CMS.Gate
alias Gate.Context.Scope.{Article, Comment, Community, Doc, Document}
alias Gate.ErrorCat
```

Query 分发模块不再为资源查询实现创建 `ArticleCompiler`、`CommentCompiler` 等带历史职责的别名；直接通过 Gate 命名空间调用：

```elixir
Gate.Scope.Article.scope(query, actor, action, context)
Gate.Scope.Comment.scope(query, actor, action, context)
Gate.Scope.Community.scope(query, actor, action, context)
Gate.Scope.Document.scope(query, actor, action, context)
```

这样可以同时避免两个问题：

- 完整模块路径重复出现在 alias 区域；
- `Gate.Context.Scope.Article` 与 `Gate.Scope.Article` 被强行改成 `Article` / `ArticleCompiler` 两套概念名。

Context 类型可以保留短 alias；查询实现通过 `Gate.Scope.*` 显式表达其所属边界。Gate 内部模块凡是同时使用多个顶层 context，都必须先使用 `alias GroupherServer.{Accounts, CMS}`，再使用 `Accounts.*`、`CMS.*` 和 `CMS.Gate`；只使用一个顶层 context 时也先 alias 该顶层 context。除非模块确实需要频繁调用某个子模块并且不存在命名冲突，否则不再引入 `as: XxxCompiler` 这类实现细节别名。

## 9. Gate ErrorCat 收口

`CMS.Gate` 作为一个 context 只保留一个错误目录：

```text
GroupherServer.CMS.Gate.ErrorCat
```

当前的 `GroupherServer.CMS.Gate.RateLimit.ErrorCat` 不构成独立的 context。RateLimit 是 Gate 的能力模块，publish throttle 的失败原因仍然属于 Gate 的 admission 错误，因此不需要额外的 ErrorCat 层级。

目标结构：

```text
CMS.Gate
├── ErrorCat
└── RateLimit
    └── Publish
```

Gate 的全局注册表按 namespace 分配错误码区间。当前 `{:cms, :gate}` 只能使用 `4600..4699`，而 `{:cms, :gate, :rate_limit}` 独占 `4200..4299`。因此不能在合并 namespace 后继续保留 `4201`、`4202`、`4203`；这会触发 `ErrorCat.Validator` 的 namespace range 校验。

本次采用“合并目录并迁移错误码”的方案：删除 `4200..4299` 的 RateLimit range，把以下错误定义移动到 `Gate.ErrorCat`，使用 Gate 区间内的空位：

```elixir
error(:throttle_interval, code: 4626)
error(:throttle_hour, code: 4627)
error(:throttle_day, code: 4628)
```

`RateLimit.Publish` 统一使用：

```elixir
alias GroupherServer.CMS.Gate.ErrorCat
```

并删除 `gate/rate_limit/error_cat.ex`。`RateLimit.Publish` 的检查逻辑和返回形状不变，但错误码从 `4201..4203` 迁移到 `4626..4628`。

同步更新 `GroupherServer.ErrorCat`：

```elixir
@ranges
# 删除 {:cms, :gate, :rate_limit} => 4200..4299

@catalogs
# 删除 GroupherServer.CMS.Gate.RateLimit.ErrorCat
```

同步更新所有调用方，包括：

```elixir
backend/main/lib/groupher_server/cms/gate/rate_limit/publish.ex
backend/main/lib/groupher_server_web/middleware/publish_throttle.ex
backend/main/test/groupher_server_web/mutation/cms/publish_throttle_test.exs
```

合并后 namespace 会从：

```elixir
{:cms, :gate, :rate_limit}
```

变为：

```elixir
{:cms, :gate}
```

默认 message key 也会从：

```text
cms.gate.rate_limit.throttle_interval
cms.gate.rate_limit.throttle_hour
cms.gate.rate_limit.throttle_day
```

变为：

```text
cms.gate.throttle_interval
cms.gate.throttle_hour
cms.gate.throttle_day
```

这是 V5 明确接受的 ErrorCat 合同迁移，不是隐式副作用。GraphQL `gq_format` 会把 numeric code 暴露给客户端，因此必须同时迁移所有依赖旧 namespace、旧 message key 或旧 numeric code `4201`、`4202`、`4203` 的客户端、错误映射、日志检索和测试。GraphQL middleware 当前按 reason 和 numeric code 处理错误，也必须更新它对 `Gate.ErrorCat` 的调用。

ErrorCat 合并前后都必须运行 `GroupherServer.ErrorCat.validate!/0`。否则 range owner、catalog owner、重复 namespace、错误码区间和 message key 前缀问题可能只在应用启动时暴露。

V5 的错误目录原则是：同一个 context 只保留一个 ErrorCat；只有真正拥有独立错误边界、namespace 或发布生命周期的 bounded context，才建立独立 ErrorCat。

## 10. 验收标准

V5 完成后应满足：

```text
CMS.Gate.scope/4
  → Gate.Scope.scope/4
  → Gate.Scope.Query.build/5
  → resource Scope.scope/4
  → Ecto.Query
```

命名能够直接表达以下事实：

- `Gate.Scope` 是公开的读取范围入口；
- `Scope.Query` 是内部查询构造与分发模块；
- `Query.build` 是构造动作，而不是语言编译动作；
- 资源 Scope 模块负责各自资源的查询边界；
- `Gate.ErrorCat` 是 CMS.Gate 唯一错误目录；
- 通用 `Helper.QueryBuilder` 与 Gate 资源可见性保持独立。

本次重构不得借机新增权限规则、改变 SQL 可见性、恢复 raw-map Context、增加隐式 actor 权限，或把 Scope 查询改成逐行 Repo 授权检查。
