# MD/MDX 文档标题归一化

本文定义所有 Markdown/MDX 来源进入 Groupher Docs 时的标题语义和正文转换规则。它适用于 VitePress、Docusaurus、Fumadocs、MkDocs、Nextra、Rspress、Starlight 以及后续接入的通用 MD/MDX 来源，不允许在单个 framework adapter 中实现另一套标题删除逻辑。

## 1. 问题边界

Markdown/CommonMark 只定义 heading，不定义 Groupher 的页面标题字段。来源系统通常同时存在以下信息：

- YAML frontmatter 或 MDX static export 中的标题元数据。
- 正文开头供读者看到的 H1。
- sidebar、nav 或 meta 配置中的导航标签。
- 文件名提供的最后 fallback。

Groupher 编辑器又把页面 `title` 和 body 分开显示。如果把来源 H1 同时写入页面 `title` 和 body，就会出现重复标题。

这不是 VitePress 特有问题，而是所有“MD/MDX 文档模型 → 标题与正文分离的 CMS 模型”都必须处理的映射问题。

## 2. Frontmatter 是什么

本文中的 `frontmatter` 指文件开头由 `---` 包围的 YAML 元数据：

```md
---
title: Installation
slug: /installation
---

# Install Groupher
```

它不是 Markdown/CommonMark 标准中的正文节点，也不能写入 Groupher body。MDX 可以使用以下静态 export 表达同类元数据：

```mdx
export const title = 'Installation'
export const metadata = { title: 'Installation' }
export const frontmatter = { title: 'Installation' }
```

导入器只读取静态可确定的字符串，不执行来源仓库中的 MDX、JavaScript 或 TypeScript 代码。

## 3. 四种语义

| 名称       | Contract / 状态                            | 含义                                                                           |
| ---------- | ------------------------------------------ | ------------------------------------------------------------------------------ |
| 元数据标题 | `SourceAnalysis.documents[].metadataTitle` | frontmatter 或 MDX static export 中的标题；可用于 SEO、来源追踪和导航 fallback |
| 可见标题   | `SourceAnalysis.documents[].title`         | 最终写入 Groupher Doc title、在编辑器标题区展示的唯一页面标题                  |
| 导航标题   | `SourceTree.page.title`                    | sidebar、nav、meta 中显示的标签；不回写正文或覆盖可见标题                      |
| 已消费 H1  | Publisher 的目标 AST 状态                  | 来源 H1 已提升为可见标题，因此不再重复写入 Groupher body                       |

“已消费 H1”不是对原始 Markdown 的修改，也不需要单独持久化布尔字段。`titleSource = heading` 是 Publisher 可以消费首个 H1 的来源证明。

## 4. 可见标题解析规则

`SourceAnalysis.documents[]` 按以下顺序解析：

1. 从原始文件中提取 YAML frontmatter，得到只包含正文的 body。
2. 把 body 解析为 Markdown/MDX AST，不使用正则搜索或删除 `# ...`。
3. 忽略静态 MDX ESM 和纯注释前导节点后，检查第一个有效顶层节点。
4. 如果该节点是 H1，则取它的纯文本作为 `title`，并记录 `titleSource = heading`。
5. 如果没有前导 H1，但存在静态 `metadataTitle`，则用它作为 `title`，并记录 `titleSource = metadata`。
6. 两者都没有时，用格式化后的文件名作为 `title`，并记录 `titleSource = filename`。

H1 包括 ATX 和 Setext 两种 Markdown 写法；链接、强调等内联格式只贡献纯文本。例如 ATX H1：

```md
# Markdown _Extension_ [Examples](/examples)
```

以及 Setext H1：

```md
# Visible title
```

只有第一个有效顶层节点是 H1 才能提升。段落后的 H1、后续 H1、嵌套 heading 都是正文结构，不能自动消费。

## 5. 导航标题规则

`SourceTree.page.title` 与 Doc `title` 分开解析，优先级为：

