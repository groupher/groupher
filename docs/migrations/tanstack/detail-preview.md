# Preview Drawer Workspace

状态：设计完成，待后续实现

本文档定义 Community 在 preview Drawer 内浏览相关文章的产品和实现契约。目标是让
Drawer 内的文章切换符合用户对浏览器 Tab 的理解，而不是把每一篇相关文章都映射成
浏览器 history entry。

## 1. 产品决策

相关文章优先在当前 Drawer workspace 内打开。第一次打开 preview 时创建一个浏览器
导航；之后点击相关文章只切换 Drawer 内部 Tab，不改变浏览器 URL，也不新增 history
entry。

```text
Post list
  -> 打开 23
  -> URL: /home/post/23
  -> Drawer tabs: [23]

Drawer 内点击相关文章 24
  -> URL 保持 /home/post/23
  -> Drawer tabs: [23, 24]
  -> active tab: 24

浏览器 Back
  -> 关闭 Drawer
  -> 回到 Post list
```

这意味着浏览器 URL 表示“当前打开的 Drawer workspace”，Drawer Tab 表示 workspace
内浏览过的文章。不能把 24 作为第二层 Drawer，也不能让 `/post/23` 的 URL 看起来
像已经导航到了 `/post/24`。

当前 Tab 必须显示清晰的文章标题，并提供“打开完整页面”或“复制文章链接”入口。
因为 Tab 24 不占用浏览器 URL，分享 24 时必须显式使用它自己的 canonical URL。

## 2. 当前差异和根因

Community 当前的 `frontend/community/src/platform/Link.tsx` 只在 Post list、Changelog
list 和 Kanban board 上执行 preview mask。详情页中的相关文章会进入 canonical detail
navigation。

之前考虑过为详情页增加 detail-background preview route，但这会让一个看似普通的
相关文章点击同时改变 URL、背景 route 和 Drawer 状态，用户需要理解两套 history 语义。
本方案取消 detail-background preview subtree，改为在已有 preview Drawer 内管理文章 Tab。

Main 当前的 intercepted preview 行为也需要在 parity matrix 中按这个产品契约重新确认：
目标不是复制现有实现细节，而是让 Main 和 Community 最终都遵循同一套 workspace 行为。

## 3. URL 和 route 模型

只对“第一次打开 Drawer”使用 route mask：

```text
浏览器显示：/home/post/23
内部匹配：  /home/post/previewer/23
```

Drawer 内从 23 切换到 24 时：

```text
浏览器显示：仍然是 /home/post/23
内部 route：仍然是当前 preview workspace route
Drawer 状态：activeArticleId = 24
```

具体 preview route 继续沿用现有 list/board background route，不新增 detail-background
route。具体要求：

- canonical `/post/$id` 直接访问、刷新和复制链接时渲染完整详情页；
- list/board 第一次打开 preview 时显示 canonical detail URL；
- Tab 切换不调用 Router push/replace，不修改浏览器 URL；
- Drawer close 使用现有 route back，回到打开前的 list/board；
- raw preview URL 直接访问时 redirect 到 canonical detail 或返回 404；
- preview workspace 不覆盖背景页面的 title、description、canonical 和 Open Graph。

## 4. History 契约

浏览器 history 只记录 Drawer workspace 的打开和关闭：

```text
entry A: /home/post
entry B: /home/post/23  // Drawer workspace opened

Tab 23 -> Tab 24        // no history entry
Tab 24 -> Tab 25        // no history entry

Back: entry B -> entry A // close Drawer, return to list
Forward: entry A -> entry B // reopen workspace at its initial route state
```

实现要求：

- 第一次打开 preview 使用 push，不使用 replace；
- Drawer 内文章 Tab 切换完全由 workspace state 驱动；
- Tab 切换不触发浏览器滚动恢复，也不改变 list/board 背景；
- Drawer close 在退出动画结束后执行现有 route back；
- 浏览器 Back 直接关闭 workspace，不回退 Tab；
- `resetKey` 使用 `${thread}:${articleId}`，确保切换正文时滚动位置重置；
- Tab 的数据使用现有 article detail query/cache authority；
- “打开完整页面”才创建新的 canonical detail navigation，且属于明确的用户动作。

## 5. 实现边界

### 5.1 PreviewWorkspace

在现有 preview Drawer 内增加 workspace 状态，不新增 Drawer 层级：

```text
preview route owner: 23
  └── PreviewWorkspace
        ├── tabs: [23, 24, 25]
        ├── activeArticleId: 24
        └── Drawer content: ArticleViewer(24)
```

要求：

- 复用 Core `frontend/core/ui/@Drawer`；
- 复用现有 `isFullView` ArticleViewer、页面锁和退出动画；
- 维护当前 workspace 的 tabs 和 active article；
- 同一文章再次点击时切换到已有 Tab，不重复创建 Tab；
- Tab 切换不卸载背景 list/board；
- Tab close、active tab 和 empty workspace 行为要有明确规则；
- 不使用全局 React store 替代 Router history。

