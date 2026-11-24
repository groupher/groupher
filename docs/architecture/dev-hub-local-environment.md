# Dev Hub 统一本地运行环境

> 本地覆盖配置的当前实现见 [Dev Hub 集中本地配置](./dev-hub-local-config.md)：由 Hub 按服务管理 `local-dev.env`，旧应用 dotenv 文件不再是 Hub 的日常配置来源；下文保留统一身份与历史迁移背景。

> 状态：实施与验收记录；入口清单和验收矩阵见第 4、6、7 节。
>
> 基线：`5627fc9d01b59121592f058637d01aa556fe1c07`（2026-11-18）。工作树包含其他
> 未提交改动；实施不要求先提交这些改动，也不将其混入本方案的提交范围。

## 1. 背景与范围

本地开发出现过绕过 Dev Hub 另起 Vite、通过裸端口验收，以及 Dash 缺少服务 secret 的
问题。根因是配置散落在服务定义、父进程、Make、dotenv 和 Worker bindings 中，缺少
统一的准备与交付流程。为单个应用继续补 `.env` 不能解决这个问题。

目标是：通过 Dev Hub 启动任意应用时，自动获得匹配的本地配置和服务身份；开发者不用
逐个填写内部 secret，应用仍走真实的鉴权和业务流程，生产部署不读取本地生成状态。

沿用 [外部依赖服务本地运行时原则](./external-services-local-runtime.md)，复用现有服务
定义、依赖管理、Portless 和鉴权协议。本次只增加一个本地环境模块及必要的运行时适配，
不建设通用配置平台。

本次不做：generation/revision 管理、多 profile 框架、在线密钥轮换、prune/rollback 命令
体系、插件式 adapter registry，以及大型验收 runner。多工作树端口隔离、第三方服务的
离线替代、生产凭据管理和业务权限改写也不在范围内。

## 2. 保留的最小架构

```text
services.ts + service-endpoints.ts       private local state
  service needs / identity grants         stable keys and client secrets
                  |                                |
                  +----------------+---------------+
                                   v
                         local-environment.ts
                         prepare + resolve config
                                   |
                  +----------------+----------------+
                  v                v                v
              Node env        Phoenix env      Worker bindings
                  |                |                |
                  +----------------+----------------+
                                   v
                         existing ServiceManager
                                   |
                         Portless canonical HTTPS
```

职责只分三处：

- `services.ts`：继续维护服务命令、端口、依赖；补充应用实际需要的身份、配置和 bindings。
  地址引用现有 `service-endpoints.ts`。不另建一份重复的 manifest 或依赖图。
- 新增 `local/dev-hub/src/server/local-environment.ts`：读取/初始化本地状态，生成匹配的 Auth 注册信息，返回某个
  服务应获得的普通配置对象。权限名称复用共享 contract；不要发明配置 DSL。
- 现有启动入口：消费解析结果。Node/Phoenix 交付 env，Worker 使用当前工具支持的开发
  bindings。适配代码按实际工具放置，不建立动态注册或插件体系。

统一管理不意味着共享一个 secret。Auth、Phoenix、Assets Hub、Dash、Community、Import、
Press 等调用方分别有自己的本地身份和最小权限；没有服务调用的应用不分配客户端凭据。

## 3. 配置来源与本地状态

### 3.1 一个权威来源

受管配置先由本地环境模块完整解析，再交给应用。旧来源不能覆盖它：

| 现有来源                          | 改动要求                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `services.ts` 的 `definition.env` | 身份、issuer、后端地址等受管值转交统一解析；保留无冲突的非敏感静态参数             |
| `envFallback`                     | 随服务接管删除三处定义，最终删除 readEnvFallback；旧文件只供迁移                   |
| 父进程环境                        | 继承后删除全仓库受管 key 和已知凭据，保留工具链兼容性；仅按服务重新注入            |
| 旧 Dash/Auth 初始化器             | 显式迁移其输出后删除旧 writer；setup-auth 只调用统一 prepare，不再写 Auth/Dash env |
| Make、package scripts、cross-env  | 删除受管 key 的内联赋值，不能在 spawn 后再次覆盖                                   |
| 应用 dotenv                       | 托管模式跳过应用 dotenv；白名单外部授权从 Hub 集中 `local-dev.env` 读取            |
| Vite / Cloudflare 配置            | 开发态消费统一 bindings，清除重复默认值；生产加载路径保持独立                      |

关键约束是“一个 key 有一个 owner”。检查受管 key 的所有旧来源和最终有效值，不能只
搜索 `services.ts` 的字符串字面量。冲突必须指出服务、key 和来源，不能静默选一个值。

