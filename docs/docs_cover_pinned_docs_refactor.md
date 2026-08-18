# Docs Cover：Pinned Docs 重构任务说明

> 产品规则、领域模型、数据结构、Thumbnail 派生与实施验收

## 结论

当前后端已经存在 pinned item 的数据骨架，但产品功能尚未闭环。

本次不考虑兼容，直接完成以下收敛：

- `pinnedItems` 改为 `pinnedDocs`。
- `doc_cover_pinned_items` 改为 `doc_cover_pinned_docs`。
- Pinned Doc 的 `ui_config` 改为 `appearance`。
- `DocCover` 最终由 `pinnedDocs` 和 `groups` 构成。
- 补齐前端展示、添加、移除、排序和单卡背景编辑。
- 为 Published Article Document 派生轻量 `thumbnail`，用于正文缩略展示。

Cover 是文档树之上的展示编排层。Pin 到 Cover 不改变 `tabs → groups → docs` 的真实内容结构，也不改变文档在所属 Group 中的位置。

## 1. 目标与范围

在 Docs Cover 顶部增加可横向滚动的一行 Pinned Docs。

每篇已置顶文档以独立卡片展示，并且：

- 可以单独编辑背景。
- 背景支持独立的 Light/Dark 配置。
- 正文区域使用 Published Article Document 派生的轻量 Thumbnail 结构渲染。
- Thumbnail 可以实时适配 Light/Dark、Theme Preset 和可变 Page Background。

### 本次包含

- Pinned Docs 顶部单行横向展示。
- Pinned Docs 拖动排序。
- 每张 Pinned Doc Card 独立背景编辑。
- 文档菜单中的“置顶到封面 / 取消封面置顶”。
- Cover 编辑页中的 Add Drawer。
- Drawer 列出全部文档，并解释不可选状态。
- 数据、Ecto、GraphQL 和前端类型全量切换为 `pinnedDocs`。
- Published Article Document 的 `thumbnail` 派生模型。
- 轻量 `ContentThumbnail` DOM Renderer。

### 本次不包含

- 不限制 Pinned Docs 数量。
- 不实现“只有一篇时展示宽卡片”等特殊布局。
- 不使用 Canvas 渲染 Thumbnail。
- 不使用正文截图作为主要方案。
- 不保留旧字段、旧 GraphQL 名称或兼容层。
- 不增加单个 Group 独立 Layout；Doc Covers Layout 继续作为 Cover 级全局设置作用于所有 Group。
- 不处理 Docs 文档跨 Community 迁移及其 Cover Relation 迁移。

## 2. 当前实现判断

| 能力                         | 当前状态   | 本次处理                                  |
| ---------------------------- | ---------- | ----------------------------------------- |
| `doc_cover_pinned_items` 表  | 已有       | 改名为 `doc_cover_pinned_docs`            |
| `index`                      | 已有       | 保留并用于排序                            |
| `ui_config`                  | 已有       | 改为 `appearance`                         |
| 后端 pin / unpin             | 已有       | 按 Doc 语义改名并加强校验                 |
| Cover 查询返回 `pinnedItems` | 已有       | 改为 `pinnedDocs`                         |
| 文档树返回 `pinnedToCover`   | 已有       | 按最终命名检查并保留必要状态              |
| 前端 Layout 渲染 Pinned Docs | 未实现     | 新增 `PinnedDocsRow`                      |
| Pinned Docs 排序             | 未实现     | 新增 `reorderDocCoverPinnedDocs`          |
| Add Drawer                   | 未实现     | 本次补齐                                  |
| 文档菜单 Pin/Unpin           | 未实现     | 本次补齐                                  |
| 单卡背景编辑                 | 仅预留 Map | 定义 `appearance.light/dark` 并接入编辑器 |
| Article Thumbnail            | 未实现     | 发布时派生，前端轻量 DOM 渲染             |

目前 `DocCovers` 顶层虽然向各个 Layout 传入了 `pinnedItems`，但 Layout 实际只渲染 `groups`。

因此当前准确状态是：

> 后端骨架存在，但用户可见的产品功能尚未闭环。

## 3. 最终产品规则

### 3.1 Cover 结构

```text
DocCover
├── pinnedDocs[]   // 顶部单行，超出后横向滚动
└── groups[]       // 已加入 Cover 的 Group
```

Pinned Doc 与 Group 相互独立：

- 文档所属 Group 不需要先加入 Cover。
- 文档被 Pin 到 Cover 后，仍然保留在所属 Group 中。
- Pin 到 Cover 不改变侧边栏顺序或文档归属。

