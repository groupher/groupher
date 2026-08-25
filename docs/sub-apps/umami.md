# Umami on Fly.io

> 状态：已完成（2026-08-25）
>
> 更新：2026-08-25

## 当前状态

Groupher 自托管的 Umami 已从 Vercel 迁移到 Fly.io。`analysis.groupher.com` 是唯一稳定的
产品集成地址；2026-08-25 已确认其 `/api/heartbeat` 返回 200，响应由 Fly 提供。

- 公开分析源站继续使用 `https://analysis.groupher.com`。
- 现有 Neon `umami-dev` 继续保存 Umami 数据。
- Groupher 的 Web Analysis 脚本、Phoenix provider、GraphQL DTO 和 website ID 不因平台迁移改变。
- 旧 Vercel 项目 `umami` 已删除；不再把 Vercel 作为 Umami 的运行或回滚平台。
- Fly 的发布版本、Machine 数量和 secrets 以 `groupher/umami` fork 及 Fly 控制台为准。

本次只迁移 Umami 应用运行层，不迁移数据库，也不处理历史统计数据。Neon `umami-dev` 原地保留，
已有历史数据通过继续使用同一个数据库自然保留；不执行 dump/restore、历史数据回填或历史统计对账。

当前不启用或验收 2FA。未来启用 2FA 时，需要在 Fly 配置稳定的
`TWO_FACTOR_ENCRYPTION_KEY`，并增加 2FA 专项验收。

## 当前基线

- Umami 源码：`groupher/umami` fork，fork 自 `umami-software/umami`。
- 当前应用：Fly.io 上的 Umami 实例。
- 当前数据库：Neon 项目 `umami-dev`。
- 当前 fork 版本：以 `groupher/umami` 的线上 release/commit 记录为准。
- 正式源站：`analysis.groupher.com`。
- Fly 的 `*.fly.dev` 地址仅用于部署、预发布和平台诊断，不作为产品配置地址。
- 当前 `/api/heartbeat` 和 `/script.js` 均通过正式域名访问。

当前仓库不包含 Umami 源码，只包含 Groupher 的接入逻辑和部署文档。Umami 镜像构建、Fly 配置和发布记录应以 `groupher/umami` fork 为主要修改位置；本仓库只同步平台边界和验收结果。

## 目标拓扑

```text
浏览器
  -> https://analysis.groupher.com/script.js
  -> https://analysis.groupher.com/api/send
                 |
                 v
          Fly.io Umami
                 |
                 v
          Neon umami-dev

Phoenix Analysis.Web
  -> Umami API
  -> 受限 Groupher DTO
  -> Dashboard
```

`analysis.groupher.com` 是稳定的产品集成地址，不应改成 Fly 的诊断域名。Fly 的 `*.fly.dev` 地址只用于部署、预发布和平台诊断。

## 平台决策

### 第一阶段：升级并迁移应用

Fly 应用建议命名为 `groupher-umami`。主区域不再预先写死；Phase 0 先记录 Neon 区域、现有 Fly 服务区域并做连接延迟测试，再确定目标区域。

Umami 使用外部 Neon PostgreSQL，因此第一阶段不创建 Fly Volume。Fly 的根文件系统是临时的，Volume 又是绑定单台 Machine 的本地持久盘；数据库在外部托管时，Umami 不需要依赖本地磁盘状态。

生产实例建议使用至少 1 台 Machine 起步，稳定后运行 2 台无状态实例。是否直接启用 2 台由流量、成本和数据库连接数测试决定。

不在本计划中迁移数据库。Neon `umami-dev` 继续作为唯一数据库，不创建 Fly Postgres，不执行历史数据导出、导入、回填或对账。

## 历史迁移记录

下面的 Phase 0–5 保留迁移时的检查项，便于追溯；它们不是当前待执行计划。
其中涉及 Vercel 升级、回滚或 DNS 切换的条目均已结束，不能作为新的部署目标。

### Phase 0：盘点与冻结