`resolve(serviceId)` 返回该服务的权威配置，spawn 合并顺序固定如下，不允许调用方改序：

```ts
const resolved = resolve(serviceId)
const filteredParent = filterParentEnvironment(process.env)
const env = { ...filteredParent, ...definition.env, ...resolved.env }
```

迁移时，B2 只在 fixture 启用上述新合并、过滤和冲突断言；live 服务仍走旧加载逻辑，
不检查也不清理尚未迁移的定义。B3a/B3b 按批次清理来源，但 live 切换要等所有服务
完成清理和全量检查后一次启用。这样 Auth 不会在自身迁移前被全局断言拦住，也不需要
per-service 接管标记。prepare 的结果不能写回 Hub 的 `process.env`。

过滤函数保留父环境的工具链兼容性，删除全仓库已声明的受管 key 和已知凭据，再由
resolve 按服务注入。检查过滤后的对象，不要求开发者原始 shell 环境没有这些 key。
生产模式检查必须在过滤前执行；不通过删除 NODE_ENV/CLOUDFLARE_ENV 消除生产标记。
`filterParentEnvironment` 与冲突断言共用 `local-environment.ts` 导出的同一份受管 key
集合，不在调用方维护第二份列表。

具体执行顺序固定为：

```text
B2   fixture enables new path; live services keep old loading
       |
B3a  clean Auth / Phoenix / Dash sources; keep live legacy path
       |
B3b  clean remaining services; verify every managed service
       |
     enable filtered merge + live assertion globally; remove legacy branch
```

每个服务迁移时同步清理该服务 `definition.env` 的受管值、`envFallback`、受管 dotenv 和命令
内联赋值，不能只清后两项。B3b 完成时先对全部受管服务检查，再统一启用 live 新路径并
移除旧分支；不引入 per-service 接管标记。B4 新接入的入口直接遵守统一规则。

配置分三类：

1. **内部开发配置**：服务 secret、Auth 签名/会话密钥、capability/preview 密钥等，由统一
   模块首次生成并持久保存。只生成真实消费方需要的键。
2. **本地资源和地址**：DB、对象目录、R2/D1/Workflow、issuer、JWKS/token endpoint 等，
   根据现有本地拓扑交付。浏览器用 canonical HTTPS，服务内部允许声明的 loopback。
3. **外部授权**：GitHub OAuth、remote AI 等继续使用现有忽略文件，由统一 loader 按应用
   白名单读取。无需再造 secret store；缺少外部授权时仅阻塞对应集成功能。

逻辑 resource URI（例如 Content Publisher 的资源标识）与实际网络地址分别处理。
不能把所有生产域名字符串一律替换，也不能让本地网络请求自动回退到生产地址。

### 3.2 稳定的单份私有状态

使用已被忽略的 `local/dev-hub/.data/local-environment/state.json`，保存格式版本、仓库
realpath、签名/会话等必要开发密钥，以及按 service id 区分的客户端凭据。
本地测试账号使用从已有私有状态按用途派生的独立凭据，仅注入开发 Auth 和 Phoenix。
固定 local-debug / local-passport-admin 登录及原 Admin opt-in 已退役；新命令按 run 登记
账号、显式配置 Community / Article 权限，并验证实际本地开发库。

- 目录 0700、文件 0600；不提交，不出现在 UI/API/日志/测试报告中。
- 首次生成，后续启动复用；普通启动不轮换，不写每个应用的 `.env.local`。
- 同一进程串行准备；跨进程使用一个简单排他文件锁，写临时文件后原子替换 state.json。
  锁内记录 PID 和创建时间，等待最多 10 秒；检查持有进程是否仍存活，超时非零退出并报告
  锁路径及持有者。不能仅凭锁年龄判定失效，不自动删锁；人工确认持有者退出且无写入后
  才能移除遗留锁并重试。状态损坏或工作树不匹配时阻塞，不重新生成掩盖。
- Auth 得到签名私钥与凭据 hash 注册表；每个应用只得到自己的配置，其他服务通过 JWKS
  公钥验证。Worker 所需文件是可重建的投影，不是另一份权威配置。
- 迁移前保留一份私有备份，成功后不自动清理用户旧文件。首版不做历史版本、自动回滚和
  日常轮换；需要重建时安排本地维护窗口，不能在运行中直接删除状态。

