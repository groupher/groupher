# Landing TanStack Rewrite

> 状态：代码迁移已落地；生产部署需在 Docker 可用环境完成固定 Gatus 校验后执行
>
> 目标：将 `frontend/landing` 从 Next.js App Router 直接迁移到 TanStack Start，保留现有产品页面、SEO、主题和交互体验，并继续以 Cloudflare Static Assets 作为生产部署边界。

## 1. 结论

Landing 应迁移到 TanStack Start。

当前 Landing 只有 `/`、`/pricing`、`/book-demo` 三个公开页面，没有动态路由、登录态、Server Action、RSC 数据流、ISR、PPR 或运行时服务端业务请求。生产构建已经使用 `output: 'export'`，Cloudflare 只托管静态产物；Next.js 在这里主要承担文件路由、静态 metadata 和静态导出，收益不足以覆盖其构建语义、开发运行时和部署适配成本。

目标运行模型是：

```text
source routes/components
  -> TanStack Start + Vite build
  -> build-time prerender
  -> static HTML/CSS/JS/assets
  -> Cloudflare Static Assets
```

Landing 不复制 Community 或 Dash 的动态 SSR Worker 模型。三个公开页面必须在构建期预渲染，生产请求不依赖常驻 React 服务端运行时。

本次采用硬切换：

- 不保留 Next.js 与 TanStack 双实现；
- 不保留 Next.js `assetPrefix` 产生的 `_next` 构建产物结构；
- 不兼容 `/landing/_next/*`；
- 不添加旧资源路径 rewrite、redirect 或 fallback；
- 不把 Next.js 构建目录或文件名当作部署协议。

Landing 新资源统一使用 `/landing/assets/*`。该路径保留 Landing 的资源所有权，但不保留任何 `_next` 兼容语义。

## 2. 当前边界

### 2.1 页面

当前公开页面：

| Route        | 当前入口                                  | 目标 route                    |
| ------------ | ----------------------------------------- | ----------------------------- |
| `/`          | `frontend/landing/app/page.tsx`           | `src/routes/index.tsx`        |
| `/pricing`   | `frontend/landing/app/pricing/page.tsx`   | `src/routes/pricing.tsx`      |
| `/book-demo` | `frontend/landing/app/book-demo/page.tsx` | `src/routes/book-demo.tsx`    |
| 其他路径     | `frontend/landing/app/not-found.tsx`      | root route not-found boundary |

页面组件、Salon、主题、i18n 和展示交互不依赖 App Router，可以在迁移中保持产品行为不变。

### 2.2 Next.js 专属能力

Next.js 耦合主要集中在：

- `app/layout.tsx` 的 `Metadata` 和 `next/script`；
- `app/platform/NextPlatformProvider.tsx` 的 `next/image`、`next/link`、`next/navigation` 和 `next/script`；
- `next.config.js` 的静态导出、asset prefix 和开发域名配置；
- package scripts 中的 `next dev`、`next typegen` 和 `next build`；
- `prepare-cloudflare-worker.mjs` 对 `out/_next` 的二次搬运。

这些能力都不要求保留 Next.js：route `head()`、TanStack Router、普通图片/脚本组件和 Vite 静态资源可以覆盖当前需求。

### 2.3 不变的产品边界

迁移不改变：

- Landing 对营销页、产品介绍、价格页和预约演示页的所有权；
- Core 的平台无关定位；
- Landing 与 Main、Auth、Apply、Dashboard 的产品链接语义；
- 当前 locale、theme、first-paint、layout、Salon 和 UI 组件行为；
- Cloudflare 作为 Landing 生产托管平台；
- `landing.groupher.localhost` 和本地端口 `3002`。

## 3. 目标架构

建议目录：

```text
frontend/landing/
  src/
    routes/
      __root.tsx
      index.tsx
      pricing.tsx
      book-demo.tsx
      health.ts
    platform/
      TanStackPlatformProvider.tsx
    router.tsx
    routeTree.gen.ts
    widgets/
      domain.css
  app.config.ts
  wrangler.jsonc
  package.json
```

