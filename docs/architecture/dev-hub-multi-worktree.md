# Dev Hub 多 worktree 本地联调方案

状态为提案。第一阶段用 CLI 和产品浏览器验证两套真实运行时；第二阶段将它们接入一个桌面窗口。本文的启动、隔离与验收行为均为实施目标。

分步操作及通过条件见[双 worktree 验收手册](../infra/tooling/acceptance/two-worktrees.md)。本文提及的实现与演练文件随对应业务批次提交。

## 背景和决策

两个 agent 可以在不同 worktree 同时改代码和跑单测。问题出现在两人都要以真实用户身份打开产品页面，验证各自分支的前端、Auth、Phoenix 权限判断及数据库写入时。浏览器访问的是 URL，从 B 的终端打开 A 的产品地址，页面仍由 A 提供。一份通过的浏览器报告因此可能验证了另一份代码。轮流切换共享运行时可以串行验收，但会打断另一方的登录会话和调试。

现有 CLI 会核对 Hub 返回的 repoRoot；服务定义仍含固定端口、Portless 别名、Auth 地址与 Cookie 域。本地 actor 已支持隔离浏览器 profile、真实社区授权，以及通过开发 Auth 建立正常会话；fixture 当前只准入标准本地开发库。仅增加窗口或分配不同 actor 都无法隔离服务路由、迁移和写入。见[本地环境](dev-hub-local-environment.md)、[服务定义](../../local/dev-hub/src/server/services.ts)与[本地账号手册](../auth/local-test-actors.md)。

采用**每个活动 worktree 一个 Hub 进程**。同一 checkout 的多个 session 复用运行时，按需使用不同账号。归属以规范化的 checkout 根路径确定，与现有 [CLI 的真实路径校验](../../local/dev-hub/src/server/cli.ts)保持一致；分支名和 HEAD 用于展示及留证。每份代码运行自己的服务定义，桌面端只负责发现和展示。主机可以共用 PostgreSQL 实例和 HTTPS 代理，每个环境拥有独立数据库、服务地址、凭据与可写状态。

运行时归 worktree 所有，**不由启动它的终端或桌面窗口持有**。同一 checkout 的多个 session 本来就在改同一份代码，共享同一套服务、数据库和 fixture，不要求 agent 之间的数据隔离；并发验收时各自使用带标记的账号和数据即可。

## Worktree 依赖与构建复用

本节是日常开发和临时验收共同遵循的准备规则。新 worktree 须按仓库约定先取得授权；准备依赖时先检查目标已有结果与兼容缓存，避免每次重新下载和全量编译。共享依赖内容，工作区链接和可写运行状态由各 checkout 分别持有。这里描述操作要求；统一的依赖准备命令尚未交付。

- **先核对兼容性。** 对照目标的 `pnpm-lock.yaml`、`pnpm-workspace.yaml`、相关 package manifests、`backend/api/mix.lock`、`mix.exs` 和编译期配置，以及 Node/pnpm、Elixir/OTP、系统架构和 `MIX_ENV`。锁文件一致不单独证明构建缓存可用。缓存缺失或不兼容时，在目标环境正常准备，记录原因；不覆盖其他 checkout 的依赖或构建结果。
- **前端。** 优先复用 pnpm 共享 store；目标缺少可用链接时，在目标运行 `pnpm install --offline --frozen-lockfile`，注意这一步可能执行生命周期脚本。离线缺包时报告缺失，再按项目正常安装流程处理。每个 worktree 保有自己的 `node_modules` 依赖结构，不把整个目录链接到另一活跃 checkout。检查 `@groupher/contracts` 和 `@groupher/frontend-core` 的实际解析位置；对目标本地的 injected 包，还要验证目标源码的修改和新增文件确实被消费，不能仅凭路径判断。空间收益受文件系统及 pnpm 导入方式影响，不以 `du` 数字相加当作实际磁盘占用。
- **后端依赖与构建。** 依赖匹配时，优先把可信、兼容的 `deps` 和可用构建缓存以文件系统克隆或复制方式准备到目标目录。源缓存须无并发写入，保留权限和时间戳；不对其他活跃 checkout 的 `deps` 执行会修改它的操作。仅在明确不会修改依赖目录的准备命令中考虑共享 `MIX_DEPS_PATH`。受管 secondary Phoenix 当前使用目标自己的 `deps` 与 `_build`，不得绕过 Hub 另起服务。`_build` 必须是目标独占的可写目录，不能链接到另一活跃 checkout 的构建目录；正常增量编译并让 Mix 判断失效，路径或编译期配置变化仍可能触发全量编译，不能用 `--no-compile` 掩盖。
- **准备与回收。** 记录缓存来源、兼容检查、是否安装或重新编译及原因。关闭临时环境时只回收明确属于它的目录与资源，不清理共享 store 或其他 worktree 的缓存。`status`、`logs` 和诊断不得隐式安装依赖。

验收须在两个真实 worktree 上分别检查：匹配缓存的冷、热准备时间和实际磁盘变化；B 修改前端 workspace 源码（含新增文件）和后端源码后，B 使用新代码、A 保持自身代码；A、B 并发运行和测试时构建输出互不覆盖；锁文件、工具链或架构不匹配时正确回退。分别报告通过和未验证项，不把缓存命中或目录存在视为行为通过。

## 运行时归属与生命周期

Hub 是 worktree 级的常驻进程，由 `pnpm devhub` 管理。终端、CLI 和桌面都只是附加者，不拥有它的生命周期。