备份固定放在 `.data/local-environment/backup/`（相对 Dev Hub 目录）：目录 0700、文件
0600，按原相对路径保存源文件，并备份已存在的 state.json。只保留这一份迁移备份，不
覆盖已有备份；再次 apply 若已有完整匹配状态则无操作，其他情况报告冲突。源文件不改写。
恢复时先停止受影响服务并退出 Hub，恢复旧启动代码/配置来源；若本次切换替换了旧 state
则从备份恢复，否则移开本次新建 state，然后按记录重启原活动服务并验证鉴权。备份完整
且候选状态校验成功后才能提交 state，失败保留原状态及诊断，不自动清理备份。

Worker 需要的私有投影固定在 `.data/local-environment/workers/<serviceId>/`，目录 0700、
文件 0600，按该服务的 resolved 配置重建，不提交、不作为迁移输入、不回写应用
`.dev.vars`/`.env.local`。B2 须为下列三类工具记录实际配置入口、支持的传递 API/参数及
禁用旧 dotenv 的方式，真实 handler 探针通过后才算交付；不预设它们支持同一个 CLI 参数：

| 工具                   | 需要覆盖的入口                                   | 交付要求                                                                                      |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Cloudflare Vite plugin | Dash、Community 等 SSR 开发入口                  | 配置从 Hub child env 读取并交给 `bindings.text/secret()`，不使用 public defines 传 secret     |
| cf CLI                 | Converter、Assets Worker、Edge Router 等启动变体 | 配置从 Hub child env 读取并由 `bindings.*()` 传入；应用配置不得再读 dotenv                    |
| Wrangler               | Import、Status、Review AI                        | Hub 在私有目录重建 `.env` 投影，以 pinned Wrangler 的 `--env-file` 加载；远端 AI 授权单独检查 |

Secret 不通过 `--var SECRET=...` 等命令行字面量传递；没有验证过交付方式时，B2 报告
阻塞，不能临时改写每个应用的 dotenv 作为替代。

Auth 注册表由同一份服务需求生成。请求 token 成功后还要核对实际授予 scope 覆盖全部
必需项，因为现有 Auth 会取允许 scope 的交集；不能把 HTTP 200 当作权限齐全。

## 4. 所有应用与入口的覆盖方式

清单按“应用 + 启动变体”维护，不把 17 个应用误当成 17 条命令。服务定义是固定端口、
Portless alias、依赖和内部启动目标的来源；下表列出可直接执行的用户入口。
在现有 `local/dev-hub/src/server/services.test.ts` 增加小型清单对比测试，覆盖根及应用
package.json 的开发/监听脚本、Make 启动 target 和本文列出的 POC/测试例外。脚本或
target 与登记列表不一致时失败，要求实施者更新归类；不新增通用 shell 扫描器。

| 应用 / 入口                                               | 处理方式                                                             |
| --------------------------------------------------------- | -------------------------------------------------------------------- |
| Auth、Phoenix、Assets Hub、Dash、Community、Import、Press | 同一套本地身份、地址和鉴权准备；各自独立凭据                         |
| Apply、Landing、Inspire Me、Converter、Dev Gateway        | 纳入统一配置，按实际需要提供地址和资源；不额外授予服务身份           |
| Widget sandbox、交互式 Mock Server、Core VGPU POC         | 明确开发工具入口，监听服务通过 Hub；不把库本身虚构成产品服务         |
| Edge Router、Status                                       | 明确本地启动变体，使用本地上游和 bindings；不默认启动                |
| Review AI Worker                                          | 显式远端 AI 集成，需要开发账户授权；不声称已经离线闭环               |
| 命名 E2E / parity runner                                  | 保留测试 runner 对隔离 listener 的归属，不能拿来替代日常产品开发实例 |
| 纯库、build/deploy 命令、旧失效命令                       | 分别标记 library/build/deploy/removed，不创建虚假服务                |

### 4.1 可执行入口清单

