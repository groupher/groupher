# Wallpaper 实时编辑与静态发布边界（v1 主体归档）

> 文档角色：Mixed reference。v1 单图保存、上传和数据模型已经归档；§4.1.1 的编辑页 SSR→GPU
> 接管、§7 的 pre-paint `data-theme`/CSS 主题选择，以及 §4.2/§8 中普通路由 static-first、默认不加载
> GPU runtime 的边界仍然有效。涉及单 `staticAssetPublicRef` 的具体实现继续按 v1 归档理解。
> §9/§10 中标记为“待补”或“待决策”的内容（包括 `reconcileConfirmed` 和产物计划分支测试）均为
> v1 遗留记录，不代表 v2 现行 backlog；v2 后续工作以 Active contract 的收敛清单和验收标准为准。
>
> Active：[当前 theme 单独保存重构](./current-theme-save-refactor.md) ·
> [保存链路与数据边界](./save-pipeline-contract.md) ·
> [响应式静态产物、历史与共享导出机制](./responsive-revisions.md) ·
> [实时预览架构](./preview-architecture.md)
>
> Active background contract：[Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md)
>
> 历史状态：第一阶段已实施（静态契约、保存发布、共享 Shell 边界）；编辑页 SSR→GPU 双层接管已实现
> `gpu-ready`/failure 信号、context 丢失恢复与主题 CSS 首屏选择。v2 已改为当前 theme 单独保存、
> `dashboard.wallpaper` Profile 图片和 NONE→Root page color；本文件只保留仍有效的编辑页接管、首屏
> 主题选择和 static-first 消费边界。Landing Shell 静态背景、bundle 产物审计和线上验收仍需单独完成。
>
> 日期：2026-09-06
>
> Archive：[浏览器端导出与上传（v1）](./browser-export-upload.md)
>
> 协议版本说明：本文记录已归档的 v1 单图实现。当前 v2 的 Profile 图片、当前 theme 单独保存、
> Snapshot/Settings 和最近 5 次历史以 [保存链路与数据边界](./save-pipeline-contract.md) 与
> [当前 theme 单独保存重构](./current-theme-save-refactor.md) 为准；本文不提供运行时兼容路径。
> 当前方案只复用本文 §8 末段的 bundle 边界决策和 §9.10 的 Landing 静态背景决策表述；§9 的其他
> v1 历史步骤（尤其旧的 light/dark 合并保存）均不可执行，也不构成当前迁移清单。

## 1. 决策

Wallpaper 明确拆成两种运行形态：

- **创作态**：仅 Dash Wallpaper 编辑页使用 WebGPU 实时渲染。
- **发布态**：其他所有路由和子应用只使用上传完成的 light/dark 静态图片。

WebGPU 实时运行时只允许出现在以下 Dashboard 页面：

```text
https://dash.groupher.localhost/home/appearance/wallpaper
```

TanStack file route 模式是 `/$community/appearance/wallpaper`；上面的具体 URL 中
`$community = home`，因此实际 pathname 是 `/home/appearance/wallpaper`。这里的 `home` 是
community slug，不是额外的固定路由前缀。

Dash 其他路由、Community、Landing、Apply 以及其他子应用不再用 Wallpaper recipe 驱动全屏背景，
不为 Wallpaper 构造 `TBgRenderSpec`，不为 Wallpaper 挂载 Canvas，也不加载 Wallpaper 的
WebGPU、WebGL、vgpu 或 WGSL runtime。CoverEditor/DocCovers 等独立能力若自身使用 `BgRenderer`，
不属于本次 Wallpaper 边界。
现有共享 Shell 仍可能为按钮、布局等非背景 UI hydrate Wallpaper store；这不属于背景渲染路径，
后续可在查询层进一步拆分为 static-only payload。

保存时的一次性 WebGPU 导出仍属于 Wallpaper 编辑页能力，不属于普通页面的实时渲染。

