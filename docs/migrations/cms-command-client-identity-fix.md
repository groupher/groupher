# CMS Command 客户端 Identity 边界修复

> 状态：待实施（2026-10-08）
>
> 范围：保留 GraphQL `commandId` 合同，将 command identity 的创建、持有、retry 复用和 unknown
> outcome 恢复统一收回 mutation executor；组件和领域 UI 不再直接调用 `createCommandId()`。

相关合同：

- [CMS Command](../architecture/cms-command.md)：Command、Receipt 与 ambiguous commit 的长期边界；
- [CMS Command V3](../architecture/cms-command-v3.md)：Confirmation、result builder 与同 ID 恢复；
- [Optimistic Operation](./tanstack/optimistic-operation.md)：客户端 execute attempt、queue 与 optimistic effect；
- [Optimistic Read Your Writes](./tanstack/optimistic-read-your-writes.md)：confirmed receipt 与刷新后收敛。

## 1. 问题

`commandId` 是一次逻辑写操作的稳定 identity。它需要在请求发出前创建，因为服务端可能已经提交，
但响应可能在 transport 中丢失；此时客户端只有复用原 ID，才能恢复首次结果而不重复执行写入。

```text
用户发起一次写操作
  -> 请求到达服务端
  -> transaction + Receipt 已提交
  -> response 丢失
  -> 客户端以同一 commandId 重试
  -> CMS.Command 恢复首次 Confirmation / canonical result
```

问题不在于 GraphQL 暴露 `commandId`，而在于当前部分组件和领域 Hook 自己创建 ID：

```ts
pinPost({ article, commandId: createCommandId() })
```

这会把以下协议责任泄漏给 UI：

- 什么时候创建新的 command；
- transport retry 是否复用原 ID；
- 网络超时后是新建 command，还是恢复结果未知的旧 command；
- toggle/no-op/补偿操作是否应该获得新 ID；
- command 何时可以从内存中释放。

现有 [Optimistic Operation](./tanstack/optimistic-operation.md) 已规定通用 executor 在实际 execute
attempt 开始时生成 `commandId`。当前生产代码仍有 10 个调用方文件、11 处组件或业务 hook 直接调用
`createCommandId()`；此外 executor 内部有 1 处目标保留的默认生成逻辑。调用方没有完全遵守既有合同，
而不是需要再发明一套 identity 名称。

## 2. 决策

### 2.1 公共名称继续使用 `commandId`

不将字段改名为 `idempotencyKey`：该名称偏基础设施，不能直接表达 Groupher 中“一次业务 Command”的
含义。也不使用以下名称：

- `requestId`：一次 command 可以经历多个 transport request；
- `operationId`：容易与 GraphQL operation、trace operation 混淆；
- `mutationId`：把协议错误绑定到 GraphQL，无法覆盖未来 CLI、Agent 或后台入口。

冻结语义：

> `commandId` 标识一次已经开始执行的逻辑写操作。相同操作的安全 retry/recovery 必须复用；新的
> 用户意图、补偿写入或不同 payload 必须使用新 ID。

GraphQL 继续声明需要可靠恢复的 mutation 参数为 `commandId: ID!`；服务端继续映射到
`CMS.Command.command_id`。本修复不改 GraphQL 字段名、Receipt schema 或后端 Command identity。

### 2.2 组件不创建、不保存、不传入 commandId

组件只表达业务输入：

```ts
const [, pinPost] = useCommandMutation(S.pinPost)

pinPost({ article: articlePath })
```

组件不得：

- import 或调用 `createCommandId()`；
- 因一次 retry 再生成 UUID；
- 根据 HTTP/GraphQL 错误自行判断 Receipt 是否存在；
- 将 `commandId` 放入 React local state 充当 retry coordinator。

领域 Hook 可以声明 operation name、entity key、queue key、optimistic plan 和 reconcile 策略，但不得
自行实现 UUID 生命周期。Docs 编辑器这类长流程 coordinator 可以持有 executor 返回的 command handle，
不能绕过 executor 直接生成 identity。

