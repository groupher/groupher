# Wallpaper Shaders v1

> 状态：Wallpaper Editor 的 Gradient/Flow/Liquid/Texture/图片/Blur GPU preview/export slice 已接入；浏览器矩阵与全量迁移验收中
>
> 日期：2026-09-06
>
> 目标：以 `vgpu + WebGPU + WGSL` 统一 wallpaper / cover editor 的 shader
> 预览与静态图片导出。v1 优先采用浏览器端生成，Cloudflare 只承担上传控制和资产保存，
> 不引入 Worker 端 Dawn 或容器渲染。

## 方向结论（核心链路已验证，正式替换待完整验收）

这个方向值得迁移，最终目标不是长期维护多套等价效果，而是使用 WebGPU/WGSL 替代现有
wallpaper 和 CoverEditor 的像素效果实现。vgpu 是 WebGPU 的渲染基础设施，不是另一套业务
状态或 fallback 抽象。

v1 的目标是：

- 保留 `TBgConfig -> composeBgRenderSpec() -> TBgRenderSpec` 作为权威背景协议。
- 使用一套 WGSL shader 同时服务编辑器实时预览和浏览器端静态导出。
- 所有进入 wallpaper/CoverEditor 导出图片的像素效果都以 WebGPU 为最终实现；预览和导出
  使用同一套 shader、参数归一化和混合语义。
- 支持 WebGPU 的浏览器直接完成渲染、图片编码和上传。
- 最终 wallpaper 文件默认使用 WebP，并把 `800 KB` 作为输出体积上限，而不是 GPU
  渲染期间的内存上限。
- Cloudflare Worker / Assets Hub 只负责鉴权、上传意图、签名、完成确认和元数据；R2
  保存最终静态图片。
- Dashboard 之外的运行时继续消费纯图片资产，不把 editor recipe 或 shader runtime
  带入普通页面。

迁移期不能承诺：

- 接入 vgpu 后立即删除 WebGL1 和现有 Canvas 2D visual renderer；它们只作为过渡路径。
- 所有浏览器都能使用高级 shader editor。
- 不同 GPU、浏览器和驱动在不同尺寸下天然逐像素完全一致；相同 renderer、参数和尺寸应
  通过视觉基准测试保证一致。
- vgpu 一定比当前单 pass WebGL 更快。
- 在普通 Cloudflare Worker 内运行 `vgpu/node + Dawn + sharp`。

### 最终渲染边界

以下内容属于导出图片的像素效果，最终都应由 WebGPU/WGSL 或 WebGPU compositor 负责：

- linear/radial gradient、Flow、Liquid 和多中心/非规则渐变。
- Pattern、Noise、Dots、Beam、Tile、ASCII、Oil 等纹理效果。
- Brightness、Saturation、Blur、mask、多层混合和其他 filter。
- 图片采样、crop、translate、scale、rotate、rounded corners、shadow、border、magnifier
  和 glass effects。

CSS/DOM 只保留不进入导出像素的内容，例如编辑器控件、布局、交互区域和面板装饰。即使
linear/radial gradient 可以由 CSS 完成，也不把 CSS 作为正式 wallpaper preview/export
实现，避免预览与导出出现差异。

WebGL1 是迁移期间的临时兼容 renderer，不升级 WebGL2；Canvas 2D 不再扩展为新的效果
renderer。`<canvas>` 仍可以作为 WebGPU surface，`toBlob()` 仍可以作为浏览器编码接口，
这两者不等于使用 Canvas 2D 绘制视觉效果。

## 当前状态与下一步

当前已经可以把 Flow/Liquid 定义为“首批 POC 与 Editor 实时预览链路已验证”，但还不能把它
等同于所有浏览器和所有导出场景均已生产就绪：

| 能力                                                                  | 状态       | 说明                                                                                                           |
| --------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------- |
| Linear/Radial/Flow/Liquid + Pattern + Texture + 图片 + Blur WGSL 迁移 | 已接入     | 同一份 shader 已用于 Editor 预览和浏览器端导出；Blur 使用共享 WGSL 后处理采样                                  |
| Chromium Editor 预览                                                  | 本地已验证 | WebGPU 首帧接管、Profile/DPR backing store 与 resize 跨 Profile 已通过本地 smoke；跨浏览器仍待验收             |
| WebGL legacy lane                                                     | 已验证     | 仅在调用方明确未启用 `preferVgpu` 时保留旧路径                                                                 |
| POC readback/WebP                                                     | 已验证     | 固定尺寸、top-origin、尺寸和 WebP Blob 已断言                                                                  |
| 正式 Wallpaper 导出                                                   | 部分完成   | 已有带超时的懒加载 API、调试按钮和 Gradient/Flow/Liquid/Texture/图片/Blur 下载；真实上传与正式产品入口仍待接入 |
| Safari                                                                | 待验收     | 包括 surface、异步 readback、编码和 device loss                                                                |
| 移动端                                                                | 待验收     | 至少覆盖一个真实 WebGPU 设备                                                                                   |
| WebGL/WebGPU A/B                                                      | 待验收     | 需要同一 recipe、尺寸和设备的视觉/性能数据                                                                     |
| 完整 Wallpaper renderer                                               | 部分完成   | Linear/Radial/Flow/Liquid、六种程序化 texture、图片、Pattern 和 Blur 使用 vgpu；跨浏览器和 A/B 仍待验收        |
| CoverEditor compositor                                                | 未开始     | 需要图片图层、transform、mask 和特效合成                                                                       |

后续执行顺序按依赖和风险安排为：

```text
Phase 0 剩余矩阵
  → Phase 2 Wallpaper 正式浏览器导出
  → Phase 1 完整 Wallpaper renderer
  → Phase 3 CoverEditor GPU compositor
  → Phase 4 收敛 WebGL / Canvas 2D
```

Phase 1 的首批 Editor 接入已经完成，因此 Phase 0 收口、正式导出和 Phase 1 扩展可以并行准备；
这里把正式导出提前作为下一条纵向链路，是因为它直接验证 preview/export 共用 shader 的核心架构
假设。只有导出和兼容性矩阵稳定后，才扩大普通社区页面的 WebGPU 使用范围。

迁移路径明确为 `WebGL 1 -> WebGPU`。不把现有 renderer 升级到 WebGL 2，也不新增一套
WebGL 2 shader；迁移期只保留现有 WebGL 1 作为明确 legacy lane，避免同时维护 WebGL 1、WebGL 2
和 WebGPU 三种实现。

## Shader 在这里解决什么问题

Shader 是运行在 GPU 上的小型渲染程序。Wallpaper 场景主要使用 fragment shader：它为
画布上的每个像素计算最终颜色，因此适合：

