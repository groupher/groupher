# ViewTracker

> 状态：同步计数协议已落地；生产边缘限流、观测与真实并发压测待发布验收。

- [`v1.md`](./v1.md)：Article 有效阅读的独立领域合同；V1 已落地，生产 Cookie、密钥和观测仍需部署验收。
- [`v2.md`](./v2.md)：已删除异步实现的历史合同，仅用于解释旧 `ViewEvent/ViewSummary/Oban` 设计，不是当前实现。
- [`../../architecture/article-stats-and-public-cache.md`](../../architecture/article-stats-and-public-cache.md)：ArticleStats 公共计数、SSR hydration、HTML/CDN 缓存和 tracking 判断；其中的前端缓存合同 supersede V2 的旧 placeholder/15 秒读取描述。
- [`../../architecture/article-stats-target.md`](../../architecture/article-stats-target.md)：canonical Article identity、可排序 ArticleStats 投影、revision vector 与 drift repair 的目标架构。
- [`article-view-counting.md`](./article-view-counting.md)：当前唯一 views 写协议；`ViewDedupeState`、ArticleStats、ViewerState 与 MetricEvent 同步事务，GraphQL 只返回 `tracked + state`。
- [`article-view-counting-simplification.md`](./article-view-counting-simplification.md)：已实施的 direct-cutover 设计记录；删除 View transport receipt 与客户端幂等 ID，统一 RequestActor 和前端 Article 状态组装。
- [`../../architecture/article-stats-and-viewer-state-sync.md`](../../architecture/article-stats-and-viewer-state-sync.md)：已实施的写后同步合同；mutation 返回完整公共 ArticleStats 与 owner-specific private state，前端不再使用 entity 中转 cache 与 per-article disabled observers。
- [`cloudflare-abuse-protection-todo.md`](./cloudflare-abuse-protection-todo.md)：独立的 Edge rate limit、Bot/crawler evidence、origin 收口与生产观测 backlog。
- [`../../architecture/request-actor.md`](../../architecture/request-actor.md)：ViewTracker 消费的平台级 human/agent/crawler/unknown 分类；不在领域内重复分类。
- [Article Insights V1](../analysis/article-insights-v1.md)：消费有效阅读及其他业务指标，形成小时趋势。