| 命令                                    | 行为                                                                                                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm devhub up`（`make dev` 调用）     | 新增。幂等确保：复用或后台启动本环境 Hub，输出实例摘要后返回。现有 `logs <id>` 返回快照；本批新增 `pnpm devhub logs <id> --follow` 跟随服务日志，Ctrl-C 仅断开跟随 |
| `pnpm devhub status`                    | 已有。扩展为列出 checkout、Hub 实例与端口、服务、域名、数据库、日志路径和启动时长                                                                                  |
| `pnpm devhub down`                      | 新增。先让 Hub 优雅停止其服务，再终止本环境进程组并确认端口释放                                                                                                    |
| `pnpm devhub start\|stop\|restart <id>` | 已有。仍按服务操作；完整重启 Hub 用 `down` 后 `up`                                                                                                                 |
| `pnpm devhub ensure\|setup\|doctor`     | 已有。Portless 代理、hosts 同步与诊断，不启动或停止 Hub                                                                                                            |
| `make dev.hub`                          | 前台运行 Hub，供调试、自动化和桌面故障诊断；已有常驻实例时拒绝并提示先 `down`；`make dev.dev` 继续用于 Hub 自身开发                                                |

- Hub 以独立进程组启动，并记录本环境的服务进程组；清理孤儿前同时核对已登记 PID、进程启动时间、进程组和 checkout 工作目录或可验证的启动归属，证据不足则保留并诊断，不触碰其他环境。
- 日志写入 `userDataRoot` 下的文件，`status` 输出路径，不静默丢弃。
- HEAD 或服务定义变化不触发自动重启；`up` 检测到变化时提示先 `down` 再 `up`，避免悄悄中断已打开的页面。
- 桌面退出不得终止 Hub。停止只由显式命令或经确认的界面操作发起，替换[现有桌面启动器](../../local/dev-hub/src-tauri/src/main.rs)里 `terminate_owned_hub` 的语义；这一步随批次 1 交付，不等桌面 tabs。
- `down` 的顺序固定：先让已核验的 Hub 优雅停止其登记的服务，再确认本环境的进程组与监听已释放，最后删除运行记录。归属无法确认的进程保留给诊断，不按端口终止。
- `make dev.hub` 在前台运行 Hub；从新 checkout 首次运行时，与 `up` 共用身份解析和登记锁，可直接创建缺少的 environment 与 starting 记录。首次安装须已选定 primary 或完成下述显式初始化；损坏的 registry 走恢复流程。角色由 Git 拓扑和 primary 记录判定。前台可请求运行模式，默认选择当前已就绪的模式，启动参数不能绕过 full 的前提。已有本环境 starting 或 running 实例时报告状态并拒绝新启动；Ctrl-C 只关闭本次前台启动的实例。
- `make dev.dev` 在第一阶段限定为整机单实例，沿用 4310/4311；任一监听被占时报告占用并退出。

发现与登记：

- 登记文件位于 `userDataBase()/Groupher/DevHub/registry.json`，目录 `0700`、文件 `0600`。
- 显式入口为 `pnpm devhub env init-primary`、`pnpm devhub env register` 和 `pnpm devhub env retire`。前者只接受 Git 主工作树；register 登记当前 checkout。retire 在 checkout 仍存在时仅接受已停止的 secondary，核验其 dev/test 库均已回收后删除登记和私有归属凭据；保留数据库清理报告与其他本地数据。所有操作拒绝部署环境。受管 Hub 启停及 secondary 数据库目标已接入登记；真实双 worktree 的完整验收仍待执行。
- `env retire` 与建库共用数据库操作锁，并在 registry 锁内复核实例、库和 checkout 凭据；建库在取得数据库操作锁后再次核对登记身份。库仍存在、数据库不可达或实例仍在运行时，保留登记。登记已删除但凭据删除失败时返回明确错误并保留该凭据供恢复，不自动重新登记。环境命令（`local/dev-hub/src/server/environment-command.ts`） · 并发与拒绝测试（`local/dev-hub/src/server/environment-command.test.ts`）
- 文件分两段。`environments` 存长期配置：规范化根路径、slug、primary 标记、数据库名、用途与归属标记、创建时间；`down`、崩溃和重启都不修改。`runs` 存本次运行：实例标识、Hub 端口、PID 与进程启动时间、phase（`starting`/`running`）、启动者标识、启动期限；`down` 只删除运行记录。
- 首次安装或迁移由操作者显式选定 Git 主工作树，将其真实根路径与规范化 Git common dir 存入 `userDataBase()/Groupher/DevHub/primary.json`。目录权限为 `0700`，文件为 `0600`；仅初始化、迁移或显式恢复可写，使用 registry 的同一跨进程锁和临时文件 rename。先落盘 primary 身份，再据此写 registry；两次写入间中断时可据前者恢复。日常 up、前台启动和 down 仅读取该文件。各入口以 `git rev-parse --git-common-dir` 解析仓库归属，以真实根路径区分 linked worktree，再与登记核对。同一仓库的其他 worktree 和独立 clone 均为 secondary。registry 缺失或损坏时由 `doctor` 诊断，仅当独立记录与 Git 主工作树身份都吻合时才可恢复 primary；身份不足时保留损坏文件并要求显式恢复，不能按启动顺序重建。
- `role`（primary / secondary）决定环境归属；`mode`（control-only / full）决定产品能力。`up`、前台入口和不经 Hub 的 CLI 操作共用身份解析。Hub 在创建 Portless 或 ServiceManager 前复核启动身份。不一致立即退出。新版 `/api/identity` 返回 repoRoot、apiOrigin、instanceId、role、mode、apiVersion；控制方比对登记和协议，缺少新版字段的旧实例只供诊断。
- 写入使用跨进程锁加临时文件 rename；控制方在发送命令前核验实例标识与真实路径。每次发给 Hub 的变更请求还携带期望的 instanceId，由接收 Hub 在操作前复核。验收时在查询身份与发出 stop 之间换实例，即使端口相同，新实例也须拒绝旧请求并继续服务。
- Hub 管理端口从固定的 4310 改为按环境分配：在登记锁内回收失效运行记录后，取 `4312–4339` 中最小且可绑定的端口（`4311` 留给 Hub 自身开发 API）；先写入带启动者与期限的 `starting` 记录，再拉起 Hub，健康检查通过后标记 `running`，超期或失败进入本实例的回收流程。`DEV_HUB_PORT` 仅保留为调试覆盖，CLI 不再默认 4310，一律按 checkout 查登记。
- 启动、续写状态、释放端口和删除运行记录均在登记锁内比对本次 `instanceId`。迟到的启动者发现记录已被替换时，只收尾自己能核验归属的子进程，不得改写新记录或释放新实例的端口。监听仍在时不得重新分配该端口。测试使用可控就绪顺序的 stub Hub、真实子进程与监听：第一实例超期后仍占端口，第二次 up 在登记锁内为第二实例选下一个可绑定端口，原子更新其 starting 记录的端口与本次尝试期限，再放锁并启动；每次重试都受同一总截止时间约束；端口池耗尽或期限届满则报错。待第二实例成功，再分别模拟第一次返回成功和失败；两次都须验证登记与端口仍属第二个实例，第一实例已退出或留下明确的待处理诊断。
- 首次 `up` 遇到 4310 上本 checkout 的旧实例时，不自动接管：识别为 legacy，输出诊断和当前服务列表；需要新生命周期语义时执行显式交接——停止旧进程、按新协议启动、恢复原服务集。旧桌面或旧前台终端仍持有进程时，登记保持只读，不写接管记录。
- 登记存在但 `/api/identity` 返回的 repoRoot 或实例标识不符时，报告诊断并拒绝启动第二个 Hub，不重建、不接管。
- 失效判定：`running` 用 PID 加进程启动时间，不单独依赖 PID；`starting` 用启动期限加启动者标识，避免进程尚未产生 PID 时无法回收。
- secondary full 停止后，先确认本次进程已退出及所分配端口不再监听，在 Portless 共用锁下核对并移除仍属于本实例的静态 alias，最后释放登记的端口。alias 已被更改或回收失败时保留运行记录与端口，供显式诊断与重试，避免旧域名指向后来占用该端口的环境。

### 状态来源与日常诊断

`primary.json` 确定主 checkout；registry 分别记录环境的资源分配和当前实例；checkout 内的 DB 目标文件供 Mix 读取，是分配结果的副本；实际连接到的库及其标记用于执行前独立核验。冲突时由 `doctor` 指出哪两项不一致。CLI、桌面、直接 Mix 与存储目录统一使用 checkout 的真实根路径。通过 symlink 进入应命中同一环境；移除后在原路径建新 checkout 时，缺少原登记的归属凭据即报告旧库、profile 和 Worker 目录，等待显式恢复或回收。见[存储整理](dev-hub-storage-reorganization.md)。

拟扩展 `status/doctor` 的文本及 JSON 输出，包含真实路径、HEAD、instanceId、服务和产品 URL、dev/test 库、已应用及待执行迁移、阻塞原因。所有日常 CLI 入口从调用目录选环境；拟提供 `pnpm devhub db status` 与 `pnpm devhub db inspect`，后者打开经核验的只读数据库会话，默认 dev，可显式选 test。脱敏输出足以定位目标，无需复制 DSN 或自行拼端口。

当前 `db status` 返回经归属核验的目标库、已应用版本、当前 checkout 的待执行迁移和库中存在但本 checkout 未提供的版本。终端执行 `pnpm devhub db inspect [--target dev|test]` 会打开只读查询会话；非交互脚本可使用 `--sql 'SELECT …'`，或用 `--interactive` 从标准输入逐行查询。非 TTY 且不带查询参数时，`db inspect` 保持返回迁移摘要。

只读查询先核验本机目标和归属，使用临时 PostgreSQL 登录角色，仅授予目标库现有 schema 的读取权限，并在只读事务中执行。每行只接受一条 SELECT、WITH、SHOW、EXPLAIN 或 VALUES；可用末尾分号，语句内部的分号和 psql 元命令不支持。会话最多使用一小时，正常退出或 Ctrl+C 会撤销授权并删除角色；异常退出的角色在过期后可由后续会话回收，也会在受管删库前核验并回收。活跃会话会阻止删库。SQL 中主动调用的数据库函数可能产生事务之外的外部效果，该入口不作为执行不可信 SQL 的沙箱。

建立会话时短暂使用现有 `database-create.lock`；如进程在持锁期间被强制终止，该锁可能需要人工核验后恢复。只读入口会在锁目录写入操作和进程信息；缺少信息或归属不明时不要自动删除锁。

2026-11-28 在 `158faf901` 的临时 B 验证了 `--sql` 和交互查询，实际连接 B 开发库和临时只读角色；尝试切换为管理员被拒，结束后临时角色数为零。此前开发版本的临时 B 演练还验证了并发读取、只读事务拒绝写入、多语句拒绝、活跃会话阻止删库，以及强制终止后删库回收遗留角色；最终实现的独立 PostgreSQL 集成测试覆盖并发会话、受限权限、遗留角色回收和角色拥有对象时保留对象。B 已回收，A Hub 未重启。

当前 `doctor` 已报告 checkout 真实路径和 HEAD、登记的实例和端口、已验证实例报告的服务状态与产品 URL、可核验数据库的迁移摘要、Portless 诊断及分项阻塞原因；它不展示私有登记凭据。服务状态来自 Hub 快照，不代表独立完成了端到端请求验证。主环境测试库的只读状态查询按已登记的主 checkout、标准本机库名及实际连接身份核验；已有 Dev Hub 标记时还须核对本 checkout 的认领记录及原备注。该查询不会认领库；需要显式认领时使用 `pnpm devhub db adopt-primary --target test`，可用同一命令加 `--revert` 恢复认领前备注。普通主环境 `mix test` 仍沿用既有目标选择，标记核验用于受管数据库命令，不改变普通测试的启动前提。

## 本地域名与 Cookie（已定案）

主环境使用 `groupher.localhost`，每个 secondary 使用同级域 `groupher-<slug>.localhost`。slug 取工作树目录名，去掉 `groupher-` 前缀后规范化，碰撞时追加稳定短 hash。域级 Cookie 使用现有名字，作用域限于各自环境；host-only Cookie 继续由签发主机持有。

| 环境                           | Dash 地址                            | Auth 与 API 所在域                                                        | 域级登录 Cookie 的行为                                                        |
| ------------------------------ | ------------------------------------ | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A 主环境                       | `dash.groupher.localhost`            | `auth/api` 各自位于 `groupher.localhost` 下                               | 域为 `.groupher.localhost`                                                    |
| B（示例 slug 为 `feat-login`） | `dash.groupher-feat-login.localhost` | `auth.groupher-feat-login.localhost`、`api.groupher-feat-login.localhost` | B 的域为 `.groupher-feat-login.localhost`。浏览器按域区分，沿用现有 Cookie 名 |

Hub 从本环境根域生成产品地址与 Cookie 域。接入新应用时，核对 Portless 解析、证书、alias、Auth 回跳、SSR 和 HMR 的实际落点。浏览器回归用同一 profile 验证两侧 viewer 和独立登出；日常角色验收使用独立 profile。

**2026-11-26 本机验证。** macOS arm64，仓库锁定 Portless 0.18.1，Chrome 158.0.8127.88。复用 443 上的现有代理，使用临时 loopback 测试监听与全新的单个 Chrome profile。A 的探针域为 `probe-a.groupher.localhost`，B 使用上表 B 的三个实际主机名。

| 检查                   | 实测结果                                                                                                                                                                                                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 系统解析               | 登记前，macOS `getaddrinfo` 查不到 B 的三个名字；登记后均返回 `127.0.0.1`。当前代理在路由变化期间更新了 `/etc/hosts`，即使调用 alias 的 CLI 设置了 `PORTLESS_SYNC_HOSTS=0`。移除后待同步完成，三个名字均恢复为不可解析。首次 setup 与后续环境级 hosts 管理需要兼容正在运行的代理配置。 |
| TLS 与路由             | 原生 Chrome 保持证书校验，三个 B 地址各自通过 HTTPS 命中指定的测试监听并返回对应标记。独立 TLS 握手逐个验证 SNI、证书链及主机名，均为 TLS 1.3，证书 SAN 覆盖对应主机名。                                                                                                               |
| 同一 profile 的 Cookie | 两个域由各自探针通过 HTTP 响应签发同名、不同值的 `Secure; HttpOnly` 域级测试 Cookie。B 的 Dash、Auth、API 均只收到 B 的值；清除 A 后 B 继续收到原值，重新签发 A 再清除 B 后 A 继续收到原值。                                                                                           |
| 产品登录与登出         | 另行使用真实双环境完成，结果见下文。                                                                                                                                                                                                                                                   |

收尾核对：临时 alias、监听和 profile 已回收；原有 23 条路由恢复，hosts 中无探针条目，原有四个运行服务 PID 均与基线一致。

**同日真实账号复验。** A 维持现有服务，临时 B 基于 `1ad7cdc62`，用 B 的 Hub 启动 Auth、Phoenix、Community 和 Assets Hub。B 有独立 PostgreSQL 开发库、归属标记、服务身份与真实 fixture 账号。为此次验收，在 B 的本地配置与开发专用 fixture 中指定其域名、端点与目标库；没有改变产品会话、鉴权或登出实现。两库分别查得本侧测试账号 1 个、对侧账号 0 个。

一个全新 Chrome profile 中打开 A、B 两个 Community 标签页，通过各自开发 Auth 登录。每次都刷新真实的 `/home/post` 并重新从该站点的 `/api/graphql` 读取 `sessionState { isValid user { login } }`。表内 A/B 用户代表两个各自核对过完整 login 的不同账号。

| 操作          | 刷新 A         | 刷新 B         |
| ------------- | -------------- | -------------- |
| 分别登录 A、B | A 用户，有效   | B 用户，有效   |
| 在 A 登出     | 匿名           | B 原用户，有效 |
| 仅重新登录 A  | A 用户，有效   | B 原用户，有效 |
| 在 B 登出     | A 原用户，有效 | 匿名           |

两侧登录和登出均返回 HTTP 204，最后登出 A 后再次刷新也为匿名。实测覆盖同级域布局下的 Community 真实会话。自动创建或发现 B、Dash 与真实第三方 OAuth 回调仍按各自批次验收。

控制面可先启动。缺少解析时，`up/doctor` 报告当前环境实际需要的完整主机名。

- 主机级 Portless 代理和 CA 信任由人在交互终端首次准备。环境级 `pnpm devhub setup` 根据当前 checkout 的登记，只处理自己 slug 的 hosts 标记块（`# groupher-devhub:begin <slug>` 至对应 end）；写前备份并打印 diff，不执行全局 hosts sync。环境登记可在 control-only 状态存在，批次 2 允许此准备动作先于 full 模式。归属与操作范围校验先于 TTY、sudo 和文件写入；非 TTY 且无受限免密 helper 时立即返回。
- `down` 保留 hosts 块。`doctor` 区分停用与已移除的 checkout；移除前可显式清理本环境块，遗留块由人按诊断核对清理。其他 checkout 的常规 setup 不做代清理。

