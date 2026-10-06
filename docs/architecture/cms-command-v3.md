# CMS Command V3：Confirmation 与结果投影边界

> 状态：已实施（2026-10-04）。本文冻结 `CMS.Command` V3 的当前边界与迁移验收结果。
> 当前 runtime 已删除 `present/2`、action result 三元组与领域层 `executed/recovered` 分支。
>
> 版本关系：本文取代 [CMS Command](./cms-command.md) 中 presenter、action result 和结果投影的相关合同，
> 并修订 [CMS Command Confirmation](./cms-command-confirmation.md) 中 optional presenter 与 action seed
> 的现行说明。Receipt identity、IntentCodec、retention、Outbox 和 Confirmation codec 合同保持不变，
> 除非本文明确修订。

相关文档：

- [CMS Command](./cms-command.md)：当前 Command、Receipt 与领域写入边界；
- [CMS Command Confirmation](./cms-command-confirmation.md)：当前 Confirmation codec、Receipt JSON 与 retention 合同；
- [CMS Domain Outbox](./cms-outbox.md)：事务内 effect intent 与提交后消费；
- [FrontDesk V2](../feature/front-desk/v2.md)：顶层资源 canonical read 与 internal view；
- [CMS Query V2](./cms-query-v2.md)：Query、Store/Facts 与 Projection 所有权。

## 1. 问题

当前 `CMS.Command.execute/2` 的生产调用形状是：

```elixir
Command.execute(command,
  action: &publish_action/1,
  confirmation: PublishConfirmation,
  present: &present_command_result/2
)
```

`present/2` 允许首次执行复用 `action_context` 中已经加载的资源，恢复分支则从
Confirmation 的 immutable anchor 重建结果。该优化减少了首次执行后的部分重复读取，
但也产生了以下长期问题：

1. 一个 Command 被拆成 command data、action、confirmation、presenter 四部分；
2. 通用 Runner 需要携带 `action_context`，并向领域 presenter 暴露 `:executed | :recovered`；
3. 首次执行与恢复虽然返回相同外部形状，内部却走不同结果构造路径；
4. presenter 在 Receipt transaction 内运行，结果投影查询会延长写事务和锁持有时间；
5. projection failure 会参与领域写入回滚，使“命令是否提交”和“响应是否成功构造”继续耦合；
6. 架构文档同时声称生产 API 只有 `action/confirmation`，又定义了 `present/2`，目标合同不唯一。

V3 不以隐藏或重命名 presenter 为目标，而是删除 Command 基础设施中的结果投影职责。

## 2. 决策摘要

V3 冻结以下规则：

1. `%CMS.Command{}` 保持现有 identity data 形状，不新增 `%Command.Request{}` 包装层或通用领域构造器。
2. `CMS.Command.execute/2` 的公开执行选项只包含 `action/1` 与 `confirmation: Module`。
3. `action/1` 的成功结果只允许 `{:ok, %Confirmation{}}`；不再接受三元组和 `action_context`。
4. `CMS.Command.execute/2` 在首次执行和 Receipt 恢复时都返回同一种 typed Confirmation。
5. Command transaction 只包含 claim、领域 action、Confirmation encode 和 Receipt finalize。
6. canonical result builder 在 Command transaction 提交后，由领域 Command owner 显式调用。
7. Runner 不接受或调用 `present/2`，也不向领域代码暴露 `:executed | :recovered`。
8. GraphQL、transport 和产品代码仍只接收原有 canonical business result，不接触 Confirmation。
9. result builder 必须以 Confirmation 的 immutable revision/draft/branch anchor 为根，不能读取当前最新 head 代替命令结果。
10. 必须与领域写入原子提交的 Audit、Activity 和外部 effect intent 继续留在 action/Outbox，不得移入 result builder。
11. projection failure 不撤销已经提交的领域事实；retry/reconcile 严格遵守 §5.3 错误矩阵，任何后续处理都不得再次执行 action。
12. V3 直接切换，不保留 presenter overload、action-context compatibility 或双执行协议。
13. Article revision result 只保留 `RevisionResult.build/2`；删除 `build/1` 与 `build_from_action/4`。
14. 同一公开领域用例无论是否携带 `commandId`，都必须进入同一个 canonical result builder，或由字段级测试证明结果完全同形。
15. V3 不修改 `PublishConfirmation` payload；Article Publish 必须把已加载 Community 传给 result builder。

