# Wallpaper 响应式静态产物、历史与共享导出机制

> 文档角色：Active contract；Profile、Assets Hub、生命周期和共享导出边界仍有效
>
> 日期：2026-09-06
>
> Current save contract：[当前 theme 单独保存重构](./current-theme-save-refactor.md)
>
> Active background contract：[Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md)
>
> Active：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [实时预览架构](./preview-architecture.md)
>
> Mixed：[实时编辑与静态发布边界（v1 主体归档）](./static-wallpaper.md)
>
> Archive：[浏览器端导出与上传（v1）](./browser-export-upload.md)

> 契约提示：本文早期的双 theme 聚合保存模型已被
> [当前 theme 单独保存重构](./current-theme-save-refactor.md) 和
> [保存链路与数据边界](./save-pipeline-contract.md) 取代。当前 theme 的保存粒度、Settings、Snapshot、
> NONE 和单支指针规则以上述两篇为准；本文件继续作为 Profile 矩阵、Assets Hub、生命周期、保留和
> 安全边界的 Active 参考，不能从旧段落恢复双支运行路径。

> v2 阅读边界：下方早期章节中出现的 `CommunityWallpaperState`、Theme Revision、RevisionAsset、
> authoring、candidate refs、Variant、`stateVersion`、`staticWallpaper` 以及 light/dark 双支同时保存，
> 都是历史设计记录，不是当前运行时契约。当前实现使用 `CommunityWallpaper`、`WallpaperSnapshot`、
> `WallpaperSnapshotImage`、Settings、Snapshot、Image、`version` 和 `wallpaper`；一次保存只更新当前
> theme 指针，但当前指针、`version + 1`、Snapshot/Images 与 Receipt 仍在同一数据库事务中完成。
> 本文件的 Profile、Assets Hub、lease、reconciliation、保留策略、静态消费和安全边界继续有效；保存、
> GraphQL shape、错误码和命名以两篇 Active contract 为准。

## 0. 当前实现基线（2026-09-02）

本轮实现已将本文的首期契约落到 Phoenix、Assets Hub Worker 和 Dashboard：

- Batch 协调状态由 Cloudflare Durable Object 的 SQLite storage API 保存；这是 Durable Object 的存储
  后端，不是 D1，也不需要另外创建 SQLite 服务。部署仍必须在 Wrangler 中声明 Durable Object
  binding 和 SQLite migration；生产账户需要具备 Durable Objects 使用权限。
- 内部鉴权 scope 固定为：claim `assets:generated-batch:claim`、cleanup
  `assets:generated-batch:cleanup`、对象删除 `assets:object:delete`、finalize 后注册 manifest entry
  `assets:generated-batch:register`。注册只接受 `service:assets-hub`，其余三个 scope 只接受
  `service:phoenix`。
- manifest digest v1 使用排序后的 camelCase wire entry；TypeScript 与 Elixir 共用
  `packages/contracts/fixtures/wallpaper-manifest-digest-v1.json` golden fixture。
- Profile/Variant 矩阵由 `packages/contracts/fixtures/wallpaper-profile-matrix-v1.json` 固定，并由
  Frontend、Phoenix 与 Assets Hub 分别执行 golden test；Profile 名不得包含 `-`。
- GraphQL 中 variants、candidate revision refs、expected variants、upload intents 和 static variants
  均已类型化。Absinthe 负责 GraphQL camelCase 到内部 snake_case 的映射；Assets Hub capability 与
  manifest 的 camelCase 只在 `CMS.Assets.GeneratedBatch.PublishCapability` 双向转换。
- Wallpaper settings 使用 typed 稳定骨架和版本化 JSON recipe，由 Frontend codec 与
  `CMS.Wallpaper.Settings` 明确规范化；request digest 只由 `CMS.Wallpaper.RequestDigest` 计算。
- claim 会在冻结 manifest 后对每个 R2 object 执行 `head`，复核存在性、MIME 和 SHA-256；manifest
  不完整或物理对象不一致时，先持久化 delete claim，再删除对象与 Durable Object 元数据。
- publish cleanup 在 Phoenix 侧查询 `batch_published?(batchRef)` 后，Assets Hub 的 Durable Object
  还会在实际删除前再次执行同一 published probe；probe 为 `unknown` 时返回 retryable 错误并保留
  claim/R2 对象，probe 为 `published` 时只清理 DO metadata，不删除对象。这个双 probe 缩小了并发
  loser 误删胜者对象的窗口，但不是跨 Phoenix 数据库与 R2 的分布式原子事务；要完全消除窗口仍需
  后续引入 publish-finalization/cleanup lease 协议。
- Phoenix 在事务外预检 lease，并在事务 callback 内二次校验。当前 policy `v1`：DB transaction
  timeout 5 秒、lock timeout 4 秒、publish transaction budget 10 秒、最大时钟偏差 5 秒；Batch TTL
  15 分钟。
- light/dark 合计保留最近使用的 5 个 post-cutover Snapshot。淘汰 Snapshot 的 `deleteAfter` 为当前时间加 2 小时，
  不再立即删除。Oban 每 15 分钟清理过期 Receipt、过宽限期且非 active 的 Revision，并对超过
  30 分钟仍未被 Revision 引用的 `wallpaper-generated` CommunityAsset 做孤儿对账。
- Editor 返回 `version` 和当前 theme 最近 5 次 post-cutover Snapshot 历史；`restoreWallpaperSnapshot` 通过
  聚合行锁和 base version 原子恢复 retained Snapshot。NONE Snapshot 同样可恢复。pre-cutover Snapshot 不
  进入新 history，不做 v1→v2 materialization；5 个名额与 `deleteAfter` 宽限期只统计 post-cutover 新行。
- Receipt 重放只处理当前 cutover 版本；pre-cutover Receipt 不进入新 replay/restore 路径，旧数据不做兼容迁移。
- 浏览器对同一份失败 Save 保留 idempotency key；响应丢失后的重试可命中 Phoenix Receipt，而用户
  修改内容或 State version 改变后会生成新 key。
- Assets Hub 增加真实 workerd/Miniflare Durable Object 测试，覆盖成功 claim、manifest 不完整以及
  R2 object 缺失；纯 kernel 测试锁定过期优先级、cleanup probe 决策和 reconcile 退避上限。Hub
  cleanup 的真实 Phoenix probe 仍需在带 service-auth 测试绑定的 worker 环境补齐，不能用远期
  `expiresAt` 测试替代 alarm/reconcile 覆盖。

首期 capability 签名仍采用单个 HMAC key，`signingKeyId = hmac-v1`，尚未提供多 key 轮换。这是已知
缩减，不影响当前单 key 部署；引入轮换前必须先让 Phoenix 支持 trusted key set，再切换签发 key。
生产部署还必须在服务身份注册表中给 `service:assets-hub` 授予
`assets:generated-batch:register`，否则 finalize 后的 manifest 注册会被拒绝。

## 1. 背景与目标

当前 Wallpaper 使用固定画布导出一张静态图片，普通路由再将它作为全屏背景显示。固定画布与实际
viewport 的宽高比不一致时，Pattern、图片采样、Gradient 中心和可见区域都会变化，导致 Editor
WebGPU 预览、SSR 静态背景和路由切换后的静态背景不一致。

单张固定尺寸图片不能同时表达 wide、desktop、tablet 和 phone 的构图。本方案不再寻找一个
“万能尺寸”，而是：

- 为每个 viewport Profile 单独生成静态产物；
- 当前 theme 分别保存不可变的成功 Snapshot；
- 每次事务只切换当前 theme 引用；
- light/dark 合计保留最近使用的 5 个 Snapshot；
- 任何生成或上传失败都放弃整个临时批次，不发布、不续传、不修补；
- 普通路由只消费静态图片，不加载 WebGPU 或 settings recipe；
- 共享浏览器导出和 Assets Hub 能力，为后续 Cover 多用途输出复用机制，但不提前统一产品模型。

本文件取代旧单图目标：

- 不再使用 `1200 × 630` 作为 Wallpaper 固定导出尺寸；
- 不再使用 light/dark 各一个 `staticAssetPublicRef` 作为最终契约；
- `UPLOAD` 也必须按照各 Profile 的构图规则生成静态产物；
- Gradient、Pattern、Texture、滤镜和上传图片全部通过 WebGPU 生成，不增加 CSS Gradient 发布分支；
- 不迁移或兼容旧 Wallpaper 静态产物、Snapshot、Receipt 或 Dashboard `contentShadow` 数据；硬切换后由
  新部署的默认值和用户下一次 Save 产生新模型数据。

