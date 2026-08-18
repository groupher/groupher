# 文章版本控制架构

> 状态：已被 [Gate V3](./community/gate_v3.md) 取代。
>
> 本文仅保留历史方案背景，不再作为当前 Article / Doc Versioning 的实现或验收依据。当前普通 Article 只使用 Article Core 的 Draft/Public；Branch、DocSnapshot、Doc Tree 和 Release 仅属于 Doc。

> 历史状态：本文方案曾被接受实施，后续已由 Gate V3 重新划分 Article Core 与 Doc 专属能力。

## 1. 目标

为每个文章线程提供一个共享基础：

- 稳定的逻辑同一性；
- 草稿和公开内容；
- 预览分支；
- 不可变的快照和修订历史记录；
- 差异和恢复；
- 文章级时间机器；
- 产品扩展，例如文档树和全站点文档版本。

基金会不得合并产品领域。`Post`,`Blog`,
`Changelog`和`Doc`保留自己的表、API、权限、字段和
公布副作用。

## 2. 非目标

- 不要引入`ArticleWorkspace`表。
- 不要将所有文章产品合并到一个内容表中。
- 不要让其他线程强制使用 Tree、Release 或 Docs 站点状态。
- 不要引入事件溯源或保留成对 Diff 结果。
- 不要通过公共 GraphQL 合约公开内部数据库 ID。
- 不要保留运行时兼容性逻辑。现有的本地数据可以迁移
  一旦进入目标模型。

## 3. 术语

| 术语                | 意义                                                        |
| ------------------- | ----------------------------------------------------------- |
| 物理`id`            | 内部行主键。草稿行和公共行具有不同的 id。                   |
| `article_hash_id`   | 跨分支、阶段和修订的一篇逻辑文章的稳定 UUID。               |
| 快照`hash_id`       | 公共 UUID 用于获取、分叉和恢复修订版，而无需公开其物理 ID。 |
| `branch_id`         | 包含当前文章行或快照的分支。                                |
| `stage`             | 当前行角色：`draft`或`public`。                             |
| 快照                | 完整版本化文章状态的不可变存储副本。                        |
| 修订                | 在有序历史时间轴中显示的快照。它不是一个单独的表。          |
| 差异                | 两个当前状态或快照之间的瞬时比较。                          |
| 时间机器            | 快照历史+差异+恢复+分支分叉。它不是一个单独的存储模型。     |
| `DocPublishRelease` | 将文章快照绑定到树快照的纯文档聚合。                        |

`v1`、`v2`和类似标签不是文章字段。唯一的数字文章
历史字段是`ArticleSnapshot.revision_number`。文档版本编号是
单独的仅文档概念。

## 4. 核心不变量

1. `article_hash_id`是一个随机的、稳定的 UUID。它从来不是从内容中衍生出来的。
2. `body_hash`识别一种规范的 BodyBag；`version_hash`识别
   完整的版本化文章状态以及任何版本化字段发生变化时，
   关系，或 BodyBag 内容发生变化。
3. 公共交通只读取`main`分支+`public`阶段。
4. 预览分支仅包含草稿状态。它从不拥有公共文章行。
5. 公开争吵永远不会回到草案。编辑公共内容会创建草稿副本。
6. 第一次发布后，主要的公共物理行是永久运行时锚点。
7. 仅发布版本化字段的副本；它保留公共运行时字段和关系。
8. 文章快照仅供追加。恢复永远不会删除以后的历史记录。
9. 核心生命周期操作始终使用完整坐标：

   ```text
   thread + article_hash_id + branch_id + stage
   ```

10. 分支默认值在产品边界处解决。核心草案、发布、
    快照、差异和恢复函数接收显式分支。
11. 迁移是单向的：将现有数据移动到目标字段并
    表，应用程序代码仅读取和写入新模型。
12. 除了测试模块之外，每个新的或更改的模块都有一个有意义的
    `@moduledoc`;公共职能有`@doc`；生命周期模块包括
    必要的 ASCII 流。
13. 枚举和语义常量是集中的并且跨域连接
    数据库、Ecto、`CMS.Const`、GraphQL 和前端常量/类型。
14. 共享行为在其所属模块中覆盖一次，然后通过
    单独的帖子、博客、变更日志和文档集成测试。等径螺纹
    行为不会合并到一项参数化产品测试中。
