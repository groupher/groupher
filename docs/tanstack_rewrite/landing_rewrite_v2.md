# Landing TanStack Rewrite V2：Bundle 与依赖边界

> 状态：Phase 1–3 的确定性依赖收敛已于 2026-08-26 落地；Tooltip、Markdown、首屏以下 islands 与 wallpaper 图片化仍按本文边界留作后续。
>
> 原则：优先删除 Landing 不应拥有的运行时依赖，再拆分页面加载边界；不能为了减小 HTML 而退回客户端空壳。

## 1. 结论

TanStack 重写后的 Landing production 产物比当前线上 Next.js 版本少约 20% 的首屏 JS + CSS gzip，但该数字是“TanStack 全量 prerender 页面”与“Next.js CSR bailout 页面”的实际部署产物对比，不是相同渲染策略下的框架开销 benchmark，不能引用为 TanStack 天然比 Next.js 小 20%。当前产物仍存在明显的跨边界依赖泄漏：

- `GlobalProvider` 的 barrel export 将未使用的 `QueryProvider`、GraphQL query 和完整生成文件带入 Landing；
- 公共 Footer 复用 Dashboard Footer editor model，将 `@dnd-kit` 带入公开页面；
- Landing 首次加载静态导入全部首屏以下展示模块，使 React Aria、Tippy、Markdown、QR code、carousel 等依赖进入首批 JS；
- root route 使用历史命名的完整 `MainProvider` 和 `GlobalProvider`，为纯营销页建立了 Dashboard、Account 和登录弹窗等过宽的运行时边界。

因此 V2 不更换框架，也不以 Router 为优化对象。V2 的核心是让 Landing 只加载营销页面真正使用的 Core 能力，并完成两条 Shell provider 边界：完整社区运行环境使用 `CommunityShellProvider`，静态页面运行环境使用 `StaticShellProvider`。Tooltip 的底层替换和 Markdown 的服务端/RSC-style renderer 不属于本轮。

## 2. Production 基线

### 2.1 首页实际引用资源

2026-08-26 使用 production build，并按首页 HTML 实际引用的资源统计：

| 指标                 | TanStack rewrite | 线上 Next.js |      变化 |
| -------------------- | ---------------: | -----------: | --------: |
| JS 文件数            |               13 |           15 |        -2 |
| JS raw               |      1,889,864 B |  2,303,018 B |    -18.0% |
| JS gzip              |        467,966 B |    587,098 B |    -20.3% |
| JS Brotli            |        430,339 B |    542,563 B |    -20.7% |
| CSS raw              |        188,936 B |    195,056 B |     -3.1% |
| CSS gzip             |         29,201 B |     31,143 B |     -6.2% |
| JS + CSS gzip        |        497,167 B |    618,241 B |    -19.6% |
| HTML raw             |        361,236 B |     45,649 B |   +691.3% |
| HTML gzip            |         69,801 B |      9,362 B | +60,439 B |
| HTML + JS + CSS gzip |        566,968 B |    627,603 B |     -9.7% |

以上数据只比较首页首次 HTML 明确引用的 JS/CSS，不把 `dist/client` 中未被首页引用的 wallpaper、图标和其他静态文件计入 bundle。当前 CSS 是一个约 189 KB raw 的全量文件，尚未随 route 或页面模块拆分。

线上 Next.js 数据是当日对 `https://groupher.com/` 的实际响应测量结果。后续复测必须记录日期，因为线上部署会变化。

### 2.2 HTML 不是同一种渲染结果

TanStack 首页 HTML 包含完整 prerender 页面：

- body 约 358 KB raw；
- 1,688 个 `div`；
- 245 个 inline SVG；
- 392 个 SVG `path`；
- inline scripts 合计约 18 KB，其中 TanStack stream barrier 约 17 KB。

线上 Next.js HTML 包含 `BAILOUT_TO_CLIENT_SIDE_RENDERING`，原始响应几乎没有真实 Landing DOM，主要是客户端 bootstrap/RSC 数据。因此 HTML gzip 的 `70 KB vs 9 KB` 不是同等 SSR 输出下的框架开销对比。

