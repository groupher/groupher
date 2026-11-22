# Docs R8 生产切换记录

状态：**生产部署已完成，真实身份业务验收尚未完成**。2026-11-12 已清理获授权的旧内容、执行最新 DDL，并部署新后端、Dash 和 Community Worker。下文的“尚未执行”等句子是切换前的历史记录；以本节的实际执行结果为当前状态。

## 实际执行结果（2026-11-12）

1. R7 根因修正后，普通 Article 的历史归属由 `cms.article_history_owners` 表示，Binding 移动时保留来源和目标 Community 的历史归属；删除 Community 时只清理该 Community 的归属，最后一个归属删除后再清理 Article 历史。聚焦测试通过；全量后端单并发 `2574 passed, 0 failures, 1 excluded`，生产编译和 `pnpm docs:check` 通过。并发全量中另有一个 Press 大批量测试超时，单独重跑通过；不能据此宣称并发争用已解决。详见 [R7 清理记录](docs-legacy-cleanup-r7.md)。
2. 从实际生产分支 `br-ancient-darkness-a1gy9enb` 创建新鲜演练分支 `br-curly-union-a1znz0r3`，parent LSN `0/5E4F72F8`。在该克隆上按[明确清理清单](../../ops/postgres/docs-r8-content-reset-plan.json)清空 33 篇旧内容，范围外数据指纹保持一致；[清理证据](evidence/docs-r8-history-clone-reset-20261112.json)。随后运行含 `20261112234000` 的全部 28 个待迁移版本，剩余 Article 为 0，结构指纹 `53879d6dc5dddc9e8b4d4c359cab0afae5a2cf64939d058e410d9bd520906230`；[迁移证据](evidence/docs-r8-history-clone-migrations-20261112.json)。
3. 停止生产旧 Machine `0807979ad30968` 后，从实际生产分支创建切换前备份 `br-small-water-a1cxypig`，parent LSN `0/5E5134B0`，已达到 ready。生产清理事务删除 33 篇旧 Article，剩余 0，受保护表指纹保持一致；[生产清理证据](evidence/docs-r8-production-reset-final-20261112.json)。
4. 生产执行全部 28 个待迁移版本，最大版本 `20261112234000`，剩余 Article 为 0；结构指纹与克隆一致，generation `7f39fe0a-d3e9-4d4b-982a-edbdbe8a6c3f` 标记 ready；[生产迁移证据](evidence/docs-r8-production-migrations-final-20261112.json)。`SHARED_COMMENTS_SCHEMA_SHA256` 已更新为该指纹。
5. Fly 配置补入现有 `groupher_data` volume 的 `/data` 挂载，成功部署镜像 `registry.fly.io/groupher-api:deployment-01M77VFE1ES6TWT65RPHZGRR0J`。release migration 成功；当前唯一业务 Machine 为新镜像且 `started`，`https://api.groupher.com/health` 返回 200，GraphQL `__typename` 返回 `RootQueryType`。Fly CLI 的最终 DNS 检查因本机到 `8.8.8.8:53` 超时给出警告，但自定义域名的实际 HTTPS 请求成功。
6. Dash Worker 首次部署版本为 `d0edbc24-06f3-4683-b546-400e2c60c979`。Community Worker 首次版本上传卡住，静态资源已上传但版本未生效；重试成功，版本 `1668fdfb-5975-456e-a3fc-45bc3a96a3f7`。此前打开的 Chrome 标签显示 `Sign in required`，因此当时无法做真实身份验收。
7. 生产公开 GraphQL 的 `docPublicTree(community: "dev")` 返回空 `tabs`，符合清空旧内容后的状态；匿名 `docsWorkspaceTree` 和 `configureDocsQueue` 均返回 `account_login`（4301）。新 Community Worker 上 `/dev/doc` 返回 200，旧 Doc ID 4 的详情请求 `/dev/doc/4/legacy` 返回 404。此检查只覆盖匿名读取、权限拒绝及路由，不替代新内容发布后的正文、目录和副作用验收。
8. 后续用户提供的已登录生产截图暴露前端启动错误：`useSideTreeLogic()` 在父组件渲染时先调用 `useDocsEditor()`，而 `DocsEditorStoreProvider` 位于其返回的子树内。将 Provider 提升到编辑器外层、目录控制器创建后再接入 store；Core / Dash 类型检查、聚焦测试、lint、格式检查和 Dash 生产 dry-run 通过。重新部署 Dash 版本 `ec1a465c-4755-416f-999d-231655ba0dd6` 后，在同一已登录 Chrome 标签刷新，编辑器显示 `Add Group`、`Import content`、`Doc status`，错误卡片消失。这只证明编辑器能够启动，D/Q、审批、预览、Release 和 D 生命周期的真实操作仍待执行。

