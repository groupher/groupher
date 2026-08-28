# 网络分析 v2

> 迁移说明：文中的 Next Dashboard `Client.tsx` 是已退役实现。当前 Trends 入口是
> `frontend/dash/src/routes/$community/trend.tsx`，服务端加载位于 `frontend/dash/src/server/trend.ts`。

> 状态：实现进行中。
>
> 范围：基于 Groupher 自有 UI 和 DTO 构建的 Dashboard`Analytics / Trends`，
> 并继续使用自托管的 Umami 作为采集与聚合查询引擎。

## 实现状态

- 第 1 阶段已就位：新初始化的社区会立即尝试创建其 Umami website，并将生成的 UUID 持久化到
  `community_dashboards.umami_website_id`；Main 只注入该社区的公共`data-website-id`。
  提供方故障不会阻塞社区创建；查询侧的幂等 provisioning 路径会在稍后重试。
- 第 2 阶段契约已在本地实现：`analysisTrendsOverview`是用于摘要加图表的 SSR/RSC 请求，
  而页面、来源、环境、位置和流量区块都有各自独立的 GraphQL 查询。 Dashboard 依赖 urql 缓存标识复用标签页；
  Trends 路径中不再保留浏览器`sessionStorage`缓存。
- 部署与生产能力验证仍然是发布门槛。
  第 3 到第 5 阶段有意仍属于后续工作。

## 目标

v2 将当前薄层的 Dashboard 分析界面，变成一个由单个社区对应一个 Umami website 支撑的原生 Groupher 概览页。
产品体验应像 Groupher，而不是像嵌入式 Umami 控制台。

首个实现应覆盖 Umami Overview 中常见的信息，同时收紧现有 v1 边界：

- Dashboard 向 Phoenix 请求分析数据。
- Phoenix 在查询分析数据前验证当前查看者和社区。
- Phoenix 解析社区拥有的`umami_website_id`。
- Phoenix 将 Umami 响应映射为 Groupher 自有 DTO。
- Dashboard 基于这些 DTO 渲染自定义图表和表格。
- 浏览器代码永远拿不到 Umami API 凭据。

Umami 仍然是供应商应用。不要为了 Groupher 的产品建模去 fork 或 patch Umami UI。

## 当前基线

v1 在 [`web_analysis_v1.md`](./web_analysis_v1.md) 中定义了内建 Web Analysis 模型：

- 为`groupher.com`使用一个全局 Umami website；
- 社区分析通过路由路径作用域推导，例如`/home`；
- 公共采集脚本由 Main 挂载；
- Dashboard 查询通过 Phoenix；
- 原始 Umami 响应字段不跨越提供方边界。

v1 期间的生产事故暴露了这种形状的两个限制：

- 提供方必须从一个全局 website 扇出，并在查询二级维度前反复推导路径作用域行。
  当有多个作用域路径时，一个 Dashboard 概览可能会变成几十次 Phoenix 到 Umami 的调用。
- Dashboard 使用了临时的`Client`fetch 路径和`emptyOverview`回退，以从认证/加载问题中恢复。
  这会让慢数据在请求完成前看起来像真实的零值。

v2 用按社区划分的 Umami website 替代全局 website 模型，并且不迁移 v1 历史数据。
权衡是明确的：v2 Dashboard Trends 从按社区 website rollout 之后收集的流量开始；
旧的全局 website 历史仅在未另作设计迁移前作为运维/供应商数据保留可用。

v2 还必须移除临时的 Client 侧 workaround。浏览器仍然可以 hydrate 交互式图表，
但初始 Dashboard trend payload 应来自正常的服务端 GraphQL 路径。

当前需要退役的实现说明：

- `frontend/dashboard/src/app/[community]/dashboard/trend/Client.tsx`是一条临时救援路径。
  它从浏览器请求`/api/graphql`，并维护一个标签页局部的`sessionStorage`缓存，这样刷新时不会闪出`0`。
- 正确的 v2 形态是通过`~/graphql/server`（`gqFetch`）进行 SSR/RSC 数据加载，
  它在存在当前请求 cookie 时已经会派生`Authorization: Bearer <token>`，
  在没有有效 token 时则保持匿名。
- 加载、空、部分与错误状态都必须显式表达。不要用`emptyOverview`来表示仍在飞行中的请求。

## 社区 Website 模型

v2 为每个社区使用一个 Umami website。 Umami website ID 由 Umami 生成，并由 Groupher 作为社区的分析身份存储。

只把供应商身份持久化到现有的“每个社区一行”的 dashboard 记录中：

```text
community_dashboards.umami_website_id uuid
```