V2 必须保留以下合约：

- 原始 HTML 存在页面标题、关键营销内容和主要链接；
- 关闭 JavaScript 后页面仍有可读内容；
- 未知路径继续返回品牌 `404.html`；
- 不通过 CSR bailout、空 suspense shell 或 mount 后再渲染整页来制造较小 HTML。

HTML 优化应针对重复 markup 和经实测占比显著、确实适合图片化的资产，而不是删除 prerender 内容或批量替换普通 SVG icon。

### 2.3 V2 改动前后基线

以下数据使用同一台机器、同一套 production build 与“首页 HTML 实际引用资源”口径。十进制 KB 仅用于快速阅读，验收与后续 diff 以精确字节数为准。

| 指标                 |                    V2 前 |                    V2 后 |   绝对变化 | 百分比变化 |
| -------------------- | -----------------------: | -----------------------: | ---------: | ---------: |
| JS 文件数            |                       13 |                        5 |         -8 |     -61.5% |
| JS raw               | 1,889,864 B / 1,889.9 KB | 1,135,159 B / 1,135.2 KB | -754,705 B |     -39.9% |
| JS gzip              |     467,966 B / 468.0 KB |     360,967 B / 361.0 KB | -106,999 B |     -22.9% |
| JS Brotli            |     430,339 B / 430.3 KB |     304,115 B / 304.1 KB | -126,224 B |     -29.3% |
| CSS 文件数           |                        1 |                        1 |          0 |         0% |
| CSS raw              |     188,936 B / 188.9 KB |     188,936 B / 188.9 KB |          0 |         0% |
| CSS gzip             |       29,201 B / 29.2 KB |       29,421 B / 29.4 KB |     +220 B |      +0.8% |
| JS + CSS gzip        |     497,167 B / 497.2 KB |     390,388 B / 390.4 KB | -106,779 B |     -21.5% |
| HTML raw             |     361,236 B / 361.2 KB |     359,973 B / 360.0 KB |   -1,263 B |      -0.3% |
| HTML gzip            |       69,801 B / 69.8 KB |       69,925 B / 69.9 KB |     +124 B |      +0.2% |
| HTML + JS + CSS gzip |     566,968 B / 567.0 KB |     460,313 B / 460.3 KB | -106,655 B |     -18.8% |

因此 V2 完成后的两个固定报告值是：

- Landing 首页 client bundle：`390.4 KB gzip`（JS + CSS，不含 HTML）；
- Landing 首页首次静态传输：`460.3 KB gzip`（HTML + JS + CSS，不含图片、字体及运行时请求）。

改动前后的依赖边界对比：

| 依赖/能力                  | V2 前                                        | V2 后                                    |
| -------------------------- | -------------------------------------------- | ---------------------------------------- |
| GraphQL generated/query    | 由 provider barrel 进入 Landing              | 不在 Landing client source map           |
| Dashboard store            | Landing root 默认创建                        | 由 `StaticShellProvider` 移除            |
| Footer editor / `@dnd-kit` | 公共 Footer 间接加载                         | Footer 使用独立 domain/context，不再加载 |
| React Aria/Stately         | Dashboard showcase 的真实 ColorSelector 引入 | Landing 使用轻量内置色交互，不再加载     |
| FAQ 其他布局               | 聚合入口共同加载                             | 直接使用 `LeftRightList`                 |
| QR renderer                | `MenuButton` 顶层加载                        | 菜单打开且存在 `qrLink` 时动态加载       |

HTML 与 CSS 基本不变是符合本轮范围的结果：V2 处理客户端依赖边界，不以删除 prerender 内容或视觉样式换取体积。HTML、单文件 CSS、Tooltip/Markdown 和动画 runtime 的后续基线由 V3 继续承接。

## 3. 已确认的依赖泄漏

### 3.1 Provider barrel 带入 GraphQL

Landing root route 当前通过 barrel 导入：

```text
src/routes/__root.tsx
  -> ~/app/providers
     -> GlobalProvider
     -> QueryProvider
        -> query/mutation/article
        -> query/viewer
        -> generated/gql.ts
        -> generated/graphql.ts
```

