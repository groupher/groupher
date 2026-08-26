# Landing TanStack Rewrite V3：首屏 Runtime 收敛

> 状态：规划中。
>
> 前置：V2 已切断 Landing 对 GraphQL、Dashboard store、Dashboard Footer editor、`@dnd-kit`、React Aria/Stately 与 eager QR renderer 的错误依赖。本文只处理 V2 后仍真实存在的首屏 runtime、CSS 与 HTML 成本。

## 1. 目标与非目标

V3 的主要目标是将 Landing 首页实际引用的 JS + CSS 从当前约 `390 KB gzip` 收敛到 `330–350 KB gzip`，同时保持完整 prerender HTML、无 JavaScript 可读性、品牌 404、路由行为和视觉效果。

V3 不做以下事情：

- 不将页面退回 CSR 空壳或 mount 后整页渲染；
- 不因为 chunk 数量增加就宣称 bundle 已优化；
- 不把 source map 源码大小直接等同于网络节省量；
- 不为 Landing bundle 删除 Community/Dashboard 的真实产品能力；
- 不在缺少请求瀑布证据时批量添加 `lazy()`；TanStack prerender 可能仍 preload 动态 chunk；
- 不把框架迁移作为优化手段。

## 2. V3 基线

2026-08-26 production build，按首页 HTML 实际引用资源统计，使用十进制 KB：

| 首屏资源             |      V2 前 |    V3 基线 |     变化 |
| -------------------- | ---------: | ---------: | -------: |
| JS 文件数            |         13 |          5 |   -61.5% |
| JS raw               | 1,889.9 KB | 1,135.2 KB |   -39.9% |
| JS gzip              |   468.0 KB |   361.0 KB |   -22.9% |
| CSS raw              |   188.9 KB |   188.9 KB | 基本不变 |
| CSS gzip             |    29.2 KB |    29.4 KB | 基本不变 |
| JS + CSS gzip        |   497.2 KB |   390.4 KB |   -21.5% |
| HTML gzip            |    69.8 KB |    69.9 KB | 基本不变 |
| HTML + JS + CSS gzip |   567.0 KB |   460.3 KB |   -18.8% |

最大的两个 client chunk：

| chunk    |      raw |     gzip | 主要归属                                                   |
| -------- | -------: | -------: | ---------------------------------------------------------- |
| `index`  | 623.6 KB | 205.5 KB | React DOM、Core、Motion、TanStack Router、`cnfast`         |
| `routes` | 502.0 KB | 154.4 KB | Landing/Core 页面、Tippy/Popper、Markdown、动画与 carousel |

当前 CSS 是单个约 `188.9 KB raw / 29.4 KB gzip` 的文件。它不是样式正确性问题，而是首页也会下载其他路由或延迟模块可能使用的样式，缓存与加载粒度不够细。

当前 HTML 约 `360 KB raw / 70 KB gzip`。其体积来自完整 prerender DOM、重复装饰节点与 inline SVG；与线上 Next.js 的 CSR bailout 空壳不是同一种渲染结果。

## 3. 优化顺序

### 3.1 Tooltip 与交互浮层分层

当前 `routes` chunk 同时包含 Tippy 和 Popper。项目的 `Tooltip` 实际承载了两类能力：

1. 普通文本提示：hover/focus 后显示短文本，不需要复杂浮层定位、交互内容或 portal；
2. 交互式浮层：菜单、用户卡片、二维码等，需要 click trigger、动态定位、边界碰撞、延迟关闭或可交互内容。

目标方案：

- 盘点 Landing 中每个 Tooltip caller，按普通提示与交互浮层分类；
- 普通提示优先使用浏览器原生能力或轻量 CSS/ARIA 实现；
- 交互式浮层继续使用完整实现，但只能由真实交互入口按需加载；
- 不直接全局替换共享 Core Tooltip，Community/Dashboard 的交互行为必须保持；
- 若 Tippy/Popper 仍因一个首屏 caller 进入首页，记录具体 caller，不能用 manual chunk 隐藏。

验收：

- 原生提示具备键盘 focus、可访问名称和合理延迟；
- 交互式菜单 hover/click、outside click、Esc、定位与移动端行为不回归；
- source map 和首页请求确认 Tippy/Popper 是否退出首屏，而不是只换 chunk 名；
- 记录实际 gzip 收益。

### 3.2 FAQ Markdown 构建期输出

FAQ 是固定营销内容，目前仍在浏览器加载 `markdown-to-jsx` runtime。V3 应将固定 Markdown 在构建或模块生成阶段转换成 React/HTML，使原始 HTML 继续包含完整 FAQ 内容，而客户端无需通用 Markdown parser。

边界：

- 保留 FAQ 内容的单一文本来源，避免手写 Markdown 与 JSX 双份内容；
- 生成结果必须支持现有链接、强调、列表和换行语义；
- 不使用 mount 后请求或渲染 FAQ；
- Community、Docs、编辑器等动态 Markdown 场景不在本轮替换；
- 若共享 `Markdown` 仍被 Landing 其他组件使用，逐个列出而不是假定 FAQ 是唯一 caller。

验收：原始 HTML FAQ 内容一致，关闭 JavaScript 可读，`markdown-to-jsx` 不再出现在 Landing 首页 client source map。

### 3.3 动画与 carousel 审计

`routes` chunk 仍包含 Typewriter、carousel、`react-simple-animate`、`react-flip-numbers`、Popmotion 等。逐项按照产品价值处理：

- 纯装饰、一次性进入动画优先改为 CSS；
- 数字滚动若不能证明有产品价值，使用静态数字或 Landing 专用轻实现；
- carousel 必须确认触摸、键盘、自动播放和 reduced-motion 合约后再替换；
- 不重复引入第二套动画 runtime；
- 已经由 Motion 提供的能力优先复用，但也要验证是否因此扩大首屏 Motion 图；
- `prefers-reduced-motion` 下不得保留无必要循环动画。