该列在 rollout 期间应保持可空，这样现有社区可以逐步 provisioning。 v2 的退出标准应要求每个活跃社区都有一个值。
不要把这个字段放到`communities`上；Umami website ID 不是公开的社区身份。

不要添加`web_analysis_enabled`。内建 Web Analysis 是平台能力，默认启用。
也不要复用第三方集成的 analytics 模型；那个面向用户自有的外部脚本和 provider IDs。

推荐的 Umami website 属性：

```text
id:     <Umami 生成的 UUID>
name:   <community.slug>
domain: groupher.com
```

使用`community.slug`作为`name`，因为它足够稳定，便于管理界面展示，并且在社区标题变化时不会频繁抖动。
如果将来 slug 变更成为受支持的产品操作，那么更新 Umami website 名称只是外观层面的事情，可以异步处理。

`domain`保持平台主域名`groupher.com`。采集隔离通过`data-website-id`实现，而不是通过 domain。
社区自定义域名仍应渲染同一个社区的`umami_website_id`；它不需要新的 Umami website。

生命周期：

```text
community created
  -> Phoenix 调用 Umami POST /api/websites
  -> Phoenix 将返回的 website.id 存为 umami_website_id

community public page rendered
  -> Main 解析 community umami_website_id
  -> script 渲染 data-website-id=<umami_website_id>

dashboard trend loaded
  -> Phoenix 解析 community umami_website_id
  -> Phoenix 直接查询该 Umami website
  -> Phoenix 返回 Groupher 自有 DTO
```

删除和重命名是产品生命周期决策，不是采集需求：

- 删除社区时可以删除 Umami website，也可以保留它以覆盖审计/恢复窗口。 v2 不需要迁移旧的全局 website 数据。
- 重命名社区标题不需要 Umami 变更。
- 更改 slug 只需要在管理界面希望同步新 slug 时，做一次外观性的 Umami`name`更新。
- 暂停或停用社区应停止公共脚本注入。除非社区按所选保留策略被永久删除，否则现有 Umami website 数据会被保留。

这个模型消除了 v1 的路径前缀隔离问题。 Phoenix 不再需要查询一个全局 website 并过滤`/home/**`行来推导社区摘要。
用户过滤仍由 Phoenix 校验，但它们现在只是已经被隔离的社区 website 内部的过滤条件。

## 产品表面

保持 Dashboard 导航简单：

```text
Analytics
  Trends
  Logs
```

`Trends`是第一个 v2 页面。它是社区流量的原生概览表面。

`Logs`不在 v2 范围内。只有在产品已经需要一个占位项时才保留这个导航项。
具体的 log/event 模型应移动到未来的`v3`文档，或者在达成一致形态之前标记为`TBD`。

不要在 Groupher 中暴露 Umami 的完整管理导航。 Groupher 只应呈现对社区管理员有用的分析视图。

## v2 趋势 DTO

将 API 设计为面向分区的 Trends endpoints。 Dashboard 不应在服务端渲染请求中加载所有标签页和维度。
SSR/RSC 仅加载顶部摘要和图表，这样刷新时首屏更稳定。所有下层面板都在 hydration 后由客户端拉取，
非默认标签页的数据按需获取，并由 GraphQL 客户端缓存。

建议的概览形态：

```text
analysisTrendsOverview(community, range, filters) {
  status
  provider
  range
  filters
  summary
  chart
  errors
}
```

建议的分区 endpoint 形态：

```text
analysisTrendPages(community, range, dimension, filters) {
  status
  items
  error
}

analysisTrendSources(community, range, dimension, filters) {
  status
  items
  error
}

analysisTrendEnvironment(community, range, dimension, filters) {
  status
  items
  error
}

analysisTrendLocation(community, range, dimension, filters) {
  status
  items
  error
}

analysisTrendTraffic(community, range, filters) {
  status
  timezone
  cells
  error
}
```

初始 Dashboard 渲染：

- 只服务端渲染`analysisTrendsOverview`；
- SSR/RSC 期间不要请求下层面板；
- hydration 后，请求默认可见的分区面板：
  - `analysisTrendPages(dimension: PATH)`；
  - `analysisTrendSources(dimension: REFERRER)`；
  - `analysisTrendEnvironment(dimension: BROWSER)`；
  - `analysisTrendLocation(dimension: COUNTRY)`；
- 只有在热力图 hydration 后可见时才请求`analysisTrendTraffic`；
- 非默认标签页只在管理员切换时请求。

标签切换时不得重新请求 urql 已经缓存的数据。不要为此使用`sessionStorage`或其他手写缓存层。

状态值：

- `ok`：已加载完整请求的 Trends payload。
- `partial`：至少有一个分区失败或不可用，但响应包含对其他分区可用的数据。
- `unavailable`：没有任何请求的分区可以加载。