15. 一个逻辑文章的每个突变都使用相同的独立于分支的
    生命周期锁：`community + thread + article_hash_id`。跨分行
    升级/分叉必须使用草稿自动保存、快照和发布进行序列化。

## 5. 心智模型

```text
                          official public traffic
                                    |
                                    v
                              main/public
                               ^         |
                      publish |         | start editing
                               |         v
                              main/draft

preview-a/draft -------- promote -------> main/draft

Snapshot ---------------- restore ------> target branch draft
```

箭头表示复制版本化内容。它们并不意味着移动相同的物理实体
分支之间的行或在草稿和公共之间重复更改一行。

此心智模型也出现在共享草稿/预览生命周期模块中
`@moduledoc`图。

## 6. 文章分支

`ArticleBranch`是共享基础设施。它的范围是文章草案状态，没有
拥有任何特定于产品的内容。

```text
ArticleBranch
├─ id
├─ community_id
├─ thread
├─ slug
├─ title
├─ type              main | preview
├─ status            active | archived
├─ source_branch_id  optional
├─ created_by_id
├─ inserted_at
└─ updated_at
```

该字段被命名为`type`，而不是`kind`。

所需的约束：

```text
UNIQUE (community_id, thread, slug)
UNIQUE (community_id, thread) WHERE type = 'main'
```

一个分支属于一个社区和一个文章线程。一个分支可能包含
一篇或多篇已更改的文章。分支创建是惰性的：它不会复制每个分支
社区中的文章。

### 6.1 枚举和常量链

分支类型必须在整个堆栈中一致定义：

```text
Database check constraint
        |
        v
Ecto.Enum
        |
        v
CMS.Const.article_branch_type(...)
        |
        v
GraphQL ArticleBranchType
        |
        v
frontend ARTICLE_BRANCH_TYPE
```

任何业务模块不应包含分散的原始`"main"`或`"preview"`
字符串。

建议值：

```text
Backend atoms:   :main | :preview
Database values: main  | preview
GraphQL values:  MAIN  | PREVIEW
Frontend values: ARTICLE_BRANCH_TYPE.MAIN | ARTICLE_BRANCH_TYPE.PREVIEW
```

相同的全链规则适用于`stage`、分支`status`和 Snapshot
行动。

## 7. 产品文章行

参与生命周期的每个产品表都添加相同的路由字段：

```text
article_hash_id
branch_id
stage             draft | public
```

当前状态示例：

```text
Changelog(article_hash_id=A, branch=main,      stage=public)
Changelog(article_hash_id=A, branch=main,      stage=draft)
Changelog(article_hash_id=A, branch=preview-a, stage=draft)
```

绝对不能有：

```text
Changelog(article_hash_id=A, branch=preview-a, stage=public)
```

行唯一性：

```text
UNIQUE (branch_id, article_hash_id, stage)
```

Branch 服务和产品变更集还必须验证 Branch
与文章模型属于同一社区和线程。

## 8. 田地所有权

文章字段分为四个职责。

### 8.1 路由字段

```text
physical id
article_hash_id
branch_id
stage
```

这些标识一行。它们不会被复制为可编辑内容，并且不会
参与内容差异。

### 8.2 版本化字段

这些字段通过草稿、发布、快照、差异、恢复和升级进行移动。

常见示例：

```text
title
digest
document JSON
link address
cover
tags
```

产品示例：

```text
Doc:       subtitle, slug, template_key
Post:      category, copyright, other publishable configuration
Changelog: copyright, release metadata
Blog:      blog-specific publishable configuration
```

每个产品模型必须显式声明其版本化字段。发布必须
永远不要依赖于复制整个 Ecto 结构。

### 8.3 派生字段

这些是从版本化内容生成的：

```text
markdown
markdown_toc
html
xml
rss
plain_text
body_hash
document asset refs
```

恢复写入版本化源内容并重新运行内容管道。衍生的
字段被重新生成，而不是被视为独立的用户拥有的状态。

### 8.4 运行时字段

这些仅属于官方主/公共运行时行：

```text
inner_id
views
comments
upvotes
collects
reactions
active_at
published counters
runtime moderation and notification state
```

运行时字段不会复制到草稿或预览，也不会从
文章快照，并在重新发布时保留。

### 8.5 场流矩阵

