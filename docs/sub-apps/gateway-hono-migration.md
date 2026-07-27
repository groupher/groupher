# Gateway Hono 迁移评估

> 运行形态：独立 Node/Hono reverse proxy
>
> UI：无独立 UI
>
> 当前状态：Hono 迁移已开始，核心 routing/proxy/app 结构已落到 `backend/gateway/src`

本文是 [`docs/gateway.md`](../gateway.md) 的 Hono 落地方案。Gateway 的首期实现
直接在 Hono/Node 范围内解决，不为 NGINX、Envoy、Worker、API Gateway 等短期不会
使用的 runtime 设计额外抽象。

## 目标

`backend/gateway` 当前只是一个全局入口和路由分发层，但运行在完整 Next.js
runtime 上。目标是把它一次性迁移为独立 Hono gateway，保留现有用户可见 URL 和
分流规则，移除 Next.js 依赖、`.next` 构建产物和 `NextResponse.rewrite` 运行时。

本迁移不做双运行时兼容、不保留旧 Next gateway 的 fallback，也不引入长期
adapter。切换前可以使用 preview 或临时域名做验收；正式切换时直接以 Hono
实现替换 Next 实现。

## 当前 Gateway 职责

迁移前入口位于 `backend/gateway/proxy.ts`，辅助规则位于
`backend/gateway/utils.ts`。迁移后的入口位于 `backend/gateway/src/app.ts`，纯路由决策
位于 `backend/gateway/src/routing.ts`，代理执行位于 `backend/gateway/src/proxy.ts`。

| 输入                          | 当前行为                                                  | 目标 Hono 行为                                     |
| ----------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| `/api/auth/*`                 | rewrite 到 `AUTH_SITE`                                    | reverse proxy 到 `AUTH_SITE`                       |
| `/api/graphql`                | rewrite 到 `API_SITE/graphiql`                            | reverse proxy 到 `API_SITE/graphiql`               |
| `main.*` host                 | rewrite 到 `MAIN_SITE`                                    | reverse proxy 到 `MAIN_SITE`                       |
| `landing.*` host              | rewrite 到 `LANDING_SITE`                                 | reverse proxy 到 `LANDING_SITE`                    |
| `dashboard.*` host            | rewrite 到 `DASHBOARD_SITE`，保留原始 path                | reverse proxy 到 `DASHBOARD_SITE`，保留原始 path   |
| `/:community/dashboard/...`   | 去掉第二段 `dashboard` path segment 后进入 Dashboard      | 同样裁剪第二段 `dashboard` 后 reverse proxy        |
| `/dashboard/_next/static/*`   | rewrite 到 Dashboard                                      | reverse proxy 到 Dashboard                         |
| `/landing/_next/static/*`     | rewrite 到 Landing                                        | reverse proxy 到 Landing                           |
| `/`、`/pricing`、`/book-demo` | rewrite 到 Landing                                        | reverse proxy 到 Landing                           |
| 其他路径                      | rewrite 到 Main；`/xxx/settings/dashboard` 不能误判为 Dsb | reverse proxy 到 Main；保留同样的非 dashboard 边界 |

GraphQL 入口还有一个安全边界：浏览器请求当前域 `/api/graphql`，Gateway 删除浏览器
传入的 `authorization` 和原始 `cookie`，只把 HttpOnly `groupher-auth.token`
以同名 Cookie 转发给 Phoenix。这个行为必须逐字保留。

`groupher-auth.token` 必须来自共享 auth contract，即
`frontend/core/constant/auth-contract.ts` 的 `GROUPHER_AUTH_TOKEN_COOKIE`。迁移时可以像
`backend/auth` 一样让 gateway workspace 依赖 `@groupher/frontend-core`；如果后续需要
减小依赖面，再把 auth contract 提到更小的共享包。首期不要在 gateway 内复制 cookie
字符串。

## 为什么适合迁移

Gateway 没有页面、RSC、image pipeline、metadata、Next data fetching 或 App Router
业务能力。它需要的是：

