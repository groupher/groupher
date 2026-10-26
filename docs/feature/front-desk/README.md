# FrontDesk

> 状态：current

本文是 FrontDesk 的唯一当前合同。V1–V3 保留设计和实施历史，不需要组合多个版本才能判断新代码。

FrontDesk 负责 User、Community、Article、Comment 等顶层资源的稳定单资源读取，以及少量稳定业务关系。

单资源/批量转发与 list/pagi Query 的已确认边界、现存绕行和待实施验收见
[FrontDesk 与 Query 收口计划](../../migrations/frontdesk-query-convergence.md)。该计划不表示现有调用已全部符合合同。

```text
GraphQL / application / cross-domain caller
  -> GroupherServer.FrontDesk
  -> Accounts | CMS root Facade
  -> owner-internal FrontDesk
  -> Gate scope / stable lookup / Repo
```

## 当前规则

- Web、Job 和跨 Context caller 只能调用 Root FrontDesk 或目标 Context 根 Facade；
- Root FrontDesk 只负责稳定 API、参数分发和领域委托，不直接实现 CMS/Accounts 读取规则；
- Context 内部使用自己的 FrontDesk seam，不绕行 `CMS -> Root -> CMS`；
- internal FrontDesk 虽然是 Elixir public module，架构上只允许所属 Context 内部调用；
- 单资源 API 必须明确 `public | management | internal` mode、actor、locator、可选具名 `view` 和 fail-closed 行为；
- `view` 只选择该资源 owner 定义的稳定结果形状，不改变授权、mode 或 locator 语义；
- transport 已解析为 canonical struct 后，下游不得无理由降级为 ID 再做通用 lookup；
- transaction/Gate callback 可以为锁和权限重新加载 canonical resource；
- async effect 可以按稳定 ID 重新加载当前 authority；
- FrontDesk 不拥有 mutation、transaction lock、产品专用 projection builder 或产品专用 workflow；稳定的单资源
  projection 可以由资源自己的 FrontDesk 实现拥有。

特殊能力必须回到 owner，例如 ViewTracker lock、Article Insights、Revision projection；不能因为它们读取资源
就继续堆进 FrontDesk。

详细的 transport、canonical reload 和异步 reload 分类见
[Resource Loading Boundary](../../architecture/resource-loading-boundary.md)。

## 历史记录

- [V3：全局入口与领域委托修复](./v3.md)：当前调用层级的实施记录；
- [V2：单资源读取合同](./v2.md)：mode、actor、view 与 locator 的历史设计；
- [V1：资源读取边界与改造合同](./v1.md)：最初迁移背景。
