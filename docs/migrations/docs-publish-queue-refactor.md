# Docs 独立发布队列与去 Branch 重构

> 状态：目标方案，尚未实施。本文定义产品与架构目标、迁移边界和验收条件；当前运行时合同仍以代码及现行 Gate、Article、DocTree 文档为准。
>
> 范围：每个 Community 的 Docs 站点只有一个活动发布队列。取消 Doc 的 branch 维度及旧 branch API，不提供双写、旧参数兼容、旧数据迁移或 preview branch 合并。新合同从空的 Docs 数据状态启动；本文所说的 Release 历史均指新合同上线后产生的记录。

## 1. 决策与产品语义

面向作者的概念是**草稿、发布队列、预览、审核、发布、历史、回收站**。普通作者不需要创建或切换 Branch。

```text
Doc 正文草稿 ──作者显式加入──┐
                            ├── 每站点唯一的活动发布队列
目录草稿 ──可发布变更自动加入─┘                │
                                             ├── 预览 / 审核
                                             └── 一次原子发布
                                                       │
                                                       v
                                             不可变 Docs Release
```

- 发布始终消费**整条队列**，请求只携带站点、`command_id` 和预期队列 revision，不在请求中临时选子集。“单篇发布”指作者调整队列后只剩一篇 Doc 及其必要目录依赖；多篇文档和目录变更共享同一条发布路径。
- 保存正文草稿不自动入队。未入队草稿不参与队列预览、审核状态或发布。编辑器显示“草稿未入队”（小圆点）；入队后显示“待发布”（小飞机），并提供文字标签，不仅依赖图标。
- 作者可以“移出队列”，保留 Doc 正文草稿；目录变更默认自动入队，但可通过“撤销改动”恢复公开状态，或“暂缓发布”保留工作区目录草稿并移出队列。两种操作都必须重算目录依赖；被其他队列成员依赖的变更不能单独暂缓。队列预览与发布只使用仍在队列中的目录变更，不能泄漏暂缓的工作区状态。
- 已有公开页面的目录排序、重命名、移动及删除默认自动入队。创建空文档只建立工作区节点和正文草稿，不进入队列，也不出现在公开或队列预览；内容达到可发布条件并由作者入队时，正文和目录位置一起入队。新建 Group / Tab 默认只留在工作区；被入队文档引用的父级壳节点自动作为依赖入队。
- V1 可发布条件：新 Doc 有非空白标题和非空白的语义正文（纯空段落、空格不算）；新 Group / Tab 有非空白名称且父级链可发布。没有入队子项的空 Group / Tab 不自动入队；若产品允许刻意发布空容器，须另加显式确认命令，不借自动目录入队隐式发布。
- 删除已公开文档或目录时，公开内容的删除进入队列；发布前公开站点保持原状。删除范围内从未公开的草稿进入可恢复回收站，不凭空生成“公开删除”队列项。确认界面列出受影响的公开文档和未公开草稿数量。
- 已入队但从未公开的 Doc 被删除时先出队、再进入回收站；目录混合删除拆为公开节点的待发布删除和未公开草稿的回收，不把后者记成公开删除。发布前恢复删除事件会撤销相应队列效果；若恢复牵涉未公开草稿，还须恢复其稳定 `doc_id` / `node_id` 关系。永久删除仍被活动队列引用的实体应拒绝，要求先完成出队 / 撤销；获批快照必须保存独立不可变内容，历史引用不能因工作区实体删除而级联消失。
- 目录位置属于稳定的 `node_id` / `doc_id` 关系，正文草稿不另存一份目录位置。目录发布后，未入队的正文草稿仍跟随同一个文档身份；已删除父节点下的未入队草稿必须有明确的回收或冲突结果，不能静默改挂位置。
- 工作区保留原始目录操作审计；队列成员与审核预览按“公开树 → 队列树”的**净效果**归并。A→B→A、删除后恢复到原位不留下有效待发布变更，连续重命名只显示最终名字；归并、撤销或恢复仍推进队列 revision，获批后审批状态据此显示为 `pending`。
- 读者可见的产品文档版本（如 1.0 / 2.0）与发布队列、单篇修订和整站 Release 是不同概念；本文不设计读者版本切换。

## 2. 当前基线与差距

| 已有能力 | 当前事实                                                                                          | 目标变化                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Doc 内容 | 稳定 `Article` 身份、可变 `DocDraft`、不可变 `ArticleRevision` / `DocBranchVersion`、`DocPublic`  | 内容身份与不可变修订保留；草稿、公开 head、生命周期和版本序列去 branch 作用域                     |
| 目录     | Draft / Public `DocTreeNode`，带正反 payload 的 staged `DocTreeEvent`                             | 保留两种视图与可审阅事件；以站点而非 branch 为作用域，定义哪些事件属于队列                        |
| 发布     | `Checklist` 临时汇总所有草稿和 staged 目录事件；前端用本地 state 勾选；请求省略选择时默认选择全部 | 服务端持久队列成为唯一成员 authority；成员通过入队 / 出队 / 暂缓命令维护，发布只消费整队          |
| 并发     | `DocDraft.version`、`DocsSiteState.tree_lock_version`、`site_draft_version` / checklist revision  | 保留内容及目录锁；新增独立的 `queue_revision`，未入队草稿保存不得推进它                           |
| 发布结果 | 选中的文档和目录事件在一个事务内发布，写入 `DocPublishRelease`、树快照及成员记录                  | 保留事务与 Release；队列锁定、核对、消费纳入同一个发布事务                                        |
| 审核     | `PublishRequest` 是未来审核模型预留，不是可用的队列审批；已有 Doc 正文 diff 和目录事件            | 退役 `PublishRequest`，建立队列专属审批记录与不可变内容快照，提供“最近获批 → 当前队列”的增量 diff |

