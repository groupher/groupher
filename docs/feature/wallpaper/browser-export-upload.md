# Wallpaper 浏览器端导出与 R2 上传（v1 归档）

> 文档角色：Archive，仅记录已被响应式 Batch/Revision 契约取代的 v1 单图链路
>
> Active：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [响应式静态产物、历史与共享导出机制](./responsive-revisions.md)
>
> 历史状态：架构已确认，Save 后导出与上传链路已接入，静态资产引用切换与真实浏览器矩阵待完成
>
> 日期：2026-09-01
>
> 协议版本说明：本文的固定 `1200 × 630`、light/dark 单图导出描述属于已实施的 v1 链路。
> 响应式 WebGPU batch export、Profile/Variant targets、临时上传批次与成功 Theme Revision 目标由
> [响应式静态产物与版本历史](./responsive-revisions.md) 取代。实施时不兼容或迁移旧单图数据；
> 本文仅用于记录旧浏览器导出和 Assets Hub 上传事实。

## 目标与边界

Wallpaper 的最终图片由支持 WebGPU 的浏览器生成，然后通过现有 Assets Hub 协议上传到
R2。Cloudflare Worker 只负责上传控制和资产确认，不负责运行 WebGPU、vgpu、Dawn、Canvas
渲染或图片合成。

这条边界是当前阶段的明确选择：

- 避免把 `vgpu/node + Dawn + sharp` 引入 Worker，降低部署体积、运行时兼容和维护复杂度。
- 预览和导出继续使用同一份 `TBgRenderSpec`、WGSL shader 和参数映射。
- Community、Landing 等普通子应用只消费上传完成后的静态图片，不加载 Wallpaper Editor
  的 WebGPU runtime。
- 只有 Dash 的 Wallpaper Editor 需要实时 WebGPU 预览和浏览器端导出。

## 端到端流程

```text
Dash Wallpaper Editor
  -> TBgConfig
  -> composeBgRenderSpec()
  -> WebGPU surface / offscreen target
  -> shared WGSL wallpaper shader
  -> browser canvas WebP encode
  -> Blob / File
  -> Assets Hub upload intent
  -> presign
  -> browser PUT to R2
  -> finalize
  -> assetPublicRef + variant
  -> 普通子应用渲染静态图片
```

浏览器端负责：

- 读取当前 Dash Editor 的 committed wallpaper spec。
- 在独立的 WebGPU export surface 上以固定尺寸渲染。
- 处理 Gradient、Flow、Liquid、Pattern、Texture、图片采样、Brightness、Saturation 和
  Blur 等导出像素效果。
- 通过 `canvas.toBlob('image/webp')` 进行浏览器原生 WebP 编码。
- 校验 MIME、宽高和文件体积。
- 将结果包装为 `Blob` / `File` 并上传。

Assets Hub / Worker 负责：

- 校验当前 community 的上传权限。
- 根据文件名、MIME、大小和 SHA-256 checksum 创建 upload intent。
- 返回带 capability 的 presign 信息。
- 接收浏览器直接发往 R2 的 PUT 请求。
- finalize 上传并返回 `assetPublicRef`、`uploadRef` 和服务端耗时信息。
- 保存资产元数据和 variant，不参与图片像素生成。

## 当前代码边界

| 阶段                                        | 当前实现       | 代码位置                                                                     |
| ------------------------------------------- | -------------- | ---------------------------------------------------------------------------- |
| Render spec                                 | 已实现         | `composeBgRenderSpec()`                                                      |
| WebGPU export                               | 已实现         | `render/BgRenderer/vgpu/export.ts`                                           |
| 懒加载 export API                           | 已实现         | `render/WallpaperExport/index.ts`                                            |
| WebP 尺寸校验                               | 已实现         | 显式 backing size + `createImageBitmap()` 解码校验                           |
| 800 KB 限制                                 | 已实现         | export API 的 `maxBytes`                                                     |
| 浏览器导出 API                              | 已实现         | `render/WallpaperExport/index.ts`                                            |
| Upload intent / presign / R2 PUT / finalize | 已抽出共享协议 | `AssetsHub/uploadCommunityAsset.ts`                                          |
| Save 后 Wallpaper 导出与上传                | 已接入         | Save 的配置 mutation 成功后导出 active theme 并调用 `uploadCommunityAsset()` |
| Save 与静态资产引用切换                     | 未接入         | 当前只完成资产生成/上传，尚未把 `assetPublicRef` 写回 Wallpaper 配置         |
| Community / Landing 静态图片消费            | 现有架构已支持 | 不应加载 editor WebGPU runtime                                               |

## 导出契约

### 输入

导出入口只接收 renderer-ready 的 `TBgRenderSpec`，不读取 Wallpaper store，也不直接读取
React context。Wallpaper Editor 负责把当前 theme branch 的状态适配为 render spec。