| 启动变体                                             | 公共入口                                                                                      | Hub service id                            | Hub 内部目标                                          | 固定监听 / canonical URL                           |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Dash、Community、Apply、Landing、Inspire Me、Widget  | 根 `pnpm dev:*`、对应 `make fe.dev.*`、应用包 `dev`                                           | 各自同名 id（Widget 为 `widget-sandbox`） | 对应 `*:managed` 脚本                                 | `services.ts` 中登记的端口与 HTTPS alias           |
| Auth、Phoenix、Import、Press、Converter、Dev Gateway | 根 `pnpm dev:*`、对应 `make be.*`、应用包 `dev`                                               | 各自同名 id                               | 对应 `.managed` Make target                           | `services.ts` 中登记的端口与 HTTPS alias           |
| Assets Node upload/local provider                    | Assets 包 `dev`、`dev:local`、`dev:upload-api`；`make be.assets-hub.start`                    | `assets-hub`                              | `be.assets-hub.start.managed`                         | `8002`, `https://assets-hub.groupher.localhost`    |
| Assets Cloudflare read Worker                        | Assets 包 `dev:cloudflare`、`dev:read-worker`、`dev:worker`；根 `pnpm dev:assets-read-worker` | `assets-read-worker`                      | `be.assets-read-worker.start.managed`                 | `8787`, `https://assets-worker.groupher.localhost` |
| Edge Router development Worker                       | Edge Router 包 `dev`、`dev:local`；`make be.edge-router.start`                                | `edge-router`                             | `be.edge-router.start.managed`，固定 development mode | `8788`, `https://edge-router.groupher.localhost`   |
| Status Worker                                        | Status 包 `dev`；根 `pnpm dev:status`；`make be.status.start`                                 | `status`                                  | `be.status.start.managed`                             | `8793`, `https://status.groupher.localhost`        |
| Review AI Worker                                     | Worker 包 `dev`；根 `pnpm dev:review-ai-worker`；`make be.review-ai-worker.start`             | `review-ai-worker`                        | `be.review-ai-worker.start.managed`                   | `8794`, `https://review-ai.groupher.localhost`     |
| Core VGPU POC                                        | Core 包 `poc:vgpu:dev`；根 `pnpm dev:vgpu-poc`；`make fe.dev.vgpu-poc`                        | `core-vgpu-poc`                           | `fe.dev.vgpu-poc.managed`                             | `3012`, `https://vgpu.groupher.localhost`          |
| Interactive GraphQL Mock                             | 根 `pnpm mock:server`、Mock package `dev`、`make be.mock-server.start`                        | `mock-server`                             | `be.mock-server.start.managed`                        | `4010`, `https://mock.groupher.localhost`          |

Assets Cloudflare Worker 是独立集成变体，不属于 Node 本地 provider 的默认依赖，以免日常
开发无条件要求远端 R2/Cloudflare 授权。Status 的本地 D1 schema 更新是显式操作：
`pnpm --filter @groupher/status run db:migrate:local`；普通 `dev`/Hub start 不运行 migration。E2E/parity runner 仅在对应
测试命令内部创建隔离 listener，不作为日常开发入口。

必须核对的实际差异：

- Assets Hub 的 local、upload-api、read-worker、cloudflare 变体分别登记；同一命令的别名
  指向同一 entry，不重复创建服务。功能不同的 listener/bindings 不能合并成一个别名。
- Edge Router 的默认 dev 使用 production mode，本地入口应明确使用 development 变体。
- Status 的 production 标记、D1、service bindings、定时触发需要本地配置。
- 清除根脚本中已失效的 content-import/document-converter 入口，记录 removed 原因。

资源在本节维护一张普通表即可，不建立资源编排框架。B0 补齐各项真实配置：

| 资源                        | owner / 地址来源                                 | 生命周期                                            |
| --------------------------- | ------------------------------------------------ | --------------------------------------------------- |
| PostgreSQL                  | 现有本地 DB 配置，核对 `ops/postgres` 及实际实例 | 开发者明确安装/初始化；Hub 不在健康检查中迁移或清库 |
| Assets 对象目录             | Assets Hub local provider，复用已有目录约定      | 持久保留；清理需配合业务引用/reconciliation         |
| R2 / D1 / Workflow 本地状态 | 对应 Worker 的开发 bindings                      | 显式本地持久化目录；停止服务不自动删除              |
| 远端 AI / OAuth             | 对应集成应用的开发账户                           | 显式启用；不把生产凭据作为本地 fallback             |

仍使用已有固定端口和 Portless aliases。新增 listener 在 B0 登记固定端口、归属和冲突
处理；遇到占用就报告，不找空闲端口绕过。多工作树并行不是本次承诺。

## 5. 启动、依赖与安全边界

### 5.1 复用现有启动流程

```text
make dev / Desktop / Hub API / CLI
                 |
                 v
       validate worktree + local mode
                 |
       prepare local state + per-service config
                 |
       check Portless proxy / trust / aliases
                 |
       start existing dependency chain
                 |
       check service config / health / capabilities
                 |
       canonical HTTPS browser acceptance

failure -> stop dependent steps, report cause
        -> preserve owned healthy processes
        -> never change port or launch a substitute server
```

Web、CLI、桌面入口都调用同一准备函数。Restart 停止旧健康实例前，先做静态配置和
Portless 预检。配置改变涉及 Auth 注册表时，明确报告并通过 Hub 重载 Auth 和受影响
调用方；不能只重启页面服务后宣称就绪。