source map 中两个 GraphQL 生成文件的源码合计约 1.37 MB：

| 文件                                    | source map 源码大小 |
| --------------------------------------- | ------------------: |
| `core/lib/graphql/generated/graphql.ts` |         1,010,590 B |
| `core/lib/graphql/generated/gql.ts`     |           358,128 B |

Landing 没有使用 TanStack Query、viewer query 或 article mutation。这部分属于模块边界错误，不属于营销页面的必要成本。

落地方案：

1. Landing 不再使用 `GlobalProvider` barrel，root 直接组合 `StaticLayout` 与 `StaticShellProvider`；
2. 检查其他 host 是否依赖该 barrel，Landing 的修改不能破坏 Main、Dashboard 或 Community；
3. 构建后确认 `query/viewer.ts`、`query/mutation/article.ts` 和 GraphQL 生成文件不再出现在 Landing client source map；
4. 若 direct import 后仍保留 GraphQL，继续从具体 side effect/import 链定位，不能用 manual chunk 掩盖泄漏。

### 3.2 公共 Footer 带入 Dashboard DnD 与 Dashboard store

已确认链路：

```text
public Footer
  -> useFooterLinks
  -> DashboardThread/Footer/Editors/model
  -> @dnd-kit/sortable
  -> @dnd-kit/core + @dnd-kit/utilities
```

问题在于公共 Footer 只需要链接校验，却复用了同时实现拖拽排序的 editor model。`arrayMove` 是该 model 的顶层 runtime import，因此 bundler 无法只保留校验逻辑。

该问题不是 Landing 独有。Community 同样通过公共 `SiteFooter -> useFooterLinks` 进入 editor model，因此修复必须发生在 Core，并在 Landing 与 Community 两个 production build 中复测。

只拆 validation 仍不完整：`useFooterLinks` 还通过 `useDashboard()` 从 `DashboardStoreProvider` 读取 `footerLayout`、`footerLinks` 和 `footerOnelineLinks`。store context 缺失时 hook 会抛错，因此 Phase 2 不能在没有替代数据源的情况下直接移除 Landing 的 Dashboard provider。

落地方案：

1. 将 Footer link validation/normalization 拆到不依赖 React 和 DnD 的公共纯函数模块；
2. 公共 Footer 与 Dashboard editor 都依赖该纯函数模块；
3. `arrayMove`、drag target 和 editor draft 转换继续归 Dashboard editor 所有；
4. Core 提供 `FooterLinksProvider` 与 `FooterLinksContext`，只承载公开 Footer 所需的 `layout`、`links`、`onelineLinks`；
5. 保留现有 `useFooterLinks` 名称，但将实现改为读取 `FooterLinksContext`，不再调用 `useDashboard()`；
6. `SiteFooter`、`GroupLayout` 和 `OnelineLayout` 继续通过 `useFooterLinks` 取数，不直接读取完整 Dashboard store，也不直接耦合 `LANDING_INIT_DATA`；
7. `CommunityShellProvider` 在 `DashboardStoreProvider` 内挂载简单的 `DashboardFooterLinksProvider`，后者只读取 Dashboard store 的三个 Footer 字段并传给 `FooterLinksProvider`；
8. Dashboard editor 继续直接使用 Dashboard store；编辑状态变化会使 `DashboardFooterLinksProvider` 更新 context，因此公开 Footer preview 保持实时更新；
9. `StaticShellProvider` 接收必填的 `footerLinks` 配置并直接挂载 `FooterLinksProvider`，完全不创建 Dashboard store；没有 Footer 的静态 host 必须显式传空配置，不能依赖隐藏默认值；
10. 检查 `DashboardThread/Footer/Templates/Group.tsx` 等其他公共渲染入口，全部改为依赖纯 Footer domain，不能从第二条路径重新引入 editor model；
11. 构建后确认三个 `@dnd-kit` 包不再进入 Landing 与 Community 的公共页面 client source map。

目标数据流：