- 全路径 HTTP handler。
- host/path/query 规则判断。
- header 和 cookie 清洗。
- upstream response 透传。
- `/health`、`robots.txt`、`sitemap.xml`、`manifest.json` 等低成本静态响应。

这些能力都可以用 Hono 和标准 `Request` / `Response` 表达。仓库里的 `backend/auth`
已经使用 `src/app.ts`、`src/server.ts`、`index.ts` 的 Hono 结构，Gateway 应该复用同
一种子应用运行模型。

## POC 结论

POC 使用临时目录 `/tmp/hono-gateway-poc`，安装版本：

```text
hono@4.12.32
@hono/node-server@2.0.12
```

验证项：

| 项目                | 结论                            | 实施要求                                                               |
| ------------------- | ------------------------------- | ---------------------------------------------------------------------- |
| GraphQL POST 透传   | 可行                            | 必须显式传 `method`、`headers`、`body`                                 |
| GraphQL Cookie 清洗 | 可行                            | 只转发 `groupher-auth.token`，删除 `authorization` 和其他 Cookie       |
| Node request body   | 可行                            | 带 body 的代理请求需要 `duplex: 'half'`                                |
| redirect            | 默认会 follow upstream redirect | Auth/OAuth 路径必须设置 `redirect: 'manual'`                           |
| `Set-Cookie`        | 可以透传                        | 需要真实浏览器验证多 Cookie 行在部署平台上的表现                       |
| streaming response  | 可以透传                        | 需要用真实 upstream 验证 RSC/static/data 响应                          |
| Hono proxy 写法     | 可行但容易误用                  | 不能写 `honoProxy(url, { ...c.req.raw })`，因为 `Request` 属性不可枚举 |
| Node fetch response | 会自动解压 gzip/br body         | 不能原样透传 `content-encoding` 和旧 `content-length`                  |
| dev WebSocket       | 需要 Node upgrade 反代          | Next HMR 的 `/_next/hmr` 不能只走 Hono fetch handler                   |

关键发现：

```ts
return proxy(targetUrl, {
  method: c.req.raw.method,
  headers,
  body: c.req.raw.body,
  redirect: 'manual',
  duplex: 'half',
})
```

如果写成下面这样，POST method/body 不会按预期透传：

```ts
return proxy(targetUrl, {
  ...c.req.raw,
  headers,
})
```

另外，如果不显式使用 `redirect: 'manual'`，Hono proxy 底层的 fetch 会跟随 upstream
302，浏览器拿到的是最终响应而不是原始跳转。这会破坏 Auth.js/OAuth callback、
sign-in 或 logout 这类需要浏览器感知 redirect 的路径。

Node `fetch` 还会自动解压 upstream 的 gzip/br 响应体，但不会替 reverse proxy 删除
upstream 的 `content-encoding`。Gateway 返回给浏览器前必须重建 response headers，
删除 `content-encoding` 和旧 `content-length`；否则浏览器会把明文 HTML 当 gzip 再
解一次，导致页面灰屏或加载失败。

本地开发还需要单独处理 WebSocket upgrade。Hono 的 `fetch` handler 可以覆盖普通
HTTP 请求，但 Next dev HMR 使用 `/_next/hmr` WebSocket；`src/server.ts` 必须监听
Node server 的 `upgrade` 事件，并按同一套 routing 规则把 socket 反代到对应子应用。

### 实现细节评估

以下细节不是迁移阻塞，但需要在 review 中明确：

- `src/upgrade.ts` 会把 upstream host 写入 `Host` header，但不会覆盖已有的
  `x-forwarded-host`。这符合当前需求：路由决策依赖原始 client host 或 Portless
  传入的 `x-forwarded-host`，而 upstream socket 请求需要真实 upstream host。Next HMR
  不依赖 `Host` 做产品路由；如果未来某个 WebSocket upstream 依赖 `Host` 而不是
  `x-forwarded-host` 判断外部域名，需要为该 upstream 明确增加策略测试。
