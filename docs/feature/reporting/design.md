# V1 举报事实与 AlertBoard（历史）

> 状态：historical；当前举报与审核合同见 [ReviewBot / AlertWall V2](../alert-board/v2.md)。

本文记录 V1 目标，不再定义当前实现。V2 将举报事实归 AlertWall，资源处置仍由 CMS/Accounts 正式领域入口执行。
管理员 Moderator、Passport 和资源 Gate 不因此删除。

## 当前实现与迁移边界

当前举报 owner 是 `CMS.AbuseReports`，包括提交/撤销、report_cases 聚合和 Interaction 投影。
当前内容举报实际经 `interactions/reactions/report.ex`，其 maybe_fold_comment 仍按 threshold 调用 fold_for_report；
账号举报另走 `abuse_reports/report.ex`。新实现删除前者阈值折叠并统一事实归属。

```text
用户举报内容 / 用户 -> 独立举报事实 -> AlertBoard 事项
ReviewBot 检测结果  -> 独立检查事实 -> 同一相关事项
                                      |
                                 正式处理决定
                                      |
                          CMS / Accounts 正式领域入口
```

- 保留举报提交者、对象、理由、撤销和重复举报约束，不删除举报业务。
- 多条举报可关联同一事项，AI 信号不得冒充用户举报。
- `viewer_has_reported` 与统计投影从举报事实派生，不作为处罚结论。
- 撤销举报不能自动撤销人工处置；举报数不能直接等于违规。
- 账号举报由 AlertBoard 管理；账号处罚仍由 Accounts，社区内禁言仍由社区成员领域执行。
- 普通用户响应不暴露举报人列表、内部证据、审核员备注。

举报表、权限、submit/withdraw、一次性数据转换和旧 facade 删除见 [实施合同 §11](../alert-board/implementation.md#11-举报归属切换与历史边界)，
旧举报全链路在 [D5](../alert-board/delivery.md#d5-清除旧-report-运行时全链路) 先移除；事实一次性迁移按 [N4](../alert-board/delivery.md#n4-举报历史一次性迁入-alertboard) 执行。用户举报 V1 只受理、驳回和记录人工处理，不提供账号处罚 API。
[旧 Audit 退役](../../migrations/legacy-content-audit-removal.md)不等于举报迁移已完成。
