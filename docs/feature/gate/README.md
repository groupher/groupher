# Community Gate

> 状态：current

本文是 Gate 的当前入口。Gate 只负责读取 scope 和写入 admission，不拥有业务状态迁移或 transport：

```text
read caller
  -> Gate.scope(queryable, actor, action, typed scope context)
  -> composable Ecto query

write command
  -> load and lock canonical resource once
  -> Gate.with_check(actor, action, resource, callback)
  -> callback reuses the authorized canonical resource
```

- 读取返回可组合 query，不在 Gate 内执行最终 Repo 查询；
- 写入在 command transaction 内完成加载、锁和授权，不能先授权 ID 再重新加载另一份资源；
- Access/Scope context 使用资源专属 struct，禁止自由 map 和隐式默认权限；
- Lifecycle 是状态权威，Gate 只消费状态并给出 admission decision；ReviewBot 的意见通过 CMS 资源 Command 更新限制，Gate 不直接调用 ReviewBot；
- Resolver、Job 和其他 Context 不得直接进入 Gate internal module；
- 新代码以本文、V4 typed context 和对应资源 Lifecycle 合同为准，不从历史版本恢复旧入口。
- 审核限制、内容待审、AI 意见和 AlertWall 的职责见 [ReviewBot / AlertWall V2](../alert-board/v2.md)。

## 版本状态

- [V2](./v2.md)：Gate/Lifecycle 基础合同的实施历史和通用 API 细节。
- [V3](./v3.md)：Article Draft/Public 与 Doc 专属能力划分记录。
- [V4](./v4.md)：typed Access/Scope context 的当前详细合同，已落地。
- [V5](./v5.md)：当前 `Scope.Query` 命名、分发和 ErrorCat 收口合同，已落地。

## 补充与历史

- [读取与操作准入收口](../../migrations/gate-admission-convergence.md)：已确认、待实施的调用覆盖与重复准入清理计划；不新增另一套 Gate 合同。

- [`lifecycle-cleanup.md`](./lifecycle-cleanup.md)：已确认、待实施的 Lifecycle 清理设计。
- [`implementation-history.md`](./implementation-history.md)：V2 一次性切换记录。
- [`legacy-overview.md`](./legacy-overview.md)：旧入口，仅用于指向后续版本。