当前依据：[Article 目标合同](../feature/article/revision-draft-target.md)、[DocTree 现状](./cms-doctree-refactor.md)、[Checklist](../../backend/api/lib/groupher_server/cms/doc_tree/publish/checklist.ex)、[Selection](../../backend/api/lib/groupher_server/cms/doc_tree/publish/selection.ex)、[Publish Workflow](../../backend/api/lib/groupher_server/cms/doc_tree/publish/workflow.ex)、[Release](../../backend/api/lib/groupher_server/cms/model/doc_publish_release.ex)、[前端选择状态](../../frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/usePublishChecklist.ts)。这些链接描述当前实现，不代表本文目标已落地。

## 3. 目标事实与 authority

### 3.1 草稿与队列分离

每个站点至多一条活动队列。Live Queue 是**待发布改动的成员集合与线性并发水位**，不复制成另一套 Doc 工作空间。持久事实至少包括站点身份、单调递增的 `queue_revision`、Doc / 目录事件成员及加入顺序；`plan_hash` 和可变的 `approved/pending` 字段都不属于 Live Queue。最近获批的不可变快照及审批记录单独存储。成员引用稳定文档 / 节点身份和可校验的源版本；实际表与字段命名在实施批次确定。入队、移出、目录暂缓 / 恢复、删除 / 恢复都是服务端命令，并在一个事务内校验依赖闭包与推进 `queue_revision`。`queue_revision` 按站点独立，新合同空站点初始为 `0`，首次影响队列的写入变成 `1`；不沿用旧数据水位，发布消费后和后续 Release 之间均不重置。**Doc 正文与目录的公开内容基线**只能通过该发布路径改变。ReviewBlock 的可见性与 DocCover 的公开展示投影独立于 Release / 队列水位，按 §3.3 的读取和缓存规则处理。

| 名称                                         | 作用与持久化位置                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `queue_revision` / `expected_queue_revision` | Live Queue 的线性水位 / 发布请求的 CAS 期望值                                        |
| `public_release_id`                          | 当前公开正文与目录基线的 Release 身份；首次发布前为 `null`                           |
| `plan_hash`                                  | 有效计划的派生摘要；仅写入不可变 Approval Snapshot 与 Release，不写入 Live Queue     |
| `approval_snapshot_id`                       | 一次获批内容与计划的不可变快照身份；不用含糊的 `review_id`                           |
| `approved_queue_revision`                    | Approval Snapshot 获批时对应的队列水位，不是另一条 Live Queue 水位                   |
| `plan_format_version`                        | 计划语义与规范化格式版本，写入 Approval Snapshot / Release；格式变化通常需要重新审批 |
| `planner_version`                            | planner 实现 / 部署版本，仅隔离预览缓存；格式与 hash 不变的部署不使旧批准失效        |
| `public_presentation_revision`               | DocCover 与影响预览的 Docs 站点设置的独立公开展示水位；不属于发布队列                |
| `release_id`                                 | 一次 Docs 发布结果的身份；跨域字段必要时用 `publish_release_id`                      |
| `command_id`                                 | Publish Command 的幂等键，由 Receipt 处理，与 revision / hash 分离                   |

正文草稿可独立存在。编辑未入队 Doc 只推进其 Draft version，不改变队列 revision。**编辑已入队 Doc 时，Draft 写入与队列 revision 前进必须同事务提交**；目录变更触发自动入队时，Tree 写入、成员更新、依赖校验与队列 revision 前进也必须同事务提交。失败时全部回滚；不能出现新正文已可见但队列仍被视为获批，或目录事件已写入但未入队。`approved_queue_revision == queue_revision` 只是审批对齐的基础条件；完整 `approved` 还须通过 §3.2 的版本与 hash 校验，无须同步写一个 Live Queue 状态字段。目录事件自动入队须遵守新页面可发布性和依赖闭包，不能让队列树指向未入队、未公开的文档。

`DocsSiteState.site_draft_version` 当前随 Dashboard Docs 草稿变动，不能直接充当队列 revision。`tree_lock_version` 仍负责目录并发；`DocDraft.version` 仍负责正文并发；`queue_revision` 负责队列内容和审核基线。三者不能互相替代。旧状态字段在切换时按下表退场，不能仅改 GraphQL 字段名而保留旧判断：

