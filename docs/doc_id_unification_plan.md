# Doc ID 统一重构方案

---

## 一、问题

### 1. `workspace` 命名不对

`ArticleWorkspace` 在业界（Notion/Slack/Linear）代表组织级的容器，用在单篇文档编辑区 scope 不对。

### 2. ID 体系分裂

同一个 doc 在生命周期不同阶段被多套 ID 引用，心智模型割裂：

```
draft 阶段:       ArticleWorkspace.id         (workspace_id  →  对外引用用这个)
                  ArticleWorkspace.article_id (nil，未发布)
published 阶段:   docs.id                      (doc_id  →  对外引用换这个)
                  ArticleWorkspace.article_id  (link back 到 docs.id)
历史:             ArticleSnapshot.workspace_id (draft snapshot)
                  ArticleSnapshot.article_id   (public snapshot)
树节点:           DocTreeNode.workspace_id     (draft node 引用)
                  DocTreeNode.doc_id           (public node 引用)
```

一个 doc 在系统里有 3 个身份（`workspace_id`、`doc_id`、`article_id`），5 个 FK 字段引用它，前端需要根据 `stage` 切换用哪个 ID。

### 3. 不必要的桥接

publish 流程需要在 `ArticleWorkspace` 和 `docs` 之间做 link back（`article_id` 字段），纯粹是因为两张表分了家。

---

## 二、讨论过程

### 最初方案：改名

把 `ArticleVersion` → `ArticleWorkspace`、`ArticleRevision` → `ArticleSnapshot` 等。名字改干净了，但 ID 体系分裂的根本问题没解决。

### 轮次 1：前端 URL 的困惑

dashboard 编辑器 URL 用 `workspaceId`，public 端用 `docId`——两个 ID 指向同一个 doc，只是阶段不同。

### 轮次 2：回到 `docId`

用户分析：本质上就是一个 doc 的不同阶段。用 `docId` 贯穿全链路是最自然的。

### 轮次 3：`docs` 表统一

讨论 `ArticleWorkspace` 是否可以并入 `docs`，用 `stage` 区分 draft/public。

### 轮次 4：单行 vs 双行

尝试单行模型（同一行改 `stage`），但遇到「编辑已发布 doc」的矛盾：
新内容不能泄露给 public，旧内容还要继续 serve——单行做不到。

最终定案 **双行模型**：draft 和 public 共享同一个 `doc_id`，但各有自己的行。编辑已发布 doc 时插入新 draft 行，public 行不动。

### 最终方案

`ArticleWorkspace` 表删除，draft 行也进 `docs` 表，用 `doc_id` 把同一个 doc 的 draft 和 public 两行绑在一起。`docs` 成为唯一内容锚点。

---

## 三、核心 invariant

> `docs` 是 doc 内容锚点。同一个 doc 最多两行：一行 `stage=draft`（编辑态），一行 `stage=public`（线上态）。两行共享同一个 `doc_id`。

```
                                     doc_id = 42
                     ┌───────────────────┴───────────────────┐
                     ▼                                       ▼
            docs(id=99, doc_id=42,                    docs(id=23, doc_id=42,
              stage=draft)                              stage=public)
             "正在编辑的版本"                           "线上版本"
                     │                                       │
                     └───────────────┬───────────────────────┘
                                     │ checkpoint / publish
                                     ▼
                             ArticleSnapshot(doc_id=42)
                               ├─ stage=draft
                               └─ stage=public
```

### 生命周期

```
新 draft:             INSERT docs(stage=draft, doc_id=42)
                      → docs(id=5, doc_id=42)
publish:              UPDATE docs SET stage='public' WHERE id=5
                      → docs(id=5, doc_id=42, stage=public)   ← draft 直接变 public
编辑已发布 doc:        INSERT docs(stage=draft, doc_id=42)
                      → docs(id=99, doc_id=42, stage=draft)   ← 新 draft 行，同 doc_id
                      → docs(id=5, doc_id=42, stage=public)   ← public 行不动
再次 publish:          UPDATE docs SET (content) WHERE id=5   ← 内容写回 public 行
                      DELETE FROM docs WHERE id=99             ← 删掉 draft 行
```

### 读路径