## 2. 目标链路

```text
Dash Wallpaper Editor
  -> light/dark 完整创作配置
  -> WebGPU 实时预览
  -> Save
  -> 分别解析 light/dark 的静态产物计划
  -> NONE 写 null / 无效果 UPLOAD 复用原 assetPublicRef
  -> 仅对需要合成的 branch 导出 WebP
  -> Assets Hub 上传并 finalize 派生产物
  -> 获得完整 light/dark static refs
  -> 一次 mutation 发布配置和静态资产引用
  -> Community Snapshot 暴露静态图片 URL
  -> StaticWallpaper 按当前主题显示对应图片
  -> Dash 其他路由 / Community / Landing / Apply / 其他子应用
```

这条链路中只有 Editor 和保存时的导出步骤接触 GPU renderer。`StaticWallpaper` 是普通运行时
唯一允许使用的 Wallpaper 组件。

## 3. 修复前问题与已落地结果

以下“当前”描述保留问题的原始证据；截至本次实施，3.1 和 3.2 的代码修复已落地，
3.3/3.4 的契约缺口也已补齐。剩余验证项见 §9 和 §10。

### 3.1 普通路由仍在挂载实时 renderer

当前 `frontend/core/shell/GlobalLayout/Wallpaper.tsx` 直接挂载 `WallpaperRenderer`，而
`GlobalLayout` 又在所有共享页面上无条件渲染它。

`frontend/core/shell/StaticLayout/index.tsx` 也复用了同一个动态 Wallpaper。因此当前普通页面
虽然没有开启 `preferVgpu`，仍然会：

- 构造完整 `TBgRenderSpec`；
- 订阅 Wallpaper preview frame；
- 挂载 `BgRenderer`；
- 保留 WebGL/WebGPU renderer 的运行时边界。

Landing 还有两处绕过共享 Layout、直接挂载 `WallpaperRenderer` 的营销演示：

- `frontend/landing/src/widgets/Landing/CoverImage/DesktopDevice.tsx:40`；
- `frontend/landing/src/widgets/Landing/DashboardIntros/LayoutTab/WallpaperCard.tsx:11`。

它们不是 community Wallpaper 消费端，而是 Landing 内的固定产品演示。目标实现不应让它们
读取 community snapshot 或复用 `StaticWallpaper` 的业务数据；应改为 Landing 自有的预渲染
静态演示图，或者接收 Landing 本地静态 asset props。两处都必须移除对 `WallpaperRenderer`、
Wallpaper store 和 preview bus 的依赖。

本次已将共享 Shell 切换为 `StaticWallpaper`，并将上述两处 Landing 演示改为本地 light/dark
静态图；`WallpaperRenderer` 现在只保留在 Editor 的 `GlobalPreview` 与 `AuthPreview`。

### 3.2 保存配置与发布静态图片相互脱节

当前 `useLogic.ts` 的顺序是：

```text
保存 Wallpaper recipe
  -> mutation success
  -> acceptSubmitted，清除 touched
  -> 提示保存成功
  -> 异步导出当前 theme
  -> 异步上传
```

导出或上传失败不会撤销 recipe 保存；上传返回的 `assetPublicRef` 和 `uploadRef` 也没有写回
Wallpaper 配置。结果是 UI 可以显示“保存成功”，但供其他应用消费的静态图片并未发布。

### 3.3 只导出当前主题

当前导出 spec 来自正在编辑的 theme branch。一次 Save 只生成 light 或 dark 中的一张图，无法
保证普通页面切换主题后存在对应的静态产物。

### 3.4 数据契约没有静态发布产物

当前 `TWallpaperConfig` 只描述 Wallpaper 创作配置，没有 light/dark 静态图片的
`assetPublicRef`、URL、revision 或 render hash。Community Snapshot 因此也没有稳定的静态
Wallpaper 契约。

## 4. 组件边界

