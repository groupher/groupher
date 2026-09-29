# Inspire Me TanStack Rewrite V1

> 状态：已完成。下文 Vinext、`.next` 和旧构建路径仅记录迁移输入；当前应用是纯 TanStack
> Start，不保留兼容层。
>
> 本文定义 `frontend/inspire-me` 从 Vinext 改写为 TanStack Start 的实施边界。V1 是运行时迁移，不是产品重做；公开 URL、研究数据、页面行为、Worker 身份和 Cloudflare Access 契约保持不变。

## 1. 背景

`frontend/inspire-me` 是部署在 Cloudflare Workers 上的内部反馈研究工具，当前由 Vinext 承载。应用规模较小，现有能力只有：

- `/`：选择第一个反馈平台并展示帖子；
- `/:platform`：展示指定反馈平台；
- `?page=N`：每页 500 条的服务端分页；
- 平台级 title、description、Open Graph 和 Twitter metadata；
- `/health`：服务健康检查；
- 构建前将 Markdown 研究数据生成到 `public/feedback-platforms/*.json`；
- 生产 Worker 通过 Cloudflare Assets binding 读取生成数据；
- `inspire-me.groupher.com` 上的 Cloudflare Access 保护。

当前运行链路：

```text
Markdown research data
  -> generate-feedback-data.mjs
  -> public/feedback-platforms/*.json
  -> Vinext App Router page
  -> Cloudflare Worker
  -> researcher
```

V1 将其中的 Vinext / Next.js App Router 替换为 TanStack Start，目标链路为：

```text
Markdown research data
  -> generate-feedback-data.mjs
  -> public/feedback-platforms/*.json
  -> TanStack route loader
  -> Cloudflare Worker
  -> researcher
```

## 2. 决策

### 2.1 应用边界保持不变

迁移后继续使用：

```text
目录       frontend/inspire-me
workspace  @groupher/inspire-me
Worker     inspire-me
域名       inspire-me.groupher.com
本地端口   3010
```

不将应用移动到 `frontend/`。`inspire-me` 是内部研究工具，现有目录和 workspace 名称已经是稳定边界。

### 2.2 直接迁移到 TanStack Start

不再增加新的 Vinext 兼容层，也不保留 Next 与 TanStack 两套业务 route tree。迁移在当前 workspace 内完成，但删除旧 `app/` 和 Vinext 依赖必须放在 TanStack 版本通过 Worker runtime 验证之后。

### 2.3 V1 不引入 TanStack Query

研究数据由 route loader 读取，没有客户端写入、跨页面 server-state 同步或复杂失效需求。TanStack Router loader 足以承担数据加载和 SSR；V1 不增加 QueryClient、query key、dehydrate/hydrate 或额外 cache authority。

### 2.4 保持 SSR，不批量 prerender 平台页

V1 继续由 Worker SSR 输出页面。平台数据合计体积较大，不将所有平台 JSON 导入 Vite module graph，也不在构建期批量生成所有详情页。生成数据继续作为静态 Assets 存在，由 loader 按平台读取。

## 3. 目标目录

```text
frontend/inspire-me/
├── data/
│   └── feedback-platforms/
├── src/
│   ├── routes/
│   │   ├── __root.tsx
│   │   ├── index.tsx
│   │   ├── $platform.tsx
│   │   └── health.ts
│   ├── components/
│   │   └── FeedbackPage/
│   │       ├── index.tsx
│   │       ├── PlatformNav.tsx
│   │       ├── PlatformHeader.tsx
│   │       ├── Pagination.tsx
│   │       ├── PageLink.tsx
│   │       ├── PostList.tsx
│   │       └── PostItem.tsx
│   ├── lib/
│   │   ├── feedback.ts
│   │   └── pagination.ts
│   ├── router.tsx
│   ├── routeTree.gen.ts
│   ├── server.tsx
│   └── styles/
│       └── global.css
├── public/
│   ├── feedback-platforms/
│   ├── platform-logos/
│   └── favicon.svg
├── scripts/
│   ├── generate-feedback-data.mjs
│   └── generate-route-tree.mjs
├── app.config.ts
├── cloudflare-workers.d.ts
├── wrangler.jsonc
├── package.json
└── tsconfig.json
```

