# About 访客分布地图

> 迁移提示：本文尚未实施，文中的 `frontend/main`、Next API route 和 `.next` 检查命令是
> 旧方案输入，不能直接执行。实施前必须改为 `frontend/community` 的 TanStack route/server
> function 边界；不恢复 Main 或 Next 兼容层。

> 状态：方案已确认，尚未实现。
>
> 范围：在社区 About 页面公开展示国家级访客分布，并为指定的大型国家细化 region marker；
> Dashboard 继续保留完整的国家、地区和城市级分析能力。

## 背景

Umami 已经为每个社区提供 `country`、`region`、`city` 等位置维度。当前这些维度属于 Dashboard
Analysis 管理能力；About 页面还没有面向普通访客的访问来源展示。

本方案在 About 的文字介绍下方增加“访客分布”区域：左侧使用 Cobe 渲染紧凑的地球，右侧展示国家访客统计列表。
右侧统计列表只展示国家级聚合；左侧地图将指定大型国家细化成 region marker。
城市数据继续只在后台供管理员查看。

## 产品目标

- 让社区公开展示其访客的全球分布。
- 右侧公开统计保持国家级聚合；region 只用于改善大型国家的地图落点，不展示城市明细。
- 不改变 Umami 的采集行为；开关只控制 About 页是否公开展示。
- 地图和列表使用同一个 30 天窗口；右侧列表以 country metrics 为统计权威，region metrics 只增强地图落点，
  不产生第二套国家统计。
- 不把国家坐标全集打进浏览器 bundle。

## 非目标

- 不在 About 页面列表中展示地区，不在任何 About 表面展示城市或单次 Session 数据。
- 不开放现有管理员查询 `analysisTrendLocation`。
- 不在浏览器中调用在线地理编码服务。
- 不把 Cobe 做成全站默认依赖；它只服务于存在访客分布数据的 About 页面。
- 不修改 Umami UI 或 Umami 的数据模型。

## Enable 配置

在 Dashboard 的 `Enable -> About` 子项中新增“访客分布”开关。

字段命名：

```text
Frontend: visitorLocationMap
Backend:  visitor_location_map
```

约束：

- 新字段默认值为 `false`，避免升级后自动公开既有社区的分析数据。
- About 父开关关闭时，`visitorLocationMap` 不产生公开展示。
- About 父开关关闭时，Dashboard 中的“访客分布”子开关显示为 disabled，但保留其原值；父开关恢复后继续使用原值。
- 开关关闭后，Umami 仍继续正常采集，Dashboard 仍可查看国家、地区和城市数据。
- 公开查询必须在服务端校验该开关，不能只依靠浏览器隐藏组件。
- 开关旁展示静态提示：“开启后，国家及大型国家的地区访客分布将公开展示，包括低访客量数据。”不在设置页
  为提示文案额外请求分析数据或展示动态国家数量。

## About 页面 UX

访客分布位于社区文字介绍之后、社区概况之前：

```text
社区文字介绍

┌──────────────────────────────────────────────┐
│ 访客分布                           近 30 天   │
│                                              │
│ ┌────────────────────┐ ┌───────────────────┐ │
│ │                    │ │ 中国       42%    │ │
│ │                    │ │ 美国       21%    │ │
│ │       Cobe         │ │ 日本       13%    │ │
│ │       Globe        │ │ 德国        8%    │ │
│ │                    │ │ 其他       16%    │ │
│ └────────────────────┘ └───────────────────┘ │
└──────────────────────────────────────────────┘

社区概况
成员
```

布局规则：

- 左右严格按 `50 / 50` 分布。
- 桌面端和移动端都保持左右结构，不切换为上下布局。
- Cobe 只占左半区域；通过缩小球体、裁切画布外缘和控制 marker 尺寸保持紧凑。
- 右侧展示 Top 5 国家，其余可识别国家合并为“其他”。
- 每一项展示本地化国家名称、访客数和占比。
- 动态数字使用等宽数字样式，避免加载或刷新时产生宽度抖动。
- 标题使用浏览器 DTO 顶层的 `days` 渲染为“近 {days} 天”（当前为 30）；该值来源于 GraphQL 的
  `range.days`。这样既避免前端常量与服务端窗口漂移，也避免把滚动时间窗误解为社区历史累计数据。

移动端仍为左右布局，因此需要使用紧凑版本：

