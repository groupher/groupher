# Docs Mirror Fix：Queue 正文与站点 Mirror

> 状态：当前 Docs 正文仍由 Queue 管理。此前 D1 tree-only 正文切换未获授权，其 runtime、API、UI、Publisher 与 Seeds 改动已恢复；本文件中描述该切换的目标和批次暂不作为当前实现合同。D0 只读盘点仅覆盖本地 dev，D3 生产数据处置与演练未通过，不能据此放行生产或删除旧数据。2026-11-22 更新。
>
> 合同来源：Passport / Admin、Article History / Diff 与 Co-authors（分别见 `docs/migrations/passport-permissions-refactor.md`、`docs/feature/article/edit-history-diff.md`、`docs/feature/article/co-authors.md`）。这些链接说明本文消费的领域合同，不代表各计划必须整体验收后才能开工；批次的实际并行与切换依赖见 §6。
>
> 当前 Docs 继续遵循 [旧发布队列合同](./docs-publish-queue-refactor.md) 的正文 Queue、Queue WorkingCopy、Approval 与 Release 所有权。本文只维护仍需实施的 Mirror、Gate / Scope、Trash 与数据验收边界；曾提出的 tree-only 正文迁移已撤回，作为历史提案保留在 §5 / §7，不是现行目标。
>
> 文档交付边界：本文与公共读取专项文档同步合入。Passport / History / Co-authors 三份前置合同不属于本次提交，以下保留待独立合入的路径引用；依赖关系不因移除未落地链接而改变。
>
> D2 公共读取子批次的实现步骤和专项验收由 [Docs 公共读取 Scope 收口](./docs-public-read-scope-fix.md) 维护；本文保留产品目标、整体依赖和 D2 完成状态。该子批次满足独立放行条件后可先于 Passport / co-authors / D1 上线，不代表 D2 或本合同整体完成。
>
> 公共读取子批次 R0–R3 已完成本地实施与专项验收：17 文件 173 项通过，实际 HTTP / 页面及计数刷新 / 独立诊断已验证，见 [实施记录](./docs-public-read-scope-implementation.md)。现有 dev/test 未改动、未部署；用户确认无已知外部 cursor 消费者、保留 Y 的状态卡展示。目标环境刷新 / 外部缓存仍须在发布时核验，不代表 D2 整体完成。

## 1. 当前权威与变化范围

```text
Article identity / owner / co-authors / Passport permissions
 +-- ArticleEvent / Snapshot history and Review attribution
 +-- Public identity / binding and cross-community visibility
 |
 +-- Community X -> Docs Queue + Queue WorkingCopy + Approval + Release
 +-- Community Y -> Docs Queue + Queue WorkingCopy + Approval + Release
```

Docs Queue 持有正文 WorkingCopy，并负责正文保存、合并、审批及 Release；Article history / Gate / Co-Author 提供 Article 身份、归因与准入消费。Article 的稳定身份和历史归属不因此复制；每个 Community 的 Queue、目录计划、Approval 与 Release 仍是各自的站点事实。共同作者只凭当前 Article 的明确 grant 编辑其已有 Queue member，不因此获得 Queue tree、Enqueue、Approval 或 Release 权限。

本文件当前负责 D1 Queue-preserving co-author 接入，以及 D2 的站点 Binding、公共读取、Trash 和多站点消费方整改。不得把 Article history / permission 共用解释为 Queue 正文副本或 Queue Release owner 的迁移。

当前具体入口包括 `DocTree.Commands.QueueAccess` 的单 Doc Article 授权、Queue member reader / Save / Merge，及 D2 的 `Publish.QueueRelease / Release / Lifecycle`、`PostPublishConflictRead`、`WorkspaceTrashPurge`、`Articles.Query.Locator / FrontDesk.Article`、DocTree.Publication 读写和前端消费者。D1 不切换 Queue 正文保存、审批或 Release 所有权。

### 1.1 工作区基线与未完成项

| 路径                                     | 当前代码 / 合同                                                       | 本轮仍须完成                                                             |
| ---------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| QueueAccess / Queue member read / Save   | Queue 保留正文副本；当前需接入 Article co-author 的单 Doc read/update | 仅访问当前 Community 已有 member；挡住 legacy default-copy 绕行          |
| Queue Release / Approval / Lifecycle     | Queue 负责正文与目录审批 / Release                                    | 保留当前语义；D2 另行闭合本站 Binding 与 Trash 同事务边界                |
| WorkspaceTrashPurge                      | 当前清理本站 conflict / Binding，未见删除评论操作                     | 统一 Binding 未引用检查，校正文档注释，不以局部修复宣称整个 Trash 已验收 |
| Locator / FrontDesk / Pagination / Press | 本地已统一到 Gate Scope，专项回归通过                                 | 发布时目标环境核验；本项完成不代表其他 D2 写入合同完成                   |
| Comments.Mentions                        | 仍用唯一 ArticleHistoryOwner 推断 Community                           | 改为请求入口事实，支持多 Binding；评论身份始终归 Article                 |

上表仅为本地源码核对，不是运行验收或生产状态。既有 Comment 通过 article_id 关联 Article，并未按 Community 各复制一套；本次未在 Release / WorkspaceTrashPurge 路径发现删除评论操作。整改的是仍假设唯一社区的消费者，不能把目标保护规则写成已确认发生误删。

owner 不可用的恢复、root 接管邀请及所有权转移均推迟到独立方案；不是本次 co-authors / D1 的前置，也不临时赋予镜像 Community lord 正文权限。

## 2. Queue 正文与站点 Release

### 2.0 当前责任边界