## 第一阶段 · 两个 worktree 并发真实验收

交付范围为同机 A、B 两个 checkout，各自通过公共 Make/Dev Hub CLI 启动自己的 Hub、Dash、开发 Auth、Phoenix 及所选业务路径实际使用的依赖。浏览器走真实 HTTPS 产品入口，actor 只替代第三方 OAuth 登录交互。首条路径选用 Dash 社区外观的主题预设写入（`selectThemePreset`，公开权限键 `dashboard.theme.update`，Command 内 Gate 使用内部 scope `:dashboard_theme_update`）。主 checkout 的入口、数据和现有服务继续可用。桌面 tabs 与多环境界面、所有子应用的并发支持及第三方 OAuth 回调验收留给独立工作；桌面启动器“退出不终止 Hub”的最小改动随批次 1 交付。

同级域双登录已经通过。接下来验证 Mix 对三类数据库的选择和公开 `pnpm devhub start dash` 的完整启动链，再固化恢复协议。当前 Dash 的必需依赖含 dev-gateway、Auth、Phoenix、Assets Hub，另有可选 Import、Converter。按[服务定义](../../local/dev-hub/src/server/services.ts)验收默认启动方式，并逐项记录实际启动与请求落点。核对 B 的前端 workspace 链接指向 B，自用可写 Mix 构建目录；A、B 的 Phoenix 与两边测试并发时 PostgreSQL 连接容量足够。对[现有 Playwright runner](../../frontend/e2e/playwright.config.ts)核对固定 listener 和 API 目标；尚未支持并发的入口应在占用监听或发送请求前给出诊断。

### 批次 1 · 两个 Hub 安全共存

交付登记、实例发现、受管启动与退出，并让桌面退出只断开连接。secondary 初始为 control-only。按能力允许本实例的身份、状态、只读地址和关闭；HTTP 路由以允许列表判定，默认拒绝其他调用，包括服务重启、环境 ensure 和配置写入。CLI 的直连入口在执行前检查能力，PortlessManager 在代理或 alias 变更前再次检查。控制面跳过启动时的 Portless ensure，也不构造会启动轮询的产品 ServiceManager，不启动产品指标监控或进行外部服务恢复。control-only 的 `GET /api/services` 从本 checkout 的静态服务定义列出服务 ID，仅从本环境登记取已分配地址；快照带 mode，产品服务显示“control-only，本实例未启动”，PID 为空。该状态描述本实例的管理行为，不探测主机上的其他进程。status 和 url 共读这份快照；url 没有已分配地址时返回未分配，不隐式 ensure 或返回 primary 的地址。

分别验收三种状态：

1. **旧 Hub。** 旧桌面、旧前台终端分别持有 4310 时，仅输出 legacy 诊断；显式交接后恢复原服务集。
2. **新版共存。** A 在 full 模式运行产品，B 从后台或前台入口进入 control-only。先在仅缺 B 环境记录的干净 checkout 直接执行 make dev.hub，验证登记、快照及退出；与 up 并发时只能有一个实例成功启动。再并发执行两个 B 的 up，核对只出现一个实例。B 的 status/url/down、被拒绝的直接 CLI 和 HTTP 写操作均不改变 A 的 PID、alias 与页面；关闭后保留环境记录。启动超期和端口竞争按登记章节的 stub 用例验证。
3. **孤儿。** 模拟 Hub 异常退出但产品子进程仍活着，验证 B 不会终止 A 的进程组；本环境恢复时遇到 PID 复用或归属不明，保留诊断。

### 批次 2 · 独立数据库上的真实服务与路由

