# 批量导入文档：GitHub 目标方案与 Node 迁移计划

> 状态：GitHub Docs 新边界已完成本地切换；生产 Private Blob、固定公开仓库 Browser E2E、全局分析 admission 和部署环境观测仍待验收
>
> 产品范围：一个完整的公开 GitHub 仓库，全量导入到 Groupher Docs 的主 Draft。
>
> 重构范围：七类 Docs framework adapter 已在 Dashboard Node/TS 落地并通过现有 basic golden fixtures；目录、PreviewStore/Files SDK、PostgreSQL staging 和 Phoenix 旧链路已完成直接切换，不恢复生产双路径。
>
> Source of truth：本文负责 GitHub Docs Bulk Import 的产品步骤与 UI。跨来源架构、`ThreadDataset`、Node/Phoenix 边界和公共命名以 [`content_import_architecture.md`](./content_import_architecture.md) 为准；Files SDK/staging 以 [`import_file_sdk.md`](./import_file_sdk.md) 为准；实施清单以 [`content_import_refactor_plan.md`](./content_import_refactor_plan.md) 为准；共享 Import Content/BodyBag 以 [`article_publish_import_refactor.md`](./article_publish_import_refactor.md) 为准；本轮联调错误与恢复边界见 [`import_error_handling.md`](./import_error_handling.md)。
>
> 本文先定义目标产品规格，再单列当前实现快照、目标验收标准和迁移步骤。

## 1. 结论

首版产品只解决一条完整路径：

```text
公开 GitHub 仓库 URL
        │
        ▼
Dashboard Next.js API 校验权限与 admission
        │
        ▼
启动 Vercel Workflow，并立即返回 `previewRef`
        │
        ▼
Workflow Step A 在临时工作区中流式解压，识别文档框架、配置和导航结构
        │
        ▼
将筛选后的来源文件、SourceTree 和分析结果保存到 Vercel Private Blob
        │
        ▼
Workflow Step B 读取 SourceTree，调用 Phoenix Validator 并保存 Target Preview
        │
        ▼
展示识别信息、源文档树和目标映射
        │
        ▼
用户确认全量导入
        │
        ▼
转换正文并原子写入 Docs Draft
        │
        ▼
打开第一篇导入文档或 Preview
```

首版不支持 ZIP、线上文档 URL 抓取、私有仓库、指定分支、指定子目录、部分勾选导入和完整冲突处理。

这里的 archive 是系统内部透明使用的 GitHub 仓库快照，不是要求用户手动下载或上传 ZIP。用户始终只提供仓库 URL。

## 2. 产品边界与命名

| 位置             | 中文         | 英文             | 说明                                 |
| ---------------- | ------------ | ---------------- | ------------------------------------ |
| Dashboard 侧栏   | 批量导入     | Bulk Import      | 文档库级入口，名称保持简短           |
| 页面标题         | 批量导入文档 | Bulk Import Docs | 页面内可使用更完整的名称             |
| 编辑器内单篇操作 | 导入内容     | Import Content   | 只导入内容到当前文档，不属于本文范围 |

“批量导入”和编辑器里的“导入内容”是不同的产品编排，但必须复用同一条 Import Content 正文转换链，不能维护两套 Markdown/MDX → AST → BodyBag 实现。

### 2.1 单篇导入与批量导入

| 维度     | 编辑器单篇 `Import Content`    | Dashboard `Bulk Import`             |
| -------- | ------------------------------ | ----------------------------------- |
| 入口     | 当前 Page 的编辑器             | Docs Dashboard                      |
| 输入     | 一个文件或一条受支持的内容 URL | 一个 GitHub Repo URL                |
| 目标     | 替换或填充当前 Page 的正文     | 创建完整的 Tabs / Groups / Pages 树 |
| 用户确认 | 确认当前 Page 的内容           | Review 整个仓库树后确认全量导入     |
| 执行状态 | 当前编辑会话内完成             | `previewRef` + 持久化 `jobRef`      |
| 原子边界 | 单篇正文                       | 整批文档树和所有 Page 正文          |

Bulk v1 的 Review 只检查结构、目标映射、数量和 warning，不在确认前转换或展示单篇正文。用户确认后的“逐篇转换”只是一个 Bulk Import Job 内部的 item 执行单位；完成后进入 Docs 编辑器检查正文。

两条产品流程不共享页面状态和 Review 状态，但共享现有 Import Content、artiment-publisher、BodyBag contract、PostgreSQL staging 和 Docs Writer。Bulk 只是把多个 source item 组织成 `DocsDataset` 并在最终阶段使用树级原子 apply；后续单篇来源同步使用同一写入链的 single-item mode。单篇导入的详细边界见 [`article_publish_import_refactor.md`](./article_publish_import_refactor.md)。

## 3. 目标和非目标

### 3.1 首版目标

- 用户只需提供一个公开 GitHub 仓库地址。
- Dashboard Next.js API 只负责鉴权、启动 Vercel Workflow 和映射响应；仓库下载、解压和分析发生在 Workflow Step，不把 archive、解压文件或未确认正文传给 Phoenix。
- 用户确认前只创建有 TTL 的不可变 PreviewRecord 和 versioned `DocsDataset`，不创建正式 ContentImport Job，也不写入 Docs 数据。
- Workflow 持久化执行状态、步骤结果和重试历史；筛选后的来源文件、SourceTree 和 `TBadSmell[]` 保存在 Vercel Private Blob，不依赖 Node 进程内存或本地持久卷。
- 系统自动解析默认分支，不要求用户判断文档框架。
- 系统识别框架、配置文件、内容目录、导航和资源文件。
- 第二步以 Info 形式明确展示识别结果，再让用户确认。
- 系统展示完整的只读源文档树，不在首版提供部分勾选。
- 用户能理解源 `Tabs / Groups / Pages` 将如何进入 Groupher。
- 正文被转换为有效的 BodyBag，并与结构一起写入。
- 整次导入保持原子性：成功则完整可见，失败则不留下半套文档树。
- 导入结果只进入主 Draft，不自动发布，不影响线上内容。
- Preview 有效期内，页面刷新后能够根据 `previewRef` 恢复分析和检查状态；Groupher 不维护可变 Workflow Session。
- Dashboard Node 覆盖 Docusaurus、Fumadocs、MkDocs、Nextra、Rspress、Starlight 和 VitePress；发布前继续补充框架变体、固定公开仓库 Preview 和完整端到端验收。

### 3.2 首版不做

| 能力                     | 首版处理                                                              |
| ------------------------ | --------------------------------------------------------------------- |
| ZIP 上传                 | 延后，在 GitHub 流程稳定后复用同一检查与导入页面                      |
| 线上文档 URL 全站抓取    | 延后，单独研究站点树发现、抓取边界和正文提取                          |
| 私有 GitHub 仓库         | 延后，需要授权、凭据和权限生命周期设计                                |
| 手动选择 branch/path     | 延后，首版只使用默认分支和完整仓库                                    |
| 部分文档勾选             | 延后，首版全量导入                                                    |
| Review 单篇正文预览      | 延后，与部分 Page 选择和 Preview cache 一起设计                       |
| 对已导入仓库增量 re-sync | 延后；同仓库再次全量导入会复用 Mapping 并覆盖，尚不提供逐篇 diff/sync |
| 导入到多个已有 Tab       | 延后，首版避免复杂的逐项目标映射                                      |
| 覆盖、合并已有 Page      | 只允许显式确认后覆盖同来源 mapped Pages；未映射碰撞仍阻断             |
| 完整冲突解决 UI          | 延后；首版检测到冲突即阻断                                            |
| 自动发布                 | 不做，只进入主 Draft                                                  |

### 3.3 产品首版与重构工作量不是同一个范围

首版产品能力仍然只是“公开 GitHub 默认分支 → 全量 Review → 主 Draft”。七类 Node framework analyzer 已存在，这次重构不重新实现一遍 adapter，也不改成依赖某个通用 Markdown npm 包：

- framework adapter 继续使用 Groupher-owned safe static config parser，把 sidebar/meta/nav 归一化为 canonical SourceTree；`remark` 等 Markdown parser 只解决正文语法，不能替代框架导航分析。
- 七类 basic fixture 已与现有 Elixir golden `expected/tree.json` 对齐；剩余工作是补齐 auto navigation、动态配置、缺页、frontmatter override 等变体，并做固定公开仓库验收。
- Phoenix 旧 framework dispatch 在新 Files SDK/staging 链路端到端通过后删除；切换后不恢复 Elixir fallback。
- ZIP、branch/path、私有仓库、部分选择等新产品能力仍然保持延期，不因现有 adapter 已落地而顺带开放。

## 4. 首版验收前提

首个可验收场景采用以下约束：

1. 仓库是公开仓库，URL 有效且可访问。
2. 仓库默认分支可解析。
3. 仓库使用目标 Node analyzer 支持的文档框架之一。
4. 文档配置和导航可以被完整解析。
5. 文档文件在数量、单文件大小和总大小限制内。
6. 目标位置不存在 Tab、Group 或 Page 命名/路由冲突。
7. 用户选择全量导入。
8. 导入目标始终是主 Draft。

支持框架的准确列表由服务端返回，UI 不硬编码框架判断逻辑。目标首版覆盖：Docusaurus、Fumadocs、MkDocs、Nextra、Rspress、Starlight 和 VitePress。

## 5. 整体流程

```text
┌────────────────────┐
│ ① GitHub 仓库      │
│ 输入 URL            │
└─────────┬──────────┘
          │ 分析仓库
          ▼
┌────────────────────┐
│ 分析中              │
│ 仓库 → 框架 → 导航  │
└─────────┬──────────┘
          │ 分析完成
          ▼
┌────────────────────┐
│ ② 检查内容         │
│ Info + 树 + 目标映射│
└─────────┬──────────┘
          │ 用户确认
          ▼
┌────────────────────┐
│ ③ 导入             │
│ 转换正文 + 原子写入 │
└─────────┬──────────┘
          │ 完成
          ▼
┌────────────────────┐
│ 打开文档编辑器      │
└────────────────────┘
```

页面使用三步 Stepper：

```text
① GitHub 仓库  ─────────  ② 检查内容  ─────────  ③ 导入
```