| 旧字段 / 信号                | 目标处理                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `site_draft_version`         | 不再作为发布清单或审核 revision；若工作区仍需全站变更水位，可保留内部工作区计数并另命名，队列只认 `queue_revision`  |
| `published_version`          | 旧的“所有草稿均已发布”对齐点退役；已发布位置由最新 Release / Public head 表达                                       |
| `staged_event_count`         | 旧汇总语义退役；分别给出队列目录净变更数和暂缓的工作区目录变更数，均从各自成员事实推导                              |
| 前端 `hasUnpublishedChanges` | Doc 内容差异仍可用于“草稿相对公开有改动”，不得用于判定是否入队；目录的旧布尔 dirty 信号拆为工作区有改动与队列有改动 |
| 前端 `stagedEventCount`      | 不再驱动发布抽屉；改读服务端队列目录净变更数及 `queue_revision`，暂缓目录改动另行显示                               |

### 3.2 审核与增量 diff

审核针对一个确定的队列快照。**批准事务生成 `approval_snapshot_id`，记录 `approved_queue_revision`、有效计划的 `plan_hash`、`plan_format_version` 与 hash 算法版本，并将成员集合、每篇入队文档的规范化正文与元数据、目录净效果和树基线复制到不可变审批快照**；从未发布的 Draft 也按同一规则复制。`draft_version` / hash 仅用于校验，不单独充当历史基线。审批快照独立持有这些内容字节，不以可被 `Articles.Revision.Cleanup` 或树快照清理删除的 `ArticleRevision`、`ArticleBodySnapshot`、`DocTreeSnapshot` 引用作为内容来源。正文图片、单篇 Doc 封面等资产还须登记快照专属 asset ref，由资产清理保护；只复制 URL 或元数据不能保证原文件仍可用。站点级 DocCover 展示投影不属于这份队列审批快照。获批内容再变化使队列 revision 超过 `approved_queue_revision`，界面显示 `pending`；原批准记录及其内容保留，恢复、出队、日常清理或永久删除工作区实体不得级联删除快照。

首次审核没有获批快照时，以**当前公开站点 → 当前队列**为比较基线；再次审核默认比较**最近一次获批快照 → 当前队列**，包括正文、标题等元数据、目录净效果以及新增 / 移出成员。再次批准后更新基线；在此之前继续修改时，比较基线不前移。作者仍可查看“当前公开内容 → 当前队列”的发布效果 diff，两种比较不能混用。关闭审核的站点只有发布效果 diff，没有虚构的获批基线。

站点默认不要求审核，以支持随写随发；启用审核时，具有独立批准权限的人才能批准，默认不得批准自己的入队改动（若站点确需自批，须显式配置并留痕）。批准只对应快照，不授予额外发布权限；发布者仍须通过 Gate。审核启用时的状态枚举固定为 `idle / pending / approved / needs_reapproval`：空队列为 `idle`；有成员而获批 revision 不符为 `pending`；revision 对齐、计划格式 / hash 算法受支持且当前计划 hash 经校验相符才是 `approved`；版本不受支持或 hash 不符为 `needs_reapproval`，禁止发布，同版本 hash 不符另记一致性错误。`approved` 只表示审核成立，实际发布仍须通过 Gate、源版本和目录依赖检查。关闭审核的站点不生成批准状态或快照，审核状态字段为空。批准或状态转为 `pending` / `needs_reapproval` 后通过提交后事件通知相关队列参与者；通知失败不改变审核事实或阻止发布。审批策略、权限、通知接收人和无审核模式的状态值须在 B0 固定为合同。

状态查询先用队列是否为空及获批 revision 是否对齐做廉价判断；仅对齐时才校验版本与计划 hash。计算结果可按站点、`queue_revision`、`approval_snapshot_id`、`public_release_id`、`plan_format_version`、`planner_version` 和受支持 hash 算法集合的配置版本短期缓存，不写回 Live Queue；重新审批或算法支持配置改变后旧缓存不可命中。发布仍在锁内独立重建并校验计划，不能信任状态查询缓存。

现有 `publish_requests` 的通用 `target_type + target_id` 和单条状态不承载站点队列 revision、逐次批准快照及历史。目标模型**退役 `PublishRequest` / `publish_requests`，新建队列专属审批记录与快照**；不复用旧表，不迁旧审批行，也不设置旧状态读取回退。

现有 [正文修订 diff](../../frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/RevisionDrawer/model.ts)可复用计算能力，但它当前只建立正文比较对；目录增量可由 [DocTreeEvent](../../backend/api/lib/groupher_server/cms/model/doc_tree_event.ex) 的操作 payload 呈现。审核的权限、审批状态及内容锁与内容治理的 ReviewBot / AlertWall 分属不同业务流程，不共用一个含糊的 `review` 状态。

### 3.3 队列预览与公开读取

队列预览以**当前公开站点**为基线，仅叠加入队 Doc 草稿及入队目录事件。新站点首次发布前没有 Release，统一使用 `public_release_id: null` 加规范化空树快照作为初始公开基线；没有 Release 却存在 Public head / 非空公开树时属于不一致错误，不能当作空站点。预览、首次审核 diff、计划 hash 和首次发布共用该基线，不创建虚构的空 Release。未入队 Doc 使用已公开版本；从未公开且未入队的文档在预览中不可见。预览必须包含导航、正文、链接 / 封面等会影响发布结果的投影，不能只预览单篇编辑器正文。