- **标记格式。** `COMMENT ON DATABASE <已核验且正确引用的库名> IS <标记文本>` 保存 JSON 对象，字段为 `namespace`（固定 groupher-devhub）、`formatVersion`（1）、`worktreeId`、`purpose`（dev / test / rehearsal，演练另记 run）和 `previousComment`（原备注，可为 null）。本批的 create 与 migrate 共用读写和解析规则；连接经核验的目标库后，使用 `SELECT shobj_description(oid, 'pg_database') FROM pg_database WHERE datname = current_database()` 读取。保留已有普通备注；遇到其他环境的标记、未知版本或损坏的标记立即停止。若使用备份恢复，按实际备份命令验证标记往返；恢复副本需要重新核对归属。
- 交付 `pnpm devhub db create` 和 `db migrate`。读取、创建与迁移默认选择 dev，拟用 `--target test` 选择本 checkout 的测试库；drop 必须显式指定 `--target dev|test` 中的一种。只操作已登记的本机目标；secondary 库名由 slug 单独规范化为 ASCII 标识（含前缀最长 63 字节，碰撞时分配稳定短 hash）。创建时写入上述 v1 归属标记；重复创建仅复用标记一致的库。迁移前核对目标并记录版本。建库与写标记之间中断，留下的无标记库阻止自动认领，保留供诊断。本批使用的库保留至批次 3 显式回收。
- 在 [Phoenix 开发配置](../../backend/api/config/dev.exs)与 Hub 共读当前 checkout 根目录下拟新增的 `local/dev-hub/config/database-target.json`。由建库命令在库与标记核验成功后原子写入 worktreeId 以及按 dev/test 区分的 host、port、database；文件不含凭据。Mix 按自己的 checkout 定位文件，与登记比对，受管 dev/test 操作的环境变量不能覆盖为其他目标。一次性迁移演练按下文独立准入。secondary 缺配置、实际目标非本地、显式 DB_NAME/连接参数与登记冲突或指向 primary 时，在业务 Repo 建连前失败；迁移执行前另核验库内标记。分别从 Hub 与 B 的开发 Mix 入口验证这些负例，检查 A 的迁移版本和数据未变。
- 每环境在锁内预留产品端口，重启服务沿用本次运行的分配。由同一份结果生成监听、健康检查、Portless alias、SSR/API 地址、Cookie 域、Auth Origin/回跳、issuer、JWKS 地址和 `SERVICE_AUTH_TOKEN_ENDPOINT`。本地 Auth 保留进程内 issuer；当 `E2E_AUTH_STACK=1` 时，同一环境配置指向本环境的 HTTP token endpoint。分别断言两种模式的服务凭据通过本环境验证，HTTP 模式另核对请求落点。盘点 [Phoenix CSRF](../../backend/api/lib/groupher_server_web/middleware/browser_csrf.ex)、[Auth 主机规则](../../backend/auth/src/app.ts)、相关前端 app.config.ts 的 allowedHosts/HMR 与 [Dash bindings](../../frontend/dash/cloudflare.config.ts)。Portless alias 变更加锁并校验版本。通过独立库、端口及 HTTPS 的准备检查后，为已就绪的 secondary 启用 full，解除批次 1 对首条产品链的限制；其他环境保持原模式。
- **通过标准。** 两套同名服务同时启动，分别验证域名解析、代理落点、实际主机名证书以及 SSR 到本环境真实 Phoenix 的请求。让 B 的 Auth 取得 audience 为 `phoenix:auth-api`、scope 为 `auth:session:read` 的服务身份，调用 B 的 [browserSessions](../../backend/api/lib/groupher_server_web/schema/account/account_queries.ex)。用中间件或测试观测证明本环境请求通过 ServiceScope 并到达 resolver，外环境服务身份在认证层被拒绝；分别留证，不记录凭据。此处无需用户会话，完整权限写入留到批次 4。

### 批次 3 · 数据库生命周期与 fixture 准入

- **旧 primary。** `pnpm devhub db adopt-primary` 仅在独立 primary 身份、调用方根路径、开发模式和实际本机标准端口的 groupher_server_dev 均吻合时写标记。同一标记重复执行无写入。`db adopt-primary --revert` 仅在标记仍匹配本次认领记录时恢复原备注；保留账号、数据和其他后续改动。常规 create 拒绝认领无标记旧库，常规 drop 拒绝 primary。
- **primary 测试库。** `pnpm devhub db adopt-primary --target test` 独立认领标准本机 `groupher_server_test`，保留原备注和数据；`--target test --revert` 仅撤回该库认领。dev 与 test 使用独立记录和标记，常规 drop 都拒绝 primary。一次性 PostgreSQL 演练已验证两库各自认领、重复执行、撤回及数据保持；实际主库未因此修改。对应演练（`local/dev-hub/src/server/database-primary-rehearsal.test.ts`）
- **回收与验收。** `pnpm devhub db drop` 核对登记、实际库和标记，明确回收 secondary 库。复用批次 2 的 v1 标记与解析规则，同步更新 fixture Guard（`backend/api/dev/seed/target.ex`）、[账号手册](../auth/local-test-actors.md)和对应单测。A、B 可创建同名社区、run 和 alias；错库、远端库和部署环境在授权前被拒。用含既有账号的演练库验证 primary 认领、重复执行、撤回和恢复旧入口后的登录。验证删除 secondary 库后重试得到明确的已回收结果。

### 数据库操作与双环境验收（批次 2–3）

下表为交付契约。`devhub db …` 是拟新增的本地入口；Make、Mix 与 CI 脚本是现有调用方。创建、迁移和清理从当前 checkout 解析目标；涉及库的操作均记录实际主机、端口、库名、用途和迁移版本。fixture Guard 只接受本环境 dev 库。

| 数据库     | 操作入口与归属                                                                                                                                                                                                                          | 验收                                                                                                                                                                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 开发库     | 在专用 primary 演练中验证既有库认领；日常验收的 A 已就绪。B 从空库 `db create`、`db migrate`。保留 `make be.migrate`、`be.rollback`、`be.seed.home`。拟增的 `db status/inspect` 从同一目标读取                                          | 重试创建和迁移均幂等。在 B 的可回滚演练迁移上执行 rollback、查版本、再 migrate。从 B 的公开入口启动所需 Assets 服务并运行 seed，再用 `pnpm devhub start community` 验证 B 的 `/home/post` 可读；跟踪资产写入/删除地址也属 B。A 原有社区、资产和迁移版本保持基线 |
| 默认测试库 | 每个 checkout 有独立 test 目标；`make be.test`、普通 `mix test`、`be.migrate.test`、`be.rollback.test` 共用它。当前 [Mix alias](../../backend/api/mix.exs) 会先建库、迁移，[测试配置](../../backend/api/config/test.exs) 默认共用一个库 | 两份专用验收 checkout 各带一条独有的演练迁移，并行从 backend/api 运行普通 `mix test`，不手填 `TEST_DB_NAME`。各测试库只出现本侧演练版本；两开发库均不出现该版本。分别检查一次测试库回滚和重新迁移                                                               |
| 单次演练库 | [fresh-migration 脚本](../../backend/api/scripts/fresh_db_migrations.sh)在 `MIX_ENV=dev` 下为本次运行建库、迁移、查版本和删除。允许已核验的显式临时目标，与日常 dev/test 选择分开                                                       | 从无 Hub registry 的[干净 CI checkout](../../.github/workflows/backend-tests.yml)运行原入口；两次并发演练各自成功回收。模拟中途失败，按运行归属重试，只清理本次库；有活动连接则报告并保留                                                                       |

**破坏性操作。** 在一次性 secondary 演练库验证 `mix ecto.reset` / `ecto.drop` 等直接入口与 Hub 遵守相同约束。对原有 primary、其他 checkout、无标记、用途冲突、远端和部署环境，在写入前拒绝；不要因目标库尚未建立而回退到默认库。允许重建的临时库须在重建后重新核对标记与迁移。注入冲突的 DB 配置、模拟建库后写标记中断，分别复查 A 的数据、迁移和连接。显式回收 B 前先完成 fixture 清理并保存报告，停止本次服务释放连接，再按用途分别回收获准删除的库；重复 drop 返回已回收。普通 `down` 保留数据库。

`pnpm test:seed-isolated` 已在无 registry 的后端副本及一次性 PostgreSQL 模拟主 dev/test 库上直接执行 `mix ecto.drop` 和 `mix ecto.reset`，四次均在删除前拒绝，两个库的探针数据保持不变。该测试不连接实际主库，也不覆盖已登记主 checkout 的完整路径；secondary 的真实受管入口验收仍按上述步骤执行。隔离测试入口（`scripts/test-local-seed-isolated.py`）

[现有 Make 入口](../../Makefile)中，`be.seed.home` 会另读 `.env.local` 并使用固定 Assets 端口。实施须统一解析其 DB 与资产目标，并覆盖与 Hub 配置冲突的旧 dotenv。PostgreSQL 之外，Status 的本地 D1 迁移与 Worker 读回另见[存储验收](dev-hub-storage-reorganization.md)。