### 2.3 mutation executor 是唯一客户端 owner

```text
Component / domain hook
  -> business variables without commandId
  -> Command mutation executor
       -> create commandId once
       -> attach commandId to generated GraphQL variables
       -> preserve it across bounded transport retry/recovery
       -> classify confirmed / rejected / unknown
       -> release or retain the command handle
  -> GraphQL transport
  -> CMS facade -> concrete use case -> CMS.Command
```

`createCommandId()` 可以继续作为 executor 内部 primitive，但不再是组件可直接消费的公共 helper。

推荐类型边界：

```ts
type TCommandVariables<TVariables extends { commandId: string | number }> = Omit<
  TVariables,
  'commandId'
>

type TCommandHandle<TVariables> = {
  commandId: string
  variables: TCommandVariables<TVariables>
  status: 'pending' | 'unknown'
}
```

`TCommandHandle` 只在 `pending` 和 `unknown` 阶段存在；`idle` 表示尚未创建 handle，`settled`
表示 handle 已清理，因此二者不属于 `status` union。

GraphQL generated type仍然要求 `commandId`，保证 transport 合同不被弱化；业务 hook 对组件暴露的
参数类型删除该字段，由 executor 在最靠近 transport 的统一位置补齐。

## 3. Command 生命周期

客户端至少区分以下状态：

```text
idle
  -> begin business attempt
pending(commandId)
  -> confirmed / rejected -> settled
  -> transport outcome unknown -> unknown(commandId)
unknown(commandId)
  -> retry/recover with same commandId
  -> confirmed / rejected / expired -> settled
settled
  -> next user intent creates a new commandId
```

### 3.1 必须复用原 ID

- connection reset、timeout 或 response decode 失败，无法确认服务端是否提交；
- 服务端返回明确的 retry/reconcile action，且合同要求恢复同一 Receipt；
- executor 发起的有界 transport retry；
- 页面内对同一个 `unknown` command 的人工“重试”。

### 3.2 必须创建新 ID

- 用户在上一 command 已 confirmed/rejected 后再次发起新操作；
- confirmed state 与最新 pending state 不同，需要补偿 execute；
- target、operation 或 payload identity 发生变化；
- Receipt 已明确 expired，产品允许把当前意图作为新写入重新发起。

### 3.3 不创建 ID

- toggle 被同一 queue 中更新的 pending state 吸收；
- `confirmed === pending` 的 no-op；
- 前端校验失败、请求尚未进入 execute attempt；
- query、prefetch 或纯本地 UI 操作。

## 4. 错误与 retry 合同

不能把所有失败都变成相同的 `{ error }`，否则调用方无法区分“服务端明确拒绝”和“提交结果未知”。

| 结果                                      | command 状态 | 后续行为                                      |
| ----------------------------------------- | ------------ | --------------------------------------------- |
| canonical success                         | settled      | reconcile，释放 handle                        |
| 确定性业务错误 / Gate denial / validation | settled      | 展示错误；新操作使用新 ID                     |
| command identity conflict                 | settled      | 记录协议错误；禁止换 ID 静默重放相同调用      |
| timeout / disconnect / response 无法解析  | unknown      | 保留 handle；同 ID 有界 retry/recovery        |
| `command_result_unavailable`              | settled      | authority reconcile；不重放 action            |
| Receipt expired                           | settled      | 显式 reconcile 后由产品决定是否创建新 command |

自动 retry 只能由统一 executor 基于错误分类执行。React 组件再次调用 mutation 默认表示新的用户意图，不能
被隐式当成 transport retry；若要恢复 `unknown` command，必须调用 executor 暴露的 `retry(handle)` 或等价
能力。

## 5. 当前实现盘点

### 5.1 已符合方向