部署后的[运行态证据](evidence/docs-r8-production-runtime-20261112.json)：数据库 `groupher_mentions_graph_20261106`、Article 0、历史归属 0、最大迁移 `20261112234000`、活动 Oban 任务 0；Fly 服务检查为 passing，Community 部署列表确认新版本正在承载流量。真实发布副作用与外部 Search/CDN 尚未验收；`SEARCH_ARTIMENTS_ENABLED=false`。

## 已确认的目标

用户明确选择生产环境，并于本轮完成 Fly CLI 登录。2026-11-12 的只读实测：

| 项目                | 实测值                                  |
| ------------------- | --------------------------------------- |
| Fly App             | `groupher-api`                          |
| Machine             | `0807979ad30968`                        |
| Region / State      | `sin` / `started`                       |
| 部署镜像 tag        | `deployment-01M6Q64D5HMFN8VW1ZDTNS40ZG` |
| Repo 当前数据库     | `groupher_mentions_graph_20261106`      |
| Repo 当前角色       | `neondb_owner`                          |
| PostgreSQL TimeZone | `UTC`                                   |

身份核对通过 `flyctl status --app groupher-api --json` 和运行实例的 release RPC 查询 `current_database(), current_user, current_setting('TimeZone')` 完成，未读取或记录连接密码。

**旧的 2026-11-04 验收库名 `groupher_prod_seed_20261104` 不代表当前生产目标，不得按旧记录执行清理。**

## 放行前检查清单（切换前历史记录）

以下条目保留切换前的判断过程，完成情况以“实际执行结果”为准。

- R7 旧机制清理曾完成一轮全量后端 2,573 通过、0 失败、1 排除；随后普通 Article 历史保留改动重新打开验收，切换前须以本轮最终全量结果和最新构建为准。
- 在当前实例核对部署版本、迁移版本、Doc 根集合、所有入向引用及任务归属。
- 生产基线与旧 Binding URL 标识已持久保存；全部旧 Article 均在授权清理范围内，保护账号、配置及范围外资源，实际暂停 / 排空仍须记录。
- 生成有明确切换 ID、规则版本、逐阶段计数和失败恢复步骤的可执行清单；隔离演练通过后再执行。
- 生产清理、DDL、部署、真实身份冒烟、Search / Press / CDN 和旧 URL 404 尚未执行。

当前记录只是目标识别证据，不是 `go` 标记或完成报告。后续阶段必须逐项补录实际结果，不能从隔离库结果推定。

## 首轮只读盘点

2026-11-12 运行实例查询结果：

- `schema_migrations`：759 条，最大版本 `20261105234500`。
- Article：Doc 1、Post 29、Blog 1、Changelog 1、Ticket 1。非 Doc 共 32 条；后续用户明确授权将这些旧内容及依赖纳入清理。
- 仍有 `doc_branches` / `doc_branch_states` / `doc_drafts` / `doc_publics` / `doc_revisions` / `docs_site_states`，正文仍为 `article_body_drafts` / `article_body_snapshots`。
- 查询时 Oban 的 `available` / `scheduled` / `executing` / `retryable` 任务数为 0。这只是当时的数据库观察，不等于已暂停生产者或完成任务排空。

### 前置依赖盘点（清理范围已获用户扩大授权）

该实例尚未部署 Article 新基座。不能仅清除 1 篇旧 Doc 后执行全部待迁移 DDL：

1. `20261107100000_simplify_mention_current_edges.exs` 明确要求整个 Article / Comment / Mention 目标为空，非 Doc Article 也会阻断。
2. `20261110140000_link_article_public_to_snapshot.exs` 添加非空 Snapshot 外键，不提供旧 Public 转换。
3. `20261112000000_retire_ordinary_draft_revision_tables.exs` 拒绝非空普通 Article Draft / Revision 表。

最初的“仅清理 Docs、保护非 Doc”范围无法满足这些前置条件。用户随后明确回复：**“允许清除旧内容，按最新模型重建生产”**。这条授权覆盖当前 33 篇旧文章及其内容依赖，替代本轮原先的非 Doc 内容保留要求；不建立历史转换或兼容读取。

切换清单须据此盘点全部旧内容及入向引用，并保护清理范围外的账号、社区配置及共享资源。放行仍依赖 R7、最新模型回归、清理演练和实际任务排空完成；不能绕过迁移校验。

## 生产克隆演练：旧内容清理（2026-11-12）