#### 2026-11-26 双 worktree 数据库实测

A 使用当前工作目录（含未提交的 OAuth 迁移），临时 B 使用 `1ad7cdc62`。两边的写入均指向同一个一次性 PostgreSQL 实例（`127.0.0.1:60591`），借此直接检验同一实例上的库名隔离。日常 A 的开发库和测试库位于 5432，仅做只读对照。

| 场景                                             | 实测结果                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 当前 checkout 默认行为                           | 两边不设置 `TEST_DB_NAME`，同时从各自的 `backend/api` 运行普通 `mix test`。在一次性实例上预先禁止连接默认测试库，两边都在迁移入口收到同一库 `groupher_server_test` 的拒连错误。当前默认配置会撞库。                                                                                                                                                                                                                                            |
| 为 B 配置独立默认库，再次并行运行普通 `mix test` | A 使用 `groupher_server_test`，B 使用 `groupher_isolation_b_test`，命令均未传库名。一次 `pg_stat_activity` 采样在两个库各看到 20 个连接。A 运行 3025 项，0 失败、16 跳过、1 排除，耗时 11 分 54 秒；B 运行 3001 项，0 失败、11 跳过、1 排除，耗时 12 分 24 秒。两库都记录了 817 条迁移，但 A 独有 OAuth 版本 `20261125100000`，B 独有探针版本 `20261126000100` 和探针表。                                                                      |
| B 开发库迁移、回滚、重新迁移                     | 从空库对 `groupher_isolation_b_dev` 依次运行 `make be.migrate`、`make be.rollback`、`make be.migrate`。三次均成功。迁移数依次为 817、816、817，探针版本记录与实际表均随之出现、消失、恢复。                                                                                                                                                                                                                                                    |
| B 从空开发库迁移后运行 `make be.seed.home`       | 临时让 B 的 Make 入口复用 B 的 Hub 环境，确认 DB 和资产端点指向 B，启动 B 的 Auth、Phoenix 和 Assets Hub。seed 在内容事务内返回 `cms.gate.throttle_interval`（4626）。同一个 seed 账号连续发布文章，开发配置的最短发布间隔为 3 分钟。事务回滚后 B 的 `home` 社区为 0 条，壁纸上传和页面读回尚未验到。见 [LiteHome](../../backend/api/lib/groupher_server/cms/seeds/lite_home.ex) 与[开发使用的发布限额](../../backend/api/config/config.exs)。 |

Dev Hub 受管 Phoenix 的默认连接池为 10，可通过本环境的 `DB_POOL_SIZE` 显式调整；变更只在下次启动生效，不会重启正在使用的 A。`dev.exs` 的非受管默认值仍为 50。2026-11-27 补测中，本机 PostgreSQL `max_connections` 为 100，A 旧进程占用 51 个连接，B 使用旧默认值 50 启动时出现 `too_many_connections`。改用受管默认值后，B 占用 11 个连接，B 重复清理时 A 的测试账号仍可读取。因此数据库隔离还须核对共享 PostgreSQL 的连接容量；独立数据库并不自动隔离服务器级连接上限。

普通 `mix test` 的连接池目前为每个进程 20；在旧 A（51 个连接）和新 B（11 个连接）同时运行时，再启动两套测试的理论需求已超过此实例的 100 个连接。不要把上述 B 清理补测当成该组合已通过。两侧服务下次按新默认值启动后仍须在目标机器核对实际容量并复测；需要更多并行进程时，可以按机器资源调整 PostgreSQL 实例的 `max_connections` 或各环境的连接池，不得为验收擅自重启正在使用的实例。

以并行测试结束时为基线，在 B 的迁移、回滚、重新迁移和 seed 失败后逐次比对 schema、普通表的行数与行内容摘要、序列值。一次性实例内 A 的开发库副本和测试库每次都一致。日常 A 的测试库从验收前到结束也一致；日常 A 的开发库只有 Oban 的 `public.oban_jobs`、`public.oban_peers` 和任务序列出现变化，业务表与 schema 一致。

上述 B 配置仅用于当时验收。后续实现让受管开发环境的发布频控支持连续准备，空库 home 的内容和壁纸补测见下文；普通 Mix 与 Make 的目标选择、已有社区权限 fixture 和生产隔离仍按各自条件核对。

### 批次 4 · 从创建社区和权限用户到清理

资源创建、授权、重试与清理的共享接口见[本地 seed 工具箱设计](local-seed-toolkit.md)。下文示例使用现有 Dev Hub 命令。拟议的本地 fixture 主入口为 `pnpm seed`；交付后在 A、B 各用它复跑下述兼容入口的建账号、建社区、授权和清理流程。对同一 run 中可安全重复的动作交叉使用两个入口，核对同一资源引用、有效权限与清理预览，再执行清理。服务启动和浏览器操作仍由 Dev Hub 管理。

**2026-11-27 单侧主链路实测。** 临时 B 基于 `1ad7cdc62` 并叠加当时的未提交改动（包括独立 OAuth 改动），登记为 secondary，在本机 PostgreSQL 创建独立 dev/test 库并迁移 dev；通过 B 的 Hub 启动 Dash 依赖。首次启动等待 Phoenix 编译超时，编译完成后重试成功。使用 `pnpm seed` 创建 owner、editor 和社区，真实邀请并接受 `dashboard.theme.update`；账号清单显示授权生效，editor 用独立 Chrome profile 打开 B 的 Dash，页面显示对应社区。清理预览无阻塞；执行和重复执行均报告 `cleaned`，普通管理员移除、社区归档、初始 lord 保留，之后该 actor 的 UI 操作被拒绝。随后停止 B Hub，分别回收 B dev/test 库并移除临时 worktree。当时环境登记记录的回收入口尚未实现，本次在 registry 锁下核对 B 路径不存在、run 已释放后手动移除其登记；删除 B 的浏览器、日志和指标目录，保留本机数据库回收报告。后续新增的 `env retire` 已用一次性 PostgreSQL 验证库仍存在时拒绝、库回收后允许注销；尚未在实际 B 上复验。此结果只覆盖 B 单侧、当前叠加代码的主链路；不代表双环境并发、A 的会话保持、生产隔离或排除 OAuth 后的最终 PR 已验收。

**2026-11-27 双侧主链路补测。** A 与新建 B 分别使用同一 run、alias 和 slug 创建账号、社区并完成邀请和接受；社区 ref、账号和成员各自不同，两个 editor 分别登录 Dash。B 从 `e1355254b` 建库、迁移并启动；依赖安装生成了本地前端图标文件。两侧并发修改权限时发现返回值含不可 JSON 编码的用户结构，修复提交 `c116c839b` 后，同 key 重试取回已提交结果；B 更新到该提交，两侧再次并发修改均成功。B 清理预览无阻塞，执行及重复执行报告 `cleaned`，社区归档并保留初始 lord；清理同时 A 的权限修改成功，之后 A 的账号仍 active，原浏览器 profile 重新加载社区页面成功。A 随后也清理本次 run，按策略保留归档社区、账号和历史。B 停止后两个专属数据库均回收，实际运行 `env retire` 成功并移除 worktree、浏览器、日志和指标，保留数据库清理报告。此补测不等于完整双向 UI 写入、同 profile 双向登出、home 空库准备或生产隔离验收；这些仍按下列条件单独验证。

**2026-11-27 Context 收口后的补测。** B 在 `7c43c9327` 新建独立 dev/test 库，迁移 dev 并由自身 Hub 启动服务；本地依赖安装重新生成了前端图标文件。A、B 用同名 run、alias 和 slug 新建账号及社区，返回不同的账号和社区 ref。两边各自完成邀请、接受、Dash 登录和并发权限更新；B 在接受前的只读清理预览正确报告一条待处理邀请。B 清理及重复清理均返回 `cleaned`，保留归档社区及初始 lord；清理同时 A 的权限写入成功，A 原浏览器 profile 随后重新加载社区成功，B 已关闭的 actor 操作被拒绝。A 也清理了本轮 run，按策略保留账号、归档社区及历史；B 服务、两个专属库、登记、worktree 和临时浏览器数据已回收，保留清理报告。此轮专门复测受 Context 读取与清理改动影响的主链路，不替代上段列出的其他验收。

**2026-11-27 Gate 收紧后补测。** 使用 `4e16cd8d9` 在 A、B 分别创建同名 run 和社区，完成真实邀请、接受、Dash 登录、成员列表及并发权限更新，账号和社区 ref 均不同。B 清理时 A 继续写权限并成功刷新原浏览器会话；B 清理报告 `cleaned`，社区归档并保留初始 lord。随后 B 的新 run 使用原 slug 得到 `slug_retained`，错误包含 `archived` 并提示换 slug；换新 slug 创建成功，返回不同 ref。A 和 B 的本轮 run 均完成清理；B 服务、dev/test 库、登记和 worktree 已回收，保留数据库清理报告。B 的依赖安装重新生成了本地前端图标。此轮不替代其他尚未完成的 home、生产隔离及完整双向 UI 验收。

