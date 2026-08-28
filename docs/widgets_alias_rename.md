# 共享前端别名重命名

> 历史实施记录：下文的 Dashboard type-check 名称来自旧 workspace，当前对应应用为 Dash。

> 状态：已实现。
>
> 范围：将共享的`frontend/core/widgets`命名空间重命名为`ui`，将应用外壳组件移动到`shell`，将渲染组件移动到`render`，并更新对应的 TypeScript 别名和导入。

## 动机

当前的`~/widgets`别名指向`frontend/core/widgets`下的共享前端组件集合。这个集合主要包含 UI 和交互组件，但它的名称现在与产品概念 **Groupher Widget** 发生了冲突。

同一个词目前描述了两种不同的东西：

```text
~/widgets/Tooltip
  shared frontend UI component

frontend/widget
@groupher/widget
<groupher-widget>
  external product runtime
```

这次重命名让这种区别变得明确：

```text
~/ui/Tooltip
  shared UI

frontend/widget
  Groupher Widget product
```

当前快照中，`frontend/core/widgets`下大约有 423 个文件，约 508 个前端文件正在导入`~/widgets`。这些计数只是规划估算；迁移必须在实施时使用实际的导入图。

## 目标命名空间

```text
frontend/core/ui/
~/ui
  shared UI and interaction components

frontend/core/shell/
~/shell
  application root, theme bootstrap, and SSR shell components

frontend/core/render/
~/render
  content, background, and visual rendering components
```

这些命名空间都属于`@groupher/frontend-core`。它们是导入组织边界，不是独立包。

## 所有权规则

### `ui`

`ui`负责可复用的展示和交互组件，这些组件可以被 Main、Dashboard、Dash、Landing 或其他前端界面消费。

示例：

```text
Buttons
Cards
CheckLabel
Checker
ColorSelector
ColorsPresetBall
CustomScroller
Drawer
Facepile
IconHub
Img
ImgFallback
Input
Loading
Modal
NoticeBar
Pagi
Portal
RangeInput
Select
Switcher
Toaster
Tooltip
UserList
WordsCounter
```

在这次迁移中，`ui`不需要成为一个严格的设计系统包。带有少量 Groupher 特定假设的组件，只要仍然是共享的展示或交互原语，也可以保留在这里。

### `shell`

`shell`负责应用根、全局布局、关键主题初始化，以及服务端注入样式的组件。

初始候选项：

```text
GlobalLayout
RootLayoutShell
ThemeFirstPaintScript
ServerInsertedStyle
ResolvedThemeStyle
CommunityThemePresetStyle
```

这些组件不是普通控件。它们的位置应该传达出它们参与了应用启动和文档级渲染。

### `render`

`render`负责将内容或渲染规范转换为视觉输出的组件。

初始候选项：

```text
ArtimentBody
Markdown
BgRenderer
WallpaperRenderer
MarkerRender
```

以下组件仍保留在`render`之外：

```text
MarkdownEditor
  editor interaction, not read-only rendering

MarkerPicker
  user interaction, keep under ui
```

这个拆分依据的是职责，而不仅仅是组件名称。

## 明确不在范围内

这次迁移不得重命名或移动以下内容：

```text
frontend/landing/app/widgets
  Landing page-local composition directory

/dashboard/widgets
  Groupher Widget product management route

frontend/widget
@groupher/widget
<groupher-widget>
  Groupher Widget product runtime
```

`frontend/landing/app/widgets`是应用本地目录，与共享 Core 别名无关。`/dashboard/widgets`是产品路由，必须继续使用复数的`Widgets`标签。

这次迁移也不会把每个领域特定的共享组件拆分到新包中，也不会引入设计系统包。

## 别名变更

当前别名：

```json
{
  "~/widgets": ["./widgets"],
  "~/widgets/*": ["./widgets/*"]
}
```

目标别名：

```json
{
  "~/ui": ["./ui"],
  "~/ui/*": ["./ui/*"],
  "~/shell": ["./shell"],
  "~/shell/*": ["./shell/*"],
  "~/render": ["./render"],
  "~/render/*": ["./render/*"]
}
```

确切的相对路径会根据各自的 consumer 配置进行调整。至少需要检查：

```text
frontend/core/tsconfig.json
frontend/core/tsconfig.app.json
frontend/core/jsconfig.json
frontend/dash/tsconfig.json
```

消费 Core 别名的应用配置也必须通过它们现有的 Core/Dash 配置机制解析这些新路径。

在所有导入迁移完成后，应移除旧的`~/widgets`别名。不要保留永久兼容别名。一次 monorepo 级别的迁移可以在一个变更中更新所有 consumer，保留旧别名会让新的歧义导入重新出现。

## 迁移形态

最终期望结构为：

```text
frontend/core/
  ui/
  shell/
  render/
  unit/
```

迁移应保留组件内部实现和行为。这是一次路径和所有权重构，不是视觉或运行时重设计。

建议顺序：

```text
1. inventory current imports and path aliases
2. create ui, shell, and render directories
3. move the agreed component directories
4. update internal and external imports
5. update TypeScript and JavaScript path aliases
6. remove the old widgets alias
7. search for stale widgets imports and paths
8. run focused validation
```

不要在未检查以下情况时进行大范围文本替换：

- 移动目录内部的导入；
- 类型导入；
- 动态导入；
- 测试和 story/demo 文件；
- 记录真实路径的注释；
- Dash 和应用特定配置中的别名；
- 必须保持不变的`frontend/landing/app/widgets`下的文件；
- `/dashboard/widgets`路由和产品命名。

## 验证

重命名所需检查：

```text
rg -n "from ['\"]~/widgets|import\\(['\"]~/widgets" frontend
rg -n "frontend/core/widgets|~/widgets" frontend docs
rg -n "frontend/landing/app/widgets|/dashboard/widgets" frontend

yarn workspace @groupher/frontend-core type-check
frontend/core focused tests
frontend/dash type-check
frontend/dashboard type-check
git diff --check
```

第一条搜索在迁移后应不返回任何活跃的`~/widgets`导入。对`frontend/landing/app/widgets`和`/dashboard/widgets`的引用是预期存在的，并且应保持为有意为之。

验证必须证明：

- Core 能解析`~/ui`、`~/shell`和`~/render`；
- Dash 能解析共享别名；
- Main 和 Dashboard 保持现有的 root 和 loading shells；
- 共享组件保留其导出和行为；
- 没有意外重命名 Groupher Widget 产品路径；
- 不再存在陈旧的`frontend/core/widgets`路径。

## 提交边界

这应该是一个独立的前端重构提交。它不能与 Groupher Widget 功能实现、后端 API 工作或无关 UI 更改混在一起。

建议的提交标题：

```text
refactor(fe): rename shared widgets aliases to ui
```
