# PR #619 Passport review — 2026-11-24

## Scope

Review and repair the canonical Passport chain in the existing delivery branch. Do not merge this PR. Existing legacy data compatibility is excluded; active callers, structures, configuration, fixtures and generated contracts must use the current architecture. D2 acceptance and D3 migration/recovery rehearsal remain separate work.

## Changes

- Replace legacy Registry/Assignment/facade authorization and virtual user Passport projections with Catalog, Store and actor-bound scoped facts. Keep only the explicitly offline LegacyPlan report vocabulary.
- Enforce canonical Community membership and Global category authority; distinguish theme and RSS actions. Filter Trash reads by owner or system root before hydration.
- Preserve site-authorized Queue editing and check Article admission after commit. Isolate private WorkingCopy caches and editor state by account.
- Align Import capability queries, service audience/scope, configuration and local runtime provisioning. Declare the GraphQL generator plugin explicitly.
- Reject seed privilege adoption without a matching ownership ledger; allow exact cleaned memberships to be initialized again.
- Remove obsolete executable rehearsal scripts; port remaining supported fixtures.

## Validation

Final full-suite and CI results are reported in the PR description for the delivered head; focused results below are not a substitute for that acceptance.

- Canonical Passport / Queue / Seed / error boundary: 87 passed, 5 skipped.
- Review / category / provider-failure regressions: 62 passed. The original full run exposed obsolete scope fixtures and global-empty assertions; these were reproduced separately before repair.
- WorkingCopy / Queue / Admin frontend regression tests: 16 passed.
- Import: 150 passed, 1 skipped; Auth: 86 passed; Dev Hub: 111 passed.
- Core, Dash and Apply type checks, GraphQL source/generated checks and documentation/architecture gates passed locally.
- A final full backend run uses a newly recreated task-owned database with `TEST_REF_ISOLATED=1 mix test --exclude skip_ci --max-cases 8`. Do not infer its result from the focused counts.

## Review ledger

The 50 threads below are from the three automatic review submissions on the original candidate; their disposition does not constitute independent human approval.

| #   | Topic                                               | Disposition                                                   |
| --- | --------------------------------------------------- | ------------------------------------------------------------- |
| 1   | Preserve site-level access to the Dash Queue editor | 已修复；重复意见由同一修复覆盖                                |
| 2   | Preserve body edits made while saving               | 已修复；重复意见由同一修复覆盖                                |
| 3   |                                                     | 发布前置：按新资源配置，不保留旧 bucket 兼容                  |
| 4   |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 5   |                                                     | 不采纳旧数据自动晋升；新社区原子创建 lord                     |
| 6   |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 7   |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 8   |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 9   |                                                     | 不迁移旧 R2 数据；新资源预置见发布计划                        |
| 10  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 11  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 12  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 13  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 14  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 15  |                                                     | 历史证据限制已注明；当前版本 D3 验收仍待后续                  |
| 16  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 17  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 18  |                                                     | 发布前置：配置新服务身份与 Secret                             |
| 19  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 20  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 21  |                                                     | 保留设计：grantable 限制权限持久化，不禁止 root/lord 查询能力 |
| 22  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 23  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 24  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 25  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 26  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 27  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 28  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 29  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 30  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 31  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 32  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 33  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 34  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 35  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 36  |                                                     | 历史计划已明确标注，并增加当前架构映射                        |
| 37  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 38  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 39  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 40  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 41  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 42  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 43  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 44  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 45  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 46  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 47  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 48  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 49  |                                                     | 已修复；重复意见由同一修复覆盖                                |
| 50  |                                                     | 已修复；重复意见由同一修复覆盖                                |
