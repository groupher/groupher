# Analytics Realtime Online

## 状态

实现记录。本文定义 Trends 页面右上角 `Online` 指标的产品口径、数据链路和 UI 挂载方式，并记录当前已经落地的后端与前端边界。

## Umami 兼容性基线

Groupher 当前使用自托管的 `groupher/umami` fork。本文引用的是 Umami v3/master 形态的接口和源码路径，不把 `master` 当成线上部署版本保证。

在进入实现前，必须在部署记录中补充该 fork 实际部署的 Umami release tag 或 commit SHA，并针对该版本验证以下接口：

- `GET /api/websites/:websiteId/active`
- `GET /api/realtime/:websiteId`
- Active Users 查询返回的字段名和数据类型

如果线上实例仍是旧 v2.x，不能直接套用本文的 `src/app/api/websites/[websiteId]/active/...`、`useActiveUsersQuery.ts` 或 `/api/realtime/:websiteId` 路径；应先按实际部署版本更新 provider 适配层和本文引用。

## 产品口径

`Online` 表示当前社区在最近 5 分钟内产生过访问事件的去重 session 数，不等同于 WebSocket 连接数，也不表示能证明浏览器此刻仍然打开页面的精确人数。

Umami 官方 Active Users 使用以下查询语义：

```sql
select count(distinct session_id)
from website_event
where website_id = :website_id
  and created_at >= now() - interval '5 minutes'
```

因此 Groupher 的 UI 文案可以显示为：

```text
27
[绿色闪烁点] online
```

必要时可以在 tooltip 或帮助文案中说明“活跃于最近 5 分钟”。

`0` 是有效结果，不是不可用状态。即使 Umami 官方的 `ActiveUsers` 组件在 `count === 0` 时会隐藏，Groupher 仍显示 `0 online`，让管理员知道查询功能正常且当前没有最近 5 分钟内的活跃 session。

## Umami 接口与刷新

使用独立的 Active Users 接口，不复用 Trends overview 或 30 分钟 realtime 聚合：

```http
GET /api/websites/:websiteId/active
```

返回值：

```json
{
  "visitors": 27
}
```

Umami 官方前端的实现是 React Query 查询 `/websites/:websiteId/active`，默认 `refetchInterval = 60000`，即每 60 秒轮询一次。Groupher 保持这个刷新频率即可；不需要 WebSocket。

### 与 Realtime API 的边界

```http
GET /api/realtime/:websiteId
```

这个接口表示最近 30 分钟的 views、visitors、events、URL 等实时聚合，用于 Realtime 页面或图表，不直接作为右上角 `Online` 数字的来源。

## Groupher 数据链路

```text
TrendPage / WebOverview
  -> GraphQL analysisActiveVisitors(community)
  -> Phoenix 校验查看权限
  -> Phoenix 从 community_dashboards.umami_website_id 解析 website
  -> Analysis.Web.active/1 按 website_id 做短 TTL 缓存
  -> Umami Provider.active/1 请求 /api/websites/:websiteId/active
  -> Phoenix 映射 { visitors } 为 Groupher DTO
  -> Dashboard 每 60 秒轮询 analysisActiveVisitors
```

边界要求：

- Umami API key 只存在 Phoenix/provider 服务端，浏览器不能直接请求 Umami。
- 查询必须绑定当前 `community`，不能由浏览器提交任意 Umami website ID。
- `analysisActiveVisitors` 是独立的轻量查询，不塞进 `analysisTrendsOverview`，避免每次 SSR 都强制等待在线人数。
- Provider boundary 新增 `active(Community.t())` callback；provider 只负责调用 Umami 和归一化 `{visitors}`，缓存和产品 DTO 由 `Analysis.Web` 负责。
- `Analysis.Web.active/1` 使用 `website_id` 作为 key，通过 `Helper.Cache.get_or_fetch/4` 做短 TTL 缓存，TTL 暂定 30 秒。它覆盖多个管理员页面错开的 60 秒轮询，避免每个 Dashboard 直接打 Umami。当前 `Helper.Cache` 是进程内 Cachex；多 Phoenix 节点要复用同一份结果，需要共享缓存，使节点 B 在锁释放后能直接读到节点 A 写入的缓存值。
- 同一个 website 的并发请求应尽量合并为一次上游请求；`get_or_fetch/4` 使用按 `pool + key` 划分的 single-flight 锁保证这一点。
- 在线查询失败不应阻塞 Trends 摘要、图表和下方分区；不要把 provider 错误转换成真实的 `0`。
- 页面不可见、路由离开或组件卸载后应停止轮询；恢复可见时再刷新。
- 返回值为非负整数；`0` 表示可用且无人活跃，空值或错误表示不可用。

