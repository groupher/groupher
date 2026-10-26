# GraphQL Mock Server

> 状态：current

本文说明 `frontend/mock-server` 的职责、使用场景，以及它和正式 GraphQL schema 的关系。

## 职责边界

Mock Server 是本地 GraphQL fixture 服务，不连接 Groupher 数据库，也不执行 Phoenix 后端的业务规则、授权或持久化。它根据 `frontend/mock-server/src/mocks.js` 中的 fixture 和 resolver 返回模拟响应，用于让前端在不依赖真实业务数据的场景下运行。

```text
普通本地开发
前端应用 ──> Phoenix GraphQL ──> Groupher 数据库

隔离 UI 开发 / 部分 E2E
前端应用 ──> Mock Server ──> 固定 fixtures

生产环境
前端应用 ──> API Gateway ──> Phoenix GraphQL ──> Groupher 数据库
```

普通本地开发默认使用 Phoenix。前端客户端的本地 GraphQL endpoint 是 `http://localhost:4001/graphiql`；本地启动 Phoenix 时，它提供这个 endpoint。启动 Mock Server 也是显式操作，或由特定 E2E 配置启动，不会替换普通开发的数据源。

Mock Server 适合隔离渲染、交互和固定响应下的前端测试。涉及真实数据、权限、mutation、副作用、Session 行为或数据库持久化时，应使用 Phoenix 和相应测试环境；Mock Server 的成功响应不能证明这些后端行为正确。

## 启动方式

在仓库根目录执行：

```sh
pnpm run mock:server
```

也可以使用 `pnpm --filter @groupher/mock-server run dev` 启动。默认监听 `4001`，GraphQL endpoint 为 `/graphiql`。Mock Server 与本地 Phoenix 使用相同默认端口，因此应按当前运行场景选择其中一个；需要并行运行时，可通过 `MOCK_GRAPHQL_PORT` 为 Mock Server 指定其他端口，并让前端 endpoint 指向同一端口。

## E2E 中的使用

`frontend/e2e/playwright.config.ts` 按测试应用选择后端：

- Dash 等默认 E2E 场景启动 Mock Server，并把前端 GraphQL endpoint 指向它。
- Auth E2E 在 `4104` 启动带 auth fixture 的 Mock Server，再由前端和 auth E2E 服务共同使用。
- Community E2E 启动 Phoenix，并使用真实 GraphQL 服务。
- Landing E2E 不依赖 GraphQL Mock Server。

因此，Mock Server 是部分 E2E 场景的 fixture 后端，也是可选的隔离 UI 开发工具；它不是所有前端测试或日常开发的统一后端。

## Schema 来源

`backend/api/schema.graphql` 是唯一 GraphQL SDL 来源。Mock Server、前端 schema 测试和 Codegen 都以它为准，不维护第二份 schema 内容。

`frontend/mock-server/schema.graphql` 是指向 `backend/api/schema.graphql` 的已跟踪软链接。Mock Server 默认从该路径读取 SDL；路径缺失时才回退到后端 schema 路径。运行以下命令会从 Absinthe 重新生成后端 SDL，并重建软链接：

```sh
make be.gen.schema
```

GraphQL contract 检查会验证该路径仍是软链接，且最终解析到 `backend/api/schema.graphql`。不要把独立导出的 SDL 副本放进 Mock Server 目录，否则 fixture 服务可能悄悄使用过时的 API 合同。

## 相关代码

- `frontend/mock-server/src/index.js`：读取 SDL、组合 resolver 和 mock、启动 HTTP GraphQL 服务。
- `frontend/mock-server/src/mocks.js`：模拟响应和场景状态。
- `frontend/e2e/playwright.config.ts`：为 E2E 选择 Phoenix 或 Mock Server。
- `Makefile` 的 `be.gen.schema`：生成后端 SDL 并重建 mock schema 软链接。
- `contracts/graphql/scripts/assert-graphql-contract.mjs`：检查 schema 软链接的目标。
