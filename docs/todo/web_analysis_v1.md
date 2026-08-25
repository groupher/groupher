# 网络分析 v1

> 状态：规划中。
>
> 目标：先验证面向真实 Groupher 页面、可自托管的 Umami 采集闭环，然后引入一个由 Groupher 拥有的轻量业务边界，这个边界最初可以只是透明转发，之后再扩展为社区隔离、权限和产品分析。

## 背景

Groupher 现在已经有一个自托管的 Umami 部署：

- 应用：`https://analysis.groupher.com`
- 运行平台：Fly.io（旧 Vercel 项目已退役）
- 源仓库：`groupher/umami`，fork 自`umami-software/umami`
- 数据库：Neon 项目`umami-dev`
- 为 Groupher 创建的 Umami website：
  - 名称：`groupher dev`
  - 域名：`groupher.com`

Umami 仍然是一个供应商应用。 Groupher 不应为了产品建模去修改 Umami 源码。 Groupher 负责业务映射、权限、脚本注入策略，以及任何面向产品的 DTO。

本文描述的是 Groupher 内建的 Web Analysis 功能。它不同于 Dashboard 中的`Integrations / Third-party / Analytics`产品面，用于让社区管理员配置他们自己的外部分析提供商，例如 Google Analytics、Google Tag Manager、Facebook Pixel、Hotjar、Microsoft Clarity，或者他们自己的 Umami 实例。

内建 Web Analysis 是一个平台能力。每个社区都具备它。 v1 中没有社区级别的启用/禁用开关，用户也不会为它选择 provider 或 tracking scope。

## v1 目标

1. 验证生产中的 Groupher 页面会加载 Umami 跟踪脚本。
2. 验证来自真实页面的 page view 会被`analysis.groupher.com`接收。
3. 验证 Umami 仪表盘会展示为配置 website 生成的流量数据。
4. 对`groupher.com`只使用一个内部 Umami website，并按路径范围过滤社区统计。
5. 先使用一个透明的服务端转发层，让 Dashboard 可以通过 Groupher 查询 Umami，同时不向浏览器暴露 Umami 凭据。
6. 保持第一版与后续的社区隔离、权限和产品级分析兼容。

## 非目标

- v1 不要 fork 或 patch Umami 内部实现。
- 不要把原始 Umami events 复制到 Phoenix。
- 在采集闭环和 API 边界被验证之前，不要先做自定义图表。
- v1 不要为每个社区创建一个 Umami website。
- 不要向前端暴露 Umami 管理员凭据、API key 或数据库凭据。
- 不要让`analysis.groupher.com`成为公开社区 URL 模型的一部分。它是一个分析服务源站。
- 不要把 Third-party Integrations 模型复用于内建 Web Analysis。
- v1 不要为内建 Web Analysis 添加面向用户的启用/禁用开关。

## 验收检查

### 1. 运行时脚本检查

在一个在线的 Groupher 页面上，验证渲染后的文档包含配置好的 Umami 脚本：

```html
<script
  defer
  src="https://analysis.groupher.com/script.js"
  data-website-id="<umami_website_id>"
  data-exclude-search="true"
  data-exclude-hash="true"
></script>
```

检查项：

- `src`使用的是`analysis.groupher.com`，而不是 Vercel 部署 URL。
- `data-website-id`与在 Umami 中创建的 website 一致。
- 脚本只从 Main app 根布局挂载一次，并且在页面子内容之后挂载，这样所有公开的 Main 路由都能被采集，而不需要把 analytics 绑定到`[community]`路由段。
- 脚本属性中不嵌入 PII、正文、邮箱、用户名或用户生成的原始内容。
- 如果请求上下文能够识别 staff/internal 流量，应当在脚本注入之前完成排除。
- 在采集之前应排除 query string 和 hash fragment。
- 如果路由可能包含敏感路径段，或者外部 referrer 可能携带敏感数据，则在启用这些路由的采集之前，添加`data-before-send`清理器。

### 2. 网络采集检查

打开一个在线页面并验证浏览器网络活动：

```text
browser
  -> GET https://analysis.groupher.com/script.js
  -> POST https://analysis.groupher.com/api/send
```

预期：

- `script.js`返回 200。
- `/api/send`返回成功响应。
- 记录的 URL 是在线 Groupher 页面路径，不包含 query string 或 hash。
- 持续页面导航会按 Umami 客户端脚本预期，记录额外的 page view 或 route change。

### 3. Dashboard 数据检查

在 Umami 中：

```text
analysis.groupher.com
  -> Websites
  -> groupher dev
  -> realtime / overview
```

预期：

- 在访问真实页面后会出现最近访问记录。
- Page URL、referrer、browser、OS、device 和 country 字段在可用时会被填充。
- 数据关联的是`groupher.com`这个 website，而不是临时的 Vercel 域名。

