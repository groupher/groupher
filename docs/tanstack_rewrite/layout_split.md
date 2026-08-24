# Community 首屏布局与依赖拆分重构计划

## 背景

Community 的 `/post` 首屏当前同时承载了多套社区布局、多个帖子布局以及一批只在交互路径使用的图标和渲染器。虽然这些代码可以通过运行时分支保证 SSR 输出正确，但静态 import 会让构建器把“当前页面不会使用”的实现也纳入首屏依赖图，造成初始 JavaScript 过大、模块 preload 过多、浏览器请求变碎。

本计划的目标是：保留 SSR 首屏确定性和 hydration 一致性，同时让构建边界与实际页面状态一致。布局选择不能简单改成客户端 `lazy`，因为那会先渲染空壳再补内容；选择必须在服务端已知的 route/loader 数据阶段完成。

## 当前问题

1. `CommunityDigest` 静态引入 Classic、Hero、Sidebar 三套布局，再在组件内部做分支。
2. `PostItem` 静态引入五套帖子布局，列表中的每个条目再重复做布局选择。
3. 菜单和部分布局通过 icon barrel 引入，扩大了依赖范围；图标应该跟随实际引用它的组件，或按 route 合并成一个小的 route-scoped chunk。
4. `TagNote` 静态引入 Markdown renderer。即使 tag 没有描述，`markdown-to-jsx` 也会进入 `/post` 依赖图。
5. SSR 数据请求错误曾经被可选链吞掉，最终表现为 `undefined` 或空页面，难以区分后端错误、schema 不兼容和真实的空数据。

## 目标架构

### 1. 先确定布局，再渲染布局

入口 loader 读取并规范化 `communityLayout`、`postLayout`，生成带有稳定枚举值的 route data。服务端和客户端都使用同一份已序列化的数据，不在组件 render 阶段依赖 `window`、随机值或异步探测。

伪代码：

```ts
const layout = await loadLayoutData({ community })
return {
  communityLayout: layout.communityLayout,
  postLayout: layout.postLayout,
}
```

页面只选择当前布局对应的实现：

```tsx
const CommunityDigest = lazy(() => import(`./layouts/${communityLayout}`))
```

实际实现不能让 SSR 先输出未知布局的 fallback。应由 route loader 或 TanStack Start 的服务端模块预加载当前布局，再在 SSR 中渲染真实 HTML，并把同一个布局 chunk 交给客户端 hydration。不能对三套布局全部静态 import，也不能让每个布局在客户端 mount 后自行决定。

### 2. `PostList` 负责布局边界

`PostItem` 目前是单条卡片组件，布局分叉如果留在卡片内部，构建器会看到所有布局的静态依赖。重构步骤：

1. `PostList` 读取已经解析的 `postLayout`。
2. 每种布局抽成独立模块，模块只 import 自己需要的子组件和图标。
3. `PostList` 按布局选择一个列表 renderer；同一页只加载当前 renderer。
4. renderer 内部把 entries 传给对应的卡片实现，`PostItem` 不再 import 五套布局。
5. 如果业务确实允许单篇帖子混用布局，则先从 SSR 数据计算本页实际出现的布局集合，再并行预加载这个小集合，不能在 `entries.map` 中逐条 `lazy`，避免请求瀑布。

验收条件：同一 `/post` 页面不会因为帖子数量增加而增加布局 chunk 请求；切换布局时只加载目标布局，并且切换前后的 SSR HTML 与 hydration 不出现 mismatch。

### 3. 图标按引用边界打包

禁止在首屏路径引入全量 `icons/index.ts` barrel。组件直接引用自己的 icon module：

```tsx
import LinkIcon from '~/icons/Link'
```

对于 `/post` 固定会出现的一组小图标，优先让构建器把图标和引用组件合并；如果构建器仍拆成多个独立 chunk，则建立 route-scoped 的 `community-post-icons` 分组，只包含当前 `/post` 布局需要的图标。不能把所有 `~/icons` 源文件打入该分组，也不能让菜单图标因为 barrel import 进入首屏。

菜单、设置和其他交互路径的图标保持异步加载，只有打开对应菜单或进入对应 route 才触发 chunk 请求。

### 4. Markdown 只在有描述且完成 hydration 后加载