- 非规则、多中心、多图形渐变。
- 类似熔岩灯的流动、液态、扭曲效果。
- noise、dots、beam、oil、tile、ASCII 等程序化纹理。
- 图片采样、混合、遮罩、滤镜和多 pass 后处理。
- 动态效果，以及从动态效果中选定一个时间点导出静态帧。

线性渐变和径向渐变本身可以由 CSS 完成。把它们纳入 GPU 的价值不在于“CSS 做不到”，
而在于它们可以与 mesh、liquid、texture、image 和 filter 共享同一参数协议、混合顺序和
导出路径。若只保留 CSS 预览、另写 GPU/Canvas 导出，仍会继续维护两套视觉实现。

## 当前架构基线

当前权威背景链路是：

```text
TBgConfig
  -> composeBgRenderSpec()
  -> TBgRenderSpec
  -> BgRenderer / BgLayer
  -> dual-canvas renderer adapter
       ├── CSS base layer（legacy/load only）
       ├── WebGL1 canvas（legacy caller only）
       ├── WebGPU canvas（eligible gradient slice）
       └── Pattern DOM overlay（仅 legacy caller）
```

`BgLayer` 同时挂载 WebGL1 和 WebGPU canvas，但由 adapter 保证同一时间只有一个 active
renderer。Editor 的 `preferVgpu` 路径把 WebGPU 视为必需能力：初始化、pipeline 或 device
运行失败时进入可诊断的 `failed` 状态，不自动切回 WebGL1。WebGL1 和 Pattern DOM overlay
只为尚未启用 `preferVgpu` 的明确 legacy caller 保留，WebGPU shader 自己负责 Pattern 合成。

其中：

- `frontend/core/lib/bg/compose.ts` 负责把业务配置转换为 renderer-ready spec。
- `frontend/core/render/BgRenderer/BgLayer.tsx` 管理 CSS fallback、WebGL canvas、pattern
  overlay、resize 和 context 生命周期。
- `frontend/core/render/BgRenderer/webgl.ts` 使用 WebGL 1、一个全屏 quad、一个 program
  和一组 uniforms 渲染 gradient、mesh、图片和 texture。
- 当前 WebGL 渲染按配置变化、图片加载和 resize 调度，不是持续动画循环。

当前静态导出则走另一条链路：

```text
CoverEditor config
  -> adaptCoverBgRenderSpec()
  -> Canvas 2D 重绘 background
  -> Canvas 2D texture / pattern / filter
  -> Canvas 2D image layers
  -> canvas.toBlob()
```

`frontend/core/unit/CoverEditor/exportFinalImage.ts` 会重新实现背景和图片图层的合成；
`frontend/core/lib/wallpaperMesh/texture/` 维护 noise、tile、beam、ASCII、dots、oil 的
Canvas 2D 版本。

### 当前架构的主要缺点

- 预览与导出不是同一个 renderer，容易出现颜色、纹理、DPR、filter 和边界行为漂移。
- 每新增一个 shader 效果，通常还要补 Canvas 2D 导出实现。
- WebGL shader、Canvas helper、CSS base layer 分别维护相似语义，测试矩阵持续扩大。
- 当前 GLSL shader、uniform 查找、program 生命周期和资源管理均为项目手写。
- CoverEditor 导出与 background runtime 共享 `TBgRenderSpec`，但没有共享最终像素实现。
- 将来增加动态 shader、多 pass 或复杂组合时，Canvas 2D fallback 会越来越难保持一致。

## 为什么选择 vgpu

截至 2026-08-29，vgpu 最新稳定版本为 `v0.3.1`。它仍是早期 `0.x` 项目，因此应锁定
版本并先做 POC，但其架构方向与 Groupher 需求高度吻合：

- 浏览器、headless Node 和测试 mock 共享同一套 API。
- WGSL 可以作为独立模块导入，并提供 typed binding / reflection。
- `effect()` 适合 wallpaper 这种全屏 fragment effect。
- frame、pass、surface、target 都是显式资源，不依赖隐藏 scene state。
- 支持离屏 target 和像素 readback，适合静态导出与视觉测试。
- `@vgpu/wgsl-std` 提供 noise、hash、sampling 等通用 shader 基础能力。
- tree-shaking 和较小的 effect runtime 适合按路由加载 editor 能力。

版本锁定不是形式要求。vgpu `0.2.0` 已移除旧的 `gpu.*` facade，`0.3.0` 又改为所有发布包
lockstep versioning，说明 pre-1.0 阶段仍可能出现明显的 API 和发布模型调整。POC 应锁定精确
版本；升级时先阅读 public package CHANGELOG 与 GitHub Releases，并单独验证构建、shader、
readback 和 visual baseline，不能依赖宽松 semver 自动升级。

仓库根 `CHANGELOG.md` 目前只记录到 `0.1.6`，不能作为 `0.2+` 的升级依据。当前 public
`vgpu` package 的 changelog 位于 `packages/vgpu-api/CHANGELOG.md`；`packages/vgpu/` 对应
`@vgpu/cli`，也不是 public rendering API 的变更记录。根 CHANGELOG 只用于查阅 0.1.x
历史行为，例如 top-origin UV 和异步错误模型。

vgpu 带来的主要收益是“统一和约束”，不是凭空增加 GPU 能力。WebGPU 本身已经能完成这些
效果，vgpu 主要减少 WGSL binding、资源生命周期、跨 runtime 和测试基础设施的维护成本。

### vgpu 不能自动解决的问题

- 现有 GLSL 必须迁移为 WGSL，不能直接复制使用。
- 业务参数仍需由 Groupher 的 `TBgRenderSpec` 定义和归一化。
- 图片 CORS、解码、颜色空间和 export codec 仍由项目处理。
- vgpu 负责产生像素，不负责决定 wallpaper 的输出尺寸、格式、质量和 800 KB 限制。
- CoverEditor 的 crop、rotate、rounded corners、shadow、magnifier、border highlight 等仍需
  迁入 GPU compositor；不再扩展 Canvas 2D 等价视觉实现。
- `0.x` API 可能继续变化，需要版本锁定、升级记录和 POC 退出条件。

## 目标架构

### 单一渲染协议，两种输出目标

```text
TBgConfig / CoverEditor config
              |
              v
     composeBgRenderSpec()
              |
              v
        TBgRenderSpec
              |
      +-------+--------+
      |                |
      v                v
browser surface   offscreen target
实时预览           静态导出
      |                |
      |                v
      |          read RGBA pixels
      |                |
      |                v
      |          WebP/PNG encoder
      |                |
      +----------------+
                       v
                     Blob
                       |
                       v
          upload intent / signed upload
                       |
                       v
                      R2
```

核心边界：

