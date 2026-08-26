# SSR 首次绘制主题

> 历史实现说明：文中的 Next `useServerInsertedHTML` 和旧 Main/Dashboard 文件路径仅用于
> 解释迁移前实现；当前 hosts 使用 TanStack 与共享的 pre-paint script。

> 状态：设计说明和实现指南。 Wallpaper/renderSpec 不在此范围内，应单独处理。

## 问题

Groupher 使用 CSS 变量来定义主题颜色，但在 SSR hydration 期间，暗色模式仍然可能闪烁。

调试中的关键发现是：

```text
prePaintThemeDetectScript sets html[data-theme='dark']
first visible frame is dark
Next/React hydration may briefly reconcile <html> back to the SSR attribute shape
html[data-theme] becomes missing/light for a short window
ThemeMonitor mounts and writes dark again
```

这会产生可见的序列：

```text
dark -> light/null -> dark
```

这不等同于“SSR 没有暗色 CSS”。暗色 CSS 是存在的。问题在于，承载这些 CSS 的根选择器在 hydration 窗口内可能变得不稳定。

## 为什么提前内联脚本通常有效

Rspress 和 VitePress 这类静态文档站，会在`<head>`中很早执行一个很小的内联脚本来避免主题闪烁：

```html
<script>
  // localStorage / matchMedia -> html.classList.add('dark')
</script>
```

普通的内联经典脚本在执行时会阻塞解析。如果它足够早执行，那么第一次样式计算和首次绘制已经能看到`html.dark`或`html[data-theme='dark']`。

因此浏览器时序是：

```text
parse <head>
run inline theme script
set root theme selector
calculate styles
first paint
```

Groupher 采用相同的首次绘制方向，但 Next hydration 在首次绘制之后又增加了一个阶段。在这个阶段里，React 可能会协调根`<html>`属性，并短暂移除脚本写入的`data-theme`。

## 约束

- 不要用 cookie 作为主题的事实来源。
- 主题值保持由 CSS 驱动。
- 不要在客户端首次渲染期间从`document.documentElement.dataset.theme`初始化`ThemeStore`。这会让客户端树与服务端树不同，并可能引发 hydration mismatch。
- 不要通过让单个`ui`组件各自承担 hydration 窗口补丁来修复。
- 不要把它当成仅 Dashboard 的问题。 Main、Dashboard、Landing 以及未来的子应用共享同一个根主题问题。

## 目标模型

使用一个应用级的首次绘制机制：

```text
color.css
  default light/dark CSS variables

optional community theme preset CSS
  current community effective ThemePreset tokens, if the payload has them

prePaintThemeDetectScript()
  runs before first paint
  detects theme from localStorage or matchMedia
  applies html[data-theme] and color-scheme

injectThemeFirstPaintVars()
  snapshots computed theme CSS variables for the current theme only
  writes them into a temporary head style tag

ThemeFirstPaintScript()
  is server-inserted before <body>
  installs a root fallback snapshot for default color.css vars

CommunityThemePresetStyle()
  is server-inserted by community routes with complete ThemePreset tokens
  emits community preset CSS and then immediately re-runs the snapshot script

ThemeMonitor
  applies runtime theme state
  removes the temporary first-paint style after runtime state has taken over
```

目标不是创建第二套主题系统。临时样式只是在 React 可能协调`<html>`时，维持已计算主题变量的稳定。

## 命名

使用通用名称。避免在这一层使用`Dsb`、`Dashboard`或`bootstrap`。

推荐名称：

```ts
prePaintThemeDetectScript()
injectThemeFirstPaintVars()
removeThemeFirstPaintVars()
THEME_FIRST_PAINT_STYLE_ID
THEME_FIRST_PAINT_VAR_NAMES
```

样式 id 必须以常量形式定义：

```ts
export const THEME_FIRST_PAINT_STYLE_ID = 'groupher-theme-first-paint'
```

