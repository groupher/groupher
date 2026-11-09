# Landing Scene：整页视觉方案

> 状态：静态 Scene 数据、页面读取链路和按页面/section/tab/card 切换表面的机制已接入。九项目前显式提供 light/dark 配置，但仍复用现有颜色和壁纸素材；逐项设计新配色与素材属于后续视觉工作。

## 背景

官网当前有九个封面壁纸选项，定义在 `frontend/landing/src/const/coverScenes.ts`。选择由 `frontend/landing/src/stores/coverScene/CoverSceneShell.tsx` 管理，目前主要替换壁纸数据。页面底色仍来自 `bg-pageBg`；Articles、Dashboard 的大面积渐变、Battery Bento 卡片渐变等分别写在 Landing Salon 和 Core CSS 中。因此切换到色调不同的壁纸时，封面与页面主体可能属于两套设计语言。

用户选择的应是完整的 **Landing Scene**，壁纸只是其中一项。Scene 同时决定基础主题、light/dark 壁纸、页面大面积背景和必要的装饰色。某些 Scene 可以有丰富的多色渐变，也可以非常克制：纯色页面、弱边界、无渐变。不同色调的壁纸都应有配套页面颜色；任何具体壁纸风格都不预设为所有 Scene 的目标。

当前默认 `feedback` 使用 amber/mauve 壁纸。`LANDING_INIT_DATA` 的 light/dark 暂时指向同一组图片；其余选项也主要只有单份壁纸素材。当前 `StaticShellProvider` 包含 Theme Store 和 Wallpaper Store。Landing Scene 在本页面输出基础主题与区域 CSS；Core 的 ThemePreset Provider 仍用于社区主题链路。

## 静态文件与起始位置命名

每个 Scene 已单独放在一个 TypeScript 文件中，按页面刷新后的起始排列位置命名：`l4.ts`、`l3.ts`、`l2.ts`、`l1.ts`、`center.ts`、`r1.ts`、`r2.ts`、`r3.ts`、`r4.ts`。`l1/r1` 离中间 cover 最近，数字越大距离越远。当前九项顺序以 `feedback` 为起始中心，其他项按现有 `COVER_SCENES` 顺序映射；迁移时须逐项核定左右方向。

文件名表示**刷新时的固定初始槽位**，方便定位和调试；切换后 Scene 可以移动到任意视觉位置，文件名保持不变。每个 Scene 仍保留稳定 `id`，选择状态和资源引用使用 `id`，不使用当前槽位名称。统一清单只负责导入、排序和导出这些独立文件，不集中堆放各 Scene 的视觉数据。

目前各文件显式引用同一基线，以维持原来的视觉。调整某一 Scene 时在该文件里覆盖其 `themePreset`、`appearance.light/dark` 或 `wallpaper.light/dark`；`sections.articles.byTab`、`sections.dashboard.byTab`、`sections.battery.byCard` 的缺项会回退到该 Scene 对应区域的 `default`。基础值是静态常量，不需要接口或 JSON 加载；刷新仍从 `center` 开始。

## 目标与边界

1. 顶层命名为 `TLandingScene`。它完整包含基础 `themePreset`，再扩展 Landing 独有的壁纸与各区域外观。
2. 每个 Scene 必须定义 light/dark 两套基础主题和两套壁纸。两套资源可以经过设计后相同，但不能因缺项而隐式复用另一模式。
3. 大面积背景和装饰由 Scene 控制；渐变是可选表现，不是固定结构。背景必须显式写为 `inherit` 或 `none` 等分支；可选的 border/shadow 省略时按 `inherit` 处理。
4. Scene 管大面积颜色、表面和必要装饰；局部纹理、遮罩、交互细节及组件布局、尺寸、内容和动画时序由现有组件与 Salon 管理。
5. 产品演示内表示状态或数据类别的颜色先保持语义独立。只有大面积演示表面需要协调时，才增加具名的 Scene 配置；不把每个小图标颜色都做成字段。
6. Scene 作用域只限 Landing 文档根节点；此独立 document 的 `:root` 不得影响 Community、Dash 或其他宿主。

## 拟定数据结构

以下是设计契约；实现见 `frontend/landing/src/const/scenes/shared.ts`、`style.ts` 和 `CoverSceneShell.tsx`。当前页面与主要 section 已使用受控表面；现有渐变 token 和少量封面/装饰变量保留像素表现。`TResolvedThemePreset` 指 Core 现有的已解析 token 结构：`shared`、`light`、`dark`。以下 import 路径仅表示类型来源，正式代码按所在目录解析。

