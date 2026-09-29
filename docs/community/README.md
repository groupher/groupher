# Community App

> 状态：current

本目录用于 Community 独立应用的路由、渲染、运行边界和应用级设计。

当前 Community 的 TanStack rewrite 记录位于
[`migrations/tanstack/`](../migrations/tanstack)；业务能力按逻辑链路归档：

- [`feature/gate/`](../feature/gate)：读取范围和操作准入。
- [`feature/lifecycle/`](../feature/lifecycle)：状态、转换与 blocker。
- [`feature/reporting/`](../feature/reporting)：举报事实和审核聚合。
- [`feature/community/`](../feature/community)：成员、计费和 Community 产品能力。
