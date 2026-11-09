# CMS Domain Outbox

> 状态：当前合同，已落地。
>
> 范围：承载 CMS 事务提交后必须可靠执行的副作用，包括公共缓存失效、Press 缓存失效、
> 搜索索引、通知、Webhook 和其他领域投递。

## 1. 结论

CMS Outbox 是 CMS 共享的内部持久化能力。领域业务通过自己的 `Effects` 登记 intent；`Jobs`
拥有 Oban Worker；`CMS.Outbox.Workflow` 负责认领、重试和投递状态。Outbox 不直接包含业务规则，
也不把 Worker 放在 `cms/outbox/` 内。

```text
CMS Command transaction
  -> Domain.Effects.enqueue(...)
       -> CMS.Outbox.send(event)
            -> insert Event
            -> insert Oban Job
  -> COMMIT

Jobs.CMSOutbox<Domain>.perform(job)
  -> CMS.deliver_outbox(domain, job)
       -> CMS.Outbox.Workflow.<Domain>.perform(job)
            -> CMS.Outbox.execute(event_id, &deliver/1)
                 -> claim / lease Event
                 -> reload canonical resources from stable IDs
                 -> execute the domain effect
                 -> done / retrying / failed
```

## 2. 目录与 owner

```text
lib/groupher_server/
|-- cms.ex                              # CMS 对外 Facade
|-- cms/
|   |-- outbox.ex                       # Outbox capability Facade
|   |-- outbox/
|   |   |-- event.ex                    # durable event schema
|   |   |-- persist.ex                  # event/lease/status persistence
|   |   `-- workflow/
|   |       |-- article.ex
|   |       |-- comment.ex
|   |       |-- community.ex
|   |       |-- interaction.ex
|   |       |-- asset.ex
|   |       `-- press.ex
|   `-- <domain>/effects.ex              # 业务 intent owner
`-- jobs/
    |-- cms_outbox_article.ex
    |-- cms_outbox_comment.ex
    |-- cms_outbox_community.ex
    |-- cms_outbox_interaction.ex
    |-- cms_outbox_asset.ex
    `-- cms_outbox_press.ex
```

职责边界：

- `<Domain>.Effects` 决定何时产生什么业务副作用，并在当前事务内调用 `CMS.Outbox.send/1`；
- `CMS.Outbox` 只维护 event、lease、attempt、retry 和最终状态；
- `Jobs.CMSOutbox*` 只做稳定入口转发，不访问 Repo 或 provider；
- `CMS.Outbox.Workflow.<Domain>` 按稳定 ID 重载当前资源并执行对应 effect；
- provider module 只负责具体外部调用，不拥有 Outbox 状态机。

## 3. 写入合同

Outbox Event 与领域事实必须在同一个数据库事务中写入：

```elixir
with {:ok, article} <- Persist.publish(...),
     {:ok, _event} <-
       CMS.Outbox.send(%{
         event: "article.published",
         contract_version: 1,
         worker: GroupherServer.Jobs.CMSOutboxArticle,
         resource_type: "article",
         resource_id: article.id,
         identity: {:command, command_id},
         effect_key: "publish",
         data: %{
           binding_id: binding.id,
           community: community.slug,
           thread: article.thread,
           inner_id: article.inner_id
         }
       }) do
  {:ok, article}
end
```

禁止在事务提交后再补写 Event：

```text
domain COMMIT
  -> callback
  -> insert Event in another transaction   # 禁止，进程崩溃会永久漏投递
```

持久化 payload 只允许 JSON-safe 的稳定 ID 和执行所需的最小、版本化业务事实，例如
`operation`、`changed_fields` 或缓存 scope。禁止持久化 module、function、匿名函数、Elixir struct、
Erlang term 或 `{module, function, args}` 动态调用合同。

## 4. 调用权限

业务代码不能任意调用 Outbox：

```text
允许：<Domain>.Effects -> CMS.Outbox.send
禁止：Commands / Query / Resolver -> CMS.Outbox.send

允许：CMS.Outbox.Workflow -> claim / complete / retry / mark_failed
禁止：普通 Effects / Commands / Worker -> 修改 delivery state
```

这一约束由 backend context v2 lint 检查。Outbox 是少数允许访问 Repo/transaction 的 Owner，但它只能
维护 Outbox 自身的 event、lease、attempt、retry 和 delivery 状态。

## 5. 执行合同

Worker 必须通过 CMS 根 Facade 进入，不得穿透到 Workflow：

```elixir
defmodule GroupherServer.Jobs.CMSOutboxPress do
  use Oban.Worker, queue: :cms_outbox

  @impl Oban.Worker
  def perform(job), do: GroupherServer.CMS.deliver_outbox(:press, job)