Queue WorkingCopy 是 Docs 正文的编辑副本。Queue 对正文保存、合并、审批基线与 Release 负责；Article Snapshot / Event 提供正文版本及贡献归因，Article Gate / Co-Author grant 为相关用户路径提供准入。站点目录 / Queue revision 仍是本站状态，不可把 Article 权限转成目录、Enqueue、Approval 或 Release 权限。

Co-author 编辑入口只面向单篇 Doc：后端同时检查该 Article 的 `article.read_draft` 和 `article.update`，仅返回当前 Community 中已存在的 Queue member WorkingCopy，保存与合并调用现有 Queue 命令并检查 Queue / WorkingCopy revision。Queue member 不存在时不创建 default copy，也不自动 Enqueue。

Queue 保持原有正文与站点 Release 合同。当前 D1 不改变 Queue 正文来源、冲突 / merge、Approval 或 Release 选取逻辑；D2 处理 Gate / Scope、Binding、Trash 与公共读取消费者，不以 Article Public 读取模型替换 Queue WorkingCopy。

### 2.1 正文

```text
Community Docs Queue
  -> 已有 Queue member + Queue WorkingCopy
  -> Save / Merge + Queue revision + Article history / contribution attribution
  -> Queue Approval / Release
Article Passport
  -> 共同作者 Article read_draft / update 准入
```

对共同作者开放的只是在 Queue 已有成员上的正文编辑；不通过通用 Article default WorkingCopy 的 read / save / create / fork / restore 路径绕过 Queue。owner 和当前非共同作者的既有 Docs 编辑行为由原合同管理，不随 D1 准入变化。

Queue 的 BeginEdit、Enqueue、Dequeue、Save、Merge、Approval、Release 继续使用各自现存的 Gate / command 合同。D1 不借共同作者的 Article grant 开放这些站点编排与发布操作。

### 2.2 站点

```text
Community scope / doc.queue.write
  -> tree / page membership plan + Queue body operations
Community scope / doc.queue.approve / doc.queue.publish
  -> 验证 Queue body / tree plan / queue revision / policy revision
  -> Release + current public tree + Binding 删除 + 本站 cache effects
```

Release 保留现行 Queue 正文、Approval、tree 与 policy revision 语义及既有发布记录。D2 按同一 Release 事务验证其负责的当前树、Binding 与本站失效效果；不以 D1 变更重定义 Release。

- 新增公开页面、已发布页面的公共读取和 Review / Lifecycle 规则沿用当前 Docs / Gate 合同，并由 D2 对应读消费者验收。
- Queue Approval 对 Queue 当前合同负责；正文共同作者名单不自动成为站点 Admin 或 Release actor。
- `allow_self_approval`、Queue revision、正文 merge / conflict 与 Release 的关系沿用现行 Queue 合同。
- 共同作者的正文更新仍须通过当前 Doc 对应 Queue member，不绕过站点 Queue 直接写 Article Public。

### 2.3 Release / Approval 字段去留与校验

| 数据 / 执行步骤                                      | 当前合同                                                      | 处理边界                                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| DocsQueueArticle.working_copy_id / Queue WorkingCopy | 活跃正文副本身份；Queue Save / Merge / Dequeue / Release 使用 | 保留现有引用及约束；D0 / D3 盘点实际数据，不按 tree-only 提案删除                                  |
| DocsPublishApprovalArticle 正文 / Queue revision     | 当前 Queue Approval 基线与正文来源合同                        | 保留审批记录及运行规则；不得改写 sealed approval 或转换为 tree-only 审批                           |
| QueueArticleContributor / TreeContributor            | 正文贡献和目录计划贡献按现有 Queue 模型记录                   | ArticleEvent / History 为正文历史归因提供 Article 层消费；不替换 Queue Approval 的贡献者事实       |
| DocsPublishReleaseArticle.snapshot / Queue body      | Queue Release 对正文与站点发布负责                            | 保留当前 Queue Release 语义与历史；不迁移列、不改名、不批量删除                                    |
| Article Snapshot / Event / Review                    | Article 身份下的历史与准入消费，不是 Queue 正文 owner         | Co-author / Gate / History 依 D1 当前合同消费；不能据此移交 Queue WorkingCopy / Approval / Release |

Queue 正文更新、审批和 Release 按现行合同推进 Queue revision 并执行既有冲突处理。D2 对 Release 涉及的本站树、Binding 与 cache effects 保持原事务边界；故障重试不得绕过命令 Receipt 或回放不匹配的已确认结果。

## 3. Mirror、删除与重新加入

Mirror 仅允许已有 Public 的 Article：由同时具有目标 Community 的 article.mirror 和 doc.queue.write 者创建 Binding 和工作区页面引用，不复制正文、Review、Lifecycle 或 co-author。新建本地草稿不受此 mirror 前置限制。历史归属沿用 ArticleHistoryOwner，不恢复已退役 DocsHistoryOwner。

权限目录唯一见 Passport §4.3（待独立合入：`docs/migrations/passport-permissions-refactor.md#43-article-与社区展示操作的完整-action-清单`）。本站下线 / 恢复分别检查 community.article.hide / community.article.restore，本站 Trash 读取检查 community.article.trash.read，均属 Community scope；目录修改另查 doc.queue.write。移除 Binding 检查被移除 Binding 所在社区的 article.unmirror；move 检查来源 article.move（依赖 unmirror）及目标 article.mirror，两端各自检查目录权限，同事务重查并原子提交，不因拥有目标权限而获得来源权限。Release 按本站发布 / 审批规则执行，移除意图须重查授权，不能借旧计划绕过撤权。

