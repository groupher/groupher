# 生产环境全新 Schema 与 Seed 验收手册

> 状态：BLOCKED，执行前交付物尚未齐备；尚未执行。用户于 2026-11-04 明确生产环境没有实际用户、历史数据和旧逻辑无需兼容；该决定须与执行前盘点一起登记在执行单。本手册评审通过不等于具备开跑条件，也不代表已执行生产验收。

## 1. 目标与执行边界

以同一个待发布 revision，在真实生产数据库服务上建立空库、执行完整 migration，连接正式 API、Cloudflare Workers、认证、CDN 和 AI 服务，再用固定 seed 数据完成真实请求和浏览器验收。

覆盖 Reference Map、ReviewBot / AlertWall V2、Review visibility、ArticleLifecycle / Comment 社区解耦及 Ticket V2 的相关公开链路。不做历史数据转换、旧字段映射、旧协议兼容、双读双写或旧 URL 回退。本轮不包含容量压测，也不能用一组 seed 证明所有并发行为。

默认采用**同一生产数据库服务中的新空库**。不默认销毁旧库；旧库不接入新应用，不迁移旧业务数据。新库可保留到验收结束并直接作为正式库使用。若数据库服务只允许原库重建，执行前必须在执行单明确替换策略、被销毁的库名和授权记录，不能临时把本手册改成 `drop database`。

关联合同：

- [部署拓扑](../README.md)
- [Reference Map](../../feature/article/reference-map.md)
- [ArticleLifecycle / Comment 解耦](../../feature/article/article-lifecycle-comment-decoupling.md)
- [Review 可见性规则](../../feature/alert-wall/review-visibility-fix.md)
- [ReviewBot / AlertWall V2](../../feature/alert-wall/v2.md)
- [Ticket 验收清单](../../feature/tickets/inventory.md)

P0 本地实现入口与准确调用参数见 [Production Seed P0 操作入口](./production-seed-p0.md)。其实现不代表本文生产前置条件全部满足；环境、容器镜像、受限/故障场景与生产证据仍逐项核对。

## 2. 执行前必须补齐的入口

本节是实际开跑的前置条件；未完成时状态为 BLOCKED，不能用手工改表补过验收。

| 项目                   | 当前依据                                                                                                                                                                                       | 执行前交付物 / 出口                                                                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 正式 migration         | `backend/api/fly.toml` 已配置 `/app/bin/migrate`；release 调用 `GroupherServer.Release.migrate/0`                                                                                              | 固定 release image/revision；完整空库 migration 本地通过；镜像中包含所有 migration                                                                                             |
| Seed 执行入口          | 已交付 `CMS.ProductionSeed.CLI` 与 `/app/bin/production_seed`，调用 release RPC；旧 `seed_full_community_prod.sh` 仍依赖 Mix，不能替代本入口。Factory 位于 lib/support，不是旧脚本不可用的原因 | 交付 release 兼容入口、精确调用命令、参数/输出/退出码及 §4.2 环境清单；在相同 prod 镜像本地验证；不得直接复用 seed shell                                                       |
| 社区命名空间           | 本方案要求保留 `dev` / `mock` / `tmp`；NameRules 已纳入三者；受控 bootstrap 已有本地实现                                                                                                       | P0 交付静态保留规则及仅限这三个名称的受控 seed 初始化入口；普通注册/改名 fail closed；验证 tmp 删除后名称不释放、新实体可重建且 ID 更新；详见 §5                               |
| 测试身份与正式 session | 固定用户及 Auth 一次性兑换已本地实现，使用正式 Phoenix session/Auth.js Cookie；不建立 GitHub OAuth identity                                                                                    | Phoenix 负责固定账号/持久 session，Auth 负责一次性兑换、Auth.js Session 与两类正式 Cookie；交付准确命令、失败补偿、P7 路由移除和专用密钥销毁方案；见 §5.1；不得使用 test-login |
| Seed 清理              | runId report/apply/verify 已本地实现，显式选择 retain/purge；purge 保留已撤回的不可变 Ticket 身份与历史；不能复用会删除共享 Article 的旧脚本                                                   | 独立交付 runId 清理 report、apply、verify 命令；含账号/session/OAuth identity、资产和外部派生数据边界，支持幂等与中断续跑；见 §10                                              |
| 验收数据               | 固定基础内容、六类节点引用及分页数据已有本地 seed；受限状态、审核 policy/hold 和真实故障仍须按验收用例准备                                                                                     | 实现第 5 节数据集；输出 manifest、预期结果和可登录账号引用；重复执行不能复制内容                                                                                               |
| 无 UI 操作             | 已实现 ledger 所属 tmp 的物理删除与受控重建；部分故障注入仍未交付                                                                                                                              | 交付有明确目标 ID 校验的运维入口、执行命令、前后查询与恢复步骤；仅允许 manifest 标记的 disposable 资源                                                                         |
| 监控 / 持久化          | Map runtime 强制要求密钥与失败清单路径；当前 Fly 配置未列出该清单的 volume mount                                                                                                               | 配置可写持久存储；固定真实告警接收方；给出巡检 Job、AI/Outbox 日志位置及任务重试入口                                                                                           |
| 后台常驻               | 当前 Fly app 可自动 stop 且最低运行数为 0；无流量时进程内 Oban Cron 无法保证运行                                                                                                               | 交付并启用至少一台运行 Oban 的常驻 API machine，或独立常驻 worker process；记录部署配置、machine/process ID、启动和恢复方法；验收后仍须满足后台任务持续运行条件                |
| 数据库消费者           | API、Press/Hyperdrive 等直接访问数据库；Auth 的身份/session 持久化委托 Phoenix                                                                                                                 | 列出所有实际直接/间接消费者及版本；直连者交付自身连接取证命令，Auth 等委托者交付上游配置与真实请求证据；见 §4.1                                                                |

专用 seed 建议使用 release 能加载的模块，或通过正式 GraphQL/内容发布入口构造。基础账号/权限可由受控 bootstrap 建立；正文、发布、举报、审核、互动必须使用领域命令或正式 API 产生。不得直接插入审核 block、Map 边和 revision 来冒充真实链路通过。

### 2.1 P0 评审交付清单