Stepper 表示用户需要完成的三个决策阶段，不把每个异步内部状态都提升为新步骤：

- `analyzing_repo` 是第一步“GitHub 仓库”的提交后子状态；分析期间第一步保持 active，并显示为 `① GitHub 仓库 · 分析中`。
- 分析卡片取代输入表单，但不能在视觉上伪装成已经进入第二步。
- SourceTree 和 Target Preview 都准备完成后，active step 才移动到第二步“检查内容”。
- 用户确认后才进入第三步“导入”。

## 6. 第一步：输入 GitHub 仓库

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 批量导入文档                                               帮助 ?   │
│                                                                      │
│ ① GitHub 仓库  ─────────  ② 检查内容  ─────────  ③ 导入             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  从一个完整的 GitHub 仓库导入文档                                   │
│  系统将自动识别默认分支、文档框架和导航结构。                       │
│                                                                      │
│  GitHub 仓库地址                                                     │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ https://github.com/acme/docs                                │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ℹ 首版仅支持公开仓库，并会分析默认分支中的完整仓库。               │
│                                                                      │
│                                               [取消] [分析仓库 →]    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.1 交互规则

- 输入框只接收标准 GitHub Repo URL。
- 粘贴后可做轻量格式校验，但仓库是否存在、是否公开由服务端确认。
- 首版不显示 branch、path、framework 等高级选项。
- `分析仓库` 创建临时 Preview，成功后将 `preview` 写入 URL，例如：

```text
/dashboard/doc/import?preview=preview_xxx
```

- 刷新页面或重新打开链接时，前端通过 `previewRef` 恢复当前步骤和进度。
- `previewRef` 必须是不可猜测、绑定当前用户与社区的公开引用，不能暴露临时文件路径。
- Preview 默认 60 分钟过期；用户取消、确认完成或 TTL 到期后清理对应的 Private Blob 对象。Workflow 的运行记录用于执行状态，PreviewRecord 只保存 owner/community/source/TTL/run ref，不作为可变 Session 或长期业务数据。
- URL 无效、仓库不存在、仓库不可访问时，错误显示在输入框附近，不进入第二步。

## 7. 仓库分析中

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 批量导入文档                                                        │
│                                                                      │
│ ① GitHub 仓库 · 分析中 ──  ② 检查内容  ─────────  ③ 导入             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  正在分析 acme/docs                                                  │
│                                                                      │
│  ✓ 读取仓库信息                                        main          │
│  ✓ 获取默认分支文件                                   186 files      │
│  ● 识别文档框架                                       VitePress      │
│  ○ 分析导航和文档树                                                  │
│  ○ 准备导入预览                                                      │
│                                                                      │
│  这通常需要几秒钟。你可以离开此页面，任务会继续运行。               │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

分析阶段按实际能力更新状态，不使用假进度百分比。文件数等可确定数据使用等宽/表格数字，避免进度更新时界面跳动。

分析失败时保留仓库 URL，并提供：

```text
[重试分析]  [更换仓库]
```

错误文案说明具体原因，例如：不支持的框架、找不到配置、超过导入限制，而不是只显示“导入失败”。

## 8. 第二步：检查内容

第二步先回答“系统识别出了什么”，再回答“将导入到哪里”。

### 8.1 识别结果 Info

```text
┌─ 已识别仓库 ─────────────────────────────────────────────────────────┐
│ ✓ acme/docs                                                          │
│                                                                      │
│ 默认分支      main                 Commit        a1b2c3d              │
│ 文档框架      VitePress            配置文件      docs/.vitepress/...  │
│ 内容目录      docs                 导航来源      themeConfig.sidebar  │
│                                                                      │
│ 2 Tabs   ·   6 Groups   ·   42 Pages   ·   18 Asset refs            │
│ 首版不会复制图片或附件                                               │
└──────────────────────────────────────────────────────────────────────┘
```

Info 至少包含：

- Repo、默认分支和被分析的 commit。
- 识别出的框架。
- 命中的配置文件和内容根目录。
- 导航/树结构来源。
- Tabs、Groups、Pages 和检测到的 asset reference 数量；首版明确标注图片/附件不会被复制。
- 必要的 warning，例如孤立页面、无法解析的链接、跳过的文件。

这些数据由服务端分析结果提供。UI 不要求用户确认“这是 VitePress 还是 Rspress”。

### 8.2 源文档树与目标映射

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 检查将要导入的内容                                                   │
│                                                                      │
│ ┌─ 源文档结构 ───────────────────┐  ┌─ 导入位置 ──────────────────┐ │
│ │ acme/docs                      │  │ 导入到 Docs Draft            │ │
│ │                                │  │                               │ │
│ │ ▾ Guides                       │  │ ● 保留仓库结构                │ │
│ │   ▾ Getting Started            │  │                               │ │
│ │       Introduction             │  │ 将创建：                      │ │
│ │       Installation             │  │   Guides                      │ │
│ │   ▾ Advanced                   │  │     Getting Started           │ │
│ │       Configuration            │  │     Advanced                  │ │
│ │                                │  │   API                         │ │
│ │ ▾ API                          │  │     Reference                 │ │
│ │   ▾ Reference                  │  │                               │ │
│ │       Client                   │  │ 2 Tabs · 3 Groups · 4 Pages  │ │
│ │                                │  │                               │ │
│ │ 全部 4 篇文档                  │  │ ℹ 不会自动发布                │ │
│ └────────────────────────────────┘  └───────────────────────────────┘ │
│                                                                      │
│ 将全量导入 4 篇文档，保留识别出的结构，并写入 Docs Draft。            │
│ 不修改当前公开版本。                                                 │
│                                        [上一步] [导入 4 篇文档]      │
└──────────────────────────────────────────────────────────────────────┘
```

首版源树是只读的：

- 不显示 Page checkbox。
- 不允许拖拽重排。
- 不允许在这里编辑标题或 slug。
- 所有可导入文档会被全量导入。
- warning 可以定位到对应节点，但不能在首版逐项修复。

## 9. Tabs / Groups 结构映射

### 9.1 Groupher 结构不变量

导入前后都必须满足：

```text
Docs
└── 至少一个 Tab
    └── 至少一个 Group
        └── 零个或多个 Page
```

默认 Tab 为 `Introduction`，默认 Group 为 `Untitled`。导入不能为了适配源仓库而破坏这个模型，也不能让 Page 直接挂在 Tab 下。

### 9.2 Tab 映射规则

首版不提供 in-flow Tab 目标选择，使用一套确定性映射，避免 UI 看起来可配置但实际没有完整冲突处理能力：

| 源仓库识别结果       | 首版固定映射              | 用户能否在 Review 中修改 |
| -------------------- | ------------------------- | ------------------------ |
| 没有 Tab 层级        | 导入现有 `Introduction`   | 不能                     |
| 只有一个有名称的 Tab | 保留源名称并新建该 Tab    | 不能                     |
| 多个 Tabs            | 保留源结构并创建多个 Tabs | 不能                     |

“没有 Tab”表示源框架的导航只有 Group/Page 层，而不是创建一个没有 Tab 的 Groupher 树。系统仍然必须选择或创建一个承载 Tab。

Review 只展示解析后的只读映射摘要：

```text
目标映射

无源 Tab 层级  →  现有 Tab：Introduction
单个源 Tab    →  新建 Tab：Acme Docs
```

多 Tab 时直接保留多个源 Tabs；不提供逐 Tab 映射到不同已有 Tab 的配置。如果固定映射产生冲突，首版阻断导入，而不是临时显示一个不完整的目标选择器。

### 9.3 Group 映射规则

| 源结构                                                      | 目标结构                                               |
| ----------------------------------------------------------- | ------------------------------------------------------ |
| 源 Tab 下存在 Groups                                        | 保留原 Group 名称、顺序和归属                          |
| 源 Tab 下没有 Group，Page 直接属于该导航范围                | 将这些 Pages 放入该目标 Tab 的默认 `Untitled` Group    |
| 新目标 Tab 因底层创建流程自带空 `Untitled`，但源已有 Groups | 导入事务复用或移除占位 Group，最终不能额外留下空 Group |

这里不使用 `Overview` 作为自动生成 Group 名称。`Untitled` 是结构兜底，源仓库原有 Groups 则原样保留，因此不会把源 Groups 展平后混在一起。

示例：源仓库没有 Group 层级。

```text
Source                         Groupher

Guides                         Guides
├── Introduction              └── Untitled
├── Installation                  ├── Introduction
└── Configuration                 ├── Installation
                                  └── Configuration
```

示例：源仓库本身有 Groups。

```text
Source                         Groupher

Guides                         Guides
├── Getting Started           ├── Getting Started
│   ├── Introduction          │   ├── Introduction
│   └── Installation          │   └── Installation
└── Advanced                  └── Advanced
    └── Configuration             └── Configuration
