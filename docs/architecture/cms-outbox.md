# CMS Domain Outbox

> 状态：目标架构。
>
> 范围：统一承载 CMS 领域事务提交后必须可靠执行的 effect，包括 Public Cache cleanup、
> Search reindex、Notification 和 Webhook。当前实现是迁移输入，不代表本文目标已落地。

## 1. 结论

Public Cache invalidation 是一种 Outbox Event。理想架构将可靠执行协议收口到
`GroupherServer.CMS.Outbox`，但不建立 Dispatcher、Registry、通用 Handler 或额外的
Store/Policy/Health/Telemetry 层。

```text
CMS domain transaction
  -> CMS.Outbox.send(event)
       -> insert Event
       -> insert Oban Job
  -> COMMIT

CMS.Outbox.Workers.<Domain>.<Task>.perform(job)
  -> CMS.Outbox.execute(event_id, &domain_action/1)
       -> claim Event
       -> action
       -> complete / retry / fail
```

每个 Worker 自己表达任务语义；Outbox 只统一 Event 的写入、认领、重试和完成状态。

## 2. 模块与目录

```text
GroupherServer.CMS.Outbox
|-- Event
|-- send/1
|-- execute/2
`-- Workers
    |-- Article
    |   |-- Cleanup
    |   |-- Reindex
    |   `-- Notification
    |-- Comment
    |   `-- Cleanup
    `-- ...
```

对应目录：

```text
lib/groupher_server/cms/outbox/
|-- event.ex
|-- workers/
|   |-- article/
|   |   |-- cleanup.ex
|   |   |-- reindex.ex
|   |   `-- notification.ex
|   `-- comment/
|       `-- cleanup.ex
`-- outbox.ex
```

一类领域任务一个 Worker，而不是一个 event 一个文件。Article 后续增加多种事件时，
`Article.Cleanup` 仍可以通过模式匹配处理同一任务族：

```elixir
defp cleanup(%Event{event: "article.published"} = event), do: ...
defp cleanup(%Event{event: "article.updated"} = event), do: ...
defp cleanup(%Event{event: "article.trashed"} = event), do: ...
```

不建立中央 event-to-module 映射；Oban Job 创建时已经选择具体 Worker。

## 3. Event 模型

```text
cms.outbox_events
  id                 UUID
  event              stable text, e.g. article.published
  contract_version   positive integer
  resource_type      stable text, e.g. article
  resource_id        stable text
  identity_type      command | workflow
  command_id         text (legacy column name; UUID for command, durable ref for workflow)
  effect_key         text
  data               bounded JSON map
  status             pending | executing | completed | failed
  attempts           non-negative integer
  available_at       UTC datetime
  locked_at          UTC datetime
  locked_by          lease token
  completed_at       UTC datetime
  last_error_code    stable safe code
  last_error_at      UTC datetime
  inserted_at        UTC datetime
  updated_at         UTC datetime
```

命名规则：

- Command Receipt 使用客户端 `command_id`；Outbox 使用 typed `identity`，物理 `command_id` 列仅为兼容旧表名。
- `identity: {:command, id}` 表示用户业务命令；`identity: {:workflow, ref}` 表示维护、上传或批处理 workflow。
- `effect_key` 区分同一 identity 对多个 scope/resource 产生的独立 effect，不能通过生成第二个 command UUID 绕过唯一键。
- 不使用 `target_type/target_key`、`aggregate_type/aggregate_id` 或 `causation_id`。
- `data` 只保存消费所需的最小、版本化事实，不保存完整 Article 或用户私密快照。
- Event 是可靠执行记录，不是长期 Audit/Activity。

同一 Command 可发送多个独立 Event：

```text
article.publish
  |-- article.cleanup
  |-- article.reindex
  |-- article.notification
  `-- article.webhook
```

它们分别重试，避免一次通知失败迫使缓存清理和索引更新重复执行。

## 4. 写入：`CMS.Outbox.send/1`

领域 Command 的 `action` 在当前事务内写入领域事实和 Event：

```elixir
with {:ok, revision} <- Revision.Writer.insert(article, draft),
     {:ok, article} <- Articles.move_live_revision(article, revision),
     {:ok, _event} <-
       CMS.Outbox.send(%{
         event: "article.published",
         contract_version: 1,
         worker: CMS.Outbox.Workers.Article.Cleanup,
         resource_type: "article",
         resource_id: article.id,
         identity: {:command, command_id},
         effect_key: "article:#{article.id}:published",
         data: %{revision_id: revision.id}
       }) do
  {:ok, {:article, article.id}}