以下是待实现能力的交付要求，不是现有功能说明。每项必须登记实现 SHA、负责人、准确命令、退出码及证据路径；不得仅以本文描述代替交付。文档评审通过不授权开放生产登录能力；实际开放须符合执行单登记的范围与窗口。

| 交付项            | 必须实际执行并保存的证据                                                                                                                             | 拒绝进入 P1 的条件                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Auth 完整登录兑换 | Auth 路由/开关和运维凭据命令；正式双 Cookie 与 Auth.js Session；刷新/登出；重复、过期、撤销和非登记凭据拒绝；Phoenix 或 Auth.js 任一步失败的补偿结果 | 只有 Phoenix Cookie、签发归属不清、缺少任一失败补偿证据                         |
| 三个保留名称      | 静态保留规则的实现位置；普通注册和改名分别拒绝 dev/mock/tmp；受控初始化与重复执行；tmp 删除后名称仍不可公开占用、重建 ID 更新                        | 名称未保留、公共接口可绕过、删除释放保留名称或初始化接受任意 reserved slug      |
| P7 可移除性       | 兑换实际路径、签发 HTTP 路径（如有）、开关/secret/binding 清单、旧部署处置方法、移除发布步骤和负责人；提供本地关闭演练结果                           | 只有撤销 session/凭据而没有路由与签发入口移除方案，或无法排除旧部署继续提供入口 |
| 长期证据库        | 受控共享地址、权限/保留期限；准确上传与独立下载命令；以脱敏样本演练文件清单与校验值比对                                                              | 只有本机目录、没有可执行归档命令或下载核验失败                                  |

P0 填齐后才允许执行生产阶段；P7 仍须对实际生产收口版本复验，不能以本地演练替代最终关闭证据。

## 3. 执行单与证据目录

每次执行先填写，禁止带未填项进入 P1：

| 字段                       | 必填内容                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Run ID / UTC 时间 / 操作者 | 唯一 Run ID；文件记录 UTC；执行窗口对用户展示可使用北京时间                                                                                    |
| 无实际用户的确认           | 确认人、确认时间、用户声明来源、本次数据库账号/内容盘点与审计证据位置；区分测试/系统账号；不能仅以数量证明无实际用户；若与声明冲突则停止并核实 |
| 授权范围                   | 新库创建与连接切换；seed 写入；tmp 等 disposable 资源物理删除；故障注入范围；旧库是否保留                                                      |
| Revision                   | 仓库 SHA、API image、Community / Dash / Auth / Press / Review AI 等实际部署版本                                                                |
| 数据库                     | 服务实例 ID、旧库名、新库名、host、端口、角色；不记录密码或完整连接串                                                                          |
| 数据库切换方法             | 服务控制台/CLI 的准确操作及每个消费者的更新步骤；执行前填写服务专用命令                                                                        |
| Worker / 存储              | Fly app/machine、Cloudflare deployment IDs、manifest mount/path、告警接收位置                                                                  |
| Seed 与操作入口            | seed、正式 session 签发/兑换/撤销、清理 report/apply/verify、物理删除、故障注入、恢复的精确命令与 SHA；未实现项标 BLOCKED                      |
| 常驻运行                   | 常驻方案、machine/process ID、Oban 执行节点、无流量观察起止时间、重启恢复证据及验收后持续运行安排                                              |
| 配置清单                   | §4.2 每项是否必需、配置来源/密钥引用、验证结果；不填密钥明文                                                                                   |
| 时限                       | 普通请求时限、AI 重试上限与总期限、Outbox 收敛期限、CDN 刷新期限；开跑前固定                                                                   |
| 结束策略                   | 保留演示内容或清理本次 seed；失败时维护状态和向前修复负责人；Auth 兑换功能禁用、移除发布版本、专用凭据材料销毁及复核命令                       |
| 临时登录能力负责人         | Auth 兑换/双 Cookie 负责人、Phoenix 账号/session 负责人、P0 评审人、P7 移除责任人；开放窗口及关闭时限                                          |
| 长期证据库                 | 受控共享存储地址、归档负责人、访问权限、保留期限、上传/校验/下载命令；P7 填写实际归档地址与可读性验证记录；未确定时 BLOCKED                    |

本地执行终端初始化（以下只创建临时采集目录，不是长期审计证据库）：

```bash
set -euo pipefail
export RUN_ID="prod-seed-$(date -u +%Y%m%dT%H%M%SZ)"
export EVIDENCE_DIR="$HOME/.codex/production-acceptance/$RUN_ID"
mkdir -p "$EVIDENCE_DIR"
git rev-parse HEAD > "$EVIDENCE_DIR/revision.txt"
git status --short > "$EVIDENCE_DIR/worktree.txt"
```

执行单必须先指定受控共享证据库。本地目录用于采集；P7 将脱敏后的 manifest、执行结果、日志、截图、版本清单和文件校验清单上传归档，使用独立读取操作核对文件数量、校验值和访问权限，记录最终共享地址及保留期限。上传/下载命令随所选存储在 P0 交付，不以本机路径关闭审计项。归档失败时本地保留并记 BLOCKED，不能宣布完成。

发布版本须已提交并可重建。证据不提交账号密码、Cookie、token、数据库 URL、正文或私有标题；截图脱敏。浏览器截图若落仓库，统一放 `.playwright/`。

每个用例保留：ID、开始/结束时间、actor、资源别名、请求 operation/变量、commandId（写请求）、HTTP 状态、GraphQL `data/errors`、预期/实际、日志/截图位置。HTTP 200 不等于 GraphQL 业务成功；公开 DTO 不得泄漏内部资源 ID。

## 4. 初始化与发布步骤