每删除或替换一个库后单独构建，记录其真实 gzip 差异，避免多个改动混在一起无法归因。

### 3.4 首屏以下 hydration 边界

目标是保留服务端/构建期 HTML，同时减少首屏无需执行的客户端 runtime。候选区块包括 FAQ、Dashboard showcase、对比图、社区入口和其他首屏以下动画模块。

实施前必须先验证 TanStack Start 当前 prerender 对动态 import、modulepreload 和 hydration 的行为：

- 页面 HTML 必须继续包含关键内容；
- 动态 chunk 若仍被首页 preload，不算首屏网络优化；
- IntersectionObserver 只能延后非关键行为，不能决定内容是否存在；
- 不制造滚动到区块后才出现大面积布局的 CLS；
- 可交互区块在激活前需要明确的静态状态和 focus 行为。

验收使用真实 production 请求瀑布，而不是只看构建目录里生成了多少 chunk。

### 3.5 CSS 路由与组件归属

先用构建产物和 CSS source attribution 确认单文件 CSS 的组成，再决定拆分：

- 分离 `/pricing`、`/book-demo` 和首页专属样式；
- 延迟组件样式跟随对应 runtime 边界；
- Core 全局 tokens、reset、通用 utilities 继续共享；
- 不复制相同规则到多个 route chunk；
- 不为追求文件数量制造更多阻塞 CSS 请求。

CSS 优化优先级低于 Tooltip、Markdown 和动画，因为当前全部 CSS 也只有约 `29.4 KB gzip`。

### 3.6 HTML、SVG 与 wallpaper 图片化

HTML 优化只处理经过测量的大项：

- wallpaper 按既定方向改为带内容哈希和明确尺寸的图片资源；
- 统计重复装饰 DOM/inline SVG 的 raw 与 gzip 贡献；
- 只有大型纯装饰插画、重复复杂 path 或无需主题/交互语义的内容才图片化；
- 小 icon、主题色图标和交互 SVG 保持组件形式；
- 图片化必须同时测量额外请求、缓存、LCP、CLS 与 retina 清晰度；
- 不以删除 prerender 内容换取较小 HTML。

HTML 当前只有约 `70 KB gzip`，该阶段不能优先于明显的 JS runtime 泄漏。

## 4. 暂不优先处理

### `cnfast`

source map 显示 `cnfast` 源码贡献较大，但它是 Core 广泛使用的 class/salon 基础能力。source map 源码大小不代表 gzip 可直接回收，替换还可能影响 class 覆盖语义与样式正确性。V3 只有在前述高确定性项目完成后，才单独测量它的 runtime 与调用分布。

### Router 与 React DOM

React DOM 和 TanStack Router 是当前应用基本运行时。V3 不通过换框架或自建 router 追求 bundle 数字。

### Community Header

Community 的公开 Header 读取 Dashboard 配置是正确产品依赖；Community 本身强依赖 Dashboard 配置。Header 当前没有反向引用 Header editor 或 dnd-kit，不属于 V2 Footer 那种错误依赖，不进入 V3。

## 5. 分阶段实施

### Phase 1：可确定删除的 runtime

- 完成 Tooltip caller 分类；
- FAQ Markdown 构建期输出；
- 删除或替换确认无必要的 Landing 专用动画依赖；
- 每项保存独立 bundle diff。

目标：JS + CSS 低于 `370 KB gzip`，且没有功能与可访问性回归。

### Phase 2：真实加载边界

- 验证 TanStack prerender/modulepreload 行为；
- 为首屏以下交互建立 SSR-safe hydration 边界；
- 以首页 production waterfall 验收。

目标：JS + CSS 达到 `330–350 KB gzip`；若框架 preload 行为阻止收益，记录证据并停止添加无效 lazy 边界。

### Phase 3：CSS 与静态视觉资产

- 拆分有明确归属的 route CSS；
- wallpaper 图片化；
- 处理达到收益阈值的重复装饰 SVG/DOM。

目标：不预设脱离实际 LCP/CLS 的 KB 指标，以网络与视觉体验共同验收。

## 6. 测量协议

每个候选优化必须使用同一套 production 测量：

1. clean production build；
2. 从首页 HTML 提取实际引用和 preload 的 JS/CSS；
3. 记录文件数、raw、gzip、Brotli；
4. HTML 单独记录；
5. 完整 `dist/client` 单独记录，不能代替首页请求图；
6. 使用 source map 记录最大 chunk 的模块归属；
7. 使用真实浏览器确认请求时机、modulepreload 和 waterfall；
8. 检查 hydration warning、关闭 JavaScript内容、键盘交互、reduced motion、LCP 和 CLS；
9. 与线上比较时记录 URL、日期与渲染策略。

## 7. 完成定义

V3 完成必须同时满足：

- 首页 JS + CSS 达到 `330–350 KB gzip`，或者对未达到目标的框架/runtime 下限给出 source map 与请求瀑布证据；
- Tooltip 与交互 popover 已按能力分层，普通提示不默认携带完整浮层 runtime；
- 固定 FAQ 不再在客户端加载 Markdown parser；
- 无产品价值的 Landing 动画 runtime 已删除；
- 首屏以下边界确实改变网络加载时机，而不只是增加 chunk；
- CSS 归属已量化，拆分只在请求与缓存收益成立时落地；
- 原始 HTML 继续包含关键营销内容，未知路径仍返回品牌 404；
- 页面视觉、键盘操作、移动端、reduced motion、LCP、CLS 和 hydration 无回归；
- Landing、Main、Community、Dashboard 的共享 Core 回归验证通过。