```text
CommunityShellProvider
  -> DashboardStoreProvider
     -> DashboardFooterLinksProvider
        -> FooterLinksProvider
           -> SiteFooter/useFooterLinks

StaticShellProvider
  -> FooterLinksProvider(static footerLinks)
     -> SiteFooter/useFooterLinks
```

`FooterLinksProvider` 的值使用独立公共类型：

```ts
type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
  onelineLinks: readonly TFooterOnelineLink[]
}
```

validation/normalization 在写入 context 的边界完成。纯 domain、context 和 Dashboard adapter 必须是三个独立模块：公共 Footer import context/domain，Dashboard adapter 可以 import Dashboard hook，但这种依赖不能反向泄漏回 context 或 SiteFooter。

这是一处 Core 边界修复，不应在 Landing 内复制一套临时校验逻辑。

### 3.3 Shell provider 命名与运行时边界

`frontend/main` 仍是明确保留的线上 Next.js 应用：根 scripts、Dev Hub、type-check/build 入口和 `frontend/main/src/app/[community]/layout.tsx` 都仍然使用它；在单独作出退役决策前，Main 不是临时兼容层，不能在本轮删除或假设其 caller 已不存在。

当前 `MainProvider` 的名称描述的是历史 host，而不是它实际提供的能力。它组合 Theme、InitialNow、Locale、Account、Community、Dashboard、ThemePreset 和 Wallpaper stores，应重命名为 `CommunityShellProvider`。该重命名是覆盖 `frontend/main`、Community、Dashboard 及相关测试/文档的机械迁移，不代表 `frontend/main` 退役。

Landing root route 当前也挂载了完整 `MainProvider`。即使传入 `noAccount`，模块层仍静态导入并初始化 Community、Dashboard、ThemePreset、Wallpaper 等 provider；`LANDING_INIT_DATA` 也通过完整 Dashboard `FIELDS` 构造营销页初始状态。

`GlobalProvider` 默认还静态包含 `AuthLoginModal`。Landing 已声明 `noAccount`，公开营销页不应默认拥有登录弹窗运行时。

目标边界确定为：

- `CommunityShellProvider`：完整社区运行环境，供现存 Main、Community、Dashboard 等需要社区和 Dashboard 状态的 host 使用；
- `StaticShellProvider`：Core 提供的静态页面环境，供 Landing 及后续其他静态 host 使用，只组合 Theme、InitialNow、Locale、Wallpaper 和窄 Footer 配置等明确需要的能力；
- `StaticShellProvider` 不包含 Account、Dashboard store、QueryProvider、auth modal 或其他业务查询；
- 两个 provider 复用底层小 provider，但不互相包裹，也不通过 boolean props 在一个巨型 provider 中切换能力；
- Landing 的 footer、wallpaper 和 theme 数据由明确 props/context 注入，不再通过完整 Dashboard `FIELDS` 间接供给。

不能只传入 `authLoginModal={false}` 就认定 bundle 已删除登录模块；只要 `GlobalProvider` 仍静态 import 它，构建结果可能不变。完成条件以 source map 和 chunk 内容为准。

### 3.4 整页组件 eager load

首页当前静态导入全部展示区块。主要间接依赖包括：

| 来源                                | 被带入的主要依赖               |
| ----------------------------------- | ------------------------------ |
| Dashboard showcase / color selector | React Aria、React Stately      |
| Tooltip                             | Tippy、Popper                  |
| FAQ 全布局                          | `markdown-to-jsx` 及未使用布局 |
| Cover                               | Typewriter、carousel           |
| Community menu                      | `qrcode.react`                 |
| Animated count                      | `react-flip-numbers`           |

其中 source map 源码规模约为：React Aria 318 KB、React Stately 152 KB、Tippy 74 KB、Markdown 71 KB、Popper 69 KB、React Aria Components 65 KB。

React Aria/Stately 的确认入口是：

```text
Landing DashboardIntros/LayoutTab/Header
  -> Core ColorSelector
  -> CustomColorPicker
  -> react-aria-components ColorPicker/ColorArea/ColorSlider/ColorField
```

