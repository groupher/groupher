# 本地 seed 工具箱

> 状态：实施中。`pnpm seed` 的账号、社区、管理员、场景和清理入口已接入；文中的完整验收及跨进程恢复仍未全部完成。可用命令和保留策略见[本地测试账号与社区手册](../auth/local-test-actors.md)。
>
> [Seed 命令示例](../../backend/api/dev/seed/README.md)随文档提供。运行示例需使用含相应业务实现的版本。

开发者或 agent 可以在当前 checkout 里只建一个社区，也可以一次准备好社区、管理员和测试文章。每个命令表达一个可独立观察的业务动作。例如邀请和接受由不同账号执行，中间的待接受状态也能单独用于测试。创建社区时自动生成的初始 lord、默认设置和生命周期由同一个业务用例维护。

## 业务入口

GraphQL resolver、seed、未来的 API 和 MCP 都只通过所属 Context 公开的业务入口执行产品动作。各适配器负责取得真实 actor 和转换参数。Context 负责权限、生命周期、版本校验、事务及适用的 Command Receipt。seed 的 run、账号别名和资源归属沿用本地开发库中的 fixture 绑定记录；外部调用者的身份取自认证凭据或委托授权。详见[多入口架构](cms-multi-entry-boundary.md)及[Context 根接口约定](backend-context-convention-over-configuration.md)。

当前仍有读取边界待收口：社区 slug 冲突分类、清理时的社区归属、生命周期及外来成员检查，以及开发专用 lord/global grant 兼容操作仍直接读取业务表。账号绑定、run 锁和清理报告属于本地工具自身状态；不应把这些工具记录变成产品 API。清理查询迁移时须保留对所有者变更、外来成员与不可读终态的失败关闭行为，不能为消除直接读取而增加绕过 Gate 的公开入口。

