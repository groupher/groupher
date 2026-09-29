# Wallpaper 实时预览架构

> 文档角色：Active contract
>
> 状态：PreviewFrame 第一轮已实现，Wallpaper Editor 的 Gradient/Texture/图片/全局效果 GPU 通路已接入；
> SSR→GPU 双层接管的 `gpu-ready`/failure 协议、Profile/DPR 构图一致性和 context 丢失恢复已实现，
> 跨浏览器矩阵待验收
>
> 日期：2026-09-06
>
> Current save contract：[当前 theme 单独保存重构](./current-theme-save-refactor.md)
>
> Active background contract：[Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md)
>
> Active：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [响应式静态产物、历史与共享导出机制](./responsive-revisions.md)
>
> 关联文档：[shaders_v1.md](./shaders-v1.md)

## 1. 背景

Wallpaper 编辑器中的 Angle、Brightness、Saturation、Blur、Texture、Pattern 等控件，
都需要在用户拖动或调整时实时反映到所有可见预览目标：

- Global Wallpaper：页面全局背景。
- AuthPreview：认证态页面预览。
- GlobalPreview：全局布局预览。
- 未来的 CoverEditor preview。

这里的“实时”不是保存后才生效，也不是只更新当前编辑器。所有预览目标都应该在同一轮
交互中看到最新值；Save 只负责把最终值写入持久化状态，Cancel 只负责恢复预览会话。

当前 WebGPU/vgpu 迁移已经证明 Flow/Liquid 的 shader 和浏览器端渲染方向可行，但 Angle
拖动仍然出现明显卡顿。这说明瓶颈不只是单个 shader，也不是单个控件，而是预览状态从
交互层到多个 renderer 的传播方式。

## 2. 最终方向与边界

所有进入 wallpaper 或 CoverEditor 导出图片的像素效果，最终都由 WebGPU/WGSL 或 WebGPU
compositor 负责。实时预览和静态导出使用同一套 shader、参数归一化、坐标方向和混合语义，
不维护一套 CSS preview 和一套 Canvas 2D export 的等价实现。

必须迁移到 WebGPU 的内容包括：

- linear/radial gradient、Flow、Liquid 和多中心/非规则渐变。
- Pattern、Noise、Dots、Beam、Tile、ASCII、Oil 等纹理。
- brightness、saturation、blur、mask、多层混合和其他导出 filter。
- CoverEditor 的图片采样、crop、transform、rounded mask、shadow、border、magnifier 和
  glass effects。

CSS/DOM 只负责不进入导出图片的编辑器 UI、布局、交互区域和面板装饰。WebGL1 只是迁移期间
的兼容路径，不升级 WebGL2；Canvas 2D 不再扩展为新的视觉效果 renderer。`<canvas>` 仍可
作为 WebGPU surface，`toBlob()` 仍可作为浏览器编码接口。

当前 v1 的静态导出明确在浏览器端完成：浏览器负责 WebGPU 渲染、readback、WebP 编码和
生成 Blob/File，Cloudflare Worker 只负责鉴权、上传意图、签名、校验、finalize 和 R2 保存。
不在 Node、普通 Worker 或 Container 中执行 vgpu/Dawn/shader，避免引入第二套后端 renderer
和部署 runtime。

## 3. 迁移前链路（历史基线）

当前高频预览大致经过以下路径：

```text
AngleWheel mousemove
  -> AngleWheel React state
  -> useLogic.changeAngle() 的 rAF
  -> useWallpaperPreview.scheduleWallpaperPreview()
  -> useWallpaperPreview 内部的第二个 rAF
  -> window CustomEvent
  -> 所有 WallpaperRenderer
  -> BgRenderer React state
  -> BgLayer.update()
  -> WebGL / WebGPU renderer
  -> GPU frame
```

关键实现位置：

- `frontend/core/ui/AngleWheel/index.tsx`：每次 mousemove 更新本地 angle state，并调用
  `onChange`。
- `frontend/core/unit/DsbThread/Appearance/Wallpaper/useLogic.ts`：再次通过 rAF 合并
  Angle 更新，并创建 gradient patch。