```

## 10. 冲突处理原则

长期原则是：冲突必须由用户确认，不静默覆盖，不静默合并，也不在用户不可见的情况下自动改名。

需要区分“同一已映射来源再次导入”和“未映射目标碰撞”：

- 同一社区内，GitHub `owner/repo + branch` 命中既有 Connection，且 Page `externalRef` 命中 `ImportSourceMapping` 时，属于来源更新。Target Preview 复用 mapped Doc refs，允许按 source-wins 覆盖，但 Apply 前必须显示覆盖数量并由用户确认。
- 新来源撞到现有 Tab/Group/Page，而没有 Mapping 证明它们属于同一来源时，属于目标冲突，首版继续阻断。

即使本次 commit 与上次相同，也要提示“该仓库已导入过”；后续可以在全部 source hash 未变化时直接 no-op，但不能静默隐藏来源身份。

首版不实现完整冲突编辑器。排除已映射来源更新后，检测到以下任一未映射碰撞时，禁止继续导入：

- 目标 Tab 同名或路由冲突。
- 目标 Group 冲突，且无法按已确认的结构映射落位。
- Page 标题、slug 或路由冲突。
- 同一源树内部存在解析后冲突。

```text
┌─ 发现目标冲突 ───────────────────────────────────────────────────────┐
│ 无法按当前结构安全导入。                                             │
│                                                                      │
│ • Tab “Guides” 已存在                                                │
│ • Page route “/api/client” 已存在                                    │
│                                                                      │
│ 首版不会覆盖或自动合并已有内容。                                     │
│ 请先在 Docs 中处理冲突，返回后可以重新检查当前目标状态。              │
│                                      [返回仓库] [重新检查目标状态]    │
└──────────────────────────────────────────────────────────────────────┘
```

`重新检查目标状态` 只重新调用 Phoenix Docs Validator，适用于用户已在另一个页面删除、重命名或移动冲突内容；它不暗示首版存在 branch/path 选择或逐 Tab 目标映射。

后续完整冲突 UI 可以给出 `-[platform]` 建议后缀，例如 `Guides-vitepress`；无法识别框架时使用 `-github`。这个 `suggestedName` 只存在于当前 TargetPreview，是一次性的预填建议；用户确认后的 `resolvedName` 保存在当前 ImportIntent/Job，apply 时写入实际目标树。未来如果需要在再次同步时长期记住 Tab/Group 的重命名，单独增加 connection-scoped structure override，不能把它塞进 Page 级 `ImportSourceMapping` 或旧 JobItem。

## 11. Review 操作区

新来源首版不增加独立确认页或二次弹窗。第二步 Review 在操作按钮上方展示不可跳过的摘要；用户点击一次带实际 Page 数量的按钮后直接触发 apply。若 Target Preview 表明同一 Repo/branch 已存在 Mapping，则例外弹出一次风险说明；这不是冲突阻断，用户选择继续后必须执行 source-wins 覆盖：

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 导入摘要                                                             │
│                                                                      │
│ 来源          github.com/acme/docs                                  │
│ 分支          main                                                   │
│ Commit        a1b2c3d                                                │
│ 框架          VitePress                                              │
│                                                                      │
│ 内容          2 Tabs · 6 Groups · 42 Pages                          │
│ 目标          Docs Draft                                             │
│                                                                      │
│ ✓ 全量导入仓库文档                                                   │
│ ✓ 保留识别出的 Tabs / Groups 结构                                   │
│ ✓ 导入后保持 Draft，不自动发布                                       │
│ ✓ 不修改当前公开版本                                                 │
│                                                                      │
│                                      [上一步] [导入 42 篇文档]      │
└──────────────────────────────────────────────────────────────────────┘
```

同一 Repo/branch 已存在 Mapping 时，在真正发起 Apply 前显示：

```text
┌─ 这个仓库已经导入过 ────────────────────────────────────────────────┐
│ 继续操作会覆盖 42 篇已关联文档的标题、slug 和正文，并按本次 Review  │
│ 更新 Docs 结构；不会创建第二套重复文档。                            │
│                                                     [取消] [继续并覆盖] │
└──────────────────────────────────────────────────────────────────────┘
```

按钮必须使用实际 Page 数量，避免用户误以为只是在创建结构。未映射目标冲突存在时按钮保持禁用；已映射来源覆盖只显示风险，不禁用继续操作。用户点击“继续并覆盖”后，Apply intent 携带 acknowledgement，Phoenix 重新校验来源身份、Mapping 和 `targetRevision`，校验通过即执行覆盖。按钮 disabled 仍不能替代服务端幂等和 targetRevision 校验。

## 12. 第三步：导入进度

```text
┌──────────────────────────────────────────────────────────────────────┐
│ 正在导入 acme/docs                                                   │
│                                                                      │
│ ✓ 获取并固定仓库版本                              a1b2c3d            │
│ ✓ 构建目标文档树                                  2 / 2 Tabs         │
│ ● 转换文档内容                                   27 / 42 Pages       │
│ ○ 写入 Docs Draft                                                     │
│                                                                      │
│ 当前：docs/guide/configuration.md                                    │
│                                                                      │
│ 可以离开此页面。重新打开后会恢复任务进度。                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 12.1 进度原则

- 进度按阶段和已完成数量展示，不伪造连续百分比。
- UI 使用服务端状态，不根据前端计时推测进度。
- 页面刷新后继续轮询同一个 `jobRef`。
- 执行期间禁止重复点击创建第二个相同 apply 任务。
- Apply 必须幂等或通过任务状态防止重复写入。
- 任何失败都需要保留可诊断原因；基础网络/数据库错误由对应层做有界重试，复杂或确定性失败让用户 reset/re-import。
- 原子写入失败后，不留下用户可见的残缺 Tab/Group/Page。

### 12.2 Page item 转换失败与原子边界

普通内容转换错误不允许“42 篇中成功 40 篇就导入 40 篇”；`content_too_large` 是唯一预先定义的例外。转换和写入分为两个清晰阶段：

1. Node Publisher 按有界批次转换全部 Page，并把成功的 BodyBag 暂存到 Phoenix Job staging。
2. 每个 Job item 单独记录 `pending / converting / ready / failed / skipped`、`sourceRef` 和安全 `TBadSmell[]`。
3. 单篇在共享 publisher 中超过固定 2 MiB Plate input，或生成后的 canonical BodyBag JSON 超过固定 5 MiB 上限时，记录稳定的 `content_too_large`，把该 Page 从有效选择集和 TargetTree 显式排除，继续转换其他 Page；UI 必须列出被跳过的来源路径，不能静默遗漏。
4. 除 `content_too_large` 外，只要任意 Page 转换失败，Job 停在 `conversion_failed`，不会进入 atomic apply；已暂存的 BodyBag 对用户不可见。
5. UI 展示失败/跳过篇数和可展开的 Page 列表，至少包含来源路径、阶段、稳定错误码和可读原因。普通失败不实现 item 级恢复，用户取消或 reset/re-import；超大单篇需要用户拆分或精简原文后手动导入。
6. 所有有效选中 Page 都为 `ready` 后，从 TargetTree 删除 skipped Page 和因此变空的 Group/Tab，重新校验 counts/route/item 一致性，再执行一次 Phoenix atomic apply；如果没有任何可导入 Page，则不调用 apply。apply 自身失败时事务回滚整批树和正文。

这里的 staging 只指已生成 BodyBag 的临时持久化，不是通用 `AssetStager`。Bulk v1 不创建 `Job.Asset` 下载任务，也不复制图片或附件。

失败状态示例：

```text
┌─ 1 篇转换失败，1 篇因过大跳过 ────────────────────────────────────────┐
│ 尚未写入任何 Docs 内容。                                             │
│                                                                      │
│ docs/api/client.mdx       unsupported_mdx_expression                 │
│ docs/guide/config.md      content_too_large · 请拆分后手动导入       │
│                                                                      │
│                                    [取消整批导入] [重新导入]          │
└──────────────────────────────────────────────────────────────────────┘
```

因此“原子导入”指最终用户可见写入是 all-or-nothing，并不要求转换过程不能产生 item 级诊断或临时 staging 数据。

## 13. 完成状态

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ✓ 批量导入完成                                                       │
│                                                                      │
│ acme/docs 已导入 Docs Draft                                          │
│                                                                      │
│ 2 Tabs      6 Groups      42 Pages                                  │
│                                                                      │
│ 导入内容尚未发布，你可以先检查和编辑。                               │
│                                                                      │
│                                             [打开文档编辑器]          │
└──────────────────────────────────────────────────────────────────────┘
```

- `打开文档编辑器`进入第一篇成功导入的 Page。
- `打开文档编辑器`进入第一篇导入文档。
- 完成页保留 Repo、branch、commit、框架、数量和任务时间，便于追溯。
- 如果存在 `content_too_large`，完成页额外显示“已跳过 N 篇”及可展开的 sourceRef 列表；主数量只统计实际写入的 Page，不能继续显示 Review 时的原始数量。

## 14. 状态模型

### 14.1 UI 状态

```text
idle
  │ 分析仓库
  ▼
analyzing_repo
  │ 分析完成
  ▼
ready_for_review
  │ 用户确认
  ▼
importing
  │ 写入完成
  ▼
completed

任一阶段 ───────────────► failed
```

### 14.2 后端任务阶段

```text
Vercel Workflow + immutable PreviewRecord/DocsDataset（临时）

QUEUED → DOWNLOADING → EXTRACTING → ANALYZING → READY
                                                    │
                                          用户确认  │
                                                    ▼
Phoenix ContentImport Job（持久化）

PUBLISHING_BODIES ───────────→ APPLYING → COMPLETED
        │                          │
        └── item failed ───────────┴──────────────→ FAILED
```

`READY` 是重要边界：仓库分析和目标预览已完成，但 Phoenix 中尚未创建正式导入 Job，也没有产生用户可见写入。只有用户确认后，Dashboard Node 才创建 ContentImport Job，并进入 `PUBLISHING_BODIES / APPLYING`。

Workflow 负责确认前任务的 durable execution、步骤重试和状态恢复；immutable PreviewRecord/DocsDataset 负责提供有 TTL 的安全读取边界。Groupher 不维护可变 Workflow Session。正式 Job 从用户确认开始，继续使用 Phoenix 的持久化状态和原子 apply。

## 15. 数据与服务边界

目标边界把“确认前分析”和“确认后导入”明确分开：

```text
创建与分析写路径

GitHub Repo URL
        │
        ▼
Dashboard Next.js API（鉴权 → checkPassport → admission → start Workflow → 202）
        │
        ▼
Vercel Workflow
        │
        ├─ Step A: analyzeSource
        │    下载固定 revision 的 archive
        │    → 流式解压 + 安全过滤 + Node Framework Adapter
        │    → putDataset + putManifest
        ▼
Vercel Private Blob（筛选后来源文件 + Dataset manifest + SourceTree）
        │
        ├─ Step B: validateTarget
        │    读取 SourceTree → Phoenix read-only Docs Validator
        │    → putReview → markReady
        ▼
Vercel Private Blob（review/target-preview.json + ready.json）

Browser Review 读取路径

Browser ── GET /previews/:previewRef ──► Dashboard Next.js API
                                              │ 查询 Workflow 状态
                                              │ ready 后读取 Dataset、Review artifact
                                              │ 和 ready receipt，并组装 Preview DTO
                                              ▼
                                      安全且有界的 Preview DTO
                                              │
                                              ▼
                                  Dashboard Review（尚未导入）

用户确认后的 Apply 写路径

Browser ── POST /previews/:previewRef/apply ──► Dashboard Next.js API
                                                      │ 重新鉴权并创建正式 Job
                                                      ▼
                         Node/TS Publisher：Markdown / MDX → BodyBag（有界批次）
                                                      │
                                                      ▼
                              Phoenix ContentImport Job + BodyBag Staging + Atomic Apply
                                                      │
                                                      ▼
                                              Docs Draft
```

