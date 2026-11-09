# MentionsGraph 简化重构清单

> 状态：当前关系简化、模块收口及 Article／Doc 的 Comment 定点访问已在工作区实现；跨资源验收与发布门禁仍待完成，尚未部署。当前代码合同见[当前关系合同](./mentions-graph-sync-contract.md)。下方未勾选项是**最终代码的剩余工作或发布验收门禁**；单资源一跳图和 Comment 公共定位已在工作区实施；其中某些步骤已有工作区实现，未勾选不表示从未实现，也不代表生产验收通过。

## 已定合同

- **全新空库上线，不兼容老数据。** B4 的旧内容不带入新目标库；上线前清空目标库或新建空库。旧边不迁移，旧正文不回填、不做一次性重算，也不列数据缺口。这是发布环境前提，不是运行时架构的一部分。
- 关系由**已发布正文**产生；Doc 仅跟随公开 main，编辑草稿不更新关系。Article、Doc、顶层及回复 Comment、Ticket 的所属 Command 在正文写入事务中更新当前关系。通知投递和前端缓存发现变更可以异步；关系写入不重新引入历史 set、当前 set 指针或异步投影。若盘点发现无法同步的写入口，逐项说明短暂不一致如何结束。
- **已存的 Artiment 资源之间的 mention 边在图读取时返回，边的两端节点同时返回 `title`、`url`、`status`。** 隐藏、审核、私密、draft、可恢复删除等状态不作为图边或标题、URL 的过滤条件。`url` 可点击并进入资源页；资源页显示 `UNAVAILABLE`／`DELETED` 等状态，正文是否展示由资源自己的 Gate／页面决定。只要资源未永久删除，即使没有任何 Mention 边或 Community binding，也能凭稳定资源 ID 打开状态页；资源页可达性不由图关系决定。MentionsGraph 不按这些状态分别裁剪标题、URL 或 locator，也不实现一套状态可见性矩阵。图只显示当前资源与 Article／Doc／Ticket／Comment 之间的直接出边和入边；普通 URL 与 User target 留在当前关系和一跳 `mentions` 列表中，不作为图节点；点击相邻资源节点跳转到该资源页，不在当前图内继续展开其关系。
- 状态变化不删除已存关系；**永久删除**才清理该端点的入边、出边及从属 Comment 关系。Comment 软删后直到端点永久删除前均保留删除前的入边和出边，节点显示 `DELETED`，资源页不展示原正文；tombstone 正文不能被当作普通编辑，自动把旧出边替换为空。当前 Comment Lifecycle 不允许 `deleted → visible`，也没有 restore Command，因此不预设“恢复后”的行为。若以后增加恢复，须另定原正文、关系和通知的恢复路径。
- 编辑前后持续存在的关系沿用 `mentioned_at`，不重复通知；移除后再加入按新提及处理。两个独立的结构化 Plate 节点分别计数。普通链接与带稳定 ID 的 `@ Article` 保持各自的目标确认规则：已发布来源中的 `@ Article` 只要稳定 ID 和目标类型核对通过，即使目标当前为 draft 也保存关系。**图立即返回这条边及两端节点，draft 目标的状态为 `UNAVAILABLE`；目标发布后状态变为 `READABLE`，既有关系自动以新状态呈现，无需编辑来源。**
- **当前合同和新增代码**统一称**已发布正文 revision 身份**与**图 revision**，不新增“正文 token”概念。旧文档中的 `token`、`content_token` 只描述历史版本。通知事件及投递核对复用正文 revision 身份。图 revision 用于页、游标和前端缓存失效，本轮保留现有全局单行机制。

### 对外图 ID 与模块收口（工作区已实现，待完整验收）

图节点的公开定位以**本 Community 的 `inner_id`** 为准，不把数据库 `article_id` 写成普通 Article 节点的公开编号。`Article.id` 仍是 endpoint 和关系落库的稳定身份；它与图响应的节点 ID 是两件事。目标节点尚无本 Community 编号时，沿用当前已定的稳定 `articleId` locator 作为临时定位，不能为了凑 `inner_id` 丢掉指向 draft 目标的关系。取得编号后，图 revision 必须推进，旧节点 ID／cursor／前端缓存失效并重取。