预览读取要求 actor-aware Gate 准入；公开查询、搜索、评论和 Press 继续只见已发布内容。**单次预览在 PostgreSQL `REPEATABLE READ` 只读事务中**读取公开 Release / Public head、队列 revision、成员源版本和目录有效计划，不能依赖默认 `READ COMMITTED` 下的多次查询取得同一快照。跨页面预览请求携带固定的公开 Release、队列 revision 与公开展示水位；水位变化后提示刷新或整体重试，不能拼出跨 revision 的页面。预览缓存至少按站点、授权范围、公开 Release、队列 revision、`public_presentation_revision` 和 `planner_version` 隔离；planner 实现版本变化时清理旧预览缓存，**不因此自动撤销格式与 hash 均未改变的审批**。ReviewBlock 可在没有新 Release 时改变 `DocPublic.visible`：每次队列预览及公开 Cover 响应仍须按当前 Gate 与可见性事实过滤，`article.visibility_changed` 同时触发相关预览与公开 Cover 缓存失效；异步失效尚未完成时也不能仅凭缓存命中返回受限内容。公开可见性变化不推进 `queue_revision` 或 `public_presentation_revision`。发布前在锁内再次验证队列 revision、成员源版本、目录依赖、Gate 与批准要求。

[DocCover 当前合同](../../backend/api/lib/groupher_server/cms/doc_cover.ex)没有 draft 层，写入立即改变公开 Cover；[Cover Query](../../backend/api/lib/groupher_server/cms/doc_cover/query.ex) 还从公开树和 `DocPublic.title/slug/visible` 派生 Card / Pinned 内容，而现有 [publish hook](../../backend/api/lib/groupher_server/cms/doc_cover/sync.ex) 不写 Cover 行。本轮保留它作为**独立公开展示投影**：DocCover Card / Item / PinnedDoc 或影响预览的 Docs 站点设置写入时，同事务推进站点 `public_presentation_revision`；**每次成功发布也在发布事务内推进该 revision**，即使没有 Cover 行写入。该 revision 按站点独立，新合同空站点初始为 `0`，首次展示变更后为 `1`；不沿用旧水位，也不因发布 Release 而重置。队列预览从同一读取快照取得当前 Cover / 设置，并以该 revision 隔离缓存；公开 Docs Cover / 设置读取若使用缓存，也必须以同一 revision 隔离，否则不缓存。包含可见内容的公开 Cover 缓存响应返回前仍须重新核验当前 `DocPublic.visible` / Gate；做不到则关闭该响应缓存。这些展示变更不因自身进入队列、不因 Cover 写入单独推进 `queue_revision`、不改变审批快照或有效计划 hash。DocCover 仍只能引用已公开节点；B4 停写必须一并冻结 Cover 与 Docs 站点设置写入。

队列以原始目录事件为审计输入，按固定的公开 Release、队列成员、成员源版本和稳定排序规则**确定性重建有效发布计划**，其中只包含带依赖顺序的“公开树 → 队列树”净操作。计划与 `plan_hash` 都不存为 Live Queue 字段；hash 是计划的派生摘要，仅在批准时写入不可变审批快照、发布后写入不可变 Release。hash 输入包含 `plan_format_version`、公开 Release ID（首次发布为 `null`）及规范化树基线、排序后的成员 / 源版本和依赖排序后的净操作，**不包含 `queue_revision`、`planner_version` 或独立的 DocCover 展示投影**；对象键按 RFC 8785 canonical JSON 规则编码，数组顺序由稳定 ID 与显式依赖规则确定，不依赖数据库返回顺序。V1 使用 SHA-256，快照和 Release 均记录 `plan_format_version` 与 hash 算法版本 `sha256-jcs-v1`；改变计划语义或规范化格式必须提升 `plan_format_version`，仅更换 planner 实现但输出格式与 hash 不变时不要求重新审批。发布时不支持快照记录的格式 / 算法版本则拒绝，不静默重算旧批准基线。预览可按需返回临时计算的 `publishPlanHash`，但发布请求无需传 hash。不能在发布时重新重放所有原始事件，也不能直接覆盖公开树而跳过删除、移动等领域副作用；预览、审核和发布共用计划解释和依赖规则。

### 3.4 发布与恢复

发布 Command `PublishDocs(site, commandId, expectedQueueRevision)`：**先按 `command_id` 命中已确认 Receipt 并返回原结果**；首次执行才锁定队列、校验 `expected_queue_revision`、成员源版本 / Gate / 审核并重建计划。需审核时，最近获批快照的 `approved_queue_revision` 必须等于当前队列 revision，计划格式与 hash 算法版本须受支持，锁内计算的 hash 须与快照保存的 `plan_hash` 相同，否则拒绝发布并要求重新审批；无需审核时不要求审批快照，只计算执行计划的 hash。文档修订、计划中的目录领域操作、公开投影、树快照、`DocPublishRelease`（保存实际执行的队列 revision、`plan_hash`、`plan_format_version`、hash 算法版本，以及需审核时的 `approval_snapshot_id`；无需审核时该 ID 为 `null`）、队列消费、空队列 revision 前进及 `public_presentation_revision` 前进处于同一原子提交。外部副作用仍走现有提交后 Effects / Outbox 边界；Receipt 保留不确定提交的重试与结果恢复语义。

