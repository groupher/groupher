# MentionsGraph 全链路重构执行合同

> **历史证据（2026-11-04 至 2026-11-06）：**本文的 set／occurrence／初始化／重建、请求级 SQL 预算及按资源状态裁剪图标题、URL 或边的条款均不适用于 2026-11-07 当前关系实现。现行代码合同见[当前关系合同](./mentions-graph-sync-contract.md)，新目标只用全新空库，不迁 B4 内容。下文原始测量与当时的执行事实保留供追溯，不能作为本轮发布指引。

> 状态：本文记录 B0–B4 原异步投影切换合同及当时证据；2026-11-06 工作区已实施后续同步重构（当前 parser version 4），**当前拟发布实现以[同步实现合同](mentions-graph-sync-contract.md)为准**。本文 §4、§7 中的 desired/synced、投影 Outbox、`projectionPending`、`syncState` 等仅作为历史合同，不再指导新版本实施。新版本尚未部署；B2 目标容量与生产数据驱动验收仍未完成。B4 历史状态与证据见[切换手册](../../deploy/runbooks/mentions-graph-cutover.md)。
>
> 新版本运行时合同由[同步实现合同](mentions-graph-sync-contract.md)接管。本文和更早合同保留为历史记录。

> 2026-11-05 目标合同修订：与 [Doc 共享评论计划](../../migrations/comment-reaction-snapshot-counts.md#49-mentionsgraph-身份与在途合同同步) 同步，Doc 单 owner Community 下跨正文分支共用评论。Doc endpoint 改为稳定 `(doc, article_id)`，Comment endpoint 为 `comment_id`，父 endpoint 为稳定 Article/Doc；endpoint 不再保存 branch 身份。Doc 正文的真实 branch/version 仍在 source_token 中，用于选版，公开 projection 只取 owner 的当前 main。Mentions endpoint、Parser/Capture、Store、Query/NodeStatus 与初始化的身份改动及定向复验见 inventory §9.34；共享评论存储及通用 Gate 已在另一条 Replies 会话完成；本会话独立重跑的稳定身份、真实读取及产品联合证据见 inventory §9.39。原 branch 必填身份的 B1–B3 定向证据不覆盖新合同，B4 不得据旧证据放行。

## 1. 交付目标与非目标

交付与 Activity 平级的 Mentions tab。用户点击后，独立查询当前 Community 的提及关系图；目标不可读时保留允许公开的引用关系，以状态节点呈现。正文、发布、删除、重建与缓存共同保证关系不丢失，查询成本有明确边界。

已确认约束：

- 领域仍归 `CMS.ArtimentMentions`，不新增平行的 `CMS.References`。
- 图统一命名 `MentionsGraph`，替换运行时 `ReferenceMap`；分类字段统一 `type`。
- `PublicList` 收口为 `Query`；图内状态模块为 `MentionsGraph.NodeStatus`，组图模块为 `MentionsGraph.Graph`。
- 业务写入沿用现有 Command、Gate、Receipt 和事务边界，不引入 Writer 或独立发布机制。
- 关系查询使用 Ecto；不调用 `Repo.query`、`Ecto.Adapters.SQL.query`，不将整段 SQL 放进 `fragment`。本轮分页、join、union、subquery 不使用原生 SQL 替代。
- 普通文章接口不新增提及关系、图节点、状态或计数字段；普通文章读取不触发提及图查询。
- 不建设新的正文渲染器，不给正文动态加载提及状态，不新增常驻 MiniMap。
- 支持 Post、Blog、Changelog、Doc main branch、公开 User Ticket，以及已有支持范围内的 Comment；不扩展 Ticket 评论、非 main Doc 图或跨 Community 遍历。
- User 提及通知保留现有业务能力；外部 URL 仅当来自结构化 Plate `a/link` 节点的 `url/href` 时产生 URL target/occurrence，不扩展为图节点。text 节点中的裸外部 URL 不产生 URL target/occurrence。
- 不兼容旧 Mention 数据、旧 API 或旧逻辑：不回填旧关系、不双读/双写、不保留旧字段别名、配置 fallback 或双接口。B1–B3 只在隔离环境验收，B4 是唯一对外切换点。新结构从空的 mentions 数据集开始，B4 通过一次性当前正文初始化命令建立新事实；不读取旧关系，不改变保留内容及其发布版本，具体输入见第 9.1 节。

相关权威：[Content Publisher](../../architecture/content-publisher.md)、[Command 写入边界](../../migrations/cms-command-gate-lifecycle-persist-boundary.md)、[Gate](../gate/README.md)、[审核](../alert-wall/v2.md)、[Article 版本](revision-draft-target.md)。本文不建立第二套权限或生命周期规则。

## 2. 产品规则与公开边界

```text
公开文章 A ----引用----> 评论 C ----属于----> 文章 B

B、C 公开           A 的 Mentions 显示 C 正常节点
B 审核中            显示 C [内容不可用]，不能打开或展开
C 已删除            显示 C [已删除]，不能打开或展开
请求 Community 无权访问 B
                    显示 [内容不可用]，不透露 B 的标题或审核详情
B、C 恢复公开       同一个节点恢复为正常节点
```

引用方向决定关系能否公开：

| 查询情形                    | 结果                                             |
| --------------------------- | ------------------------------------------------ |
| 公开 A 的出边 A→不可读 C    | 保留边，C 是终止占位节点                         |
| 公开 A 的入边 不可读 C→A    | 隐藏该边，不暴露不可读来源                       |
| 直接请求不可读 C 作为起点   | 现有 fail-closed 错误，不生成可遍历入口          |
| 将占位 C 提交为后续展开点   | 返回不可展开状态，无邻接边、游标或内部定位信息   |
| A 发布新版本移除对 C 的引用 | 当前公开图移除 A→C                               |
| C 删除                      | 其他公开来源指向 C 的引用保留                    |
| 来源 A 删除                 | 撤下 A 的公开出边；其他公开来源指向 A 的引用保留 |

Comment 可读必须同时满足自身及父 Article/Doc 的完整公开 Scope。Doc Comment 本身不带 branch；服务端验证请求 Community 等于该稳定 Doc 的唯一 owner，再通过 owner 当前 main 正文准入。所有 Comment 公共请求显式携带 Community，批量 all_public 由 Gate 在 SQL 中解析合法入口，不从创建地或已删除的评论 branch 推断。

本轮公开状态仅为 `READABLE / DELETED / UNAVAILABLE`。明确披露规则：对公开来源已合法绑定的出边目标，允许披露该目标已永久删除这一事实，仅凭 endpoint 的可信删除墓碑返回 `DELETED`；其余不可读情况（审核、软删除、父级隐藏、无 binding、权限变化、未知原因）一律返回 `UNAVAILABLE`。不读取 ReviewBlock 来推断公开审核原因，不定义或返回 `REVIEWING/PARENT_REVIEWING`。将来展示审核原因必须另行制定公开披露合同，不能由实现方自行开启。

这个删除状态只出现在可读来源所表达的引用内，不提供全局 endpoint 存在性查询。父级永久删除时，即使 C 的 endpoint 仍在，也不据此宣称 C 已删除；仅当 C 自己的删除墓碑存在才返回 C 的 `DELETED`。不返回内部审核原因、队列、举报数或管理员信息。

### 2.1 跨 Community 链接的绑定与展示

**已在工作区实施的输入合同（2026-11-06）**：Mentions 的正文输入只识别 canonical Plate AST 中带 `url/href` 的 `a/link` 节点和带 key 的 `mention` 节点。下文未另行限定的“平台 URL”“Doc URL”“Comment URL”“外部 URL”和“canonical URL”，在目标合同中均指结构化 `a/link` 节点的 `url/href`，不包括 text 节点中的 URL 字符串。text 节点中的 raw HTML `<a>` 与裸 URL 均按普通文字处理，不产生内部边，也不产生 URL target/occurrence；初始化遵守同一规则。当前 Parser 已删除这两类 text 扫描；本地验收见同步实现合同，生产尚未验收。结构化 link 的 URL 来自节点属性；label 的纯文本部分即使与 URL 同值也不独立计数，label 内的结构化子节点仍按各自节点规则处理；两个独立 link 节点即使 URL 相同也各计一次。未来若支持裸链接，应先由 Content Publisher 产出结构化 link 节点，再另行确定历史正文处理与验收范围。实施和验收细节见[设计评审 §3/§8](mentions-graph-design-review.md)。

结构化 `a/link` 的平台 URL 按其 `url/href` 携带的 Community + inner ID（Doc 含 branch/slug 合同）定位；结构化 mention 按可信稳定身份校验绑定。两者遵守同一规则：允许记录写入当时可合法引用的目标身份，不能因为来源与目标的 Community 不同就丢弃已解析事实，也不能绕过写入校验在全局猜目标。

结构化 Plate mention 只使用编辑器已有的通用 `key` / `value`：`key` 是业务层提供的不透明选项标识，形如 `blog:<Article UUID>` 或 `comment:<Comment ID>`；`value` 只用于展示，不能作为身份依据。编辑器不解析业务类型或 ID，也不保存目标 Community、Doc branch、审核状态。CMS Parser 从 `key` 提取类型与稳定身份，资源所属 Query/FrontDesk 再核实真实类型与资格；Doc 正文选版 branch 由 owner 的当前公开 main 确定，Comment parent 身份只由稳定 article_id 确定，不含 branch。正常发布中，`@ Article` 的稳定 ID 只要存在且类型正确，即使保存前变隐藏也记录内部关系；普通 `a/link` 与其他 `@` 仍按匿名 public Scope 确认。来源 Community 不参与目标身份判定。同来源可信旧 set 的身份继承仍按 4.4 执行。初始化命令可由结构化 `a/link` 的 canonical URL 或结构化 `mention` 的稳定 ID 验证身份，其规则见第 9.2 节。

普通 URL 和非 Article 的 `@` 新绑定，以匿名 public 读者为判定主体，不采用发布者的管理员或私有权限，不要求来源 Community 等于目标 Community。结构化 `a/link` 的平台 URL 在 `url/href` 指定的目标 Community 检查完整 public Scope；结构化稳定 ID 在所有公开 binding 中批量验证是否存在完整 public Scope，多个 mirror 不构成身份歧义，因为 Article UUID/Comment ID 已唯一确定资源。Command 提供可信 actor 与来源上下文；Parser 只遍历 Plate，目标资格由所属资源 Query 和 FrontDesk 确认，不提升 GraphQL 读取权限。唯一的初始化例外见第 9.2 节：受控命令从 canonical 正文验证目标身份，不以目标当下 public 可读性过滤已有正文所表达的关系；查询披露规则始终不变。

图在请求 Community 判断目标是否可读。已成功绑定但该 Community 不可读的目标返回 `UNAVAILABLE`，不返回另一 Community 的地址、标题或额外关系。首次出现且不能合法解析的内链保留为普通链接，不创建 endpoint/图边、不伪装成已删除。Parser 必须分别测试结构化 `mention` ID、结构化 `a/link` 的带 Community 平台 URL、Comment URL 和外部 URL，并验证 text 中的裸 URL 与 raw HTML anchor 均不生成 occurrence 或 URL target；不能以某一条解析分支的现状作为全部输入的合同。

匿名与登录用户使用同一 public Scope；管理员权限不扩大此图。根节点可读不代表任意邻居都可展开。

正常用户发布/编辑的新绑定矩阵（`@ Article` 使用稳定 ID；普通结构化 `a/link` 平台 URL 的“可读”指 `url/href` 指定 Community 的匿名完整 public Scope；不用于第 9.2 节初始化模式）：

| 输入                                                            | 目标可读                                                     | 目标不可读/私密/未知                            | 目标已永久删除                                              |
| --------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------- |
| `@ Article` 的稳定 ID                                           | 校验存在与类型后绑定                                         | 存在且类型正确仍绑定，读图时脱敏；不存在不绑定  | 读取按当前删除状态披露规则处理                              |
| `@ User` / `@ Comment` / `@ Ticket`                             | 按现有公开资格绑定                                           | 新引用不绑定                                    | 仅可信上一 set 可沿用                                       |
| 结构化 `a/link` 的平台 URL                                      | 在 URL 指定 Community 解析并绑定                             | 保留普通 URL target，不产生内部图边             | 同 source 上一 set 有唯一 URL 绑定则继承，否则普通 URL      |
| 结构化 `mention` 的 Comment ID / 结构化 `a/link` 的 Comment URL | 目标自身及稳定父级均通过，Doc 父级经 owner/main 准入才新绑定 | 不绕过父级 Scope；ID 留普通文本、URL 留普通 URL | 沿用同 source 的可信旧绑定，不能用父级墓碑推断 Comment 删除 |
| 结构化 `a/link` 的外部 URL                                      | URL target，不查询 CMS 资源                                  | 相同，不探测外部可访问性                        | 相同，不探测外部删除状态                                    |

上述降级只用于身份合法但当前不可读的目标；`key` 的类型与 canonical 资源不匹配时不建边，也不从展示文字猜测身份。Community-local URL 若在指定 Community 中无法唯一定位，按第 9.2 节初始化规则明确失败。已在同 source 的可信 set 绑定的目标在审核/隐藏后编辑正文，可按 4.4 继承身份，无需重新通过活体可读检查；不能通过另一个 source 的 set 获得这种资格。普通 URL 与非 Article 提及的“第一次引用私密内容”和“公开引用后目标变私密”有意采用不同结果；`@ Article` 按已选稳定 ID 的存在与类型确认。

## 3. 代码结构与接口责任

```text
cms/artiment_mentions/
├── parser.ex                  解析引用，绑定稳定身份
├── store.ex                   事务内保存版本关系，同步当前关系
├── query.ex                   提及列表查询，复用 Pagi
├── mentions_graph.ex            图领域入口及错误收口
└── mentions_graph/
    ├── query.ex               起点校验、关系分页、批量查询、请求预算
    ├── node_status.ex         复用 Gate/Review，批量解析节点状态
    └── graph.ex               纯内存组图、节点去重、边及展开标记
```

现有 `CanonicalSource`、`SyncProgress`、`Opaque`、`PublicLocator` 和同步任务继续承担原职责，不为每个处理步骤新增模块。Mentions 查询一致性使用一个全局递增的 `revision`，不按 Community 拆分。

| 当前代码                                          | 目标归属                                 |
| ------------------------------------------------- | ---------------------------------------- |
| `public_list.ex`                                  | `query.ex`，内部调用方与 facade 同步迁移 |
| `reference_map.ex`                                | `mentions_graph.ex`                      |
| `reference_map/batch.ex`                          | `mentions_graph/query.ex`                |
| `reference_map/page_facts.ex`                     | `MentionsGraph.Query` 内部 Ecto 查询函数 |
| `reference_map/read_model.ex` 的批量资源/状态解析 | `MentionsGraph.NodeStatus`               |
| `reference_map/read_model.ex` 的节点/连线组装     | `MentionsGraph.Graph`                    |

建议领域函数（实施时补齐具体 struct/spec）：

```elixir
MentionsGraph.page(community, focus, frontiers, first)
MentionsGraph.article_comments(community, focus, after_cursor, first)
MentionsGraph.revision()
Query.page(community, focus, direction, pagi)
NodeStatus.load(community, endpoint_ids, budget)
Graph.build(relations, nodes_by_id, neighborhoods)
```

所有业务函数返回 `{:ok, value}` / `{:error, reason}`。`NodeStatus.load` 接收去重后的整批身份，返回按身份索引的结果和剩余预算，禁止调用方逐节点执行；`Graph` 不调用 Repo、Gate 或外部服务。列表需要状态时复用此批量实现，不复制 Gate 条件。列表只组装列表，不为查询列表构建整张图。

## 4. 数据职责：版本记录与当前索引分离

以下为目标表结构；迁移编号在实施时分配，使用项目现有 schema prefix。普通 datetime 为 `:timestamptz`，Ecto 字段为 `:utc_datetime`。

### 4.1 稳定提及身份 `mention_endpoints`

| 字段                 | 类型/约束                                       |
| -------------------- | ----------------------------------------------- |
| `id`                 | UUID 主键                                       |
| `type`               | post/blog/changelog/doc/ticket/comment          |
| `article_id`         | Article UUID；Comment 行为空                    |
| `comment_id`         | Comment ID；非 Comment 行为空                   |
| `parent_endpoint_id` | Comment 必填，其他为空；FK → endpoint，RESTRICT |
| `deleted_at`         | 永久删除时间，可空                              |
| timestamps           | UTC                                             |

活体身份列 `article_id/comment_id` **不建指向 Article/Comment 的 FK**，既不 CASCADE，也不 RESTRICT/SET NULL；资源硬删后稳定身份值仍在。endpoint 不保存 branch_id。创建绑定时由领域验证稳定资源归属/type，Doc 正文 main 与真实 source token 在选版时验证。endpoint 间、set 和 occurrence 的 FK 仍保留。

按 type 建 partial unique index：Post/Blog/Changelog/Doc/Ticket 都为 `(type, article_id)`，Comment 为 `comment_id`。CHECK 保证 article/comment/parent 身份互斥，Comment 必须有稳定父 endpoint。删除 endpoint branch_id 列、Doc branch unique/CHECK 和父子 branch 相等校验，不能保留 branch 可空的两种 Doc 身份。Doc 的 branch 只存在于正文 source token/真实版本元数据；非 main token 不能覆盖当前 main projection。

不保存标题、正文、摘要、路径、审核状态或创建 Community。`deleted_at` 仅由真实永久删除事务设置；软删除从现有 Lifecycle 消费并映射不可用。墓碑不是新的 CMS 生命周期。endpoint 有关系引用或子 endpoint 时不得清理。

### 4.2 版本引用记录 `mention_sets`

字段：UUID `id`、`source_endpoint_id`（FK，RESTRICT）、`source_token`、正整数 `parser_version`、timestamps。唯一键明确为 **`(source_endpoint_id, source_token, parser_version)`**。

set 是不可变版本事实，**没有 completed/ready/pending 标记**。set 与全部 occurrences 同事务提交；存在且零 occurrence 是确定空版本，set 不存在是缺事实。解析失败回滚，不能保存半成品 set。

复用 SyncProgress 的 canonical token 公式，不另起公式：

| 来源                            | `source_token`                                    |
| ------------------------------- | ------------------------------------------------- |
| Post/Blog/Changelog/User Ticket | `revision_id:publication_version`                 |
| Doc                             | `branch_id:branch_version_id:publication_version` |
| Comment                         | `comment_id:CommentBody.version:body_hash`        |

Article/Doc 只在发布命令选定公开 revision/publication version 后保存 set；单纯保存 draft 不创建公开 set。Comment 创建、更新、tombstone 按该次 canonical body version 保存 set。发布既有 revision 但 publication version 改变时，也要生成对应 token 的 set；可复用经验证的旧绑定，不重新猜目标。

### 4.3 occurrence 与当前索引的 target 列布局

`mention_occurrences` 每行表达一个正文出现位置：`id`、`set_id`（FK → set，ON DELETE CASCADE，仅随合法 set 回收）、`occurrence_key`、`mention_case`、`target_type`、`mentioned_at`、下表 target 列，以及 `editor_target_id`、`normalized_url`、`url_hash`、`block_id`、`path`。`(set_id, occurrence_key)` 唯一；occurrence_key 在该版本内由 parser 按节点位置/序号确定，不承担跨版本身份。mentioned_at 按第 7.2 节在保存 set 时确定，同一关系的 occurrences 使用相同时间。

| `target_type`                          | `target_endpoint_id`          | `target_user_id` | `normalized_url/url_hash`                  |
| -------------------------------------- | ----------------------------- | ---------------- | ------------------------------------------ |
| post/blog/changelog/doc/ticket/comment | 必填，FK → endpoint，RESTRICT | NULL             | 链接输入可保留匹配材料；不充当 target 身份 |
| user                                   | NULL                          | 必填             | NULL                                       |
| url                                    | NULL                          | NULL             | 必填                                       |

CHECK 保证三种 target 身份互斥，内部 target 的 type 必须与 endpoint 一致，领域校验加数据库约束实现，不把全部校验交给 FK。User ID 不建阻止账户删除的活体 FK，账户删除继续按既有提及/通知规则处理，不生成图节点。

当前 `artiment_mentions` 由新 DDL 直接建立以下列：`id`、`source_endpoint_id`（FK，RESTRICT）、`source_set_id`（FK，RESTRICT）、`target_type`、上述三组 target 列、`mention_case`、`edge_key`、`mentioned_at`（非空 UTC datetime）、聚合 occurrences、timestamps。不保留旧 mentioner/mentioned 双套身份列，也不写转换触发器。

保存 set 前，Store 必须验证同一关系的所有 occurrences 使用相同 `mentioned_at`；不一致则整个 set/occurrences 保存事务回滚，坏 set 不落库。投影前再次防御校验，取共有时间写入索引；若发现已有 set 损坏，回滚投影、报告完整性错误并阻止该来源验收，不通过修改不可变 set 或 MIN/MAX 掩盖差异。一跳列表的 mentionedAt 直接来自该索引列。

唯一键分别为：

- 内部目标：`(source_endpoint_id, target_endpoint_id, mention_case)`，仅内部 target 行。
- User：`(source_endpoint_id, target_user_id, mention_case)`，仅 user 行。
- URL：`(source_endpoint_id, normalized_url, mention_case)`，仅 url 行；URL 规范化 UTF-8 最大 1200 bytes，Command 超限返回稳定 `mention_url_too_long` 错误，数据库 CHECK 同步防御；url_hash 用于查询加速，不能替代原值相等验证。
- `edge_key` 全局唯一，由上述稳定关系身份确定，不含 source token/parser version；同边重复位置聚合到 occurrences。外部 URL 规范化长度固定为 1200 UTF-8 bytes，Parser/Command 与 occurrence/current-edge 两张表的 DDL CHECK 使用同一限制，避免 PostgreSQL B-tree 索引项超限。

索引只保留当前选中 set 的关系；source_set_id 必须属于对应 source endpoint。图只查询内部 target，User/URL 的提及及通知能力仍由同一套新索引承接，不使用旧表 fallback。

数据库归属约束冻结为 composite FK，不只做 changeset 校验：

- endpoint 增加 UNIQUE `(id, type)`；occurrence 和当前索引的 `(target_endpoint_id, target_type)` 引用它，保证内部 target type 相同。User/URL 的 endpoint_id 为 NULL，其 CHECK 与外键 MATCH SIMPLE 协同。
- set 增加 UNIQUE `(id, source_endpoint_id)`；当前索引的 `(source_set_id, source_endpoint_id)` 引用它，ON DELETE RESTRICT。
- SyncState 明确保存 `source_endpoint_id`（唯一、FK）；其 desired/synced set 以 `(set_id, source_endpoint_id)` 组合 FK 引用 set。synced_set_id 在初始 pending 时允许为空，desired_set_id 必须指向完整 set。
- B1 必须有绕过 changeset 的数据库负向测试：错 set/source、错 endpoint/type 均由数据库拒绝；这些约束属于新 DDL，不引入旧行兼容触发器。

### 4.4 跨版本身份继承

按以下顺序处理，每个等级存在歧义都不能继续猜测：

1. 结构化 mention 的通用 `key`：CMS 解析 `type:stable-id` 后校验 canonical type、稳定 Comment parent 与 Doc owner/main 正文准入；合法活体可绑定，可信上一版本 set 已绑定的不可读或已删除目标可沿用，包括审核、软删除和父级隐藏。不接受浏览器提交内部 endpoint ID。
2. 粘贴后形成的结构化 `a/link` 节点：使用其 `url/href` 的完整规范化 URL 查上一版本绑定；同值只对应一个 endpoint 才继承。URL hash 仅缩小候选，必须比较规范化原值。
3. block ID/path：仅在链接值或 mention `key` 相等的候选中定位重复 occurrence。位置变化不改变绑定；同位置新链接不能继承旧目标。
4. 无历史匹配时按第 2.1 节执行新绑定；首次无法解析作为普通链接。存在多个不同历史 endpoint 且无法唯一定位时返回明确的引用歧义错误，保存命令回滚，不选择任意目标。

成功继承同一关系时，同时继承 endpoint 和原 `mentioned_at`，无论目标当前可读、隐藏还是已删除；编辑位置、增减重复 occurrence、重建或 parser 升级不重置时间。关系已从上一版本移除后再次出现，按第 7.2 节使用新正文时刻，不从更早历史恢复首次时间。

不得通过裸的显示文案、路径位置或 hash 单独推断资源身份。测试覆盖结构化链接移段、结构化链接重复相同 URL、同位置替换结构化链接 URL、目标删除后再编辑，以及 source 在另一 Community 投影。

### 4.5 readiness、parser 升级与回收

SyncProgress 是唯一投影水位权威。保留现有 desired/synced content token，增加 `desired_set_id`、`synced_set_id` 及受控的目标 parser version（set FK 归属必须匹配 source）。READY 当且仅当 canonical token 与 desired/synced token 相等、desired/synced set 相同且 parser version 为当前启用版本；缺任一项即 PENDING。set 本身不决定 READY。

发布事务保存 set、desired token/set 和事件；worker 在原 source 锁顺序下核对 canonical token、desired set 及启用 parser version，事务内替换索引并提交 synced token/set。过期任务先拒绝，不因其 payload 指向旧 set 而重新投影。

parser 升级不更改 canonical token：通过既有 Command/maintenance 边界，从当前可信正文加原 set 的绑定材料生成新 parser version 的 set，原子更新 desired_set_id 并发同步事件。未生成新 set 的公开来源仍视为 pending；不因 content token 相等而跳过。投影 worker 不负责解析正文。升级重建不得通知用户。

全局 `revision` 的唯一存储是 `mentions_graph_state`：单行表，固定唯一行 `id = 1`，只含 `id` 与整数列 `revision` 两列，不存 Community、来源、epoch、时间戳或其他状态；新表预置 `{id: 1, revision: 0}`。`revision` 必须与以下操作同事务递增：发布/初始化/升级设置新的 desired set，以及 worker 替换关系并追平 synced set（包括零边结果）。它只表示 Mentions 数据变化，不按来源 binding 或 Community 分桶；任务幂等 no-op 不额外递增。B2 必测“parser 升级 pending 时 revision 变化，worker 追平后 revision 再变化”，不能仅依赖内容发布时递增。

读取规则：图/列表请求在查询前读取该行，在成功返回前再读取一次；两次值不同则整页失败并丢弃，不返回混合版本结果。cursor 绑定读取时的 revision，revision 变化后旧 cursor 明确失效并要求从首批重载；`mentionsGraphRevision` 只返回由该整数派生的 opaque revision，不加载关系或 Comment seeds。读取只按 `id = 1` 取单行，不按 Community 或来源分桶。

Article/Doc 的 set 跟随可保留的发布版本；当前/待同步/仍有合法版本引用的 set 不回收。CommentBody 无正文历史，单独采用以下规则：

- 保存新版本 set 前先读取并使用上一版本绑定材料，成功后原子更新 desired。
- 保留 canonical 当前 set、desired set、synced set，以及仍由进行中的合法事务持有的 set；不能在新正文提交前删旧 set。
- 新版本投影追平、旧事务结束后，旧 Comment set 可回收；过期任务必须先检查 token/set 并终止，不要求无限保留历史，也不提供历史正文回放。
- 来源永久删除时撤下当前出边，清理水位及其不再被引用的 set/occurrences；保留其他来源仍引用的 endpoint。所有清理沿 source 锁与 FK 顺序执行。

```text
内容选版/token + immutable set     版本事实
               │
               v
SyncProgress desired / synced      唯一投影水位
               │
               v
artiment_mentions                 可重建的当前索引
```

## 5. 写入、删除、重建及通知

### 5.1 发布与编辑

```text
可信 Publisher → 既有 Command / Gate / Receipt
    │
    └── 同一事务：正文版本 + 绑定身份的引用 set + 同步事件
                        │
                        v
                现有任务按当前发布 token 投影
```

Parser 在命令可信边界内解析，CMS 验证真实身份和上下文；浏览器不能提交可信 set。Store 不另开独立业务事务。Receipt 重放不重复写 set、不重复通知。正文没有引用也必须原子保存空 set。

异步任务只读取已保存 set，不再次通过现存 URL/目标解析关系。按第 4.5 节保留 SyncProgress 的 canonical token、set 水位比较与锁顺序；旧任务不得覆盖新发布版本、删除结果或恢复后的新版本。发布版本切换与 desired token/set、事件入库同事务；worker 替换当前索引及 synced token/set 同事务。未追平时返回 PENDING，不把旧版本关系当作当前完成结果。

### 5.2 删除与恢复

- Article/Doc/Comment 各删除入口必须盘点；更新 endpoint 墓碑或读取软删除状态、撤下来源当前出边、写同步/失效事件，均归既有 Command/Lifecycle 事务。
- 目标删除前，取得引用来源所在的受影响 Community 集合；不能只使目标自身 binding 的 Community 失效。
- 修订 `Store.purge`、`purge_article_comments`、`mark_target_state` 及所有相关 FK/所有权触发器，不能只填一个当前 no-op helper。
- Comment tombstone 正文不能覆盖其他来源指向它的关系；父 Article 或 Doc 正文 branch 删除必须保持 Comment endpoint 的稳定父级身份可解释；单独删除正文 branch 不标记稳定 Doc/Comment endpoint 已删除。
- 恢复后复用原 endpoint 和公开节点 ID；硬删除墓碑不可被普通同步任务清除。

### 5.3 重建与通知

Rebuild 读取当前发布选版对应 set 生成索引；同一输入重复执行结果一致。缺失 set 返回明确不完整状态，不把空图作为成功，不默认恢复 URL fallback。

实现入口为 `Commands.RebuildCurrentSet.execute(token, source_endpoint_id)`：校验独立的
`cms:mentions:rebuild` maintenance 能力后，在来源锁内核对真实 canonical token、desired set 与
当前版本事实，修复缺失或损坏的当前索引。相同完整索引为 no-op，不递增 revision、不移动水位时间，
不触发 Parser、发布、Activity 或通知；缺失/过期 set 明确失败。worker 也在来源锁内复核真实
canonical 选版，main 正文已移除而稳定 Doc 仍在时，旧事件结束为 stale，不重建已撤下的出边。

提及通知由原有发布语义决定，仅对允许通知且实际新增的提及发送。重建、任务重试、目标审核/删除/恢复、缓存刷新不产生新的提及通知。通知消费者仍检查现有接收者与内容可访问规则。

正常 Capture 比较同来源上一 desired set 中的显式 User recipients，将实际新增的 User ID 冻结在
同一 `mention.set_project` Outbox intent；消费者再次检查它们属于该不可变 set、canonical token 未过期、
接收者仍存在以及既有 Messaging public Gate。收件箱仍用现有 revision/body-version delivery identity
幂等插入，不重置已读状态。链接位置或显示文字变化不重发，移除后在新正文版本重新提及才允许新投递。
尚未投递的既有 User 意图只在新版仍包含该 User 时继承，不能因旧 set 过期而丢失首次通知。
收件箱行与 Outbox 的 `consumed_user_ids` 在来源锁内同事务提交；ACK 丢失或重复任务不把已投递意图
再次带入新版。初始化、重建不创建 notification recipients。支持范围保持原有普通 Article/Doc/Comment 收件箱合同；
User Ticket 保存 User/URL/内部目标事实，但本轮不扩展原先没有的 Ticket inbox thread/locator 或通知入口。

## 6. Ecto 查询、分页和预算

### 6.1 有界查询计划

1. 校验 Community、focus、frontier 和签名游标；用 typed public Scope 校验起点，先失败后查询邻接关系。
2. 每个 frontier 以 Ecto 构造出边、入边子查询。两者均 SQL 限制来源可读；Comment 来源组合父 Article/Doc 完整 Scope。同时关联 canonical token、SyncProgress 和 source_set_id，仅输出 token/set/parser version 已追平的当前关系，在 LIMIT 前排除旧版本边。待同步来源没有可用旧边，但页级 projectionPending 必须反映其未完成。
3. 两个方向分别按稳定 edge key 取 `first + 1`，用 Ecto subquery/union 合并去重、排序，再取 `first + 1`。不把全邻域加载到内存。
4. 所有 frontier 结果收集身份、去重，NodeStatus 按类型批量查询可公开字段。占位目标计入分页，不因目标不可读补扫。
5. Graph 使用身份 map/set 组装，时间复杂度为 O(节点数 + 边数)，不做边 × 全节点的嵌套查找。

目标不可读时不得在占位前预加载其 body/title。当前公开标题查询必须组合 public Scope。pending 按第 7.3 节使用 Ecto union/subquery + `exists?`，禁止 Repo.all 所有待处理候选；Article 下 Comment seed 单独分页，无需枚举全部评论。

裸 SQL 清理必须覆盖现有 PageFacts 邻接查询、ReadModel endpoint 聚合及 Batch 的 `SET TRANSACTION`，不能只改 PageFacts。新读取使用 Ecto 显式查询，读取前后各读取一次全局 `revision`；版本不同返回明确的图已变化错误并丢弃整页，客户端重载首批，不在服务端无限重试，也不依赖裸 SQL 设置隔离级别。所有影响 Mentions 查询结果的 owner 必须按第 8 节递增 revision。

列表复用现有 `Pagi`，图使用签名 cursor。若列表仍暴露 offset/精确 total，必须 SQL 计数，不允许扫描投影后内存计数；本轮图接口不提供全图 total。图 cursor 绑定 focus/frontier、排序版本及 revision；revision 变化时明确要求从首批重载，不承诺跨版本快照分页。

### 6.2 冻结预算

| 项目                           | 上限/处理                                                                         |
| ------------------------------ | --------------------------------------------------------------------------------- |
| 每请求 frontier                | 1–10，focus 可且首批必须出现一次，计入这 10 个；frontier 内重复身份拒绝           |
| 每 frontier `first`            | 1–20                                                                              |
| 邻接子查询输出候选             | 最多 10 × 2 × 21 = 420 条                                                         |
| 合并后关系结果（含 lookahead） | 最多 10 × 21 = 210 条                                                             |
| 本批关系涉及的 endpoint        | 最多 420，加去重后的 focus/frontier；不能扩展全邻域                               |
| SQL 执行次数                   | 整个领域请求最多 32，BEGIN/COMMIT 不计；Scope、状态、pending、revision 查询均计入 |
| 数据库单条查询 timeout         | 初始 2,000ms，通过 Repo 查询 option 设置，不修改全局连接配置                      |
| 图查询累计耗时                 | 初始 5,000ms，每次发出 SQL 前检查剩余时间，单条 timeout 取剩余时间与上限的较小值  |

这些是返回候选和请求工作量上限，不能声称数据库实际只扫描 420 行。源数据扫描通过匹配索引、执行计划及查询 timeout 控制。初始时间阈值只能经规模验收有据调整，SQL/分页上限不能靠调大掩盖 N+1。

Query 显式持有请求预算，沿所有执行 Repo 的内部函数传递；发 SQL 前扣减/预留，不可执行超额后才检测。**图读取调用链禁止 `Repo.preload`、Ecto preload 和逐节点 FrontDesk 加载**；关联数据经受预算管理的显式 join/批量查询取得。NodeStatus 批量调用不创建新的预算，Graph 不消耗 SQL。预算不是每个 frontier 各自 32 次。

32 次的设计分配如下，不代表现有实现已满足。B0 必须输出每一项对应的实际 Ecto 查询、调用路径和最坏组合，B2 用 telemetry 验证；不得将同一 SQL 重复记账，也不得省略 helper 内部查询。

| 阶段                                                                  | SQL 预算 |
| --------------------------------------------------------------------- | -------- |
| Community 定位及公开准入                                              | 1        |
| focus 与全部 frontier 身份合并去重后定位/准入，按六种资源类型批量处理 | 6        |
| 最多 10 个 frontier 的双向合并邻接，每个至多一条 SQL                  | 10       |
| NodeStatus：endpoint/墓碑及六类公开节点字段                           | 7        |
| Community 公开来源 pending exists                                     | 1        |
| 请求前后 revision fence                                               | 2        |
| 其他必须且在 B0 清单解释的查询余量                                    | 5        |
| 合计硬上限                                                            | 32       |

focus 是上下文起点，不是额外隐含 frontier；仅展开 frontiers 指定身份。focus 未列入时最多有 11 个待校验身份，但仍按类型合并查询；首批 [focus] 只定位一次。Comment seed 和独立 revision 请求各自有预算清单且同样不超过 32；它们不与首批 page 偷偷合并执行。若具体六类批量计划无法落在分配内，B0 必须先调整查询设计并记录证明，不以增大总上限通过出口。

预算不足返回 `mentions_graph_budget_exceeded`，本次 page 原子失败，不返回半页成功或 `hasNextPage: false`。不新增递归扫窗协议。DB timeout 映射明确的查询超时错误，不伪装成空关系。

索引至少覆盖 source endpoint + edge key、target endpoint + edge key，以及 source endpoint/source token/parser version 唯一键；来源准入 join 的 binding、branch、review 索引通过代表性执行计划确认。若 Ecto 计划无法满足预算，先调整查询/索引，不改用裸 SQL。

## 7. 专用 GraphQL 合同

沿用原功能的独立 query 形状，统一重命名为：

- `mentionsGraph`：focus 与最多 10 个 frontier 的关系页。
- `mentionsGraphArticleComments`：具有提及或待同步状态的公开 Comment seed 页。
- `mentionsGraphRevision`：仅在 Mentions tab 活跃时用于刷新判断。

精确参数沿原输入合同迁移，资源分类统一 `type`；输入使用现有 Community-local locator，输出 endpoint 使用签名/不透明 ID，不暴露数据库主键。

节点字段：`id`、`type`、`status`、`title`、`url`、`locator`、`canOpen`、`canExpand`、`syncState`。`title/url/locator` 可空；不可读节点三者均不返回真实内容，前端按 status 显示占位文案。

状态 enum：`READABLE / DELETED / UNAVAILABLE`，严格按第 2 节披露；同步 enum 为 `READY / PENDING`。占位节点是确定结果，不因不可读自动进入 PENDING。不可读目标无出边可读性承诺，公开 DTO 的 syncState 为 READY，仅表示占位展示已确定，不披露该目标内部同步情况。可读节点的同步状态消费第 4.5 节水位；PENDING 不暴露上一版关系、内容或内部同步 token。

每个 frontier 返回 edge IDs、是否可展开、`hasNextPage/endCursor`；只有可展开 frontier 才有续页。边不含隐藏正文摘录或 occurrence 私有文本。输入错误、不可读起点、无效/过期游标、预算与超时各使用现有 ErrorCat 机制分配正式错误，不手写跨端数字常量。

旧 `referenceMap*` query/type、generated operation、facade 与运行时错误名在 **B4 唯一对外切换点**移除，不保留双接口。B3 在隔离环境准备完整新合同及 UI，不提前部署对外 API 改名。普通 Article/Doc/Ticket/Comment DTO 不新增 mentions 字段。本轮不顺带删改与图无关的既有通知协议。

### 7.1 locator 与节点能力

GraphQL `MentionsGraphLocator` 与 `MentionsGraphLocatorInput` 字段同形：`type: MentionsGraphNodeType!`、`articleInnerId: ID!`、`commentInnerId: ID`。Article/Doc/Ticket 的 commentInnerId 必须为空；Comment 必填父 Article 的 articleInnerId 与自身 commentInnerId。所有 inner ID 都在顶层 Community 下解释。

Doc 的公开正文仍仅支持唯一 owner Community 的官方 main，branch 在服务器由当前公开选版解析，**locator 不接收/输出 branchId**。Doc/Comment endpoint 都是稳定身份；Comment 无 branch 校验字段，但其父 Doc 必须通过同一 owner/main Scope。稳定身份不允许借缺 branch 字段访问非 main 正文，也不新增非 main 图。GraphQL shape 相同不代表省略领域校验；type 与路径不匹配必须失败。

节点 `locator` 为 nullable 的上述 object；不可读节点为 NULL。READABLE 节点始终返回当前 locator，前端可复制其字段构造 frontier，但必须遵守 canExpand：

| status              | syncState | canOpen      | canExpand    | title/url/locator              |
| ------------------- | --------- | ------------ | ------------ | ------------------------------ |
| READABLE            | READY     | true         | true         | 当前公开值                     |
| READABLE            | PENDING   | true         | false        | 当前公开值；不可返回上一版关系 |
| DELETED             | READY     | false        | false        | NULL                           |
| UNAVAILABLE         | READY     | false        | false        | NULL                           |
| DELETED/UNAVAILABLE | PENDING   | 不允许该组合 | 不允许该组合 | 不输出内部同步状态             |

PENDING 表示关系尚未追平，不否定当前正文可读；其 frontier 返回空边、无续页并通过 projectionPending 解释未完成。READABLE+READY 的 canExpand=true 表示允许查询邻域，不保证有边。focus 可出现在 frontiers 中一次且计入上限；重复判断按解析后的稳定身份，不能用不同 locator 写法绕过。

### 7.2 一跳列表 API

保留独立根 query `mentions` 与 `mentionedBy` 的业务能力，不把它们混入普通 Article 字段，也不作为旧逻辑兼容入口。B2 在隔离环境实现并验证本节新查询/DTO；B3 生成并接入新 schema；B4 才将新实现作为唯一运行时入口对外切换，旧实现不与新实现并行：

```graphql
mentions(community: String!, source: MentionsGraphLocatorInput!, pagi: PagiInput): ArtimentMentionPage!
mentionedBy(community: String!, target: MentionTargetInput!, pagi: PagiInput): ArtimentMentionPage!
```

`MentionTargetInput` 字段为 `type: MentionType!`、`locator: MentionsGraphLocatorInput`、`userLogin: String`，明确为互斥选择：内部 type 必填 locator 且与 locator.type 相同，USER 仅填 userLogin，URL 不接受为反向 target；不能传内部主键。User 入边只用于现有可公开 User 资料，账户不可公开/删除时 fail closed。所有调用都显式传 Community，使用匿名 public Scope，resolver 只适配输入并调用 ArtimentMentions.Query。

`ArtimentMentionPage` 为 `entries`、共享 `pageInfo`（沿 Pagi）、`projectionPending`；Pagi 默认 20、最大 20，offset 计数由同一来源公开 Scope 的 SQL 完成，cursor 使用稳定 edge key。SQL/超时预算沿第 6 节，独立列表分配固定见 [B0 inventory §5.3](mentions-graph-b0-inventory.md#53-一跳列表独立预算)：已分配保守上界 20、请求硬上限 32，含 source/target NodeStatus、Community pending、offset count 和前后 revision fence；原有输入/输出按此新合同一次替换，不保留双 shape。

每个 entry 返回 `id`、`source`（公开节点）、`targetType`、`target`（内部节点/User/URL 的 union）、`mentionCase`、`occurrencesCount`、`mentionedAt: DateTime!`：

- 内部 target 共用 NodeStatus；公开来源的不可读 target 返回占位；mentionedBy 始终过滤不可读来源。
- User target 仅包含允许公开的用户定位与显示信息；不可公开时返回 type=USER 的不可用占位，无 login/URL/个人信息；URL target 仅返回按现有 URL 安全规则接受的链接，不做外部探测。
- union 成员为内部 `MentionsGraphNode`、`MentionUserTarget`、`MentionUrlTarget`。User DTO 仅 `type: USER`、`status: READABLE/UNAVAILABLE`、nullable `login/displayName/url`；URL DTO 仅 `type: URL`、`url: String!`，不返回远端标题/可用状态。source 使用当前 Community 的公开 locator，不引入 User/URL 图节点。
- 当前索引新增 `mentioned_at`。首次关系从 source 选中正文的时间取得（ArticlePublic.updated_at / DocPublic.updated_at / CommentBody.updated_at）；同一 edge 延续保持原值，关系移除后重新出现使用新正文时刻。初始化取当前 canonical 正文已有时刻，不使用初始化运行时间。
- set 保存可重建的该时间材料；rebuild、parser 升级及任务重试不得重写时间。初始化不承诺恢复旧历史 first-mentioned 时间。

首批 tab 使用 mentionsGraph，不额外请求这两个列表；它们继续服务一跳消费场景，不改变 Mentions tab 懒加载约束。

### 7.3 页级 `projectionPending`

`mentionsGraph` 页必须返回 non-null Boolean `projectionPending`。Scope 为：当前请求 Community 内、六类受支持且当前匿名 public Scope 可读的全部来源（包含符合稳定父级及 Doc owner/main 准入规则的 Comment），是否存在第 4.5 节定义的未完成投影。隐藏来源不计入，管理员身份不扩大范围。

该字段不能只检查本页已出现节点，因为尚未投影的入边来源可能还没有任何边。Ecto 从符合 public Scope 的 canonical 来源出发，LEFT JOIN 水位/set，覆盖缺水位、缺当前 set、token 不一致及 parser version 升级；通过有界存在性结果返回，不全量加载候选。缺失事实返回 pending，同时触发已有巡检/修复告警，不在读取内写库补 set。

`hasNextPage` 仅表示当前投影中该 frontier 是否还有关系；`projectionPending` 表示 Community 投影是否追平，两者独立：

| hasNextPage | projectionPending | 展示含义                                             |
| ----------- | ----------------- | ---------------------------------------------------- |
| false       | false             | 当前 frontier 没有更多，当前 Community 投影已追平    |
| false       | true              | 当前已投影关系暂时没有更多，不能显示“关系已完整加载” |
| true        | 任意值            | 当前 frontier 还有已投影关系可翻页                   |

true 不保证随后一定新增边，也不披露待处理数/来源身份。前端只在 tab 活跃时有限重试；初始最多 120 秒，每次间隔不小于 5 秒，超时显示“投影尚未完成”与手动重试，不自动扫遍 Community。seed 页也返回相同 Scope 的 projectionPending，避免把 pending 评论误判为无提及。

## 8. 前端入口、展开及缓存

```text
打开文章 → 普通文章请求 → 正文
                         │
                  关联 Ticket 状态区       独立区域，位于 Footer 上方
                         │
                    ArticleFooter
                    只挂载选中的 tab
                  /        |        \
             Activity   Mentions   Members
                |          |          |
           自己的查询   useMentionsGraph  自己的查询
                           |
                       当前对象一页关系
```

- 所有 Footer tab（含后续新增 tab）统一“选中 → 挂载 → 组件内 hook 加载”，不先挂载全部面板再用 CSS 隐藏，不在父层或 loader 预请求未选中 tab。默认 Activity 已被选中，可以首屏加载；未点击零 Mentions 请求不等于禁止默认 Activity 请求。切回按 TanStack Query 缓存/stale 策略处理，不强制每次重新下载。
- `frontend/core/unit/ReferenceMap` → `MentionsGraph`；`useReferenceMap` → `useMentionsGraph`，文件为 `MentionsGraph/useMentionsGraph.ts`；`query/referenceMap.ts` → `query/mentionsGraph.ts`，相关类型、locale、测试同步命名。hook 放在 MentionsGraph 内，组件挂载自动查询是预期行为。
- 移除 ArticleView、Comment list、Doc/Ticket route 中旧图的常驻或行内挂载；普通文章读取、SSR loader、hover prefetch 不发送图请求。
- 首次打开 Mentions 发一条当前 focus 的 `mentionsGraph` 图页（`frontiers = [focus]`、`first = 20`），并独立启动低频 `mentionsGraphRevision` fence 查询；revision 查询不加载图边或 Comment seeds。首次不自动查询 seeds/一跳列表，也不自动穷尽 BFS。Comment 按钮直接进入时当前 focus 即为该 Comment，不先查询文章关系。
- Mentions 内的“查看评论提及”才触发 `mentionsGraphArticleComments`，参数用页面所属 `articleFocus`。选择 seed 后切 Comment focus，返回文章恢复 articleFocus。Doc 没有完整 Comments List，使用同一个面板内入口；Doc main branch 仍由服务器校验。Ticket 不提供 Comment seeds。
- 独立 revision 轮询在首次 page 结束后启动，初始间隔 30 秒；关系展开/更多由用户操作触发。保留前端 150 节点、300 边、每轮最多 10 请求的呈现防线，达到上限显示未全部展开。
- 不可读节点展示状态且没有 href，不加入展开队列。READY 占位不触发节点 pending 重试；页级 pending 按第 7.3 节处理。
- 所有 tab 离开后停止轮询、取消无人继续使用的请求；不因卸载一个实例而取消其他实例仍观察的共享查询。page/seeds/revision、Activity 及本轮改动的 Comments queryFn 都把 `{signal}` 传到 browserGraphQLRequest/fetch；不只丢弃旧响应。已完成或无法中止的响应仍用请求代次隔离，abort 不当成业务错误重试。
- 图 cache key 包含 Community、focus、frontier/cursor 和合同版本；不按 viewer 扩大图的 public Scope。Activity 缓存遵守它自身的权限语义，不能把私有/管理结果共用为公共缓存。切换 Community/focus/账户不串响应。
- 发布、审核、删除、恢复等 Mentions 数据变化递增全局 `revision`，使图缓存失效。读取仍执行当前公开 Scope，缓存 TTL 不能延迟权限收紧；若无可靠失效信号，上线前关闭图结果的跨请求服务端缓存。前端收到失效先移除敏感字段再重载；重新进入图校验 revision。
- 一文件一组件，子组件自行引用 salon，不传父级 salon 对象。不新增 Mentions Context 或全局事件；服务端结果仍归 TanStack Query，store/local state 只保存 UI 状态。

宿主和明确的 props/callback 合同见 [B0 inventory §6.1](mentions-graph-b0-inventory.md#61-tab-宿主与组件接口b3-实现)：ArticleView 保存 `{activeTab, focus}` 并通过 Viewer → PostViewer/ChangelogViewer → ArticleFooter 传递，Comments 子树通过 onShowMentions 回调更新同一 state。Footer 为受控组件。Doc Article 在反馈区后接 Footer，本地管理相同 UI 状态；页面所属 articleFocus 与当前查看的 Comment focus 分开。TicketDetail 使用下述默认收起的独立 Mentions 入口，不挂没有公开读取合同的 Activity 面板。切页面重置默认 tab，显式选择评论/返回文章保持 Mentions，不重复创建状态 owner。

**Activity 接入为本轮 B3 必做项。** Post/Blog/Changelog/Doc 使用现有 `articleLogs(article, pagi)`，Activities 挂载后由 `useArticleActivity` 与 `query/articleActivity.ts` 查询，支持分页、加载、错误重试及取消。删除 mock 活动；成功空结果才显示空态，撤销“Doc 固定空态”和父层预取活动的方案。前端仅展示后端活动，不通过 Ticket 更新或状态拼装时间线。

Post Activity 涉及 Ticket 的内容仅为该 Post 创建或关联 Ticket 的事件；Ticket 状态变化和 Ticket 文字更新不属于 Post Activity。B3 按 §8.3 新增 PostLog 事件，由后端负责事实记录、权限与公开投影；ArticleLog 不合并 TicketLog，前端不合并多个接口或推导历史。Post 的 `postTicketProgress` 则是关联 Ticket 当前状态/完成数量/链接，独立显示在 ArticleFooter 上方，先用简洁 UI，随该区域挂载查询，不受 tab 切换影响。`ticket.updates` 是 Ticket 自身的文字更新记录，保留独立语义，不作为 Activity 的输入；撤销“把 updates 搬到 Activity”的方案。

**Ticket 页范围已冻结。** 本轮增加的是 Post 创建/关联 Ticket 的公开活动，不新增 Ticket 自身的公开 Activity API，也不开放 TicketLog 的内部事件。撤销此前“Ticket 新挂 Footer 并默认 Activity”的目标：`frontend/community/src/routes/$community/ticket/$id.tsx` 的 TicketDetail 保留现有 updates 区域，将常驻图换成独立的“Mentions”展开/收起按钮。页面本地 `mentionsOpen` 初始为 false，focus 固定为当前 User Ticket；点击才挂载共享 MentionsGraph，收起即卸载并取消无消费者请求，切 Community/Ticket 时重置收起。这里没有伪造的 Activity/Members tab，也没有 Comment seeds。Post/Blog/Changelog/Doc 继续使用默认 Activity 的 ArticleFooter；所有实际存在的 Footer tab 仍遵守同一挂载加载规则。Ticket 自身的公开 Activity 若未来需要，另立读取和披露合同，不作为 B0–B4 的隐含交付项。

### 8.1 重命名范围与密钥

| 对象                                                                                           | B4 后名称/处理                                                                                                                                                               |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Elixir ReferenceMap 模块、目录、facade 调用                                                    | MentionsGraph；查询版本列名为 `revision`，Opaque 等职责保持原样                                                                                                              |
| `referenceMap*` 图 GraphQL query/type/operation、对应生成物、前端组件/hook/query 文件与 locale | mentionsGraph / MentionsGraph 对应命名，旧图入口删除；不包含一跳 API                                                                                                         |
| 一跳 GraphQL 根 query `mentions` / `mentionedBy`                                               | 保留这两个业务名，B4 替换为第 7.2 节的新输入/DTO/实现，不保留旧 shape                                                                                                        |
| 一跳类型 `ArtimentMentionPage`                                                                 | 名称保留，字段按第 7.2 节重建；其旧条目类型 `ArtimentMention` 同名采用新 entry 字段，不映射旧字段；User/URL target 按新 union 定义                                           |
| `reference_map_*` 图错误名                                                                     | `mentions_graph_*`，通过 ErrorCat 生成；`cms/error_cat.ex` 既有五项保留 4549–4553 编号和含义，定义/调用/测试同步改名，不留别名；新增预算等错误另行登记，见 B0 inventory §6.2 |
| `REFERENCE_MAP_CONTENT_CHANGE` 及事件字符串                                                    | `MENTIONS_GRAPH_CONTENT_CHANGE`、`groupher:mentions-graph-content-change`                                                                                                    |
| 前端 query key                                                                                 | `['mentions-graph', contractVersion, community, ...]`，旧缓存整体丢弃                                                                                                        |
| Ecto schema 物理表 `reference_map_revisions`                                                   | 当前新图单行表经迁移命名为 `mentions_graph_state`，只含 `id` 和全局整数列 `revision`（固定 `id = 1`）；B4 切换时删除旧图 revision 数据/表，不迁移旧计数                      |
| 应用配置 `reference_map_key` / `reference_map_key_version`                                     | `mentions_graph_key` / `mentions_graph_key_version`                                                                                                                          |
| 对应部署环境变量 `REFERENCE_MAP_KEY` / `REFERENCE_MAP_KEY_VERSION`                             | `MENTIONS_GRAPH_KEY` / `MENTIONS_GRAPH_KEY_VERSION`，部署配置一起切换，无旧变量 fallback                                                                                     |
| 测试 sandbox 配置、遥测图事件名                                                                | 同步改为 mentions_graph 命名，B0 清单逐项列明                                                                                                                                |
| 历史 migration、明确标注旧运行时/历史的文档与旧证据                                            | 唯一命名豁免，保留原名以准确记录历史；不作为运行时兼容入口                                                                                                                   |

节点/边身份仅在相同 Community、稳定身份和密钥版本内保持不变。新密钥至少 32 字节，所有实例使用一致的版本和配置；缺失或不一致时关闭图 API，不能生成随机临时 key。B4 直接使用新配置，不兼容旧 node ID/cursor。

后续密钥轮换先暂停图 API/签发并使在途图响应失效，递增全局 `revision` 并审计变更，再统一切换密钥和递增 key version、清除服务端与前端图缓存后恢复；失败时保持入口关闭直到配置一致。旧 ID/cursor 一律失效，客户端明确清空图并从 focus 重载；不接受旧密钥解码 fallback。轮换测试覆盖版本失配、旧游标拒绝、旧缓存移除与重载。轮换只影响公开 ID，不改变 endpoint/关系事实。

### 8.2 Article / Comments 状态组合命名

- `useArticleState`：单篇；`useArticleStates`：一组文章，例如普通翻页的当前页，继续保留。
- `useArticleStatesByChunks` 改为 **usePagedArticleStates**：多页累积展示时保留各页查询身份，避免追加页改变旧页的查询分组；不保留旧名别名，不为改名增加包装层。
- `useCommentPages` 改为 **usePagedCommentStates**：已取回评论页的 viewerState/已确认写入结果组合；分页容器继续负责取页、pageInfo 和翻页。具体文件与调用方见 inventory §6.3。
- 选择依据是 UI 是否累积多页，不是 cursor/offset 协议。普通换页替换列表可用 useArticleStates；offset 加载更多也可以使用多页入口。缓存过期仍可重新请求，不承诺旧页永不刷新。
- Comments 维持公开分页内容（含公开计数）与按页批量 viewerState 分离；store 保存编辑/回复/折叠 UI，不保存第二份服务端列表。头部 commentsState 混合 summary/isViewerJoined 的现状单列记录，本轮不扩展为 summary API 重构。
- B3 补齐 comment.ts page/infinite/reconcile 的 AbortSignal；已有 viewerStates signal 保留。所有改名保持原分页边界、回执合并、去重和账户隔离测试，不能只改名称却改变数据归属。

### 8.3 Post 创建/关联 Ticket 的事件合同（B3 实现）

当前 `Activity.ArticleLog` 按 handler 读取单一日志表；Post 对应 `Activity.Post` / `Activity.Model.PostLog`，尚无以下两种 action。B3 固定为扩展 PostLog，保留既有 `articleLogs(article, pagi)` 入口及分页顺序，不读取或合并 TicketLog：

| 操作与现有落点                                              | 新 PostLog action  | 记录规则                                                              |
| ----------------------------------------------------------- | ------------------ | --------------------------------------------------------------------- |
| 从 Post 创建 User Ticket：`CMS.Tickets.Persist.create_user` | `ticket_created`   | Ticket 和来源关联创建成功时记录一次；这一操作不额外生成 ticket_linked |
| Post 关联已有 Ticket：`CMS.Tickets.Persist.link_source`     | `ticket_linked`    | 仅实际新增 TicketSource 关系时记录；已有关系的成功返回不新增事件      |
| Ticket 改 work status、发布/替换文字更新、解除来源关系      | 无新增 Post action | 不复制 TicketLog；本轮只新增上述创建/关联两种 Post 事实               |

- 写入 owner 仍是相应 Ticket Command 的持久化事务，调用 Activity 以来源 Post 为 stream；`article_id` / subject 为 Post，target 为 Ticket 稳定身份，Community 来自该操作验证过的请求绑定。禁止通过任取第一个 binding 决定 mirror Post 的 Community。
- actor、UTC occurred_at 和 command 的 operation_ref 沿用 Activity 标准字段；两个资源各自的事件使用既有 event_ref / operation_index 规则，不共享一个事件身份。PostLog 写入失败时，Ticket 创建/关联和同事务日志一起回滚；命令回放、事务重试及已存在关联均不得重复记录。
- `Activity.Post.contracts` 新增上述 action，公开 surface 仅为 `:article_log`；`Activity.Model.PostLog` action 枚举及对应数据库 action check 同步扩展。现有 TicketLog 事件保留自己的语义；本轮不扩展 CommunityLog，也不补写历史 Post 活动。
- 公开 DTO 由后端投影。读取先沿现有 ArticleLog 准入验证 Post，再按请求 Community 的 public Scope 批量解析 Ticket target；允许公开时提供当前标题/链接。Ticket 不可公开、删除或无该 Community 投影时，保留“创建/关联 Ticket”的 Post 事件和时间，但 target 的身份、标题、链接及 snapshot 不对外返回，仅显示“Ticket 不可用”。不得从写入快照恢复隐藏信息；即使读取者有内部权限，该公开面也不扩大目标披露范围。该页 target 去重后批量读取，禁止每条日志单查。
- B3 落点包含 `cms/tickets/persist.ex`、`activity/post.ex`、`activity/model/post_log.ex`、PostLog action 约束 migration，以及 `activity/article_log.ex` 的安全 target 投影；GraphQL DTO/生成物及前端 Activity 文案同步。纯事件格式化仍归 Activity，前端只展示响应。
- 验收从真实 Command 到 `articleLogs`：创建一条且不额外关联；新关联一条；重复关联/命令回放零新增；失败全回滚；解除后重新关联按新操作记录一次；状态/文字更新零新增 PostLog；隐藏 Ticket 不泄露 target；Post 本身不可读时拒绝；mirror 请求 Community 正确；分页顺序稳定且 target 批量读取。精确测试命令见 inventory §7.2。

## 9. 实施批次与出口

**B4 是唯一对外 cutover。** B0–B3 是隔离环境的开发/验收批次，不把 B1 的新写入、B3 的新 API 或 UI 提前部署到仍运行旧逻辑的环境。允许分批提交，不维护 B1–B3 与旧运行时的兼容矩阵；旧程序不读取新表，新程序不读取旧行。

| 批次              | 必做事项                                                                                                                                                                                                                                                           | 出口证据                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B0 盘点与失败用例 | 冻结全部当前正文初始化集合、初始化绑定模式、命令方案、旧异步 writer 停机清单和全局 revision 读写规则；列全发布/删除/恢复/重建/通知入口、FK/触发器、parser 分支、所有图挂载点；列每阶段 SQL 分配、所有隐式 preload/裸 SQL、取消 signal 路径及重命名清单；补失败用例 | 文件/函数/入口清单；32 SQL 的具体计划；signal 与首批请求断言；目标环境初始化范围；无业务实现已完成声明                                                                                                |
| B1 数据与命令     | 在隔离空 mentions 数据集直接建立新 DDL；canonical token + parser version 的不可变 set；删除、身份继承、Comment 回收、唯一水位及通知幂等                                                                                                                            | 新结构约束、空 set、旧任务乱序、parser 升级、删除和重建测试通过；一次性初始化命令幂等、覆盖全量当前来源且不发布/通知；不存在旧列兼容/旧行回填代码                                                     |
| B2 Ecto 读取      | Graph Query/NodeStatus/Graph 与第 7.2 节一跳 Query；所有新读取去裸 SQL/preload；父级 Scope、公开状态、页级 pending、分页预算、revision fence 与失效                                                                                                                | 图及一跳边界/预算测试通过、代表性执行计划；SQL≤32；隐藏来源不计 pending                                                                                                                               |
| B3 接口与产品     | 隔离环境准备完整新 GraphQL/generated；全部 Footer tab 按需挂载；本轮接真实 Activity、§8.3 PostLog 两类 Ticket 事件；独立 Ticket 状态区；Mentions/Doc Comment seeds；状态 hook 改名、Comments/图/Activity 取消                                                      | 六类入口及真实 Viewer/callback 集成；未选中面板零预请求、实际 abort、活动边界及缓存隔离测试；Ticket 独立 Mentions 默认收起且不查询 Activity；PostLog 事务/幂等/公开投影测试；可供 B4 发布的新版本构建 |
| B4 一次切换与验收 | 关闭旧入口及同步/异步写入；按 9.1/9.2 初始化全部保留当前正文；部署 B3 构建及新配置；删除旧运行时 API/逻辑/旧图数据；启用并验收                                                                                                                                     | 全量初始化及新命令创建数据的零未解释差异；必跑门禁、切换与回退演练、目标环境记录完整                                                                                                                  |

### 9.1 无兼容的一次性切换

执行顺序固定为：

```text
关闭旧图入口并暂停受影响内容写入
    → 停旧 cron/CLI/worker，终止或排空在途任务及旧 Outbox（见 9.3）
    → 保存环境快照及初始化范围记录
    → 移除旧 Mention/水位/图 revision 数据及冲突约束
    → 直接建立新结构（必需列从创建时 NOT NULL）
    → 部署仅新逻辑/API/UI/生成物/配置的构建
    → 执行一次性当前正文初始化命令，覆盖冻结的全部来源集合
    → 验证 set/水位/索引覆盖与零副作用，再用新命令创建验收内容
    → 完整验收后开放 Mentions tab 和写入
```

不安排 nullable 过渡、旧行 backfill、新旧边对照迁移或不可恢复旧边的接受流程。当前正文初始化明确允许，但只读取 canonical 正文及新结构，不读旧 mentions/水位/旧失败 manifest。旧 mentions 数据不在保留范围，不承诺恢复旧系统已经丢失的关系。旧 schema 定义、触发器及水位表由迁移显式删除/重建，不能只清数据却留下旧级联约束。

不把“不兼容 mentions 数据”解释为授权清空 Article、Comment、账户或其他业务数据。B0 必须列出目标环境的具体初始化表与受影响范围，并冻结第 9.2 节的全部当前正文输入集合。保留的既有内容统一通过一次性当前正文初始化命令生成新 set，不要求重新发布或更新，不改变 revision/publication version，不读取旧关系。这是从权威正文建立新事实，不是旧行 backfill 或旧逻辑 fallback；缺 set 仍为 pending，不可通过忽略既有来源通过验收。本次文档修改不执行数据删除或初始化。

验收核对对象是**一次性初始化生成的新事实及新合同下的新写入**：全部保留当前正文与 set、当前索引、水位及公开输出一致；缺 set、重复 endpoint、正文 source token/main 选版错配、owner 冲突、未知来源为零。重建两次结果相同，通知发送数为零。“零未解释差异”不要求新结构重现旧历史；任何新链路关系缺失都是缺陷，不能通过书面接受绕过门禁。

切换失败先关闭新入口/写入。恢复写入前可恢复整套快照与对应旧构建；恢复后若已产生新数据，不直接回退旧代码读取新结构，采用前向修复，或明确处理新写入后整体恢复快照。不存在旧 API fallback 或双写回退路径。

生产停机、排空、迁移、初始化和恢复步骤必须按 [MentionsGraph 一次性切换运行手册](../../deploy/runbooks/mentions-graph-cutover.md) 执行。删表迁移的显式确认值为 `drop-legacy-mentions:<actual-database>:writers-drained`；只有在 API/worker/CLI 已停止、旧事务结束且旧任务/outbox 已逐类终结并留存证据后才可设置。

### 9.2 一次性当前正文初始化命令

选定方案为新增 `ArtimentMentions.Commands.InitializeCurrentSets.execute`，只通过受控运维 CLI/release 入口执行，不公开 GraphQL。复用 CMS Command 的事务与规范业务返回；执行身份须具备明确的 CMS maintenance 服务能力，B0 必须列出对应 registry 校验和实际命令入口，不能以任意用户或未鉴权 CLI 执行。

初始化输入集合 S 固定为全局去重的：

- Post/Blog/Changelog 和 User Ticket：存在当前 ArticlePublic 的受支持 Article，读取其当前 revision/snapshot。
- Doc：每个官方 main branch 当前 DocPublic 及对应 branch version/revision/snapshot。
- Comment：上述受支持父资源下仍存在的 canonical CommentBody，包含当前 tombstone 正文；无 Ticket Comment；Comment 无 branch 归属，Doc 父级是否有当前正文选版仍按 S 的既有边界判断，不把 preview 审阅变成来源。
- 来源是否因审核/隐藏暂时不可读不改变其选版事实，仍纳入 S，以免恢复后缺 set；仅 draft、无任何当前公开选版的 Article/Doc 不纳入。缺正文、非法父级/branch 和身份冲突列为错误，不能静默跳过。

B0 记录 S 的选择谓词、分页顺序、各类型数量与来源 fingerprint；B4 暂停写入后生成最终 manifest（source identity、canonical token、正文 hash、parser version、确定的 mentioned_at），以此为覆盖分母，而非本轮几条验收样本。manifest 不含正文/私有标题。

命令具备 report/apply 模式及分页 checkpoint（单页最多 100 来源）。按 source 取得既有规范锁顺序，核对 manifest token，以服务器内部 `binding_mode: :initialize_current` 调用新 Parser；同事务保存不可变 set/occurrences、desired/synced 水位和当前关系索引，调用与正常投影相同的内部 helper 并递增全局 `revision`。不调用发布、Comment 更新、Activity 或提及通知入口，不发送内容发布事件。初始化期间不开正常同步 worker；失败页记录逐来源错误，可按 checkpoint 重试。

初始化专用绑定规则：

| 当前 canonical 正文中的目标                                                            | 身份验证与处理                                                                                                                                                                  |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 全局稳定身份（Article UUID / Comment ID），资源仍存在                                  | 验证 type 和稳定父级，Doc 验证唯一 owner；branch 仅用于正文 source token 选版，按稳定身份创建 endpoint；Article 有多个 mirror binding 不构成歧义，不选择某个 binding 作为其身份 |
| 结构化 `a/link` 中带 Community 的平台 URL                                              | 通过 URL 的 Community + inner ID 和现存权威 binding 定位；验证 type/Doc main branch/Comment 父级，不套目标 public 过滤                                                          |
| 目标审核、软删除、父级隐藏或 Community 私密                                            | 身份可验证则保留内部边；读取仅返回 UNAVAILABLE；恢复可读后同一边/节点恢复 READABLE                                                                                              |
| 目标永久删除，但仍有可验证身份及权威删除记录                                           | 可以建立带 deleted_at 的 endpoint；不从 Gate 未命中或正文显示文案猜墓碑                                                                                                         |
| 没有可验证身份/已删除且所有身份记录都不存在                                            | 结构化 `a/link` 保留为普通链接，结构化 `mention` 保留其显示文本，并在初始化 report 记录无法绑定原因；不读取旧 mentions 补身份，不承诺重建已消失的历史事实                       |
| 身份证据冲突、Community-local locator/URL 在指定 Community 内无法唯一定位、branch 错配 | 明确失败并阻止该 source 验收，不能任选目标或降级掩盖错误；全局 Article UUID 的多个 mirror binding 不适用此错误                                                                  |

该模式只由已鉴权的 InitializeCurrentSets 命令设置，输入只能从第 9.2 节冻结的 canonical 正文读取；GraphQL、浏览器、导入参数和普通发布 Command 不能指定它。Parser 仅取验证身份所需元数据，不加载目标私有正文或把私有标题存入 set。初始化新事实可以包含不可读目标的身份，但公开响应仍按第 2 节裁剪，不能借初始化模式扩大正常发布者的权限。

manifest 为每个候选记录解析结果、绑定身份或明确不能绑定原因；apply 必须与 report 的身份结果一致。身份证据在冻结窗口内变化时终止并重新 report，不能让不同分页次序决定关系。引用链目标无需属于来源集合 S，只要满足上述受支持身份校验就可绑定。

初始化扫描不从来源 ArticleBinding 选择 Community，也不统计来源绑定数参与目标解析或来源 fingerprint。全局稳定 ID 只由目标 canonical 身份定位；Doc UUID 必须由目标自身唯一的 main owner 确定 branch，目标有多个候选 owner 才报歧义。结构化 `a/link` 中带 Community 的平台 URL 只使用 `url/href` 指定的目标 binding。来源新增 mirror binding 不改变正文引用事实，也不使未变化的初始化报告失效。

初始化 Comment target 时，先验证 canonical Comment 的 article_id/thread，再创建或复用稳定父 Article/Doc endpoint，最后以 parent_endpoint_id 创建 Comment endpoint。父资源没有 public selection、因而不在 S，也照此创建 auxiliary endpoint；不为它伪造 source set、水位或发布选版。Doc 父 endpoint 为 `(doc, article_id)`，Comment/parent 不携带 branch。Doc 正文源仍需真实 main branch/version 的 source token，不能将 preview 选版混入公开 projection。全局 Comment ID 的唯一父级从稳定资源记录取得，不从 URL 文案猜测。

父/子 endpoint 按第 4.1 节唯一键幂等创建并在同一 source 事务中完成；唯一冲突后读取并校验现存稳定 identity/parent，不能覆盖冲突归属。manifest 的 auxiliary_endpoints 列出稳定身份、parent identity、引用该辅助身份的 source/occurrence，以及“target/parent dependency”用途；跨来源去重，不纳入来源覆盖分母 S。父级不存在且无可信身份/归属证据时明确报告，不能建悬空 parent。无 public selection 的父级后来发布后，该 Comment 的既有 endpoint 不变，NodeStatus 按新的 Scope 恢复正常展示。

每个 source 的幂等键为 endpoint + canonical token + parser version。重跑同键是 no-op；token 不匹配 manifest 则明确失败，不能移动 publication version 适配。空引用也建 set。初始化不读取历史绑定，目标不可读本身不能成为降级理由；仅上述确实无法验证身份的情况保留普通链接/文本。生成 set 后，普通编辑按第 4.4 节继承其绑定和 mentioned_at，不重复启用初始化模式。

验收必须证明：S 全部来源覆盖、缺 set/未追平为零；重跑零重复；选版、文章内容 revision、publication version、正文 hash、正文时间戳、Activity 数量前后不变；提及/内容发布通知及通知 Outbox 新增数为零。全局 `revision` 与新 mentions 数据允许改变。源正文缺失等错误不得用减少 manifest 分母掩盖；失败时不得开放新入口。

### 9.3 旧异步写入停机与恢复

B0 必须列出 cron、Oban worker/queue、CLI/release 命令、Outbox dispatcher、事件类型及 payload，以及在途与可重试任务的定位方法。至少包括 `Jobs.CMSMentionHealth`、`cms.mentions.rebuild`、`article.mention_sync`、`comment.mention_sync`、production seed CLI 的 `cleanup-apply` / `delete-tmp` 及其在途 release 进程，并检查共享 cms_outbox 队列中的其他任务，不能一键丢弃整条共享队列。

`production_seed/cleanup.ex` 的 Ticket purge 分支实际是撤回并保留 aggregate/历史。B1 必须适配新关系模型：撤下公开出边，保留 endpoint/set 与合法入边，不写永久删除墓碑；B4 停旧 cleanup 并等待事务结束后才删旧表，切换后只恢复已适配的新入口。该调用适配属于 mentions 重构必要边界，不扩展生产 seed 的业务范围，也不意味着生产切换已获验收。

B4 在任何旧表删除前执行：

1. 禁用旧 health cron、旧 rebuild 的 apply 入口及部署外运维调度，停止新旧内容写入和旧提及任务领取。
2. 排空或取消正在执行的旧提及 worker/CLI，等待其事务结束；仅停止领取不能阻止已执行事务写库。
3. 按明确 worker/event 类型取消 scheduled/retryable/enqueued 的旧任务，终结未投递的旧提及 Outbox，不转换为新 payload；导出处理清单及计数，不丢弃无关任务。
4. 确认旧执行实例已退出、旧提及 writer 活跃数为零、可领取/可重试旧任务为零，再删旧表并初始化。
5. 对旧 Mentions 专属任务和 Outbox 事件逐类终结并留存清单；不清空共享队列，不转换旧 payload，也不启用 epoch 兼容逻辑。
6. 确认旧 writer、在途事务及可领取/可重试的旧 Mentions 任务均为零后，执行全量初始化；验收通过后再启用新 worker/health 调度及写入，并记录切换前后的队列清单。

增加停机演练：旧任务卡在执行中时禁止进入删表步骤；已终结的旧任务不得重新领取；新 worker 完成零边/非零边投影均在同事务递增 revision。回退需要连同调度和 Outbox 状态整体处理，不允许只替换 Web 节点。

### 9.4 全局 revision 与任务切换

MentionsGraph 只维护一个全局递增整数列 `revision`，存于 `mentions_graph_state` 的唯一一行（固定 `id = 1`）。该表是单行表，只含 `id` 和 `revision` 两列，不存其他状态；新表初始化时创建该行并设 `revision = 0`，后续只做原子递增，不按来源或 Community 建多行。它用于检测一次图查询期间关系是否变化，不表示内容版本或初始化代次。所有影响 Mentions 查询结果的 set、current edge 或公开状态变化，必须在同一数据库事务内递增该值；幂等 no-op 不递增。读取只在 `id = 1` 上取值，图请求读前/读后各一次并比较，cursor 绑定该 revision；变化时整页失败并要求从首批重载。初始化 manifest 不含 revision，apply 仍通过 database identity、来源 token/hash、分页 checkpoint 防止错环境或过期页写入。

该全局值需要跨 Article、Doc、Ticket、Comment 和各 worker 共享，并与图变化在同一事务提交，因此由 Mentions 自己的单行表持有；现有按 Community、branch 或资源归属的状态表不能充当全局 owner。正文自身的 revision 与 set 的 `source_token` 用于判断某来源投影是否对应当前公开正文，不写入 `mentions_graph_state`。所有图写事务更新同一行会形成写入串行点，B2/B4 的代表性负载验收须观察该行锁等待；若成为瓶颈，应重新设计全局 revision 合同，不能只把该行拆成多个计数器。

新投影事件不携带 epoch，也不从部署环境读取数据集代次。安全切换依赖第 9.3 节的明确停机门禁：停止旧 producer/worker，等待执行事务结束，按 Mentions 专属 event/job 类型终结旧待处理项，确认旧 writer、在途事务和可重试旧任务均为零后，才删除旧表并运行初始化。未通过门禁不得删表或开放新写入。新 worker 完成投影时与 current edge 和水位更新同事务递增 `revision`。

B2 必测：单次写入使 `revision` 增加；worker 追平（包括零边结果）使 `revision` 增加；幂等 no-op 不增加；查询前后 revision 不同则整页失效；停机验收能逐类证明旧任务已终结且不能重新领取。无需 UUID、外部 epoch 配置或多套版本名。

## 10. 验收矩阵与可运行检查

### 10.1 行为与边界测试

| 测试                                                     | 必须断言                                                                                                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A→C，父文章隐藏/审核/恢复                                | 同一边和节点身份，状态正确，无隐藏标题/body/url，无展开                                                                                                                                                                              |
| 审核/软删除/未知原因、自己永久删除/仅父级永久删除        | 前者 UNAVAILABLE；仅目标自己的可信墓碑可为 DELETED；无审核原因 enum                                                                                                                                                                  |
| C→A，C 不可读                                            | 入边不公开，不经图推断来源                                                                                                                                                                                                           |
| 目标软删/硬删、父 Article 删除、Doc 正文 branch 删除     | 入边与 endpoint 保留；公开 source selection 消失才撤下当前出边；branch 删除不能伪造稳定 Doc/Comment 删除墓碑，数据库约束不级联丢边                                                                                                   |
| 新版本移除引用、旧任务晚到                               | 当前关系按新版本，旧任务不复活关系                                                                                                                                                                                                   |
| Doc Comment                                              | 单 owner Community 与稳定父级匹配；公开正文仍经 main Scope，Comment endpoint 不携带 branch；错社区/缺上下文 fail closed                                                                                                              |
| 六类资源、匿名/登录/管理员                               | 相同 public 结果，无权限扩大                                                                                                                                                                                                         |
| 重建、Receipt/任务重试、恢复                             | 结果幂等，无重复 occurrence/通知                                                                                                                                                                                                     |
| 缺 set 与空 set                                          | 分别为不完整和确定空结果，不混淆                                                                                                                                                                                                     |
| token 相同但 parser version 升级                         | 新 set 独立保存，旧 synced 不判 READY，追平新 set 后才完成                                                                                                                                                                           |
| structured-only 输入合同（待新增验收）                   | text 中的 raw HTML `<a>` 和裸 URL 不生成内部边、URL target 或 occurrence，初始化同样；两个独立结构化 `a/link` 即使 URL 相同也各计一条；与 URL 同值的纯文本 label 不另计，text/link 节点下嵌套的结构化 `mention` 仍按节点规则递归提取 |
| 结构化链接移段/重复 URL/同位置换结构化链接/历史匹配歧义  | 按 4.4 身份继承，不串目标；歧义明确失败                                                                                                                                                                                              |
| Comment 原位更新和旧 set 回收                            | 先继承绑定、再生成当前 set；追平前保留必需 set，过期任务不能复活已回收版本                                                                                                                                                           |
| 跨 Community 的结构化 ID 和 URL                          | 按合法目标身份绑定，当前 Community 不可读则占位；无法合法绑定只保留普通链接                                                                                                                                                          |
| 空图但公开来源缺水位/set，或无关隐藏来源待同步           | 前者 projectionPending=true，后者不污染 pending；不能伪装完成                                                                                                                                                                        |
| 当前正文初始化，全类型及暂时隐藏来源                     | manifest 全覆盖、相同 token/set；内容选版及 Activity 不变、发布/提及通知零新增；重跑幂等                                                                                                                                             |
| 初始化时 A→C，C 审核/软删除/父级隐藏/目标 Community 私密 | 身份可验证则保留内部边，当前 UNAVAILABLE；恢复后同一 endpoint/edge 恢复 READABLE，mentioned_at 不变，无私有字段泄露                                                                                                                  |
| 初始化模式隔离及身份冲突                                 | 普通发布/API 无法启用专用模式；冲突阻止初始化，不以目标暂时不可读为由降级                                                                                                                                                            |
| 初始化 Comment target 的父级不在 S                       | 幂等创建 auxiliary parent 和 Comment endpoint；manifest记录依赖但不增加S；父级发布后同一节点恢复可读                                                                                                                                 |
| 稳定 ID 对应多个 mirror binding                          | 单一 endpoint，不报binding歧义；仅指定Community内的local locator无法唯一定位才失败                                                                                                                                                   |
| 隐藏或删除目标继承、occurrence 聚合                      | endpoint 与原 mentioned_at 同时继承；索引时间等于全部 occurrence 的共有时间；不一致回滚投影                                                                                                                                          |
| set 保存前 occurrence 时间冲突                           | 保存事务失败，无set/occurrences落库；投影前另有防御校验，不遗留不可变坏事实                                                                                                                                                          |
| 数据库组合 FK                                            | 直接写入错 source/set、错 endpoint/type、错水位 source，均由数据库拒绝                                                                                                                                                               |
| worker 追平、零边投影及 parser 升级                      | desired 改变与 synced 追平分别同事务递增全局 `revision`；查询能观察完成                                                                                                                                                              |
| 一跳列表的内部/User/URL target 与分页                    | 明确 DTO、公开 Scope、稳定 mentionedAt；重建及初始化不冒充新提及                                                                                                                                                                     |
| 旧异步任务停机与晚到                                     | 旧 writer 或在途事务非零阻止删表；旧 Mentions 任务终结并确认不可领取/重试后才开放新写入                                                                                                                                              |
| 全局 revision                                            | 所有图变化与 revision 同事务；读前/读后变化使整页失效；初始化 manifest 不依赖外部代次配置                                                                                                                                            |
| 图与一跳 API 命名                                        | referenceMap* 图名删除；mentions/mentionedBy、ArtimentMentionPage/ArtimentMention 保留业务名且仅新 DTO 可用                                                                                                                          |

### 10.2 性能测试

通过测试进程关联的 Ecto telemetry 统计整个 GraphQL/领域调用 SQL，过滤 BEGIN/COMMIT 和 fixture 建数，避免混入并发测试查询。断言结果正确及总 SQL ≤32，不只统计某一个 helper。

- 3,000 条邻接关系请求 20 条：数据库查询包含 keyset/order/limit，返回 20 条及正确续页，不加载全图。
- 20 条关系指向同一目标、以及相同页大小下全部不同目标：批量查询，不按节点新增 SQL。
- 10 frontier 混合资源类型、重复节点、环和重复方向：总预算、候选数、节点去重和边完整。
- 95% 目标已删除/审核/隐藏：占位计入页，无递归补扫；95% 来源不可读：SQL Scope 先筛选，不返回隐藏来源，计划有界超时。
- 大量 pending source：存在性查询无全量 Repo.all；source pending 不泄露旧关系。
- source token 未变的 parser 升级、缺水位/set：pending exists 正确，不增加逐来源查询。
- 所有图读取路径静态检查无裸 SQL、Repo.preload/Ecto preload，关联数据均走显式预算查询；telemetry 总数含 helper 查询。
- revision fence 前后变化：整页明确失败，不返回混合版本结果，不在服务端超预算重试。
- 预算只剩一次而流程还需两次：第二次 SQL 发出前失败；超时映射正确，没有伪造末页。
- Graph 纯函数测试：禁止 Repo 依赖，规模增长下结果一致；O(V+E) 通过 map/set 实现审查及独立规模基准验证，不用易抖动的墙钟时间作为单元测试硬门禁。

执行计划使用 Ecto 的 explain 能力，在隔离 PostgreSQL 真实数据分布下检查索引、排序和扫描行数，记录版本、数据规模、SQL 数、耗时分位和计划。不能只以 LIMIT 或小样本 SQL 计数证明数据库成本。

### 10.3 产品入口测试

- 普通文章 GraphQL 操作没有提及图字段，且不触发 mentions SQL；schema 不新增文章关系/状态字段。
- 首次打开页面、SSR、Activity tab、hover 均不发 Mentions 请求；所有 tab 只挂载选中面板。默认 Activity 可请求自身数据，未选中面板不预取；切回按缓存策略处理，离开后停止自身轮询。
- Activity 本轮接真实 articleLogs：有数据、真空结果、失败、分页及权限隔离；Doc 不再固定空态，普通 Article 无 mock 数据。Post 创建/关联 Ticket 事件由后端返回，Ticket 改状态或发布文字更新不生成 Post Activity；前端不合并 Ticket 数据。
- Post 关联 Ticket 的状态区在 Footer 上方独立展示，切 tab 不影响；Ticket updates 与 Activity 分离。Ticket 页默认收起 Mentions，不请求图或 Activity；展开只查当前 Ticket 一页关系，收起实际卸载/取消；切 Ticket/Community 重置，无 Comment seeds。
- 普通文章通过实际 PostViewer/ChangelogViewer 到 Footer；Comments callback 原子切换 tab+focus；Doc 在 Mentions 内显式查 seeds、选择评论、返回 Doc。多个页面/抽屉实例不串状态，不新增共享全局 focus。
- 首次点击严格一次 page、frontiers=[focus]；首批不发 seeds/revision，只有选择评论提及入口才请求 seeds。
- focus 在 frontiers 中计数一次；10 frontier 可包含 focus，11 frontier 拒绝；不同 locator 指向同身份不能绕过重复校验。
- READABLE+PENDING 可以打开当前正文但不能展开；locator 按 7.1 携带字段，Doc 不接收 branch，非 main 分支不能借此进入。
- 图 page/seeds/revision、Activity、Comments page/infinite/reconcile 的 fetch 均收到 signal；切 tab/focus/unmount 后无消费者请求实际 abort，abort 不重试，旧响应不合并；仍被其他实例使用的同 key 查询不误取消。
- 占位节点无链接、不展开；恢复更新；切 Community/focus 不串缓存；预算错误可重试且不显示“没有更多”。
- projectionPending 与 hasNextPage 四种组合按 7.3 展示；超时停止自动重试且不宣称完整。密钥版本改变清空旧 ID/cursor/cache 后重载。
- Core 单测覆盖入口开关；路由集成测试覆盖 Post/Blog/Changelog/Doc/Ticket/Comment 的实际挂载。浏览器验证使用 `/home/xx`，截图仅放 `.playwright/`。

### 10.4 命令与证据

后端从 `backend/api` 执行，使用隔离测试数据库；新测试文件由对应批次创建：

```sh
mix test test/groupher_server/cms/artiment_mentions_test.exs
mix test test/groupher_server/cms/mentions_graph_test.exs
mix test test/groupher_server/cms/mentions_graph_budget_test.exs
mix test test/groupher_server_web/query/cms/mentions_graph_test.exs
mix test test/groupher_server/cms/review_regression_test.exs
mix compile --warnings-as-errors
mix format --check-formatted
```

仓库根目录执行：

```sh
make be.gen.schema
pnpm graphql:codegen
pnpm contract:graphql:generated
pnpm contract:graphql
pnpm test:core
pnpm type-check
pnpm docs:check
git diff --check
```

`pnpm test:core` 使用现有 Core Vitest 配置。开发期间可通过 `pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/core/unit/MentionsGraph` 运行重命名后的目标测试，最终仍须覆盖 tab 集成及实际路由挂载；不得只运行没有覆盖新入口的旧测试。B0 将新增 tab 集成测试的精确文件路径与命令写入实施 inventory。

旧名称搜索须覆盖源码、GraphQL operation、生成物、locale 和测试；历史迁移文件及标为历史的文档允许保留原名，不能以全仓无字符串作为门禁。新增读取路径扫描确保无原生 SQL，必要 fragment 必须说明用途，不接受用 fragment 重写完整查询。

## 11. 文档收口与完成定义

实施 inventory 每批使用以下记录模板，所有项初始为未完成：

```text
批次：B0 / B1 / B2 / B3 / B4
状态：未开始 / 进行中 / 验收通过 / 阻塞
提交与文件：
数据库环境、迁移版本、样本规模：
实际执行命令与退出码：
关键断言、SQL 数、候选数、执行计划证据：
数据差异与未解决事项：
出口是否满足：是 / 否（原因）
```

B4 将 `reference-map.md` 从当前运行时合同改为指向本文的历史入口；更新 `reference-map-inventory.md`，按 B0–B4 逐项附真实证据，不覆盖旧日期伪装完成。Article README、Feature 索引、Gate/Review/删除说明同步链接；部署验收继续使用独立 runbook，不把生产 seed 工作并入本轮实现。

完成必须同时满足：数据关系在删除与重建后保留、公开字段不泄露、图仅点击 tab 查询、Ecto 有界分页与请求预算可测试、旧运行时路径删除、目标环境验收完成。任何一项缺失都不能将 B4 标记完成或宣称生产全绿。
