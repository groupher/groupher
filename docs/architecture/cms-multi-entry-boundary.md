# CMS 多入口与领域用例边界

> 状态：目标架构。
>
> 范围：GraphQL、未来 CLI、MCP 与 Plugin 如何复用同一 CMS 领域 API；本文不要求当前立即实现
> CLI、MCP 或 Plugin runtime，也不定义具体产品的 tool/command 清单。
>
> Source of truth：`CMS.Command` 的幂等、Receipt 和事务合同以
> [`cms-command.md`](./cms-command.md) 为准；资源加载以
> [`resource-loading-boundary.md`](./resource-loading-boundary.md) 为准；Gate/Lifecycle 规则以对应
> 领域文档为准；可靠 effect 统一遵循 [`cms-outbox.md`](./cms-outbox.md)。

## 1. 结论

多入口不增加一个万能 `DomainCommand` framework。目标结构是：

```text
GraphQL Resolver ----\
CLI Command ----------\
MCP Tool --------------> CMS public facade -> concrete use case -> domain internals
Plugin Capability ----/                              |
                                                     `-> CMS.Command when required
```

各层职责：

```text
Adapter
  认证上下文和协议参数 -> 来源无关的领域参数

CMS facade
  对所有入口提供唯一、稳定的公共领域 API

Concrete use case / Domain Command
  一个完整业务动作的 Gate、Lifecycle、version 与写入编排

CMS.Command
  需要抵抗 ambiguous commit 时，提供首次执行/已完成重试、Receipt 和事务边界

Store / Writer / Target
  仅供领域内部组合的持久化 primitive
```

## 2. 当前基线与非目标

当前已经存在：

```text
GraphQL
  -> CMS Resolver
  -> CMS.Articles / CMS.Docs / CMS.DocTree facade
  -> Commands.*
  -> Gate / Lifecycle / Draft / Revision
  -> CMS.Command（部分需要幂等恢复的写入）
```

当前尚不存在本文所描述的正式 CMS CLI、MCP write tools 和第三方 Plugin capability runtime。
本文冻结未来接入方式，避免它们出现后复制 Resolver 或直接调用 Repo/Store。

本文不做：

- 全局 Command Bus。
- `DomainCommand.run(type, action, attrs)` 万能 dispatcher。
- 把所有 CRUD 强制放入 `CMS.Command`。
- 把技术 primitive 暴露给 AI、CLI 或插件自由编排。
- 让 Adapter 自己决定 Gate/Lifecycle/Revision 顺序。

## 3. 为什么不是“再抽一个通用层”

Domain Command 是一组具体业务用例：

```text
Articles.UpdateDraft
Articles.Publish
Articles.UpdateAndPublish
Articles.DiscardDraft
Assets.ReplaceUse
ContentImport.ApplyPlan
Survey.SubmitResponse
```

每个用例有不同的不变量。通用化它们只会退化成可选字段和运行时 dispatcher。

真正共享的是执行协议：

```text
actor
commandId
command identity
target/input fingerprint
first execution
completed retry
committed result identity
post-commit effects
```

这部分由 `CMS.Command` 负责。

## 4. Public facade 与 concrete use case

以普通 Article 为例，公共 facade 明确业务动作：

```elixir
defmodule CMS.Articles do
  def update_draft(article, attrs, actor, opts),
    do: Commands.UpdateDraft.execute(article, attrs, actor, opts)

  def publish(article, actor, opts),
    do: Commands.Publish.execute(article, actor, opts)

  def update_and_publish(article, attrs, actor, opts),
    do: Commands.UpdateAndPublish.execute(article, attrs, actor, opts)

  def discard_draft(article, actor, opts),
    do: Commands.DiscardDraft.execute(article, actor, opts)