- `TBgRenderSpec` 继续是业务层和 GPU renderer 之间的稳定协议。
- WGSL shader 不读取 Dashboard store，不理解 ThemePreset，也不拼接业务 URL。
- preview 和 export 使用同一 shader module、同一 uniform 映射、同一混合顺序。
- 卡片 preview 与无已发布产物的全屏 preview 使用目标 DOM 逻辑尺寸；有已发布产物的全屏 Editor preview
  使用 active Wallpaper Profile 逻辑尺寸。两者的 backing store 都可按受控 DPR 提高清晰度。
- export 使用固定 width、height、seed、time 和 color format 的 offscreen target。
- 输出编码和上传是 shader renderer 之后的独立步骤。

建议的新边界名称：

```text
createBgGpuRenderer()
renderBgSpecToTarget()
renderBgSpecToPixels()
encodeWallpaperImage()
exportWallpaperAsset()
```

具体命名在实现阶段按现有目录与封装习惯确认；本文件只确定职责，不要求现在创建这些 API。

## 浏览器端静态图片生成

浏览器端生成是 v1 的主路径。支持 WebGPU 的浏览器可以：

1. 获取 adapter / device。
2. 以固定尺寸创建离屏 target。
3. 使用和预览相同的 shader 渲染一帧。
4. 将 GPU texture 异步复制到可映射 buffer，并读取 RGBA 像素。
5. 编码为 WebP、PNG 或 JPEG Blob。
6. 检查尺寸、MIME、checksum 和最终文件大小。
7. 通过既有 Assets Hub 安全上传链路写入 R2。

### 800 KB 的含义

`800 KB` 是最终压缩图片的产品约束，不是 GPU 中间缓冲区约束。

例如 2048 × 2048 的 `rgba8` 帧，readback 时约有 16 MiB 临时像素数据；最终编码后的
WebP 仍可能低于 800 KB。临时数据在编码和上传完成后应立即释放，不会进入 R2，也不会成为
wallpaper 下载体积。

推荐输出策略：

- Wallpaper 默认输出 WebP；只有确实需要无损或透明语义时使用 PNG。
- 使用固定的最大导出尺寸，不允许按设备 DPR 无上限放大。
- 先按目标质量编码，再检查 Blob 字节数。
- 超过 800 KB 时逐级降低质量；仍超限时再降低分辨率。
- 最终文件超过上限时不进入上传完成态，避免把体积约束交给 R2 之后处理。
- recipe 中保留固定 `seed`；动态 shader 导出必须显式传入 `time` 或 frame，而不是读取当前
  wall clock。

图片编码不属于 vgpu，但 v1 明确在浏览器端完成编码。当前可以对 WebGPU canvas 调用
`toBlob()` 生成 WebP；它不创建 Canvas 2D context，也不重新实现 shader。若后续需要删除
`toBlob()`，替换的仍应是经过体积、速度和 Safari 验证的浏览器端编码器，而不是把导出迁移
到 Node 或 Worker。

### 坐标方向契约

Preview、texture sampling、offscreen target、readback 和最终编码图片统一使用 top-origin：
`(0, 0)` 在左上角，Y 轴向下。

vgpu 从 `0.1.4` 起将 `effect()` UV 定义为 top-origin，并与 `target.read()` 对齐。Groupher
当前 WebGL vertex shader 也已通过
`vUv.y = (1.0 - aPosition.y) * 0.5` 主动生成 top-origin UV，因此迁移时不应默认再做一次
`1.0 - uv.y`。是否需要转换必须由实际输入纹理与输出测试决定，不能根据 WebGL/WebGPU API
名称推断。

POC 使用四角颜色不同、带方向标记的非对称测试图，逐项验证：

- WebGL legacy preview 与 WebGPU preview 方向一致。
- HTML image 上传到 GPU texture 后方向正确。
- offscreen target 的像素方向正确。
- `target.read()` 返回的行顺序与 top-origin 契约一致。
- 最终 WebP 与 preview 不发生额外 Y flip。

### 异步 readback

WebGPU 没有 WebGL 的同步 `readPixels()` API。v1 的底层验收路径应是：

```text
render target texture
  -> copyTextureToBuffer
  -> submit command buffer
  -> GPUBuffer.mapAsync(GPUMapMode.READ)
  -> copy mapped bytes
  -> unmap / release buffer
  -> remove aligned row padding
  -> return contiguous texel bytes
```

vgpu `0.2.0` 的 `target.read()` 返回 `Promise<Uint8Array>`。API 边界拿到的是 target 自身
format 的连续裸 texel bytes，已经移除 WebGPU 底层 `bytesPerRow` 对齐产生的行 padding；长度为
`width * height * bytesPerPixel`，行序遵守 top-origin。对于 v1 固定使用的 `rgba8unorm`，应满足：

```text
pixels.byteLength === width * height * 4
```

POC 应直接在 Safari 验证这条异步路径，包括返回长度、无 padding、top-origin、map 失败、
device loss、资源释放和连续多次导出的行为。Groupher 不自行逐行去 padding，而是验证 vgpu
已经正确完成这一步；若断言失败则视为 renderer/readback 不可用。`target.read()` 不能退回
WebGL `readPixels()`，也不能把 `copyBufferToBuffer` 误当作从 texture 取像素的第一步。

### 错误收集契约

vgpu 的 GPU 错误不能只靠 `try/catch` 判断。`Draw.draw()` 从 `0.1.0` 起返回 `void`；异步
validation 或提交错误通过 GPU error sink 报告。Preview、POC 和 export 应同时覆盖三条通道：

- `try/catch`：捕获 `init()`、参数校验、资源创建、编码和其他同步错误。
- Promise rejection：捕获 `target.read()`、底层 `mapAsync()`、图片 decode、encode 和
  upload 的异步失败。
- `gpu.onError(callback)`：在首次 render 前注册，收集异步 GPU validation、pipeline、
  readback 和 driver 错误。

测试、一次性 export 和 teardown 在相关 work 启动后调用 `await gpu.settled()`，等待此前已提交
的 GPU work 和错误投递完成，再检查已收集错误。不能依赖 `settled()` 自身 reject，也不能用
`try/catch` 包住一个返回 `void` 的 draw 调用后就宣告成功。持续 preview 不需要每帧等待
`settled()`；它只在 POC 断言、导出完成边界和资源销毁前使用。

### Cloudflare 边界

v1 的导出在支持 WebGPU 的浏览器端完成，不在 Node、普通 Cloudflare Worker 或 Container
内执行 shader。v1 不在普通 Cloudflare Worker 内运行 `vgpu/node + Dawn + sharp`：

- Workers 的 Node compatibility 只提供 Node API 子集，不等同完整 Node runtime。
- Dawn 依赖原生 GPU/runtime 能力，不适合当作普通 Worker npm 包使用。
- Cloudflare Container 可以承载完整 runtime，但对当前 wallpaper 生成链路过重，会引入镜像、
  冷启动、资源和运维成本。
- 浏览器已经具备用户设备 GPU，没有必要为 v1 再复制一套后端渲染基础设施。