普通命令沿用 `start/restart/status/logs/url/doctor`。扩展 doctor 展示配置缺项和依赖状态，
不新增 env 命令族。现有 ensure/setup 明确仍是 Portless 语义；setup-auth 过渡为统一
本地准备的兼容入口，日常启动自动调用准备函数，不要求开发者手工执行它。
兼容入口必须调用同一个 prepare、使用同一把状态锁；删除旧 Dash/Auth writer，不再修改
应用 env。`local-service-auth.test.ts` 改为断言兼容入口复用准备逻辑、重复调用幂等且不写
两个旧文件，不能只删除旧测试。既有配置的导入仍只由显式迁移脚本执行。

status/logs/doctor 保持只读：不生成密钥、不起服务、不安装依赖。首次证书信任与 hosts
初始化仍显式执行 `pnpm portless:setup`，不引入开机自启或每次 sudo。

公共开发入口与内部启动命令分开，例如 `fe.dev.dash` 转交 Hub，而 Hub 使用
`fe.dev.dash.managed` 直接启动工具。检查完整 Make/pnpm/wrapper 调用链，避免：

```text
BAD:  Hub -> make fe.dev.dash -> Hub -> ...
GOOD: user -> make fe.dev.dash -> Hub -> internal managed target -> Vite
```

入口检查与 skill 提供工程约束，不宣称阻止同一 OS 用户手工运行任意底层二进制。

### 5.2 启动顺序与业务依赖分开

保留现有 `startPolicy.requiredDependencies` 作为启动图来源，不再声明第二张 boot 图。
Auth/Phoenix 等业务调用有环，不能要求彼此先达到“完整业务 ready”：

```text
config prepared
      |
Auth listener + signer/JWKS live
      |
Phoenix listener + DB ready
      |
Assets Hub / requested dependencies live
      |
verify Auth -> Phoenix and other required service capabilities
      |
requested application ready
```

能力检查复用既有验证器与只读探针，不改 health.v1，不为探针添加生产鉴权后门。慢编译
超时报告日志与状态，保留仍在工作的受管进程，不能另起一份绕过。

### 5.3 保留必要的安全与生产隔离

- 本地仍校验 token 签名、issuer、audience、scope、用户委托及 Gate 权限。
- 本地测试身份由独立开发入口及实际本地数据库检查约束，受现有
  开发编译、本地主机和专用凭据限制；授权必须指定 Community / Article。
  旧固定账号与管理员开关已移除。真实 OAuth 单独配置。
- 受管秘密只展示键名、来源和是否存在；服务端禁用 reveal，删除对应 UI 开关。
  `config-reader.test.ts` 保留脱敏检查，将原明文断言改为 reveal 被拒绝或仍不返回明文。
  普通非敏感源码查看不必删除，不能用隐藏按钮或正则脱敏代替服务端边界。
- API 的 Host 校验置于路由之前，allowlist 来自实际监听配置，兼容 4310/4311；有 Origin
  的敏感读/写请求按允许来源验证，命名 metrics 入口保留其既有来源规则。无 Origin 的 CLI
  请求需正常工作；工作树身份检查防误连，不能代替访问控制。首版不增加 token 管理系统。
- 所有本地状态变更都拒绝生产环境，包括 NODE_ENV、CLOUDFLARE_ENV 和对应运行时的
  生产选择；生产运行时不注册本地登录入口、不读取私有目录，不依赖 Dev Hub 的准备模块，
  secret 不进入客户端 bundle。Auth 顶层导入登录 flag helper 不等于启用该入口。

```text
LOCAL:      Dev Hub -> local state -> env / local bindings
PRODUCTION: deploy configuration -> production env / bindings
                                      |
                same auth and business contracts

production build --X--> local state
missing local config --X--> production fallback
```

生产验收检查“本地登录不注册、不可访问”，不要求源码字符串被 tree-shake。无需为此
改变生产鉴权、部署 secret 或业务代码路径。

## 6. 可审查的实施批次

本节定义交付批次和验收条件；执行状态以相应代码、检查结果和审查记录为准。
不因本文件创建提交；B0 的基线按相关路径单独整理。