### 5.2 PlatformLink 和相关文章入口

PlatformLink 的职责拆成两层：

```text
list/board 普通文章入口 -> 打开 preview workspace，创建唯一 history entry
Drawer 内相关文章入口 -> openPreviewTab(article)，不触发 Router navigation
打开完整页面入口     -> canonical Link/navigation
```

相关文章入口不能继续作为普通 canonical Link 直接跳转，也不能仅依靠扩大
`Link.tsx` 的 pathname 判断来模拟 detail-background preview。它需要明确调用 workspace
的 `openPreviewTab` 能力，并保留语义化的完整页面 Link 作为显式出口。

### 5.3 Data、SSR 和 head

- workspace 初始 article 由 preview route loader/query 提供；
- Tab 24 的数据通过现有 article detail query 加载和缓存；
- SSR 只负责首次 workspace owner 的文章，不 SSR 隐藏的 Tab 列表；
- 刷新 `/post/23` 恢复 23 作为初始 Drawer article，不能恢复未写入 URL 的 Tab 24；
- active Tab 24 不修改浏览器 head；
- Tab 数据加载失败时显示明确的 Tab 内容错误，不显示空 Drawer；
- preview runtime 仍按 route 后置加载，不进入普通 `/post` 初始 preload。

### 5.4 Raw preview redirect

raw preview URL 只属于 Router 内部实现，不应成为公开 URL。当前 list/board preview
使用 308 redirect；workspace Tab 切换不会产生新的 raw preview URL，因此不增加新的
307/308 语义。

307/308 只影响用户直接访问 raw preview URL 的情况，与 Drawer 内 Tab 切换无关。

## 6. 分阶段实现

### Phase A：Post preview workspace

- 在现有 Post preview Drawer 内增加 `PreviewWorkspace`；
- 增加文章 Tab UI、active article 和重复文章去重；
- 相关文章点击调用 `openPreviewTab`，不修改浏览器 URL；
- 保留“打开完整页面”和“复制链接”入口；
- 完成 Back/Forward、close、刷新和直接访问测试；
- 不改变现有 list/board preview route 的第一次打开行为。

### Phase B：交互和数据稳定性

- 补齐 Tab close、active tab、loading、error、not-found 和 auth 行为；
- 验证 Tab 切换不改变背景滚动、head、history 和 SSR 输出；
- 验证 query cache 不重复请求同一文章；
- 对 Main 和 Community 执行同一组 workspace parity matrix；
- 评估 Main 是否需要迁移到同样的 workspace 交互契约。

### Phase C：扩展到其他 thread

- Changelog preview workspace；
- 必要时支持跨 thread article Tab；
- 每种 thread 单独确认 canonical URL、Tab 标题、head、history 和 direct URL 契约；
- 保持 307/308 只服务于 raw preview URL，不让 Tab 状态进入浏览器重定向语义。

## 7. 验收矩阵

| 场景                       | 预期结果                                                 |
| -------------------------- | -------------------------------------------------------- |
| Post list 打开 23          | 创建一个 Drawer workspace，URL 显示 23                   |
| Drawer 23 点击相关文章 24  | 增加/激活 Tab 24，URL 不变                               |
| Drawer 24 再点击 25        | 增加/激活 Tab 25，不新增 history                         |
| 23、24 重复点击            | 激活已有 Tab，不重复创建                                 |
| 浏览器 Back                | 直接关闭 Drawer，回到 list/board                         |
| 浏览器 Forward             | 恢复 Drawer workspace 的初始 route 状态                  |
| Tab 内点击关闭             | 按约定切换到相邻 Tab，不触发浏览器 Back                  |
| 打开完整页面               | 使用 24 自己的 canonical URL                             |
| 复制文章链接               | 复制 24 的 canonical URL，而不是当前 workspace owner URL |
| 刷新 `/post/23`            | Drawer 初始显示 23，不恢复未写入 URL 的 Tab 24           |
| 直接访问 raw preview URL   | redirect 到 canonical detail 或 404                      |
| Tab 打开/切换/关闭         | 背景滚动、head、页面锁和动画行为正确                     |
| Tab loader error/not-found | 显示明确错误，不显示空壳                                 |
| production build           | workspace runtime 不进入普通 `/post` 初始 preload        |

## 8. 非目标

- 不把每个 Tab 映射成浏览器 history entry；
- 不把多个 Drawer 嵌套起来；
- 不因为 active Tab 是 24 就把浏览器 URL 改成 `/post/24`；
- 不让隐藏 Tab 参与 SSR head 或 canonical；
- 不把所有详情页 Link 都强制改成 preview；
- 不改变 canonical detail URL、SEO metadata 或公开 URL 结构；
- 不修改现有 list/board preview 第一次打开的产品行为。