浏览器端导出链路为：

```text
canonical wallpaper/Cover config
  -> WebGPU/WGSL offscreen target
  -> browser-side WebP encoding
  -> Blob/File
  -> signed upload URL
  -> R2
```

浏览器端负责渲染、readback、编码和导出状态；Cloudflare 只负责上传控制和资产保存。Node
端渲染、Worker 端 Dawn/sharp 和 Container 渲染都不属于 v1，避免在现阶段引入第二套后端
renderer、GPU runtime 和部署依赖。

Cloudflare 侧保留：

- 创建 upload intent。
- 鉴权、quota 和 checksum 约束。
- 提供受限上传地址或接收上传流。
- 写入 R2。
- finalize 资产记录，返回 `assetPublicRef + variant`。
- runtime 通过纯图片 URL 消费资产。

浏览器不能持有通用 R2 密钥，也不能自行决定任意 object key、community ownership 或
finalize 状态。

## WebGPU 支持与显式失败

Can I Use 在 2026-08-29 显示 WebGPU 全球使用覆盖约为：

```text
83.99% fully supported + 1.57% partial support = 85.56%
```

这个数字表示浏览器版本对应的全球使用占比，不表示 85.56% 的访问一定能成功渲染。实际还会
受到操作系统、GPU、驱动、企业策略、adapter 获取失败和 device loss 影响。

因此功能检测必须以运行时结果为准：

```text
navigator.gpu exists
  -> requestAdapter succeeds
  -> requestDevice succeeds
  -> minimal shader compiles and renders
  -> enable WebGPU editor/export
```

v1 运行策略：

- 已保存的 wallpaper 在普通页面上是纯图片，不依赖访问者的 WebGPU 支持。
- Editor 中 `preferVgpu=true` 时，WebGPU 是必需 renderer；WebGPU 不可用、runtime chunk
  加载失败、shader 编译失败、render rejection 或 device loss 都必须进入 `failed` 状态并暴露
  stage/error，不自动切回 WebGL1。
- `preferVgpu=false` 的调用方仍可明确选择现有 WebGL1 legacy lane；这不是 WebGPU 失败后的
  fallback，而是尚未迁移调用方的显式路径。
- 如果某个新效果只有 WGSL 实现，浏览器应明确提示该效果不可编辑或不可导出，不能静默输出
  错误图片。导出不自动转移到 Node/Worker。
- 收集 adapter 初始化、shader 编译、device loss、readback、encode 和 upload 分阶段错误，
  并区分同步异常、Promise rejection 与 `gpu.onError`，再决定何时移除 legacy renderer。

不应只用 `navigator.gpu` 判断能力，也不应把 Can I Use 的覆盖率直接当作产品成功率。

## Canvas 2D 的退出边界

WebGPU 迁移顺利后，Wallpaper 和 CoverEditor 的导出像素生成不再依赖 Canvas 2D，但页面上仍会存在
`<canvas>` 元素作为 WebGPU surface；“不用 Canvas 2D”和“不用 canvas”不是一回事。

Canvas 2D 可以分阶段退出：

1. Shader 背景预览改用 vgpu/WGSL。
2. Shader 背景静态导出改用同一 WGSL + offscreen target。
3. 编码阶段暂时保留浏览器 `canvas.toBlob()`，不再用 Canvas 2D 重绘视觉效果。
4. CoverEditor 的图片 crop、rotate、rounded corners、shadow、mask 等迁入 GPU compositor。
5. 如确有必要，接入独立的浏览器端图片编码器后，删除 `toBlob()` bridge；不引入 Node/Worker
   renderer。

如果只完成前两步，Wallpaper shader 已经统一，但 CoverEditor 完整图片仍可能经过 Canvas 2D
合成；此时只能说明 Wallpaper 已完成 WebGPU 像素迁移，不能宣称项目已完全移除 Canvas 2D。

## 效果迁移评估

| 效果                           | WebGPU/vgpu 可行性 | v1 建议                                      |
| ------------------------------ | ------------------ | -------------------------------------------- |
| 线性渐变                       | 高；CSS 也能完成   | 纳入统一 shader，避免预览/导出双实现         |
| 径向渐变                       | 高；CSS 也能完成   | 纳入统一 shader                              |
| Flow / mesh                    | 高                 | 第一批 POC，验证参数和视觉一致性             |
| Liquid / lava lamp             | 高                 | 第一批 POC，WebGPU 的核心价值场景            |
| Noise / dots / beam            | 高                 | 迁移为 WGSL utility/effect                   |
| Tile / ASCII / oil             | 高                 | 第二批迁移，先固定 sampling 和强度语义       |
| 图片背景 + texture             | 高                 | 需要统一图片 cover sampling、CORS 和颜色空间 |
| Pattern overlay                | 高                 | 迁入 WebGPU compositor；DOM overlay 仅作过渡 |
| Blur / brightness / saturation | 高                 | 统一到最终 GPU pass，避免 CSS/export 差异    |
| 多图形、多中心渐变             | 高                 | 值得新增，使用参数化 primitives/SDF          |
| Cover 图片 crop/rotate         | 高                 | 完整 Cover GPU compositor 阶段               |
| 圆角、遮罩、阴影               | 高                 | 使用 mask/SDF 或额外 pass                    |
| Magnifier / glass border       | 高但复杂           | 后续阶段，先做视觉基准图                     |
| 文本和复杂 DOM                 | 不自动支持         | 保持独立，不纳入 wallpaper shader v1         |

## 性能判断

WebGPU 在资源复用、多 pass、compute、复杂纹理和大量动态参数场景通常更有上限，但不能仅凭
API 名称断言比当前 WebGL 更快。

当前 wallpaper renderer 是单 full-screen quad、单 program、按需 render；对于简单静态渐变，
WebGL 已经很轻。迁移后的直接性能收益可能不明显，甚至会被首次 adapter/device 初始化和
shader pipeline 创建抵消。

预计收益更明显的地方：

- 复杂 liquid/noise 和多 pass 效果。
- preview 与 export 共享 pipeline，减少重复 CPU 绘制和重复实现。
- target、pipeline、uniform 和 texture 的长期复用。
- 后续增加 compute 或多个 compositing pass。
- 用 typed WGSL 和统一资源生命周期减少维护成本与错误率。

POC 必须测量：

- 首次初始化耗时。
- 首帧和 warm frame 耗时。
- resize 和参数拖动时的帧率。
- 1024、1920 × 1080、2048 尺寸的 export render/readback/encode 分段耗时。
- 峰值内存与 export 后资源释放。
- 最终 WebP 质量和 800 KB 达标率。

性能结论应基于相同 recipe、相同尺寸、相同设备的 A/B 数据，而不是把 WebGPU 当作天然加速。

## v1 实施阶段

### Phase 0：可行性 POC

时间盒与责任：