- `frontend/core/unit/DsbThread/Appearance/Wallpaper/useWallpaperPreview.ts`：合并完整
  wallpaper state，更新 CSS 变量，再派发全局预览事件。
- `frontend/core/lib/wallpaperPreview.ts`：通过 `window` 广播临时预览状态。
- `frontend/core/render/WallpaperRenderer/index.tsx`：每个 renderer 都订阅同一个全局事件，
  并把完整 state 重新适配为 `TBgRenderSpec`。
- `frontend/core/render/BgRenderer/index.tsx`：即使不需要 crossfade，也会通过
  `setActiveSpec()` 更新 React state。
- `frontend/core/render/BgRenderer/vgpu/renderer.ts`：每次 update 都重新设置 mesh 参数并
  提交 GPU frame。

第一轮架构已将高频路径收敛为：

```text
AngleWheel local state
  -> useLogic.changeAngle()
  -> useWallpaperPreview 一个 rAF
  -> 一次 adaptWallpaperBgRenderSpec()
  -> versioned preview frame bus
  -> 所有 WallpaperRenderer targets
  -> BgLayer.updatePreviewFrame()
  -> 当前 WebGL/WebGPU renderer scheduler
  -> GPU frame
```

当前实现要点：

- `angleDraft` 已移出共享 Wallpaper context，Angle 只在局部控件中维护显示值。
- 预览 frame 使用 `TBgPreviewFrame`，所有目标消费同一份 `TBgRenderSpec` 和 version。
- `BgRenderer` 的高频路径通过 imperative handle 更新，不调用 `setActiveSpec()`。
- 预览不再写全局 `<html>` CSS 变量，也不再使用 `window` 级别 CustomEvent。
- WebGL1 和 WebGPU renderer 都有 `updatePreviewFrame()`，并缓存尺寸/静态参数。

## 4. 卡顿根因

### 4.1 实时更新目标是合理的，但传播方式是全局和重复的

页面上存在多个 WallpaperRenderer 是产品需求，不是错误。问题在于每个目标都从一个全局
`CustomEvent` 开始，重复执行完整的状态适配、React 更新和 renderer update。

认证场景下典型的运行关系是：

```text
一个 Angle 值
  -> Global Wallpaper：全屏 WebGL
  -> AuthPreview：WebGPU
  -> GlobalPreview：WebGPU
```

因此一次输入可能同时触发一套全屏 WebGL 绘制、两套 WebGPU 绘制，以及三个 BgRenderer 的
React 更新。所有目标都需要实时更新，但不需要各自重复计算同一份业务状态。

### 4.2 存在多层 rAF，增加了输入到画面的延迟

目前至少存在以下调度层：

```text
AngleWheel / useLogic rAF
  -> useWallpaperPreview rAF
  -> renderer rAF
  -> GPU frame completion
```

多层 rAF 可以减少队列堆积，但会增加延迟。当 Liquid 的 GPU frame 尚未完成时，新的角度
只能等待下一次提交，体感上就会变成“拖动跟手性差”。

### 4.3 高频更新仍然驱动完整 React 和完整 render spec

每个 Angle tick 都会产生多次对象合并和适配：

- gradient 对象复制。
- wallpaper preview state 复制。
- nested patch 合并。
- `TBgRenderSpec` 适配。
- CSS fallback/background 字符串计算。
- `BgRenderer` 和 `BgLayer` React 更新。

Angle 本身的 24 个 SVG tick 不是主要瓶颈；真正的问题是它触发了完整预览状态链路。

### 4.4 `angleDraft` 通过共享 context 触发编辑器重渲染

`angleDraft` 当前属于 `useLogicValue` 的 React state。`applyAngleChange()` 每个 rAF tick
都会调用 `setAngleDraft()`，使 provider 重新生成 context value。所有调用 `useLogic()` 的
消费者都会重新执行 render，包括 `PreviewPanel`、`AuthPreview`、`GlobalPreview`、
`SavingBar`、`TuningPanel` 和 `Wallpaper` 根组件。

因此当前一次 Angle tick 同时有两条更新路径：

