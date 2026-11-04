# Production Seed P0 操作入口

状态：P0 已在真实生产新库执行；实际证据及已完成的 P7 收口见 [2026-11-04 执行记录](./production-seed-acceptance-2026-11-04.md)。生产收口版本已删除 CLI `issue` 分派及 Auth 兑换路由，API seed 开关关闭；下文签发/兑换命令仅保留为窗口内协议和历史操作说明，不能作为当前可用的生产入口。保留社区/固定账号不等于延长登录旁路；新一轮执行须按主手册重新固定范围和截止时间。

## 1. 交付与约束

- `dev/mock/tmp` 已加入静态保留名单。普通申请使用 NameAvailability/NameRules，公开创建命令也校验这三个保留名称；Community 与 Dashboard 改名路径均禁止改入或改出三者；专用 bootstrap 仅能创建这三个固定 slug，保留占用和 ledger 归属校验。`tmp` 删除不改变静态名单。
- `CMS.ProductionSeed` 位于 release 的 lib 中；CLI 是固定命令分发，不调用 Mix，不接受任意 SQL/函数/user ID。生产镜像包含 `/app/bin/production_seed`。
- 所有入口要求 API 进程 `PRODUCTION_SEED_ENABLED=true`，且 request.database 与 Repo 实际 `current_database()`、run ledger 的数据库身份一致。默认禁用。操作 shell 的环境变量不会自动传给已运行的 release RPC 目标，必须配置 API 进程并重启生效。
- 同一时间只允许一个 active run。窗口固定两小时；过期后先 close/清理，再使用新 runId，不能延长旧窗口。bootstrap 对同 run 幂等；已有但不属于 ledger 的同名用户/社区会拒绝接管。
- 固定登录名：`ps-author`、`ps-admindev`、`ps-adminmock`、`ps-platform`、`ps-reporter1..N`、`ps-outsider`。N 至少 3，并跟随编译期举报阈值增大。无 OAuth identity；发现意外绑定停止操作。adminDev 拥有 dev/tmp root，adminMock 拥有 mock root；adminDev 另有 Post move/mirror/unmirror 全局 binding 权限，**没有全局审核权限**。platform 仅有 review.platform.read/decide/configure。权限快照进入 manifest，遇到未登记权限变化拒绝自动覆盖/删除。
- 凭据有效期最多五分钟，数据库只存 SHA-256 摘要，按 run/用户签发、事务内单次消费。Phoenix 正式 session 及刷新上限为 run 的两小时截止时间。Auth 兑换开关和明确截止时间必须同时有效。
- 内容/manifest 在同一个数据库事务内提交；失败整体回滚。Article/Comment/Ticket receipt 写入由 Node 提供 runId + 场景的稳定 commandId；Doc workflow 受版本检查与同一外层事务保护。事务外重试依据 artifact checksum、revision/body version/binding 核对；已编辑/删除的资源拒绝按 seed 覆盖。不要把验收操作后的数据当作原始 seed 重放。

## 2. 准备请求与正文文件

以下是操作说明，生产执行仍须先填写主手册执行单。request JSON 只含非秘密参数，不放凭据、Cookie 或正文。正文 artifact 必须由固定 revision 的可信 Node 生成器产生，不能让浏览器上传任意 BodyBag 到运维入口。

在仓库根目录生成正文（输出文件必须不存在）：

```bash
pnpm --filter @groupher/backend-auth exec tsx ../../scripts/production-seed-bodybags.mts prod-seed-YYYYMMDDTHHMMSSZ /tmp/production-seed-bodies.json
```

将 artifact 通过已登记的受控文件传输方式放到目标 API machine 的同一路径，检查文件校验值和 owner。CLI 不执行文件传输；集群中必须明确持有文件的 machine，RPC 只读取该 machine 的本地文件。正文 artifact 不是公开证据。

运行中的 release 内，准备请求（样例库名必须替换为执行单实际库名）：

```json
{
  "command": "bootstrap",
  "runId": "prod-seed-YYYYMMDDTHHMMSSZ",
  "database": "ACTUAL_EMPTY_DATABASE"
}
```

保存为 `/tmp/production-seed-request.json` 后执行：

```sh
/app/bin/production_seed /tmp/production-seed-request.json
```

底层为 `/app/bin/groupher_server rpc`。成功输出 JSON `{ok:true,result:...}`；参数错误 shell 返回 64，业务/数据库/RPC 失败返回非零，不能只根据日志出现过成功字样继续。不要从异常或 shell debug 日志采集凭据；禁止 `set -x`。