- 时间盒：10 个工作日，最多 2 个自然周，不因效果调参无限延长。
- 计划窗口：2026-08-31 至 2026-09-11。
- 决定日期：最迟 2026-09-12 给出 `adopt / revise / stop` 结论并更新本文状态。
- DRI：Wallpaper/CoverEditor 前端 owner；POC 启动前必须在对应任务中填写唯一具体负责人，
  未指定 DRI 不进入计时和实施。
- 参与评审：前端架构 owner 与 Assets Hub 上传链路 owner。

- 锁定 vgpu 版本，不使用浮动版本。
- 验证当前构建工具对 `.wgsl` typed imports 的支持和 editor route 的懒加载边界。
- 将一个 Flow 和一个 Liquid 效果迁为 WGSL。
- 同一 recipe 同时输出 browser surface 和固定尺寸 offscreen target。
- 使用非对称四象限测试图验证 WebGL legacy、WebGPU surface、texture sampling、readback 和
  最终 WebP 全部遵守 top-origin，不发生重复 Y flip。
- 在 Chrome 与 Safari 验证 `copyTextureToBuffer -> mapAsync` 异步 readback。
- 对 `rgba8unorm` 断言 `pixels.byteLength === width * height * 4`，确认 `target.read()` 返回连续
  texel bytes，Groupher 不重复处理底层 row padding。
- 在首次 render 前注册 `gpu.onError`，并在测试/导出边界使用 `await gpu.settled()` 验证异步
  validation 错误确实可观测。
- 完成 WebP Blob 生成、800 KB 检查和本地下载。
- 验证 Chrome、Safari、移动端至少各一个真实环境。

退出条件：效果、readback、编码或构建链路任一不可接受时，不进入正式替换阶段。

#### 2026-08-29 核心技术链路实测

隔离 POC 位于 `frontend/core/render/BgRenderer/vgpu-poc/`；它首先在不接入生产 `BgLayer`
的情况下验证技术链路，随后将通过的 Flow/Liquid shader 提升为生产与 POC 共用源码。POC
锁定 `vgpu@0.3.1`，使用独立 Vite 配置和动态 `import('./runner')`，验证结果如下：

- `.wgsl` typed import 与 WGSL-to-WGSL 相对 import 构建成功；`vgpu check
--require-validation` 的 device-backed validation 通过。
- Flow 与 Liquid 已从现有 GLSL 迁为 WGSL，并在同一份 shader 上分别输出 browser surface
  与 `rgba8unorm` offscreen target。
- Headless Chrome 152 / macOS 实测初始化约 `76 ms`，无 `gpu.onError` 异步错误；POC
  设置了 `10 s` 初始化上限，超时后会释放可能迟到的 device。
- `import('./runner')` 使用独立的 `10 s` deadline；加载 rejection 或 timeout 会写入带
  `runtime-load` stage 和错误码的失败 report，不再永久停留在 working。动态 import 无法取消，
  因此 runner module 禁止顶层 GPU 副作用，迟到的 chunk 只完成求值，不得启动 renderer。
- Chromium 实测正常 runner 加载约 `32 ms`；拦截为 404 时约 `46 ms` 进入
  `VGPU_RUNNER_LOAD_FAILED`；将 chunk 延迟 `12 s` 时页面在 `10 s` 进入
  `VGPU_RUNNER_LOAD_TIMEOUT`，chunk 迟到后 report 未被覆盖，也没有生成下载链接。
- top-origin 验收通过：`target.read()` 首行像素为 `[255, 0, 0, 255]`，末行像素为
  `[0, 0, 255, 255]`，不需要额外 Y flip。现有 WebGL vertex shader 也已经把 `vUv`
  转为 top-origin，因此 Flow/Liquid 迁移边界本身不应再翻转。
- 两个 1200 × 630 target 的 readback 均返回 `3,024,000` 字节，严格等于
  `width × height × 4`，确认返回的是去掉 row padding 的连续 RGBA texel bytes。
- pipeline 同时按 offscreen `rgba8unorm` 和 canvas surface signature 预热后，Flow render
  约 `13.7 ms`、Liquid render 约 `5.1 ms`；异步 readback 分别约 `4.7 ms` 和 `2.6 ms`。
  这些是单次本机样本，不作为跨设备性能结论。
- 最终导出直接调用 WebGPU canvas 的 `toBlob('image/webp', 0.86)`，没有创建 Canvas2D
  context；Flow WebP 为 `15,654` 字节，Liquid WebP 为 `6,896` 字节，均远低于 800 KB。
  两个 canvas backing store 与解码后的 WebP 都断言为 `1200 × 630`；`3,024,000` 字节
  readback 是诊断阶段的临时裸像素，不是最终上传资产大小。
- 构建保持懒加载：入口 chunk 约 `2.26 KB gzip`，包含 vgpu、target/readback 和 shader 的
  POC runner chunk 约 `48.38 KB gzip`。正式接入仍应维持 editor route 的异步边界。

尚未完成，因此 Phase 0 不能标记为最终 `adopt`：

- Safari 26.5 已安装，但本机 Safari 未启用 Developer 设置中的 `Allow remote automation`，
  无法执行自动化实机验收；需要启用后复跑同一页面，验证 surface、异步 readback 与 WebP。
- 移动端真实设备尚未验收。
- 尚未完成同一 recipe、同一尺寸、同一设备下 WebGL 1 与 WebGPU 的视觉/性能 A/B，也未覆盖
  texture sampling、图片背景和 device loss 重建。

当前阶段判断为 `continue`：核心构建、WGSL、surface、offscreen readback 和浏览器端 WebP
链路均可行，可以继续完成 Phase 0 剩余矩阵；在 Safari / 移动端和 A/B 完成前，不切换普通
社区页面的全局 renderer。

#### Phase 0 收口清单

- [x] Flow/Liquid WGSL、Chromium Editor surface 和实时 Angle 交互。
- [x] 固定尺寸 offscreen target、top-origin、连续 texel bytes 和 POC WebP。
- [x] runner/device deadline、异步错误收集、WebGPU fail-fast 和 latest-wins 调度。
- [x] `vgpu check --require-validation` 对完整 Wallpaper shader 的静态校验。
- [ ] Safari surface、`copyTextureToBuffer -> mapAsync` readback、WebP 和 device loss。
- [ ] 移动端真实设备验收。
- [ ] 同一 recipe、尺寸和设备下的 WebGL/WebGPU 视觉与性能 A/B。
- [ ] resize、连续导出、资源释放和异常恢复的实机验证。

Phase 0 退出后，下一条最小可交付纵向链路是：Flow/Liquid 固定 recipe 导出 WebP，产出
`Blob/File`，接入现有 Assets Hub upload intent / finalize，并在浏览器端完成尺寸、体积和错误状态
验收。

### Phase 1：统一 Wallpaper renderer