1. framework 导航配置中的显式标签，例如 VitePress `sidebar.text` 或 MkDocs nav label。
2. 文档 frontmatter 中的 `sidebar_label`。
3. `metadataTitle`。
4. Doc 可见 `title`。

导航 fallback 不改变字段边界。例如：

```md
---
sidebar_label: Start Here
---

# Getting Started
```

导入结果是导航显示 `Start Here`，页面标题显示 `Getting Started`，body 不再重复包含这个前导 H1。

## 6. Publisher 与“已消费 H1”

Publisher 必须使用分析阶段持久化的 `titleSource`，不能在发布阶段凭字符串相等重新猜测：

1. 从 PreviewStore 读取原始 Markdown/MDX 和对应的 `SourceAnalysis` document。
2. 从转换输入中排除 YAML frontmatter；MDX static metadata export 同样不进入 Groupher body。
3. 把正文反序列化为目标 Rich Editor AST。
4. 仅当 `titleSource = heading` 且目标 AST 的首个正文节点是 H1 时，消费该节点。
5. 发布剩余 AST 为 BodyBag。

| 来源结构                      | Groupher `title`           | Groupher body                                |
| ----------------------------- | -------------------------- | -------------------------------------------- |
| 只有 metadata title           | metadata title             | 完整保留正文                                 |
| 只有前导 H1                   | H1 纯文本                  | 消费已提升的第一个 H1                        |
| metadata title 与前导 H1 相同 | H1 纯文本                  | 消费第一个 H1，只展示一次                    |
| metadata title 与前导 H1 不同 | H1 纯文本                  | 消费第一个 H1；metadata title 留在来源分析中 |
| 段落后出现 H1                 | metadata 或文件名 fallback | H1 作为正文完整保留                          |
| 两者都没有                    | 文件名 fallback            | 完整保留正文                                 |

这里的“完整保留”只指正文节点。YAML frontmatter 和 static MDX metadata export 始终属于来源元数据。

消费只发生在本次生成 BodyBag 的目标 AST。PreviewStore 中的原始 Markdown/MDX 保持不变，因此重试、诊断和后续同步仍然有完整来源证据。

## 7. Contract 与实现边界

该规则从 `SourceAnalysis.schemaVersion = 2` 开始生效：

```ts
type TSourceDocument = {
  metadataTitle?: string
  title: string
  titleSource: 'heading' | 'metadata' | 'filename'
  // sourceRef、route、contentHash、sizeBytes 省略
}
```

实现位置：

| 边界                      | 文件                                                                                                            |
| ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| frontmatter/body 拆分     | [`documentFile.ts`](../../frontend/dashboard/src/lib/content-import/threads/docs/analyzer/documentFile.ts)      |
| Markdown/MDX AST 标题解析 | [`documentTitle.ts`](../../frontend/dashboard/src/lib/content-import/threads/docs/documentTitle.ts)             |
| SourceAnalysis contract   | [`sourceAnalysis.ts`](../../frontend/dashboard/src/lib/content-import/threads/docs/contracts/sourceAnalysis.ts) |
| 导航标题 fallback         | [`helpers.ts`](../../frontend/dashboard/src/lib/content-import/threads/docs/analyzer/helpers.ts)                |
| 目标 AST H1 消费          | [`publisher.ts`](../../frontend/dashboard/src/lib/content-import/threads/docs/publisher.ts)                     |

## 8. 测试要求

共享测试至少覆盖：

- 只有 metadata title。
- 只有前导 H1。
- metadata title 与前导 H1 相同。
- metadata title 与前导 H1 不同。
- 非前导 H1。
- 文件名 fallback。
- ATX、Setext、内联格式 H1。
- YAML frontmatter 的 LF、CRLF 和 BOM。
- MDX static title / metadata / frontmatter export。
- 注释或 static ESM 位于 H1 之前。
- 导航标签与可见标题不同。
- 真实 Markdown 反序列化后只消费被提升的 H1，保留正文中的其他 heading。
