# Architecture

> 状态：current

本目录记录跨应用或跨领域的工程规则、架构决策和技术迁移。能够明确归属于某个业务领域
或独立应用的文档，应放入对应目录。

- 工程规则统一收录在 [`docs/rules/`](../rules/)，入口见 [`be.md`](../rules/be.md) 与 [`fe.md`](../rules/fe.md)。
- [`bundle-size/`](./bundle-size)：产物体积基线与优化记录。
- [`performance/`](./performance)：复杂度与性能审计。
- [`query-store-boundary.md`](./query-store-boundary.md)：Query、Store、Draft 与缓存边界。
- [`query-invalidation.md`](./query-invalidation.md)：TanStack Query typed target、领域 key resolver 与通用失效 executor。
- [`orm.md`](./orm.md)：`Helper.ORM` namespace、Ecto 默认写入、AdvisoryLock API 与裸 SQL 边界。
- [`article-stats-and-public-cache.md`](./article-stats-and-public-cache.md)：ArticleStats 公共计数、SSR hydration、HTML/CDN 缓存和 tracking 判断。
- [`article-stats-target.md`](./article-stats-target.md)：本次改造的 canonical Article、ArticleStats 读取投影、排序索引与修复协议。
- [`article-emotion-counts.md`](./article-emotion-counts.md)：canonical Article identity 后的 emotion typed-row、GraphQL 改名与 direct cutover。
- [`../feature/view-tracker/article-view-counting.md`](../feature/view-tracker/article-view-counting.md)：Article view 当前唯一写协议、actor-specific 阅读资格、同步 UPSERT 与未来高流量方案的另立版本门槛。
- [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md)：已落地的 Article 写后完整 ArticleStats、owner-specific private state、前端 owner-wise merge 与多 surface 同步合同。
- [`article-stats-view-chain-audit.md`](./article-stats-view-chain-audit.md)：ArticleStats/View 已实施的全链路审计与收口记录。
- [`request-actor.md`](./request-actor.md)：平台级 human/agent/crawler/unknown 请求主体分类能力。
- [`public-cache-invalidation.md`](./public-cache-invalidation.md)：Phoenix 领域事务 outbox、Oban worker 和 Cloudflare cache-tag purge 的可靠失效协议。
- [`resource-loading-boundary.md`](./resource-loading-boundary.md)：CMS resource loading 合同。
- [`cms-multi-entry-boundary.md`](./cms-multi-entry-boundary.md)：GraphQL、CLI、MCP 与 Plugin 复用同一 CMS facade 和领域用例的多入口架构。
- [`cms-outbox.md`](./cms-outbox.md)：统一 Domain Outbox、typed event、Dispatcher 与 PublicCache Cleanup 等消费边界。
- [`error-cat.md`](./error-cat.md)：领域错误目录、全局注册和协议边界。
- [`domains.md`](./domains.md)：主要业务领域的命名、职责和详细设计入口。
- [`seo.md`](./seo.md)：搜索索引与规范 URL。
- [`ssr-theme.md`](./ssr-theme.md)：SSR 首次绘制主题边界。
