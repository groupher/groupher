# Report 与审核聚合设计

本文定义 CMS 举报事实、审核聚合、Gate、Lifecycle、Interaction 和 Audit 的边界。目标是让“用户举报了什么”“审核团队正在处理什么”“资源最终发生了什么”成为三个可分别追溯的事实，避免用举报数量直接代替审核结论或资源状态。

相关文档：

- [Gate V2：统一读取范围与操作准入](./gate_v2.md)
- [Gate V3：Article Core 与 Doc Release 边界](./gate_v3.md)
- [Community Lifecycle](./lifecycle.md)
- [Artiment Interaction V2](../artiment/interaction_v2.md)

## 1. 结论

举报不是普通 Reaction，也不是处罚结果。

```text
Report Fact
  某个用户针对某个资源提交或撤销的一次举报事实

ReviewCase
  审核团队针对目标资源处理的一张工作单

Moderation Decision
  审核员对工作单作出的正式结论

Resource Command / Lifecycle
  正式结论需要改变资源时执行的领域命令和状态转换
```

四者可以在同一业务流程中协作，但不能互相替代：

- Report Fact 不拥有 `open / claimed / resolved` 审核状态；
- ReviewCase 不拥有 Article、Comment、Community 的资源状态；
- `reported_count`、阈值和风险分数不能直接成为删除、归档或封禁的权威；
- Lifecycle 不保存举报人、举报原因或审核队列状态；
- Audit 记录发生过的操作，不作为当前审核状态或资源状态的查询来源；
- Interaction 只投影 `viewer_has_reported` 等响应状态，不拥有审核结论。

## 2. 当前实现

当前 `CMS.AbuseReports` 已具备以下能力：

- Account、Article、Comment 举报和撤销入口；
- 同一用户不能重复举报同一目标；
- `AbuseReport` 按物理目标聚合 `report_cases`；
- Article / Comment 举报会在同一事务内更新 Interaction report projection；
- 普通读取可以返回 `viewer_has_reported`；
- 显式 `surface: :report` 可以读取 `reported_count`；
- `CMS.AbuseReports.List` 提供举报列表；
- Comment 达到固定阈值后会直接调用 `CMS.Comments.fold_comment/2`。

当前链路：

```text
report mutation
  -> create/update AbuseReport.report_cases JSON embed
  -> update reported bitmap/count projection
  -> threshold reached ? fold Comment : keep visible
  -> return hydrated Article / Comment
```

当前方案能满足简单的“举报、撤销、计数、折叠”产品能力，但存在以下边界问题：

1. 一个 `AbuseReport` 同时承担目标聚合、举报事实集合和部分审核字段，职责过多；
2. reporter case 保存在 JSON embed，难以独立索引、约束、分页、审计和做可信度分析；
3. `operate_user`、`deal_with` 不能完整表达 claim、处理历史、重开和多人协作；
4. 举报阈值直接触发 `fold_comment`，把群体信号和正式审核结论耦合；
5. 当前列表是 AbuseReport 列表，不是具有明确状态、优先级和并发 guard 的审核队列；
6. Account、Article、Comment 的处理动作没有统一 Moderation Decision 契约；
7. Gate 尚未形成 report/review 专用的读写 action matrix。

## 3. 目标模型

### 3.1 ReportFact

目标结构使用窄事实表记录每个 reporter 的独立举报：

```text
ReportFact
  id
  community_id
  target_type
  target_id
  reporter_id
  reason
  attr / evidence
  state: active / withdrawn
  operation_ref
  inserted_at
  withdrawn_at
```

约束：

```text
UNIQUE(target_type, target_id, reporter_id) WHERE state = active
```

语义：

- 用户举报创建 active fact；
- 用户撤销只结束自己的 fact，不修改其他 reporter 的事实；
- ReportFact 不保存审核处理人和审核结论；
- ReportFact 是 `viewer_has_reported` 和 active report count 的权威来源；
- bitmap/count 是可重建 projection，不是权威事实。

### 3.2 ReviewCase

ReviewCase 是按目标资源建立的审核工作单：

```text
ReviewCase
  id
  community_id
  target_type
  target_id
  state: open / claimed / resolved / dismissed
  priority
  risk_score
  active_report_count
  claimed_by_id
  claimed_at
  resolution
  resolved_by_id
  resolved_at
  version
  operation_ref
  inserted_at
  updated_at
```

默认一个目标最多有一个 active ReviewCase：

```text
UNIQUE(target_type, target_id) WHERE state IN (open, claimed)
```

ReportFact 与 ReviewCase 的关系不是强制一对一：

- 一个 ReviewCase 可以由多个 ReportFact 触发；
- 没有用户举报时，系统检测或 operations 也可以建立 ReviewCase；
- ReviewCase resolved 后出现新的有效举报，可以按策略重开旧 case 或创建新 case；
- case 保存当时的风险摘要，但 reporter 明细始终从 ReportFact 读取。

