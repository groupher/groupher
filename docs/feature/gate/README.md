# Community Gate

> 状态：current

本文是 Gate 的当前入口。Gate 只负责读取 scope 和写入 admission，不拥有业务状态迁移或 transport：

> **2026-11-14 Docs 目标更新：**当前 Gate 运行态仍按单一 Docs owner / DocsLifecycle 执行；这只是待迁移的实现事实。新目标允许 Doc 多社区 Binding，Gate 按显式请求 Community 验证对应 Binding，并从共享 ArticleLifecycle 读取单篇状态。Docs 站点读取和发布继续使用站点级 Queue / Release。当前运行态说明不得作为新目标合同。

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
- 审核限制、内容待审、AI 意见和 AlertWall 的职责见 [ReviewBot / AlertWall V2](../alert-wall/v2.md)。

> 共享评论运行态：`Comment.for_thread(thread, community_id: canonical_id)` 强制显式请求社区，`all_public()` 为跨 thread 公共聚合入口；Comment 不接受 branch selector。Doc 评论当前仍按旧 owner/main 实现；切换后按对应 Binding 和 Article Gate 读取，评论身份与统计继续归稳定 Article。实施目标见 [共享评论计划](../../migrations/comment-reaction-snapshot-counts.md) 与 [Docs 发布队列合同](../../migrations/docs-publish-queue-refactor.md)。

## 版本状态

- [V2](./v2.md)：Gate/Lifecycle 基础合同的实施历史和通用 API 细节。
- [V3](./v3.md)：Article Draft/Public 与 Doc 专属能力划分记录。
- [V4](./v4.md)：typed Access/Scope context 的当前详细合同，已落地。
- [V5](./v5.md)：当前 `Scope.Query` 命名、分发和 ErrorCat 收口合同，已落地。

## 补充与历史

- [读取与操作准入收口](../../migrations/gate-admission-convergence.md)：已确认、待实施的调用覆盖与重复准入清理计划；不新增另一套 Gate 合同。
- [Article WorkingCopy Gate 与已发布编辑策略收口](../../migrations/article-working-copy-gate-policy-fix.md)：Article 作者专属 `:edit_article`、默认允许且可配置的发布后编辑策略及 Receipt / Asset workflow 规则；实现和本地验收记录见合同 F4，完整后端套件未运行。

- [`lifecycle-cleanup.md`](./lifecycle-cleanup.md)：已确认、待实施的 Lifecycle 清理设计。
- [`implementation-history.md`](./implementation-history.md)：V2 一次性切换记录。
- [`legacy-overview.md`](./legacy-overview.md)：旧入口，仅用于指向后续版本。