### 4. 后端 DTO 检查

在 Groupher 的业务层存在之后，Dashboard 应该先查询 Groupher：

```text
Dashboard
  -> Phoenix GraphQL / API
  -> Analysis
  -> Umami API
  -> 受限 DTO
```

预期：

- 浏览器不会使用管理员凭据直接调用 Umami API。
- Phoenix 会在返回数据之前验证当前社区和查看者。
- `Analysis`会把 Umami 响应映射为一个明确的、由 Groupher 拥有的 DTO。
- 未知的、Umami 特有的字段会在返回 Dashboard 之前被丢弃。
- DTO 字段由 Groupher 白名单和版本控制，而不是由 Umami 的响应结构决定。

## 产品边界

Groupher 有两个与 analytics 相关的表面：

| 表面                     | 目的                                                    | 负责人                       | 数据边界                           |
| ------------------------ | ------------------------------------------------------- | ---------------------------- | ---------------------------------- |
| 内建 Web Analysis        | 在 Dashboard`Analytics`中展示的原生社区流量和产品分析。 | Groupher 平台。              | Groupher 拥有的 Umami 部署。       |
| Third-party Integrations | 用户配置的外部分析脚本和 provider ID。                  | 社区管理员 / 外部 provider。 | 外部 provider 账户或用户自有服务。 |

这两个表面不能共用同一个持久化模型。 Third-party Integrations 可以有面向用户的 provider 选择和启用开关。内建 Web Analysis 不可以。

## 业务模型

v1 不应引入社区到 Umami website 的映射表。 Groupher 的公开路由模型是以路径为先：

```text
groupher.com/<community>/...
```

这意味着对`groupher.com`使用一个 Umami website 才是 v1 的正确形态。社区分析通过按路由路径过滤全局 website 数据得出。

### 全局 Website 配置

自托管 Umami website ID 是平台配置，不是每个社区的状态，也不是 v1 中新的 domain schema。

优先使用环境或应用配置：

```text
WEB_ANALYSIS_WEBSITE_ID=d91f259a-40b6-46d9-b8a5-d7d124a46ba4
WEB_ANALYSIS_API_TOKEN=<server_side_umami_api_token>
```

如果后续运行时操作需要管理后台编辑、审计历史或多个全局 analytics 后端，它可以迁移到一个单独的平台配置行。但这不是 v1 的要求。

`WEB_ANALYSIS_WEBSITE_ID`可以由公开页面渲染器用于加载采集脚本。`WEB_ANALYSIS_API_TOKEN`只用于 Phoenix 到 Umami 的 Dashboard 查询，绝不能暴露给浏览器 JavaScript。

Umami 源站在代码中固定为`https://analysis.groupher.com`。不同的 dev/staging/prod analytics 流应通过同一源站下不同的 Umami website ID 来表示，而不是通过面向用户的 provider/origin 开关。

部署面：

- Main 前端需要`WEB_ANALYSIS_WEBSITE_ID`来注入公开采集脚本。
- Phoenix 后端需要`WEB_ANALYSIS_WEBSITE_ID`和`WEB_ANALYSIS_API_TOKEN`来代理 Dashboard analytics 查询。
- Dashboard 前端应携带相同的`WEB_ANALYSIS_WEBSITE_ID`用于部署一致性和诊断，但在 v1 中不直接调用 Umami。它应该通过 Phoenix GraphQL DTO 来诊断 analytics，而不是接收 Umami 凭据。

不变式：

- v1 只使用一个`groupher.com`的 Umami website。
- 社区级统计通过 path filter 查询，而不是分别使用独立的 Umami website。
- v1 没有内建 Web Analysis 的`enabled`标志。
- 内建 Web Analysis 没有面向用户的 provider 选择。
- `WEB_ANALYSIS_WEBSITE_ID`是一个供应商身份，不应该变成公开的 Groupher ID。
- 浏览器可以接收 website ID 用于脚本采集，但 Dashboard analytics 查询仍然必须经过 Phoenix。

### 社区路径范围

当前社区的 analytics 范围应从 Groupher 路由中派生。 v1 不需要表，除非 route 到 community 的关系不再可派生。

示例：

| 社区       | 公开路径范围   | Umami website          |
| ---------- | -------------- | ---------------------- |
| `home`     | `/home/**`     | `groupher.com`全局网站 |
| `feedback` | `/feedback/**` | `groupher.com`全局网站 |
| `docs`     | `/docs/**`     | `groupher.com`全局网站 |

查询形态：

```text
community slug
  -> path prefix
  -> global Umami website ID
  -> 带 URL/path filter 的 Umami 统计查询
```

共享 website 的策略只有在已部署的 Umami API 能支持所需的 path-scope 查询时才有效。在 Phase 2 之前，创建一个至少包含两个社区、位于同一个 website 下的 fixture，例如`/home/...`和`/feedback/...`，并证明：