## 2. 设计原则

### 2.1 Crash first

保存过程采用全有或全无语义：

```text
任一 render / encode / validate / upload 失败
  -> 终止整个临时批次
  -> 作废并删除本批次已上传的 generated assets
  -> 当前线上 Wallpaper 保持不变
  -> UI 显示 flash，提示用户重新保存
```

不实现以下恢复链路：

- 不从中间 Variant 继续；
- 不接管旧 Session 或旧批次的 ready 产物；
- 不恢复 conflicted Session；
- 不修补部分 Revision；
- 不自动合并两个 Tab 的变更；
- 不在 Phoenix、Worker 或后台任务中重新渲染；
- 不为业务保存过程建立复杂状态机。

浏览器能够明确感知失败或正常离开编辑页时，应 best-effort cancel 临时批次。浏览器崩溃、断网或
被强制关闭时无法可靠通知服务端，因此仍需要一个简单的临时批次 TTL：到期后直接删除仍归属于该
批次的 generated assets。TTL 是崩溃清理兜底，不是恢复窗口。

建议的 UI flash：

```text
普通失败：壁纸保存失败，本次生成的图片已作废，请重新保存。
并发冲突：壁纸已在其他页面更新，本次保存未生效，请确认当前内容后重新保存。
```

UI 可以保留当前未保存的本地编辑值，但下一次 Save 必须创建全新的批次并重新生成全部目标产物。

### 2.2 复用机制，不复用产品模型

Wallpaper 与未来 Cover 共享：

- WebGPU/WGSL 背景渲染能力；
- 浏览器多 Target 导出调度；
- encode、validate、checksum 和进度协议；
- Assets Hub 批量 intent、publish/delete claim、cancel/delete；
- `purpose`、`ownerRef`、`variantKey` 等通用资产元数据。

Wallpaper 与 Cover 不共享：

- authoring schema；
- Profile key 和选择规则；
- framing/crop 数据结构；
- 当前状态、历史和恢复规则；
- Revision 数据表；
- 通用 Publication 或通用业务状态机。

不提前建设 `GenericRevision`、`GenericPublication`、`GenericHistory` 或 polymorphic authoring JSON。
等 Wallpaper 与 Cover 都完成真实接入后，再从重复实现中提取小型 helper。

### 2.3 成功结果进入业务模型，失败过程留在临时批次

正式 `WallpaperSnapshot` 只表示一次成功发布过、可以被当前状态或历史引用的完整结果。
pending、ready、failed、conflicted 等上传过程不进入 Revision 生命周期。

```text
临时 Save Batch
  -> 全部 Variant 上传完成
  -> Assets Hub claimForPublish：原子校验并冻结 manifest，同时取得 publish claim
  -> Phoenix publishWallpaper：原子创建 Revision 并切换 State
  -> 创建正式 Theme Revision

临时 Save Batch
  -> claimForPublish 前失败或超时
  -> 删除临时产物
  -> 不创建正式 Theme Revision

已取得 publish claim 的 Batch
  -> publishWallpaper 失败、冲突或进程退出
  -> candidate Revision 不存在
  -> 作为 publish orphan 删除
  -> 删除临时产物
  -> 不创建正式 Theme Revision
```

## 3. 响应式 Profile 与构图

### 3.1 首期 Profile

首期覆盖所有目标设备宽高比：

```ts
type TWallpaperProfile = 'wide' | 'desktop' | 'tablet' | 'phone'

type TWallpaperProfileSpec = {
  key: TWallpaperProfile
  logicalWidth: number
  logicalHeight: number
  mediaQuery: string
}
```

每个 Profile 首期至少生成一个最终像素尺寸。多 DPR/width variant 是后续按清晰度、导出耗时和
R2 体积实测增加的能力，不在首期强制固定为 `1x + 2x`。

```ts
type TWallpaperVariantSpec = {
  key: string
  profile: TWallpaperProfile
  width: number
  height: number
  format: 'webp'
  quality: number
}
```

Profile 表达 viewport 场景和逻辑宽高比，Variant 表达实际输出像素。不同 Profile 必须独立构图，
不能先生成一张固定大图，再二次裁切冒充不同 Profile。

### 3.1.1 Static 与 Editor runtime 的 Profile 选择契约

`StaticWallpaper` 以 `wide` 为默认分支，再由 media query 覆盖：`<= 767px` 为 `phone`、
`768..1023px` 为 `tablet`、`>= 1024px` 且宽高比 `<= 16/10` 为 `desktop`，其余为 `wide`。client
renderer 的 Profile resolver 必须镜像这套 cascade 和边界；不能另外维护一套“近似” breakpoint。
Profile contract test 同时读取 `utils.css` 和 TS Profile spec，校验 base `wide`、每个 light/dark media block
及 `wide -> desktop` cascade 顺序；resolver 测试覆盖 `16/10` 等号边界。该测试锁定源码契约，真实浏览器的
computed-style matrix 仍属于跨浏览器验收。它不会执行 CSS cascade，也不能证明任意规则重排后的行为等价；
例如 media block 相对 base 的整体位置变化仍必须由浏览器矩阵发现。

有当前主题的 published Wallpaper 时，编辑页全屏 GPU 接管遵守以下规则：

```text
CSS media query / client resolver
  -> 同一个 active Profile
  -> Profile logical width/height 作为 renderer 构图尺寸
  -> backing store = logical size × min(devicePixelRatio, 2)
  -> canvas 与静态图片都在 viewport 内 cover center
```

其中 Profile logical size 决定 Pattern repeat、Gradient 中心和 framing；DPR 只提高栅格分辨率，不能改变
这些视觉参数。没有当前主题的 published Wallpaper 时，编辑页 CSS draft 与 client renderer 共同按实际 viewport
构图；AuthPreview、GlobalPreview 等卡片目标则按各自 DOM rect 构图。显式 export 始终使用 Target 的固定 logical/
pixel size，不读取设备 DPR。

因此“SSR 与 client 一致”不是要求静态 WebP 与 GPU canvas 逐像素同源，而是要求接管前后使用同一 Profile、
同一逻辑坐标系、同一 `cover center` presentation。React 没有 hydration warning 也不能证明这项视觉契约成立。

连续 resize 时 active Profile 必须立即跟随 CSS，但 GPU renderer Profile 可以等待 `150ms` 稳定后再替换。
等待期间立即撤销旧 Profile 的 ready handoff、显示静态层；不能通过给 TS resolver 增加 CSS 不具备的状态性
迟滞带来减少重建，否则会在迟滞区重新产生 CSS↔GPU Profile 分歧。

settle 只属于 client renderer 生命周期，不属于响应式 Profile 选择协议。当前首次 hydration 后从 SSR `wide`
校正到真实 client Profile 也会触发 settle；后续优化应在 hydration commit 后立即完成这一次初始化校正，再把
`150ms` 仅保留给用户 resize。禁止通过 render 阶段的 `typeof window` 分支绕开 SSR snapshot。

### 3.2 Profile source override

默认情况下，一个 theme 使用同一份 source 为所有 Profile 生成产物。数据模型预留按 Profile
覆盖 source/framing 的能力，后续 tablet/phone 可以上传专用素材；首期不要求用户逐个 Profile
完成手动构图。

```ts
type TWallpaperSource = {
  assetPublicRef: string
  width: number
  height: number
  mime: string
}

type TNormalizedPoint = {
  x: number
  y: number
}

type TNormalizedRect = {
  x: number
  y: number
  width: number
  height: number
}

type TWallpaperFraming =
  | {
      mode: 'crop'
      rect: TNormalizedRect
    }
  | {
      mode: 'focal'
      point: TNormalizedPoint
      zoom: number
    }

type TWallpaperProfileAuthoringConfig = {
  sourceOverride?: TWallpaperSource
  framing?: TWallpaperFraming
}

type TWallpaperThemeAuthoringConfig = {
  recipe: TWallpaperThemeConfig
  defaultSource: TWallpaperSource | null
  profileOverrides?: Partial<Record<TWallpaperProfile, TWallpaperProfileAuthoringConfig>>
}
```

默认构图是确定性的协议规则：

```text
图片且没有 Profile framing override
  -> focal point = (0.5, 0.5)
  -> zoom = 1
  -> center-cover

Gradient / Pattern / Texture 等程序化内容
  -> 使用完整 Profile 逻辑画布
```