`data/feedback-platforms/` 是研究数据源，迁移时保持原位，不将其导入 Vite module graph。

`routeTree.gen.ts` 是生成产物，业务代码不得手动编辑。仓库当前没有统一的提交规则：Landing 跟踪该文件，Dash、Community 和 Apply 则忽略。Inspire Me V1 明确跟随 Landing，提交 `src/routeTree.gen.ts`，让这个小型独立应用的路由变化可以直接接受代码审查。

`cloudflare-workers.d.ts` 在 V1 中继续提供 `cloudflare:workers` 和 `ASSETS` binding 类型。只有在 `wrangler types` 已能稳定生成同等声明并纳入现有命令后，才用生成类型替换它。

当前 `postcss.config.cjs` 不进入目标目录。V1 改用与 Landing、Apply、Community 一致的 `@tailwindcss/vite`，并删除 `@tailwindcss/postcss`、`postcss` 和旧 PostCSS 配置。

## 4. 路由与框架 API 映射

| 当前实现                     | TanStack Start 实现             | 说明                                       |
| ---------------------------- | ------------------------------- | ------------------------------------------ |
| `app/layout.tsx`             | `src/routes/__root.tsx`         | HTML shell、全局 head、样式、Dev Hub       |
| `app/page.tsx`               | `src/routes/index.tsx`          | 默认平台页面                               |
| `app/[platform]/page.tsx`    | `src/routes/$platform.tsx`      | 动态平台页面                               |
| `app/health/route.ts`        | `src/routes/health.ts`          | `server.handlers.GET` Server route handler |
| `searchParams` Promise       | `validateSearch` + loader deps  | 类型化并规范化 `page`                      |
| `params` Promise             | loader `params.platform`        | 类型化平台参数                             |
| `generateMetadata`           | route `head()`                  | 根据 loader data 生成平台 metadata         |
| `next/navigation.notFound()` | TanStack `notFound()`           | 缺失或非法平台返回 404                     |
| `next/link`                  | TanStack `Link`                 | 站内平台和分页导航                         |
| `next/image`                 | 原生 `img` 或 app-local adapter | 本地小图不依赖 Next 图片优化               |

帖子来源地址仍使用原生 `<a target="_blank" rel="noreferrer">`，不经过 TanStack Router。

## 5. 数据边界

### 5.1 必须保留的规则

- 原始 Markdown 只在构建或开发启动前转换为 JSON；
- 生成数据不进入 TypeScript import graph；
- 生产 Worker 不调用 `node:fs`；
- 生产环境通过 Cloudflare `ASSETS` binding 读取 JSON；
- 平台 ID 继续使用 `[a-z0-9-]+` 白名单校验；
- 平台摘要和完整平台数据可以保留模块级只读 cache；
- `count` 继续由实际帖子数量规范化；
- 数据文件路径继续为 `/feedback-platforms/index.json` 和 `/feedback-platforms/:platform.json`。

### 5.2 开发环境读取

开发和生产统一通过 Cloudflare `ASSETS` binding 读取生成 JSON，避免 `node:fs`、`process.cwd()` 和 publicDir 物理布局形成第二套运行路径：

```text
wrangler.jsonc assets binding
  -> @cloudflare/vite-plugin dev/build environment
  -> cloudflare:workers env.ASSETS
  -> env.ASSETS.fetch(...)
```

当前安装的 `@cloudflare/vite-plugin` 没有独立的 `@cloudflare/vite-plugin/assets` helper，不能依赖不存在的子路径 API。Vite dev 和 production Worker 都应验证同一套 `env.ASSETS.fetch(...)` 实现；如果开发 runtime 暴露出插件或 binding 缺口，再记录具体证据后决定是否增加仅限开发环境的 fallback。