```text
setAngleDraft()
  -> shared context value changed
  -> editor / preview consumers render and reconcile

preview event
  -> BgRenderer.setActiveSpec()
  -> BgLayer.update()
  -> WebGL / WebGPU renderer
```

即使部分子组件最终通过 `memo` 跳过 DOM commit，context consumers 仍会重新执行 render，
React 仍需遍历和 reconcile 相关子树。这是主线程每帧开销的独立来源，不是 renderer 优化
可以自动消除的问题。

目标架构中，高频 Angle 值不应放在共享 editor context：

- AngleField/AngleWheel 可以保留本地显示 state。
- PreviewSession 通过 ref 和 scheduler 保存 transient frame。
- 共享 context 只暴露低频 committed state、操作和 Save/Cancel 生命周期。
- 如果其他控件必须显示当前角度，使用窄范围订阅，不让整个 Wallpaper editor 订阅 frame。

### 4.5 WebGPU latest-wins 只能限制积压，不能消除渲染成本

vgpu 当前会等待正在进行的 GPU frame 完成，并在之后提交最新值。这可以避免提交无限堆积，
但无法降低以下成本：

- 多个预览目标各自提交 frame。
- Liquid shader 本身的计算量。
- 每次提交前的参数创建、尺寸读取和 mesh 更新。

因此不能只继续优化 `scheduleRender()`，否则只能缓解局部症状。

### 4.6 CSS filter 是活跃渲染层成本，不是普通 fallback

迁移期间 WebGL legacy lane 的 `BgLayer` 把 `filter` 挂在包含 canvas 的整层上。此时
`blur()`、`brightness()` 和 `saturate()` 要求浏览器把整层作为滤镜合成表面处理，可能产生
offscreen surface、重新栅格化和额外合成成本。WebGPU active path 已将这三个效果放进共享
WGSL 像素 pass，因此不再依赖这层 CSS filter。

这里不能简单称为 GPU 到 CPU readback；是否发生真实 readback 需要浏览器 trace 证实。但它
明确属于活跃渲染路径，不是可以忽略的 CSS fallback。WebGPU 失败时不再切回这条路径。

当前每次预览还会重新写入 `<html>` 的 preview CSS variables。Angle 不改变 filter 时，仍不
应该重复写入相同 filter 值。

目标架构中：

- Angle frame 不触碰 CSS filter。
- Blur、Brightness、Saturation 变化时才更新对应 target 的 GPU 参数；只有 WebGL legacy lane 才更新
  整层 CSS filter。
- 优先将 brightness/saturation/blur 纳入 GPU pass；当前 Wallpaper vgpu shader 已完成这三个全局效果，
  Blur 使用共享 WGSL 九采样近似，后续只需通过真实设备 A/B 确认成本与视觉误差。
- CSS fallback 只用于兼容或加载状态，不作为正式导出像素实现。

### 4.7 每帧布局读取是可避免的同步依赖

WebGL 和 WebGPU renderer 都在 render loop 中调用 `getBoundingClientRect()`。如果之前存在
尚未处理的样式变更，这可能触发 forced style/layout；即使浏览器返回缓存结果，每个 target
每帧读取布局也会增加主线程工作。

尺寸应由 `ResizeObserver` 或显式 resize 生命周期更新缓存，render loop 只消费缓存的 CSS
尺寸和 backing size。是否实际触发 forced layout 需要在基线 trace 中单独确认，不能只凭函数
调用断言。

### 4.8 迁移期全屏 WebGL Flow 可能是最大的 GPU 单帧成本

迁移期 Global Wallpaper 仍可能使用全屏 WebGL Flow。Flow shader 的多 strand 和 noise
计算作用于整窗分辨率；即使 React 和事件链路完全优化，它仍可能与两个 WebGPU preview
以及活跃 CSS filter 合计超过 16.7ms。

本节记录迁移期的 WebGL 性能判断：当时的 `FLOW_DPR_CAP = 1` 只限制 DPR 上限，不代表已经降低
内部渲染分辨率。当前 Editor 的 Profile/DPR 规则以 §5.6 为准；如果真实 frame trace 仍超预算，
应显式引入与构图坐标系分离的质量档位，而不是重新改变 Profile logical size。可考虑：