**2026-11-27 归档并发修复后补测。** 基于 `04738f69e`，B 使用独立 dev/test 库完成迁移、启动、创建账号与社区、管理员邀请和接受，以及 editor 的 Dash 登录。清理预览无阻塞；执行和重复执行均返回 `cleaned`，普通管理员已移除，社区归档并保留初始 lord。B 清理同时读取 A 的独立测试账号，确认其仍为 active；随后 A 测试 run 也已清理。隔离测试覆盖订阅与归档两种锁先后顺序，验证先加入时归档回滚、先归档时加入被拒绝。B 的服务、两个库、登记、worktree 和浏览器数据已回收，保留数据库清理报告。本次针对归档修复补测，不替代上述双侧权限操作或其他待完成验收。

**2026-11-27 同 profile 双向登出补测。** B 基于 `b34b3fb88`，在独立 dev/test 库及其受管服务中与 A 分别创建不同的账号和社区。使用同一个临时 Chrome 会话的两个 Dash 标签，以各环境的开发账号登录入口建立真实会话；两个实际社区页面各自读回对应账号。A 登出并刷新后为匿名，B 刷新仍为原 B 用户；重新登录 A，再登出 B，B 刷新后为匿名，A 刷新仍为原 A 用户。登录和登出请求均返回 204；本轮未验证真实第三方 OAuth 回调。两侧会话退出并完成 fixture 清理，社区按策略归档并保留初始 lord；B 服务、库、登记和 worktree 已回收。页面控制台另报告测试社区默认图标域名解析失败，以及 B 的主题偏好 Cookie 回退为单主机；这些不属于本次登录会话断言。

**2026-11-27 合并 case 与 home 补测。** 在合并候选 `e59ca2490` 的空 B 库和本地 Assets 上，两次 `pnpm seed home prepare` 返回相同 ref；核对 7 篇文章、两套壁纸、8 个图片，8 个本地资产地址均返回 200，Community 的 home 页面显示 4 篇预期 Post。首次尝试时 Phoenix 未获 Hub 的 Assets capability 密钥，修复注入后重新创建空库并通过。主题编辑权限、待接受邀请和已接受邀请三个 case 经受管入口创建，核对权限及待处理状态，预览并清理均成功；待接受邀请的前端交互尚未验收。`doctor --service assets-hub` 在依赖运行时报告 `running`，停止 B 的 Phoenix 后报告 `not-ready`。B 的服务、dev/test 库、登记、worktree 和本地资产已回收；测试仅针对 B，不代替生产隔离验收。

**2026-11-28 主题权限 UI 补测。** 使用候选 `24533ed52` 的临时 B，创建独立 dev/test 库并迁移 dev，启动 Dash 依赖后运行 `theme-edit-permission` case。核对 owner 为 lord，editor 有 `dashboard.theme.update`，limited 无该权限；两人分别以真实会话打开 B 的主题页面。editor 从 Default 选择 Claude 并保存，重新进入页面仍为 Claude；limited 刷新后选择 Solarized 并保存，Dash 记录服务端返回 `PassportError: your passport not qualified`，再次刷新仍为 Claude，B 的只读 DB 查询也读到 `claude`。清理预览无阻塞，apply 返回 `cleaned`，移除两名普通管理员、归档社区并保留初始 lord；B 服务、两库、登记、浏览器及 worktree 已回收，保留删库报告。A 的五项原有服务在回收后仍运行；A 的 `db inspect` 因主库认领记录缺失而拒绝，未核实 A 库中对应 slug。此轮只证明 B 的 UI 权限与清理，不代替完整双向 UI 写入和 A 原会话验收。

**2026-11-28 双环境主题 UI 补测。** 候选 `67dcd5e8e` 的 A、临时 B 用同名 run 和 slug 创建各自的主题权限 case，社区引用及账号不同。两侧 editor 并行通过 Dash 保存不同主题：A 为 Claude，B 为 Solarized；两侧 limited 刷新后尝试对换主题，均返回权限不足，随后 editor 刷新仍读到各自原值，B 只读数据库确认 `solarized`。B 清理时 A 原 editor 会话保存 HN 并刷新读回；停止 B 后同一 A 会话再次保存 Default 并刷新读回，均未重新登录。两侧清理预览无阻塞，apply 均返回 `cleaned`，普通管理员移除、社区归档且初始 lord 保留；B 服务、dev/test 库、登记、浏览器和 worktree 已回收，保留删库报告，A 五项原有服务仍运行。A 的受管 dev 库只读入口因缺少主库认领记录未能直接查询；此轮也未交换停止方向或验证验收前已有的 A 浏览器会话。

以下场景使用现有[本地账号命令](../auth/local-test-actors.md)。先记录 A 原有 Hub、服务、库、浏览器与资产基线，保持 A 的窗口可用；在 B 从空开发库完成上一节迁移与 seed 后再操作 fixture。两边各自记录 checkout 真实路径、HEAD、instanceId、服务进程归属、实际库、迁移版本与产品 URL。示例 run 和 slug 仅供本轮使用；重跑已封存的场景时，两边同步换一对未占用的 run 和 slug。另用一次性 checkout 验证孤儿、primary 交接和回滚，避免占用正在调试的 A。

**1. 从各自终端运行同一组命令。** 同名 run、alias、slug 故意制造碰撞。每个环境分别执行：

```sh
pnpm devhub start dash
pnpm devhub actors create --run parallel-theme --alias owner
pnpm devhub actors create --run parallel-theme --alias editor
pnpm devhub actors create --run parallel-theme --alias limited
pnpm devhub communities create --run parallel-theme --owner owner --slug theme-demo
pnpm devhub actors grant --run parallel-theme --as editor --community theme-demo --by owner --permissions dashboard.theme.update
pnpm devhub actors grant --run parallel-theme --as limited --community theme-demo --by owner --permissions dashboard.rss.update
pnpm devhub actors list --run parallel-theme
pnpm devhub actors open --run parallel-theme --as owner --community theme-demo
pnpm devhub actors open --run parallel-theme --as editor --community theme-demo
pnpm devhub actors open --run parallel-theme --as limited --community theme-demo
```

逐侧核对实际 login、community ref、初始 lord、两份普通 Admin 成员资格及有效权限。受限 Admin 的示例授予另一项社区权限；按本分支 Catalog 核对两人都能进入待测页面且只有 editor 有主题写权限。普通授权经过真实邀请、接受和成员更新；新建社区使用原有 Command、默认配置与 Lifecycle。通过各自的只读数据库入口按返回的 community ref 和账号查询社区、成员及权限记录，对照页面上的 viewer 和资源标记。重复同一账号、建社区和授权请求，确认复用本库记录且无重复有效成员。另用不同 run 对同名已登记社区发起创建，必须报告冲突。观测 [fixture POST](../../local/dev-hub/src/server/local-test-command.ts)、[浏览器登录](../../local/dev-hub/src/server/local-test-browser.ts)、SSR、浏览器 API 和资产请求的实际落点；仅查看 CLI 醒目的环境名不足以判定通过。

**2. 验证实际权限与会话。** 每个 actor 用独立 profile。A 的 editor 通过 Dash 执行 `selectThemePreset`，同时 B 的 limited 尝试同一动作。记录 viewer、社区、Phoenix 业务结果与库内主题预设。交换两边角色和可辨认的预设值再做一次，刷新确认各自读取本库。受限侧必须到达权限判断；若 UI 隐藏按钮，用该受限会话调用同一业务入口核对拒绝原因。单独验证跨环境 service token 与用户 token 的签名或 issuer 拒绝，包括把外环境 token 置于接收方预期的 Cookie 名或头。依次登出两边的 limited，确认另一边仍可读，有权账号原会话继续有效；报告隐去 token 和会话引用。

**3. 覆盖已有资源。** 在 seeded `home` 使用另一 run 创建专用测试 owner，再以 `actors grant … --community home --role lord` 显式初始化，普通 Admin 仍用 `--by owner` 和明确权限。记录原有成员及内容。若验收文章权限，用 `articles create` 建立该测试 owner 的 Post，再用返回的 `articleId` 授予 co-author，核对普通成员与作者权限；清理报告列出保留的文章和历史。两环境的 fixture 命令在选错库、实例或缺少授权时均须在业务写入前失败。

**4. 预览、清理、读回。** 在 B 使用下列命令；已有 `home` 的另一 run 也各自预览、执行。模拟有外来成员或所有者变更，确认清理报告阻塞；模拟某一步失败，记录已完成和待清理的资源，解决原因后按同一 run 重试。