```ts
import INTROS from '~/landing/DashboardIntros/constant' // 示意：实现时使用实际相对路径
import type { TPublishedWallpaper, TThread } from '~/spec'
import type { TBgPattern } from '~/lib/bg'
import type { TWallpaperFraming } from '~/lib/wallpaperProfiles'
import { WALLPAPER_TYPE } from '~/const/wallpaper'

type TLandingScene = {
  id: string
  label: string
  themePreset: TResolvedThemePreset
  wallpaper: {
    light: TLandingWallpaper
    dark: TLandingWallpaper
  }
  appearance: {
    shared?: TLandingSharedAppearance
    light: TLandingAppearance
    dark: TLandingAppearance
  }
}

type TColor =
  | { kind: 'hex'; value: string } // 校验合法 hex，允许 alpha
  | { kind: 'oklch'; l: number; c: number; h: number; alpha?: number }
  | {
      kind: 'token'
      name: 'pageBg' | 'cardColor' | 'dividerColor' | 'primaryColor' | 'accentColor'
    }
type TColorStop = { offset: number; color: TColor } // offset: 0..1
type TBackground =
  | { kind: 'inherit' }
  | { kind: 'none' }
  | { kind: 'solid'; color: TColor }
  | { kind: 'gradient'; stops: readonly TColorStop[]; angle?: number }
  | { kind: 'image'; asset: TLandingStaticAssetRef; overlay?: TColor }
type TEffect = { kind: 'inherit' | 'none' } | { kind: 'color'; color: TColor }
type TLandingStaticAssetRef = { kind: 'bundled'; path: string } // 仅允许清单内路径；将来可加 Assets Hub 已发布引用
type TPublishedWallpaperProfiles = NonNullable<TPublishedWallpaper['light']>
type TSurface = { background: TBackground; border?: TEffect; shadow?: TEffect }

type TLandingWallpaper = {
  type: WALLPAPER_TYPE.PATTERN | WALLPAPER_TYPE.GRADIENT
  source: string
  assets: TPublishedWallpaperProfiles // wide/desktop/tablet/phone，各档含 URL 和尺寸
  preview: string // 壁纸预览资源，按现有静态壁纸发布/打包路径校验
  cover: string // 主封面资源，按现有静态壁纸发布/打包路径校验
  pattern?: TBgPattern
  framing?: TWallpaperFraming // 素材制作配置；已发布图片仍使用 assets
}

type TTabbedSurface<TTab extends string> = {
  default: TSurface
  byTab?: Partial<Record<TTab, TSurface>>
}

type TCardSurfaces<TCard extends string> = {
  default: TSurface
  byCard?: Partial<Record<TCard, TSurface>>
}

type TLandingSharedAppearance = {
  decorationEnabled?: boolean
}

type TArticleTab = Extract<TThread, 'POST' | 'KANBAN' | 'CHANGELOG' | 'DOC'> // 以现有实际枚举值为准
type TDashboardTab = keyof typeof INTROS // 落地前先统一 ANALYSIS/TREND，并与实际 tab 列表对齐
type TBatteryCard =
  | 'bundleSize'
  | 'mobileFirst'
  | 'darkMode'
  | 'security'
  | 'richContent'
  | 'integration'
  | 'design'
  | 'statistics'

type TLandingAppearance = {
  page: TSurface
  opening: TSurface
  sections: {
    cover: TSurface
    articles: TTabbedSurface<TArticleTab>
    dashboard: TTabbedSurface<TDashboardTab>
    battery: TCardSurfaces<TBatteryCard>
    compare: TSurface
    users: TSurface
    join: TSurface
    footer: TSurface
  }
}
```

`TTabbedSurface` 应有默认表面和可选的 `byTab` 覆盖；`TCardSurfaces` 应有默认卡片表面和可选的 `byCard` 覆盖。缺少某个 tab/card 覆盖表示继承该区域的默认表面，不能回退到上一 Scene 的值。Articles 沿用现有 `TThread`，Dashboard 以 `INTROS` 实际 tab key 为界，Battery 在实现阶段建立稳定卡片 ID。上面的 union 是目标示意，具体枚举值应按现有常量核定；Dashboard 的 `ANALYSIS`/`TREND` 分歧须先收敛。现有 `TCoverScene` 的 `id/label` 和壁纸资源迁入 Scene；`coverImage` 迁到封面组件固定配置，不进入 Scene；动效字段 `wallpaperPanAxis` 留在封面交互配置，不并入背景 token。

### 顶层字段

