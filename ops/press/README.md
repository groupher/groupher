# Press 上线验收工具

实施方案和已执行证据分别见 [迁移方案](../../docs/press/cloudflare-workers-migration.md) 与 [部署记录](../../docs/press/cloudflare-workers-deployment.md)。这些工具用于运维验收，不提供产品路由或备用运行时。

生产已切到 `press.groupher.com` Worker，旧 `groupher-press` Fly 应用已删除。保持 Free，超限拒绝服务、不升级；部署证据和 Search 独立遗留项见部署记录。下面的 fixture/RPC 工具仍严格限定在隔离 preview，不能替换 hostname 后直接对生产使用。

## 隔离环境

- Phoenix：`backend/api/fly.press-preview.toml`；使用本批候选 backend image 发布，所有 secrets 和数据库均为 preview 专用。
- Auth：`backend/auth` 的 `cf deploy --mode preview`；要求 `AUTH_PREVIEW_ORIGIN`、`PHOENIX_PREVIEW_ORIGIN`、`PRESS_PREVIEW_ORIGIN`，并通过 `--secrets-file` 提供独立 service registry/JWK。
- Press/edge-router：`Deploy Press Worker` workflow 的 `preview` 目标；GitHub Environment 为 `press-preview`。
- 业务 fixture 数据库：`groupher_preview`；Press cache/metrics 数据库：`press_preview`。
- default Press origin 开放 health/internal，真实公开输出经 staging edge-router → named `Public`。preview origin 的 `workers.dev` 只为 health/invalidation 提供稳定地址。

`preview-fixtures.exs` 同时校验 Phoenix hostname 和数据库名；只能创建/操作 `press-preview` 合成社区。它使用真实 CMS Commands/ReviewBlocks 和独立 Search sink。Assets/CDN 外围集成的验收边界见部署记录，不能据此声称生产 CDN purge 成功。

## Preview Phoenix 发布的 migration 行为