### 4.1 Wallpaper Editor Renderer

仅由 `/$community/appearance/wallpaper` 路由以 `editor` runtime mode 加载，负责：

- 完整 light/dark recipe；
- `TBgRenderSpec` 适配；
- WebGPU 实时预览；
- PreviewSession/frame 更新；
- 编辑器内的 Global/Auth 等预览目标；
- 保存时懒加载 WebGPU export runtime。

Editor、renderer、shader 和 export runtime 应保持 route-local lazy boundary。普通路由的静态
import graph 不应到达这些模块。

当前实现由 Dash `DsbShell` 根据 TanStack route match 设置 `WallpaperRuntimeProvider`：

```text
route id = /$community/appearance/wallpaper
  -> mode = editor
其他 route
  -> mode = static
```

共享 `GlobalLayout/Wallpaper` 在内部读取这个 mode：`editor` 时 lazy mount
`EditorStaticWallpaper` 与 `WallpaperRenderer`，`static` 时只渲染 `StaticWallpaper`。因此编辑页不需要从
内容组件向上控制 Shell，普通路由的静态 import 也不会进入 authoring composer/store 或 GPU renderer。

### 4.1.1 编辑页 SSR 首屏与 GPU 接管（已实施）

编辑页的 SSR 静态层与 client GPU 层可以使用不同 renderer，但两者在接管时必须使用同一主题、同一
responsive Profile 和同一构图语义；不能把“实现不同”解释为允许 Pattern 密度、Gradient 中心或可见裁切
发生跳变。当前已实现 `gpu-ready`/failure 信号、双层透明度接管和 GPU context 丢失后的静态层恢复。
切换顺序是：

```text
SSR / 首屏
  -> 显示 StaticWallpaper
  -> client 加载 WallpaperRenderer
  -> 创建 GPU renderer
  -> GPU 成功绘制首帧（gpu-ready）
  -> GPU 层淡入
  -> StaticWallpaper 淡出
```

这里必须区分两个 ready 状态：Suspense ready 只表示 `WallpaperRenderer` 的 JavaScript
chunk 已加载；`gpu-ready` 还必须表示 renderer 已创建并成功提交至少一帧。不能在 Suspense
解除时立即卸载静态层。

编辑页采用已发布静态层、CSS draft 层与 GPU 层的三层结构：静态层先保持可见，GPU 层初始透明，
收到与当前首屏主题相同的 `gpu-ready` 后淡入，静态层再淡出。主题切换会重新建立对应主题的 GPU layer；在
新 layer ready 前，旧静态双分支仍保持可见，因此不会把 hydration 期间的 light 快照误当成
dark 用户的可见结果。动画结束后可以保留静态层作为不可见 fallback；如果 GPU context 丢失或
初始化失败，应恢复静态层，而不是让页面变空。

Wallpaper renderer 的主题唯一真相源是 pre-paint 脚本写入的
`document.documentElement[data-theme]`。SSR 和 hydration 的 React store 快照可以暂时是
light，但 renderer 不得使用未解析的 store 快照选 branch；`useTheme()` 在 theme domain 内部
读取 DOM 值并向业务层提供当前主题，从而与首屏 CSS 选择保持一致。编辑页的 Global/Auth 预览
共用相同的双分支静态 fallback，pattern 的颜色、mask 和背景也按同一主题 branch 选择。