Release 引用本次精确的不可变文档修订和完整树快照，不引用可变草稿或“最新版本”。本轮“恢复”仅指 Command Receipt 结果恢复、事务失败回滚、Revision → Draft 与发布前 Trash 恢复；**整站 Release 级回滚不在本轮范围**。Trash 恢复若改变队列成员或其依赖，推进队列 revision，审批状态随之被推导为 `pending`。

## 4. 去 Branch 的边界

最终一个 Community 只有一套 Docs 工作区和公开站点。移除 `DocBranch` 及所有 Doc `branch_id` / `branch_policy: :main` 选择；旧 GraphQL 字段和参数直接退役，不保留 fallback。主要波及：

1. **持久层**：`DocDraft`、`DocPublic`、`DocLifecycle`、`DocBranchState`、`DocBranchVersion` / counter、`DocTreeNode` / Event / Snapshot、`DocsSiteState`、`DocPublishRelease` 及成员、Trash、`PublishRequest` 和内容审核限制的唯一键、外键与作用域。新合同产生的 Release 仍需要每篇 Doc 的不可变版本坐标，可重命名为不含 branch 的 Doc Publication / Version；旧 Release 不迁入新模型。队列审批使用独立记录与快照。
2. **写入与读取**：`CMS.Docs` / `CMS.DocTree` Commands、Draft Store、Publish Workflow、Query / Projection、FrontDesk、Gate Access / Scope、Lifecycle、内容审核及评论准入、Interactions、Search、Press、Activity、Import、seed 和维护入口。旧 `PublishBranch` 命令须由站点队列发布命令替换，不能只改名。`Doc` 与普通 Article 可共享内容机制，但仍保留 Docs 的目录、Release、Trash 和资源专属 Gate Context；是否进一步合并 Draft/Public 物理表独立决策，不作为本次队列迁移前置条件。
3. **协议与前端**：Docs GraphQL 查询 / mutation / types、生成类型、编辑器路由与 store、目录、发布清单、修订历史、LocalDraftHistory 的工作区 key、回收站、队列预览及审核界面。`branchId` 不能只在 UI 隐藏而在合同中继续传播。LocalDraftHistory 存于客户端 IndexedDB：新 key 使用新命名空间，旧 branch key 不再读取，客户端启动时清理旧 key；服务端 dry-run 无法计数客户端数据，也不迁移草稿。B0 还须盘点非 schema 作用域：advisory lock key、缓存 tag / invalidation、Outbox / Activity ref、Command Receipt / Confirmation payload、审核类型、DocCover projection 及持久化 JSON / 字符串引用。
4. **导入边界**：Content Import 的 `target_branch` 是目标 Doc 工作区，应随队列合同退场；源仓库的 Git `source branch` 是外部来源信息，继续保留。批量 Import apply **默认只生成工作区草稿，不自动入队或发布**；这是交互式目录改动自动入队规则的明确例外。导入完成后由作者显式发起一次“批量加入发布队列”命令，可选择本批中的文档，并原子校验正文可发布性、父级壳节点和目录依赖；失败不留下半批入队结果。
5. **合同文档**：按下方逐节清单更新当前合同，历史设计只标注“已被替代”，不机械改写其历史事实。代码切换后再同步写成新事实，不能提前把本文写成已实现。

| 合同范围                                                                                                                                                               | B0 标记与 B4/B5 更新点                                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [Gate 入口](../feature/gate/README.md)、[V3](../feature/gate/v3.md)、[V4](../feature/gate/v4.md) 及现行后续版本                                                        | Doc / Comment Scope、Lifecycle、公开 main 选择、preview 管理读取、发布准入和 Trash 定位 |
| [Article Revision / Draft](../feature/article/revision-draft-target.md)、[DocTree](./cms-doctree-refactor.md)、[Docs ID 统一](../feature/docs/id-unification-plan.md)  | Doc 身份、Draft/Public/Revision、目录事件、Release 与 branch / version 假设             |
| [AlertWall](../feature/alert-wall/README.md) 及其当前实施合同、[评论联合验收](../feature/article/mentions-graph-doc-comment-joint-acceptance.md)                       | Doc 审核限制作用域、Doc 评论父级与公开可见性；区分内容审核和发布队列审批                |
| [Mentions Graph](../feature/article/mentions-graph-sync-contract.md) 及相关现行设计、[Article Stats](../architecture/article-stats-target.md)、[Press](../press/v1.md) | main / preview 读取边界、公开投影、缓存和统计口径                                       |

以上是已知清单，不代替 B0 全量扫描；B0 为每处记录“当前合同需更新 / 历史记录仅标注 / 无运行时影响”和对应章节。

本轮**不迁移或兼容任何旧 Docs 数据**：旧 main / preview 的草稿、公开 head、目录、Trash、审核记录和 Release 均不转入新合同，不设计导出、回填、双写、旧版读取 fallback 或回滚到旧合同。新架构从空的 Docs 数据状态启动；旧 Doc URL 返回 404，不做跳转。B0 用只读 dry-run 清单列出将清理的服务端 Docs 与关联行数，覆盖 Doc 评论 / 互动 / 统计 / Mentions、Doc 专用 Assets 与覆盖图、`ArticleAssetRef`、Search 与 Press / CDN 索引、通知、Import source mapping、旧 Command Receipt / Confirmation payload、旧审批记录、Outbox / Activity 和缓存；**不把客户端 IndexedDB 计入服务端行数**。清单只用于完整清理和无孤儿验证，**不迁移旧讨论历史**；共享 Article 与共享资产只能按经确认的 Doc 归属解绑或清理，不波及其他资源。若目标环境有真实用户数据，B0 记录一次产品负责人对破坏范围和用户通知安排的确认；没有真实用户数据则不增加通知步骤。

