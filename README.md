# Groupher

Groupher 是面向团队和社区的内容、知识与反馈协作平台。组织可以建立独立品牌的
Community，统一管理文章、Docs、Changelog、评论、互动、成员和通知，并通过 Dashboard
完成内容运营、权限控制、审核、导入与数据分析。平台也提供官方内容站点、社区申请、统一
认证，以及面向机器消费的 Markdown、Feed 和 sitemap 输出。

## 面向客户

主要服务于 SaaS 公司、开源项目、开发者工具、产品团队和专业服务组织，适合需要长期经营
用户关系与知识资产，同时收集反馈、发布路线图、沉淀产品决策的团队。访客负责浏览和参与，
运营者通过 Dashboard 管理社区与内容。

## 技术栈

前端采用 React 19、TypeScript、TanStack Start/Router、TanStack Query、GraphQL、Tailwind
CSS 和 pnpm workspace。核心后端采用 Elixir、Phoenix、Absinthe、Ecto 与 PostgreSQL，保持
模块化单体并作为业务与数据权威入口。Node.js/Hono 用于 Gateway、Auth、Press、内容导入和
媒体服务，Python/FastAPI 用于文档转换，Oban 处理异步任务；测试覆盖 Vitest、Playwright、
ExUnit 与 Pytest。

## 部署与目录

Cloudflare Workers 承载 Edge Router、Landing、Community、Dash、Apply、Auth 等边缘应用，
通过 Worker Routes 和 Service Bindings 统一入口；Phoenix API 与 Press 使用 Docker 部署到
Fly.io，数据使用 PostgreSQL。GitHub Actions 负责类型检查、契约校验、测试和构建验证；本地
可通过 Dev Hub、Gateway、Portless 启动多服务。`frontend/` 为前端，`backend/` 为后端与独立
服务，`packages/` 为共享契约，`infra/`、`ops/` 为基础设施，`docs/` 为项目文档。部署细节见
[`docs/deploy/README.md`](docs/deploy/README.md)。