- 每个社区查询只返回自己的路径；
- 聚合计数与过滤后的页面集合一致；
- top pages 和 referrer 不会泄露另一个社区的路径。

如果 Umami 不能以可接受的正确性和性能按 path prefix 过滤，则不要继续使用基于 slug 的过滤。先修订查询策略，例如在`Analysis`中查询分组后的 URL 指标并过滤，添加一个受限投影，或者只有到那时才重新考虑分离的 Umami website。

如果某个社区以后有别名、自定义域名或无法仅从 slug 推导出的路径规则，则引入一个小型`community_analysis_scopes`表来存储 path/domain scopes。该表应存储查询范围，而不是 Umami website 身份。

## 运行时配置

v1 对所有公开 Groupher 页面使用一个全局 Umami website ID。

```text
Main root layout
  -> render children
  -> mount WebAnalysisScript with global Umami website ID
  -> later Dashboard queries filter by community path scope
```

对于当前的 Next 应用，内建 Web Analysis 脚本注入属于 Main app 根布局，不属于 Phoenix LiveView，也不属于`[community]`layout。 tracker 是 Main 公共应用的全局 page-view 采集器；社区边界在后续通过服务端查询层中的 pathname filter 派生。

实现说明：

- 在`frontend/main/src/app/layout.tsx`中把`WebAnalysisScript`挂载在`{children}`之后。
- 保持`strategy="afterInteractive"`，这样 tracker 不会阻塞初始 HTML 或 hydration 关键工作。
- 不要仅为了决定脚本注入而在 root layout 中读取请求 cookies；那会让该路由在 Vercel 上变成动态路由。
- 不要创建按社区分别注入脚本的逻辑。 v1 中所有 Main 路由都使用同一个全局 website ID。

## v1 请求流程

```text
Live page render
  -> root layout renders page content
  -> root layout mounts Umami script with global website ID after children
  -> browser sends page view to analysis.groupher.com
  -> Umami stores raw analytics events
```

```text
Dashboard analytics view
  -> current dashboard community
  -> GraphQL asks Phoenix for analytics summary
  -> Phoenix checks viewer permission
  -> Phoenix derives community path scope
  -> Phoenix calls Umami API with global website ID and path filter
  -> Phoenix returns bounded DTO to Dashboard
```

## 阶段计划

### Phase 0: 外部服务验证

当前重点。

- 确认`analysis.groupher.com`指向 Fly 上的 Umami 实例。
- 确认 Neon`umami-dev`包含迁移后的 Umami schema。
- 在 Umami UI 中手动创建或确认`groupher.com`的 Umami website，用于引导启动。
- 将 website ID`d91f259a-40b6-46d9-b8a5-d7d124a46ba4`记录为全局 analytics 配置值。
- 将该 website ID 记录到 Main 前端、Dashboard 前端和 Phoenix 后端使用的部署配置中。
- 手动验证脚本加载、`/api/send`和 dashboard 数据。

退出条件：

- `https://analysis.groupher.com/api/heartbeat`返回 200。
- `groupher dev`的 Umami website ID 已知，并存在于服务端配置中。
- 一个在线 Groupher 页面在 Umami 中记录到至少一次可见访问。

### Phase 1: 脚本注入

- 添加一种由服务端拥有的方式，把 Umami website ID 提供给在线页面渲染。
- 从 Main app 根布局挂载内建 tracker，位置在`{children}`之后。
- 从`https://analysis.groupher.com/script.js`加载脚本。
- 在 tracker script 上使用`data-exclude-search="true"`和`data-exclude-hash="true"`。
- 当需要比移除 query 和 hash 更强的路由/referrer 清理时，添加`data-before-send`。
- 在 v1 中对每个公开社区页面使用同一个全局 website ID。
- 将社区过滤视为基于 pathname scope 的服务端查询问题，而不是在社区布局中挂载单独脚本的理由。
- 当有可信 session 可用时，在注入脚本之前排除 staff/internal 流量。
- 在页面浏览循环被验证之前，避免自定义事件 payload。

退出条件：

- 生产页面访问采集无需手工编辑脚本即可工作。
- 清理测试覆盖具有代表性的敏感 URL 和 referrer 情况。
- 当请求能够识别 staff/internal 访问时，这些访问不会污染第一版基线。

### Phase 2: 透明 Dashboard 代理

- 添加一个最小服务模块`Analysis`，负责解析当前社区的路径范围并调用 Umami API。
- 添加一个小型 GraphQL/API 端点用于 summary 数据。
- 调用 Umami 时设置受限超时。
- 只重试幂等的读请求，且重试预算要小且固定。
- 在 Umami 5xx 或超时时，返回一个对 Dashboard 友好的、提示性的 fallback，而不是阻塞 Dashboard 请求。
- 返回一个受限 DTO，先包含最小的一组字段：
  - 7天汇总：页面浏览量、访问量、访问量/会话数、跳出量、总时间。
  - 按天 timeseries：pageviews 和 sessions。
  - 前10页。
  - 前 10 名推荐人。
  - 可选的 Top 10 browser、OS、device 和 country。

