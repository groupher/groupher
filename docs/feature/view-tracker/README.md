# ViewTracker

> 状态：mixed。

- [`v1.md`](./v1.md)：Article 有效阅读的独立领域合同；V1 已落地，生产 Cookie、密钥和观测仍需部署验收。
- [`v2.md`](./v2.md)：planned；将当前 views 从 Article 宽表迁到 ViewTracker 独立 Summary，统一列表与 Drawer 的读取缓存，并收口阅读资格、投影失败与级联清理。
- [`../../architecture/article-stats-and-public-cache.md`](../../architecture/article-stats-and-public-cache.md)：ArticleStats 公共计数、SSR hydration、HTML/CDN 缓存和 tracking 判断；其中的前端缓存合同 supersede V2 的旧 placeholder/15 秒读取描述。
- [Article Insights V1](../analysis/article-insights-v1.md)：消费有效阅读及其他业务指标，形成小时趋势。