SSR fallback 优先使用已发布的 `wallpaper` Profile 图片，GPU Editor 使用当前编辑 settings。
如果当前 theme 没有已发布 Profile 图片，`EditorStaticWallpaper` 会把 light/dark 两套当前 settings 同时
SSR 成 `.theme-light-branch` / `.theme-dark-branch`，由 pre-paint 写入的 `html[data-theme]` 在 CSS 层
选择首帧。不能在 React render 中只输出当前 theme 的一套 inline background；否则 system-dark 在 hydration
前仍会短暂看到 light draft。pre-paint 必须保持为 `<head>` 内的同步 inline script，在 `</head>`/`<body>` 与
首次绘制前写入 `data-theme`；React 可能把 stylesheet link hoist 到脚本前，因此不以两者 HTML 顺序为契约。
这样双分支的 200ms transition 才不会形成首帧 cross-fade。Editor fallback 外层不使用 `.static-wallpaper`，
背景只由两个显式主题子层绘制。该 fallback 不会写入发布契约，也不
替代 Save 时的 WebGPU 导出。两者应通过相同的发布 revision 保持语义一致；在 recipe 尚未
生成新静态产物或产物与 renderer 存在像素差异时，静态层只承担首屏/fallback 职责，不能被
当作 GPU 首帧的像素等价证明。

接管一致性还包含尺寸契约：有当前主题的已发布图片时，CSS 静态层和 client renderer 必须命中同一个
`wide/desktop/tablet/phone` Profile。GPU 的逻辑画布使用该 Profile 的逻辑宽高，backing store 再按
`min(devicePixelRatio, 2)` 提高清晰度，最终 canvas 与静态图片都在 viewport 内 `cover center`。Pattern repeat
始终以逻辑画布单位计算，不能随 backing-store DPR 改变。没有已发布图片时，CSS draft 与 GPU 才共同使用
实际 viewport 构图。

ready/failure 不能只按 theme 记忆，还必须包含 Profile（无已发布图片时为 viewport 模式）。resize 导致
Profile 切换后，active Profile 立即使旧 ready 状态失效并显示新 Profile 的静态层；GPU renderer Profile 仅在
边界稳定 `150ms` 后替换，避免在 `16/10` 附近反复销毁和初始化。新 key 的首帧成功后才能再次接管。
这里的 `150ms` 只 debounce resize 后的 renderer 重建，不延迟 CSS 选图。当前 post-hydration 的首次
`wide -> client Profile` 校正也会经过该 settle，可能产生一次多余的初始 renderer 工作；安全优化必须在 hydration
commit 后直接确定首次 client renderer Profile，不能在首次 client render 中读取 `window` 改变 SSR tree。

### 4.2 StaticWallpaper

共享 Shell 使用轻量 `StaticWallpaper` 替换当前动态 `WallpaperRenderer`。它只接收已发布的
静态图片信息。组件 props 与 §5 的数据契约使用不同类型名：

```ts
export type TStaticWallpaperProps = {
  wallpaper?: TPublishedWallpaper | null
  className?: string
}
```

`StaticWallpaper` 只负责：

- 根据 light/dark theme 显示对应静态图片；
- 在没有已发布图片或图片加载失败时不产生图片绘制，让 Root page color 显示；
- 使用 CSS variables 和 `<html data-theme>` 完成主题/Profile 选择；
- 保持 SSR 首屏和 hydration 前后稳定；
- 为静态图片提供可长期缓存的 URL。

它不得：

- 读取 Wallpaper 编辑 store；
- 接收 recipe 或 `TBgRenderSpec`；
- 订阅 preview frame；
- 挂载 Canvas；
- import `BgRenderer`、vgpu、WebGL renderer 或 shader。

`StaticWallpaper` 本身不维护“上一版 ref”本地缓存。发布失败时 Backend 不切换 Snapshot，
普通页面自然继续拿到上一版完整 `TPublishedWallpaper`；若当前 branch 为空或图片加载失败，组件
不跨 theme、跨 Snapshot 猜测旧 URL，也不写入默认颜色；Root page canvas 继续负责基础颜色。目标模型中
Content surface 只按当前 theme 的 published branch 是否非空决定是否启用透明度与 blur，不跟踪图片
网络加载状态。

## 5. 数据契约

创作配置和发布产物需要分离。字段名最终遵守 backend schema 现有命名，但语义应等价于：