开发环境还必须验证 Assets 的 serving 目标和数据新鲜度。`generate:data` 写入 `public/feedback-platforms/`，不能让 dev binding 意外读取上一次 production build 遗留的 `dist/client/feedback-platforms/`。验证顺序：

1. 清理旧 `dist`；
2. 执行 `generate:data`；
3. 启动 Vite dev；
4. 请求 `/feedback-platforms/index.json`；
5. 将响应内容或内容 hash 与本次生成的 `public/feedback-platforms/index.json` 对照；
6. 再通过首页 loader 确认读取的是同一份数据。

内容或 hash 对照是验收依据，不依赖 HTTP 是否暴露源文件 mtime。

### 5.3 Loader 输出

route loader 只返回页面需要的 view model：

```text
platform summaries
selected platform
current page
total pages
rank offset
current page posts
```

组件不再次请求数据，也不维护第二份平台 server state。

## 6. 分阶段实施

### Phase 0：冻结行为基线

- 记录 `/`、真实平台页、分页、非法平台、越界页码和 `/health` 的当前结果；
- 记录首页与平台页 metadata；
- 确认 favicon、平台 logo 和 JSON Assets 路径；
- 记录当前 production build 和 Worker bundle 基线；
- 至少准备 route-level 或 Wrangler smoke，用于迁移前后对照。

完成标准：现有行为有可重复检查方式，迁移验收不依赖主观观察。

### Phase 1：建立 TanStack 应用骨架

- 在 `package.json` 中加入 `@tanstack/react-router`、`@tanstack/react-start`、router generator 和需要的 Vite 插件；
- 版本与仓库现有 TanStack workspace 对齐；
- 新建 `app.config.ts`、`src/router.tsx`、`src/server.tsx` 和 route-tree 生成脚本；
- 使用 `@tailwindcss/vite`，删除旧 `@tailwindcss/postcss`、`postcss` 和 `postcss.config.cjs`；
- 开发端口保持 `3010`，允许 `inspire-me.groupher.localhost`；
- 不设置 Router `basepath`，canonical route 从 `/` 开始；
- 建立 `__root.tsx`，接入 `HeadContent`、`Outlet`、`Scripts`、favicon、默认 metadata 和全局 CSS；
- Dev Hub 环境变量从 `NEXT_PUBLIC_DEV_HUB_URL` 改为 `VITE_DEV_HUB_URL`，仅在开发环境渲染 reporter。

完成标准：空 route tree 可以完成 generate、type-check、build 和 Worker dry-run。

### Phase 2：迁移健康检查

- 将 `/health` 改为 TanStack `server.handlers.GET`，不使用 route loader；
- 完整保留 health 合同：`schemaVersion: 'health.v1'`、`status`、`service`、`version`、`environment`、`timestamp`、`uptimeMs`、`checks`；
- 直接复用 Landing 的 Worker-safe 模式：模块级 `startedAt = Date.now()`，`version` 使用 `import.meta.env.VITE_GIT_COMMIT_SHA || 'dev'`，`environment` 使用 `import.meta.env.MODE || 'development'`，`uptimeMs` 使用当前时间减去 `startedAt`；
- `deploy` 和 `deploy:dry-run` 在 build 前注入 `VITE_GIT_COMMIT_SHA=$(git rev-parse --short HEAD)`；
- 不使用 Worker 中不可靠的 `process.env.VERCEL_GIT_COMMIT_SHA`、`process.env.npm_package_version` 或 `process.uptime()`；
- 确认 `/health` 不触发页面 loader，也不依赖研究数据 Assets。

完成标准：本地 Vite runtime 和 Wrangler runtime 均返回兼容的健康检查响应，并与 `frontend/landing/src/routes/health.ts` 的 `health.v1` schema 对照验证。

### Phase 3：迁移数据读取