1. 确认 `groupher/umami` 当前线上 release tag 或 commit SHA，并将 fork 升级到 `3.3.1` 后重新固定目标 commit。
2. 导出 Vercel Production 环境变量名称和配置范围，不将 secret 值写入 Git。
3. 保留当前 `APP_SECRET`；不要因为迁移平台而重新生成。
4. 检查目标 fork 的 `Dockerfile`、`package.json`、`build-docker`、`start-docker` 和 `check-db`：确认 migration 是构建期还是启动期动作，以及目标镜像是否包含 `npm run update-db`。
5. 记录 `DATABASE_URL`、`DIRECT_DATABASE_URL`、`DATABASE_TYPE`、`SKIP_DB_CHECK`、`SKIP_DB_MIGRATION`、`BUILD_GEO`、`SKIP_BUILD_GEO`、`GEO_DATABASE_URL`、`MAXMIND_LICENSE_KEY` 及所有 `FORCE_SSL`、`CORS_MAX_AGE`、`DISABLE_*` 等实际生效变量；2FA 当前不纳入配置清单和验收。
6. 通过 Neon 控制台或 `neonctl` 记录 Neon 区域；同时记录现有 Fly 服务区域，并以实测连接延迟确定 Umami 目标区域。
7. 确认权威 DNS provider 和 `analysis.groupher.com` 当前 TTL；切换前将可控 TTL 预降到约 60 秒，并用权威查询确认实际 TTL。
8. 记录 website ID、管理员登录、API token 使用方；不导出或处理历史统计数据。
9. 确认 Phoenix 的 `WEB_ANALYSIS_API_TOKEN` 是否需要随 Umami token 变化而更新。
10. 确认 Neon snapshot 的创建和恢复方式，但不要在 Phase 0 提前创建实际快照；实际快照必须紧贴 Vercel Production 升级构建前创建。

退出条件：目标版本、fork 的 migration 行为、变量分类、Neon/Fly 区域、DNS TTL、website ID 和回滚入口均有记录。

### Phase 1：准备 Fly 应用

1. 先确认 Vercel 使用源码 `build` 而不是 Docker 专用 `build-docker`；源码 `build` 会在构建期执行 `check-db`。
2. 为 Vercel Production 配置 pooled `DATABASE_URL` 和 direct `DIRECT_DATABASE_URL`，保持 `SKIP_DB_MIGRATION` 未设置，让构建期 `check-db` 自动使用 direct URL 完成 Prisma migration。Vercel Preview 构建设置非生产占位 `DATABASE_URL`（仅供 Prisma build/generate 读取，不得指向 Neon），并设置 `SKIP_DB_CHECK=1`；Preview 不配置 `DIRECT_DATABASE_URL`，也不连接生产 Neon。若 Preview 必须验证数据库连接，则改用独立的非生产 `DATABASE_URL`，并设置 `SKIP_DB_MIGRATION=1`，不要使用生产数据库。
3. 在 Vercel Production 升级构建开始前立即创建 Neon snapshot；该 snapshot 对应本次 migration，不在 Phase 0 提前创建。
4. 将 Vercel Production 的 `BUILD_GEO` 配置与当前线上保持一致；如果当前使用 `BUILD_GEO=1`，升级时必须保留。GeoIP 配置是统计一致性检查，不是本次正常启动的阻断项。
5. 将 Vercel 项目升级到同一个 `3.3.1` tag/commit，并从构建日志确认 migration 使用 direct URL。
6. 迁移期间曾在 Vercel 上验证启动、管理员登录、脚本采集、Dashboard 和 Phoenix analytics 查询；该实例已不再作为回滚目标。
7. 在升级后的 `groupher/umami` fork 中准备 Dockerfile 和 `fly.toml`，固定 `3.3.1` 的 tag/commit，不使用 `latest`。
8. 将 Umami 服务端口配置为 `3000`。
9. 配置 `/api/heartbeat` 健康检查、HTTPS 和滚动发布。
10. 使用 Fly runtime secrets 写入 `DATABASE_URL`、`DIRECT_DATABASE_URL`、`APP_SECRET` 和其他运行时敏感配置；当前不配置 2FA key。
11. 将 `release_command` 配置为 wrapper：先将 `DATABASE_URL` 临时设置为 `DIRECT_DATABASE_URL`，再执行 `npm run update-db`。不要让 `update-db` 直接读取 Neon pooled URL。
12. `release_command` 在新版本 Machine 接收流量前运行一次；若没有待执行 migration，该命令应无副作用地完成。release command 失败时不得继续切换流量。
13. 发布后将 `SKIP_DB_MIGRATION=1` 作为运行时控制，避免 Umami 默认的启动流程在每台 Machine 上重复执行 migration；保留 `check-db` 的连接和版本检查。
14. `DATABASE_TYPE=postgresql` 若被目标 Dockerfile 消费，作为非敏感 build arg/env 传入；不要把它当作 secret。`DATABASE_URL`、`DIRECT_DATABASE_URL` 只有在目标 Dockerfile 的 build 阶段实际读取时才使用 Fly build secret，否则只作为 runtime/release secret。
15. Fly 构建时不设置 `VERCEL`，默认执行 GeoIP build；只有目标 fork 明确要求时才设置 `SKIP_BUILD_GEO`。如果 `GEO_DATABASE_URL` 含有私有签名或 license 信息，才将其作为 build secret 传入。
16. 创建独立的预发布 Fly app 或使用 Fly 临时域名，不接管正式 DNS。

