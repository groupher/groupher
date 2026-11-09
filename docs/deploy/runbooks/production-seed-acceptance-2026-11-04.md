# 2026-11-04 生产 Seed 验收执行记录

> 状态：本手册范围验收完成，**25 PASS / 2 用户授权 SKIP**；P7 关闭及共享证据独立下载校验完成。旧库误迁移事故单独保留，旧库恢复评估未完成；不得据此宣称旧库无损或所有其他功能合同已关闭。

## 范围与授权

执行人：本会话 Codex；确认人：仓库所有者。用户在本会话明确表示生产没有实际用户、历史数据和旧逻辑不需兼容，并授权完成线上整体验收。原数据库的 670 个账号、10 篇 Article 是执行前盘点值；这些数量本身不能证明没有实际用户。

采用同一 Neon 生产服务中的新空库 `groupher_prod_seed_20261104`，连接真实 Fly API、Auth、Community、Dash、Edge、Press/Hyperdrive、CDN 和真实 AI provider。新库固定发布合同为 **742 条 migration，最后一条 `20261104120000`**。与本轮同时发生的未提交 Mention B0 模型和新增 migration 不属于发布范围，未进入生产。

用户明确豁免：

- 搜索停用，本轮记 **SKIP**；不能宣称 Algolia 或搜索结果验收通过。重新启用需配置 provider、全量重建索引、单独验收。
- 告警实际送达记 **SKIP**。真实健康巡检、无人工保活的常驻观察、失败清单持久化和重启恢复已验证；这些证据不替代接收方收到告警。

本文的 `PS-*` 编号来自[本次手册](./production-seed-acceptance.md)，不会自动关闭其他合同的全部 M0–M5、V01–V15 或 Ticket R12。

## 必须保留的事故记录：PS-INC01

首次 migration 执行错误地命中了旧 `neondb`。原因是把包含 `&` 的原始 dotenv URL 当作 shell 文件直接 source，旧的继承 `DATABASE_URL` 没有被正确替换。旧库 migration 从 `20261026010000` 前进到 `20261101130000`，随后被 Ticket 空库前置检查拒绝。

已确认影响：旧库的三个社区 Kanban layout 被改写，`cms.kanban_states` 被删除。执行前没有该表行数，**无法排除旧 Kanban 数据丢失**。用户、Article、Comment、Review、Outbox 的盘点数量未变，不能据此推断全部旧数据未受影响；Oban 计数变化原因也未完全确定。

处置：停止旧 API machine 并关闭自动启动，旧库留存且不接入当前应用；没有执行猜测性的 down migration 或恢复覆盖。随后给 release 增加实际 Repo 数据库名守卫，使用安全解析/引用的环境变量，在确认连接新空库后完成全部 migration。该事故已在会话中向用户说明。

证据：`migration-failure-database-audit.json`、`old-database-impact-counts.json`、`execution.json.incidents`。新库验收结论**不代表旧库事故恢复完成**；旧库恢复评估需要独立处理，不能在本轮静默覆盖。

## 实际环境与版本

| 消费者 | 实际目标 / 验证                                                                                                |
| ------ | -------------------------------------------------------------------------------------------------------------- |
| API    | Fly `groupher-api`，machine `0807979ad30968`，region `sin`；实际 Repo 输出数据库名、role 和 UTC                |
| DB     | `groupher_prod_seed_20261104`；742 migration；两处旧 Community 字段已不存在，ArticleLifecycle 无重复           |
| Press  | 独立 `press_seed_20261104` role，仅 analysis schema 权限；无法直接读取 CMS；Hyperdrive 指向新库                |
| Auth   | 身份/session 持久化仍委托 Phoenix；测试账号没有 GitHub OAuth identity；通过正式 Auth.js 与 Phoenix Cookie 登录 |
| 持久盘 | 加密 volume `vol_r7ynpqm28ddlyynr`，挂载 `/data`，失败清单归运行用户所有且可写                                 |
| 后台   | `auto_stop_machines=off`、`min_machines_running=1`；无人工保活观察超过 15 分钟，真实 Cron 执行                 |
| 搜索   | `SEARCH_ARTIMENTS_ENABLED=false`，Disabled provider；原 41 条失败同步 intent 已按停用策略处理                  |

