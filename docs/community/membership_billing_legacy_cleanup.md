# Membership / Billing 旧链路清理

本文记录 2026-08 的一次性清理：目标是删除历史 Membership/Billing 实现和未落地的
Lifecycle 占位，不在本轮引入替代模型、支付接入、会员资格或新的 Gate 规则。

它是当前运行时契约和 review 清单；新的产品设计确定前，本文不推断其数据模型、状态机或
授权语义。

## 当前边界

当前系统不存在以下运行时能力：

- Billing Context、Payment Provider、订单、订阅、试用、付款事件或 entitlement projection。
- Community Membership / paid-content 的成员资格、角色、期限或 Gate Scope 条件。
- `billing_read_only`、`billing_suspend` Lifecycle Blocker。

因此，Gate 只消费现有 Lifecycle、Moderation、Owner、Ops 和 Passport 事实；不得添加
Membership/Billing `EXISTS` 条件、外部服务调用或 fail-open fallback。

## 保留的产品链路

`cms.communities_subscribers` 不是 Membership，也不是 Billing。它是现有的社区关注关系：

```text
订阅社区 / 点赞 / 评论 / 表情
              ↓
communities_subscribers
              ↓
侧边栏、订阅列表、订阅数与关注后的产品体验
```

本次清理不改 `CommunitySubscriber`、`subscribe_community`、互动自动订阅、Community
Moderator 或 Passport。它们不能被用于推断未来的会员资格或支付授权。

## 已删除的旧链路

### 历史会员徽章

以下实现只会把用户 Achievement 的永久布尔字段设为 `true`，没有付款来源、作用域、到期、
撤销或授权能力，因此整体删除：

- `Accounts.Achievements.Membership` 和 `Accounts.Achievements.set_member/2`。
- `Achievement` 的 `donate_member`、`senior_member`、`sponsor_member`。
- GraphQL `Achievement` 的对应字段、空值 middleware 投影、前端 user fragment、生成类型与
  `TMembership`。

### 旧 Billing 残留

以下无生产者或无调用残留已删除：

- `billing.state.update` 与 `system_accountant` Passport grant、翻译和存量 Passport JSON 键。
- Payment PostgreSQL schema prefix、旧 bill factory 和旧 bill error codes。
- Lifecycle 的两个 Billing blocker、Elixir/GraphQL 枚举、状态投影、测试和文档声明。

资产库中的 “billing bytes” 是 Community asset 容量计量，不是旧 Payment/Billing 链路；本次不改。

## 数据迁移

[`20260814120000_remove_legacy_membership_and_billing_placeholders.exs`](../../backend/api/priv/repo/migrations/20260814120000_remove_legacy_membership_and_billing_placeholders.exs)
执行以下不可逆操作：

1. 删除 `account.achievements` 的三个旧会员徽章列及其依赖索引。
2. 从 `cms.passports.rules.global` 删除 `system_accountant`。
3. 删除 `cms.community_lifecycle_blockers` 的 `billing_read_only` 和 `billing_suspend` 记录。
4. 对受影响 Community 按剩余 Owner/Moderation blocker 重算物化 Lifecycle state。
5. 收紧 blocker type CHECK，只允许 `owner_archive`、`moderation_suspend`、
   `moderation_archive`、`ops_legal_hold`。

历史 migration 不修改也不删除；它们是数据库演进记录。尤其旧 payment 数据已由
`20260413000100_drop_payment_and_customization.exs` 不可逆删除，不能从当前数据库恢复或迁移。

## Review 清单

- 不应出现旧会员字段、`set_member`、`TMembership`、`billing.state.update`、
  `system_accountant` 或 Billing Lifecycle blocker 的运行时代码/API。
- `communities_subscribers` 及其自动订阅入口不应出现在本次 diff 中。
- Lifecycle 状态只由现存 Blocker 类型投影；迁移删除旧 blocker 后必须重算状态。
- GraphQL SDL、客户端生成类型和前端 fragment 必须同步删除旧 Achievement 字段。
- 历史 migration 内的旧名字属于保留历史，不是运行时残留。

新的 Membership/Billing 设计开始前，应先替换本文所列的“当前不存在”契约，再新增任何表、
权限、Gate policy 或 Lifecycle effect。