| 运营                 | 路由字段                | 版本化字段            | 派生字段          | 运行时字段           |
| -------------------- | ----------------------- | --------------------- | ----------------- | -------------------- |
| 开始编辑 main/public | 创建主/拔模坐标         | 将公众复制到草稿      | 重新生成/复制缓存 | 请勿复制             |
| 自动保存草稿         | 不变                    | 更新草稿              | 再生              | 未更改/未使用        |
| 第一次主要发布       | 草案首次公开            | 保留草稿值            | 再生              | 初始化公共运行时     |
| 重新发布             | 保留现有的主要/公共坐标 | 草稿覆盖公共          | 重新生成公共缓存  | 维护现有的公共价值观 |
| 创建预览             | 创建预览/草稿坐标       | 复制选定的源快照/公共 | 再生              | 请勿复制             |
| 推广预览             | 创建/更新主/草稿坐标    | 预览草稿覆盖主草稿    | 再生              | 请勿复制             |
| 恢复快照             | 创建/更新目标拔模坐标   | 快照覆盖目标草稿      | 再生              | 请勿复制             |

版本化关系（例如标签和封面）属于其草稿行，而
编辑。发布取代了公共版本关系，而评论，
反应和其他运行时关系保持附加到主/公共行。

## 9. 生命周期流程

### 9.1 新文章

```text
Docs Dashboard                       direct-publish products

create/save                          create Post/Blog/Changelog
    |                                          |
    v                                          v
main/draft                         create main/draft inside transaction
    |                                          |
    | explicit publish                         | publish before commit
    v                                          v
main/public + Snapshot             main/public + Snapshot
```

第一次发布可能会提升第一个草稿行，因为没有运行时公共行
还存在。从那时起，它的物理 ID 就成为永久的
运行时锚点。直接发布命令使用的临时草稿是
内部事务步骤，并且在成功提交后永远无法观察到。

产品 API 使用单独的命令表达意图，而不是接受原始命令
客户端控制的`stage`：

```text
Docs:                  create/update Draft -> publishDocChanges
Post/Blog/Changelog:   createX (publish now) | createXDraft -> publishXDraft
```

内核不会从`thread`推断出这些默认值；产品解析者选择一个
显式共享命令。

### 9.2 编辑和重新发布

```text
main/public
  |
  | copy versioned fields
  v
main/draft -- edit/autosave --> main/draft
  |
  | publish versioned fields
  v
main/public -- preserve runtime fields
  |
  +--> ArticleSnapshot(action=publish)
  +--> delete main/draft and its derived caches/relations
```

### 9.3 预览分支

```text
main/public or selected Snapshot
  |
  | fork versioned fields
  v
preview/draft -- edit/autosave --> preview/draft
```

预览 URL 读取显式预览分支的草稿。预览不创建
公开争吵或引发官方发布副作用。

### 9.4 将预览提升为主

```text
preview/draft
  |
  | promote versioned fields
  v
main/draft
  |
  | explicit official publish
  v
main/public
```

升级永远不会更改预览行的`branch_id`。它复制版本化字段
进入主/草稿，因此正式发布只有一条路径。

如果主/公共在预览分叉点之后发生更改，则升级必须报告
通过将预览基础快照与当前主/公共快照进行比较来解决冲突
快照。该基础不需要自动三路合并。

### 9.5 恢复

```text
Snapshot r3
  |
  | restore versioned fields
  v
target branch draft
```

恢复从不直接写入 main/public。仍需官方修改
明确的主要发布。

## 10. 文章快照和修订

`ArticleSnapshot`是单个不可变的文章历史记录表。

```text
ArticleSnapshot
├─ id
├─ hash_id
├─ community_id
├─ thread
├─ article_hash_id
├─ branch_id
├─ revision_number
├─ stage
├─ action
├─ parent_snapshot_id
├─ source_snapshot_id
├─ author_id
├─ title
├─ digest
├─ document_json
├─ body_bag
├─ data
├─ version_hash
├─ schema_version
├─ message
└─ inserted_at
```

建议的快照操作：

```text
checkpoint | publish | fork | promote | restore
```

`revision_number`在以下范围内增加：

```text
thread + article_hash_id + branch_id
```

草稿和公共快照共享一个修订序列。他们不维护
单独的草稿/公共编号。

### 10.1 快照数据

没有单独的`payload`域模型。快照存储分为：

- 显式公共列，例如标题、摘要、文档 JSON、可恢复
  `body_bag`和完整状态`version_hash`；
- `data`，存储特定于产品的版本字段和可恢复字段
  版本化关系。

变更日志快照数据示例：