当 v2 包含多个分区后，使用`errors[]`，而不是单个松散的`error`字符串：

```text
error {
  code
  message
  section
  providerStatus
}
```

当某个分区不可用时，返回一个存在的分区对象，带上自己的`status`以及空的`items`或`points`列表。
避免在可恢复的提供方缺口中混用缺失 key 和`null`。仅在有效行内部的可选标量值上保留`null`。

### 摘要

字段：

- `visitors`
- `visits`
- `views`
- `bounceRate`
- `visitDuration`

每个摘要指标在可用时都包含 Umami 的 provider comparison 值：

```text
metric {
  value
  previousValue
  changeRate
}
```

比较值使用 Umami 针对请求范围返回的`/stats`comparison payload。 v2 中，Phoenix 不应仅为了自己计算上一周期对比而额外发起第二次`/stats`请求。
如果 Umami 对某个指标省略了 comparison 数据，就返回当前值，并将`previousValue`和`changeRate`设为`null`。

Dashboard 随后可以像 Umami 一样渲染五个概览卡片，而不复制 Umami 的视觉样式。

摘要卡片比较 UI：

- 当`changeRate`存在时，在每个指标下方渲染一个紧凑的箭头和百分比。
- 正值`changeRate`使用向上箭头，负值使用向下箭头，`0`使用中性短横线。
- 对于`views`、`visitors`、`visits`和`visitDuration`，正向变化是好的，应使用正向颜色；负向变化应使用负向颜色。
- 对于`bounceRate`，正向变化通常是坏的，应使用负向颜色；负向变化应使用正向颜色。
- 如果`changeRate`为`null`，省略箭头行，而不是渲染`0%`。

指标计算边界：

- 如果 Umami 返回了 ready 值，Phoenix 就把提供方字段规范化到 DTO 中。
- 如果 Umami 只返回计数字段，Phoenix 计算：
  - `bounceRate = bounces / visits`；
  - `visitDuration = totalTime / visits`。
- 除以零时，显示指标返回`0`，而在没有有意义前置基线时，对比率返回`null`。
- 这些公式必须通过 provider adapter 测试覆盖，这样 Dashboard 就不会重新实现提供方数学逻辑。

### 图表

主图表需要一个标准化的分桶序列：

```text
chart {
  bucket
  points[] {
    timestamp
    views
    visits
  }
}
```

`bucket`是必需的，且必须是以下之一：

- `hour`：用于不超过 48 小时的范围，包括“过去 24 小时”。
- `day`：用于超过 48 小时的范围，包括 7、30 和 90 天。

`timestamp`是桶起始时间的 UTC 毫秒值。前端可以在标签中按查看者时区格式化它，但分组由后端定义，并且对整个响应保持稳定。

在 v2 中，默认渲染 pageviews 和 sessions。不要要求每个桶都提供`visitors`，除非已证明 provider endpoint 会返回它。
Umami 的`GET /api/websites/:websiteId/pageviews`通常返回 pageviews 和 sessions 数组；它可能不包含每个桶的唯一访客数。
如果 Dashboard 之后需要 visitors 线条，只应在验证了如 stats endpoint 或其他 timeseries endpoint 之类的 provider source 后再添加。

### 页面

暴露常见的页面 breakdown 标签：

- 小路
- 进入页面
- 退出页面
- 标题
- 询问

这些标签组不需要暴露完全相同的字段集合。使用一个共享的显示对，再加上对该维度有意义的 metric 字段。

建议形态：

```text
pages {
  path: pageMetric[]
  entry: countMetric[]
  exit: countMetric[]
  title: pageMetric[]
  query: countMetric[]
}

pageMetric {
  value
  label
  metrics {
    visitors
    visits
    views
    bounceRate
    visitDuration
  }
}

countMetric {
  value
  label
  metrics {
    visitors
    visits
    views
  }
}
```

这个嵌套的`pages { path, entry, exit, title, query }`形态是页面 breakdown 分组的概念类型模型，
不是单个分区请求返回的 payload。单个`analysisTrendPages(dimension: PATH)`请求只返回
所选维度的`{ status, items, error }`。

使用`value`作为稳定的原始维度值，使用`label`作为展示值。 Path 行来自当前社区 website。
当采集脚本按 website ID 作用域限定后，它们不需要强制的`/<community>`前缀。

不要把`bounceRate`或`visitDuration`强行塞到 provider 无法产生有意义值的标签上。
在 v2 中，`entry`、`exit`和`query`当前返回`pageMetric`行，其中`bounceRate: null`且`visitDuration: null`
（因为 Umami 对这些维度的 metrics 在语义上并不可靠）。前端必须把这些可空值视为这些标签不可用。