### 3.3 ModerationDecision

正式处理通过显式 command 表达：

```text
dismiss
  举报不足以采取动作，关闭 ReviewCase

keep
  内容保留，可记录 warning 或 reviewer note

fold
  仅改变 Comment 展示方式，不等于 Comment deleted

delete
  调用 Article / Comment 删除 command，推进对应 Lifecycle

archive
  调用 Article / Community archive command

suspend_actor
  调用 Accounts / Community Moderation 的独立 command
```

ReviewCase 不得直接更新 Article、Comment、Community 表。它调用资源所属领域的正式 command，由该 command 完成 Gate、锁、Lifecycle transition 和 Audit。

## 4. Gate 边界

Gate 继续只有两类公开路径：

```text
Gate.scope
  编译 ReviewCase / ReportFact 的读取范围

Gate.access_check
  单个举报或审核 command 的操作准入
```

建议 action：

| action | actor | resource | 说明 |
| --- | --- | --- | --- |
| `:report` | 登录用户 | Account / Article / Comment | 提交自己的举报 |
| `:withdraw_report` | reporter | ReportFact | 只撤销自己的 active fact |
| `:read_own_report` | reporter | ReportFact | 查看自己的举报状态 |
| `:read_review_queue` | moderator / operations | ReviewCase query | 读取被授权社区的审核队列 |
| `:claim_review` | moderator | ReviewCase | claim 一张 open case |
| `:release_review` | claimant / operations | ReviewCase | 释放 claim |
| `:resolve_review` | claimant / operations | ReviewCase | 写正式审核结论 |
| `:reopen_review` | moderator / operations | ReviewCase | 按策略重开已关闭 case |

Reporter 不能通过普通 Interaction response 读取其他 reporter、审核内部 note、risk score 或处理人。普通 public list 不能打开 moderation surface。

Review Scope 必须同时组合：

```text
actor moderator/operations authority
  + community ownership
  + target resource identity
  + ReviewCase state filter
```

审核队列必须在 SQL 中完成 Scope 和分页，不得先加载全部 case 再逐行调用 Gate。

## 5. Interaction 边界

Interaction report projection 只负责响应读取：

```text
viewer_has_reported
active_report_count（仅显式 report/moderation surface）
```

规则：

- projection 从 active ReportFact 重建；
- public Article / Comment 响应只暴露 `viewer_has_reported`；
- `active_report_count` 只允许举报 mutation response 或 moderation surface 使用；
- ReviewCase state、priority、resolution 不放进 Interaction State；
- moderator queue 直接查询 ReviewCase，不通过 reaction bitmap 推导；
- ReportFact 创建/撤销与同步 projection 更新处于同一事务。

## 6. 阈值与自动化

举报阈值是风险信号，不是正式判决。

允许的自动化：

```text
active_report_count 达到阈值
  -> 建立或提高 ReviewCase priority
  -> 发 moderator notification
  -> 对高风险 Comment 设置可恢复的 presentation fold
```

禁止的自动化：

```text
count >= N
  -> ArticleLifecycle.deleted
  -> CommentLifecycle.deleted
  -> Community suspended
```

如果产品保留自动折叠 Comment，应明确：

- fold 是 presentation safety state，不是 Lifecycle delete；
- 撤销举报后是否自动展开必须有独立策略；
- moderator `keep` 可以覆盖自动 fold；
- 自动 fold、人工 fold 和删除必须能在 Audit 中区分；
- 最终删除仍通过 `resolve_review(:delete)` 调用 Comment command。

未来 risk score 可以组合 reporter reputation、原因、历史命中率和目标类型，但只影响队列 priority 或临时保护措施，不直接成为资源 Lifecycle authority。

## 7. 完整流程

### 7.1 用户举报 Comment

```text
GraphQL reportComment
  -> CMS.AbuseReports.report_comment command
  -> transaction
     -> Gate.access_check(actor, :report, comment)
     -> insert ReportFact
     -> update report projection
     -> ensure/open ReviewCase when threshold or policy requires
     -> update ReviewCase risk summary
     -> Audit report.submitted
  -> return Comment with viewer_has_reported=true
```

### 7.2 Moderator 处理

```text
Dashboard moderation queue
  -> ReviewCase query
  -> Gate.scope(actor, :read_review_queue, community context)
  -> Repo pagination

claim
  -> transaction
     -> lock ReviewCase
     -> Gate.access_check(actor, :claim_review, case)
     -> state open -> claimed
     -> version + 1
     -> Audit review.claimed

resolve delete
  -> transaction
     -> lock ReviewCase
     -> Gate.access_check(actor, :resolve_review, case)
     -> CMS.Comments.delete(comment, moderator, source: :moderation)
        -> resource Gate
        -> CommentLifecycle.transition(:deleted)
        -> resource Audit
     -> ReviewCase state -> resolved
     -> write resolution / operation_ref
     -> Audit review.resolved
```