```sh
pnpm devhub actors clean --run parallel-theme
pnpm devhub actors clean --run parallel-theme --apply
```

逐项核对 B 的会话已撤销，待接受邀请已取消（用 `--pending` 单设一例），测试授权已撤销，只有 run 创建的社区被归档，profiles 已回收；账号、内容和审计历史保留。`home` 及原有成员保持基线。单独验证 `actors close` 只封存 run、撤销会话及回收浏览器，`actors browsers-clean` 仅回收浏览器。清理 B 前后都用 **A 原 editor 窗口**更新主题并查库，全程不重新登录。显式停止和重启本次创建的 B Hub，核对 A 的路由、进程、会话与数据；在一次性双环境中交换停止方向，验证 B 的原会话同样可继续写。

**5. 恢复基线。** 报告按实例、库用途、run、社区 ref 和 actor 列出创建、复用、清理、保留及受阻的资源。A 原 editor 完成最后一次查库后，对 A 本次创建的 run 同样预览并执行清理，再用 A 验收前已有的会话验证原有社区。成功和故意失败各演练一次。只停止本次新启用的服务、释放本次创建的路由和监听；保留复用的 Hub 与他人会话。数据库的保留或显式回收使用前述准入规则。最后核对 A 原有服务集和原窗口。随公共入口更新 AGENTS、本地开发手册与 Dev Hub、fixtures、cleanup 技能，说明旧协议实例的诊断与交接；让 agent 从新 checkout 仅凭公共命令完成上述流程。

### 生产隔离验收（第一阶段通过条件）

复用[统一本地环境的生产验收矩阵](dev-hub-local-environment.md)。在隔离的构建环境用合成凭据、可观测的本地替身和现有 build / dry-run；全程无需连接生产数据库、调用线上鉴权、发布或执行远端迁移。每组记录运行入口、有效配置、请求目的地与通过或阻塞原因，证据脱敏。

| 方向                           | 用例                                                                                                                                                                | 必须观察到                                                                                                                                                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 生产入口独立于 Hub             | 对 Auth、Phoenix、Assets Hub、Dash 各跑两组：无 registry/私有目录；存在 B 的配置并在父环境混入本地 DB、域名、Cookie、issuer、JWK、fixture 开关及可检索的测试 secret | 两组均由生产入口选择部署配置。Phoenix release / 迁移入口解析注入的测试用部署 DB；生产域名、Cookie 名和域、issuer、JWKS、受众和 Worker bindings 符合部署契约。无本地文件依赖、localhost 回退或客户端产物泄露测试 secret；Auth/Phoenix 的开发登录与 fixture 路由不可用 |
| 本地操作只写本地或专用测试资源 | 在 B 对 DB、fixture、seed、搜索索引、Assets 写入/删除和后台任务检查目的地。注入冲突的远端目标与部署环境标记，使用请求捕获器记录尝试                                 | 错误 DB/部署模式在首次写之前拒绝。可写外部集成使用批准的测试资源或关闭；B 不复用 A 的目标，捕获器中无发往生产的写入。Status 的本地 D1 命令只触达它自己的本地状态                                                                                                     |
| 原有操作可回归                 | 干净 checkout 跑现有 CI 临时库迁移；按既有发布入口做配置测试或 dry-run，再复查原单环境开发入口                                                                      | CI 和部署流程可脱离本机登记；本地命令不会触发部署或远端迁移。A 的原数据、产品 URL 和登录可复验。缺少构建前提的项目标为受阻，补测前本项保持待验收                                                                                                                     |

Phoenix 生产 runtime 允许部署环境显式提供 `SERVICE_AUTH_ISSUER`、`SERVICE_AUTH_JWKS_URL` 和 `SERVICE_AUTH_TOKEN_ENDPOINT`。隔离演练确认本地地址原先会覆盖生产默认值；现在 prod 与 seed_prod 检测到 loopback 或 `.localhost` 地址时会在启动前报错，保留其他部署地址的显式配置。这个拒绝路径不等于完整生产隔离矩阵已通过：实际部署注入来源、其他服务以及生产构建产物仍须按上表验收。[Phoenix runtime 配置](../../backend/api/config/runtime.exs)

服务令牌验证器使用两套独立合成 RSA 密钥与 issuer 双向测试：每侧接受自身令牌、拒绝另一侧令牌。该测试只覆盖 Phoenix 验证器的隔离，不代表其他服务或实际部署密钥已经验收。[验证器测试](../../backend/api/test/groupher_server_web/service_auth_verifier_test.exs)

**2026-11-28 实际服务凭据交换。** 使用候选 `00fbc2669` 的 A 和临时 B，通过各自本地 Auth 用受管 Press 服务身份获取 `press:site:read` 令牌，再向两侧本机 Phoenix 的 `pressSiteManifest` 查询交叉发送。A、B 各自令牌分别读回 A 的 home 和 B 的测试社区；两种跨环境请求均返回“service identity could not be verified”，没有返回目标社区。密钥和令牌仅在测试进程内使用。B 的测试 run 清理返回 `cleaned`，社区归档，B 服务、两库、登记和 worktree 已回收；A 原服务保持运行。此验证覆盖本地 Press → Phoenix 身份链，不代表所有服务或生产部署凭据已验收。

浏览器访问令牌使用两份随机合成环境密钥双向测试：每侧接受自己的签名并拒绝另一侧签名。该测试验证 Phoenix 的浏览器访问令牌验签，不代替实际 A、B 之间交换 Cookie 或请求头的验收。[浏览器令牌测试](../../backend/api/test/helper/guardian_browser_environment_isolation_test.exs)

**2026-11-28 实际用户凭据交换。** 使用候选 `f9f85875c` 的 A 和临时 B，分别通过各自受管 Auth 为不同的测试 editor 建立真实会话。以本机 HTTPS 请求把同名 Cookie 放到接收方：各自 Auth 会话检查返回 204，跨环境均返回 401；各自 Phoenix 浏览器访问 Cookie 在 `/api/graphql` 的 `me` 查询读回对应账号，跨环境两方向均返回匿名 `me`（GraphQL HTTP 状态为 200）。凭据仅保存在测试进程内。两侧 run 已清理，B 服务、两库、登记与 worktree 已回收，A 原服务保持运行；A 的账号和归档社区按清理策略保留。该次是 HTTP 级 Cookie 交换，不是浏览器自动发送跨域 Cookie 的测试；同 profile 隔离见上文。

本次用临时构建目录和合成配置执行 Phoenix `prod` 编译及 `mix run --no-start`：干净配置读取生产默认 issuer，且不加载开发 fixture 模块或路由；注入同级 `.localhost` issuer 时在应用启动前拒绝。另用配置测试覆盖 prod、seed_prod 的 issuer/JWKS/token 三项本地地址。没有启动应用、连接数据库或线上服务；临时构建目录已删除。

Auth 和 Assets Hub 的生产 Node 入口不再读取本地 dotenv；生产进程的身份服务或 Phoenix 地址指向本机、或 Assets Hub 被设为本地存储模式时拒绝启动。它们的单测覆盖这些分支；Worker 配置测试也验证混入本地地址时仍选用生产服务地址。Assets Worker 的现有生产配置仍引用名为 `groupher-assets-dev` 的 R2 与 `groupher-asset-delete-dev` 队列，这是既有配置而非本次新建的隔离资源；实际线上资源归属与读写影响尚未核验，不得因为名称推断隔离，也不得在本次验收中改写它们。[现有绑定](../../backend/assets-hub/cloudflare.config.ts) · [历史状态](../assets-hub/v2.md)

**2026-11-27 Node 生产构建补测。** 用现有 Auth 和 Assets Hub 构建命令的 esbuild 参数，在临时目录分别执行移除三项探针变量、以及注入本地 DB 名、`.localhost` issuer 与测试秘密标记的两组构建；四个 bundle 均生成，均不包含测试标记。Auth 和 Assets Hub 对应生产配置及环境单测分别为 4 项、11 项通过。此检查仍使用当前 checkout，不等于无本地状态的独立构建，也不覆盖 Dash 产物、实际部署注入或 Worker 绑定矩阵。

**2026-11-28 Node 正式构建复测。** 在候选 `3810ffb7c` 的独立 B checkout 复用 pnpm 缓存，以空临时 HOME 和禁止出站网络执行 Auth、Assets Hub 各自的 `pnpm --filter … run build`。无污染和注入本机数据库、`.localhost` issuer、Auth 地址及合成秘密两组共四次均成功；合成秘密未出现在 bundle，同一应用两组 bundle 的 SHA-256 一致。Auth 的生产边界、配置、环境和本地登录测试共 11 项通过；Assets Hub 的生产配置、环境及本地存储测试共 14 项通过。B 随后回收。本次未启动生产进程或核验实际部署注入与线上资源。