职责边界：

- Dashboard Browser 只负责三步交互、轮询、展示固定目标映射和用户确认，不接收 archive 或完整正文集合；用户点击某一 Page 时，可以按需读取该 Page 的安全正文预览。
- Dashboard Next.js API 负责登录态鉴权、调用 Phoenix `checkPassport`、启动/查询 Vercel Workflow、校验 Preview 归属和映射 HTTP 响应；Route Handler 不等待完整分析结束。
- Vercel Workflow 负责 durable orchestration、步骤重试和运行状态，并固定拆为两个业务 Step。`analyzeSource` 下载、流式解压、候选过滤和 framework 分析，在当前 Step 的临时工作区内完成后写入 Dataset/manifest 并清理目录；`validateTarget` 读取已持久化的 SourceTree，调用 Phoenix Docs Validator，写入 Target Preview 并最后 `markReady`。后一个 Step 失败时不重跑下载分析。上线前必须分别测量两个 Step 及其内部阶段的耗时、内存和字节数；只有 `analyzeSource` 在最大允许 archive 下仍无法稳定落在当前 Function `maxDuration`/memory 内时才进一步拆分，其物化边界使用筛选后的 `SourceWorkspaceRef`，不保存完整原始 archive。
- Vercel Private Blob 是对象存储，不是数据库。首版为 Dashboard 项目创建一个 private store，按 `content-import/previews/{previewRef}/...` 隔离 Preview；不为每个社区或仓库单独创建 store。
- Node/TS Publisher 在用户确认后把 Markdown/MDX 逐 Page 转换为 Groupher BodyBag，并以 count/bytes 双上限批次同步给 Phoenix；这里的“逐 Page”是 Bulk Job 的 item 粒度，不是编辑器单篇导入产品。
- Phoenix 是社区权限的唯一事实来源。Dashboard Node 在创建 Preview 前调用 Phoenix `checkPassport` 做提前反馈；用户确认并创建正式 Job 的 mutation 再次执行 `doc.import` Passport middleware。Job 创建后的内部 stage/apply 是 Server Trust 对已授权 Job 的后台延续，不增加第三套用户权限判断，也不在 Node 复制权限规则。
- Phoenix 在用户确认前只接收 bounded `sourceInfo + SourceTree`，以只读方式查询当前 Docs 状态、生成 TargetTree、检查冲突并返回 `targetRevision`；不创建 Job，不保存来源正文。
- Phoenix 负责创建正式 ContentImport Job、重新检查目标状态、持久化导入事实、BodyBag staging、幂等和原子 apply；Bulk v1 不进入 AssetStager lifecycle。
- 用户确认前，archive 只存在于 `analyzeSource` Step 的流和临时工作区；筛选后的候选正文与 Preview 结果写入 Private Blob，不发送给 Phoenix。SourceTree 是允许跨 Step/服务边界的结构化小对象。
- 首版不引入 URL crawler，也不需要为 GitHub Bulk Import 新增 Python 抓取流程。
- `backend/document-converter` 只服务 PDF/Office 等“外部文件 → Markdown”来源；GitHub Repo 已提供 Markdown/MDX，它的 Vercel 部署状态不是本文链路的 release blocker。
- 七类 Docs framework analyzer 已在 Node/TS 生产入口落地，旧 Elixir analyzer 不再是目标链路。Node 只理解“来源仓库是什么”；Phoenix 只决定“它能如何进入 Groupher”，两端通过 versioned SourceTree contract 连接。
- 后续 URL 全站导入应作为独立来源适配器研究，不进入本次 archive downloader。

## 16. 目标接口

浏览器只读取安全的 Preview/Job DTO；archive、Markdown 集合、BodyBag 集合和临时路径都不能返回浏览器。

Dashboard Next.js API 负责确认前的临时 Preview。`POST` 在权限校验通过后调用 Workflow SDK `start(...)`，取得 Workflow run reference，并立即返回 `202`；Browser 不等待下载和分析完成：

```http
POST /api/docs/import/previews
Content-Type: application/json

{
  "community": "acme",
  "repoUrl": "https://github.com/acme/docs"
}

202 Accepted
{
  "previewRef": "preview_xxx",
  "status": "queued"
}
```

`previewRef` 是产品公开引用，可以由服务端安全地关联 Workflow run reference，但不能暴露 Blob pathname、临时目录或可绕过用户/社区归属检查的 Workflow 内部接口。`GET preview` 根据 Workflow run 状态返回 `queued / running / ready / failed`，完成后再从 Private Blob 读取 immutable Preview artifacts。

创建 Preview 前的授权顺序：

1. Dashboard Node 从当前登录会话取得用户身份，不接受浏览器自行声明 `userRef`。
2. Dashboard Node 携带当前用户凭据调用 Phoenix 的通用 `checkPassport` query。
3. Phoenix 使用现有 `PermissionRegistry` 和社区 Passport 规则返回 `true` 或 `false`。
4. 只有允许后，Dashboard Node 才生成服务端 idempotency key。若全局上限由共享 semaphore 实现，必须在启动 Workflow 前获取名额，失败时返回稳定的可重试错误。
5. Node 调用 Workflow SDK `start(...)`，把 `previewRef` 与 Workflow run reference 绑定并立即返回 `202`；若全局上限由 Workflow 对应 Queue/consumer 承载，超过运行上限的任务保持 queued。Route Handler 不等待分析完成，queued 不等于已经占用分析执行名额，超限任务也不能提前下载 archive。
6. 首版不实现“每社区同时最多一个”的独立 lease。全局名额优先由 Workflow 所使用的 Queue/consumer 显式配置最大并发；如果当前 Workflow 接口不能提供该配置，才使用共享 semaphore，并由成功、失败、取消和超时路径释放。不能把 Vercel 自动扩容误认为并发上限。
7. Dashboard 使用 audience/scope 受限的 Service Identity，并同时转发当前用户 access
   credential；Phoenix 必须验证两者并继续执行社区 Passport，service token 不能替代用户权限。

```graphql
query CheckPassport($community: String, $action: String!) {
  checkPassport(community: $community, action: $action)
}
```

本次使用：

```json
{
  "community": "acme",
  "action": "doc.import"
}
```

`checkPassport` 的规则：

- 不接受 `user` 和 `thread` 参数；始终判断当前登录用户，action 本身必须足够具体。
- 社区 action 必须传 `community`；global action 可以不传。
- action 必须在 `PermissionRegistry` 注册，未知 action 返回 GraphQL error，不能与无权限的 `false` 混为一谈。
- 该 query 是下载前的资源预检，不替代业务 mutation 的强制授权。
- 正式创建 ContentImport Job 的 mutation 仍使用 `middleware(M.Passport, action: "doc.import")`，因此 Review 期间权限被撤销后不能继续 apply。
- `doc.import` 是独立 community CMS grant，不复用 `doc.edit`；community root 和 global god 继续按现有规则 bypass。

Node analyzer 生成 SourceTree 后，调用 Phoenix 的只读 Docs Validator query：

```graphql
query PreviewDocContentImportTarget(
  $community: String!
  $sourceInfo: ContentImportSourcePreviewInput!
  $tree: Json!
) {
  previewDocContentImportTarget(community: $community, sourceInfo: $sourceInfo, tree: $tree) {
    targetTree
    conflicts
    counts
    targetRevision
  }
}
```

- 该 query 校验 SourceTree schema/version/规模，只读取当前社区 Docs 状态，不创建 Connection、Snapshot、Plan 或 Job。
- `targetRevision` 标识规划时主 Docs Draft/Tree 的状态。首版语义固定为 main branch identity 与 `DocsSiteState.tree_lock_version` 的版本化组合；API 可以返回 opaque string，但不能改成与 Tree revision 无关的随机 token。main branch 或 state 尚未惰性初始化时与 revision `0` 等价。
- Node 将 TargetTree、conflicts 和 targetRevision 合并进 Preview DTO；原始正文仍保存在当前 `previewRef` 的 Private Blob 前缀下。
- Apply mutation 必须在包含整个写入过程的同一个 Phoenix `Repo` transaction 中解析 main branch，再获取普通 Doc Tree 写入共用的 PostgreSQL transaction advisory lock：`doc_tree:<community_id>:<branch_id>`，然后读取当前 `tree_lock_version` 并比较 targetRevision。
- targetRevision 已变化时必须回滚并返回 `target_revision_conflict`，要求用户重新 Review。创建 Job 或 apply 不能静默重新规划并接受一套用户没有确认过的新映射。
- targetRevision 未变化时继续持有同一把锁，直到 BodyBag/Draft 写入、Tree upsert、revision bump、ImportSourceMapping 更新和 Job completion 一起提交。不能在事务外做 `read → compare → write`，也不能只依赖所有写入方未共同参与的孤立 CAS。

```http
GET /api/docs/import/previews/preview_xxx

200 OK
{
  "previewRef": "preview_xxx",
  "status": "ready",
  "expiresAt": "...",
  "sourceInfo": { "repo": "acme/docs", "branch": "main", "commit": "..." },
  "counts": { "tabs": 2, "groups": 6, "pages": 42, "assets": 18 },
  "tree": { "tabs": [] },
  "targetTree": { "tabs": [] },
  "targetRevision": "...",
  "conflicts": [],
  "badSmells": []
}
```

用户确认时仍由 Dashboard Next.js API 编排，但从这一步起创建 Phoenix ContentImport Job：

```http
POST /api/docs/import/previews/preview_xxx/apply
Content-Type: application/json

{
  "community": "acme"
}

202 Accepted
{
  "jobRef": "job_xxx",
  "status": "publishing_bodies"
}
```

`apply` 内部按以下顺序执行：