- 新建 vgpu renderer adapter，输入只接受 `TBgRenderSpec`。
- 已迁移 linear、radial、flow、liquid、Noise、Tile、Beam、ASCII、Dots、Oil、图片采样，以及内置 Pattern。
- global brightness/saturation/blur 与 procedural texture 均进入共享 WGSL 最终像素 pass；WebGPU layer 不再挂
  CSS filter，避免全屏 layer 的重复合成。
- Shader Phase 1 负责 wallpaper 的正式 GPU 像素 pass，包括 Pattern、texture、brightness、
  saturation、blur 和多层混合；具体效果可以分批实现，但不能把这些 pass 长期留在 CSS 或
  Canvas 2D 路径。
- Shader S1 同时必须适配 [preview_architecture.md §5.4/§5.5](./preview-architecture.md)：
  接收 `PreviewFrame` 的高频更新，并与 `updatePreviewFrame` / committed-preview 分离契约
  对齐；shader 迁移完成不等于预览编排契约可以绕过。
- Wallpaper renderer 适配 [preview_architecture.md §5.4/§5.5](./preview-architecture.md)：
  消费 `PreviewFrame`，提供 `updatePreviewFrame(frame)`，并区分高频 preview 与低频
  `setCommittedSpec(spec)`；`PreviewSession` 和 `PreviewScheduler` 仍属于预览编排层。
- 保留现有 `BgRenderer` React 边界；CSS/ WebGL 只作为明确 legacy caller 的路径。
- 加入 adapter/device failure、device loss、resize 和 dispose 处理。状态语义参考 `BgLayer`
  现有 `webglcontextlost` / `webglcontextrestored` 处理，但 WebGPU 实现使用 `device.lost`
  Promise 完成失效检测和重建，不能照搬 WebGL DOM event。
- runtime chunk、adapter 和 device 初始化分别设置明确 deadline 和错误 stage；chunk 加载
  失败、adapter/device 超时、Promise rejection 或初始化后 device loss 都进入 `failed` 状态，
  不自动切回 WebGL，也不在当前 renderer 实例内自动重建 vgpu。超时后的迟到 device 必须主动
  dispose，不能留在后台继续占用 GPU process。
- 旧 WebGL renderer 只在调用方明确选择 legacy lane 时运行，不承担 WebGPU 失败后的兜底。
- 不新增 WebGL 2 renderer 或 GLSL ES 3.0 过渡实现。

#### 2026-08-30 Phase 1 首批接入

- `BgLayer` 保持现有 React、filter、pattern 和 crossfade 边界；新增双 canvas 单活 adapter，
  WebGL 仅在 vgpu 完成 chunk load、device init、pipeline compile 和首帧前作为过渡画面。WebGPU
  canvas 失败时销毁两套 renderer 并进入 `failed`，不复用其 context，也不回到 WebGL canvas。
- adapter 只接受 `TBgRenderSpec`，不读取 Wallpaper/Cover store。当前 eligibility 覆盖 Linear/Radial/Flow/Liquid、
  六种程序化 texture、图片、Pattern 和 Blur；不支持或初始化失败时进入可诊断 `failed` 状态。
- `WallpaperRenderer` 新增显式 `preferVgpu`，默认 `false`。目前只在 Wallpaper Editor 的
  AuthPreview 与 GlobalPreview 打开，普通社区 Wallpaper、Landing demo 和其他调用方不切换。
- vgpu runtime 使用动态 import；Dash 生产构建生成独立 client chunk，约 `45.68 KB gzip`。
  普通页面不会因 `BgRenderer` 本身加载该 chunk。所有可能打包 Core 背景的 Vite host 共用
  `@groupher/frontend-core/vgpu-vite`，避免每个应用维护不同 WGSL loader 配置。
- runtime chunk 有独立 `10 s` deadline，device init 也有独立 `10 s` deadline。初始化失败、
  `gpu.onError`、render rejection 或 `device.lost` 都会销毁 vgpu 与 WebGL 资源并进入 `failed`；
  迟到 chunk 无顶层 GPU 副作用，迟到 device 会主动 dispose。
- adapter/参数测试覆盖 WebGL 过渡画面、vgpu 就绪后接管、初始化失败 fail-fast、失效 spec
  对迟到 renderer 的取消，以及 `TBgRenderSpec -> WGSL uniforms` 映射。
- 当前 Chromium 页面曾复现完整 `wallpaper-mesh.wgsl` 的 `random2` 未导入错误；修复后必须
  重新完成真实 WebGPU 接管、Flow/Liquid 和导出验收。本阶段曾将两个 Editor preview 限制为 DPR 1；
  该历史策略已被下方 2026-09-06 的 Profile/DPR 契约取代，最终导出仍不读取预览设备 DPR。

#### 2026-08-31 vgpu 交互性能修复

- `useWallpaperPreview` 沿用 preview CSS var 的 rAF 合帧边界，将完整 preview state 的组合与
  `emitWallpaperPreview` 合并为每帧最多一次，拖动事件只保留最新状态。
- vgpu renderer 改为单个 GPU frame 在途的 latest-wins 调度；前一帧尚未完成时不再向 GPU
  队列继续提交新帧，避免 Angle 拖动后积累 work 导致页面失去响应。
- 本阶段 Editor 的 Flow/Liquid surface 曾使用 DPR 1；当前 preview 使用受控 HiDPI backing store，
  静态导出继续使用独立的固定尺寸与质量策略。

#### 2026-08-31 vgpu Pattern overlay

- vgpu mesh shader 新增 pattern texture、top-origin repeat UV、pattern color 和 opacity；
  Editor 实时预览与浏览器端导出共用同一套 pattern 合成逻辑。
- pattern 图片通过当前 WebGPU device 上传为 `rgba8unorm` texture；内置 pattern 资源加载失败
  时，vgpu renderer 进入 `failed`，不生成缺少图层的导出文件，也不回到 WebGL。
- `patternSize` 作为 renderer/export 参数传入：Editor 预览、全局 renderer 和静态导出统一使用
  共享的 `DEFAULT_WALLPAPER_PATTERN_SIZE`（当前为 `260px auto`），避免 SSR/static image 与编辑器
  外层 wallpaper 的重复尺寸不一致。
- Linear/Radial、Flow/Liquid、六种程序化 texture、图片、Pattern 和 Blur 共用同一份 WGSL Params；global
  brightness/saturation/blur、texture intensity 和 image sampling 在 shader 中执行，export 复用同一参数映射。
- WebGL 继续由 `BgLayer` 的 CSS mask overlay 绘制；它只属于明确的 legacy lane，不是 vgpu
  失败后的自动回退。

#### 2026-08-31 vgpu global effects