- 隐藏非必要说明文案。
- 缩小国家列表的行间距和辅助字号。
- 保留至少可辨识的国家名称与占比；空间不足时访客数可作为次级信息隐藏。
- 地球不占满容器高度，也不把国家列表挤到首屏以下。
- 实现前必须验证 `320px`、`375px` 和 `430px` 三档原型。若空间不足，优先裁切地球、缩减列表信息和间距；
  未经新的产品决策，不自动改成上下布局。

## 数据口径

- 固定时间范围：最近 30 天。
- 排序指标：`visitors` 降序。
- 百分比分母：country 响应中所有合法且可识别的 ISO 国家代码对应访客数之和，包括最终合并进“其他”的国家。
- 各国家占比使用未四舍五入的访客数计算；Top 5 使用同一精度四舍五入，“其他”按
  `100 - sum(top5 displayed percentages)` 计算，确保显示值合计为 `100%`。
- 公开统计维度：`country`；region 仅作为指定大型国家的地图 marker 子项。
- 后台维度：继续支持 `country`、`region` 和 `city`。
- `Unknown`、空值和无法识别的国家代码不进入公开展示。
- Top 5 之外的可识别国家合并为“其他”；“其他”不生成地球 marker。
- 地图 marker 候选只来自右侧 Top 5 国家，不为“其他”中的国家生成 marker。
- 即使“其他”的占比大于 Top 5 国家占比之和，地图仍然只绘制 Top 5；“其他”只在右侧列表表达。这是头部分布
  可视化的明确产品取舍，不视为地图数据缺失。
- 不设置社区总访客量、country 或 region 的最低展示阈值。管理员开启该功能后，即使某个国家或 region
  只有一个访客也可以公开展示。

### 大型国家 region marker

为避免俄罗斯、加拿大、美国等大型国家的 marker 落在缺乏代表性的几何中心，以下国家初始使用 region marker：

```text
CN, US, CA, RU, AU, BR, IN, ID
```

- Phoenix 并行执行一次 `type=country` 和一次 `type=region` 的全局 `/metrics/expanded` 请求；总请求数固定为两次，
  不为每个国家单独发起 region 请求。
- Phoenix 对 Top 5 中 allowlist 内的国家最多按 visitors 取 Top 10 个已规范化 region，并移除该国的 country marker；
  Top 5 中的其他国家继续使用 country marker。Top 10 之外的 region 只是不绘制，不能通过 visitors 差值并入
  country fallback。
- Phoenix 不持有坐标数据；“已规范化”只表示 provider 已产出 canonical `countryCode` 和 `regionCode`，不表示
  Node 坐标表一定存在对应项。
- 因此地图最多包含 `5 * 10 = 50` 个 marker；实现不得因为 allowlist 有八个国家或 country 响应包含更多国家而
  绕过这个全局上限。该上限同时约束 Cobe 的视觉密度和运行时开销。
- Umami 文档将 region 定义为 ISO 3166-2，但运行值可能受 CDN header、GeoIP 数据源和部署配置影响。实现时必须
  先抽样当前 Umami 实例的真实 region 响应，再由 provider 将已知格式规范化为 canonical `countryCode` 和
  `regionCode`；不能直接依赖 `String.split(value, "-")` 推导父国家。无法规范化父国家的 region 不进入 Top 10。
- Next.js Node 端负责把 Phoenix 选出的 Top 10 region 映射到坐标。某个已规范化 region 缺少坐标时记录数据缺口
  并忽略该 marker，不在运行时使用第 11 名 region 补位；如果该国家最终没有任何 region 坐标可用，才回退为
  country marker。坐标缺失属于生成数据覆盖问题，应通过更新数据源与生成文件解决。
- region 的 `visitors` 只用于 region marker 的相对大小，不能把各 region visitors 相加后作为 country visitors；
  同一访客在 30 天内可能跨 region，直接求和可能重复。右侧统计始终使用独立 country 请求的结果。
- country 请求是公开统计的必需数据；region 请求只是地图增强。region 请求失败时退化为全部使用 country marker，
  不把整个模块标记为不可用，也不引入 `partial` 状态。
- 右侧列表始终按国家汇总，不展示 region 行。

## GraphQL 契约

新增用途明确的公开查询：