坐标统一使用源图片的 `0..1` 归一化坐标，不保存 Editor DOM 像素。Editor 和 Export 必须调用
同一个 framing resolver：

```text
source image
  + Profile logical canvas
  + default framing / Profile override
  + Variant width/height
  -> source sampling rect
  -> WebGPU target texture
```

图片分辨率影响采样清晰度，但不改变归一化构图。上传阶段保存归一化方向后的源图宽高，导出前按
Variant 尺寸检查 source 是否满足最低清晰度要求。Pattern 尺寸和 Gradient 中心也必须使用归一化
坐标或 Profile 逻辑单位，不能依赖 backing pixel。

## 4. 共享浏览器导出与上传机制

### 4.1 中立的导出 Target

共享层只认识画布、最终像素和文件格式，不认识 Wallpaper Profile 或 Cover 用途：

```ts
type TImageExportTarget = {
  key: string
  logicalWidth: number
  logicalHeight: number
  width: number
  height: number
  format: 'webp' | 'png' | 'jpeg'
  quality?: number
}

type TExportedImageVariant = {
  targetKey: string
  width: number
  height: number
  mimeType: string
  blob: Blob
  checksum: string
}

type TImageExportProgress = {
  targetKey: string
  stage: 'render' | 'encode' | 'validate' | 'checksum' | 'upload'
  status: 'pending' | 'running' | 'done' | 'failed'
}
```

GraphQL 使用类型化 `WallpaperBatchVariantInput` 列表承载批次变体，Browser 不 stringify 固定结构；
Absinthe 将字段映射为内部 snake_case。事故时间线和当前边界见
[保存链路与数据边界](./save-pipeline-contract.md)。variants 不保留 camelCase/snake_case 双格式读取；
Assets Hub manifest 的 camelCase 由 `CMS.Assets.GeneratedBatch.PublishCapability` 负责解析和 digest 发射。

Wallpaper adapter 将 `TWallpaperVariantSpec` 转成 `TImageExportTarget`；未来 Cover adapter 将
article cover、card、share、Open Graph 等用途转成自己的 Target。中立 Target 和 adapter 命名在
Cover 真正接入前属于 provisional 内部契约；本期只保留直接的纯函数映射，不建设 adapter 注册表或
插件机制。

### 4.2 批量导出

Wallpaper 提交发生变化的 theme 和全部要求 Target：

```ts
type TRenderWallpaperThemeInput = {
  theme: 'light' | 'dark'
  renderSpec: TBgRenderSpec
}

type TRenderWallpaperBatchInput = {
  themes: TRenderWallpaperThemeInput[]
  targets: TImageExportTarget[]
}
```

批量实现必须：

- 只初始化一次 WebGPU device、pipeline 和共享资源；
- Pattern、Texture 和上传图片只加载/解码一次；
- 为每个 Target 创建独立输出 texture；
- Editor 与 Export 使用相同 shader、参数单位和 framing resolver；
- render、encode 和 upload 使用有限并发；
- 单个 Variant 完成后可以开始上传，不等待全部 Variant 编码完成；
- 任一 Variant 失败立即 cancel 整个批次；
- 普通路由不得加载导出 runtime。

WASM 只作为未来编码或 CPU 图像算法的可选优化，不引入第二套像素 renderer。Worker、Phoenix 和
普通服务端不运行 WebGPU，不后台补图。

### 4.3 临时 Generated Image Upload Batch

Assets Hub 提供短期临时批次：

```ts
type TGeneratedImageUploadBatchTarget = {
  candidateOwnerRef: string
  variantKey: string
  width: number
  height: number
  mimeType: string
}

type TGeneratedImageBatchClaim = {
  type: 'publish' | 'delete'
  key: string
  claimedAt: string
  expiresAt: string
}

type TGeneratedImageManifestEntry = {
  assetPublicRef: string
  candidateOwnerRef: string
  variantKey: string
  width: number
  height: number
  mimeType: string
  checksum: string
}

type TGeneratedImagePublishCapability = {
  batchRef: string
  purpose: string
  claimKey: string
  requestDigest: string
  requestDigestVersion: number
  manifest: TGeneratedImageManifestEntry[]
  manifestDigest: string
  policyVersion: string
  signingKeyId: string
  expiresAt: string
}

type TGeneratedImageUploadBatch = {
  publicRef: string
  purpose: string
  requestDigest: string
  requestDigestVersion: number
  expectedVariants: TGeneratedImageUploadBatchTarget[]
  expiresAt: string
  claim: TGeneratedImageBatchClaim | null
}
```

`purpose` 是 Phoenix 创建 Batch 时指定、并由 publish capability 绑定的开放字符串，例如
`wallpaper-render`、`cover-render`。Assets Hub 将它作为经过服务端授权的 opaque metadata，不维护
封闭 enum，也不接受 Browser 任意指定。`requestDigest` 及其 `requestDigestVersion` 同样由 Phoenix
在创建 Batch 时提供，Assets Hub 只负责原样持久化并签名绑定，不解析 Wallpaper authoring。

`candidateOwnerRef + variantKey` 在 Batch 内唯一，因此 light/dark 同时生成相同 Profile 时不会发生
Variant key 冲突。

临时批次内每个 Asset 记录：

```text
batchRef
candidateOwnerRef
variantKey
width / height / mime / checksum
storageKey
```

每个 Variant 先走既有的 per-asset intent、PUT 和 per-asset finalize（单 Asset 完成登记）；只有完成记录
已落库，`claimForPublish` 才能在冻结 manifest 中读取并校验该 Asset 的 checksum、尺寸和 MIME。这里的
per-asset finalize 不是 Batch 生命周期阶段，不恢复已删除的批次级 finalize。

规则：

- 批次只接受声明过的 Variant；
- 取得 publish claim 前，Batch 及其 generated assets 都是临时资源；
- `claimForPublish(batchRef, idempotencyKey)` 必须在 Assets Hub 的同一个事务/行锁内确认 Batch open、
  未过期且未被 claim，原子校验 Variant key、尺寸、MIME、checksum、数量和 owner，随后冻结 manifest、
  记录其 digest、写入 publish claim，并返回签名绑定 Batch `requestDigest`、完整 manifest、
  manifest digest 和 lease 的有期限 capability；
- manifest 冻结后不再接受上传或修改；相同 Batch 和 `idempotencyKey` 在 claim 有效期内重试时返回
  同一语义的 capability，不创建第二个 claim，不同 key 直接拒绝；
- manifest 校验失败时不保留可重试中间态：Batch 原子转入 delete claim，拒绝发布并显示重新保存
  flash；
- 每个 Asset 从创建时就携带 Phoenix 预分配的 `candidateOwnerRef`，发布后不再执行跨服务归属迁移；
- Browser cancel、open Batch expiry 和服务端清理都通过 `claimForDelete(batchRef, cleanupKey)` 取得
  delete claim 后删除；已有 publish claim 时 Browser cancel 必须被拒绝；
- `claimForPublish` 与 `claimForDelete` 在 Assets Hub 内对同一个 `claim` 字段执行原子
  compare-and-set，只有一方能够成功；
- publish claim 成功后 cleanup 不能获得 delete claim；delete claim 成功后 `publishWallpaper` 必须
  失败并显示 flash；
- Phoenix 已知发布失败时，只有当前 publish claim 持有者可以携带相同 key 将它原子转成 delete
  claim；未知进程崩溃只能等待 lease 和 safety margin 后由 reconciliation 转换；
- 删除依据数据库登记的 `storage_key`，不能依赖 R2 prefix 扫描；
- 物理删除任务可以幂等重试，但产品保存流程不等待或恢复删除任务。

`claimForPublish` 将“完整性校验、manifest 冻结和发布/删除互斥”收敛为一次原子操作，不再保留独立
完成接口、完成时间字段或第二套 orphan TTL。Browser 在全部上传完成后、claim 前崩溃时，Batch 仍为
open，由原有 open Batch TTL 删除。清理任务也必须先取得 delete claim，才能执行最终引用复核和物理
删除；删除前的正式 Revision 引用复核只是第二道安全检查。

publish claim 使用有期限 capability，但不能在 capability 到期瞬间立即转为 delete claim。Phoenix
只有在剩余 claim 时间大于配置的 `publishTransactionBudget` 时才能开启事务，并必须设置更短的数据库
事务超时；stale claim 清理只能在 `claim.expiresAt + publishTransactionSafetyMargin` 之后执行。此时
任何持有该 capability 的事务都已经不可能再合法提交。