| 图响应字段                                             | 重构后的规则                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 有编号的 Article／Doc／Ticket 节点 `id`                | `article:<community_id>:<thread>:<inner_id>`；Doc 只代表公开 main，不加入 branch ID                                                                                                                                                                                                                                           |
| 尚无本 Community 编号的 Article／Doc／Ticket 节点 `id` | `article:<community_id>:<thread>:id:<article_id>`，只用于已确认的稳定 ID 目标；取得 `inner_id` 后改用上行                                                                                                                                                                                                                     |
| Comment 节点 `id`                                      | `comment:<community_id>:<parent_thread>:<parent_inner_id>:<comment_inner_id>`；无 binding 时父编号改为 `id:<parent_article_id>`。不使用数据库自增 `Comment.id`，与 Article 节点分开；URL 先生成父 Article／Doc 的完整资源路径（Doc 含 slug），再追加 `#comment-<C.inner_id>`；无 binding 时按下文的父资源稳定 ID 后备路径定位 |
| 边 `id`                                                | `edge:<community_id>:<edge.id>`；数据库 `edge_key` 仍负责关系去重和分页顺序                                                                                                                                                                                                                                                   |
| 图页、列表页及独立查询的 `revision`                    | 同一个全局整数 revision 的字符串形式，保持 GraphQL `ID`／前端字符串合同                                                                                                                                                                                                                                                       |

节点、边和 revision ID 不再通过 `Opaque.id/3`、HMAC 密钥或 `v1_` 前缀生成。分页 cursor 是另一项合同：继续绑定 Community、图 revision、查询方向／节点及最后一条边，保留必要的校验，不把 cursor 的处理理由扩散成所有图 ID 都需要签名。`mentions_graph_key` 是否仍用于 cursor，须按实际编码调用核对；只删除确实不再使用的密钥／版本配置。

文件按现有 Context／Owner 规则收口，不新增逐文件白名单或空 Facade：

- [x] 将 `Mention.from_target/2` 的薄转换并入 `ArtimentMentions.Capture`，删除 `mention.ex`；`Persist` 继续负责来源锁、关系 diff、`mentioned_at` 延续与落库。
- [x] 本轮复用 `CMS.FrontDesk` 的 Article／Comment 等**资源 URL 与 Artiment 状态读取**入口；FrontDesk 原有资源读取能力继续保留；替换 `ArtimentMentions.Capture`、`MentionsGraph.NodeStatus`、Ticket 查询和 seed 的资源路径调用后删除 `LinkPath`。普通外链规范化属于 Mentions 的关系键处理，当前只有 `Persist` 一个调用点，可收回该流程的纯函数并删除 `LinkURL`；不把 FrontDesk 扩成通用 URL 工具，也不把外链规范化当成 Article 目标确认。
- [x] 上一版 User 关系／未消费通知状态由 Query 读取，纯收件人差异计算归 `ArtimentMentions.Capture`。调用链明确为：正文 Command 在事务内调用 `Effects` 记录 Outbox 意图 → 事务提交 → Outbox Workflow 消费事件 → 调用 `Effects` 的投递入口 → `effects/notifications.ex` 执行投递与当前关系／来源核对。保留 `effects.ex` 作为边界，Workflow 不直接穿透 `Effects.Notifications`；删除平级 `notifications.ex`。投递不能在正文事务内执行，通知去重与准入规则不变。
- [x] 将 `MentionsGraph.Graph.build/4` 的结果合并逻辑收进 `MentionsGraph.Query` 的私有函数，删除 `mentions_graph/graph.ex`；不引入有歧义的 `PageBuilder`。
- [x] 将 `mentions_graph_revision.ex` 移到已有 `mentions_graph.ex + mentions_graph/` 下的 `mentions_graph/revision.ex`。更新 Article、Doc、Comment、Review、Community、binding 和 Mentions 的调用方；继续使用同一个 `CMS.Model.Mentions.GraphState` 和全局单行 revision，不改变 bump 时机。
- [x] 在以上调用替换后删除 `opaque.ex`，统一图页、一跳列表、GraphQL、前端和测试的 ID／revision 格式；保留当前边的数据库去重键。跨 Community 的相同 `inner_id`、同一 Article 的不同 Community binding、无编号 draft 目标取得编号、Comment 节点、延续边 ID、旧 cursor 及前端缓存均须有断言。

实施顺序为：先固定上述 ID 与无编号目标用例，再接 FrontDesk，随后收拢 Command／Effects，最后迁移图读取与 revision 模块。每批确认没有旧调用后才删除文件；不加兼容别名。上述模块搬迁与调用替换已在工作区实施；仍须以定向与跨模块测试核对最终边界。

