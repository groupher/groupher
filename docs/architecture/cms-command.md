# CMS Command

> 状态：current

本文定义同步 CMS 用户写命令的长期 API 与所有权边界。它不定义具体领域的
Gate、Lifecycle 或 version 规则，也不记录迁移步骤。

- 业务一致性与 action matrix 见
  [Groupher Action Matrix 与 Transition Contract](../feature/lifecycle/transition-contract-improvement.md)。
- 从历史 `CMS.CommandReceipt.run_user_command/8` 迁移到本文目标的步骤见
  [CMS Command Receipt 重构](../migrations/cms-command-receipt-refactor.md)。
- Command、Writer、事务和 effect 的通用领域边界见
  [Command：复杂领域操作的组织边界](../feature/artiment/command.md)。
- GraphQL、CLI、MCP 与 Plugin 如何共同调用领域 Command，见
  [CMS 多入口与领域用例边界](./cms-multi-entry-boundary.md)。
- 事务内 effect intent、统一 Outbox 与消费幂等见
  [CMS Domain Outbox](./cms-outbox.md)。
- 成功结果的 Confirmation codec 与 Receipt JSON 合同见
  [CMS Command Confirmation](./cms-command-confirmation.md)。

发生冲突时，领域行为以 Transition Contract 为准，长期模块与 API 边界以本文为准，
阶段顺序和临时状态以迁移文档为准。

当前 Confirmation 协议已经完成收敛：生产调用点只使用 `action/confirmation`，presenter 让首次
执行复用事务内结果，recovery 从 Confirmation 重建。旧 callback、旧结果列与 whole-intent
fingerprint 均已删除；本次 contract migration 明确清空历史 Receipt，不承诺历史数据兼容。

## 1. 目标

`CMS.Command` 为需要抵抗 ambiguous commit 的同步用户写命令提供事务性幂等边界：
数据库已经提交而响应丢失时，相同用户使用同一个 `commandId` 重试，服务端返回同一份
canonical business result，不重复执行领域写入或 effect。

调用方表达的是“执行 Command”，不是“操作 Receipt”。目标模块层级为：

```text
CMS.Command
├── execute
├── Receipt
└── Store
```

`Receipt` 和 `Store` 是 `Command` 的内部实现，不是领域 facade 的公共协作对象。

本文不建立全局 Command Bus、通用 CRUD framework 或跨领域状态机。

## 2. 术语

```text
actor       已完成认证的 User
operation   固定的服务端操作类型，例如 :comment_update
commandId   一次逻辑用户意图的 UUID；transport retry 必须复用
target      已加载的领域资源，或 create/batch 命令的稳定逻辑 scope
params      影响本次意图的业务参数和 expected version/revision
action      仅首次执行的领域写入函数
confirmation 首次执行与已完成重试共用的不可变领域确认值
receipt     有限窗口内证明该 commandId 已提交并可恢复结果的内部记录
```

`commandId` 不包含 `post:123` 一类资源坐标。资源身份由领域对象或具体 Command
内部派生，不能要求普通调用方重复传递 `"comment"` 与 `comment.id`。

数据库继续使用稳定文本字段 `command` 保存 operation，并使用 `resource_type/resource_id`
保存 target 坐标；领域 API 使用受控 atom、struct
和领域参数。operation 编码与 IntentCodec policy 必须集中在 `CMS.Command` 边界，不能散落在调用点。

Receipt 的内部身份字段统一称为 `command` 与 `command_id`，不再保留 `command_name` 或
`command_key` 作为兼容别名。`command` 是冻结的 wire-level operation tag，不由可变的
atom 命名拆分规则隐式推导。Receipt 必须在 retention 窗口内支持当前版本与前一版本的
Confirmation decoder；部署采用 reader-first、writer-later 的 expand/write/contract 顺序，
确保滚动发布与安全回滚。

## 3. 接入条件

是否接入 `CMS.Command` 取决于业务写入是否需要处理“已经提交但响应丢失”的重试，
不取决于函数是否恰好叫 create、update 或 delete。

通常需要接入：

- 创建资源，重复执行会创建两份；
- update 会增加 revision 或触发其他事务写入；
- publish、trash、restore 等状态迁移；
- reaction、counter 等重复执行会改变结果；
- transport 会自动重试、且需要恢复原确认结果的用户写操作。

不应接入：

- read、纯计算；
- 不存在 transport retry 合同的内部一次性 helper；
- 由稳定领域约束自然幂等、且无需恢复原响应的简单写入；
- 仅仅因为属于 CRUD 而没有上述风险的操作。

Job 与 system command 不属于当前用户 API。未来出现真实需求时应设计独立入口，
只复用内部 Receipt primitives，不能把 `run_user` 泛化为含混的 initiator API。