服务端清理的根集合以 `Article.thread = :doc` 的稳定 Article ID 确定，再沿其 `ArticleBinding`、Doc Tree、评论父级及各投影引用扩展；`ArticleBinding.thread` 与 Article 类型不一致或引用归属无法确定时停止清理，不用模糊的社区 ID 批量删除。dry-run 按实体与阶段保存目标 ID 集合摘要、预期行数和实际行数；任一未分类引用、实际数量超出清单或非 Doc 基线变化均阻止完成。普通 Article 的正文、评论、统计和资产逐项保持不变；共享资产只解除旧 Doc 引用，不删除仍被其他资源使用的文件。

| 旧状态                                              | 新合同切换时的处置                                                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `DocCoverCard`、`DocCoverItem`、`DocCoverPinnedDoc` | 关联旧目录节点，删除旧行；新站点发布后按新树重建 Cover 投影                                           |
| `DocsSiteState`、旧 Doc Tree / Release / 审批状态   | 清空并初始化新站点状态；不保留旧发布水位或旧节点 ID                                                   |
| Doc 的 `ArticleBinding`、alias / locator            | 按 Doc 根集合删除旧绑定与定位；旧 URL 返回 404，不映射到新内容                                        |
| Docs 站点设置                                       | 无 Doc / 旧 branch 引用的站点级配置可保留；包含旧 Doc ID、节点 ID 或 branch 的字段重置，B0 逐字段列出 |
| `ArticleAssetRef`、Doc 专用资产                     | 删除旧 Doc 引用；物理文件仅在确认为无其他引用且符合资产清理规则时处理，共享文件保留                   |

切换是一次性新合同部署：先在隔离环境演练清空 Docs 作用域、重建 schema / 投影和冒烟验证；实际切换先禁止新 Doc 内容、目录、Cover、Docs 站点设置、评论、互动及导入写入与任务入队，再暂停并排空或明确取消在途的 Doc 相关 Oban Job、Outbox effects、通知、Import Job、Trash 定时删除和缓存失效任务。验证无旧任务能再次写入或重建公开页面后，执行同一清理与新建步骤，核对外键、队列空状态、旧 URL 的 404、公开索引失效和新建 / 入队 / 预览 / 审核 / 发布流程，然后恢复写入与任务消费。清理按数据库事实、外部投影 / 缓存失效、新合同初始化分阶段记录完成标记与验证查询；每阶段可重试且幂等，完成门禁要求所有阶段通过。同一 PostgreSQL 内可合并的清理优先在事务内完成，不假定跨表清理无法入事务。失败时保持停写并修复或重跑未完成阶段，**不部署旧读写合同作为兼容回退，也不把冷备份设为门禁**。窗口与 go / no-go 条件由演练确定；不需要旧数据迁移回退点或 Release 对齐检查。

dry-run 清单、Doc 归属与数量判定、阶段完成标记和验证结果必须写入**不在清理范围内的独立 control schema 或外部持久 runbook 记录**，不能只输出日志或存入将被清空的表。记录包含切换 ID、目标环境、生成时间、清理规则版本、每阶段计数与校验结果；保留期限在 B0 runbook 中写明，至少覆盖切换和后续验收。它是删除审计轨迹，不保存旧 Doc 正文或提供数据恢复能力。

## 5. 实施批次与前置条件

这些批次是开发和验收边界；实现可分批完成，但对外只启用完整的新读写合同，不为旧数据或旧客户端增加兼容层。

