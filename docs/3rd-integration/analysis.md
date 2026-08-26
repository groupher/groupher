# 第三方分析集成

> 迁移提示：本文中的 Main/Dashboard 文件路径是功能最初落地时的历史位置。当前公开页面
> host 为 Community、管理 host 为 Dash；后续修改必须使用现存 TanStack 路径。

> 状态：v1 已实现；v2 后续工作见下文。
>
> 范围：社区管理员为公开社区页面配置的第三方分析脚本。

## 产品边界

本文档只覆盖 Dashboard 的 `Integrations / Third-party / Analytics`。它不定义
也不改变 Groupher 内置的 Web Analysis 实现。

第三方分析是社区自有的集成入口：

- 社区管理员选择一个受支持的分析 provider。
- 社区管理员输入 provider 正常的公共追踪身份，例如 Google Analytics 的
  measurement ID 或 Fathom 的 site ID。
- Groupher 存储配置，并在配置启用且有效时，仅在该社区的公开页面上注入
  provider 脚本。

v1 的 provider 集合：

- Google Analytics
- Google Tag Manager
- Microsoft Clarity
- Plausible
- Fathom

不要把 Umami 加入默认的 v1 provider 列表。如果以后需要支持用户自有的 Umami，应
作为高级“custom Umami”集成开放，而不是混入默认分析选项。

Provider 可用性和配置字段定义应来自后端。把它们当作编辑器模板：Dashboard 向
后端询问支持哪些分析 provider、每个 provider 需要哪些字段、应该展示哪些校验
提示。避免在 Dashboard UI、后端校验和公开脚本加载三处分别维护同一份 provider
列表。

## 运行时范围

第三方分析脚本应从公开 community 布局注入：

```text
frontend/main/src/app/[community]/layout.tsx
  -> ThirdPartyAnalyticsScripts
  -> Client
```

不要从 Dashboard 布局注入这些脚本。Dashboard 是集成配置的管理面，不应被社区
管理员的第三方分析账号追踪。

v1 不要把第三方分析放到根 `frontend/main/src/app/layout.tsx`。该特性是
community 维度的，`[community]/layout.tsx` 已经拥有决定哪些脚本可被渲染所
需的 community dashboard 数据。

### 内容安全策略（CSP）

如果生产中由 Groupher 发送 CSP 头，第三方分析的上线必须先更新它，才能正式启用。
至少需要检查 v1 provider 域名的 script/connect 权限：

```text
www.googletagmanager.com
www.google-analytics.com
www.clarity.ms
scripts.clarity.ms
plausible.io
cdn.usefathom.com
```

保持具体的 CSP 指令靠近部署/header 实现。本文只记录需要考虑的 provider 域名。

GTD 状态：

- `Waiting`：确认生产当前是否在应用代码、Vercel、Cloudflare 或其他反向代理中
  设置 CSP。
- `Next`：如果存在 CSP，在启用第三方分析之前，把上述 provider 域名加到相关
  `script-src` 和 `connect-src` 指令。
- `Later`：如果生产目前没有 CSP，把它列为第一次 CSP 推出时的部署清单项。

## 加载规则

脚本必须按 provider 条件加载。

```text
community 没有第三方分析配置
  -> 不渲染

provider 配置存在但 enabled 为 false
  -> 不渲染

provider 配置 enabled 但无效
  -> 不渲染

provider 配置 enabled 且有效
  -> 只渲染该 provider 的脚本
```

支持五个 provider 不应让每个 community 都下载五个分析库。v1 不要使用第三方
npm SDK。仅在某个 provider 启用时，渲染精简的 Next `Script` 标签和内联引导。

预期的无配置路径：

```text
SSR community layout
  -> 没有有效且启用的第三方分析配置
  -> <ThirdPartyAnalyticsScripts /> 返回 null
  -> 没有第三方分析网络请求
```

## Provider 身份

这些值不是 secret。它们是分析 provider 期望网站放在浏览器可见脚本中的常规
公共追踪身份。

| Provider           | 用户提供的值   | 示例               |
| ------------------ | -------------- | ------------------ |
| Google Analytics   | Measurement ID | `G-1234567`        |
| Google Tag Manager | Container ID   | `GTM-ABC1234`      |
| Microsoft Clarity  | Project ID     | `abc123xyz`        |
| Plausible          | Site domain    | `docs.example.com` |
| Fathom             | Site ID        | `ABCDE`            |

不要在这种集成模型中存储或暴露 provider 管理凭据、API token、OAuth secret 或
服务端访问密钥。v1 只需要上述浏览器追踪身份。

## Provider Registry

后端拥有 provider registry。它应暴露一个 GraphQL 查询，供 Dashboard 渲染卡片
和设置表单。

建议形态：