| 阶段                | 操作                                                                                                                             | 必须取得的出口证据                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| P0 固定版本及入口   | 完成本地门禁并逐项交付 §2，特别是保留社区、seed、正式 session、清理三阶段和故障入口；填齐执行单                                  | 同一 SHA 全绿；所有入口有准确命令和本地验证；缺一项仍为 BLOCKED；Ticket 历史记录不能替代本次结果                                |
| P1 暂停旧写入       | 暂停公共写入与旧后台 writer；停止会触发数据库自动重连的旧实例；记录 Oban/Outbox 和外部定时任务状态；登记新版本后台常驻方案       | 不存在旧版本向新库写入的路径；常驻配置已准备；未完成时禁止切 URL                                                                |
| P2 创建新库         | 在实际生产数据库服务创建空库；由服务管理员配置 migration/runtime 角色、扩展权限与连接授权                                        | 新库身份确认、业务表为空；新建库不代表拥有所需扩展/DDL 权限                                                                     |
| P3 配置依赖         | 给所有消费者指向新库；设置密钥、挂载与告警；保持公共写入口受控                                                                   | 每个消费者的数据库身份可核对；旧凭据/session 不作为 seed 登录依据                                                               |
| P4 迁移并部署       | 发布固定 API image，由 Fly release command 跑 migration；成功后部署同版前端与相关 Worker                                         | release migration 成功日志；版本一致；健康检查通过；重启后仍连新库                                                              |
| P5 Bootstrap / Seed | 按 §4.2 复核 prod 环境，使用 §2 已交付的 release 精确命令创建 dev/mock/tmp、固定用户并签发正式 session，再生成内容；重跑验证幂等 | manifest 完整、角色会话可用、无重复资源；正常 writer/Worker 启用；常驻实例和 Oban 实际运行证据已记录                            |
| P6 验收             | 依次执行第 6–9 节；每项记 PASS / FAIL / BLOCKED                                                                                  | 无跳过项冒充通过；后台任务最终状态可解释                                                                                        |
| P7 收口             | 执行清理/保留、§5.1 临时登录能力移除及共享证据归档；发布不含兑换路由的 Auth 收口版本；填写第 11 节                               | 旧 session/凭据均不可用；所有实例路由最终 404；专用密钥已销毁；共享证据可读且校验一致；记录收口版本并复验正常服务后更新生产状态 |

Fly migration 已由部署自动执行。需要在**同一新版本镜像、已确认连接新库**的运维 shell 内重试时，现有命令为：

```sh
/app/bin/migrate
```

它不创建数据库；须先完成 P2。不得把本地 `fresh_db_migrations.sh` 用作生产初始化：该脚本固定 dev 并在退出时 drop 临时库。不得在生产 release 中执行 `mix ecto.reset`、`MIX_ENV=test` 或依赖 Mix 的 seed shell。

P3/P5 按 §4.2 检查完整清单。额外必查：`REFERENCE_MAP_KEY` 至少 32 字节，`REFERENCE_MAP_KEY_VERSION` 为正整数，所有实例取同一版本；`MENTION_REBUILD_FAILURE_MANIFEST` 是持久存储绝对路径，运行用户可写；多实例恢复命令必须访问实际持有失败清单的持久盘，不能误读另一实例的空文件。挂载重启后核对文件仍在。

生产数据库服务专用的新库创建、URL/Hyperdrive 更新和发布操作以执行单中核实的命令为准。本文不虚构供应商命令；未填齐即停在 P0。

### 4.1 数据库身份与 schema 核对

在执行单登记的数据库会话中运行；确认会话不是旧库：

```sql
SELECT current_database(), current_user, inet_server_addr(), inet_server_port();
SHOW server_version;
SHOW timezone;
SELECT version FROM public.schema_migrations ORDER BY version;
SELECT table_name, column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'cms'
  AND table_name IN ('article_lifecycles', 'comments')
ORDER BY table_name, ordinal_position;
SELECT conrelid::regclass AS relation, conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE connamespace = 'cms'::regnamespace
ORDER BY conrelid::regclass::text, conname;
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'cms'
  AND tablename IN ('article_lifecycles', 'comments', 'comment_review_blocks');
```

在固定 SHA checkout 上列预期 migration（与数据库输出逐条比较，不只比最大版本）：

```bash
python3 - <<'PY'
from pathlib import Path
for path in sorted(Path('backend/api/priv/repo/migrations').glob('*.exs')):
    print(path.name.split('_', 1)[0])
PY
```

出口：无缺失/多余版本；`article_lifecycles.article_id` 非空且唯一；该表无 `community_id`；`comments` 无 `origin_community_id`/`community_id`。保存旧 FK/CHECK 已移除及 Doc branch 替代约束存在的证据。应用连接 session timezone 必须 UTC；管理员 SQL 会话的 `SHOW timezone` 不能代替应用会话证据。由各实际直连消费者自己的连接输出脱敏身份，不能只核对管理员连接。

在每台运行 Repo 的 API / 独立 worker machine 的 shell 执行以下现有 release RPC（仅查询，不输出连接串）：

```sh
/app/bin/groupher_server rpc 'r = GroupherServer.Repo.query!("SELECT current_database(), current_user, inet_server_addr(), inet_server_port(), current_setting($1)", ["TimeZone"]); IO.inspect(r.rows)'
/app/bin/groupher_server rpc 'IO.inspect(%{report_threshold: Application.fetch_env!(:groupher_server, :cms_review_report_threshold)})'
```

逐实例核对目标库/角色/服务器身份，时区须为 UTC；记录 machine ID 和 image SHA，不能把一次 RPC 当作所有实例的证据。迁移角色与运行角色可不同，但均须登记预期值。

| 消费者类型                              | 取证方法与 P0 交付要求                                                                                                                                |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| API / Elixir worker                     | 使用上述现有 RPC，从自身 Repo 连接查询；保存输出                                                                                                      |
| Press / 其他直连 Worker                 | P0 交付在该部署自身连接上执行同等 SQL 的受控命令及调用示例；含 Hyperdrive 配置 ID 与部署 ID，不输出 URL/密码；尚无命令时 BLOCKED，不能以 API RPC 代替 |
| Auth / Community / Dash 等经 API 委托者 | 无独立数据库连接的服务不伪造 SQL 证据；记录其实际上游配置及一次正式请求关联 ID，关联到已取证的 Phoenix 实例/部署；浏览器同源 facade 也须验证          |

### 4.2 Prod 环境与常驻检查

以下是专用 seed 在正式 release 上运行的环境合同；不是对现有 seed shell 已支持能力的声明。入口继承该 release 的正式配置，不注入脚本中 for-test-only 值。所有密钥只记录 secret 引用与验证结果。

