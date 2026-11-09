# MentionsGraph 一次性切换运行手册

> 本文仅保留设计和历史结论。原始源码快照、测试日志与测量输出已从仓库移除；历史数字不作为当前发布验收证据。

> **当前边界（2026-11-07）：下文第 0–6 节只记录 2026-11-06 的 B4 切换及随后被放弃的同步 set 发布方案，不能用于本轮简化版上线。** 当前工作区合同见[当前关系合同](../../feature/article/mentions-graph-sync-contract.md)与[简化清单](../../feature/article/mentions-graph-simplification-plan.md)。本轮代码尚未部署。

## 本轮简化版发布前提（尚未执行）

1. 目标必须是全新空库。若沿用 B4 的目标环境，须先另建空数据库或在已批准的发布操作中清空该目标库；**不带入 B4 现有 Article、Comment、Ticket 或关系**。不迁移旧 current edges、不回填旧正文、不运行一次性重算、manifest 或 initializer。
2. 在空库执行完整数据库迁移，包括 `20261107100000_simplify_mention_current_edges`；该迁移会拒绝已有旧关系的库。检查 `cms.mention_endpoints`、`cms.mention_current_edges`、`cms.mentions_graph_state` 与新代码匹配，旧 set／current set／occurrence 表不在运行结构内。
3. 发布同一版本的 API、Worker 和前端，再用真实 Article、Doc main、Comment／回复与 Ticket 写入验证同事务关系；Doc 非 main branch 不产生关系。验证受限节点返回边、标题、URL、状态，资源页只拦正文，通知在受限来源延后并在符合条件时只投递一次。
4. 记录目标 PG17 的完整发布 p95、图读取 p95、首次成功率、全局 revision 锁等待及分页查询计划。此前 B2 短窗口数据不构成本轮容量资格。验收通过后才可宣称上线完成。

以下内容保留原始历史事实，不作为当前发布步骤。

> 状态：2026-11-06，用户已批准全新空库切换，旧 Article/Comment 不迁入。新库共享评论 bootstrap、全量迁移、MentionsGraph 空来源初始化均通过；Fly API 机器和 Community Worker 已切换并开放。数据驱动的内容页、tab 与正常写入验收仍待新内容建立。

2026-11-06 决定先记录 B2 首次读取成功率的未达标证据，推进 B4 流程验证；B2 独立性能复核仍为 `PARTIAL`，详见 [B2 性能记录](../../feature/article/mentions-graph-b2-performance-acceptance.md)。当前 API 服务镜像为 `registry.fly.io/groupher-api:deployment-01M6Q64D5HMFN8VW1ZDTNS40ZG@sha256:74520f7e1ef8c5adf7ee2b08e48c821781c24103f3094bc59db10e6d7bfe470c`。先前的临时机器验证对应上一镜像；本镜像额外修复 release 节点命名，并在实际服务机器上通过健康检查。

本手册用于按 [MentionsGraph 重构合同](../../feature/article/mentions-graph-refactor.md) 执行一次性切换。2026-11-06 用户批准舍弃旧库的 Article、Doc、Comment、Ticket、账户及其它业务数据，采用独立 Neon 分支中的全新空数据库 `groupher_mentions_graph_20261106`。新库从空表迁移，MentionsGraph 初始化的来源分母为 0；旧数据库 `groupher_prod_seed_20261104` 保留在原分支作为回退点。新旧应用不得在同一数据库上并行写入。

Auth client 登记和真实签发已单独完成，见 [纯鉴权验证记录](mentions-graph-maintenance-auth.md)。新库初始化四步均使用现场签发的短期 `cms:mentions:initialize` token。

## 0. 开始条件

开始窗口前必须具备：

- 经审核的目标应用、数据库名、Fly 组织/应用、当前镜像 digest 和目标新镜像 digest。
- 已验证可恢复的数据库快照及恢复演练记录。
- Auth 已注册 maintenance client；使用 `cms:mentions:initialize` scope 签发的短期 token 已安全注入运维 release 环境。token 不写入 manifest、请求 JSON、shell 参数、日志或证据包。
- 新 API/UI 构建、migration、受控 initializer 和此手册已在隔离环境跑完验收。
- 维护窗口、写入冻结公告、回退负责人和继续/中止负责人已登记。

