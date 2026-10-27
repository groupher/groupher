# Groupher Status

`ops/status` 是公开状态页和前端可用性监控 Worker。每两分钟通过 Cloudflare
Service Bindings 检查六个前端入口，D1 只保存当前状态与连续成功/失败次数；不保存或迁移
Gatus 的历史结果。

## 监控边界

| 显示名称           | Worker        | 请求      |
| ------------------ | ------------- | --------- |
| Public Edge Router | `edge-router` | `/health` |
| Public Website     | `landing`     | `/`       |
| Community          | `community`   | `/health` |
| Dash               | `dash`        | `/health` |
| Apply              | `apply`       | `/health` |
| Inspire Me         | `inspire-me`  | `/health` |

允许列表保存在 `src/probes.ts`。探测不请求 Phoenix、GraphQL、Fly 域名、社区内容页或
依赖后端的 readiness endpoint。`groupher.com/health` 只代表 Edge Router；Landing 由
自己的 Service Binding 检查。Service Binding 验证 Worker 本身，不覆盖公开 DNS 和完整
业务页面。后端停机时前端 `/health` 仍可能是绿色，这是本阶段刻意保留的边界。
状态页只反映监控目标的可用性，不替代应用日志、链路追踪、业务验收或发布回滚判断。

三次连续失败才标为 unavailable；恢复时需要两次连续成功。最近一次检查超过六分钟，
公开页面改为 `No recent check`，避免定时器中断后继续显示绿色。页面本身不触发检查。
本阶段不发送 Discord 告警。

## 开发与部署

```bash
pnpm --filter @groupher/status run type-check
pnpm --filter @groupher/status run test
pnpm --filter @groupher/status run deploy:dry-run
pnpm --filter @groupher/status exec wrangler d1 migrations apply groupher-status --remote
pnpm --filter @groupher/status run deploy
```

生产 D1 数据库为 `groupher-status`，binding 名为 `DB`。Worker 名为 `status`；
`wrangler.jsonc` 配置一个 `*/2 * * * *` Cron Trigger。部署前应确认六个目标 Worker
均已存在。临时验证地址为 `https://status.groupher.workers.dev`，正式入口为
`https://status.groupher.com`。

旧 Gatus/Fly 配置已从本目录移除，历史设计见
[`status-check-v1.md`](../../docs/infra/diagnostics/status-check-v1.md)。生产 DNS 已切换到
Cloudflare Worker，旧 Fly 应用 `groupher-status` 已删除。

## 后续迁入 Container

当前 Worker 将调度、探测、状态和页面拆开。若未来检查复杂度超出 Workers Free 的
10 ms CPU 限额，可保留公开页面与 D1，把重型探测执行器迁入 Container；若选择恢复
Gatus，则需要重新实现配置映射、运行管理和持久化存储。Cloudflare Container 的本地
文件系统默认不持久，不能把旧 SQLite 路径直接作为长期存储。