| 配置                                                                       | 必需性 / 检查                                                                                                     |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                             | 必需；实际 Repo 取证必须指向登记的新库；角色可连接并具有所需运行权限                                              |
| `SECRET_KEY_BASE`、`PHX_JWT_SECRET`                                        | 正式认证必需；使用正式密钥；签发/刷新/撤销正式 session 的调用成功                                                 |
| API `PRODUCTION_SEED_ENABLED`                                              | 默认禁用；窗口内明确设为 `true` 并使运行中的 API 生效；shell 的变量不会自动传给 RPC 目标；P7 关闭                 |
| Auth `PRODUCTION_SEED_LOGIN_ENABLED`、`PRODUCTION_SEED_LOGIN_UNTIL`        | 默认禁用；前者须为 `true`，后者须为未来的明确 UTC ISO 截止时间；同时满足才接受兑换，P7 禁用并移除                 |
| Auth `NEXTAUTH_SECRET`、Cookie secure/domain 与 `PHOENIX_GRAPHQL_ENDPOINT` | 复用正式 Auth 配置，双 Cookie、跨子域、刷新/登出均须验证；不使用临时 Auth.js 主签名密钥冒充正式 session           |
| `PAGINATION_CURSOR_CURRENT_KEY`、`PAGINATION_CURSOR_CURRENT_VERSION`       | key 为 prod/seed_prod 强制项；版本默认 1，须为正整数；多实例一致并通过实际分页读取                                |
| `PAGINATION_CURSOR_PREVIOUS_KEYS`                                          | 可选轮换配置；新库无需历史 key；设置时须合法 JSON 且不包含当前版本                                                |
| `REFERENCE_MAP_KEY`、`REFERENCE_MAP_KEY_VERSION`                           | key 必需且至少 32 字节；版本为正整数，默认 1；多实例一致                                                          |
| `MENTION_REBUILD_FAILURE_MANIFEST`                                         | 必需绝对路径；挂载持久盘、可写、重启后存在；登记持盘实例                                                          |
| `VIEW_TRACKER_PEPPER`                                                      | prod/seed_prod 强制项；正式值，不采用 seed shell 固定值                                                           |
| `VIEW_TRACKER_COOKIE_SECRET`、`VIEW_TRACKER_COOKIE_PREVIOUS_SECRET`        | 当前 secret 可默认使用 SECRET_KEY_BASE；previous 可选；按正式轮换配置验证                                         |
| `PHX_HOST`、`PORT`、`DB_POOL_SIZE`、`DNS_CLUSTER_QUERY`                    | 核对正式域名、监听/连接池及集群配置；值和默认值以固定 SHA 为准                                                    |
| `SERVICE_AUTH_*` 与 Auth 的服务签名配置                                    | 逐服务登记 issuer/JWKS/token endpoint、所需 client 配置和密钥引用；真实服务请求可认证；不能启用 test service auth |
| AI / Review profile 与 Worker binding                                      | 按固定 SHA 的 AI 配置提供 profile、provider 凭据和线上 Worker binding；真实调用通过；不得把伪造回调记为真实 AI    |
| 搜索/资产/Press/CDN 等已启用服务                                           | 逐服务列出其部署配置和 secret 引用；例如已启用 Algolia 时登记 ALGOLIA_* 与 index；真实派生写入/删除可观察         |

`OAUTH_GITHUB_*` 不作为本轮固定账号登录的前提；如果正式站点继续开放 GitHub OAuth，独立保留该服务需要的配置，不把本轮验收解释为 OAuth 回归。P0 必须从固定 SHA 的 runtime、各服务配置和 secret 清单补齐实际部署所需项，不能仅凭以上通用表断言全部环境齐备。

当前 Fly 配置 `auto_stop_machines = 'stop'`、`min_machines_running = 0` 不能保证 Oban Cron 执行。开跑前选择并落实一项：

1. 让运行 Oban 的 API 至少一台常驻。登记自动停机策略、最低实例数及生效区域，验证目标 machine 不因无流量停止。
2. 独立常驻 worker process，明确启动 Oban/Cron/所需队列及故障恢复方式；仅加 process 名称不算交付。

具体部署命令在 P0 填入执行单并先验证，本轮文档修改不改变 fly.toml。P5 后停止人工保活流量，观察至少一个完整 15 分钟巡检周期，保存 machine 连续运行、实际巡检 Job、Outbox/cms_review 消费及告警证据；HTTP ping 保活不能代替常驻配置。跨重启检查需单独记录恢复时间。验收结束后仍维持后台任务常驻方案，否则不得标记巡检持续可用。

## 5. 固定 Seed 数据与 Manifest

固定 X=`dev`、Y=`mock`、disposable=`tmp`。**本方案要求将三者实现为系统保留社区，保留规则与受控 bootstrap 已本地实现，生产尚未部署验收**。P0 选择静态保留规则路线：将三者纳入 NameRules 保留名单，普通注册和改名请求均拒绝；专用 seed 初始化入口只允许这三个固定名称，保留语法、占用和归属检查，不允许任意 reserved slug，也不放宽公共创建接口。

P0 必须提供本地验收证据：普通注册/改名不能占用三者；受控初始化可创建且重复执行幂等；tmp 物理删除后普通用户仍不能占用，受控重建成功并得到新 ID。静态保留不依赖 Community 行存在，不随删除释放；如果实现改用 reserved slug claim，须先修订本文并验证 claim 在删除后持续保留，不能临场切换。私有负向测试所需的额外社区由 manifest 登记，slug 满足现有语法规则。

主社区入口为 `https://groupher.com/dev`，第二社区为 `/mock`；`/dev/xxx`、`/mock/xxx` 的首段是社区 slug，后续是内容路径，不表示嵌套社区。具体内容 URL 由 canonical locator 写入 manifest。此前协作说明中的 `/home/xx` 与当前路由语义冲突，本手册线上验收采用 `/dev/...`。`home` 不用于本轮 seed。

完成上述 P0 交付后，`dev` / `mock` 不做物理删除。`tmp` 用于 PS-A02，可删除并重建；删除实体不释放其系统保留名称。PS-A02 使用 tmp/mock 的单独共享 Article，不能删除 shared。重建 tmp 后必须更新 manifest 的 ID、binding 和 URL，旧 ID 不得复用；同一 tmp 场景只允许一个 run 操作。保留社区可跨 run 复用，但内容/权限归属须按 runId 隔离，占用/归属不符则报错，不覆盖其他 run。