### 来源

暴露：

- 推荐人
- 渠道
- 领域

建议的 item 形态：

```text
sourceMetric {
  value
  label
  metrics {
    visitors
    visits
    views
  }
}
```

空的直接流量应规范化为 Groupher 自有枚举值：

```text
TrafficSource.direct
```

不要把 provider 特定的空字符串约定泄漏给 Dashboard 代码。

### 环境

暴露：

- 浏览器
- OS
- 设备
- 语言
- 屏幕

建议的 item 形态：

```text
dimensionMetric {
  value
  label
  metrics {
    visitors
    visits
    views
    percentage
  }
}
```

如果可用，前端可以把已知浏览器、OS 名称和设备映射到现有图标资源。未知值应渲染为纯文本行。

### 位置

暴露：

- 国家
- 地区
- 城市

建议的 item 形态：

```text
locationMetric {
  value
  label
  code
  metrics {
    visitors
    visits
    views
    percentage
  }
}
```

`value`和`label`是标准显示对。`code`是可选的 provider 或地理元数据，例如 ISO 国家代码。 Country 表在 v2 中是支持的；
地图渲染和地图专用 DTO 推迟到 v3，因为 Umami 不提供专门的 map endpoint。如果未来的地图使用 country metrics，
Groupher 必须自行负责 country 到几何形状或 country 到坐标的映射。

### 流量热力图

暴露按星期和小时划分的每周流量。 v2 对这个热力图使用 UTC 分桶，这样后端和前端不会对同一份数据做出不同解释：

```text
traffic {
  timezone: "UTC"
  cells[] {
    weekday
    hour
    visitors
    visits
    views
  }
}
```

`weekday`的取值为`0..6`，其中`0`表示周日。`hour`的取值为`0..23`。两个值都使用 UTC。
未来如果需要社区可配置时区，可以增加一个新的版本化字段或查询参数；不要悄悄改变 v2 的分桶语义。

Umami 的`/sessions/weekly`endpoint 返回的是按 weekday 和 hour 的 session count，而不是独立的 visitors 或 pageview counts。
把每个`[weekday][hour]`值映射到一个 traffic cell：

```text
visits = session count
visitors = session count
views = 0
```

这会保持 v2 heatmap DTO 的稳定，同时明确 provider 限制。
如果未来某个 provider 能返回按小时的唯一访客数或 pageviews，就在完成能力验​​证后，把这些值填到同一组 DTO 字段里。

## API 能力

Umami 的 website API 可以通过文档化 endpoint 提供大部分 v2 概览数据：

- `GET /api/websites`
- `POST /api/websites`
- `GET /api/websites/:websiteId`
- `POST /api/websites/:websiteId`
- `DELETE /api/websites/:websiteId`
- `GET /api/websites/:websiteId/stats`
- `GET /api/websites/:websiteId/pageviews`
- `GET /api/websites/:websiteId/metrics`
- `GET /api/websites/:websiteId/metrics/expanded`
- `GET /api/websites/:websiteId/sessions/weekly`

有用的 metric 维度包括：

- 路径、标题、查询、进入、退出；
- 引荐来源网址、渠道、域名；
- 国家、地区、城市；
- 浏览器、操作系统、设备、语言、屏幕；
- UTM来源、媒介、活动、术语、内容。

Groupher API 到 Umami API 的映射：

```text
Groupher field/query                         Umami endpoint
--------------------------------------------------------------------------------
analysisTrendsOverview.summary              GET /api/websites/:websiteId/stats
analysisTrendsOverview.chart                GET /api/websites/:websiteId/pageviews
analysisTrendPages(PATH)                    GET /api/websites/:websiteId/metrics/expanded?type=path
analysisTrendPages(ENTRY)                   GET /api/websites/:websiteId/metrics/expanded?type=entry
analysisTrendPages(EXIT)                    GET /api/websites/:websiteId/metrics/expanded?type=exit
analysisTrendPages(TITLE)                   GET /api/websites/:websiteId/metrics/expanded?type=title
analysisTrendPages(QUERY)                   GET /api/websites/:websiteId/metrics/expanded?type=query
analysisTrendSources(REFERRER)              GET /api/websites/:websiteId/metrics/expanded?type=referrer
analysisTrendSources(CHANNEL)               GET /api/websites/:websiteId/metrics/expanded?type=channel
analysisTrendSources(DOMAIN)                GET /api/websites/:websiteId/metrics/expanded?type=domain
analysisTrendEnvironment(BROWSER)           GET /api/websites/:websiteId/metrics/expanded?type=browser
analysisTrendEnvironment(OS)                GET /api/websites/:websiteId/metrics/expanded?type=os
analysisTrendEnvironment(DEVICE)            GET /api/websites/:websiteId/metrics/expanded?type=device
analysisTrendEnvironment(LANGUAGE)          GET /api/websites/:websiteId/metrics/expanded?type=language
analysisTrendEnvironment(SCREEN)            GET /api/websites/:websiteId/metrics/expanded?type=screen
analysisTrendLocation(COUNTRY)              GET /api/websites/:websiteId/metrics/expanded?type=country
analysisTrendLocation(REGION)               GET /api/websites/:websiteId/metrics/expanded?type=region
analysisTrendLocation(CITY)                 GET /api/websites/:websiteId/metrics/expanded?type=city
analysisTrendTraffic                        GET /api/websites/:websiteId/sessions/weekly
```