退出条件：Fly app 可以构建、启动，Machine 为 healthy，且没有 secret 泄露到镜像或日志。

### Phase 2：预发布验证

通过 Fly 临时域名完成以下检查：

- `/api/heartbeat` 返回 HTTP 200 和 `{"ok":true}`。
- `/script.js` 返回 200，内容可被浏览器执行。
- 使用隔离 website 或测试页面验证 `/api/send`。
- Umami 登录、Dashboard 和现有 website 配置正常；不做历史数据迁移或历史数据对账。
- Phoenix 的 Overview、Trends、Active Users 查询正常。
- API token 认证正常，401/403 行为没有变化。
- 对新的实时访问样本验证 country/city 统计；不回算历史访问的地理位置。
- 检查 `release_command` 日志，确认 migration 使用 Neon direct host/port；不得只证明应用 runtime 可以访问 pooled URL。
- 普通启动日志没有 crash loop、`TWO_FACTOR_ENCRYPTION_KEY` 缺失导致的启动错误或其他 fatal error；当前不执行 2FA 登录测试。
- Fly health checks、应用日志、数据库连接数和错误率正常。
- 预发布使用 Fly 临时域名验证 heartbeat、script、登录和只读 Dashboard；不向多个实例重复发送测试 pageview。

退出条件：Fly 实例在不改变正式 DNS 的情况下，可以完整承载采集、查询和管理路径。

### Phase 3：正式 DNS 切换

1. 为 Fly app 添加 `analysis.groupher.com` certificate。
2. 按 Fly certificate 输出配置 DNS 记录。
3. 确认 Fly certificate 已签发，且 Fly 临时域名和自定义域名均可访问。
4. 确认 DNS TTL 已预降并记录切换前的权威解析结果。
5. 将 `analysis.groupher.com` 从旧 Vercel 记录切换到 Fly。
6. 切换期间保留 Neon 数据库；Vercel Umami 项目在观察期结束后删除。

切换窗口内优先验证 DNS、TLS、heartbeat 和脚本加载；不要先从 Groupher 业务页面判断迁移是否成功。

### Phase 4：线上观察

至少观察 24–48 小时：

- 真实页面持续产生 pageview。
- `/api/send` 没有持续性 4xx/5xx。
- Umami Dashboard 能看到切换后的 realtime 和新产生的访问。
- Phoenix analytics 查询没有超时、空数据或 provider error。
- Fly Machine 没有反复重启，health check 持续通过。
- Neon 连接数、延迟和错误率没有异常增长。

### Phase 5：收尾

观察期通过后：

1. 将 Fly app、区域、Machine 数量和 secret 管理方式记录到 Umami 部署记录。
2. 更新本仓库的部署文档和本地开发说明。
3. 记录 Fly app、区域、Machine 数量和 secret 管理方式；如创建了 Neon 快照，则按既定保留期保留它作为 schema migration 的故障保护。
4. 观察期通过后删除旧 Vercel Umami 项目（已完成）。

## 配置清单

### Umami 应用侧