任一项缺失，停止在开始条件，不执行迁移。

**已解决的数据库门禁：**旧库有 33 个 Article、5 个 Comment，且缺少 `public.shared_comments_generation`，不能原地迁移。经用户批准，新建独立分支 `br-ancient-darkness-a1gy9enb` 和空库 `groupher_mentions_graph_20261106`，在空库执行共享评论 bootstrap 后完成 PG17 全量迁移。共享评论 generation 为 `7f39fe0a-d3e9-4d4b-982a-edbdbe8a6c3f`，状态 `ready`，指纹为 `fbc51ba8c1750dfd6205d144c79ac6aa2e90af46563fe44a0b9e463d9cacb5ae`。剩余生产切换条件仍须逐项验收。

## 1. 生成切换前只读报告

从受控运维机通过现有 Fly release RPC 执行只读聚合报告。脚本核验实际连接数据库与 `MIGRATION_EXPECTED_DATABASE` 完全一致，事务设置为 `REPEATABLE READ, READ ONLY`，只把聚合 JSON 写到本机权限为 0600 的文件：

```sh
cd backend/api
node scripts/mentions_graph_target_report.mjs /tmp/mentions-graph-before.json
```

在输出文件中核对 `database` 与旧库 `groupher_prod_seed_20261104` 完全一致。记录来源计数、缺失正文数、旧 Mention/水位数、旧 worker 的 worker/state 计数以及旧 Outbox event/status 计数。共享 worker 的计数不可当作可整队清除授权。此报告用于旧库回退盘点；新库不迁入这些来源。

2026-11-06 已保存的目标只读报告记录 32 个普通 Article/Ticket、1 个 Doc、5 个 Comment 当前来源，缺正文 0；旧 Mention 27 行、水位 38 行。所列候选 worker 全为 `completed`，Mention Outbox 全为 `done`。这只是当时快照；正式窗口停机前后都须重跑，不能据此提前宣称 writer 已排空。

## 2. 冻结旧服务并保留回退点

新旧数据库分属不同 Neon 分支；旧 Mention job 和 Outbox 留在旧库，不迁移、不删除，也不会被新库 worker 领取。因此不以清空旧队列作为新库切换门禁。切换时仍须停止旧服务，避免旧镜像继续对外提供结果。

1. 记录旧服务镜像 digest、机器配置和旧 `DATABASE_URL` 到受控私有位置；不在仓库或日志中保存密码。暂停外部写入入口、部署外 cron 和旧维护任务。
2. 先 cordon 已登记的旧 Fly Machine，等待代理不再向它转发请求；随后停止机器，使旧 Web、Oban、Scheduler 实例全部退出。保留同一 machine、卷和配置，不能用缩容到零代替停止。当前 Fly 服务配置允许自动启动已停止机器，因此切换期间必须保持 cordon 并复核其状态：

   ```sh
   fly machine cordon 0807979ad30968 --app groupher-api
   fly machine stop 0807979ad30968 --app groupher-api
   fly machine list --app groupher-api --json > mentions-graph-machines-stopped.json
   ```

3. 核实旧服务机器为 stopped 且仍 cordoned；无其它旧镜像服务机器在运行。临时维护机器无 services，不能算作旧服务。
4. 停写后在旧 main 分支创建窗口快照，记录快照 ID、时间和旧库名；本次窗口快照 `snap-sweet-snow-a1j91nfa` 已创建。旧库及其旧队列保持原样供回退使用。

若旧服务重新启动，或无法确认旧库与新库隔离，停止切换。

## 3. 迁移并保持服务关闭

新库迁移已先于旧服务停机完成，因为它位于独立 Neon 分支，旧应用无法连接。使用无 services、无挂载、禁止 DNS 注册和自动重启的临时 Machine 运行新镜像；不直接部署到服务机器。空库 bootstrap 需要独立 generation，迁移进程通过标准输入取得新库连接和 MentionsGraph key，且设置：