版本及 digest 以归档中的 `execution.json`、`p7-auth-version-sanitized.json` 和最终服务清单为准。API 最终功能修复源码 `53a1b2af0`，镜像 digest `sha256:4e200fb51645d33fe5124dc9f00d1cb5e4e86fe0a55c1c49435c2ac7bafac043`；Dash 平台审核页面修复源码 `e1eafafa6`。后续仅文档提交不表示业务镜像重新构建。

## 数据集、身份与定位

保留 `dev`、`mock`、`tmp` 命名空间及固定账号 `author`、`adminDev`、`adminMock`、`platform`、`outsider`、`reporter1–3`。保留的是 demo 身份和内容，不保留临时管理权限或登录旁路。

第一轮 ledger `prod-seed-20261104T061010Z` 创建 37 个固定资源，引用集预期 27 条边；基础 seed 与 references 初始重放均验证幂等。后续真实编辑、回复、移动、Doc Tree 发布会改变当前数据，不能再拿最初 locator/checksum 断言当前内容未变。

四个实际会话窗口分别由 bootstrap 创建并限定最长两小时：

| runId                        | 实际窗口（UTC）                   | 用途                                             |
| ---------------------------- | --------------------------------- | ------------------------------------------------ |
| `prod-seed-20261104T061010Z` | 07:21:34–09:21:34                 | 初始化与第一轮实际请求                           |
| `prod-seed-20261104T094400Z` | 09:43:54–11:43:54                 | 复杂审核、内容编辑与浏览器验收                   |
| `prod-seed-20261104T115500Z` | 11:51:14–13:51:14（实际提前关闭） | 作者 pin 与修复后的互动、平台审核界面复验        |
| `prod-seed-20261104T123000Z` | 12:30:03–14:30:03（实际提前关闭） | 历史风险说明 JSON 与三人举报详情的最终浏览器复验 |

当前 URL 必须读取 **`final-current-manifest.json`**。例如 shared 当前位于 `/dev/post/32` 和 `/mock/post/5`，删除探针位于 `/mock/post/3`；旧 `/dev/post/5`、`/mock/post/2` 不再是这些资源的当前入口。`tmp` 原 id=3 已真实物理删除，现为新实体 id=4；保留 slug claim，不开放普通注册抢占。

## 验收矩阵与主要证据

逐条结论与文件映射见 **`acceptance-case-matrix.json`**。本节列出证据含义与限制，不以一张页面截图代替领域链路验证。

| 范围            | 实际验证                                                                                                                                                                      |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PS-M01–M02      | Post/Blog/Changelog/Doc/User Ticket/Comment 六类公开入口；真实浏览器 graph/mini-map；零引用、自引用排除；PX 两页共 23 条相邻边，无重复/遗漏                                   |
| PS-M03          | Comment 引用删除再恢复，正文版本 2→3→4，边 2→1→2；真实可见页面轮询约 9 秒观测到新 revision                                                                                    |
| PS-M04–M05      | 隐藏时 HTML/Markdown/API/Map 不返回旧标题正文；共享 binding 移除后 Y 可读；非 main Doc Comment 负向数据由受控 fixture 构造，经真实匿名 HTTP 验证后删除                        |
| PS-M06–M07      | 连续两次强制 rebuild 的 facts hash、通知数量不变；真实失败、持久 manifest、API 重启、retry 和最终 report issues=[]                                                            |
| PS-M08          | 常驻与实际巡检通过；接收方实际收到告警 SKIP                                                                                                                                   |
| PS-V01–V04      | 五种 hold 均有真实 DB 历史；阈值为标准 release 编译期 3；三个独立 reporter 汇入同一全局 Item；manual hold 不被真实 AI clear 解除                                              |
| PS-V05–V08      | 社区管理员不能全局处置普通 Comment；queued/running approve 拒绝，running reject 成功；failed 可人工通过；同 command 重放不复制决定，改变 payload 拒绝；迟到结果不覆盖人工决定 |
| PS-V09          | 真实模型 clear/suspect/uncertain；临时错误 bearer 导致实际 401，失败可处理，原凭据恢复；没有伪造 AI 回调                                                                      |
| PS-A01–A03      | move/mirror/unmirror 不复制 Lifecycle；tmp 物理删除后 Article/Comment/互动保留；Y 路径编辑、回复、互动和作者 pin/unpin；缺上下文及 outsider 越权被拒绝                        |
| PS-A04–A06      | 作者列表跨 binding 去重，offset/cursor 三页共 5 条唯一评论；无可读 binding 时消失；删除来源后重试实际 Job，通知不重复；新互动事件记录请求社区 ID                              |
| PS-A07 / PS-T01 | Doc main 正常 Tree 发布和公开读取；preview 不泄漏；User Ticket 保存、冲突、发布、重放；Ticket mirror 与普通 Comment 扩展被拒绝                                                |
| PS-T02          | 真实 Ticket 公开 URL；Article 的 Press/HTML/API/Map 预热、隐藏、恢复及投递完成。没有观测到 Cloudflare HIT 响应头，不能宣称已证明某次边缘 HIT                                  |
| SEARCH          | 已停用，SKIP。历史 SearchIndex Job 859 曾为 discarded；停用后经正常 Oban 接口在事务内重置并取消。原失败证据保留，不冒充搜索成功                                               |