共享的 Umami 参数：

- `startAt`：UTC 范围起始时间戳，单位毫秒。
- `endAt`：UTC 范围结束时间戳，单位毫秒。
- `filters`：由 Phoenix 翻译为 Umami 支持的过滤参数的 Groupher 自有过滤器。
- `limit`：`metrics/expanded`的分区行限制；默认使用较小的产品限制，例如`10`或`20`，而不是 Umami 的最大值。

接口特定参数：

- `analysisTrendsOverview.chart`在不超过 48 小时时发送`unit=hour`，超过 48 小时时发送`unit=day`。
  它还会发送`timezone=UTC`。
- `analysisTrendTraffic`发送`timezone=UTC`。
- `analysisTrendsOverview.summary`依赖`/stats`comparison 数据。 v2 中 Phoenix 不会额外发起 previous-period`/stats`请求。

提供方响应映射：

```text
/stats
  pageviews             -> summary.views.value
  visitors              -> summary.visitors.value
  visits                -> summary.visits.value
  bounces / visits      -> summary.bounceRate.value
  totaltime / visits    -> summary.visitDuration.value
  comparison.*          -> previousValue/changeRate when available

/pageviews
  pageviews[].x         -> chart.points[].timestamp
  pageviews[].y         -> chart.points[].views
  sessions[].x          -> chart.points[].timestamp
  sessions[].y          -> chart.points[].visits

/metrics/expanded
  name                  -> item.value and item.label after provider normalization
  pageviews             -> item.metrics.views
  visitors              -> item.metrics.visitors
  visits                -> item.metrics.visits
  bounces / visits      -> item.metrics.bounceRate when meaningful
  totaltime / visits    -> item.metrics.visitDuration when meaningful

/sessions/weekly
  [weekday][hour]       -> traffic.cells[] with weekday, hour, visits
```

`analysisTrendLocationMap`故意不属于 v2。 Umami 可以提供位置 metric 行，但它不提供一对一的 map DTO。
未来的 v3 地图应当要么通过 Groupher 自有的地理映射层，从`country`/`region`/`city`行派生 map points，
要么引入一个不同的 provider/projection，直接返回可用于地图的数据。

Umami website 管理仅限服务端。浏览器代码会接收用于采集的`data-website-id`，但永远不会接收用于创建或查询 website 的 API token。

Umami 可能不会在一次请求中返回所有 Trends 维度。即使每个社区只有一个 website，
provider adapter 也应把每个 Trends endpoint 视为一次有边界的 provider 读取：

- 带 provider comparison 的 stats；
- pageviews 图表序列；
- 一个选定的 metric 维度对应一个分区标签页；
- weekly sessions 用于流量热力图。

使用较小的并发限制、有限超时，以及不设上限的重试。不要在一次 Phoenix 请求里重复拉取同一份数据。
默认标签页数据和非默认标签页数据应当是不同的 GraphQL 请求，这样初始页面就不会为管理员尚未打开的标签页付费。

不要为标签数据添加手写浏览器缓存。让 urql 按 operation 和 variables 为分区标签页查询缓存。
如果某个分区请求失败，返回该分区自己的错误，而不是让无关分区一起失败。

不要查询不受支持的 Umami 维度。 v1 事故表明`metrics/expanded type=url`在已部署的 Umami 实例中返回 HTTP 400。
在证明有受支持的 provider query 之前，不要发布 Dashboard 的`URL`标签。

在启用某个标签或 metric 维度之前，针对已部署的`analysis.groupher.com`实例运行并记录一份能力检查清单。
下表是必需清单，不只是代表性样本：