| 批次                 | 改动范围与交付物                                                                                                                                           | 通过条件 / 回退                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| B0 基线与清单        | 记录仓库当前 HEAD 作为 baseline；核对实际消费键、权限、资源，清理失效入口；在 services.test.ts 增加入库入口清单对比；修现有 JSDoc 缺失                     | baseline 可获取、入口差异有测试约束；本次实施不自动创建提交，变更由调用者按路径审阅和提交                           |
| B1 统一准备函数      | local/dev-hub/src/server/local-environment.ts 及测试；复用服务定义，单份私有状态、注册信息、权威 env、10 秒锁与原子写；交付迁移脚本及 check/apply 失败测试 | 第 7.2 节迁移 fixture 测试及生成/复用/隔离通过；不接管活跃服务，可撤回调用                                          |
| B2 运行时交付与边界  | 在 fixture 启用固定合并/过滤/断言和 loader/Worker 新路径；落实三类工具交付表；禁用 reveal 并改负向断言，补 Host/Origin 与生产代表应用测试                  | fixture 验证通过且未接管 live 服务仍用原加载方式；不提前清理真实 Auth 的旧值或切换其身份                            |
| B3a 迁移准备及首条链 | 显式导入并备份；setup-auth 改为同锁 prepare、移除旧 writer；清理 Auth/Phoenix/Dash 的 definition.env 和其他旧来源；live 仍走旧路径                         | 恢复活动服务后鉴权正常；fixture 断言通过；失败按第 3.2 节恢复                                                       |
| B3b 其余服务接管     | 清理其余服务全部旧受管来源；完成全量检查后统一启用 live 过滤、合并和断言，移除旧分支                                                                       | 全部当前受管服务使用权威配置，definition.env 无受管 key、fallback/helper 清零；正反向鉴权通过；回退遵循 B3a         |
| B4 入口及文档收口    | Make/pnpm/桌面入口与额外变体收口；更新根 `AGENTS.md`、文档及 skill；documentation.yml 的 dev-hub job 跑 test/type-check                                    | 新入口直接遵守统一规则；Agent 被明确导向 Hub/Portless；入口无递归、清单测试通过；CI 为离线检查，真实 Hub smoke 手动 |

B4 的 CI 落点为 `.github/workflows/documentation.yml` 中独立的 `dev-hub` job：复用
现有 Node/pnpm 安装约定，两个检查都执行：

```bash
pnpm --filter @groupher/local-dev-hub run test
pnpm --filter @groupher/local-dev-hub run type-check
```

与 documentation job 独立，不因文档检查失败而跳过；不启动 Hub、Portless 或 DB。
`test:local-environment` 继续手动运行，不加入该 job。同步更新
[验证矩阵](../infra/tooling/validation.md)。

一次性迁移只读取明确的旧文件，按服务验证本地 issuer、endpoint、client 和凭据匹配，
不把生产目标或不明授权导入。优先保留有效本地密钥，减少会话和 token 无意义失效；
旧授权超出声明时报告并评审，不直接复制全部权限。先生成完整配置并校验，切换前保存
私有备份；中途失败不得让半份配置进入正常启动。

B3a 必须明确迁移旧 `local-service-auth.ts` 的输出：`backend/auth/.env.local` 和
`frontend/dash/.env.local`；Auth 按现有 `.env`、`.env.development`、`.env.local` 的有效
优先级读取配置，不能只读最后一个文件就认为注册信息完整。核对以下四个注册表字段与
`SERVICE_AUTH_RESOURCES_JSON`，去重并验证资源和凭据匹配：

```text
SERVICE_AUTH_CLIENTS_JSON
SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE
SERVICE_AUTH_CLIENTS_JSON_ADDITIONS
SERVICE_AUTH_CLIENTS_JSON_EXTRA
```

保留有效 Dash 身份 `dash-development` / `dev-hub-local-dash` 及其匹配 secret，不额外
轮换、不复制超范围授权；Phoenix、Assets 和其他受影响调用方也按 B0 的来源清单核对。
旧初始化器完成迁移后退出写入路径，不能与 state.json 同时作为日常配置来源。

一次性迁移脚本由 B1 交付，B3a 在记录原活动服务并停止受影响服务、退出 Hub 后执行。
先 check 再 apply；普通启动不代替执行者做迁移：

```bash
pnpm --filter @groupher/local-dev-hub exec tsx scripts/migrate-local-environment.ts --check
pnpm --filter @groupher/local-dev-hub exec tsx scripts/migrate-local-environment.ts --apply
```

上述命令由 `local/dev-hub/scripts/migrate-local-environment.ts` 实现，并有旧 Auth/Dash
配置 fixture 覆盖。`--check` 只输出迁移项和冲突，不写盘；`--apply` 先生成私有备份，
再提交完整 state。新环境直接初始化；已有内部配置但未迁移时阻塞切换，避免自动生成新
身份使旧服务失效。

临时兼容只用于已明确的迁移步骤，不能保留为长期 fallback。迁移成功后，普通启动不再
扫描旧内部凭据；外部授权按白名单处理。删除旧文件属于独立操作，不自动删用户配置。

## 7. 可执行验收

### 7.1 检查与命令归属

