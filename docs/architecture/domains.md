# 主要领域与模块命名

> 状态：目标架构，实施状态 mixed。
>
> 本文使用目标领域命名，不表示所有模块均已实现。

本文回答“某项能力最终归谁所有”，同时标出当前代码中的对应模块。具体模型、事务和迁移步骤以链接的
Feature 文档为准。

`ArticleStats` 不是新的业务领域：它是跨 `ViewTracker`、`Interactions` 和 Article/Comment 读取投影的公共
统计 DTO 与 Query cache 边界。它的命名、SSR hydration、缓存 TTL 和 tracking 判断见
[ArticleStats 与公共页面缓存](./article-stats-and-public-cache.md)。Interactions 的 emotion typed-row 与 GraphQL 改名已作为
独立 direct cutover 在本地落地，见 [Article emotion counts](./article-emotion-counts.md)。

```text
CMS
├─ Interactions       普通用户反应：upvote / collect / emotion
├─ ViewTracker        Article 有效阅读的 identity、去重和计数
├─ Report             用户提交或撤销举报事实
└─ Moderation         审核工作单、审核决定与资源处置编排

RequestActor          平台级请求主体分类：human / agent / crawler / unknown

Helper.ORM            平台级数据库访问基础设施；不是业务领域，不存在 Database.* 平行 namespace

Analysis
├─ ArticleInsights    Groupher 自有业务指标的小时趋势与维度查询
└─ Web                外部 Web Analytics provider 的适配和读取边界

Activity              低频、可解释的业务活动历史，不承担高频统计
Sentinel              自动识别违法、违规或高风险内容，并产生风险信号
```

## 边界速查

| 目标模块                   | 实施状态                     | 当前对应模块                  | 最终拥有                                                         | 详细设计                                                          |
| -------------------------- | ---------------------------- | ----------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| `CMS.Interactions`         | existing，V5 partial         | `CMS.Interactions`            | upvote、collect、emotion 的事实与同步读取状态                    | [Interaction V5](../feature/interaction/v5.md)                    |
| `RequestActor`             | implemented，入口持续补齐    | `GroupherServer.RequestActor` | 请求级 human/agent/crawler/unknown 分类结果；不包含业务策略      | [RequestActor](./request-actor.md)                                |
| `CMS.ViewTracker`          | synchronous implemented      | `CMS.ViewTracker`             | tracking identity、有效阅读策略、watermark、receipt 与当前 views | [View 同步计数](../feature/view-tracker/article-view-counting.md) |
| `CMS.Report`               | planned rename/refactor      | `CMS.AbuseReports`            | `Report.submit` / `withdraw` 与 ReportFact                       | [Report 设计](../feature/reporting/design.md)                     |
| `CMS.Moderation`           | planned                      | 无独立模块                    | ReviewCase、Decision、调用资源正式 command                       | [Report 设计](../feature/reporting/design.md)                     |
| `Analysis.ArticleInsights` | mixed                        | `Analysis.ArticleInsights`    | Article 业务指标的时间桶与产品查询                               | [Article Insights V1](../feature/analysis/article-insights-v1.md) |
| `Analysis.Web`             | existing，后续阶段未全部完成 | `Analysis.Web`                | Umami provider adapter、权限与 Groupher DTO                      | [Web Analysis V2](../umami/web-analysis-v2.md)                    |
| `Activity`                 | existing                     | `Activity`                    | 发布、审核、状态变化等业务活动历史                               | [Activity V1](../feature/activity/v1.md)                          |
| `Sentinel`                 | planned                      | 无运行时模块                  | 自动内容风险检测与信号输出                                       | [Sentinel V1](../infra/diagnostics/sentinel-v1.md)                |

第三方分析集成是已经实现的 Dashboard 能力：Community 可以接入 Google Analytics、GTM、
Clarity、Plausible 或 Fathom。它们由用户自己的平台采集和解释，不是 `Analysis.ArticleInsights`
的数据源，也不与 Groupher 的有效阅读口径强行对齐。参见 [第三方分析集成](../umami/integration.md)。

`GroupherServer.RequestActor` 是平台级请求主体分类 owner，不归属任何单一业务 Context。它的 `Const` 拥有
`actor_type/confidence/classified_by` 封闭词表，`classify/1` 是唯一公共分类入口，输出
`RequestActor.Classification`。ViewTracker、Interaction、Comment、Analysis 和未来消费者只读取同一个分类结果；
RequestActor 不拥有 tracking key、counted policy、权限或内容输出。`Analysis.Const.actor_dimension` 在真实 actor type
之外增加仅供聚合使用的 `all`。旧 `Actor.Const` 与 `CMS.ViewTracker.Classifier` 已删除，不保留 delegate 或 alias。
该归属遵守
[后端 Const 与模式匹配规则](../rules/backend-const-and-pattern-matching.md) 的明确 owner 要求。

`Helper.ORM` 同样不是 CMS 业务领域。普通领域写入默认使用 Ecto；advisory transaction lock 等 Ecto 没有等价 API 的
PostgreSQL 原语集中在职责明确的 `Helper.ORM.*` 模块。仓库不建立 `Database.*`、`GroupherServer.ORM` 或兼容 wrapper。
完整 API、注释和静态门禁要求见 [ORM 与数据库原语边界](./orm.md)。