```text
MENTIONS_GRAPH_CUTOVER_CONFIRMATION=drop-legacy-mentions:groupher_mentions_graph_20261106:writers-drained
```

此确认值仅用于通过 release 中含旧表删除版本的保护；全新库没有旧 writer 或旧 Mention 数据。`/app/bin/migrate` 已在新库成功完成：最高 migration `20261105234500`，共享评论 phase 为 `ready`，Article/Comment 均为 0，新 `cms.mentions_graph_state` 有 1 行，旧 `cms.artiment_mentions` 和 `cms.reference_map_revisions` 均不存在。迁移没有连接或修改旧库。

临时机器的创建命令使用经审核的镜像引用；`fly machine run` 返回的新 ID 必须与 `fly machine list --json` 中无 services、无 mounts、无 DNS 注册、restart 为 `no` 的配置一致。下面是本次验证使用的原始镜像；最终服务镜像在修复节点命名后重新构建。迁移通过 SSH 的标准输入注入目标连接和密钥，不把秘密写入命令参数：

```sh
fly machine run registry.fly.io/groupher-api:deployment-01M6Q486M39HMBV6HQCZD1PKQP 3600 \
  --app groupher-api --region sin --entrypoint /bin/sleep --restart no \
  --skip-dns-registration --vm-memory 1024 --name mentions-b4-fresh-db-bootstrap --detach
fly machine list --app groupher-api --json > mentions-graph-maintenance-machine.json
```

本次临时 Machine ID 为 `48ee242fe32908`，已销毁。若临时机器超时停止，核对连接和迁移状态后新建无服务机器，不能把旧应用机器作为运维进程启动。清理临时机器前下载全部 manifest 和运行证据。新库验收记录和完整初始化 manifest已保存。

## 4. 初始化当前正文

用新镜像启动不对外提供服务的临时 release process，注入同一目标 `DATABASE_URL`、已核验 `MIGRATION_EXPECTED_DATABASE` 和 maintenance token。镜像须包含 `/app/bin/mentions_initialize`；它用独立 `eval` 和临时 Repo 执行，不依赖正在服务的 BEAM 节点，也不启动 API/Oban。manifest 在临时进程磁盘上生成后下载到受控运维机审阅和留存；命令请求只包含固定 operation 与文件路径：

```json
{"command":"report","manifest":"/tmp/mentions-graph/manifest.json"}
{"command":"preflight","manifest":"/tmp/mentions-graph/manifest.json"}
{"command":"apply","manifest":"/tmp/mentions-graph/manifest.json"}
```

按顺序执行 `report`、人工核对 manifest 的来源分母与分类型数量、`preflight`、`apply`。断点续跑只使用已审阅且 page hash 完整的 manifest；source token/hash 变化时重新生成 report，不手改页或缩小分母。应用完成后再执行 `preflight`，确认全部来源已追平、没有错误页。

受控运维机使用 `node backend/api/scripts/mentions_graph_remote_initialize.mjs <temporary-machine-id> report|preflight|apply <private-local-dir> groupher_mentions_graph_20261106` 逐步传递文件并签发短期 token。设置 `CMS_MENTIONS_DATABASE_URL_FILE` 和 `CMS_MENTIONS_GRAPH_KEY_FILE` 指向受控本地 0600 文件，脚本只通过 SSH 标准输入传递其内容。`report` 使用全新本地目录；每步核对 manifest、page hash 和退出码，`apply` 前保留人工审核记录。

**隔离演练证据（2026-11-06）。** 本机独立 SSL PostgreSQL 14 临时库先迁到 `20261105100000`，保留旧 Mention 表；新 production release 在缺少 `MENTIONS_GRAPH_CUTOVER_CONFIRMATION` 时拒绝 DDL，传入精确值后完成迁移并建立 `cms.mentions_graph_state`，旧 `artiment_mentions`/`reference_map_revisions` 均消失。真实 Auth initialize token 通过独立 release 执行 `report → preflight → apply → preflight`，空来源 manifest 完成。可重复的本地脚本为 `local rehearsal`（历史文件，已删除），结果摘要记录日志路径和 SHA。此演练验证命令通路与删表保护；新 Neon PG17 空库的实际迁移与初始化证据另见第 3、4 节。