### 图节点与资源页

图查询以已存的 Artiment 资源之间的关系为准，分页返回边及两端节点；URL/User target 由一跳列表读取，不进入图。节点 `status` 由资源现有 lifecycle／Gate 机制集中计算，继续使用现有 GraphQL enum／const 映射；MentionsGraph 不为 hidden、review、private、draft 等状态分别定义一套枚举或字段披露规则。受限节点的 `title` 和 `url` 仍返回；不把“正文不可读”解释成“节点不可见”。资源页用节点状态提示不可用或已删除，并由资源自己的 Gate 决定是否展示正文。

任一仍存在的节点都可直接作为 GraphQL 关系查询的起点；隐藏、审核中、私密、draft、可恢复删除或父级受限不阻止查询其已存入边和出边。接口中 `focus` 只是“本次从哪个节点查关系”的参数名，不代表额外的资源状态或准入。GraphQL 图查询只接收一个 `focus` 和其分页游标 `after`；每页只取该资源与其他 Artiment 的直接出边和入边。相邻节点点击后跳转资源页，由该页以自身为新起点查询；不在原图展开其他节点，GraphQL 节点不再提供 `canExpand`。有 Community 编号时 locator 使用 `articleInnerId`；未取得编号或跨 Community 出现的 Article／Doc／Ticket 使用稳定 `articleId`，不把 Doc branch 放进身份。稳定 ID 查询仅允许本 Community 有 binding 的节点，或本 Community 有 binding 的相邻来源／目标节点。Article／Doc 当前 lifecycle 为 draft 时，作为已有边的来源或目标都可以出现在图上；编辑草稿不产生新出边。Comment 父级为 draft、Trash、审核中等状态时，既有 Comment 边也照常返回，Comment 节点照常提供标题、URL 和状态。当前仍为 `published`／`archived`、只是同时编辑草稿时，图关系继续跟随有效公开版。Community binding 或路由缺失不能静默隐藏关系；实现前核对并补足能跳转到资源状态页的 URL 和图查询定位入口。

**Comment 的定点访问**：例如 A 提及文章 B 下的评论 C，用户点击图中的 C，进入 B 的文章页并定位到 C。B 状态页自身可由稳定资源 ID 打开，不需要 B 有直接提及边；A→C 的已存关系只用于确认能否读取指定 C。B 正文可读时照常显示；B 因隐藏、审核、私密、draft 或可恢复删除而受限时，页面只显示 B 的标题与 `UNAVAILABLE`／`DELETED` 状态，不显示 B 正文和其他评论，但显示被定位的 C。C 的原正文能否显示只取决于 C 自己的状态；C 自身受限或软删时显示 C 的状态，不泄露原正文。读取时必须核对 C 确实属于 B；这个**指定 Comment 视图**不因 B 正文的 Gate 拒绝而丢失 C，同时不能变成绕过 C 自身准入的普通评论列表。

B 在本 Community 有 binding 时，由 FrontDesk 先生成 B 的完整资源 URL，再追加 `#comment-<C.inner_id>`：普通 Article 例如 `/<community>/post/<B.inner_id>#comment-<C.inner_id>`；Doc 必须含 slug，例如 `/<community>/doc/<B.inner_id>/<slug>#comment-<C.inner_id>`，无可用 slug 时以 `doc` 兜底。B 的 binding 已解绑但 A→C 关系仍可从本 Community 的已绑定 A 读到时，同样先生成父资源的稳定 ID 状态页 URL：普通 Article 例如 `/<community>/post/<B.article_id>#comment-<C.inner_id>`；Doc 例如 `/<community>/doc/<B.article_id>/doc#comment-<C.inner_id>`。不能用不含 slug 的通用模板拼 Doc Comment 路径。Comment 图 locator 用现有字段 `type: COMMENT`、父 Article／Doc 的稳定 `articleId`、`commentInnerId`，仅在该 Community 的已存相邻关系成立时允许定位。B 后续重新取得编号时，改回编号路径并推进图 revision。此后 C 应有非空 URL／locator，可以直接作为图查询起点。**工作区实现**：`NodeStatus` 已为无 binding 的 C 生成稳定父资源 URL／locator，并允许其通过本 Community 已存相邻关系直接查图。`mentionedComment` 使用专用 Comment Gate 视图，在确认 C 确实参与该 Community 的关系后只读取 C；受限父页按 URL fragment 定点加载 C，普通评论列表仍受父资源 Gate 约束。Doc owner binding 有数据库删除保护，Doc 的无 binding 路径目前仅验证了 FrontDesk 路径生成，尚未做真实解绑端到端验收。