安全窗口结束后，Assets Hub/Phoenix reconciliation 查询 `candidateOwnerRef`：正式 Revision 已存在
则视为发布成功，只清理 Batch 元数据；不存在则将 stale publish claim 转为 delete claim 并删除
publish orphan。该过程不会继续执行用户发布，也不会后台补渲染。

## 5. Wallpaper 产品模型

### 5.1 CommunityWallpaper 聚合行

历史设计中的聚合行保存当前 light/dark 引用；当前实现仍使用一条 `CommunityWallpaper` 聚合行，但每笔
保存只更新当前 theme 的一支指针，不再要求两支指针作为一组切换：

```ts
type TCommunityWallpaper = {
  communityId: string
  publicRef: string
  version: number
  activeLightSnapshotRef: string | null
  activeDarkSnapshotRef: string | null
  updatedAt: string
}
```

`version` 同时用于乐观并发和 Wallpaper 缓存失效。当前保存事务锁定该聚合行，只更新当前 theme 指针，
并将 Snapshot、Images、`version + 1` 和 Receipt 一起提交；另一支指针保持原值。没有整组恢复或
light/dark 组合审计需求，因此不增加 `WallpaperPublication`。

### 5.1.1 Editor snapshot 的默认值与空值边界

`CommunityWallpaper` 可以在第一次 Wallpaper Save 之前不存在，但这不代表编辑器的设置分支为空。
`wallpaperSettings` 在以下情况下必须返回非空的 `light/dark` JSON：

- 没有聚合行：调用 `DashboardFields.wallpaper_default()` 返回两个默认分支，`version=0`，
  历史为空；
- State 存在但某个 theme 没有 active Revision：该 theme 调用
  `DashboardFields.wallpaper_bg_default()` 返回同一份默认分支；
- theme 被明确保存为 `NONE`：返回 `{ "type": "none" }`，不能与未设置的默认配置混淆。

`wallpaper_default()` 本质上用同一份 `wallpaper_bg_default()` 组装 light/dark，因此两个调用点共享一个
后端默认值 source of truth。

因此 GraphQL `wallpaperSettings.light` 和 `wallpaperSettings.dark` 是 non-null。默认配置只由后端
Dashboard Fields 提供，前端不得复制默认 source、颜色或其他 Wallpaper 字段。前端可以把不符合契约
的旧缓存/异常响应中的 `null` 归一为“未提供”，交给已有 Store 初始化安全网处理，但不能把这个防御
分支当作业务默认值来源。

这条规则只适用于编辑器 settings。`wallpaper` 外层始终非空，但其 theme branch 仍可以为
`null`：它表示尚未生成可供普通路由消费的静态产物；普通路由在这种情况下只显示 Root page color，
不启用 Content surface 的半透明颜色或 blur。

> 历史章节说明：5.2–6.4 中保留的 `WallpaperThemeRevision`、旧 authoring payload 和双支保存步骤，
> 仅用于记录迁移前的设计背景，不是当前实现清单。当前 Snapshot、Settings、单 theme 保存、NONE 和
> restore 契约以 [当前 theme 单独保存重构](./current-theme-save-refactor.md) 与
> [保存链路与数据边界](./save-pipeline-contract.md) 为准。

### 5.2 WallpaperThemeRevision

Revision 是 light/dark 独立的成功快照和删除单位：

```ts
type TWallpaperThemeRevision = {
  publicRef: string
  communityId: string
  theme: 'light' | 'dark'
  sourceBatchRef: string | null
  recipeSchemaVersion: number
  rendererVersion: number
  profileVersion: number
  authoring: TWallpaperThemeAuthoringConfig | null
  createdBy: string
  insertedAt: string
  activatedAt: string
  historyUsedAt: string
  deleteAfter: string | null
}
```

`authoring: null` 表示该 theme 明确保存为 `NONE`。NONE 是正式 Revision，能够进入最近 5 次和被
恢复，但不生成静态 Variant。非 NONE Revision 的 `sourceBatchRef` 必须记录生成其完整 manifest 的
Batch ref；NONE Revision 没有 Batch，必须为 `null`。后端数据库字段名为 `source_batch_ref`。

`sourceBatchRef` 是不可变的产物来源审计链接，不阻止成功 Batch 的运行期 claim/lease 元数据清理。
Batch 生成的 Asset 仍保留各自 `batchRef`，因此 Publish Receipt GC 后仍可断言同一 Revision 的所有
generated assets 均来自 `sourceBatchRef` 指向的同一批次。

Revision 不保存 `pending/ready/active/retained/retired/deleting/failed` 状态：

- 尚未成功提交的内容属于临时批次，不是 Revision；
- 被 State 引用即为 active；
- 未被 State 引用、`deleteAfter=null` 即为可恢复历史；
- `deleteAfter` 非空即已退出历史并等待删除；
- 物理删除完成后删除 Revision 业务记录，不保留复杂 tombstone。

### 5.3 WallpaperThemeRevisionAsset

```ts
type TWallpaperThemeRevisionAsset = {
  themeRevisionRef: string
  variantKey: string
  profile: TWallpaperProfile
  width: number
  height: number
  format: 'webp'
  checksum: string
  assetPublicRef: string
}
```

checksum 只用于上传完整性和批次校验，不做跨 Revision 去重。每个 Revision 的 generated variants
拥有独立 Object；source Asset 可以被多个 Revision 共享。

### 5.4 WallpaperPublishReceipt

幂等发布结果由 Phoenix 持久化，不能依赖最终会被清理的 Assets Hub Batch 元数据。一次 Save 可能
创建一条或两条 Theme Revision，也可能是纯 NONE 或 no-op，因此 `idempotencyKey` 不属于某一条
Revision。

```ts
type TPublishWallpaperResult = {
  statePublicRef: string
  stateVersion: number
  createdThemeRevisionRefs: string[]
}

type TWallpaperPublishReceipt = {
  communityId: string
  idempotencyKey: string
  requestDigest: string
  requestDigestVersion: number
  responsePayload: TPublishWallpaperResult
  insertedAt: string
  expiresAt: string
}
```

数据库必须对 `(community_id, idempotency_key)` 建唯一约束。Receipt 与 Theme Revision、
RevisionAsset 和 Wallpaper State 在同一个 Phoenix 事务中写入，保证 State 发布成功时一定存在对应
Receipt，事务失败时也不会留下虚假的成功 Receipt。

相同 key 重试时 Phoenix 先查询 Receipt，并按 Receipt 的 `requestDigestVersion` 重算：
`requestDigest` 相同则直接返回保存的 `responsePayload`，
不访问 Assets Hub，也不要求原 Revision 仍在最近 5 次；digest 不同则拒绝，不能把一个 key 用于两次
不同用户操作。`createdThemeRevisionRefs` 和 `responsePayload` 是响应快照，不建立阻止 Revision 淘汰的
外键。Receipt 是有期限的轻量幂等记录，不参与 Wallpaper 历史、active 引用或 Asset 删除。

## 6. Save 与原子切换

### 6.1 正常保存

`publishWallpaper` 的请求契约为：

```ts
type TPublishWallpaperInput = {
  baseStateVersion: number
  idempotencyKey: string
  batchRef: string | null
  candidateThemeRevisionRefs: Partial<Record<'light' | 'dark', string>>
  authoring: Partial<Record<'light' | 'dark', TWallpaperThemeAuthoringConfig | null>>
}
```

`communityId` 由已鉴权的 API scope/route 提供，不接受 Browser 在载荷中任意指定。第一次提交和
`publishWallpaper` 都以 `communityId + baseStateVersion + canonical authoring` 计算同一个
`requestDigest`；服务端生成的 `batchRef` 和 `candidateThemeRevisionRefs` 不进入 digest。创建 Batch
时 Phoenix 选择当前 `requestDigestVersion`，发布时必须按 capability 指定的同一版本调用服务端
canonicalization 函数重新计算，不能信任 Browser 提交的 digest。非 NONE candidate ref 必须与冻结
manifest 的 `candidateOwnerRef` 一致；`batchRef` 必须与 capability 一致。纯 NONE 请求的
`batchRef=null`，其 candidate ref 由步骤 3 预分配并在事务唯一约束下创建。