- Global Wallpaper 使用独立的内部低分辨率 surface。
- 根据 GPU frame time 在 0.5x、0.75x、1x 之间选择质量档位。
- 允许 Global Wallpaper 与小尺寸 Editor preview 使用不同质量预算。

shared offscreen texture 仍可作为后续方案，但不应成为解决全屏成本的唯一候选。

### 4.9 preview 与 committed update 可能重复渲染

拖动期间 preview frame 会更新所有 target；停止约 300ms 后，debounced commit 又会通过 store、
`renderSpec` prop 和 `applySpec()` 重新驱动整条链路。同一个最终 Angle 可能因此被渲染两次。

目标架构需要让 committed update 携带最后一个 preview version，若最终视觉帧已经渲染过，
commit 只确认状态，不重复提交相同 GPU frame。

Pattern overlay 在 WebGPU 下已经不再重复绘制，但这只是必要的局部修复，不是完整解决方案。

### 4.10 导出按钮不是持续卡顿的原因

Export debug button 只在点击时执行，不订阅高频 preview state，因此不会解释 Angle 拖动时
持续出现的卡顿。页面中已有的 GraphQL 500 和图片加载警告也不在这条渲染调用链上。

## 5. 目标架构

### 5.1 PreviewSession：一次编辑对应一个实时预览会话

编辑器创建一个 `PreviewSession`，负责保存当前编辑中的临时值，并向所有可见预览目标
分发最新帧。

```text
Wallpaper Editor
  -> PreviewSession
       -> Global Wallpaper target
       -> AuthPreview target
       -> GlobalPreview target
       -> CoverEditor target（未来）
```

这里仍然是多目标实时更新；变化的是所有目标共享一个受控的预览会话，不再依赖全局
`window` 事件隐式广播。

### 5.2 PreviewFrame：高频路径使用轻量渲染参数

PreviewSession 每个显示帧只生成一份 `PreviewFrame`，不重新构造完整的持久化 wallpaper
state。

示意结构：

```ts
type TWallpaperPreviewFrame = {
  version: number
  gradient: {
    renderer: 'flow' | 'liquid' | 'linear' | 'radial'
    angle: number
    colors: readonly string[]
    softness: number
    warp: number
    scale: number
    contrast: number
    brightness: number
  } | null
  effect: {
    blurIntensity: number
    brightness: number
    saturation: number
  }
  pattern: {
    enabled: boolean
    id: string
    intensity: number
    tone: string
  }
  texture: {
    enabled: boolean
    type: string
    intensity: number
  }
}
```

实际类型可以根据现有 `TBgRenderSpec` 进一步收敛。重点不是字段名，而是：

- 高频参数只生成一次。
- 所有目标使用相同的 frame version。
- 不把 Dashboard store、React state 和业务 patch 直接传进 renderer。
- 目标可以根据自己的逻辑尺寸、backing-store DPR 和 backend 生成本地提交参数，但不得自行改变
  `TBgRenderSpec` 的构图语义。

### 5.3 PreviewScheduler：统一 latest-wins 和单 rAF

所有高频控件都通过同一个 scheduler：

```text
pointermove / keyboard / slider
  -> session.publish(patch)
  -> 合并 pending patch
  -> 一个 requestAnimationFrame
  -> 生成一个 PreviewFrame
  -> 分发给所有 targets
```

Scheduler 必须保证：

- 多个输入事件只保留最新值。
- 一个 PreviewSession 每个显示帧最多生成一次 frame。
- 不在 Angle、Blur、Texture 等控件内部各自维护一套 rAF。
- session 销毁、取消或切换页面时，旧 frame 不再提交。
- renderer 正在执行时只保留最新 frame，避免 GPU 队列增长。

### 5.4 PreviewTarget：每个目标独立渲染，但共享同一份输入

每个目标注册到 PreviewSession，并实现统一接口：