| 批次                 | 交付物                                                                                                                                                                                                                                                                                                                   | 完成条件                                                                                                                                                                                                                                                                                                                                               |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B0：报告基线         | 扫描 branch 字段 / 键 / 外键、字符串 / JSON 作用域与全部生产者 / 消费者；固定旧状态退场、`PublishRequest` 退役、审批策略及 `idle / pending / approved / needs_reapproval` 状态枚举、Cover / 站点设置独立公开边界和合同章节；产出破坏性切换 runbook、持久化的只读 dry-run 计数 / 清理与验证清单、实体处置表及任务排空步骤 | 每个代码入口有去留；Doc 根集合和非 Doc 不变量可执行；控制记录位于清理范围外且有保留期限；隔离环境演练确定窗口与 go / no-go 条件；真实用户数据存在时取得一次产品确认与通知安排；不改严格门禁                                                                                                                                                            |
| B1：队列事实         | 站点唯一队列、Doc 入队 / 出队、目录自动入队 / 暂缓 / 撤销、导入批量显式入队、删除 / 恢复命令、站点级从 `0` 起且跨 Release 单调递增的 `queue_revision`、可发布性及依赖闭包                                                                                                                                                | 未入队 Doc 编辑不改变队列；已入队 Draft 写入、Tree 写入 / 自动入队与 revision 前进分别同事务；成员调整不留孤儿；Live Queue 不存 `plan_hash` 或审批状态；旧 dirty 字段退场                                                                                                                                                                              |
| B2：预览与审核       | `REPEATABLE READ` 队列预览、受权隔离缓存、首次发布空基线、`planner_version` 与站点级从 `0` 起的 `public_presentation_revision` 缓存隔离、公开 Cover 可见性实时核验、确定性有效计划与派生 hash、队列专属 `approval_snapshot_id` / `approved_queue_revision` / 内容副本 / asset refs、推导的审批状态和净效果增量 diff      | 并发编辑不产生混合预览；ReviewBlock 后预览与公开 Cover 均不从缓存泄漏受限内容；公开 Cover / 设置缓存与预览同用展示水位；状态查询缓存按算法支持配置版本隔离且不参与发布校验；清理任务不能删除获批内容或资产；相同计划的 hash 稳定且仅写入不可变快照；版本不支持 / hash 不符要求重新审批；首次审核与再次审核采用正确基线；导入草稿仅在显式批量命令后入队 |
| B3：发布切换         | 发布 Command / Workflow 从服务端整队读取并在锁内重建计划；需审核时比较获批快照的 revision / 计划版本 / hash；Receipt 优先重放、原子 Release、队列消费与展示水位前进、事务与结果恢复                                                                                                                                      | 首次发布使用空基线；每次成功发布都同事务推进 `public_presentation_revision`，不依赖 Cover 行写入；单篇 / 多篇 / 目录同一路径；无需审核时不读取审批快照；Release 保存队列 revision、实际计划 hash / 版本及可空的审批快照 ID；获批校验不符拒绝发布；冲突回滚无部分公开结果；相同命令重试不重复消费                                                       |
| B4：去 Branch        | 冻结 Doc 正文 / 目录 / Cover / 站点设置 / 评论 / 互动 / 导入写入与任务入队，暂停 / 排空 Doc 异步任务；按 runbook 清空旧 Docs 数据与跨域派生状态，启用新 schema 和 Gate / 公共读取 / 审核 / Trash / GraphQL / 前端合同；退役 `PublishRequest` 与旧 branch 表 / 入口                                                       | 无在途旧任务、每阶段持久完成标记和验证查询通过后，新队列从空状态启动；不传播 Doc branch selector，非 Doc 基线不变、外键与派生状态无孤儿，旧 URL 为 404；新合同冒烟通过后恢复写入，失败保持停写并重试未完成阶段                                                                                                                                         |
| B5：合同和全链路验收 | 逐节更新当前合同、标记历史文档、源码注释、定点测试与新 schema 数据场景                                                                                                                                                                                                                                                   | 文档标记与代码一致，以下用例全部通过；不延长 B4 停写窗口                                                                                                                                                                                                                                                                                               |

## 6. 必须验收的场景

