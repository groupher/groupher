# Wallpaper NONE 与页面背景绘制边界

> 文档角色：Active companion contract；Root/Content 条件绘制代码已落地，浏览器长页面验收待完成
>
> 日期：2026-09-05
>
> 文件名中的 `fallback` 是历史命名。当前契约不再为 Wallpaper 定义 Content fallback。
>
> 当前实现差异：浏览器长页面与真实预览宿主仍需验收；代码侧已将 Root 基础色移到全局 `html/body`，并
> 将 Content surface 的颜色与 blur 收敛为有 Wallpaper 才启用。具体未完成项以 §10 未勾条目为准。
>
> 未完成项总表：[Wallpaper 后续工作](./followups.md#3-核心链路剩余验收与编辑器接线) §3.1；本文的未勾选项
> 是验收/接线任务，不代表 Root/Content 核心绘制规则尚未落地。
>
> 保存模型：[当前 theme 单独保存重构](./current-theme-save-refactor.md)
>
> 当前实现参考：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [实时编辑与静态发布边界（v1 主体归档）](./static-wallpaper.md) · [实时预览架构](./preview-architecture.md)

## 1. 目标

Wallpaper 与 Content 是两套独立设置：Wallpaper 只决定图片层，Content 只决定中间内容显示区的视觉。
两者不能互相复制配置，也不能把同一份半透明背景同时画在 Root 和 Content 上。

`contentShadow` 独立存储后，渲染门仍保持 Wallpaper 分支与全局开关的合取关系：

```text
effectiveContentShadow[theme] = hasWallpaper[theme] && dashboard.contentShadow
```

因此 `contentShadow = true` 不会在 Wallpaper 为 NONE/`null` 时单独制造 Content surface 效果；
NONE 只关闭本次视觉消费，不清除 Dashboard 中保存的 shadow 配置。

最终绘制分为三层：

```text
底层  Root page canvas：始终绘制不透明的页面基础颜色
中层  StaticWallpaper：仅当前 theme branch 非空时绘制图片
上层  Content surface：仅有 Wallpaper 时绘制 Content 半透明颜色和 backdrop blur
顶层  页面内容
```

这不是“Content 背景作为 Wallpaper fallback”。Wallpaper 为 `null` 时只是图片层透明；页面颜色本来就由
Root page canvas 独立、持续地绘制。

## 2. 现有背景变量的职责

不新增或重命名 CSS variable。实现使用现有变量区分两个用途：

- `--color-page-custom`：原始、不透明的页面颜色，供 `html`、`body` 或唯一应用 Root 绘制；
- `--color-page-custom-bg`：结合透明度后的派生颜色，供 Content surface 使用；
- `--color-pageBg`：保留为 Content 消费侧 alias；在 `.page-custom` 中解析到
  `--color-page-custom-bg`；
- `--preview-page-bg`：保留为编辑器 Preview host 的局部覆盖。

`frontend/core/tailwind/tokens/color.css` 中的 `--color-page-custom-bg: var(--color-page-custom)` 只是
没有有效 ThemePreset 数据时的静态、不透明默认值。真实 ThemePreset 的透明派生已经集中在
`frontend/core/lib/theme/preset.ts` 的 `composeThemePresetCssVars()`：它用 `blurRGB(pageBg, gaussBlur)`
生成 `--color-page-custom-bg`，再由 `serializeCommunityThemePresetCss()` 及 ThemePreset provider 写入
`:root` 和 `[data-theme='dark']`。该派生始终由 ThemePreset 完成，与 Wallpaper branch 是否存在无关；
Wallpaper 状态只决定 Content surface 是否消费这个已派生值。

Root page color 和 Content surface color 来自同一份 Content 设置，不是两个独立真相源。Root 直接使用
`--color-page-custom`；Content surface 才通过 `--color-pageBg` 使用透明派生值并启用 `backdrop blur`。
禁止为了描述这一区别再引入平行 CSS variable 命名。

`.page-custom` 不迁移到 `html` 或 `body`。`Main.wrapper` 继续通过 `page()` 携带这个 utility，仅在
Content 局部边界建立 `--color-pageBg` alias；其子节点 `Main.background` 因继承关系能够读取正确的
`--color-page-custom-bg`。Root 不需要该 alias，直接读取 ThemePreset 已写入 `:root` 的
`--color-page-custom`。这样既保持现有挂载点，也不会把透明 Content 语义扩散给所有 Root 后代。

当没有 Wallpaper 时，透明度和高斯模糊没有可处理的背景素材，视觉上应自然成为 no-op。设置值仍然保留，
但不应为了“体现设置”在 Content 区域重复绘制一层半透明颜色。

## 3. NONE 语义

当前 theme 的 `TWallpaperSettings.type = 'none'` 表示没有 Wallpaper 图片层：

```text
dashboard.wallpaper[theme] = null
  -> StaticWallpaper 不产生图片像素
  -> Root page canvas 继续显示页面基础颜色
  -> Content surface 不绘制半透明颜色，不启用 backdrop blur
```

NONE 不表示白色、透明白或默认渐变，也不触发纯色图片生成。Frontend 不根据这个 `null` 在 Wallpaper
层定义默认色、复制 Content rgba 或生成占位图片。

## 4. 单一真相源

Content 设置负责：

- 页面基础颜色及其不透明 Root 派生值；
- 有 Wallpaper 时 Content surface 的透明度与模糊效果；
- Theme token 到上述两个绘制值的解析；
- Content 容器、卡片和 overlay 的局部层级。

Wallpaper 设置负责：

- 当前 theme 是否存在壁纸；
- 已发布 Profile 图片；
- 图片的响应式选择和 cover 行为；
- Wallpaper 自身效果已经烘焙后的最终像素。

禁止：

- 在 Wallpaper settings 中保存 Content 背景颜色；
- `StaticWallpaper`、Wallpaper wrapper 或图片加载错误分支绘制默认颜色；
- Root 与 Content surface 同时绘制同一份半透明颜色；
- Frontend 为 NONE 定义另一套默认 Wallpaper；
- 生成纯色或透明占位图片；
- 把 Content rgba 预先拍平成 Wallpaper 颜色；
- 因缺少静态图片而回退到某个内置 Wallpaper preset。

## 5. 运行时状态

| 当前 theme 状态         | Root page canvas       | StaticWallpaper       | Content surface                             |
| ----------------------- | ---------------------- | --------------------- | ------------------------------------------- |
| 有 Wallpaper            | 始终绘制不透明页面颜色 | 绘制对应 Profile 图片 | 绘制 Content 半透明颜色并启用 backdrop blur |
| NONE / branch 为 `null` | 始终绘制不透明页面颜色 | 不绘制                | 保持透明且不启用 backdrop blur              |

Root page canvas 始终存在；条件只控制 Wallpaper 图片和 Content surface 效果，不在有无 Wallpaper 之间
迁移背景 owner。无 Wallpaper 时全页只由 Root 绘制一次颜色，因此 Content 区域不会因重复 alpha 合成
出现块状深浅差异。

有 Wallpaper 时，Root 仍作为稳定底色存在，Wallpaper 图片覆盖其上；Content surface 才在中间显示区对
图片进行局部着色和模糊。这是正常的空间合成，不表示 Content 设置参与 Wallpaper 的保存或生成。

`StaticWallpaper` 只写已发布 Profile 图片变量，缺图时变量值为 `none`。它不接受 fallback 颜色，也不
负责 Root page canvas。编辑页的 `EditorStaticWallpaper` 只提供当前编辑 draft 的 CSS 预览层，同样不能
成为页面基础颜色的 owner。

普通页面不跟踪 CSS `background-image` 的网络加载状态，也不引入隐藏 `<img>`、preload 探测或
`wallpaper-failed` 状态。Content surface 是否启用只按 GraphQL branch 判断；URL 404 时由浏览器自然不
绘制图片，资产故障交给监控和数据对账处理，不进入页面背景状态机。

存在判断按消费场景分别取值，只共享规则，不共享同一个状态：

```ts
// 普通页面：已发布静态数据
hasPublishedWallpaper = dashboard.wallpaper[currentTheme] !== null

// 编辑器预览：当前尚未发布的 draft
hasPreviewWallpaper = normalize(draftSettings).type !== 'none'
```

普通页面用 `hasPublishedWallpaper` 控制 `Main.background`；编辑器 Preview host 用
`hasPreviewWallpaper`，确保选择 NONE 后无需保存即可立即关闭 Content surface。

这里的 Preview host 不等于 editor route 的外层 `GlobalLayout`：`GlobalLayout/Main.wrapper` 即使位于
editor route，也继续使用已发布 Wallpaper 与已确认的 `dashboard.contentShadow`。未保存的 draft 只驱动
`PreviewPanel`、`GlobalPreview` 和 `AuthPreview` 等编辑器预览宿主，不改变外层 Dashboard shell。

## 6. SSR 与 theme 切换

服务端同时拿到 light/dark 的发布图片，首屏根据 pre-paint `data-theme` 选择当前分支：

- 当前 theme 有 Wallpaper：显示对应 Profile 图片，并启用 Content surface 效果；
- 当前 theme 为 NONE：不显示 Wallpaper 图片，Content surface 保持透明；
- 切换 theme：独立判断目标 theme 是否有 Wallpaper，并同步切换图片层与 Content surface 状态；
- Root page color 随 theme token 正常切换，不等待 hydration。

NONE 分支不能产生白色闪烁，也不能先显示另一 theme 的 Wallpaper 或 Content surface 再撤下。

## 7. Wallpaper 编辑器

编辑 route 使用 WebGPU 显示当前 `TWallpaperSettings`，但 Preview host 必须模拟与普通页面相同的三层
结构。当用户选择 NONE：

- 立即隐藏 GPU Wallpaper 层；
- 预览 Root 显示当前页面基础颜色；
- Content surface 关闭半透明颜色和 backdrop blur；
- Save 发布 NONE Snapshot，不生成图片；
- Cancel 恢复保存前的 Wallpaper 图片及 Content surface 状态。

编辑器不能用白色 canvas、`hoverBg` 或内置 preset 代替页面基础颜色。Global/Auth 等 Preview host 必须
共用 Root page color 与同一条渲染规则，但存在性读取编辑 draft 的 `hasPreviewWallpaper`，不能误用普通
页面的 published branch，也不能由 `WallpaperPreview` 自己补色。

## 8. 未初始化状态

Backend 为编辑器返回完整默认 `TWallpaperSettings`，Frontend 不指定默认设置。未初始化并不等于已经
发布 Wallpaper：

```text
dashboard.wallpaperSettings
  -> Backend 默认编辑配置

dashboard.wallpaper
  -> { version: 0, light: null, dark: null }
```

默认编辑配置只帮助编辑器展示控件，不得自动成为普通页面的 Wallpaper 图片层。`dashboard.wallpaper`
外层始终非空；未初始化和已经保存 NONE 在普通页面都不绘制图片，Root page canvas 负责基础颜色，
Content surface 不重复绘制。

每个 theme 的 editor baseline 独立解析：有 active Snapshot 时返回该 Snapshot 的完整 settings，包含
已保存的 `type: 'none'`；只有没有 active Snapshot 时才使用 Backend 默认 settings。Frontend 不得把
`'none'` 当作缺省值并自行替换成默认配置。

## 9. 响应式选择

当前 theme 有 Wallpaper 时，前端直接读取固定 Profile：

```text
wallpaper[theme].phone
wallpaper[theme].tablet
wallpaper[theme].desktop
wallpaper[theme].wide
```

可以使用 `<picture>/<source>` 或等价 CSS media query 在首屏选择图片。Profile 切换不影响 Root page
color 或 Content 设置所有权。图片加载失败不创建新的页面状态，也不能用硬编码白色替代页面基础颜色。

## 10. 实施清单

- [x] 删除 `StaticWallpaper.fallback`、Wallpaper wrapper 上的默认背景色和 dark→light fallback。
- [x] `dashboard.wallpaper[theme] = null` 时不渲染静态图片层。
- [x] NONE 的 GPU/CSS recipe 不产生 Wallpaper 像素。
- [x] `composeThemePresetCssVars()` 独立于 Wallpaper 状态生成 `--color-page-custom` 和透明派生的
      `--color-page-custom-bg`。
- [x] Root 通过全局 `html/body` 使用现有 `--color-page-custom` 绘制唯一、不透明的页面基础色，不新增 CSS variable，
      也不把 `.page-custom` utility 迁移到 Root。
- [x] `Main.wrapper` 保留 `page()`/`.page-custom` 作为局部 `--color-pageBg` alias 挂载点，但不再无条件
      绘制该颜色或启用 blur。
- [x] `Main.background` 仅在 `hasPublishedWallpaper` 为真时通过 `--color-pageBg` 绘制 Content surface
      颜色与 blur。
- [x] hard cut 后仍保持 `hasWallpaper[theme] && dashboard.contentShadow` 的渲染门；NONE/`null` 只关闭效果，
      不删除独立 Dashboard shadow 配置。
- [x] 显式固定 Root、Wallpaper、Content surface 和内容的 stacking context，不能依赖 sibling DOM 顺序。
- [x] Global/Auth Preview host 复用真实 Root page color，并由 `hasPreviewWallpaper` 控制 Content surface；真实浏览器验收仍待完成。
- [x] editor route 的外层 `GlobalLayout/Main.wrapper` 继续使用 published branch；draft 只由 PreviewPanel 及其
      Global/Auth preview host 消费。
- [ ] SSR 在首次 paint 前同步决定当前 theme 的 Wallpaper 与 Content surface 状态。
- [ ] theme 切换分别处理 light/dark 的存在与 NONE。
- [x] active NONE Snapshot 在 Editor 中仍显示 `'none'`，不回退到 Backend 默认 settings。
- [x] 普通页面不加载 editor settings/history；`PageCommunity` 只返回已发布 Wallpaper 与独立的
      `dashboard.contentShadow`，GPU runtime 仍按既有 Static/Editor 运行时边界加载。
- [x] 增加纯函数/组件测试：light-only、dark-only、双 nil、version 0、dark 不回退 light，以及 published
      branch/draft NONE 对各自 Content surface 开关的控制。
- [x] 增加布局集成测试：双 nil 时 Root 使用 `--color-page-custom`，`Main.background` 透明且无
      `backdrop-filter`。
- [ ] 浏览器最终验收无壁纸时全页颜色均匀，不因 Content 区域重复 alpha 合成形成色块。

## 11. 验收矩阵

| 场景                                         | 预期                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------- |
| light 有 Wallpaper，dark 有 Wallpaper        | 两个 theme 各自显示对应 Profile 图片；Content surface 各自启用             |
| light 为 NONE，dark 有 Wallpaper             | light 只显示 Root page color；dark 显示图片及 Content surface 效果         |
| light 有 Wallpaper，dark 为 NONE             | light 显示图片及 Content surface 效果；dark 只显示 Root page color         |
| light/dark 都为 NONE                         | 两边都只显示各自的 Root page color，Content 区域没有色块                   |
| Wallpaper 为 NONE，但 `contentShadow = true` | 仍不绘制 Content surface；独立 shadow 配置保留，Wallpaper 恢复后可重新生效 |
| 未初始化                                     | 普通页面只显示 Root page color；编辑器使用 Backend 默认 settings           |
| 保存当前 theme 为 NONE                       | 外层保留，当前 branch 为 `null`；Content surface 同步关闭                  |
| Editor 选择 NONE                             | 预览显示真实 Root page color，Save 不导出图片                              |
| Editor Cancel NONE                           | 恢复之前的 Wallpaper 图片及 Content surface 效果                           |
| 窄屏切换 Profile                             | 选择 phone/tablet 图片，Root 与 Content 设置所有权不变                     |