### 3.2 操作文案

| 场景     | 中文         | 英文             |
| -------- | ------------ | ---------------- |
| 未置顶   | 置顶到封面   | Pin to cover     |
| 已置顶   | 取消封面置顶 | Unpin from cover |
| 状态描述 | 已在封面置顶 | Pinned on cover  |

### 3.3 可置顶资格

新增置顶必须同时满足：

```text
存在 Published Version
AND
当前 Draft 与 Published 完全一致
```

| 文档状态             | Drawer                      | 文档菜单           |
| -------------------- | --------------------------- | ------------------ |
| 从未发布             | 显示；Disabled；Draft Badge | 不显示置顶操作     |
| 已发布且无改动       | 显示；可选                  | 显示“置顶到封面”   |
| 已发布但有未发布改动 | 显示；Disabled；Draft Badge | 不显示新增置顶     |
| 已置顶且无改动       | 显示；已选中，可取消        | 显示“取消封面置顶” |
| 已置顶后产生改动     | 显示；保持已选中，可取消    | 仍允许取消置顶     |

补充规则：

- 前端资格判断用于交互反馈。
- 后端必须再次校验，不能只依赖前端隐藏或 Disabled。
- Pinned Card 始终展示 Published 内容，不展示 Draft 内容。
- 已置顶文档产生 Draft 改动后，现有 Pinned Card 不自动移除。

## 4. 数据模型重构

### 4.1 Pinned Doc

最终表结构：

```text
doc_cover_pinned_docs
- community_id
- node_id          // Published Page Node
- index
- appearance       // 当前 Pinned Card 独有
- inserted_at
- updated_at
```

约束：

```text
unique(community_id, node_id)
index >= 0
```

每条记录对应一张 Pinned Card，因此每张卡片都拥有独立的 `appearance`，不是整行 Pinned Docs 共享配置。

### 4.2 Appearance

```ts
type TPinnedDocAppearance = {
  light: Partial<TBgConfig>
  dark: Partial<TBgConfig>
}
```

技术边界：

- 底层完整复用 Wallpaper 背景引擎。
- 数据契约复用 `TBgConfig`。
- 背景 Renderer 复用现有背景渲染能力。
- Pinned Card 编辑器只开放适合卡片的能力。

首期 UI 建议开放：

- 纯色
- 渐变
- 图片
- 图片位置
- 图片缩放
- Light/Dark 分别编辑

Pattern、Texture 等能力可以保留在底层契约中，但不要求首期全部暴露在 UI。

### 4.3 Group

本次不增加单个 Group 的 `layout` 或 `appearance`。

当前 Doc Covers Layout 是 Cover 级全局设置，对所有 Group 生效。单个 Group 独立选择 Layout 属于另一项产品能力，暂不进入本次重构。

因此本次保持 `doc_cover_groups` 的现有职责：

```text
doc_cover_groups
- community_id
- group_id
- index
```

不新增 `layout` 列，也不把 Group 配置改名为 `appearance`。

## 5. Article Document Thumbnail

### 5.1 定义

`thumbnail` 不是：

- 截图
- 图片 URL
- Canvas 结果
- 完整 Article Document AST

它是从 Published Article Document 派生出来的简化正文结构，本质上与 TOC 同属派生数据：

```text
Article Document AST
├── toc         // 标题层级与锚点
└── thumbnail   // 卡片缩略展示所需的简化结构
```

### 5.2 存储位置

`thumbnail` 存在 `article_documents`，与 `json`、`markdown_toc`、`html` 等派生表达位于同一模型：

这里的 `Doc` 与 `ArticleDocument` 是两个独立的 Ecto Schema，对应两张独立表，不是同一张表的不同命名：

```text
CMS.Model.Doc
└── schema "docs"

CMS.Model.ArticleDocument
└── schema "article_documents"
```

`docs` 保存文章实体、版本坐标和元数据；`article_documents` 保存正文及其派生表达。因此 `thumbnail` 应新增在 `CMS.Model.ArticleDocument`，不是 `CMS.Model.Doc`。

```text
article_documents
├── json
├── markdown_toc
├── thumbnail
├── html
└── content_hash
```

数据库字段：

```elixir
# backend/main/lib/groupher_server/cms/model/article_document.ex
schema "article_documents" do
  # existing document representations...
  field(:thumbnail, :map)
end
```