1. 校验 PreviewRecord 所属用户、社区和 TTL，并读取 ready Dataset manifest。
2. 调用创建正式 Job 的 Phoenix mutation；该 mutation 通过 Passport middleware 再次强制校验 `doc.import`，不依赖之前的 `checkPassport=true`。
3. 向 Phoenix 发送 bounded import manifest、SourceTree、固定 source revision 和 Review 时的 targetRevision；Phoenix 验证 Review intent 仍有效后创建正式 Job，失败则要求重新 Review。
4. 从 Private Blob 读取筛选后的来源文档，逐 Page 转换为 BodyBag。Node 使用共享 publisher 已有的 `ARTIMENT_MAX_INPUT_BYTES = 2 MiB`（序列化 Plate value），以及写死的 `MAX_BATCH_COUNT = 4`、`MAX_BATCH_BYTES = 6 MiB`（完整 GraphQL request JSON）和 `MAX_BODY_BAG_BYTES = 5 MiB`（单篇 canonical BodyBag JSON）切批并 stage；大小统一按未压缩 UTF-8 序列化 bytes 计算，不按字符数或压缩后大小计算。
5. 单篇超过 2 MiB Plate input 或 5 MiB BodyBag 时返回 `content_too_large`，将该 Page 标记为 skipped 并从有效 TargetTree 排除，其他 Page 继续；普通转换失败则停止在 `conversion_failed` 且不调用 apply。所有有效 Page ready 后才调用 atomic apply；全部 Page 均被跳过时不调用 apply。
6. 返回 `jobRef`，后续恢复和进度读取切换到持久化 Job。
7. apply 完成或失败收尾后清理 Preview objects；正式 Job 和错误摘要继续由 Phoenix 保存。

切换时直接删除旧 `startGithubDocImport` 分析入口；不保留兼容期接口、silent fallback 或新旧双路径。目标流程不再由 Phoenix mutation 在用户确认前读取 GitHub 或创建正式 Job。

### 16.1 Preview DTO 边界

Dashboard 只接收可展示的安全 DTO：

- Repo、branch、commit、framework、config path、content root。
- 只读 SourceTree 和数量统计。
- warnings / `TBadSmell[]` 的公开描述。
- 固定目标映射、TargetTree 和碰撞结果。
- 任务状态、分阶段进度和最终公开引用。
- Preview 的公开引用和过期时间。

`counts.assets` 只表示 analyzer 检测到的 asset reference 数量，用于提示首版可能缺失的图片/附件；它不表示这些资源会被复制或进入 `Job.Asset`。

不能暴露到 Dashboard：

- 数据库内部 ID。
- 私有凭据或 GitHub token。
- 完整内部 Import Plan。
- 全量未发布 BodyBag、staging 内容地址或正文集合。
- 后端内部文件系统或临时存储引用。
- archive 下载地址、解压根目录或任意服务端绝对路径。

## 17. 当前实现快照

本节记录 2026-07-22 目标边界完成本地切换后的仓库现状。目标产品规格仍以前文为准；部署环境 release gate 单列在第 18 节。

### 17.1 当前链路

1. Dashboard 保留三步 UI：输入 Repo、检查识别结果与树、确认导入。确认前使用 `previewRef`，正式 Job 使用 `jobRef`，URL 与 API 可分别恢复 Review 和 Import。
2. Vercel Workflow 固定为 `analyzeSource` 与 `validateTarget` 两个 durable Step；安全 archive workspace 只活在前一个 Step，后一个 Step 从 PreviewStore 读取 SourceTree。
3. Docusaurus、Fumadocs、MkDocs、Nextra、Rspress、Starlight、VitePress 七类 Node/TS analyzer 继续使用真实仓库形态 fixture；生产路径不再保留 Elixir analyzer fallback。
4. Files SDK 后的 `PreviewStore` 保存不可变 `PreviewRecord + DocsDataset + Review artifact`，使用固定 `attemptRef`、write-once run association 和 attempt-local ready receipt。
5. Dashboard Node 复用 document-importer/artiment-publisher，把 Markdown 转换为 BodyBag；固定容量为 2 MiB Plate input、每批最多 4 篇、完整 GraphQL request JSON 最多 6 MiB。
6. Phoenix 只保留 ImportJob、JobItem、PostgreSQL BodyBag staging、Docs Validator/Writer 和 ImportSourceMapping。单篇 canonical BodyBag 最多 5 MiB，由 Phoenix 编码并记录权威 `body_size_bytes`。
7. Writer 在一个数据库事务和 main Doc Tree advisory lock 内验证 `targetRevision`、过滤 skipped Page、写 Draft/Tree/Mapping、完成 Job 并删除 staging。same-hash stage、completed stage/apply 重放均幂等。
8. 旧 Snapshot/Preparation/Plan/Checkpoints/PayloadStore、Phoenix GitHub/archive/framework 路径、Changelog/AssetStager 半成品和相关旧表已直接移除，不保留兼容读写或数据迁移。

### 17.2 仍待部署验收

- 使用真实生产配置验证 Vercel Private Blob 的私有读写、TTL 清理与失败诊断保留。
- 用固定公开仓库跑通 Browser → Dashboard Node → Phoenix → PostgreSQL → Docs Draft 完整 E2E，并覆盖真实 403、archive、adapter 和转换错误。
- 在实际 Workflow queue/consumer 上配置并验证全局活动分析并发；当前没有每社区独立 lease。
- 接通主动 sweeper 调度、阶段耗时、BodyBag/Blob 字节、retry 和清理结果指标。
- 继续补充 framework 复杂变体；当前 basic/已有变体 fixture 不能替代真实公开仓库验收。

### 17.3 当前存储事实

当前只有三类明确存储职责：

- Node Files SDK PreviewStore：确认前的不可变 Preview/Dataset/Review 工作集；local/test 使用 fs adapter，生产使用 private Vercel Blob adapter。
- PostgreSQL ContentImport staging：确认后、apply 前的 Job/JobItem/BodyBag；不保存 archive、解压文件或 Snapshot/Plan locator。
- PostgreSQL Docs 数据：原子 apply 后的主 Draft、DocTree 与 ImportSourceMapping。

Preview 不复用 `CONTENT_IMPORT_PAYLOAD_DIR`，也不新增 Phoenix 本地 payload 目录。Workflow Step 的本地临时目录只服务当前一次下载、解压和分析，Step 结束即丢弃。多媒体资源发现、复制、URL 重写和清理生命周期仍是后续能力，不属于本次迁移。

Vercel Private Blob 是类似 S3 的对象存储，不是关系型数据库，也不保存业务查询模型：

- 只需要在 Vercel Team/Project 下创建一个 private store 并连接到 Dashboard 项目，不为每个社区单独申请。
- 生产 Functions 使用项目级认证访问；Browser 不能拿到 store 凭据，也不能直接列出 Preview 对象。
- Workflow event log 保存步骤状态与小型返回值；大量 Markdown 和来源 artifact 保存在 Blob，不能塞入 Workflow step output。
- Blob 对象尽量 immutable；Preview 用 `previewRef` 前缀隔离，取消、apply 完成或 TTL 到期后按前缀清理。

## 18. 目标验收标准

2026-07-22 已完成新边界的本地代码切换与聚焦测试。以下 checklist 同时记录本地实现和部署 release gate：已勾选项表示代码与本地测试已完成；未勾选项需要产品交互复核、真实凭据、全局运行时配置或 Browser E2E，不能只凭单元/集成测试宣称完成。

### 18.1 产品与交互

- [x] 用户只粘贴 GitHub URL，不需要手动下载 archive，也不需要填写 GitHub token。
- [x] Stepper 明确把分析中显示为第一步子状态，SourceTree 和 Target Preview 就绪后才进入第二步。
- [x] 第二步显示 repo、branch、commit、framework、config、content root 和只读 SourceTree。
- [x] 无源 Tab 固定进入 `Introduction`；单/多源 Tab 保留源名称；Review 中不显示伪目标选择器。
- [x] Review 只检查 SourceTree、TargetTree、标题、slug、数量和 warning；首版不在确认前转换或预览单篇正文。
- [x] Review 操作区内联展示全量导入摘要，并通过一次带实际 Page 数量的按钮直接 apply，不增加独立确认页或二次弹窗。
- [ ] 同一 Repo/branch 命中既有 Mapping 时，Review 返回 mapped Page 数量并显示覆盖风险；用户点击“继续并覆盖”后 Phoenix 校验 acknowledgement 并执行覆盖，不能再以重复/冲突为由禁止导入。
- [ ] 冲突页只提供真实可执行的“返回仓库”和“重新检查目标状态”，不出现不存在的 branch/path/逐 Tab 映射操作。
- [ ] 转换结果显示失败/跳过 Page、来源路径、阶段、错误码和原因；普通转换失败不能跳过，只有稳定的 `content_too_large` 可排除该 Page 后继续。
- [x] 全部有效 Page 转换成功后才 atomic apply；过滤后的 TargetTree 必须与有效 items 一致；零可导入项不 apply，任一失败都不留下用户可见的残缺树或正文。
- [x] 完成页可在 Docs 编辑器中打开第一篇导入文档，且不会自动发布。

### 18.2 架构与迁移