```ts
type TWallpaperPreviewTarget = {
  id: string
  updateFrame: (frame: TWallpaperPreviewFrame) => void
  updateCommitted: (spec: TBgRenderSpec) => void
  destroy: () => void
}
```

目标之间仍然可以有不同实现：

- Global Wallpaper 在迁移期可以由调用方明确选择全屏 WebGL legacy lane；启用 WebGPU 后失败
  必须进入可诊断失败态，不自动切回 WebGL。编辑页存在已发布图片时，全屏 WebGPU target 使用当前
  responsive Profile 的逻辑画布，而不是直接拿 viewport 重新构图。
- AuthPreview 和 GlobalPreview 这类卡片目标使用自身 DOM rect 作为逻辑画布，并按 DPR 分配 backing store。
- CoverEditor 将来可以使用自己的 compositor surface。

但它们不再重复执行业务 state merge 和完整 render spec adaptation。

### 5.5 Renderer 需要区分 committed update 和 preview frame

`BgRenderer` 应该区分低频状态变化和高频画面更新：

```ts
renderer.setCommittedSpec(spec)
renderer.updatePreviewFrame(frame)
```

`setCommittedSpec()` 可以驱动 React、crossfade、legacy lane 和资源生命周期；
`updatePreviewFrame()` 则直接进入当前 renderer 的调度器，不能每帧触发 `setActiveSpec()`。

对 Flow/Liquid，Angle 变化最终只需要更新 mesh 参数或 uniform；对 CSS legacy lane，则只更新
当前目标容器需要的 CSS 值，而不是每帧修改全局 HTML 状态。

WebGL1 legacy lane 也必须实现 `updatePreviewFrame(frame)` 的轻量路径。它应缓存颜色解析、
texture、uniform 映射和已准备的 spec，只突变 Angle、Flow 等变化字段；不能因为是 legacy lane
就每帧重新适配完整 spec、遍历颜色并执行全部 `parseColor`。

### 5.6 SSR 首屏与 GPU 接管（基础协议已实施）

当前已在 `BgRenderer` 暴露 renderer 首帧 ready/failure 信号，并由 GlobalLayout 保持静态层与
GPU 层同时挂载完成接管。若没有已发布 Wallpaper 图片，编辑页静态层会从当前 settings recipe
生成 CSS-only fallback；GPU context 丢失时会恢复静态层，context restored 后重新等待首帧
再接管；不同浏览器的事件/能力矩阵仍需验收。

Wallpaper 编辑页的 SSR 首屏和 client GPU 预览不是同一个像素阶段。SSR 同时输出 light/dark
两套 settings fallback，theme domain 内部只使用 pre-paint 脚本已经写入的
`document.documentElement[data-theme]` 解析当前 branch；该 DOM 值是 wallpaper 的唯一主题
真相源，业务组件统一通过 `useTheme()` 获取结果。SSR 不能执行
`BgLayer` 的 renderer effect，因此首屏只能显示已发布的 `StaticWallpaper`，或显示
`BgRenderer` 提供的 CSS fallback；client 才会创建 WebGL/WebGPU context 并提交真实 GPU frame。

`ThemeStoreProvider` 在浏览器创建 runtime store 时读取 pre-paint 已写入的 `data-theme`；每个
`useTheme()` 消费者的第一次 hydration snapshot 仍复用 SSR seed，完成自身 hydration 后再读取 runtime
store。业务代码不需要知道 first-paint 的实现细节。Global Wallpaper 和 Global/Auth 编辑预览都在对应
主题的 GPU 首帧 ready 前保留静态双分支；因此 pattern image、pattern tone 和 background 不会经历
light → dark 的中间渲染。

编辑页必须采用以下双层接管顺序：

```text
StaticWallpaper 可见
  -> WallpaperRenderer chunk loaded
  -> GPU context / pipeline ready
  -> 首个 GPU frame 成功提交（gpu-ready）
  -> GPU layer fade in
  -> StaticWallpaper fade out
```

Suspense 的解除只能作为 chunk loaded 信号，不能作为 `gpu-ready` 信号。静态层在 GPU 首帧
之前不得卸载；动画结束后可以保留为不可见 fallback，以便 renderer 初始化失败、WebGPU device
丢失或 WebGL context 丢失时恢复。普通路由不进入这条接管链路，继续只使用 `StaticWallpaper`。