针对 running race 临时发布过有明确过期时间的 4 秒 Judge 延迟探针；完成后源码已移除、普通 Worker 重新部署。非 main Doc 负向 fixture 同样已清理，保留构造/清理脚本与事务证据供复核。

## 线上发现与修复

| 问题                                     | 修复与复验                                                                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| migration 可误连旧库                     | release 在任何 DDL 前断言 Repo 实际库名；旧库被守卫拒绝，新库完整通过                                                                          |
| Community optional homepage 导致运行异常 | Dsb/Classic 均处理未配置 homepage；真实页面复验                                                                                                |
| 静态资源跨域失败                         | Community 静态资源 CORS 与真实页面验证                                                                                                         |
| 根域内容发布路由漏掉精确路径             | Edge 显式处理 `/api/content/publish`；真实内容发布/冲突验证                                                                                    |
| Comment Outbox 回读旧社区关联            | 独立 effect 按稳定 ID 和事件上下文投递；不需要的 effect 不回查创建地                                                                           |
| 举报错误目录未注册导致 500               | 注册 AI/AlertWall ErrorCat，隐藏目标返回稳定 GraphQL 错误                                                                                      |
| 作者评论列表镜像重复                     | 查询先按稳定身份去重再分页，返回当前可读路径；offset/cursor 真实复验                                                                           |
| Comment 互动 Outbox 异常                 | 写入时冻结请求社区 ID；投递时不读 Comment 所属社区；目标社区已删则不转订其他 binding。旧缺上下文 intent 仅跳过不可恢复的订阅，稳定通知幂等投递 |
| 全局 Alert Wall 缺 Account provider      | 平台审核页面挂载正式 AccountStore 与 DashAccountBoundary；真实列表、历史记录和三人举报详情均复验通过                                           |

历史查询另修复了持久化 JSON 字符串 key 与 GraphQL 默认 atom key 解析不一致的问题；29 项回归、编译与实际浏览器风险说明/举报详情读取均通过（源码 `53a1b2af0`）。

pin 的一次误判已纠正：`adminMock` 的 root Passport 不包含作者专属 `comment.pin/undo_pin` 权限，4353 拒绝符合合同。没有发布放宽权限的候选修改；改用 author 在当前 `/mock/post/5` 完成 pin/unpin。

互动修复前后的通知总数均为 4；三条已失败的互动 intent 经正常 Outbox 重投后完成，新 HEART 添加/撤销也已完成并保留原计数 1。两个真实健康巡检失败 Job 重试后恢复。未用 SQL 伪造完成状态。

## 验证与 P7 出口

本地全量后端已有 `2548 passed, 1 excluded` 记录；后续互动修复另跑 44 项相关测试与 `mix compile --warnings-as-errors`，均通过。Auth 路由移除测试 76 项、类型检查、打包通过；平台审核相关 5 项组件测试、Dash 类型检查与打包通过。