end
```

命名规则：

- facade 使用产品动作：`update_draft`、`publish`。
- use case module 使用动作名并统一 `execute`：`UpdateDraft.execute`、`Publish.execute`。
- Store/Writer 使用持久化动作：`Draft.Store.update`、`Revision.Writer.insert`。
- 不使用重复且隐藏副作用的 `Commands.Update.update`。

外部入口只能调用 facade，不能直接调用 `Commands.*`、`Store`、`Writer`、`Target` 或 `Repo`。

## 5. 业务原子性，而不是技术原子性

外部可调用的原子动作必须是完整业务承诺：

```text
UpdateDraft
  修改 mutable Draft，不影响线上 Revision

Publish
  将当前 Draft 固化成 Revision 并切换 live pointer

UpdateAndPublish
  在一个事务性用户意图内更新 Draft 并发布

DiscardDraft
  放弃未发布变更，保留全部历史 Revision
```

以下只是内部 primitive，不能成为多入口公共 API：

```text
ensure_draft
write_body
sync_asset_refs
insert_revision
move_live_pointer
update_lifecycle
write_activity
```

否则不同入口会各自决定调用顺序：

```text
GraphQL: write_body -> sync_refs -> insert_revision
MCP:     write_body -> insert_revision -> 忘记 sync_refs
Plugin:  直接 move_live_pointer
```

业务用例必须在一个位置固定顺序和事务边界。

## 6. `CMS.Command` 是 action/result 分支，不是 callback 流水线

`action/result/after_commit` 作为平铺参数容易被误读成顺序执行：

```text
execute -> load_result -> after_commit
```

实际语义是：

```text
                         Receipt.claim
                              |
              +---------------+----------------+
              |                                |
              v                                v
       FIRST_EXECUTION                  COMPLETED_RETRY
       action                           skip action
       finalize result ref              reuse result ref
              |                                |
              +---------------+----------------+
                              |
                              v
                         COMMIT / READ
                              |
                           result
                              |
                              v
                       same result shape
```

目标 API 只暴露两个短而明确的动作：

```elixir
CMS.Command.execute(command,
  action: fn context ->
    # 首次请求才执行；完整领域用例 + transactional outbox
    {:ok, context.target, %{result_key: context.target.id}}
  end,
  result: fn receipt ->
    # 首次和已完成重试都执行
    CMS.Articles.Reader.article(receipt.result_key)
  end
)
```

它们不是顺序流水线；`Receipt.claim` 决定是否进入 `action`，两条分支最后统一进入 `result`：

| Callback | 首次执行 | 已完成重试 | 职责                                                  |
| -------- | -------- | ---------- | ----------------------------------------------------- |
| `action` | 是       | 否         | 执行完整领域用例并写 Outbox，返回稳定 result identity |
| `result` | 是       | 是         | 根据 result identity 构造相同公共结果                 |

`result` 不是 recovery/补偿，也不是第二次执行业务。它只是把已经提交的 result identity 解析为
调用方结果。

不在公共 API 中保留第三个 `after_commit` callback。必须送达的搜索、通知、Webhook、缓存失效等
effect，由 `action` 在同一事务中写入 Outbox，提交后由 worker 消费；非关键 Telemetry 由
`CMS.Command` 基础设施自己发出，不要求每个领域 Command 再提供 callback。

这里的 Outbox 是统一的 `GroupherServer.CMS.Outbox`。Public Cache invalidation、Search reindex、
Notification 和 Webhook 都写入统一 Event，由 `CMS.Outbox.Workers.<Domain>.<Task>` 执行。

这里不是把真正的 `after_commit` 工作移进数据库事务。`action` 只登记可靠的 effect intent，实际
外部工作仍然在 commit 后执行：

```text
action transaction
  -> write Revision / live pointer / Lifecycle
  -> insert OutboxEvent(article_published)
  -> finalize Receipt
  -> COMMIT

Outbox worker after commit
  -> update search index
  -> purge CDN cache
  -> send notification
  -> call Webhook
  -> mark OutboxEvent completed
```

禁止在 `action` 事务中直接发送通知、HTTP Webhook 或调用外部搜索服务。否则外部动作可能已经成功，
数据库事务却随后回滚；同时外部延迟会不必要地占用数据库事务和锁。

两种失败都必须安全：

```text
transaction rollback
  -> domain write 与 OutboxEvent 一起不存在
  -> 外部 effect 不会发生