```json
{
  "linkAddr": "https://example.com/release",
  "copyRight": "CC BY 4.0",
  "tags": ["release", "frontend"],
  "cover": {
    "light": "https://cdn.example/light.png",
    "dark": "https://cdn.example/dark.png"
  }
}
```

快照`data`仅包含版本化状态。它从不存储观点、评论、
赞成票或其他运行时状态。

`data`在变更集输入中是可选的，因为文章可能没有
产品特定领域。它的持久值始终是一个非空映射
数据库和 Ecto 默认为`%{}`。

### 10.2 仅追加历史记录

不得通过还原更新或删除快照。

```text
r1 -> r2 -> r3 -> r4
                  |
                  | restore r2
                  v
                  r5(action=restore, source_snapshot_id=r2)
```

`r3`和`r4`仍然可用。恢复创建新历史而不是修剪
旧的时间线。

## 11. 差异和时间机器

Diff 是纯粹的按需比较。它不拥有真实来源存储。

支持的比较：

```text
current draft      <-> latest main/public Snapshot
Snapshot A         <-> Snapshot B
preview draft      <-> fork source Snapshot
preview draft      <-> current main/public Snapshot
Doc release N      <-> Doc release N-1
```

比较顺序：

1. 比较规范的`version_hash`；
2. 比较普通版本化字段；
3. 比较版本关系；
4. 仅当文档 JSON 更改时才运行编辑器 AST Diff。

不要坚持每个成对的差异。使用`R`修订版，存储快照历史记录
必须保留`O(R)`，而不是`O(R^2)`。

文章 TimeMachine 是一个用例外观：

```text
Snapshot.list/get
Diff.compare
Restore.apply
Branch.fork
```

它不需要`article_time_machines`表。

当前文章行被标准化为与以下相同的瞬态可比较状态
快照。读取当前的 Diff 永远不会插入检查点或更改历史记录。

### 11.1 前端修订 Diff 管道

前端有一个编辑器 Diff 引擎：

```text
Groupher                              @groupher/rich-editor
----------------------------------    --------------------------------
query and order Snapshots             define Plate Diff semantics
select comparison baselines           compute one complete Diff result
schedule Worker tasks                 derive stats and hasChanges
cache results                         produce diffValue
render Revision product UI            render diffValue
restore a Snapshot
```

Groupher 不得实现 LCS、Myers、LIS、块签名、内联段、
或第二个修订差异渲染器。旧版没有兼容路径
Groupher 特定的 Diff 模型。

#### 按钮和历史记录具有不同的比较语义

操作按钮回答一个产品问题：

```text
"How much has the current document changed since the latest publish?"

latest public Snapshot
          |
          | direct comparison
          v
     current body
          |
          +-- stats -------> button +n/-n
          `-- hasChanges --> button state
```

它从不添加中间草稿快照的统计数据。相邻求和
历史条目不会产生净差异：

```text
published -> r1     +1/-0
r1        -> r2     +0/-1
--------------------------------
summed history      +1/-1    wrong answer for net change
direct comparison   +0/-0    current equals published
```

修订抽屉回答了一个不同的问题：两个之间发生了什么变化
邻近的检查站？

```text
current body  <-> latest draft Snapshot       "Now"
draft r3      <-> draft r2
draft r2      <-> draft r1
draft r1      <-> latest public Snapshot
public p3     <-> public p2
public p2     <-> public p1
```

这两种语义仍然是分开的。该按钮使用一对直接发布；
抽屉使用相邻对的有序时间线。

#### 历史是懒惰的

进入编辑器并不会计算每个历史对：

```text
Editor mounted
      |
      +-- query Snapshot metadata
      |
      `-- debounce current body
             |
             v
         calculate only
         latest public -> current body

Drawer closed
      |
      `-- no historical Diff calculation
```

仅当用户打开抽屉时历史记录工作才开始：

```text
Open Drawer
      |
      v
construct ordered pairs
      |
      +-- staged tab pairs
      `-- published tab pairs
             |
             v
calculate stats needed by the active tab
```

当暂存选项卡保持打开状态时，只有其实时`Now`对跟随编辑器
输入。它与发布对共享相同的去抖窗口；不可变的
快照对不会在每次击键时重新启动：

```text
bodyValue changed
      |
      v
200 ms debounce
      |
      +-- latest public -> current body ------> button
      |
      `-- staged tab active?
              |
              `-- latest draft -> current body -> "Now"

historical Snapshot pairs
      `-- unchanged; keep cached results