```text
1. Browser 提交 baseStateVersion、本次 light/dark authoring 和 idempotencyKey
2. Phoenix 查询 Publish Receipt；命中时按 Receipt.requestDigestVersion 重算并比较 digest，相同则
   直接返回历史结果；未命中时按当前 requestDigestVersion 计算 requestDigest
3. Receipt 未命中时校验 authoring，预分配 candidate Theme Revision refs
4. 如果存在变化且非 NONE 的 theme，创建绑定 requestDigest 和 requestDigestVersion 的临时 Batch，
   并返回 required targets
5. Browser 为这些 theme 批量 WebGPU 导出并上传全部 Variant
6. 任一 Variant 失败：cancel Batch、显示失败 flash、流程结束
7. Browser 携带 batchRef、idempotencyKey、candidateThemeRevisionRefs、authoring 和
   baseStateVersion 请求 Phoenix publishWallpaper
8. Phoenix 再次查询 Publish Receipt，处理响应丢失后的重复请求
9. Receipt 未命中时调用 Assets Hub claimForPublish(batchRef, idempotencyKey)
10. Assets Hub 在一次原子操作内校验并冻结完整 manifest、取得 publish claim，并返回有期限的
    publish capability；capability 同时携带签名绑定的 requestDigest、requestDigestVersion、冻结
    manifest 和 manifestDigest
11. Phoenix 在事务外按 capability.requestDigestVersion 重新计算 requestDigest，并校验它与
    capability.requestDigest 相同；同时校验 capability 签名、policyVersion、manifestDigest、
    candidateOwnerRef、candidate Revision refs 和 Wallpaper required target 矩阵，预检剩余时间足以
    覆盖 publishTransactionBudget，并配置更短的事务 timeout
12. Phoenix 开启数据库事务
13. 在事务 callback 开始时按服务端 UTC 重新断言 remaining lease > publishTransactionBudget
14. 在事务内最后一次查询 Publish Receipt，命中则返回已有结果
15. 锁定 CommunityWallpaperState，并断言当前 version 等于 baseStateVersion
16. 重新校验 capability 有效期，并使用步骤 11 已验证且由 digest 绑定的同一份冻结 manifest
17. 创建发生变化的正式 Theme Revision 和 RevisionAsset，并为非 NONE Revision 写入 sourceBatchRef
18. 原子更新 active light/dark refs，并将 version + 1
19. 重新计算 light/dark 合计最近 5 次并安排超额 Revision 删除
20. 写入包含发布响应的 WallpaperPublishReceipt
21. 在 capability 有效期内提交事务，失效 Snapshot 缓存并返回成功
```

步骤 12～21 是同一个 Phoenix 数据库事务。步骤 11 只是减少无效事务的预检，步骤 13 才是 lease
正确性断言；claim 获取、预检与事务开始之间的调度时间不能计入可用预算。Assets Hub 必须先完成
manifest 完整性校验、冻结并授予 publish claim，Phoenix 才能创建正式 Revision；线上 State 因此
不会引用未被完整 publish manifest 覆盖的 Asset。Asset 的 `candidateOwnerRef` 在创建 Batch 时已经
固定，不存在 Phoenix 发布后再跨服务迁移 Asset 归属的步骤。Assets Hub 负责验证物理 Asset 事实；
Phoenix 仍负责验证 manifest 是否满足 Wallpaper 当前 profileVersion 的产品矩阵，两层校验职责不同。
冻结 manifest 随签名 capability 一次返回，Phoenix 不在数据库事务内再次调用 Assets Hub。事务外先
验证签名、digest 和产品矩阵，事务内只消费由同一 digest 绑定的 manifest 并重验 lease，从而避免把
跨服务网络延迟计入数据库事务预算。

Batch 创建时绑定由 Phoenix 根据 canonical authoring 计算的 `requestDigest` 及其算法版本，publish
capability 签名回显二者；`publishWallpaper` 必须按该版本重新计算并比对，保证创建 Batch 与发布
Revision 使用相同的声明 authoring。该绑定防止两次请求中的 recipe 内容被意外替换，但不提供 recipe
与 Browser 上传像素之间的像素级证明；浏览器导出产物仍属于客户端信任边界。唯一约束和事务内
Receipt 查询共同处理并发重复请求；相同
`idempotencyKey + requestDigest` 返回同一个持久化响应，不能重复创建 Revision。

### 6.2 失败和浏览器退出

取得 publish claim 前的已知失败统一处理：

```text
cancel Batch
  -> 作废全部 Variant
  -> Assets Hub 删除本批次 generated assets
  -> 当前 Wallpaper State 不变
  -> UI 显示 flash
```

如果删除请求暂时失败，由 Assets Hub 的幂等物理删除任务继续处理；Wallpaper 不维护一条可恢复的
失败工作流。

浏览器在 `claimForPublish` 前崩溃或无法发送 cancel 时：

```text
Batch expiresAt 到期
  -> 原子取得 delete claim
  -> 删除整个 Batch
```

`claimForPublish` 会原子校验并冻结 manifest。校验失败时 Batch 直接转入删除且 UI 提示重新保存；
成功取得 publish claim 后只有以下结果：

```text
publish claim 胜出，Phoenix publishWallpaper 成功
  -> candidate Revision 成为正式 Revision
  -> Assets 由正式 Revision 引用

delete claim 胜出
  -> publishWallpaper 直接失败
  -> UI 显示 flash

publish claim 胜出，但 Phoenix publishWallpaper 冲突、失败或未执行
  -> candidate Revision 不存在
  -> 已知失败时服务端使用 publish claim 将 Batch 转入删除
  -> 进程崩溃时由 stale publish claim reconciliation 判定并删除
```

Phoenix 事务成功但浏览器没有收到响应时，相同 `idempotencyKey + requestDigest` 的重试先从 Phoenix
Publish Receipt 返回原 `responsePayload`，不依赖 Assets Hub Batch 元数据仍然存在，也不重新 claim。
reconciliation 会因为正式 Revision 存在而只清理 Batch 元数据，不删除 Asset。系统不需要重放
Asset 归属迁移。

发布成功路径不向 Assets Hub 同步发送 Batch/claim 元数据清理请求，也不等待清理完成。无论客户端
是否收到成功响应，成功 Batch 元数据都统一由周期 reconciliation 在确认正式 Revision 存在后清理；
该清理结果不影响 `publishWallpaper` 的成功语义。

### 6.3 并发冲突

两个 Tab 可以并行导出，但只有基于当前 `version` 的批次可以提交：

```text
Tab A: baseVersion=12 -> publish -> State version=13
Tab B: baseVersion=12 -> publish -> conflict
```

Tab B 的整个临时 Batch 立即作废和删除，不接管、不复用、不自动合并。UI 保留当前本地编辑值并显示
冲突 flash；用户确认内容后重新 Save，新 Save 使用最新 State version、全新的 `idempotencyKey` 和
全新 Batch，并重新生成全部目标产物。冲突后的操作是新的用户意图，不能沿用旧 key。

### 6.4 removeWallpaper / NONE

`removeWallpaper()` 只修改当前编辑的 theme：

- 为该 theme 创建 `authoring: null` 的正式 Revision；
- 不创建 generated variants；
- 与另一支当前引用一起原子提交；
- NONE 计入最近 5 次，并可以恢复；
- light/dark 都为 NONE 时，State 仍是已发布状态；Editor snapshot 两个 branch 都返回
  `{ "type": "none" }`，StaticWallpaper snapshot 的两个 branch 才返回 `null`。

只有存在变化且非 NONE 的 theme 时才创建 Generated Image Upload Batch：

```text
全部变化都是 NONE
  -> 不创建 Batch
  -> Phoenix 直接在事务内创建 NONE Revision、切换 State 并写入 Publish Receipt

一支非 NONE + 另一支 NONE
  -> Batch 只包含非 NONE 分支的 Variants
  -> Phoenix 在同一事务中创建正常 Revision 和 NONE Revision

没有任何变化
  -> 不创建 Batch 或 Revision，返回当前 State 并写入 Publish Receipt
```

从未成功保存过的 Community 可以没有 Wallpaper State，或拥有两个 active ref 都为空的初始 State；
运行时语义均为未发布 Wallpaper。

## 7. 最近 5 次与恢复

### 7.1 保留规则

light/dark 合计保留最近 5 个 post-cutover 不同 Theme Revision，不为任一 theme 设置历史保底；pre-cutover
数据不进入该集合：