```text
surface        endpoint                         required result
summary        stats                            200; pageviews, visitors, visits,
                                                bounces, totaltime, comparison
chart          pageviews                        200; pageviews and sessions arrays
traffic        sessions/weekly                  200; weekday/hour session counts
path           metrics/expanded?type=path       200, non-empty when traffic exists
title          metrics/expanded?type=title      200 or disabled tab
query          metrics/expanded?type=query      200 or disabled tab
entry          metrics/expanded?type=entry      200 or disabled tab
exit           metrics/expanded?type=exit       200 or disabled tab
referrer       metrics/expanded?type=referrer   200 or disabled tab
channel        metrics/expanded?type=channel    200 or disabled tab
domain         metrics/expanded?type=domain     200 or disabled tab
browser        metrics/expanded?type=browser    200 or disabled tab
os             metrics/expanded?type=os         200 or disabled tab
device         metrics/expanded?type=device     200 or disabled tab
language       metrics/expanded?type=language   200 or disabled tab
screen         metrics/expanded?type=screen     200 or disabled tab
country        metrics/expanded?type=country    200 or disabled tab
region         metrics/expanded?type=region     200 or disabled tab
city           metrics/expanded?type=city       200 or disabled tab
```

Provider 请求默认值：

- 并发：每个 Phoenix 请求中最多`3`个并发的 Umami API 请求；
- 超时：每个 Umami API 请求最多`5s`；
- 重试：默认`0`，网络错误或 5xx 响应时最多`1`次重试；

如果这些值需要变化，请连同本文档和 provider 测试一起更新，这样生产行为就不会停留在模糊的“有限”措辞上。

参考文档：

- https://umami.is/docs/api/website-stats
- https://umami.is/docs/api/website-metrics
- https://umami.is/docs/api/sessions

## 过滤模型

高级选择器应通过 Groupher 自有的 filter DSL 提供支持。不要直接把原始的 Umami filter JSON 暴露给 Dashboard 组件。

建议形态：

```text
filter {
  combinator: "and"
  conditions[] {
    dimension
    operator
    value
  }
}
```

v2 只支持扁平的`and`组。这能覆盖常见场景，例如：

```text
path contains "blog" AND country is "US"
```

边界情况：

- `conditions: []`表示没有用户过滤器。
- 单个条件仍然使用`combinator: "and"`；不要省略`combinator`。
- 未知维度或运算符会在发起任何 provider 请求前被拒绝。

UTM 维度在 v2 中仅用于过滤。它们被列为有效的过滤维度，是因为 Umami 可以暴露 UTM 数据，但 v2 不提供 UTM breakdown 标签。
未来某一阶段可以在有明确 Dashboard 用例时添加`sources.utm`分区。

在有具体 UI 和 provider 翻译方案之前，不要添加嵌套的`or`组。
如果以后确实需要，应当对输入形态进行版本化，而不是复用`conditions[]`。

初始维度：

- `path`
- `title`
- `query`
- `referrer`
- `channel`
- `domain`
- `country`
- `region`
- `city`
- `browser`
- `os`
- `device`
- `language`
- `screen`
- `utmSource`
- `utmMedium`
- `utmCampaign`
- `utmTerm`
- `utmContent`

初始运算符：

- `is`
- `isNot`
- `contains`
- `notContains`

第一版 UI 要保守。选择器在视觉上可以类似 Umami 的维度选择器，但它应当被建模为 Groupher filters，
这样未来的 provider 或 projection 才能复用同一份契约。

## 社区范围不变量

v2 最重要的规则是：用户过滤器始终应用在服务端推导出的社区 website 内部。

```text
Dashboard selected community
  -> Phoenix 加载 community.umami_website_id
  -> Phoenix 验证查看者权限
  -> Phoenix 只查询那个 Umami website
  -> Phoenix 在该 website 内应用用户过滤器
  -> Phoenix 将提供方响应映射为 overview DTO
```

不要信任客户端传入的 website ID 或路径作用域。客户端可以提出过滤条件，但 Phoenix 必须掌控社区边界，
并从可信数据库状态中解析`umami_website_id`。

因为 v2 为每个社区使用一个 website，社区隔离不依赖路径前缀或通配符语义。路径过滤器是可选的用户过滤条件，
不是授权边界。

仅用于 provider 能力研究时，保留一个小型调试脚本或私有运维页面，用来验证已部署的 Umami API 是否支持更丰富的路径过滤：

```text
filters={"path":"/home"}
filters={"path":{"operator":"contains","value":"/home"}}
filters={"path":{"operator":"regex","value":"^/home(/|$)"}}
```

不要把这个调试 UI 放进公共 Dashboard 产品表面。如果运维测试证明支持前缀/正则，只能把它用于可选的社区内过滤，
不能用于社区隔离。

v2 的流量热力图遵循与 Trends 其余部分相同的过滤语义。
如果某个 provider endpoint 不能将请求的过滤集合应用到每周 session 数据上，则应将热力图分区返回为`partial`或`unavailable`，
而不是在过滤后的分区旁边静默显示未过滤的流量。