## UI 挂载位置

当前 Dashboard Trends 页面使用 `frontend/core/unit/DashboardThread/Portal` 渲染标题区。`Portal` 已有 `addon?: ReactNode` slot：

```tsx
<Portal
  title={t('dsb.menu.trend')}
  desc={t('dsb.analysis.desc')}
  addon={<RealtimeOnline community={community} />}
  crumbItems={crumbItems}
  withDivider
/>
```

`Portal` 的 `addon` 由自身的 `addon` salon 样式定位在标题区域最右侧，因此不需要新增 Context、prop drilling 或改 Portal 布局结构。

`RealtimeOnline` 自己负责 `analysisActiveVisitors` 的查询和 60 秒轮询，slot 只传当前 `community`。不要在示例中使用来源不明的 `visitors` prop；website ID 和 provider 凭据都由 Phoenix 根据 community 解析。

### 推荐结构

数字在上，说明在下：

```text
                    27
             [dot] online
```

建议结构：

```tsx
<div className='column items-end'>
  <span className='text-title text-2xl tabular-nums'>{visitors}</span>
  <span className='row-center text-digest text-xs'>
    <OnlineDot />
    online
  </span>
</div>
```

右侧整体使用 `items-end`，与标题区最右边对齐；数字使用 `tabular-nums`，避免轮询更新时宽度跳动。

### 三态显示

- `ready`：请求成功时显示当前数字和绿色 dot；包括有效的 `0 online`。
- `stale`：已经成功过、后续轮询失败时可以保留上一次数字，但必须移除绿色 dot，并显示 muted 的 `unavailable`（或通过辅助文本明确这是旧值），不能继续标记为健康的 `online`。
- `unavailable`：首次请求失败、返回空值或未配置时隐藏整个 addon；不显示 `0`，也不显示绿色 dot。

第一版建议只在客户端保留上一次成功值，不让 Phoenix 在 Umami 失败后把过期值伪装成新鲜缓存；这样服务端缓存和 UI 的健康状态仍然是两个清晰的边界。

## Online dot

`dot` 使用 Tailwind 的 `animate-ping`，参考项目已有的双层点写法：外层负责扩散动画，内层负责保持稳定的绿色实心点。

```tsx
<span className='relative flex size-3'>
  <span className='absolute inline-flex size-full motion-safe:animate-ping rounded-full bg-green-500 opacity-75' />
  <span className='relative inline-flex size-3 rounded-full bg-green-500' />
</span>
```

实现注意事项：

- 外层必须是 `absolute`，否则动画会参与正常布局。
- 内层保持 `relative`，保证静态绿点始终可见。
- 点与 `online` 文案使用 `gap-x-1` 或项目现有等价 utility。
- 如果最终需要跟随主题，绿色 token 应通过项目现有颜色 API 生成；不要在组件中重复定义颜色变量。
- `motion-safe:animate-ping` 只负责在用户允许动画时扩散；静态内层点始终保留，满足 reduced-motion 用户的可见性。
- 数据不可用时应移除绿色 dot，而不是显示一个仍在闪烁的健康状态。

## 参考实现

- Umami Active Users 前端组件：`src/components/metrics/ActiveUsers.tsx`
- Umami Active Users 查询 hook：`src/components/hooks/queries/useActiveUsersQuery.ts`
- Umami Active Users route：`src/app/api/websites/[websiteId]/active/route.ts`
- Umami distinct session 查询：`src/queries/sql/getActiveVisitors.ts`
- Groupher provider callback：`backend/api/lib/groupher_server/analysis/web/provider.ex`
- Groupher Umami adapter：`backend/api/lib/groupher_server/analysis/web/provider/umami.ex`
- Groupher Web Analysis facade：`backend/api/lib/groupher_server/analysis/web.ex`
- Groupher cache helper：`backend/api/lib/helper/cache.ex`
- Groupher RealtimeOnline UI：`frontend/core/unit/DashboardThread/Analysis/RealtimeOnline/index.tsx`
- Groupher 现有 global lock + ETS 缓存先例：`backend/api/lib/groupher_server/service_auth/client.ex`
- Groupher 标题右侧 slot：`frontend/core/unit/DashboardThread/Portal/index.tsx`
- Groupher slot 定位样式：`frontend/core/unit/DashboardThread/Portal/salon/index.ts`
- Groupher Trends 页面入口：`frontend/dash/src/routes/$community/trend.tsx`

## Cache helper 复用边界

实时人数使用通用的：

```elixir
Helper.Cache.get_or_fetch(
  :common,
  "analysis.active.#{website_id}",
  [expire_sec: 30],
  fn -> provider().active(community) end
)
```

`get_or_fetch/4` 是已经新增的通用 CacheX helper。它的语义是：先读取 CacheX；命中则直接返回；未命中时，在同一个 key 的并发请求之间只执行一次 loader；实现必须在锁内再次检查缓存，否则排队请求仍可能重复访问 Umami。

loader 返回 `{:ok, value}` 时才写入缓存；返回 `{:error, reason}`、抛出异常、退出或 throw 时均转换成错误并且不写入缓存。

loader 的返回契约固定为：

```elixir
{:ok, value}      # 只缓存 value，并返回 {:ok, value}
{:error, reason}  # 不写入缓存，直接返回 {:error, reason}
```

因此上面的 `provider().active(community)` 可以直接作为 loader：provider 成功时缓存人数，provider 失败时不会把错误结果缓存 30 秒。缓存中只存成功的 `value`，不存 `{:ok, value}` 或 `{:error, reason}` 包装值。

并发锁由 helper 内部使用精确到单个缓存条目的 global lock：

```elixir
:global.trans({{Helper.Cache, pool, key}, self()}, fun)
```

`global` 的 lock id 是二元组 `{ResourceId, LockRequesterId}`。这里的 `ResourceId` 包含 `pool` 和 `key`，避免所有 CacheX 请求共用一把锁；`self()` 作为当前请求的 `LockRequesterId`，避免不同请求共享 requester 身份。锁内必须二次检查 CacheX，再决定是否执行 loader。

`:global.trans` 默认作用于当前节点及已连接的 BEAM 节点，但 CacheX 的缓存值只存在当前 Phoenix 节点。因此多节点时，同一个 key 的 loader 会跨节点串行，但节点 B 在获得锁后仍可能因本地 CacheX 未命中而再次执行一次 loader；这是“串行但重复”，不是真正的跨节点 single-flight。真正的跨节点结果复用需要共享缓存，使节点 B 在锁释放后能直接读到节点 A 写入的缓存值；分布式锁本身只能协调执行顺序，不能提供缓存值共享。

`Transaction.lock_global/2` 可以作为项目中已有的数据库 advisory lock 模式参考，但不用于这里，因为它会在执行 Umami HTTP 请求期间持有数据库事务和 PostgreSQL advisory lock。

第一版明确接受 `global.trans/2` 默认的 `infinity` retries，不额外增加 `Task.yield`。拿不到同一条目锁的请求会持续等待；当前 Umami provider 的请求 timeout 为 5 秒，并允许一次 retry，因此上游异常时等待请求最坏可能阻塞 10 秒以上。Tesla 负责限制上游请求时长，GraphQL 层必须确保整体请求 deadline 能覆盖这个最坏等待时间，并记录超时和上游错误日志。

如果后续需要限制等待时间，应使用 `:global.trans/4` 传入有限 retries。返回 `:aborted` 后只能再次普通检查 CacheX；如果仍未命中，应返回类似 `{:error, :cache_load_busy}`，不能绕过锁再次执行 loader，否则会重新产生并发穿透。

项目中的 `GroupherServer.ServiceAuth.Client` 已有 `ETS + :global.trans + 锁内二次检查` 的先例。它使用 `:global.trans({__MODULE__, key}, fun)`，二元组格式正确，但其 `ResourceId` 是模块名，多个 token key 会共享一把资源锁；CacheX helper 不应照搬这个锁粒度。