Landing 这里只展示 Dashboard UI，不需要真实可编辑颜色选择器。本轮已从 Landing showcase 移除真实 `ColorSelector`，改为只切换内置色的轻交互按钮。共享 Dashboard 的 custom picker 属于真实产品能力，本轮不删除；它已从 Landing 依赖图消失，因此没有必要为了 Landing bundle 改变 Dashboard 行为。

Markdown 的确认入口是当前 FAQ renderer：`FaqList -> LeftRight/Section -> Markdown -> markdown-to-jsx`。本轮只拆 FAQ layout 的模块边界，不替换 Markdown；后续用服务端/RSC-style renderer 单独处理。

QR code 的确认入口更间接：Landing 使用 `LEFT_RIGHT`，但 `FaqList` 静态导入未使用的 `Collapse`，后者通过 `Banner -> MenuButton -> Menu` 顶层导入 `qrcode.react`。因此先拆 FAQ layout 即可让 Landing 不再加载该链；Core `MenuButton` 仍应在菜单实际打开、且确实存在 `qrLink` 时才 lazy load QR renderer。由于该改动位于共享 Core，必须同步复测 Main、Community、Dashboard 的 production build 与含 QR 菜单交互，不能只验证 Landing。

Tooltip/Tippy/Popper 的 native tooltip 与 interactive popover 分层留作独立后续工作，本轮不替换 Tooltip，也不把其潜在收益计入 V2 验收目标。

这些数字是 source map 源码大小，不等于可直接相加的 gzip 收益；共享 runtime、tree shaking 和压缩都会影响最终结果。

落地方案：

1. 先消除明确的跨边界泄漏，再重新测量；
2. 将 FAQ 当前布局与其他布局拆成独立入口，不能因一个 `LEFT_RIGHT` 页面加载全部 FAQ renderer；
3. 从 Landing Dashboard showcase 移除真实 `ColorSelector`；共享 Dashboard custom picker 保持不变；
4. `MenuButton` 仅在菜单打开且 option 确实包含 `qrLink` 时 lazy load QR renderer；
5. 对首屏以下重模块设计延迟 hydration/load 边界；
6. 保留关键营销内容的 prerender HTML，不能简单用 IntersectionObserver 把整个区块改为客户端后渲染；
7. 若当前 TanStack/React 架构无法同时实现 SSR markup 与独立 hydration，先接受共享 hydration，再优化组件内部依赖，不引入脆弱的伪 islands。

## 4. HTML 与静态资产

完整 `dist/client` 在不同构建中观察到约 35–42 MB、4,395–4,424 个文件，主要来自 wallpaper、icons 和其他静态资源。该数字会随 wallpaper 等资产变化，每次 production build 都必须重新记录，不能作为固定基线，也不能作为 JavaScript bundle size 对外报告。

HTML 中有 245 个 inline SVG，但 source map 未发现单个巨型 Landing SVG：CompareDev 的 `CurveLine1–4` 每个源码约 690 B，ImportTab 的连接线约 626 B，大部分是重复的小图标实例。后续 wallpaper 本身计划改为图片资源，但 V2 不把普通 icon 或这些小连接线默认图片化：

- 有交互、主题色或需要 CSS 控制的图标继续保留组件形态；
- 只有实测占比显著的大型纯装饰图、重复复杂 path 和无需 DOM 语义的插画才优先转成静态图片；
- 图片必须有内容哈希和明确尺寸，避免 CLS；
- 首屏关键图片验证 LCP，不能因减少 HTML 而引入更慢的串行图片请求；
- wallpaper 图片化后删除旧 renderer/generated asset 的前提是确认没有其他 host 使用；
- CompareDev 曲线和 ImportTab 连接线当前收益太小，不进入 V2 强制改造清单。

## 5. 实施阶段

### 5.0 本轮落地结果（2026-08-26）

已完成：