## 前端实现

分析界面使用自定义 Groupher 组件。 UI 应借鉴 Umami Overview 的信息架构，而不是它的实现或视觉系统。

实现中会把可复用的 Dashboard UI 保持在现有 Core unit 中，而不是创建第二棵 route-local 组件树。
路由只拥有 SSR overview query；`WebOverview`拥有交互式分区客户端。

相关拆分：

```text
frontend/dash/src/
  routes/$community/trend.tsx     # route loader 与页面入口
  server/trend.ts                 # overview query 和显式失败 DTO
  components/TrendRoutePage.tsx   # 组合共享 WebOverview

frontend/core/unit/DashboardThread/Analysis/WebOverview/
  SummaryGrid.tsx
  TrendChart.tsx
  PagesPanel.tsx                  # 为所选标签页发起一个查询
  SourcesPanel.tsx                # 为所选标签页发起一个查询
  EnvironmentPanel.tsx            # 为所选标签页发起一个查询
  LocationPanel.tsx              # 为所选标签页发起一个查询
  TrafficPanel.tsx                # 由 IntersectionObserver 门控的查询
  schema.ts                        # 浏览器 GraphQL documents
```

只有在路由需要本地 DTO 映射、日期/范围辅助函数或查询常量时才添加`helper.ts`。
不要把它作为一个空的惯例文件创建出来。

`Client.tsx`不应负责初始数据加载。如果图表、范围变化或过滤交互需要客户端组件，
它们应以 SSR 数据作为初始状态，然后通过正常的 GraphQL client 重新请求。

需要移除的临时 v1 救援代码：

- `frontend/dashboard/src/app/[community]/dashboard/trend/Client.tsx`中仅浏览器可用的`fetch('/api/graphql')`；
- `sessionStorage`作为本地分析缓存；
- 在第一次响应完成前渲染`emptyOverview`。

客户端重新请求时使用现有 GraphQL/cache 层。加载状态应是`fetching`或显式 DTO status，而不是手写存储。

遵循现有 Dashboard 约束：

- 每个文件只放一个组件；
- 不要把`const s = useSalon()`作为 props 传递；
- 优先使用`frontend/core/tailwind/common/utils.css`中现有的全局类；
- 需要相互覆盖时使用`cnMerge`；
- 除非现有工具类无法表达布局，否则避免任意 Tailwind 值。

## 图表库

`shadcn/ui`charts 是对 Recharts 的封装。当前 shadcn CLI 通过每个 package 的`components.json`支持 monorepo 项目，
但 Groupher 不需要为了这个功能引入整套 shadcn 组件系统。

参考文档：

- https://ui.shadcn.com/docs/monorepo
- https://ui.shadcn.com/docs/components/chart
- https://ui.shadcn.com/docs/changelog/2026-03-cli-v4

建议：

- 直接使用 Recharts，或者只拷贝小型的 chart wrapper 模式；
- 将 chart primitives 保持在 Groupher 自有文件中；
- 不要 wholesale 导入 shadcn cards、buttons、selects 或 theme tokens；
- 视觉样式保持与当前 Dashboard 的颜色、圆角、排版和间距一致。

这样可以得到有用的图表交互体验，同时不会把 Dashboard 设计系统绑定到 shadcn。

## 阶段计划

### 第 1 阶段：社区 Website Provisioning

- 将`umami_website_id`加到社区自有的 analytics/dashboard 配置中。
- 在社区创建时，创建一个 Umami website，属性如下：
  - `name = community.slug`;
  - `domain = groupher.com`。
- 存储 Umami 返回的 UUID。不要从 slug 推导它。
- 从当前社区的`umami_website_id`渲染 Main 的公共采集脚本。
- 从公共脚本路径中移除`WEB_ANALYSIS_WEBSITE_ID`。
- 为缺失、无效以及成功 provisioning 的 website ID 添加测试。
- 定义 suspend/deactivate 行为：非活跃社区不注入采集脚本，但现有分析数据会被保留。

退出标准：

- 新社区的流量被采集到该社区自己的 Umami website 中。
- Dashboard 可以从数据库记录中解析可信的`umami_website_id`。
- 浏览器代码永远拿不到 Umami API 凭据。
- 内建 Web Analysis 没有用户可见的启用开关。
- 不需要从 v1 全局 website 迁移历史数据。

### 第 2 阶段：Trends 契约

- 添加面向分区的 v2 GraphQL 查询：
  - `analysisTrendsOverview`;
  - `analysisTrendPages`;
  - `analysisTrendSources`;
  - `analysisTrendEnvironment`;
  - `analysisTrendLocation`;
  - `analysisTrendTraffic`。
