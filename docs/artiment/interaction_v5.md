# Artiment Interaction V5：同步投影与 Audit 退役

> 状态：设计确认，待实施。
>
> V5 不修改 V1–V4 文档。旧版本继续记录当时的设计与实施背景；本文只定义新的最终边界。
> V5 不处理历史数据、不提供旧数据兼容、不扫描或修复存量脏数据。

前置文档：

- [Interaction V4](./interaction_v4.md)：统一 facade、reaction 事务与 ReadState；
- [Activity V1](../activity/v1.md)：业务活动记录与旧 CMS Audit 的切换边界；
- [Sentinel V1](../sentinel/v1.md)：跨领域内容风险检测。

## 1. 问题背景

Interaction 同时保存两类数据：

```text
权威事实
  upvote / collect / emotion / report fact

读取投影
  viewer membership bitmap
  materialized count
  bounded latest-user snapshot
```

现有 `CMS.Interactions.Audit` 和每日 `Jobs.InteractionAudit` 会遍历 fact 与投影，检查差异并重建
bitmap/count。这个设计把以下前提带入了长期运行时：

```text
正常写入可能不完整
  -> 以后由定时任务发现
  -> 再由 repair 恢复一致
```

V5 不接受这个前提。新系统不以历史脏数据、旧版本兼容、人工改库或部署交错作为常态设计输入。
正常 mutation 必须在自己的事务中完成全部权威写入和同步投影；任何一步失败，整个 mutation 回滚。

因此，Interaction 不再需要一个永久存在的全库 Audit/Repair safety net。

## 2. V5 决策

### 2.1 同步 transaction 是当前唯一写入模型

每个 reaction command 使用同一条路径：

```text
CMS.Interactions command
  -> Repo transaction
  -> Gate access check + canonical resource
  -> 写入或撤销 authoritative fact
  -> 根据同一结果同步更新 ReadState
  -> commit
  -> 执行事务后副作用
```

以 upvote 为例：

```text
insert/delete upvote fact
  + align viewer bitmap
  + align materialized count
  = one transaction
```

这里的 `align` 是 command 内部动作，不是独立 Context、公共 facade 或后台修复任务。

约束：

1. fact 写入和对应 ReadState 更新必须位于同一个数据库事务；
2. command 不得只写 fact 后依赖未来 Job 补齐投影；
3. command 不得只写投影而缺少对应 fact；
4. GraphQL Resolver、Job 和其他领域不得直接写 ReadState；
5. notification、search、achievement 等非权威副作用必须位于 commit 之后；
6. transaction 返回成功时，fact 和同步投影必须已经对齐。

### 2.2 不新增独立 `Interactions.Align`

当前同步模型下，独立 `CMS.Interactions.Align` 会制造一个不存在的产品边界。

```text
错误理解
  mutation 写事实
    -> Align 在另一个时间修正投影

V5
  mutation 在一次 transaction 内完成事实和投影
```

因此当前不新增：

```text
CMS.Interactions.Align
Jobs.AlignInteraction
定时全库 align
```

内部函数可以使用 `align_*` 表达“让投影与本次事实变更一致”，但它必须是具体 reaction command 的
私有实现，不构成跨模块公共入口。

### 2.3 只有切换为异步投影时才建立 Align

未来只有同时满足以下条件，才允许新增正式 `Interactions.Align`：

1. 产品明确接受 fact 提交后 ReadState 短暂滞后；
2. 存在真实的 event/outbox consumer；
3. mutation 只承诺 authoritative fact 已提交；
4. viewer state、count 和排序能够定义清楚的一致性窗口；
5. consumer 具备幂等键、重试、顺序和可观测性合同；
6. 这是一项单独版本设计，而不是当前同步路径的备用修复器。

届时的语义才是：

```text
fact transaction
  -> durable event/outbox
  -> Interactions.Align consumer
  -> project latest authoritative state
```

异步 Align 处理正常事件传播，不负责扫描或修复历史数据。

### 2.4 Report 不再成为 Audit 的长期理由

旧 `AbuseReport.report_cases` JSON embed 的重复 case、孤儿用户和 count 不匹配属于旧 Report 模型问题。
V5 不为它保留永久检查器，也不把 Report 数据检查继续放在 Interactions 下。

新的 Report 设计必须使用独立、可约束的举报事实：

```text
one reporter
  -> one report fact for one target
  -> database uniqueness constraint
```

目标事实模型不再按 target 聚合一整组 reporter：

```text
ReportFact
  id
  community_id
  target_type
  target_ref
  reporter_id
  reason
  evidence
  state: active / withdrawn
  inserted_at
  withdrawn_at

UNIQUE(target_type, target_ref, reporter_id) WHERE state = active
```

切换后的权威语义：

- 一位 reporter 针对一个 target 的一次 active 举报是一条独立 fact；
- reporter 撤销只结束自己的 fact，不更新其他 reporter 的记录；
- active report count 由规范化 fact 查询或同步投影得出，不由聚合行中的手写 count 决定；
- reporter 身份通过正式 Account ref/FK 表达，不保存 embed user snapshot；
- Report Fact 不保存审核处理人、审核结论或资源处罚状态；
- Interaction 只投影普通响应需要的 `viewer_has_reported`；
- Moderation surface 如需 count，必须从 active Report Fact 得出。