不要在建立路由壳时同时重排整个组件树。功能切换阶段可以暂时保留 `app/widgets`，降低路由迁移和机械路径变更互相干扰的风险；硬切换后必须用独立机械步骤将其迁到 `src/widgets`。Landing rewrite 完成时 `frontend/landing/app/` 必须完全消失，不能长期保留只剩 widgets 的半迁移目录。

### 3.1 Root route

`src/routes/__root.tsx` 负责：

- 输出完整 HTML document；
- 声明 charset、viewport、title、description、Open Graph 和 Twitter metadata；
- 在首次绘制前注入 theme 和 initial-time 脚本；
- 加载静态英文 Landing locale；
- 组装 `MainProvider`、`GlobalProvider` 和 Landing 平台 adapter；
- 挂载开发环境 Dev Hub reporter；
- 挂载 `@vercel/analytics/react` 和 `@vercel/speed-insights/react`，不再使用 Next 专属入口；
- 渲染 `HeadContent`、`Outlet` 和 `Scripts`。

首屏 theme 与时间种子必须在 hydration 前执行，不能退化成 `useEffect`，也不能出现先亮后暗、相对时间首帧跳动或 hydration mismatch。

### 3.2 路由

三个页面使用 TanStack Router file routes。页面没有运行时数据依赖，不引入 TanStack Query，也不为了形式增加 loader。

每个页面必须参与 production prerender，并生成可直接由 Static Assets 返回的 HTML。关闭 JavaScript后，页面标题、主要文本和主要链接仍应存在。

### 3.3 Platform adapter

Core 继续只暴露平台无关的 `PlatformProvider` 合约，不直接依赖 `@tanstack/react-router`。

Landing 新建自己的 TanStack adapter：

- 声明式站内导航使用 TanStack `Link`；
- 命令式导航由 router adapter 实现；
- 外部链接继续使用原生 `<a>`；
- 图片使用普通 `<img>` 或 Core 的平台图片合约，不引入新的图片代理服务；
- 脚本使用普通 React script adapter，并保持加载时序语义；
- 不从 Dash 或 Community 直接 import adapter；可以复用其设计，但应用 adapter 仍归各自 host 所有。

### 3.4 静态资源

生产资源使用 Vite 内容哈希路径 `/landing/assets/*`。`/landing/` 是 Landing 在共享根域上的资源 namespace；最终哈希文件名属于构建产物，不进入产品路由或跨应用协议。不要使用裸 `/assets/*`：当前根域路由会把首段 `assets` 识别为 community slug。

当前实现保留 Vite 内部 `/assets/*` 产物路径，并由 `finalize-static-build.mjs` 在 prerender 完成后只改写 HTML 中的资源引用为 `/landing/assets/*`；route contract 再把公开路径映射回 Landing Static Assets 的 `/assets/*`。该方案依赖 JS chunk 之间使用相对引用，CSS 不出现根路径 `url(/assets/*)`。finalize 脚本必须对这两个边界做构建断言；未来一旦引入非 data URI 的 CSS 根路径资源，应让构建失败并改造资源 base，不能静默发布失效 URL。

生产构建还必须从预渲染的品牌 NotFound route 生成根级 `404.html`，供 Cloudflare `not_found_handling: '404-page'` 返回；不能退化为 Cloudflare 默认 404 页面。

迁移后删除：

- `assetPrefix: '/landing'`；
- `_next` 目录假设；
- `out/_next` 到 `out/landing/_next` 的搬运；
- 所有针对 `/landing/_next/*` 的配置、测试和文档。

该变化必须同步到共享路由协议和两个运行时 adapter：