## 3. 目标 API

### 3.1 Command identity

领域 Command 继续显式构造当前 struct：

```elixir
command = %Command{
  actor: user,
  command_id: Keyword.get(opts, :command_id),
  operation: :article_publish,
  target: article,
  params: opts |> Keyword.delete(:command_id) |> Map.new()
}
```

该 struct 只描述稳定命令身份：谁、哪次意图、什么操作、哪个 target、哪些业务参数。
它不持有函数、codec、projection 或 transport response。

V3 不把它重命名为 `%Command.Request{}`。仅改变名字不会减少概念或字段，反而增加调用层级。

### 3.2 Execute

```elixir
Command.execute(command,
  action: &publish_action/1,
  confirmation: PublishConfirmation
)
```

目标类型合同：

```elixir
@type action_result(confirmation) ::
        {:ok, confirmation}
        | {:error, term()}

@spec execute(t(),
        action: (map() -> action_result(struct())),
        confirmation: module()
      ) :: {:ok, struct()} | {:error, term()}
```

`confirmation` module 仍负责：

- 声明支持的 operation；
- 将 typed Confirmation 编码为严格、JSON-safe、版本化 payload；
- 从 Receipt payload fail-closed decode typed Confirmation；
- 提供 N/N-1 decoder 兼容窗口。

它不负责加载产品资源或组装 transport result。

### 3.3 Domain result builder

领域公开入口在 `Command.execute/2` 返回后显式构造 canonical result：

```elixir
def publish(%Article{} = article, %User{} = user, opts) do
  with {:ok, %Community{} = community} <-
         FrontDesk.community(article.community_id, mode: :internal),
       command = %Command{
         actor: user,
         command_id: Keyword.get(opts, :command_id),
         operation: :article_publish,
         target: article,
         params: opts |> Keyword.delete(:command_id) |> Map.new()
       },
       {:ok, %PublishConfirmation{} = confirmation} <-
         Command.execute(command,
           action: &publish_action/1,
           confirmation: PublishConfirmation
         ) do
    RevisionResult.build(confirmation, community)
  end
end
```

`RevisionResult.build/2` 在这里表达一个明确的领域动作：根据发布 Confirmation 构造对应 revision 的
Article result。它不是 Command 生命周期 callback，也不是 UI presenter。

Article Create、Update、Publish 都必须调用该 `build/2`。V3 删除当前恢复路径的 `build/1` 与首次路径的
`build_from_action/4`，不保留内部 fallback overload。

领域 owner 可以使用 `Result`、`Projection` 或更具体的已有模块名，但不得重新引入一个由 Runner 调用的
通用 presenter behaviour。

## 4. 执行与事务边界

```text
GraphQL / CMS facade
  -> domain Command
       -> build %CMS.Command{}
       -> CMS.Command.execute(command, action + confirmation)
            -> BEGIN
            -> Receipt.claim
                 -> new: execute action
                      -> Gate / canonical lock / version / Lifecycle
                      -> domain writes + Audit + Outbox intent
                      -> typed Confirmation
                 -> completed retry: decode saved Confirmation
            -> new: Confirmation.encode + Receipt.finalize
            -> COMMIT
            -> return the same typed Confirmation from both branches
       -> domain Result.build(confirmation, loaded context)
            -> immutable-anchor reads
            -> canonical business result
       -> return unchanged public result shape
```

事务边界必须满足：

- claim、首次 action、Confirmation encode 和 Receipt finalize 同事务提交或回滚；
- result builder 不在 Receipt transaction 中运行；
- result builder 失败不能回滚已经提交的 Article、Comment、Audit、Receipt 或 Outbox intent；
- completed retry 只 decode Confirmation，不调用 action；
- `executed/recovered` 可以新增为 Runner 内部 Telemetry metadata，但不能影响领域返回路径；
- completed retry 的 conflict resolution 会短暂对 Receipt 行执行 `FOR UPDATE`；Command 返回前必须提交
  recovery claim transaction 并释放该行锁，result builder 不得在持锁期间运行。