| 别名                                                              | 准备的数据 / 用途                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| platform / adminDev / adminMock / author / reporter1–N / outsider | 固定别名的独立测试用户，不建立 GitHub OAuth identity；按 §5.1 获取正式 session；adminX=adminDev、adminY=adminMock；reporter 数量至少为实际阈值 N；匿名使用无 Cookie 会话 |
| PX / BX / CX / DX / TX / CM                                       | 已公开 Post、Blog、Changelog、Doc main、公开 User Ticket、普通 Comment 六类节点；另准备 Doc main Comment                                                                 |
| shared                                                            | 普通 Article 同时绑定 X/Y，Comment 在 X 创建；同一稳定身份；预留编辑、互动、举报用内容                                                                                   |
| deleteProbe                                                       | Article 绑定 disposable/Y；包含 Comment、互动和引用；用于物理删除 disposable                                                                                             |
| restricted                                                        | draft、manual hold、私有 Community、Doc 非 main branch；用于匿名和越权负向读取                                                                                           |
| map                                                               | 固定正文引用：PX→BX、BX→CX、CX→DX、DX→TX、TX→CM、CM→PX；另建零引用来源和 PX 自引用；数量超过所选分页大小的真实边                                                         |
| review                                                            | immediate / ai_first / human_first、平台/社区 policy；每项独立内容，覆盖五种 hold；AI queued/running/failed 与内容换版场景通过真实流程触发                               |
| ticket                                                            | 一个公开 User Ticket、草稿 Ticket、受限 Ticket及合法 Post source；避免为 Ticket 创建 Comment/mirror                                                                      |

Manifest 必须含 `runId`、revision、seed 版本、资源别名→内部 ID（仅运维）、公开 locator/URL、branch/binding、账号登录标识和角色、预期 Map 边集、清理归属、disposable 标记与预期计数。不存密码/token/一次性兑换凭据。账号固定别名可跨 run 复用，另记录 user ID、createdByRun、run 关联、session 非秘密引用和权限归属；凭据经受控密钥渠道交付。

Seed 幂等键使用 runId + 场景别名。不同 runId 必须隔离；同 runId 重跑需验证现存对象版本，遇不一致报错，不自动覆盖已被验收操作修改的内容。需要复跑破坏性场景时创建新的场景批次，并记录其前置状态。

### 5.1 固定测试账号与正式 session

本轮测试内容、权限与后台链路，不要求真实 GitHub 账号。采用受控 bootstrap 创建 account.users 与正式权限，不建立 account.oauth_providers。Seed 用户存在不代表已具备登录能力，以下入口未交付前 P5 为 BLOCKED。

该方案明确引入**临时、受限的测试登录旁路**，仅用于 P0 评审登记的固定用户和开放窗口，不引入通用或长期登录旁路。必须在 P7 禁用并移除；账号保留供演示或未来验收也不延长本次入口生命周期。

职责与待交付入口：

| 归属             | P0 必须交付的内容                                                                                                                                                                                                                       |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phoenix Accounts | release 兼容账号 bootstrap 命令，限定 runId/manifest/固定别名，输出用户和角色非秘密引用；复用正式 BrowserSessions 创建、刷新和撤销逻辑，返回持久 session/access token；不承担 Auth.js Cookie 签发                                       |
| Auth             | 实现凭据兑换入口及运维签发/禁用/撤销方法，完整创建 Auth.js Session；由 Auth 按现有协议协调 Phoenix 并设置 `__Host-groupher-auth.session-token` 与 `groupher-auth.token` 两类正式 Cookie；精确命令、路径、部署开关及移除发布步骤必须填写 |
| 联合失败处理     | 固定一次性消费与失败恢复顺序；防重复兑换；任何步骤失败都不能留下可使用的半登录，已创建的 Phoenix session 必须可撤销/补偿，失败响应不得留下单边有效 Cookie；证明清理/重试后无孤立可用会话                                                |
| 执行负责人       | 填写 Auth/Phoenix 实现负责人、P0 评审人与 P7 移除责任人；入口尚未实现或未验证时状态仍为 BLOCKED                                                                                                                                         |

Phoenix `BrowserSessions.create/2` 单独调用只产生持久 session 与 access token，不能形成 Auth.js Session。禁止仅写 Phoenix Cookie 的半登录；遵守 [Auth 当前合同](../../auth/README.md) 中由 Auth 协调两类 Cookie 的边界。

执行步骤：

1. 使用已交付的 bootstrap 命令创建固定用户与角色；重复执行不新增同名用户，复用时核对归属，不修改其他 run 权限。不建立 account.oauth_providers；发现意外绑定时报告并停止自动删除。
2. 受控运维命令仅为 manifest 登记的固定测试用户生成短期一次性凭据。P0 明确凭据/session 的准确有效期、runId、用途/接收站点、消费限制及吊销方法；禁止未登记用户或任意 user ID。凭据使用专用签名密钥或独立可撤销存储材料，与正式 Auth.js/业务认证密钥隔离。
3. 浏览器经 **Auth 侧**兑换入口取得完整正式登录状态；不得由 Phoenix 运维命令直接设置 Cookie 来代替。沿用现有 Cookie 属性、刷新、登出、CSRF/origin 和 Gate；不伪造 Cookie/JWT，不放宽正式认证校验。凭据不能出现在 URL、Referer、公开日志；交付方式在 P0 确定，禁止现有 test-login。
4. 验证两类 Cookie 和 Auth.js Session 均建立、Phoenix 持久 session 可关联；实际刷新、登出均通过。另验证重复兑换、过期/撤销/非登记凭据、Phoenix 创建失败和 Auth.js 签发失败，不留下可使用的单边会话。证据只留属性、非秘密引用和结果，不留 Cookie/token 值。
5. 每个角色使用独立浏览器上下文，reporter1–N 是不同用户，平台与社区管理员分开。记录一次性消费结果和 session 非秘密引用；本轮不据此声称 GitHub OAuth 验收通过。

P7 必须按顺序关闭入口，单纯撤销 session 或删除凭据不足以关闭此项：