| 字段                    | 必需 | 含义                                                                   | 页面部位                                    |
| ----------------------- | ---- | ---------------------------------------------------------------------- | ------------------------------------------- |
| `id`                    | 是   | 稳定选择键；持久化或 URL 同步时使用                                    | 封面切换器、Scene 状态                      |
| `label`                 | 是   | 选项的可读名称；若需要多语言，应改为文案 key                           | 封面壁纸卡片的名称/无障碍描述               |
| `themePreset`           | 是   | 完整 light/dark 基础主题 token                                         | 整个 Landing 的基础色、文字、卡片与通用控件 |
| `wallpaper.light/dark`  | 是   | 两种模式各自的壁纸配置                                                 | 页面两侧/外层壁纸、封面主卡、壁纸预览卡     |
| `appearance.shared`     | 否   | 两种模式确实相同的非颜色行为，如装饰启用状态；不能代替 light/dark 颜色 | 对应 Landing 区域                           |
| `appearance.light/dark` | 是   | 两种模式下各区域的外观                                                 | 首屏及以下所有 section                      |

### `themePreset`：复用 Core 语义

Core 的 `TResolvedThemePreset` 字段见 `frontend/core/spec/theme_preset.d.ts`。Landing Scene 包含它的完整形状；并非以下每项都要在 Landing 中新增一套实现。

| 字段                                      | 页面部位与用途                                                              |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `shared.glowFixed`                        | 保留 token；Landing 的 StaticLayout 当前未挂载 GlowBackground               |
| `light/dark.pageBg`                       | `Main` 页面底色；`page: inherit` 时也是各区域的最终基底                     |
| `light/dark.pageBgHue`、`pageBgIntensity` | 保留 token；当前前端未找到消费点                                            |
| `light/dark.primaryColor`                 | 全站主要按钮、链接、选中态等通用 primary 语义                               |
| `light/dark.accentColor`                  | 次级强调色和可复用 accent 语义                                              |
| `light/dark.textTitle`、`textDigest`      | Hero、section 标题与说明文字，以及通用组件文字                              |
| `light/dark.cardColor`、`dividerColor`    | 通用卡片、菜单、分隔线、FAQ 等组件表面                                      |
| `light/dark.gaussBlur`                    | 已有 Core CSS 派生用途；Landing 接入 ThemePreset 后需检查与页面表面叠加效果 |
| `light/dark.glowType`、`glowOpacity`      | 保留 token；Landing 当前未挂载 GlowBackground                               |

### `wallpaper.light/dark`：每个模式必备

| 字段                               | 含义                                                 | 页面部位                                                          |
| ---------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------- |
| `type`、`source`                   | 壁纸种类和稳定来源标识，沿用现有壁纸契约             | Wallpaper Store、封面切换器                                       |
| `assets.wide/desktop/tablet/phone` | 各断点已发布资源与尺寸；确有同源资源时可以显式复用   | 页面外层壁纸及响应式背景                                          |
| `preview`                          | 选项缩略图资源；可从对应资源生成，但最终应有确定引用 | 左右壁纸卡片、移动端壁纸栏                                        |
| `cover`                            | 主封面中展示的壁纸资源；可与 `assets` 共享           | `MainCover` 背景                                                  |
| `pattern`                          | 可选的叠加图案：启用、图案 ID、强度、明暗等          | 外层壁纸的纹理层；当前 `LANDING_INIT_DATA` 两模式都启用了 pattern |
| `framing`                          | 可选取景配置；不作为运行时样式                       | 素材制作/导出                                                     |

现有 `coverImage.light/dark` 是**产品截图**，与壁纸不是同一个概念。当前留在封面组件的固定内容配置，不进入 Scene；未来确需按 Scene 换截图时再加入 `coverContent`。目前所有选项都复用同一组产品截图。

### `appearance.light/dark`：Landing 专属视觉