不建设统一验收框架。复用现有 node:test、Vitest、Phoenix 测试；窄范围的
`local/dev-hub/test/local-environment.smoke.ts` 和 package script `test:local-environment`
手动检查已有 Hub 的身份和真实 token/验证器链路。
该目录不在现有 `src/**/*.test.ts` glob 内，不能将普通 workspace test 当作 smoke 已运行。

Smoke 不启动替代服务、不写业务数据、不输出秘密；使用 CLI 相同的工作树检查，读取
受管配置只在进程内使用。必须输出服务、检查项和 passed/failed/not-run 原因，目标未
运行不能算通过。新增单元测试在 B1/B2 随对应实现交付，不等到收尾才写。

下列已有检查从仓库根执行，按批次选择相关消费者，不要求每次重复整个仓库测试：

```bash
pnpm --filter @groupher/local-dev-hub run test
pnpm --filter @groupher/local-dev-hub run type-check
pnpm --filter @groupher/backend-auth run test
pnpm --filter @groupher/assets-hub run test:unit
pnpm --filter @groupher/import run test
pnpm --filter @groupher/press run test
pnpm --filter @groupher/frontend-dash run type-check
pnpm --filter @groupher/frontend-community run type-check
pnpm run contract:health
pnpm run docs:check
```

Phoenix 从 `backend/api` 执行，使用明确的 test DB：

```bash
MIX_ENV=test mix test test/groupher_server_web/service_auth_verifier_test.exs \
  test/groupher_server_web/context_service_auth_test.exs \
  test/groupher_server_web/middleware/service_scope_test.exs \
  test/groupher_server_web/middleware/delegated_scope_test.exs
```

真实环境验收先在正常维护窗口准备 Hub；DB、依赖安装是显式前置条件，不隐藏在 startup
health 中。`make dev` 在独立终端前台运行，其他终端执行：

```bash
pnpm devhub status
pnpm devhub doctor
pnpm devhub start dash
pnpm devhub start community
pnpm devhub start import
pnpm devhub start press
pnpm devhub url dash
pnpm devhub url community
```

以下手动 smoke 要求 Auth、Phoenix 和 Assets read Worker 已由 Hub 启动：

```bash
pnpm --filter @groupher/local-dev-hub run test:local-environment
```

### 7.2 必须通过的技术验收

| 项目                        | 执行方法                                                                                                                     | 通过标准                                                                                                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 空环境与重复启动            | 临时根目录单元测试；另在无旧应用 env 的专用开发 checkout 实测                                                                | 无需预先初始化 Auth env；自动生成内部配置；重启不换密钥。不要删除真实工作树 env 模拟空环境                                                                          |
| 并发和写失败                | 并发调用、写中断、坏 JSON；模拟持锁进程存活/退出和等待超时                                                                   | 单份有效状态，失败保留旧文件；10 秒内给出锁超时错误与恢复提示，不自动删锁或重建状态                                                                                 |
| 迁移 check/apply 与失败恢复 | 旧 Auth/Dash env fixture 覆盖四个注册表、资源表、现有 id/ref/secret；执行 check/apply 并注入写失败；B3a 再恢复原活动服务验真 | check 零写入，空环境报告无需迁移、冲突失败；apply 生成 0600 备份和完整 state，重复 apply 无操作；失败旧文件/原 state 不变、没有半份 state；恢复服务后原调用方仍认证 |
| 身份与来源隔离              | B2 fixture 和 B3 已接管服务注入冲突值；另测接管/未接管混合运行；B3b 结束检查全部当前受管服务                                 | 已接管服务 filteredParent 无受管 key、definition.env 冲突必败、最终值等于 resolved.env；未接管服务加载不变；全部接管后无临时分支                                    |
| 正反向鉴权                  | 真实 Auth 签发、验证器验签；错误 secret/resource/scope、错 audience 和跨 history origin 测试                                 | 正向 scope 全量覆盖；非法调用被现有协议拒绝；不修改线上状态码语义                                                                                                   |
| Worker 交付                 | 通过实际 Worker handler 验证其 bindings，检查本地持久化目录                                                                  | 不是只检查父 process.env；R2/D1/Workflow/service bindings 使用声明资源；秘密不进入浏览器 bundle                                                                     |
| 入口与失败恢复              | Web/CLI/Desktop，代理不可用、慢编译、循环调用检查                                                                            | 统一准备；Auth/Phoenix 无互等；失败不换端口、不起另一份；restart 预检失败保留旧健康进程                                                                             |
| 秘密与 API                  | fixture secret 测试 reveal、恶意 Host/Origin、无 Origin CLI、合法开发 UI                                                     | API 不返回受管秘密；服务端拒绝非法请求；4310/4311 与正常 CLI 保持可用                                                                                               |
| 生产隔离                    | Auth/Phoenix/Assets/Dash 按下表执行两组构建及生产入口/配置测试；本地状态写操作测试 NODE_ENV/CLOUDFLARE_ENV 等生产选择        | 不依赖私有状态，产物无本地秘密；生产模式拒绝本地状态写入，本地登录不注册/不可访问                                                                                   |

