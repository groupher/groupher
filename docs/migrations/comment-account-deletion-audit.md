> 当前状态：无 guard 的旧库/旧 schema 仍有摘要漂移风险；[数据库 guard 与准入验收](comment-account-physical-deletion-block.md) 已在当前新 schema 本地拒绝未受控 DELETE/TRUNCATE，尚未部署，不能宣称线上 blocker 已解除。下文保留无 guard 时的历史诊断；受控账号删除/匿名化仍未实现。

# 账号物理删除与评论摘要：独立核查

> 2026-11-05。只核查直接物理删除行为，未修改账号删除策略、FK 或业务 writer，未发布。诊断在私有 `groupher_pending_audit_20261105` 的 Sandbox 中执行，结束后整体回滚；未删除既有环境账号。

## 1. 已确认的边界

[外键只读结果](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/comment-review-fk.log) 确认：

```text
Comment.author_id -> account.users(id) ON DELETE CASCADE
```

因此“保留有效评论，但 User 行不存在”的状态不符合当前数据库约束。不能为了模拟该场景关闭 FK，也不能靠 left_join 解决级联删事实后的摘要维护。新评论缺少真实合法账号时继续失败，不使用 placeholder 代替账号授权。

已有快照的账号资料不可用是另一条读取合同：Snapshot.Query 已生成 `deleted / Deleted user / avatar=nil`；ShadowSync 必须保留稳定 ID/ref、顺序和数量。本轮新增 SNAP-02 回归验证 article participants、root reply participants 与 reaction 嵌套快照，Count、entries、revision、lastReplyAt 均不因资料刷新变化。

## 2. 无 guard 的历史 schema：直接物理删除确有摘要漂移

诊断步骤：正常发布文章 → 独立用户正常发表评论 → 在内层事务直接 `Repo.delete!(commenter)`，绕过业务删除命令 → 读取事实和 ArticleStats。外层 Sandbox 最终回滚。

[结果 JSON](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/comments-account-delete-audit.json)：

| 项目                                     | 删除前 | 删除后         |
| ---------------------------------------- | ------ | -------------- |
| User                                     | 存在   | 不存在         |
| 该用户的 Comment                         | 存在   | 被 FK 级联删除 |
| ArticleStats.comments_count              | 1      | 1（未同步）    |
| ArticleStats.comments_participants_count | 1      | 1（未同步）    |

这证实无 guard 时的一条独立缺陷：直接物理删除账号可以绕过评论摘要维护。当前新 schema 拒绝该删除入口，未修补旧库的历史漂移。诊断用例的“执行完成”不代表删除一致性通过；也不应将该结果描述为“已由 unavailable 占位修复”。

本轮在 Accounts facade/Commands 的定向核查未发现受支持的账号物理删除业务命令；`FrontDesk.Cache.delete_user` 是缓存删除，不能混称账号删除。该核查不是全仓库/外部运维脚本写入口审计，不证明没有其他删除入口。

## 3. 封闭方案实施前的处理状态

- 本轮只补既有快照资料缺失的读取回归，不修改 Summary 或完整参与者分页去保留已无有效事实的用户。
- 账号物理删除是共享评论计划明确排除的策略重写范围，本轮不擅自更改 CASCADE、匿名化或历史保留口径。
- 当时登记为未修复；后续授权已选择并在当前新 schema 本地实施“拒绝未受控 DELETE/TRUNCATE”。旧库/旧 schema 未因此自动受保护，原始诊断证据保持不变。
- “保留匿名评论”或“删除事实并同步所有受影响 aggregate”的受控账号删除策略仍待独立设计，须另列事务、授权、摘要、通知/提及和并发验收。直接删除 `account.users` 仍不是受支持业务流程，新库发布验收也不得借该操作建立不一致 fixtures。

[临时诊断源码](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/comments-account-delete-audit_test.exs.txt)、[运行日志](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/comments-account-delete-audit.log)、[固定输入与 SHA](comment-reaction-snapshot-counts-audit/review-20261105T130013Z/manifest.json)。