```

选择一个条目请求其完整结果：

```text
Select Revision pair
      |
      v
RevisionDiffClient.getOrCompute(pair)
      |
      +-- cache hit --------------------------+
      |                                       |
      `-- cache miss                          |
             |                                |
             v                                |
        Worker.compute(before, after)         |
             |                                |
             v                                |
         complete result ---------------------+
             |
             v
       RichEditorDiff(diffValue)
```

缓存驱逐是一个优化细节，而不是一个可见的状态。总是怀念
根据该对的`before`和`after`值重新计算；它不得呈现
默默地空Diff。

#### 工作线程和缓存边界

由于大块，完整的板差异计算不会在主线程中进行
集和大型文本替换可能会超出一帧预算。

```text
Main thread                            Worker
----------------------------------     -------------------------------
debounce input                         receive before/after
allocate request id      postMessage   computeRichEditorDiff
discard stale response  <-----------   return complete result
cache result
update UI
```

Worker 是无国籍的。它有一个操作：

```text
compute(before, after)
      |
      v
{
  stats,
  hasChanges,
  diffValue
}
```

主线程客户端拥有单个有界结果缓存。当前实体键
替换它们以前的值；不可变的快照对使用稳定的版本哈希
键。缓存未命中遵循相同的计算路径，因此驱逐无法更改
行为。

当不存在草稿快照时，按钮和`Now`具有相同的基线。
他们使用一对实时密钥，因此正在进行的工作和缓存的完整结果是
共享而不是运行相同的板差异两次。

每个当前主体请求都有一个单调递增的 id：

```text
input A ---- request 41 --------------------------x stale
input B ------- request 42 -------------------x stale
input C ---------- request 43 ---------------> accepted
```

只有最新的响应才可以更新当前按钮状态。工人调度，
反跳、缓存生命周期和过时响应处理属于 Groupher；他们
不要更改 rich-editor Diff 合约。

#### 统计数据不是变化检测

`stats`是表示数据。修订可见性使用`hasChanges`：

```text
mark change           stats=+0/-0   hasChanges=true
link attribute change stats=+0/-0   hasChanges=true
empty block insertion stats=+0/-0   hasChanges=true
```

最终的输出路由为：

```text
computeRichEditorDiff(before, after)
      |
      +-- stats --------------------> exact +n/-n display
      +-- hasChanges ---------------> visibility and empty state
      `-- diffValue ----------------> RichEditorDiff renderer
```

#### 临时工人构建适配器

当前的 Dashboard Turbopack 版本将`new URL(...worker.ts)`目标复制为
原始 TypeScript，而不是生成可执行的 Worker 包。直到
捆绑程序正确处理此条目，仪表板使用隔离适配器：

```text
diff.worker.ts
      |
      | temporary Vite build
      v
public/worker-revision-diff.js
      |
      v
Dashboard Worker URL
```

该适配器仅用于构建基础设施。它不能拥有 Diff 行为或
缓存策略，当仪表板捆绑器可以发出
直接工人。生成的 JavaScript 未提交。

## 12. 快照增长政策

自动保存更新可变草稿行；它不会每隔几次创建一个快照
秒。

快照是为有意义的事件创建的：

```text
explicit checkpoint
publish
fork
promote
restore
session/inactivity checkpoint under a bounded policy
```

普通检查点通过规范`version_hash`进行重复数据删除。发布并
其他显式产品事件仍可能在需要时创建审核条目。

保留类别：

| 快照类别                  | 保留                               |
| ------------------------- | ---------------------------------- |
| 主要公开发布              | 永久                               |
| 引用自`DocPublishRelease` | 永久                               |
| 分叉/恢复源               | 引用时受到保护                     |
| 显式用户检查点            | 长期                               |
| 自动吃水检查点            | 可能会因年龄/人数而变薄            |
| 废弃的预览历史记录        | 当未引用时，分支存档后可能会被删除 |

基础是版本检查点系统，而不是击键级别的 CRDT/oplog
历史。

## 13. 文档扩展名

文档重用文章基础，而不将树概念移至文章中
核。

```text
ArticleBranch(thread=doc)
├─ Doc rows
├─ ArticleSnapshot
├─ DocTreeNode
├─ DocTreeEvent
├─ DocTreeSnapshot
├─ DocsSiteState
└─ DocPublishRelease
```

Docs 产品保留两条独立的历史记录线：

```text
Article content line
Doc draft/public -> ArticleSnapshot

