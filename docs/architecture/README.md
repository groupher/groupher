# Architecture

> 状态：current

本目录记录跨应用或跨领域的工程规则、架构决策和技术迁移。能够明确归属于某个业务领域
或独立应用的文档，应放入对应目录。

- 工程规则统一收录在 [`docs/rules/`](../rules/)，入口见 [`be.md`](../rules/be.md) 与 [`fe.md`](../rules/fe.md)。
- [`apps.md`](./apps.md)：独立运行应用、平台能力和业务 Feature 的划分原则。
- [`external-services-local-runtime.md`](./external-services-local-runtime.md)：外部依赖服务的本地等价实现、统一 Dev Hub 编排和线上/本地运行时边界。
- [`backend-context-convention-over-configuration.md`](./backend-context-convention-over-configuration.md)：
  Backend Context、Facade、Owner 和可执行 lint 的通用设计。
- [`backend-effects-and-job-contract.md`](./backend-effects-and-job-contract.md)：Effects、durable Job payload
  和 Worker 调用边界。
- [`bundle-size/`](./bundle-size)：产物体积基线与优化记录。
- [`performance/`](./performance)：复杂度与性能审计。
- [`query-store-boundary.md`](./query-store-boundary.md)：Query、Store、Draft 与缓存边界。
- [`query-invalidation.md`](./query-invalidation.md)：TanStack Query typed target、领域 key resolver 与通用失效 executor。
- [`frontend-account-passport-gate.md`](./frontend-account-passport-gate.md)：AccountStore、Passport、前端 Gate 与各应用的认证策略。
- [`account-identity.md`](./account-identity.md)：`login`、`nickname`、`user.id` 的身份边界。
- [`contracts.md`](./contracts.md)：跨运行时 contract 的归属、生成、freshness 与 Gate Action 目标合同。
- [`protocol-constants.md`](./protocol-constants.md)：前端裸写协议字符串的历史审计和现有归属记录。
- [`policy.md`](./policy.md)：后端 Policy 的准入决策职责，以及与 Gate、Lifecycle、Config、Workflow 和 Persist 的边界。
- [`orm.md`](./orm.md)：`Helper.ORM` namespace、Ecto 默认写入、AdvisoryLock API 与裸 SQL 边界。
- [`pagination.md`](./pagination.md)：统一 offset/cursor 分页、Flop adapter、Lite read model、领域 Query 目录与 N+1 门禁。
- [`article-stats-and-public-cache.md`](./article-stats-and-public-cache.md)：ArticleStats 公共计数、SSR hydration、HTML/CDN 缓存和 tracking 判断。
- [`article-stats-target.md`](./article-stats-target.md)：ArticleStats 模型 direct-cutover 的历史设计记录；
  当前合同以 `article-stats-and-public-cache.md` 为准。
- [`article-emotion-counts.md`](./article-emotion-counts.md)：emotion typed-row 和 GraphQL 改名的历史
  direct-cutover 记录。
- [`../feature/view-tracker/article-view-counting.md`](../feature/view-tracker/article-view-counting.md)：Article view 当前唯一写协议、actor-specific 阅读资格、同步 UPSERT 与未来高流量方案的另立版本门槛。
- [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md)：已落地的 Article 写后完整 ArticleStats、owner-specific private state、前端 owner-wise merge 与多 surface 同步合同。
- [`article-stats-view-chain-audit.md`](./article-stats-view-chain-audit.md)：ArticleStats/View 已实施的历史
  全链路审计与收口记录。
- [`request-actor.md`](./request-actor.md)：平台级 human/agent/crawler/unknown 请求主体分类能力。
- [`public-cache-invalidation.md`](./public-cache-invalidation.md)：PublicCache tag/provider 约束及历史独立
  invalidation 状态机；CMS 当前可靠投递以 `cms-outbox.md` 为准。
- [`resource-loading-boundary.md`](./resource-loading-boundary.md)：CMS resource loading 合同。
- [`cms-query-v2.md`](./cms-query-v2.md)：CMS Reader/List 向 Query、Store/Facts、Projection 收口，以及与 FrontDesk 的互补边界。
- [`cms-context-module-architecture.md`](./cms-context-module-architecture.md)：CMS Context 的 specialization、ownership、调用路径与共享基础设施边界；通用模块结构见 [`be-context-module-structure.md`](../rules/be-context-module-structure.md)。
- [`cms-facade-directory.md`](./cms-facade-directory.md)：CMS internal capability Facade 的历史拆分与实施记录。
- [`cms-multi-entry-boundary.md`](./cms-multi-entry-boundary.md)：GraphQL、CLI、MCP 与 Plugin 复用同一 CMS facade 和领域用例的多入口架构。
- [`graphql-resolver-boundary.md`](./graphql-resolver-boundary.md)：GraphQL resolver 越界审计、目标职责和 R1-R5 完成结果。
- [`cms-outbox.md`](./cms-outbox.md)：当前 CMS Domain Outbox、typed event、Jobs Worker、Workflow 和
  provider effect 边界；不建立 Dispatcher 或动态 handler registry。
- [`cms-command.md`](./cms-command.md)：CMS 用户写命令、Receipt 幂等与 Confirmation 边界。
- [`cms-write-boundary-contract.md`](./cms-write-boundary-contract.md)：CMS Command 的 receipt/write/workflow
  pipeline 目标合同、Gate/事务边界、编译后 contracts 与纯 Elixir 调用图检查，以及当前实现与自动化缺口。
- [`cms-command-confirmation.md`](./cms-command-confirmation.md)：Confirmation codec、Receipt JSON、
  recovery 与 retention 子协议。
- [`cms-command-v3.md`](./cms-command-v3.md)：Confirmation 与提交后 result builder 的历史实施记录；
  当前合同已合并到前两篇。
- [`content-publisher.md`](./content-publisher.md)：Plate/Markdown 到 canonical BodyBag、可信 Node
  Publisher、delegated user、service capability，以及 Docs、Article、Comment 原子写入的当前合同。
- [`ci-contract-gaps.md`](./ci-contract-gaps.md)：GraphQL operation、Command Receipt、Outbox、scope、并发与分页的 CI/测试覆盖缺口及门禁计划。
- [`error-cat.md`](./error-cat.md)：领域错误目录、全局注册和协议边界。
- [`orm-raw-sql-inventory.md`](./orm-raw-sql-inventory.md)：仍需保留或收口的裸 SQL 清单与 owner 判断。
- [`domains.md`](./domains.md)：主要业务领域的命名、职责和详细设计入口。
- [`seo.md`](./seo.md)：搜索索引与规范 URL。
- [`ssr-theme.md`](./ssr-theme.md)：SSR 首次绘制主题边界。