```ts
type TWallpaperAuthoringConfig = {
  light: TWallpaperThemeConfig
  dark: TWallpaperThemeConfig
}

type TStaticWallpaper = {
  light: {
    assetPublicRef: string
    url: string
  } | null
  dark: {
    assetPublicRef: string
    url: string
  } | null
  revision: string
}
```

尚未发布过 Wallpaper 时，外层字段可以是 `null`；一旦存在发布记录，`revision` 必须为非空
字符串。`type: NONE` 的发布记录也保留新的 revision，但其 light/dark 均为 `null`。

边界要求：

- 只有 Dashboard Wallpaper 编辑页需要 authoring config 和 static artifact refs 来编辑与发布。
- Dash 其他路由与其他子应用的背景消费只读取 static artifact refs/URL；现有共享查询若同时携带
  authoring 字段，不得把它们交给 renderer。
- Community Snapshot 只需向普通消费者暴露 `TStaticWallpaper`。
- 子应用不需要理解 gradient、pattern、texture、effect 或 shader 参数。
- 静态资产使用不可变 URL；新保存通过 revision/ref 切换版本，不覆盖旧 URL。

## 6. Save 发布语义

一次 Save 必须完整解析并发布 light/dark 两个主题。每个 theme branch 先判断其产物来源，
并不无条件重新编码：

| Wallpaper 状态                                          | 静态发布行为                          | 是否需要 WebGPU |
| ------------------------------------------------------- | ------------------------------------- | --------------- |
| `NONE`                                                  | 对应 branch 写 `null`                 | 否              |
| `UPLOAD` 且没有 Pattern、Texture、Filter 或其他合成效果 | 直接复用原上传资产的 `assetPublicRef` | 否              |
| `UPLOAD` 且存在任何影响最终像素的效果                   | 导出派生 WebP 并上传                  | 是              |
| Gradient、Flow、Liquid 等 recipe                        | 导出派生 WebP 并上传                  | 是              |

这里的“Pattern”仅描述实际会参与合成的效果：当前 renderer/export pipeline 只对
`GRADIENT` recipe 计算 `hasPattern`，`UPLOAD` 类型不会合成 `pattern`。因此
`requiresWallpaperExport` 不应因为 `UPLOAD` 的 `pattern.enabled` 单独变为 `true`；只有
确实影响最终像素的上传图效果才需要导出派生 WebP。

因此 UPLOAD authoring state 必须新增并保留原图的 `assetPublicRef`，不能只保存临时 URL。
这是契约变更，不是现有能力：当前 `frontend/core/spec/wallpaper.d.ts` 中的 `TWallpaperPic`
只有 `image`/`preview` URL 和效果字段，没有 `assetPublicRef`。backend schema、GraphQL input/output、
frontend spec、parser 和 Wallpaper store 必须一起补齐该字段，上传完成后也必须把 ref 写入
authoring state。light/dark 可以复用同一个原图 ref，也可以各自引用不同原图；最终仍作为一个
revision 原子发布。

完整 Save 顺序为：

```text
flush draft
  -> 为 light/dark 分别制定 static artifact plan
  -> NONE 解析为 null
  -> 无效果 UPLOAD 解析为原 assetPublicRef
  -> 其余 branch 生成 render spec、导出 WebP 并上传
  -> 得到完整 light/dark static refs
  -> 一次 mutation 写入 authoring config + static refs
  -> mutation success
  -> acceptSubmitted / 清除 touched
  -> 刷新 Dashboard query 与 Community Snapshot
```

提交边界还要执行两项协议归一化：编辑器为了拖拽连续性允许角度落在 `-180..180`，发送到
backend 前必须转换为持久化使用的 `0..359`；`pattern`、`contentShadow`、`effect`、`gradient`
和 `texture` 这些 GraphQL `Json` 字段必须以 JSON 字符串发送。否则后端会以 `4102` changeset
错误拒绝保存。changeset 错误中的结构化 `key/message` 也应在前端保留，不能退化成
`[object Object]`。