`frontend/core/query/mutation/optimistic/execute.ts` 已在 execute attempt 内部生成 `commandId`，并允许
内部调用方传入已有 ID。Article/Comment optimistic operation 应继续复用这个 owner，不新增第二套生成器。

### 5.2 待迁移直接调用

当前生产代码中的直接 `createCommandId()` 调用分为三批：

1. Article 设置：Title、Tags、Pin/Unpin；
2. Docs：Draft autosave、SideTree persistence/trash、Publish、Revision restore；
3. CMS Trash：restore 与 permanently delete。

这些调用必须逐个确认实际 attempt 边界，不能机械替换：

- 普通一次性 mutation 迁到共享 `useCommandMutation`；
- 已使用 optimistic operation 的动作直接删除外层手工 ID；
- autosave/Docs persistence 由其 coordinator 创建一次 executor handle，并在同一次保存恢复中复用；
- publish/restore/delete 的 ambiguous outcome 必须保留原 handle，不能在 catch/retry 中重新生成。

`useArticleSettingMutation` 当前要求组件传完整 generated variables，并将所有异常压成简单 error result；它
不能正确持有 unknown command，是首批应收口的入口。

## 6. 实施阶段

### Phase 1：建立统一非 optimistic Command executor

- 提供 typed `useCommandMutation` / command execution primitive；
- 对组件隐藏 generated variables 中的 `commandId`；
- command handle 保存 `commandId + immutable variables identity + status`；
- 明确 confirmed、rejected、unknown 和 expired 分类；
- 默认不自动 retry，只有 operation 显式声明且同 ID 可恢复时才允许有界 retry。

### Phase 2：迁移 Article 设置

- Title、Tags、Pin/Unpin 不再 import `createCommandId`；
- `useArticleSettingMutation` 改由 Command executor 驱动；
- 同一次 transport retry 复用 ID，新点击生成新 ID；
- mutation success 后继续执行既有 article/list invalidation。

### Phase 3：迁移 Docs 与 Trash coordinator

- 按 autosave、tree edit、publish、revision restore、trash action 分别定义 operation identity；
- coordinator 只持有 typed handle，不直接生成 UUID；
- response unknown 时保留原 ID；
- payload 改变时终止旧 attempt，创建新 command，不复用错误 identity。

### Phase 4：关闭直接访问

- 将 `createCommandId` 移入 executor 内部目录或取消 export；
- 增加静态门禁，禁止 component/unit 直接 import；
- 只对白名单内部 executor 和测试开放 command ID 注入；
- 更新 Optimistic Operation、Command V3 和本文件的状态，删除已完成迁移清单。

## 7. 验收

- production component、domain UI hook 和 coordinator 中不存在直接 `createCommandId()`；
- GraphQL 需要可靠恢复的 mutation 仍声明 `commandId: ID!`；
- 组件调用类型不包含 `commandId`，executor 发送的 transport variables 必须包含合法 UUID；
- 同一次自动 transport retry 与 unknown recovery 复用同一 ID；
- 新用户操作、补偿操作和 payload identity 变化生成新 ID；
- conflict 不通过生成新 ID 静默重试；
- no-op 和被 queue 合并的点击不创建 Command Receipt；
- Pin/Unpin、Title、Tags、Docs autosave/publish/restore、Trash restore/delete 均有 identity 生命周期测试；
- 测试覆盖 response 丢失但服务端已提交、同 ID recovery、确定性拒绝、Receipt expired 和 payload conflict；
- GraphQL codegen、frontend type-check、相关 mutation tests、`pnpm docs:check` 与静态门禁通过。

## 8. 非目标

本修复不：

- 将 `commandId` 改名为 `idempotencyKey`；
- 改用全局 HTTP `Idempotency-Key` header；
- 要求所有 mutation 都进入 `CMS.Command`；
- 把 optimistic queue、mutation key、entity key 与 command identity 合并；
- 把 Receipt 当成离线任务队列或无限期恢复记录；
- 改变 Gate、Lifecycle、Confirmation、result builder 或 Outbox 的所有权。