1. 关闭签发和兑换 feature flag/部署开关；撤销未兑换凭据、本次 Phoenix session、对应 Auth.js 登录能力和临时权限，清理两类浏览器 Cookie 并验证旧会话无法访问受保护资源。
2. 销毁专用兑换签名密钥或独立凭据材料，移除对应 secret/binding。若保留凭据撤销记录用于审计，须不含可再次使用的秘密。不轮换正式 Auth.js/业务认证密钥来代替移除测试入口。
3. 发布**移除兑换路由和本次 feature flag/签发入口**的 Auth 收口版本，确保没有旧 deployment/实例仍可服务该路径；记录原验收版本、收口 SHA/deployment IDs 和差异范围。单纯关 flag 只能算临时禁用，不能最终关闭 P7。Auth 现有 `/api/auth/*` 通配入口会接管未匹配路径，收口版必须同时使旧兑换路径走明确的未知路径 404（通用 action allowlist 或无业务处理的拒绝响应）；仅删除专用 handler 不能假定已得到 404。
4. 临时禁用阶段可返回 401/404；最终移除后，实际兑换路径及签发 HTTP 路径（如有）须返回 404。从真实公共域名测试未兑换旧凭据、已兑换凭据和过期凭据均不能兑换；核对所有服务实例/部署及缓存不会返回旧有效入口。
5. 对正常 Auth session 刷新/登出、业务 API 和后台任务做收口版本复核，避免移除旁路时破坏正常服务；将移除发布、密钥销毁、路由 404、会话撤销证据纳入 §11。若保留固定账号，记录保留清单，不能保留可用的平台审核会话或本次旁路。

## 6. Reference Map 线上验收

开始前确认 seed 正文含 canonical 内部引用，非手工插入图边；等待实际 Outbox 同步，先验收正常同步，再测重建。在线 RPC 可调用现有领域模块，不依赖 Mix。

以下命令在目标 API machine 运维 shell 上执行，先确认该 machine 的数据库身份与持久盘；stdout/stderr 与退出码保存到执行单。RPC 对正在运行的 release 调用，因此进程可退出码为零但返回问题，命令显式断言：

```sh
/app/bin/groupher_server rpc 'r = GroupherServer.CMS.ArtimentMentions.Rebuild.report_all(); IO.inspect(r, limit: :infinity); if r.issues != [], do: raise("mention report has issues")'
/app/bin/groupher_server rpc 'r = GroupherServer.CMS.ArtimentMentions.Rebuild.apply_all(); IO.inspect(r, limit: :infinity); if r.failures != [], do: raise("mention rebuild has failures")'
/app/bin/groupher_server rpc 'r = GroupherServer.CMS.ArtimentMentions.Rebuild.report_all(); IO.inspect(r, limit: :infinity); if r.issues != [], do: raise("mention report has issues")'
```

首次 report 若暴露落后水位应记录并定位；只有预先登记的重建场景允许预期异常，不能用 apply 掩盖正常同步失败。空库 report 全绿也不能关闭本节，`scanned` 必须覆盖本次六类 seed 来源，manifest 与结果核对。

| ID     | 操作                                                   | 通过标准                                                                              |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| PS-M01 | 匿名逐个打开六类节点页面/Map、入边/出边和 Comment 深链 | 对照预期边集；零引用来源 READY；自引用不展示；Comment 独立节点，不伪造父子边          |
| PS-M02 | 按固定 `first` 翻页直到末页，再刷新重查                | 无重复/遗漏；边集与 manifest 一致；cursor 正常终止                                    |
| PS-M03 | author 编辑并发布一条引用，再移除它                    | Outbox 正常完成；旧边消失、新边出现；revision 推进；30 秒轮询启用后在约定期限内收敛   |
| PS-M04 | platform 隐藏/恢复节点，匿名和 outsider 读取           | 页面、列表、Map 不泄漏受限标题/摘要/边；恢复后一致；Doc 非 main 不泄漏                |
| PS-M05 | X/Y 读取 shared，移除 X binding 后读 Y                 | 不复制全局来源事实；Y 可读；X 入口拒绝；各 binding revision 正确                      |
| PS-M06 | apply 连续执行两次，再 report                          | 无重复边、通知或计数；report issues 为空                                              |
| PS-M07 | 对专用来源注入可恢复同步失败，执行重建和续跑           | 本轮明确失败；持久 manifest 有该来源；其他来源可继续；恢复后 retry 清零并 report 全绿 |
| PS-M08 | 等待实际健康巡检并进行一次受控异常告警                 | 真实任务执行；告警到达指定接收方；恢复后巡检正常；不能以本地 telemetry 替代           |

失败修复后的续跑入口：

```sh
/app/bin/groupher_server rpc 'r = GroupherServer.CMS.ArtimentMentions.Rebuild.retry_failed(GroupherServer.CMS.ArtimentMentions.Rebuild.default_manifest()); IO.inspect(r, limit: :infinity); if r.failures != [], do: raise("mention retries remain")'
```

故障注入只作用于独立 seed 来源，不破坏全局密钥、不停用全部数据库、不制造私有内容泄漏；具体注入与恢复命令必须在 P0 交付并先在本地验证。PS-M01–PS-M06 通过前不以开放轮询作为验收完成。

## 7. ReviewBot / AlertWall / 可见性线上验收

每项使用独立 seed 目标，保存前后请求与列表响应。人工在真实 Dash 操作；自动化同样走正式认证、CSRF 和 GraphQL，不引入通用或长期登录旁路；唯一例外是 §5.1 中 P0 评审、P7 禁用并移除的固定测试用户一次性 Auth 兑换入口。五种 hold 分别为 `ai_review_hold`、`human_review_hold`、`ai_suspect_hold`、`manual_hold`、`report_threshold_hold`。