- 将 `app/lib/feedback.ts` 移入 `src/lib/feedback.ts`；
- 保持生成脚本和 public JSON 格式；
- 删除基于 `process.env.NODE_ENV` 的文件系统分支；
- 开发和生产统一从 `cloudflare:workers` 读取 `env.ASSETS` 并调用 `ASSETS.fetch`；
- 分别验证 Vite dev 和 production Worker 中的 Assets binding；
- 验证 13MB 级研究数据没有进入 client 或 server JS bundle；
- 保留 summary cache、platform cache 和非法 ID 拒绝逻辑。

完成标准：首页和任一平台数据可在 Wrangler runtime 中读取，bundle 中不包含完整研究数据；Vite dev 首次读取的 Assets 内容与本次 `generate:data` 生成的 public JSON 一致，不依赖陈旧 `dist/client`，production Worker 读取的内容与本次 build 复制的 Assets 一致。

### Phase 4：迁移首页与平台路由

`src/routes/index.tsx`：

- 使用与动态平台页相同的 `validateSearch`/loader search 投影；
- 保持 `/?page=2` 可访问，并为第一个平台计算对应分页；
- loader 获取平台摘要；
- 选择第一个平台；
- 加载完整平台数据；
- 规范化分页并构造 view model；
- 缺少可用平台时返回 404。

`src/routes/$platform.tsx`：

- `validateSearch` 将 `page` 规范为正整数或 `undefined`；
- loader 根据 `params.platform` 加载数据；
- 非法或不存在的平台返回 404；
- `head()` 根据 loader data 生成平台 title、description、Open Graph 和 Twitter metadata；
- component 只呈现 loader data。

分页解析和链接生成规则保持：

- 每页 500 条；
- search 继续兼容现有 `Number.parseInt(value, 10)` 语义：缺失值、`abc` 和其他 `NaN` 输入回退第 1 页，`12abc` 为第 12 页，`1.9` 为第 1 页；
- 小于 1 的页码收敛为 1；
- 大于最大页数的页码收敛为最后一页；
- 非法或越界 `page` 不返回 404、不抛 search validation error，也不自动重定向；
- 应用生成的第一页分页链接不带 `?page=1`；用户直接访问 `?page=1`、`?page=abc` 或其他可容错 query 时，URL 保持原样；
- 平台切换时清除旧平台的分页参数。

`validateSearch` 只负责把原始 search 投影为兼容旧 `parseInt + clamp` 语义的 loader 输入，不通过严格 schema 改变既有 URL 容错行为，也不承担 canonical redirect。

完成标准：首页、平台页、分页、刷新、浏览器前进后退、metadata 和 404 行为与旧实现一致。

### Phase 5：迁移并拆分 UI

当前 `FeedbackPage.tsx` 同时定义页面、分页、链接、帖子和图标。迁移时按组件职责拆分，遵守一个文件不定义多个业务组件的前端约束。

- `FeedbackPage` 负责页面布局；
- `PlatformNav` 负责平台列表；
- `PlatformHeader` 负责当前平台摘要；
- `Pagination` 和 `PageLink` 负责 typed search 导航；
- `PostList` 和 `PostItem` 负责帖子呈现；
- 站内链接改用 TanStack `Link`；
- 本地 logo 使用原生 `img` 或 app-local adapter；
- 外部来源链接保持原生 anchor；
- 保持现有桌面和移动端视觉、tooltip、键盘 focus 与分页交互。

V1 不顺带清理所有 Tailwind arbitrary values，也不进行重新设计。样式体积和视觉优化应作为独立后续任务。

完成标准：旧页面视觉与交互等价，代码中不再 import `next/link`、`next/image` 或 `next/navigation`。

### Phase 6：切换 Cloudflare 构建和部署

