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