`TagNote` 的 tag marker 与 Markdown 描述是两个独立职责。marker 首屏直接渲染；Markdown renderer 通过 `React.lazy(() => import('~/render/Markdown'))` 延迟到客户端 hydration 后，并且仅在 `tag.desc` 非空时挂载。Suspense fallback 必须是稳定的空内容，避免 SSR 与 hydration 产生文本分叉。

长期方案仍可把 Markdown 在 Phoenix 或 Worker/Hono server boundary 转成经过 sanitizer 的 `descHtml`，让展示端只输出安全 HTML；但在该方案落地前，客户端 renderer 不能静态污染 `/post` 首屏。

### 5. 请求错误必须显式失败

Community server fetch 层统一检查：

- HTTP status 是否成功；
- response 是否为有效 JSON；
- GraphQL `errors` 是否为空；
- GraphQL response 是否包含 `data`。

任何一项失败都抛出带 status 和 GraphQL errors 的 `GraphQLRequestError`。loader 只处理合法的业务空值，例如 `community: null`，不再用可选链把 transport/schema 错误变成 `undefined`。

## 分阶段改造

### Phase 1：建立基线与边界

- 固定 `/demo/post` 的 production build、SSR HTML、modulepreload 数量、JS raw/gzip 和关键 chunk 清单。
- 单独标记 framework/runtime、业务共享层、当前布局、图标、Markdown、wallpaper 和编辑器依赖。
- 修正本地 preview 的 API 环境：本地开发必须使用 `http://api.groupher.localhost:4001/graphiql`，不能继承 production 的 `https://api.groupher.com/graphiql`。

### Phase 2：低风险异步边界

- 完成 `TagNote` Markdown lazy load，并验证无描述时不发起 renderer chunk 请求。
- 保留真实 tag marker 的 SSR 输出。
- 统一 GraphQL 显式错误处理。

### Phase 3：布局拆分

- 先梳理 `CommunityDigest` 各布局内部的共享分叉、数据依赖、icon 依赖和 salon 依赖。
- 抽取每个布局的最小 renderer module，避免把“组件内部分叉”误判成只移动一个 import 就能解决。
- 由 route loader 解析布局并预加载当前实现；SSR、客户端初次 render 和 hydration 使用同一布局值。
- 再梳理 `PostItem` 的五套布局，决定“整页单一布局”还是“页面内少量布局集合”，分别采用单 renderer 或并行预加载集合。

### Phase 4：图标与交互路径分组

- 统计每个 layout/route 的实际 icon 引用，移除 barrel 入口。
- 优先合并到引用组件；无法合并时生成 route-scoped icon chunk。
- 菜单、设置、wallpaper catalog 等非首屏能力保持按需加载。

### Phase 5：服务端 Markdown HTML

- 选择 Worker 兼容的纯 JS Markdown parser 和 sanitizer，或由 Phoenix 统一产出 `descHtml`。
- 若采用 Hono 子应用，只把它当作 server boundary/router；Markdown parser 和 sanitizer 仍需显式选择。
- 将 `descHtml` 放入 GraphQL/loader 数据，避免每个 tag 在客户端再发一次 Markdown 请求。
- 编辑/预览仍保留原始 Markdown 输入链路，展示链路使用已清洗 HTML。

## 验收指标

每个阶段都记录同一条 `/demo/post` 路径的：

- 首屏 JS modulepreload 数量；
- 首屏 JS raw 与 gzip 总量；
- 独立 icon/Markdown 请求数量和 gzip；
- SSR HTML 是否包含真实布局和 tag marker；
- hydration console 是否为零 error；
- 首次渲染后是否出现请求瀑布；
- 同一数据、同一 viewport 下的 LCP、内存和交互可用时间。

优化只有在首屏 JS 和请求链路同时改善时才算通过。单纯把一个大 chunk 拆成很多小请求，或为了减少请求而把大量非首屏逻辑塞回初始 JS，都不算完成。

## 回滚策略

每个 phase 保持独立提交。若出现 SSR mismatch、布局闪烁、路由 chunk 404 或首屏 gzip 回升，先回滚对应 phase，不回退与它无关的 Phoenix、icons 或 wallpaper 变更。保留基线报告，以便用同一页面和同一数据重新比较。