| 时间点                                             | 目标行为                                                                                                               |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 删除工作区中的已公开节点                           | 产生本站 pending tree deletion；Public tree / Binding 暂不删除，公网仍可读                                             |
| 发布删除                                           | 同事务写 Release，移除 current public tree membership；本站已无该 Article 任何页面 / 工作区有效引用时删除 Binding      |
| 发布前恢复节点                                     | 取消对应删除计划、推进 queue revision，原公网入口不闪断                                                                |
| 发布后恢复                                         | 建立工作区引用 / 必要 Binding，重新入目录计划；未 Release 前本站直链仍 404                                             |
| 同一 Article 在本站工作区 / 公开树分别有 page 引用 | 删除一侧引用不移除仍被另一侧有效引用使用的 Binding；同一目标树内不允许重复 page doc_id，公网可见性只按当前公开页面判断 |
| 清理本站 Trash                                     | 仅清本站工作区 / queue / trash；不代替 Release 删除仍公开的节点                                                        |
| 删除最后一个 Binding                               | 无站点公开入口，Article / Public / Snapshot / events 保留                                                              |

用户看到的“删除页面”是移除本站入口；最后一个公开入口删除后各站均不可见。它不表示立即物理清除正文、评论及历史，也不要求提供零站点入口继续发布的功能。

Binding 可为工作区编排存在，因此不是公开凭据。Release 删除与 Trash purge 共用一项事务内 Binding 清理步骤：遵循 Passport 共享锁序（待独立合入：`docs/migrations/passport-permissions-refactor.md#42-本轮写入共享锁序唯一维护位置`） 取得站点与 Article / Binding 所需锁，在删除当前引用后检查本站工作树、公开树、活动 tree Queue；只有三者都无有效引用时才 DELETE Binding（已不存在返回成功），不能各自写一份不同的判断。只有本站再无有效工作区 / 公开引用时才删 Binding；如果仅剩 Trash 或历史引用，不保留公开 Binding。ArticleHistoryOwner / Release 引用独立保留，不能因 Binding 删除而清历史。实际 DELETE Binding 前，先按依赖显式处理 cms.article_binding_trash 的 RESTRICT 引用：Doc 正常不产生该表记录，若存在旧异常记录，D0 报告并给出明确处置，不能静默级联或直接忽略。非 Doc 的同类 Binding 清理由 P2B 负责；全局永久删除依 Diff §6.2 先删本站事实再删 Binding。

### 3.1 公开读取

```text
当前行 Binding 所属 Community 可公开读取
AND 关联该 Community 与 Article 的 ArticleBinding 存在，Article.thread = doc
AND ArticlePublic + PublicBody 存在且一致
AND ArticleLifecycle / Review 允许公开读取
AND EXISTS 本行 Community 的 DocsTreeNode（stage = public、type = page、doc_id = Article.id）
```

目标为不满足时本站直链不可读，其他站点不受影响；FrontDesk 的 Article not-found 是 6008，GraphQL 通过 extensions.code 返回，页面 HTTP 404 另行验收，不声明现有树后置检查已稳定返回 404。授权编辑 / 历史 / 站点预览是独立入口，不能放宽公网路由。公共读取条件唯一由 Gate Scope 的 Doc 分支维护；FrontDesk（含内部 Locator）、GraphQL 单篇 / 列表、SSR、Search、Press / RSS / sitemap、Mention endpoint 和公开投影消费者统一消费该可组合 Scope，不能各自补一份权限过滤。