退出条件：

- Dashboard 能显示相同的基础统计，而不需要从浏览器直接与 Umami 通信。
- 权限检查在任何 Umami API 调用之前完成。
- Umami 依赖故障会产生一个明确的 unavailable/empty DTO 状态，而不会让整个 Dashboard 页面失败。
- 在向社区 analytics 公开之前，通过多社区 fixture 验证 prefix/path-scope 行为。

### Phase 3: 社区隔离

- 除非 path-filter 查询变得不够用，否则保持一个 Umami website。
- 让 Groupher 的 route-derived path scope 成为社区查询的权威来源。
- 确保社区管理员只能看到按其社区 path scope 过滤后的 analytics。
- 为 disabled、archived、deleted 或 domain-changed 的​​社区定义行为。
- 只有当自定义域名、别名或 route 规则使基于 slug 的 path scope 变得含糊时，才引入`community_analysis_scopes`。
- 只有在有明确需求时，才考虑为每个社区使用一个 Umami website，例如需要 Umami 原生隔离、按社区共享、删除/导出，或者路径过滤存在限制。

退出条件：

- 无法从另一个社区上下文查询到某个社区的 analytics 数据。
- 社区查询应用了正确的 path/domain scope。

### Phase 4: 产品分析

- 只有在 page-view pipeline 稳定之后，才添加自定义事件。
- 使用稳定的业务事件名和低基数属性。
- 对需要产品原生分析的功能，考虑受限投影，例如周报或内容表现汇总。

示例：

| 事件           | 目的                                           |
| -------------- | ---------------------------------------------- |
| `article_view` | 内容级流量汇总。                               |
| `post_vote`    | 产品参与趋势事件，而不是 vote 计数的事实来源。 |
| `docs_search`  | Docs 搜索效果和空结果检测。                    |

Phoenix/Postgres 仍然是事务型产品数据的事实来源，例如 votes、content status、permissions 和 moderation。 Umami 只用于流量、趋势、漏斗和行为分析。

## 安全与隐私

- Umami 管理员凭据只能保存在服务端密钥存储中。
- 前端只接收脚本 URL 和 website ID。
- v1 中不要把邮箱、登录名、昵称、文章正文、评论正文或原始搜索查询文本作为 event property 发送。
- 优先使用稳定的分类属性，而不是用户提供的字符串。
- 当请求带有可信 session 时，应在脚本注入之前排除 staff/internal 流量。匿名公共流量不能通过邮箱域名来分类。
- tracker 配置默认排除 query string 和 hash fragment。
- 如果公开 URL 中可能出现敏感值，则在采集之前，route/referrer 清理器必须移除或拒绝敏感的 path/referrer 值。

## Umami API 边界

`Analysis`应通过 provider adapter 调用自托管的 Umami API。不要直接查询 Umami 数据库。

```text
Origin:   https://analysis.groupher.com
API base: /api
Adapter:  Analysis.Provider.Umami
Auth:     server-side credential only
```

第一个 provider adapter 应该面向文档化的网站统计端点。下面的路径相对于`API base`：

- `GET /websites/:websiteId/stats`
- `GET /websites/:websiteId/pageviews`
- `GET /websites/:websiteId/metrics/expanded`

Phoenix 应使用服务端 Umami API token 进行认证，该 token 存储为`WEB_ANALYSIS_API_TOKEN`或等价的密钥配置。要求是 Phoenix 负责 token 处理，浏览器永远拿不到该凭据。

对于自托管的 Umami 部署，从 Umami 的登录 API 获取 token：

```bash
curl -s https://analysis.groupher.com/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"<umami_admin_username>","password":"<umami_admin_password>"}'
```

响应中包含`token`。只把该值存到 Phoenix 后端密钥配置中，作为`WEB_ANALYSIS_API_TOKEN`。

adapter 必须把 origin 和 endpoint path 组合成如下 URL：

```text
https://analysis.groupher.com/api/websites/:websiteId/stats
```

不能生成重复前缀，例如`/api/api/websites/...`。

## 未决问题

- 哪个 Dashboard 角色可以查看 analytics：仅 owner，还是 admin、moderator，或者一个专门的权限？
- Umami 的 URL/path 过滤是否能以足够的精度和性能覆盖所有需要的社区路由？
- 如果自定义域名或社区别名不再能从`community.slug`推导，应该如何表示？
- 后续是否需要一个公开流量页面，还是 analytics 暂时只对管理员可见？