以建社区为例，resolver 从认证上下文取得用户，调用 `CMS.create_community(attrs, user, command_id)`。本地 CLI 传递 run 和 `--owner` 别名，由受管 Phoenix 验证管理请求、解析真实用户，再通过 seed 动作调用同一函数；社区创建 fixture 已改为使用这个公开入口。社区与成员权限首批接口已切换为动词在前的名称，resolver 和 seed 使用同一个公开入口。其余接口的问题、候选名和迁移顺序见业务批次的命名审计 `docs/architecture/resolver-context-api-naming-audit.md`。首批接口见[本文对照表](#首批动作与-context-入口)。[现有 resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/communities.ex) · 社区创建实现（`backend/api/dev/seed/community/create.ex`）

### 同一业务用例如何接入不同入口

以更新社区管理员权限为例，每个入口都要提供经过认证的操作者、目标社区和成员、期望 revision、新权限及 command ID。Context 用操作者的真实权限决定是否允许更新，并负责版本冲突、持久化和重试结果。邀请、接受和更新各有自己的操作者与操作身份。[现有管理员 resolver](../../backend/api/lib/groupher_server_web/resolvers/cms/community_admins.ex)

| 入口                            | 请求携带什么凭据，服务端如何确定操作者                                                                                                                                                                                                                                                       |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 本地人或 agent 使用 `pnpm seed` | 现有管理客户端从本地 Dev Hub 的服务端密钥 `auth:session-secret` 派生 fixture 管理凭据，通过 `X-Groupher-Local-Test` 发给受管 Phoenix。这条请求独立于当前浏览器登录会话。凭据用于验证本地管理请求；环境和目标库通过检查后，Phoenix 才按 run 绑定把 `--owner alice` 等别名解析为真实测试账号。 |
| 已登录网页调用 GraphQL          | 浏览器随请求发送登录 Cookie。服务端验证用户会话，将当前用户放入 resolver 的认证上下文。                                                                                                                                                                                                      |
| 未来 API / MCP / agent          | 客户端携带获发的访问凭据。agent 代表用户操作时，由服务端验证委托 token，确定它能代表谁、能执行哪些操作以及可访问哪些资源。Context 仍按该用户的实际业务权限作出决定。                                                                                                                         |

第一批限定在已确认的主 checkout 和既有单环境。CLI 核对 Hub 的 repoRoot，受管 Phoenix 通过现有 Guard 核对标准本地开发库。管理凭据无效、目标不符或所需服务未运行时，在业务写入前返回错误。多 worktree 的登记、库内标记和 Phoenix 端点解析由后续批次交付。开发身份注册、按 run 选取合成账号和 fixture 回收只在已准入的本地管理路径使用；正式 API/MCP 的操作者始终来自认证上下文。建测试账号和为它开启浏览器会话是两个独立操作。[管理客户端](../../local/dev-hub/src/server/local-test-command.ts) · [管理请求鉴权](../../backend/api/dev/local_test_actors/controller.ex) · 开发库准入（`backend/api/dev/seed/target.ex`）

本地 agent 准备测试数据时使用 `pnpm seed`。面向用户的 agent 代用户建社区时，经正式 API 或 MCP 携带用户或委托身份调用同一个 CMS 用例。正式入口独立于本机 Hub、pnpm 与 fixture run。接入工作集中在凭据与委托校验、参数映射和结果映射。用同一组业务契约用例验证允许、拒绝、过期 revision、丢失响应后的重试。若新增入口还要复制权限判定、事务或 Receipt 恢复，应先把缺失的行为收进 Context，再接入口。

## 建议目录

首批扩展现有管理链路，每个命令只在客户端解析一次。

| 落点                                                                                                 | 首批职责                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 仓库根 `package.json`、`local/dev-hub/src/server/cli.ts`                                             | 新增 `seed` script，启动同一 TS CLI 的 seed 分支。既有 Dev Hub fixture 命令保留兼容语法。                                                                                                                                          |
| `local/dev-hub/src/server/local-test-command.ts`                                                     | 将两套命令拼写映射到共同动作。复用 actor、community 创建和清理路径，新增 `admin invite/accept/set-permissions/remove` 的参数校验和映射。现有 `actors grant` 继续组合邀请、决策与权限更新。                                         |
| `backend/api/dev/local_test_actors/controller.ex`、`local_test_actors.ex`（位于 `backend/api/dev/`） | 现有 `POST /__local-test/actors` 校验管理请求并调用 `LocalTestActors.execute/1`。普通写操作通过 Guard，进入事务并取得 run 写锁，再由扩展的 `dispatch/3` 分派给 seed 动作。`cleanup --apply` 通过同一 Guard，按下文清理顺序取得锁。 |

Elixir 动作放在 `backend/api/dev/seed/`，利用现有开发编译路径，由受管 Phoenix 执行。Dev Hub 管理服务、登录会话和浏览器。下图列出各原子入口；权限更新与移除共用 `admin/membership.ex` 中的操作身份和版本处理。[Mix 配置](../../backend/api/mix.exs)

```text
backend/api/dev/
└── seed/
    ├── README.md                     # 实现后的操作手册、命令示例和返回字段
    ├── target.ex                     # 首批复用 Guard 核验开发库，多 worktree 阶段追加归属标记
    ├── run.ex                        # 复用 fixture 归属记录，解析别名、操作 key 和资源引用
    ├── actor/create.ex               # 通过开发身份入口注册或复用 run 的测试账号
    ├── community/create.ex           # 由指定 owner 创建社区，返回 community ref 和 lord 身份
    ├── community/request_destroy.ex  # 为 run 拥有的社区请求销毁，返回实际生命周期状态
    ├── admin/invite.ex               # 由有权成员发出邀请，返回邀请引用
    ├── admin/accept.ex               # 由受邀人接受邀请，返回成员引用及 revision
    ├── admin/set_permissions.ex      # 由授权人按成员 revision 更新权限集合
    ├── admin/remove.ex               # 移除 run 拥有且允许清理的成员关系
    ├── admin/membership.ex           # 共用成员操作身份、版本和重试处理
    ├── article/create.ex             # 通过现有 Content Publisher 链准备草稿或创建并发布 Post
    ├── scenario/theme_permissions.ex # 组合出 owner、可改主题的 editor、无此权限的 limited
    ├── cleanup/run.ex                # 预览或执行回收，列出保留、受阻及可重试的资源
    └── home/
        └── prepare.ex                # 核对本地目标，将 DB 与资产端点交给共享的 LiteHome
```

账号、社区、管理员和场景动作使用 `run(run, opts)` 形式并返回 `{:ok, result}` 或 `{:error, reason}`。文章跨进程步骤使用 `prepare/2` 和 `record/2`，清理使用 `report/1` 和 `apply/1`，home 使用 `run/0`；这些入口均由受管分发调用。管理请求通过准入后，场景在服务端组合动作函数，每个步骤按实际 actor 执行业务校验。现有 Dev Hub 命令沿用同一份身份绑定、邀请记录和清理语义。文章的 canonical 内容继续由 Content Publisher 产生，Phoenix 通过公开业务入口执行对应操作。[文章 fixture 流程](../auth/local-test-actors.md#create-an-owner-bound-article-fixture)

### 首批动作与 Context 入口

下表列出当前可调用的函数。首批九个接口已切换为动词在前的名称，resolver 与 seed 同步使用新名。

| seed 或清理动作                                  | 受管服务端调用的 CMS 根接口                                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| 创建社区、请求销毁本次创建的社区                 | `CMS.create_community/3`、`CMS.request_community_destruction/3`                                                        |
| 查询当前账号的社区成员关系与权限校验             | `CMS.get_current_community_admin_membership/2`、`CMS.passport_validate_permissions/2`                                  |
| 查询本人关系和待处理邀请                         | `CMS.list_own_community_admin_memberships/1`、`CMS.list_own_pending_community_admin_requests/1`，以及对应 Article co-author 接口 |
| 核对文章归属和已发布快照                         | `CMS.verify_post_creation/2`，按当前 actor 的历史读取权限核验创建与发布证据                                           |
| 邀请、接受、取消管理员邀请                       | `CMS.create_community_admin_request/6`、`CMS.decide_community_admin_request/6`、`CMS.cancel_community_admin_request/4` |
| 更新普通管理员权限、移除普通管理员               | `CMS.update_community_admin_permissions/6`、`CMS.remove_community_admin/5`                                             |
| 清理待决 co-author 邀请、退出 co-author 成员关系 | `CMS.cancel_article_co_author_request/4`、`CMS.leave_article_co_author_role/4`                                         |

普通管理员的邀请、授权和移除在单步命令、组合场景及清理中都走表内入口。Remove 负责计数、活动记录，并对 lord 返回 `lord_membership_immutable`。首批沿用受管开发环境专用的测试 lord 回收能力，按成员关系逐项判断归属。[CMS 公开入口](../../backend/api/lib/groupher_server/cms.ex) · [权限 fixture](../../backend/api/dev/local_test_actors/grants.ex) · 清理实现（`backend/api/dev/seed/cleanup/run.ex`）

| lord 来源                                    | 首批清理契约                                                                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| run 创建社区时生成的初始 lord                | 公开 create 返回社区。seed 在同一外层事务内以 owner 调用公开的 `CMS.get_current_community_admin_membership(community.ref, owner)`，核对返回的 `is_lord`，将其 `member_id` 与 community ref、owner 一起登记。该入口直接查询当前 actor，避免依赖分页；查询或绑定失败时回滚。清理核对归属和外来成员，以公开的 `request_destroy` 请求归档，再读回生命周期。首批可达的 `archived` 允许恢复，初始 lord 按策略保留。 |
| 兼容命令在共享社区（如 home）授予的测试 lord | 授权时在同一事务记录 community ref、合成账号、member ID 及本次是新增还是复用。同一 run 再次 grant 须沿用首次登记的归属。仅回收本 run 新增且仍匹配的关系；首次调用前已存在且有明确基线的 lord 按策略保留。                                                                                                                                                                                                     |

首批只验收通过根 Context 可达的归档，不为 seed 暴露调度或销毁操作。若读到其他流程已推进到 `pending_destroy` 或 `destroy`，报告实际状态并保留初始 lord；终态回收留待后续批次。run 封存与测试会话撤销仍按清理流程执行。[请求销毁的业务入口](../../backend/api/lib/groupher_server/cms/communities/commands/request_destroy.ex) · [归档与恢复](../../backend/api/lib/groupher_server/cms/communities/lifecycle.ex) · [成员查询投影](../../backend/api/lib/groupher_server/cms/communities/admins/query.ex)

生成最终清理清单时替换现有逐行 `remove_admin` 分派。已归档社区的初始 lord、共享社区有基线的既有 lord 只进入保留清单；来源未知的关系进入受阻清单。应回收的普通成员走公开 Remove，只有本 run 新增且归属已核实的共享社区测试 lord 才进入专用回收。删除时在事务内锁定并复核成员，同步更新管理员计数和活动记录。

迁移现有 `complete?` 时，将 `remaining.admins == 0` 改为“应回收的管理员关系已清零，且无归属未知或受阻项”。已归档社区的初始 lord 和有基线的既有 lord 在报告中单列。其余清理项仍须满足各自的完成条件。历史绑定证据不足、owner 变更或出现外来成员时报告原因，不能仅凭账号属于 run 删除授权。此例外仅限本地 fixture 管理，产品 API、MCP 及普通 `admin remove` 继续执行 lord 保护。

`pnpm devhub actors grant --scope global` 首批保留兼容，新增的 seed 命令面不提供全局授权。现行授予调用 `CMS.Passport.grant_in_transaction`，撤销会按用户删除非 root 的 GlobalPassport 和旧 Passport 行。兼容路径须保留可核对的本次授权及原有权限，清理只撤销可归属的变更；既有授权有后续修改或旧数据归属无法核实时保留并报告受阻。

实现 PR 新增 `scripts/check-dev-fixture-boundary.mjs` 和根脚本 `check:dev-fixture`，接入 push 与 PR 已运行的 `docs:check`。检查覆盖新动作和 `communities.ex`、`grants.ex`、`cleanup.ex` 的迁移点，识别直接或通过 alias 调用内部 Command、Query 和写业务表的行为。例外按具体调用点登记允许操作及理由，覆盖 fixture 绑定、受管测试 lord 的初始化与回收，以及兼容 global 授予与按归属撤销。按用户批量删除 Passport 的现行实现须收窄后才能通过。账号注册和会话撤销先核对 Accounts/Auth 的公开入口。[CI 工作流](../../.github/workflows/documentation.yml)

### home 与生产 seed

`home/prepare.ex` 在受管入口准入后串行调用共享的 LiteHome。文章、标签与壁纸的准备逻辑仍归 LiteHome；`make be.seed.home` 委托 `pnpm seed home prepare`。本地运行前需先建库并迁移，再启动 Hub、受管 Phoenix、Auth 和 Assets；壁纸上传完成时由运行中的 Phoenix 接收 Assets 回调。数据库和资产端点取自同一已核实环境。受管开发环境将发布间隔设为零并放宽小时、日限额；发布仍经过 Gate 和计数，`MIX_ENV=test` 和生产配置不变。空库连续两次 prepare 及壁纸回调仍需真实环境验收。生产 `MIX_ENV=seed_prod` 继续从原脚本调用共享实现，构建及运行均独立于 `dev/` 和本机 Hub。[LiteHome](../../backend/api/lib/groupher_server/cms/seeds/lite_home.ex) · [Make 入口](../../Makefile) · [生产脚本](../../backend/api/scripts/seed_lite_home_prod.sh)

## 命令与资源身份

在当前 checkout 的仓库根目录执行。以下单步示例把同一份邀请留给受邀账号接受；调试待接受的 UI 时可以停在第四步。

```sh
pnpm seed actor create --run theme-demo --alias owner
pnpm seed actor create --run theme-demo --alias editor
pnpm seed community create --run theme-demo --owner owner --slug theme-demo
pnpm seed admin invite --run theme-demo --community theme-demo --by owner --to editor --key editor-invite --permissions dashboard.theme.update
pnpm seed admin accept --run theme-demo --invite editor-invite --as editor
pnpm seed admin set-permissions --run theme-demo --community theme-demo --by owner --member editor --permissions dashboard.theme.update --key grant-editor-theme

# 验证完权限后，撤下这位管理员
pnpm seed admin remove --run theme-demo --community theme-demo --by owner --member editor --key remove-editor

# 可单独请求归档本 run 创建的社区；返回实际生命周期
pnpm seed community request-destroy --run theme-demo --by owner --slug theme-demo
```

也可以一次准备完整场景。例如 `pnpm seed scenario theme-permissions --run demo-2 --community theme-demo-2 --json` 会在另一 run 下创建三个测试账号、社区和对应授权。`pnpm seed home prepare` 负责常驻开发内容。普通 run 借用已有的 home 时，只记录和清理本次创建的邀请、授权等资源。

### 每一步怎样识别重试

在当前环境和 run 内，先按动作及下表的 key 查找记录，再核对调用人、目标和输入。已经使用的 key 带上不同输入时报告冲突。资源引用用于定位对象，操作 key 用于区分对同一对象先后执行的动作。

| 动作                                    | 操作 key                                                                  | 首次执行时记录的目标                                                   |
| --------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `actor create`                          | `--alias`                                                                 | 合成账号绑定和用户 ID                                                  |
| `community create`                      | `--slug`                                                                  | owner 绑定和创建的 community ref                                       |
| `community request-destroy`             | `--slug`                                                                  | owner、community ref 和原 command ID                                   |
| `admin invite`                          | 显式 `--key`                                                              | 社区、邀请人、受邀人及返回的 request ID                                |
| `admin accept`                          | `--invite` 引用的邀请 key                                                 | 原 request ID、受邀人和期望 revision                                   |
| `admin set-permissions`、`admin remove` | 每次有意发起的新操作给一个显式 `--key`                                    | 原 community ref、成员 ID、操作者、期望 revision，以及更新时的权限集合 |
| `article create`（后续批次）            | 沿用 owner 绑定下的 community ref、thread 和 key，省略 key 时取 `primary` | 返回的 article ID 和 working copy ID                                   |

**同库重复建社区。** 归档后社区行继续占用 slug，cleanup 报告列出保留的 slug、community ref 和生命周期。开放的 run 重试同一次创建时显式传原 `--slug`、owner 和输入，返回原 ref。现有 CLI 在省略 slug 时会为每次调用生成随机值。run 封存后，仅新创建请求优先返回 `local_test_run_closed`；已封存 run 的清理重试仍按清理流程。下一轮场景使用新 run 和新 slug，可直接在同一开发库执行。[现有 CLI](../../local/dev-hub/src/server/local-test-command.ts) · [slug 唯一约束](../../backend/api/lib/groupher_server/cms/model/community.ex)

fixture 对不属于当前绑定的同名社区返回 `local_test_community_collision`。核实 slug 由非活跃的保留社区占用时（`archived`、`pending_destroy`、`destroy`），CLI 和 JSON 返回 `slug_retained`，报告其生命周期并提示换用新 slug；活跃社区占用时仍返回普通冲突。两种情况都保留旧社区及其归属。首批只构造 `archived`，另外两种走防御性分类，不纳入首批主验收。seed 间竞争同一 slug 在事务内串行；与 GraphQL 等不持有该锁的入口竞争时由数据库唯一约束裁决，seed 仅对对应的 slug 唯一约束在回滚后重新核对占用者并分类，其他错误原样返回。fixture 创建逻辑（`backend/api/dev/seed/community/create.ex`）

邀请在同一个开发库事务中写入 request 和 fixture 绑定（邀请 key、actor、输入摘要、request ID）。成功响应丢失后，同 key、同输入返回原 request ID，库里只有一份邀请。

接受、更新权限和移除成员在首次调用前记录 command ID、原始 revision、目标引用及输入摘要。重试先取回这些参数，避免重新查成员别名或取最新 revision。新操作携带旧 revision 应得到版本冲突。已提交操作在 Receipt 结果有效期内按各自的 Confirmation 恢复：

| 操作                    | 用原 key 重试的可观察结果                                                                                                                                                                                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `admin accept`          | 从 Confirmation 取得 request ID，读取仍存在的请求。后来移除成员不影响该读取；请求本身已不存在时，结果不可取。                                                                                                                                                                                                                              |
| `admin set-permissions` | 公开入口成功时报告“操作已完成”，并返回 member ID、当前权限和 revision。原操作期望 revision 为 `r`，成功后为 `r+1`。若当前版本更高，CLI 和 JSON 均标明成员已有后续更新，同时返回当前权限及版本，即使权限值后来改回也可识别。结果不可取时透传 `command_result_unavailable`，不据此推断是哪次请求提交、成员为何不可读取，也不重放或重建成员。 |
| `admin remove`          | 从 Confirmation 的 `removed` 恢复移除结果，重试不依赖成员行仍在。                                                                                                                                                                                                                                                                          |

Runner 在内部区分首次执行和恢复，公开 Context 只返回业务结果。CLI 和 JSON 只描述此次调用可确认的完成状态和当前投影，不标记 `replayed` 或直读 Receipt 推断提交时机。[Receipt Runner](../../backend/api/lib/groupher_server/cms/command/receipt/runner.ex)

结果有效期以该 Receipt 的 `expires_at` 为准（当前 24 小时）。结果过期、`identity_expires_at` 仍有效时，同一已完成操作返回 `command_result_expired`。身份保留期（当前 30 天）结束后，Receipt 不再保证去重。两种情况下 CLI 都应核对 fixture 记录和实际资源，避免自动重放。[Command 契约](cms-command.md) · [Receipt Store](../../backend/api/lib/groupher_server/cms/command/receipt/store.ex)

### 目标、恢复与清理

- **目标。** 首批沿用上述主环境核验。支持多 worktree 后，写入前还须比较登记与实际连接的主机、端口、库名、用途及归属标记。跨库、远端、部署环境和无法核实的目标立即返回错误。资产写入同样核对本环境端点。测试库、迁移及整库回收仍按[数据库生命周期](dev-hub-multi-worktree.md)执行。
- **输出与重试。** `--json` 返回环境、run、步骤状态和资源引用。单库创建须在同一事务内提交业务结果和归属。同一 run、key、actor 和输入的并发创建最终返回同一 ref；输入冲突返回错误。确认提交前发生暂时性故障，可以按 Command 契约重试同一操作。权限、参数或 revision 被拒绝时返回业务错误。
- **跨进程写入（后续批次）。** 在所属开发库先提交输入摘要、command ID 和 `pending`，再发起外部操作。文章客户端依次执行 `article.prepare`、启动并验证浏览器、`article.begin`、创建文章和 `article.record`。发送前的 begin 在 run 锁下将状态从 `prepared` 改为 `dispatched`，不同调用者只有一个能成功；同一次发送使用的 attempt ID 可在下游发送前恢复丢失的 begin 响应，其他 attempt 不可取得发送权。旧客户端缺少协议版本时在 prepare 被拒绝。浏览器尚未取得 begin 时失败，可以重试准备；begin 后协调进程退出或数据库锁释放，下游仍可能提交。按原 command ID 核对下游终态、Receipt 与实际资源：已确认提交则补记 ref；确认最终失败且无资源则登记失败；确认未提交且原请求已结束才可按 Command 契约重试。只要下游仍可能提交，保持 `pending` 并阻止封存。[客户端编排](../../local/dev-hub/src/server/local-test-command.ts) · 文章 fixture（`backend/api/dev/seed/article/create.ex`）

  当前文章准备记录 UTC 时间。重复请求先通过 `CMS.find_article_creation_by_command/3` 按 command ID、操作者和社区，借助尚存的 Receipt 身份及 Article 创建历史查找已提交资源，并检查文章历史读取权限；唯一匹配且通过归属校验时补登记并返回原引用。Receipt 身份已清除时不能使用这条查询确认旧资源。没有匹配时，明确处于 `prepared` 的新协议记录可重复准备；`dispatched` 或旧记录返回 `local_test_article_recovery_required`，不自动重发。缺少可见 Receipt 无法证明已发送请求未提交或已结束；下游终态核对仍待实现。清理预览包含准备时间、发送状态与操作引用。

- **显式保留（后续批次）。** 预览给出本 run 内唯一的 `operation-ref`。操作者可用 `pnpm seed cleanup run --run <run> --apply --retain-unconfirmed <operation-ref> --reason <text>` 申请结束核对。服务端在清理锁和 run 写锁下核验操作归属及下游终态证据。只有能确认该请求已结束、资源归属仍无法判定时，才在原绑定保存 command ID、摘要、最后观测时间、终态证据、原因及“归属未确认，已保留”的决定。若下游无法提供该证据，拒绝处置。重复申请读回原决定；迟到回填在 run 写锁下复查，已有保留决定时仅追加证据。该项允许封存，清理报告持续标为部分完成，资源保留且不自动重放。

  当前预览已列出文章操作引用，申请会核对其属于本 run；由于发布链尚无可供核验的请求终态证据，当前一律返回 `local_test_terminal_evidence_unavailable`，不封存、不修改资源。成功保留的实现和验收仍待后续交付。

- **并发清理。** `pnpm seed cleanup run --run theme-demo` 仅在只读一致性快照中生成预览，不取得 run 写锁、不封存、不阻塞创建。预览只代表读取时刻；加 `--apply` 后重新核验。受管入口在 Guard 后将预览单独分派；执行清理时在取得写锁后确定最终快照并封存，避免遗漏并发写入。顺序如下。[普通写入与封存](../../backend/api/dev/local_test_actors.ex) · 清理实现（`backend/api/dev/seed/cleanup/run.ex`）
  1. 普通创建在事务内取得 `local-test-actors:<run>` 写锁，检查整个 run 的绑定后再写。任一绑定为 `closed` 即拒绝该 run 的新业务写入，包括创建从未出现过的 alias。
  2. 清理先取得 `local-test-clean:<run>` 专用锁，再在短事务内取得同一把写锁。先检查 run 和阻塞项：空 run 返回“未找到 run”，有阻塞项或已经取得发送权且仍待核对的操作则返回原因，保持绑定状态。仅在检查通过后，才在该事务内确定最终快照、取消尚未发送的 `prepared` 文章操作，并将本 run 的 fixture 绑定 `raw["status"]` 置为 `closed`。封存后 `article.begin` 无法取得发送权。
  3. 提交封存事务、释放写锁后，继续持有清理专用锁，按清单逐项执行并复查资源归属和 revision。部分失败时允许重新清理已封存的 run，最终释放专用锁。
- **资源处置。** 清理撤销测试会话与授权、取消未决邀请、退出本次 co-author 成员关系，并为本次创建的社区发起生命周期操作，按实际状态报告归档或待处理。账号、文章、审计历史和借用的社区继续保留。发现外来成员、所有者变更或部分失败时，逐项报告已完成、保留和受阻资源。[现行保留策略](../auth/local-test-actors.md#optional-cleanup)

## 第一批通过条件（单个受管开发库）

以下丢响应测试共用同一机制：测试客户端收到指定操作的成功响应后丢弃一次，让调用方按原操作身份重试。

1. 分别从 GraphQL 和 seed 经同一 Context 入口建社区，核对 owner、初始 lord、默认设置与生命周期。各丢弃一次成功响应，GraphQL 重用原 command ID，seed 显式传回相同的 `--slug`、owner 和输入，均恢复各自的原社区引用。
2. 从普通终端调用 CLI，分别验证缺少管理凭据、目标库不符时在业务写入前失败。取得合法管理身份后，受限账号仍须被业务权限拒绝。
3. 走真实邀请、接受和授权流程。GraphQL 和受管 seed 均验证受限成员修改权限被拒、合法授权人提交过期 revision 得到版本冲突。分别丢弃 invite、accept、set-permissions、remove 的一次成功响应，再用各自原 key 重试。invite 和 accept 核对原 request ID 及请求状态，set-permissions 核对成员 ID、当前 revision 和权限，remove 核对 `removed: true`，每步只产生一次业务效果。另以两个不同 key 连续更新同一成员，再重试第一步，CLI 须报告操作已完成及成员当前的后续版本。测试通过丢弃前已收到的成功响应确认首次调用已提交，并核对重试前后的 revision 和活动记录数相同。移除成员后再重试第一次更新，须返回 `command_result_unavailable` 且成员仍不存在。
4. 两个进程以相同 run、key 和输入创建社区，核对两次返回同一 ref、库中只有一个社区。模拟提交前的暂时性故障，重试同一操作。另用两个开放的 run 竞争同一可用 slug，只有一方创建成功，另一方收到普通冲突且未取得该社区的绑定。

   已在一次性 PostgreSQL 实例用独立连接验证同 run 并发返回同一 ref，以及不同 run 竞争 slug 时只有一个绑定获得社区；测试显式取得 dispatch 使用的 run 锁，调用真实社区 Context 创建流程。另在创建与绑定后、外层提交前注入回滚，确认两者均不存在，再重试得到唯一社区及原子登记的 lord。受管 HTTP 与双 worktree 场景仍需分别验收。并发测试（`backend/api/test/groupher_server/local_seed_concurrency_test.exs`）

5. 用独立数据库连接和测试进程消息在临界区同步。确认创建已持锁再放行清理，交换顺序时确认清理已取得写锁再放行创建。前者必须进入最终清理清单，后者必须被拒绝。另验预览期间可创建且 run 仍开放、空 run 的返回、有阻塞时 run 未被封存、封存后使用新 alias 被拒、清理中断后重试和其他 run 的已有资源。

   已在一次性 PostgreSQL 实例运行 actor 创建与清理的两种锁顺序测试：用独立连接和 `pg_blocking_pids` 确认等待关系，再放行持锁进程。另在创建事务持锁时运行预览，确认预览不等待、不封存，创建提交后两个账号仍为 active。该测试调用实际 actor 创建和清理模块，写入侧在测试中显式取得与 dispatch 相同的 run 锁；尚不替代受管 HTTP、社区创建或双 worktree 验收。执行 `pnpm test:seed-isolated` 会准备并回收一次性数据库及独立后端副本，再运行并发和文章恢复测试；直接执行测试时须显式设置 `TEST_SEED_CONCURRENCY=1` 并自行准备和回收库名为 `groupher_seed_concurrency` 的一次性数据库。后端 CI 在隔离的 PostgreSQL 容器内使用该专用库运行并发测试。并发测试（`backend/api/test/groupher_server/local_seed_concurrency_test.exs`） · 隔离测试入口（`scripts/test-local-seed-isolated.py`）

   文章发送申请与清理也验证了两种排队顺序：发送先取得锁时清理报告 pending；清理先取得锁时取消未发送记录，迟到申请被拒绝。这仍不证明已发送请求的下游终态。

6. 清理普通成员经公开 Remove，普通调用移除 lord 得到 `lord_membership_immutable`。自建社区经公开入口归档后，核对生命周期为 `archived`、初始 lord 的 member ID 与创建时相同、会话已撤销；其余步骤成功时报告 `cleaned` 并列出保留项。对保留的 lord，在首次 apply 前后核对同一 member ID、社区管理员计数及该成员的移除活动：计数的变化只来自实际移除的成员，该 lord 的移除活动增量为零。再执行一次清理，计数及移除活动数均不再变化。共享社区采用以下两个独立基线。

   - **本次新增。** 对尚无该成员的共享 home，用同一 run 和账号连续 grant 两次。清理后该关系消失，重复清理不再改变计数或产生移除活动。
   - **首次调用前已存在。** 由外层验收登记并负责回收一次性受管环境。在该环境内，用本 run 的合成账号经 GraphQL 创建一个供本例借用的社区，取得初始 lord 的 member ID。该社区未登记为 seed 创建。随后用同一账号向该社区执行兼容 grant，须复用同一 member ID。首次清理后读回社区仍为 `active`、member ID 与基线相同，复验重复清理后，由外层验收整体回收环境。只有日常主开发库可用时，把该基线放在使用一次性数据库的集成测试中运行。

   缺少归属证据的旧关系保持原状并报告受阻。另以兼容命令授予 global 权限，清理后读回原有权限及旧 Passport，核对其他授权未受影响。

7. 在同一开发库验收下一轮场景。清理第一轮后，先从报告读回已归档社区的 slug 和 ref。用已封存的 run 即使换新 slug 也返回 `local_test_run_closed`。用新 run 和原 slug 得到 `slug_retained`；读回原社区、owner 和绑定均未变化。随后用该新 run 和可用的新 slug 创建成功，返回不同的 ref，再清理这一轮。

## 后续集成验收

1. 待 worktree 登记、数据库及服务端点可按环境解析后，在 A、B 使用相同的 run、alias 和 slug，核对实际落库。预览并清理 B 后，A 原编辑者窗口仍能写主题并从 A 库读回。完整步骤见[双 worktree 验收](dev-hub-multi-worktree.md)。
2. **home 验收待执行。** 从空开发库执行第一次 prepare，再在同一库执行第二次。读回内容和壁纸，核对资源无重复、资产均属本环境及 Phoenix 已收到上传回调；同时验证测试与生产频控未改变。[此前受频控阻塞的实测](dev-hub-multi-worktree.md#2026-11-26-双-worktree-数据库实测)

   已在独立 PostgreSQL 实例应用当前 checkout 的 817 条迁移，以受管开发频控连续调用两次 LiteHome，确认社区引用一致，并在另一演练库恢复空库基线。该次关闭壁纸步骤，也没有经过受管 HTTP 入口；完整服务链路仍待验收。演练数据库与独立构建目录已回收。

3. 随跨进程动作交付，在隔离环境发出创建请求，在下游提交前暂停它并终止协调进程。此时申请显式保留须被拒绝，run 仍开放；放行下游提交，再按原 command ID 恢复唯一 ref，验证没有第二次创建。另模拟 fixture 确认写回失败、Receipt 结果过期但身份仍有效、结果及身份均过期，均不得自动重放。对下游已终止且归属仍未明的一项，验证显式保留的原因和证据可读、重复申请读回同一决定、迟到回填仅追加证据、报告部分完成。其他 run 的引用须被拒绝。