1. 当前 active light/dark 永远不能删除，并计入 5 个名额；
2. 其余 Revision 按 `historyUsedAt DESC` 排序；
3. 从最新到最旧填满剩余名额；
4. 超出的 Revision 退出可恢复历史并设置 `deleteAfter`；
5. 保存 light 时只创建新的 light Revision，不能连带删除当前 dark；
6. 不常修改的一支可能没有任何历史，这是统一最近 5 次策略的预期结果。

只修改一个 theme 时，另一支 active Revision 被动复用，不更新其 `historyUsedAt`。用户明确恢复某个
Revision 时更新该 Revision 的 `historyUsedAt`。

### 7.2 恢复

恢复只操作已经成功发布、仍在最近 5 次且 `deleteAfter=null` 的 Revision：

```text
1. Browser 提交 baseStateVersion 和目标 Theme Revision ref
2. Phoenix 锁定 CommunityWallpaperState
3. 断言 version 未变化
4. 校验 Revision theme、Asset manifest 和 profileVersion
5. 只替换该 theme 的 active ref
6. version + 1
7. 更新 historyUsedAt / activatedAt
8. 重新计算最近 5 次
9. 失效 Snapshot 缓存
```

Restore 不创建 Upload Batch，不运行 WebGPU，不复制 Asset，不重新上传，也不建立 Save Session。
发生并发冲突时直接失败并显示 flash，用户重新选择恢复即可。

恢复能力拆成：

```text
activatable
  = required variants 完整可读
  + profileVersion 被 StaticWallpaper 支持

editable
  = recipeSchemaVersion 可解码或存在 migration adapter
```

recipe 不可编辑但静态产物完整时，可以只激活静态版本；`rendererVersion` 不一致不阻止已有静态
产物激活。任何兼容性问题都不能在恢复操作中触发静默重渲染。

### 7.3 发布后淘汰和删除

超出最近 5 次的 Revision 立即从历史隐藏并设置：

```text
deleteAfter = now
  + max Snapshot TTL
  + CDN stale window
  + client safety margin
```

到期后再次确认：

- Revision 不是当前 active light/dark；
- Revision 不在最近 5 次；
- generated assets 没有其他业务引用。

确认后将该 Revision 的 generated asset refs 批量交给 Assets Hub 删除。删除成功后删除
RevisionAsset 和 Revision 记录。删除任务必须幂等，但不为业务层暴露 deleting/deleted 状态。

无限期打开的旧页面与“历史 Object 最终物理删除”不能同时获得绝对零 404 保证；产品通过宽限期
定义接受边界。

source Asset 与 generated variant 必须区分：

- 淘汰 Revision 只删除其 generated variants；
- 任一未删除 Revision 仍引用 source Asset 时，Assets Hub 必须拒绝删除原图；
- source Asset 的引用保护需要覆盖 Wallpaper 和未来 Cover authoring。

## 8. 静态消费契约

普通消费者只读取当前 State 对应的静态资源：

```ts
type TStaticWallpaperVariant = {
  assetPublicRef: string
  url: string
  width: number
  height: number
}

type TStaticWallpaperTheme = {
  themeRevision: string
  profileVersion: number
  variants: Partial<Record<TWallpaperProfile, TStaticWallpaperVariant[]>>
}

type TStaticWallpaper = {
  state: string
  version: number
  light: TStaticWallpaperTheme | null
  dark: TStaticWallpaperTheme | null
} | null
```

语义：

- 外层 `null`：从未按新模型成功发布；
- theme branch 为 `null`：当前 branch 没有可供消费者使用的静态图片；正常来源是未设置或明确为
  NONE；
- light/dark 都为 `null` 且外层非空：已发布的空 Wallpaper；
- 非空 branch 必须包含其 `profileVersion` 要求的全部 Variant。

active manifest 损坏时，Snapshot 也会将对应 theme 临时降级为 `null` 并触发高优先级报警。该异常
降级只影响当前静态输出，不能被解释为用户发布了 NONE，也不能改写 Wallpaper State；普通消费端
仍统一显示 Root page color，Editor/Phoenix 通过 Revision 数据和报警区分真实 NONE 与损坏降级。

SSR 输出当前 State 的 light/dark 双分支，并按各 Revision 自身 `profileVersion` 展开全部候选 URL。
pre-paint 的 `html[data-theme]` 选择 light/dark，media query/`<picture>`/`image-set` 选择具体 Profile
和可选的 width variant。SSR 不猜 viewport，也不只输出单一图片。

静态 Asset URL 不可变并长期缓存；State/Snapshot 使用可失效的短缓存。普通路由不读取 authoring、
不加载 WebGPU、shader 或 Editor runtime。

### 8.1 profileVersion 演进

StaticWallpaper 在升级窗口内可以同时支持多个 `profileVersion`：

```text
已有 active Revision
  -> 继续使用自身完整矩阵

新 Save
  -> 使用 latestProfileVersion

StaticWallpaper
  -> supportedProfileVersions
```

先发布支持新旧版本的消费者，再让新 Save 使用新版本。旧版本 active 数量归零前不能停止支持；
不能要求 Phoenix/Worker 补渲染。需要升级的旧 Revision 由用户重新 Save，或未来通过受控浏览器工具
重新生成，不在运行时静默处理。

## 9. Cover 与后续产品扩展

### 9.1 Cover 复用什么

Cover 后续需要多用途输出，例如：

```ts
type TCoverOutputProfile = 'article-cover' | 'community-card' | 'share-card' | 'open-graph'
```

具体 Profile 和尺寸由真实消费入口确认。Cover 复用：

- `TImageExportTarget`、结果和进度协议；
- WebGPU 背景能力；
- 浏览器批量导出调度；
- Generated Image Upload Batch；
- Assets Hub/R2 上传和删除协议。

### 9.2 Cover 不复用什么

Cover authoring 继续由 `TCoverConfig` 表达，包括图片图层、crop、position、rotate、shadow、border、
magnifier 和背景。Wallpaper 的 `TWallpaperFraming` 不能替代 Cover crop。

Cover 当前没有用户可见历史需求，因此不提前建设：

- Cover 最近 N 次；
- Cover 恢复；
- Cover retained/history 状态；
- 通用 Revision/Publication/History 表。

Cover 可以使用简单的当前 authoring + active Render Set：

```text
CoverState
  -> current authoring
  -> activeRenderSetRef

CoverRenderSet
  -> article-cover
  -> community-card
  -> share-card
  -> open-graph
```

新 Render Set 全部生成成功后一次性切换；旧 Render Set 只保留缓存删除宽限期，然后物理删除。这个
短期保留不是用户历史。Cover 保存期间的临时导出复用 Batch claim、expiry 和 cancel/delete；正式
切换后，旧 Render Set 设置 `deleteAfter`，到期时再次确认它不是 active 且没有业务引用，再批量删除
generated assets。已发布 Render Set 的淘汰不依赖最终会被清理的临时 Batch 元数据，也不为此增加
历史或状态机。

### 9.3 何时继续抽象

Wallpaper 和 Cover 都完成后，只在出现真实重复时提取：

- export target 转换和批量调度；
- manifest 完整性校验；
- generated asset 批量删除提交；
- source/generated 引用保护；
- 简单的删除宽限期计算。

历史数量、active 状态、NONE、light/dark 和 Profile 选择继续由各产品负责。

## 10. Phoenix、Assets Hub 与 R2 边界

### 10.1 Phoenix

Phoenix 负责 Wallpaper 业务：

- 校验 authoring 并确定 required targets；
- 预分配 candidate Revision refs；
- 锁定 State、校验 base version 并原子切换 light/dark；
- 只在成功 `publishWallpaper` 时创建正式 Revision；
- 为非 NONE Revision 持久化不可变的 `sourceBatchRef` 产物来源；
- 管理统一最近 5 次和 Restore；
- 计算已发布 Revision 的删除宽限期；
- 失效当前 Wallpaper Snapshot。

### 10.2 Assets Hub

Assets Hub 负责通用资产机制：

- 临时 Generated Image Upload Batch；
- 批量 intent、publish/delete claim、cancel/delete；
- Variant manifest 和通用元数据；
- Batch expiry 清理；
- CommunityAsset、R2 Object 和物理删除重试；
- 删除前的最终业务引用保护。

Assets Hub 不理解 light/dark、最近 5 次、NONE 或 Cover 产品语义。