`READABLE`、`UNAVAILABLE`、`DELETED` 是现有对外状态；具体资源状态到这三个值的转换应只在一个服务端边界完成，并复用项目现有 const/enum 机制。资源页的正文准入仍遵守自己的 Gate。图接口不返回正文，也不靠裁剪标题或 URL 代替正文权限检查。

### Doc branch 边界

同一 Doc 的 main 和 preview 等 branch 共用稳定 Doc ID（`Article.id`），公开 Doc URL 也不包含 branch。Mention 对 Doc 只使用这一稳定身份，**语义始终指向公开 main**：main 的已发布正文产生该 Doc 的出边，main 尚未发布时稳定 ID 仍可作为入边目标并显示 `UNAVAILABLE`。main 发布后，该目标变为 `READABLE`，已有入边继续有效。

非 main branch 的草稿、已发布版本和版本历史均不产生或替换 Mention 出边，也不作为独立的 Mention 目标；不能用非 main 的正文、标题或状态冒充 main。即使用户可以在 Dashboard 找到或阅读 preview branch，也不会得到该 branch 专属的 `mentions`／`mentionedBy`。例如同一 Doc 的 main 提及 A、preview 提及 B，图中只有 Doc → A；查询 B 的 `mentionedBy` 不因 preview 的内容出现这个 Doc。其他来源以稳定 ID 提及该 Doc 时，也只关联稳定 Doc 的 main；若正文含非 main branch 的专属 URL，该 URL 仅按普通链接规则处理，不映射为 branch 的内部 Doc 节点。Doc Comment 的 Mention 准入同样跟随其稳定父 Doc 的 main，不随 preview branch 分裂。

当前 `DocPublic` 和正文 revision 仍按 branch 存储；**branch ID 仅参与 main 已发布正文的选择与 revision 身份，不进入 Mention endpoint、关系键、GraphQL locator 或公共 URL**。非 main branch 不支持 Mention 是明确的产品范围，不要求为所有 Article 引入 branch 身份。实现时检查 main 发布、预览发布、branch 恢复及删除路径：只有 main 的正文变化更新关系；永久删除稳定 Doc 才清理该 Doc 关系。

### 正文版本与提及时间来源

| 已发布来源              | 当前代码的正文 revision 身份                                        | 新增关系的 `mentioned_at` 来源 |
| ----------------------- | ------------------------------------------------------------------- | ------------------------------ |
| Post / Blog / Changelog | `ArticlePublic.revision_id` + `publication_version`                 | `ArticlePublic.updated_at`     |
| Doc 公开 main           | `DocPublic.branch_id` + `branch_version_id` + `publication_version` | `DocPublic.updated_at`         |
| 顶层／回复 Comment      | `comment.id` + `CommentBody.version` + `body_hash`                  | `CommentBody.updated_at`       |
| Ticket                  | `ArticlePublic.revision_id` + `publication_version`                 | `ArticlePublic.updated_at`     |

以上是当前写入表达式，重构时核对所属资源的真实发布选择；延续关系仍沿用旧 `mentioned_at`，不使用本次更新时间覆盖。

## 实施前必须核对