- 一篇已发布 Doc 的未入队草稿保存后，公开站点、队列预览、队列 revision 和已获批状态均不变；入队后预览只显示该草稿。
- 队列有 Doc A、Doc B 和自动入队的目录改动时，先移出 B 并撤销或暂缓与 A 无关的目录改动，再发布整队；Release 只含 A 及其必要目录依赖，B 的草稿和暂缓目录改动仍在工作区。若目录改动是 A 的依赖，单独暂缓被拒绝。
- 首次审核比较公开站点与队列；批准后编辑入队 Doc / 目录，状态变 `pending`，即使 Draft 已被再次覆盖，审核 diff 仍只显示获批后的增量；再次批准后基线前移。无需审核模式只显示发布效果 diff，不能产生虚假获批记录。
- 新站点尚无 Release 时，预览、首次审核 diff、计划 hash 和首次发布均使用 `public_release_id: null` 与同一规范化空树；新 Release 的计划格式版本、输入水位和 hash 可追溯，不能为首发虚构上一笔 Release。
- 新合同空站点的 `queue_revision` 与 `public_presentation_revision` 均为 `0`；首次 Doc 入队只推进前者，首次 Cover / 设置变更只推进后者。首发消费队列后前者继续递增；后续 Release 不重置两者，旧站点水位不沿用。
- 批准快照引用的封面和正文图片在资产替换、清理后仍可读取；仅有 URL / 元数据而没有受保护 asset ref 的快照不能获批。
- 并发保存已入队 Doc 或修改目录时，正文 / 树与队列 revision 同成同败；模拟任一步失败后不留下“内容已变、仍被推导为 approved”或“目录已变、未入队”的状态。日常 Revision / 树快照清理不能删除批准时复制的正文、元数据与目录结果。
- 创建空文档、空 Group / Tab 不自动进入队列或预览；标题与语义正文就绪后入队，必要的父级壳节点与正文不可分割地发布；缺少依赖、空白正文或空白名称被拒绝。
- 移动已公开文档后，其未入队正文草稿仍跟随稳定 `doc_id`；删除包含未公开草稿的目录后，草稿可从回收站恢复。
- 已入队但从未公开的 Doc 被删除后出队并可从回收站恢复；混合目录删除将公开删除入队、未公开草稿回收。发布前恢复删除事件，队列 revision 前进、审批状态被推导为 `pending`；永久删除仍被活动队列引用的实体被拒绝，历史审核快照与 Release 不被级联删除。
- 删除已公开文档 / 目录后，发布前公开内容不变，发布后整批移除；A→B→A、连续重命名和删除后恢复的审核 diff 显示最终净效果，原始操作仍可审计。
- 多篇文档加目录改动一次提交，任一过期版本、依赖缺失或权限拒绝均不留下部分公开内容或被消费的队列成员。
- 公开详情、目录、列表、搜索、评论、Press 以及无权限的预览请求均不能读取队列草稿；预览过程中并发编辑只返回一个 revision 的一致结果或整体重试，有权限预览与同 revision 的实际 Release 内容一致。
- 预览多次查询在 `REPEATABLE READ` 下共享同一公开 Release 与队列 revision；A→B→A、删除 / 暂缓与依赖排序的预览、审核和发布都解释同一个有效计划，原始操作仅保留审计。相同计划的派生 hash 稳定；需审核时，发布前 hash 与获批快照不符则拒绝，不产生部分 Release。
- 队列 revision 与获批快照相同，但计划格式 / hash 算法不受支持或 hash 不符时，界面显示“需重新审批”，发布拒绝；`planner_version` 变化后旧预览缓存不可命中。
- 只升级 `planner_version` 且计划格式与 hash 不变时，旧批准仍有效；改变 `plan_format_version` 后旧批准显示 `needs_reapproval`。审核启用时状态只能是 `idle / pending / approved / needs_reapproval`，无审核时不生成审批状态。
- ReviewBlock 在没有新 Release / queue revision 时改变 `DocPublic.visible`，队列预览仍按当前 Gate / 可见性隐藏受限页面；即使 `article.visibility_changed` 失效任务尚未完成，旧缓存也不能泄漏该页面。
- 已纳入 Cover 的 Doc 发布新标题或 slug 后，即使 publish hook 不写 Cover 行，`public_presentation_revision` 仍在发布事务前进，公开 Cover 与队列预览读取新展示。ReviewBlock 隐藏该 Doc 后，公开 Cover 立即不再返回它；异步失效尚未完成时旧缓存也不得泄漏。
- DocCover 或影响预览的 Docs 站点设置独立写入后，`public_presentation_revision` 同事务前进，队列 revision、批准快照与计划 hash 不变；预览读取新公开展示投影且旧缓存不可命中。切换停写覆盖 Cover 与这些设置。
- 公开 Docs Cover / 站点设置若有缓存，变更后使用与预览相同的 `public_presentation_revision` 读取新值；无该水位或无法在返回前复核可见性的 Cover 响应缓存必须关闭。成功发布即推进展示水位，不因 Cover 写入单独推进队列水位。
- 仅切换受支持 hash 算法的配置而不部署新 planner 时，审批状态查询缓存不可命中旧 `approved`；发布仍按当前支持集合重新校验。
- 不同运行时和部署批次对同一计划按 `sha256-jcs-v1` 得到相同 hash；调整对象键顺序或数据库返回顺序不改变 hash，算法版本不一致时拒绝发布，不静默重算获批基线。
- 发布命令消费队列后，以同一 `command_id` 和旧 `expected_queue_revision` 重试，先命中 Receipt，返回相同 Release 且不重复消费；Release 仍能定位精确的 Doc 修订与树快照。
- 无需审核时，发布只校验预期队列 revision 与成员源版本，锁内计算 hash 并写入 Release；请求不传 hash，Live Queue 没有 hash 字段。需审核时，批准快照记录的 revision / 版本 / hash 与锁内结果相符才发布；Release 记录发布前的 `queue_revision`、实际 `plan_hash` / 版本及 `approval_snapshot_id`（无审核为 `null`），发布后空队列 revision 继续递增。
- 一次导入 100 篇 Doc 后，工作区有草稿而队列仍为空；作者显式批量入队后，Doc 与父级依赖同成同败，发布整队一次完成，apply 本身不触发发布。
- 未入队草稿保存不改变发布抽屉的队列计数、审批与缓存键；暂缓目录改动仅显示为工作区待处理，不计入队列。切换演练用持久 dry-run 计数和阶段验证确认旧 Docs 数据与跨域派生状态清理完整，重复执行清理不改变结果；新队列从空状态启动，旧 URL 为 404，不读取旧合同。
- 切换前 Doc 相关异步任务已暂停并排空或取消，恢复消费后不会重建旧 Doc；普通 Article 的正文、评论、统计与资产计数 / 内容在清理前后逐项不变，共享资产文件仍可由非 Doc 引用读取。
- 服务端 dry-run 不包含客户端 IndexedDB 行数；新前端不读取旧 LocalDraftHistory branch key，客户端启动清理后只使用新命名空间。

## 7. 不在本轮范围

- 多个并行发布队列、同一内容的独立工作空间、跨队列合并或 Git 同步语义。
- 面向读者的 1.0 / 2.0 文档版本选择；整站 Release 的流水号不能冒充产品版本号。
- 整站 Release 级回滚；现有 Revision → Draft、Trash 和 Command Receipt 恢复仍按本轮合同保留。
- 旧 main / preview 数据、旧 Release、旧审批记录、旧评论 / 互动 / 统计 / Mentions 历史的迁移、兼容读取或双写。
- 把普通 Post / Blog / Changelog 一并改成 Docs 的队列发布产品流程。
- 把全部 Doc 专属字段、目录和 Release 塞进普通 Article 的可选字段大表。