Tree line
DocTreeNode/Event -> DocTreeSnapshot
```

`DocPublishRelease`聚合它们：

```text
DocPublishRelease
├─ branch_id
├─ release_number
├─ version_slug
├─ ArticleSnapshot[]
├─ DocTreeSnapshot
└─ published TreeEvent[]
```

`DocPublishRelease`仅限文档。正常的帖子、博客或变更日志发布
创建文章快照但不创建发布包装器。

`DocPublishRelease`包括描述此聚合的模块级 ASCII 流
边界。

### 13.1 文档预览

文档预览分支包含草稿文档和草稿树。预览渲染
直接读取该显式分支。

升级将选定的预览文章和树草稿状态复制到主草稿中
状态。然后，正式发布遵循单一主要发布路径，并且
创建一个新的`DocPublishRelease`。

### 13.2 文档时间机器

文章快照恢复一个文档的版本化内容。一个
`DocPublishRelease`恢复整个文档站点组成：

```text
selected DocPublishRelease
├─ ArticleSnapshots -> new main Doc drafts
└─ DocTreeSnapshot  -> new main Tree draft
                         |
                         v
                explicit official publish
                         |
                         v
                new DocPublishRelease
```

旧版本和快照保持不变。

## 14. 建议的模块边界

共享文章基础：

```text
CMS.Articles.Branch
CMS.Articles.Draft
CMS.Articles.Publish
CMS.Articles.Preview
CMS.Articles.Snapshot
CMS.Articles.Diff
CMS.Articles.VersionedRelations
CMS.Model.ArticleBranch
CMS.Model.ArticleSnapshot
```

文档扩展名：

```text
CMS.DocPublishRelease
CMS.Model.DocPublishRelease
CMS.Model.DocPublishReleaseArticle
CMS.Model.DocPublishReleaseTreeEvent
CMS.DocTree.*
```

共享模块可以使用`Artiment.Matcher`，每线程版本字段列表，
以及少量显式线程情况。该提案不需要
协议、行为、适配器注册表或动态插件系统。

## 15. 交易边界

单件产品使用正常的生命周期条目：

```text
Publish.publish / Publish.create
├─ acquire Article lock
├─ open transaction
├─ apply Draft to main/public
├─ update document and versioned relations
├─ create ArticleSnapshot
├─ delete Draft state
└─ run official main-publish effects
```

`Snapshot`拥有不可变的检查点构建和历史操作。
`Publish`拥有编排权，并且是唯一公开过渡到
`main/public`;没有公共的 apply-without-Snapshot 条目。

文档需要可组合的内部条目，因为文章和树发布必须
是原子的：

```text
Doc publish transaction
├─ publish selected Docs through Article Publish core
├─ project selected Tree events
├─ create/reuse DocTreeSnapshot
├─ create DocPublishRelease
└─ update DocsSiteState
```

任何失败都会回滚整个文档发布。

## 16. 公共API语言

基础设施名称`article_hash_id`并不强制每个产品 API
暴露`articleHashId`。

```text
Article Core: article_hash_id
Docs product: doc_id / docId
Changelog:    changelog path
Post:         post path
Blog:         blog path
```

解析器将产品语言转换为内部生命周期坐标。
GraphQL 必须继续避免暴露原始物理数据库 ID。

文档没有公开主要内容创建/更新突变。仪表板树/文档草稿
突变是唯一的编辑表面，`publishDocChanges`是唯一的
官方文档发布条目。帖子、博客和变更日志保持即时
发布突变，同时公开单独的草稿命令以进行显式
“另存为草稿”选择。

## 17. 实施清单

1. 模型、枚举、常量和模块命名是集中和锁定的。
2. `ArticleBranch`提供显式的每线程主/预览坐标。
3. 共享文章标识为`article_hash_id`；文档将其翻译为`doc_id`
   仅在其产品边界。
4. `ArticleSnapshot`是分支感知型且仅附加的，具有一个修订时间表。
5. 标量字段、版本化关系、派生内容和运行时状态
   不同的所有者。
6. 草稿、发布、预览、比较和恢复可在所有文章线程中工作。
7. 仅文档版本组合在整个过程中被命名为`DocPublishRelease`。
8. DocTree 仍然是附加到共享分支坐标的文档扩展。
9. 帖子、博客、变更日志和文档都有独立的生命周期测试，
   其他关系、冲突、迁移、GraphQL 和前端检查。