### 10.3 R2

R2 只保存 Object，不是历史或引用关系的事实来源。正式 key 可以保留 owner 级运维前缀：

```text
communities/{community}/generated/wallpaper/{themeRevisionRef}/
  wide.webp
  desktop.webp
  tablet.webp
  phone.webp
```

未来增加多个 width variant 时使用稳定扁平文件名，例如 `desktop-1600.webp`。R2 没有真正目录；
删除清单以数据库 `storage_key` 为准。

## 11. Reconciliation 与安全边界

Reconciliation 与异常处理分成三类。

自动执行的机械清理：

- cancel/open expired Batch 先原子取得 delete claim，再删除临时 generated assets；
- stale publish claim 到期并经过 `publishTransactionSafetyMargin` 后查询 candidate Revision：存在则
  只清理 Batch 元数据，不存在则转为 delete claim 并删除 publish orphan；
- 成功发布的 Batch/claim 元数据也统一由周期 reconciliation 清理，`publishWallpaper` 成功路径不
  同步等待或触发该清理；
- 超过 `publishReceiptRetention` 的 WallpaperPublishReceipt 由 Phoenix 周期 reconciliation 清理；
- 已到 `deleteAfter` 且确认无引用的 Revision 删除 generated assets；
- Assets Hub 重试中断的物理删除；
- 删除不存在业务引用的确定性 orphan。

运行时自动保护但不修改业务选择：

- 删除任务发现 Revision 被当前 State 引用时必须停止删除并报警；
- active Revision 的 `deleteAfter` 非空时必须取消对应物理删除任务并报警；
- Snapshot 构建发现 active manifest 不完整时不得输出破损 URL，该 theme 暂时返回 `null` 并触发
  高优先级报警；
- open Batch 清理发现 publish claim，或 publish orphan 清理发现正式 Revision 引用时，必须停止删除。

由 Phoenix 业务告警负责人按 runbook 人工处理、不能自动猜测修复的不变量：

- State 的 light ref 只能指向 `theme=light` Revision；
- State 的 dark ref 只能指向 `theme=dark` Revision；
- active 非 NONE Revision 必须拥有自身 `profileVersion` 要求的完整 manifest；
- active Revision 的 `deleteAfter` 必须为空；
- 最近集合包含 active light/dark 且总数不超过 5；
- 非 NONE Revision 的 `sourceBatchRef` 必须非空，其正式 RevisionAsset 只能引用冻结 publish
  manifest 内、`batchRef` 等于该 `sourceBatchRef` 的 Asset，且 Asset 的 `candidateOwnerRef` 必须等于
  Theme Revision ref；
- 拥有 generated variants 的非 NONE 正式 Revision 必须来自一个由相同 `idempotencyKey` 成功
  `claimForPublish` 并冻结完整 manifest 的 Batch；该条件在发布事务中强制校验，Batch 运行期元数据
  GC 后由 Revision 的 `sourceBatchRef` 与 Asset 的 `batchRef` 持续核验产物来源；
- NONE Revision 必须 `authoring=null` 且没有 generated variants，可以直接在 Phoenix 事务中创建，
  `sourceBatchRef=null`，不依赖 Batch 或 publish claim；
- 每次成功的 `publishWallpaper` 必须存在同事务写入的 Phoenix Publish Receipt；相同
  `(communityId, idempotencyKey)` 只能对应一个 `requestDigestVersion`、`requestDigest` 和响应结果。

人工处理只能修正被确认的数据错误或要求用户重新 Save；系统不能自动选择另一个 Revision 修复
active State，也不能后台重新渲染缺失图片。Assets Hub 只负责资产侧保护和物理清理重试，Phoenix
负责业务告警及 runbook。

## 12. 实施与硬切换

### 12.1 实施前确认

- wide、desktop、tablet、phone 的逻辑宽高比、media query 和首期像素尺寸；
- WebP quality、单文件和整批体积预算；
- render/encode/upload 并发上限；
- open Batch TTL、publish claim TTL、`publishTransactionBudget` 和 `publishTransactionSafetyMargin`；
- Phoenix `databaseTransactionTimeout`、Assets Hub/Phoenix 最大时钟偏差和 cleanup 调度抖动；
- Assets Hub capability active signing key/key id，以及 Phoenix trusted verification key set；
- Phoenix active/supported `requestDigestVersion` 和对应 canonicalization 实现；
- Phoenix `publishReceiptRetention`，即 API 承诺幂等重放的时间窗口；
- Snapshot TTL、CDN stale window、client safety margin 和已发布 Revision 删除宽限期；
- `profileVersion` 与默认 center-cover/framing resolver 规则。

lease 参数必须满足以下硬约束，不能独立随意取值：

```text
databaseTransactionTimeout
  < publishTransactionBudget
  < publishClaimTtl

remainingPublishClaimTtlAtTransactionStart
  > publishTransactionBudget

publishTransactionSafetyMargin
  >= databaseTransactionTimeout
   + maxClockSkew
   + cleanupSchedulingJitter
```

`databaseTransactionTimeout` 是从 Phoenix 事务 callback 开始计算的事务整体壁钟上限，必须覆盖
`SELECT ... FOR UPDATE` 的 State 行锁等待、Receipt 查询、所有读写语句和最终 commit；只配置单条
业务语句的 timeout 不能替代该约束。数据库支持事务级 timeout 时优先使用；否则应用层 watchdog
必须能够取消数据库查询并保证整个事务回滚。`statement_timeout`、`lock_timeout` 可以作为额外保护，
但不能单独充当事务整体预算。

claim capability 使用 Assets Hub 服务端签发的 UTC 绝对时间，Phoenix 不信任客户端时间。claim 获取
后的事务外检查只是预检，必须在事务 callback 开始时按服务端 UTC 重新计算剩余 lease；不足时直接
回滚并显示重新保存 flash。不能依赖 claim 获取与事务开始之间的时间，也不能延长旧 Batch 后继续
发布。

这些参数属于一份版本化的跨服务 lease policy，而不是散落的常量。Assets Hub 集中配置并在启动时
断言 claim TTL、safety margin、时钟偏差和清理抖动关系；Phoenix 集中配置并在启动时断言事务 timeout、
transaction budget 与其接受的最小 claim TTL 兼容。publish capability 必须携带绝对 `expiresAt`、
policy version、Batch `requestDigestVersion`、`requestDigest`、冻结 manifest 及其 digest。任一启动
断言失败时服务不得接收流量，并通过配置测试覆盖所有不等式。

签名配置同样必须通过启动断言：Assets Hub 必须存在唯一 active signing key 和非空 key id；Phoenix
必须存在非空 trusted verification key set，并能按 capability key id 找到验证密钥。未知 key id、
验签失败或签名算法不在允许列表时一律拒绝发布。密钥轮换遵循先消费后签发：先向 Phoenix trust set
加入新 verification key，再让 Assets Hub 切换 active signing key；旧 capability 全部过期后才能从
Phoenix 移除旧 verification key。私钥只存在于 Assets Hub，不跨服务共享。

`policyVersion` 升级使用 expand-contract 顺序：先让 Phoenix 同时支持 old/new，且暂不提高最低接受
版本；再让 Assets Hub 开始签发 new；等待所有 old publish claim 过期并完成 reconciliation 后，Phoenix
才提高最低接受版本并移除 old。Phoenix 必须拒绝不在支持集合内或低于当前最低接受版本的
capability，不能先提高最低版本再升级签发方。

`requestDigestVersion` 独立于 lease `policyVersion`。以下是未来确实需要滚动升级时的通用协议规则：
canonicalization 在 Phoenix 滚动部署期间保持兼容；同一 Save 的建批和发布可能由不同实例处理，Receipt
重放也可能发生在后续版本，因此先部署同时支持 old/new digest 的 Phoenix，确认所有实例均支持 new 后再切换
active digest version；只有使用 old 的 open Batch、publish claim 和未过期 Receipt 全部排空后，才可删除 old
canonicalization。正常的协议升级按 capability 版本重算、按 Receipt 版本重放，未知版本一律拒绝。本次
Wallpaper hard cut 不启用该历史兼容窗口：pre-cutover Batch/claim/Receipt 不进入新的 restore 或
idempotency replay，并在切换时退出旧数据生命周期。每个版本必须提供固定输入/输出的 golden fixtures，覆盖对象 key 顺序、缺省字段、数值
规范化和新增可选参数；禁止直接依赖普通对象序列化的隐式顺序，新增字段也不能静默改变旧版本结果。