## 5. 首次执行、恢复与错误语义

### 5.1 首次执行

```text
claim new
  -> action returns Confirmation
  -> encode + finalize
  -> commit
  -> Result.build
```

Result 构造成功时，领域入口返回原有 `{:ok, canonical_result}`。

### 5.2 已完成重试

```text
claim recovery
  -> SELECT Receipt FOR UPDATE
  -> decode saved Confirmation
  -> commit recovery claim transaction and release the Receipt row lock
  -> the same Result.build
```

恢复与首次执行不再仅仅“返回类型相同”，而是实际共用同一条结果构造路径。
当前 presenter 在同一 transaction 内运行，使相同 `commandId` 的并发恢复请求在完整 projection 查询期间
串行等待 Receipt 行锁。V3 必须在 decode 后立即提交；projection 的耗时和失败不能延长该锁的持有时间。

### 5.3 提交后结果构造失败

领域写入已经提交、但 result builder 失败时，错误归一化由领域 result builder 或领域入口负责；
`CMS.Command.normalize_command_result/1` 不再覆盖该阶段。V3 使用以下错误合同：

| 场景                                                  | 目标错误                      | retryable/actions                                  |
| ----------------------------------------------------- | ----------------------------- | -------------------------------------------------- |
| immutable Article/Revision/Body anchor 缺失或无法重建 | `command_result_unavailable`  | `retryable: false`、`actions: [:reconcile]`        |
| 已知的暂时性派生 projection 未就绪                    | 领域 `projection_not_updated` | `retryable: true`、`actions: [:retry, :reconcile]` |
| transport/连接在结果交付阶段失败                      | 保留 transport 错误           | transport 层以原 `commandId` 有界重试              |
| 未预期异常                                            | 保留异常语义并记录 telemetry  | 不伪装成领域成功或任意已知错误                     |

因此：

1. 三个 Article Command 的 builder failure 必须按上表归一，不得各自选择不同错误码；
2. 不删除或回滚 finalized Receipt；
3. 可重试错误或 transport failure 必须保留原 `commandId`，再次 decode 同一 Confirmation 并运行 result builder；
4. `command_result_unavailable` 进入 reconcile，不自动生成重试风暴；
5. 禁止自动生成新 `commandId` 重放领域写入。

该语义不是 partial commit 漏洞，而是 Command Receipt 处理“写入已提交、响应未能交付”的核心能力。
实施时必须同步更新 ErrorCat metadata、GraphQL error extensions 与前端 retry/reconcile 指引；当前
`command_result_unavailable` 尚未声明 `actions: [:reconcile]`，领域 `projection_not_updated` 也尚未统一
声明 `actions: [:retry, :reconcile]`，不能把本文目标误写成现状。ErrorCat 的 `actions` metadata 与
GraphQL extensions 传递机制已经存在，`command_resolution_pending`（4531）和
`command_result_expired`（4536）已在使用；V3 只补充目标错误的 metadata 与消费测试，不新建错误协议机制。

### 5.4 非法放在 result builder 的工作

以下工作如果是命令成功条件，必须留在 action transaction：

- Gate、Lifecycle 和 expected version 校验；
- 领域实体写入；
- 必须原子记录的 Audit/Activity；
- Outbox event intent；
- 业务唯一约束与计数写入。

result builder 只允许执行可重复的只读加载和结果组装，不得补写缺失状态或触发外部 effect。

## 6. Result builder 合同

### 6.1 Immutable anchor

Article publish/update/create 的 builder 必须使用 Confirmation 中的 `article_id + revision_id`。
即使该 Article 后续又发布了新 revision，旧 `commandId` 的恢复结果仍锚定原 revision。

禁止：

```text
Confirmation(article_id = A, revision_id = R42)
  -> read current ArticlePublic head R43
  -> return R43
```

要求：

```text
Confirmation(article_id = A, revision_id = R42)
  -> read ArticleRevision R42 + BodySnapshot
  -> return result anchored to R42
```

current operational decoration 如果属于公共合同，必须由具名 transport/result adapter 明确添加；
不能悄悄替换 immutable content anchor。