- 公共 Footer validation/normalization 已从 Dashboard DnD editor model 拆出；`SiteFooter` 只读取 `FooterLinksProvider`；
- `DashboardFooterLinksProvider` 作为很薄的 Dashboard 数据适配层，Community/Main/Dashboard 仍保留实时 Footer preview；
- 历史 `MainProvider` 已重命名为 `CommunityShellProvider`，所有仍存活的 Main、Community、Dashboard caller 已同步迁移；
- Landing 改用 `StaticShellProvider` 与 `StaticLayout`，不再创建 Dashboard、Account、Query 或 auth modal runtime；
- Landing 所需公开 layout 配置由窄的 shell context 注入，不再借完整 Dashboard store 供给；
- FAQ 改为直接导入 `LeftRightList`，不再通过聚合入口加载未使用布局；
- Landing Dashboard showcase 不再加载真实 `ColorSelector`；共享 Dashboard custom picker 保持原产品能力；
- QR renderer 改为菜单处于打开状态且 option 存在 `qrLink` 时动态加载，并有交互测试覆盖。

Landing client source map 已确认以下目标全部缺席：

```text
lib/graphql/generated
query/viewer
query/mutation/article
@dnd-kit
react-aria / react-stately / react-aria-components
qrcode.react
DashboardThread/Footer/Editors/model
```