end
```

Workflow 负责：

1. 使用 event ID claim event；
2. 对活动 lease 返回 `{:snooze, seconds}`；
3. 从 `resource_id` 和 `data` 中的稳定 ID 重载 canonical resource；
4. missing/obsolete resource 按各业务明确的 no-op 或 error policy 处理；
5. provider 失败返回 `{:error, reason}`，使 Oban 重试；
6. 达到最大尝试次数后将 event 标为 `failed`；
7. 成功后将 event 标为 `done`，重复投递不再执行 effect。

不得把认证失败、网络失败或非 2xx 响应返回为成功。只有本地明确未配置可选服务时，才能按文档定义
返回 no-op；生产部署检查必须保证所需 endpoint、resource 和 scope 均已配置。

Cloudflare 返回 HTTP 429 且提供 `Retry-After` 时，adapter 保留秒数或 HTTP-date 指定的等待时间，加入
1–5 秒抖动；Outbox 在同一 lease fence 下记录错误并设置 `available_at`，释放锁，再让 Oban snooze。
没有可解析的 `Retry-After` 时继续走普通重试退避。Cloudflare 相关 Worker 新任务共用
`cloudflare_purge` 队列（每个 Oban 节点并发 2）；`public_cache` 队列保留为每节点并发 1，用于排空旧版本
已入队任务。`cms_outbox` 继续处理旧版 Comment 任务；排空期间这些旧任务仍可能调用 Cloudflare。
该并发限制是每节点配置，不是跨节点的 zone 全局限流器。

## 6. Public Cache 与 Press

Public Cache 和 Press 都是 Outbox 的下游能力，不拥有可靠投递状态机：

```text
Article/Comment/Community Effects
  -> CMS Outbox
  -> Jobs.CMSOutbox<Domain>
  -> Outbox.Workflow.<Domain>
  -> PublicCache root Facade
  -> tag calculation + Cloudflare provider

Press.Effects
  -> CMS Outbox
  -> Jobs.CMSOutboxPress
  -> Outbox.Workflow.Press
  -> Press.Invalidation
  -> authenticated Press endpoint
```

CMS 的当前写路径不再创建 `PublicCache.Invalidation`；它由 CMS Outbox Workflow 解析 tag 并调用
PublicCache 根 Facade。仓库仍保留一套没有生产领域调用方的 `PublicCache.Invalidation`、
`PublicCache.Workflow` 与 `Jobs.PublicCachePurge` 独立投递设施；这是待删除或重新确认使用方的遗留能力，
不能写成 CMS 当前主链路。`Helper.Later`、动态 callback 和旧模块名兼容入口已经退役。

## 7. 与 CMS.Command 的关系

```text
首次执行
  -> Command action
       -> domain writes
       -> Domain.Effects
            -> CMS.Outbox.send
  -> finalize Command Receipt
  -> COMMIT
  -> result reader

done replay
  -> skip action
  -> reuse committed result identity
  -> result reader
```

- Command Receipt 防止同一用户命令重复写入，并恢复 canonical result；
- Outbox Event 保证已提交命令产生的外部副作用最终执行；
- 两者可共享 `command_id/resource_type/resource_id`，但不能互相替代。

## 8. 测试合同

公共 Outbox suite 至少覆盖：

- 同一 event 重复投递只执行一次；
- effect 失败后进入 `retrying`，后续可恢复；
- 活动 lease 返回 busy/snooze，过期 lease 可重新认领；
- 同一 identity/effect scope 唯一；
- 领域事务回滚时 Event 与 Job 一起回滚；
- 达到最大尝试次数后标记 `failed`。

每个领域流程还必须覆盖自己的失败注入矩阵：资源缺失、payload version 不支持、认证失败、
provider 网络失败、非成功响应和正常成功。不能只依赖公共状态机 happy-path 测试。

## 9. 门禁

`pnpm check:backend-context-v2` 检查：

- Outbox 写入只能来自 Effects；
- delivery state 只能由 Outbox Workflow 修改；
- Worker 必须位于 `jobs/`，且不能直接访问 Repo/provider；
- Job payload 不得持久化不稳定的执行细节；
- 外部 caller 不得穿透 CMS internal capability。

运行级正确性仍由 ExUnit integration tests 负责；lint 不能证明 provider 失败一定返回错误，也不能证明
部署环境已经配置 endpoint、resource 和 scope。