```
Dashboard editor:   docs WHERE doc_id=42 AND stage='draft'   ← 编辑用 draft 行
Public site:        docs WHERE doc_id=42 AND stage='public'  ← 线上读 public 行
```

不需要切到 snapshot 做 public serve——`docs(stage=public)` 始终稳定。

---

## 四、FK 统一

所有引用统一为 `doc_id` → `docs.doc_id`（不是 `docs.id`）：

```
docs:
  id          PK (自增行号，内部使用)
  doc_id      稳定标识（业务层标识，同 doc 的 draft/public 行共享）
  stage       draft | public
  inner_id    (跨 thread 通用标识，不变)
  ...
```

| 表                 | 旧 FK                         | 新 FK    | 说明           |
| ------------------ | ----------------------------- | -------- | -------------- |
| `DocTreeNode`      | `workspace_id` + `doc_id`     | `doc_id` | 统一一个 FK    |
| `ArticleSnapshot`  | `workspace_id` + `article_id` | `doc_id` | 统一一个 FK    |
| `DocTreeEvent`     | `workspace_id`                | `doc_id` | 事件绑定的 doc |
| `DocTreeTrashItem` | `workspace_id`                | `doc_id` | 垃圾箱         |
| `DocDocument`      | `doc_id`（不变）              | `doc_id` | 不变           |

### 删除

| 删除                            | 原因                                |
| ------------------------------- | ----------------------------------- |
| `ArticleWorkspace` 表           | draft 行进 `docs`                   |
| `ArticleWorkspace.article_id`   | 不需要 link back——两行共享 `doc_id` |
| `DocTreeNode.workspace_id`      | 统一为 `doc_id`                     |
| R4（GQL `doc_id` 拆分）         | 只有一个 `docId`                    |
| `ensure_page_article_workspace` | → `ensure_doc_draft`                |
| `normalize_workspace_id` bridge | 前端直接传 `docId`                  |

### 不变的

| 模块 / 表                      | 说明                                             |
| ------------------------------ | ------------------------------------------------ |
| `DocTreeNode`（树结构、stage） | 结构不变，只 FK 统一                             |
| `DocTreeEvent`（事件系统）     | 逻辑不变                                         |
| `DocTreeSnapshot`              | 完全不变                                         |
| `PublishRelease`               | 完全不变                                         |
| `ArticleSnapshot`              | 逻辑不变                                         |
| `DocDocument`                  | 完全不变                                         |
| `DocsSiteState`                | 完全不变                                         |
| diff 逻辑                      | 源从 `ArticleWorkspace` 换成 `docs(stage=draft)` |
| 跨 thread 通用逻辑             | 继续走 `inner_id`                                |

### FK 约束说明

`docs.doc_id` 不是 unique（draft + public 两行共享同一个值），PostgreSQL FK 必须引用 unique 列。因此其他表的 `doc_id` 列不建传统 FK constraint——用 index + sequence + service 层原子分配保证完整性。

---

## 五、实现细节

### draft 创建

```sql
INSERT INTO docs (doc_id, inner_id, community_id, thread, stage, ...)
VALUES (42, 42, 1, 'doc', 'draft', ...)
-- → id=5, doc_id=42, stage=draft
--   doc_id 从序列生成，id 自增 PK
```

### publish 流程

```
改前:
  ArticleWorkspace(draft) → upsert docs(public) → link back article_id
  → snapshot → release

改后:
  新 draft 第一次发布:
    UPDATE docs SET stage='public' WHERE id=5
    → ArticleSnapshot(stage=public, doc_id=42)
    → PublishRelease

  编辑已发布 doc 再次发布:
    UPDATE docs SET (title, slug, ...) WHERE doc_id=42 AND stage='public'
    (用 draft 行内容覆盖 public 行)
    DELETE FROM docs WHERE id=99   ← 删掉 draft 行
    → ArticleSnapshot(stage=public, doc_id=42)
    → PublishRelease
```

### public 读路径

```
public site → docs WHERE doc_id=42 AND stage='public'
```

不切到 snapshot——`docs(stage=public)` 始终是稳定线上版本。

### diff 逻辑

```
ArticleWorkspace(draft)  ↔  latest ArticleSnapshot(public)   ← 改前
docs(stage=draft)        ↔  latest ArticleSnapshot(public)   ← 改后
```