任何导出、上传或 mutation 失败时：

- touched 必须保持；
- 不提示完整保存成功；
- 普通页面继续使用上一版完整 light/dark 静态图片；
- 不允许发布一张新图和一张旧图组成的混合版本；
- 不允许静默上传缺层、空白或 fallback 图片。

图片上传早于最终 mutation，因此 mutation 失败时可能产生未引用 asset。该问题由 Assets Hub
临时上传过期清理或后续资产回收处理，不能通过提前切换 Wallpaper 引用规避。

### 6.1 removeWallpaper / NONE

`removeWallpaper()` 把当前 theme branch 设为 `type: NONE`。保存时该 branch 的静态引用必须
写为 `null`，不执行 GPU 导出，也不继续沿用旧图片。普通页面看到 `null` 后只显示 Root page color，
Content surface 不重复绘制半透明颜色或 blur。

如果只删除 light 或 dark 中的一支，另一支仍按其当前配置生成或复用静态引用；最终 mutation
仍需一次发布两支的完整结果，避免 snapshot 出现新旧 revision 混合。

### 6.2 无 WebGPU 环境

不允许“只保存 recipe、静态产物缺失”的半发布模式。Save 按 static artifact plan 判断能力：

- 本次修改的所有 branch 都是 `NONE` 或可直接复用原资产的无效果 `UPLOAD` 时，允许保存，
  不要求 `navigator.gpu`。
- 任一 branch 需要派生导出而 `navigator.gpu` 不可用时，阻止 Save，显示明确的浏览器能力错误，
  保持 touched，继续对外提供上一版 snapshot。
- 不上传空白图，不自动降级到与正式 shader 语义不一致的 CSS/Canvas 导出。

编辑页应在提交前完成 capability check；可以提前提示当前环境无法发布需要渲染的 Wallpaper，
但是否禁用 Save 必须根据本次 static artifact plan 决定，而不是全局禁用。

## 7. 主题与首屏行为

普通页面应在 CSS 层根据现有 `data-theme` 选择 light/dark 图片，避免等待客户端 theme hook
后再替换背景造成闪烁。

推荐行为：

- Dash SSR 当前固定输出 `PUBLIC_THEME_SEED = { theme: light, themeMode: system }`，服务端并不
  读取 cookie 决定最终主题；浏览器的 `ThemeStoreProvider` 会在创建 store 时以 pre-paint 写入的
  `data-theme` 覆盖该 seed 的 resolved theme，因此这不会把 hydration 锁在 light。
- `<head>` 中现有 `prePaintThemeDetectScript()` 在首屏绘制前先读取 `themeMode` cookie；合法值
  为 `light`、`dark`、`system`。没有合法 cookie 时沿用 SSR seed 的 `system`。
- mode 为 `system` 时再读取 `prefers-color-scheme: dark`，否则直接使用 mode 作为 resolved
  theme；随后写入 `<html data-theme>`、`data-theme-mode`、`color-scheme` 以及现有 cookies。
- `StaticWallpaper` 应让 light/dark URL 同时进入 CSS variables，再由已经在首屏脚本中确定的
  `[data-theme='light']` / `[data-theme='dark']` selector 选图，不另建主题检测逻辑。
- 编辑页 SSR 同时输出 light/dark authoring fallback；client 端以 pre-paint 写入的
  `data-theme` 作为唯一 branch 依据。业务代码只调用 `useTheme()`，不得自行读取 cookie、
  `matchMedia` 或维护第二套首屏主题状态。
- Community 等子应用复用各自现有的同语义 pre-paint theme 流程，不能由 `StaticWallpaper`
  自行读取 cookie 或 `matchMedia`。
