# Docs Nested Group：递归导航方案与实施计划

> 状态：底层递归数据模型、Backend subtree move、`tabs[].groups[].pages[]` Contract、
> Cover Card 投影、前端递归 Tree DnD、Group-first 双 lane 排序、递归创建与多层视觉
> 对齐已经落地；浏览器完整 E2E、键盘操作与无障碍公告仍待最终验收。
>
> 目标：直接把现有固定的 `Tab → Group → Page/Link` 导航改造成递归导航树
>
> 前提：不考虑实现成本，不保留旧数据契约、旧 GraphQL 字段或运行时兼容层

## 结论

本次改造不在现有 `tab_id/group_id` 模型上增加第二层 Group，而是直接收敛成统一的父子树：

```text
Tabs[]
└── Tab
    └── groups: GroupNode[]
        └── Group
            └── pages: NavigationNode[]
                ├── Group
                ├── Page
                └── Link
```

```ts
type NavigationNode = GroupNode | PageNode | LinkNode

type GroupNode = {
  type: 'group'
  pages: NavigationNode[]
}
```

数据库只使用一个 `parent_node_id` 表达层级：

- `Tab.parent_node_id = null`
- `Group.parent_node_id = Tab | Group`
- `Page.parent_node_id = Group`
- `Link.parent_node_id = Group`

对外 Contract 使用对应的 `parentNodeId`。之所以不继续使用
`parent_id/parentId`，是因为该字段引用的是稳定逻辑 `node_id`，不是数据库物理
`id`；名称中保留 `node` 可以直接表达引用目标。

该 identity 边界必须同时写入 migration column comment、`DocTreeNode`
`@moduledoc`、GraphQL 字段描述和 TypeScript JSDoc。注释至少说明：

- `parent_node_id` 引用同 Community、Branch、Stage 下直接父节点的逻辑
  `node_id`，不是物理 `id`。
- 只有根 Tab 可以为 `NULL`。
- Group 的父节点只能是 Tab/Group，Page/Link 的父节点必须是 Group，Pin 的父节点必须是
  Tab。

`tab_id`、`group_id` 全部删除。GraphQL 和 TypeScript 保留业务语义明确的
`tabs[].groups[]`；只有 Group 使用递归 `pages[]`。后端、Dashboard、公共导航、
发布、Trash、Cover 和 Content Import 消费同一棵 `parent_node_id` 树，但在 API
边界把 Tab 的直接 Group 投影为 `groups`。

这项设计直接沿用 Mintlify 的核心结构能力：`pages` 列表既可以放 Page、Link，也可以
放嵌套 Group。`pages` 是产品 Contract，不改名为泛化的 `children`；数据库内部仍使用
`parent_node_id` 表达通用父子关系。

参考：