- 在 `app.config.ts` 接入 Cloudflare Vite 插件；
- 保留根 `wrangler.jsonc` 作为部署配置源，并将 `main` 改为 `@tanstack/react-start/server-entry`；
- 在根 `wrangler.jsonc` 中声明 Assets binding、Worker 名称、compatibility date/flags、custom route 和 observability；
- 保留根配置的 `cache: { enabled: true }`；它是 Worker entrypoint cache capability，不等同于 Assets cache-control、CDN TTL 或应用数据 cache；
- production build 由 `@cloudflare/vite-plugin` 读取根配置，生成 `dist/server/wrangler.json`、server bundle 和 `dist/client` Assets；
- `deploy` 和 `deploy:dry-run` 使用构建后生成的 `dist/server/wrangler.json`；
- build 后确认生成的 `dist/server/wrangler.json` 仍包含 `cache.enabled: true`，且 dry-run 没有相关 schema warning；
- 保持 `workers_dev: false`；
- 保持 `inspire-me.groupher.com` custom route 和现有 Access application；
- 更新根 `Makefile` 和 package scripts 中与旧 Vinext 输出耦合的部分，但不改变 workspace 命令名称。

SSR 不能只通过“页面能打开”或 hydration 后 DOM 验收。clean build 后需要确认 `dist/client` 中不存在会静态拦截 `/` 或 `/:platform` 的 HTML shell，并直接获取 Wrangler runtime 的原始响应 HTML：

- `/` HTML 包含默认平台名称和至少一条由 loader 渲染的帖子内容；
- `/:platform` HTML 包含对应平台名称和至少一条帖子内容；
- 原始 HTML 与 Phase 0 基线对照，关键首屏内容没有退化为客户端加载后的结果；
- 不使用浏览器 hydration 后的 DOM 代替 SSR 证据。

如果构建产物或 Assets routing 出现静态 HTML 抢先命中的证据，再评估显式配置 `assets.run_worker_first`；V1 不在缺少验证的情况下预先固定该值。

完成标准：dry-run 通过，生成配置保留 `cache.enabled: true`，Wrangler 本地 runtime 的页面、Assets、404 和 `/health` 全部正常，且首页与平台页的原始 HTML 包含 loader 渲染的首屏内容。

### Phase 7：删除旧运行时并更新文档

在 TanStack Worker runtime 验证完成后删除：

- 旧 `app/` route tree；
- Vinext `vite.config.ts`；
- `vinext`、`@vinext/cloudflare`、`react-server-dom-webpack`；
- 所有 `next/*` import；
- `NEXT_PUBLIC_*` 环境变量；
- Vinext 专属构建、部署和清理规则；
- `.next`、Vinext typegen 和旧 Vinext `dist` 内容；`dist/server/wrangler.json` 路径由新的 TanStack/Cloudflare build 重新生成，不作为 Vinext 专属路径永久删除；

同步更新：

- `frontend/inspire-me/AGENTS.md`；
- `frontend/inspire-me/README.md`；
- 根目录清理脚本；
- 部署和 health 文档中涉及构建方式的说明。

完成标准：workspace 中不存在 Vinext / Next 运行时依赖，文档、命令和实际部署链路一致。

## 7. 验收清单

### 7.1 静态检查

- `generate:data`；
- `generate:routes`；
- workspace `type-check`；
- `lint`；
- `format:check`；
- production `build`；
- `wrangler deploy --dry-run`；
- 根 workspace type-check 仍包含 `@groupher/inspire-me`。

### 7.2 本地和 Wrangler 路由

至少验证：

```text
/
/?page=2
/?page=abc
/?page=12abc
/?page=1.9
/?page=0
/?page=999
/featurebase
/canny
/featurebase?page=2
/featurebase?page=0
/featurebase?page=999
/not-a-platform
/health
/favicon.svg
/platform-logos/featurebase.png
/feedback-platforms/index.json
```

### 7.3 行为与质量