```graphql
analysisVisitorLocationMap(community: String!) {
  status
  range {
    days
  }
  countries {
    code
    visitors
    percentage
    regions {
      code
      visitors
    }
  }
  error {
    code
    message
    section
    providerStatus
  }
}
```

该查询与 Dashboard 的 `analysisTrendLocation` 保持分离：

- 不接受 `dimension`。服务端固定并行查询一次 country metrics 和一次全局 region metrics，并输出 country
  汇总与 allowlist region 子项。
- 不接受任意时间范围，服务端固定为最近 30 天。
- `range.days` 是 GraphQL 响应口径元数据，不是可变查询参数；Route Handler 将其转换为浏览器 DTO 顶层的
  `days`，About 标题使用 DTO 的 `days`，不在客户端写死 `30`。
- 不需要登录，但必须经过社区解析并检查 `visitor_location_map`。
- 不返回 Umami website ID、API 凭据、city 或原始供应商响应。
- error 复用现有 `analysis_web_error`：`code`、`message`、`section`、`providerStatus`。
- 该查询是一个原子 section，`status` 固定只使用 `ok` 或 `unavailable`，不使用 overview 聚合查询的
  `partial`，也不使用 summary 的 `ready`。
- country 请求失败时返回 `unavailable`；只有 region 请求失败时仍返回 `ok` 和 country marker 所需数据，
  同时记录内部日志与监控，不向公开调用方增加第三种状态。
- 开关关闭、没有数据或没有可识别国家时返回 `status: ok` 与空集合；Umami 未配置或临时失败时返回
  `status: unavailable` 与标准 error。两类响应在 UI 上都不渲染模块，但日志和监控可以区分。
- 成功的 provider 响应缓存 15 分钟，并复用社区级 singleflight，防止同一社区的并发请求击穿 Umami。
- provider 失败不进入长期缓存，但需要缓存约 30 秒的失败状态，避免故障期间并发重试打爆 provider。

## Node 端坐标转换

Cobe marker 需要 `[latitude, longitude]`，而 Umami 指标只提供国家和 region 标识。坐标与本地化名称转换在
Next.js Node 端完成，不在浏览器中携带国家或 region 地理数据全集。

建议链路：

```text
AboutThread client
  -> Next.js Route Handler
  -> Phoenix GraphQL: analysisVisitorLocationMap
  -> Phoenix Analysis provider
     -> Umami metrics/expanded type=country ┐
     -> Umami metrics/expanded type=region  ┘ parallel, constant two requests
  -> Phoenix normalized country/region DTO
  -> Next.js Node server-only country/region lookup
  -> browser receives compact marker DTO
  -> Cobe renders markers in the browser
```

`frontend/main/src/app/[community]/about/page.tsx` 和 `frontend/core/unit/AboutThread/index.tsx` 保持现有
`'use client'` 模式，不迁移为 Server Component。浏览器通过 Next Route Handler 获取访客地图数据；AboutThread
将当前 Groupher locale 作为经过 allowlist 校验的 `locale` 查询参数传入，Route Handler 调用 Phoenix 的
`analysisVisitorLocationMap`，在 Node 中完成坐标和本地化名称转换后返回精简 DTO。locale 缺失时先回退社区
`baseInfo.locale`，再回退 `en`；不直接使用 `Accept-Language`，避免页面语言与浏览器语言不一致。

Route Handler 必须在回源前按项目支持的 locale allowlist 规范化该参数，并遵守以下规则：

- canonical locale：正常处理；对于带 locale 参数的请求，只有 canonical URL 可以写入公开 CDN cache。
- 项目已知 alias：返回不缓存的重定向到 canonical locale URL，由客户端随后请求 canonical cache key。
- 非法或非 allowlist locale：返回 `400` 和 `Cache-Control: no-store`，不得按原始参数回源或写入 CDN。
- 缺少 locale：使用社区 locale，再回退 `en`；无参数 URL 本身是每个社区唯一、数量有界的 cache key。

仅在业务逻辑中把任意原始值回退成 `en` 并不能统一 CDN cache key，因为共享缓存仍可能按原始 URL 区分条目；
因此非法参数必须在进入公开缓存路径前被拒绝。

Node 转换后的浏览器 DTO：

```ts
type VisitorLocationMap = {
  days: number
  countries: Array<{
    code: string
    label: string
    visitors: number
    percentage: number
  }>
  markers: Array<{
    kind: 'country' | 'region'
    countryCode: string
    latitude: number
    longitude: number
    visitors: number
  }>
}
```