新模型切换时直接删除旧实现，不兼容、不回填、不双写：

```text
AbuseReport.report_cases
Embeds.AbuseReportCase
report case 中的 embed user snapshot
AbuseReport.report_cases_count 的权威语义
CMS.Interactions.Audit.Report
旧 CMS.AbuseReports.List
旧 target 聚合 AbuseReport 读写路径
```

旧数据不转换为 ReportFact。新结构上线后只接受新产生的举报事实。

举报数量也不能直接触发资源动作。以下旧链路必须与 embed 一起删除：

```text
report_cases_count >= threshold
  -> CommentStates.fold_for_report
```

新链路必须是：

```text
Report Fact
  -> Moderation Case / policy
  -> explicit Decision
  -> Comment command / Lifecycle
  -> Activity
```

Report Fact、Moderation Case、资源 Lifecycle 和 Activity 的详细边界由后续独立版本文档定义。
Interaction 只负责公开响应所需的 `viewer_has_reported` 等同步投影。

## 3. 退役范围

V5 实施时删除：

```text
GroupherServer.CMS.Interactions.Audit
GroupherServer.CMS.Interactions.Audit.Projection
GroupherServer.CMS.Interactions.Audit.Report
GroupherServer.Jobs.InteractionAudit
Oban daily InteractionAudit cron
对应 telemetry event
对应测试与文档引用
```

不新增替代 Job，也不执行历史 report/audit 清单、backfill 或 repair。

历史 migration 文件可以保留其原始名称和内容；它们记录已经发生的 schema 演进，不是当前运行时
模块，也不构成保留 Audit Job 的理由。

## 4. 事务职责

每个具体 reaction owner 负责自己的完整 transaction：

```text
CMS.Interactions.Reactions.Upvote
  authoritative upvote fact
  upvoted viewer bitmap
  upvotes count

CMS.Interactions.Reactions.Collect
  authoritative collect fact
  collected viewer bitmap
  collects count

CMS.Interactions.Reactions.Emotion
  authoritative emotion fact
  emotion viewer bitmap
  emotion count

CMS.Interactions.Reactions.Report
  authoritative report fact
  viewer_has_reported projection
  explicit moderation-surface count when retained
```

不得抽出一个能够任意修改所有投影的通用 writer。共享 SQL helper 只能复用机械能力，不能成为第二个
业务写入口。

## 5. 失败语义

同步 transaction 的失败语义必须简单：

```text
fact failure
  -> rollback

ReadState failure
  -> rollback fact

transaction success
  -> fact and ReadState are aligned

post-commit effect failure
  -> 不回滚 Interaction
  -> 由对应 effect owner 重试
```

不引入 `projection_not_updated` 这种“业务成功但同步投影失败”的成功变体。只要同步 ReadState 仍是
mutation 合同的一部分，它失败就表示整个 mutation 失败。

## 6. 验证方式

V5 不运行全库一致性扫描。正确性通过 command 级测试证明：

1. 每个 create/undo command 同时断言 fact 和 ReadState；
2. Gate 拒绝时二者均不改变；
3. fact constraint 失败时 ReadState 不改变；
4. ReadState 更新失败时 fact 回滚；
5. changed/unchanged 幂等结果不产生重复 fact 或错误 count；
6. 并发测试证明同一 target 的 count、bitmap 和唯一 fact 一致；
7. transaction 之后才触发通知、搜索等副作用。

这些测试验证正常系统合同，不承担历史数据兼容。

## 7. 实施顺序

1. 确认 Upvote、Collect、Emotion、Report 的 fact 与 ReadState 位于同一 transaction；
2. 补齐 command 级 rollback、幂等和并发测试；
3. 删除 `Interactions.Audit` facade、Projection 和 Report；
4. 删除 `Jobs.InteractionAudit` 与 Oban cron；
5. 删除只服务于 Audit 的 telemetry、测试和配置；
6. 在新的状态索引或后续版本中声明 V5 已取代旧 Audit safety-net 结论，不回写 V1–V4；
7. 用规范化 ReportFact 一次性替换 `AbuseReport.report_cases` 聚合模型；
8. 删除旧 AbuseReport List、embed/count 和 report threshold 自动 fold；
9. 不扫描、不导出、不修复历史数据。

第 6 步只能在新文件中声明 superseded，不回写旧版本设计正文。

## 8. 验收标准

- 运行时代码中不存在 `CMS.Interactions.Audit`；
- 不存在 Interaction 全库 report/repair/align cron；
- 每个 reaction 的 fact 和同步 ReadState 位于同一 transaction；
- mutation 成功时投影已经对齐，失败时全部回滚；
- 没有历史数据扫描、repair、backfill 或兼容路径；
- 当前同步模型下没有独立 `Interactions.Align`；
- 未来异步 Align 必须通过新的版本文档单独设计。
- 一位 reporter 的 active 举报由一条规范化 ReportFact 表达；
- 不存在 `report_cases`、reporter embed snapshot 或聚合行 count 权威；
- 举报数量不能直接 fold、hide、delete 或改变资源 Lifecycle。