**目标数据库回退。** 新旧 `DATABASE_URL` 指向独立 Neon 分支中的不同数据库；Fly `groupher_data` 卷快照不是数据库快照。2026-11-06 已从旧 `groupher-demo` main 创建演练快照并恢复到独立分支；只读对照确认库名、33 个 Article、5 个 Comment、27 条旧 Mention 和迁移版本一致。旧服务停止后创建的窗口快照为 `snap-sweet-snow-a1j91nfa`，时间 `2026-11-06T00:59:17Z`。旧库及旧队列至今未修改；若旧库状态有疑义再从窗口快照恢复。[Neon 分支恢复文档](https://neon.com/docs/postgres/backup-restore/branch-restore)是操作依据。

## 5. 验收、开放和回退

- 新库业务内容、账户、旧队列和旧通知均为空，这是用户批准的全新空库结果；旧库和窗口快照保留供回退，不对新库复制历史行。
- 初始化 manifest 的来源分母为 0，`complete: true`；后续建立新内容后仍须运行 Query/公开状态、隐藏/删除占位、分页、revision fence、tab 和正常写入验收，不能用零来源通过代替这些用例。
- 保存镜像 digest、数据库名、migration 版本、manifest/page hashes、各类来源数、错误数、查询 SQL/延迟证据、停机/任务清单与所有命令退出码。
- 已将原服务机器 `0807979ad30968` 更新到修正版镜像，保留同一卷与 service，启动后健康检查 passing；release RPC 核对连接库为 `groupher_mentions_graph_20261106`。公网 `/health` 和 GraphQL `__typename`、MentionsGraph 字段内省成功。Community Worker 已部署版本 `318a9ab6-5a3b-4de4-9e8f-3a276437b71b`，新 MentionsGraph 资源可访问。完整状态见目标切换记录。
- Fly `secrets list` 仍将六项新值显示为 `Staged`；新建的临时机器曾用这些值通过 release 迁移门禁，当前服务机器也经 RPC 证实连接新库。下次发布前仍须核对实际 machine 的 secret 版本与 `fly.toml`，不能仅凭 `secrets list` 状态推断运行时旧值。旧/新连接和 graph key 的受控副本存放在仓库外的私有目录，文件权限为 0600，值不写入证据。
- 若需回退，先 cordon 并停止新服务机器，再将 `DATABASE_URL`、`MIGRATION_EXPECTED_DATABASE`、旧镜像恢复为受控保存的原值；启动并核验旧库身份后解除 cordon。旧数据库和旧队列未被修改。若旧库状态有疑义，按窗口快照 `snap-sweet-snow-a1j91nfa` 恢复，不让旧代码连接新库。新库开放后产生的新写入不会自动转回旧库，回退前须记录并决定处理方式。

任何尚未实跑或无法从目标环境复核的条目都标记为未完成；不得用隔离测试库、空报告或操作员口头确认代替目标环境证据。

## 6. 同步关系版本的后续发布（尚未执行）

本节是 2026-11-06 原 B4 空库切换**之后**的另一次发布，不改写第 0–5 节历史记录。目前本地工作区已完成同步关系实现与空库迁移验证；Fly API、Neon 目标库和 Community Worker **尚未发布此版本**。执行前以[同步实现合同](../../feature/article/mentions-graph-sync-contract.md)和新镜像 digest 审核完整差异。

**发布前只读观测（2026-11-06 08:42 UTC）：**目标分支 `br-ancient-darkness-a1gy9enb` 的 `groupher_mentions_graph_20261106` 已有 33 Article（Post 29，Blog/Changelog/Doc/Ticket 各 1）、4 Comment、37 条旧水位、43 个 set、27 条当前边；最高 migration 仍为 `20261105234500`。`mention.set_project` 44 条均为 `completed`，未完成事件和 desired/synced 差异均为 0。另外两条 `dead` Outbox 分别为 `article.cdn_purge` 和 `comment.changed`，不属于投影迁移门禁，仍需在相应作业恢复流程中单独处理。这是发布前的一次快照，不代表之后仍排空；正式停写后必须重跑第 2 步。原第 0–5 节的空来源记录是切换当时的事实，不再是当前目标数据分母。

**隔离迁移演练（2026-11-06 09:05 UTC）：**在目标分支的子分支 `br-young-truth-a1cgre8h` 上执行本轮迁移；新版本 `20261106100000` 已登记，旧水位表消失，37 个 current set 和 27 条边保持不变，当前 set 无孤儿记录，主键及两个外键名称已核对。来源分支仍停留在旧 migration，未出现新表。具体计数见演练证据。这证明当前目标数据快照可通过结构迁移，不代替正式停写、快照及发布后的行为验收。演练子分支已删除，并从后续分支列表确认消失。

**本轮只读复核（2026-11-06 13:51 UTC）：**Neon 项目 `groupher-demo` 的目标分支 `br-ancient-darkness-a1gy9enb`、数据库 `groupher_mentions_graph_20261106` 仍为 PG 17.11，最高迁移 `20261105234500`；33 Article、43 set、27 当前边，旧 desired/synced 差异为 0，未完成投影事件为 0。27 条边只来自 6 个来源，最大出度 22，来源出度 p95 约 16.75；这不是 B2 大图的代表分布。`mention.set_project` 共 44 条，全部 `completed`；另有 `article.cdn_purge` 和 `comment.changed` 各一条 `dead`，未重放。只读复核没有冻结 writer、没有创建快照，也没有改变目标库；正式发布前必须在停写后重新运行下列预检。

1. 冻结所有旧 API writer 和 Oban 消费者，记录目标数据库名、迁移版本、旧镜像、可恢复快照；核对已提交内容与目标库是否仍匹配。新旧程序不能同时写同一 `mention_sync_states`/`mention_current_sets` 结构。
2. 在旧版本下核对并处理 `mention.set_project`：

   ```sql
   SELECT status, count(*) FROM cms.outbox_events
   WHERE event = 'mention.set_project' GROUP BY status ORDER BY status;
   SELECT count(*) AS unsynced_sources FROM cms.mention_sync_states
   WHERE desired_set_id IS DISTINCT FROM synced_set_id
      OR desired_content_token IS DISTINCT FROM synced_content_token;
   ```

   `mention.set_project` 的 `pending/executing/failed/dead` 等非 `completed` 事件须按旧版本重放，或逐条核对通知与当前关系后形成处理记录；不能仅因水位相同就清空或批量标为完成。迁移本身会拒绝任何未完成的旧投影事件及水位不一致状态。当前观测到的两条其它类型 `dead` 事件尚未重放，须单独处置，但不能误写成旧投影队列未排空。通知 Outbox 不删除。

3. 在旧 writer 全部停止且上述查询为零后，对目标库快照，在隔离的 release 进程中运行 `20261106100000_replace_mention_projection_state_with_current_set`，核对新表主键、组合 FK、来源数、当前边数及 Outbox 状态。新 worker 只处理 `mention.notify`，不能让旧 projector 在新表上运行。
4. 以同一镜像运行 `report -> preflight -> apply -> preflight`。当前 parser version 为 4；现有来源当前 set 为 v1/v2/v3 时，即使正文 token 相同，也必须新建并选中 v4，预期首次为 `applied`，再次运行才是 `unchanged`。核对各类来源数、各版本分母和当前边变化，尤其 text 裸 URL/raw HTML 不再产生 occurrence、普通结构化链接不再沿用隐藏目标、`@ Article` 在目标隐藏后仍保留稳定关系，以及回复 Comment 已更新 current set；任何版本/hash 漂移须重新生成 manifest。启动新 API 前核对下面查询为 0，不能以迁移完成代替解析版本追平。重建抽样验证边可从当前 set 恢复且不发通知。

   ```sql
   SELECT count(*) AS old_parser_current_sources
   FROM cms.mention_current_sets AS selection
   JOIN cms.mention_sets AS facts ON facts.id = selection.set_id
   WHERE facts.parser_version <> 4;
   ```

5. 部署 API 与 Community Worker，验证真实 Article/Doc/Comment/Ticket 新建和改版、用户通知、审核及隐藏后的脱敏、图/列表/评论入口的 opaque revision、旧 cursor 与前端切回缓存。保存 SQL 预算、首次成功率、写入 p95/p99、锁等待及数据库容量。B2 目标 PG17 三轮资格未通过前只记录实测，不把本地 40 次 writer 样本当作生产容量验收。
6. 回退时先停止新 writer 和 worker。**不能**直接让旧镜像读取已经迁成 `mention_current_sets` 的库；必须按已验证的回退迁移或快照恢复旧 schema 与队列，再启动旧镜像。发布后新写入与通知必须先清点，不能静默丢弃。

### 本轮发布审查状态（2026-11-06）

- 工作区代码和文档尚未提交，也没有为同步关系版本构建、登记新镜像 digest；目标库和服务仍运行旧版本。
- 严格编译、文档边界门禁、Publisher 的结构化 mention JSON 用例、前端图缓存用例及 FrontDesk 批量用例通过。全量后端套件 2750/2751 通过、1 excluded；唯一失败是 Press 多页站点清单测试，它在 `mix test --failed` 和整个 Press 测试文件中复跑通过。保留全量并发失败记录，不写成全绿。
- 本地隔离 PostgreSQL 14 的 40 次完整 Article 发布全部成功，writer p95 160.333ms；同时读图首次成功 2915/3056（95.39%）。测量摘要是诊断，不代表目标 PG17 资格。
- 产品编辑器还没有接 Article 搜索选项；后端接受结构化 `@ Article` key 的能力已验收，但真实界面选择流程尚未验收。用户已选择 4 reader、2 writer、每 writer 间隔 500ms 作为下一轮候选诊断负载；它不是目标流量。B2 目标到达率、代表性图、纯锁等待阈值和生产资格也未签收。这些缺口在正式发布审查时须逐项决定，不得由旧 B4 空库切换记录替代。

**本次 Command/Parser/Persist 收尾复核（2026-11-06 23:43 本地）：**当前工作区 parser version 已为 4；回复 Comment 创建现与顶层创建同样在所属 Command 事务更新关系。定向关系/图页/评论/Ticket 199/199、GraphQL/恢复等补充 88/88、来源隐藏后的 User 通知 1/1 通过，`mix compile --warnings-as-errors` 通过。本地隔离 PostgreSQL 14 的完整发布诊断为 writer 40/40、p95 173.119ms，reader 首次成功 3732/3868（96.48%）。这些结果不替代停写后迁移预检、当前正文 v4 全量初始化、目标 PG17 三轮 B2 资格或生产发布验收。正式发布前应重新核对本节的证据、镜像和目标状态。

**全量后端回归补记（2026-11-07 00:03 本地）：**`mix test --max-failures 5` 为 2750/2753 通过、1 excluded、3 失败。其一是仍断言普通 URL 在目标 Trash 后沿用内部边的旧测试，已改为本轮允许的稳定 `@ Article` 用例并单独复跑通过；其余两个是 Press/Assets 各构造 101 篇文章时在社区计数的 PostgreSQL 查询处达到 60 秒测试超时。随后两个用例分别以原 60 秒上限独立复跑，9.3 秒和 11.1 秒通过；Press 曾在另一次隔离复跑中达到 180 秒，说明本地数据库等待有明显波动，尚无足够证据将其归因于 Mentions 写入。全量原始记录在本机 `/tmp/mentions-full-suite-20261106.log`，不能把这轮全量写成全绿；三个失败的最终用例均已单独通过。