国家与 region 地理数据应遵守以下边界：

- 放在 `frontend/main` 的 server-only 模块中，不放在 `frontend/core` 或任何客户端可达的模块中。
- 模块入口显式导入 `server-only`，防止未来被客户端组件误用。
- 使用固定版本、许可证清楚的数据源生成 ISO 3166-1 alpha-2 到地图 label point 的映射；ISO 3166-2
  只生成 allowlist 八个国家的 region label point，不生成全球 region 全集。
- 不使用简单几何中心。优先使用面向制图标注的位置；大型国家进一步使用 region label point，降低 marker 落在无人区的概率。
- 国家名称在 Node 端使用 `Intl.DisplayNames` 按已校验的 locale 转换，并保留英文 fallback；region 名称不进入当前
  浏览器 DTO，也不要求维护多语言名称表。V1 不支持 region tooltip；未来增加 tooltip 属于 DTO 契约扩展，届时
  需要显式增加 `regionCode` 与本地化 `label`，允许名称回退为数据源提供的英文名或当地名称。
- 保留生成脚本、数据源版本和许可证说明；不要手工维护一份来源不明的坐标常量。
- 构建验证需要确认坐标全集只存在于 Node server chunk，不出现在浏览器静态 chunk。
- Node 坐标映射只消费 Phoenix 已规范化并裁剪后的 Top 10 region；缺失坐标需要记录可观测事件，不反向请求
  Phoenix 获取第 11 名补位。
- Node 只向浏览器传输右侧 Top 5 国家对应的 country/region marker，总数硬上限为 50。

建议的代码归属形态：

```text
frontend/main/src/app/[community]/about/
  page.tsx                        # 保持现有 client 页面

frontend/main/src/lib/geo/
  visitor-location.generated.ts  # Node-only country point、allowlist region point 与英文 fallback

frontend/main/src/app/api/visitor-location-map/[community]/
  route.ts                       # 限流、调用 Phoenix、Node-only 转换并返回精简 DTO

frontend/core/unit/AboutThread/
  VisitorLocationMap/            # Cobe 与国家列表 UI
```

共享 Core 组件只请求 Next Route Handler，不读取国家/region 数据全集，也不直接访问 Umami、Phoenix GraphQL
或在线地理编码服务。`analysisVisitorLocationMap` 是 Phoenix 与 Next Route Handler 之间的契约，不是浏览器直接调用的接口。

### Bundle 边界验证

生成文件导出一个仅用于构建审计的稳定标记，例如 `VISITOR_LOCATION_DATA_VERSION`。生产构建后执行：

```bash
pnpm --filter @groupher/frontend-main run build

# 浏览器 chunk 不得包含 Node-only 地理数据标记；该命令必须无输出。
rg -l "VISITOR_LOCATION_DATA_VERSION" frontend/main/.next/static/chunks

# Node server 产物必须包含该标记；该命令必须至少命中一个文件。
rg -l "VISITOR_LOCATION_DATA_VERSION" frontend/main/.next/server
```

同时使用现有 bundle analyzer 检查 Cobe 只存在于 About 的异步客户端 chunk；`server-only` 导入保护应保证任何
从客户端组件引入完整地理数据的改动直接构建失败。

## 缓存与公开查询防护

- Phoenix 按社区和固定 30 天窗口缓存成功结果 15 分钟，并使用 `Helper.Cache.get_or_fetch` 的 singleflight。
- Phoenix 对 provider 失败使用约 30 秒的 negative cache，避免故障期间持续击穿 Umami。
- Next Route Handler 的完整成功响应增加 `Cache-Control: public, s-maxage=300, must-revalidate`，减少每次浏览器
  请求穿透到 GraphQL，并保证旧响应在 5 分钟 freshness 到期后不能继续通过 stale-while-revalidate 返回。
  关闭开关后的 CDN 数据最多延迟约 5 分钟失效。
- 不可用响应使用 `Cache-Control: public, s-maxage=30, must-revalidate`，与 Phoenix 约 30 秒的 provider
  negative cache 对齐。
- region 请求失败后的 country-only 降级响应使用 `Cache-Control: public, s-maxage=60, must-revalidate`，使
  region provider 恢复后可以较快重新启用细化 marker。