只给 Published Article Document 生成和读取 Thumbnail。发布管线在创建或更新 Public Doc 对应的 `ArticleDocument` 时计算并写入 `thumbnail`；Draft 内容发生变化不会覆盖当前 Public Thumbnail。

不选择其他存储位置：

- 不放在 `docs`：Thumbnail 是 Article Document 的派生结构，不是 Doc 元数据。
- 不放在 `doc_snapshots`：Snapshot 是不可变历史检查点，不是公开页面当前读取模型。
- 不建立独立表：当前没有独立生命周期、多尺寸或异步资产状态，单独建表会增加无必要的关联复杂度。

### 5.3 数据模型

```ts
type TArticleThumbnail = {
  version: number
  blocks: readonly TThumbnailBlock[]
}

type TThumbnailBlock =
  | {
      type: 'heading'
      level: 1 | 2 | 3
      text: string
    }
  | {
      type: 'paragraph'
      text: string
    }
  | {
      type: 'list'
      items: string[]
    }
  | {
      type: 'image'
      url: string
      aspectRatio?: number
    }
  | {
      type: 'callout'
      text: string
    }
  | {
      type: 'table'
      rows: number
      columns: number
    }
  | {
      type: 'code'
      lines: string[]
    }
```

### 5.4 派生规则

在发布管线中，从规范化后的 Published Article Document 计算 `thumbnail`：

```text
Published Article Document
        ↓
Thumbnail Compiler
        ↓
TArticleThumbnail
```

Compiler 负责：

- 限制 Block 数量。
- 限制段落和标题文本长度。
- 过滤编辑器专用信息。
- 将复杂交互 Block 降级成静态摘要或占位。
- 只保留缩略展示所需的信息。

建议的 Block 降级规则：

| 正文 Block     | Thumbnail 表现   |
| -------------- | ---------------- |
| Heading        | 小标题           |
| Paragraph      | 截断后的文本     |
| List           | 限制数量的列表项 |
| Image          | 真实图片缩略图   |
| Callout        | 简化 Callout     |
| Table          | 简化表格轮廓     |
| Code           | 限制行数的代码   |
| Video          | 静态封面或占位   |
| Embed          | 静态占位         |
| 复杂交互 Block | 摘要或忽略       |

### 5.5 前端渲染

`ContentThumbnail` 使用轻量 DOM 渲染 `thumbnail`，不加载完整编辑器运行时。

```text
ArticleDocument
└── ContentThumbnail
```

它只负责：

- Thumbnail Block 的 DOM 渲染。
- 固定缩略区域。
- 内容裁切。
- 图片展示。
- 使用 Theme Token 着色。

它不负责：

- Cover
- Pin/Unpin
- 排序
- 卡片背景
- 文档编辑
- 复杂 Block 交互

Thumbnail 容器保持透明，使用当前 Theme Token：

```css
color: var(--text-title);
background: transparent;
border-color: var(--border-divider);
```

因此以下变化不需要重新生成 Thumbnail：

- Light/Dark 切换
- Theme Preset 变化
- Page Background 变化
- Pinned Card Appearance 变化

### 5.6 Pinned Card 组合

```text
PinnedDocCard
├── BackgroundRenderer
│   └── appearance.light/dark
├── Title / Author
└── ContentThumbnail
    └── Published Article Document.thumbnail
```

数据归属：

```text
Pinned Doc Relation
└── appearance

Article Document
└── thumbnail
```

## 6. GraphQL 与领域接口

### 6.1 查询结构

```graphql
type DocCover {
  groups: [DocCoverGroup!]!
  pinnedDocs: [DocCoverPinnedDoc!]!
}

type DocCoverPinnedDoc {
  nodeId: ID!
  index: Int!
  appearance: Json!
  doc: Doc!
}

type ArticleDocument {
  thumbnail: ArticleThumbnail
}
```

GraphQL 面向前端只暴露公共 Ref/Node Identifier，不暴露内部数据库 ID。

`Doc.document: ArticleDocument` 当前已经由 `general_article_fields()` 暴露，并使用现有 `dataloader(CMS, :document)` 解析。本次不新增或重复实现 `Doc.document`；只需要：

- 在 `ArticleDocument` GraphQL Type 增加 `thumbnail` 字段。
- 让 `DocCoverPinnedDoc.doc` 返回对应的 Public `Doc`。
- 继续通过现有 `Doc.document` Dataloader 读取 `ArticleDocument`。

解析链：