- Neon project：`summer-union-85679467`；实际生产 branch：`br-ancient-darkness-a1gy9enb`。
- 由实际生产分支创建演练 branch `br-bold-cherry-a12y4sv7`，名称 `docs-r8-rehearsal-20261112`；创建于 `2026-11-12T09:27:51Z`，parent LSN `0/5E335790`。
- [生产外键盘点](evidence/docs-r8-production-fks-20261112.json)记录 325 条 FK；[明确清理清单](../../ops/postgres/docs-r8-content-reset-plan.json)登记 108 个内容及依赖表、混合 Outbox / Receipt / Oban 的限定事件或命令。
- [清理工具](../../ops/postgres/docs-r8-content-reset.py)默认只读；执行模式必须提供目标 host、连接文件及 `--apply`，检查任务已排空、混合通知 / 审核归属，再在同一事务内清理。使用明确表集合，不使用 `TRUNCATE CASCADE`。
- [演练前计数](evidence/docs-r8-rehearsal-reset-before-20261112.json)与[清理结果](evidence/docs-r8-rehearsal-reset-20261112.json)：33 篇旧文章清除，剩余 Article 为 0，66 个受保护表的范围外数据指纹一致。仅重置账号 / 社区的内容派生计数；账号身份、配置、共享资源和 Inner ID 计数器保留。
- 两次演练尝试因 JSON 输出解析、空 meta 处理失败；事务内失败已回滚。修正后上述清理演练通过。
- **尚未完成克隆库最新 DDL 验证；生产尚未清理、迁移或部署。** 克隆分支不是最终切换前的新鲜生产备份。

后续盘点补入旧 Production Seed run / login 台账（仅内容种子及其临时登录凭据，不含账号身份）。[追加清理证据](evidence/docs-r8-rehearsal-ledger-reset-20261112.json)确认该两表清除、其余 64 个受保护表保持不变。最新 DDL 演练正在执行，尚无生产写入。

## 最新迁移与发布准备

- 克隆库先前的待迁移 DDL 通过，见 [首次迁移](evidence/docs-r8-rehearsal-migrations-20261112.json)及[补充迁移](evidence/docs-r8-rehearsal-migrations-final-20261112.json)，当时最终版本为 `20261112233000`。新增普通 Article 历史归属迁移 `20261112234000` 尚未在新鲜生产克隆库演练，旧指纹和旧镜像均不能用于最终切换。
- 当时的目标结构指纹：`bfc0fd859501b83f09d75331cd970a97d383cd8630c95d52c11cba879e37856e`。新增迁移后必须重新生成并核对最终指纹；这里的旧值不得用于切换。
- [生产基线](evidence/docs-r8-production-baseline-20261112.json)保存旧 Binding 标识和原 generation；[生产只读清理盘点](evidence/docs-r8-production-reset-before-20261112.json)确认当前 33 篇旧 Article。生产实际清理仍未执行。
- 旧后端候选镜像 `registry.fly.io/groupher-api:deployment-01M77KS0YQVC0XVNJZPBVTSA2M` 已构建上传但不含普通 Article 历史保留修正，已失效且尚未部署。Dash / Community 的当时生产 dry-run 构建通过。

## 批准的切换顺序（执行前清单）

以下是待执行步骤；成功证据必须在后文另记，不能从本清单推定完成。

1. 检查 Fly App 全部 Machine 和当前任务。停止旧实例的自动唤醒与自动重启，再停止实例；核对没有其他写入实例和活动数据库连接 / 任务。清理工具再次拒绝任何活动 Oban 任务。
2. 从实际生产 branch 创建切换前备份 branch，记录 parent LSN / 创建时间。演练分支不是新鲜备份。
3. 对生产连接运行 `docs-r8-content-reset.py` 的只读盘点，再显式 `--apply`。目标 host / database 必须匹配清单；事务内保护范围外表指纹，失败立即回滚，不扩大表集合。
4. 用 `MIX_ENV=test mix run --no-start scripts/docs_r8_migrate.exs` 对明确生产连接执行全部 DDL；`R8_APPROVED_SCHEMA_SHA256` 使用最新完整迁移演练的指纹，`R8_EXPECTED_GENERATION` 使用基线 generation。脚本只允许空 Article 聚合，完成结构核验后将原 generation 标记为新结构 ready。
5. 更新 Fly 的 `SHARED_COMMENTS_SCHEMA_SHA256` 部署环境，部署包含最终 R7 改动的新镜像；Release hook 必须成功、health 必须通过。恢复自动唤醒 / 重启，确认只有新实例写入。
6. 部署已构建的 Dash / Community Worker；使用默认浏览器现有登录态验证新建 D、保存、入队 / Q、审批 / 预览、Release、D 删除及再次编辑，检查公开详情 / 目录、权限、旧 URL 404。
7. 验证新的 Outbox 与 Press / CDN 投递。生产当前 `SEARCH_ARTIMENTS_ENABLED=false`；不得把数据库 Search 投影测试描述成实际外部 Search 投递通过。

失败处理：清理事务失败时保持原数据并修正明确原因；DDL 或新服务启动失败时维持停止写入，不用旧程序访问新表。需要回退时，从切换前备份分支恢复数据库目标及原 Schema 环境，恢复原镜像，再核验 health 和基线。不得通过反向 DDL 或兼容表掩盖失败，也不得恢复生产写入后悄悄覆盖新数据。