end
```

`send/1` 同时插入 Event 和对应 Oban Job，并复用当前数据库事务。它不自行开启第二个事务。
所有 Groupher 内部 API 统一返回：

```elixir
{:ok, value}
{:error, reason}
```

禁止：

```text
domain COMMIT
  -> callback
  -> insert Event in another transaction
```

否则进程可能在两次事务之间崩溃并永久漏掉 effect。

## 5. 执行：`CMS.Outbox.execute/2`

每个具体 Worker 直接 `use Oban.Worker`：

```elixir
defmodule GroupherServer.CMS.Outbox.Workers.Article.Cleanup do
  use Oban.Worker, queue: :cms_outbox

  alias GroupherServer.CMS.Outbox

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id}}) do
    case Outbox.execute(event_id, &cleanup/1) do
      {:ok, _event} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp cleanup(event) do
    with {:ok, tags} <- PublicCache.Scope.tags(event),
         {:ok, response} <- PublicCache.Cloudflare.cleanup(tags) do
      {:ok, response}
    end
  end
end
```

`perform/1` 是 Oban 要求的适配器名称；项目内部仍使用统一的 `execute`。Worker 内部函数使用
真实业务动词，例如 `cleanup`、`reindex`、`notify`，不统一伪装成 `handle`。

`CMS.Outbox.execute/2` 负责：

```text
load Event
  -> completed: return stored completion
  -> executing + valid lease: ask Oban to retry later
  -> pending / expired lease:
       claim
       run action
       complete, or record failure and retry
```

幂等性不写进函数名。它是 `CMS.Outbox.execute/2` 的固定合同，由 Event status、lease 和
Worker 的 provider contract 共同保证。

## 6. Public Cache 的位置

`GroupherServer.PublicCache` 是缓存能力，不是 Outbox 基础设施：

```text
GroupherServer.PublicCache
|-- Scope / Tags
`-- Cloudflare

GroupherServer.CMS.Outbox.Workers.Article.Cleanup
  -> PublicCache.Scope
  -> PublicCache.Cloudflare
```

因此现有 `PublicCache.PurgeWorker` 的目标不是变成全局 `PublicCache.Cleanup`，而是按领域和
任务迁移到 `CMS.Outbox.Workers.<Domain>.Cleanup`。Public Cache 不拥有 Event 状态机，
但仍拥有 tag 计算和 provider 调用。

## 7. 与 `CMS.Command` 的关系

```elixir
CMS.Command.execute(command,
  action: fn context ->
    # 仅首次执行；同一事务写领域事实与 Outbox Event
    publish(context)
  end,
  result: fn receipt ->
    # 首次提交和 completed retry 都执行
    CMS.FrontDesk.article(receipt.result_key, mode: :internal)
  end
)
```

`action` 不直接请求 Cloudflare、搜索服务、通知服务或 Webhook。它只在事务内调用
`CMS.Outbox.send/1` 登记必须发生的 effect intent；真正的外部 effect 由 Worker 在 commit
后执行。

```text
first execution
  -> action
       -> domain writes
       -> CMS.Outbox.send
  -> finalize Command Receipt
  -> COMMIT
  -> result

completed retry
  -> skip action
  -> reuse committed result identity
  -> result
```

Command Receipt 与 Outbox Event 都使用 `resource_type/resource_id/command_id`，但职责不同：

- Command Receipt 防止同一用户命令重复写入，并恢复 canonical result。
- Outbox Event 保证提交后的外部 effect 最终执行。

## 8. 迁移方向

1. Command Receipt 将 `target_type/target_key` 重命名为
   `resource_type/resource_id`，并与 Outbox 对齐。
2. 建立 `CMS.Outbox.Event`、`CMS.Outbox.send/1` 和 `CMS.Outbox.execute/2`。
3. 先把现有 Public Cache invalidation 迁移为
   `CMS.Outbox.Workers.<Domain>.Cleanup`。
4. 再迁移 Search、Notification 和 Webhook；每项保持独立 Event 和独立重试。
5. 删除公共 `after_commit` callback；非可靠 Telemetry 保留在基础设施内部。

迁移期间，当前 `PublicCache.Invalidation` 与 `PurgeWorker` 仍是已实现路径；本文描述的是最终
所有权与命名，不应误写为当前状态。
