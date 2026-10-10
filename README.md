# Groupher

Groupher 是一套面向产品团队的用户社区与内容运营平台，帮助 SaaS 公司、开源项目和
开发者工具建立自己的品牌社区，把用户反馈、产品文档、更新日志和客户沟通放在同一个
产品空间中持续运营。

## 项目介绍

很多团队的反馈散落在邮件、工单、聊天群和表格里，文档与版本更新又分布在不同系统，导致
用户无法看到产品进展，团队也难以判断哪些问题最值得优先解决。Groupher 提供一个可配置、
可持续维护的社区入口：用户可以浏览内容、提交建议、评论、互动和追踪进展；产品、支持和
运营团队则可以在后台管理文章、Docs、Changelog、社区成员、权限、审核、导入和数据分析。

## 适用客户

- SaaS 产品和开发者工具：建设帮助中心、反馈中心与公开路线图。
- 开源项目：沉淀文档、发布版本动态，并维护贡献者社区。
- 产品与客户成功团队：集中收集客户声音，公开处理进度，减少重复沟通。
- 专业服务和多产品组织：为不同业务建立独立社区，同时统一运营和认证能力。

## 核心能力

Groupher 由公开 Community、内容管理 Dashboard、社区申请 Apply、统一认证 Auth 以及
内容发布、导入、媒体和格式转换服务组成。平台支持文章、Docs、Changelog、评论、互动、
成员与通知等完整内容链路，并通过 GraphQL API、Markdown、Feed 和 sitemap 服务网页与
其他系统消费。

## 子应用

每个已落地子应用的运行边界、本地命令和相关文档入口如下：

| 子应用             | 代码目录与 README                                          | 定位                               |
| ------------------ | ---------------------------------------------------------- | ---------------------------------- |
| Landing            | [`frontend/landing`](frontend/landing)                     | 官网与产品信息站点                 |
| Community          | [`frontend/community`](frontend/community)                 | 面向访客的公开社区                 |
| Dash               | [`frontend/dash`](frontend/dash)                           | 管理员与运营工作台                 |
| Apply              | [`frontend/apply`](frontend/apply)                         | 社区申请与创建流程                 |
| Widget             | [`frontend/widget`](frontend/widget)                       | 可嵌入的社区组件                   |
| Inspire Me         | [`frontend/inspire-me`](frontend/inspire-me)               | 反馈平台研究工具                   |
| Auth               | [`backend/auth`](backend/auth)                             | OAuth、登录与会话边界              |
| Phoenix API        | [`backend/api`](backend/api)                               | 账户、CMS、权限与 GraphQL 领域后端 |
| Assets Hub         | [`backend/assets-hub`](backend/assets-hub)                 | 上传、对象访问与媒体执行层         |
| Content Import     | [`backend/content-import`](backend/content-import)         | 外部内容导入与标准化               |
| Document Converter | [`backend/document-converter`](backend/document-converter) | 单文档格式转换                     |
| Press              | [`backend/press`](backend/press)                           | 官方内容的缓存友好输出             |
| Dev Gateway        | [`infra/dev-gateway`](infra/dev-gateway)                   | 本地开发入口与代理                 |
| Edge Router        | [`infra/edge-router`](infra/edge-router)                   | Cloudflare 生产边缘路由            |
| Status             | [`ops/status`](ops/status)                                 | 公共状态页与可用性监控             |

规划中的 `AI`、`Posthouse` 和 `Risk Center` 尚未作为独立代码应用落地，当前边界与实施
状态以 [`docs/ai`](docs/ai)、[`docs/posthouse`](docs/posthouse) 和
[`docs/risk-center`](docs/risk-center) 为准；完整应用划分见
[`docs/architecture/apps.md`](docs/architecture/apps.md)。

共享与开发支持组件也各自维护 README：[`frontend/core`](frontend/core)、
[`frontend/mock-server`](frontend/mock-server)、[`local/dev-hub`](local/dev-hub)、
[`packages/contracts`](packages/contracts)、[`packages/service`](packages/service)、
[`packages/route-contract`](packages/route-contract) 和
[`packages/artiment-publisher`](packages/artiment-publisher)。

## 技术与部署

前端采用 React、TypeScript、TanStack Start/Router、TanStack Query、GraphQL、Tailwind CSS
和 pnpm workspace；核心后端采用 Elixir、Phoenix、Absinthe、Ecto、Oban 与 PostgreSQL，
以模块化单体维护账户、CMS、权限和业务数据。Node.js/Hono 承载 Gateway、Auth、Press 等
独立服务，Python/FastAPI 承载文档转换。生产环境使用 Cloudflare Workers 承载边缘应用，
Phoenix API 与 Press 通过 Docker 部署在 Fly.io；GitHub Actions 负责测试、类型检查、契约
校验和构建验证。

代码位于 `frontend/`、`backend/`、`packages/`、`infra/` 和 `ops/`，架构与部署说明见
[`docs/`](docs/) 和 [`docs/deploy/README.md`](docs/deploy/README.md)。