1. **写入路径**：盘点 Article、Doc 公开 main、顶层及回复 Comment、Ticket 的发布、编辑、软删、恢复，以及 import、seed 等能改变已发布正文的路径。普通草稿编辑和 Doc 非 main branch 的发布均排除；Comment tombstone 软删按保留已存关系处理。漏接的发布路径接入所属 Command。正常写入同步完成后，不再靠读取端的 `CurrentSet` 比较正文版本。
2. **目标环境**：发布前确认目标为真正空库。若沿用 B4 目标库，先清空旧内容与关系；否则新建空库。不得把 B4 旧内容或旧边带入，也不运行旧 parser 兼容、迁移、回填、一次性重算或缺口扫描。
3. **关系粒度**：公开接口当前只需 `occurrences_count` 和 `mentioned_at`，没有已确认的位置／高亮调用方。默认只保存这两项；若出现位置需求，再定义关系键、位置格式和时间继承规则。区分目标、`mention_case` 与 URL，避免错误合并。
4. **通知规则**：通知是独立于图读取的投递行为。延续、新增、移除后再加入、上次未送达但本次仍存在的 User 提及须分别验收；保留 Ticket 不发 User 提及通知、自我提及和作者排除规则。草稿编辑不产生新事件；投递时核对当前已发布正文 revision、当前关系、来源及父级的通知准入、**本次通知对应 Community** 的有效 binding。来源或 Comment 的父 Article／Doc 处于所属资源已定义的隐藏、审核中、私密、draft、Trash 状态，来源 Comment 自身软删，或该 Community 缺有效 binding 时，旧 pending 事件不投递；永久删除后不再有有效来源。其他资源恢复公开或重新绑定后，仍须通过当前 revision、关系、来源和父级状态及 binding 检查，未消费意图才可送达一次，过期意图不得复活。Comment 没有现成恢复入口，不把它列入恢复投递用例。图上展示边、标题和 URL 不代表允许发送通知。**普通隐藏仍须由所属资源定义代码谓词，但只用于通知来源／父级的准入判断，不用于图边、标题或 URL 的过滤。**每个来源的每个已发布正文 revision 至多一条 `mention.notify` Outbox 事件：去重身份为 `source_endpoint_id + published_revision_identity`，事件内冻结拟通知 User ID；每个 User ID 另记消费结果。相同 revision 重试复用该事件；移除后再加入产生新 revision 与新事件，不依赖 `set_id`。
5. **状态页与路由**：状态页必须独立于 Mention 边和 binding，只以稳定资源身份和永久删除状态决定能否打开；逐资源核对 Article、Doc、Comment、Ticket 在受限或可恢复删除状态下仍能提供图节点 `title`、可点击 `url` 与 `status`，并在资源页隐藏不可读正文。现有 Gate 若把节点元数据与正文准入合并，实施时拆开这两个读取边界；不要在 MentionsGraph 写各状态分支。特别核对 Comment 的父 Article 受限或失去本 Community binding 后，指定 C 仍可从 B 的状态页定位，B 正文及其他评论不随之公开。

## 改造步骤

### 1. 让当前关系独立承担写入

- [ ] 以来源 endpoint 的 `FOR UPDATE` 锁串行处理同一来源编辑。锁内读取旧当前边，按关系键比较新增、延续、移除；延续沿用 `mentioned_at`，新增使用本次正文时刻；据此确定通知名单，再 upsert／删除当前边。正文与关系任一步失败，所属事务整体回滚。
- [ ] 将所有纳入 Mention 的已发布正文写入口接到这一流程。Doc 仅 main 发布更新稳定 Doc 的关系；非 main branch 发布不写 Mention 或通知，也不覆盖 main 的出边。验证并发编辑不丢边、不重置延续关系时间、不重复通知；正文所属 Command 的版本冲突规则仍决定较晚编辑能否提交。稳定 ID `@ Article` 指向尚未发布 main 的 Doc 时照常入库。
- [ ] 修改 `Comments.Commands.Delete`／`Comments.Mentions.delete/3` 的 tombstone 路径：Comment 软删保留旧出边和入边，节点映射为 `DELETED`；不假设存在 Comment restore。普通隐藏、审核、私密、Article／Doc Trash 等状态变化也不删边；`Persist.mark_deleted/1` 只在永久删除时清理双向及从属关系。
- [ ] 确定稳定 endpoint 和当前 edge 的最小字段。没有产品调用方的位置数据不默认保留；重复节点仅保存所需 count。核对状态变化、Community binding 的绑定／解绑／转移及永久删除时的全局图 revision；跨 Community 关系变化必须使旧 cursor 失效。

### 2. 切换读取与通知