```text
thirdPartyAnalyticsProviders: [
  {
    provider: "ga",
    title: "Google Analytics",
    desc: "Pageviews, traffic sources, user paths, and events.",
    docsUrl: "https://developers.google.com/analytics",
    icon: "/integrations/ga.png",
    configFields: [
      {
        key: "measurementId",
        label: "Measurement ID",
        placeholder: "G-XXXXXXXX",
        requiredWhenEnabled: true,
        pattern: "^(G|GT)-[A-Za-z0-9-]+$"
      }
    ]
  }
]
```

后端 registry 职责：

- 拥有 v1 支持的 provider key。
- 拥有不依赖前端运行时行为的 provider 卡片元数据。
- 拥有 config 字段定义和校验提示。
- 在 Dashboard 保存校验时复用同一 registry。

前端职责：

- 从后端 provider registry 渲染 Dashboard 卡片和表单。
- 如果图标只被 Dashboard 使用，将其放在 `frontend/dashboard/public/integrations`。
- 脚本渲染实现保留在前端代码，因为它依赖 Next `Script`、CSP/运行时行为，并
  且要避免后端下发可执行脚本字符串。

如果后端 registry 包含某个 provider，但前端还没实现对应的脚本渲染器，则公开
页面必须跳过该 provider 的脚本注入。Dashboard 可以显示为当前前端渲染器不支持，
或后端在该渲染器上线前不要返回它。

## 数据模型

为第三方分析添加一个专属的 community dashboard section。把它和内置分析配置
分开。

配置以 `community_dashboards` 一部分持久化，而不是放在 `communities` 表，也不
作为独立的 v1 表。它属于 community Dashboard 配置面，应沿用相同的 replace-style
dashboard section 更新路径。

建议的持久化形态：

```text
third_party_analytics: [
  {
    provider: "ga",
    enabled: true,
    config: {
      measurement_id: "G-1234567"
    }
  }
]
```

使用 provider 专属的 config key，而不是到处都使用一个泛化的 `id`。这样能让
校验和未来的 UI 标签更清晰：

| Provider    | Config field     |
| ----------- | ---------------- |
| `ga`        | `measurement_id` |
| `gtm`       | `container_id`   |
| `clarity`   | `project_id`     |
| `plausible` | `domain`         |
| `fathom`    | `site_id`        |

持久化形态使用 snake_case，因为它由后端存储和校验。GraphQL 和前端公开形态通过
Absinthe 常规的字段转换边界使用 camelCase。

公开页面渲染器应只接收标准化、可加载的 config：

```text
enabledThirdPartyAnalytics: [
  { provider: "ga", measurementId: "G-1234567" },
  { provider: "clarity", projectId: "abc123xyz" }
]
```

禁用、无效和草稿值应保留在 Dashboard 配置响应中，不应被渲染进公开页面 HTML。

为 `[community]/layout.tsx` 优先使用后端解析后的公开字段，如
`enabledThirdPartyAnalytics`。它应只返回启用且有效的 config，前端脚本渲染器仍
应在渲染前做防御性校验。

## 脚本注册

脚本渲染集中到一个前端 registry。布局不应包含 provider 专属分支，前端也不应
重复已经由后端 registry 返回的 provider 元数据。

建议位置：

```text
frontend/core/lib/thirdPartyAnalytics/
  validators.ts
  ThirdPartyAnalyticsScripts.tsx
```

职责：

- `validators.ts` 在渲染前对持久化 config 做防御性校验。
- `ThirdPartyAnalyticsScripts.tsx` 接收标准化 config 并渲染已启用的脚本。
- 本地一个 `SCRIPT_RENDERERS` 常量把 provider key 映射到渲染函数。这有意归前端
  拥有；不允许后端下发可执行脚本字符串。

高层形态：

```tsx
const SCRIPT_RENDERERS = {
  ga: renderGoogleAnalytics,
  gtm: renderGoogleTagManager,
  clarity: renderClarity,
  plausible: renderPlausible,
  fathom: renderFathom,
} as const

export function ThirdPartyAnalyticsScripts({ configs }) {
  const renderableConfigs = configs.filter(isRenderableAnalyticsConfig)

  if (renderableConfigs.length === 0) return null

  return renderableConfigs.map((config) => SCRIPT_RENDERERS[config.provider]?.(config) ?? null)
}
```

Provider 脚本应有稳定的 ID，避免重复注入：

```text
third-party-analytics-ga-loader
third-party-analytics-ga-init
third-party-analytics-gtm
third-party-analytics-clarity
third-party-analytics-plausible
third-party-analytics-fathom
```

推荐的 Next `Script` 策略：