- 首页选择正确的默认平台；
- 首页和动态平台页使用相同的兼容分页解析；
- 平台切换不携带旧 `page`；
- 应用生成的第一页链接不带 `?page=1`，但直接访问该 query 时不重写 URL；
- 前后分页、页码、省略号逻辑正确；
- 浏览器前进/后退与直接刷新正确；
- 动态平台 title 和 description 正确；
- 无效平台返回真正的 404；
- 外部来源链接仍在新窗口打开；
- client bundle 不包含完整研究数据；
- Worker 首次读取和 cache 后读取均正常；
- 无 hydration warning、Assets binding error 或 JSON parse error。

### 7.4 生产验证

部署成功本身不等于完成。必须在真实公开入口验证：

```text
https://inspire-me.groupher.com/
https://inspire-me.groupher.com/featurebase
https://inspire-me.groupher.com/featurebase?page=2
https://inspire-me.groupher.com/not-a-platform
https://inspire-me.groupher.com/health
```

同时确认：

- Cloudflare Access 仍然生效；
- custom domain 指向新的 Worker deployment；
- 页面、Assets 和 health 均非 `workers.dev` 临时地址；
- 分别抓取 `/` 和 `/featurebase` 的原始响应 HTML，确认包含对应 loader 渲染的平台名称和至少一条帖子内容，验收标准与 Phase 6 一致，不能使用 hydration 后 DOM 代替 SSR 证据；
- `assets.run_worker_first` 的最终决策以真实 Cloudflare Assets 层的生产证据为准；如果生产出现静态 HTML 抢先命中，再显式配置并重新验证，不以 Miniflare/Wrangler 本地行为直接推定；
- Worker logs 没有路由 fallback、Assets binding 或数据读取错误；
- 旧 deployment 可以在异常时回滚。

## 8. 非目标

V1 不处理：

- 将应用移动到 `frontend/inspire-me`，workspace 名称保持不变；
- 不改变公开 URL、平台 ID、JSON schema 或分页大小；
- 不引入 TanStack Query、Valtio 或新的客户端数据层；
- 不把研究数据放进数据库、KV、D1 或 R2；
- 不重做数据抓取和 Markdown 生成流程；
- 不重做页面设计；
- 不批量清理 Tailwind arbitrary values；
- 不修改 Cloudflare Access 的产品策略；
- 不将 Inspire Me 加入公开 Status，除非另行确认其产品关键性；
- 不把这次迁移扩大为其他 Next/Vinext 应用的框架迁移。

## 9. 建议提交批次

如果按功能拆分提交，建议保持以下边界：

1. `refactor(fe): add inspire me tanstack runtime skeleton`
   - dependencies、app config、router、root、route generator、health；
2. `refactor(fe): migrate inspire me routes and data loaders`
   - feedback data、首页、动态平台、typed search、metadata、404；
3. `refactor(fe): migrate inspire me presentation components`
   - 组件拆分、TanStack Link、图片和分页 UI；
4. `chore(fe): switch inspire me worker deployment`
   - Wrangler、scripts、dry-run、部署配置；
5. `chore(fe): remove inspire me vinext runtime`
   - 删除旧 app tree、依赖、遗留配置并更新文档。

每批提交都只 stage 对应路径，并在提交前检查 cached diff、空白错误和当前 dirty worktree，避免带入无关修改。

## 10. 完成定义

V1 只有在以下条件全部满足时才算完成：

- `frontend/inspire-me` 只使用 TanStack Start，不再依赖 Vinext 或 Next runtime；
- `/`、`/:platform`、分页、metadata、404 和 `/health` 行为与迁移前一致；
- 研究数据仍作为 Assets 读取，没有进入 JS bundle；
- Vite dev、production build、Wrangler dry-run 和 Worker runtime 验证通过；
- `inspire-me.groupher.com` 真实 URL 验证通过；
- Cloudflare Access、custom domain、Worker observability 和回滚能力不受影响；
- workspace 静态检查和根 type-check 通过；
- AGENTS、README、部署文档和实际命令一致；
- 旧 Vinext / Next 文件、依赖、环境变量和生成产物已清理。