- [x] 创建 Preview 前调用 Phoenix `checkPassport(community, "doc.import")`；正式 Job create/start mutation 使用同一 action 的 Passport middleware 再次强制校验，后续 stage/apply 仅接受 `service:content-import` 的 operation-scoped continuation。
- [x] Dashboard Node 流式下载固定 commit 的 archive，不把完整压缩包或解压结果放入进程内存。
- [x] 用户确认前，Phoenix 不创建正式 ContentImport Job，不接收 archive、解压文件或正文集合。
- [x] Node 只把 versioned SourceTree/sourceInfo 发送给 Phoenix；Phoenix 只读返回 TargetTree、conflicts 和 targetRevision。
- [ ] 七类 Node adapter 已通过 basic golden parity；继续补齐变体，并完成固定公开仓库 Preview 验收。
- [x] 保持生产请求不按 framework 回退 Elixir analyzer；新 Files SDK/staging 链路验收后删除 Phoenix 旧 analyzer，未来 ZIP 也复用同一 Node Source Analyzer。
- [x] Apply 时 Phoenix 验证 Review intent 和 targetRevision；变化后失败并要求重新 Review，不能静默规划新目标或覆盖并发修改。
- [x] `POST preview` 启动 Vercel Workflow 后立即返回 `202`；Browser 通过 `previewRef` 轮询，不保持长 HTTP 请求。
- [x] Workflow 固定拆为 `analyzeSource` 与 `validateTarget` 两个 durable Step；target validation 失败只重试第二步，Function 实例退出或部署切换不会要求扫描本地目录恢复状态。
- [ ] 筛选后的来源文件、SourceTree 和 `TBadSmell[]` 缓存在 Private Blob；生产链路不依赖本地持久卷、进程内 registry 或 sticky session。
- [ ] 全局活动分析并发显式限制为配置值；达到上限时排队或返回可重试错误。首版不承诺每社区独立并发上限，但相同请求必须通过服务端 idempotency 防止重复启动。
- [x] archive 路径穿越、device/FIFO、压缩炸弹、超限文件和超时均被阻断；symlink/hardlink 不解析、不物化，安全跳过并计入文件数上限。
- [ ] 固定公开仓库完成 Browser → Dashboard Node → Phoenix 的完整联调，并验证详细 403、archive、adapter、Page conversion 和 atomic apply 错误。
- [x] 旧 Snapshot/Preparation/Plan/Job/JobItem/JobAsset/PayloadStore/Preview Session 数据与 payload 文件可直接删除；不做历史迁移、backfill、dual read/write、旧 decoder、fallback 或兼容 accessor。

## 19. 实施步骤

### 19.1 复核并冻结 Preview contract

1. 保留当前确认前 `TDocImportPreview` 与确认后 `TContentImportJob` 的边界。
2. 固定 `sourceInfo / counts / tree / badSmells / expiresAt` 的公开字段。
3. 保持 `previewRef` 与 `jobRef` 分开命名，不允许重新合并为一个状态对象。
4. 复用现有七类 framework golden，并为 Preview DTO 增加布局、hash 版本和规模 runtime decoder。

### 19.2 建立 Workflow PreviewRecord 与 DocsDataset

1. 复用现有 Dashboard Workflow，在 admission 时为一次逻辑分析预先生成随机 `previewRef/attemptRef`，并把两者作为 Workflow 输入。
2. Immutable PreviewRecord 必须绑定 `userRef + community + repoUrl + attemptRef + TTL`；Workflow run ref 单独写入 write-once `analysis-run.json`。读取 Preview DTO 和 apply 都重新校验归属。
3. Workflow 不把状态写入可变 Session；两个 Step 的基础重试复用固定 `attemptRef`，写 content-addressed immutable DocsDataset shards，最后写 attempt-local ready receipt。
4. `POST /previews` 完成权限和 admission 检查后调用 `start(...)`，将 `previewRef` 传入 Workflow 并立即返回 `202`，不能在 Route Handler 中等待完整仓库分析。
5. `analyzeSource` Step 完成下载、解压、候选过滤和 Node adapter 分析；它使用权限收紧的随机临时目录，将筛选后的来源文件、SourceAnalysis、SourceTree 和 `TBadSmell[]` 写入 DocsDataset 后在 `finally` 中清理。临时文件不跨 Step，也不作为恢复依据。
6. `validateTarget` Step 从 PreviewStore 读取已持久化的 SourceTree，调用 Phoenix Docs Validator，将 Target Preview 单独写入 `review/`，再最后写 attempt-local `ready.json`；该 Step 失败只重试 target validation/review 写入，不重跑 archive 下载与分析。
7. Workflow 将执行状态和错误写入 durable event log；Phoenix Target Preview 不混入纯来源 Dataset。
8. 增加主动取消、失败清理和 TTL sweeper；默认 TTL 60 分钟。用户取消、apply 完成或过期后删除当前 `previewRef` 前缀下的 Blob 对象。
9. Workflow 运行在 Node.js runtime，不使用 Edge runtime。首版不需要 Docker、常驻 Node、单节点持久卷、Fly.io 或独立 Worker；只有未来出现原生系统依赖时才评估同一 Vercel 项目内的 `Dockerfile.vercel`。
10. Workflow 整体可以长期运行，但每个 `"use step"` 仍是一次 Function invocation，必须落在当前 Vercel plan 的 `maxDuration` 和 memory 上限内。上线前用最大允许 archive 分别测量 `analyzeSource` 的 download/extract/analyze/persist 和 `validateTarget` 的 Phoenix round trip/review write；只有前者仍不稳定时才进一步物化 `SourceWorkspaceRef` 拆分，不能保存完整原始 archive。

Private Blob 使用一个 Dashboard 项目级 private store，逻辑路径只使用不可猜测的随机 `previewRef`，不能使用仓库名或“仓库名 + 短 commit”作为身份：

```text
content-import/previews/
├── _preview-records/v1/prv_01JXYZ....json
└── prv_01JXYZ.../
    ├── analysis-run.json
    └── attempts/{attemptRef}/
        ├── dataset/
        │   ├── manifest.json
        │   ├── analysis.json
        │   ├── tree.json
        │   ├── bodies/
        │   ├── bad-smells.json
        │   └── optional-streams/   # future；首期不创建空目录
        ├── review/
        │   └── target-preview.json
        └── ready.json
```

- `previewRef` 是 Preview 的公开身份，同时绑定当前用户与社区；它不是数据库 ID，也不能直接授权 Blob 访问。
- `owner/repo`、默认分支和完整 commit SHA 保存在 immutable Preview artifact；短 commit 只用于 UI 展示，不能作为 identity。
- `source/` 只保存筛选后的候选文件；首版不创建单篇正文 Preview cache。
- Blob pathname 不能直接包含未规范化的用户输入、branch 或 source path；`sourceRef` 必须先经过 contract 校验和编码。
- Blob artifact 使用 content hash 或 attempt-scoped immutable pathname；`ready.json` 位于 attempt 内并最后写入，绑定 `datasetManifestHash/targetPreviewHash/targetRevision`。Step 重试在相同 `attemptRef` 下执行 create-or-assert-same，不能读取没有 ready receipt 的半成品；根目录不维护需要 CAS 的获胜 attempt 指针。
- Function 实例退出时，Workflow 从已完成的 durable Step 继续；如果正在执行的 `analyzeSource` 被中断，则重试整个 Step，不进行 archive 流中点续传；`validateTarget` 失败不重跑前者。
- 若未来增加跨 Preview 的 immutable commit cache，应使用独立的 `sha256(owner/repo@full-commit)` cache key，不能与 Preview 生命周期混在一起。

#### 19.2.1 本地开发与调试

本地不需要额外启动 Redis、队列或 Workflow 数据库。Workflow SDK 的 Local World 随独立
Content Import Node 服务运行：

```bash
cd backend/content-import
yarn dev
yarn exec workflow inspect runs --web
```

- 本地 Inspector 从 `.workflow-data/` 读取 Run、Step、输入、输出、错误和耗时；该目录是开发产物，不提交 Git。
- GitHub 和 Phoenix 使用本地 `.env`/`.env.local`；需要连接 Vercel 测试资源时再执行 `vercel link` 和 `vercel env pull`。
- `PreviewStore` 是可替换接口：本地默认使用 `.tmp/docs-import/previews/`，`CI=true` 也强制使用 local backend，即使 CI 环境包含 `VERCEL=1`；测试不需要 `BLOB_READ_WRITE_TOKEN` 或 Vercel 网络。
- 可通过 `DOCS_IMPORT_PREVIEW_STORE=local|blob` 显式选择 backend；本地/CI 可设置 `DOCS_IMPORT_PREVIEW_DIR` 指向测试临时目录。Vercel Preview/Production 选择 `blob` 时才要求 `BLOB_READ_WRITE_TOKEN`。
- 单测直接覆盖 downloader、extractor、adapter 和 SourceTree 纯逻辑；集成测试再覆盖 `POST → Workflow run → Preview ready/failed` 生命周期。
- 测试应显式注入 Step 失败，验证已完成 Step 不重复执行、`analyzeSource` 在固定 `attemptRef` 下整体重试、`validateTarget` 失败不重跑前者、无 ready receipt 的半成品不可见以及错误 DTO 可恢复。

### 19.3 实现 archive downloader

1. 只接受标准 `https://github.com/{owner}/{repo}` 公共仓库 URL。
2. 解析并固定默认分支 revision；archive 必须锚定到固定 commit，Review 与 Apply 不能读取两个不同版本。
3. 通过 GitHub archive/codeload 获取该 commit 的 `tar.gz`，不执行 `git clone`、不下载 `.git` history，也不再调用每文件 blob API。
4. 将 HTTP body 接入 gzip/tar 流，边下载、边解压、边检查 entry；不把完整 archive 放入 Node 进程内存。
5. 只把 framework config、navigation config、项目 manifest、Markdown/MDX 等候选文本文件写入 `analyzeSource` Step 的临时目录，并在 Step 成功前上传到当前 `previewRef` 的 Private Blob 前缀；其他源码和二进制 entry 只计入安全上限，不保留。
6. 下载和解压流同时执行 compressed bytes、expanded bytes、物化文件 bytes、总超时、空闲超时和取消处理。
7. 对无效仓库、不可访问、下载超时和上游 5xx 返回稳定错误码，不把上游原始响应直接暴露给用户。

### 19.4 安全解压与资源上限

首版沿用已有导入上限，并额外增加 compressed archive 上限：

| 限制                     | 首版建议值 | 校验时机                                                       |
| ------------------------ | ---------: | -------------------------------------------------------------- |
| compressed archive       |     50 MiB | 下载流中，同时检查 `Content-Length` 与实际字节                 |
| files                    |      5,000 | 解压 entry 迭代中                                              |
| single extracted file    |     10 MiB | 写入前和写入中                                                 |
| total expanded stream    |    500 MiB | tar 解压流中所有 entry 的累计实际字节                          |
| retained candidate bytes |    100 MiB | 当前 Step 临时写入并最终上传到 Private Blob 的候选文件累计字节 |