commit 后进程崩溃
  -> OutboxEvent 已持久化为 pending
  -> worker 稍后继续处理
```

因此准确表述是：

```text
action 负责提交“领域事实 + 必须发生的 effect intent”
worker 负责在 commit 后执行真正 effect
```

### 6.1 目标内部算法

```elixir
transaction_outcome =
  Repo.transaction(fn ->
    case Receipt.claim(identity) do
      {:new, receipt} ->
        with {:ok, result_identity} <- action.(context),
             {:ok, _receipt} <- Receipt.finalize(receipt, result_identity) do
          {:first_execution, result_identity}
        end

      {:completed, receipt} ->
        {:completed_retry, receipt.result_identity}

      {:conflict, reason} ->
        Repo.rollback(reason)
    end
  end)

case transaction_outcome do
  {:first_execution, result_identity} ->
    result.(result_identity)

  {:completed_retry, result_identity} ->
    result.(result_identity)
end
```

关键不变量：

- 相同 actor + commandId + fingerprint 只执行一次 `action`。
- 相同 commandId、不同 fingerprint 返回 identity conflict。
- 首次和重试都经过同一 `result`，避免返回形状漂移。
- 已完成重试跳过 `action`，因此不会重复写领域事实或 Outbox event。
- 必须送达的 effect 与业务写入一起写 transactional outbox。

无法从当前状态精确重建的 DocTree 等结果，可以让 result identity 指向 Receipt 内最小、版本化、
JSON-safe payload，由 owner codec 实现 `result`；不能因此保存整个敏感资源快照。

## 7. Adapter contract

Adapter 负责：

```text
protocol authentication/session
  -> actor or delegated actor
protocol input
  -> typed domain arguments
domain result/error
  -> protocol response/error
```

Adapter 不负责：

```text
Gate decision
Lifecycle transition
Draft/Revision order
transaction boundary
Receipt claim
domain effect selection
```

### 7.1 GraphQL

```elixir
def update_article_draft(_root, args, %{context: %{cur_user: actor}}) do
  CMS.Articles.update_draft(
    args.article,
    Map.take(args, [:title, :subtitle, :body_bag]),
    actor,
    expected_draft_version: args.expected_draft_version,
    command_id: args.command_id
  )
end
```

GraphQL 负责 Absinthe input/context/error 映射，不拥有业务流程。

### 7.2 CLI

```text
argv
  -> option parser
  -> authenticated actor
  -> CMS.Articles.update_draft(...)
  -> domain result to stdout/exit code
```

CLI 必须支持稳定 `--json`、错误码和显式 `--command-id`/自动生成策略；它不能直接执行 Mix task 内的
Repo update。

### 7.3 MCP

```text
tool arguments
  -> schema validation / confirmation
  -> session actor
  -> CMS.Articles.update_draft(...)
  -> domain result to tool result
```

MCP 是面向模型发现和调用的 API adapter，不是第二套领域服务。Tool 应暴露
`update_article_draft`、`publish_article` 等窄领域动作，避免通用 `update_record(fields)`。

### 7.4 Plugin

```text
plugin request/hook
  -> installation + capability check
  -> delegated actor and bounded attrs
  -> CMS facade
  -> domain result to sandbox-safe result
```

Capability 只允许插件表达某个业务动作，例如 `article.block.attach:survey`；插件不能得到 Repo、Store 或
任意 Article attrs 写入能力。

## 8. 一个动作的四入口对照

以 `CMS.Articles.publish/3` 为例：

| 入口    | 输入适配                            | 身份                               | 结果适配                |
| ------- | ----------------------------------- | ---------------------------------- | ----------------------- |
| GraphQL | `ArticlePathInput` + camelCase args | GraphQL context user               | Absinthe DTO/error      |
| CLI     | argv/options                        | CLI credential user/service policy | JSON/stdout + exit code |
| MCP     | tool JSON schema                    | MCP session user                   | tool content/error      |
| Plugin  | sandbox request + capability scope  | delegated user                     | capability-safe DTO     |

进入 facade 后四条路径完全相同：

```text
CMS.Articles.publish
  -> Commands.Publish.execute
  -> Gate publish
  -> lock Article/Draft/Lifecycle
  -> expected versions
  -> CMS.Command first/retry branch
  -> Revision + refs + live pointer
  -> canonical result