生产构建使用专用随机测试 secret，不用真实生产 secret；只执行现有 build 或明确的
部署 dry-run，不执行发布。拿两套独立测试 keyset 验证跨环境 token 拒绝，不访问线上
鉴权接口。构建需要外部账户时明确报告 blocked，不用跳过代替通过。

生产隔离至少覆盖下面四个代表应用，均执行“无本地状态”和“有状态且父环境受污染”
两组；比较有效配置与秘密暴露情况，不要求构建产物逐字节相等：

| 运行方式 / 应用 | 执行入口与断言                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Node Auth       | `pnpm --filter @groupher/backend-auth run build`；生产入口测试中即使登录 flag 为 true，本地登录也不可访问                            |
| Phoenix         | 从 backend/api 执行 `MIX_ENV=prod mix compile`，并在配置测试中验证 prod runtime 不读取私有状态、鉴权配置未放宽                       |
| Node Assets Hub | `pnpm --filter @groupher/assets-hub run build`，生产入口测试确认不加载 Hub 私有状态                                                  |
| Worker Dash     | `pnpm --filter @groupher/frontend-dash run build`，检查 Worker bindings 和客户端产物无本地 secret、有效 endpoint 未使用本地 fallback |

上述生产入口/配置测试由 B2 随实现交付；单独 build 成功不代替运行时断言。登录 flag
只由本地解析配置交付，B2 loader 测试必须证明旧 dotenv 不能反向覆盖它。

### 7.3 浏览器闭环

使用 canonical HTTPS 和 `/home/xx` 社区。浏览器身份通过 Dev Hub 注册的合成账号与独立 profile 建立；有权写入
的测试账户/成员关系需显式准备，不自动授予未声明的管理权限。测试内容使用唯一
`local-runtime:<run-id>` 标记，结果记录内容 id、receipt/operation id，截图放 `.playwright/`。

| 场景             | 操作                                                 | 必须记录的结果                                                                      |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 登录与权限       | 普通本地登录、刷新、跨产品打开；无权账户尝试管理操作 | 正常会话和 HttpOnly cookies；无 TLS/mixed-content/CSRF 错误；业务权限仍拒绝无权请求 |
| Dash / Community | 各用受权账户创建并保存内容，刷新查看                 | 两个独立服务身份，正常用户委托，history origin 为 browser                           |
| Assets           | 产品内上传、保存/发布引用，再加载资源                | prepare/upload/finalize/register/claim 完整，真实本地对象可读                       |
| Import           | 使用固定 Markdown 测试文件预览并 apply，再读取结果   | 真实本地 Import/Workflow，job/receipt 可追溯，history origin 为 import              |
| Press            | 读取已发布测试内容对应的输出                         | 返回真实内容，无生产上游请求，不以 health=200 代替                                  |
| 撤销与清理       | 撤销会话、刷新受限页，通过业务入口清理本次内容       | 会话失效；只清理本次数据；失败列出遗留 id，不直接删表或对象目录                     |

环境、接口或 UI 缺失就记录 blocked/not-run；不能把 token 成功、页面打开或模拟响应
当作业务闭环。额外工具及集成入口单独验证，缺 remote AI 授权不影响普通 local 服务。

## 8. 完成标准与资料

完成时提供：基线 commit、实际改动、覆盖的应用/启动变体、运行中的 Hub 是否加载新代码、
检查结果及剩余阻塞。无需为此设计持久报告系统；在实施记录中写清 passed/failed/
blocked/not-run 即可，秘密和 token 不进入证据。

签收标准是：所有实际入口都已归类，所有受管配置都有唯一来源；内部 secret 自动准备且
身份隔离；三类运行时真实可用；日常操作只经过 Dev Hub/Portless；生产配置不依赖本地
状态。文档、磁盘代码、运行实例和业务验收结果分别说明，不能相互替代。

- [本地开发入口](../infra/local-development.md)
- [Portless](../infra/portless.md)
- [Dev Hub README](../../local/dev-hub/README.md)
- [本地测试账号与社区](../auth/local-test-actors.md)
- [服务 token 协议](../auth/service-token.md)
- [验证矩阵](../infra/tooling/validation.md)