不要在调用点内联这个 id。

## 变量事实来源

`frontend/core/tailwind/tokens/color.css`和
`frontend/core/tailwind/tokens/shadow.css`是默认首次绘制 CSS 变量名和值的事实来源。

`color.css`必须保持在同步的全局 CSS import 链中。当前链路是：

```text
frontend/core/tailwind/global.css
  -> frontend/core/tailwind/tokens/index.css
  -> frontend/core/tailwind/tokens/color.css
  -> frontend/core/tailwind/tokens/shadow.css
```

每个子应用根都应该把`global.css`作为全局 CSS 导入，不要懒加载`color.css`、通过`next/head`注入它，或者在 hydration 之后再通过客户端 CSS-in-JS 引入它。`injectThemeFirstPaintVars()`依赖默认主题变量在受保护的 body 内容被解析之前已经进入级联。

不要维护手写的变量白名单，例如：

```ts
const VARS = ['--color-title', '--color-card']
```

这会变成第二个事实来源，并且会与 token CSS 文件漂移。

相反，在构建期或开发期从`color.css`和`shadow.css`生成首次绘制变量名列表：

```text
frontend/core/tailwind/tokens/color.css
frontend/core/tailwind/tokens/shadow.css
  -> scripts/generate-theme-first-paint-vars
  -> frontend/core/constant/theme-first-paint.generated.ts
```

生成输出形状：

```ts
export const THEME_FIRST_PAINT_VAR_NAMES = [
  '--color-title',
  '--color-digest',
  '--color-card',
  '--color-divider',
  '--color-pageBg',
] as const
```

生成器应该使用 PostCSS 或结构化 CSS 解析器解析源 CSS。不要在浏览器里解析编译后的运行时 CSS。

然后首次绘制脚本会快照最终计算值：

```js
var computed = getComputedStyle(document.documentElement)
var css = ':root{'

for (var i = 0; i < THEME_FIRST_PAINT_VAR_NAMES.length; i += 1) {
  var name = THEME_FIRST_PAINT_VAR_NAMES[i]
  var value = computed.getPropertyValue(name).trim()
  if (value) css += name + ':' + value + ';'
}

css += '}'
```

这意味着：

- `color.css`负责默认 token 值。
- community theme preset CSS 可以在快照之前覆盖这些变量。
- `injectThemeFirstPaintVars()`不知道也不会重复 token 值。
- 维护首次绘制覆盖面意味着保持生成文件及时更新。

## 社区主题预设代币

community 路由可能从 SSR community 数据中获得有效的 ThemePreset tokens。这些 token 是当前 community 的最终主题结果，而不是原始 Custom overwrite 本身。它们可能来自内置 preset、Custom preset，或者后端合并后的 Custom overwrite。

它们仍然通过全局 CSS 变量名暴露。 “Community”描述的是值从哪里来，而不是这些变量能在哪里使用。

在当前应用中，这段 CSS 由以下内容生成：

```ts
serializeCommunityThemePresetCss(dashboard.themeTokens)
```

当前调用方：

- `frontend/main/src/app/[community]/layout.tsx`
- `frontend/dashboard/src/app/[community]/dashboard/layout.tsx`

路由通过 SSR dashboard/community payload 获取`dashboard.themeTokens`，并把当前 community 的有效 ThemePreset tokens 转换为长生命周期的 CSS 自定义属性。这不是`color.css`中的源 token 表；它是在`color.css`之上的 per-community 主题层。

示例解析后的形状：

```ts
type TResolvedThemePreset = {
  shared: {
    glowFixed: boolean
  }
  light: {
    pageBg: string
    primaryColor: string
    accentColor: string
    textTitle: string
    textDigest: string
    cardColor: string
    dividerColor: string
    gaussBlur: number
    glowType: string
    glowOpacity: number
  }
  dark: {
    pageBg: string
    primaryColor: string
    accentColor: string
    textTitle: string
    textDigest: string
    cardColor: string
    dividerColor: string
    gaussBlur: number
    glowType: string
    glowOpacity: number
  }
}
```