| 字段                         | 当前页面部位                                                                              | 当前表现                                         | 抽取后控制什么                                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `page`                       | 整页 `Main` 表面                                                                          | 当前 `bg-pageBg` 为纯色                          | 页面级表面，默认继承 `themePreset.pageBg`；允许整页渐变                                                |
| `opening`                    | Hero 背后及首屏展开区域                                                                   | `landing-opening-backdrop` 使用 `bg-pageBg`      | 首屏底色或柔和装饰，默认继承 `page` 的最终表面；`page: inherit` 时即 `pageBg`；开场宽度动画仍由 CSS 管 |
| `sections.cover`             | 主封面及左右 rail 的边框、阴影和遮罩                                                      | `CoversPreview/styles.css` 固定值                | 封面背景、边框与阴影；遮罩为组件固定效果，几何和动效仍归组件                                           |
| `sections.articles.default`  | ArticlesIntroTabs 演示区的大背景                                                          | 当前无独立 default 层                            | 未覆盖 tab 的基底；可为纯色/继承                                                                       |
| `sections.articles.byTab`    | Forum、Board、Changelog、Docs 四个 tab                                                    | 紫、蓝、红、青渐变                               | 每个 tab 可覆盖背景；素色 Scene 可全部继承默认表面                                                     |
| `sections.dashboard.default` | DashboardIntros 演示区的大背景                                                            | 当前无独立 default 层，部分 tab 无渐变           | 未覆盖 tab 的基底表面                                                                                  |
| `sections.dashboard.byTab`   | Appearance、Post、Tags、Classic、Admins、SEO、Import 等 tab                               | 分别使用不同色的渐变；部分 tab 无专属渐变层      | 各 tab 可选覆盖；未配置时继承默认，不需为每个 tab 强行造渐变                                           |
| `sections.battery.default`   | BatteryBento 卡片                                                                         | 卡片各有不同彩色渐变                             | 卡片基底与边界；hover 强度由组件固定交互规则控制                                                       |
| `sections.battery.byCard`    | Bundle、Mobile、Dark Mode、Security、Rich Content、Integration、Design、Statistics 等卡片 | 按卡片写死的紫、棕、青、绿、蓝、粉、黑、橙等渐变 | 可选择逐卡配色，或统一为克制的纯色卡片                                                                 |
| `sections.compare`           | CompareDev 的两侧对比墙及大面积背景                                                       | 绿色渐变、红色浅背景和条纹                       | 主要表面；对比条、条纹强度为组件固定效果，须保持正反语义清晰                                           |
| `sections.users`             | UsersWall 整区背景                                                                        | 灰色淡渐变                                       | 背景、纸张与页面的层次关系；纸张本身优先用 `cardColor`                                                 |
| `sections.join`              | JoinOurCommunity 外层与内层纸张                                                           | 主要使用通用背景、边框和卡片色                   | 如 Scene 需要不同的收束区域，可配置表面；默认继承基础 token                                            |
| `sections.footer`            | Landing 自有 Footer，及必要时静态页脚的表面                                               | 主要由通用 token 和当前 Salon 控制               | 页面末端的底色与边界；文字强调使用 `primaryColor`/`accentColor`                                        |

`TechStacks` 中的键盘墙明确设置了 `data-theme='dark'`，属于产品展示里的固定暗色舞台；不应因为页面进入 light Scene 就自动反色。它周围的 section 背景可先继承 `pageBg`，只有确有设计需要时再新增 `sections.tech`。FAQ 同样先沿用基础文字、卡片与分隔线 token，不单列 Scene 字段。

## 背景类型和继承规则

- `inherit`：引用父级最终表面；opening 和 section 取 `page` 的最终表面，`page: inherit` 才取 `themePreset.pageBg`。
- `none`：不建立新背景层，直接露出父级；与引用父表面值的 `inherit` 不同。
- `solid`：明确指定该区域纯色；适合与页面底色有轻微层次的区域。
- `gradient`：指定受控的色标与方向；只用于 Scene 设计要求的区域。
- `image`：仅在区域确实需要额外图片时使用；页面主壁纸仍归 `wallpaper` 管。
- `border`、`shadow` 省略等同 `inherit`；border 继承 `dividerColor`，shadow 继承组件既有默认阴影。`none` 显式关闭效果。遮罩、hover 强度及条纹形状归组件固定规则。
- tab/card 的默认表面必须明确；局部覆盖可省略，省略即继承当前 Scene 的默认值。
- light/dark 各自完整定义。切换主题时从同一 Scene 的对应分支读取，不从另一模式或另一 Scene 继承。
- `TColor` 允许校验后的 hex、带透明度的 oklch 以及白名单语义 token 引用；渐变的动态收口引用 `pageBg`。`TBackground.image.asset` 仅接受打包静态资源清单中的路径；未来接 Assets Hub 时增加已发布资源引用分支。壁纸的 `assets` 遵守现有已发布 profile 契约，`preview`/`cover` 遵守静态壁纸资源路径校验；颜色与资源进入 CSS 前均需校验。Core 现有 ThemePreset CSS 序列化只接受安全颜色值，不能直接用它处理任意渐变或图片 URL。

## 实施阶段

1. 机制阶段：将九个选项分别放入起始槽位文件，显式定义基础主题、light/dark 壁纸、页面和区域表面；按 tab/card 的业务 ID 选择覆盖，缺项取当前 Scene 的 default，并保持当前外观。现有渐变 token 和封面局部装饰变量是保留像素表现的兼容映射。
2. 视觉阶段：逐个 Scene 设计真正的 light/dark 壁纸与配色；需要新视觉时直接修改对应 Scene 文件。允许素色、单色或多色方案。若封面局部装饰也需要新表现，再把现有具名 CSS 变量升级为受控效果对象。
3. 两阶段都检查 Scene 切换、主题切换和首次绘制。首屏需同时具备 light/dark 数据，遵守 `docs/feature/wallpaper/theme-source.md` 的 pre-paint `data-theme` 契约。