这些数值还必须与实际 Vercel plan 的 Function memory、`maxDuration` 和 Blob operation 成本一起压测。Workflow 解决跨 Step 的持久化和恢复，不意味着单个下载/分析 Step 可以无限占用 CPU、内存或执行时间。

解压器还必须：

- 拒绝绝对路径、`..` 路径穿越和逃出 session root 的目标路径。
- symlink/hardlink 不解析 target、不物化到工作区，安全跳过并计入文件数上限；拒绝 device、FIFO 和其他非普通文件/目录 entry。
- 不信任 archive header 声明的大小，按实际解压字节再次计数。
- 超限或取消时立即停止读取、关闭句柄并清理临时目录。
- 使用异步流式 API，禁止同步读取整个 archive 或在事件循环中做无界 CPU 工作。

### 19.5 巩固现有 Docs analyzer 与 parity

七类 Node/TS analyzer、共享 SourceWorkspace/static config 基础和 basic golden parity 已存在。本节不是重新实现 adapter，而是把现有模块收敛到目标目录、冻结跨运行时 contract，并补足框架变体和真实仓库验收。

#### 19.5.1 复核并冻结跨运行时 contract

1. 定义 versioned `DocsDataset / SourceTree / TBadSmell` JSON contract，不把 Elixir struct、atom 或数据库字段直接翻译成 TS 类型。
2. Node 输入统一为只读 `SourceWorkspace`：固定 revision、规范化相对路径、大小、文本读取接口和文件 metadata；adapter 不接触 archive、临时绝对路径或网络。
3. Node 输出统一进入 `DocsDataset`：framework、config paths、content root、canonical SourceTree、document descriptors 和 `TBadSmell[]`。
4. SourceTree 只表达来源语义 `scope / section / page / link`，不包含 Groupher Tab/Group/Doc ID，也不执行目标冲突判断。
5. 为 contract 增加 schema version、runtime decoder 和规模限制；Node 输出和 Phoenix 输入都必须验证，不能只依赖 TypeScript 类型。

目标模块边界以总架构文档为准，首期只创建 GitHub + Docs 的真实目录：

```text
backend/content-import/src/
├── lib/content-import/
│   ├── core/contracts/
│   ├── core/preview-store/
│   ├── platforms/github/repo/
│   ├── threads/docs/
│   └── transport/phoenix/docsImport.ts
└── workflows/content-import/docs/
    ├── analyzeGitHubRepo.ts
    └── applyDocsDataset.ts
```