首屏静态层来自已发布 Wallpaper 图片，GPU 层来自当前 settings recipe；Snapshot、主题选择
和 fallback 语义必须可诊断，不能把静态层与 GPU 层的视觉差异误判成 preview frame 传播错误。

这里存在三种不能混用的尺寸：

| 尺寸                     | 含义                                                     | 规则                                                                                                          |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Profile logical size     | Pattern repeat、Gradient 中心、图片 framing 的构图坐标系 | 有已发布 Wallpaper 时使用当前 `wide/desktop/tablet/phone` Profile；无已发布图片和卡片预览使用目标自身逻辑尺寸 |
| backing-store pixel size | GPU 实际栅格分辨率                                       | 逻辑尺寸乘 `min(devicePixelRatio, 2)`；不得反向改变 Pattern tile 或其他视觉参数                               |
| CSS presentation size    | canvas 在页面中的显示范围                                | 全屏 published handoff 与静态图片统一 `cover center`；卡片按自己的布局显示                                    |

SSR 通过 CSS cascade 选择静态 Profile，client 必须用同一选择规则解析 Profile；不能用 `innerWidth × innerHeight`
替代已发布 Profile 的逻辑画布。否则即使 React DOM 完全 hydration 成功，GPU 接管时也会出现 Pattern 密度、
Gradient 中心或裁切跳变。ready/failure 状态因此按 `theme + profile/viewport` 标识，Profile 改变后必须等待新画布
首帧，不能复用旧 Profile 的 ready 状态。active Profile 始终立即跟随 CSS；只有昂贵的 renderer Profile 替换
等待 `150ms` 稳定期。在等待期间 GPU 层隐藏、静态层可见，因此不会用迟滞后的旧 canvas 覆盖 CSS 已选择的
新 Profile。

#### 5.6.1 `150ms` settle 的职责与已知边界

`150ms` 不是 SSR、hydration、Pattern 或 GPU 绘制时长的一部分，也不是要求所有预览延迟显示。它只用于
debounce 连续 resize 中的昂贵 renderer Profile 替换：每次跨 `desktop/wide` 边界都会重新计时，只有 active
Profile 连续稳定 `150ms` 后才更换 `renderLogicalSize` 和 renderer key。active Profile、CSS 静态选图和旧 GPU
handoff 的失效仍立即发生。

当前实现还有两个明确的非正确性成本：

- hydration 首次 render 为了复用 SSR snapshot 固定从 `wide` 开始；desktop 用户进入 client runtime 后也会走
  一次 `150ms` settle，若旧 renderer 已开始初始化，可能出现先建 wide、再建 desktop 的额外工作。不能在
  hydration render 中用 `typeof window !== 'undefined'` 直接读取 viewport 初始化 state，否则会让服务端与首次
  client tree 再次不一致。后续应保持首次 hydration snapshot 不变，在 commit 后读取客户端 Profile，并让这次
  初始校正立即完成且只启动正确 Profile 的 renderer；只有后续用户 resize 才使用 settle。
- settle 等待期旧 renderer 保持 mounted 且不可见，最多持续到边界稳定；这是用少量短期隐藏成本换取避免重复
  init/prepare。只有性能数据证明该成本显著时，才增加 pending pause/suspend 能力，不能为了暂停而改变 active
  Profile 或静态接管正确性。

`150ms` 是可调的交互参数，不属于 Profile 数据协议。调整它需要复验快速跨界时的 renderer 创建次数、静态层
接管和最终首帧延迟。

## 6. 状态生命周期

```text
开始编辑
  -> 创建 PreviewSession(snapshot)
  -> 控件产生 transient patch
  -> PreviewSession 生成 frame
  -> 所有 PreviewTarget 实时更新

Save
  -> flush 最后一帧
  -> 合并 transient patch 到 draft/store
  -> 更新 committed spec
  -> 结束 session

Cancel
  -> 停止 scheduler
  -> 所有 target 恢复 snapshot
  -> 清理 transient preview
  -> 结束 session
```