固定发布源码的完整 `pnpm docs:check` 通过；混合工作区检查曾被并行 B0 的未提交返回值规则失败拦住，不能将该检查结果混为本轮源码失败或替 B0 宣称通过。`git diff --check` 单独记录。

以下 P7 出口均已有实际证据：

1. 四个 run 均 retain report/apply/verify 完成；活动测试 BrowserSession 与临时 Passport 均为 0，OAuth identity 仍为 0。短期 Phoenix JWT 按现有 V1 合同自然到期，需另外验证最晚 token 窗口及 60 秒余量已过去。
2. API `PRODUCTION_SEED_ENABLED=false`，CLI 已不含 issue 分派；Auth 生产源码不含兑换路由，seed env binding 不存在；旧凭据 POST 404 且不签发 Cookie。
3. Auth 普通生产签名密钥保留。本轮使用随机 opaque grant，没有新增专用 seed 签名密钥；关闭 run、撤销 grant/session 并销毁临时明文凭据，不能用轮换正常服务密钥代替清理。
4. 临时 Press DB probe 已删除，真实 URL 返回 404；Judge 恢复普通版本；本轮浏览器 Cookie 清理，线上授权不能再使用旧 session。
5. 最终 Outbox 无未完成事件、无当前 queued/running review；Map report issues=[]；HTTP 与浏览器正常；历史搜索失败以 SKIP 记录，Job 已明确取消。
6. 脱敏证据上传私有共享 R2，下载后逐文件/整包 checksum 校验一致；本机临时目录不是唯一证据。

最后一枚已签发 Phoenix access token 的最晚到期为 **2026-11-04 13:02:05 UTC**，P7 额外等待到 **13:03:05 UTC** 之后复核。撤销后、到期前的一次实际 `me` 仍识别为 ps-platform，刷新已返回 401；这按现有 Auth V1 的无状态 access TTL 记录，未伪称即时撤销所有 JWT，也未修改账号协议。登出后 session probe 返回 401，本轮八个浏览器上下文均清理 Cookie 并关闭。

最终数据库证据：`p7-final-database-and-disabled-entrypoints.json`；四个 run 全部 closed/retain verified，活动 BrowserSession=0、临时 Passport=0、OAuth identity=0；8 个固定账号和演示社区/内容保留。`p7-access-token-expiry-drain-complete.json` 证明数据库时钟已超过全部 access 窗口及 60 秒余量，remaining_windows=0。

最终 Auth version：`88d77672-9ef5-4189-a703-6c9a2929b1bc`，生产流量 100%，seed binding/旧兑换路由均移除，版本 URL 列表为空。Dash version：`9a0b2552-9794-49f7-bd96-717cf1980872`。API image 和 digest 见上表，仍为 742 条 migration。

共享证据为私有 R2 bucket **`groupher-production-acceptance`**，key **`prod-seed-20261104T061010Z/final/evidence.zip`**。归档含 277 个文件；SHA-256 **`d77c3665b8ced16e139f06512d59e7f6a6aa8a389128da6f90914c7204a445c6`**，大小 922214 字节。已通过独立下载验证整包 SHA-256 及每个成员的大小/校验值。公开 managed domain 关闭，未绑定公开 custom domain；仅 Groupher Cloudflare 账号授权操作者可读取，保留至所有者明确清理。

最终凭据、脚本与后台复核见 `execution.json`、`acceptance-case-matrix.json`、`final-current-manifest.json`。归档内 `execution.json` 是打包时冻结的执行记录；独立下载结果放在外部 `final/receipt.json` 和 `final/readback.json`，避免 checksum 自引用。执行人通过现有 Cloudflare 登录读取，不创建公开分享链接：

```sh
pnpm --filter @groupher/backend-auth exec cf r2 objects get \
  prod-seed-20261104T061010Z/final/evidence.zip \
  --bucket-name groupher-production-acceptance > evidence.zip
shasum -a 256 evidence.zip
```

本轮修复和记录仅在当前本地分支提交，未 push。并行 B0 工作保留在工作区，未部署、未纳入本轮 schema 或验收结论。