### 6.2 Community 是 Article builder 的必需上下文

Article Create、Update、Publish 的领域入口在执行 Command 前都已经加载 Community。三者必须把该
Community 传给唯一的 result builder：

```elixir
RevisionResult.build(confirmation, community)
```

`PublishConfirmation` 当前没有 `community_id`。V3 不给它增加该字段，也不升级 Confirmation schema；
如果 Publish 不传 Community，builder 只能为推导 `community_id` 额外读取 Article，直接违反本节查询合同。
Create/Update 的 `RevisionConfirmation` 即使包含 `community_id`，也必须使用相同 `build/2` 形状，不能
恢复 `build/1` 形成第二条结果路径。

这不等同于旧 `action_context`：

- context 不由 Runner 捕获或传递；
- 不区分首次执行与恢复；
- 两条路径调用完全相同的 builder；
- builder 仍以 Confirmation anchor 为结果事实源。

### 6.3 查询约束

当前 `RevisionResult.build/1` 的重复读取必须在 V3 切换前删除。以缺少 `community_id` 的 Publish
Confirmation 为例，现有路径依次执行：

```text
community_id/2 fallback
  -> FrontDesk.article(article_id, mode: :internal)          # Article 第 1 次
FrontDesk.community(community_id, mode: :internal)           # Community 再加载
FrontDesk.article(article_id, mode: :internal)               # Article 第 2 次
Store.revision(revision_id)                                   # Revision 第 1 次
CMS.Articles.RevisionProjection.build(article, community, revision)
  -> read_internal(:command_context)                          # Article 第 3 次 + preload
  -> Repo.get(ArticleRevision, revision_id)                   # Revision 第 2 次
  -> BodySnapshot/tags/lifecycle/pinned/comments/extensions
```

Create/Update Confirmation 已包含 `community_id`，不会执行第一条 fallback，但仍重复读取 Community、
Article 和 Revision。目标 `build/2` 至少满足：

1. 复用必传 Community，额外 Community 查询为 0；
2. Article 及其必要 author context 只加载一次；
3. 指定 ArticleRevision 只加载一次；
4. BodySnapshot、tags、lifecycle、pinned、comment participants 和 thread extension 各有明确 owner；
5. 不先单独读取 Article/Revision，再调用一个内部重复读取相同资源的 facade；
6. 查询发生在 Command transaction 之外；
7. 不为了减少查询而读取 current public head。

性能目标不是保证 V3 的 HTTP 总耗时一定低于当前 fast path，而是同时做到：

- 缩短写事务和资源锁持有时间；
- 将首次与恢复统一到一条可测量的读取路径；
- 把额外 root lookup 控制在明确、有界的范围内；
- 优先优化 result builder，而不是重新扩大 Command API。

## 7. 领域迁移

当前生产 `present:` 调用点只有 Article Create、Update 和 Publish。V3 按领域逐项直接切换。

### 7.1 Article Publish

- `publish_action/1` 只返回 `PublishConfirmation`；
- 删除 `%{article: article, revision: revision}` action context；
- 删除 `present_command_result/3` 的 executed/recovered 分支；
- Command 提交后统一调用 `RevisionResult.build(confirmation, community)`。

### 7.2 Article Update

- action 只返回 `RevisionConfirmation`；
- 首次与恢复统一使用 revision-rooted result builder；
- 保持 expected draft/lifecycle version、Gate、Effects/Outbox 的现有事务语义；
- 不得退回读取 current `ArticlePublic` 作为历史 command result。

### 7.3 Article Create

Create 当前 action 内已经构造 public projection，并将其用于 Activity 等后续逻辑。`created` Activity
不接受 content payload，但共享 `ArtimentEvent.describe/3` 仍需要稳定的 `article_id/id`、`thread`、
`community_id`、`title`、`inner_id` 以及可选 `branch_id` 来构造 stream/subject snapshot。因此 V3 冻结：