- 构建参数：`DATABASE_TYPE=postgresql`（仅当目标 Dockerfile 消费）、`BASE_PATH`、`SKIP_BUILD_GEO`、`BUILD_GEO`。
- 构建期 GeoIP 输入：`GEO_DATABASE_URL`、`MAXMIND_LICENSE_KEY`（仅在构建实际读取时传入；含敏感信息时使用 build secret）。
- 运行时/release secret：`DATABASE_URL`、`DIRECT_DATABASE_URL`、`APP_SECRET`。当前不配置 `TWO_FACTOR_ENCRYPTION_KEY`。
- 运行时行为：`CORS_MAX_AGE`、`FORCE_SSL`、`CLIENT_IP_HEADER`、`DISABLE_BOT_CHECK`、`DISABLE_LOGIN`、`DISABLE_UPDATES`、`DISABLE_TELEMETRY` 等实际生效变量。
- 启动/migration 控制：Production/Fly 一般只设 `SKIP_DB_MIGRATION=1`，保留启动期连接和版本检查；不要用 `SKIP_DB_CHECK=1` 替代，否则会跳过整个 `check-db`。Vercel Preview 是例外：由于 Preview 不应连接生产 Neon，构建时使用非生产占位 `DATABASE_URL` 并设置 `SKIP_DB_CHECK=1`；如果使用独立非生产数据库，则改用 `DATABASE_URL` + `SKIP_DB_MIGRATION=1`。正式 migration 由使用 direct URL 的 `release_command` 执行。
- Fly app 名称、主区域、Machine 数量
- 服务端口 `3000`
- 健康检查 `/api/heartbeat`
- 正式域名 `analysis.groupher.com`

### Groupher 侧

- `WEB_ANALYSIS_WEBSITE_ID` 保持不变。
- `WEB_ANALYSIS_API_TOKEN` 继续只存在 Phoenix 服务端。
- `Analysis.Web.Config.origin` 继续使用 `https://analysis.groupher.com`。
- [WebAnalysisScript.tsx](/Users/xieyiming/code/groupher/groupher/frontend/main/src/app/WebAnalysisScript.tsx) 继续使用正式源站，不改为 `*.fly.dev`。

## 当前故障恢复

如果 Fly 版本出现采集失败、登录失败、数据查询错误或持续不健康：

1. 使用 Fly 的 previous release/image 回滚能力恢复上一版本。
2. 检查 Fly release command、数据库连接和环境变量，不在普通应用故障窗口内恢复 Neon snapshot。
3. 只有数据库 schema 无法继续使用时，才进入 Neon snapshot 恢复流程；恢复前必须暂停写入并明确接受 migration 后新增数据丢失。
4. 修复 Fly 版本后重新通过预发布验证。

正常情况下，回滚只需要恢复 Fly 上一版本，不需要 PostgreSQL 数据恢复，也不需要回滚 Groupher 的前端或 Phoenix 代码。
Neon snapshot 只用于 migration/schema 级故障，不是普通平台回滚步骤。

## 当前验收记录

- [x] `analysis.groupher.com/api/heartbeat` 返回 HTTP 200，且响应由 Fly 提供（2026-08-25）。
- [x] 正式脚本和 API 继续使用 `analysis.groupher.com`，未改用 `*.fly.dev`。
- [x] Neon `umami-dev` 保持为 Umami 数据库，未执行数据库迁移或历史数据回填。
- [x] 旧 Vercel `umami` 项目已删除；域名注册、Cloudflare DNS、Fly 应用和 Neon 未受影响。

迁移期间的版本、release command、GeoIP、TLS 和 24–48 小时观察记录，保留在上面的历史
Phase 清单和 `groupher/umami` fork 的发布记录中；它们不表示当前仍需保留 Vercel 资源。

## 参考

- [Umami Installation](https://docs.umami.is/docs/install)
- [Umami Environment Variables](https://docs.umami.is/docs/environment-variables)
- [Fly.io Dockerfile 部署](https://fly.io/docs/languages-and-frameworks/dockerfile/)
- [Fly.io Health Checks](https://fly.io/docs/reference/health-checks/)
- [Fly.io Custom Domains](https://fly.io/docs/networking/custom-domain/)
- [Fly.io Release Command](https://fly.io/docs/reference/configuration/)
- [Fly.io Build Secrets](https://fly.io/docs/apps/build-secrets/)
- [Umami Releases](https://github.com/umami-software/umami/releases)
- [Umami Container Versions](https://github.com/umami-software/umami/pkgs/container/umami/versions)
- [Umami 3.3.1 migration: 24_lowercase_username](https://raw.githubusercontent.com/umami-software/umami/v3.3.1/prisma/migrations/24_lowercase_username/migration.sql)