- `src/env.ts` 的 cwd fallback 和 `src/static.ts` 的 `PUBLIC_ROOT` fallback 一致，都是为
  `yarn run dev:gateway` 从 monorepo root 启动、以及从 `backend/gateway` 目录直接启动
  两种方式服务。`src/server.ts` 通过 `import './env'` 提供唯一显式入口，`dev` 和
  `start` 都依赖这个入口加载环境变量。
- `src/static.ts` 返回 `ArrayBuffer` 时使用 `byteOffset/byteLength` 做 slice。这个处理是
  必要的：esbuild bundle 后 `readFile()` 返回的 `Buffer` 可能指向更大的底层
  `SharedArrayBuffer`，直接返回 `content.buffer` 会暴露错误范围。

## 目标代码结构

建议保留 workspace 名称 `@groupher/backend-gateway`，但移除 Next 运行时。

```text
backend/gateway/
  index.ts
  package.json
  tsconfig.json
  src/
    app.ts
    server.ts
    routing.ts
    proxy.ts
    upgrade.ts
    env.ts
    health.ts
    static.ts
    routing.test.ts
    proxy.test.ts
    upgrade.test.ts
    app.test.ts
```

职责划分：

- `src/routing.ts`：纯函数，输入 URL、host、headers，输出 target URL 和转发策略。
- `src/proxy.ts`：把 Hono request 转为 upstream proxy request，处理 header/cookie。
- `src/upgrade.ts`：处理本地 dev WebSocket upgrade，例如 Next HMR。
- `src/app.ts`：Hono routes，包括 `/health`、静态文件和 `app.all('*')`。
- `src/server.ts`：本地 Dev Hub 或独立 Node server 入口，使用 `@hono/node-server`。
- `index.ts`：Vercel Hono 部署入口，`export { default } from './src/app'`。

## 实施步骤

### 1. 抽出路由决策

先把现有 `utils.ts` 和 `proxy.ts` 中的判断收敛为纯函数：

```ts
resolveGatewayTarget({
  pathname,
  search,
  host,
  forwardedHost,
  headers,
})
```

输出类型从 `src/routing.ts` 直接导出，避免迁移文档和代码各自维护一份 target 名称：

```ts
export type GatewayTargetKind = 'main' | 'dashboard' | 'landing' | 'auth' | 'phoenix'
```

输出应包含：

- `targetUrl`
- `targetKind: GatewayTargetKind`
- `preserveRedirect`
- `sanitizeHeaders`
- `requiresBodyProxy`

现有 `proxy.test.ts` 和 `utils.test.ts` 的语义应迁移到这个纯函数测试中。Dashboard
测试必须分别覆盖：

- `dashboard.*` host 保留原始 path，例如 `/home/dashboard` 仍进入 Dashboard
  `/home/dashboard`。
- 普通 host 上的 `/:community/dashboard/...` 裁掉第二段 `dashboard`。
- `/organizations/settings/dashboard`、`/foo/bar/dashboard` 这类路径不进入 Dashboard。

### 2. 建立 Hono app

新增 `src/app.ts`：

- `GET /health` 返回现有 `health.v1` contract，并用
  `contracts/services/health/schemas/v1.schema.json` 做 conformance test。
- `GET /robots.txt`、`GET /sitemap.xml`、`GET /manifest.json` 保持当前公开响应。
- `app.all('*')` 调 `resolveGatewayTarget()`，再执行 `proxy()`。

所有代理请求默认使用：

```ts
{
  method: c.req.raw.method,
  headers: sanitizedHeaders,
  body: shouldForwardBody ? c.req.raw.body : undefined,
  redirect: 'manual',
  duplex: shouldForwardBody ? 'half' : undefined,
}
```

`GET` 和 `HEAD` 不能带 body。

### 3. 替换 workspace runtime

更新 `backend/gateway/package.json`：

- 移除 `next`、`react`、`react-dom`。
- 增加 `hono`、`@hono/node-server`、`tsx`、`esbuild`、`rimraf`。
- `dev` 使用 `tsx watch src/server.ts`。
- `build` 使用和 `backend/auth` 类似的 esbuild Node bundle。
- `type-check` 使用普通 `tsc --noEmit`。

