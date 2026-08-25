# Docs Import 运行时迁移

> 状态：迁移设计，尚未切流
>
> 范围：`backend/document-converter`、`backend/content-import`、Dashboard
> proxy、PreviewStore 与长任务编排。

## 结论

`document-converter` 和 `content-import` 不是同一种迁移对象：

- `document-converter` 是无状态的 FastAPI 单文件转换服务，当前的临时文件模型
  与 Docker/Fly 很匹配，可以先迁移。
- `content-import` 是 Node/Hono 导入执行服务，当前默认使用 Vercel World 和
  Vercel Blob，但这两个依赖都有可迁移路径：Workflow SDK 可以接自托管 Postgres
  World，`files-sdk` 也已经提供 R2 adapter。它不能只改部署入口，但不需要重写整个
  导入器。
- Dashboard 是用户界面和稳定 proxy，不是导入执行器。Dashboard 下线或迁移时，
  必须保留一个调用 `content-import` 的产品入口；不能把 Dashboard proxy 当成可
  直接删除的 Vercel 配置。

结论矩阵如下：

| 目标                                                  | 可行性 | 结论                                                                                                                                                                      |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `content-import` → Fly                                | 高     | 推荐路径。保留 Node/Hono、Node 文件系统、归档分析和现有 workflow 代码；改用 Postgres World + R2 adapter，并补长驻 worker 启动。                                           |
| `content-import` → Cloudflare Worker + Workflows + R2 | 中     | 可行，但要把 HTTP/Workflow 代码改成 Worker runtime，并把 Node 文件系统、`zlib`、`tar-stream` 和临时 workspace 改成 Worker/Container 可用的实现。                          |
| `content-import` → Cloudflare Container               | 中高   | 可以保留 Node 计算和临时 workspace，但仍需 Worker 路由层；不建议在 Container 内继续依赖需要长驻轮询的 Postgres World，编排应改用 Cloudflare Workflows 或独立 Fly worker。 |

推荐顺序是：`document-converter` 先迁 Fly，随后 `content-import` 整体迁 Fly；
如果目标是计算和编排全部进入 CF，再做第二阶段的 Worker + Workflows + R2 拆分。

## 当前拓扑

```text
Browser
  -> Dashboard API route / proxy
  -> content-import (Node/Hono)
       |-> source adapters / analyzer / apply planner
       |-> Vercel Workflow: analysis and apply orchestration
       |-> Vercel Blob via files-sdk: immutable preview artifacts
       |-> document-converter (FastAPI)
       `-> Phoenix internal apply boundary
             `-> PostgreSQL / final domain state
```

约束仍然成立：`content-import` 不直接写 Phoenix 数据库；Phoenix 负责用户、社区、
权限、ImportJob、幂等和最终落库。导入的业务 contract、Dataset、PreviewStore 和
Apply 边界分别见：

- [`docs/sub-apps/content_import.md`](../sub-apps/content_import.md)
- [`docs/bulk-import/content_import_architecture.md`](../bulk-import/content_import_architecture.md)
- [`docs/bulk-import/import_file_sdk.md`](../bulk-import/import_file_sdk.md)

## 子项目盘点

| 子项目                       | 当前职责                                             | 当前平台耦合                                                       | 迁移判断                                                                                          |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| `backend/document-converter` | 单文件转换为 Markdown，返回 diagnostics              | FastAPI、MarkItDown、临时文件                                      | 先迁 Fly；Cloudflare Containers 可行，但不是标准 Worker 的直接部署                                |
| `backend/content-import`     | 来源读取、分析、Dataset、Preview、Apply 编排         | `workflow` 默认 Vercel World、`files-sdk/vercel-blob`、Node 运行时 | 可迁 Fly；需要接 Postgres World + R2。迁 CF Worker 则还要处理 Node runtime 和 workspace           |
| Dashboard proxy              | 用户鉴权后的稳定 API 转发                            | `CONTENT_IMPORT_APP_ENDPOINT`、Phoenix token/delegation header     | 保留 API 边界；UI 可随 Dashboard 一起迁移或由新的产品入口接管                                     |
| PreviewStore                 | 保存不可变 preview、diagnostics 和 workflow run 引用 | 当前 Vercel Blob，生产禁止依赖本地磁盘                             | 迁 R2 或 S3-compatible 存储；不能改成生产本地临时目录                                             |
| 长任务编排                   | 分析、Apply、取消、重试和 run 状态                   | `workflow/api` 的 `start`、`getRun`、`cancel`                      | Fly 可用 Workflow SDK 的 Postgres World；CF 可改 Cloudflare Workflows；不能在 HTTP 请求内同步执行 |

## `document-converter`：推荐先迁 Fly

### 为什么适合 Fly

服务的输入输出是单文件到 Markdown，服务本身不持有用户、社区或导入状态。当前
实现已经具备以下适合容器部署的特征：

- Python 3.12 + FastAPI，启动入口和健康检查明确。
- MarkItDown 使用 stream API，不把上传内容当作本地路径或 URI。
- 大文件会从内存 spool 到临时磁盘，转换结束后释放。
- 不需要持久化卷，临时目录只属于一次请求。
- 调用方可以携带短期 delegation token，转换服务不需要回访 Phoenix。

建议部署为独立 Fly app，使用 `backend/document-converter` 作为 Docker build
context，保留 `GET /health` 和 `POST /convert` contract。切流时只替换
`DOCUMENT_CONVERTER_APP_ENDPOINT`，不改变 `content-import` 的 Dataset 或 Apply
协议。

### Cloudflare 的备选

Cloudflare Containers 现在可以由 Worker 管理并运行 Docker image，Wrangler 也提供
构建和推送镜像的流程；但这会增加 Worker 到 Container/Container class 的边界。
因此它是可行的第二选择，不是本次单文件服务迁移的最低风险路径。参考
[Cloudflare Containers getting started](https://developers.cloudflare.com/containers/get-started/)
和 [Container class](https://developers.cloudflare.com/containers/container-class/)。

标准 Cloudflare Worker 不应直接承载这套 Python/MarkItDown/临时文件运行时，除非
先完成一次独立的 Python Worker 兼容性验证，并证明 Office/PDF 依赖、上传大小、
CPU 时间和内存都满足生产需要。

## `content-import`：两个依赖都有迁移路径

### 1. Workflow：Fly 可以自托管，CF 需要适配

`backend/content-import/src/lib/content-import/http.ts` 当前通过
`workflow/api` 的 `start`、`getRun` 和 `cancel` 管理分析任务，并把 run 引用写入
不可变 preview artifact。迁移时必须保留这些业务语义：

- 请求返回稳定的 preview/job/run identity。
- 分析和 Apply 不占用 HTTP 请求直到完成。
- 失败可以得到结构化 diagnostics，而不是只得到进程异常。
- 用户取消后，后续 Apply 不得继续使用已取消的 run。
- 重试不能制造互相竞争的业务 attempt。

#### Fly 路径：保留 Workflow SDK，改用 Postgres World

Workflow SDK 本身提供自托管 World：使用 PostgreSQL 保存 run、step、hook 和事件，
使用 Graphile Worker 执行队列。它适合 Docker/Fly 这类有长驻进程的环境，但当前
`backend/content-import/package.json` 只有 `workflow`，没有
`@workflow/world-postgres`，`src/server.ts` 也没有启动 World worker。因此 Fly
迁移至少需要：

- 增加与当前 Workflow SDK 兼容的 `@workflow/world-postgres` 依赖和数据库 bootstrap；
- 配置 `WORKFLOW_TARGET_WORLD`、`WORKFLOW_POSTGRES_URL` 等运行时变量；
- 在 Node server 启动和关闭时启动/停止 World worker；
- 保留现有 `workflowRunRef`，让 `getRun().cancel()`、状态投影和重试语义不变；
- 为 Workflow tables 使用独立 schema 或 job prefix，避免和 Phoenix migration 混淆。

这条路径的核心业务代码，包括 `analyzeGitHubRepo`、`applyDocsDataset`、SourceTree、
Dataset 和 Phoenix apply boundary，原则上可以继续保留。

#### Cloudflare 路径：换成 Cloudflare Workflows

| 方案                        | 适合度         | 说明                                                                                                                                                            |
| --------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare Workflows        | 适合全 CF 目标 | 官方提供持久化 step、重试、事件等待和 instance API；需要把当前 `workflow/api` 调用和 `'use workflow'` / `'use step'` 实现改成 Cloudflare Workflow class/binding |
| Workflow SDK Postgres World | 适合 Fly       | 保留现有 workflow 代码，新增自托管 World 和长驻 worker；这是 Fly 的最低改动路径                                                                                 |
| HTTP 请求内同步执行         | 不接受         | GitHub 下载、归档解压、框架分析和批量 Apply 的时长与资源都不可控                                                                                                |

Cloudflare Workflows 能表达当前“分析 → 目标校验 → Preview ready”和“选中条目
→ 批量 staging → Phoenix apply”的步骤模型，也支持外部事件、重试和 instance
状态。需要额外设计的是现有 `workflowRunRef` 到 Cloudflare instance ID 的映射，
以及 `getRun().cancel()` 对应的 terminate/status API。参见
[Cloudflare Workflows](https://developers.cloudflare.com/workflows/) 和
[Workflows Workers API](https://developers.cloudflare.com/workflows/build/workers-api/)。

### 2. `files-sdk/vercel-blob` 不是普通文件系统

当前 PreviewStore 通过 `files-sdk` 的 Vercel Blob adapter 保存
`content-import/previews` 下的对象，要求 private access、不可覆盖，并可使用
`VERCEL_OIDC_TOKEN`、`BLOB_STORE_ID` 或 `BLOB_READ_WRITE_TOKEN`。本地 adapter
只能用于开发，生产不能依赖本地磁盘。

当前安装的 `files-sdk 2.2.3` 已有 `files-sdk/r2` adapter，因此这里不是重新发明
PreviewStore，而是将 `store.ts` 的 `vercelBlob(...)` 分支替换为 R2 配置。Fly
可以通过 R2 的 S3-compatible HTTP endpoint 访问；Worker 则可以直接使用 R2 binding。
Cloudflare 官方 R2 API 支持对象的读、写、列表、metadata 和条件写入，适合承接当前
PreviewStore 的不可覆盖语义。参见
[R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)。

迁移时仍需保持 PreviewStore 的上层接口不变：

- object key、owner、community、source revision 和 TTL 的语义不变；
- immutable preview 仍然禁止覆盖，重复写入使用明确的冲突结果；
- 内容、metadata、diagnostics 和 workflow run 引用仍可按 preview identity 读取；
- 清理由 TTL/生命周期策略完成，不由进程退出触发；
- 不把 Phoenix 最终内容或数据库 staging 搬进对象存储。

### Cloudflare Worker 的实际阻塞点

当前服务不是只换 `@hono/node-server` 就能变成 Worker：

- `src/lib/content-import/http.ts` 使用 `node:crypto`；多个 analyzer 使用
  `node:path`、`node:fs/promises` 和 `node:os`。
- GitHub workspace 使用临时目录；archive extractor 使用 Node stream、zlib 和
  `tar-stream`，依赖本地文件/归档处理能力。
- `src/server.ts` 是 Node 进程入口，当前生产 build 也是
  `esbuild --platform=node`；Worker 入口、bindings 和启动模型都不存在。

因此纯 Worker 目标至少要二选一：

1. 把 workspace、归档下载/解压和 analyzer 改成 web streams + R2 artifact，保证
   所有依赖能在 Worker runtime 运行；或
2. Worker 只负责 API 和 Workflow，实际 workspace/analyzer 调用一个 Container 或
   Fly compute service。

第二种更接近现有代码，也更适合先验证业务 contract；第一种才是真正的纯 Worker，
但迁移面明显更大。

## 推荐目标拓扑

### 目标 A：Fly 全部承载，推荐

```text
Dashboard / replacement UI
  -> content-import HTTP API on Fly
       |-> Workflow SDK + Postgres World worker
       |-> R2 via files-sdk/r2
       `-> document-converter on Fly
  -> Phoenix API / internal apply boundary
```

这个目标保留 Node/Hono、Node 文件系统、归档解压和现有 source/analyzer/apply 代码，
只替换 Workflow World 和对象存储 adapter。它是移除 Vercel project、降低迁移风险的
最短路径。

### 目标 B：全 Cloudflare

```text
Dashboard / replacement UI
  -> Worker/Hono API
       |-> Cloudflare Workflows
       |-> R2 PreviewStore
       |-> Worker-compatible API / adapter code
       |-> Container-backed workspace analyzer when needed
       `-> Container-backed document-converter when needed
  -> Phoenix API / internal apply boundary
```

这个目标可以统一 CF CI 和运行时，但迁移面更大：Node API、文件/归档处理、长任务
编排、存储 adapter 和转换器容器边界都要分别验证。Cloudflare Containers 可以由
Worker 路由到 Docker image，但容器磁盘默认是临时的，持久化 artifact 仍必须放在
R2；官方文档也明确 Container 由 Worker/Container class 管理。参见
[Containers getting started](https://developers.cloudflare.com/containers/get-started/)
和 [Container class](https://developers.cloudflare.com/containers/container-class/)。
不要把“新增一个 Worker workflow”当成整个 Docs Import 迁移完成。

## 分阶段计划

### Phase 0：冻结协议和观测点

- 固定 Dashboard proxy 的稳定路由、HTTP method、body、错误 envelope 和鉴权 header。
- 固定 `CONTENT_IMPORT_APP_ENDPOINT`、`DOCUMENT_CONVERTER_APP_ENDPOINT` 的环境变量
  语义。
- 记录 PreviewStore key、preview identity、workflow run identity 和 Phoenix
  ImportJob 的对应关系。
- 为 analyze、preview、cancel、apply、reset 增加跨服务 correlation id。

验收：不更换平台时，现有 Dashboard、content-import、document-converter 和
Phoenix contract 测试保持通过。

### Phase 1：迁移 `document-converter`

- 增加 Dockerfile、Fly app 配置和 `/health` smoke check。
- 在 Fly 上验证 PDF、DOCX、PPTX、XLSX、HTML、超限文件和坏 archive。
- 验证临时文件释放、请求超时、并发上限和 delegation token。
- 将 `DOCUMENT_CONVERTER_APP_ENDPOINT` 指向新地址，再跑 content-import 文件导入
  集成测试。

验收：转换结果、source metadata、diagnostics 和错误码与当前 contract 一致。

### Phase 2：替换 PreviewStore

- 将 `files-sdk/vercel-blob` 分支改为 `files-sdk/r2`，先用同一组 contract tests
  对比 local 和现有 Vercel Blob adapter。
- 明确 private read、写入冲突、TTL、metadata、删除和失败重试语义。
- 新旧存储并行读/写一段时间，确认 preview artifact 可完整回放后再停 Vercel Blob。

验收：一个 preview 的 artifact、diagnostics、source revision 和 run 引用可以在
新存储中完整创建、读取、取消后保留、过期后清理。

### Phase 3：替换长任务编排

- Fly 路径：接入 Workflow SDK Postgres World，启动长驻 worker，并以现有
  `start/getRun/cancel` 语义做回归。
- CF 路径：将 `start/getRun/cancel` 映射到 Cloudflare Workflow instance create、
  status、terminate API，并把 `'use workflow'` / `'use step'` 函数改成 Workflow
  class steps。
- 把分析、Apply、reset、retry 的状态迁移为显式状态机；不要让进程内状态成为
  唯一事实来源。
- 验证重复提交、worker 重启、超时、取消、重试和 Phoenix 侧幂等。

验收：所有 run 都有可查询状态；取消和重试在 worker 重启后仍然成立；同一个业务
attempt 不会产生重复 Apply。

### Phase 4：迁移 `content-import` HTTP/worker

- 先迁 API 和 health，再迁 analyzer/adapter worker，最后切 Apply。
- 保持 `content-import` 不直写 Phoenix DB 的约束。
- 继续由 Phoenix 在 Apply 前重新校验用户、community、权限、mapping 和 target
  revision。
- 对 GitHub 大仓库、归档解压、外部 API 限流和 converter 调用做资源预算。

验收：Dashboard 通过同一稳定 proxy 完成 analyze、preview、cancel、apply、reset；
Phoenix 数据一致性和审计结果不变。

### Phase 5：处理 Dashboard 产品入口

Dashboard 如果只是“不再作为线上独立项目”，不能直接删掉 Docs Import route。需要
在以下两种选择中明确一个：

1. 保留 Dashboard UI，改为调用新的 content-import endpoint；或
2. 把 Docs Import UI/route 迁到新的 Dash/Community 产品入口，并保留相同 API
   contract。

验收：用户仍能创建 Preview、查看 BadSmell、选择范围、确认覆盖并观察 ImportJob
结果；旧 Dashboard endpoint 下线前已有流量迁移和回滚开关。

## 不能作为迁移完成条件的做法

- 只删除 `vercel.json` 或 Vercel project，而不迁移 `workflow` 和 PreviewStore。
- 只把 `content-import` 的 HTTP 端口放到 Fly，却继续依赖不可达或未治理的 Vercel
  Workflow run。
- 把 PreviewStore 改为容器本地目录。
- 把长任务挪进 Dashboard route 或一个同步 Worker 请求。
- 让 content-import 为了方便直接连接 Phoenix PostgreSQL。
- 只迁 document-converter，就宣称 Docs Import 已经脱离 Vercel。

## 开放问题

- 目标优先级是“先移除 Vercel 托管项目”，还是“所有 Workflow/Blob 依赖也必须
  同时移除”？两者会得到不同的 Phase 2/3 顺序。
- Docs Import UI 最终归属 Dashboard、Dash 还是 Community？这决定 proxy 是否继续
  保留以及域名切换方式。
- Cloudflare Workflows 是否能完整承接当前 run 的取消、重试、状态查询和长步骤；
  如果不能，Fly queue/worker 是更稳妥的中间目标。
- R2 的对象 metadata、条件写入、生命周期和私有读取是否足够表达当前
  `FilesPreviewStore` 的不可变语义。
- GitHub 大仓库和 Office/PDF 转换的内存、临时磁盘、CPU、超时预算需要用生产级
  fixture 测量，不能仅凭本地成功判断。

## 相关入口

- [`docs/sub-apps/document_converter.md`](../sub-apps/document_converter.md)
- [`docs/sub-apps/content_import.md`](../sub-apps/content_import.md)
- [`backend/document-converter/README.md`](../../backend/document-converter/README.md)
- [`backend/content-import/README.md`](../../backend/content-import/README.md)
- [`docs/deploy/cf_arch.md`](../deploy/cf_arch.md)