### 12.2 可以提前上线的基础设施

以下能力可以提前部署，但保持正式入口关闭：

1. `TImageExportTarget`、结果和进度契约。
2. WebGPU Wallpaper batch export。
3. Assets Hub 临时 Batch、批量 intent/cancel、原子“manifest 校验冻结 + publish claim”、delete
   claim、lease capability 签发和 expiry cleanup。
4. Wallpaper State、Theme Revision 和 RevisionAsset schema。
5. Snapshot 新契约的服务端实现。

### 12.3 单一硬切换发布点

以下用户可见链路必须通过同一个 release gate 同时切换：

1. Editor 从 `CommunityWallpaper` + 当前 theme 的 active Snapshot settings 初始化。
2. Save 使用临时 Batch、完整矩阵和原子 `publishWallpaper`。
3. `dashboard.wallpaper`/StaticWallpaper 只读取新聚合行和响应式 Profile 图片。
4. Phoenix 关闭旧 v1 Wallpaper mutation/write path。
5. 未按新模型保存的 Community 返回外层非空的 `dashboard.wallpaper`，其 theme branch 为 `null`，
   Root page canvas 继续绘制不透明页面基础颜色，Content surface 不启用透明度或 blur。

不允许出现新读旧写、旧读新写或 recipe 已保存但静态产物未发布的生产中间态。

硬切换不迁移历史数据，不提供 v1/v2 联合类型或 runtime fallback。旧字段可以为滚动发布暂时物理
存在，但切换后不得再被读写；旧实例和旧 bundle 完全退出后再物理删除字段及旧 R2 Object。

## 13. 验收标准

> 本节是当前实现的验收标准。当前 theme 重构落地时，双支原子切换、candidate refs、Revision/Variant
> 命名等条目必须按 [重构验收](./current-theme-save-refactor.md#11-验收) 同步替换。

- wide、desktop、tablet、phone 分别导出，不再使用固定 `1200 × 630` Wallpaper。
- Editor 使用同一 Profile 画布预览时，与对应静态产物保持像素语义一致。
- SSR CSS 与 client resolver 在 breakpoint、宽高比边界和默认 `wide` 分支上命中同一 Profile；resize 跨 Profile
  后等待新 Profile 的 GPU 首帧再接管。
- CSS↔TS source contract test 覆盖 base/media variable 映射、规则顺序和 `16/10` 边界；跨边界抖动只延迟
  renderer 重建，不延迟 active Profile 或静态选图。
- Profile logical size、backing-store pixel size 与 CSS presentation size 分离；DPR 不改变 Pattern repeat、
  Gradient 中心或 framing。
- Gradient、Pattern、Texture、滤镜和上传图片全部由 WebGPU 生成。
- Wallpaper publish lane 一次只生成发生变化且非 NONE 的 theme，但必须完成该 theme 的全部 required targets；
  Appearance Save 若同时包含 Dashboard `contentShadow`，由 Dashboard 普通字段 mutation 另行提交。
- 每个 Variant 必须先完成 per-asset intent、PUT 和完成登记，未登记的 Asset 不能进入冻结 manifest。
- 任一 Variant 失败时，整个 Batch 作废，线上 State 不变，UI 显示重新保存 flash。
- 已知失败立即 cancel；浏览器崩溃留下的 open Batch 在 TTL 后删除。
- Assets Hub 必须通过 `claimForPublish` 原子校验并冻结完整 manifest、取得 publish claim，Phoenix
  才能创建 Revision 和切换 State。
- publish 与 cleanup 必须原子竞争同一个 claim；publish claim 和 delete claim 不得同时成功。
- Phoenix 发布事务必须在 publish capability 有效期内完成；stale claim 只能在最大事务预算和安全
  余量之后转入删除。
- capability 在事务外预检后，必须在事务 callback 开始时重新断言剩余 lease；调度延迟不能侵占
  publishTransactionBudget。
- publish capability 必须签名绑定 Batch requestDigestVersion、requestDigest、完整冻结 manifest、
  manifestDigest 和 policyVersion；Phoenix 在事务外按指定 digest 版本完成比对和产品矩阵校验，
  事务内不得为读取 manifest 再调用 Assets Hub。
- `publishWallpaper` 必须携带当前 theme 的 settings、batchRef（NONE 除外）、idempotencyKey 和
  baseVersion；两次请求按同一用户意图重算的 requestDigest 必须一致。
- recipe 内容变化必须导致 requestDigest 不同并拒绝发布；该绑定不承诺服务端能够证明上传像素由
  recipe 渲染。
- requestDigest canonicalization 必须版本化并提供 golden fixtures；正常协议升级时发布按 capability 版本
  重算、Receipt 重放按 Receipt 版本重算，old Batch/claim/Receipt 排空前不能删除旧算法。本次 Wallpaper
  hard cut 不兼容 pre-cutover Batch/claim/Receipt；它们不进入重放路径，并在切换时退出旧数据生命周期。
- lease policy 升级必须先扩展 Phoenix 支持范围，再切换 Assets Hub 签发版本，旧 claim 排空后才收缩
  Phoenix 最低接受版本。
- Assets Hub signing key/key id 和 Phoenix trusted verification key set 必须通过启动断言；密钥轮换
  必须先部署 verifier，再切换 signer，最后等待旧 capability 排空后移除旧 key。
- `databaseTransactionTimeout` 从事务 callback 开始计时并覆盖 State 行锁等待和全部事务语句；超时
  必须保证数据库事务回滚。
- publish claim 成功后 Browser cancel 必须被拒绝；所有临时 Batch 删除都必须先取得 delete claim。
- publish claim 胜出但发布失败的 Batch 成为 orphan：已知失败立即转入删除，进程崩溃由 stale
  publish claim reconciliation 清理。
- Phoenix 发布成功但响应丢失时，幂等重试返回成功结果，正式 Revision 引用阻止 orphan 清理。
- 幂等结果来自 Phoenix 在发布事务内写入的 Publish Receipt，不依赖 Assets Hub Batch 元数据；同 key
  不同 request digest 必须被拒绝。
- 发布成功路径不做同步 Batch 元数据清理，周期 reconciliation 最终清理且不影响用户成功响应。
- 不存在部分 Revision、中间 Variant 续传、Session 接管、后台补渲染或自动合并。
- 两个 Tab 基于同一 version 保存时，只有第一个 `publishWallpaper` 成功；冲突批次作废并提示使用
  最新 State version、全新 idempotencyKey 和全新 Batch 重新保存。
- 拥有 generated variants 的非 NONE 正式 Theme Revision 只在完整 Batch 成功发布时创建。
- 非 NONE Revision 必须持久化 `sourceBatchRef`，并与其全部 generated Asset 的 `batchRef` 一致；NONE
  Revision 的 `sourceBatchRef` 必须为 `null`。
- light/dark 在同一 State 事务中原子切换。
- light/dark 合计最近 5 个 post-cutover Revision 可直接恢复，不保证每个 theme 分别拥有历史；不兼容
  pre-cutover 历史数据。
- 普通 Restore 不生成、不上传、不复制 Asset，只替换目标 theme 当前引用；不存在历史 Snapshot
  materialization 迁移操作。
- NONE 可以发布、计入最近 5 次并恢复。
- 纯 NONE 保存不创建 Batch；无变化保存不创建 Batch 或 Revision；两者仍写入 Publish Receipt。
- 非 NONE Revision 必须由冻结完整 manifest 并取得 publish claim 的 Batch 发布；NONE Revision 不依赖
  Batch 或 publish claim。
- 超过 `publishReceiptRetention` 的 Publish Receipt 最终由 Phoenix 周期清理。
- manifest 损坏时 Snapshot branch 临时为 `null` 并报警，但不得将业务状态改写为 NONE。
- 超出最近 5 次的已发布 Revision 经过缓存宽限期后删除 generated variants。
- source Asset 不会因为删除一个 Revision 而误删。
- SSR 输出当前 State 双主题和全部 Profile 候选 URL，不猜 viewport。
- 普通路由不加载 Wallpaper WebGPU、shader 或 authoring recipe。
- Cover 后续能够复用导出 Target、批次调度和 Assets Hub 协议，而不依赖 Wallpaper 历史模型。
- 硬切换后运行时不读取旧单图字段，存量 Community 在首次新 Save 前只显示 Root page color。