同一个 `operation_ref` 应贯穿 review resolution、资源 command、Lifecycle transition 和 Audit，使一次处理可以跨表关联。

### 7.3 用户撤销举报

```text
withdraw report
  -> Gate.access_check(actor, :withdraw_report, fact)
  -> ReportFact active -> withdrawn
  -> update projection
  -> refresh ReviewCase active_report_count / risk_score
```

撤销举报不能自动撤销 moderator 已完成的正式资源操作。若审核结论需要推翻，必须执行新的 restore/reopen command 并追加 Audit。

## 8. Audit 与当前状态

Audit 回答“发生过什么”，ReviewCase 和 Lifecycle 回答“当前是什么”。

```text
ReviewCase.state
  当前审核状态权威

ArticleLifecycle / CommentLifecycle / CommunityLifecycle
  当前资源状态权威

AuditLog
  append-only 责任与操作历史
```

建议 Audit action：

```text
report.submitted
report.withdrawn
review.opened
review.priority_changed
review.claimed
review.released
review.resolved
review.dismissed
review.reopened
moderation.comment_folded
moderation.resource_deleted
moderation.resource_restored
```

Audit 不参与 Scope 的当前状态过滤，也不通过读取最后一条 Audit 推断 ReviewCase 或 Lifecycle 状态。

## 9. Contribution 边界

现有 `Analysis.Contribution` 可以记录用户参与和贡献事实，但不能直接成为 Gate 权限或审核结论。

未来可以增加独立的 reputation projection：

```text
Contribution facts
  -> CommunityReputation projection
  -> reporter trust / moderation eligibility input
  -> Gate 与 ReviewCase risk policy 组合
```

示例：

- 高质量贡献者的举报可以提高 queue priority；
- 多次被 moderator 判定为恶意举报的账号降低 reporter weight；
- 达到社区治理等级后可以获得 `:read_review_queue` 或有限 `:claim_review` 能力；
- 最终权限仍由 Passport/Gate 明确授予，Contribution 本身不直接返回 allow；
- risk weight 只影响审核优先级，不能让高等级用户的举报直接删除内容。

这允许未来扩展贡献者成长体系，而不改变现有 Contribution、Gate 和 ReviewCase 的所有权。

## 10. 迁移路径

项目尚未发布时按一次性切换处理，不保留长期双写：

1. 建立 `report_facts` 和 `review_cases`；
2. 将 `AbuseReport.report_cases` 拆成独立 ReportFact；
3. 用 active facts 重建 report bitmap/count；
4. 将 `operate_user`、`deal_with` 映射为 ReviewCase 当前状态和 resolution；
5. 切换 report/withdraw mutation；
6. 切换 moderation list 为 `ReviewCase |> Gate.scope |> Repo pagination`；
7. 将阈值直接折叠改为 ReviewCase/risk policy 触发；
8. 接入 claim/resolve/reopen command 与 Audit；
9. 验证后删除 AbuseReport embed 和旧列表路径，不保留双权威。

## 11. 验收标准

### Report Fact

- 同一 reporter 对同一目标最多一个 active fact；
- 撤销只影响自己的 fact；
- report/withdraw 与 projection 在同一事务；
- fact 可以按 target、reporter、community、reason 和时间索引查询。

### ReviewCase

- 同一目标最多一个 active case；
- claim 使用 row lock 和 version guard；
- 非 claimant 不能普通 resolve；
- resolved/dismissed/reopened 都有 Audit；
- 新举报不会静默覆盖已完成 resolution。

### Gate

- public response 不泄露 reporter 和 moderation 内部字段；
- review queue 先 Scope 后分页，不逐行 Gate；
- report、withdraw、claim、resolve action 分离；
- ReviewCase resolution 不能绕过资源所属领域的 Gate 和 Lifecycle。

### Lifecycle

- 举报数量不会直接写 Article/Comment/Community Lifecycle；
- delete/archive/suspend 只由正式 moderation command 推进；
- restore 不通过删除 Audit 倒推状态，使用资源 Trash/Lifecycle 保存的恢复来源。

### Interaction

- `viewer_has_reported` 来自 active fact projection；
- 普通 public list 不读取 `active_report_count`；
- projection drift 可以从 ReportFact 重建；
- ReviewCase 状态不进入 reaction/emotion projection。

### 并发与幂等

- 重复 report request 不重复建立 fact 或增加 count；
- 多 reporter 并发提交只建立一个 active ReviewCase；
- 两个 moderator 不能同时 claim 同一 case；
- resolve retry 通过 operation_ref 幂等，不能重复执行资源删除；
- report withdraw 与 resolve 并发时，锁顺序和最终 case summary 可验证。

本文最终边界：ReportFact 是用户举报权威，ReviewCase 是审核工作流权威，Lifecycle 是资源状态权威，Interaction 是响应投影，Audit 是 append-only 责任历史；任何一个层次都不能通过自己的派生值取代另一个层次的正式决定。