- `packages/route-contract` 将 `/landing/assets/*` 识别为 Landing asset；
- 生产 `infra/edge-router` 通过 `LANDING` service binding 转发该路径；
- 本地 `infra/gateway` 将该路径代理到 Landing `:3002`；
- 两侧测试删除 `/landing/_next/*` 断言并增加 `/landing/assets/*` 断言；
- 仓库、文档和配置中清点旧 `/landing/_next/*` 引用，但不增加兼容逻辑。

Gateway 只用于本地开发；生产公共入口由 Edge Router 承担。Landing rewrite 不新增 Gateway 专属业务规则，只同步共享 route contract 的本地 adapter。

### 3.5 本地 Gateway 与 Edge Router

Cloudflare 已正式支持多个本地 Worker 通过 service bindings 通信，也支持分别由 `vite dev` 和 `wrangler dev` 启动的 Worker 跨进程连接。该底层能力可用于未来统一本地和生产入口。

但它目前不是 Groupher Gateway 的即插即用替代：

- 当前本地上游包含 Worker、Next.js、Vite/TanStack 和普通 Node/Phoenix 端口，并非全是 Worker service；
- Gateway 还负责本地 HMR/WebSocket、Vite 虚拟模块和 referer-based 资源归属；
- Cloudflare 单命令多 Worker 开发仍标记为 experimental；
- Edge Router 当前 production 配置绑定已部署 Worker，不能直接把同一组 service bindings 当作任意 localhost HTTP upstream。

因此本次保留 Gateway。本地 Edge Router 替换应作为独立基础设施项目：先设计 production service binding 与 localhost upstream 的双 adapter，再验证 Portless、HMR、WebSocket、Auth、GraphQL 和全部子应用启动链。该项目不属于 Landing rewrite 的完成条件。

## 4. SEO 与可观测性

### 4.1 SEO 合约

迁移前后必须保持：

- 每个页面的 title 和 description；
- root 页面 Open Graph 和 Twitter card；
- 保留当前 `favicon.ico`、`manifest.json`、`robots.txt` 和 `sitemap.xml` 的公开路径；
- 正确的 canonical origin；
- 预渲染 HTML 中存在关键营销内容；
- 未知路径返回真实 HTTP 404，而不是带 200 的 SPA fallback；
- `robots.txt`、sitemap 或结构化数据如果后续加入，也必须由明确的静态或 Worker route 提供。

不要把客户端执行后的 DOM 当作 SEO 验收结果。验收应读取 production build 返回的原始 HTML。

当前 metadata 没有 `og:image`，迁移只保持现有 metadata 等价，不在框架重写中新增 SEO 产品字段。

### 4.2 Analytics

当前 `@vercel/analytics/react` 和 `@vercel/speed-insights/next` 属于 Vercel/Next 集成面。迁移时必须明确选择：

1. 替换为 Cloudflare 或现有平台无关 analytics；或
2. 暂时移除，并记录观测缺口。

不得为了保留 Speed Insights 而继续引入 `next` 包。

### 4.3 Health

Landing 必须在本地开发服务器恢复稳定的 `GET /health`，响应仓库统一的 `health.v1`：

- `service` 为 `landing`；
- 健康状态可被 Dev Hub 和本地 Gatus 验证；
- 健康检查不依赖页面渲染或外部服务；
- 未知路径仍返回 404，不能由健康检查 fallback 吞掉。

当前直接消费者只有 Dev Hub 和 `ops/status/config.local.yaml`，两者都检查 `http://127.0.0.1:3002/health`。生产 Status 检查的是 `https://groupher.com/health`，该响应属于 `edge-router`，并不直接检查 Landing service。

因此生产 Landing 保持纯 Static Assets，不为了 `/health` 增加 Worker script。生产可用性由 Edge Router health 加 `ops/status` 的真实 Landing 页面 probe 覆盖：增强现有 `Public Website` 检查，使 `/` 除 HTTP 状态外还验证预渲染 HTML 关键内容；新增 `/pricing` 检查并验证状态与关键内容。若未来出现 Landing production health 的独立消费者，再单独评估 Cloudflare Worker `main` 与 assets binding，不提前增加运行时。