### revision / snapshot

```
checkpoint  → ArticleSnapshot(stage=draft, doc_id=42)
publish     → ArticleSnapshot(stage=public, doc_id=42)
```

### slug 唯一约束

```sql
CREATE UNIQUE INDEX docs_published_slug_idx
  ON docs (slug)
  WHERE stage = 'public';
```

### 前端影响

| 位置              | 旧                      | 新           |
| ----------------- | ----------------------- | ------------ |
| GQL `DocTreeNode` | `workspaceId` + `docId` | `docId`      |
| URL query param   | `workspaceId`           | `docId`      |
| SSR helper        | `workspaceId` 参数      | `docId` 参数 |
| SideTree useLogic | `workspaceId`           | `docId`      |

### 不需要的

- `article_id` 桥接字段——`doc_id` 统一
- R4（GQL `doc_id` 拆分）——只有一个 `docId`
- `normalize_workspace_id` bridge
- `DOC_EDITOR_QUERY_PARAM.WORKSPACE_ID` → `DOC_EDITOR_QUERY_PARAM.DOC_ID`

---

## 六、branch / version 扩展

```
docs(doc_id=42, stage=public, branch=nil, version="v2")
docs(doc_id=42, stage=draft, branch="feat-x", version=nil)
```

唯一键：`(doc_id, stage, branch, version)`。主分支 `branch=nil, version=nil` 是默认态。

---

## 七、场景覆盖

| 场景                  | 处理                                                     | 风险                                           |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| 新建 doc → publish    | 一行 `UPDATE stage='public'`                             | 无                                             |
| 编辑已发布 doc        | 新 draft 行 + 旧 public 行，共享 `doc_id`                | 无                                             |
| 删除 draft            | `DELETE` 行。有 snapshot 兜底                            | 无                                             |
| 删除 public doc       | 树 event 处理可见性，docs 行可选软删                     | 和旧行为一致                                   |
| restore from snapshot | 覆盖 draft 行内容                                        | 无                                             |
| 多人并发创建          | PG sequence 保证 `doc_id` 唯一                           | 无                                             |
| tree diff             | draft node 树 ↔ `DocTreeSnapshot.tree_json`，不涉及 docs | 无                                             |
| branch preview        | row: `(doc_id, stage=public, branch="feat-x")`           | 无                                             |
| v1/v2 版本共存        | row: `(doc_id, stage=public, version="v1")`              | 唯一键 `(doc_id, stage, branch, version)` 保证 |

---

## 八、执行计划

### Phase 1: Model & DB

1. `docs` 表加 `doc_id`、`stage` 列（`:draft | :public`）
2. 迁移：`DocTreeNode.workspace_id` → `doc_id`
3. 迁移：`ArticleSnapshot.workspace_id` + `article_id` → `doc_id`
4. 迁移：`DocTreeEvent.workspace_id` → `doc_id`
5. 迁移：`DocTreeTrashItem.workspace_id` → `doc_id`
6. Slug 约束改为 `WHERE stage = 'public'`
7. 删除 `article_workspaces` 表和所有相关约束

### Phase 2: Business Logic

1. `Articles.Draft` → 写 `docs` 表（`stage=draft`，分配新 `doc_id`）
2. `Articles.Draft.publish` → 新 draft：`UPDATE stage='public'`；已有 public：覆盖 public 行 + 删 draft 行
3. `Articles.Snapshot` → FK 从 `workspace_id` + `article_id` 换 `doc_id`
4. `DocTree.Read` → `to_map` 只用 `doc_id`
5. `DocTree.Write` → `ensure_doc_draft` 取代 `ensure_page_article_workspace`
6. `ChangeDetection` → draft 参数从 `ArticleWorkspace` 换 `Doc`

### Phase 3: GQL & Frontend

1. GQL `DocTreeNode`：删 `workspaceId`，保留 `docId`
2. GQL `ArticleSnapshot`：`workspace_id` → `doc_id`
3. GQL query / mutation args 跟进
4. Frontend `schema.ts` 跟进
5. Frontend `spec.d.ts` DTO 跟进
6. URL query param `workspaceId` → `docId`
7. SSR helper 跟进