`backend/api/fly.press-preview.toml` 默认配置 `/app/bin/migrate` 为 release command。
2026-10-27 无数据库结构变更的候选发布明确使用了 `--skip-release-command`，不是 TOML
移除了 migration。完整部署命令及 15 项测试的文件清单见
[本轮命令记录](../../docs/press/cloudflare-workers-deployment.md#本轮实际部署与本地测试命令)。
后续包含 DDL 的 preview 发布不能照搬跳过参数，须按该批 migration 计划执行。

## 真实公开 HTTP 验证

先在 staging 创建合成数据并输出 locator；运行环境检查在 fixture 文件内执行，不能切换到生产 app：

```sh
python3 ops/press/preview-rpc.py seed --output /absolute/private-directory/fixtures.json
python3 ops/press/preview-rpc.py hold:doc
python3 ops/press/preview-rpc.py probe
python3 ops/press/preview-rpc.py restore:doc
```

`hold/restore` 调用真实 ReviewBlocks transaction，并通过真实 Outbox workflow 确认 Press/Search 两个 child 完成、CDN child 完成或预期失败已终止后返回三者 `deliveries.children`；restore 只结束 `press-preview-` 来源的测试限制。Search sink 仅在操作期间生效；先暂停四个本地队列并等待运行中 job 完成，退出时终止合成社区遗留 intents、取消其 queued jobs，恢复 adapter 后恢复原本未暂停的队列。正常和异常路径都执行清理；清理失败则保持队列暂停。pause/resume 必须返回 `:ok`、cancel 必须返回 `{:ok, count}`；恢复后轮询实际 queue paused 状态与原值一致，超时就失败。成功结果包含 `queues.before`、`queues.after`、`queues.confirmed=true`，RPC 同时检查没有配置泄漏。工具仅用于隔离的单节点 preview；RPC 在执行前检查 Machine 数必须为一，不能在生产或多 Machine 环境运行。ASCII 图见 [独立投递说明](../../docs/press/effect-delivery.md)。`probe` 从 Phoenix 投影推导预期状态与条目数，状态或计数不符时退出失败；`probe` 从 Singapore Phoenix Machine 访问公开 edge-router，可与本地请求的 Cloudflare colo 对照。发送 review transition 后先确认该 intent 已完成 Press invalidation，再断言即时读取结果；不能用等待 TTL 到期代替失效验收。

fixture JSON 格式为：

```json
{
  "community": "press-preview",
  "articles": [
    { "thread": "post", "inner_id": 1 },
    { "thread": "blog", "inner_id": 2 },
    { "thread": "changelog", "inner_id": 3 },
    { "thread": "doc", "inner_id": 4 }
  ]
}
```

```sh
node ops/press/verify-public.mjs \
  --public-origin https://edge-router-preview.groupher.workers.dev \
  --internal-origin https://press-preview.groupher.workers.dev \
  --fixtures /absolute/private-directory/fixtures.json \
  --auth-file /absolute/private-directory/invalidation-auth.json \
  --report /absolute/private-directory/report.json
```

停服状态添加 `--disabled`：公开内容必须为 no-store 503，包括携带 `If-None-Match` 的请求；default 内容仍为 404，health/internal 保持原合同。`--auth-file` 可省略，但最终验收必须覆盖签名失效请求。

invalidation auth 文件字段为 `clientId`、`clientSecret`、`tokenEndpoint`、`resource`。使用该环境的 Phoenix client，resource 为该环境 Press 的 `/internal`。文件权限设为 0600，放在仓库外；不要把值写到命令参数或聊天中。

## 数据库只读探测

`backend/press` 的 `probe` mode 发布临时 `press-db-probe`，仅提供带随机 `PROBE_TOKEN` 的 `POST /internal/probe`。它执行只读 SQL 并等待 client 关闭，不读取业务内容、不写 cache/metrics。

```sh
PRESS_HYPERDRIVE_ID=<config-id> pnpm --filter @groupher/press exec cf deploy \
  --mode probe --secrets-file /absolute/private-directory/probe-secrets.json
```

通过受保护脚本发送 Bearer token，不将 token 展开到 shell 参数。核对匿名 401、指定 runtime role、UTC 和三个 analysis 表读取后删除临时 Worker：

```sh
cf workers delete press-db-probe --force
```

## 数据库 migration

`Deploy Press Worker` workflow 中 `apply_migrations=true` 启用独立 migration job。临时向目标 GitHub Environment 添加 `PRESS_MIGRATION_DATABASE_URL`；只有 migration job 可读取，deploy/Worker 不接收它。migration 失败会阻断部署。记录 job 成功后移除该 secret；正常代码发布保持 `apply_migrations=false`。

production migration 和部署都要求 `confirm_press_cutover=true`，并遵循文档中的 best-effort 窗口顺序。不要将 production Hyperdrive、数据库或 secret 绑定到 preview Worker。

## Free 监控与 route 复核

生产保持 Workers Free：超限拒绝、不升级、不回退。Free 100k/day 是账号共享额度，UTC 零点重置；
Press 与 Auth、edge-router、其它 Worker 共用。5 MiB 的 61–75ms CPU 样本不符合标称 10ms，
大内容持续可用性未通过容量验收，不能因为低流量或一次 HTTP 200 宣称通过。

`Press Free guard` workflow 在 GitHub Actions 每 30 分钟（分钟 13/43）检查，执行端独立于
Workers。首次启用需要合并到仓库默认分支，并手动运行一次；GitHub Environment 使用现有
`press-production` 的 `CLOUDFLARE_API_TOKEN`，需要 Account Analytics Read 和本 zone 的
Workers Routes Read。权限不足、查询失败或探针异常均让 workflow 失败，不能当成零消耗。
GitHub 的 Actions 失败通知取决于接收者 notification/watch 设置；没有额外 webhook，也没有
自动升级/付款逻辑。配置代码已提供不代表定时任务已生效；部署记录须保留实际 run 链接。

```sh
node --test ops/press/free-guard.test.mjs
node ops/press/free-guard.mjs
# 每次修改 zone/route（包括重新部署 router/auth）后必须执行：
node ops/press/free-guard.mjs --routes-only
```

凭据通过受保护环境注入 `CLOUDFLARE_API_TOKEN`，不要把 token 放进命令参数、日志或聊天。
脚本只读 GET zone routes 并查询 Analytics GraphQL，不改变订阅、route、DNS 或内容。
复核要求 `groupher.com/*`、`www.groupher.com/*`、`auth.groupher.com/*` 的目标正确，且所有
指向 edge-router/auth 的本 zone routes 均显式 `request_limit_fail_open=false`。普通 curl 200
不能证明 fail mode 正确。新增其它 zone 时须把对应 zone/预期 routes 纳入脚本再发布。

告警阈值：UTC 当日全账号采样 invocation 估算 ≥70k；最近 30 分钟至少 100 次调用且错误率
≥1%；任一 CPU-limit rejection；或任一公开探针失败。报告包含账号调用/错误估算和拒绝样本，
不按单个 Press 请求简单乘算共享额度。Analytics 是 adaptive 采样且有延迟，invocation 与计费
request 口径不同，此阈值只是保守预警，不能保证耗尽前一定触发，也不能当作精确余额。
Hyperdrive SQL 额度与 Phoenix 回源专项告警仍待后续配置，本脚本不能替代它们。

公共探针检查 edge-router/Auth/Press health、`home/llms.txt` 可读及 Press origin 同路径 no-store
404；低流量时直接捕获失败，不依赖错误率的最小样本。平台拒绝可能发生在用户代码执行前，
必须结合外部探针与 Cloudflare Metrics 的 `exceededCpu`/1027 查看，不能只统计应用日志。
GitHub schedule 为 best-effort，可能延迟；半小时检查不构成可用性 SLA。

Press binding 抛出异常且 router 仍在执行时返回 no-store 503 + Retry-After；已有 HTTP 错误响应
保持原状态。账号额度耗尽导致 router 自身无法执行时接受 Cloudflare 1027/资源限制错误，
不保证由应用返回 503，绝不旁路到 origin。default 内容继续 404，health 不检查 DB/Gate 可用性。

Free guard daily 无维度 `sum` 与按 scriptName 分组总和已做同窗只读对照：483 = 483（10个分组）；不是 Dashboard 对账或精确账单。该证据及 Custom Domain 与 core routes 的复核边界见 [投递与统计说明](../../docs/press/effect-delivery.md#free-guard-的统计口径)。

2026-10-27 已完成真实 preview seed/Post/Doc hold/restore：三个 child 与四个队列恢复结果见 [部署验收记录](../../docs/press/cloudflare-workers-deployment.md#隔离-preview-真实队列验收2026-10-27)。生产尚未部署本批改动。