更新 `tsconfig.json`，不再继承 Next typegen 和 `.next/types`。

删除：

- `app/`
- `next-env.d.ts`
- `next.config.js`
- `.next`
- Next 专用 `vercel.json` build 配置

### 4. 调整部署入口

当前 `backend/gateway/vercel.json` 使用 `@vercel/next`。迁移后应改为 Hono/Vercel
默认入口模型，保留独立 gateway 项目，不修改 root-level 多项目部署脚本语义。

Root 级 `frontend/scripts/vercel.build.sh` 仍然按
`yarn workspace @groupher/backend-gateway build` 触发，因此 Gateway 的 `build`
脚本必须继续存在，即使 Vercel Hono 部署本身可以零配置。

### 5. 验证

单元测试：

```bash
yarn workspace @groupher/backend-gateway test
yarn workspace @groupher/backend-gateway type-check
yarn workspace @groupher/backend-gateway build
```

本地 smoke：

```text
GET /
GET /pricing
GET /book-demo
GET /home
GET /home/dashboard
GET /home/dashboard/appearance/kanban
GET /organizations/settings/dashboard
GET /dashboard/_next/static/...
GET /landing/_next/static/...
GET /api/auth/signin/github
GET /api/auth/callback/github
POST /api/graphql
GET /health
GET /robots.txt
GET /sitemap.xml
GET /manifest.json
```

浏览器验证必须覆盖：

- 从 Main 发起登录并回到 Main。
- 从 Dashboard 发起登录并回到 Dashboard。
- Dashboard 页面 GraphQL 请求只携带 `groupher-auth.token`。
- Dashboard nested path 不丢失 path segment。
- 非第二段 `dashboard` 的路径继续走 Main，不被 dashboard 子串误判。
- Landing 静态页面和静态资源正常。
- Main 默认路由正常。

### 6. 切换

评审通过后直接替换 `backend/gateway` 实现。正式部署前使用 preview 或临时域名验证。
生产切换不保留旧 Next gateway 的兼容代码；如果失败，回滚部署版本，而不是在运行时
双分支。

## 风险和处理

| 风险                     | 影响                                         | 处理                                                      |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------- |
| rewrite 变 reverse proxy | header、cookie、redirect、cache 语义可能变化 | 用真实 upstream smoke 验证                                |
| redirect 被自动 follow   | OAuth/Auth 流程失败                          | 全部代理请求使用 `redirect: 'manual'`                     |
| POST body 未透传         | GraphQL 请求失败                             | 显式传 `method/body/duplex`                               |
| 多 `Set-Cookie` 合并     | Auth cookie 可能异常                         | 真实浏览器验证登录、callback、logout                      |
| upstream 依赖 Host       | 子应用生成 URL 或 cookie domain 异常         | 保留 `x-forwarded-host`，必要时明确重写 forwarded headers |
| 静态资源缓存 header 变化 | chunk 缓存或 CDN 行为变化                    | 对比 `_next/static` 响应 header                           |
| Vercel 项目识别变化      | gateway 部署失败                             | 单独验证 gateway project，不改 root 多项目脚本            |
| dev WebSocket host 语义  | HMR 或未来 socket upstream 路由错误          | `Host` 指向 upstream，保留原始 `x-forwarded-host` 并测试  |
| cwd 不同导致资源缺失     | env 或 public 文件加载失败                   | env/static 统一兼容 root 和 `backend/gateway` cwd         |
| Buffer 底层范围泄漏      | public 文件响应包含多余字节                  | `readPublicFile()` 使用 `byteOffset/byteLength` slice     |

## 不做的事

- 不迁移 Phoenix、Main、Dashboard 或 Landing。
- 不把 GraphQL 改成 Hono RPC。
- 不引入长期 Next/Hono 双运行时兼容。
- 不改变 Auth、Phoenix token 或 `groupher-auth.token` 的安全边界。
- 不改变用户可见 URL。

## 外部参考

- Hono Vercel 部署：https://hono.dev/docs/getting-started/vercel
- Hono Proxy Helper：https://hono.dev/docs/helpers/proxy