- `blurIntensity` 统一映射为 `0–6px` 的 `blurRadius`，与原 Wallpaper CSS filter 的控制范围一致。
- WGSL 在 Pattern、Texture、Brightness、Saturation 合成之后执行九采样 Gaussian 近似；因此
  WebGPU 预览和浏览器端导出不会再依赖包含 canvas 的整层 CSS filter。
- WebGL 仍保留原有 CSS filter，仅作为明确 legacy lane；这不增加第二套 Wallpaper 正式导出实现。
- Blur 现在已通过 eligibility 和导出入口，仍需在真实 Safari/移动端以及 WebGL/WebGPU A/B 中确认
  边缘采样、视觉误差和帧时间。

#### 2026-08-31 Chromium Editor A/B smoke test

- 使用同一个 `Stone Green + Pattern 10 + Flow/Liquid` recipe，在同一个 Chromium 进程中分别
  强制使用 WebGL 与 WebGPU 预览；两组截图的渐变结构、Pattern 重复方向和布局肉眼一致，预览
  canvas backing store 尺寸也一致。
- WebGPU 预览的 active canvas 均正确标记为 `data-bg-renderer='active'`，WebGL legacy lane
  lane 在临时隐藏 `navigator.gpu` 后仍能独立渲染同一 recipe。
- Flow 导出 WebP 实测约 `105,950` bytes，Liquid 约 `103,480` bytes；两者均包含 Pattern，
  并通过 `1200 × 630` 输出路径，低于 `800 KB` 上限。
- 本次是 Chromium smoke test，不等价于逐像素误差和跨设备性能结论；正式 A/B 仍需固定设备
  收集初始化、首帧、warm frame、交互帧和导出分段耗时。
- 当前环境的 Playwright WebKit 未安装，不能代替真实 Safari 验收；移动端真实设备也尚未执行。

#### 2026-09-06 Profile/DPR 与 SSR 接管修正

- Pattern 发糊的 root-cause 不是 Blur、intensity 或 pattern asset，而是全屏 Editor 曾把 `1200×630 @ DPR 1`
  canvas 放大到 viewport；Gradient 与细线同样被放大，只是 Pattern 最明显。
- renderer 现在区分 Profile logical size、backing-store pixel size 和 CSS presentation size。DPR 上限为 2，
  只提高实际像素密度；`patternSize` 继续按 logical size 解释，不能因 DPR=2 把 `260px` tile 缩成 `130px`。
- 有 published Wallpaper 时，全屏 Editor 使用与 `StaticWallpaper` CSS cascade 相同的 active Profile 逻辑画布，
  backing store 为 `profile × min(DPR, 2)`，两层均在 viewport 内 `cover center`。直接按 viewport 重绘虽然清晰，
  但会改变 Pattern 密度和构图，不能作为修复。
- 无 published Wallpaper 时，全屏 CSS draft 与 GPU 都按 viewport 构图；AuthPreview/GlobalPreview 等卡片按自身
  DOM rect 构图。显式 export 的 logical/pixel target 仍固定且与设备 DPR 无关。
- GPU ready/failure 以 `theme + profile/viewport` 为 identity。resize 跨 Profile 后 active Profile 立即使旧
  canvas 退出接管；renderer Profile 等待 `150ms` 稳定后再替换，避免在 `16/10` 附近反复执行 vgpu
  init/prepare。等待期显示 CSS 静态层，新 Profile 首帧完成后再接管。
- 真实 Chromium 已验证 `1720×1250 @ DPR 2` 命中 desktop：逻辑 `1440×900`、backing `2880×1800`；
  resize 到 `1800×1000` 命中 wide：逻辑 `1920×1080`、backing `3840×2160`。这属于本地 smoke，不能替代
  Safari/移动端矩阵。
- 边界 settle smoke 在 `1600×1000` 与 `1601×1000` 间以 `50ms` 往返：原 desktop canvas 保持同一 DOM identity
  但立即隐藏，静态层接管；稳定后才创建 wide canvas。证明 debounce 没有让旧 Profile 继续覆盖新静态图。
- `150ms` 只是 resize Profile replacement debounce，不是 shader 或首帧预算。当前 hydration 后的首次
  `wide -> desktop/tablet/phone` 校正仍会经过该等待，并可能先初始化一次 wide renderer；应在不改变首次 hydration
  snapshot 的前提下，于 commit 后直接确定首个 client renderer Profile，避免用 render-time `window` 分支。
- settle pending 期间旧 GPU 仍 mounted 且不可见。当前把它视为可接受的短时成本；若后续 trace 证明 GPU 预算受压，
  再为 pending renderer 增加暂停提交能力，不提前增加额外状态机。

这一批尚未启用全局 Wallpaper，也尚未接入 CoverEditor。下一批先完成 Editor 内同设备
WebGL/WebGPU 视觉 A/B、Safari/移动端验证与运行指标，再决定是否扩大 `preferVgpu` 范围。

### Phase 2：浏览器端 Wallpaper 导出与上传

浏览器生成、WebP 校验、Assets Hub intent、R2 PUT 和 finalize 的独立边界见
[browser_export_upload.md](./browser-export-upload.md)。

- 导出固定 width、height、seed、time、format。
- 实现 WebP 编码和 800 KB 体积控制。
- 输出 `Blob/File`，接入现有 Assets Hub upload intent / finalize 流程。
- 保存 `assetPublicRef + variant`；普通页面只渲染最终图片。
- 为 export render、readback、encode、upload 分别提供可诊断错误；同步异常、Promise
  rejection 和 `gpu.onError` 事件不能合并成无上下文的“导出失败”。

#### 2026-08-31—09-01 浏览器端导出与 Save 上传

- 新增 `render/WallpaperExport/exportWallpaperAsset()` 懒加载入口；vgpu、WGSL 和导出实现只在
  触发导出时加载，不进入普通 Wallpaper runtime 的初始路径。
- 浏览器端导出 API 已完成，由 Wallpaper Editor 的 Save 成功回调触发；不再保留独立的导出或
  上传调试按钮。
- `exportVgpuWallpaper()` 当前接受可带内置 pattern、六种程序化 texture 和 blur 的 Linear/Radial/Flow/Liquid/图片 `TBgRenderSpec`，
  默认输出 `1200 × 630` WebP，质量 `0.86`，体积上限 `800 KB`，同时返回 `Blob` 和 `File`。
- 导出前后均做尺寸保护：显式设置并断言 canvas backing store，并解码 WebP 断言最终宽高；此处
  使用的是 WebGPU canvas surface，不创建 Canvas 2D context。
- 正式导出入口对 dynamic import 设置独立 deadline；runtime chunk 永久 pending 或加载失败时
  会返回可诊断错误，不会让界面永久停留在 working 状态。
- Assets Hub 的 checksum、intent、presign、R2 PUT、finalize 已抽为共享
  `uploadCommunityAsset()`；Wallpaper 调试上传复用该协议且不传 `thread`，不会伪造 Post 归属。