首页资源的完整改动前后数据见 [2.3 V2 改动前后基线](#23-v2-改动前后基线)。该表同时保留精确字节、十进制 KB、绝对变化和百分比，作为后续 V3 及线上复测的固定比较基线。

最大两个 client chunk 现在是：

- `index`：623.67 KB raw / 205.47 KB gzip，主要由 React DOM、Core、Motion、TanStack Router 与 `cnfast` 组成；
- `routes`：502.01 KB raw / 154.44 KB gzip，主要由 Landing/Core 页面代码、Tippy/Popper、Markdown、动画和 carousel 组成。

`/pricing`、`/book-demo` 与 `/404` 已生成独立 route chunk；首页仍只引用单个 188.93 KB CSS 文件，CSS route split 尚未完成，不能把 V2 的依赖收敛描述成 CSS 优化已经完成。

验证结果：Core 全量 674 tests 通过；Core、Main、Dashboard、Community、Landing type-check 通过；Landing、Main、Community production build 通过。Dashboard production build 的编译与 TypeScript 阶段通过，静态预渲染 `/[community]/appearance/theme` 时因本地 GraphQL 服务未启动而 `ECONNREFUSED`，属于构建环境前置服务缺失，需在可连接 API 的环境补跑最终 prerender 验收。

### Phase 1：切断错误依赖

- Landing 绕过 provider barrel，直接使用窄入口；
- 将公共 Footer validation 与 Dashboard DnD editor model 拆开；
- 建立 `FooterLinksProvider`，让现有 `useFooterLinks` 改读窄 context；
- 建立 `DashboardFooterLinksProvider`，维持 Community/Dashboard Footer 的实时 store 数据；
- 让 `StaticShellProvider` 直接注入静态 Footer links，解除 Landing `SiteFooter -> useDashboard`；
- 构建并保存新的首页资源清单与 source map 证据。

验收：

- Landing source map 不再包含 GraphQL generated/query 链；
- Landing 与 Community 公共页面 source map 不再因 SiteFooter 包含 `@dnd-kit`；
- Landing 不挂载 Dashboard store 时 SiteFooter 正常渲染，缺失 Footer provider 时给出明确开发错误而不是静默读取默认 Dashboard 数据；
- Dashboard 编辑 Footer 后 SiteFooter preview 仍实时更新；
- `/`、`/pricing`、`/book-demo` 和品牌 404 行为不变；
- 类型检查、production build 和静态产物校验通过。

### Phase 2：建立 Community/Static Shell

- 将历史 `MainProvider` 重命名并收敛为 `CommunityShellProvider`，同步更新现存 `frontend/main`、Community、Dashboard 的 import、组件名、测试和说明；
- 新建 `StaticShellProvider`，只组合 Landing 实际需要的静态能力；
- Landing 切换到 `StaticShellProvider`，移除 Dashboard、Account、Query 和 auth modal 等运行时；
- 保留 theme、locale、initial time、wallpaper、Footer 配置、first-paint 与 platform adapter 合约；
- 验证 light/dark、wallpaper、locale、导航和 hydration。

验收：完整页面能力不退化，且被移除模块不再出现在 source map；不能只以代码路径“未执行”作为完成依据。Main、Community、Dashboard 与 Landing 的 type-check 和 production build 均通过，Main 的现有线上运行边界不变。

### Phase 3：页面加载边界

- 拆分 FAQ renderer；
- Landing showcase 移除真实 `ColorSelector`，共享 Dashboard custom picker 保持不变；
- QR renderer 改为仅在打开含 `qrLink` 的菜单时加载；普通 MenuButton 不请求 QR chunk，含 QR 的菜单首次打开后才请求并正确渲染；
- Tooltip 与 Markdown 保持现状，分别留到后续独立方案；
- 评估 carousel 和动画库的必要性；
- 对首屏以下重模块建立 SSR-safe 加载策略；
- 使用 source map 量化最大 chunk 的模块归属；当前基线中 `index` 约 963 KB raw、`routes` 约 676 KB raw，不能只观察总量；
- 确认 `/`、`/pricing`、`/book-demo` 和 not-found 页面组件按 route 正确 code-split；
- 检查 chunk 数量和请求链，避免体积平均下降但单块仍巨大，或请求瀑布恶化。

验收：原始 HTML 仍含关键内容，无 hydration error、布局闪烁或滚动位置回归；同一测量口径下 JS + CSS gzip 继续下降；首页 CSS 不再无条件加载所有 route/延迟模块样式，若 Vite 未自动拆分则记录具体阻塞模块。共享 QR 改动需通过 Main、Community、Dashboard production build，并验证 Share/MenuButton 等现有 QR 入口。

### Phase 4：HTML 与 wallpaper 图片化

- 统计各区块 inline SVG/path 的真实贡献，仅处理达到明确收益阈值的装饰资源；
- 推进 wallpaper 图片化并清理仅由 Landing 使用的旧 renderer；
- 检查图片缓存、尺寸、LCP 和 CLS。

验收：HTML gzip 下降，同时关键 prerender 内容、LCP 和视觉效果不退化。

## 6. 测量与完成定义

每个 Phase 都必须使用同一口径记录：

1. clean production build；
2. 从构建后的首页 HTML 提取实际引用的 JS/CSS；
3. 分别记录 raw、gzip、Brotli、文件数；
4. 单独记录 HTML，不把 HTML 与 client bundle 混为一个指标；
5. 记录完整 `dist/client`，但标注它是部署资产总量；
6. 通过 source map 确认目标依赖是否真正消失；
7. 记录最大 chunk 的 raw/gzip、模块归属和 route code-split 结果；
8. 记录首页 CSS 文件数、raw/gzip 及其 route/组件归属；
9. 与线上对比时记录 URL、日期和线上渲染策略。

V2 完成必须同时满足：

- GraphQL generated/query 和 `@dnd-kit` 不再进入 Landing；
- SiteFooter 不再依赖 Dashboard editor model 或完整 Dashboard store，Community 同步获得该边界修复；
- `CommunityShellProvider` 与 `StaticShellProvider` 边界落地，Landing root runtime 不再默认拥有无关的 Dashboard/Account/auth 能力；
- 首屏以下依赖边界已经收敛，未使用 FAQ 布局不会共同打包；
- Landing showcase 不再加载 React Aria/Stately custom color picker，普通菜单不再默认加载 QR renderer；
- 四个页面边界正确 code-split，最大 chunk 与 CSS 归属有可复现报告；
- 原始 HTML 保持可索引、可阅读，不退化为 CSR 空壳；
- 三个公开页面、品牌 404、资源 namespace 和 Cloudflare Static Assets 合约不变；
- production bundle 报告更新为优化后的实测值，不用估算值代替验收。

V2 不预设一个脱离产品行为的绝对 KB 指标。第一目标是删除已确认的错误依赖；最终预算应在 Phase 1 和 Phase 2 完成、重新得到稳定基线后确定。