## 来源与优先级

| 来源                                                       | Scene 字段                                                     | 规则                                                                                                       |
| ---------------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `Main.tsx` 的 `bg-pageBg` 与 `theme_preset.d.ts`           | `appearance.page`、`themePreset.pageBg`                        | 页面表面落点及基础色；仅已被 Landing 渲染路径消费的字段算当前生效                                          |
| Core 色彩 token                                            | `themePreset`                                                  | 基础色默认值；仅已被 Landing 渲染路径消费的字段算当前生效                                                  |
| `coverScenes.ts`、`LANDING_INIT_DATA`                      | `wallpaper`、`id/label`                                        | 当前 `TCoverScene` 为迁移来源，不直接视为完整 Scene；非 feedback 的四档图片均是同一张 1920×1080 占位资源   |
| `tokens/color.css` 的 `landing-gradient-*` 与 `gradient-*` | `appearance.sections.articles/dashboard/battery/compare/users` | Articles/Dashboard 使用 `byTab`，Battery 使用 `byCard`，Compare/Users 使用 section surface；缺项取各自基底 |
| Battery、Compare、Users Salon                              | 对应 `appearance.sections`                                     | 组合 Core 渐变和组件表面；缺省取各自基底                                                                   |
| `domain.css`、`CoversPreview/styles.css`                   | `appearance.sections.cover` 或组件固定效果                     | 对比条、条纹、纸张打孔、键盘颜色和封面边框阴影需逐项判定；Compare 的绿色渐变来自 Core token                |

| 冲突                           | 优先级                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `page` 对 `themePreset.pageBg` | `page.background: inherit` 取 `pageBg`；显式背景覆盖页面表面                                                                                      |
| section 对 page                | section `inherit` 取页面最终表面；`none` 表示移除额外背景层，露出父表面                                                                           |
| card/border 对基础 token       | 卡片背景 `inherit` 取 `cardColor`，border `inherit` 取 `dividerColor`，shadow `inherit` 取组件默认阴影；`none` 取消该效果；显式值只作用于当前区域 |
| `byTab`/`byCard` 对 `default`  | 局部覆盖优先；缺项取当前 Scene 的 default，不读取上一 Scene                                                                                       |
| `shared` 对 light/dark         | shared 仅放跨模式非颜色行为；若字段发生冲突，以当前 light/dark 分支为准，并在校验时报告冲突                                                       |

## 首屏与验收

Landing 是独立 document，Scene CSS 可以写在本页 `:root`，但不得影响其他宿主。现有 Core ThemePreset serializer 仅输出安全颜色子集，不能直接用于渐变和图片。实现时须在 SSR HTML 中输出默认 Scene 的 light/dark token 与受控的 Landing 外观 CSS；pre-paint 的 `data-theme` 负责选模式。运行时选择 Scene 时应一次更新壁纸和颜色，避免短暂显示旧 Scene 或默认主题。

第一阶段验收：九个 Scene 各有静态文件并显式包含两种模式；刷新后从 `center` 开始；SSR HTML 含默认 Scene 的两种模式 CSS；切换 Scene 与主题时壁纸和页面样式同批更新；现有视觉、tab 与卡片 fallback 保持不变。选择状态不写 URL 或存储，刷新和浏览器后退都回到初始 Scene。

第二阶段验收：每个 Scene 的两种模式都有经过设计核定的壁纸资源；纯色 Scene 无残留彩色渐变；封面与主体从同一 Scene 取 token，页面大色块无 Scene 外硬编码；文字、按钮及焦点态达到 WCAG AA 对比度；减少动态效果偏好下仍可正常切换。

## 非目标与开放问题

本阶段不改变页面布局、内容、组件动效时序，也不把产品演示里的每个状态色、纸张打孔和键盘细节都变成 Scene 字段。`DashboardIntros` 当前实际挂载于 Landing 的 Suspense 区域；顶部注释掉的旧调用不是禁用状态。Dashboard 的 `ANALYSIS`/`TREND` 标识须在按 tab 配置前统一。

**选择状态：** 本阶段仅在本次页面访问有效，不写入 URL 或存储；刷新重置到 `center`。若将来需要持久化，SSR 必须能在首屏前取得同一 Scene ID 并输出对应 CSS 与资源。