命令清单（均需 `runId`、`database`）：

| command        | 额外参数             | 结果                                                                                                                                       |
| -------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| bootstrap      | 无                   | 三个社区、固定账号、权限和截止时间 manifest                                                                                                |
| seed           | artifactPath         | 固定基础内容和内部 ID/公开 locator/相对 URL                                                                                                |
| references     | artifactPath         | 六类节点引用、分页与自引用负向数据；预期边集合                                                                                             |
| report         | 无                   | 当前 manifest，不输出 credential、digest 或私有 session ref                                                                                |
| issue          | alias、outputFile    | 一次性凭据写入远端独占 0600 文件，仅输出路径/到期时间                                                                                      |
| close          | 无                   | 撤销本 run 已签发 session；未消费凭据因 run 关闭失效；过期窗口也可关闭                                                                     |
| delete-tmp     | 无                   | 物理删除 ledger 所属 tmp；只允许本 run 且在其他社区仍有 binding 的 Article；更新幸存 locator                                               |
| map-failure    | 无                   | 仅在全部 Map 来源属于本 run 且初始健康时，事务内破坏 CM 的 JSON，真实执行单来源重建后回滚所有数据库写入；仅保留真实失败清单供重启/续跑验证 |
| cleanup-report | mode=retain 或 purge | 范围、阻塞项、待处理 effects 与 report_digest                                                                                              |
| cleanup-apply  | mode、reportDigest   | 重核报告、关闭登录/清理权限，按明确策略保留或清理内容                                                                                      |
| cleanup-verify | mode                 | 本地核对；未收敛则非零；不替代 CDN/Auth 路由/证据归档复核                                                                                  |

## 3. runId Seed 与引用

先 bootstrap，再 seed。基础集：PX/BX/CX/DX、User Ticket TX、普通 Comment CM、shared 及其 Comment、tmp/mock 的 deleteProbe 及其 Comment、Doc main Comment、zero/self、独立 reviewImmediate/reviewAI/reviewHuman，以及 21 个分页目标 Post。

`review*` 是独立测试资源，**别名不会自动设置 policy、触发真实 AI 失败或产生五种 hold**。执行主手册 PS-V 时通过正式配置、举报与审核动作产生状态。草稿/私有社区/Doc 非 main 等受限场景也必须按 PS-A/PS-M 的领域操作准备并取证；基础 seed 成功不关闭这些验收项。

manifest 分别记录 Node artifact 的 Git SHA/dirty 标记与 API 的 runtimeImageRef/runtimeVersion；二者不能自动互相证明。P0 执行单必须核对它们来自同一固定发布版本，dirty 的本地验收不能作为生产发布证据。

取得 seed 的完整 `report` JSON，保存为 `/tmp/production-seed-manifest.json`，在可信 Node 环境生成引用正文：

```bash
pnpm --filter @groupher/backend-auth exec tsx ../../scripts/production-seed-links.mts /tmp/production-seed-manifest.json /tmp/production-seed-links.json
```

将 links artifact 放到指定 machine，再调用 `references`。它通过 Article update、Doc update/publish、Ticket draft/save/publish 和 Comment 带 Community context 的正式命令更新正文。预期有 PX→BX→CX→DX→TX→CM→PX 六边，以及 PX→page1..21 共 27 条不同边，足够验证 first=20 的翻页。PX 自引用和 self 自引用属于负向输入，不能增加自环；zero 无引用。

manifest 的 `expectedEdges` 是期望，不是通过证据。正常 Mention Outbox/worker 必须收敛，真实 GraphQL Map 结果和匿名 URL 仍按主手册验证。不得插入 Map 边冒充链路通过。

`delete-tmp` 后，幸存内容 locator 切至 mock；report 记录 deletedTmpId。再 bootstrap 会创建新 tmp ID，保留 dev/mock/user ID。原 deleteProbe 留在 mock；要重做一次破坏性场景，按主手册创建新场景批次，不把旧内容重新 seed 到新 tmp。

PS-M07 使用 `map-failure`：先等待正常 Outbox 同步并确认 report issues 为空，再调用。该入口在同一事务中使 CM 的 BodyBag 临时不可解析，走真实 Rebuild/Store 错误路径，将 CM 写入正式持久失败清单，然后回滚数据库；不提交损坏正文、不关闭约束、不手造 Mention 边。失败后的 report 应包含 `failed_manifest`；先核对持久盘文件，再重启同一持盘实例确认文件仍在，最后按主手册调用 `retry_failed(default_manifest())`，要求 processed=1、failures=[]，report issues 清零。其余来源使用普通重建命令验证可继续处理；不能以故障入口的单来源 processed=1 代替此项。已有非本 run 来源时入口拒绝执行，不在混合用户库中使用。

