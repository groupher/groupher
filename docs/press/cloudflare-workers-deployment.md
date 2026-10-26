# Press Workers 部署记录

> 2026-10-26：生产硬切尚未执行；以下记录已实际完成的资源配置与隔离验收。

## 代码与生产 Phoenix

- [PR #602](https://github.com/groupher/groupher/pull/602) 已合并到 `dev`，提交 `d7db690f695533dc444035c7bb0f67d6c87a14fb`。
- 同一提交的 [Phoenix 生产部署](https://github.com/groupher/groupher/actions/runs/40301883206) 成功；`https://api.groupher.com/health` 返回 200。
- 公开输出仍由当前 Gate 负责。没有执行 AlertBoard V2 production cutover。
- staging 发现并修复：同账号 Auth Worker HTTP 调用缺少 `global_fetch_strictly_public`；Cloudflare 压缩产生的弱 ETag 不能返回 304；5 秒 Phoenix 回源超时无法覆盖冷启动。后续变更须通过 CI 并合并后再做生产硬切。

## 已配置资源

| 环境       | 资源                                                                       | 状态                                                                                                        |
| ---------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| production | Hyperdrive `press-analysis-production`：`32a99d5d789043f09c39d728d9ae2aeb` | query cache disabled；连接现有生产 analysis 数据                                                            |
| production | PostgreSQL runtime role `press_worker_cf`                                  | 只授予三个 Press 表及所需 sequence 的权限；已验证无 CMS 表访问权限                                          |
| production | GitHub Environment `press-production`                                      | Hyperdrive ID、Press service credential、原有 metric salt 与生产 endpoint 已配置；public disabled 保持 true |
| preview    | Neon project `groupher-press-preview`：`spring-dew-46030887`               | Singapore，独立业务数据库 `groupher_preview` 和 analysis 数据库 `press_preview`；不复制生产业务数据         |
| preview    | Hyperdrive `press-analysis-preview`：`b68f73b9cd9a4642819365c707ae3146`    | query cache disabled；独立角色 `press_preview_worker`                                                       |
| preview    | Phoenix `groupher-press-preview-api.fly.dev`                               | 使用上述已发布的 Phoenix image，独立数据库、签名及 service client secrets                                   |
| preview    | Auth `auth-press-preview.groupher.workers.dev`                             | 独立 RSA key/JWKS、Press/Phoenix/Auth service clients；不使用生产 secret                                    |
| preview    | Press `press-preview.groupher.workers.dev`                                 | default 只开放 health/internal；public 内容经 Service Binding 调用                                          |
| preview    | edge-router `edge-router-preview.groupher.workers.dev`                     | 仅允许 Press/health；绑定 preview Press 的 named `Public`                                                   |

数据库 owner 连接和 API key 仅用于受控运维，不进入 Worker binding、源码、日志或本文。生产三个 Press 表已在角色授权前备份；当时包含 4 条 raw metric、44 条 hourly aggregate、0 条 cache。备份存放于受保护的本地运维目录，未提交仓库。

## 已完成验收

- staging 真实 HTTP 常规验收 24/24：Post/Blog/Changelog/Doc Markdown、RSS/Atom/JSON Feed、Doc Feed、llms、sitemap、压缩弱 ETag 的 304、default 内容 404、unsigned invalidation 401、Phoenix-signed invalidation 200。
- Review restriction：Post 与 Doc 各自开始/结束共 4 次 transition，通过真实 CMS transaction → Outbox → Press invalidation，在 PDX、SIN 两个 Cloudflare colo 复验 Markdown 与 Feed。测试先将已存在的测试 cache pointer/negative entry 延长到 5 分钟，再确认 Outbox 后 pointer 被删除，因此结果不能由自然 TTL 到期解释。没有读到旧正文或旧 404。
- 生产 Hyperdrive：临时受保护的只读 Worker 5 次并发读取三个 Press 表均成功；匿名请求 401；数据库角色为 `press_worker_cf`，timezone UTC。探测 Worker 已删除。
- Retention：在 preview analysis 写入过期测试数据，执行实际清理函数；6 次并发覆盖正常与 SQL 失败，另覆盖连接失败；测试 backend PID 无残留，过期测试数据已删除。
- Phoenix 冷启动：显式停止 preview Phoenix Machine，清除 Press pointer 后从公开路由首次读取；约 8.2 秒返回 200，并确认 Phoenix 是新启动实例。原 5 秒期限已改为 15 秒，service token 获取期限仍为 5 秒。
- 本地检查：Press 35 tests、Auth 66 tests、相关 TypeScript type-check/lint 通过。
- 停服演练：Press/edge-router disabled 的四种组合均已验证。任一 guard 开启时公开内容为 no-store 503（携带 ETag 也不返回 304），default 内容始终 404，health/internal 保持可用。恢复两个 guard 为 false 后重新执行常规 24/24 HTTP 验收。

### staging 外围集成边界

该环境只验收 Press 链路。Assets endpoints 指向 `.invalid`，Cloudflare 公共页面 purge 使用无权限占位配置；Search provider 使用 fixture 内的 sink，避免写入生产索引。CMS Gate、ReviewBlocks、Outbox、service JWT、Press HTTP、Hyperdrive、cache 与 metrics 均使用真实实现。

Review visibility Outbox 已实际完成 Press invalidation，随后在独立的公共页面 CDN purge 步骤返回 `cloudflare_rejected`。这验证了 Press 失效链路，不等于整个 CDN purge workflow 成功。生产硬切后必须另验 Outbox completion/retry；不能将此 staging 结果作为生产 CDN purge 的验收。

## 尚未完成

- 后续修复 CI/合并；首次受控 CI migration 及短时 migration secret 清理。
- 确认 Workers Paid（当前账户订阅 API 未列出 Workers Paid）。
- 生产受控可见性复验、best-effort domain/Service Binding 硬切、最终生产 HTTP/跨 POP/Outbox 验收与旧 Press Fly 退役。
- 至少 7 天的容量、失败率与账单观察。

生产域名仍为 `press.groupher.com`。硬切窗口接受中断、不保证输出；不添加 Fly fallback、兼容路由或备用 origin。