| Provider           | Strategy           | 原因                                     |
| ------------------ | ------------------ | ---------------------------------------- |
| Google Analytics   | `afterInteractive` | 标准分析引导，不阻塞首次绘制。           |
| Google Tag Manager | `afterInteractive` | v1 中避免让 community 页面关键路径变重。 |
| Microsoft Clarity  | `afterInteractive` | session 工具应在 hydration 完成后启动。  |
| Plausible          | `lazyOnload`       | 轻量页面分析可以等浏览器空闲。           |
| Fathom             | `lazyOnload`       | 轻量页面分析可以等浏览器空闲。           |

## Provider 渲染说明

### Google Analytics

仅在 `measurement_id` 有效时渲染 `gtag.js`。

预期的浏览器可见输出：

```html
<script async src="https://www.googletagmanager.com/gtag/js?id=G-1234567"></script>
<script>
  window.dataLayer = window.dataLayer || []
  function gtag() {
    dataLayer.push(arguments)
  }
  gtag('js', new Date())
  gtag('config', 'G-1234567')
</script>
```

### Google Tag Manager

仅在 `container_id` 有效时渲染 GTM bootstrap。

预期的浏览器可见输出：

```html
<script>
  ;(function (w, d, s, l, i) {
    /* GTM bootstrap */
  })(window, document, 'script', 'dataLayer', 'GTM-ABC1234')
</script>
```

v1 故意省略 GTM 的 `noscript` iframe，因为 Groupher 公开 community 页面依赖
JavaScript 走正常运行时路径。如果以后需要 noscript 兜底，应在公开 body 区域
里刻意添加。

### Microsoft Clarity

仅在 `project_id` 有效时渲染 Clarity bootstrap。

预期的浏览器可见输出：

```html
<script>
  ;(function (c, l, a, r, i, t, y) {
    /* Clarity bootstrap */
  })(window, document, 'clarity', 'script', 'abc123xyz')
</script>
```

### Plausible

仅在 `domain` 有效时渲染 Plausible 脚本。

预期的浏览器可见输出：

```html
<script defer data-domain="docs.example.com" src="https://plausible.io/js/script.js"></script>
```

如需支持自托管 Plausible，以后再添加一个高级 origin 字段。除非有明确的产品需
要，否则 v1 不要加入自定义脚本 origin。

### Fathom

仅在 `site_id` 有效时渲染 Fathom 脚本。

预期的浏览器可见输出：

```html
<script src="https://cdn.usefathom.com/script.js" data-site="ABCDE" defer></script>
```

## 校验

使用足够严格的校验以避免意外脚本注入，同时保持产品简单。

建议的校验：

| Provider           | 校验                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| Google Analytics   | `measurement_id` 匹配 `/^G-[A-Za-z0-9-]+$/`                                                           |
| Google Tag Manager | `container_id` 匹配 `/^GTM-[A-Za-z0-9-]+$/`                                                           |
| Microsoft Clarity  | `project_id` 非空，且只包含字母、数字、下划线和连字符                                                 |
| Plausible          | `domain` 匹配 `/^[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?(\.[A-Za-z0-9]([A-Za-z0-9-]*[A-Za-z0-9])?)+$/` |
| Fathom             | `site_id` 非空，且只包含字母、数字、下划线和连字符                                                    |

所有用户输入的 provider 值应有一个实际的最大长度。除非某个 provider 有更严
格的文档限制，否则 provider 身份字段和域名使用 255 字符。provider key 应更短，
例如 32 或 64 字符。

校验应在两处执行：

- Dashboard 保存路径：拒绝无效的启用 config 并展示有用的字段错误。
- 公开渲染路径：即使已有错误数据，也要防御性地跳过无效 config。

## Dashboard UX

每个 provider 卡片打开一个设置 modal，包含：

- 启用开关。
- 一个必填的 provider 身份字段。
- provider 专属帮助文本和文档链接。
- 保存按钮。
- 当前状态：已启用、已禁用或无效。

v1 阶段每个 provider 使用一个 config 字段。在基础加载路径证明可行前，避免加入
高级事件映射、consent-mode 设置、自定义域名或 provider API 校验。

## 实施阶段

### Phase 1: Provider 列表清理

- 从默认 Analytics provider 列表移除 Umami、Matomo、Hotjar 和 Facebook Pixel。
- 保留 Google Analytics、Google Tag Manager、Microsoft Clarity、Plausible 和
  Fathom。
- 同一实现切片内，移除或停止引用被移除 provider 的 i18n key、设置元数据和
  Dashboard 图标。
- 只为 Dashboard 仍渲染的 provider 把图标保留在
  `frontend/dashboard/public/integrations`。
- 不需要兼容性迁移，因为这些不支持的 provider 从未作为公开特性发布。

GTD 状态：`Done`。

### Phase 2: 后端 Provider Registry