- [Mintlify Navigation](https://www.mintlify.com/docs/organize/navigation)
- [Mintlify Editor Navigation](https://www.mintlify.com/docs/editor/navigation)

## 1. 背景

### 1.1 改造前模型是固定两层结构

改造前 `doc_tree_nodes` 使用两套父节点字段：

```text
Tab
  parent = null

Group / Pin
  tab_id = Tab.node_id

Page / Link
  group_id = Group.node_id
```

改造前代码中的结构规则是：

- `Tab` 只能是根节点。
- `Group` 只能属于 Tab。
- `Page/Link` 只能属于 Group。
- `Pin` 只能属于 Tab。

这使得 Group 不是通用容器，而是写死在 Tab 和叶子节点之间的一层。

### 1.2 改造前固定层级已经扩散到整条链路

改造前层级假设不仅存在于数据库：

| 层                | 改造前假设                                                   |
| ----------------- | ------------------------------------------------------------ |
| Ecto              | `DocTreeNode` 同时存在 `tab_id` 和 `group_id`                |
| Read              | 先按 `group_id` 组装 pages，再按 `tab_id` 组装 groups        |
| Write             | `group_parent/3`、`tab_parent/3` 分别校验固定父类型          |
| Move              | 接收 `targetTabId` 和 `targetGroupId`                        |
| Snapshot/Event    | payload 分别保存 `tabId/groupId`                             |
| GraphQL           | Node 同时暴露 `pages`、`groups`、`pins`                      |
| Dashboard         | SideTree 以 Group 列表为第一层，只渲染一层 pages             |
| DnD               | 拖动模型是 Group Column 与 Group Child 两类                  |
| Public Tree       | 返回 `tabs[].groups[].pages[]`                               |
| Cover             | 每张 Cover Card 绑定一个 Group，并投影其直接 Page/Link/Group |
| Import TargetTree | 固定为 `tabs[].groups[].pages[]`                             |

因此“允许 Group 里再放一个 Group”不是局部类型调整，而是 Docs Navigation 的领域模型升级。

### 1.3 SourceTree 已经是递归的

Content Import 的来源契约已经具备目标结构所需的表达能力：

```ts
type TSourceNode = TSourceScope | TSourceSection | TSourcePage | TSourceLink

type TSourceSection = {
  type: 'section'
  pages: TSourceNode[]
}
```

改造前真正发生信息损失的位置，是 Phoenix Target Mapper/Validator 将递归 SourceTree
压平成 flat TargetTree。

目标链路：

- 七类 framework analyzer 继续输出递归 SourceTree。
- Phoenix 不再压平 Section。
- Import Review、Validator 和 Writer 直接消费递归 TargetTree。
- Source Scope 的直接 Page/Link 会进入一个显式 `Overview` Group，不生成含糊的
  `Untitled` Group。

## 2. 设计目标

### 2.1 产品目标

- Group 可以包含 Group、Page 和 Link。
- Tab 只直接包含 Group。
- 每个 Group 的直接子节点固定为两个连续排序 lane：Nested Group 在上，
  Page/Link 在下；两类节点不交叉混排。
- Group 子树可以整体移动、复制、删除、恢复和发布。
- 编辑器、公共站点和导入预览展示同一棵树。
- Page URL 不依赖导航祖先路径；移动节点不修改文章 URL。
- Tabs 继续作为站点顶层分区，不允许嵌套在 Group 中。
- Pins 和 Cover 继续是导航树之上的展示投影，不成为 Group 的特殊子类型。

### 2.2 技术目标

- 所有层统一使用 `parentNodeId + index`。
- 树组装保持 `O(n)`，不在递归过程中重复扫描全量节点。
- 所有写操作在一个事务内完成父节点校验、环检测、排序和 revision 更新。
- Draft/Public 两个 stage 继续共享稳定的逻辑 `node_id`。
- Snapshot、Event、TargetTree 使用同一种递归 JSON 形态。
- SourceTree → TargetTree 不再存在 flat 中间模型。
- 不双写 `tab_id/group_id/parent_node_id`，不同时维护 v1/v2 GraphQL。
- Tree 不保存 URL slug；Page canonical slug 只归 Doc 所有，Link/Pin 使用
  `href`，Tab/Group 不参与 URL。
- Tree 不保留 `template_key` 或无明确消费者的 `ui_config`。

### 2.3 非目标

本方案不顺带实现 Mintlify 的全部导航元素：

- 不增加 Anchor、Dropdown、Product、Version 或 Language 节点。
- 不允许 Tab 嵌套进 Group。
- 不把 Group 变成 Article。
- 不在本次增加 Group Root Page；Group 点击默认只负责展开/折叠。
- 不让 URL 随 Navigation ancestry 改变。
- 不把 Cover 结构改造成第二棵 Docs Navigation。

## 3. 最终领域模型

### 3.1 节点类型

```ts
type TDocTree = {
  tabs: TDocTreeTab[]
}

type TDocTreeTab = {
  id: string
  parentNodeId: null
  type: 'tab'
  title: string
  index: number
  groups: TDocTreeGroup[]
  pins: TDocTreePin[]
}

type TDocNavigationNode = TDocTreeGroup | TDocTreePage | TDocTreeLink

type TDocTreeGroup = {
  id: string
  parentNodeId: string
  type: 'group'
  title: string
  index: number
  pages: TDocNavigationNode[]
}

type TDocTreePage = {
  id: string
  parentNodeId: string
  type: 'page'
  docId: string
  title: string
  index: number
}

type TDocTreeLink = {
  id: string
  parentNodeId: string
  type: 'link'
  href: string
  title: string
  index: number
}
```

Pin 仍然只属于 Tab，并通过 `tab.pins` 单独返回：

```ts
type TDocTreePin = {
  id: string
  parentNodeId: string // 必须指向 Tab
  type: 'pin'
  href: string
  title: string
  index: number
}
```

Pin 不进入 `Tab.groups`，也不能成为 Group 的子节点。

这里的 `Pin.parentNodeId` 指向所属 Tab 的 `id`，不是复制 Tab 自己的 `parentNodeId`：

```text
Tab:
  id = tab-guides
  parentNodeId = null

Pin:
  id = pin-github
  parentNodeId = tab-guides
```

因此 `parentNodeId` 仍然承载“Pin 属于哪个 Tab”的必要信息。Pin 不进入 `groups`
只表示它使用独立的展示和排序 lane，不代表它没有 parent；改回 `tabId` 会重新引入
本方案要删除的特殊层级字段。

### 3.2 父子规则

| 节点  | 允许的父节点 | 是否可以有 pages           |
| ----- | ------------ | -------------------------- |
| Tab   | 无           | 仅通过 `groups` 返回 Group |
| Group | Tab、Group   | 是                         |
| Page  | Group        | 否                         |
| Link  | Group        | 否                         |
| Pin   | Tab          | 否；独立存在于 `pins`      |

统一约束：

- 一棵树至少有一个 Draft Tab。
- Draft 允许临时空 Tab/Group，便于编辑。
- Public Projection 自底向上裁掉没有任何可见 Page/Link 的空 Group。
- 没有可见 Navigation pages 且没有 Pins 的空 Tab 不进入公共导航。
- `hidden=true` 的 Group 隐藏整棵子树。
- `hidden=true` 的 Page/Link 只隐藏自身。
- 产品语义上支持任意层级；为防止异常输入和递归攻击，服务端统一设置 `maxDepth = 32`、`maxNodes = 10_000`。

### 3.3 排序

`index` 只在同一父节点下有意义：

```text
sibling scope =
  community_id
  + branch_id
  + stage
  + parent_node_id
```

根 Tab 使用 `parent_node_id IS NULL` 的独立 sibling scope。

数据库仍以同一 parent 下的单个 `index` 序列持久化节点，但产品和所有运行时投影必须
把它规范化为两个连续 lane：

```text
groups lane:
  Group
  Group

leaves lane:
  Page
  Link
  Page
```

固定规则：

- Nested Group 始终连续排在 Page/Link 之前。
- Group 只允许在 `groups` lane 内排序；Page/Link 只允许在 `leaves` lane 内排序。
- Group 与 Page/Link 不能通过创建、DnD、Import 或 Backend mutation 形成交叉序列。
- GraphQL `pages[]` 返回两个 lane 拼接后的 canonical sequence。
- 不为两个 lane 增加独立数据库字段；节点最终 `index` 是 canonical sequence 中的零基
  位置。

双 lane 是领域排序规则，不只是 Dashboard 的视觉分组：

- 数据库只保存单一 `parent_node_id + index` sibling sequence；普通 unique index
  只能保证位置不重复，不能单独表达跨行的 Group-first 规则。
- Backend Write/Import/Restore 在领域边界按 `Group → Page/Link` 规范化并连续化
  `index`，是 canonical order 的最终权威。
- Dashboard DnD 使用 `groups/leaves` 两个交互 lane，但提交前重新定位到完整 canonical
  sibling sequence；GraphQL、Snapshot、Publish 和 Public Navigation 不需要各自重新
  解释顺序。
- 如果来源 sibling 顺序存在 Group/Page/Link 交叉，Content Import 必须明确提示已按
  Groupher Group-first 规则规范化，不能声称原样保留。

### 3.4 标识与 URL

- `id`：数据库物理行 id，不暴露给产品层。
- `node_id`：Draft/Public 共用的稳定逻辑节点 id，对外作为 GraphQL `id`。
- `parent_node_id`：父节点的逻辑 `node_id`，不是物理 row id；对外对应
  `parentNodeId`。
- `doc_id`：Page 指向 Article 的稳定 id。
- `index`：节点在同一 parent 的完整 canonical sibling sequence 中的零基排序位置；
  不是 lane-relative index。Group lane 和 leaves lane 只是领域校验及前端交互投影。
- Page 公共 URL 继续由 Published Doc 的 identity/slug 生成。
- Group title、折叠状态和祖先链不参与 Page canonical URL。
- 移动 Page 或整棵 Group 只改变 Navigation，不触发 redirect。

本方案固定以下命名边界：

| 语义                   | Database / Ecto         | GraphQL / TypeScript |
| ---------------------- | ----------------------- | -------------------- |
| 当前节点稳定逻辑身份   | `node_id`               | `id`                 |
| 直接父节点稳定逻辑身份 | `parent_node_id`        | `parentNodeId`       |
| 移动后的目标父节点     | `target_parent_node_id` | `targetParentNodeId` |

Pin 不使用 `tab_id` 特例。`Pin.parentNodeId = Tab.id` 与
`Tab.parentNodeId = null` 是同一条直接父子关系的两端，不代表两个字段互相引用。

### 3.5 `type` 命名规则

所有 Groupher 自有业务 Contract、JSON、GraphQL、TypeScript discriminated union 和
Ecto enum 统一使用 `type`，不使用 `kind`：

```ts
type TDocNavigationNode =
  | { type: 'group'; pages: TDocNavigationNode[] }
  | { type: 'page'; docId: string }
  | { type: 'link'; href: string }
```

只允许以下不可控边界保留 `kind`：

- BEAM/Elixir `catch kind, reason`、`Exception.format(kind, ...)` 等运行时术语。
- Phoenix 或第三方包明确规定的外部字段；进入 Groupher 领域层后立即适配成 `type`。
- 描述旧数据库状态的历史 migration。
- `deps/` 和生成产物。

Content Import 的 `source.kind = 'repo'`、Header Editor `column.kind`、Marker Picker
`item.kind` 等自有字段不满足例外条件，统一改为 `type`。SourceTree 和 TargetTree
节点也只能使用 `type`。

## 4. 数据库设计

### 4.1 `doc_tree_nodes`

最终字段：

```text
doc_tree_nodes
- id
- community_id
- branch_id
- stage
- node_id
- parent_node_id       // 新的唯一层级字段，引用同 stage 的 node_id
- type
- doc_id
- title
- index
- href
- marker
- badge
- hidden
- inserted_at
- updated_at
```

删除：

```text
tab_id
group_id
slug
template_key
ui_config
```

### 4.2 约束与索引

稳定逻辑身份：

```text
unique(community_id, branch_id, stage, node_id)
```

父节点引用使用同一 Community、Branch 和 Stage 的复合外键：

```text
(community_id, branch_id, stage, parent_node_id)
  REFERENCES
(community_id, branch_id, stage, node_id)
```

该外键应为 deferrable，支持事务内批量创建、移动和发布整棵子树。

Navigation 与 Pin 是 Tab 下两条独立序列。Navigation sibling 约束：

```text
unique(community_id, branch_id, stage, parent_node_id, index)
  WHERE parent_node_id IS NOT NULL AND type != 'pin'

unique(community_id, branch_id, stage, index)
  WHERE parent_node_id IS NULL AND type = 'tab'
```

Pin sibling 约束：

```text
unique(community_id, branch_id, stage, parent_node_id, index)
  WHERE type = 'pin'
```

Pin 的 `parent_node_id` 必须是所属 Tab 的 `node_id`，不会是 `NULL`。上面的约束因此按 Tab 分区，例如 `(tab-a, 0)`、`(tab-a, 1)`、`(tab-b, 0)` 是三条有效位置。

Partial unique index 不能设为 deferrable；批量 reorder 使用临时负数/偏移 index，再在同一事务内连续化为最终 index，避免中间状态碰撞。

同级名称约束统一改成 parent scope，不再维护 root、tab sibling、group sibling 三套索引：

```text
unique(community_id, branch_id, stage, parent_node_id, title)
  WHERE parent_node_id IS NOT NULL AND type != 'pin'

unique(community_id, branch_id, stage, title)
  WHERE parent_node_id IS NULL AND type = 'tab'
```

类型字段约束：

```text
Tab:
  parent_node_id IS NULL
  doc_id IS NULL
  href IS NULL

Group:
  parent_node_id IS NOT NULL
  doc_id IS NULL
  href IS NULL

Page:
  parent_node_id IS NOT NULL
  doc_id IS NOT NULL
  href IS NULL

Link/Pin:
  parent_node_id IS NOT NULL
  doc_id IS NULL
  href IS NOT NULL
```

父节点的具体类型不能只靠当前行的 CHECK 判断，统一由写事务校验：

- Group 的 parent 必须是 Tab 或 Group。
- Page/Link 的 parent 必须是 Group。
- Pin 的 parent 必须是 Tab。
- parent 与 child 必须属于相同 Community、Branch 和 Stage。
- 目标 parent 不能是当前节点或当前节点的任意后代。

### 4.3 One-way migration

本方案不使用 Expand/Contract，也不保留兼容窗口。数据库和应用必须作为同一个版本
一次性切换：

1. 暂停 Docs Tree 写入并创建数据库恢复点。
2. 新增 `parent_node_id`，根据 `tab_id/group_id` 回填现有 placement。
3. 在同一个 migration 中审计 orphan、非法父类型和重复 sibling index。
4. 建立最终 composite FK、类型 CHECK 和 sibling unique indexes。
5. 同一个 migration 删除 `tab_id/group_id/slug/template_key/ui_config` 及旧索引。
6. 同步完成 Cover Group → Section、外键和 `appearance` rename。
7. 同时部署 Backend、GraphQL、Dashboard、Public、Cover 和 Import；不允许新旧消费者
   混跑。
8. 执行 Draft/Public、编辑器、发布、Trash、Cover 和 Import smoke test，失败时修复
   新版本并重新演练。

新版本不提供旧字段 alias、不双写、不保留 v1/v2 GraphQL 双栈，也不通过 feature
flag 切换结构。迁移后产生的递归数据无法由旧模型表达，因此运行策略只允许
roll-forward。

## 5. Backend Tree Core

### 5.1 统一树构建器

删除按 Group/Tab 分两轮拼装的 `build_groups/build_tabs`，改为通用构建：

```text
rows
  │
  ├─ validate unique node_id
  ├─ children_by_parent = group_by(parent_node_id)
  ├─ roots = type=tab AND parent_node_id=nil
  └─ DFS attach pages
       ├─ detect cycle
       ├─ detect orphan
       ├─ enforce maxDepth/maxNodes
       └─ preserve sibling index
```

复杂度：

```text
build index: O(n)
attach tree: O(n)
memory: O(n)
```

Draft 和 Public 共用同一个 Tree Builder：

- Draft 在节点上附加 publish state、Cover state 和 editor metadata。
- Public 解析 Page href，过滤 draft/hidden 节点并裁掉空容器。
- 两者不维护两套结构组装算法。

### 5.2 统一创建接口

后端内部收敛成：

```elixir
create_node(community, %{
  parent_node_id: parent_node_id,
  type: type,
  index: index,
  ...
})
```

规则：

- 创建第一个 Tab 时不自动创建占位 Group。
- Page/Link 只能创建在 Group 下。
- Group 可以创建在 Tab 或任意 Group 下。
- 新节点 index 由目标 parent 的 sibling scope 计算。

### 5.3 统一移动接口

```elixir
move_node(community, node_id, %{
  target_parent_node_id: parent_node_id,
  target_index: index,
  base_revision: revision
})
```

事务步骤：

1. 锁定 `DocsSiteState` revision。
2. 读取待移动节点和目标 parent。
3. 读取待移动 Group 的 descendant set。
4. 拒绝把节点移动到自身或自身后代。
5. 校验 node/parent 类型组合。
6. 锁定 source/target 两组 siblings。
7. 更新 `parent_node_id/index`。
8. 重新连续化 source/target sibling indexes。
9. 记录包含 old/new parent 与 index 的 move event。
10. bump tree revision。

移动 Group 只修改 Group 根节点的 `parent_node_id/index`，后代不改 parent，不逐行重写整棵子树。

### 5.4 子树操作

Group 成为真正的子树边界后，下列操作必须统一按 descendant closure 执行：

| 操作                | 语义                                              |
| ------------------- | ------------------------------------------------- |
| Delete Group        | Group 与全部后代作为一个 Trash 单元               |
| Restore Group       | 原样恢复整个子树及内部排序                        |
| Duplicate Group     | 复制完整结构；Page 同时复制 Draft Doc             |
| Hide Group          | 公共投影隐藏整个子树                              |
| Publish Group       | 发布选中 Group 所需的 ancestor/descendant closure |
| Move Group to Draft | Group 与全部 Public descendants 回到 Draft 可见性 |

通用查询能力：

```elixir
ancestors(node_id)
descendants(node_id)
subtree(node_id)
is_descendant?(candidate_parent_node_id, node_id)
```

PostgreSQL 使用 recursive CTE 完成 ancestor/descendant 查询；内存中的已加载树操作使用一次 DFS，不重复访问数据库。

## 6. Publish、Snapshot、Event 与 Trash

### 6.1 发布闭包

递归树不能只发布一个失去祖先的叶子节点。

发布选择扩展为：

```text
selected nodes
  + required ancestor closure
  + structural descendant closure
  + referenced Page content
```

规则：

- 发布 Page 时，其尚未存在于 Public 的祖先链自动加入发布范围。
- 发布新 Group 时，用户选中的已就绪后代一起进入范围。
- 删除/隐藏/移动 Group 的发布范围包含公共树中受影响的整棵子树。
- 发布不能产生 orphan、cycle、重复 sibling index 或没有 Tab 根的公共树。
- 发布事务完成后再生成 Snapshot 和 PublishRelease。

### 6.2 Snapshot JSON

Snapshot 不再保存 `tabId/groupId`：

```json
{
  "tabs": [
    {
      "id": "guides",
      "type": "tab",
      "groups": [
        {
          "id": "getting-started",
          "type": "group",
          "pages": [
            {
              "id": "advanced",
              "type": "group",
              "pages": [
                {
                  "id": "configuration",
                  "type": "page",
                  "docId": "..."
                }
              ]
            }
          ]
        }
      ],
      "pins": []
    }
  ]
}
```

Snapshot hash 基于 canonical recursive JSON 计算：

- groups/pages 按 index 排序。
- Map key 顺序固定。
- 不包含数据库物理 id 和时间字段。
- 相同逻辑树必须得到相同 hash。

### 6.3 Event

所有结构 Event 使用统一 selector：

```json
{
  "nodeId": "advanced",
  "parentNodeId": "getting-started",
  "index": 1
}
```

Move Event：

```json
{
  "nodeId": "advanced",
  "from": {
    "parentNodeId": "getting-started",
    "index": 1
  },
  "to": {
    "parentNodeId": "api",
    "index": 0
  }
}
```

Delete Event 保存可恢复的 subtree snapshot，不能只保存根 Group。

### 6.4 Trash

Trash Item 至少保存：

```text
node_id
type
deleted_from_parent_node_id
deleted_from_index
subtree_json
deleted_at
restored_at
```

恢复规则：

- 原 parent 仍存在：恢复到原 parent 和尽可能接近原 index 的位置。
- 原 parent 不存在：返回 `restore_target_required`。
- Trash Drawer 在当前 Trash Item 下方展开行内 parent 选择器，用户明确选择合法的
  Tab/Group 后，以 `targetParentNodeId + targetIndex` 再次恢复；不使用阻塞式 modal，
  也不能只弹 toast 后结束。
- Pin 的恢复目标只能是 Tab；Group 的恢复目标可以是 Tab 或 Group；Page/Link 的恢复
  目标只能是 Group。
- 不静默恢复到第一个 Tab 或自动创建 `Untitled`。

## 7. GraphQL Contract

### 7.1 查询

`DocTreeNode` 和 `DocPublicTreeNode` 统一成递归字段：

```graphql
type DocTreeNode {
  id: ID!
  parentNodeId: ID
  docId: ID
  type: DocTreeNodeType!
  title: String!
  index: Int!
  href: String
  marker: Marker
  badge: String
  hidden: Boolean!
  publishState: DocTreeNodePublishState
  groups: [DocTreeNode!]!
  pages: [DocTreeNode!]!
  pins: [DocTreeNode!]!
}
```

字段规则：

- 只有 Tab 返回非空 `groups` 和 `pins`。
- 只有 Group 返回非空 `pages`。
- Page/Link 的 `pages` 固定为空数组。
- 删除 `tabId`、`groupId`；保留 Tab 业务边界上的 `groups`。
- Draft/Public 使用同一结构，差异只在 editor-only 字段。

### 7.2 Mutation

删除按类型重复的创建 mutation，统一为：

```graphql
createDocTreeNode(
  community: String!
  baseRevision: Int!
  parentNodeId: ID
  input: DocTreeNodeInput!
): DocTreeMutationPayload!
```

```graphql
input DocTreeNodeInput {
  type: DocTreeNodeType!
  title: String!
  index: Int
  docId: ID
  href: String
  marker: MarkerInput
  badge: String
  hidden: Boolean
}
```

移动：

```graphql
moveDocTreeNode(
  community: String!
  id: ID!
  baseRevision: Int!
  targetParentNodeId: ID
  targetIndex: Int!
): DocTreeMutationPayload!
```

恢复：

```graphql
restoreDocTreeTrashItem(
  community: String!
  id: ID!
  baseRevision: Int!
  targetParentNodeId: ID
  targetIndex: Int
): DocTreeMutationPayload!
```

不再接受：

```text
tabId
groupId
targetTabId
targetGroupId
```

### 7.3 子树命令

Group 是子树聚合根。GraphQL 传一个根节点 ID，Backend 负责计算 ancestor/descendant closure；不能要求调用方展开并提交一组 descendant IDs。

| 产品操作      | GraphQL 命令                | 输入                                                  | 服务端语义                                                            |
| ------------- | --------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------- |
| 删除 Group    | `deleteDocTreeNode`         | `id`                                                  | 将根 Group 和全部 descendants 写入一个 Trash subtree                  |
| 移动 Group    | `moveDocTreeNode`           | `id + targetParentNodeId + targetIndex`               | 只更新根节点位置，后代自然跟随                                        |
| 恢复 Group    | `restoreDocTreeTrashItem`   | `trashItemId + targetParentNodeId? + targetIndex?`    | 从一个 Trash Item 恢复完整 subtree                                    |
| 复制 Group    | `duplicateDocTreeSubtree`   | `id`                                                  | 复制结构、Links 和所有 Page Draft Docs                                |
| Move to Draft | `moveDocTreeSubtreeToDraft` | `id`                                                  | 将 Group 与全部 Public descendants 回到 Draft 可见性                  |
| 发布          | `publishDocChanges`         | `docChangeIds + treeChangeIds + restoreTreeChangeIds` | 根据被选 Event/Change IDs 计算 ancestor/descendant closure 并原子发布 |

`publishDocChanges` 继续使用现有批量选择模型；`treeChangeIds` 是待发布 Tree Event/Change IDs，不是由前端展开出的节点列表。

以下场景不需要新的公共 batch node mutation：

- Group move/delete/restore/duplicate 都由单个聚合根命令表达。
- Content Import 的整树写入由内部 Validator/Writer 在一个事务内执行，不通过 Dashboard 的逐节点 GraphQL mutation。
- 将来只有在一个用户动作需要同时修改多个互不相关的根节点时，才单独增加 batch command。

## 8. Dashboard SideTree

### 8.1 前端类型

删除：

```ts
TSideTreeGroup[]
group.pages: Array<Page | Link>
```

改成：

```ts
type TSideTreeNode = TSideTreeGroup | TSideTreePage | TSideTreeLink

type TSideTreeGroup = {
  type: 'group'
  pages: TSideTreeNode[]
}
```

SideTree Controller 保留产品语义明确的创建与编辑命令：

```ts
addGroup()
addNestedGroup(parentGroupId)
addChild(groupId, type)
renameGroup(groupId, title)
renameChild(groupId, childId, title)
reorderGroups(groups, activeNodeId)
```

Backend placement 仍收敛为通用 Node contract：

```text
createNode(parentNodeId, type, input)
updateNode(nodeId, patch)
deleteNode(nodeId)
duplicateNode(nodeId)
moveNode(nodeId, targetParentNodeId, targetIndex)
toggleNode(nodeId)
```

### 8.2 组件结构

每个文件只定义一个组件。当前递归边界：

```text
SideTree/
├── index.tsx
├── Group/
│   ├── index.tsx
│   ├── File.tsx
│   └── Link.tsx
├── PinList/
├── Dnd/
└── salon/
```

递归关系：

```tsx
SideTree
  → Group
      → Group[]
      → File | Link[]
```

下层组件各自调用 `useSalon()`，不把 salon 对象作为 props 向下传递。

`File.tsx` 只接收并渲染 `TSideTreePage`，`Link.tsx` 独立处理
`TSideTreeLink`；两者没有混用同一个叶子组件。这里保留 `File` 命名，避免在 Next.js
工程中增加容易与路由 `page.tsx` 混淆的 `Page.tsx`，不收敛为语义过宽的
`Item.tsx/Child.tsx`。

多层视觉 lane 使用统一 spacing constant：

- 顶层 Group 使用独立 header gutter。
- 第一层 Nested Group 标题与当前 Group 的 Page/Link marker lane 对齐。
- 更深一层 Nested Group wrapper 递归增加
  `NESTED_GROUP_LEVEL_MARGIN_LEFT = ml-2`，即 8px。
- 任意父 Group 内，Nested Group 标题必须与该父 Group 的 Page/Link 图标左边形成同一
  lane；不能只按 `depth > 0` 使用同一档缩进，也不能固定增加 24px。
- Group drag handle、drop indicator 和完整子树跟随同一个 wrapper 缩进，不单独计算
  偏移。
- Page/Link 在深层 Group 中继承父 wrapper，再使用自己的 leaf indent；顶层 Page/Link
  不额外增加 nested leaf indent。

### 8.3 展开状态

- 展开/收起是编辑器本地 UI 状态，不写入 Tree 结构。
- 当前 SideTree view model 使用 `group.expanded` 保存本地展开状态；它不进入 Backend
  mutation、Snapshot 或公共 Contract。
- 搜索期间使用派生 expanded state，不覆盖用户原来的展开状态。
- 新建 Group 后自动展开并进入 rename。
- 当前 active Page 的 ancestor chain 自动展开。

### 8.4 搜索

搜索返回匹配节点及其完整祖先链：

```text
Guides
└── Advanced
    └── Configuration  ← match
```

规则：

- Page/Link 按 title 搜索。
- Group 可以按自身 title 命中。
- 命中后保留祖先用于说明位置。
- 搜索结果不改变真实 pages 和 DnD index。
- 搜索模式禁止拖动，避免对过滤树计算错误位置。

### 8.5 前端 DnD

底层数据模型和 Backend 已支持整棵子树移动：只更新被拖动根节点的
`parent_node_id + index`，后代继续指向原直接父节点并自然跟随；Backend 已校验父类型、
循环、深度、revision 与 sibling index。

前端已完成：

- SideTree 使用独立 Tree DnD controller，不再复用 LinkEditor 的 `Column + Link`
  controller。
- 顶层与 Nested Group 使用同一种 sortable node identity 和同一个标题 drag handle，
  不再区分 column drag 与 child drag。
- DnD 从开始到提交显式保留真实 `activeNodeId`，不再通过前后 Tree diff 猜 moved node。
- Page、Link、顶层 Group 与 Nested Group 使用同一条 subtree move 路径。
- 顶层 Group 可以拖入任意合法 Group；Nested Group 可以提升回 Tab 根层。
- 前端和 Backend 都拒绝把 Group 移入自己或自己的后代。
- 折叠 Group 作为 target 时支持 hover 自动展开。
- Drop Target 明确表达 `before | after | inside`；碰撞时优先选择最深的合法节点或
  children container。
- Page/Link 不允许提升到 Tab 根层；Group 不能落入自己的 subtree。

渲染层使用带 depth 和 parent identity 的递归 sortable projection：

```ts
type TVisibleTreeRow = {
  node: TDocTreeGroup | TDocTreePage | TDocTreeLink
  parentNodeId: string
  index: number
  depth: number
  path: readonly string[]
}

type TDocTreeDropTarget = {
  parentNodeId: string
  lane: TDocTreeDndLane
  index: number
  intent: 'before' | 'after' | 'inside'
  overNodeId?: string | null // 仅用于交互指示，不进入 Backend mutation
}

const SIDE_TREE_DND_LANE = {
  GROUPS: 'groups',
  LEAVES: 'leaves',
} as const

type TDocTreeDndLane = (typeof SIDE_TREE_DND_LANE)[keyof typeof SIDE_TREE_DND_LANE]

type TDocTreeDragState = {
  activeNodeId: string
  activeSubtreeIds: ReadonlySet<string>
  target: TDocTreeDropTarget | null
}
```

扁平列表只是交互投影，不成为服务端 Contract。DnD 从开始到提交必须显式保留真实
`activeNodeId`，禁止再通过前后 Tree diff 猜测移动节点。`target.index` 在 DnD
计算阶段可以使用 lane 内位置；写回递归 Tree 后必须通过最终
`groups + leaves` canonical 顺序重新定位节点，Backend mutation 接收的是该节点在
完整 sibling 序列中的最终 `index`，不是 lane-relative index。

最终提交仍是单节点 move：

```ts
{
  nodeId: activeNodeId,
  targetParentNodeId: target.parentNodeId,
  targetIndex: target.index,
}
```

交互规则：

- Group 可以整体拖到 Tab、Group，完整子树随根节点移动。
- Page/Link 只能拖进 Group。
- Group 只能在 `groups` lane 内排序，Page/Link 只能在 `leaves` lane 内排序；
  两个 lane 不能通过 DnD 交叉。
- Group 可以拖入另一个 Group 的 `groups` lane；Page/Link 可以拖入另一个 Group 的
  `leaves` lane。
- Drop 到 Group 行上明确表示 `inside`；上、下插入线分别表示 `before/after`。
- Hover 折叠 Group 500–700ms 后自动展开；直接松手时，Group 追加到 `groups` lane
  末尾，Page/Link 追加到 `leaves` lane 末尾。
- 搜索状态禁止 DnD。
- 前端即时拒绝拖进自身、自己的后代、Page/Link，以及超过 `maxDepth` 的目标。
- Backend 重复父类型、环、深度、revision 和 sibling index 校验，不能相信前端投影。

创建规则：

- 新建顶层或 Nested Group 时，临时输入框位于当前 `groups` lane 第一位。
- Group 确认标题后移动到当前 `groups` lane 末尾，再使用最终 canonical `index` 创建
  Backend Node；已有 Group 的重命名不改变顺序。
- 新建 Page/Link 时，临时输入框位于 `leaves` lane 第一位，也就是全部 Nested Group
  之后、已有 Page/Link 之前。
- Page/Link 确认后移动到 `leaves` lane 末尾，再提交最终 `index`。
- 临时输入框只存在于前端，不参与 DnD，也不会在确认前持久化。
- 在任意深度 Group 内创建 Page 后，Backend 返回真实 Page/Doc identity 时自动激活该
  Page，并把稳定 `docId` 同步到现有编辑器 URL；顶层和 Nested Group 行为一致。

Cover 联动：

- Card 绑定稳定 `groupNodeId`，普通移动不改变 Card identity。
- 如果移动并发布后使两张 Card 形成祖先/后代关系，保留最高层已选祖先 Card，原子删除
  被其覆盖的后代 Card。
- Publish checklist 在提交前列出将被替换的后代 Card。
- 发布后重新计算 Cover Group Item 的 `leafCount` 和首个可访问 `href`。

浏览器与无障碍验收：

- 同层向前/向后跨多个位置时，持久化的始终是实际 active node。
- 顶层 Group 可以整体拖入任意合法 Group，也可以从 Nested Group 提升回 Tab 根层。
- 每个 Group 只有一个一致的 drag identity 和 drag handle，不再区分 column/child 路径。
- 子 Group 可整体拖进空、展开、折叠 Group，并保留完整后代结构。
- Group 不能移入自己或自己的任意深度后代。
- 深层 nested droppable 始终选择最深合法目标。
- optimistic move conflict 后恢复 authoritative Tree 和 active path。
- 覆盖鼠标、键盘和无障碍 announcements。

### 8.6 多人协作与 revision conflict

Docs Tree 使用 `baseRevision` 做 first-writer-wins 乐观锁，不尝试自动合并两棵结构树。

同一浏览器实例：

- 所有 Tree mutation 进入串行队列；后一条 mutation 使用前一条成功返回的新 revision。
- 队列中任何 mutation conflict 后，取消尚未发送的后续结构 mutation，只触发一次权威 reload。
- DnD 可以 optimistic 更新，但提交前保存上一份 authoritative tree snapshot。
- 创建中的本地节点保留 local id，直到服务端返回真实 `node_id`。

不同编辑者同时修改：

1. 第一位编辑者成功写入并推进 revision。
2. 第二位编辑者使用旧 `baseRevision` 时，服务端返回：

   ```ts
   {
     conflict: true
     revision: currentRevision
     node: null
   }
   ```

3. 前端丢弃本地 optimistic 结构并全量重拉 Tree。
4. 使用 URL 中的 `docId` 重新定位 active Page、active Tab 和 ancestor expansion。
5. 显示非阻塞 conflict toast，不弹阻塞式合并窗口。

不同操作的恢复策略：

| 操作                  | Conflict 后处理                                                       |
| --------------------- | --------------------------------------------------------------------- |
| DnD、删除、隐藏、排序 | 丢弃 optimistic patch，以服务端 Tree 为准                             |
| Rename                | 重拉 Tree，保留未提交文本并重新打开对应节点的编辑态；不自动重放       |
| Create                | 重拉 Tree，将输入保存在本地 `pendingCreate`；由用户重新确认位置并提交 |
| Publish               | 重新读取 checklist/revision，要求用户再次确认发布范围                 |

Create conflict 使用明确的非阻塞恢复流程：

1. 将 `{localId, type, title/href, parentNodeId, targetIndex}` 保存在本地
   `pendingCreate`，它不进入刚重拉的 authoritative Tree。
2. 若原 `parentNodeId` 仍存在且仍可接收该节点，在原位置重新显示带“未保存”状态的
   inline create row，并恢复输入焦点；用户再次提交后才发送 mutation。
3. 若原 parent 已删除或类型已不合法，不把节点临时挂到其他位置。SideTree 顶部持续
   显示一条未保存恢复项，提供“选择位置”和“放弃”两个动作。
4. “选择位置”打开现有 parent picker；Group 可选 Tab/Group，Page/Link 只能选
   Group。选中合法 parent 后把
   `pendingCreate.parentNodeId` 更新为新位置并恢复 inline create row，仍由用户确认提交。
5. conflict toast 只负责说明“树已被其他编辑者更新”，不能作为未保存输入的唯一载体；
   不自动弹出 merge modal，也不自动选择 fallback parent。

只有用户主动放弃且输入包含有效内容时才需要二次确认；关闭 toast、切换 Tab 或重新展开
树都不能隐式清除 `pendingCreate`。

不自动 merge 或 replay 的原因：

- target parent 可能已删除或移动。
- sibling index 已经改变。
- title 可能产生新冲突，Page Doc slug 冲突由 Doc 写入边界单独返回。
- 自动重放删除、移动和发布可能扩大用户原本确认的影响范围。

### 8.7 编辑器 URL

Nested Group 不改变现有编辑器 URL contract：

```text
/:community/dashboard/doc/editor?docId=<docId>
```

规则：

- `docId` 是稳定的 Doc identity，不是 Tab、Group 或 Navigation Node id。
- URL 不包含 `tabId/groupId`，也不编码 ancestor path。
- 移动 Page 或整个 Group 后 URL 保持不变。
- active Tab 和 ancestor Groups 由前端在递归树中根据 `docId` 反向查找。
- 切换 Tab 时选择该 Tab 的第一个可见 Page，并以 `router.replace` 更新 `docId`。
- URL 中的 `docId` 已不存在时，选择第一篇可见 Page 并替换 query；整棵树没有 Page 时删除 `docId`。
- 展开状态是本地 UI 状态，不进入 URL。

## 9. Public Navigation

公共读取直接返回递归树：

```text
read public rows
→ build recursive tree
→ resolve Page href
→ filter hidden/unpublished leaves
→ prune empty Groups/Tabs
→ render
```

公共 SideTree：

- Group 递归展开/收起。
- Group 默认只展开/收起，不自动导航。
- Page/Link 是可导航叶子。
- Breadcrumb 从 active Page 的 ancestor chain 派生。
- Previous/Next 使用公共树中 Page 的 DFS 顺序。
- 移动节点后 breadcrumb 会变化，但 Page URL 不变。
- 深层缩进需要视觉上限；超过展示上限后减少每层 indent，不能裁掉真实层级。

## 10. Cover

Cover 是 Navigation 之上的 Group Card 投影，不复制完整导航树，也不把 descendant
Page 铺平到父 Card。

### 10.1 最终类型与命名

不使用 `TDocCoversData`、`TDocCoverSection`、`sections` 或模糊的
`sourceNodeId`。最终命名：

```ts
type TDocCovers = {
  cards: readonly TDocCoverCard[]
  pinnedDocs: readonly TDocCoverPinnedDoc[]
}

type TDocCoverCard = {
  id: string
  groupNodeId: string
  title: string
  index: number
  appearance: TDocCoverCardAppearance
  items: readonly TDocCoverCardItem[]
}

type TDocCoverCardAppearance = {
  layout?: TDocCoverLayout | null
  marker?: TMarkerValue | null
}

type TDocCoverCardItem = TDocCoverPageItem | TDocCoverLinkItem | TDocCoverGroupItem

type TDocCoverPageItem = {
  type: 'page'
  nodeId: string
  docId: string
  title: string
  href: string
  index: number
  marker?: TMarkerValue | null
  badge?: string | null
}

type TDocCoverLinkItem = {
  type: 'link'
  nodeId: string
  title: string
  href: string
  index: number
  marker?: TMarkerValue | null
  badge?: string | null
}

type TDocCoverGroupItem = {
  type: 'group'
  nodeId: string
  title: string
  index: number
  leafCount: number
  href: string
  marker?: TMarkerValue | null
}

type TDocCoverPinnedDocAppearance = {
  light: Partial<TBgConfig>
  dark: Partial<TBgConfig>
}

type TDocCoverPinnedDoc = {
  nodeId: string
  index: number
  href: string
  appearance: TDocCoverPinnedDocAppearance
  doc: {
    title: string
    author?: TDocAuthor | null
    document?: {
      thumbnail?: TArticleThumbnail | null
    } | null
  }
}
```

Card 只绑定 Published Group，不允许绑定 Tab。`groupNodeId` 对外必须是稳定逻辑
`node_id`；数据库物理 FK 只存在于 Ecto/DB 内部，不得以同名 GraphQL 字段泄漏。
`TArticleThumbnail`、`TDocAuthor` 属于 Article/User 领域，由 Cover 引用，不在 Cover
模块重复定义。

`appearance` 只保存布局、背景、marker 等展示配置。`desc/digest` 属于内容，不放进
appearance；如果后续需要 Cover-local 文案覆盖，应使用明确的顶层
`description`/`descriptionOverride` 字段。

### 10.2 Card 投影规则

每张 Card 展示目标 Group 的直接 `pages`：

```text
Group.pages
├── 直属 Group ──→ Cover Group Item
                   leafCount = 递归可见 Page + Link 数量
                   href = 第一个递归可访问 Page/Link
├── 直属 Page  ──→ Cover Page Item
└── 直属 Link  ──→ Cover Link Item
```

规则：

1. 子 Group 的 Page/Link 不展开到父 Card；父 Card 只展示一行 Group Item。
2. `leafCount` 递归统计该 Group 子树中前台实际可访问的 Public Page 和 Public Link。
3. Group Item 的 `href` 按 navigation `index` 做 DFS，指向第一个可访问 Page/Link。
4. 第一个叶子是 Page 时跳 Page URL；是 Link 时遵循 Link 自身的打开方式。
5. 没有可访问 Page/Link 的 Group Item 不展示。
6. Social Media 等全部由 Link 组成的 Group 正常生成 Card 和 Link Item，Link 必须计数。
7. Card 自身 Group 重命名后，Card 标题读取最新 Published title。

示例：

```text
Guide Card
├── Introduction                         Page Item
├── Installation                         Page Item
└── Advanced                 4  →         Group Item
    ├── Configuration                    不在 Guide Card 展开
    └── Performance
        ├── Cache
        └── Runtime
```

`Advanced` 可以单独成为一张 Card；此时它展示自己的直属 Page/Link/Group。

### 10.3 Add to Cover 与祖先覆盖

已选 Cover Group 集合必须构成 Tree antichain：任意两个已选 Group 不能互为祖先/后代。

产品规则是非对称的：

- 如果父 Group 已经在 Cover，所有子/子子 Group 隐藏 `Add to Cover`。
- 后端同样拒绝绕过前端直接添加这些后代 Group。
- 如果子 Group 已经在 Cover，父 Group 仍显示 `Add to Cover`。
- 添加父 Group 时，在一个事务中删除其所有已选后代 Card，再添加父 Card。
- 新父 Card 放到被替换后代 Card 中最靠前的 index；没有后代时追加到末尾。
- 父 Card 使用默认 appearance，不继承任意子 Card appearance。
- 被替换 Card 的 Card-local 配置随 Card 删除；以后移除父 Card，不自动恢复旧子 Card。

Dashboard SideTree 使用正向状态表达：

- 只有 Group 自身直接对应一张 Cover Card 时，Group 行显示本地 Lucide
  `Signpost` 图标。
- Signpost 是只读 membership 状态，不承担点击、添加或移除操作。
- 未加入 Cover 的 Group 不显示负向 `CalendarSlash` 状态图标。
- 仅被祖先 Card 覆盖的后代 Group 不显示 Signpost，也不显示 `Add to Cover`。
- Cover Card 的添加和移除统一通过 Group More 菜单完成；直接在 Cover 中的 Group
  显示 `Remove from Cover`，`CalendarSlash` 只作为该 action icon。
- 添加父 Card 并替换后代 Card 后，刷新 Tree 时 Signpost 从后代 Group 转移到父 Group。

示例：

```text
Before:
Getting Started
Advanced          ← Guide descendant
Reference
Examples          ← Guide descendant
About

Add Guide

After:
Getting Started
Guide             ← 使用 Advanced/Examples 中最靠前的位置
Reference
About
```

前端根据当前 Public/Dashboard Tree 派生 `canAddToCover`；Backend 在事务内重新计算 ancestry
并作为最终权威，不能相信前端。

### 10.4 Navigation move 与 Publish 联动

Card identity 绑定稳定 `groupNodeId`，普通重排或换父节点不改变 Card identity。但 Tree
move 可能让原本独立的两张 Card 变成祖先/后代：

- Publish checklist 明确列出将被替换的后代 Card。
- 发布时保留最高层已选祖先 Card，原子删除其覆盖的后代 Card。
- 发布完成后重新计算所有受影响 Group Item 的 `leafCount` 和 `href`。
- Draft move 在正式发布前不静默改变 Public Cover。
- Pinned Docs 完全独立，不参与 Group ancestry 规则。

### 10.5 持久化迁移

现有 Cover 表需要从 Section/Item 语义继续收敛为 Card/Item 语义。目标约束：

```text
unique(community_id, group_node_fk)
unique(cover_card_id, node_fk)
card source node.type = 'group'
card source node.stage = 'public'
```

迁移必须审计：

- 旧 Tab source 不再合法，不能带入最终 Card。
- GraphQL `groupNodeId` 映射逻辑 `node_id`，不暴露物理 FK。
- Item 支持 `page | link | group` 投影；不得继续把 descendant Page 铺平。
- Pinned Docs 数据和 appearance 不参与本次 Card 迁移。
- 不保留 `Section` alias 或旧 `TCoverSectionAppearance/TCoverItemAppearance` 类型。

## 11. Content Import

### 11.1 目标契约

flat TargetTree 直接替换为递归 TargetTree：

```ts
type TTargetTree = {
  schemaVersion: 2
  tabs: TTargetTab[]
}

type TTargetTab = {
  sourceId: string
  type: 'tab'
  title: string
  groups: TTargetGroup[]
}

type TTargetNode = TTargetGroup | TTargetPage | TTargetLink

type TTargetGroup = {
  sourceId: string
  type: 'group'
  title: string
  pages: TTargetNode[]
}
```

只接受新 schema，不保留 v1 decoder 或 flat fallback。

### 11.2 映射

```text
Source scope at root
  → Tab

Source section
  → Group

Nested source section
  → Nested Group

Source page
  → Page

Source link
  → Link
```

没有显式 Scope 的来源进入默认 Tab，并使用语义明确的 `Overview` Group 承接直接
Page/Link；Tab 的直接子节点始终只能是 Group：

```text
Default Tab
└── Overview Group
    ├── Page
    ├── Group
    └── Link
```

### 11.3 Validator

Phoenix Validator 递归校验：

- schema version。
- maxDepth/maxNodes。
- sourceId 唯一。
- Page Doc canonical slug 唯一；Tree 本身不保存 slug。
- Group 的父类型为 Tab/Group，Page/Link 的父类型为 Group。
- 同级 title 冲突。
- SourceTree 与 TargetTree 的 source intent 一致。
- Target revision。
- 所有可导入 Page 都在 TargetTree 中且只出现一次。

counts 使用递归遍历生成，不从 UI 提交值：

```text
tabs
groups
pages
links
maxDepth
```

### 11.4 Review UI

Import `SourceTree.tsx` 改为与 SideTree 相同的递归展示模型：

- 任意层级 Group。
- Group checkbox 选择全部 descendant Pages。
- indeterminate 从 descendant selection 派生。
- Link 不可选择正文，但保留结构预览。
- 文件大小为全部 descendant Pages 之和。
- 搜索/折叠不改变 selected sourceIds。

### 11.5 Skipped Page 剪枝

单篇 Page 因 `content_too_large` 被跳过后：

1. 从 TargetTree 删除该 Page。
2. 自底向上删除没有 Page/Link/Group pages 的空 Group。
3. 删除没有 groups 的空 Tab。
4. 重新计算 counts、route 和 item/tree 一致性。
5. 若没有任何可导入 Page，则不调用 apply。

### 11.6 Writer

Writer 在一个事务内：

1. 校验 targetRevision。
2. 将 TargetTree 递归节点转换成按 parent 排序的写入计划。
3. 先写 Tab，再按 breadth-first 或 topological order 写 descendants。
4. 为 Page 写入/复用 Doc，并将 `doc_id` 放入 Page Node。
5. 写 Link。
6. 连续化每个 parent 的 sibling indexes。
7. 写 ImportSourceMapping。
8. 完成 Job。

不再存在“先创建 Tab 默认 Untitled Group，再复用或删除占位 Group”的分支。

## 12. 实施计划

本次按最终依赖顺序实施，不按旧 flat contract 分阶段兼容。

### 当前实施状态

截至 2026-07-25：

- 已完成 one-way migration、`DocTreeNode` 递归 schema 和 identity 注释。
- 已完成 Backend create/move/delete/duplicate/read、递归 Publish/Snapshot/Event/Trash。
- Restore 在原 parent 消失时返回明确错误，并支持
  `targetParentNodeId/targetIndex` 重新选择父节点；Trash Drawer 已提供行内 parent
  选择和重试，不使用 toast-only 或阻塞 modal。
- GraphQL、Dashboard、Public Navigation、Snapshot/Event/Trash 和 Import 已统一为
  `tabs[].groups[].pages[]`。
- 已完成 Demo Template 全链路删除，Tree 不再保存 slug/template/ui config。
- Cover 已切换到 `TDocCovers.cards: TDocCoverCard[]`：Card 只绑定 Group，直属投影
  Page/Link/Group，并实现祖先覆盖后代 Card。
- SideTree 已使用独立 Tree DnD controller 和统一 node identity，支持 Page/Link/Group
  跨父节点移动、顶层 Group 降级、Nested Group 提升、循环拒绝、最深合法 target 与
  折叠 Group hover 自动展开。键盘 DnD、无障碍公告和浏览器交互仍待最终验收。
- SideTree 已落实 Group-first 双 lane：Group 与 Page/Link 分别排序且不能交叉；创建时
  inline input 位于对应 lane 第一位，确认后追加到该 lane 末尾并提交最终 index。
- 任意深度 Group 内创建 Page 都会在成功后自动激活并同步 `?docId=`；多层 Group header、
  Page/Link marker 与 drag handle 已统一为递归 8px lane 对齐。
- Cover 行状态已从“未加入时显示 CalendarSlash”反转为“直接加入时显示 Signpost”；
  ancestor coverage 只负责隐藏后代 Cover action，不产生状态图标。
- Backend Docs Tree/GraphQL 针对性测试、Frontend type-check 和
  SideTree/DocThread/Cover 针对性测试已经纳入本次验收。
- Content Import 已切换 TargetTree schema version 2，Validator/Writer 保留递归
  Section；Tab 仍只包含 Group，Source Scope 直接 Page/Link 进入 `Overview` Group。
  完整七类 adapter golden fixture 和浏览器 E2E 仍属于 Phase 8–10 的最终验收项。

### 前置清理：删除旧 Demo Template（已完成）

Nested Group 开始前先删除现有 Docs Demo Template 全链路：

- 删除 `CMS.DocTree.Template` 及 `ensure/reset/delete_demo_template` 公共接口。
- Community 创建不再自动生成 Demo Tab/Group/Page。
- 删除 Demo Template 专属 `TemplateBodyBags` 和 fixture。
- 普通新建 Page 使用通用 canonical empty BodyBag，不保留模板文案。
- 从 `doc_tree_nodes` 和 `docs` 删除 `template_key`、索引、changeset 和
  Snapshot/Trash payload。
- 删除 Template 专属测试；其他测试显式创建所需 Tree fixture，不再先调用
  `delete_demo_template`。
- 存量 Demo Docs 保留为普通用户内容，仅移除 `template_key`，不得在 migration 中
  自动删除可能已经被用户编辑的内容。
- 历史 migration 不回改，使用新的 forward migration 删除当前字段和索引。

下面的 Phase 记录开发和验收顺序，并在标题中标明当前状态，不是兼容旧运行时的
Expand/Contract 发布方案。已完成 Phase 保留为设计与实施审计记录，不代表仍待开发；
部分完成 Phase 只以其明确列出的剩余验收项为 TODO。

本方案明确不考虑实现成本和向后兼容：

- 数据库 migration 一次性切换到新 contract，同时删除旧字段和旧索引。
- Backend、GraphQL、Dashboard、Public、Cover 和 Import 必须作为同一个版本交付。
- 不提供旧 GraphQL alias，不双写，也不保留旧 hierarchy helper。
- Phase 9 是整体部署前的集成验收；Phase 10 只清理遗漏的旧代码和测试，不再承担延迟删列。

### Phase 1：冻结递归 Contract（已完成）

- 定稿 `tabs[].groups[].pages[]`、`NavigationNode`、父子规则和
  `parentNodeId/index`。
- 定稿递归 GraphQL 输出和 mutation input。
- 定稿单根 subtree command 与 `publishDocChanges` closure 语义。
- 定稿 Snapshot/Event/Trash JSON。
- 定稿 `TDocCovers/TDocCoverCard`、Group-only Card source、Card Item union 和祖先覆盖规则。
- 定稿 Cover 物理 FK 与 GraphQL 逻辑 `groupNodeId` identity 边界。
- 定稿 `TDocCoverCardAppearance/TDocCoverPinnedDocAppearance` 和全链路
  `appearance` 命名。
- 定稿 `baseRevision` conflict 与编辑器 `?docId=` contract。
- 定稿 TargetTree schema version 2。
- 将本文件作为跨 Backend/Frontend/Import 的 source of truth。

验收：

- 所有层使用相同的节点类型和 parent 语义。
- migration、Ecto、GraphQL 和 TypeScript 都解释
  `id/node_id/parent_node_id` identity 边界。
- 不再出现“Group 只能属于 Tab”的目标规则。
- 不设计 v1/v2 双栈。

### Phase 2：数据库与 Ecto（已完成）

- 新增 `parent_node_id`，根据 `tab_id/group_id` 回填存量 placement。
- 同一个 migration 中完成数据审计、最终 composite FK、类型 CHECK 和 sibling indexes。
- 同一个 migration 中删除 `tab_id/group_id/slug/template_key/ui_config` 及旧索引。
- Cover 同步执行 Group → Section、外键和 `appearance` rename。
- Ecto 只声明新字段；代码中不保留旧字段的过渡 changeset。

验收：

- 全部现有节点都能得到唯一、合法的 `parent_node_id`。
- 数据审计能够阻止非法父类型、跨 stage parent 和重复 sibling index 进入整体部署。
- Draft/Public 相同 `node_id` 的 parent identity 一致可追踪。
- migration 完成后旧运行时明确不可运行，必须与新应用版本整体部署。

### Phase 3：Backend Tree Core（已完成）

- 新增通用 Tree Builder。
- 新增 ancestor/descendant/subtree 查询。
- 更新 `DocTreeNode` changeset 和类型校验，只读写 `parent_node_id`。
- 统一 create/update/move/delete/duplicate。
- 实现单根 ID 驱动的 subtree delete/restore/duplicate/move-to-draft。
- 删除 `group_parent/tab_parent` 和两套 target 参数。
- 统一 sibling reindex。
- 补 Group 嵌套、跨层移动和环检测测试。

验收：

- 可以创建至少三层 Nested Group。
- Group 可在 Tab/Group 之间移动。
- Page/Link 可在 Group 之间移动。
- 移动 Group 不重写 descendants。

### Phase 4：Publish、Snapshot、Event、Trash（已完成）

- 将 Snapshot 改为 `tabs[].groups[].pages[]`。
- Event selector 改为 `parentNodeId/index`。
- Publish Selection 增加 ancestor/descendant closure。
- Public Projection 递归过滤和剪枝。
- Trash 保存/恢复 subtree。
- Group duplicate 复制完整子树。
- 更新 diff、rollback 和 release audit。

验收：

- Draft/Public/Snapshot 对同一树得到一致 canonical projection。
- 发布 Page 不会产生缺失祖先的公共树。
- 删除、恢复、rollback Nested Group 后结构和顺序一致。

### Phase 5：GraphQL（已完成）

- 修改 DocTreeNode、DocPublicTreeNode 和输入类型。
- 删除 `tabId/groupId`，保留 Tab 的 `groups`。
- 统一 create/move/restore mutation。
- 明确 `delete/restore/duplicate/move-to-draft/publish` 的聚合根与闭包语义。
- 更新 Resolver 参数和错误 contract。
- 同步前端 generated schema/types。

验收：

- Query 只返回 `parentNodeId/groups/pages/pins`。
- 节点 placement mutation 只使用 `parentNodeId/targetParentNodeId`，不接受 `tabId/groupId`。
- Schema 中不存在旧 hierarchy 字段。

### Phase 6：Dashboard 与 DnD（主体完成，最终交互验收待完成）

- SideTree 类型改为递归 union。
- 保持 `SideTree → Group → Group[] / File | Link[]` 的递归组件边界；每个文件只定义
  一个组件，下层组件自行调用 `useSalon()`。
- Controller 保留有明确产品语义的 `addGroup/addNestedGroup/addChild` 等入口，并在
  persistence 边界统一映射为通用 node mutation。
- 搜索保留 ancestor chain。
- 展开状态使用本地 `group.expanded` view model，不进入 Backend、Snapshot 或公共
  Contract；搜索只派生临时展开状态。
- DnD 使用独立 Tree controller 和 flatten projection，显式携带
  `activeNodeId`，提交 `targetParentNodeId/index`。
- 创建和 DnD 都维持 Group-first 双 lane；Group 与 Page/Link 不允许跨 lane 混排。
- 新建 Group/Page/Link 的 inline row 位于对应 lane 顶部，确认后追加到该 lane 末尾。
- Nested Group header 与同一 parent 下的 Page/Link marker lane 对齐，每深入一层递归
  增加 8px，并让 drag handle 与完整子树同步移动。
- 删除通过前后 Tree diff 猜 moved node 的提交路径。
- 实现 `before/after/inside`、折叠 Group hover 自动展开和最深合法 droppable 选择。
- 增加客户端 Tree mutation 串行队列和 revision conflict 恢复。
- 保持 `/:community/dashboard/doc/editor?docId=` URL 不变，递归改造 active path 和 menu action。

验收：

- 三层以上 Group 正确渲染和折叠。
- DnD 可以跨 Tab/Group、同层排序和提升/降低层级。
- 顶层与 Nested Group 创建确认后均位于各自 `groups` lane 末尾。
- 顶层与 Nested Page 创建成功后均自动激活并同步 `?docId=`。
- 无法拖进自身后代或叶子节点。
- 搜索不破坏原树和排序。
- Conflict 后丢弃 optimistic Tree、全量 reload，并通过 `docId` 恢复 active path。
- 移动 Page/Group 前后编辑器 URL 不变。

剩余项：

- 完成真实浏览器中的鼠标 DnD 全矩阵验收。
- 补齐键盘 DnD 与无障碍 announcements。
- 在窄宽度和长标题下复核多层缩进、drop indicator 与 hover auto-expand。

### Phase 7：Public Navigation 与 Cover（主体完成，集成验收待完成）

- 公共 SideTree 递归渲染。
- breadcrumb、Previous/Next 改为递归派生。
- Cover 收敛为 `TDocCovers.cards: TDocCoverCard[]`，每张 Card 只绑定 Published Group。
- Card 只投影 Group 的直属 Page/Link/Group；Nested Group 使用
  `title + leafCount + href`，不铺平 descendant Page/Link。
- `leafCount` 递归统计可访问 Public Page + Link；`href` 指向 DFS 第一个可访问叶子。
- 删除 Section/Container/Tab source 和旧 appearance 类型命名。
- 实现祖先覆盖：父 Card 已选时隐藏后代 Add to Cover；添加父 Card 时原子替换所有已选后代。
- Tree publish 产生新 ancestry overlap 时，由最高层已选祖先 Card 获胜，并在 checklist 提示。
- 验证 hidden、draft、move 和 publish 对 Cover 的影响。

验收：

- 公共导航与 Published Snapshot 等价。
- Nested Group 的 Page URL 在移动前后不变。
- Cover Card 不展开 Nested Group 的 descendant Page/Link。
- Social Media 等 Link-only Group 正常生成 Card、计数和首个 href。
- 任意两个已选 Card Group 不互为祖先/后代。
- 添加父 Group 能以最早后代 Card 的位置原子替换全部已选后代。

剩余项：

- 完成 Publish checklist、Tree move 后 ancestry overlap 和 Public Cover 的浏览器级联调。
- 补齐 Link-only、空 Group、hidden/draft 组合的端到端验收。

### Phase 8：Content Import（主体完成，golden fixture 与 E2E 待完成）

- TargetTree 替换为 recursive schema version 2。
- Validator 删除 flat planning。
- Writer 按 parent 拓扑顺序写入。
- Review UI 递归展示和选择。
- skipped pruning 改为自底向上递归剪枝。
- 增加七类 adapter 的 Nested Group golden fixture。

验收：

- SourceTree 中的 Nested Section 原样进入 Nested Group。
- Source Scope 的直接 Page/Link 进入 `Overview` Group。
- 不生成 `Untitled` 占位 Group，也不允许 Page/Link 直接进入 Tab。
- Review、TargetTree 和最终 Docs Tree 结构一致。

剩余项：

- 补齐七类 framework adapter 的 Nested Group golden fixture。
- 完成 Review → Apply → Public Tree 的浏览器 E2E。

### Phase 9：整体部署前验收（待完成）

- 在隔离环境从当前 schema 完整演练一次 one-way migration。
- 同时部署 Phase 2–8 的 Backend、GraphQL、Dashboard、Public、Cover 和 Import。
- 确认运行时只读写 `parent_node_id`，不存在旧字段读取、旧 operation 或旧类型。
- 执行 Backend、GraphQL、Dashboard、Public、Cover 和 Import smoke test。
- 验收失败时修复新版本并重新演练；不设计旧运行时兼容路径。

验收：

- one-way migration 能从当前 schema 稳定执行到目标 schema。
- Draft/Public、编辑器、发布、Trash、Cover 和 Import smoke test 全部通过。
- 新 schema 中导航结构统一使用 `parentNodeId + groups/pages`。

### Phase 10：残留清理与总体验收（待完成）

- 审计所有消费者，确认不存在旧 hierarchy 字段读取。
- 删除所有 flat hierarchy helper、类型和测试 fixture。
- 删除旧 GraphQL operation。
- 更新 Bulk Import、Cover 和 Docs Editor 相关文档。
- 执行 Backend、Frontend、GraphQL、Import 和浏览器 E2E。
- Playwright 使用 `/home/xx` 社区，截图只放 `.playwright/`。

验收：

- 仓库中不再存在运行时 `targetTabId/targetGroupId`。
- `tab_id/group_id` 只允许出现在历史 migration 或迁移说明中。
- `slug/template_key/ui_config` 不再出现在运行时 `DocTreeNode` contract。
- 最终约束能够拒绝 orphan、跨 stage parent、非法父类型和重复 sibling index。
- 验收失败只能修复新 contract，不恢复旧 flat contract。

## 13. 测试矩阵

### 13.1 Backend

- 拒绝 Tab → Page。
- 拒绝 Tab → Link。
- Tab → Group → Group → Page。
- Group parent 下 Nested Group 始终连续排在 Page/Link 之前。
- Group 与 Group、Page/Link 与 Page/Link 分别支持同 lane 排序。
- 跨 Group 移动 Page。
- Group 提升到 Tab。
- Group 降级到另一个 Group。
- Group 移入自身、后代、Page、Link 时拒绝。
- maxDepth/maxNodes 边界。
- source/target sibling reindex。
- 并发 baseRevision conflict。

### 13.2 Publish/Trash

- 新祖先与 Page 一起发布。
- 移动 Published Group 后发布。
- 隐藏父 Group 后整棵公共子树消失。
- 删除/恢复三层 Group。
- 原 parent 不存在时要求 target。
- Snapshot canonical hash 稳定。
- Rollback 恢复 parent/index。
- Group move-to-draft 处理完整子树。

### 13.3 Frontend

- Recursive render。
- active Page 自动展开 ancestors。
- 编辑器继续使用 `?docId=`，Page/Group 移动后 URL 不变。
- URL docId 失效和空树 fallback。
- 搜索 Page、Link、Group。
- 搜索状态退出后恢复原展开状态。
- DnD 同层向前/向后跨多个位置时始终提交真实 active node。
- Group inline input 位于 `groups` lane 第一位，确认后移到 lane 末尾并以最终 index
  持久化；顶层和 Nested Group 均覆盖。
- Page/Link inline input 位于 `leaves` lane 第一位，确认后移到 lane 末尾。
- 任意深度 Group 创建 Page 后自动切换到新 Page，并同步编辑器 `?docId=`。
- 同一 parent 下 Nested Group 标题与 Page/Link 图标 lane 对齐；三层以上每层递归增加
  8px，drag handle 与 drop indicator 同步缩进。
- 子 Group 整体拖进空、展开、折叠 Group，后代结构保持不变。
- DnD 明确区分 before/after/inside，并优先选择最深合法 droppable。
- Group 移入自身或任意深度后代时前后端都拒绝。
- 折叠 Group hover 自动展开；搜索状态禁止拖拽。
- optimistic update 与 revision conflict recovery。
- 同一客户端 mutation queue 串行推进 revision。
- 两个编辑者并发 DnD：第二位 reload、toast、恢复 active path，不自动 merge。
- Rename/Create conflict 后保留用户输入但不自动重放。
- Create 的原 parent 仍合法时恢复带“未保存”状态的 inline create row。
- Create 的原 parent 已失效时保留 `pendingCreate`，要求用户选择位置或主动放弃。
- toast 消失、切换 Tab 和展开状态变化不会清除 `pendingCreate`。
- 深层 indent 和窄屏可用性。

### 13.4 Cover

- `TDocCovers` 不带 `Data` 后缀，GraphQL 返回 `cards/pinnedDocs`。
- Cover Card 只绑定 Group，Tab 不能成为 Card source。
- Card 展示直属 Page、Link、Group Item，不展开 Nested Group descendants。
- Group Item 的 `leafCount` 递归统计可访问 Public Page + Link。
- Group Item 的 `href` 指向 DFS 第一个可访问 Page/Link；空 Group Item 不展示。
- Link-only Social Media Group 正常生成 Card 和 Link Items。
- 父 Card 已存在时，所有后代 Group 不显示 Add to Cover，Backend 也拒绝添加。
- 只有直接对应 Cover Card 的 Group 显示 Signpost；未加入和仅被祖先覆盖的 Group
  均不显示状态图标。
- 后代 Card 已存在时，添加父 Card 原子替换全部已选后代，并使用最早后代 index。
- Tree move/publish 产生 ancestry overlap 时，最高已选祖先获胜并在 checklist 提示。
- `appearance` 只保存展示配置，内容文案不进入 appearance。
- Pinned Docs 不受 ancestry 影响。

### 13.5 Import

- Source Section 三层嵌套。
- Source Scope 的直属 Page/Link 进入显式 `Overview` Group。
- Source Group 可混合 Group/Page/Link；TargetTree 明确提示并规范化为 Group-first 两个
  lane，不声称保留来源 sibling 交叉顺序。
- Group checkbox 递归选择。
- skipped Page 自底向上剪枝。
- 全部 Page skipped 时不 apply。
- TargetTree/Writer/最终 Public Tree golden parity。

### 13.6 规模与性质测试

- 10,000 nodes、depth 32 的 read/build/validate。
- 随机树 round-trip：rows → tree → rows。
- 随机合法 move 后无 orphan/cycle。
- Snapshot canonicalization 对输入 row 顺序不敏感。
- Tree Builder、Public Projection、Target Validator 都保持 `O(n)`。

### 13.7 One-way migration

- migration 在同一版本内完成回填、审计、最终约束和旧字段删除。
- Backend、GraphQL、Dashboard、Public、Cover 和 Import 不允许新旧版本混跑。
- smoke test 失败时修复新版本并重新演练，不恢复旧 flat contract。
- Nested Group 写入一旦开放，明确只允许 roll-forward。
- 最终 schema 不包含旧 hierarchy 列，运行时不包含 alias 或双写。

## 14. 完成定义

只有同时满足以下条件，Nested Group 才算完成：

- 数据库只使用 `parent_node_id` 表达 Docs 层级。
- Tree 不保存 `slug`、`template_key` 或 `ui_config`。
- Backend CRUD、Publish、Snapshot、Trash、Rollback 全部理解子树。
- GraphQL 导航统一暴露 `tabs[].groups[].pages[]`，不暴露递归 `children`。
- 子树命令只提交聚合根，Backend 权威计算 closure。
- Dashboard 可以创建、编辑和拖动 Nested Group；DnD 显式提交真实 active node，
  支持 before/after/inside、折叠目标和整棵子树移动。
- Dashboard 的 Tree 始终保持 Group-first 双 lane；临时创建行在 lane 顶部，确认后移动
  到 lane 末尾并以最终 index 持久化。
- 任意深度 Group 新建 Page 后行为一致：自动激活新 Page，并同步稳定 `?docId=`。
- 多层 Group、Page/Link marker、drag handle 和 drop indicator 使用同一递归视觉 lane。
- Dashboard 串行提交 Tree mutation；多人 conflict 不自动 merge。
- Create conflict 的未保存输入具有可见、持久到显式处理的恢复入口。
- 编辑器始终使用稳定 `?docId=`，Navigation ancestry 不进入 URL。
- 公共站点可以递归渲染并正确计算 breadcrumbs/Previous/Next。
- Cover 使用 `TDocCovers.cards`，每张 Card 只绑定 Group。
- Cover Card 只展示直属 Page/Link/Group；Group Item 递归计算 `leafCount/href`。
- Cover Group 选择保持 ancestor/descendant antichain，添加父 Group 自动替换后代 Card。
- SideTree 只为直接加入 Cover 的 Group 显示 Signpost，ancestor coverage 不冒充直接
  membership。
- Cover 持久化展示字段统一使用 `appearance`，内容字段不混入 appearance。
- Content Import 不再压平 SourceTree。
- 不生成 `Untitled` 占位 Group。
- 不保留旧 flat runtime contract 或兼容分支。
- 整体部署前存在明确集成验收门；新 Contract 启用后只允许 roll-forward。
- 三层以上 Nested Group 的 Backend、Frontend、Import 和 E2E 测试全部通过。

最终边界：

```text
SourceTree (recursive source facts)
        ↓
TargetTree (recursive Groupher intent)
        ↓
DocTreeNode(parent_node_id)
        ↓
Draft/Public recursive projection
        ├── Dashboard SideTree
        ├── Public Navigation
        ├── Cover projection
        └── Snapshot / Publish / Trash
```