长生命周期的 community preset CSS 仍然应该输出两个主题分支：

```css
:root {
  --color-title: light-value;
}

[data-theme='dark'] {
  --color-title: dark-value;
}
```

输出的变量是当前由解析后的 preset token 表示的子集：

```text
--color-primary-custom
--color-accent-custom
--color-page-custom
--color-page-custom-bg
--color-title
--color-digest
--color-card
--color-divider
```

`--color-page-custom-bg`已经包含了页面背景上解析后的`gaussBlur`效果。其他在首次绘制阶段可见的值，例如 glow/filter，必须先移入 CSS 变量，这个机制才能保护它们。

`injectThemeFirstPaintVars()`不需要知道变量来自哪里。它在`prePaintThemeDetectScript()`选择了真实主题后读取计算值。因此它只输出当前主题的具体值。

## 脚本注入

这两个首次绘制脚本都必须是内联经典脚本。不要把它们做成`type="module"`、`defer`、`async`，也不要做成客户端 bundle 导入。

`prePaintThemeDetectScript()`应该尽早在`<head>`中输出：

```html
<script>
  // detect localStorage/system theme
  // set html[data-theme]
  // set document.documentElement.style.colorScheme
</script>
```

`injectThemeFirstPaintVars()`也应该是一个内联 head 脚本，但它需要在构建或服务端渲染时把`THEME_FIRST_PAINT_VAR_NAMES`序列化进脚本文本里。它不能在 hydration 之后从浏览器 bundle 中导入生成的 TS 文件：

```html
<script>
  var names = ['--color-title', '--color-card']
  var computed = getComputedStyle(document.documentElement)
  // write <style id="groupher-theme-first-paint">...</style>
</script>
```

预期的实现路径是：

```text
theme-first-paint.generated.ts
  exports THEME_FIRST_PAINT_VAR_NAMES

injectThemeFirstPaintVars()
  imports THEME_FIRST_PAINT_VAR_NAMES in the SSR-safe helper module
  embeds JSON.stringify(THEME_FIRST_PAINT_VAR_NAMES) into returned script text
```

不要从请求路径读取 token CSS，也不要依赖客户端 bundle 导入来提供变量列表。生成的 TS 文件是服务端渲染输入；`check:theme-first-paint-vars`负责让它与`color.css`和`shadow.css`保持同步。

`injectThemeFirstPaintVars()`不应该作为原始 route body script 输出。原始 body script 会成为 React hydration tree 的一部分，并可能引发警告或 mismatch。应该通过`useServerInsertedHTML`输出它，这样真实 HTML 会在`<body>`之前进入`<head>`。

community 布局应该输出长生命周期的 community preset CSS：

```tsx
<CommunityThemePresetStyle cssText={serializeCommunityThemePresetCss(dashboard.themeTokens)} />
```

`CommunityThemePresetStyle`只刻意输出长生命周期的 community preset CSS：

```text
<style>community preset CSS</style>
```

这里使用的是 CSS-in-JS 风格的 helper。它不是运行时客户端 CSS-in-JS。它通过 Next 的`useServerInsertedHTML()`在服务端渲染期间把 CSS 放入`<head>`：

```text
React component tree

RootLayoutShell
  body
    children
      [community layout]
        CommunityThemePresetStyle
          useServerInsertedHTML:
            <style>community preset CSS</style>

    ThemeFirstPaintScript
      useServerInsertedHTML:
        <script>injectThemeFirstPaintVars()</script>

Rendered HTML

head
  prePaintThemeDetectScript
  CommunityThemePresetStyle output
  ThemeFirstPaintScript output
body
  React content
```

关键细节是，helper 返回的`<style>`和`<script>`不会留在`<body>`中的 JSX 调用点。 Next 会把它们插入到`<head>`。

