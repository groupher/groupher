# Dev Hub 本地存储整理

状态：本机已切换（截至 2026-11-26）。新版 Hub 已启动并恢复原有服务。Dev Hub 单测、type-check、配置界面验收、身份链路和启动清理验收通过。旧浏览器已关闭，旧 `.data` 已删除。

## 目标结构

以下用户数据路径是 macOS 示例。Linux 和 Windows 的目录选择已实现并由单测覆盖，尚未在对应系统实机验证。

```text
local/dev-hub/config/                  # Git 忽略，本工作树的私有配置
├── auth.env                          # Auth 配置，包括 OAuth client ID 和 secret
├── <service>.env                     # 其他服务有本地覆盖值时创建
├── service-identity.json             # Hub 生成并复用的服务间通信凭据
└── state.lock                        # 配置操作期间使用的锁

~/Library/Application Support/Groupher/DevHub/<工作树标识>/
├── browsers/<run>/<alias>/           # 测试账号各自的 Chrome profile 和控制文件
├── metrics/                          # 本地指标，保留今天及前 6 个本地日历日
└── worker-state/<服务名>/            # Wrangler 的本地持久状态

$TMPDIR/groupher-dev-hub/<工作树标识>/
└── workers/<服务名>/<run>/            # Hub 为开发工具生成的临时环境文件
```

当前共享路径函数对 checkout 真实路径取 SHA-256 摘要前 16 位；符号链接归一及新 checkout 不能继承旧登记已有单测，实际双 worktree 验收仍待执行。见[路径实现](../../local/dev-hub/src/server/storage-paths.ts)。Linux 使用 XDG 数据目录，Windows 使用 LOCALAPPDATA。Auth 的 OAuth 凭据通过 Dev Hub 配置面板维护。

## 清理规则

当前 `actors close --run <run>` 撤销会话、关闭浏览器并删除 profile；`actors clean --run <run> --apply` 会清理 profile，同时执行账号授权和社区清理。

- `pnpm devhub actors browsers-clean --run <run>` 关闭并删除指定 run 的浏览器目录，不修改账号、授权或社区。自动测试在成功及失败收尾时直接调用同一清理函数。
- smoke 测试登记 ephemeral 标记。Hub 启动时仅补清带标记、登记进程已退出且所有 worker 已退出的 run。手工联调 run 保留到明确清理。
- 指标保留今天及前 6 个本地日历日。清理在 Hub 初始化和跨日后的下一次指标写入时触发，Hub 长时间空转时清理会延后。
- worker 的临时环境文件按运行实例隔离，进程退出后清理。Hub 启动时仅清理有完整记录且所属 Hub 和 worker 进程组均已退出的遗留实例。记录不完整或进程仍存活时保留。
- Wrangler 的 `--persist-to` 指向用户数据目录下的 `worker-state/`。该目录可能包含本地服务数据，跨服务重启保留。

## 当前进度

工作区代码已修改配置、身份、浏览器、指标和 worker 的路径，指标轮转已改为保留 7 个本地日历日。`config/` 已加入 Git 忽略。本机服务覆盖配置和身份文件已迁入新目录，核对后旧副本及旧指标已清理。现有 Auth 配置的四项 GitHub 和 Linux DO 凭据可由新版 Hub 读取。

此前两项单测失败已修复。Dev Hub 118 项单测、配置界面隔离验收和连续测试账号 smoke 通过。新版 Hub 启动时已实测回收废弃自动测试及 worker 目录，保留手工 run 和活跃进程；本地身份链路探针通过，worker 停止后临时凭据文件已移除。

旧浏览器进程已关闭，旧配置、旧指标及旧 `.data` 目录均已删除。Hub 从新配置目录初始化身份，不扫描或导入应用的旧 dotenv 文件。旧身份导入脚本和 `setup-auth` 兼容入口已移除。

## 验收与剩余事项

- 本机新版 Hub 的配置读取、身份链路、指标写入、启动清理，以及 worker 正常停止后的临时文件清理均已验证。连续测试账号 smoke 验证了 profile 启动与回收。原有四个服务已恢复。
- Assets Worker 和 Edge Router 使用 Cloudflare Vite 插件的 `persistState` 指定持久状态目录，避免向 Vite 传递不支持的 `--persist-to` 参数。Assets Worker 身份链路通过；Edge Router 的本地健康检查通过。
- Linux 和 Windows 的路径选择有单测覆盖，尚未在对应系统实机验证。
- 旧 `.data` 已删除；新 profile 均写入用户数据目录。

## 待验收的存储操作

**Status 的本地 D1 迁移。** 此前受管 Worker 使用 `DEV_HUB_WORKER_STATE_DIR`，而 `make be.status.db.migrate.local` 只指定 `--local`。现已让[迁移入口](../../ops/status/package.json)使用当前 checkout 的同一状态目录。

迁移入口复用 `workerStateRoot`，此前已在两个一次性路径验证迁移、重复迁移及使用相同 D1 数据库标识的 Miniflare `DB` binding 隔离。2026-11-28 在 `2e17da443` 的独立 B worktree 实测受管 Status：迁移前 `/api/status` 返回 503，执行 `make be.status.db.migrate.local` 后返回 200；向 B 的本地 D1 写入测试状态，真实 Worker 可以读到，重启后仍可读，重复迁移报告没有待执行迁移。B 的服务、数据库、worktree 与本次创建的 Status 状态目录已回收。A 的 Status 当时处于停止状态，因此尚未验证两个真实 Status Worker 同时运行及相互隔离。

1. 在本次演练专用的空状态目录中，通过上述公开入口迁移，用受管 Status Worker 的实际 `DB` binding 读取[首条迁移](../../ops/status/migrations/0001_current_status.sql)创建的 `service_status` 表。记录工作树、解析出的目录、迁移版本和查询结果。
2. 重启 Worker 后再次读取；重复迁移应报告已应用。在另一个 checkout 的独立空目录重复，确认 B 迁移前读不到 A 的表、迁移后两边各自可读。验收只使用本地 D1，单环境读回可先独立交付，双环境部分在 Status 支持并发后执行。
3. 仅回收演练创建的目录，保留既有 Worker 状态。部署和远端 D1 迁移继续使用现有生产入口；通过本地配置测试核对调用目标，无需执行远端命令。

**工作树退役。** 浏览器、指标和 Worker 状态可能在删除 checkout 后继续存在。`doctor` 会列出登记的 checkout、归属状态和浏览器、指标、Worker 状态及运行目录；路径缺失或归属无法确认时只报告，不自动继承或递归清除。若数据根目录是符号链接，子目录标为待核验，不跟随它判断目录内容。登记中的运行阶段只代表登记快照，不代表进程存活。[诊断实现](../../local/dev-hub/src/server/doctor.ts) · [登记核验](../../local/dev-hub/src/server/environment-registry.ts)

PostgreSQL 开发库、测试库、临时库以及 fixture 的回收条件见[多 worktree 方案](dev-hub-multi-worktree.md)。双 worktree 的并行测试、迁移回滚及空库 seed 结果见[数据库实测](dev-hub-multi-worktree.md#2026-11-26-双-worktree-数据库实测)。该次演练使用一次性 PostgreSQL 实例；后续仍需验证自动选库、成功 seed 和 fixture 回收。
