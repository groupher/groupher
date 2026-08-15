# Gate / Lifecycle 实施记录

Gate V2 已完成一次性切换，旧的分批实施草案不再作为当前任务清单或接口合同。

请使用 [gate_v2.md](./gate_v2.md) 查看当前公开 API、Scope/access_check 边界、Community 状态矩阵、Document action matrix 和验收清单；使用 [lifecycle.md](./lifecycle.md) 查看 Lifecycle 本身的状态与转换。

实现原则只有两条：

```text
queryable -> CMS.Gate.scope(actor, action, context)
resource  -> CMS.Gate.access_check(actor, action, resource_ref)
```

旧的 Gate facade、boolean 准入、隐式 loader、公共 scope bypass 和兼容 alias 均不属于 V2。