```text
DocCoverPinnedDoc
→ Public DocTreeNode.doc_id / article_hash_id
→ Public Doc
→ Doc.document
→ ArticleDocument.thumbnail
```

Cover Read 应继续批量查询 Public Docs，并将对应的 `Doc` 放进 Pinned Doc 读取模型；前端通过 `doc.document.thumbnail` 读取 Thumbnail。`Doc.document` 复用现有 Dataloader，避免为每张卡片执行独立查询。

前端查询示例：

```graphql
pinnedDocs {
  nodeId
  index
  appearance
  doc {
    title
    author {
      avatar
      nickname
    }
    document {
      thumbnail
    }
  }
}
```

### 6.2 Mutation

#### Pin

```graphql
pinDocToCover(
  community: String!
  nodeId: ID!
): DocCoverPinnedDoc!
```

职责：

- 校验文档存在 Published Version。
- 先检查是否已经 Pinned；如果是，直接返回已有关系，保证幂等。
- 只有准备创建新关系时，才校验当前没有未发布改动。
- 将文档追加到 `pinnedDocs` 末尾。

#### Unpin

```graphql
unpinDocFromCover(
  community: String!
  nodeId: ID!
): DocCoverPinnedDoc!
```

#### Reorder

```graphql
reorderDocCoverPinnedDocs(
  community: String!
  nodeIds: [ID!]!
): DoneState!
```

用于在 Cover 编辑页调整 Pinned Docs 顺序。

后端按 `nodeIds` 的完整顺序重写 `index`，并校验：

- 不存在重复 Node。
- 所有 Node 都属于当前 Community 的 Pinned Docs。
- 请求集合与当前集合一致。
- 整次重排在一个事务内完成。

Index 策略：

```text
Reorder: 0, 1, 2, ...
New Pin: max(index) + 1
Read: ORDER BY index ASC, id ASC
```

`max(index) + 1` 与 Reorder 后的连续 Index 不冲突。并发 Pin 可能得到相同 Index，因此读取时必须使用 `id` 作为稳定的第二排序条件；第一阶段不为 `(community_id, index)` 增加唯一约束，避免 Reorder 更新过程产生中间值冲突。

#### Update Appearance

```graphql
updatePinnedDocAppearance(
  community: String!
  nodeId: ID!
  appearance: Json!
): DocCoverPinnedDoc!
```

只更新当前这一张 Pinned Card 的 Appearance。

## 7. 前端交互

### 7.1 PinnedDocsRow

```text
PinnedDocsRow
├── PinnedDocCard
├── PinnedDocCard
├── PinnedDocCard
└── Add Button
```

布局规则：

- 固定单行。
- 卡片宽度稳定。
- 不限制数量。
- 超出容器后横向滚动。
- 桌面支持触控板横滑。
- 可以提供左右导航按钮。
- 编辑态支持拖动排序。

每张卡片拥有独立设置入口：

- 编辑背景。
- 取消封面置顶。

### 7.2 Add Drawer

点击 Pinned Docs 区域的 Add 按钮，打开右侧 Drawer。

Drawer 结构：

```text
Pin docs to cover

[ Search all documents... ]

Published
○ Introduction
  Basics

Draft
○ Installation                  [Draft]
  Not published

Changed
○ API Reference                 [Draft]
  Unpublished changes

Pinned
● Authentication               [Pinned]
```

规则：

- 列出全部文档，不隐藏 Draft 或 Dirty Published 文档。
- 顶部搜索框匹配全部文档标题。
- 显示 Tab / Group 路径，解决同名文档问题。
- 从未发布的文档 Disabled，并显示 Draft Badge。
- 有未发布改动的文档 Disabled，并显示 Draft Badge。
- Disabled 项显示具体原因：`Not published` 或 `Unpublished changes`。
- 已置顶文档保持选中状态，可以取消。

### 7.3 文档菜单

```text
Doc ···
├── Rename
├── Move
├── Pin to cover
└── Delete
```

状态切换后：

```text
Doc ···
├── Rename
├── Move
├── Unpin from cover
└── Delete
```

### 7.4 Appearance Editor

复用 Wallpaper 的：

- `TBgConfig`
- 背景 Renderer
- 颜色、渐变和图片能力
- ThemeSwitch

但使用 Pinned Card 专用编辑面板，只开放首期所需能力。

Light/Dark 分别编辑，保存时整体更新当前 Pinned Doc 的：

```text
appearance.light
appearance.dark
```

## 8. 命名重构

不保留兼容层，直接全量改名。