- 只有 canonical locale 或缺少 locale 的成功请求可以进入公开缓存。合法 alias 重定向、非法 locale 的 `400`
  和限流 `429` 均使用 `Cache-Control: no-store`；`429` 同时返回 `Retry-After`。
- canonical locale 使用经过 allowlist 校验的查询参数，因此不同 locale 自然使用不同 CDN cache key；不使用
  `Vary: Accept-Language` 扩大缓存变体。
- Next Route Handler 按 `IP + community` 对匿名请求限流，并为每个 IP 设置全局上限，防止通过遍历 community 绕过限制。
- 当前 `PublishThrottle` 面向登录用户的写操作，不能直接复用于该匿名读取接口；应使用 Gateway/Route Handler
  的匿名限流能力，若实现时没有通用能力，则增加访客地图专用的有界 token bucket。
- 命中限流时返回标准 `429`、`Retry-After` 和 `Cache-Control: no-store`，不继续调用 Phoenix 或 Umami。

## Cobe 加载与交互

- Cobe 必须使用动态导入，只在 `visitorLocationMap` 开启且存在可渲染 marker 时加载。
- 不在 About 以外的 route 加载 Cobe runtime。
- 默认缓慢自转，拖动时暂停自转并跟随指针。
- 遵守 `prefers-reduced-motion`；减少动态效果时停止自动旋转，但仍允许手动拖动。
- 主题切换时同步地球底色、辉光和 marker 颜色。
- country 与 region marker 使用同一色系，尺寸按 visitors 做平方根归一化并设置最小/最大值，避免头部国家
  吞没其他 marker；region marker 略小，country fallback 使用较低透明度。
- 组件卸载时释放 animation frame、ResizeObserver 和 WebGL context。
- WebGL 初始化失败时隐藏地球画布，但保留右侧国家统计列表。
- Canvas 需要可访问名称；统计信息仍由真实 DOM 文本表达，不能只存在于 Canvas 中。

## 页面状态

```text
visitorLocationMap = false
  -> 不请求公开分布，不渲染区域

visitorLocationMap = true + 有可识别国家数据
  -> Route Handler 返回精简 DTO，渲染 Cobe 与国家列表

visitorLocationMap = true + 无可识别国家数据
  -> 不渲染整个区域

GraphQL 或 country metrics 临时失败
  -> 当前请求不展示区域，不把失败伪装成 0 访客

region metrics 临时失败
  -> 保留 country 统计，地图全部回退为 country marker

WebGL 不可用
  -> 保留国家列表，隐藏 Cobe
```

About 保持 client 模式。`visitorLocationMap` 沿用现有 `PageCommunity -> community.dashboard.enable -> dashboard store`
配置链路，AboutThread 从现有 store 读取，不单独请求开关配置。组件只在开关开启时请求 Route Handler；加载期间为
地图区域预留稳定尺寸，避免数据返回后产生明显布局跳动。

## 数据公开与权限边界

- 该功能由管理员显式开启；不对社区总访客量、country 或 region 设置匿名阈值。
- About 右侧列表只公开国家级聚合；region 只用于 allowlist 大型国家的地图 marker，不展示 region 名称或列表。
- 完整、未裁剪的 region、city 和 Session 明细继续要求 Dashboard 登录与 `analysis.web.read` 权限。
- 不通过公开查询暴露可切换的 location dimension。
- 浏览器 DTO 只携带绘制 marker 所需的坐标、父国家和 visitors，不携带 region code、region display name、
  city 或单次访问坐标。
- Enable 开关是服务端数据公开边界，不只是 UI 偏好。

## 验收标准

### 产品

- Dashboard 的 `Enable -> About` 下存在“访客分布”开关，字段名为 `visitorLocationMap`。
- 开关旁明确提示会公开国家、地区及低访客量数据，不动态请求或展示预计国家数量。
- 默认关闭；关闭时公开接口不返回国家数据，About 页面不出现该区域。
- 开启且有数据时，访客分布出现在文字介绍下方、社区概况上方。
- 标题根据浏览器 DTO 的 `days` 渲染；该字段来源于 GraphQL `range.days`，不在客户端写死 `30`。
- 桌面和移动端均为 Cobe 与列表 `50 / 50` 左右布局。
- 公开页面右侧列表只显示国家；地图仅对 allowlist 大型国家使用 region marker；Dashboard
  仍可查看完整的 country、region 和 city。