- [ ] 图页、`mentions`、`mentionedBy` 和评论入口直接从当前边分页读取；图页仅返回 Artiment 两端节点的 `title`、`url`、`status`，一跳列表另按 URL／User 目标类型返回对应字段；不因节点 hidden、review、private、draft、可恢复删除或 Comment 父级状态过滤边、节点元数据或查询起点。有效节点无论状态都能直接查询已存关系；图 API 移除多 frontier 输入与 `canExpand` 字段，改用单个 focus 的 `after` 游标分页。核对 GraphQL schema、节点组装、受限节点定位和前端跳转；资源页按 Gate 隐藏正文并显示状态。对外 status 映射复用现有 const/enum 机制，不在 GraphQL、Query、Persist 和前端各写一套列表。
- [ ] 补 Comment 的**指定节点访问**：有 binding 时沿父 Article 编号路径定位；无 binding、但本 Community 有已存相邻关系时，用父 Article 稳定 ID + Comment `inner_id` 生成非空 URL／locator，复用现有 GraphQL locator 字段。图查询按这一组合确认 Comment 属于该父 Article，且确实通过本 Community 的已存边到达，不能开放任意稳定 ID 查询。文章页的指定 Comment 视图将父 Article 的标题／状态与 C 分开读取；父正文受限时不返回正文或其他评论，C 的正文只按 C 自身准入展示。核对 Article、Doc、Ticket 对应父页路径和 Comment 锚点。
- [ ] 隐藏、审核、软删、恢复、目标从 draft 发布，以及 Community binding／父级状态变化，即使不改边，也要在相应事务内推进全局图 revision；核对是否已有 owner 路径推进，避免重复 bump。目标从 draft 发布后，旧 cursor／缓存失效，原边保留且目标状态从 `UNAVAILABLE` 变为 `READABLE`。永久删除清理入边、出边或从属 Comment 关系后同样推进 revision。验收旧 cursor 拒绝、切回 tab 清缓存及在途响应不回填旧状态。
- [ ] 移除读取端对 `mention_current_sets` 和 parser 版本的准入判断；保留 `first`／单 focus 的 `after` 游标分页和图 revision；数据库超时由 Repo 配置管理，不作为业务参数逐层传递。移除 `MentionsGraph.Budget` 的请求级 SQL 次数及累计耗时管理，不引入新水位。
- [ ] 通知 worker 用已发布正文 revision 和当前关系验证事件，不再读取历史 set。逐项测试来源或 Comment 父 Article／Doc 隐藏、审核中、私密、draft、Trash，来源 Comment 自身软删，以及通知对应 Community 缺有效 binding 时均不投递；永久删除后不投递，非 Comment 来源恢复或重新绑定后只在当前条件仍匹配时送一次。另测草稿不产生事件、移除后再加入、上次未送达且本次仍提及和重复投递；图边可见不影响通知准入。

### 3. 删除旧结构

- [ ] 在已确认的空库上建立新结构；不迁移 B4 旧内容或旧边，不补建旧正文关系。保留的 Ecto schema 按 `cms/model/` 惯例整理。
- [ ] 新读写链通过后，删除 `mention_sets`、`mention_occurrences`、`mention_current_sets`、版本事实和历史重建代码。`Parser.version`／`parser_version` 若无运行时用途一并删除。此前讨论的 `References → Mentions`、`RebuildCurrentSet → RebuildCurrentEdges` 不单独执行：目标是删除仅供旧机制使用的模块。
- [ ] 删除旧正文补建的 `Commands.Initialize`、`Initialize.References`、`InitializeSourceScan`、`InitializationWorkflow`、`InitializeCLI`、manifest/checkpoint、release 入口、专用授权及专用脚本；删除基于历史 set 的 `RebuildCurrentSet` 和维护权限。核对 GraphQL、Jobs、测试与部署脚本引用。

### 4. 验证与文档收口

- [x] 缺失 Comment 行的 endpoint 在批量状态读取中返回不可读状态；若脏边仍指向它，图返回明确的完整性错误，不伪造节点或抛 `FunctionClauseError`。Comment 软删仍保留真实身份和已存边。