这个顺序已经在渲染出的 dashboard HTML 中得到验证：

```text
prePaintThemeDetectScript()
CommunityThemePresetStyle community preset CSS
ThemeFirstPaintScript first-paint snapshot
<body>
ThemePresetScope runtime style
```

这次单次快照发生在 community preset CSS 已经进入级联之后，但仍然在 body 内容解析之前。它也保护没有 community preset CSS 的页面，因为计算值会回退到全局主题变量。

快照脚本本身保持简单：

- 只读取一次计算后的自定义属性；
- 把它们写入`style#groupher-theme-first-paint`；
- 写入带`!important`的临时自定义属性，这样在 React 协调`html[data-theme]`时，后续的 SSR/runtime 样式就不会暴露 light-frame 回退。

## 配色方案

根主题选择还应该更新浏览器的 color-scheme：

```js
document.documentElement.setAttribute('data-theme', theme)
document.documentElement.style.colorScheme = theme
```

这不会替代应用 CSS 变量。它只是告诉浏览器如何渲染原生表面，例如滚动条、表单控件和内置背景。

`<meta name="color-scheme" content="light dark">`可以声明两种受支持的 scheme，但当用户已经有明确的明暗偏好时，pre-paint 脚本仍然应该设置当前的`colorScheme`。

## 脚本顺序

有两个时序要求：

```text
prePaintThemeDetectScript()
  should run as early as possible
  does not need theme CSS to be loaded
  decides theme and writes html[data-theme] / color-scheme

injectThemeFirstPaintVars()
  is installed after prePaintThemeDetectScript()
  snapshots once from the currently available cascade
  reads computed CSS variables for the already-selected theme
```

实际顺序是：

```text
1. prePaintThemeDetectScript() sets html[data-theme] before first paint
2. optional community preset CSS is emitted
3. ThemeFirstPaintScript snapshots the available color/shadow/community vars
4. React/Next hydration starts
5. ThemeFirstPaintScript or ThemeMonitor cleans temporary vars
```

关键要求是，临时首次绘制变量必须在 hydration 可能产生可见的 light-frame 回退之前安装完成。拥有完整 ThemePreset CSS 的 community 路由，必须在单次`ThemeFirstPaintScript`快照运行之前输出 preset CSS。

完整时序流程：

```text
Server render
-------------
RootLayoutShell
  emits early head script:
    prePaintThemeDetectScript()

CommunityThemePresetStyle, only when cssText exists
  server-inserts:
    <style>community theme preset CSS</style>

ThemeFirstPaintScript
  server-inserts:
    <script>theme snapshot</script>


Browser parses HTML
-------------------
head script: prePaintThemeDetectScript()
  localStorage / matchMedia -> html[data-theme]
  documentElement.style.colorScheme = theme

head style: community theme preset CSS
  add current community preset values to the cascade

head script: theme snapshot
  read computed vars from color.css + shadow.css + community preset CSS
  write style#groupher-theme-first-paint

body content parses
  first visible frame already has protected theme vars


Hydration window
----------------
Next/React may temporarily reconcile html[data-theme]
style#groupher-theme-first-paint keeps CSS vars stable

ThemeMonitor
  applies runtime theme state
  removes style#groupher-theme-first-paint on handoff
```

## 清理

首次绘制变量是临时的。运行时主题状态必须在 hydration 之后接管。

清理应该集中处理：

```ts
export const removeThemeFirstPaintVars = () => {
  document.getElementById(THEME_FIRST_PAINT_STYLE_ID)?.remove()
}
```

`ThemeMonitor`应该：

```text
1. read persisted/system mode
2. apply runtime theme through changeMode(mode, { keepFirstPaintVars: true })
3. wait until ThemeStore has rerendered to the resolved runtime theme
4. remove first-paint style on a next-paint handoff
```

优先在下一次`requestAnimationFrame`中删除：