持久化状态不应在拖动过程中被逐帧写入。实时预览和 Save/Cancel 是两个不同的生命周期。

## 7. 关于多目标和 GPU 成本

“统一驱动”不等于“所有目标只渲染一次”。如果 Global Wallpaper、AuthPreview 和
GlobalPreview 的 canvas 尺寸不同，它们可能仍然需要各自提交 GPU frame。

第一阶段要消除的是重复的 CPU、React 和状态传播成本：

```text
当前：N 次完整 state/spec/React 链路 + N 次渲染
目标：1 次 frame 计算 + N 次轻量 renderer update
```

如果完成这一步后 GPU 仍然超出预算，再引入可选的 shared render cache：

```text
一次生成共享 offscreen texture
  -> 多个目标 surface 采样/合成
```

这应当由真实 GPU frame time 决定，而不是在预览 session 重构阶段提前引入复杂度。

## 8. 迁移步骤

### Phase 1：建立轻量预览会话边界（第一轮核心已实现）

- 以 module-level frame bus、version 和单个 rAF scheduler 实现 `PreviewFrame` 的最小会话边界；
  暂不引入独立的 `PreviewSession` / `PreviewScheduler` 类，避免为当前问题增加过度抽象。
- 让 Global Wallpaper、AuthPreview、GlobalPreview 显式注册为 targets。
- 暂时保留现有 renderer，实现新旧路径可对照。
- 在迁移前建立固定 recipe、固定 viewport 和固定拖动轨迹的性能基线，记录 CPU frame time、
  GPU frame time、input-to-present latency、CSS recalculation、layout、paint、composite
  和 dropped frame。

退出条件：所有目标都能收到同一 frame version，Save/Cancel 行为不变；性能 trace 可比较，
并且能定位成本属于输入、React、CSS、WebGL 还是 WebGPU。

2026-09-01 的当前 Chrome 页面检查已确认 Dash Editor 可进入，但该运行实例的
`navigator.gpu` 为 `false`，只能记录 WebGL 页面基线，不能据此得出 WebGPU 性能结论。完整
GPU frame time、CSS recalculation、layout、paint、composite 和 dropped frame 需要在启用
WebGPU 的 Chrome DevTools Performance trace 中采集。

### Phase 2：迁移 Angle 高频路径（第一轮核心已实现）

- AngleWheel 保留本地控件显示，但不再通过完整 wallpaper state 驱动预览。
- 删除 Angle 专用的重复 rAF。
- Angle 通过 PreviewSession 发布轻量 patch。
- Flow/Liquid renderer 直接消费 preview frame。

退出条件：Flow、Liquid 下所有预览目标同步更新；拖动期间不触发完整 BgRenderer React
state 更新。

### Phase 3：统一其他高频控件

- Brightness、Saturation、Blur、Texture、Pattern intensity 等全部走同一 scheduler。
- 控件只负责产生语义化 patch，不再各自决定调度策略。
- 对 CSS-only 和 GPU-only 效果分别定义目标更新方式。

当前进度：Brightness、Saturation、Blur、Texture intensity、Pattern 和图片采样已通过同一 PreviewFrame
scheduler 进入 vgpu 参数，并在支持的 gradient/Flow/Liquid/texture/image shader 中执行。WebGPU
预览和浏览器端导出使用同一份最终像素逻辑；WebGL/CSS 只保留为明确 legacy lane。

### Phase 4：删除旧广播链路（Wallpaper 路径已实现）

- 删除 `window` 级别的 wallpaper preview CustomEvent。
- 删除每帧完整 state 到 `TBgRenderSpec` 的重复适配。
- 保留持久化 store、committed spec 和 export 使用的权威协议。

### Phase 5：根据数据决定 GPU 共享

- 记录各目标的 GPU frame time、提交延迟和 dropped frame。
- 如果全屏 target 仍超出预算，先评估内部低分辨率和自适应质量；只有在 GPU 成本仍是主要
  瓶颈时，再评估 shared offscreen texture 或共享 compositor。