## 4. 所有权边界

| 层                              | 负责                                                                                                                   | 不负责                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| GraphQL / transport             | 认证、接收客户端 `commandId`、转发领域参数                                                                             | 服务端 Receipt 字段、首次/恢复分支          |
| 领域 Command                    | command 含义、Gate、version、Lifecycle、领域写入                                                                       | SQL claim、超时、retention                  |
| `CMS.Command`                   | transaction、首次执行或恢复、Confirmation encode/decode、统一结果返回、effect 调度边界                                 | 猜测 Comment/Article/DocTree 返回结构       |
| FrontDesk                       | 加载查询时刻的 current canonical projection、解析领域关系                                                              | Receipt claim、幂等判断、旧命令结果重建     |
| `CMS.Command.Receipt` / `Store` | canonical intent params、claim、finalize、冲突与两段 retention                                                         | Gate、Lifecycle、领域 Reader、产品响应形状  |
| 前端 mutation infrastructure    | 以 `commandId` 保存短期 Browser Receipt，跨刷新恢复 optimistic read-your-writes，并把成功结果 reconcile 到 Query cache | 服务端首次/恢复判断、`commandReplayed` 分支 |
| Audit / Activity                | 长期业务与审计事实                                                                                                     | 有限窗口的 transport retry                  |

Transport/UI 调用方、GraphQL 和前端业务代码不得感知服务端首次执行还是 Receipt 恢复。
领域 Command owner 可以声明恢复投影或 codec，因为如何重建 canonical result 属于领域知识；
但它不处理 replay 状态，也不直接操作 Receipt。正常公共返回保持领域原有形状：

Receipt-backed 的 command-time 结果由领域 result builder 负责，例如
`CMS.Articles.RevisionResult.build/1` 或 `CMS.Docs.DraftResult.build/1`。它们以 decoded
Confirmation 中的 immutable revision/draft anchor 为根，不读取当前 `ArticlePublic` 或原始 transport
args；FrontDesk 仍只负责查询时刻的 current projection。

```elixir
{:ok, canonical_result}
{:error, reason}
```

`executed/recovered` 只允许用于 `CMS.Command` 内部控制、日志、Telemetry 和测试，不挂在
`%Comment{}`、`%Article{}` 等领域 struct 上，也不进入 GraphQL 产品合同。

## 5. 内部执行路径

```text
GraphQL / CMS facade
  -> authenticated domain Command
  -> CMS.Command
       -> BEGIN + timeout policy
       -> Receipt.claim(actor, command_id, command, resource/input identity)
            -> first execution: execute domain callback
                 -> Gate
                 -> canonical resource lock
                 -> expected version/revision
                 -> Lifecycle/precondition
                 -> domain writes + transaction-owned Audit/outbox
                 -> Confirmation.encode + persist confirmation JSON
            -> completed retry: skip domain callback and Confirmation.decode saved JSON
            -> incompatible intent params: command identity conflict
       -> finalize receipt in the same transaction
       -> COMMIT
       -> both branches return the same Confirmation; product projection stays outside Command
       -> first execution persists required effects to transactional outbox
       -> return the same business result shape
```

Claim、领域写入和 finalize 必须处于同一事务。失败时三者一起回滚；成功时一起提交。
`CMS.Command.execute/2` 把已解析的 command context 传给 `action` callback；context 中的 `target` 是调用方声明的
领域资源，canonical resource 仍由领域 Gate 在锁内解析。当前 context 字段固定为
`actor/command_id/target/params`。`action` 返回
`{:ok, %Confirmation{}} | {:ok, %Confirmation{}, action_context} | {:error, reason}`；codec 只允许保存稳定的
Confirmation JSON。异常继续按 Elixir 异常语义向外传播，不转换成领域错误。

超时分成三层是为了让并发冲突快速失败，同时给真正的领域事务足够时间：claim 阶段的
`lock_timeout` 为 4 秒；外层 transaction 和 statement 的上限为 30 秒。4 秒只限制等待其他
事务释放唯一键/资源锁的时间，不限制整个命令执行；30 秒分别限制事务总时长和单条 SQL，避免
慢查询或连接异常无限占用连接。它们不是三次重试，也不改变幂等语义，超时统一转为可重试的
command resolution pending 错误。

已完成重试不是调用方需要处理的 replay-status 分支。领域 owner 提供版本化 Confirmation codec，
`CMS.Command` 只保存和取回 opaque JSON。面向领域 Command 作者的 API 使用 `action` 与
`confirmation: Confirmation`：只有首次分支调用 `action`，恢复分支只 decode 已保存 Confirmation。
不使用容易被理解为事务补偿或失败修复的
`recovery`，也不暴露容易被误读为第三个顺序步骤的 `after_commit` callback。必须送达的 effect
由 `action` 同事务写入 Outbox，提交后异步消费。