```

## 9. 错误边界

领域层返回稳定领域错误：

```text
permission_denied
article_not_found
draft_version_conflict
lifecycle_version_conflict
command_identity_conflict
command_resolution_pending
```

Adapter 分别映射：

```text
GraphQL -> ErrorCat / extensions
CLI     -> stderr JSON + exit code
MCP     -> structured tool error
Plugin  -> sandbox-safe error
```

禁止在领域 Command 中返回 `Plug.Conn`、HTTP status、Absinthe resolution、MCP content block 或 CLI exit
code。

## 10. 模块目标

```text
backend/api/lib/groupher_server/cms/
|-- articles.ex                         # public facade
|-- articles/
|   |-- commands/
|   |   |-- update_draft.ex            # UpdateDraft.execute
|   |   |-- publish.ex                 # Publish.execute
|   |   |-- update_and_publish.ex      # UpdateAndPublish.execute
|   |   `-- discard_draft.ex           # DiscardDraft.execute
|   |-- draft/store.ex                 # internal primitive
|   `-- publish/target.ex               # internal primitive
|-- command.ex                          # first/retry execution boundary
`-- command_receipt/                    # internal receipt implementation
```

未来 adapter 放在各自 transport/application 边界，不进入 `CMS.Articles.Commands`：

```text
GraphQL resolver       backend/api/.../resolvers
CLI adapter            独立 CLI application/boundary
MCP adapter            MCP server/application boundary
Plugin adapter         plugin runtime boundary
```

## 11. 分阶段实施

### Phase 0：命名与现状审计

- 把 `Commands.Update.update` 识别为 `UpdateAndPublish.execute` 语义。
- 逐 mutation 分类：纯 adapter、DTO hydration、业务编排。
- 不为尚不存在的 CLI/MCP/Plugin 提前创建空 adapter。

### Phase 1：Article 用例收口

- facade 明确 `update_draft`、`publish`、`update_and_publish`、`discard_draft`。
- Commands 统一 `execute`。
- transport 不直接调用 Store/Writer/Target。

### Phase 2：Command 分支 API

- `action` 只由 Receipt 的 new 分支调用，并返回 result identity。
- `recovery` 收口为 `result`；首次/重试都通过 result identity 调用。
- 删除面向领域调用方的 `after_commit` callback；重要 effect 转 transactional outbox。
- 首次/重试统一通过 result identity 与同一个 `result` 返回。

### Phase 3：第二入口验证

- 只在有真实产品需求时选择 CLI 或 MCP 的一个窄动作作为第二入口。
- 验证它只增加 adapter，未复制 Gate/Lifecycle/Writer。
- 再根据真实需求扩展 tool/command catalog。

### Phase 4：Plugin capability

- 先定义 installation/capability/delegated actor。
- 插件只调用已经稳定的 facade use case。
- 只有真实插件需求出现时新增插件专属领域动作。

## 12. 验收标准

- 同一业务动作从不同入口进入同一个 facade 函数。
- Resolver/MCP/CLI/Plugin adapter 不直接调用 Repo、Store、Writer 或 Target。
- facade API 不接受 transport-specific 类型。
- 每个 `Commands.*` 表达具体业务用例并使用 `execute`，不出现万能 dispatcher。
- Public action 按业务原子性设计，不暴露技术 primitive 给外部组合。
- `CMS.Command` API 从命名上明确首次执行与已完成重试分支。
- 相同 commandId/fingerprint 的重试跳过领域写入和 effect，但返回同形状结果。
- 不同 fingerprint 复用 commandId 返回 conflict。
- CLI/MCP/Plugin 未实现前，不增加虚构模块或未使用 abstraction。