| 当前名称                       | 最终名称                    |
| ------------------------------ | --------------------------- |
| `doc_cover_pinned_items`       | `doc_cover_pinned_docs`     |
| `DocCoverPinnedItem`           | `DocCoverPinnedDoc`         |
| `pinned_items`                 | `pinned_docs`               |
| `pinnedItems`                  | `pinnedDocs`                |
| `pin_item`                     | `pin_doc`                   |
| `unpin_item`                   | `unpin_doc`                 |
| `pinDocCoverItem`              | `pinDocToCover`             |
| `unpinDocCoverItem`            | `unpinDocFromCover`         |
| `updateDocCoverPinnedUiConfig` | `updatePinnedDocAppearance` |
| Pinned Doc `ui_config`         | `appearance`                |

## 9. 实施任务拆分

### Task 1：数据库与 Ecto

- [ ] 将 `doc_cover_pinned_items` 改为 `doc_cover_pinned_docs`。
- [ ] 将 `DocCoverPinnedItem` 改为 `DocCoverPinnedDoc`。
- [ ] 将 Pinned Doc 的 `ui_config` 改为 `appearance`。
- [ ] 定义 `appearance` 默认值。
- [ ] 在 `article_documents` 增加 `thumbnail :map`。
- [ ] 删除旧迁移中不再需要的兼容逻辑。
- [ ] 保留并验证唯一约束与索引。

### Task 2：后端领域层

- [ ] 将 `pin_item` / `unpin_item` 改为 Doc 语义命名。
- [ ] 增加 Clean Published 校验。
- [ ] 实现 `reorderDocCoverPinnedDocs`。
- [ ] 实现 `updatePinnedDocAppearance`。
- [ ] 保证重复 Pin 先返回已有关系，再对新建关系执行 Clean Published 校验。
- [ ] Reorder 校验完整集合并在事务中重写 Index。
- [ ] 新增 Pin 使用 `max(index) + 1`，读取使用 `index ASC, id ASC`。
- [ ] 验证删除、移动、取消发布等边界场景。

### Task 3：GraphQL

- [ ] `pinnedItems` 改为 `pinnedDocs`。
- [ ] `uiConfig` 改为 `appearance`。
- [ ] `DocCoverPinnedDoc` 返回 `doc: Doc!`，不直接返回 `document: ArticleDocument!`。
- [ ] Cover Read 批量挂载 Public Doc，并复用已经存在的 `Doc.document` Dataloader；不新增重复 Resolver。
- [ ] 只在现有 `ArticleDocument` GraphQL Type 增加 `thumbnail` 字段。
- [ ] 更新 GraphQL Types。
- [ ] 更新 Query。
- [ ] 更新 Mutation。
- [ ] 更新 Resolver。
- [ ] 更新前端 Schema。
- [ ] 清理旧名称。

### Task 4：Thumbnail Pipeline

- [ ] 定义 `TArticleThumbnail`。
- [ ] 定义 `TThumbnailBlock`。
- [ ] 实现 Thumbnail Compiler。
- [ ] 接入 Published Article Document 发布管线。
- [ ] 将编译结果写入 Public `article_documents.thumbnail`。
- [ ] Draft 改动不得覆盖当前 Public Thumbnail。
- [ ] 限制 Block 数量和文本长度。
- [ ] 定义复杂 Block 降级规则。
- [ ] 增加 Compiler 单元测试。

### Task 5：ContentThumbnail

- [ ] 在 Article Document 领域下新增 `ContentThumbnail`。
- [ ] 使用轻量 DOM Renderer。
- [ ] 不初始化完整编辑器运行时。
- [ ] 使用当前 Theme Token。
- [ ] 保持背景透明。
- [ ] 支持固定区域裁切。
- [ ] 支持图片和复杂 Block Fallback。

### Task 6：Cover UI

- [ ] 新增 `PinnedDocsRow`。
- [ ] 新增 `PinnedDocCard`。
- [ ] 接入各个 Cover Layout 顶部。
- [ ] 实现单行横向滚动。
- [ ] 实现编辑态拖动排序。
- [ ] 接入 Pin/Unpin Mutation。

### Task 7：管理交互

- [ ] 增加文档菜单“置顶到封面 / 取消封面置顶”。
- [ ] 实现 Add Drawer。
- [ ] Drawer 列出全部文档。
- [ ] 实现搜索。
- [ ] 显示 Tab / Group 路径。
- [ ] 实现 Disabled Draft 状态。
- [ ] 显示 Draft Badge 和具体原因。