- Activity 使用由 Article、Revision 和 Confirmation 组成的最小稳定 descriptor；
- 不得仅因 Activity 需要上述 identity/snapshot 字段而在事务内构造完整 transport result；
- 如果后续发现其他事务内业务确实需要完整 projection，必须单独记录具体字段和查询证据，不能默认保留；
- 即使事务内保留领域读取，也不能把结果作为 action context 交给 Runner；
- Command 提交后的公共返回仍统一从 Confirmation 构造。

Create 的额外读取成本属于 Create 领域优化，不能成为通用 presenter 合同继续存在的理由。

### 7.4 无 commandId 路径

部分领域入口允许 `commandId == nil` 并绕过 Receipt，例如 Article Create、Comment Create/Reply、Article
Trash、asset replacement 和 reaction。V3 不要求所有内部调用都强制生成服务端 Receipt，但要求同一个
公开领域用例的最终结果不能因是否携带 `commandId` 而改变形状或语义：

```text
without commandId: direct action -> typed Confirmation -> Result.build
with commandId:    Command.execute -> typed Confirmation -> Result.build
```

优先让两条路径进入同一个 result builder。暂时无法统一时，必须增加字段级 shape parity 测试，并覆盖
preload、command_id、revision anchor 和错误码；只比较 `{:ok, map()}` 不足以证明同形。

Article Create 的 nil-commandId 分支已纳入 V3 迁移。Comment Create 的 nil 与 Receipt 分支现在都先收敛为
Confirmation，再走同一个 replay/result 组装；Comment Reply 继续在两条路径调用同一个 `reply_result`。

### 7.5 其他 Command

当前没有 presenter 的 Command 保持原有 `action + confirmation` 形状；迁移必须验证它们的 action 已经只返回
typed Confirmation，而不是依赖 Runner 接受任意成功值。Runner 的 `encode_confirmation` 当前已经要求返回值
struct 与 codec module 匹配，并不会自动包装任意 map。所有可选 Receipt 入口同时接受 §7.4 审计。

## 8. 可观测性与性能验收

V3 不以静态查询数猜测代替测量。切换前后至少记录：

- Command transaction duration 的 p50/p95/p99；
- Receipt `FOR UPDATE` lock wait、持锁时长与 `command_resolution_pending` 数量；
- 首次执行与 completed retry 的 SQL count、DB time 和 HTTP 总耗时；
- Result builder duration、失败率与失败原因；
- command committed 但 result unavailable 的数量；
- Article Create、Update、Publish 分场景数据，不用总体平均值掩盖差异。

验收重点：

| 维度               | V3 要求                                                                                |
| ------------------ | -------------------------------------------------------------------------------------- |
| Command API        | 生产调用点只有 `action/confirmation`                                                   |
| 首次与恢复         | 返回同一 typed Confirmation，并调用同一 result builder                                 |
| 写事务             | result projection 不在 Receipt transaction 内；recovery decode 后立即释放 Receipt 行锁 |
| 查询               | 额外 Community 读取 0 次，Article/Revision 各只读取 1 次                               |
| 内容一致性         | 始终锚定 Confirmation revision/draft/branch                                            |
| projection failure | 按 §5.3 归一；只执行声明的 retry/reconcile；绝不换新 commandId 重放 action             |
| 产品合同           | GraphQL 和前端结果形状保持不变，不暴露 replay state                                    |

不设置“HTTP 总耗时必须零回归”的绝对门槛。若事务显著缩短而请求增加少量、稳定的事务外主键读取，
可以接受；若 result builder 出现无界 N+1 或明显 p95 回归，应优化 builder，而不是恢复 presenter。

## 9. 实施顺序

### Phase 1：Result builder（已完成）

1. 新增 `RevisionResult.build(confirmation, community)`，并以它作为 Article 的唯一 result builder；
2. 删除 `build/1` 与 `build_from_action/4`，不再维护 action-seed 的第二套查询算法；
3. 覆盖 immutable revision anchor、后续再发布、nil-commandId shape parity 与 recovery 测试；
4. 保留 SQL count、DB time 与 transaction duration 的生产观测作为后续容量验收基线。

### Phase 2：领域调用点迁移（已完成）

实施时先完成领域调用点迁移，再收口 Command core；没有将兼容 presenter/三元组的中间状态发布到生产。