上述目标的实施细则及专项验收见 [公共读取子批次 §2–§6](./docs-public-read-scope-fix.md#2-唯一权威与调用链)。Scope 不接收请求 Community，单站调用方限定目标 Binding / Community；树条件关联行内 Community，hidden: true 仍算直读 page 凭据但导航按既有 hidden 规则隐藏，使用 EXISTS 表达成员存在性并避免树 join 进入消费者的别名空间，不以重复 page doc_id 为前提。写入校验及公开 page 唯一索引均禁止本站同 stage 重复 page 指向同一 Article。仅 Doc 的 policy_mode == :public 新增 tree / 当前 PublicBody 条件，不能仅按 stage: :public 挂载；owner_management 单读和 insights_management 保持现有准入，不把独立管理意图称为绕过公共检查。

站点删除只撤除本站公共搜索 / feed / sitemap 入口与 cache tags；共享正文仍有其他入口时，不发全局 Article 删除事件。Article 正文公开变化的失效覆盖所有当前 Binding 站点，Outbox 旧重试按当前权威重读，不复活已删除页面。外部 Search / Press 的索引身份须包括 Community scope，不能按 Article ID 整条全局删除。

### 3.2 多站点交互与当前公开读取缺口

同一篇安装说明在 X / Y 展示：用户在 Y 留评论并 @小李，评论和 reaction 属于同一 Article；本次操作的入口是 Y。不能用“该 Doc 必须只有一个历史归属社区”来推断入口，否则新增第二个归属后评论保存可能在 Mention 捕获阶段失败。Comments.Mentions 当前就含该唯一归属判断，须列为 D2 的显式整改点，不能将此遗漏误判为改回单社区模型的理由。

请求显式传入 Community，经 FrontDesk / Gate 核对本站公开入口；共享评论 / reaction / stats 不按站点复制。Mention 关系继续归内容；通知跳转在投递 / 点击时选择当前可访问站点，不把已删除的 Y 入口当永久地址。单站删除不清全局关系或互动。

共享评论的可见与审核规则沿用 [Article Lifecycle / Comment 合同](../feature/article/article-lifecycle-comment-decoupling.md#1-完成后的规则)：X / Y 在父 Article 与 Comment 均允许公开读取时看到同一套评论 / 回复 / reaction / 计数；任一站点举报指向同一个 Comment。单次举报不直接隐藏，既有阈值限制另按合同执行；平台审核隐藏 / 恢复在所有可读入口生效，创建地管理员不因此获得全局处置权。共享 is_folded 等内容状态不表示本站私有副本，不新增“X 隐藏、Y 仍显示”的 Comment 状态。社区只决定入口准入，举报发生地不改变目标归属或全局审核权限。

D2 必须让 Doc 接上与普通共享 Comment 一致的 Review 平台范围检查及 Scope，不能只删除 Mention 唯一归属判断；当前 Review.Decisions 的共享 Comment 分支还需纳入 Doc。新增站点局部隐藏功能不在本批范围。

Locator 是 FrontDesk 内部把“Community + thread + 本站 inner_id”批量解析成稳定 Article 的查询模块，不是新权限层，调用方不直接进入。

整改前具体缺口（本地读取修复已完成，见实施记录）：Locator / FrontDesk 为单篇补 public tree 检查；FrontDesk 的检查返回 false 时 read_stable 的 else 未匹配该值，静态存在 WithClauseError 路径，尚未运行复现；Articles.Pagination 仅 public_tree 选项开启时添加树条件；Press 又单独执行树查询。结果可能出现 Y 详情拒绝或异常，而忘带选项的集合仍返回该 Doc；Press 为同一条件额外查询；后续规则修改易漏掉一处。并非所有当前路由已复现泄露，D2 应对每个入口做实际用例验证。

R0 基线中 GraphQL docPage 默认 thread: :doc，resolver 不传 opts，Pagination 的 public_tree 默认为 false；隔离库已复现 Y 集合泄漏，本地 R1/R2 已删除开关并验证 Y 空集合。该入口及 count / indexer / 其他 public_binding_ids 消费者的盘点、迁移和专项验收统一见 [公共读取子批次](./docs-public-read-scope-fix.md)，本文不再维护第二组读取实施批次。

公共集合的可组合条件统一归 Gate Scope 的 Doc 分支，包含行内 Community / Binding / public tree / Lifecycle / Review / 当前 PublicBody；消费者移除重复公共过滤及可选开关。现有分页经 public_binding_ids 子查询消费，外层投影 join 不受语义去重要求禁止。PublicBody 精确读取由 Articles.Public 保留，禁止回退历史正文；R1 / R2 保持 FrontDesk 对 Public.current 失败的 not-found 映射及后续投影错误传播，独立损坏诊断与协议边界见子批次 §4，不要求缺 Body 的稳定单读必然返回 public_body_missing。

## 4. Trash、历史与全局销毁

Doc 的本站 Trash 不是只有 pending tree deletion：组合视图以 TrashAction（root_type = doc_tree_node）为回收单元，成员为 trashed_doc_tree_nodes / trashed_doc_articles，按 trash_action_id 归组，附加 Queue 的 pending 状态；删除尚未 Release 时公开页仍可见，Release 后保留 Trash 记录并标实际下线，group 仍按 subtree 单元。组合视图使用 pagedCommunityArticleTrash / communityArticleTrash，Doc item 为实现 CommunityArticleTrashItem interface 的 CommunityDocTreeTrashItem；接口、类型 / thread 映射、读取权限（仅 community.article.trash.read，不依赖 preview）、恢复所需 doc.queue.write、去重与 P2B / D2 adapter 归属统一见 Passport §4.4.2（待独立合入：`docs/migrations/passport-permissions-refactor.md#442-本站-trash-组合视图与-graphql`）。本站 / 全局 Activity、Doc 计划与 Release 实际生效的措辞及投影统一见 §4.4.1（待独立合入：`docs/migrations/passport-permissions-refactor.md#441-activity-投影与审计社区`）；D2 必须同批更新相关 Activity 合同及前端展示；存量缺 operation_scope / effect 按 NULL 和旧措辞显示，新相关事件必填，其它事件不受影响，具体字段规则以 Passport 为准。

站点 Trash 可清理本站 tree trash、工作区节点、Queue tree change / conflict 和不再使用的 Binding。不得删除 shared Public / PublicBody、ArticleLifecycle、default WorkingCopy、ArticleSnapshot / article_events，或按 Article ID 全局删除 Mention / Review / AlertWall。

历史与 diff 复用 Article 基座：

- 正文“谁、何时、改了什么”走 ArticleEvent / Diff，需要 article.history.read。
- 站点目录历史记录本站贡献者、tree before / after 与 Release，需要 Community 目录历史权限，不能因此读取全局草稿。
- 旧 Release 的观察 Snapshot 不是草稿历史授权；本站历史页可展示已获准公开的发布观察内容，读取仍校验当前 Article / Review 限制，不通过快照绕过内容限制。
- 站点删除或社区销毁不级联共享正文历史；最后入口消失不置 global deleted。全局 article.trash / restore / permanent_delete 遵循 Diff 基座 §6.1（待独立合入：`docs/feature/article/edit-history-diff.md#61-删除范围与历史结果`），不新增 delete / destroy 同义动作；本站目录命令不能触发全局永久删除。
- 内容恢复只生成新 WorkingCopy 修改和 restore event，不回滚整个站点 Release；目录恢复不回滚正文。

## 5. 先前提出的 Q 正文退出方案（未获授权，当前不执行）

先前提案拟退役 DocsQueueArticle.working_copy_id / source_snapshot_id 正文来源、Q 正文保存 / 合入 / 正文 diff、DocsPublishApprovalArticle 正文审批事实、站点正文 conflict / stale / rebase 和 Release 选择正文的路径。该切换未获授权且已撤回。当前 Enqueue / Save / Merge / Dequeue、DequeuePreview、Queue body Approval / Release、对应 GraphQL / CMS / 前端与 Content Publisher 入口均保留；正文 preview/diff 继续读取 Queue 副本。Article Snapshot / ArticleEvent history 不替代 Queue 正文所有权。

Queue 正文成员、正文贡献者、Approval 和 Release 发布合同属于当前实现。结构化 tree change、queue / policy revision、tree contributor、不可变 Release 树及 Article 页面历史继续并存。DocsQueueArticle 与 DocsQueueArticleContributor 是活跃运行时数据，不应仅凭 D0 盘点将其视为退役历史行。D0 / D3 仍须确认数据保留和清理边界，不能批量删除，也不能把当前本地保护视为克隆 / 生产放行。

切换前 report-only 盘点 Article、站点、Q WorkingCopy revision、独有修改、Snapshot / assets / approval / Release 引用，生成可逐项处置的清单。未发布 Q 内容不得静默丢弃或覆盖 Shared Public：有独有编辑则固定完整 Snapshot、保存可追溯来源并交 owner / 有权共同作者处理；可由其显式 fork 为独立 WorkingCopy，或明确批准丢弃。无实际变更的副本可在引用解除后清理。

本地 `groupher_server_dev` 的只读 D0 结果为零条 Queue 正文 / Approval / Release 记录，见 [本地盘点报告](./evidence/docs-q-d0-local-inventory-20261122.md) 和 [可重跑的 report-only SQL](./evidence/docs-q-d0-inventory.sql)。该结果不代表生产或克隆环境为空，也不放行 DDL。

Co-Authors / Passport / Docs Queue 本轮遇到的过期测试夹具、由此发现的真实生命周期缺陷及验证结果，记录于 [测试清理与回归记录](./evidence/test-cleanup-findings-2026-11-23.md)。该记录区分已通过的本地测试与尚待完成的浏览器 / D3 验收。

不自动合并多个 Q，不把旧 Q Snapshot 伪造为新 Public 基线。新内容历史从实际切换点记录，不伪造过去作者。历史引用保留期间不得删除其 Body / Cover / assets。

如果将来重新批准 tree-only 迁移，必须先完成 D0 逐行处置、备份和克隆库演练，再明确正文、审批与 Release 的兼容边界。当前恢复的 Queue body API 与 consumer 继续运行；WorkspaceDelete 按原 Queue Dequeue / confirmation / remove 流程处理成员。WorkspaceTrashPurge 与 HistoryPurge 对尚未解除的历史 Queue 引用保留独立保护，D0 / D3 未通过前不得清除这些引用或历史数据。

## 6. 当前实施批次与依赖

当前合同保留 Queue 对 Docs 正文副本、保存 / 合并、Approval 与 Release 的所有权。D1 只接入 Article co-author 对现存 Queue member 的单 Doc 正文读取与保存准入，不切换正文所有权、不退役 Queue 正文入口，也不增加 co-author 的目录、Enqueue、Approval 或 Release 权限。

```text
P: Passport / Admin / ref / Community Admin 请求 producer
  -> H: 不可变修改历史 / Diff
  -> C: Co-authors + 普通 Article 授权入口
  -> D0: Q 数据只读盘点
  -> C3: 普通 Article 授权入口切换
  -> D1: 单 Doc existing Queue member Article auth
  -> D2: Gate / Scope 公共读取入口与 Trash 等消费方
  -> D3: 生产 / 迁移演练及全消费面验收

M: Messaging Notice / Dedup / Inbox 通用基础设施（与主链并行、独立验收）
P4a: Passport 消费方盘点（可与 C1/C2、D1 并行）
P4b: 各领域按自身边界清理旧入口（可并行）
P4c: Passport 全局收尾验收（等待相关消费方切换及 D3 验收）
```

D0 可只读提前进行。D2 的公共读取子批次是可提前发布的明确例外：按 [专项步骤及退出条件](./docs-public-read-scope-fix.md#5-实施顺序) 完成 R0–R3，保持管理 / insights、现有写入保护及非 Doc 行为后，可独立于 Passport / co-authors / D1 上线。R1 / R2 必须同一可发布变更完成，且 R2 发布前必须确认实际 Doc cursor 消费者收到 GraphQL errors[].extensions.code = 4203（服务端 reason: cursor_query_mismatch）时会清除旧 cursor 并从第 1 页重取，缺失时在同一变更中补齐并验证，不能推迟到 R3。R1 / R2 是原子实施单元，R3 是首次发布前最终专项验收，全部相关退出条件满足后才可放行。无 feature flag、无 DDL；回滚 revert 整个读取变更并记录原缺口恢复风险。本地验收时用户确认无已知外部 Doc cursor 消费者，仓库无运行时 Doc cursor UI；已验证两个 API 的 4203 响应及无 after 首屏重取，没有新增无调用方的 UI 恢复分支。后续接入实际客户端仍须满足恢复合同。该放行不包含 Binding 清理、Trash、多站点互动或搜索缓存架构，不代表 D2 完成。

D1 和 D2 的实现可在隔离开发中拆分并行准备；由于共用 Gate / Scope 与路由入口，正式切换按 C3 → D1 → D2 顺序合入并验证。D1 的 co-author 准入以当前 Article 的 `article.read_draft` + `article.update` 为准，只查询本站该 Doc 已有 Queue member，并保存到该 Queue WorkingCopy；不创建或读取 default WorkingCopy。局部交付不代表 D2 或 D3 完成。

本节描述 Docs 的实施顺序，不是所有任务的统一开工顺序。D0 只读盘点、Passport P4a 消费方清单、P4b 各领域自有清理，以及不触碰不稳定 Gate / Scope 合同的 D1 / D2 开发可并行。D1 正式切换依赖 C3 的 Article 授权合同及 D1 实际消费的 History 数据 / 接口合同验收，不等待完整 H3 UI / E2E。D2 按其自身读写合同和专项验收推进。D3 的生产 / 迁移演练必须等待相关消费者完成切换和验收；P4c 全局收尾也等待这些消费方与 D3 验收，不阻塞 C1/C2 或 D1 的独立开发。

public_binding_ids 虽被 BindingPersist 的最后一个公开 Binding 删除保护使用，但其 unmirror 入口只允许 post / blog / changelog，Doc 返回 unsupported_for_doc。本子批次只收紧 Doc Scope，须验证普通 Article 的删除保护不变，不为不可达的 Doc 分支分离保护查询或新增产品决策门槛。Doc Binding 清理仍归本 D2 的 DocTree 发布 / Trash 引用合同，不能由 BindingPersist 的普通 Article 规则推导。

D2 保留 DocTree.Publish.PublicTree.validate_pages 的候选页面与提交完整性验收：目前业务校验只查询 Article / 本站 Binding / ArticlePublic，但 R0 已确认迁移及兼容参考库存在 Public / PublicBody 双向延迟复合 FK，正常提交会拒绝缺 Body 或版本不匹配，不能将未显式 join Body 当成已确定的永久坏节点发布漏洞。须区分事务内暂态、旧库缺约束及其他不可读原因；读侧过滤不替代提交约束，也不证明发布闭环。D2 保持约束与事务边界，是否需要业务层提前报错按真实用例确定，不强制新增重复检查。候选页面验证不能要求节点已存在于公开树，也不能恢复正文版本绑定目录审批的旧语义。

D1 从单 Doc Queue member reader、Article draft-read / update 准入、现有 Queue Save / Merge Receipt 到单篇 Doc 编辑 affordance 打通。Queue WorkingCopy、Queue revision、保存 / 合并语义、Approval / Release owner 保持原状；拒绝 co-author 经 legacy default WorkingCopy 读取、保存、创建、fork 或恢复入口绕过 Queue。D2 将其 own Gate / Scope 和 Binding / Trash 消费者按已核定合同逐项切换，统一采用 Passport 共享锁序，不在本节另定锁序。D3 只在批准的目标环境执行数据盘点、克隆演练、备份与回退准备；本文不授权生产执行。

### 6.1 唯一入口归属与放行

| 入口 / 数据                                                                   | 唯一负责批次                  | 其他批次提供什么                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 非 Doc 本站下线 / 恢复 / Trash 及消费者切换                                   | P2B                           | D 不拥有 Posts / Blogs 的实现；P4 退役旧入口前必须验收，不以 Docs Tree 替代                                                                                                               |
| Permission 合同 / 生成器、Admin / Global 授权、ref、Community 管理 Gate       | P1 / P2                       | C / D 只消费 Passport，不重新定义目录                                                                                                                                                     |
| Notices / Dedup / Inbox 通用基础设施                                          | Messaging M1 / M2             | Passport P3 与 Co-authors C1 各自实现并验收领域 producer；边界见 [Messaging Notices 与 Inbox 收口](./messaging-notices-refactor.md)                                                       |
| Community Admin / Article 请求通知 producer                                   | Passport P3 / Co-authors C1   | 复用 Messaging M1 / M2 合同；两领域的事件语义、接收方和资源授权分别归各自文档                                                                                                             |
| Snapshot 前后固定、article_events、Diff / history 接口及编辑器历史            | H1–H3                         | C 按 Co-authors 合同验收自身准入、归因、Review 与双账号流程；D1 验证其实际消费的事件 / Snapshot / 授权 / 贡献者接口。完整 H3 UI / E2E 只门控 History 自身交付，不作为 C3 或 D1 的整体前置 |
| Article co-author 关系、请求、普通 Article read_draft / update / publish 授权 | C0–C3                         | P 提供公共权限接口；H 提供历史                                                                                                                                                            |
| Article co-author 对单 Doc 现存 Queue member 的正文读取 / 保存准入            | D1                            | C3 提供 Article `read_draft` / `update` 授权判断；Queue 保留正文、Save / Merge、Approval / Release 所有权；co-author 不获得 Queue tree / Enqueue / Approval / Release 权限                |
| Docs Queue 正文副本、正文审批基线、Release 正文选择与正文 stale / merge       | 当前 Queue 合同               | D1 仅调整 co-author 对单篇现存 member 的准入，不退役或重分配这些 Queue 入口                                                                                                               |
| Gate Scope Doc 公共查询、移除 FrontDesk / Locator / 分页 / Press 重复过滤     | D2 公共读取子批次；可提前发布 | 实施步骤及专项验收唯一见 [公共读取 Scope 收口](./docs-public-read-scope-fix.md)；FrontDesk 保持外部入口，本文只跟踪 D2 整体状态                                                           |
| Binding 清理、Trash、共享评论 / Mention / reaction 的多站点入口               | D2                            | 事件 / 通知归公共基座，不复制 Article 互动                                                                                                                                                |
| Q 运行数据盘点、生产 / 迁移演练、目标环境验收                                 | D0 / D3                       | D0 仅报告数据，不处置；D3 按审批后的演练合同准备备份 / 回退，不以此退役当前 Queue 正文能力                                                                                                |

### 6.2 Queue-preserving D1 局部交付

1. 单 Doc 页面先查询 Article `read_draft` + `update`，再请求只返回该 Community 中该 Doc 现存 Queue member 的 reader；无 member 返回空，不调用默认副本创建入口。
2. 已有 Queue member 时复用 Queue WorkingCopy 编辑器；读取、保存、合并始终携带 Queue revision 与 WorkingCopy revision，调用原 Queue Save / Merge 命令。
3. 后端仅在当前 Article `update` 授权允许 co-author 对该现存 Queue member 保存；无 `read_draft`、无 `update`、其他 Doc、非本 Community、member 移除或不存在均拒绝或不返回内容。
4. 正反例覆盖 Queue member 可读 / 保存、另一个 Doc 与移除后失权、co-author 不能经 default WorkingCopy read / save / create / fork / restore 绕开 Queue，也不能 Enqueue、改树、Approval 或 Release。
5. D1 不增加 DDL，不改变 Queue owner、正文副本、revision / merge / approval / release 语义；D2 / D3 另按各自验收和批准执行。

WorkspaceDelete 维持原有队列生命周期：先检查 Q-only 编辑及其 confirmation，再通过 `Queue.remove_many` 清理该操作拥有的队列成员，随后写入 Trash 与树变更。WorkspaceTrashPurge 与 HistoryPurge 分别保留对尚存 Queue 引用的保护；D0 / D3 仍负责判定历史数据最终处置，不能将合法活动成员一概视为删除 blocker，也不能级联清理历史正文。

外键顺序按真实引用确认：旧 docs_queue_articles(article_id, source_snapshot_id) 引用 article_snapshots(article_id, id)，不引用 ReleaseArticle.snapshot_id。Release 列 rename 本身不要求先删除 Queue FK，PostgreSQL 会保留列身份及关联约束；真正删除旧 Queue 副本 / Snapshot / Body 前，必须先清理或迁移所有引用，并先证明历史保留引用仍完整。D0 输出依赖清单，D3 在克隆数据库验证该顺序，禁止为消除 FK 报错 CASCADE 删除历史。

## 7. 先前切换提案的验收矩阵（当前未执行）

本节验收 Mirror Fix 整体目标。公共读取子批次的文件级测试、双社区 fixture、count / indexer / comments / Mention endpoint / status / 导航 / summaries / Binding 删除保护、管理 / insights、非 Doc 指纹兼容、Doc 4203 cursor_query_mismatch 及客户端重置验证与缓存残留窗口统一按 [专项验收矩阵](./docs-public-read-scope-fix.md#6-验收矩阵) 执行并引用记录，不另建一套读取退出标准。提前发布通过不代表下列完整发布 / 删除 / 恢复闭环已通过。

| 场景                                                                                 | 必须结果                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| X / Y 同 Doc，A 编辑正文、B 改标题、C 发布 S2                                        | 修改历史分别归因，两个站点读 S2，两个站点 Release 不推进                                                                                                                                        |
| 普通 Admin / lord 无 Article 权限                                                    | 可按自身目录权限编排，不能读草稿 / 编辑 / 发布正文                                                                                                                                              |
| co-author 有 update 没 publish / 没目录权                                            | 可编辑，不可发布或编排；读取正文历史另需 article.history.read                                                                                                                                   |
| 本地新建未公开 Doc                                                                   | 创建者 owner 可编辑和先发布正文，再发布站点页面；他人不能 mirror 未公开正文                                                                                                                     |
| Y 删除工作区页面未 Release                                                           | Y 公网仍可读；发布删除后 Y 404，X 仍读 S2                                                                                                                                                       |
| Doc Trash 列表 / 详情：未公开删除、pending deletion、Release 后、group、恢复 / purge | 使用 community.article.trash.read 读取，不依赖 preview / write；仅有 trash.read、无 preview 的账号可读限定摘要，条目不重复；计划不冒充实际下线，恢复不自动公开，Activity 仅写目标社区且状态正确 |
| 带本站 Binding Trash 引用的 Binding / Article 清理                                   | RESTRICT 依赖先处理；Doc 异常行先报告，受保护引用仍阻断，绝不误删共享历史                                                                                                                       |
| Y 同 Article 的工作区 / 公开树引用、恢复或 Trash purge                               | 不误删仍使用的 Binding，不复活未 Release 页面                                                                                                                                                   |
| 同一目标树重复 page doc_id                                                           | D2 写入侧 TargetTree 内部返回 {:error, :duplicate_tree_identity}（不据此承诺同名 GraphQL reason），公开 page 唯一索引继续生效；不构造重复公开 page 的合法读取 fixture                           |
| 最后 Binding 删除                                                                    | 所有站点无入口，全局内容 / 历史保留，无 global deleted                                                                                                                                          |
| 正文受 Review 限制、无关 tree 发布                                                   | 读取按当前限制，无草稿泄露；目录审批不因正文变化 stale                                                                                                                                          |
| tree 发布到 Public 更新 / 并发删除                                                   | 两类事务不覆盖彼此；版本与公开条件在锁内核对                                                                                                                                                    |
| tree / Binding / Release / Outbox 任一步失败                                         | 全事务回滚，重试不重复记录或部分删除                                                                                                                                                            |
| 发布候选页的 PublicBody 缺失或与当前 Public 不一致                                   | D2 保持双向 FK 的提交完整性，事务内暂态 fixture 最终回滚，提交尝试被拒绝；验证并发边界，读侧导航隐去 / 404 不替代该验收                                                                         |
| Q 有未发布独有修改                                                                   | 未处置则切换阻断；处置后 Snapshot / assets 完整可读，不覆盖全局 Public                                                                                                                          |
| Search / Press / cache 延迟重试                                                      | 已删本站入口不复活，其他站点不被 Article ID 全局删除                                                                                                                                            |
| 共享评论 / reaction / Review                                                         | X / Y 读取同一评论，跨站回复 / 互动不复制；平台隐藏 / 恢复各入口一致，Community Admin 不得误获全局审核权                                                                                        |
| 正文 / 目录 Diff、旧 Release 历史                                                    | 权限分离、身份和来源清晰，无正文审批基线或站点正文副本                                                                                                                                          |

组合视图的 publicVisible 必须按 Passport §4.4.2 在同一 entries SQL 中批量投影；Doc group 用 Gate 公开 Scope 组合的 EXISTS 判任一页面，不逐条加载或调用 Gate，不跨请求缓存。D2 验收多 group / 多成员下查询次数不随条目增长；P2B 验收非 Doc 恒 false、固定 "1" token 与重新下线新 id 的保护。查询的 thread 入参及 item 均使用四值 CommunityArticleTrashThread，同源生成与 adapter 映射一致。其合同独立归 packages/contracts/community-article-trash.contract.json，不加入 Gate 权限目录。Doc item.id 为 TrashAction.hash_id，详情 / restore / purge 同义，恢复复用 WorkspaceRestore.run/8 的 action_id，内部 groupKey 与该公开 id 一致且不单独公开。D2 另验混合 subtree：一页已 Release、一页 pending 时 status=effective、removedMemberCount=1、pendingMemberCount=1，与详情成员状态一致；publicVisible 单独按公开条件计算，UI 显示“部分已下线、1 项待 Release”。D2 另验多页 group 在 entries 恰好一行、按 TrashAction 单元顺序分页无重复 / 无遗漏；禁止展开页面 join 改变条目数。

D2 的恢复目标和读事务合同统一见 Passport §4.4.2：缺省恢复到回收快照的原父 / 原顺序，原父缺失返回现有 docs_restore_parent_missing，父仅移动且仍合法不拒绝；显式 targetParentNodeId / targetIndex 支持用户选位，未提供与显式 NULL 选根必须区分，失败整笔回滚并保留 action。组合视图读不获取 docs_site advisory lock 或行写锁，需要同响应跨查询一致时使用同连接只读 REPEATABLE READ；读写并发验收不因站点锁互相等待，不把恢复写命令也改成无锁。当前分支已本地接线并定向验收“缺省 vs 显式 null / root / index-only 拒绝”这一 adapter 子合同，边界和剩余验收见 [D2 Restore Target Adapter 本地验收记录](./evidence/docs-d2-restore-target-acceptance-20261122.md)；这不代表 D2 整体完成。

D2 补充目标父验收：默认 / 显式目标父及全部祖先都不能位于任何有效 pending deletion 子树中，亦不能位于本次恢复 subtree 内形成环；在恢复写锁内重查，失败保留完整 action，默认不可用目标沿用 docs_restore_parent_missing。详情打开后 Queue / Release 变化，分页成员按不透明 recordRevision 校验，旧版本刷新整个详情及游标，不混合旧计数和新成员页；action 已恢复 / purge 则结束操作并刷新列表。Doc token 服务端生成 / 校验，客户端只原样传回，独立 tree / Queue 版本检查继续执行。D2 另验 A 节点生成详情 token、B 节点处理 pagedMembers / restore 时可无状态校验；全节点协调轮换密钥后旧 token 返回冲突并要求刷新，不自动重试写入，具体派生合同见 Passport §4.4.2。

旧 :docs_trash_read 已确认映射 doc.trash。D2 接管读路径，只检查 community.article.trash.read；迁移全部 doc.trash 消费者后同批删除旧键、内部映射及旧入口，不保留过渡入口、双读或 fallback。仍有删除命令等消费者未迁移时阻断切换；P0 对账资源 / thread 范围差异，不补授 preview。

D0 / P0 清点 TrashAction 根 / 成员归组及历史多根异常，并冻结数百页面 subtree 的查询预算；D2 按 Passport §4.4.2 验证实际 p95 / 扫描预算和 SQL 计划。旧 docTreeTrashItems 字段、resolver 入口、schema/docs.ts 查询与 Dash 消费者同批退役；保留对既有领域 :docs_trash_read 的真实准入核对，不将 schema 缺 middleware 当作已复现越权。D2 负例覆盖匿名、缺 community.article.trash.read 的账号无法读取标题 / 删除时间；只有该读取权限而无 preview / write / publish 的账号可读限定摘要，但不可读草稿 / Snapshot / 完整发布预览，旧字段不再存在，nodeId / 成员 id 不能用于恢复整个 action。

执行 focused Article / DocTree / Gate.Scope / History / Review / Mention / Trash / Search / Press / Outbox 数据库与并发测试、mix compile --warnings-as-errors；schema / codegen / freshness、Dash / Community type-check；在 /home/xx 和第二个有测试数据的隔离站点验证多站点闭环（默认使用 /home/xx，第二站点由 fixture 显式建立）。增加 Gate Scope 的 query / SQL 形状测试：详情 / 列表 / Press 同集、分页不依赖 public_tree 开关、无逐行额外查询（N+1 / 后置 exists）或逐行 Gate，保留 Scope 内 SQL EXISTS。docs:check 仅验证链接 / 结构及既有静态门禁，不证明这些业务条件。真实 Search / CDN / Press 投递与生产 URL 单独验收；静态 / mock 通过不代替它们。

P2B 接入后，本篇相关验证还须运行：在 packages/contracts 执行 pnpm run generate:community-article-trash、pnpm run generate:community-article-trash:check、pnpm test；根目录执行 pnpm run contract:community-article-trash；在 backend/api 执行 mix test test/groupher_server/cms/articles/community_article_trash_contract_test.exs；并执行 pnpm graphql:codegen / pnpm contract:graphql:generated。脚本注册、包 test / CI 串联和 parity 测试的唯一规格见 Passport §4.4.2；接入前标记未提供，不将这些计划命令列为已执行检查。