- 在 Dashboard 页面迁移之前，保留现有的 v1 summary query。
- 针对社区自己的 Umami website，实现 SSR 概览的摘要和图表序列。
- 针对社区自己的 Umami website，将每个下层面板实现为客户端加载的分区查询。
- 添加显式的不可用与部分数据状态。
- 定义图表序列的`hour`和`day`分桶选择。
- 将 Umami`/stats`comparison 数据透传给摘要卡片。
- 即使 heatmap 渲染在第 2 阶段才上线，也要定义流量热力图桶的 UTC 语义。
- 添加范围裁剪和权限检查测试。
- 移除临时的 trend Client 初始加载 workaround，并通过`~/graphql/server`服务端渲染初始概览 payload。
- 将 SSR provider 读取限制为`/stats`和`/pageviews`。

退出标准：

- Dashboard 可以从 Phoenix DTO 渲染顶部摘要和趋势图表。
- Dashboard SSR 只执行一次 GraphQL overview 请求，不会等待下层面板。
- 客户端 hydration 会拉取默认可见的下层面板；非默认标签页在被选中时加载。
- 没有浏览器代码直接调用 Umami API。
- provider 失败不会让无关的 Dashboard 分区一起失败。
- DTO 测试覆盖`ok`、`partial`和`unavailable`状态。
- 缺失的 provider 字段以存在的空分区表示，而不是以不一致的缺失 key 表示。
- 刷新 Trend 页面时，在第一次请求完成前绝不会渲染`emptyOverview`回退数据。加载、空与错误状态彼此独立。
- 位置地图数据不属于 v2。

### 第 3 阶段：Breakdown 扩展

- 在能力检查通过后，添加第 2 阶段未发布的可选维度，例如 title、query、language、screen 和 UTM 维度。
- 只有在定义了 Groupher 自有的 geo mapping 层，或者引入一个直接返回可用于地图的数据的 provider/projection 之后，才添加 country 或 region 地图数据。
- 如果仅 UTC 桶不够，再添加更丰富的流量热力图控制。
- 为任何新的分区 endpoint 添加有边界的 provider fan-out 和请求超时覆盖。
- 不要对每个 path、每个 dimension 发起一次 Umami 请求。应针对隔离后的社区 website 查询维度，只有当 provider endpoint 没有 website 级别的等价能力时，才使用基于 path 的 fan-out。

退出标准：

- 页面覆盖 Umami Overview 的常见信息。
- 空状态有用且视觉上稳定。
- 每个 breakdown 都只读取当前社区 website。
- 后端不会在每个 Dashboard 请求中发起无上限数量的 provider 调用。
- 热力图输出使用文档化的 UTC weekday/hour 分桶。

### 第 4 阶段：Filters

- 将 Groupher filter DSL 加入 GraphQL input。
- 在服务端对维度和运算符做校验。
- 在应用用户过滤器之前先解析必需的社区 website。
- 构建高级选择器 UI。
- 先支持扁平的`and`组；嵌套的`or`组推迟到 UI 和 provider 翻译方案设计完成之后。

退出标准：

- 用户可以按页面、来源、位置、环境和 UTM 维度过滤。
- 过滤器不能切换或扩大当前社区 website。
- 无效过滤会返回类型化的 GraphQL error 或安全的空状态。
- 多个过滤器以显式`and`语义组合。

### 第 5 阶段：Logs 和 Events TBD

Logs 和 events 不属于 v2 实现。这个阶段只保留为标记。

在更后面的阶段开始之前，先定义：

- `Logs`指的是原始分析事件、采样事件、产品事件，还是类似审计的活动；
- API 形态、分页、保留策略和隐私策略；
- 数据来自 Umami、Groupher projection，还是其他产品事件流。

## 未决问题

第 2 阶段阻塞项：

- 哪些 Dashboard 角色可以读取分析：仅 owner、admin、moderator，还是单独的权限？
- v2 的范围应当只允许固定预设，还是允许自定义日期范围？

延后问题：

- 对于 v3 的国家或地区地图，Groupher 应该通过 Umami location metrics 加内部地理映射层来推导地图数据，
  还是使用单独的、可直接用于地图的 projection？
- 第一版生产 UI 是否需要嵌套`or`过滤器，还是扁平`and`对 v2 已经足够？
- 删除社区时，应该立即删除 Umami website，还是在恢复窗口后删除，或者永不自动删除？
- slug 重命名应当同步更新 Umami website`name`，还是通过尽力而为的后台任务更新？
- 旧的 v1 全局 website 应该只在 Umami admin 中可用，还是在 rollout 期间由 Phoenix 暴露一个仅运维可见的诊断入口？
