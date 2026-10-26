# Press 上线验收工具

实施方案和已执行证据分别见 [迁移方案](../../docs/press/cloudflare-workers-migration.md) 与 [部署记录](../../docs/press/cloudflare-workers-deployment.md)。这些工具用于运维验收，不提供产品路由或备用运行时。

生产已切到 `press.groupher.com` Worker，旧 `groupher-press` Fly 应用已删除。保持 Free，超限拒绝服务、不升级；部署证据和 Search 独立遗留项见部署记录。下面的 fixture/RPC 工具仍严格限定在隔离 preview，不能替换 hostname 后直接对生产使用。

## 隔离环境

- Phoenix：`backend/api/fly.press-preview.toml`；使用记录的 production image 发布，所有 secrets 和数据库均为 preview 专用。
- Auth：`backend/auth` 的 `cf deploy --mode preview`；要求 `AUTH_PREVIEW_ORIGIN`、`PHOENIX_PREVIEW_ORIGIN`、`PRESS_PREVIEW_ORIGIN`，并通过 `--secrets-file` 提供独立 service registry/JWK。
- Press/edge-router：`Deploy Press Worker` workflow 的 `preview` 目标；GitHub Environment 为 `press-preview`。
- 业务 fixture 数据库：`groupher_preview`；Press cache/metrics 数据库：`press_preview`。
- default Press origin 开放 health/internal，真实公开输出经 staging edge-router → named `Public`。preview origin 的 `workers.dev` 只为 health/invalidation 提供稳定地址。

`preview-fixtures.exs` 同时校验 Phoenix hostname 和数据库名；只能创建/操作 `press-preview` 合成社区。它使用真实 CMS Commands/ReviewBlocks 和独立 Search sink。Assets/CDN 外围集成的验收边界见部署记录，不能据此声称生产 CDN purge 成功。

## 真实公开 HTTP 验证

先在 staging 创建合成数据并输出 locator；运行环境检查在 fixture 文件内执行，不能切换到生产 app：

```sh
python3 ops/press/preview-rpc.py seed --output /absolute/private-directory/fixtures.json
python3 ops/press/preview-rpc.py hold:doc
python3 ops/press/preview-rpc.py probe
python3 ops/press/preview-rpc.py restore:doc
```

`hold/restore` 调用真实 ReviewBlocks transaction，并通过真实 Outbox workflow 确认 Press invalidation 后返回 `deliveries`；restore 只结束 `press-preview-` 来源的测试限制。Search sink 仅在操作期间生效，`finally` 恢复原配置，RPC 同时检查没有配置泄漏。`probe` 从 Phoenix 投影推导预期状态与条目数，状态或计数不符时退出失败；`probe` 从 Singapore Phoenix Machine 访问公开 edge-router，可与本地请求的 Cloudflare colo 对照。发送 review transition 后先确认该 intent 已完成 Press invalidation，再断言即时读取结果；不能用等待 TTL 到期代替失效验收。

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
