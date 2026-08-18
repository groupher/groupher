# CMS Gate（V2 入口）

Gate V2 已收敛到 [gate_v2.md](./gate_v2.md)。本文原先描述的 Gate 多 facade、旧 boolean 检查和隐式加载方案已废止，不再作为设计、实现或验收依据。

当前唯一公开接口：

```elixir
queryable |> CMS.Gate.scope(actor, action, context)
CMS.Gate.access_check(actor, action, resource_ref)
```

状态权威、Community mode 矩阵、Article/Comment/Document policy、Reader/Writer 边界和迁移决策全部以 [gate_v2.md](./gate_v2.md) 为准。