1. 迁移 Article Publish，只返回 Confirmation，execute 后调用 `build/2`；
2. 迁移 Article Update，只返回 Confirmation，execute 后调用 `build/2`；
3. 迁移 Article Create，使用最小 Activity descriptor，并统一 nil-commandId 结果路径；
4. 审计 Comment Create/Reply 和其他 optional Receipt 路径的 shape parity；
5. 全量审计所有 Command action 返回形状；
6. 确认生产代码不再传 `present:` 或返回三元组；
7. 删除已无调用方的 `RevisionResult.build/1` 与 `build_from_action/4`。

### Phase 3：Command core 硬化（已完成）

Phase 2 的生产调用点迁移完成后执行本阶段：

1. 将 action success 合同收敛为 `{:ok, %Confirmation{}}`；
2. 删除 `Command.presenter`、Runner `present/4` 和 presenter 参数 overload；
3. 删除三元组 action result、`action_context` 与 `:executed/:recovered` 领域分支；
4. 可以新增内部 claim-state Telemetry，但不得进入公开返回值；
5. 删除兼容测试，增加对 `present:` 和三元组的静态/编译期拒绝测试。

禁止先硬化 core、再迁移领域调用点。Phase 2 与 Phase 3 可以在同一 release 原子落地，但文档、提交和
验证顺序仍必须保持“调用点先兼容迁移，core 后收口”，不得产生无法编译或运行时崩溃的中间状态。

### Phase 4：合同与清理（已完成）

1. 更新 `cms-command.md` 和 `cms-command-confirmation.md`；
2. 删除 presenter/action-context 测试与文档术语；
3. 增加“提交后 retryable projection failure + 相同 commandId 恢复”及 unavailable reconcile 集成测试；
4. 更新 ErrorCat metadata；GraphQL extensions 与前端 retry/reconcile 指引沿用现有 actions metadata；
5. 运行 format、warnings-as-errors compile、focused Command tests、完整 backend suite 和文档检查；
6. 确认 GraphQL schema/generated artifacts 不再出现 replay/presenter 派生合同。

## 10. 非目标

V3 不改变：

- `%CMS.Command{}` 的 identity 字段；
- `commandId` 的客户端生成与 transport retry 复用规则；
- Receipt schema、两段 retention 和 identity conflict；
- IntentCodec 的敏感参数 digest 策略；
- Confirmation JSON schema version 与 N/N-1 rollout；尤其不向 `PublishConfirmation` 增加 `community_id`；
- Gate、Lifecycle、version 和 canonical resource lock；
- Outbox 至少一次投递与 consumer 幂等；
- GraphQL/public canonical result 形状；
- FrontDesk V2 与 CMS Query V2 的资源/查询所有权。

V3 也不引入通用 `%Command.Request{}`、`CommandOutcome`、after-commit callback 或新的 universal command
behaviour。未来如果需要独立的异步 job/batch protocol，应按其真实生命周期设计，不扩张同步用户 Command。

## 11. 完成定义

只有同时满足以下条件，V3 才能标记为已落地：

1. 生产代码不存在 `present:`、presenter 或 action context；
2. 所有 `CMS.Command.execute/2` 调用只声明 `action/confirmation`；
3. action 成功只返回 typed Confirmation；
4. 首次与恢复共用领域 result builder；
5. result builder 在 Receipt transaction 提交后运行；
6. `RevisionResult` 只保留 `build/2`，`build/1` 与 `build_from_action/4` 已删除；
7. Article Create/Update/Publish 的首次、恢复、后续再发布与 projection failure 测试通过；
8. optional Receipt 与 nil-commandId 路径共用 result builder，或已有字段级 shape parity 测试；
9. builder 额外 Community 读取为 0，Article/Revision 各只读取一次；
10. completed retry 在运行 result builder 前已经释放 Receipt `FOR UPDATE` 行锁；
11. builder errors 已按 §5.3 统一归一，GraphQL/frontend 能观察目标 retry/reconcile metadata；
12. transaction duration、SQL count、Receipt lock wait 和 result-builder 指标已有对比记录；
13. 当前架构文档不再保留 presenter/action-context 的冲突说明；
14. 产品层仍只接收原 canonical result，不感知 executed/recovered。
