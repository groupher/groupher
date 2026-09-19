# ViewTracker

> 状态：mixed。

- [`v1.md`](./v1.md)：Article 有效阅读的独立领域合同；V1 已落地，生产 Cookie、密钥和观测仍需部署验收。
- [`v2.md`](./v2.md)：核心实现与定向测试完成；当前 views 已迁到 ViewTracker 独立 `ViewSummary`，待真实环境验收。
- [`../../architecture/article-stats-and-public-cache.md`](../../architecture/article-stats-and-public-cache.md)：ArticleStats 公共计数、SSR hydration、HTML/CDN 缓存和 tracking 判断；其中的前端缓存合同 supersede V2 的旧 placeholder/15 秒读取描述。
- [`../../architecture/article-stats-target.md`](../../architecture/article-stats-target.md)：本次直接落地的 canonical Article、可排序 ArticleStats 投影、revision vector 与 drift repair。
- [`../../architecture/request-actor.md`](../../architecture/request-actor.md)：ViewTracker 消费的平台级 human/agent/crawler/unknown 分类；不在领域内重复分类。
- [Article Insights V1](../analysis/article-insights-v1.md)：消费有效阅读及其他业务指标，形成小时趋势。
