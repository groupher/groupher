# Gateway 架构边界

> 状态：架构约定
>
> 当前结论：Gateway 的核心是稳定的入口分流规则和安全边界；首期实现直接在 Hono
> 内完成，不为短期不会使用的 gateway runtime 做额外抽象。

## 定位

Gateway 是 Groupher 的统一公开入口。它负责把浏览器请求稳定地分发到 Main、
Dashboard、Landing、Auth、Phoenix 和后续子应用，同时保留用户可见 URL、同源
GraphQL 入口和登录态边界。

Gateway 不属于某个前端框架，也不应该依赖某个框架独有的 rewrite API 才成立。它的
边界是：

```text
HTTP request -> route decision -> selected upstream + request policy
```

当前实现目标直接落在 Hono/Node。这里强调 route decision 独立，是为了避免分流规则
散落在 Hono handler 细节里；不是为了预留 NGINX、Envoy、Worker 等多 runtime
adapter。

## 当前职责

当前 `frontend/gateway` 承担这些职责：

- `/api/auth/*` 进入独立 Auth 应用。
- `/api/graphql` 进入 Phoenix `/graphiql`，并执行浏览器 header/cookie 清洗。
- `main.*` host 进入 Main。
- `landing.*` host 进入 Landing。
- `dashboard.*` host 进入 Dashboard。
- `/:community/dashboard/...` 进入 Dashboard，并去掉 URL 中的 `dashboard`
  path segment。
- Dashboard 和 Landing 的静态资源路径进入对应 upstream。
- `/`、`/pricing`、`/book-demo` 等静态营销页进入 Landing。
- 其他路径默认进入 Main。
- 提供低成本健康检查和少量静态公开文件，例如 `/health`、`robots.txt`、
  `sitemap.xml`、`manifest.json`。

这些职责本身是合理的；不合理的是把它们绑定在 Next.js runtime 和
`NextResponse.rewrite()` 语义上。

## 核心分流规则

Gateway 应该先定义 Hono 内部可测试的纯路由决策：

```ts
resolveGatewayTarget({
  url,
  method,
  headers,
  cookies,
  host,
  forwardedHost,
})
```

输出至少包含：

```ts
export type GatewayTargetKind = 'main' | 'dashboard' | 'landing' | 'auth' | 'phoenix'

{
  target: GatewayTargetKind,
  upstreamUrl: URL,
  requestHeaderPolicy: 'pass-through' | 'graphql-browser-clean',
  responsePolicy: 'pass-through',
  redirectPolicy: 'preserve-upstream',
}
```

这个函数应该由单元测试覆盖。Hono handler 负责把真实 HTTP request 适配成这个输入，
再按输出执行 proxy。实现不需要再抽象一层 generic runtime adapter。

Dashboard 规则必须区分 host 命中和 path pattern 命中：

- `dashboard.*` host 进入 Dashboard 时保留原始 path，例如
  `/home/dashboard` 仍代理到 Dashboard 的 `/home/dashboard`。
- 普通 host 上的 `/:community/dashboard/...` 才裁掉 `dashboard` segment，例如
  `/home/dashboard/appearance` 代理到 Dashboard 的 `/home/appearance`。
- `/xxx/settings/dashboard` 这类不是第二段 `dashboard` 的路径不能误判为 Dashboard，
  应继续走 Main fallback。

## 安全边界

### 浏览器 GraphQL

浏览器统一访问当前产品域下的 `/api/graphql`。Gateway 必须：

- 删除浏览器传入的 `authorization`。
- 删除原始 `cookie`。
- 只把 HttpOnly `groupher-auth.token` 以同名 Cookie 转发给 Phoenix。
- 不解析 Phoenix token。
- 不把浏览器登录态转换成通用 service credential。

`api.groupher.*` 只作为 GraphiQL、诊断和服务间调用入口，不作为普通浏览器跨域
GraphQL 入口。

### Auth

OAuth、callback、logout 和 Browser Session 由 Auth 子应用负责。Gateway 只负责把
稳定公开路径分发到 Auth，不读取 Auth.js Session，不解码 Auth.js Cookie，也不参与
provider 协议。

### 子应用

子应用不能因为 Gateway 分发而获得 Phoenix 领域所有权。需要领域数据、权限或写入时
仍然通过 Phoenix 的有界 API、服务信任或 delegation token。

## 业界方案背景

以下方案只作为判断 Gateway 边界的背景，不作为当前实现目标。短期实现不引入
NGINX、Envoy、Traefik、API Gateway 或 Cloudflare Worker，也不为了它们设计额外
adapter。

### CDN / 平台级 Rewrite

代表：Vercel rewrites、Cloudflare URL Rewrite 和 Transform Rules。