**2026-11-28 Dash 生产构建补测。** 在 B 的独立 checkout 和空 HOME 下，禁止出站网络执行真实生产构建；Worker 配置使用生产 API、Auth 及 secret binding，客户端使用生产 Auth 地址。混入本地 `NEXT_PUBLIC_AUTH_ENDPOINT` 时，原配置会将其写入生产客户端；修复后构建在输出前拒绝该地址，并保留合法生产覆盖。无该污染值的生产构建再次通过。没有部署或连接线上服务；实际部署环境注入仍需按既有发布流程核对。

Dash Worker 的配置测试验证污染的本地 API 和身份服务地址不会覆盖生产端点，但源码同时在生产模式读取父环境的 `DASH_DEFAULT_COMMUNITY`；这个行为在 `dev` 基线已存在，也可能是部署方有意使用的覆盖项。若构建进程继承该本地值，生产默认社区会随之改变；完整矩阵在确认部署注入方式并隔离本地与正式覆盖之前仍未通过，本批不擅自删除原有生产覆盖能力。

## 非目标与风险

### 非目标

- 第三方 OAuth 回调的本地验收；actor 只替代登录交互。
- 所有子应用和依赖链同时并发；阶段 1 只承诺所选三个服务及该路径实际依赖。
- 跨主机、远程或容器内开发；本方案只覆盖同一台机器。
- 同一 worktree 内多个 agent 的数据隔离；它们共享同一套运行时和数据库。
- 桌面 tabs；见第二阶段。

### 主要风险

| 风险                                    | 处理                                                                              |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| 遗留 Hub 或子进程占用端口、数据库连接   | 进程组 + `status`/`down` + 启动时清理本环境孤儿，不做自动重启                     |
| 两个 Hub 并发同步 Portless 或版本不一致 | 跨进程锁串行化；启动时校验版本，不匹配拒绝并诊断                                  |
| 新域名不解析，验收表现为“登录失败”      | 批次 2 前置检查域名解析；明确 hosts 步骤                                          |
| 写死的开发地址漏改，B 的页面仍打 A      | 批次 2 列清单并以 B 的 SSR/GraphQL 落点做断言                                     |
| 两库迁移版本漂移或复用到旧库            | 每库记录迁移版本；fixture 前核对库名与归属标记                                    |
| 新环境首次产品联调缺少域名解析          | 预检报告缺失条目；无免密 helper 的非 TTY setup 立即返回；可选受限 NOPASSWD helper |
| 桌面或终端退出误杀仍在使用的环境        | 生命周期归 `devhub`；桌面退出不终止 Hub，停止需显式操作                           |
| 旧桌面或旧前台终端仍持有 4310 上的 Hub  | legacy 只读诊断，不写接管；显式交接；批次 1 交付桌面退出不杀 Hub                  |
| `down` 只结束 Hub，产品子进程残留       | 先经 Hub 优雅停服务，再核对进程组与监听；未知归属留给诊断                         |
| 两环境服务端口冲突或重启后漂移          | 每环境端口池 + 运行记录持久化 + 锁内预留；重启沿用同一结果                        |

若第一阶段无法在合理成本内通过，在专用演练环境回滚到单环境入口：停止本次创建的运行时、释放路由与监听、保留数据库供诊断或明确回收，并确认 `make dev` 与既有单环境流程仍可用。回滚演练的完成条件：关闭 B、恢复默认 checkout 的旧入口后，原数据库、产品 URL 与登录均可用；A 的登记与运行记录已按显式操作清除，不留被误认的遗留实例。

## 第二阶段 · 一个桌面窗口，每个 worktree 一个 tab

依赖第一阶段通过。Tauri 复用单实例窗口；tab 只是视图，不合并运行时——每个 tab 仍连到该 checkout 的 Hub。第二次启动携带发起方的 checkout，按第一阶段登记定位或启动 Hub。桌面端按环境连接状态、日志、服务命令与产品链接，不另行分配端口或选择数据库。每个 tab 显示目录名、分支和可核对的完整路径。CLI 始终按调用方所在 checkout 路由。

`make dev` 在这一阶段表示“确保环境并打开或聚焦对应 tab”；`make dev.hub` 保留为前台 Hub 入口，行为与第一阶段一致：已有常驻实例时拒绝启动并提示先 `down`，Ctrl-C 只结束它自己启动的进程。第二次启动需要把 checkout 参数转交给已运行的桌面实例，不能像[现有启动器](../../local/dev-hub/src-tauri/src/main.rs)那样忽略后续参数。

| 操作                                         | 验收标准                                                                                   |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 在 A 连续执行两次 make dev，再从 B 执行      | 只有一个桌面窗口，A 复用原 tab，B 获得独立 tab；两套 Hub 都可验明归属。                    |
| 在桌面查看 B，同时从 A 执行 actor 或服务命令 | 命令只作用于 A；切换 tab 不会重启服务或改变 CLI 的目标。                                   |
| 关闭 tab、退出并重新打开桌面应用             | 关闭视图只影响展示，重新打开可发现仍在运行的环境；显式停止某环境时核对实例，仅停止该环境。 |
| 目标 checkout 的 Hub 版本不兼容或身份不符    | 在对应 tab 显示路径和诊断，禁用该环境的控制操作，其他 tab 继续工作。                       |

第二阶段保留可控的前台 Hub 入口供 CLI、自动化与桌面故障诊断使用。桌面启动与退出均应基于实例身份，替换[现有桌面启动器](../../local/dev-hub/src-tauri/src/main.rs)对固定管理地址的依赖。

`pnpm devhub identity` 可只读核验当前 checkout 的已登记实例，返回路径、实例 ID、模式和本机地址；它不会启动 Hub。身份缺失或不匹配时失败，供桌面重新发现环境时使用。

桌面启动器实现了 `--repo-root <绝对路径>` 参数转交、各 checkout 的标签页和运行中环境的只读发现。页面加载前同时核验 Hub 和 HTML 的实例身份；尚未更新的运行中 Hub 在对应标签页报错，不自动重启。关闭标签页或桌面应用不停止 Hub。A、B 的新版页面和 B 的原生窗口操作已实测。

2026-11-28 使用独立应用标识的临时 macOS 构建验证：`open -n` 第二次启动时，已运行进程的单实例回调收到 B 的完整 `--repo-root` 参数；该次测试未验证标签页实际聚焦或产品链接，当时自动化未能读取测试应用的窗口。

同日用 `9d600b80e` 再次实测原生窗口：先打开 A，再通过 `open -n -a` 从 B 传入路径，窗口显示两个标签并聚焦 B。B 页面显示 Live，可在标签内启动并停止 B 的 Dev Gateway；其本地地址能在系统 Chrome 中打开。关闭 B 标签后服务仍运行，重新打开标签后保留运行状态；退出测试桌面进程后 B Hub 仍存活，重新启动桌面时能再次发现 A、B。A 的旧 Hub 页面缺少新协议身份，在 A 标签报告不兼容；A Hub 没有重启。因此本轮覆盖了 B 的真实页面、标签切换、链接和旧版隔离提示，但没有验证 A、B 两个新版页面同时 Live，也不把网关的后端未启动时返回的 500 当作产品页面验收。

随后按要求重启 A 的 Hub，并恢复重启前的 Dev Gateway、Auth、Phoenix、Assets Hub 和 Dash，健康检查通过。基于 `ad1dabec6` 的 B 与 A 在同一测试桌面窗口中分别显示 Live；从 B 标签启动 B 的 Dev Gateway 后，A 标签仍显示原有五个服务运行。此次测试不包含 B 的业务页面或数据操作；那些结果见批次 4 的独立实测。

受管 Hub 返回的 HTML 带有服务端实例 ID 和 checkout 路径；页面首次查询、连接重建及每次控制写入前均核对身份。端口被其他实例复用时，页面显示断开并拒绝控制，需要刷新后重新确认目标。缺少实例身份的旧 Hub 只读。该保护不代表多 tab 已验收。

2026-11-28 在 `fe109d690` 的临时 B 实测：浏览器保持原页面，停止并重启 B Hub 后地址仍为 `127.0.0.1:4313`、实例 ID 改变；页面显示断开、身份变化提示和不可操作的服务，刷新后重新绑定并显示 Live。停启期间浏览器记录连接错误。A 的 Hub 未重启；本次 B 的 Hub、开发库、测试库、登记与 worktree 已回收。

同日对 `01f0ad2a7` 补测了服务端页面身份：B 返回的 HTML 包含其实际 checkout 和实例 ID，浏览器初次加载显示 Live；B 重启后原页面显示身份变化和断开，刷新后恢复 Live。首次查询前实例已变更的顺序由定向测试覆盖；本轮 B 资源已回收。