- “其他”占比大于 Top 5 国家占比之和时，地图仍只绘制 Top 5，“其他”不生成 marker；该行为应作为预期视觉
  结果验收，不作为缺失数据缺陷。

### 数据与安全

- 公开查询名为 `analysisVisitorLocationMap`。
- 查询固定最近 30 天，并行执行一次 country metrics 和一次全局 region metrics，不产生逐国 N+1。
- provider 使用当前 Umami 实例的真实 region 样本验证并规范化格式，不直接按 `-` 拆分父国家；无法规范化的值
  不进入 Top 10，某国没有任何规范化 region 时才回退为 country marker。
- 地图只使用右侧 Top 5 国家；allowlist 国家最多显示 Top 10 region marker，marker 总数不得超过 50；未绘制
  region 不参与 country visitors 的差值或回填计算。
- Phoenix 只按规范化 region 选择 Top 10，不判断坐标是否存在；Node 缺失坐标时不使用第 11 名补位，全部 Top 10
  均缺失时回退为 country marker，并记录需要更新生成数据的可观测事件。
- 查询复用现有 `analysis_web_error`，并只返回 `ok / unavailable` 状态。
- 浏览器拿不到 Umami 凭据、website ID、city 或未经过滤的 region 数据。
- country/region 坐标转换和国家名称本地化仅发生在 Next.js Node 端。
- 国家与 region 地理数据全集不出现在浏览器 bundle。
- country 百分比分母包含全部可识别国家，region visitors 不用于反推或汇总 country visitors。
- 匿名 Route Handler 具备按 IP 和 community 的限流，并对 provider 失败做短期 negative cache。
- canonical locale 的完整成功响应按 locale 独立缓存；非法 locale 不回源且不写 CDN，合法 alias 只重定向到
  canonical URL，缺少 locale 使用有界的社区默认 cache key。
- 完整成功、不可用和 region 降级响应分别使用 300、30 和 60 秒的明确 CDN TTL；`400` 与 `429` 不缓存。
- 关闭开关后 5 分钟内不再返回旧访客数据。

### 体验与性能

- Cobe 只在 About 页面有可渲染数据时按需加载。
- WebGL 失败不影响右侧国家列表。
- 减少动态效果时没有自动旋转。
- 组件卸载后没有遗留 animation frame、observer 或 WebGL context。
- 空数据和错误不会被显示成真实的零访问量。
- `320px`、`375px` 和 `430px` 下通过左右 `50 / 50` 原型验证。

## 实现顺序

1. 扩展 Enable 配置，增加 `visitor_location_map` / `visitorLocationMap`，默认关闭。
2. 抽样当前 Umami 实例的真实 region 响应，固化正常值、变体与异常值 fixture；再新增公开 GraphQL 查询
   `analysisVisitorLocationMap`，固定最近 30 天，并行查询一次 country metrics 和一次全局 region metrics，
   复用现有 status 与 error 契约。
3. 在 Phoenix Analysis 边界加入 country 汇总、region 格式规范化、父国家解析、每国 Top 10 allowlist 裁剪、
   成功缓存、singleflight 和失败短缓存；Phoenix 不承担坐标覆盖判断。
4. 在 Next.js Node 端加入 server-only country label point、allowlist region label point、国家名称本地化与英文
   fallback，并实现坐标缺失观测、无第 11 名补位以及全缺失时的 country fallback。
5. 新增匿名限流的 Route Handler，调用 Phoenix、完成 Node-only 转换并返回紧凑 DTO。
6. AboutThread 保持 client 模式，仅在开关开启时请求 Route Handler。
7. 实现 Cobe 与国家列表 `50 / 50` 组件、移动端紧凑样式及 WebGL 降级。
8. 增加 GraphQL schema 测试、provider 双请求/region 规范化与归组/Top 10 裁剪/region 失败降级测试、Node
   坐标缺失不补位与全缺失 fallback 测试、百分比与缓存测试、Route Handler 限流/canonical locale/alias/
   非法 locale/cache key 测试、50 marker 上限测试、Node 坐标与本地化转换测试，以及 Core UI 状态测试。
9. 验证 Enable 联动、关闭后 CDN 在 5 分钟内失效、Node-only bundle 边界、Cobe 异步 chunk、三档移动端原型
   和主题切换。