适合：

- 简单 host/path rewrite。
- 静态路径映射。
- 低成本边缘分流。

不适合单独承载 Groupher Gateway 的全部职责：

- `/api/graphql` 需要代码级 cookie/header 清洗。
- `/:community/dashboard/...` 需要动态 path 裁剪。
- 本地 Portless 和生产 forwarded host 语义需要统一处理。

### 专用 Reverse Proxy / Edge Router

代表：NGINX、Envoy、Traefik。

适合：

- 稳定边缘入口。
- TLS、缓存、限流、header 修改和 upstream 负载均衡。
- 复杂生产流量治理。

代价：

- 配置和部署复杂度更高。
- 代码级业务边界需要额外扩展机制。
- 本地开发和 monorepo 子应用迭代成本更高。

### Programmable Edge / Worker Gateway

代表：Cloudflare Workers、Fastly Compute、Deno Deploy，以及运行在这些 runtime 上的
轻量 Web framework。

适合：

- 使用标准 `Request` / `Response` / `fetch` 表达动态分流。
- 在边缘执行少量 header/cookie 逻辑。
- 保持 runtime 轻量。

风险：

- 与具体平台的 header、cookie、redirect、streaming 和缓存语义有关。
- 需要真实 upstream smoke 验证。

### API Gateway

代表：Kong、Apigee、AWS API Gateway、Envoy Gateway。

适合：

- 对外 public API。
- consumer、key、rate limit、quota、OpenAPI、analytics。
- API 管理和治理。

不适合首期替代页面 Gateway：

- Main、Dashboard、Landing 的页面分流不是纯 API 管理问题。
- 引入这类系统会明显增加运维面。

### App-level Gateway / BFF

代表：Next Proxy、Hono、Express、Fastify。

适合：

- 快速表达复杂规则。
- 和 monorepo 代码、测试、环境变量保持一致。
- 低成本迁移当前 Next gateway。

风险：

- 容易再次把 Gateway contract 绑定到某个 framework API。
- 如果 route decision 和 runtime adapter 不拆开，下一次迁移仍然会重复当前问题。

## 推荐路径

从 Next gateway 迁到 Hono/Node 是合理的，因为仓库已经有 `frontend/auth` 的 Hono
运行模型，且当前 Gateway 没有页面能力需求。

实现时直接在 Hono 范围内解决，结构保持简单：

```text
src/routing.ts       Hono 内部纯路由决策
src/proxy.ts         Hono/Node proxy 执行
src/upgrade.ts       Node WebSocket upgrade 反代
src/app.ts           Hono routes
src/server.ts        本地 Node server
index.ts             部署入口
```

核心测试应该主要覆盖 `src/routing.ts`，而不是覆盖 Hono 或 Next 的某个具体响应 API。
`src/proxy.ts` 还必须覆盖 Node `fetch` 自动解压后的 response header 重建，避免把
明文 body 和 `content-encoding: gzip` 一起返回给浏览器。`src/upgrade.ts` 只服务
本地 dev WebSocket，例如 Next HMR，不承载业务协议。

Gateway 应该成为 Groupher 的入口 contract，而不是一个业务子应用：

- public URL contract 稳定。
- routing contract 有测试。
- 实现范围收敛在 Hono，不引入短期无用的 runtime 抽象。
- Auth、GraphQL、Phoenix token 和子应用权限边界清晰。
- 部署平台和 framework 不能反向定义产品 URL 或安全边界。

## 不做的事

- 不把 GraphQL 迁成 Hono RPC。
- 不把 Phoenix 领域逻辑放进 Gateway。
- 不让 Gateway 读取 Auth.js Session。
- 不为了迁移框架改变用户可见 URL。
- 不保留长期 Next/Hono 双运行时兼容。

## 相关文档

- [`docs/sub-apps/gateway-hono-migration.md`](./sub-apps/gateway-hono-migration.md)
- [`docs/sub-apps/auth.md`](./sub-apps/auth.md)
- [`docs/sub-apps/README.md`](./sub-apps/README.md)

## 外部参考

- Vercel Rewrites：https://vercel.com/docs/routing/rewrites
- Cloudflare Transform Rules：https://developers.cloudflare.com/rules/transform/
- Cloudflare URL Rewrite：https://developers.cloudflare.com/rules/transform/url-rewrite/
- NGINX Reverse Proxy：https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/
- Envoy HTTP Routing：https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/http/http_routing
- Traefik Routers：https://doc.traefik.io/traefik/routing/routers/
- Kubernetes Gateway API HTTP redirect/rewrite：https://gateway-api.sigs.k8s.io/guides/user-guides/http-redirect-rewrite/