详细文件树见 [`content_import_architecture.md`](./content_import_architecture.md#9-node-目录结构)。

#### 19.5.2 收敛共享解析基础设施

现有实现继续遵守以下边界，目录迁移时不能退化：

1. POSIX 相对路径规范化、路径大小写和扩展名判断。
2. Markdown/MDX frontmatter、title、slug、route 和 sourceRef 提取；标题必须遵守独立的 [MD/MDX 文档标题归一化规范](./markdown_title_normalization.md)，保留 `metadataTitle / title / SourceTree.page.title` 的语义边界。
3. JSON/YAML 解析，以及 JS/TS/ESM/CJS 配置的 AST 静态对象提取。
4. sidebar/meta/nav 公共节点归一化。
5. `TBadSmell` 构造、source path 定位和 warning/error 等级。
6. 禁止执行仓库代码：不能使用 `import()`、`require()`、`eval()` 或启动框架构建命令；动态表达式必须返回可定位 BadSmell。

候选文件筛选采用“排除明显无关目录 + 保留有界文本文件”，不能只写死几个配置路径。这样 monorepo 和自定义 docs root 仍可被检测，同时大型二进制不落盘。

#### 19.5.3 扩展 golden fixtures

1. 复用现有七类 framework source fixtures，不为 Node 重新创造另一套示例语义。
2. 当前七类 basic fixture 已复用 Elixir `expected/tree.json`。Source Analyzer golden 只冻结 `来源文件 → canonical DocsDataset/SourceTree`；输出不得包含 Groupher Tab/Group、`Untitled`、targetRevision 或其他 target validation 字段。
3. Phoenix Docs Validator 单独维护 `SourceTree + 目标状态 fixture → TargetTree/conflicts/targetRevision` golden，并在这里断言无 Group 的直属 Pages 最终进入 `Untitled`。不能把 Groupher fallback 迁入 Node adapter 来满足 analyzer parity。
4. Golden JSON 只作为迁移基线；发现原实现 bug 或已确认的产品规范变化时，先单独确认语义，再更新对应层的 golden 与实现，不能让 Node 测试悄悄“修正”行为。
5. 每个 Source Analyzer fixture 至少覆盖显式导航、fallback/auto navigation、外部 link、frontmatter override、缺失 Page 和动态配置 BadSmell；共享标题测试额外覆盖“只有 metadata title / 只有前导 H1 / 两者相同 / 两者不同 / 非前导 H1 / 文件名 fallback”；Docs Validator fixtures 另行覆盖 Tab/Group fallback、目标冲突和 revision 变化。

#### 19.5.4 按顺序补齐变体与真实仓库验收

以下是测试补强顺序，不是重新实现顺序，也不是面向用户分批开放：

1. VitePress：作为首条 archive → SourceTree → Target Preview → Apply 的完整验收链路。
2. Rspress：重点补 `_nav.json` / auto navigation。
3. Nextra：重点补 `_meta.json`、pages/app router 和目录语义。
4. Fumadocs：重点补 meta/目录导航和 link/separator 行为。
5. Starlight：重点补 Astro config/sidebar 与自动目录 fallback。
6. Docusaurus：重点补 sidebars、category metadata、doc id/slug 路由。
7. MkDocs：重点补 YAML nav、docs_dir 和目录 fallback。

每个 adapter 的完成条件一致：

- detect 结果、framework metadata 和 config paths 正确。
- canonical SourceTree 与 golden JSON 等价。
- title/slug/route/sourceRef 行为等价。
- 动态或不支持配置产生稳定 BadSmell，不执行来源代码。
- adapter 单测和共享 contract tests 通过。
- 至少一个真实公开仓库 archive 能完成只读 Preview；非首个 framework 不要求每次重复完整 Apply 浏览器测试。

VitePress 完整端到端作为内部开发基线；其余六类至少通过增强 fixture 和固定公开仓库只读 Preview。任何生产请求都不能按 framework 静默回退 Elixir analyzer。

#### 19.5.5 把 Groupher 目标验证和写入留在 Phoenix

1. Node adapter 只生成 SourceTree，不迁移依赖社区数据库状态的 target conflict 逻辑。
2. Phoenix 提供只读 Docs Validator query，输入 bounded SourceTree，输出 TargetTree、conflicts、counts 和 targetRevision。
3. `Introduction / Untitled` 等 Groupher 目标树 fallback、slug/route 碰撞和当前 Docs 状态判断由 Phoenix 维护。
4. Docs Validator 和 Apply 必须遵守 [Section 16](#16-目标接口) 定义的 targetRevision、branch absence、事务与 advisory lock contract；本节不重复定义第二套规则。
5. 实现时复用普通 Doc Tree 写入的锁键和 revision 机制，不创建仅供 ContentImport 使用的平行并发协议。
6. Docs Validator 不持久化 Job/Plan，不接收 Markdown/BodyBag，也不暴露数据库 ID。

#### 19.5.6 切换和清理旧路径

1. 七类 Node adapter 已进入现有 Preview flow；目录收敛时保持外部 contract 和 golden 输出不变。
2. Files SDK、PostgreSQL staging 和新 Phoenix Writer 链路通过完整验收后，删除仍服务旧 Snapshot/Plan 路径的 Elixir framework dispatch。
3. GitHub Repo 和未来 ZIP 等 file-based Docs source 都进入同一个 Node `SourceWorkspace → DocsDataset` 边界。
4. ZIP 上传仍是后续产品能力，本次不增加用户入口；但不能为未来 ZIP 保留第二套 Elixir framework analyzer。现有 ZIP fixtures 继续作为跨来源等价测试输入。
5. 切换后删除 `startGithubDocImport` 中逐 blob GitHub Repo fetch 和确认前持久化 Job 的旧入口，不长期维护双路径或 silent fallback。
6. Elixir GitHub Releases → Changelog 是 API record source，不经过 Docs framework analyzer，不因本次迁移删除。
7. Elixir 只保留 ImportJob、PostgreSQL staging、Docs Validator/Writer 和 ImportSourceMapping；Snapshot/Preparation/Plan/PayloadStore 目标链路按总架构删除。

### 19.6 接入权限、Docs Validator 与三条 Next.js API

Phoenix：

1. 在 `PermissionRegistry` 注册独立 `doc.import` community CMS grant，并同步 Passport 管理 UI/规则列表；community root 和 global god 保持 bypass。
2. 增加通用 `checkPassport(community, action): Boolean!` query，未知 action 报错，且不接受 user/thread。
3. 增加只读 `previewDocContentImportTarget` query，验证 SourceTree contract 并返回 TargetTree/conflicts/targetRevision。
4. 调整正式创建 Job 的 mutation，使其使用 `M.Passport action: "doc.import"`，并在创建前验证 Review intent 和 targetRevision。

Dashboard Next.js：

1. `POST /api/docs/import/previews`：鉴权和 admission 后启动 Workflow，立即返回 `previewRef + queued`。
2. `GET /api/docs/import/previews/:previewRef`：查询 Workflow run 状态；完成后读取 Private Blob Preview artifact，返回阶段、Preview DTO 或稳定错误。
3. `POST /api/docs/import/previews/:previewRef/apply`：重新鉴权、创建 Phoenix Job、从 Private Blob 读取来源并转换/stage BodyBag、触发 atomic apply。
4. Route handler 只做参数、鉴权、启动/查询 Workflow 和响应映射；下载、temporary workspace、analyzer、PreviewStore 和 publisher 分别放在独立 `src/lib` 模块。

### 19.7 切换 Dashboard UI

1. 分析按钮从 GraphQL `startGithubDocImport` 改为创建 PreviewRecord/DocsDataset。
2. URL 恢复参数从 `?job=` 调整为确认前 `?preview=`、确认后 `?job=`。
3. Review Step 只消费 Preview DTO，只展示结构、目标映射、数量和 warning；单 Page 正文预览与部分选择一起延后。
4. Review 操作区内联展示全量导入摘要；用户点击一次 `导入 N 篇文档` 后切换为正式 `jobRef`，现有 importing/completed 轮询继续复用。
5. Preview 过期时保留仓库 URL 并引导重新分析；页面刷新或 Function 实例变化时通过 Workflow run 状态和 Private Blob artifact 恢复，不读取本地 `session.json`。
6. Stepper 在 `repo/analyzing` 都保持第一步 active，但分析状态必须显式显示 `GitHub 仓库 · 分析中`，避免与第二步内容卡片混淆。

### 19.8 增加有界并发

Workflow 负责 durable delivery、Step 重试和基础设施扩缩容，但自动扩容不等于产品所需的并发上限。Vercel Functions 会跨实例扩容，因此不能使用 Dashboard 进程内 limiter，也不能假设 Workflow 默认把并发限制为 4：

- 全局活动分析并发：首版建议 4，配置化，并结合仓库大小上限观察 CPU、内存、GitHub 和 Blob 用量。
- 优先在 Workflow 实际使用的 Queue/consumer group 上显式配置全局最大并发；如果当前 Workflow 接口不能暴露该能力，再实现一个共享全局 semaphore。无论采用哪种方式，都必须有跨 Function 实例的一致上限。
- 首版不实现每社区短 TTL lease，也不承诺社区级公平调度；后续只有在指标显示单社区抢占或真实并发冲突时再增加 keyed admission。
- `previewRef`/服务端 idempotency key 必须阻止相同请求因双击、网络重试或 Workflow start 重试而重复启动。
- 达到全局上限时由队列等待，或返回 `preview_queue_full`；不能先下载 archive 再拒绝。
- BodyBag Publisher 使用四个写死的代码常量：`ARTIMENT_MAX_INPUT_BYTES = 2 MiB`（序列化 Plate value）、`MAX_BATCH_COUNT = 4`、`MAX_BATCH_BYTES = 6 MiB`（完整 GraphQL request JSON）和 `MAX_BODY_BAG_BYTES = 5 MiB`（单篇 canonical BodyBag JSON）。加入下一篇会超过 4 篇或 6 MiB 时先发送当前批次；不探测运行环境、不动态改变上限，也不暴露容量配置。
- 容量统一按未压缩 UTF-8 序列化 bytes 计算。HTTP gzip、PostgreSQL TOAST 和 Blob at-rest compression 只影响传输/存储，不得放宽上述上限。
- Phoenix 在 `BodyBag.cast` 后重新 canonical encode，生成并保存权威 `body_size_bytes`；GraphQL input 不接收可信的客户端 size。

GitHub/codeload rate limit 只是上游失败保护，不是 admission 或成本控制机制。上线前必须验证所选 Workflow/Queue 配置确实生效；若无法显式设置全局并发，则共享 semaphore 仍是 release blocker。

### 19.9 错误与可观测性

至少提供以下稳定错误码：

| code                             | 含义                                                                           | 用户动作                       |
| -------------------------------- | ------------------------------------------------------------------------------ | ------------------------------ |
| `github_repo_unavailable`        | 仓库不存在、非公开或不可访问                                                   | 检查 URL/仓库可见性            |
| `github_archive_rate_limited`    | GitHub/codeload 返回 403 或 429 限流                                           | 展示可重试时间并稍后重试       |
| `github_archive_download_failed` | archive 上游失败                                                               | 重试                           |
| `preview_queue_full`             | 当前分析任务过多                                                               | 稍后重试                       |
| `archive_size_limit_exceeded`    | 下载或解压总体积超限                                                           | 更换仓库/缩小仓库              |
| `archive_file_limit_exceeded`    | 文件数超限                                                                     | 更换仓库/缩小仓库              |
| `unsafe_archive_entry`           | archive 含不安全路径或 entry                                                   | 阻断并更换仓库                 |
| `unsupported_framework`          | 未识别支持的文档框架                                                           | 查看支持列表                   |
| `preview_expired`                | 临时预览已清理                                                                 | 重新分析                       |
| `preview_workflow_failed`        | Workflow 在重试后仍未完成分析                                                  | 查看具体阶段并重新分析         |
| `document_conversion_failed`     | 一篇或多篇 Page 无法生成有效 BodyBag                                           | 展开失败列表并 reset/re-import |
| `content_too_large`              | 单篇超过固定 2 MiB Plate input 或 5 MiB canonical BodyBag 上限；该 Page 已跳过 | 拆分或精简该文档后手动导入     |
| `target_revision_conflict`       | Review 后目标 Docs 已变化                                                      | 重新检查目标状态               |
| `content_import_apply_failed`    | 正式导入失败                                                                   | 查看 Job 诊断并重试            |

所有错误响应使用统一安全结构：`code / stage / message / retryable / details`。`details` 可以包含 GitHub HTTP status、脱敏的 upstream request id、`retryAfter`、framework/config path 或失败 `sourceRef`，但不能返回 token、上游原始响应正文、服务端绝对路径或 stack trace。截图中的 `[GraphQL] GitHub request failed with status 403` 在目标流程中至少应映射成具体阶段、稳定错误码、是否可重试和用户下一步，而不是只透传一行 403。

日志和指标至少包含：`previewRef`、Workflow run reference、社区公开引用、Step 尝试次数、阶段耗时、下载字节、解压字节、Blob 读写字节/对象数、文件数、admission 等待时间、framework、BodyBag 单篇/单批/单 Job 字节、结果错误码和清理结果；不记录 token、正文、Blob 凭据或服务端绝对路径。

### 19.10 测试与切换

1. Downloader 单测：redirect、404、超时、Content-Length 欺骗、流中断和取消。
2. Extractor 单测：路径穿越、symlink/hardlink 安全跳过且不物化、device/FIFO、压缩炸弹、文件数/单文件/总体积边界。
3. Analyzer fixture tests：七类框架的 source input → canonical Preview DTO。
4. Workflow/Preview tests：用户/社区隔离、TTL、取消、重复 apply、两个 Step 重试复用固定 attemptRef、target validation 失败不重跑 `analyzeSource`、无 ready receipt 的半成品不可见、Workflow run 恢复、Private Blob artifact 完整性、全局并发上限和过期清理。
5. Permission tests：`checkPassport` 不接受 user/thread、未知 action 报错、无权限返回 false；创建正式 Job 的 mutation 复用 `doc.import`。内部 stage/apply 只能通过 Server Trust 操作已存在且状态合法的 Job。
6. Integration test：固定公开仓库 → archive → Review DTO → 用户确认 → Phoenix Job → atomic apply。
7. Capacity tests：固定 2 MiB Plate input/4 篇/6 MiB request/5 MiB BodyBag 的边界值、未压缩 UTF-8 bytes、Phoenix 权威 `body_size_bytes`、跨批 stage、单篇超限跳过、过滤后 TargetTree 和零可导入项不 apply。
8. Browser test：输入 URL、第一步分析子状态、刷新/Function 实例变化恢复、检查树、一次确认 apply、普通 item 转换失败、超大单篇跳过、完成和错误重试。
9. 新链路验收通过后，直接移除 GitHub Bulk Import 的逐 blob REST 调用和前端旧 `startGithubDocImport` 分析入口；删除旧数据与 payload 文件，不保留迁移或兼容逻辑。

### 19.11 是否拆成独立 Vercel Service

首版把 Workflow、Route Handler 和 analyzer 放在现有 Dashboard Next.js 项目中。Workflow 与 Private Blob 已解决长任务、跨实例恢复和临时存储问题，不预先拆独立 Node app，也不引入 Fly.io。只有出现以下情况时，才评估同一个 Vercel Project 内的独立 Service：

- analyzer 需要与 Dashboard 不同的发布节奏、内存或 `maxDuration` 配置。
- archive 分析明显影响 Dashboard 普通 API 的成本、日志或故障域。
- 需要原生系统依赖，普通 Next.js runtime 无法满足，此时再考虑 `Dockerfile.vercel`。
- 需要独立资源配额、网络策略或团队 ownership。

拆分时仍保持 Preview HTTP contract、Preview DTO、Workflow input/output 和 analyzer contract 不变；不因为部署拓扑变化重做 Browser/Phoenix 边界。

## 20. 后续迭代顺序

建议在目标首版稳定后按以下顺序扩展：

1. ZIP 作为第二种来源，复用检查、映射、冲突和 apply 流程。
2. branch/path 高级选项。
3. 使用 `ImportSourceMapping` 在已导入文档打开时异步检查来源更新；基线 hash 使用 `source-md-v1:<sha256>` / `doc-sync-v1:<sha256>`，并复用同一 Import Content/Docs Writer 实现 single-item sync。
4. 单 Page 正文预览、Preview cache，以及部分 Page 选择和父子选择规则。
5. 完整冲突解决 UI，展示并确认 `-[platform]` 建议名称。
6. 私有 GitHub 仓库授权。
7. 线上文档 URL 全站导入，包括站点树发现、抓取边界、正文清洗和资源同步。

## 21. 联调前提

1. Auth 为 Dashboard、Content Import、Phoenix 和 Scheduler 分别配置独立 client；各调用方配置 `SERVICE_AUTH_TOKEN_ENDPOINT`、自己的 client id/secret，接收方配置 issuer/JWKS。
2. 正式 ContentImport Job 使用 PostgreSQL JobItem/BodyBag staging；确认前 DocsDataset 使用 Files SDK 后的 Vercel Private Blob。Phoenix 不再配置 PayloadStore。
3. 在 Vercel Team/Project 下创建一个 private Blob store 并连接 Dashboard 项目；它是对象存储，不是数据库，也不按社区分别创建。
4. Workflow SDK 随 Dashboard 部署；本地使用 Local World，Preview/Production 自动使用 Vercel Workflow，不需要单独部署队列或 Worker。
5. 显式配置并验证全局活动分析并发上限；优先使用 Workflow 对应 Queue/consumer 的最大并发配置，接口不支持时才增加共享 semaphore。首版不实现每社区 lease。
6. 选择一个结构完整、变动较少的公开受支持仓库作为固定验收样本。
7. 本轮不把多媒体缺失视为首版结构与正文验收的阻断项。