```ts
changeMode(mode, { keepFirstPaintVars: true })
scheduleRemoveThemeFirstPaintVars()
```

这可以避免同一任务中的级联空窗，即在 React/Valtio consumer 从 SSR 安全的 light store 状态 rerender 到解析后的 runtime dark 状态之前，就把临时变量删除了。

运行时的主题切换动作应该先应用`data-theme`/`color-scheme`，然后再防御性地删除首次绘制变量，这样即使`ThemeMonitor`失败或延迟，也不会把初始主题永久锁住。只有初始的`ThemeMonitor`交接应该传入`keepFirstPaintVars: true`。

## 生成文件集成

生成的首次绘制变量列表应该提交入仓，但不能允许它偏离`color.css`或`shadow.css`。

使用两个脚本：

```text
yarn gen:theme-first-paint-vars
yarn check:theme-first-paint-vars
```

预期行为：

- `gen:theme-first-paint-vars`分析
  `frontend/core/tailwind/tokens/color.css`和
  `frontend/core/tailwind/tokens/shadow.css`，然后写入
  `frontend/core/constant/theme-first-paint.generated.ts`。
- `check:theme-first-paint-vars`在内存中或临时文件中重新生成，并在检查中的生成文件过旧时失败。
- 实现位于`scripts/generate-theme-first-paint-vars.mjs`。
- CI 应在这里完全强制之前运行`yarn check:theme-first-paint-vars`。

如果某个子应用使用运行时 CSS-in-JS，并且只有在 JS bundle 加载后才注入主题变量，那么这些值无法被首次绘制变量保护。首次绘制可见的主题 CSS 必须以静态 CSS 或在相关快照脚本运行之前通过服务端插入的`<style>`输出。

## 这覆盖了什么

这个机制覆盖所有通过 CSS 变量表达的值：

- 前景色，例如 title 和 digest
- card、divider、border、fill 和 surface 颜色
- 页面背景变量，包括`--color-page-custom-bg`，也就是`gaussBlur`应用后的最终页面背景
- community ThemePreset 颜色覆盖
- 未来任何迁移到 CSS 变量中的、依赖主题的视觉值

它不会自动覆盖：

- 基于`useTheme()`的 React 标记分支
- 第一次渲染时从 ThemeStore 计算出来的内联样式
- 没有通过 CSS 变量表示的`dark:*`工具类
- wallpaper/renderSpec 和图像资源选择
- 仍然通过 React hooks 而不是 CSS 变量计算的 glow/filter 值

对于这些区域，规则是：

```text
first-paint visible theme-dependent values should be CSS-var consumers;
React store should not decide SSR/client first-render structure or critical
inline styles.
```

## 剩余工作

1. 把`yarn check:theme-first-paint-vars`接入 CI。
2. 在期望这个机制覆盖之前，先把首次绘制可见的 glow/filter 值迁移到 CSS 变量。
3. 审计`dark:*`的使用：
   - 颜色应该迁移到语义化 CSS 变量；
   - 如果亮度、饱和度和不透明度的视觉修正会在首次绘制期间可见，就应该变成语义化的 filter/opacity 变量。
4. 单独处理 wallpaper/renderSpec。

## 验证

使用浏览器时间线采样，而不只是静态测试。

至少跟踪这些项：

```js
document.documentElement.getAttribute('data-theme')
getComputedStyle(document.documentElement).getPropertyValue('--color-title')
getComputedStyle(document.documentElement).getPropertyValue('--color-pageBg')
getComputedStyle(document.querySelector('main')?.firstElementChild).getPropertyValue(
  'background-color',
)
getComputedStyle(document.documentElement).getPropertyValue('color-scheme')
```

预期结果：

```text
data-theme may briefly become missing/light during hydration
critical computed vars remain on the first-paint theme value
ThemeMonitor restores runtime data-theme
first-paint style is removed
no hydration mismatch overlay
```