- 为 v1 analytics provider 新增后端 provider registry 模块。
- 新增 GraphQL types/query 用于 Dashboard provider 定义。
- 把 provider 标题、描述、文档 URL、config 字段名、placeholder 和校验提示从
  前端常量中移出。
- Dashboard 保存校验时使用同一个后端 registry。

GTD 状态：`Done`。

### Phase 3: 持久化和 GraphQL Contract

- 新增 `third_party_analytics` dashboard section 或等价的持久化 community
  dashboard 配置。
- 新增 provider 专属的 input 类型或与后端 provider registry 对齐的标准化 input
  形态。
- 为 Dashboard 读/写新增 GraphQL 字段/mutation。
- 新增公开 GraphQL 字段如 `enabledThirdPartyAnalytics`，使 community SSR 只
  接收启用且有效的 config。

GTD 状态：`Done`。

### Phase 4: 脚本注册

- 新增集中式的前端脚本渲染器 registry。
- 新增 validators。
- 新增 `ThirdPartyAnalyticsScripts`。
- 把它接入 `frontend/main/src/app/[community]/layout.tsx`。

GTD 状态：`Done`。

### Phase 5: Dashboard 设置

- 查询后端 provider 定义。
- 把 provider 卡片连到持久化 config。
- 用真实保存行为替换占位 modal 行为。
- 在卡片上展示已启用/已禁用/无效状态。

GTD 状态：`Partial`。

已完成：

- Provider 卡片从后端 registry 加载。
- 设置 modal 读取和保存持久化 dashboard 配置。
- 公开页面渲染使用启用且有效的公开 config。

接下来：

- 在卡片层面显示 `Enabled`、`Disabled` 和 `Invalid` 状态。

### Phase 6: 验证

本地验证应证明脚本加载行为，而不是第三方分析后台报告。

必需的检查：

```text
禁用的 provider
  -> HTML 中没有该 provider 脚本
  -> 没有该 provider 网络请求

启用但无效的 provider
  -> HTML 中没有该 provider 脚本
  -> Dashboard 在保存时显示校验错误

启用且有效的 provider
  -> 正确渲染该 provider 的脚本
  -> 仅出现该 provider 的网络请求

多个有效 provider
  -> 每个启用的 provider 渲染一次
  -> 禁用的 provider 不渲染

生产 CSP
  -> 必需的 provider host 被允许
  -> 启用的 provider 没有浏览器 CSP 违规
```

使用 Playwright 网络断言验证公开 community 页面。Dashboard 可视化检查使用
`/home` community，因为那里有可用的本地 dashboard 测试数据。

GTD 状态：本地自动化 E2E `Done`；生产 CSP 确认 `Waiting`。

本地 E2E 现在可以执行。它只应验证 DOM 和网络行为：

- 使用本地 Dashboard 为 `/home` community 保存 provider config。
- 在 Playwright 中打开公开的 `/home` community 页面。
- 按稳定的 script ID 断言 script 标签存在/缺失。
- 按 host 断言 provider 网络请求存在/缺失。
- 不要断言第三方厂商后台报告；那是外部集成检查，不是本地 E2E 要求。

本地自动化覆盖：

```text
MOCK_GRAPHQL_PORT=4101 PLAYWRIGHT_USE_SYSTEM_CHROME=1 E2E_APP=main \
  playwright test -c frontend/e2e/playwright.config.ts \
  frontend/e2e/tests/main/third-party-analytics.spec.ts
```

### Phase 7: Dashboard 反馈打磨

- 展示 provider 专属的校验错误，而不是泛化的占位 toast。
- 错误和后端 registry 字段定义保持绑定，让 Dashboard 不发明独立的校验文案。
- 优先使用可操作的示例，例如 Plausible 域名仅使用 hostname、Google provider
  使用 `G-`/`GTM-` 前缀。

GTD 状态：`Later`。

### Phase 8: Provider 扩展策略

- 公开脚本渲染器中跳过未知的 provider。
- 如果后端 registry 在前端渲染器实现前发布了一个 provider，决定 Dashboard
  是隐藏这些不受支持的 provider，还是显示为不支持。
- 把自托管 Plausible、自定义 Umami、PostHog、consent mode、自定义脚本 origin
  和事件映射视为单独的 provider 扩展工作，而不是 v1/v2 基础硬化的一部分。

GTD 状态：`Later`。

## 非目标

- 不要改变内置 Web Analysis。
- 不要在 Dashboard 加载 community 第三方分析脚本。
- v1 不要加入 provider API 调用或 provider credential 存储。
- v1 不要加入 consent 管理 UI。
- v1 不要支持自定义脚本 origin。
- v1 不要加入事件映射或转化配置。
- v1 不要加入并发冲突检测。
- v1 不要加入 dashboard config 审计日志。