| ID     | 操作                                                                             | 通过标准                                                                                                                                                                                                                                         |
| ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PS-V01 | 分别触发五种 hold，平台在 Board/Pending 页面查看，匿名读内容                     | 名称/原因/目标正确；有 active hold 即不可公开；人工等待和 AI 技术故障不伪造违规 Item                                                                                                                                                             |
| PS-V02 | reporter1 从 X 举报 shared Comment，另一账号从 Y 举报                            | 未达阈值前不因单次举报隐藏；同一当前全局 Item；每条举报保留发生路径；标准 release 的 `config/config.exs` 固定阈值为 3，runtime.exs 无环境变量覆盖；先用 §4.1 RPC 记录实际 N；需其他 N 时修改配置并重建发布，不尝试部署时设置不存在的阈值环境变量 |
| PS-V03 | N 个独立有资格账号累计举报；撤回/重复提交按现有规则检查                          | 达阈值产生 `report_threshold_hold`；重复请求不重复计数；AI clear 不能解除该 hold                                                                                                                                                                 |
| PS-V04 | platform reject，再返回 AI clear，然后 platform approve                          | reject 产生 manual hold；AI 不解除；approve 清理同 scope 全部 active hold，其他 scope/lifecycle blocker 不被解除                                                                                                                                 |
| PS-V05 | adminDev/adminMock 对普通 Comment 请求执行 approve/reject，尝试直接处理全局 Item | 社区权限不能创建/解除全局 Comment block；社区队列 policy scope 保留；platform 可执行全局决定                                                                                                                                                     |
| PS-V06 | queued/running 时 approve；failed 时 approve；运行中 reject；重放迟到 AI 结果    | queued/running approve 拒绝；failed 可人工通过并使旧 generation 失效；迟到结果不重新隐藏/解除 manual hold                                                                                                                                        |
| PS-V07 | 修改正文触发新 generation；另做正文不变的 recheck                                | 换版 clear 仅处理合同允许的旧自动 hold；recheck 不冒充内容换版；另一个 scope 的请求保持独立                                                                                                                                                      |
| PS-V08 | 同 commandId 重发相同人工决定，再改变 payload 重发                               | 同请求幂等；不同 payload 不静默覆盖；浏览器/UI 与 API 状态一致                                                                                                                                                                                   |
| PS-V09 | 真实 AI clear / suspect / uncertain 与 provider 失败、恢复                       | 已部署 Worker/模型实际调用有日志；故障按配置有限重试，最终可处理；不把模型不稳定输出当作固定结果                                                                                                                                                 |

PS-V09 中难以稳定复现的 AI 分支，用本地确定性测试补充，但该线上项必须如实记 BLOCKED/未覆盖；不能在生产伪造 AI 回调后声称真实模型覆盖。上线验收若要求全分支通过，须先准备经审核的受控故障入口。

## 8. 解耦与 Ticket 线上验收

本手册用例统一使用 `PS-` 前缀，避免与 Map 的 M0–M5、AlertWall V2 的 V01–V15 及历史 delivery 的 T01–T25 混用。PS-A01–PS-A07 分别映射解耦合同原 A01–A07，回填时同时注明两种 ID 和证据范围；PS-M、PS-V、PS-T 是本手册场景，不能按数字自动勾选其他合同条目。使用匿名、author、adminDev、platform 独立会话交叉检查。

| ID     | 操作                                                                                                 | 通过标准                                                                                                             |
| ------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| PS-A01 | shared move/mirror/unmirror；发布并读 Ticket；查询 Lifecycle                                         | 每 Article 一行，Ticket 按单 binding 合同；Lifecycle 不复制/丢失；数据库唯一/非空约束证据完整                        |
| PS-A02 | 用 P0 核实的入口对 tmp（manifest 中的 disposable Community ID）真正物理删除，随后 Y 读取 deleteProbe | 确认 Community 行确实消失；Article、Public、Lifecycle、Comment、互动、Mention 保留；不是逻辑 destroy；Doc owner 另测 |
| PS-A03 | X 创建 Comment，Y 回复/编辑/upvote/emotion/oneComment，再移除 X binding                              | 同一 Comment；正文/互动/计数正确；无上下文公开写入明确拒绝                                                           |
| PS-A04 | X/Y 都可读、X 不可读、无可读 binding 三种状态查作者评论列表并翻页                                    | 分别出现一次、仍出现且 URL 指向 Y、不出现；total/cursor 一致                                                         |
| PS-A05 | 执行 PS-V02–PS-V07，并比较 X/Y 页面、列表、Map 与 revision                                           | 全局隐藏/恢复一致；policy scope 权限和举报路径不混用                                                                 |
| PS-A06 | 对独立场景产生通知/统计事件，在移除 X 后按正式入口重试                                               | 一次通知；链接指向当前可读 binding 或无深链；统计仍用操作发生时 Community；不从已删字段推断                          |
| PS-A07 | 读 Doc main/非 main Comment，发布与读取 User Ticket，尝试 Ticket mirror/Comment                      | Doc branch 不泄漏；Ticket 正常发布/公开读取；不获得 mirror/Comment 能力；Map 六类不退化                              |
| PS-T01 | User Ticket 编辑、发布、版本冲突和公开 Post source；读取工作台/Activity                              | 内容与版本一致；冲突有领域错误；Activity 无重复，关联可见性正确                                                      |
| PS-T02 | 先预热 Ticket/Article 正式公开 URL、Press 输出，再隐藏/恢复并重复请求                                | 真实 CDN/Press 缓存失效，隐藏后不返回旧正文；公开 URL 与 API 一致；记录刷新期限、响应头和 purge 证据                 |

约束负向写入用例优先在同 schema 的本地真实 DB 完成；若必须线上做，另交付仅作用于 seed ID、事务内断言并保证回滚的脚本。不得为了模拟约束失败在生产临时关闭 trigger/FK。

## 9. 浏览器与真实环境证据

- 使用 `https://groupher.com/dev` 进入主测试社区，`/mock` 作为 Y，`/tmp` 作为可删除重建社区；具体内容 URL 从 manifest 读取，不猜 thread/innerId。
- Dash 走 `https://dash.groupher.com`，从实际 UI 进入审核页面并记录最终 URL；不沿用已删除的社区 dashboard 路径。
- 验收浏览器同源 `/api/graphql`；另核对 API origin 健康和部署版本。仅 origin 成功不能关闭公共入口验收。
- 匿名、登录、平台审核会话隔离。记录 Console/Network 中非预期错误；预期拒绝需与目标用例对应。
- 记录 AI provider 请求、Oban `cms_review`、Mention/通知 Outbox 的关联 ID、重试与最终状态。空队列只有配合已完成的实际事件才有证明力。
- 按 §4.2 常驻方案跨一次 API machine/worker 重启验证数据库、密钥、持久 manifest 和后台恢复；重启前后版本一致。无人工保活流量时等待至少一个完整 15 分钟巡检周期并确认 machine 未自动停止、Job 执行及告警接收。

