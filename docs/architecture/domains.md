# 主要领域与模块命名

> 状态：目标架构，实施状态 mixed。
>
> 本文使用目标领域命名，不表示所有模块均已实现。

本文回答“某项能力最终归谁所有”，同时标出当前代码中的对应模块。具体模型、事务和迁移步骤以链接的
Feature 文档为准。

`ArticleStats` 不是新的业务领域：它是跨 `ViewTracker`、`Interactions` 和 Article/Comment 读取投影的公共
统计 DTO 与 Query cache 边界。它的命名、SSR hydration、缓存 TTL 和 tracking 判断见
[ArticleStats 与公共页面缓存](./article-stats-and-public-cache.md)。

```text
CMS
├─ Interactions       普通用户反应：upvote / collect / emotion
├─ ViewTracker        Article 有效阅读的识别、分类、去重和计数
├─ Report             用户提交或撤销举报事实
└─ Moderation         审核工作单、审核决定与资源处置编排

Analysis
├─ ArticleInsights    Groupher 自有业务指标的小时趋势与维度查询
└─ Web                外部 Web Analytics provider 的适配和读取边界

Activity              低频、可解释的业务活动历史，不承担高频统计
Sentinel              自动识别违法、违规或高风险内容，并产生风险信号
```

## 边界速查

| 目标模块                   | 实施状态                     | 当前对应模块               | 最终拥有                                                      | 详细设计                                                          |
| -------------------------- | ---------------------------- | -------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `CMS.Interactions`         | existing，V5 partial         | `CMS.Interactions`         | upvote、collect、emotion 的事实与同步读取状态                 | [Interaction V5](../feature/interaction/v5.md)                    |
| `CMS.ViewTracker`          | mixed                        | `CMS.ViewTracker`          | viewer identity、actor 分类、有效阅读策略、阅读事件与当前计数 | [ViewTracker V1](../feature/view-tracker/v1.md)                   |
| `CMS.Report`               | planned rename/refactor      | `CMS.AbuseReports`         | `Report.submit` / `withdraw` 与 ReportFact                    | [Report 设计](../feature/reporting/design.md)                     |
| `CMS.Moderation`           | planned                      | 无独立模块                 | ReviewCase、Decision、调用资源正式 command                    | [Report 设计](../feature/reporting/design.md)                     |
| `Analysis.ArticleInsights` | mixed                        | `Analysis.ArticleInsights` | Article 业务指标的时间桶与产品查询                            | [Article Insights V1](../feature/analysis/article-insights-v1.md) |
| `Analysis.Web`             | existing，后续阶段未全部完成 | `Analysis.Web`             | Umami provider adapter、权限与 Groupher DTO                   | [Web Analysis V2](../umami/web-analysis-v2.md)                    |
| `Activity`                 | existing                     | `Activity`                 | 发布、审核、状态变化等业务活动历史                            | [Activity V1](../feature/activity/v1.md)                          |
| `Sentinel`                 | planned                      | 无运行时模块               | 自动内容风险检测与信号输出                                    | [Sentinel V1](../infra/diagnostics/sentinel-v1.md)                |

第三方分析集成是已经实现的 Dashboard 能力：Community 可以接入 Google Analytics、GTM、
Clarity、Plausible 或 Fathom。它们由用户自己的平台采集和解释，不是 `Analysis.ArticleInsights`
的数据源，也不与 Groupher 的有效阅读口径强行对齐。参见 [第三方分析集成](../umami/integration.md)。

`GroupherServer.Actor` 是有意新增的平台级访问者协议 owner，不归属任何单一业务 Context；它的
`Actor.Const` 拥有跨 producer 使用的 `actor_type` 存储与查询词表。这不是无 owner 的共享常量例外：
协议词表归 Actor，访问者分类策略归 `CMS.ViewTracker.Classifier`，指标维度归 Analysis。ViewTracker、
Interaction、Comment 和 Analysis 都引用同一 actor 词表；`Analysis.Const.actor_dimension` 在真实 actor type
之外增加仅供聚合使用的 `all`。该归属遵守
[后端 Const 与模式匹配规则](../rules/backend-const-and-pattern-matching.md) 的明确 owner 要求。