- 图片加载失败时保留稳定底色，不启动 GPU renderer 兜底。
- Wallpaper 编辑页的静态层同样先使用 pre-paint 已确定的主题图片；GPU 层 ready 之前不会因
  React theme hydration 更新而提前卸载静态层。`StaticWallpaper` 通过 CSS variables 和
  `[data-theme]` selector 完成 light/dark 选择。

## 8. Bundle 边界

完成迁移后应满足：

| 入口                  | Wallpaper runtime                                |
| --------------------- | ------------------------------------------------ |
| Dash Wallpaper Editor | WebGPU 实时预览 + 懒加载 WebGPU export           |
| Dash 其他路由         | `StaticWallpaper`                                |
| Community             | `StaticWallpaper`                                |
| Landing 产品营销演示  | Landing 自有静态图片，不接入 community Wallpaper |
| Apply / 其他子应用    | `StaticWallpaper`                                |

Landing 仍然存在共享 Shell Wallpaper 消费点，实际链路是：

```text
Landing Root
  -> StaticShellProvider
  -> StaticLayout
  -> GlobalLayout/Wallpaper
  -> StaticWallpaper
```

当前 `LANDING_INIT_DATA.wallpaper` 没有 `staticRevision/staticWallpaper`，因此迁移后
`StaticWallpaper` 得到 `null`，Landing Shell 原先的默认 live wallpaper（`amber_mauve` + pattern）
会变为空背景。这是已知的视觉回归/产品决策点，不是“没有消费点”。已确认的 Landing 动态
renderer 另外还有 `DesktopDevice` 和 `WallpaperCard` 两处营销演示；它们应继续使用 Landing
自有静态演示图，不接入 community Wallpaper。Landing Shell 则需要二选一：配置自有 light/dark
静态背景，或明确接受移除默认背景。

需要通过构建产物确认普通入口不包含 Wallpaper Editor runtime：

- `WallpaperRenderer`；
- `WallpaperExport` / `BgRenderer/vgpu`；
- WGSL shader；
- Wallpaper preview bus；
- Wallpaper Editor store 和控制面板代码。

如果某个入口因 CoverEditor/DocCovers 使用 `BgRenderer` 而包含通用 renderer，不应据此判定
Wallpaper 边界回归；仍需确认它没有引入 Wallpaper Editor 的 preview/export 依赖。不能只依赖
运行时条件隐藏 Wallpaper Canvas；必须从普通入口的 import graph 中切断这些依赖。

## 9. 实施顺序

1. 在 backend、GraphQL 和 frontend spec 中增加 light/dark 静态产物契约；同时为现有
   `TWallpaperPic` 对应的 backend schema、GraphQL input/output、frontend type、parser 与 store
   新增并贯通原图 `assetPublicRef`，使无效果 UPLOAD 可以安全复用原资产。
2. 将 Save 改为解析两个 theme branch 的产物计划，按需复用或导出上传，再执行一次最终发布
   mutation。
3. 仅在最终 mutation 成功后 accept submitted state、清除 touched 并刷新 snapshot。
4. 新增共享 `StaticWallpaper`，替换 `GlobalLayout` 和 `StaticLayout` 的动态 renderer。
5. 将 Landing 的 `DesktopDevice` 和 `WallpaperCard` 改为 Landing 自有静态演示资产，不接入
   community `StaticWallpaper`。
6. 在 Dash Shell 根据 Wallpaper route match 写入 `editor/static` runtime mode；由共享
   `GlobalLayout/Wallpaper` 内部切换，并对 Editor renderer 建立 lazy boundary。
7. [已完成] 为 Editor renderer 增加 `gpu-ready` / failure 生命周期；静态层在首帧后淡出，
   GPU 初始化失败或 context 丢失时保持可见并在恢复后重新接管。
8. [已完成] 将 `StaticWallpaper` 的 light/dark URL 改为 CSS variables + `[data-theme]`
   selector，消除 SSR light 图到 hydration dark 图的闪切。