### Task 8：Appearance Editor

- [ ] 复用 Wallpaper 背景数据契约。
- [ ] 复用 Background Renderer。
- [ ] 使用 Pinned Card 专用编辑面板。
- [ ] 实现 Light/Dark 分别编辑。
- [ ] 每张卡片独立保存 Appearance。

### Task 9：清理

- [ ] 删除 `pinnedItem` / `pinnedItems` 旧命名。
- [ ] 删除 `doc_cover_pinned_items` 旧表和模型引用。
- [ ] 删除 Pinned Doc 的 `ui_config` / `uiConfig`。
- [ ] 删除旧 GraphQL Mutation。
- [ ] 删除旧类型和测试 Fixture。
- [ ] 不增加兼容 Adapter。

## 10. 验收标准

- [ ] Cover 顶部正确展示任意数量 Pinned Docs。
- [ ] Pinned Docs 始终保持单行。
- [ ] 超出容器后可以横向浏览。
- [ ] 每张 Pinned Card 可以分别保存和渲染 Light/Dark Appearance。
- [ ] 切换站点主题后，Thumbnail 立即适配。
- [ ] 切换 Theme Preset 后，Thumbnail 立即适配。
- [ ] 修改 Page Background 或 Card Background 后不需要重新生成 Thumbnail。
- [ ] 只有已发布且无未发布改动的文档可以新增置顶。
- [ ] 后端资格校验不能被绕过。
- [ ] Drawer 可以搜索全部文档。
- [ ] 不可置顶文档保持可见、Disabled，并显示 Draft Badge 和原因。
- [ ] 已置顶文档产生新 Draft 后，仍展示 Published 内容。
- [ ] 已置顶文档产生新 Draft 后，仍可以取消置顶。
- [ ] Pinned Docs 拖动排序后刷新顺序保持一致。
- [ ] Reorder 请求具有幂等性并拒绝非法集合。
- [ ] Reorder 在事务中按完整集合重写 `0..n-1`。
- [ ] 新增 Pin 追加到当前最大 Index 后，稳定读取顺序为 `index, id`。
- [ ] 文档所属 Group 未加入 Cover 时，文档仍可以独立置顶。
- [ ] 文档移动到另一个 Group 并发布后，Pin 关系保持不变。
- [ ] 删除 Public DocTreeNode 后，Pinned Doc 关系通过外键级联删除。
- [ ] Thumbnail 存在 Public `article_documents.thumbnail`，不写入 `docs` 或 Snapshot。
- [ ] Thumbnail 页面不初始化完整编辑器运行时。
- [ ] 旧 `pinnedItems`、`doc_cover_pinned_items`、Pinned Doc `ui_config` 命名完全清除。

## 11. 建议验证

### 后端

- Pin / Unpin / Reorder / Appearance 测试。
- 从未发布文档校验。
- Dirty Published 文档校验。
- 重复 Pin 幂等性。
- 删除、移动、取消发布场景。
- 删除 Public Node 后 Pinned Relation 的外键级联。
- 文档跨 Group 移动并发布后保持 Pin。
- Group 未加入 Cover 时独立 Pin 文档。

### GraphQL

- 验证 Query 和 Mutation 最终命名。
- 确认前端契约不暴露数据库 ID。
- 确认 `pinnedDocs` 顺序稳定。
- 确认 `PinnedDoc.doc → Doc.document → ArticleDocument.thumbnail` 使用批量读取和现有 Dataloader，不产生 N+1。

### 前端

- Focused Type Check。
- Thumbnail Compiler 和 Renderer 测试。
- Drawer 搜索和 Disabled 状态测试。
- 拖动排序测试。
- Appearance Light/Dark 切换测试。

### 视觉验证

使用 `/home/xx` 社区验证：

- Light/Dark。
- 不同 Theme Preset。
- 不同 Page Background。
- 不同 Pinned Card Appearance。
- 多张卡片横向溢出。
- Thumbnail 中的 Heading、Paragraph、List、Image、Callout、Table 和 Code。

## 最终边界

```text
Pinned Doc Relation
├── node
├── index
└── appearance

Article Document
└── thumbnail       // stored in article_documents.thumbnail

Doc Cover
├── pinnedDocs
├── groups
└── layout          // Cover 级全局设置，不是单 Group Layout
```

Pinned Doc 关系只拥有排序和卡片 Appearance；Article Document 拥有可复用 Thumbnail；Cover 负责组合展示，但不拥有正文内容。
