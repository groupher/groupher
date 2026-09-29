# Wallpaper 当前 theme 单独保存重构

> 文档角色：Active implementation contract；当前代码切换已落地，待部署与线上验收
>
> 日期：2026-09-04
>
> Active：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [响应式静态产物、历史与共享导出机制](./responsive-revisions.md)
>
> 配套契约：[Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md)
>
> 后续 backlog：[Wallpaper 后续工作](./followups.md)

> 当前未完成项：[Wallpaper 后续工作](./followups.md#3-核心链路剩余验收与编辑器接线)；保存模型、事务边界和
> 命名硬切换已完成，剩余内容主要是部署后验收、编辑器 UI 和脏状态体验。
>
> Mixed：[实时编辑与静态发布边界（v1 主体归档）](./static-wallpaper.md)
>
> Archive：[浏览器端导出与上传（v1）](./browser-export-upload.md)

## 1. 目标

Wallpaper 与 ThemePreset 当前一直是独立系统。Theme 系统只向编辑器提供当前 `light`/`dark`；
Wallpaper 保存不参与 ThemePreset mutation、token 保存、历史或发布流程。

本次重构删除一次 Save 同时聚合 light/dark 的设计。一次 Wallpaper publish 只处理当前 theme 的
Wallpaper；Appearance Save 若同时包含 Dashboard `contentShadow`，由外层 coordinator 另行编排一次
普通 Dashboard 字段 mutation：

```text
当前 theme
  -> 当前 TWallpaperSettings
  -> 当前 theme 是否 touched
  -> NONE：直接发布删除
  -> 非 NONE：导出四张图片、上传、发布
```

### 1.1 契约优先级与切换方式

本文是当前单 theme 保存模型的实施契约。`responsive_revisions.md` 保留矩阵、生命周期和 Assets Hub
通用不变量；其中与双 theme 原子保存冲突的段落以本文 §1.1 为准，不能再作为运行时规则。

本文明确修订 [响应式静态产物、历史与共享导出机制](./responsive-revisions.md) 中以下条目：

| Active 位置     | 当前 invariant                              | Proposed 替换规则                               |
| --------------- | ------------------------------------------- | ----------------------------------------------- |
| §5.1            | light/dark 指针作为一组切换                 | 每笔保存只更新当前 theme 指针                   |
| §6.1 步骤 17–18 | 一次创建一条或两条 Revision，并切换两支指针 | 一次只创建一个 Snapshot，并切换一支指针         |
| §6.4            | 支持两支 NONE/非 NONE 组合计划              | 只判断当前 settings 是 `'none'` 还是非 `'none'` |
| §10.2           | 原子切换 light/dark                         | 锁定聚合后原子更新当前指针并执行 `version + 1`  |
| §11 人工不变量  | Revision、Variant 与双支发布命名            | 改为 Snapshot、Image，并逐支验证 theme/profile  |
| §13 验收        | `light/dark` 在同一事务中原子切换           | 当前 theme 指针与 `version + 1` 在同一事务提交  |

历史总量、删除宽限期、Receipt、lease、request digest 和 generated Batch 的原子性继续保留，除本文
明确修订的保存粒度和领域命名外不变。

本文同时修订 [保存链路与数据边界](./save-pipeline-contract.md)：

| Active 位置 | 当前 contract                                               | Proposed 替换规则                                                                                    |
| ----------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| §3、§4.2    | Wallpaper 业务层使用 Variant/variantKey                     | Wallpaper 使用 Image/Profile；Assets Hub 通用协议继续保留 Variant/variantKey                         |
| §6          | Json authoring、`toWallpaperAuthoring`、发布 NONE 为 `null` | typed settings envelope、版本化 `renderConfig`、`wallpaperSettingsCodec`、canonical `{type: 'none'}` |
| §8          | Authoring/Variant 收敛清单                                  | 改为 Settings/Snapshot/Image/Profile 与当前 theme 硬切换清单                                         |

save pipeline §5 的内部/外部边界原则、§7 的 ErrorCat 公共错误结构、request digest version、Publish
Capability、Receipt 和 lease 原子性保持不变；只更新参与 digest 的 canonical payload 字段和领域命名。

## 2. 统一词汇

| 当前名称                             | 目标名称                              | 说明                                           |
| ------------------------------------ | ------------------------------------- | ---------------------------------------------- |
| `authoring`                          | `settings`                            | 完整、可复现的 Wallpaper 设置                  |
| `TWallpaperThemeState`               | `TWallpaperSettings`                  | 完整设置类型                                   |
| `WallpaperThemeRevision`             | `WallpaperSnapshot`                   | 一次成功保存形成的不可变历史快照               |
| `WallpaperThemeRevisionAsset`        | `WallpaperSnapshotImage`              | 一个 Snapshot 的 Profile 图片                  |
| `CommunityWallpaperState`            | `CommunityWallpaper`                  | 当前 light/dark Snapshot 指针和并发版本        |
| `stateVersion`                       | `version`                             | 位于 Wallpaper 对象或结果内部的并发版本        |
| `baseStateVersion`                   | `baseVersion`                         | Wallpaper mutation 提交的并发基线              |
| `staticWallpaper`                    | `wallpaper`                           | 普通页面直接消费的发布图片                     |
| `wallpaperEditor`                    | `wallpaperSettings`                   | Dashboard 编辑设置                             |
| `history` / Revision history         | `wallpaperHistory` / Snapshot history | 可恢复的保存历史                               |
| Wallpaper `variant`                  | Wallpaper `image`                     | 按固定 Profile 导出的图片                      |
| `targetKey` / Wallpaper `variantKey` | `profile`                             | Wallpaper 领域使用 `wide/desktop/tablet/phone` |
| `exportWallpaperBatch`               | `exportWallpaperImages`               | Browser 只负责导出图片，尚未创建 Batch         |
| `createWallpaperBatch`               | `prepareWallpaperUpload`              | Phoenix 准备 capability 和 upload intents      |
| `publishWallpaperAssets`             | `saveWallpaper`                       | Browser 的完整保存编排                         |
| `GeneratedImageBatchClaim.kind`      | `GeneratedImageBatchClaim.type`       | 项目自有协议禁止使用 `kind`                    |

`theme` 可以直接使用，值固定为 `light | dark`。它表示当前保存哪套 Wallpaper，不表示
Wallpaper Snapshot 属于 ThemePreset。

`T` 前缀是前端源码的类型命名规范，不是 GraphQL 协议命名。GraphQL schema 的 object、input、enum
和 result 不加 `T`，codegen 生成类型机械镜像 schema，同样不加 `T`；生成目录属于自动产物例外，
Frontend 不得在其中手工改名。前端自行声明的 TypeScript 类型必须加 `T`。

每层只有一个来源：`schema.graphql` 是 transport 类型来源，codegen 只生成镜像；前端 spec 是编辑器、
Store 和 renderer 领域类型来源。`wallpaperSettingsCodec` 显式完成 generated transport 与前端 `T...`
类型之间的转换，不手写第二份 transport 镜像，也不直接把 generated 类型当 Store 模型。

## 3. `TWallpaperSettings`

`TWallpaperSettings` 是当前 theme 的完整、扁平领域配置，不是相对 preset 的增量。内置图片或渐变 preset
只是其中的 `source`；用户调整后的 Gradient、Pattern、Texture 和 Effect 都保存在完整 settings 中。
GraphQL 的 `WallpaperSettings` 是传输 envelope；它的 `renderConfig` 在 decode 后展开回现有共享
`TBgConfig`，不在 Store 与 renderer 之间再创建一个 envelope 或中间模型。

> 归属说明：归档的 hard-cut 前 editor/publish wire 曾把 `contentShadow` 放在每个 theme 的
> `renderConfig` 中，这是历史形态，不是当前领域归属。`contentShadow` 的唯一 owner 是 Dashboard
> 的独立内容呈现字段 `dashboard.contentShadow`；普通页面不得继续从 Wallpaper settings 读取它。一次性
> contract cutover 时 editor、普通页和 schema 同时切换，切换后不保留旧字段的运行时兼容读写。

```ts
type TWallpaperSettings = { type: 'none' } | TRenderableWallpaperSettings

type TRenderableWallpaperSettings = {
  type: 'picture' | 'gradient' | 'upload'
  source: string
  customWallpaper: TCustomWallpaper
  gradient: TGradientRecipe | null
  pattern: TBgPattern
  texture: TBgTexture
  effect: TBgEffect
}

type TCustomWallpaper =
  ({ type: 'gradient' } & TWallpaperGradient) | ({ type: 'picture' } & TWallpaperPic) | null
```

`TRenderableWallpaperSettings` 与共享 renderer 的 `TBgConfig` 同源。目标形态不含 `contentShadow`；该字段由
Dashboard 独立内容表面层承载。`decodeWallpaperSettings` 输出 Wallpaper 背景领域值，运行时把
`type/source/customWallpaper/gradient/pattern/texture/effect` 交给 `composeBgRenderSpec`。图片
`assetPublicRef` 继续走 `TBgConfig` 的现有入口。禁止在 Store 与 `lib/bg` 之间再定义持久化中间类型或复制一份
视觉字段。

约束：

- Backend 是默认设置的唯一来源；Frontend 不维护第二套默认值。
- GraphQL 只 deep-type 稳定业务骨架：`settingsSchemaVersion/type/source`、CustomWallpaper 判别字段和
  `assetPublicRef`。切换前的旧 wire 将 Gradient、Pattern、Texture、Effect、ContentShadow 等复杂配置放入
  版本化 `renderConfig: Json`；hard cut 后 `contentShadow` 由 Dashboard 独立字段承载，不能再把它当作
  Wallpaper renderer 配置。
- `renderConfig` 不是任意 JSON 逃生口。它只能由 Settings codec 读写；切换前 wire 固定五个顶层字段和
  camelCase，目标 Wallpaper renderer 配置只保留背景四键，`contentShadow` 由 Dashboard 独立字段承载；复杂
  子树（包括 `texture.params`）保留为带 settings schema version 的 JSON leaf。resolver、业务模块与
  renderer adapter 禁止直接猜 key。
- 整份 settings 只使用一个 `settingsSchemaVersion`。Gradient 自身已有的 recipe `version` 属于 renderer
  内部格式，不再为 Pattern、Texture、Effect 等 leaf 分别制造 schema version。
- 文档正文用 `NONE` 表示删除概念；TypeScript、JSON 和数据库 settings 的字面量固定为小写 `'none'`。
  GraphQL enum token 可以写作 `NONE`，但 resolver 后的 settings 值仍规范化为小写。
- `type: 'none'` 明确表示删除 Wallpaper；canonical settings 内容固定为 `{type: 'none'}`，normalize 必须删除
  `source/customWallpaper/renderConfig` 等其余字段。settings 本身不使用 `nil` 表示删除。
- Snapshot 保存完整 settings，不能依赖未来可能变化的 preset 再合并。

Transport 方案经过以下取舍后固定为折衷方案：

| 方案                                    | 决策 | 原因                                                                       |
| --------------------------------------- | ---- | -------------------------------------------------------------------------- |
| settings 及所有 WebGPU 子树全深度 typed | 拒绝 | object/input/enum 镜像过多，字段演进需要重复修改 GraphQL、codec 和生成类型 |
| typed 稳定骨架 + versioned Json recipe  | 采用 | 保留判别、资源引用和版本边界，同时让复杂渲染配置只由 codec 演进            |
| 整份 settings 退化为一个 Json           | 拒绝 | 会再次隐藏 `type`、`assetPublicRef` 和分支互斥等关键业务约束               |

`light-wide` 事故的教训不是“任何 JSON 都必须改成 GraphQL object”，而是 Json scalar 内部不会由
Absinthe 自动做递归字段映射。新方案通过 typed envelope、Settings codec 独占 Json 读写和共享
fixtures 消除隐式映射，不允许业务代码直接读取未经解析的 payload。

GraphQL transport 冻结四个不同职责的名字，均不加 `T`：

| 职责                | 名称                       |
| ------------------- | -------------------------- |
| 单 theme 设置对象   | `WallpaperSettings`        |
| light/dark 设置容器 | `WallpaperSettingsByTheme` |
| 单 theme 写入 input | `WallpaperSettingsInput`   |
| 历史项              | `WallpaperSnapshot`        |

Frontend 领域类型与 GraphQL transport 的映射固定为：

| Frontend 类型            | GraphQL object / input                         | 说明                                                         |
| ------------------------ | ---------------------------------------------- | ------------------------------------------------------------ |
| `TWallpaperSettings`     | `WallpaperSettings` / `WallpaperSettingsInput` | 单 theme 完整设置                                            |
| `TCustomWallpaper`       | `CustomWallpaper` / `CustomWallpaperInput`     | typed 判别与资源引用；复杂 preset 配置由 `config: Json` 承载 |
| `TWallpaperRenderConfig` | `WallpaperSettings.renderConfig: Json`         | 版本化 WebGPU 配置，由 Settings codec 独占读写               |

`TWallpaperGradient` 继续表示现有渐变 preset 对象，不能复用为 settings 中的 Gradient recipe。
`TBgPattern/TBgTexture/TBgEffect` 继续是共享 renderer 领域类型；它们由 Frontend runtime schema 和
Settings codec 校验，不再复制成同形 GraphQL object/input。

GraphQL 只为业务骨架保留 `WallpaperType`、`WallpaperTheme`、`WallpaperProfile` 和
`CustomWallpaperType`。Pattern tone、Texture type、Gradient renderer 等 WebGPU 枚举保留在
`renderConfig` 的领域 schema 中，不在 GraphQL 再声明第二份 enum；GraphQL token 与小写领域值的映射
只存在于 codec，并由 golden fixture 固化。

### 3.1 `renderConfig` 与 Gradient 三分支

`renderConfig` 的 canonical JSON shape 对应 `TWallpaperRenderConfig`。它内部的 `TGradientRecipe` 仍是
`TLinearGradientRecipe | TRadialGradientRecipe | TMeshGradientRecipe` 判别联合；不因为 GraphQL 使用
`Json` 就放弃 runtime validation。Frontend 与 Backend Settings codec 都必须按 renderer family 校验：

| 分支   | 必填                                                                                           | 可选          | 禁止                               |
| ------ | ---------------------------------------------------------------------------------------------- | ------------- | ---------------------------------- |
| Linear | `version=2`、`renderer='linear'`、`preset/colors/angle/spread`                                 | `stops`       | radial/mesh 专属字段               |
| Radial | `version=2`、`renderer='radial'`、`preset/colors/center/radius/shape/spread`                   | `angle/stops` | mesh 专属字段                      |
| Mesh   | `version=2`、mesh renderer、`preset/colors/seed/angle/softness/warp/scale/contrast/brightness` | 无            | `stops/spread/center/radius/shape` |

共享 golden fixtures 必须覆盖 Linear、Radial 和 `MESH_GRADIENT_RENDERERS` 中的每个 renderer，验证
Frontend/Backend codec round-trip、非法跨分支字段和 request digest；`version: 2`、`stops`、
`center/shape` 及全部 mesh 参数都必须出现在对应 fixture 中。

### 3.2 CustomWallpaper 判别子类型

当前迁移输入形状是 `TCustomWallpaper = TWallpaperGradient | TWallpaperPic | null`；它只描述重构前
现状，不是目标实现。目标是 §3 的扁平判别联合：Gradient/Picture 数据直接与 `type` 同层，不增加
`value` 包装。GraphQL transport 只类型化判别字段和稳定资源引用：

```graphql
enum CustomWallpaperType {
  GRADIENT
  PICTURE
}

type CustomWallpaper {
  type: CustomWallpaperType!
  assetPublicRef: String
  config: Json!
}

input CustomWallpaperInput {
  type: CustomWallpaperType!
  assetPublicRef: String
  config: Json!
}
```

`type=GRADIENT` 时 `assetPublicRef` 必须为空；`type=PICTURE` 时允许携带上传源的 `assetPublicRef`。
`assetPublicRef` 不能放进 `config` 或只存在于 Frontend 本地状态；其余复杂 preset 字段由 Settings
codec 校验 `config`。`null` 仍表示没有 custom wallpaper，不额外增加 NONE type。

Frontend 领域值本身携带 `type`，`encodeWallpaperSettings` 只执行
`'gradient'→GRADIENT`、`'picture'→PICTURE` 的直接映射；禁止通过 `image`、`assetPublicRef` 或其他
可选字段猜测 branch。两个分支及 `null` 都必须提供 codec round-trip fixture。Picture fixture 必须断言
`assetPublicRef` 只出现在 `CustomWallpaper.assetPublicRef`，不得同时复制进 `config`；Gradient fixture
必须断言 `assetPublicRef` 为空，decode/encode round-trip 后继续满足这两个约束。

#### 3.2.1 Frontend 消费方迁移

`customWallpaper` 属于 Wallpaper 与 CoverEditor 共用的 `TBgConfig`。因此给裸 union 增加显式 `type`
是 Core 全仓的编译级契约变更，不能只修改 Wallpaper 的类型声明和 codec。实施时必须在同一次硬切换中
覆盖：

- `frontend/core/lib/bg` 的 config 解析、CSS/WebGPU 合成和 renderer adapter；
- Wallpaper Store、helper、preview patch、rollback/original baseline；
- CoverEditor 的 settings adapter、renderer、preview/export 和 custom wallpaper 面板；
- Pictures、Gradient、Upload 面板及其 source 选择逻辑；
- 上传图片的 `assetPublicRef` 保存、恢复和再次导出；
- SSR parser、Backend default settings、GraphQL mock 和跨语言 fixtures；
- 其他全部 `TBgConfig` / `customWallpaper` 消费方；
- codec round-trip、背景合成、编辑器切换和上传恢复测试。

所有原来的 `customWallpaper?.image`、`customWallpaper?.assetPublicRef` 等裸 union 访问，都必须先按
`type` narrowing：

```ts
const image = customWallpaper?.type === 'picture' ? customWallpaper.image : undefined
```

禁止绕过 `type` narrowing 直接读取分支专属字段；这种写法会让 Gradient/Picture 字段在后续演进时
重新混用。共享 `lib/bg` 只接收 narrowing 后的值或规范化 `TBgConfig`，不能自行猜测分支。
本次迁移不保留旧裸 union、临时兼容类型或兼容 adapter，也不能把 CoverEditor 留给后续 PR。

### 3.3 Settings codec 文件边界

现有 Authoring 文件和函数随领域命名一起硬切换：

| 当前                                                         | 目标                                                        |
| ------------------------------------------------------------ | ----------------------------------------------------------- |
| `frontend/core/lib/wallpaperAuthoring.ts`                    | `frontend/core/lib/wallpaperSettingsCodec.ts`               |
| `wallpaperAuthoring.test.ts`                                 | `wallpaperSettingsCodec.test.ts`                            |
| `toWallpaperAuthoring`                                       | `encodeWallpaperSettings`                                   |
| 无                                                           | `decodeWallpaperSettings`                                   |
| 分散的归一化                                                 | `normalizeWallpaperSettings`                                |
| `packages/contracts/fixtures/wallpaper-authoring-v1.json`    | `packages/contracts/fixtures/wallpaper-settings-v1.json`    |
| `GroupherServer.CMS.Wallpaper.Authoring`                     | `GroupherServer.CMS.Wallpaper.Settings`                     |
| `backend/api/lib/groupher_server/cms/wallpaper/authoring.ex` | `backend/api/lib/groupher_server/cms/wallpaper/settings.ex` |

三个 codec 函数只处理当前 theme 的完整 `TWallpaperSettings`，不接受 light/dark sparse patch。
职责固定为：

- `normalizeWallpaperSettings(settings)`：输出 canonical 领域值；NONE 收敛为 `{type: 'none'}`，angle
  归一到 `0..359`，删除 `undefined`、未知字段和不属于当前判别分支的数据。它不在 Frontend 填充默认值。
- `encodeWallpaperSettings(settings)`：先 normalize，再输出 generated `WallpaperSettingsInput`；只做
  `'picture'→PICTURE` 等稳定 enum 映射，写入 `settingsSchemaVersion`，并把复杂视觉配置写入 camelCase
  `renderConfig`。
- `decodeWallpaperSettings(input)`：检查 `settingsSchemaVersion`，运行时校验 `renderConfig` 和
  CustomWallpaper 分支，再生成 `TWallpaperSettings`；未知版本或非法结构必须返回明确错误，不能静默
  回退 Backend 默认值。

Backend 对应边界 `CMS.Wallpaper.Settings` 固定提供 input cast/validate、canonical normalize 和 GraphQL
output 三个方向。Absinthe 只负责 typed envelope 的字段映射；`renderConfig/config` 作为 Json scalar
保持 camelCase，不递归转换 snake_case。Wallpaper resolver、Snapshot、RequestDigest 和 renderer adapter
都不能绕过该模块直接读取 JSON key。

`CMS.Wallpaper.RequestDigest` 仍是版本化 canonical JSON 和 digest 的唯一实现；它只消费
`CMS.Wallpaper.Settings` 已规范化的 canonical settings，不能在 Frontend codec 或 Authoring/Settings
模块中复制另一套对象排序和数字编码逻辑。

实施时全仓删除 `serializeWallpaperPatch`、`toWallpaperAuthoring`、`authoring` 等旧文件级和函数级命名，
不保留兼容导出。

fixture 改名时同步更新 `packages/contracts/package.json` export、Frontend codec test 和
`backend/api/test/groupher_server/cms/wallpaper_test.exs` 的引用。当前协议尚未部署，因此 settings 契约
从 v1 起步；实施前若发现旧 authoring Batch/Receipt 数据，不迁移、不兼容，也不让新路径读取或重放，按部署
清理策略直接退出旧数据生命周期。

因此，若 cutover 早于首次部署，四键 Wallpaper shape 直接以 settings v1 上线，不产生 settings/request digest
版本升级或历史数据迁移；只有五键 settings v1 已先行部署时，hard cut 才需要升级版本并退出旧数据生命周期。

`packages/contracts/fixtures` 中只保留一份人工审阅的 canonical settings fixture 集合，由实际理解
settings 的 Frontend 与 Phoenix 测试共同消费；Assets Hub 继续只消费自身需要的 manifest/profile/digest
协议 fixture，不引入 Wallpaper settings 语义。不能让各端复制 fixture，也不能由某一端实现自动生成
expected digest，避免测试与实现同源后失去 golden 意义。可用覆盖检查断言 fixture 已枚举全部
renderer/enum，但 expected canonical JSON 和 digest 必须固定提交。

对应 Elixir 边界为 `CMS.Wallpaper.Settings`，数据库字段为 `settings`，Dashboard 容器字段为
`wallpaperSettings`。

## 4. Dashboard 读取边界

`dashboard.wallpaper` 外层始终非空；它承载统一的 `version` 和两个可空图片分支：

```graphql
enum WallpaperType {
  PICTURE
  GRADIENT
  UPLOAD
  NONE
}

enum WallpaperTheme {
  LIGHT
  DARK
}

enum WallpaperProfile {
  WIDE
  DESKTOP
  TABLET
  PHONE
}

type Wallpaper {
  version: Int!
  light: WallpaperImages
  dark: WallpaperImages
}

type WallpaperImages {
  wide: WallpaperImage!
  desktop: WallpaperImage!
  tablet: WallpaperImage!
  phone: WallpaperImage!
}

type WallpaperImage {
  url: String!
  width: Int!
  height: Int!
}

type WallpaperSettings {
  settingsSchemaVersion: Int!
  type: WallpaperType!
  source: String
  customWallpaper: CustomWallpaper
  renderConfig: Json
}

input WallpaperSettingsInput {
  settingsSchemaVersion: Int!
  type: WallpaperType!
  source: String
  customWallpaper: CustomWallpaperInput
  renderConfig: Json
}

type WallpaperSettingsByTheme {
  light: WallpaperSettings!
  dark: WallpaperSettings!
}

type WallpaperSnapshot {
  id: ID!
  theme: WallpaperTheme!
  settings: WallpaperSettings!
  savedAt: DateTime!
  active: Boolean!
}
```

上面是冻结后的最小边界 shape。GraphQL 负责稳定业务骨架；`renderConfig` 和
`CustomWallpaper.config` 明确是由 Settings codec 独占的版本化 Json leaf。NONE 时 `source`、
`customWallpaper` 和 `renderConfig` 都为空；非 NONE 时由 codec 强制所需字段和分支结构，不能把
GraphQL nullable 误解为任意组合都合法。

普通页面只查询已发布 Wallpaper 与独立的 Dashboard 内容呈现配置：

```graphql
dashboard {
  wallpaper {
    version
    light { wide { url width height } desktop { url width height } tablet { url width height } phone { url width height } }
    dark { wide { url width height } desktop { url width height } tablet { url width height } phone { url width height } }
  }
  contentShadow
}
```

Profile 是固定集合，输出使用具名字段，不返回需要 `find(profile)` 的数组。普通页面不需要 Snapshot ID、
Batch ref、Asset public ref、manifest 或 editor settings；`contentShadow` 是独立的 Dashboard 内容字段，
不从 Wallpaper Snapshot 读取。

普通查询和 editor route 都只读取 `contentShadow` boolean；它是 Dashboard 的普通字段，不引入
独立 revision、`baseVersion` 或幂等协调，也不与 `dashboard.wallpaper.version` 合并。

Wallpaper 编辑 route 额外查询：

```graphql
dashboard {
  wallpaper { version }
  wallpaperSettings {
    light { ...WallpaperSettingsFields }
    dark { ...WallpaperSettingsFields }
  }
  wallpaperHistory(theme: LIGHT) {
    id
    theme
    settings { ...WallpaperSettingsFields }
    savedAt
    active
  }
}
```

`wallpaperSettings: WallpaperSettingsByTheme!` 只承载配置；并发版本和历史不嵌入 settings。每个 theme
的来源顺序固定为：存在 active Snapshot 时返回它的完整 settings，包括 `type: 'none'`；不存在 active
Snapshot 时才返回 Backend 默认 `TWallpaperSettings`。已保存 NONE 不能被默认配置覆盖。

`wallpaperHistory(theme): [WallpaperSnapshot!]!` 只在编辑 route 查询，不进入普通 `PageCommunity`
请求。

settings 一次读取 light/dark，是为了 theme 切换时保留两支独立 dirty draft；history 只服务当前 theme
的历史面板。切换 theme 时按 `community + theme` 查询或命中缓存，不一次加载两支历史。

未初始化时返回 `wallpaper = {version: 0, light: null, dark: null}`；保存 NONE 时外层仍然存在，只把
对应 theme branch 返回为 `null`。`null` 只表示 Frontend 不渲染 Wallpaper 图片层：Root 继续绘制不透明
页面基础颜色，Content surface 不重复绘制半透明颜色或 blur。详情见
[Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md)。

`version` 是从 `0` 开始的非负整数：`0` 表示尚无持久化 `CommunityWallpaper`，第一次成功 publish 或
restore 后变为 `1`，之后每次成功事务加一。并发比较必须使用整数相等；SSR、缓存键和 UI 逻辑禁止
通过 `if (version)` 等 truthy 判断区分初始化状态。

GraphQL enum token 使用大写，Frontend Store、数据库 JSON 和 request digest 使用小写字面量。唯一
转换边界是 `wallpaperSettingsCodec`：Frontend 在 generated transport 与 `TWallpaperSettings` 间转换，
Backend 在 Absinthe transport 与 canonical settings 间转换。digest 只消费小写 canonical settings；
token↔小写映射必须纳入跨语言 golden fixture，不能散落在 resolver 或组件中。

## 5. 当前 theme 的 touched 与保存

编辑动作继续根据当前 theme 写入 `wallpaperStore.light` 或 `wallpaperStore.dark`。Save 的 touched
也必须只比较当前 theme：

```ts
const theme = isDarkTheme ? 'dark' : 'light'
const settings = normalizeWallpaperSettings(wallpaperStore[theme])
const original = normalizeWallpaperSettings(wallpaperStore.original[theme])
const touched = !equals(settings, original)
```

Frontend 的 `normalizeWallpaperSettings()` 供载入 baseline、判断 touched 和构造 wire payload 共用；
Backend 的 `CMS.Wallpaper.Settings` 在 RequestDigest 计算前执行同一契约的 canonical normalize。angle
等价值在比较前统一到 `0..359`，避免 `-1/359`、`0/360` 造成视觉未变但 touched 为真的情况。两端通过
同一份 fixture 对账，不共享运行时代码，也不各自维护不同默认值。

Wallpaper publish 规则只有三条：

```text
当前 theme 未修改
  -> 不保存

当前 theme 已修改且 settings.type = 'none'
  -> 不导出图片
  -> 直接 publishWallpaper

当前 theme 已修改且 settings.type != 'none'
  -> 导出 wide/desktop/tablet/phone
  -> 上传完整图片集合
  -> publishWallpaper
```

不得再通过 sparse patch 是否包含 `type` 判断是否导出。每个 theme 独立保存 dirty 状态：切换 theme
不丢弃另一支未保存设置；Save 只保存并接管当前 theme 的 original；另一支仍保持 dirty。离开 Wallpaper
route 时，只要任一 theme dirty 就提示用户，不自动串行保存两支，也不静默丢弃。

`contentShadow` 不再进入上述 Wallpaper touched、settings normalize 或 publish payload。Appearance Save
若同时发现 Wallpaper patch 与 Dashboard content-shadow patch，按 Dashboard mutation → Wallpaper publish
顺序提交；两个 mutation 各自确认 baseline，部分成功不做跨 aggregate rollback，下一次 Save 只重试失败
aggregate。Dashboard content-shadow 使用普通字段 patch，不复用 Wallpaper `version`/`baseVersion`。

## 6. 写入 API

### 6.1 准备非 NONE 上传

```graphql
prepareWallpaperUpload(
  community: String!
  input: WallpaperUploadPrepareInput!
): WallpaperUploadPreparation!

input WallpaperUploadPrepareInput {
  theme: WallpaperTheme!
  settings: WallpaperSettingsInput!
  baseVersion: Int!
  idempotencyKey: String!
  images: [WallpaperImageInput!]!
}

input WallpaperImageInput {
  profile: WallpaperProfile!
  checksum: String!
  mimeType: String!
  sizeBytes: Int!
  width: Int!
  height: Int!
}

type WallpaperUploadPreparation {
  batchRef: String!
  batchCapability: String!
  expiresAt: DateTime!
  uploadIntents: [WallpaperUploadIntent!]!
}

type WallpaperUploadIntent {
  profile: WallpaperProfile!
  capability: String!
  uploadRef: String!
}
```

Phoenix 校验四个固定 Profile 后签发 capability 和 upload intents。Browser 使用每个 intent 的
`capability` 向 Assets Hub 换取 presign，再完成 PUT/finalize；GraphQL 不直接返回 `uploadUrl`。删除
`expectedVariants`，Browser 不需要服务器再次返回其已经提交的 Profile 矩阵。

### 6.2 最终发布

```graphql
publishWallpaper(
  community: String!
  input: WallpaperPublishInput!
): WallpaperPublishResult!

input WallpaperPublishInput {
  theme: WallpaperTheme!
  settings: WallpaperSettingsInput!
  baseVersion: Int!
  idempotencyKey: String!
  batchRef: String
}

type WallpaperPublishResult {
  version: Int!
}
```

边界校验：

- `settings.type = 'none'` 时 `batchRef` 必须为空；
- `settings.type != 'none'` 时 `batchRef` 必须存在，Batch 必须包含四张有效图片；
- request digest 绑定 community、theme、规范化 settings 和 baseVersion；
- publish 在一个数据库事务内锁定 `CommunityWallpaper`、校验 baseVersion、创建当前 theme Snapshot
  及 Images、只更新当前 theme 的 active Snapshot 指针、执行 `version + 1` 并写入 Receipt；
- 未保存 theme 的 active Snapshot 指针在该事务中保持原值；
- Frontend 不提交或接收 active ref、candidate ref、owner ref 等运行期内部 Snapshot 引用；历史恢复使用
  的公开 Snapshot ID 是唯一例外。

light/dark 共用一个 `version`。两个页面基于同一 baseVersion 分别保存不同 theme 时，先提交者成功，
后提交者得到预期的并发冲突；系统不拆分双 version，也不自动重放旧请求。Frontend 必须保留本地 dirty
设置，并用“另一主题已保存，请基于最新版本重试”的专用文案区别普通保存失败。

删除 GraphQL 字段：

- `candidateThemeRevisionRefs`；
- `createdThemeRevisionRefs`；
- `expectedVariants`；
- `statePublicRef`。

## 7. Snapshot 与恢复

一次成功发布创建一个 `WallpaperSnapshot`。非 NONE Snapshot 关联四张
`WallpaperSnapshotImage`；NONE Snapshot 只保存 canonical `{type: 'none'}` 且没有图片。恢复 NONE 时
编辑器只认 `type`，不能从 Snapshot 中恢复已被 normalize 删除的旧视觉配置。

历史 API 只公开用于恢复的普通 `id`：

```graphql
restoreWallpaperSnapshot(
  community: String!
  snapshotId: ID!
  baseVersion: Int!
): WallpaperPublishResult!
```

`wallpaperHistory[].id` 是公开、opaque 的历史 Snapshot ID，restore 仅把它作为 `snapshotId` 提交。
active/candidate/owner ref 只服务于运行期发布和数据库关联，不进入 `dashboard.wallpaper` 或普通 Save。

## 8. 数据模型

如果当前 migration 尚未部署，直接修改现有 migration，不增加旧表兼容迁移：

```text
community_wallpapers
  public_ref
  community_id
  active_light_snapshot_ref
  active_dark_snapshot_ref
  version
  inserted_at
  updated_at

community_dashboards
  content_shadow (boolean: content-surface shadow enabled)

wallpaper_snapshots
  public_ref
  community_id
  theme
  settings
  settings_schema_version
  source_batch_ref
  profile_version
  created_by_id
  activated_at
  history_used_at
  delete_after
  inserted_at

wallpaper_snapshot_images
  wallpaper_snapshot_ref
  profile
  width
  height
  format
  checksum
  asset_public_ref
  inserted_at
```

保留一个 `CommunityWallpaper` 聚合。保存 light 只更新 `active_light_snapshot_ref`；保存 dark 只更新
`active_dark_snapshot_ref`。数据库字段和 GraphQL Wallpaper scope 对外名称统一为 `version`。

`content_shadow` 属于 `CommunityDashboard` 的普通 boolean 字段，不进入 `community_wallpapers` 或
`wallpaper_snapshots.settings`。它由 Dashboard section mutation 持久化，使用独立事务；Wallpaper publish、
Snapshot restore 和 Dashboard content mutation 之间没有隐式的跨 aggregate 原子性。由于本次是首次部署前
hard cut，不做历史 Snapshot 回填；普通 SSR/Query 从该字段读取，未配置时使用字段默认值。

现有最近 5 次历史、淘汰宽限期和审计列全部保留，只改领域命名。Snapshot 的 settings、theme、来源
Batch 和 Profile version 不可变；`activated_at`、`history_used_at`、`delete_after` 是可更新的生命周期
元数据。不能按上面的简图删除 Active 模型已经依赖的保留期字段。

`settingsSchemaVersion` 同时存在于持久化 settings envelope 和 Snapshot 的
`settings_schema_version` 列。写入时必须断言二者相等，读取时不一致直接返回领域错误，不能任选一处
继续解码。JSON 内版本供 Settings codec 解码和报告未知版本；独立列只是查询、审计和迁移时的快速访问
镜像，不是第二个版本真相源。NONE 的 canonical settings 内容仍是 `{type: 'none'}`，完整 envelope 为
`{settingsSchemaVersion: <version>, type: 'none'}`。

历史 restore 以 hard cut 为边界：不对既有 v1 Snapshot 做原地改写、digest 重算或 v1→v2 materialization；
pre-cutover Snapshot/Receipt 不属于新模型的读、restore 或 replay contract。post-cutover 的新 Snapshot 才进入
最近 5 次 history，`deleteAfter` 宽限期和名额只计算这些新行，不存在迁移镜像挤占用户历史的问题；运行时不
增加旧字段兼容解码路径。

不保留 `renderer_version`：当前静态图片已经烘焙并随 Snapshot 保存，恢复只复用原图片，不按 renderer
版本重新渲染。`settings_schema_version` 负责 settings 解码，`profile_version` 负责图片矩阵，
`request_digest_version` 负责发布摘要。未来若确有产物生成器审计需求，应记录在 Batch/Image 生成元数据，
不能与 settings schema version 混在 Snapshot 上。

## 9. Assets Hub 边界

保留通用基础设施术语：Generated Batch、Publish Capability、Upload Intent、Manifest 和 Request
Digest。调整如下：

- 一个 Wallpaper Batch 只属于当前 theme；
- 一个 Batch 固定包含 wide/desktop/tablet/phone 四张图片；
- `batchRef` 是临时上传与本次 publish 的关联标识；
- 删除 Browser 往返的 `candidateOwnerRef`；
- 如幂等实现需要提前生成 Snapshot ref，只允许保留在 Phoenix 签发的 capability 内部；
- Wallpaper UI、Store 和 GraphQL 业务契约只暴露 `profile`；
- Browser 内部的 Assets Hub adapter 可以处理通用 `variantKey` 和 opaque `uploadRef`；
- Assets Hub HTTP wire、Generated Batch、Manifest 和底层 client 可以继续使用 `variantKey`；
- “删除 Variant 命名”只约束 Wallpaper 领域，不约束 Assets Hub 通用协议。

## 10. 实施清单

- [x] 冻结前端 `TWallpaperSettings`、无 `T` 前缀的 GraphQL transport types 和默认值来源。
- [x] GraphQL 只类型化 settings 稳定骨架；将 WebGPU 复杂配置收进由 `settingsSchemaVersion` 管理的
      `renderConfig: Json`，不创建 Gradient/Pattern/Texture/Effect 的重复 object/input/enum。
- [x] 为 Frontend 和 Backend Settings codec 固定同一份 renderConfig 顶层 contract、camelCase 和
      Linear/Radial/Mesh family 校验，禁止业务代码直接读取 JSON key；两端实现通过共享 fixtures 对账，
      不宣称共享运行时代码。
- [x] 将 `TCustomWallpaper` 改为扁平 `type` 判别联合；GraphQL typed 保留
      `CustomWallpaperType/assetPublicRef`，复杂 preset 字段由 `config: Json` 承载并经 codec 校验。
- [x] 将 NONE normalize 为唯一 canonical `{type: 'none'}`，删除其他字段并覆盖 touched、publish、
      Snapshot 与 restore 测试。
- [x] 在既有 Wallpaper runtime adapter 中将 renderable settings 无状态投影为 `TBgConfig`；不新增 Store
      中间模型，不把 `contentShadow` 错送给 renderer，并覆盖上传图片 `assetPublicRef` 映射。
- [x] 在同一次硬切换中迁移 `lib/bg`、Wallpaper、CoverEditor 及所有共享 `TBgConfig` 消费方，包括
      Store/helper/preview、Pictures/Gradient/Upload 面板、上传恢复、SSR、defaults、mock 和 fixtures；
      访问 CustomWallpaper 字段前必须按 `type` narrowing，不保留临时兼容类型或 adapter。
- [x] 将 `wallpaperAuthoring.ts`/测试硬切换为 `wallpaperSettingsCodec.ts`/测试，并落实
      encode、decode、normalize 三个入口。
- [x] 将 Backend `CMS.Wallpaper.Authoring`/`authoring.ex` 和跨语言 authoring fixture 硬切换为
      Settings/settings 命名，并更新 package export 与全部 fixture consumers。
- [x] 修改未部署 migration、Ecto schemas 和 associations。
- [x] 从 Snapshot migration/schema 删除无消费方的 `renderer_version`；保留 settings/profile/digest 各自
      独立的版本职责。
- [x] 写入和读取 Snapshot 时断言 envelope `settingsSchemaVersion` 与列
      `settings_schema_version` 一致；增加 mismatch 领域错误测试。
- [x] 将 Authoring/Revision/Variant 领域命名迁移为 Settings/Snapshot/Image。
- [x] 将 create mutation 改为当前-theme `prepareWallpaperUpload`。
- [x] 将 publish/restore mutation 改为当前-theme settings contract。
- [x] 删除 candidate refs、created refs 和 expected variants 的 Browser 往返。
- [x] 更新 Assets Hub manifest 与 Wallpaper profile adapter。
- [x] 将 shared contracts、Assets Hub 和 Phoenix 中项目自有的 Batch claim `kind` 字段硬切换为 `type`；
      第三方 GraphQL AST 等外部数据结构不在此命名迁移范围。
- [x] 重构 Frontend touched、Save 和 original 接管为当前 theme 范围。
- [x] Frontend codec 统一 baseline/touched/wire，Backend Settings codec 统一持久化/digest；两端消费
      同一份 canonical fixtures，不复制默认值或 canonical 规则。
- [ ] 增加两支独立 dirty 的 theme 切换、保存和离开 route 提示。
- [x] 将 `dashboard.staticWallpaper` 改为具名 Profile 的 `dashboard.wallpaper`。
- [x] `WallpaperEditor` route-only 请求已存在；普通 `PageCommunity` 已删除 `wallpaperSettings`，普通查询只返回
      已发布 Wallpaper 与独立的 `dashboard.contentShadow`。
- [x] 更新 GraphQL schema、生成类型和跨语言 fixtures。
- [x] 以 `packages/contracts/fixtures` 的单份人工审阅数据作为 Frontend、Backend 和 contracts 测试的
      golden source，并覆盖 Linear/Radial/Mesh renderer、NONE 和 CustomWallpaper 分支；expected digest
      不由任一端实现自动生成。
- [x] 完成 Dashboard `contentShadow` 普通字段 mutation、普通页/Editor 同步切换，并从 Wallpaper settings、Snapshot
      canonical JSON、RequestDigest 和 Receipt fixtures 中移除 `renderConfig.contentShadow`；本次 cutover 早于首次
      部署，settings/request digest 仍为 v1，不保留 editor wire 兼容例外。
- [x] 实施历史 hard cut：不迁移或兼容 pre-cutover Snapshot/Receipt，history/restore 只接受四键 post-cutover
      Snapshot；旧/不支持版本不会静默 fallback 为默认 settings。
- [ ] 实施并验收 [Wallpaper NONE 与页面背景绘制边界](./content-background-fallback.md) 的 Root/Content
      条件绘制；Wallpaper 不补色的代码边界已完成，浏览器验收仍待完成。

## 11. 验收

- 当前 theme 未 touched 时不发请求；
- 修改任意设置后 Save 都生成四张图片，NONE 除外；
- 修改 light 不创建或切换 dark Snapshot，反之亦然；
- 当前 theme 指针、`version + 1` 和 Receipt 在同一个数据库事务中提交；
- NONE 可进入历史并恢复；
- cutover 前的 Snapshot 不进入 post-cutover 可恢复 history，也不做 v1→v2 materialization；restore 不依赖旧
  字段兼容解码，旧/不支持版本也不会静默 fallback 为默认 settings；
- 普通页面只查询 `dashboard.wallpaper` 与独立的 `dashboard.contentShadow`；
- `dashboard.wallpaper` 外层始终非空；未初始化或 NONE 只令对应 branch 为 `null`；
- branch 为 `null` 时 Frontend 不补齐 Content 数据，只是不渲染 Wallpaper 图片层；
- `contentShadow` 的有效渲染门固定为 `hasWallpaper[theme] && dashboard.contentShadow`；
  Wallpaper 为 NONE/`null` 时不绘制 Content surface 效果，但不清除独立保存的 shadow 配置；
- `version=0` 可参与 SSR、缓存键和并发比较，所有消费者均不得使用 truthy 判断；
- Profile 图片可以通过 `wallpaper[theme][profile]` 直接选择；
- Wallpaper 业务代码只感知历史恢复所需的公开 Snapshot ID，不感知 active/candidate/owner ref、manifest
  内部关联或 `variantKey`；
- Wallpaper 领域不再出现 Authoring、ThemeRevision 和 Variant 命名；Assets Hub 通用协议不受此约束。
- Linear、Radial 和全部 Mesh Gradient 均能通过 versioned `renderConfig` codec round-trip，非法跨分支
  字段组合被拒绝。
- CustomWallpaper 的 Gradient/Picture branch 严格互斥，上传图片的 `assetPublicRef` 保存和恢复不丢失。
- CustomWallpaper branch 只按显式 `type` 映射，不通过可选字段形状猜测。
- Picture round-trip 中 `assetPublicRef` 只存在于 typed transport 字段、不得复制进 `config`；Gradient
  branch 的 `assetPublicRef` 始终为空。
- 全部 CustomWallpaper 消费方先按 `type` narrowing，不增加 `.value` 包装或绕过分支读取专属字段。
- renderable settings 只通过既有 runtime adapter 投影为 `TBgConfig`，Store 与 `lib/bg` 之间没有第三套
  持久化或可编辑背景模型。
- 全仓 Frontend typecheck 通过，覆盖 Wallpaper、CoverEditor 及所有 `TBgConfig` / `customWallpaper`
  消费方；不残留旧裸 union 访问、临时兼容类型或兼容 adapter。
- Frontend 不再存在 `wallpaperAuthoring.ts`、`toWallpaperAuthoring` 或兼容导出。
- Backend、contracts fixture 和测试中不再存在 Wallpaper Authoring 命名或兼容模块。
- 项目自有 Wallpaper/Generated Batch 协议不再声明 `kind` 字段；外部库数据结构不做改写。
- NONE 的 canonical settings 内容等于 `{type: 'none'}`，持久化 envelope 只额外携带
  `settingsSchemaVersion`，GraphQL transport 使用 `NONE` token；三者都不携带陈旧视觉配置。
- Snapshot envelope 的 `settingsSchemaVersion` 与 `settings_schema_version` 列始终相等；不一致时明确
  失败，不能任选一处继续解码。
- 两个不同 theme 基于同一旧 `baseVersion` 保存时，后提交者得到预期并发冲突；本地 dirty 设置保留并
  显示区别于普通失败的重试文案。
- Dashboard content-shadow 是普通 boolean 字段；更新成功写回 `dsbKeys.config(community)` 并保留本地 draft，
  不引入独立 revision、`5702/5708` 或 Wallpaper `baseVersion`。
