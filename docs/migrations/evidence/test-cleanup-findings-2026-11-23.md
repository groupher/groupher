# Test cleanup findings — 2026-11-23

本记录汇总 Co-Authors、Passport 与 Docs Queue 联调中发现的过期测试夹具和真实产品缺陷。修正只针对当前合同；没有清理或重置共享测试数据库。

## 已修正

- `HistoryPurge` / `WorkspaceDelete` 测试仍调用已退役的 guard；改为验证当前 Queue 成员、成员副本、WorkingCopy、Snapshot 与 purge 保护合同。
- Legacy Queue 删除测试没有创建实际的 default copy 和 Queue copy；补齐数据后验证删除路径。
- `content_import_flow_test` 使用已退役的 `doc.trash` 权限、错误的 mapping 字段及未按 Community 隔离的计数；夹具已切换为当前权限和映射合同，并隔离计数范围。
- Docs R5 verifier 曾用旧 Passport fixture 及已删除的 `DocsLifecycle` / 旧 WorkingCopy 字段；已改用 CommunityAdmin 的 Docs Queue 权限与当前 `ArticleLifecycle` / WorkingCopy scope。
- R5 verifier 随后暴露真实缺陷：恢复后的 Doc 保留历史 `first_published_at`，Queue Release 因而误判为已发布文档并拒绝 draft → published。现按当前生命周期判定首次发布，并保留历史 marker 对首次发布副作用的作用；新增回归覆盖。
- `doc_workspace_boundary_test` 只授予旧 `doc.queue.write`，而当前 Gate `:edit` 使用 Article `article.update`；夹具已修正，使测试验证实际准入合同。

## 本轮验证

- 使用隔离数据库运行 Co-Authors、Docs Queue、Trash/Restore、Content Import、Passport、GraphQL 与 Gate 回归：166 passed、2 skipped、0 failures。
- 前端 Queue 编辑器、co-author Article 入口、Account 与 Gate focused tests：15 passed。
- Core、Dash、Apply type-check，`pnpm docs:check` 与 `git diff --check` 均通过。
- R5 verifier 的独立 Restore / Re-publish 阶段均通过；共享 `groupher_server_test` 数据库未清空或重置。

## 仍待完成

- 双账号浏览器验收尚未运行：Dev Hub 当前归另一 worktree 所有，不能从本分支控制；必须在此分支可用的受管环境完成。
- P4a/P4b 的 Passport owner 清理、C3 → D1 → D2 尚有各自 inventory 中列出的剩余范围；D3 克隆数据盘点与回退演练未完成，故 P4c 不能关闭。
- 当前 Phoenix 内部 `CMS.ContentImport` / GraphQL `contentImport*` / 数据表 `content_import_*` 仍沿用既有领域合同，产品 UI 的 `Import` 命名不等于后端已全链路改名。若执行全链路命名迁移，必须一次覆盖 API/schema、调用方、测试及持久化迁移，不能只重命名测试文件。

## 2026-11-23 follow-up — latest-dev rebase

以下结果是在上述快照之后取得；上面的状态和数字保留为当时记录。

- Co-Authors 分支已 fetch/rebase 到 `origin/dev`（`9c1dcd3`）；PR #615 以该 `dev` 为 base，head `a08610b` 为 29 commits ahead / 0 behind。CI shard 1 的 Trash snapshot 隔离级别错误已修正；shard 2/6/8 的 Docs `edit` / `publish` Passport action 映射已修正。
- 在独立数据库 `groupher_server_test_codex_20261123` 重跑这四个回归：Trash GraphQL 1 项通过，Docs asset cleanup、Queue grant、production seed 3 项通过；Import flow/process 20 项通过。数据库表重命名 migration 的 up/down 均已在该隔离库验证。
- 当前 Import 命名已贯通 Phoenix facade / resolver / GraphQL、Worker、Dash、Core、测试和持久化表/索引；旧迁移文件保留其历史名称。生产 R2 bucket 与临时对象前缀迁移仍待资源创建、未过期对象复制校验和部署验收，不能把代码配置切换视作生产迁移完成。
- Worker 测试 140 passed、1 skipped；Worker / Worker runtime / Dash type-check、GraphQL contract/generated checks、`pnpm docs:check`、backend warnings-as-errors compile 均通过。
- 另跑 `pnpm run check:pagination-n-plus-one` 时，现有 report-only scanner test 仍期待 1 条，当前分支扫描到 15 条；该清单未在本轮擅自改写，需对新增 request-path findings 做单独归因和处置。它与上述 4 个已通过的 CI 后端回归分开跟踪。