仓库将 Gatus 固定为 `v5.36.0`。该版本的 HTML body pattern 条件使用 `[BODY] == pat(*关键内容*)`，不能套用 JSON health 的 `[BODY].field` path，也不能使用未经该版本支持证明的 `contains` 运算符。关键内容优先选择稳定、预渲染可见且不随营销文案或翻译频繁变化的短 marker。

生产配置校验不得依赖 `start-local.sh` 的二进制发现顺序或 PATH 中未确认版本的 `gatus`。本轮需新增统一入口 `make be.status.config.validate`，由它封装固定镜像、绝对 bind mount、临时数据目录、健康等待和容器清理。底层等价启动方式是：

```bash
docker run --rm \
  --mount type=bind,source="$PWD/ops/status/config.yaml",target=/config/config.yaml,readonly \
  --tmpfs /data \
  -p 127.0.0.1::8080 \
  ghcr.io/twin/gatus:v5.36.0
```

有效配置会让 Gatus 持续运行，不会自行以成功状态退出；无效配置会在启动阶段报错退出。校验脚本让 Docker 随机分配 loopback host port，使用 `docker port` 解析实际端口，避免固定 `18080` 的占用冲突。成功标准是容器无配置错误地启动，并且对应的 `http://127.0.0.1:<随机端口>/health` 返回 200，随后正常结束并清理容器。异常退出和中断路径也必须完成清理，不能遗留校验容器或持久数据。

`src/routes/health.ts` 可以参与 route tree 生成，但它只属于本地开发运行时，必须排除在 production prerender route 集合之外。生产构建不得生成 `/health` HTML 或其他 Landing `/health` 静态产物；公开 `https://groupher.com/health` 继续由 Edge Router 所有并返回 `service: edge-router`。

## 5. 实施阶段

### Phase 1：建立 TanStack 壳

- 添加 TanStack Start、TanStack Router、Vite 和 Wrangler Static Assets 配置；
- 将 `@tanstack/react-start` 锁定为 `1.168.38`、`@tanstack/react-router` 锁定为 `1.170.21`，并对齐 Community/Dash 当前 Vite、router generator、Tailwind Vite plugin 和 Wrangler 版本；Landing 不部署运行时 Worker，因此不引入 Cloudflare Vite plugin；
- 不引入 Landing 不使用的 TanStack Query 或 `@tanstack/react-router-ssr-query`；
- 建立 router、root route 和三个页面 route；
- 建立 `TanStackPlatformProvider.tsx`；
- 保持现有组件和样式目录不动；
- 在本地端口 `3002` 启动。

验收：三个页面可访问，未知页面为 404，类型检查通过。

### Phase 2：恢复完整页面能力

- 接入 locale 和 `MainProvider`；
- 接入 theme 与 first-paint 脚本；
- 接入 Dev Hub reporter；
- 迁移 metadata；
- 处理 analytics；
- 验证站内/站外导航、图片和脚本 adapter。
- 显式验证滚动恢复：滚动首页、进入其他页面、浏览器返回后恢复原位置，新导航落在正确位置。

验收：页面内容、主题、交互和首帧与迁移前一致，无 hydration error 和浏览器 console error。

### Phase 3：静态预渲染与 Cloudflare