导出必须使用 committed spec，而不是拖动过程中的半成品 preview frame。这样可以保证：

- 点击导出时得到的是当前已确认的配置。
- 导出不会因为后续控件拖动而改变。
- 预览和导出仍共享同一套 shader 语义。

### 输出

- 默认尺寸：`1200 × 630`。
- 默认格式：`image/webp`。
- 默认质量：`0.86`。
- 默认体积上限：`800 KB`。
- 返回值：`Blob`、`File`、文件名、MIME、宽度和高度。

在上传前必须通过：

1. WebGPU surface 的 backing store 尺寸断言。
2. WebP MIME 断言。
3. 解码后图片宽高断言。
4. 文件体积断言。
5. GPU 异步错误检查：通过 `gpu.onError` 收集 shader、pipeline、device 等异步错误，并在
   `gpu.settled()` 后统一抛出，不能因为 pattern、texture 或 blur 加载失败而生成“看起来成功”
   但缺少图层的文件。该机制不等价于逐层像素级校验，也无法发现 GPU 或浏览器静默产生的
   视觉退化；视觉完整性仍需通过基准图或像素对比验收。

## 上传阶段与错误语义

`uploadCommunityAsset()` 的阶段保持独立：

```text
checksum
  -> intent
  -> presign
  -> put
  -> finalize
```

每个阶段都应向 UI 提供 running/done 和耗时；失败时保留失败阶段，不能统一显示为模糊的
“上传失败”。导出阶段也应独立显示：

```text
runtime-load
  -> gpu-init
  -> asset-decode
  -> render
  -> encode
  -> validate
  -> upload
```

典型错误包括：

- 当前浏览器没有 `navigator.gpu`。
- vgpu runtime chunk 加载超时。
- WebGPU adapter/device 初始化超时或 device loss。
- Pattern 或图片资源 decode/CORS 失败。
- shader/render rejection。
- WebP 编码失败。
- 尺寸或体积校验失败。
- intent、presign、R2 PUT 或 finalize 失败。

导出失败不能自动上传空文件、fallback 图片或缺少图层的文件。

## WebGPU 浏览器检查

Chrome 桌面版通常默认支持 WebGPU，但正式验收前仍必须检查当前运行实例：

```js
typeof navigator.gpu !== 'undefined'
```

以下情况可能导致结果为 `false`，即使浏览器版本本身支持 WebGPU：

- 启动参数禁用了 GPU 或 WebGPU。
- 无头浏览器/CI runner 没有可用 GPU。
- 当前 GPU 被浏览器黑名单屏蔽。
- 远程桌面、虚拟机或浏览器策略禁用了硬件加速。
- 连续启动过多 GPU 浏览器进程后，device 初始化处于异常状态。

因此 `caniuse` 覆盖率只能说明浏览器版本能力，不能代替当前设备的 export smoke test。

## Dash 产品接入计划

当前 Save 行为已经是：

```text
点击 Save
  -> 保存 Wallpaper recipe
  -> recipe 保存成功
  -> 浏览器导出 active theme WebP
  -> 上传 Assets Hub / R2
```

如果导出或上传失败，recipe 保存结果不会被伪造为失败；界面会明确提示“配置已保存，但
Wallpaper 图片上传失败”，不会静默生成或引用不完整的图片。

在 R2 上传链路通过真实浏览器验收后，Dash 增加一个明确的渲染模式切换用于验证：

```text
WebGPU render
  -> 实时预览 + 浏览器导出

Static image
  -> 读取已上传的 assetPublicRef
```

这只是 Dash 的验证和过渡控制，不应扩散到 Community、Landing 等普通子应用。普通子应用
的正式运行时只读取静态图片，不需要知道 Wallpaper recipe、WebGPU、vgpu 或 shader 参数。

## 验收顺序

1. Chrome WebGPU 实机验收：Blur、Pattern、Texture、图片和 Flow/Liquid。
2. 同一 `TBgRenderSpec` 比较预览与 `1200 × 630` 导出结果。
3. 连续导出、资源加载失败、device loss 和重复上传验收。
4. 采集导出分段耗时：GPU render、readback/encode、checksum、intent、PUT、finalize。
5. 接入 Dash WebGPU/static image 切换按钮。
6. 验证普通子应用只消费静态图片，并确认没有加载 editor WebGPU runtime。

## 明确不做

- 不在 Cloudflare Worker 内运行 WebGPU、Dawn、vgpu/node 或 sharp 渲染 Wallpaper。
- 不让普通子应用加载 Wallpaper Editor 的 shader runtime。
- 不在导出失败时静默回退为另一张图片并继续上传。
- 不把浏览器端导出和服务器端渲染做成两套长期维护的像素实现。