`action` 写入的是 effect intent，不是在数据库事务内直接执行外部 effect：

```text
action: domain writes + OutboxEvent -> COMMIT
worker:  search / notification / Webhook / cache purge -> mark event completed
```

事务回滚时 OutboxEvent 与领域写入一起消失；commit 后进程崩溃时 pending event 仍可重试。禁止在
`action` 内直接发送通知、调用 Webhook、请求外部搜索服务、启动异步任务或向外部进程发消息。
Command action 只能调用事务内领域写入、Gate/Lifecycle、以及 Outbox intent API；自定义 Credo
规则 `NoExternalEffectsInCommands` 对 Command action 所在模块做直接调用护栏，模块依赖检查和
Outbox 集成测试负责覆盖间接调用。

`command` atom 到 Receipt 文本的编码也只发生在 `CMS.Command` 边界：普通命令只把第一个 `_`
切成 namespace，例如 `:article_update_draft -> "article.update_draft"`；`doc_tree_` 前缀
替换为 `doc.tree.`，其余部分保持原样，例如 `:doc_tree_create_tab -> "doc.tree.create_tab"`。
这条规则属于 Receipt identity，修改时必须同时更新测试和发布说明。

### 服务端 Receipt 与 Browser Receipt 的边界

本文中的 `Receipt` 默认指服务端 `cms.command_receipts`：它记录 command identity、受控 intent params
和已确认结果引用，服务端据此决定执行还是恢复。它不应作为领域结果字段暴露给 GraphQL。

前端另有独立的 Browser Receipt（见
[Optimistic Read Your Writes](../migrations/tanstack/optimistic-read-your-writes.md)）：它保存
短期的 canonical result 或 projection，用于 optimistic mutation 后跨刷新继续显示用户刚刚完成的
写入，并在 Query cache 可用时收敛。Browser Receipt 以 `commandId` 作为客户端幂等键，首次响应和
服务端恢复响应都走同一条写入/reconcile 路径；它绝不能读取或判断 `commandReplayed`。

因此，本次 Command 重构只删除服务端恢复状态的 GraphQL 字段和前端条件分支，不删除 Browser
Receipt、reconcile hook、account cleanup 或相关测试。`viewReceipt` 是浏览事件去重的第三种机制，
也不属于 Command Receipt。

## 6. API 形态约束

GraphQL/resolver 不构造 Command request。具体领域 Command 负责构造 `%CMS.Command{}`，可以共享
Receipt 算法，但公共业务入口必须表达真实差异。
Receipt 内部的 target 也不是 Artiment 专属字段：已存在实体可能是 Post、Blog、Changelog、Doc、Comment
或 Community；create、restore、DocTree 和 batch command 则使用 owner 或领域 scope。Article create
执行前没有 Article id，Trash restore 的 item ref 也可能只存在于业务 input。因此 `artiment_type/id`
不能作为所有 command 的通用身份；领域入口负责提供真实资源或 scope，Receipt Store 只保存统一的
`resource_type/resource_id` 索引。
以下示例冻结当前合同：`%CMS.Command{}` 只承载 command identity；`action/confirmation` 必须在同一个
`CMS.Command.execute/2` 调用中成对出现。`update_user/create_user` 构造器和公开
`resolve_command_id` 不属于当前 API。

### 6.1 更新已存在实体：Comment Update

调用方已经持有 `%Comment{}`，不能再次传 `"comment"` 和 `comment.id`：

```elixir
command = %Command{
  actor: actor,
  command_id: command_id,
  operation: :comment_update,
  target: comment,
  params: body
}

CMS.Command.execute(command,
  action: fn %{actor: actor, target: comment, params: body} ->
    Gate.Access.with_check(actor, :edit, comment, fn canonical, article ->
      with {:ok, updated} <- Comments.update(canonical, article, body) do
        {:ok, %CommentConfirmation{comment_id: updated.id}}
      end
    end)
  end,
  confirmation: CommentConfirmation
)
```

以上仅冻结信息形状，不冻结最终 Elixir 语法。最终 API 必须满足：

- 从 `resource` 派生 receipt 资源身份；
- 首次成功保存 Comment 稳定引用；
- 首次和重试都通过 FrontDesk 投影并直接返回 `%Comment{}`；
- 调用方看不到 Receipt、result key、payload 或 replay。

### 6.2 创建实体：Article Create

创建前没有 `%Article{}`。API 应明确表达 create，而不是伪造 `article_collection` target：