- 配置三个 route 的 production prerender；
- 将 `/health` 明确排除在 production prerender route 集合之外，并断言生产产物中不存在 Landing `/health` 页面；
- 直接生成 Cloudflare Static Assets 可部署产物；
- 在本地 Vite/TanStack dev server 实现 `health.v1`，供 Dev Hub 和本地 Gatus 使用；
- 构建完成后将预渲染 HTML 中的 Vite 资源引用统一为公开路径 `/landing/assets/*`；route contract、Edge Router 和 Gateway 将它映射到 Landing Static Assets 内部的 `/assets/*`，不修改内容哈希文件名；
- 同步 route contract、Edge Router、本地 Gateway 及其测试；
- 更新 `ops/status/config.yaml`：增强现有 `Public Website` 根页面 probe，并新增 `/pricing` probe；HTML 关键内容使用 Gatus `v5.36.0` 支持的 `[BODY] == pat(*...*)` 条件；
- 实现并执行 `make be.status.config.validate`：使用 `ghcr.io/twin/gatus:v5.36.0` 只读挂载生产 `ops/status/config.yaml`，以临时 `/data` 启动，等待容器 `/health` 返回 200，并在成功、失败或中断后清理；
- 不得使用 `start-local.sh` 或 PATH 中未确认版本的 `gatus` 代替生产配置校验；`start-local.sh` 默认加载 `config.local.yaml`；
- 执行 `make be.status.deploy` 重新部署 Fly 上的 Status 服务；仅修改仓库配置不会让线上 probe 生效；
- 等待 Fly Machine 和 Gatus `/health` 恢复后，确认生产 Status 已出现更新后的 `/` probe 与新增的 `/pricing` probe，并至少成功执行一个完整检查周期；
- 验证静态资源路径、404 和缓存头；
- 执行 Wrangler dry-run 和真实 preview 验证。

验收：生产产物不依赖 Next.js server，不包含 `_next` 路径或 Landing `/health` 页面，三个页面的原始 HTML 都包含 SEO 关键内容；`make be.status.config.validate` 使用固定的 Gatus `v5.36.0` 成功启动生产配置并通过容器 `/health`，且没有遗留容器或数据；Status 已重新部署，且线上 `/`、`/pricing` probe 至少成功执行一个完整检查周期。

### Phase 4：硬切换和删除

- 切换 Makefile 与根 package scripts；
- 切换 Dev Hub 的 technology、config、启动命令和 readiness；
- 删除 Next platform adapter；
- 删除 `next.config.js` 和 Next 专属脚本；
- 删除 `next-env.d.ts` 的生成依赖，并从 `tsconfig.json` 移除 `next-env.d.ts`、`.next/types`；
- 从 Landing workspace 删除 `next`，并将 analytics 切换到框架无关的 React 入口；
- 删除旧 Cloudflare 产物搬运逻辑；
- 删除所有旧资源路径配置；
- 审计 `public/`，保留仍在使用的 favicon、manifest、robots、sitemap、图片和图标，删除仅服务旧 Next/Pages 构建模型的文件；
- 将本地 `.output`、`.tanstack`、`dist`、route tree、Vite timestamp 和 `*.tsbuildinfo` 纳入统一 `clean`；
- 清理当前 Landing 根目录已有的本地 `*.tsbuildinfo`；
- 将 `app/widgets` 机械迁到 `src/widgets`，修正 imports，并删除空的 `app/` 目录。

`frontend/core/next.config.js` 不属于清理范围：Main 和 Dashboard 仍在使用它。Landing 只删除自己的引用。

验收：仓库内 Landing 范围不再引用 `next/*`、`.next`、`_next` 或 `/landing/_next`，不存在 `frontend/landing/app/`，且没有兼容分支。

## 6. 验证矩阵

至少覆盖：