## 10. 失败处理与 Seed 清理

任一必测项 FAIL/BLOCKED：停止宣布切换完成，保留 manifest 和证据，维持受控写入状态；按问题关闭相关入口或轮询，修复同一新模型后复验受影响用例。不可逆 migration 不运行猜测性 down；默认在新库向前修复，必要时废弃该次新库、重新初始化并重跑 seed。旧数据库不作为本手册的数据兼容运行通道。

全新库路线不执行旧 Review block/request/receipt 逐条兼容清理。若 P2 实际复用的是非空旧库，则本手册前提不成立：停止，重新选择空库或取得整库重建方案，不能跳过 migration preflight、手工放宽 CHECK。

Seed 清理的 report、apply、verify 是独立 P0 交付物，必须有准确命令、runId/manifest 校验、预期计数、退出码、幂等/续跑说明，并在同版本 prod 镜像本地演练。入口缺失不能推迟到验收后手工补 SQL。当前实现及其 Ticket 保留边界见 [P0 清理操作](./production-seed-p0.md#5-清理-report--apply--verify)。先 report 列出 runId 范围和跨 run 依赖，核对报告后 apply，再 verify。共享 Article/Comment 以 manifest 稳定 ID 定位；不能按删除某个 Community 推断内容已全部清理，也不直接套用会删除共享 Article 的 full-community delete。

清理范围按以下归属规则执行：

| 对象                       | report / apply / verify 要求                                                                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 社区                       | P0 保留规则实现后，dev/mock 保留系统名称和实体；清理本次内容/成员权限；tmp 可物理删除/重建但名称持续保留，更新 manifest；不删除其他 run 内容                                                 |
| 用户与权限                 | 记录 createdByRun 与复用关系；仅删除本次独占且无外部依赖的用户；复用用户只移除本次权限/关联；保留策略列清单                                                                                  |
| Browser session / 登录凭据 | 按 §5.1 撤销 Phoenix 持久 session、对应 Auth.js 登录能力、刷新能力及未兑换凭据；清理两类 Cookie，实际验证拒绝；保留非秘密引用，不留有效 token                                                |
| 临时登录旁路               | 禁用后发布移除兑换路由/feature flag/签发入口的 Auth 收口版本，销毁专用密钥或凭据材料；真实路由最终 404、旧凭据均不可兑换；不能以仅撤销 session 代替                                          |
| OAuth identity             | 正常为零；若出现，报告 provider 与归属的非秘密引用并停止自动删除；不得删除预先存在的 OAuth identity 或 provider 外部账号                                                                     |
| Article / Comment / Ticket | 按稳定 ID、binding/source 依赖清理；先报告共享与非本轮依赖，存在跨 run 引用时拒绝破坏性删除。当前 Ticket 不可物理删除，purge 经正式撤回后保留身份/历史并明确列出，不能作为零残留物理删除证据 |
| Job / Outbox               | 列出目标资源关联的全部状态及重试/调度任务；先停止重建来源、排空或受控取消本次任务，不能清完内容又被迟到任务重建；不清空共享队列表                                                            |
| 资产                       | 区分本轮 upload/provider object 与共享资产；依正式 ref/usage 和清理流程处理，保护其他内容引用；输出孤儿核对结果                                                                              |
| 外部派生数据               | 逐项列 CDN/Press、搜索索引、Map/通知和已启用的分析派生面；执行各自正式 invalidation/delete/保留策略并给查询证据，不默认删 DB 即删外部副本                                                    |

清理后核对：无本轮待执行/可重试 Job 与未处理 Outbox、无遗留受限内容公开缓存、Map report 正常、manifest 无失败来源、无 seed 资产孤儿。选择保留演示数据时，清除故障场景、异常任务和多余高权限账号，记录保留对象；不能用“保留 seed”掩盖残留失败。

## 11. 执行结果与关闭标准

| 项目                                      | 结果 / 证据                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Run ID、实际开始/结束时间、执行人         | 待填                                                                                                                   |
| API / 前端 / Worker revision 与数据库身份 | 待填                                                                                                                   |
| P0–P7、schema migration、约束证据         | 待填                                                                                                                   |
| PS-M01–PS-M08                             | 每项 PASS / FAIL / BLOCKED + 证据路径                                                                                  |
| PS-V01–PS-V09                             | 每项 PASS / FAIL / BLOCKED + 证据路径                                                                                  |
| PS-A01–PS-A07、PS-T01–PS-T02              | 每项 PASS / FAIL / BLOCKED + 证据路径                                                                                  |
| 无实际用户确认与旧数据处理范围            | 确认人/时间/声明来源、盘点/审计结果、冲突处理记录                                                                      |
| 社区/账号/session                         | P0 静态保留/受控初始化证据；tmp 删除后名称仍保留及重建 ID；Auth 双 Cookie/session 签发、刷新、登出、失败补偿及撤销证据 |
| 临时登录旁路移除                          | Auth 收口 SHA/deployment IDs、无旧实例证据、flag/路由/签发入口移除、专用材料销毁、最终 404 与旧凭据拒绝、正常服务复核  |
| 共享证据归档                              | 受控证据库地址、负责人、权限/保留期限、文件清单/校验值、上传与独立读取核对结果；本机目录不作为完成依据                 |
| 后台常驻与环境取证                        | 每实例身份/时区、实际阈值 N、配置清单、常驻与无流量运行证据                                                            |
| 巡检、真实告警、重启持久性、CDN purge     | 待填                                                                                                                   |
| Seed 保留/清理和复核                      | 待填                                                                                                                   |
| 未覆盖、故障与修复记录                    | 不得空白；无则写无                                                                                                     |
| 最终结论                                  | 未执行 / 失败 / 部分完成 / 完成                                                                                        |

只有必测项全 PASS、实际部署版本与执行记录一致、后台任务正常、清理/保留策略完成、临时登录旁路已移除且共享证据归档验证通过，才更新各功能文档的生产完成状态。Auth P7 收口版本须单独登记并复核，不能把它与最初验收版本的差异遗漏。线上 seed 验收关闭的是本手册列出的真实环境链路；本地后端全量门禁、Ticket R12 其他条目仍按其合同独立核对，不能仅凭线上 seed 全绿批量勾选。
