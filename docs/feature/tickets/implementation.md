# Ticket 与 Kanban 改造实施合同

> 状态：本文记录第一版 T0–T5 的历史实现与验收。其 Ticket 领域合同已由 [V2](./v2.md)替换；当前 V2 本地验收为完整后端套件 2,438 项通过、1 项按 `:later` 排除，前端 295 个测试文件/1,241 项通过，warnings-as-errors 编译、全仓 type-check、GraphQL codegen/合同和完整 docs:check 通过。目标环境数据重建、派生面清理、真实 CDN purge 与生产 smoke 尚未执行。

> 当前合同见 [Ticket V2](./v2.md)：它已取代本文的独立公开状态/内容指针、TicketEvent、TicketPost 和任一来源隐藏即 held 等第一版设计，并接入共享 ArticleLifecycle。TicketSource / cms.ticket_sources 使用 type，首批仅 POST；Post 进度按当前 Ticket 事实读时计算，缓存和通知通过 Outbox 联动。其他来源与渠道规则仍留待接入时确定。本文保留第一版实现史；指定环境的 V2 数据重建没有执行，状态见 [V2 实施追踪](./inventory.md#v2-实施追踪)。

## 1. 目标与边界

用户继续提交、投票和评论 Post。管理员从 Post **创建新工单**或**关联已有工单**。Kanban 的卡片是 User Ticket；卡片下列出关联原帖。Post 页面显示由关联 User Ticket 得出的处理进度。管理员可从 User Ticket 创建内部 Worker Ticket，发现共性时再创建 Case 并关联相关 User Ticket。

```text
Post A ──┐
         ├── User Ticket U ── Worker W1
Post B ──┘                 └── Worker W2
                              ↑
Case C ──汇总 User Ticket U、V，并引用共同修复的 Worker / 解决方案
```

- 不给普通用户提供「创建 Ticket」入口，也不要求他们理解 Ticket 术语。公开界面使用「处理进度」和 Kanban 卡片；管理员界面可直称「工单」。
- Post 是原始反馈及互动的事实源；Ticket 是整理后的处理事项与进度的事实源。创建 Ticket 时第一版将原帖标题、摘要（`digest`）及正文快照复制为初始版本；工作台支持独立编辑标题和摘要并生成新 revision，正文快照保留创建时内容。
- 第一版使用系统内 Worker；不接 Linear、Plane、Notion 或 AI agent，不做 AI 总结、Post merge、历史数据迁移或旧 API 兼容层。
- Note、私有客服请求及精细可见性策略留待后续专题。这是第一版的范围决定，不代表产品长期只能处理公开反馈。第一版不得借关联公开 Ticket 泄露非公开 Post、作者或 Note；若尚无安全投影，拒绝这种跨可见性关联。

## 2. 当前实现与替换结果

旧 `ArticleBinding -> KanbanState?`、Post 状态命令/查询、Post-targeted GraphQL 和 `useKanbanPosts` 已从运行路径移除；`cms.kanban_states` 由新迁移删除。历史迁移保留。Post 分类和审核状态仍由 Post 自己管理，处理进度改由 Ticket 投影。

当前写入走 `CMS.Tickets` command facade、Ticket Gate 和 receipt transaction；读取走独立 Ticket Query。User、Worker、Case 均为 `Article(thread: :ticket)`，分别使用社区编号或内部 UUID。Community Kanban 列表改读 Ticket，Post 页面从 `postTicketProgress` 显示关联 User Ticket 汇总；Dash 内部工作台提供内容、状态、负责人、Post 标签/facet、Worker、Case、更新/可见性和 Timeline 操作。Ticket Cache Outbox 覆盖 Ticket/Post 公共页，Post 投票与评论会清理关联 Ticket 页面。

现有 `:kanban` 出现在 `CMS.Artiment.Threads` 的非 Article thread/导航值中；它不是新内容资源。新 Article thread 命名 `:ticket`，不得借用 `:kanban`。

## 3. 资源与关系

### 3.1 Article 身份

Ticket 使用 `Article.thread = :ticket`，复用 Article 的稳定 ID、内容版本及公开内容基础设施；业务字段放在独立 Ticket 模型，不塞进 PostState、KanbanState 或 Article 的通用列。**不把 `:ticket` 加入现有 `CMS.Artiment.Config.threads()` 普通内容集合**：该集合驱动 GraphQL、统计、互动、社区计数等自动生成面。新增显式的 Article 身份 thread 集合供 `CMS.Model.Article` 的 Ecto enum 使用，普通内容枚举及自动生成面保持原集合；Ticket 的查询、命令和公开投影单独定义。具体开关见 [T0 出口合同](./t0-contract.md)。Ticket 本身不提供投票，第一版也不提供独立的用户评论区。

每张 Ticket 只属于一个 Community。`ArticleBinding` 表及其稳定 Article→Community 身份机制无需重做，但 Ticket 创建时只建立所属 Community 的一条 binding；通用 mirror/move/unmirror 等绑定命令须显式排除 `:ticket`，不能因为 `:ticket` 属于普通 Article thread 而自动开放跨 Community 操作。Ticket 专属状态应关联这条 binding；`TicketState.article_id` 唯一和 binding 外键确定唯一的**规范 binding**，但这两个约束本身不能阻止有人另插第二条 binding。T1 要以同 Article 的事务锁和专门的数据库约束/触发器阻止 `:ticket` 的第二条 binding；T0 确认数据库实现方式。`User`、`Worker`、`Case` 是 Ticket 的业务 `type`，不是三个 Article thread。

### 3.2 建议的持久化事实

| 事实                | 建议存储与约束                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ticket 自身         | `Article(thread=:ticket)` + `TicketState`，后者以 Article ID 为主键并引用唯一的 `ArticleBinding`，包含 `type`、独立 `TicketStatus`、公开状态、`priority`、计划/实际时间、rank、版本和审计时间；Community 从 binding 确定，避免另存可漂移的 Community 事实。                                                                                                                              |
| 内容及进展          | Ticket 专用模块构造 `ArticleBodySnapshot/ArticleRevision`；普通 `Revision.Persist.create/get_extension` 不接纳 Ticket。User 可在核对合同后复用 `Articles.Public.select` 指向当前版本；Worker/Case 仅在 `TicketState.current_revision_id` 保留当前 revision 指针，并由 Revision Cleanup 将其视为保留根。`TicketEvent` 按事件类型保留工作状态与公开状态历史，`TicketUpdate` 保存对外说明。 |
| 负责人              | `TicketAssignee(ticket_id, user_id)`；唯一 `(ticket_id, user_id)`，支持零或多人，跨 Community 用户授权由命令验证。                                                                                                                                                                                                                                                                       |
| 原帖                | `TicketPost(ticket_id, post_id)`；仅 User Ticket 可关联 Post，唯一 `(ticket_id, post_id)`，同 Community，允许多对多。                                                                                                                                                                                                                                                                    |
| Worker 归属         | `TicketWorker(parent_user_ticket_id, worker_ticket_id)`；每张 Worker 恰有一张 User Ticket 父项，唯一 `worker_ticket_id`，禁止环。                                                                                                                                                                                                                                                        |
| Case 汇总           | `CaseMember(case_ticket_id, user_ticket_id)`；唯一 `(case_ticket_id, user_ticket_id)`，两侧均可多对多。一个 User Ticket 同时涉及两个共性问题时可进入两个 Case；添加/移出成员走显式命令。                                                                                                                                                                                                 |
| 共性修复引用        | `CaseWorker(case_ticket_id, worker_ticket_id)`；只引用已归属某张 Case 成员工单的 Worker，不改变 Worker 的父项。Case 的方案总结与影响范围存在 Case 内容/字段中。                                                                                                                                                                                                                          |
| 标签/版本/系统/模块 | TicketTag 仅引用同 Community 的 Post 标签词表，不新增 Ticket tag thread；TicketFacet 保存规范化筛选值。两者第一版只供内部查询，具体约束见 [T0 出口合同](./t0-contract.md)。                                                                                                                                                                                                              |
| Worker 分类         | 可选 `work_kind`（技术 / 非技术），只用于分组筛选和表单提示，不改变父子关系或授权规则；不强制每张 Worker 分类。                                                                                                                                                                                                                                                                          |

上述名称是实施建议；迁移文件可按项目命名惯例调整，但唯一性、类型限制、Community 隔离与引用语义必须成立。对 `type` 的限制同时由命令与数据库约束保护。

### 3.3 共享 Worker 的边界

Worker **只从属于一张** User Ticket。其他 User Ticket 不拥有它。Case 可把这张 Worker 标记为共同修复并展示在成员列表之上；其他成员在 UI 上看到「共同修复」的引用。每张 User Ticket 若还需自身验证、补发、回复等工作，创建自己的 Worker。这样共享修复有一个执行负责人，用户侧结案仍逐张判断。若 User Ticket 属于多个 Case，某张 Worker 是否是共性修复按每个 Case 分别显式标记。

## 4. 生命周期与状态

| 对象          | 第一版状态                    | 规则                                                                                                                                                     |
| ------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User Ticket   | `TODO -> WIP -> DONE`，可重开 | 创建为 TODO；进入 WIP 必须至少有一张具体 Worker；所有 Worker 完成后仍需管理员确认用户侧结果，才可 DONE。重开回 WIP 时仍须满足 Worker 条件。              |
| Worker Ticket | `TODO -> WIP -> DONE`，可重开 | 可以由同一管理员自己执行；完成只更新自己的事实，不自动结案父 User Ticket。若父 User Ticket 已 DONE，重开 Worker 必须先由管理员重开父项；不隐式改写父项。 |
| Case          | `OPEN -> RESOLVED`，可重开    | 这是第一版工作流选择，只表示共性问题的汇总与方案，不自动关闭成员 User Ticket；未解决的成员在列表仍显示待处理提示。                                       |

状态转换以命令为唯一写入口；Ticket 不写入 Post 处理状态或旧 KanbanState。非法转换、无 Worker 进入 WIP、跨 Community 关联及无权限操作返回稳定业务错误。重复命令按现有 command/receipt 约定处理。计划时间与实际时间分别存储：`planned_start_at`、`planned_end_at` 可编辑，`started_at`、`completed_at` 由转换记录；均使用 UTC `:utc_datetime` / `:timestamptz`。第一版 Timeline 按计划区间展示，拖动仅修改计划时间；缺少计划区间的工单放入「未排期」，不推断实际时间。User、Worker、Case 各自拥有优先级和排期；Case 只汇总展示成员的值，编辑 Case 不自动覆盖成员或 Worker。跨层批量调整留待明确操作语义后再设计。

Post 不再拥有处理状态。对关联的 User Tickets 计算公开进度：全部 TODO 显示 TODO；全部 DONE 显示 DONE；其他组合显示 WIP，并显示 `已完成 n/m`。无关联 Ticket 的 Post 不显示处理状态。重开或取消 Post 关联后重新计算。Case 与 Worker 状态不直接投影为 Post 状态。Post 的拒绝/审核决定仍属于 Post/审核流程，不生成「Rejected Ticket」或把未建单的 Post 放进 Ticket Kanban。Post 列表的旧 `status/statuses` 筛选随旧状态删除；第一版不提供按处理进度筛 Post。

## 5. 创建与交互

### 5.1 管理员从 Post 发起

Post 管理操作展示「创建新工单」「关联已有工单」。创建时预填原帖标题、描述，管理员可在确认前编辑；提交一次原子创建 Ticket、TicketPost 和初始 TODO 状态。关联已有工单时只搜索同 Community、可写的 User Ticket；确认后建 TicketPost，不合并、不改写 Post。重复关联幂等；取消关联不删除两端资源。当前 Post 已有关联时仍允许创建/关联第二张 User Ticket，但在确认界面提示已有工单，避免误建。

Post 的公开页面展示关联工单的标题、进度与链接；一篇 Post 关联多张时展示汇总状态和完成数。公开 Ticket 卡片展示独立的标题、描述、状态和计划时间；负责人仅在内部详情展示；底部展示可见的原帖链接。Ticket 上的票数、评论数为关联 Post 的简单求和，不提供 Ticket 直接投票。第一版 Ticket 查询返回关联 Post 的公开 ref，前端及 SSR 将去重 refs 按每批最多 100 个 ID 请求 `statsBatch` 并求和，SSR 将所有批次加入 hydration；Post `ArticleStats` 是唯一计数权威。详见 [T0 出口合同](./t0-contract.md)。

### 5.2 User、Worker、Case 工作台

- User Ticket 详情有 Worker 列表与「添加执行任务」；创建 TODO 不强制 Worker，改 WIP 时显示创建/选择**本工单 Worker**的引导并校验。不得生成空 Worker 占位。
- Worker 详情及其内部备注只对有处理权限的人显示。第一版公开页仅展示 User Ticket 的处理状态，不公开 Worker 标题、负责人或内部正文；未来可单独设计「只展示执行进度」的投影。
- 管理员可从多个 User Ticket 创建 Case，填写共性问题、解决方案摘要及影响范围；摘要包含受影响用户及对应 User Tickets、版本、操作系统和模块。Case 详情在顶部展示共同修复引用与摘要，下面展示成员 User Ticket 与各自未完成 Worker；共性修复引用也可固定在成员列表下方，具体位置由界面验证，但两者须同屏可见。Case 不替代单张 User Ticket 的进度与回复。
- 顶层提供 `Case` 与 `User Ticket` 两种列表视角。视角是查询参数/界面状态，不是 Ticket 的 `mode` 存储字段。Kanban 和 Timeline 首先展示 User Ticket；Case 视角用于汇总与评审；Worker 在父项详情内展示。

### 5.3 对外更新与通知

管理员修改 User Ticket 状态时可填写一条对外进展说明；说明属于 Ticket，不写回原 Post。状态与已发布说明在关联 Post 上可见。工作状态和公开状态变更都写入带 `event_type` 的 TicketEvent；重新发布通知引用 visibility 事件 ID，`holdTicket/publishTicket` 均校验目标 TicketState.version。状态历史与对外说明的存储、可见性、编辑及通知去重以 [T0 出口合同](./t0-contract.md)为准。Worker 的内部状态与 Case 的汇总状态不直接向普通用户发通知；Case 的解决方案需要对外传达时，由管理员更新相关 User Ticket。通知事件与业务状态在同一事务写入 Outbox；Outbox 写入失败回滚事务，提交后的实际发送失败可重试、不回滚已提交状态。

### 5.4 AlertWall 边界

管理员直接执行的「创建新工单」「关联已有工单」不需要经过 AlertWall。将来 AI 提议的关联、疑似重复、公开审核和待回复事项进入 AlertWall 的不同 tab，由具备相应权限的人决定；AlertWall 是待判断事项入口，不是 Ticket 状态的第二事实源。第一版不依赖 AI 建议即可完成手动建单。

## 6. 查询、筛选、权限

建立独立 Ticket GraphQL 查询、分页与 mutation；不把 Ticket 塞进 `postPage` 或现有 `groupedKanbanPosts` 返回类型。至少提供：单张详情、按 Community 的 User Ticket 分页/分组、Case 分页、父项 Worker 列表、Post 的关联工单、Ticket 的关联 Post、内部 Ticket 标题前缀搜索及 User Ticket 共享社区编号精确查询，以及创建/关联/取消关联/更新字段/状态转换命令。Worker/Case 无公开编号，只按标题/类型搜索，仍可通过 UUID 直达内部详情。第一版不提供公开 Ticket 搜索。内部搜索使用专用 PostgreSQL 查询，权限和 Community 过滤先于分页，当前 revision 标题前缀需有可用索引；「关联已有工单」只返回可管理的公开 User Ticket。列表稳定排序采用 `rank + id` 或时间加 ID，分页游标与过滤条件绑定；分组列独立分页，避免一次加载全量。Post 的 Ticket 进度采用独立批量读取，不写入 `ArticlePublic`；事件和缓存规则见 [T0 出口合同](./t0-contract.md)。

筛选合同第一版支持 `type`、`status`、`assignee`、`priority`、标签、版本、操作系统、模块、创建/更新日期和计划区间；Worker 可按技术/非技术分类。明确 `AND`/同字段多值 `OR`、空值、权限过滤和排序规则。Case/User 视角在同一筛选语义上组合，不依赖前端把全量结果拉回后过滤。为实际查询形状建索引，并用分页与筛选组合验证执行计划。

权限按具体 action 判断，不以 role 名称作运行时授权依据。至少区分 `ticket.create`、`ticket.link_post`、`ticket.update`、`ticket.transition`、`ticket.assign`、`ticket.manage_case`、`ticket.manage_visibility`、`ticket.read_internal`；角色只是一组权限的配置。Post soft trash 和 `ArticleReviewBlock` apply 导致的 hold 与人工 hold 使用同一公开状态事实；ReviewBlock apply 在同一事务写 Ticket visibility event 与 cache Outbox，resolve 只 purge 缓存，不恢复 Ticket。重新发布必须人工审核独立摘要，恢复 Post 或取消关联本身不自动发布。内部 Ticket 读取标注非公开关联 Post 与活跃 ReviewBlock 类型，供工作台解释 hold 来源。公开查询先做 Community 与资源可见性过滤，再做 Post 关系、计数和关联摘要投影。第一版仅支持安全的公开 Post ↔ 公开 User Ticket 关联；私有 Post/Note 与客服可见性模式不在本批次开放。

## 7. 分批交付记录与验收边界

T0 的[文件级起始改造清单](./inventory.md)与[出口合同](./t0-contract.md)列出需新增、改写或退役的入口，以及读模型、可见性、关系清理和状态转换的第一版决定。实施时仍须用结构索引补齐调用方，不能仅按起始清单修改。

| 批次                    | 已交付                                                                                                                                   | 本轮证据与边界                                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T0 合同盘点             | 身份、可见性、关系、状态转换、计数和缓存合同固定；文件清单已核对。                                                                       | 合同与本轮代码一致；全仓运行时旧 Post-Kanban 标识搜索无命中。                                                                                               |
| T1 领域数据             | Ticket 身份、状态、事件、更新、关联表、约束与清理迁移已加入；User 编号复用 Community counter。                                           | 定向测试覆盖状态组合、事件 payload/source、TicketUpdate 可见性和关联 Post 的 SQL 负向约束。                                                                 |
| T2 命令/权限            | Receipt command、Gate actions、Ticket/Post/Worker/Case 命令、通知与缓存 Outbox 已接入 GraphQL。                                          | 定向集成测试覆盖 held 编辑再发布、内容 no-op/hash、公开关联校验、内部读取权限和通知收件人。                                                                 |
| T3 读模型               | Ticket 详情、公开/内部 Kanban 分页、筛选、内部搜索、Post 进度和关联统计缓存路径已实现。                                                  | 定向测试覆盖公开分页、内部标题前缀搜索和权限；缓存向量及 Ticket 创建 Outbox 标签通过。标题前缀 EXPLAIN 在测试库确认索引可选；真实数据量计划和负载尚未验收。 |
| T4 前端替换             | Post 管理入口、公开进度/详情、Ticket 卡片与 Dash 工作台已接线。                                                                          | Core/Community/Dash 类型检查通过；Timeline 的已排期/未排期组件测试通过。                                                                                    |
| T5 Timeline、通知与收尾 | 排期 Timeline、关联 Post 作者/公开评论参与者通知、Outbox 投递和旧 KanbanState drop 已实现；Ticket cache tags 已接入 SSR 并加入合同向量。 | 定向测试验证关联 Post 评论者会收到通知、无关 Community subscriber 不会收到；真实 CDN purge 与生产切换仍需独立验收。                                         |

本次不迁移旧 Post/Kanban 状态历史，也不保留兼容层；旧 `KanbanState` 数据不转成 Ticket。Dashboard 旧五列/五色配置由迁移收口为 TODO/WIP/DONE。实现已在一个合同切换中完成，没有运行期双读双写。

## 8. 具体行为验收

1. 用户创建 Post A，管理员从 A 创建 User Ticket U；A 保留自己的正文、评论和投票，U 出现在 TODO 列。
2. 用户创建 Post B，管理员把 B 关联 U；U 卡片显示 A+B 的票数与评论数，并列出 A、B 链接；取消 B 关联后聚合随之变化。
3. U 无 Worker 时尝试进入 WIP 被拒绝；创建 W1 后进入 WIP，A、B 同时显示处理中。
4. W1 完成，U 仍待管理员确认；确认并将 U 置 DONE 后，A、B 显示已完成。
5. A 再关联 U2；U 为 DONE、U2 为 WIP 时，A 显示「处理中 · 已完成 1/2」；U2 完成后显示已完成。
6. U、V 遇到共同故障，创建 Case C；W1 仍归属 U，C 引用 W1 的共性修复。C 解决后 V 若仍需补发/验证，V 保持未完成并显示提示。
7. 管理员在 Timeline 调整 U 的计划日期；实际开始/完成时间不随拖动改变，原 Post 不被编辑。
8. 无 Ticket 的 Post 不出现 TODO/WIP/DONE；普通用户没有 Ticket 创建入口；无相应权限的成员不能改工单。
9. U 属于 C1 和 C2 时仍只有一张 U；C1 解决不会自动解决 C2 或 U。Case 优先级与排期修改不覆盖 U/W。
10. Worker W1 的标题、负责人和备注不出现在公开卡片；U 状态更新只向可见关联 Post 作者与公开评论参与者发一条去重通知，不广播给无关 Community subscriber；W1 内部状态变化不直接通知他们。
11. 已完成的 U 下重开 W1 时返回需先重开父工单的业务错误；不存在 Worker 操作隐式改写 U 的路径。