## 4. Auth 兑换与关闭

API：`PRODUCTION_SEED_ENABLED=true`。Auth：`PRODUCTION_SEED_LOGIN_ENABLED=true`、`PRODUCTION_SEED_LOGIN_UNTIL=<明确 UTC ISO 时间>`，以及既有正式 Auth 配置（NEXTAUTH_SECRET、Auth service client、Phoenix endpoint、Cookie secure/domain）。这些开关都不会默认开启。没有新的通用测试登录接口或 GitHub identity。

issue 示例额外参数：

```json
{
  "command": "issue",
  "runId": "prod-seed-YYYYMMDDTHHMMSSZ",
  "database": "ACTUAL_EMPTY_DATABASE",
  "alias": "author",
  "outputFile": "/tmp/production-seed-author.json"
}
```

outputFile 必须满足 `/tmp/production-seed-[a-zA-Z0-9_-]+.json`，文件已存在时拒绝覆盖。通过受控秘密渠道取得 JSON，五分钟内在 **groupher.com 或 dash.groupher.com 的独立浏览器上下文**发起：

```js
// credentialJson 从受控本地文件读取；不要把实际值复制进命令历史或证据。
const response = await fetch('https://auth.groupher.com/api/auth/production-seed/redeem', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'X-Groupher-CSRF': '1' },
  body: JSON.stringify({ credential: credentialJson.credential }),
})
if (response.status !== 204) throw new Error(`Redemption failed: ${response.status}`)
```

需保留既有 Origin/CSRF 校验。禁止 credential 出现在 URL、Referer、公开日志。该路由没有签发能力；签发仅是 release RPC 运维动作。JSON body 最大 2 KiB。

Auth 签发正式 host-only Auth.js Session Cookie（生产 `__Host-groupher-auth.session-token`）及 Phoenix `groupher-auth.token`、非秘密 signed-in hint；属性沿用当前协议。Auth.js 签发失败会撤销已创建的 Phoenix session，无成功 Cookie；补偿失败返回 503，此时立即 close 本 run，核对 session ledger 后再继续，不复用旧凭据。

P7 顺序：close/cleanup；在各浏览器正式 logout 清理 Cookie，并证明旧业务 token/refresh 已被 Phoenix 拒绝；关闭 API/ Auth flags；发布移除 Auth `/api/auth/production-seed/redeem` 路由、`production-seed.ts`、Auth flag/binding 和运维 issue 签发入口的收口版本；销毁未使用的凭据文件/副本，核对所有旧部署不可服务。opaque 凭据使用独立数据库摘要存储，没有专用签名密钥，不轮换正式 NEXTAUTH_SECRET/PHX_JWT_SECRET 来代替关闭入口。

Auth 现有 `/api/auth/*` 会接管未知路径，收口版需同时落实未知 action 的 404 策略或无业务处理的拒绝响应；只删除兑换 handler 不保证 404。最终真实公共路由须 404，旧凭据不能兑换，正常 Auth 刷新/登出仍可用。服务端撤销无法远程擦除已经写入浏览器的 Auth.js Cookie，因此必须单独完成 logout；Cookie 仍存在不代表 Phoenix session 有效。上述生产复核未执行时，不能关闭 P7。

## 5. 清理 report / apply / verify

必须显式选择 mode，不能省略：

- retain：保留本 run 演示内容、固定账号与社区，关闭兑换/会话、删除 seed passport。保留项完整报告。
- purge：清理 ledger 中的普通 Article/Comment/Doc，走领域 Trash/永久删除；Ticket 先走正式 move_to_draft，**保留撤回后的 Ticket 身份与历史**。当前 schema 的 `ticket_article_identity_guard` 禁止 Ticket Article 物理删除，脚本不关闭 trigger、不改 thread 逃避约束；这是明确保留项，不报告为全量物理删除。

report 检查外部 binding/Comment、外来 Ticket source、入向引用、资产和异常 OAuth/权限。存在未知依赖时拒绝破坏性操作；此基础集不上传资产，任何资产 ref 都需单独 reviewed asset plan。脚本不会删除共享队列、外部 OAuth/provider 账号或未登记资产。

把最近 report 的 `report_digest` 原样放入 cleanup-apply 的 `reportDigest`。操作会锁定 run 与目标行、再次核对摘要和阻塞项；状态变化须重新 report。跨 run 有新的 active window 时拒绝旧 run 清理，防止撤销新 run 的固定身份权限。