```elixir
command = %Command{
  actor: actor,
  command_id: command_id,
  operation: :article_create,
  target: {:article, community.id},
  params: attrs
}

CMS.Command.execute(command,
  action: fn %{actor: actor, params: attrs} ->
    with {:ok, article} <- Articles.create(community, :post, attrs, actor, []) do
      {:ok, %RevisionConfirmation{article_id: article.id}}
    end
  end,
  confirmation: RevisionConfirmation
)
```

Command identity 由 actor、commandId、固定 command、真实 owner 和业务 input 绑定；成功后
Receipt 保存新 Article 的稳定引用，最终通过 FrontDesk 返回 Article。

### 6.3 成功后输入资源消失：Trash Restore

恢复成功会删除 Trash membership。响应丢失后的重试不能要求再次加载已经不存在的 Trash item：

```text
首次请求：stable trash ref -> restore -> save restored Article ref
重复请求：same commandId -> read Receipt -> load restored Article through FrontDesk
```

这类差异由 `Articles.Commands.Trash` 与 `CMS.Command` 的专用组合处理。逻辑 scope tuple 只允许
出现在领域 Command 内部构造的 `%Command{target: ...}`，不得暴露为 GraphQL 参数。

### 6.4 无法重读当次结果：DocTree payload

部分 DocTree mutation 的 node、affected nodes 和 revision 无法从当前数据库状态精确重建。
DocTree owner 可以返回最小、版本化、JSON-safe result payload：

```text
DocTree execute
  -> DocTree result codec encode
  -> Receipt stores opaque payload
  -> first/retry both decode through the same owner codec
  -> same DocTree result
```

完整资源快照、敏感数据以及可以通过 FrontDesk 重读的实体不得存入通用 Receipt。

## 7. FrontDesk 与结果恢复

FrontDesk 统一负责根据稳定领域引用加载当前 canonical result。`CMS.Command` 负责取得该引用，
并在返回前完成组合；普通业务调用点不额外调用 `result/1`。

```text
new execution -> result ref --+
                              +-> FrontDesk / owner codec -> canonical result
existing receipt -> result ref+
```

如果当前可见性不允许返回资源，不能把历史 command 的成功改写为“从未执行”。Command 必须保留
已确认成功语义，并按具体产品合同返回 terminal result 或 result unavailable；Receipt 不能泄漏旧快照。

## 8. Retention

`expires_at` 只表示当前发布版本内服务端承诺识别同一次 `commandId` 的最长时间，不表示领域操作或业务结果过期。
当前服务端 Receipt 窗口为 24 小时：

```text
窗口内：相同 actor + commandId + intent params 返回已确认结果，不重复写入
窗口外：不再保证恢复；新尝试仍必须经过 Gate、version 和领域约束
```

Receipt 过期或被清理不撤销 Article/Comment，不删除领域事实或 Audit，也不允许绕过业务约束。
Receipt result retention 结束后可以清除 Confirmation，但可保留更小的 identity-only tombstone。
Tombstone 有独立且有界的 `identity_expires_at`（例如 30–90 天），不允许无界增长：

清理查询按 `expires_at` / `identity_expires_at` 扫描；命令 claim 只按
`initiator_type + initiator_key + command_id` 定位 Receipt，因此不保留 whole-intent fingerprint
列或索引。

```text
result retention 内：same actor + commandId + intent params -> decode Confirmation
result retention 外、identity retention 内：
  same intent params -> command_result_expired，不重新执行
  different intent params -> command identity conflict
identity retention 外：不再提供该 commandId 的去重保证
```

Tombstone 只防御同一 actor/commandId 的晚到重试，不提供永久幂等；客户端换用新的
`commandId` 仍可能产生新的业务写入，因此业务层仍需自己的唯一约束。新的业务意图也必须生成新的
`commandId`。
部署兼容不采用清仓后切换：Confirmation decoder 使用 N/N-1 兼容窗口。先部署能读取 N-1 与 N
但只写 N-1 的版本，确认所有节点就绪后才写 N；旧版本若不能读取 N，禁止进入 N writer 阶段。
本次从旧协议切换时不兼容历史 Receipt：contract migration 先清空旧行，再删除 legacy 结果列和
fingerprint 列。迁移历史文件保留，不改写或删除。以后若引入 Confirmation schema v2，仍按上述
N/N-1 reader-first 策略演进，而不是重新引入旧 Receipt 协议。
服务端 24 小时 Receipt TTL 与前端短期 Browser Receipt TTL 是两个独立合同：前者承诺 transport
retry 的服务端恢复，后者承诺浏览器 optimistic read-your-writes；两者不能互相替代。