## 9. Shader 与 Preview 阶段映射

`shaders_v1.md` 的 Phase 0–4 下文简称 Shader S0–S4；它与本文 Preview P1–P5 是两条独立
轨道。它们不能只依赖相同的数字表示阶段，必须通过能力依赖对齐：

| Preview 阶段               | Shader 能力依赖（不代表阶段完成）                                                           | 依赖内容                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Preview P1：PreviewSession | Shader S1：统一 Wallpaper renderer                                                          | renderer contract、target 生命周期和 committed spec                                               |
| Preview P2：Angle 高频路径 | Shader S1：统一 Wallpaper renderer                                                          | Flow/Liquid mesh 参数和轻量 preview frame                                                         |
| Preview P3：其他高频控件   | Shader S1：Wallpaper GPU effect pass（Wallpaper slice 已实现）；Shader S3：Cover compositor | brightness、saturation、blur、texture、pattern 已进入 S1 Wallpaper slice；Cover 专属效果仍依赖 S3 |
| Preview P4：删除旧广播链路 | Shader S1 + Preview P1–P3                                                                   | 所有目标均能消费 PreviewFrame，legacy 仅作为兼容路径                                              |
| Preview P5：GPU 共享优化   | Shader S1–S3 + 性能基线                                                                     | 根据真实 GPU frame time 决定 shared texture/compositor                                            |

Preview P3 在对应 GPU effect pass 尚未具备时不能宣称完成；不能用 CSS 临时实现替代正式
WebGPU 像素路径，因为这些效果最终必须参与静态导出并保持 preview/export 一致。

## 10. 验收标准

### 功能

- Angle、Brightness、Saturation、Blur、Texture、Pattern 在拖动时实时更新所有可见目标。
- Global Wallpaper、AuthPreview、GlobalPreview 使用同一 preview version。
- Save 提交最终值，Cancel 恢复编辑前状态。
- WebGL legacy lane 和 WebGPU renderer 在同一 recipe 下的实时行为一致；WebGPU 失败时不自动
  切换到 legacy lane。

### 性能

- 同一 PreviewSession 每个显示帧最多生成一次 `PreviewFrame`。
- 每个 target 每个显示帧最多提交一次 renderer update。
- Angle 拖动期间不更新共享 editor context 中的 `angleDraft`；editor context consumers 不因
  高频 frame 逐帧 render。
- Angle 拖动期间不触发完整 Wallpaper React subtree 更新。
- 不存在 Angle rAF、preview rAF、renderer rAF 的无界叠加。
- 不再通过全局 `<html>` CSS 变量驱动所有预览目标的高频变化。
- 必须分别记录 CPU frame time、GPU frame time、输入到显示延迟和 dropped frame，不能只看
  caniuse 或单次主观体验。

### 架构

- 实时预览目标是显式注册的，不依赖隐式全局事件。
- PreviewSession 是高频状态的唯一调度入口。
- `TBgRenderSpec` 继续作为 committed/export 的权威协议；PreviewFrame 只作为高频渲染层
  的轻量输入。
- preview 和 export 继续共享 shader、参数归一化和颜色语义。
- 所有进入导出图片的像素效果最终由 WebGPU/WGSL 或 WebGPU compositor 实现；CSS/DOM 只
  负责不进入导出图片的 UI 和布局。
- v1 导出在浏览器端完成；Node、普通 Cloudflare Worker 和 Container 不执行 shader，后端
  只负责上传控制、资产校验和 R2 保存。

## 11. 方向结论（待完整效果与浏览器矩阵验收）

所有预览目标实时更新是产品要求，不能通过“只更新当前 Editor”来解决卡顿。系统性方案
应该保留多目标实时渲染，同时把它们收敛到一个 PreviewSession：

```text
一次输入
  -> 一次 frame 计算
  -> 多个目标轻量更新
```

这样后续迁移更多 shader 或 CoverEditor 时，不需要再次为每个控件添加独立节流、独立事件
和独立 legacy 补丁。只有在统一预览链路完成并取得真实性能数据后，才决定是否进一步做
共享 GPU texture 或 compositor 优化。