| 范围          | 验证                                                                                               |
| ------------- | -------------------------------------------------------------------------------------------------- |
| TypeScript    | Landing type-check 与 route tree 生成                                                              |
| Format        | Landing format check                                                                               |
| Build         | production build 成功，三个页面均完成 prerender                                                    |
| HTTP          | `/`、`/pricing`、`/book-demo` 为 200，未知路径返回品牌 `404.html` 且状态为 404                     |
| Health        | 本地 `:3002/health` 通过 `health.v1`；生产不生成 Landing `/health`                                 |
| HTML          | 原始响应包含 title、description 和页面主要文本                                                     |
| Assets        | HTML 资源位于 `/landing/assets/*` 且全部为 200，不存在 `_next`                                     |
| Public        | favicon、manifest、robots、sitemap 和仍使用的 public assets 为 200                                 |
| Browser       | 无 console error、hydration error、主题闪烁和明显布局偏移                                          |
| Navigation    | 内部导航、外链、前进、后退、滚动恢复、刷新和深层链接行为正确                                       |
| Dev Hub       | Landing 从 `starting` 进入 `running`，打开地址指向正确页面                                         |
| Routing       | route contract、Edge Router 与本地 Gateway 均识别 `/landing/assets/*`                              |
| Status config | `make be.status.config.validate` 固定 Gatus `v5.36.0`，加载生产配置、通过容器 `/health` 并完成清理 |
| Status deploy | 执行 `make be.status.deploy`，线上 `/`、`/pricing` probe 出现并成功运行一个周期                    |
| Cloudflare    | Wrangler dry-run、公开 URL 页面 probe 和静态资源真实请求通过                                       |

应记录迁移前后的 production build 产物大小与页面加载瀑布，但不把框架名称本身当作性能结论。只有相同页面、相同资源和 production build 的测量才可比较。

## 7. 风险与控制

### 7.1 预渲染遗漏

风险：构建成功但某个页面退化为客户端 SPA。

控制：直接检查每个 route 的构建产物和原始 HTTP HTML，不只做浏览器截图。

### 7.2 Core 的隐式 Next 依赖

风险：Landing 页面本身没有 Next import，但共享 Core 的某条懒加载路径仍引用 `next/*`。

控制：构建 Landing production bundle，并检查依赖图和产物中是否包含 Next runtime；不要仅搜索 Landing 源目录。

### 7.3 主题与 hydration

风险：root document 和 provider 初始化时序变化导致闪烁或 hydration mismatch。

控制：保留 pre-paint script 的执行时机，以服务端/预渲染种子初始化 provider，并测试 light、dark、system 三种模式。

### 7.4 Cloudflare 404 与本地 health

风险：Static Assets 的 SPA fallback 把未知路径变成 200，或本地 `/health` 被页面路由吞掉。

控制：production prerender 显式排除 `/health` 并检查构建产物；生产明确验证静态页面和 404；本地对 `/health` 的返回状态和 JSON body 分别断言。不要把本地 readiness endpoint 扩张成没有消费者的生产 Worker。

## 8. 完成定义

只有同时满足以下条件，Landing 重写才算完成：

1. 三个公开页面由 TanStack Router 管理并在构建期预渲染；
2. 页面内容、交互、主题、i18n、metadata 和外部链接保持正确；
3. Cloudflare 直接提供静态 HTML 和 `/landing/assets/*`；
4. 本地 `/health` 符合 `health.v1`，Dev Hub 与本地 Gatus 可用，生产不生成 Landing `/health` 页面；
5. 未知路径返回 HTTP 404；
6. Landing 不再依赖 Next.js runtime、构建器或平台 adapter；
7. 仓库中不存在 Landing 的 `_next` 资源契约或历史兼容逻辑；
8. 本地 production build、浏览器回归、Wrangler dry-run 和公开预览均验证通过；
9. `frontend/landing/app/` 已删除，组件树归入 `src/`；
10. Next 版本只有在上述验收全部完成后才删除，不保留长期双轨；
11. `make be.status.config.validate` 已通过固定 Gatus `v5.36.0` 校验生产配置且无遗留容器或数据，Status 已重新部署，线上 `/`、`/pricing` probe 至少成功执行一个周期；
12. 本地 Gateway 替换未被混入 Landing rewrite，后续迁移仍以共享 route contract 为 authority。

## 9. 参考

- [Cloudflare Service bindings：本地开发](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/#local-development)
- [Cloudflare：Developing with multiple Workers](https://developers.cloudflare.com/workers/local-development/multi-workers/)
- [Cloudflare：Choosing between Wrangler and Vite](https://developers.cloudflare.com/workers/local-development/wrangler-vs-vite/)