- [ ] 验证已发布正文写入与回滚、Doc main、草稿排除、import/seed、重复节点、`mentioned_at` 延续、并发编辑、Comment tombstone 保边及 `DELETED` 状态、其他资源恢复、永久删除双向清理，以及图和列表分页。特别用同一稳定 Doc ID 的 main 提及 A、preview 提及 B 验收：只有 Doc → A；preview 发布、编辑、删除和恢复不改变 main 的出边或 Doc 的 `mentionedBy`，也不产生该 branch 独立节点或通知；main 再发布时按新正文替换出边。对 hidden、review、private、draft、Article／Doc Trash、Comment 软删和父级受限节点，分别从相邻节点和该受限节点自身直接查询图，断言均返回已存边及两端 `title`、`url`、`status`，URL 可进入状态页，正文不展示；当前资源图只包含直接入边和出边；点击邻居跳转资源页，不在图内扩展邻居关系。另验收**完全没有 Mention 边和 Community binding** 的未永久删除资源仍可凭稳定 ID 打开状态页，永久删除则不可打开。验证稳定 ID 指向 main 尚未发布的 Doc 时边已入库且图上可见，目标状态先为 `UNAVAILABLE`，main 发布后无需重编来源即为 `READABLE`。核对旧 cursor、切回 tab、在途响应、离线占位和通知重试；同一无 binding 父 Article 下两个 Comment 的稳定 locator 必须分别解析到各自的 Comment。全新空库不应包含 B4 旧内容或旧边。
- [ ] 在现有 `backend/api/test/groupher_server/cms/mentions_graph_query_plan_test.exs` 上核对分页上界、SQL 次数／执行计划与 N+1 回归；旧 `mentions_graph_budget_test.exs` 已不在当前树中，不写成尚待改名的文件。保留全局单行 revision 的写锁等待、完整发布 p95、图读取 p95 和首次成功率观测；与既有 B2 数据分开报告，不把短样本当作正式资格。运行严格编译、定向测试和架构边界扫描；全量测试报告原始与复跑结果。
- [ ] 分别以普通 Article 和 Doc 作为 B，增加 A→C（C 属于 B）的定点访问用例：B 公开且有 binding、B 受限但有 binding、B 失去 binding、C 自身软删或受限。断言 B 受限时页面只显示 B 标题／状态和指定 C，不显示 B 正文或其他评论；C 自身不可读时不泄露其原正文。Doc 的编号路径和稳定 ID 后备路径均必须含 slug（缺失时用 `doc`），点击后不能 404。无 binding 的 C 仍有 URL／locator、可作为图查询起点；B 重新绑定后 revision 推进且链接改回编号路径。
- [ ] 按“对外图 ID 与模块收口”验收有编号节点使用 Community 范围内的 `inner_id`，无编号稳定 ID 目标使用明确的临时定位；编号生成后 revision 变化并清除旧图节点、cursor 与缓存。核对 GraphQL 和前端仍以字符串处理 ID／revision，旧 `v1_` 断言已替换；验证 FrontDesk URL、Effects 通知投递入口及跨模块 revision bump 调用均已迁移。
- [ ] 更新[当前同步合同](./mentions-graph-sync-contract.md)、[设计评审](./mentions-graph-design-review.md)、[切换手册](../../deploy/runbooks/mentions-graph-cutover.md)、[旧重构合同](./mentions-graph-refactor.md)、B0/B2/B23、联合验收、`docs/auth/README.md`、迁移审计及[Article 索引](./README.md)和[Feature 索引](../README.md)。历史证据标明日期和适用版本；B4 已执行事实与下一轮全新空库上线分开表述。旧文档中的隐去标题／URL、按状态过滤边、迁移／重算旧数据等要求不得继续作为新合同。

## 完成标准

全新空库上线，不携带 B4 旧内容或旧边；正常发布路径只维护当前关系，Doc 仅由公开 main 发布更新稳定 Doc 的出边，非 main branch 不作为独立来源或目标。除永久删除及无效 endpoint 外，已存 Artiment 资源之间的边在图上返回，两端节点提供 `title`、可点击 `url` 和 `status`；资源页按 Gate 隐藏不可读正文并显示状态，图只展示当前资源与其他 Artiment 的直接入边和出边，邻居点击跳转资源页。普通有编号 Article 图节点使用 Community 范围内的 `inner_id`，无编号稳定 ID 目标使用明确的临时定位；不再为节点、边和 revision 生成 HMAC ID。稳定 ID 指向 main 尚未发布的 Doc 时关系入库并可见，main 发布后状态自动从 `UNAVAILABLE` 变为 `READABLE`。重复提及、时间延续、分页、图 revision、通知禁止条件、受限节点直接查图、并发编辑与 Comment 软删保边且显示 `DELETED` 均有验收；不假设 Comment 已有恢复入口。下一轮运行时合同不依赖历史 set、CurrentSet 指针、异步关系投影、全量补建命令、旧数据迁移或请求级 SQL 次数预算。

Comment 的父 Article 受限或失去本 Community binding 时，图中的 C 仍能打开 B 的状态页并定位到 C，C 仍可作为图查询起点。B 正文和其他评论不因此展示；指定 C 的正文只按 C 自身状态展示。工作区已消除无 binding Comment 的 `nil` URL／locator 与父 Article Gate 阻断指定 Comment 读取的问题，并增加不依赖图边的资源状态页读取；发布前仍需完成真实页面和跨资源验收。