9. [已完成] 让 wallpaper renderer 读取 pre-paint `data-theme`，并为 Global/Auth 编辑预览
   增加 light/dark 双分支静态 fallback；GPU 只在同主题首帧 ready 后接管。
10. 为 Landing Shell 配置自有 light/dark 静态背景，或记录并验收移除默认背景的产品决策；不能
    将当前共享 Shell 消费点描述为不存在。
11. 删除普通 Shell 和 Landing 对 preview bus、render spec 与 `BgRenderer` 的依赖。
12. 验证 light/dark 首屏、主题切换、发布失败保留旧 snapshot 和静态图片缓存。
13. 检查各应用 bundle，确认 GPU runtime 只存在于 Wallpaper Editor chunk。
14. 将 `publishWallpaperAssets` 的 NONE/复用/导出计划提取为可测试的纯函数，覆盖无 WebGPU、
    缺 `assetPublicRef` 和未 touch 复用等分支。
15. 明确 wallpaper store 的 `reconcileConfirmed` 生命周期：接入 Query→store 同步，或删除其
    生产 API、实现和测试，不能长期保留无调用方的第二套确认语义。

## 10. 验收标准

- Wallpaper Editor 调整参数时，所有编辑器内预览目标实时更新。
- Save 一次解析并发布完整 light/dark 静态结果，需要合成的 branch 才生成派生图片。
- 任一导出或上传失败时 touched 不清除，线上仍使用上一版图片。
- Dash 普通路由和所有子应用的背景渲染只请求/使用静态 Wallpaper 图片；查询层 static-only
  精简作为后续优化。
- 普通路由中不存在 Wallpaper Canvas、GPU device 初始化或 preview subscription。
- Community Snapshot 不向普通消费者暴露 authoring recipe。
- light/dark 主题切换不触发 GPU 渲染且没有明显背景闪烁。
- `NONE` 发布后对应静态引用为 `null`，普通页面只显示 Root page color。
- 无效果 `UPLOAD` 复用原始 asset ref，不产生重复编码资产。
- 无 WebGPU 时可以发布 `NONE`/可复用 `UPLOAD`，但不能发布需要派生渲染的 recipe。
- Landing 两处营销演示不再 import `WallpaperRenderer`。
- 只有 `/$community/appearance/wallpaper` route match 会切换到 `WallpaperRenderer`；其他路由
  使用 `StaticWallpaper`。
- Wallpaper Editor 的 SSR 首屏先显示 `StaticWallpaper`；Suspense chunk ready 不会提前卸载
  静态层，renderer 首帧 ready 后才淡入 GPU 并淡出静态层。
- 编辑页缺少已发布静态产物时，SSR 至少显示由当前 authoring recipe 生成的 CSS fallback，
  不出现空白背景；该 fallback 仅限编辑页，不改变普通路由的 static-only 边界。
- GPU 初始化失败或 context 丢失时静态层可以保持可见，恢复后 renderer 可以重新接管。
- 暗色用户的静态首屏由 pre-paint 已确定的 `data-theme` 直接选择 dark URL，不等待 React
  theme hydration。
- （待决策）Landing Shell 不再为空背景：要么提供 Landing 自有静态背景，要么明确验收移除默认
  live wallpaper 的视觉变化。
- （待补）`publishWallpaperAssets` 的产物计划分支测试，以及 wallpaper store
  `reconcileConfirmed` 的生产生命周期。
- 普通应用 bundle 不包含 `WallpaperRenderer`、Wallpaper shader/export 或 Editor runtime。

## 11. 非目标

- 不在 Cloudflare Worker、Phoenix 或 Node 服务中运行 Wallpaper WebGPU renderer。
- 不为普通子应用保留 WebGL 实时 fallback。
- 不让子应用根据 recipe 自行重建 Wallpaper。
- 不长期维护浏览器实时渲染与服务器静态渲染两套像素实现。
- 不把 CoverEditor 的运行时边界与全局 Wallpaper 静态消费重新耦合。