- 当前 Save 成功后会在浏览器生成 active theme 的 WebP，并调用 `uploadCommunityAsset()` 上传到
  Assets Hub/R2；上传结果尚未写回 Wallpaper recipe 的静态图片引用，也未替换普通页面的
  recipe 消费；Safari、移动端、连续导出和完整错误矩阵仍属于后续验收。

### Phase 3：CoverEditor GPU compositor

- 图片图层采样和 cover crop。
- translate、scale、rotate、z-index。
- rounded corners、shadow、border highlight、mask。
- magnifier 和 glass effects。
- 完整 cover 使用 GPU target 导出后，再评估删除 Canvas 2D visual renderer。

### Phase 4：收敛旧实现

- 根据真实浏览器失败率和视觉回归结果决定 legacy 生命周期。
- 删除已经由 WGSL 覆盖的 GLSL 和 Canvas texture 实现。
- 编码器稳定后删除仅用于 `putImageData/toBlob` 的 Canvas 2D bridge。
- 保留 CSS fallback 只用于明确的 legacy caller 或加载态；`preferVgpu` 路径失败时必须进入
  `failed`，不能显示低能力替代结果。

## 测试与验收

### 功能验收

- 同一个 `TBgRenderSpec` 可以渲染到 preview surface 和 export target。
- linear、radial、flow、liquid、图片背景和各 texture 的参数语义一致。
- pattern、filter 和图片 cover sampling 顺序明确且稳定。
- 固定 recipe、seed、time、尺寸时，重复导出结果在允许误差内稳定。
- 动态效果可以导出指定时间点，不依赖点击按钮时的偶然帧。
- 图片资源 CORS 或 decode 失败时，不生成看似成功但缺图的资产。

### 视觉验收

- 为每类效果保存 canonical recipe 和基准图。
- 在真实 WebGPU 浏览器中执行截图或像素 readback。
- 允许 GPU/浏览器之间有小范围数值误差，但不允许结构、色带、采样和图层缺失。
- Preview、texture、readback 和最终 WebP 均保持 top-origin，不允许上下翻转或不同阶段
  相互抵消的双重翻转。
- Preview 与最终 Blob 必须进行真实图片对比，不能只以 type-check 或函数成功返回为准。
- 导出验收同时断言 canvas backing store 和解码后的 WebP 宽高；Blob MIME 与字节数不能替代
  最终图片尺寸验证。

### 资产验收

- 最终 Blob 不超过 800 KB。
- MIME、扩展名、尺寸、checksum 与资产记录一致。
- 上传失败不会 finalize；finalize 失败保留可重试信息。
- R2 中保存的是最终静态图片，不保存浏览器临时 RGBA buffer。
- 普通社区页面不加载 vgpu、WGSL editor runtime 或 Canvas export 代码。

### 兼容验收

- 不能只检测 `navigator.gpu`，必须完成 adapter、device 和最小 render 探测。
- device loss 后进入 `failed`；是否重新初始化属于后续显式重试状态机，不得自动降级。
- POC 和 export 必须同时验证同步异常、readback Promise rejection 和 `gpu.onError` 三种错误
  通道；`await gpu.settled()` 后仍有 GPU 错误时不得进入成功态。
- runner chunk 返回 404、加载 rejection 或永久 pending 时，editor 必须进入可诊断失败态并
  停止渲染；chunk 超时后即使迟到完成，也不得继续启动 WebGPU renderer。
- WebGPU 不可用时已有资产仍可正常显示。
- legacy lane 输出不可假装支持尚未实现的 WGSL-only 效果。

### 真实 GPU CI 环境

Playwright 中的 WebGPU 是否可用取决于 Chromium 构建、启动参数、headless backend、操作系统
和 GPU process 状态，不能假设所有默认 headless 环境都有 `navigator.gpu`。真实 GPU 测试采用
独立于普通单测的执行策略：

- 普通 PR lane 持续运行 type-check、mock 测试和 `vgpu check --require-validation`；通过拦截
  runner chunk 覆盖 rejection、永久 pending 和 timeout 后迟到完成，不依赖真实 GPU runner。
- browser GPU lane 使用固定浏览器版本和启动参数，并在开始时记录 `navigator.gpu`、初始化
  耗时、device label/adapter 信息和最小 render probe。
- 同一 runner 内串行复用一个浏览器实例，不并发快速启动多个 GPU browser process。
- runtime chunk、adapter/device 初始化和每个 readback 都设置分阶段 deadline；GPU 阶段
  超时后终止整个浏览器进程，清理后最多重试一次，不能在同一失效进程内无限重试。
- Chromium lane 可作为每次合并的最小真实像素门禁；Safari 使用启用 Remote Automation 的
  固定 macOS runner，或在条件成熟前作为 nightly/manual compatibility lane。

## 已确认的架构决定

- 值得从架构上迁移到 WebGPU/vgpu。
- `TBgRenderSpec` 继续作为 renderer 的权威输入，不让 shader 直接读取 store。
- vgpu adapter 当前实例遇到初始化失败、render rejection 或 device loss 时直接进入 `failed`，
  不降级到 WebGL，也不在同一实例内自动重建；重试属于后续单独的状态机能力。
- Preview 和 export 必须逐步统一到同一 WGSL 实现。
- 浏览器端 WebGPU 静态生成是 v1 主路径。
- Cloudflare Worker 不承担 Dawn/sharp 渲染；v1 不引入 Container。
- 最终 wallpaper 静态文件应控制在 800 KB 内。
- 800 KB 与 readback 的临时 RGBA 内存是两个不同指标。
- Dashboard 外运行时消费纯图片资产。
- Wallpaper store 的确认数据以 `light/dark` 为边界；`reconcileConfirmed` 会逐字段处理每个
  主题分支，`type/source` 属于主题字段，会正常参与 reconcile，不存在任意可同步的顶层
  `type/source` 字段。
- Canvas 2D 可以逐步退出，但只有 Cover 完整 compositor 和独立编码路径完成后，才能宣称
  完全移除。

## 尚需 POC 定案

- 默认导出尺寸与不同 wallpaper 场景的尺寸 preset。
- WebP 初始 quality、降质阶梯和最低可接受质量。
- 是否允许 AVIF，以及其编码耗时和 Safari 行为是否可接受。
- Pattern 已进入 vgpu GPU pass；明确 legacy lane 继续使用 DOM/CSS overlay，直到旧路径收敛。
- Safari partial support 下的实际效果、readback 和编码成功率。
- vgpu 升级周期，以及每次 `0.x` 升级所需的 CHANGELOG、构建、readback 和视觉基准检查。
- WebGPU-only 新效果在不支持浏览器中的产品提示和编辑权限。

## 参考资料

- https:
- https:
- https:
- https:
- https:
- https:
- https:
- https:
- https:
- https:
