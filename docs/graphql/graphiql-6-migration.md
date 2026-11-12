# GraphiQL 6 和 GraphQL 链路

## 当前架构

```text
浏览器 /graphiql -> Phoenix 构建好的 GraphiQL 6 静态资源
                    -> 同源 /graphql -> BrowserCsrf -> Context -> Absinthe
产品浏览器 -> /api/graphql -> Edge / Dev Gateway -> Phoenix /graphql
Community / Dash / Apply SSR、Auth、Press、Import -> Phoenix /graphql
Absinthe -> schema / middleware -> resolver -> CMS / Accounts -> Repo / Dataloader
```

GraphiQL 6.0.1 的资源由 `backend/api/graphiql` 的独立 npm 锁文件构建，API Dockerfile 在构建镜像时打包，不依赖运行时 CDN。`GET /graphiql` 返回 IDE；GraphQL 查询和 mutation 只在 `/graphql` 执行，旧的 `/graphiql` API 兼容路径不保留。开发构建步骤见 `backend/api/README.md`。GraphiQL 以同源 POST 和 `x-groupher-csrf: 1` 调用 API，浏览器 cookie 仍经 Phoenix 的 Origin 和 CSRF 校验；也可以在 GraphiQL 中提供 Bearer token，但同时存在登录 cookie 时后端优先使用 cookie。

## 全链路审计和调整

| 位置             | 证据与结论                                                                                                                               | 处理                                                                                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 包版本           | Absinthe 1.12.0、Absinthe Plug 1.5.10、Dataloader 2.0.2 为检查时最新 Hex 正式版                                                          | 无可用升级；GraphiQL 6.0.1 独立打包。Monaco 的 DOMPurify 用 override 锁至 3.4.17，npm audit 为 0                                                                       |
| 路由与传输       | 旧路径曾将 Playground 与 API 共用，所有消费者需要迁移                                                                                    | 统一 `/graphql`，独立 `/graphiql`；网关、SSR、服务默认配置、mock、测试和当前运维文档同步                                                                               |
| CORS / CSRF      | 旧 CORS 正则会匹配 `evilgroupher.com`；cookie mutation 在执行前检查 Origin、JSON 与 CSRF header；原检查遗漏批量请求、URL 参数和原始 body | 收紧域名匹配；覆盖合并参数及批量 operations；含 cookie 的非 GET 请求必须使用 JSON；允许 API 自身的 GraphiQL Origin，并测试各输入形式及真实签发 cookie 的 mutation      |
| 访客上下文       | Phoenix 的 ViewTracker 以 `groupher-viewer` 识别匿名访客；原 Edge 和 Dev Gateway 丢弃该 cookie，而 Core 代理保留它                       | 两个网关仅白名单转发认证和访客 cookie，继续去除其他 cookie 和浏览器 Authorization；覆盖仅访客与两种 cookie 场景                                                        |
| 请求资源         | Absinthe 原来没有文档 token/complexity 上限，且 CSRF 中先执行了一次解析                                                                  | CSRF 预解析和 Absinthe 均使用 20,000 token；Absinthe 使用 500 的默认字段复杂度上限，传输批量上限 10；分页成本另设 500,000 的估算预算，均在执行 resolver 前拒绝超限请求 |
| 查询成本         | 对 239 个生成操作（展开引用 fragment）静态统计：最大 309 token；字段数最多 TicketKanban 为 439，CommentPage 为 339                       | `pnpm report:graphql-complexity` 可复现。该统计和 Absinthe 默认复杂度均不计列表倍率、SQL、时间或变量内容；500 不是生产负载校准结果                                     |
| 分页             | `Helper.ORM.Pagi.Config` 的服务端 hard max 为 100；调用方经参数验证执行                                                                  | 保留既有上限；其他非 Pagi 的列表不能据此假设有同样限制                                                                                                                 |
| 数据加载         | Comment page 主路径批量预加载 body；未预加载的 Comment 回退对 body 与 bodyVersion 分别查询                                               | 改为共享 Dataloader 批次；数据库测试覆盖未加载的 Comment 与 map projection，并验证 3 条评论、两字段只执行 1 次正文查询                                                 |
| 错误和认证       | Context 区分浏览器/服务/委托身份；业务授权由 middleware 与 domain/Gate 负责；`ErrorResponse` 对已声明错误转换 extensions                 | 保留已有边界；相关 cookie、服务认证、非法请求与 GraphQL 错误回归通过，不以 IDE 作为授权手段                                                                            |
| 客户端超时和缓存 | Community、Dash SSR 使用 10 秒上限及 no-store；Apply 缺少上游超时                                                                        | Apply 补 10 秒中止和测试；API 本身及 IDE HTML 为 no-store                                                                                                              |
| 日志             | Absinthe 默认可记录 GraphQL 原文和变量；生产 Logger 先前未设置 info 级别                                                                 | 生产关闭 Absinthe 原文日志并将日志级别设为 info；非结构化错误日志不再记录错误值，避免 debug 请求参数或错误详情进入日志                                                 |

静态 N+1 inventory 报告 6 个候选，并提示仓库中的既有 inventory 文件与当前生成结果不一致；候选不等于已经确认的 N+1。Press `hydrate_articles` 和 Mention `load_selected_articles` 已按批处理。其余四处的本地测量与处理见下表；本地计数来自测试数据库的特定测试数据，并不代表生产流量。该报告没有被改写成已完成的严格门禁。

| 路径                | 测量和处理                                                                                                                                                                                | 剩余范围                                                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Review Bot 默认配置 | 已有配置时 SELECT 从 2 次降到 1 次，返回顺序和缺失配置创建行为有测试                                                                                                                      | 无数据规模相关循环；保留各配置独立插入                                                                                  |
| 审核可见性          | 3 个绑定时涉及社区表的 SELECT 从 9 次降到 7 次；关联读取绑定与社区并保持事务和缺失社区错误                                                                                                | 事件仍逐绑定写入，不能把它视为完整的常数次 SQL                                                                          |
| 搜索重建            | 3 篇同社区公开文章从 71 次 SQL 降到 67 次；每批文章的公开绑定和搜索计数分别改为批量查询                                                                                                   | 完整 FrontDesk Article 投影仍逐文章/绑定读取，主要 N+1 尚未消除；需要在保持 Gate、正文版本和 DTO 语义前提下进一步批量化 |
| 评论通知            | 一个绑定的通知链路保持 29 次 SQL；三个绑定中前两个因审核不可见、回退到第三个的链路从 43 次降到 30 次。多个候选先通过同一公开 `:read` Gate scope 批量筛选，再按原有顺序执行 FrontDesk 读取 | 最终可读 Article 仍加载完整投影；筛选和最终读取之间仍可能发生并发状态变化                                               |

分页成本以 Absinthe 验证后的字段树计算：对声明 `pagi` 的字段，将子字段乘以请求的页大小，未提供有效大小时按 100 估算，嵌套分页相乘。fragment 引用也计入成本，重复 fragment 使用缓存并在超预算后截断，以免成本计算自身发生指数级展开；跳过的字段不计入成本。预算 500,000 是为了让现有查询在最保守默认值下通过而选出的初始值，并非 SQL 成本。它只识别 `pagi` 参数，不覆盖其他无界列表、变量大小或 SQL；单批最多 10 个操作，每个操作分别限额，尚无批次总成本限制。应继续结合 `[:absinthe, :execute, :operation, :stop]`、分页 telemetry 和 Ecto Repo query telemetry 测量真实成本；避免记录变量、cookie 或正文。

Edge Router 对 `/api/graphql` 按 Cloudflare 提供的客户端 IP 使用 300 次/60 秒的 Rate Limit binding，超限返回 429；这是待按流量校准的初始值。Cloudflare 限流按地域近似计数，不是跨地域严格全局限流。该防护只覆盖经过 Edge Router 的入口，不能保护直接访问 `api.groupher.com/graphql` 的请求；发布前仍需在该域名的 Cloudflare/WAF 或其他可信入口覆盖，并确认源站不可绕过。生产和预览使用独立 namespace，发布前应确认 namespace 在账号中没有与其他 Worker 意外共享。

## 部署和限制

本地验证：隔离测试数据库的完整后端套件 2669 项通过、1 项按现有配置排除（`mix test --timeout 180000`）；GraphQL 安全、认证和正文批量加载专项测试 46 项通过。GraphiQL 资源构建及浏览器 schema 加载和真实查询通过；路由契约、网关、相关前端和服务专项测试通过。此前一次全量运行中资产测试超过默认 60 秒，本次完整重跑通过。

分页成本、边缘限流和四处查询优化后的最终验证：隔离数据库完整后端套件 2679 项通过、1 项按现有配置排除；相关专项测试 57 项通过；Edge Router 类型检查、17 项测试及构建通过。中间一轮全量中 Mention 测试按秒级时间戳选择事件产生歧义，测试改为显式选择新事件后，相关文件重复运行及最终全量均通过。

回归检查从生成查询和仓库运行时代码中的静态操作收集查询，并包含 GraphiQL 6 使用其锁定版 `graphql` 生成的 introspection；条件指令分别测试布尔组合。当前 514 个检查项包含重复来源及指令变体，不是 514 个不同操作；普通字段复杂度最高为 TicketKanban 的 433，GraphiQL schema 查询为 220，分页成本预算也全部通过。检查通过 Absinthe 实际 schema 分析，不执行业务 resolver，已接入 GraphQL contract CI。实际 GraphiQL schema 查询还通过 `/graphql` 端点执行测试；复杂度 500 和 501 分别覆盖接受和拒绝，嵌套分页和重复 fragment 覆盖成本拒绝。检查不覆盖仓库外调用方和运行时拼装的未知查询。

本地重跑该检查需要根目录 pnpm 依赖和 `backend/api/graphiql` 的 npm 依赖，然后执行：

```bash
set -o pipefail
node scripts/graphql-complexity-fixtures.mjs | (cd backend/api && mix run --no-start test/graphql_complexity/check.exs)
```

正式部署前须同时更新 Cloudflare Worker bindings 和其他运行时的 `GRAPHQL_ENDPOINT` / `PHOENIX_GRAPHQL_ENDPOINT`，以及仓库外独立调用方；在同一切换窗口发布 API、网关和调用方，验证真实公共域名。旧 `/graphiql` 不再执行 API 请求。

本地 Docker 不可用，镜像没有在此机器构建；已在与 Docker Node 阶段相同的独立目录执行 npm ci 和 Vite build，CI 增加资源构建检查，真正镜像和线上部署仍需在发布环境验证。隔离数据库的 Lite Home 示例数据在壁纸服务步骤失败，`home` 社区已足以验证 IDE 查询，但不是完整生产数据集。线上 Cloudflare 限流、请求体大小和流量分布未经本地验证；不要把默认字段复杂度当作精确的数据库成本或完整的速率限制。