每次 apply 都是单一 DB 事务：失败回滚，成功后断线可重新 report 并 apply；已经删除的 Article 跳过，已撤回 Ticket 不再重复撤回。第一次 apply 后固定权限已移除，重跑只作本地状态核对，不重新执行需权限的领域写操作。mode 一经成功记录不可切换。

verify 检查关闭状态、会话/权限、未删除的普通聚合、Ticket 撤回状态，以及资源相关待执行 Job/Outbox。pending/failed effects 必须处理并重试 verify，不直接改 Job 状态或清队列来获得通过。正常 invalidation/search/delete jobs 继续消费，相关环境须有常驻 worker。verify 成功仅表示已列出的本地核对完成，真实 CDN/Press、资产/provider、Auth 入口 404 和共享证据归档仍要按主手册执行。

## 6. 本地验证命令

仓库根目录：

```bash
pnpm --filter @groupher/backend-auth run test
pnpm --filter @groupher/backend-auth run type-check
pnpm docs:check
bash -n backend/api/scripts/production_seed.sh
git diff --check
```

API 目录：

```bash
MIX_ENV=test mix ecto.migrate
MIX_ENV=test mix test test/groupher_server/production_seed/acceptance_test.exs test/groupher_server/cms/doc_tree/trash_action_test.exs
MIX_ENV=test mix compile --warnings-as-errors
MIX_ENV=prod mix assets.deploy
MIX_ENV=prod mix release --overwrite
./scripts/production_seed_release_smoke.sh
```

ExUnit 只用本地测试数据库，正文与 commandId 均在测试中由可信 Node 生成器实际生成；引用 artifact 在测试中用当前 manifest 实际生成，验证真实 Mention projection。生产模式 release 的本地 smoke 使用 `scripts/production_seed_release_smoke.exs`，硬编码 loopback `groupher_server_test`、禁用后台消费并事务回滚；它验证无 Mix 的 release 代码路径，不是生产镜像/服务验收。执行前确认无并行测试正在使用该库。Docker 镜像本地验证若未执行，主手册该门禁仍待补。

## 7. 本轮本地验证记录（2026-11-04）

验证基于 `2d27a9449` 的未提交工作树，不能作为生产 revision 或部署证据。

| 检查           | 结果 / 范围                                                                                                                                                                                                 |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 后端针对性回归 | 220 项通过：P0、Communities、Dashboard、Doc Trash、Browser Session 分页；含真实 Node 正文生成、27 条 Mention 边、自引用排除、tmp 删除后 Comment 保留及重建、公开创建/双改名路径拒绝、幂等清理与未知权限保护 |
| Auth           | 全套 71 项通过；类型检查通过；实际 Auth.js 解码/读取新 Session，签发失败补偿与拒绝路径均覆盖                                                                                                                |
| migration      | 外部 `MIX_ENV=test` 调用 fresh DB 脚本成功，脚本固定 dev 并通过 `create_production_seed_ledger`；临时数据库已清理；本地测试库 migration 已应用                                                              |
| 编译与合同     | `mix compile --warnings-as-errors`、schema/codegen、generated GraphQL smoke（58 source files）、完整 `pnpm docs:check`、shell 语法和 `git diff --check` 通过                                                |
| prod release   | `mix assets.deploy`、`mix release --overwrite` 和无 Mix 的 release eval/CLI smoke 通过；所有 seed 业务写入事务回滚；pending effects 正确阻止 verify；ledger/grant 行为零                                    |
| 工作树         | 静态资源构建产物已撤回，原有业务/文档改动保留；没有提交或操作生产环境                                                                                                                                       |

prod 启动仍提示原有 Sentry `included_environments` 弃用告警，本轮未修改该配置。容器镜像未验证（本地无 Docker），不能把本地 release smoke 写成同镜像验收完成。基础 seed 不替代受限/私有/非 main 状态及真实 AI 故障准备；这些场景、生产配置/常驻/持久化、Auth P7 移除和共享证据库仍按主手册保持待交付或待验收。

清理保留边界必须随执行单一并确认：固定用户、dev/mock（及重建后的 tmp）、run/凭据撤销审计记录和既有 Activity/通知投递/Receipt 历史不由此脚本擦除；purge 另保留已撤回的 Ticket 身份/历史。不要把 `local_status=verified` 当成“所有业务、历史和外部派生数据已物理删除”；通知/分析等派生面的保留或清理证据、CDN/Press 和真实 Cookie/入口复核仍单独登记。
