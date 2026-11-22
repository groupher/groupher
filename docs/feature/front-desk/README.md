# FrontDesk

> 状态：current

本文是 FrontDesk 的唯一当前合同。V1–V3 保留设计和实施历史，不需要组合多个版本才能判断新代码。

> 2026-11-20 工作区已实施：[Article 读取统一与版本接口](../../migrations/frontdesk-article-unification.md)。普通读取统一返回带当前社区的扁平 Article；ArticleView/with_community 已删除；指定 Snapshot、WorkingCopy 有独立入口。读取 mode 使用 `:admin`，内部 policy mode 使用 `:owner`。命名迁移覆盖 Article、Community、Doc、Comment 和 ArticleLog；Community 的 admin 仍允许所有者或 moderator，owner 仅所有者，并修正 `Communities.fetch` 将 owner 请求扩大为 admin 的转换。Article public 批量接受 actor，但不改变公开可见集合。本文其余旧批量包装和模式描述是历史合同，当前 Article 规则以迁移文档为准；工作区实现尚未发布。

FrontDesk 负责 User、Community、Article、Comment 等顶层资源的稳定读取、Article/Comment 有界批量读取，以及少量稳定业务关系。

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
- 单资源 API 必须明确 `public | admin | internal` mode、actor、locator 和 fail-closed 行为；Article 内容版本由 FrontDesk 默认选择，指定版本使用独立入口；
- `view` 只选择该资源 owner 定义的稳定结果形状，不改变授权、mode 或 locator 语义；
- transport 已解析为 canonical struct 后，下游不得无理由降级为 ID 再做通用 lookup；
- transaction/Gate callback 可以为锁和权限重新加载 canonical resource；
- async effect 可以按稳定 ID 重新加载当前 authority；
- FrontDesk 不拥有 mutation、transaction lock、产品专用 projection builder 或产品专用 workflow；稳定的单资源
  projection 可以由资源自己的 FrontDesk 实现拥有。
- `CMS.FrontDesk.article(ref)`／`comment(ref)` 读取单项，传入列表时批量读取。Article 普通读取返回 `%Article{}`，公开路径按所选公开版本填充内容并带当前 Community；`article_snapshot`、`article_working_copy` 独立读取指定版本。Article 列表和分页中的条目也使用 Article。批量输入上限、顺序和错误合同见 Article 迁移文档。SQL/Gate 实现在 Articles/Comments 所属 Query，FrontDesk 转发。`:internal` 结果不表示对匿名读者公开，不得直接展示给 GraphQL。

`CMS.FrontDesk.artiment_status(community, locator)` 读取单项标题、URL 和正文状态；传入已解析资源身份列表时，批量返回按输入 `key` 索引的状态供图节点组装。业务调用不传数据库超时；单项与批量都不要求存在 Mention 边。

> 2026-11-14 Docs 目标：Doc 不再有 branch，公开读取身份由 ArticleBinding + ArticlePublic 决定；下表已按目标移除 `branch_id`。R9 前现有实现可能仍返回该历史字段，但它不是新合同，调用方不得继续依赖。

批量返回形状与错误：

| 入口                                             | 输入                             | 成功项                                                 | 超过 100 个输入         |
| ------------------------------------------------ | -------------------------------- | ------------------------------------------------------ | ----------------------- |
| `CMS.FrontDesk.article(paths)`                   | Article 公开路径                 | `%Article{}` 列表（每条带对应 Community）              | `:batch_limit_exceeded` |
| `CMS.FrontDesk.article(ids, mode: :internal)`    | 稳定 Article ID                  | Article identity structs；不保证已加载内容或 Community | `:batch_limit_exceeded` |
| `CMS.FrontDesk.comment(paths)`                   | 带父 Article 路径的 Comment 路径 | `%{comment, article, thread}`                          | `:invalid_body`         |
| `CMS.FrontDesk.comment(ids, mode: :internal)`    | 稳定 Comment ID                  | `%{comment, article, thread}`                          | `:invalid_body`         |
| `CMS.FrontDesk.artiment_status(community, refs)` | 已解析的 Artiment 身份列表       | 以输入 `key` 为键的状态 map                            | `:invalid_body`         |

四种模式都省略无效或不存在的项，保留有效输入的顺序与重复项；空列表返回空列表。不支持的 mode 返回 `:invalid_body`。公开读取按目标及 Comment 父级的 Gate 状态过滤，内部模式只供可信 Command/维护流程核实身份，绝不可直接投影到公开 GraphQL。

特殊能力必须回到 owner，例如 ViewTracker lock、Article Insights、Revision projection；不能因为它们读取资源
就继续堆进 FrontDesk。

详细的 transport、canonical reload 和异步 reload 分类见
[Resource Loading Boundary](../../architecture/resource-loading-boundary.md)。

## 历史记录

- [V3：全局入口与领域委托修复](./v3.md)：当前调用层级的实施记录；
- [V2：单资源读取合同](./v2.md)：mode、actor、view 与 locator 的历史设计；
- [V1：资源读取边界与改造合同](./v1.md)：最初迁移背景。
