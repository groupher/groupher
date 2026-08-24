# OAuth V1 切换运行手册

本文是 [link_unlink_oauth.md](./link_unlink_oauth.md) 描述的 OAuth link/unlink V1
切换执行清单，已完成评审。

它不是自动执行的 Ecto migration。raw 清理是一个必须显式运行的部署后数据操作，只有在
新的 Auth/Phoenix 版本已完整提供服务且所有旧 writer 都已排空后才能执行。

## 产物

- Cleanup SQL: [`backend/main/scripts/oauth_cutover_raw_cleanup.sql`](../../backend/main/scripts/oauth_cutover_raw_cleanup.sql)
- Migration: `backend/main/priv/repo/migrations/20260811100000_harden_oauth_provider_bindings.exs`
- 已评审的发布 commit：`________________________`
- 清理脚本版本或 checksum：`________________________`

清理 SQL 只支持向前执行。它不会创建备份表，也不是回滚操作。

## 部署前

- [ ] 确认 release commit 包含有边界的 OAuth DTO，且 Auth 或 Phoenix 中不存在 raw writer。
- [ ] 确认 migration preflight 报告 `(user_id, provider)` 分组没有重复。
- [ ] 记录重复项 preflight 查询输出和受影响行数。
- [ ] 确认数据库为 PostgreSQL 13+（binding migration 使用 `gen_random_uuid()`）。
- [ ] 确认已批准的 first-party Auth origins 和 CSRF 配置。
- [ ] 记录 operator 和 approver。

如果重复断言失败，立即停止。本次切换不会删除、重写、合并、归档或以其他方式修复
provider bindings。

## 发布与排空

- [ ] 部署新的 Auth 和 Phoenix 版本。
- [ ] 确认每个 Auth 实例都报告新的 release commit。
- [ ] 确认每个 Phoenix 实例都报告新的 release commit。
- [ ] 排空并移除所有旧实例。
- [ ] 证明没有旧的 registration 或 link writer 仍在运行。
- [ ] 记录 rollout 完成时间和排空证据/链接。

只要旧 writer 仍可能写入 `account.oauth_providers.raw`，就不要运行清理；后续登录可能
再次填充该值。

## 执行清理

运行仓库中已提交的 SQL，并启用 `ON_ERROR_STOP`，例如：

```sh
psql --set ON_ERROR_STOP=1 "$DATABASE_URL" \\
  -f backend/main/scripts/oauth_cutover_raw_cleanup.sql
```

- [ ] 记录 `non_null_raw_before`。
- [ ] 记录 `rows_cleared`。
- [ ] 记录 `non_null_raw_after`（必须为 `0`）。
- [ ] 确认事务已成功提交。

## 运行后验证

- [ ] 重复 `(user_id, provider)` 数量仍为 `0`。
- [ ] `account.oauth_providers.raw IS NOT NULL` 数量为 `0`。
- [ ] 新登录只保存有边界的 allowlist metadata。
- [ ] 通过 Auth 和 GitHub callback 的 link smoke test 成功。
- [ ] unlink smoke test 成功，并保留最后登录方式规则。
- [ ] 普通登录仍能创建或复用预期的 Browser Session。
- [ ] Monitoring 未出现 OAuth callback、token refresh 或 Phoenix delegation 错误峰值。
- [ ] 记录 smoke-test 结果、monitoring 链接、执行时间和最终状态。

## 失败处理

- Migration duplicate assertion：停止部署，生成冲突行报告，交由产品批准的独立评审处理。
- 提交前清理 SQL 失败：调查原因，只有在 release/drain 前置条件仍满足时才重跑。
- 清理已提交但运行后 raw 数量非零：停止 rollout 后续操作，确认 writer，并在获批后重跑
  仓库中的 SQL。
- 回滚时绝不恢复无边界 raw 值。该清理操作有意设计为只向前执行。

## 执行记录

```text
release commit：
cleanup script checksum：
operator：
approver：
started at：
finished at：
duplicate groups before：
non_null_raw_before：
rows_cleared：
non_null_raw_after：
post-run duplicate groups：
link smoke：
unlink smoke：
sign-in smoke：
monitoring result：
final status：
notes：
```
