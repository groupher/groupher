# Community TanStack V2：首屏依赖与查询边界

> 状态：规划中；本文基于当前 Community production build 的实测产物，记录 `/demo/post` 的首屏基线、收益估计和下一阶段拆分策略。
>
> V1 负责确定 Community 的应用边界、TanStack Router/Start 运行模型，以及 Main 与 Community 长期共存的契约。V2 聚焦首屏 JavaScript、请求数量和 route 依赖边界，不改变 Main 的线上职责。

## 1. 当前基线

当前 `/demo/post` production build 的 SSR 首屏结果：

| 指标                |                       当前值 |
| ------------------- | ---------------------------: |
| modulepreload 数量  |                        71 个 |
| 首屏 JS raw         |                  1,526,188 B |
| 首屏 JS gzip        |        380,055 B / 371.1 KiB |
| Markdown renderer   |         不再进入首屏 preload |
| Markdown 按需 chunk | 70,700 B raw / 24,856 B gzip |

Markdown lazy load 已经把首屏 gzip 从约 403,332 B 降到约 380,055 B，减少约 23.3 KB。Markdown chunk 仍会在完成 hydration 且 `tag.desc` 非空时加载，这是有描述页面的后置成本，不应再次计入首屏。

当前首屏 preload 仍有 71 个。Markdown 请求被移除后，构建器用其他小 chunk 占据了依赖图位置，因此请求总数没有同步下降；这说明下一阶段必须同时处理 chunk 边界，不能只看某一个 chunk 是否消失。

## 2. 布局拆分：收益要保守估算

Community 当前存在两层静态布局分叉：

```text
CommunityDigest
  ├── ClassicLayout
  ├── HeroLayout
  └── SidebarLayout

PostItem
  ├── MinimalLayout
  ├── PHLayout
  ├── CoverLayout
  ├── MasonryLayout
  └── QuoraLayout
```

当前 `CommunityDigest` 和 `PostItem` 都是静态 import 全部实现，再在 render 阶段根据 layout enum 分支。问题不是组件无法工作，而是构建器无法证明当前页面只会使用其中一套实现，因此布局自身的组件、salon、图标和间接依赖都会进入共同依赖图。

### 2.1 收窄后的收益估计

此前提出的 `35–80 KiB gzip` 只能作为所有依赖都成功隔离后的宽泛上限，不能作为本次布局重构的预期结果。由于不同布局之间存在共享组件、共享图标和共享 runtime，简单移动 import 不会把整块体积直接减掉。

更可信的分阶段估计是：

| 阶段                   | 预计首屏 gzip 减少 | 说明                                            |
| ---------------------- | -----------------: | ----------------------------------------------- |
| 只拆 `CommunityDigest` |           3–12 KiB | 取决于 Hero/Sidebar 是否携带独有交互和图标      |
| 再拆 `PostItem`        |           7–18 KiB | 共享 Header、Footer、作者和状态组件不会重复计算 |
| 布局拆分合计           |          10–30 KiB | 这是当前更合理的目标区间                        |
| 极佳情况下             |          30–40 KiB | 只有重依赖布局也被完全隔离时才可能达到          |

因此，布局拆分完成后，当前 371.1 KiB 的首屏 JS 更现实的目标是约 340–360 KiB，而不是直接承诺 290 KiB。最终数字必须以同一 build、同一 `/demo/post` SSR preload 清单重新测量为准。

### 2.2 SSR-safe 实现原则

不能把布局选择下放到客户端 mount 后，否则会产生空壳、闪烁或 hydration 分叉。正确边界是：

1. route loader 先读取并规范化 `communityLayout`、`postLayout`；
2. 服务端根据已知 layout 选择当前 renderer；
3. SSR 输出真实布局 HTML；
4. 将相同 layout 数据序列化给客户端 hydration；
5. 只预加载当前页面需要的 renderer，不在 `entries.map` 内逐条 lazy。

如果一页允许多种帖子布局，必须从 SSR 数据先计算实际布局集合，再并行预加载少量 renderer，避免逐条卡片产生请求瀑布。

## 3. Query 到底应该怎么拆

### 3.1 当前不是“所有 query 都在一个文件”

GraphQL operation 已经按领域分散在：

```text
frontend/core/schemas/pages/community.ts
frontend/core/schemas/pages/post.ts
frontend/core/schemas/pages/changelog.ts
frontend/core/schemas/pages/comment.ts
frontend/core/schemas/pages/doc.ts
frontend/core/schemas/pages/user.ts
```

问题在于上层聚合边界，而不是 operation 文件名：

```text
frontend/community/src/server/community.ts
  ├── community
  ├── posts / post
  ├── changelogs / changelog
  ├── comments
  ├── kanban
  ├── doc / doc tree
  └── session

frontend/community/src/query/queries.ts
  ├── shell
  ├── posts / post
  ├── changelogs / changelog
  ├── comments
  ├── kanban
  └── doc
```

`/post` 入口如果 import 这个聚合层，构建器就会看到其他 route 的 loader 和 query wiring。即使部分 operation 最终被 tree-shake，聚合模块本身仍扩大了 route 的依赖图。

### 3.2 先区分 runtime 和业务 wiring

当前产物中最容易被误判的是 `query-DA0Wzhx5.js`：

| 产物                  |       raw |     gzip | 实际含义                                                               |
| --------------------- | --------: | -------: | ---------------------------------------------------------------------- |
| `query-DA0Wzhx5.js`   | 656,939 B | 77,594 B | TanStack Query runtime，包含 focus manager、QueryClient 等共享基础设施 |
| `queries-GYJBCKfv.js` |  64,785 B | 21,395 B | Community 的 query wiring、server function 协议和 query options        |

因此，`query-DA0Wzhx5.js` 不是“所有 GraphQL query 集中在一起”，也不能简单通过移动 query 文件消失。它属于共享 Query runtime，只有改变 `/post` 是否使用 TanStack Query，或重新设计 server-state 边界，才可能减少它。

可拆的是业务 wiring 和 loader：

```text
共享 runtime
  ├── React
  ├── TanStack Query runtime
  └── request-local QueryClient / hydration

/post
  ├── community shell
  ├── pagedPosts
  ├── post detail
  └── comments

/changelog
  ├── changelogs
  └── changelog detail

/doc
  ├── doc tree
  └── doc detail

/kanban
  └── grouped kanban posts
```

目标不是复制 QueryClient，而是让 `/post` 不再静态依赖 changelog、doc、kanban 等 route 的业务 loader 和 query option。

### 3.3 Query 拆分的具体步骤

1. 将 `src/query/queries.ts` 拆成 `src/query/post.ts`、`changelog.ts`、`doc.ts`、`kanban.ts` 和 `comments.ts`。
2. 将 `src/server/community.ts` 中的 loader 按 route/domain 拆分，保留统一的 GraphQL transport 和错误类型。
3. 每个 route 只 import 自己的 query options；共享的 `articleKeys`、`commentKeys` 保持在轻量公共模块。
4. 保留 TanStack Query runtime 在共享 framework chunk，不为了减少文件名而重复打包 QueryClient。
5. 对 `/post` 的 preview/detail/comment 进行独立边界设计，避免首页为 Drawer 和详情页预载完整 query。

### 3.4 更值得优先做的 shell query 拆分

当前 `community` shell query 同时携带：

- 社区基础信息；
- dashboard/theme tokens；
- wallpaper 配置；
- FAQ；
- header/footer links；
- social links 和第三方分析配置。

`/post` 首屏并不需要所有这些字段。应拆成：

```text
communityShell
  -> slug/title/logo/desc/theme/layout/locale
  -> 首屏必须的 SEO 和公共配置

communityAppearance
  -> wallpaper catalog/pattern/texture/effect
  -> appearance route 或 renderer 使用

communityNavigation
  -> header/footer links/menu
  -> Shell 需要时加载

communityDocsConfig
  -> FAQ/doc settings
  -> doc route 加载
```

这比单纯把 query 文件移动到不同目录更有价值。预期收益约为 **5–20 KiB gzip**，但必须结合 GraphQL selection 和 server response 的实际依赖重新构建确认。

## 4. 其他优化方向

按当前收益和风险排序：

| 优先级 | 方向                                                        | 预期收益                                 |
| ------ | ----------------------------------------------------------- | ---------------------------------------- |
| P0     | `CommunityDigest` / `PostItem` SSR-safe 布局拆分            | 10–30 KiB gzip，减少无效依赖             |
| P0     | `communityShell` selection 拆分                             | 5–20 KiB gzip，减少业务 query 和返回数据 |
| P1     | wallpaper renderer/catalog 延迟到 appearance 或实际使用路径 | 10–20 KiB gzip                           |
| P1     | route query wiring 拆分                                     | 通常 3–10 KiB gzip，主要改善依赖图       |
| P1     | icons 直接引用或 route-scoped 合并                          | 字节收益有限，重点是减少独立请求         |
| P2     | Tooltip、菜单、编辑器和 preview runtime 后置                | 5–15 KiB gzip，取决于当前布局引用        |

图标优化不应再以“所有 icon 合并成一个大包”为目标。目标是：组件直接引用自己的 icon；固定首屏图标必要时合并成小的 `community-post-icons`；菜单、设置和 wallpaper catalog 的图标继续保持按需加载。

## 5. 目标与验收

### 5.1 近期目标

完成布局拆分后：

- 首屏 JS gzip：约 **340–360 KiB**；
- modulepreload：从 71 个减少到约 **55–65 个**；
- `/post` 不加载 changelog、doc、kanban 的业务 query wiring；
- SSR 与 hydration 使用同一 layout；
- 不产生布局闪烁和请求瀑布。

完成 shell query、wallpaper 和交互边界后：

- 首屏 JS gzip：约 **310–345 KiB**；
- modulepreload：目标约 **45–55 个**；
- Markdown、wallpaper、菜单和 preview 能力只在需要时加载。

`250–300 KiB` 只能作为更激进的后续目标，可能涉及 Query runtime、公共 shell 和 server-state 架构调整，不应作为本轮布局拆分承诺。

### 5.2 每轮必须记录

对同一 production build、同一 `/demo/post`、同一数据集记录：

- modulepreload 数量和名称；
- 首屏 JS raw/gzip；
- framework/runtime、业务 wiring、布局、icons、Markdown、wallpaper 的分类体积；
- SSR HTML 是否包含真实布局和 tag marker；
- hydration console 是否为零 error；
- 首次加载后的网络请求是否出现 waterfall；
- LCP、浏览器内存和交互可用时间。

不能把 TanStack Query runtime 的完整体积误算成可由 GraphQL 文件拆分直接消除的业务体积，也不能把所有 route asset 的 gzip 总和当成 `/post` 首屏传输量。

## 6. 实施顺序

```text
V2.1  布局依赖清点和 SSR-safe renderer 边界
  ↓
V2.2  CommunityDigest / PostItem 按当前 layout 拆分
  ↓
V2.3  communityShell selection 精简
  ↓
V2.4  query wiring 与 server loader 按 route 拆分
  ↓
V2.5  wallpaper、menu、Tooltip、preview 后置
  ↓
V2.6  icons route-scoped 分组与最终生产测量
```

每个阶段单独测量和可回滚。若首屏 gzip 上升、modulepreload 增加、SSR layout 不稳定或出现 hydration error，停止推进后续阶段，先回滚当前阶段并保留对比报告。
