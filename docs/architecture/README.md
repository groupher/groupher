# Architecture

> 状态：current

本目录记录跨应用或跨领域的工程规则、架构决策和技术迁移。能够明确归属于某个业务领域
或独立应用的文档，应放入对应目录。

- 工程规则统一收录在 [`docs/rules/`](../rules/)，入口见 [`be.md`](../rules/be.md) 与 [`fe.md`](../rules/fe.md)。
- [`bundle-size/`](./bundle-size)：产物体积基线与优化记录。
- [`performance/`](./performance)：复杂度与性能审计。
- [`query-store-boundary.md`](./query-store-boundary.md)：Query、Store、Draft 与缓存边界。
- [`resource-loading-boundary.md`](./resource-loading-boundary.md)：CMS resource loading 合同。
- [`error-cat.md`](./error-cat.md)：领域错误目录、全局注册和协议边界。
- [`seo.md`](./seo.md)：搜索索引与规范 URL。
- [`ssr-theme.md`](./ssr-theme.md)：SSR 首次绘制主题边界。
