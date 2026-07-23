# 文档导入：Files SDK 接入与 Node/Phoenix 存储边界重构

> 状态：本地实施完成；生产 Vercel Private Blob、固定公开仓库 Browser E2E 与运维配置仍待部署验收
>
> 范围：公开 GitHub 仓库的 Docs Bulk Import。公共资源上传、ZIP 浏览器直传、图片/附件复制不在本文范围。
>
> Source of truth：本文只负责 PreviewStore、Files SDK、PostgreSQL staging 和对象生命周期。跨来源架构、公共术语和 Node/Phoenix 总边界以 [`content-import-architecture.md`](./content-import-architecture.md) 为准。
>
> 关联文档：产品流程与交互以 [`bulk-import.md`](./bulk-import.md) 为准；实施与旧链路直接删除见 [`content-import-refactor-plan.md`](./content-import-refactor-plan.md)；共享 Import Content/BodyBag 见 [`article-publish-import-refactor.md`](./article-publish-import-refactor.md)；Preview 清理与错误恢复见 [`import-error-handling.md`](./import-error-handling.md)。

## 1. 结论

文档导入引入 Files SDK 是合理的，但它只作为 **Next.js Node 侧的对象存储基础设施**：

- `analyzeSource` Step 内的下载、解压和 framework 解析继续使用原生临时目录。
- 分析完成后，把需要跨请求、跨 Workflow Step、跨实例保留的 `DocsDataset` manifest、Markdown、SourceAnalysis、SourceTree 和 BadSmell 写入 Files SDK。
- 生产初期使用 Vercel Private Blob adapter，未来可以在不修改导入业务接口的情况下切换到 S3/R2。
- 当前 GitHub URL 导入不需要 `signedUploadUrl()`；Node 端使用 `upload/download/list/delete` 即可。
- Phoenix 不再保存 Snapshot、Preparation、Plan 或 BodyBag 文件，也不再维护 `PayloadStore`。
- Node 复用现有 Import Content 生成 BodyBag，再按有界批次发送给 Phoenix；Phoenix 使用 PostgreSQL staging table 暂存每篇 BodyBag，全部有效选中项 ready 后执行一次原子 apply。
- 成功、取消或 TTL 到期后，删除当前 `previewRef` 对应的全部对象；失败数据只保留一个短诊断 TTL，不提供复杂断点恢复，用户通过 reset/re-import 重新开始。

目标边界：

```text
Files SDK / Blob / S3
  = Node ThreadDataset / Preview 的临时、共享、可恢复工作集

PostgreSQL
  = Job 控制状态 + BodyBag staging + 最终 Docs 数据

临时目录
  = analyzeSource Step 内部的 POSIX 工作区
```

## 2. 为什么引入 Files SDK

切换前已经有领域级 `PreviewStore`，但分别手写了 Local 和 Vercel Blob 实现；当前已用 Files SDK 把 provider 差异收敛在同一个基础设施入口后面：

```text
PreviewStore（Groupher 领域接口）
        |
        v
FilesPreviewStore
        |
        v
Files SDK
  |-- fs adapter             # local / test
  |-- vercel-blob adapter    # 初期生产
  `-- s3 / r2 adapter        # 后续可选
```

引入它的直接收益：

1. Node 调用方统一使用 `upload/download/list/delete`，不再分别理解 `node:fs`、`@vercel/blob` 和 AWS SDK。
2. PreviewStore 的业务 contract 不变，provider 选择留在 composition root 和环境配置中。
3. 可以统一设置 storage timeout、retry、cancel、logging 和 metrics hooks。
4. `ReadableStream`、批量操作和 prefix listing 可以复用于较大的导入工作集。
5. 若 Vercel Blob 后续不满足成本、容量或部署需求，可替换 adapter，不重写 Analyze/Review/Import 流程。

`PreviewStore` 是 Groupher 的领域接口，Files SDK 是其底层实现。业务代码不直接拼 provider key：

```text
previewStore.putDataset(...)
  -> files.upload(datasetBodyKey, markdown)

previewStore.putManifest(...)
  -> files.upload(datasetManifestKey, json)

previewStore.markReady(...)
  -> files.upload(readyKey, json)

previewStore.getSource(...)
  -> files.download(sourceKey)

previewStore.delete(previewRef)
  -> files.list({ prefix }) + files.delete(keys)
```

因此 `putDataset()`/`putManifest()` 确实使用 Files SDK，但 Analyze/Publisher 只依赖 `PreviewStore`，不直接依赖 Vercel Blob、S3/R2 或 Files SDK 的 key 规则。

Files SDK 不负责：

- GitHub 下载和限流策略。
- archive 安全解压。
- framework detection 和 SourceTree 生成。
- Preview owner、community 权限和 idempotency。
- Workflow 重试、批次断点和状态机。
- Preview TTL 调度和业务清理时机。
- Phoenix Job、数据库事务和最终 apply。

### 2.1 Vercel Blob 能力边界

Files SDK 的 Vercel Blob adapter 支持 Node 端：

```text
upload / download / head / exists / list / delete / copy
```

不支持的是 `signedUploadUrl()`，即“浏览器取得 presigned PUT/POST 后绕过 Node 直传”的接口。当前 GitHub URL 导入由 Node 主动下载源码，不存在浏览器上传，所以这个限制与本文链路无关。

Private Blob 也不提供可直接暴露给浏览器的永久/签名读取 URL。本文本来就要求所有 Preview 读取经过 Next.js API 的 owner/community 校验，因此使用服务端 `download()` 正好符合安全边界。

Vercel Blob 不支持任意 user metadata。Preview 所需的 owner、community、expiresAt、schemaVersion 等信息必须保存在受校验的 `PreviewRecord`/artifact JSON 中，不能依赖 provider metadata。

### 2.2 Repo 命名

目标流程的英文代码、contract、JSON 字段和文件名统一使用 `Repo` 缩写；中文产品文案继续使用“仓库”。迁移时一次性切换，不保留两套 accessor：

| 旧命名                                    | 目标命名            |
| ----------------------------------------- | ------------------- |
| `repository`                              | `repo`              |
| `repositoryUrl`                           | `repoUrl`           |
| `TGitHubRepository`                       | `TGitHubRepo`       |
| `resolveGitHubRepository`                 | `resolveGitHubRepo` |
| `analyzeGithubRepository`                 | `analyzeGithubRepo` |
| `analyzeRepositoryStep`                   | `analyzeRepoStep`   |
| `repositoryUrl` request/source-info field | `repoUrl`           |
| `repository` source-info field            | `repo`              |

外部平台或 SDK 的正式专有名词不改写；这里约束的是 Groupher 自己维护的导入流程命名。

## 3. 现状与目标

### 3.1 当前实现

```text
Browser
  |
  | POST /api/docs/import/previews
  v
Dashboard Next.js Node + Workflow
  |
  |-- mkdtemp / extract / analyze
  |
  `-- PreviewStore
      `-- FilesPreviewStore
          |-- files-sdk/fs (local / test)
          `-- files-sdk/vercel-blob (production)
              |
              | immutable PreviewRecord + DocsDataset + Review artifact
              v
        Vercel Private Blob

用户确认
  |
  v
Node Publisher
  | Markdown -> BodyBag，最多 4 篇 / 6 MiB request
  v
Phoenix ContentImport
  |-- ImportJob / JobItem
  |-- content_import_job_bodies (PostgreSQL staging)
  `-- atomic Docs Writer -> Preview/Draft + ImportSourceMapping
```

当前 file-based Docs import 已不再维护 Node/Phoenix 双 payload store：确认前工作集只在 Files SDK PreviewStore，确认后的 BodyBag 只在 PostgreSQL staging，成功 apply 后随事务清理。

当前恢复与清理能力快照：

| 能力                                    | 当前状态             | 说明                                                                                   |
| --------------------------------------- | -------------------- | -------------------------------------------------------------------------------------- |
| 分析结束删除临时目录                    | 已实现               | `withTemporaryWorkspace` 在 `finally` 中递归删除                                       |
| 分析完成后从 PreviewStore 读取 Markdown | 已实现               | publish 不需要重新下载 GitHub                                                          |
| `?preview=` 刷新恢复 Analyze/Review     | 已实现               | Browser 通过 PreviewRecord 关联 WorkflowRun                                            |
| `?job=` 刷新恢复 Import                 | 已实现               | Browser 轮询 Phoenix Job                                                               |
| Preview 创建幂等                        | 已实现               | 相同 owner/community/repo/idempotency key 复用 Preview                                 |
| GitHub 请求有限重试                     | 已实现               | 只覆盖 GitHub metadata/archive request                                                 |
| 导入成功删除 Preview prefix             | 已实现               | publish 完成后删除整个 Preview prefix                                                  |
| 用户取消/Reset 删除 Preview prefix      | 已实现               | 同时尝试取消关联 Workflow run                                                          |
| 访问过期 Preview 时清理                 | 已实现               | lazy expiry cleanup                                                                    |
| 定时主动清理所有过期 Preview            | 已有内部 sweep route | 仍需在部署环境配置定时调用和观测告警                                                   |
| BodyBag batch 重放                      | 已实现               | PostgreSQL 以相同 body hash 幂等吸收重复 batch；completed Job 可安全重放               |
| 普通转换失败恢复                        | 明确失败             | 不伪装成 skipped；Workflow bounded retry 后将 Job 标记 failed，由用户重新导入          |
| Files SDK provider abstraction          | 已实现               | 业务层只依赖 `PreviewStore`，local/test 与 production adapter 位于 composition root    |
| Preview 不可变布局                      | 已实现               | 固定 `attemptRef`，`analysis-run.json` write-once，attempt-local `ready.json` 最后写入 |
| PostgreSQL BodyBag staging              | 已实现               | 每批最多 4 篇，Phoenix canonical JSON 单篇最多 5 MiB 并记录权威 bytes                  |

尚未完成的是部署环境验收，而不是存储边界代码：生产 Private Blob 凭据/私有读取、固定公开仓库 Browser E2E、全局分析 admission、主动 sweeper 调度和完整观测指标仍需在真实运行环境验证。

### 3.2 实施后的目标边界

```text
┌──────────────────────────────── Next.js Node ────────────────────────────────┐
│                                                                              │
│  GitHub Gateway -> GitHub Repo Source -> Native Temp Workspace               │
│                                             │                                │
│                                             v                                │
│                                   Docs Analyzer -> DocsDataset               │
│                                             │                                │
│                              PreviewStore -> Files SDK -> Private Blob       │
│                                             │                                │
│                                             v                                │
│                    shared Import Content -> BodyBag[] -> Phoenix Client       │
│                                                                              │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │ bounded BodyBag batches
                                               v
┌──────────────────────────────── Phoenix / Elixir ────────────────────────────┐
│                                                                              │
│  authorize -> ImportJob -> PostgreSQL staging -> Docs Validator              │
│                                                      │                       │
│                                                      v                       │
│                                        atomic Docs Writer transaction         │
│                                             │                  │             │
│                                             v                  v             │
│                                    Docs Preview/Draft   ImportSourceMapping   │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

本文只展开存储部分；完整 Platform/Source/ThreadDataset/Thread 分层见
[`content-import-architecture.md`](./content-import-architecture.md)。

## 4. Analyze 阶段

### 4.1 两个分析 Step

```text
Step A: analyzeSource
  GitHub metadata/default branch/commit
    -> stream archive download
    -> mkdtemp (0700, random pathname)
    -> safe extract candidate text files only
    -> framework/config/navigation/Markdown analysis
    -> build versioned DocsDataset
    -> PreviewStore.putDataset / putManifest
    -> finally remove temp directory

Step B: validateTarget
  read SourceTree/manifest from PreviewStore
    -> Phoenix Docs Validator
    -> PreviewStore.putReview(target-preview.json)
    -> PreviewStore.markReady(ready.json)
```

临时目录只服务当前一次 Step。Files SDK 可以把本地 path/stream 作为上传来源，fs adapter 也可用于 local/test，但 analyzer 的读取 contract 仍应是受限的 `SourceWorkspace`，不能直接绑定 provider API。以下内容成功写入 PreviewStore 后，就不能再有任何后续阶段依赖绝对路径或临时文件句柄：

- 筛选后的 Markdown/MDX 正文。
- `DocsDataset` manifest、SourceTree / SourceAnalysis。
- framework、content root、config paths、commit 等 source info。
- `TBadSmell[]` 和计数。
- Phoenix Docs Validator 返回的 target tree、target revision 和 conflicts。

两个 Step 固定分开：Phoenix target validation 或 Review artifact 写入失败时，只重试 Step B，不重复下载、解压和分析。上线前必须分别测量 download/extract/analyze/persist-dataset/target-validation/mark-ready 耗时、compressed/expanded/retained/upload bytes、memory peak 和 Blob 操作数。

只有最大允许 archive 无法稳定落在 Step A 的 `maxDuration`/memory 内时，才继续拆分 Step A；物化筛选后的 `SourceWorkspaceRef`，内容固定为 candidate manifest + candidate files，不上传完整原始 archive再让下一 Step 重复下载和解压。Step A 失败会整体重新下载/解压，不尝试恢复 tar stream 中点；`finally` 始终清理本地目录。

Preview artifact 不是 Workflow 状态变化后自动生成。Workflow 内的 Groupher 业务代码按以下顺序显式调用 PreviewStore，所有写入再由 Files SDK 完成：

```text
WorkflowRun automatically: running
        |
        v
analyzeSourceStep()
        |-- previewStore.putDataset(...)  # DocsDataset + 每篇 Markdown/MDX
        `-- previewStore.putManifest(...) # Dataset manifest + SourceAnalysis + BadSmell
        |
        v
validateTargetStep()
        |-- previewStore.putReview(...)   # Phoenix TargetPreview
        `-- previewStore.markReady(...)   # 必须最后写
                |
                v
Step returns successfully
        |
        v
WorkflowRun automatically: completed
```

如果任一写入失败，当前 Step 抛错且不写 ready marker。`attemptRef` 在启动一次逻辑分析时固定，并作为 Workflow 输入传入；两个 Step 及其基础重试都使用相同 `attemptRef`，通过 content-addressed shard 和 create-or-assert-same 写入安全重放。用户 reset/re-import 才生成新的 `previewRef/attemptRef`。

### 4.2 Preview 对象布局

建议使用通用 Content Import prefix；首期其中只有 `DocsDataset`：

```text
content-import/previews/{previewRef}/
|-- preview-record.json
|-- analysis-run.json
`-- attempts/
    `-- {attemptRef}/
        |-- dataset/
        |   |-- manifest.json
        |   |-- analysis.json
        |   |-- tree.json
        |   |-- bodies/
        |   |   |-- {encodedSourceRef}
        |   |   `-- ...
        |   |-- bad-smells.json
        |   `-- optional-streams/     # future；首期不创建空目录
        |-- review/
        |   `-- target-preview.json
        `-- ready.json
```

规则：

- `previewRef` 不可猜测，并绑定 user/community/repo/idempotency key。
- `attemptRef` 标识一次逻辑分析运行，不标识 Workflow 的单次技术 retry；基础重试使用同一个 attempt prefix。
- `ready.json` 位于 attempt 内，是完整 Review artifact 的最终完成凭证；根目录不维护“哪个 retry 获胜”的可变指针。
- `ready.json` 至少绑定 `attemptRef/datasetManifestHash/targetPreviewHash/targetRevision`，且其内容在重试间保持确定性。
- source object key 使用安全编码后的 `sourceRef`，不能直接拼接未经校验的仓库路径。
- `preview-record.json` 是不可变的产品侧授权记录，不是 Workflow Session；它保存 owner、community、TTL、requested source 和预先固定的 `attemptRef`。
- `analysis-run.json` 是 write-once 的 WorkflowRun 关联；它不复制 Step 状态、retry 历史或可从 Workflow/Job 查询到的错误状态。
- 用户确认后由 Phoenix ImportJob 保存 `previewRef/datasetRef` 的一次性关联，不回写可变 Blob session，也不在 PreviewRecord 中累积 `publishRunRef/jobRef`。
- 不在 key、metadata 或 URL 中放 token、用户输入的绝对路径或私有 credential。

`target-preview.json` 是 Phoenix 根据来源树和当前 Groupher 状态生成的 Review 结果，不属于纯来源 `DocsDataset`，因此单独放在 `review/`。

Files SDK 的统一 `upload()` 不应被假定具有所有 provider 都一致的 conditional-create/CAS 语义。通过单个活动 Workflow run、固定 `attemptRef`、content-addressed immutable shards 和 attempt-local ready receipt，业务 contract 不需要根指针 CAS。`markReady` 必须实现 create-or-assert-same：不存在则创建；已存在且稳定字段相同则成功；不同则报告 invariant error。若某个 provider 仍需要严格 create-if-absent，在 PreviewStore 内使用 typed `raw` 或原生条件写，不能把它泄漏到业务层。

### 4.3 Analyze 失败与恢复

Files SDK 的 storage retry 只处理一次对象读写，不理解业务阶段。完整策略由 Workflow 和 PreviewStore 共同完成：

```text
storage request failure
  -> Files SDK retry/timeout

archive/analyzer failure
  -> Workflow retry analyzeSource Step

Phoenix target validation/review write failure
  -> Workflow retry validateTarget Step only

completed analysis + browser refresh
  -> previewRef -> PreviewRecord -> attemptRef -> ready artifact

new Node instance
  -> read the same private object prefix
```

目标不是精确续传 archive，而是保证一次 Step 失败后可以安全重跑，并且已经完成的 Preview 能跨实例恢复。

## 5. Review 阶段

Browser 只能通过 Next.js API 获取安全 Preview DTO：

```text
GET /api/docs/import/previews/{previewRef}
        |
        | owner/community/TTL check
        v
read attempts/{attemptRef}/ready.json
  -> DocsDataset manifest/analysis + review/target-preview
        |
        v
return repo info + counts + tree + badSmells + conflicts
```

不能返回：

- Blob pathname 或 provider credential。
- 原始 archive。
- 全量 Markdown 正文。
- 服务端临时目录。
- BodyBag 集合。
- Phoenix DB id。

用户选择的 `sourceRef` 在 apply 请求中提交，Node 必须与当前 ready analysis 中的可用 Page 集合求交并去重。不能信任 Browser 直接传入的任意 object key。

## 6. Import 阶段与 BodyBag 批处理

首期容量常量直接写死，不做运行时探测、配置协商或自动调整：

```text
ARTIMENT_MAX_INPUT_BYTES = 2 MiB  # 序列化 Plate value
MAX_BATCH_COUNT = 4
MAX_BATCH_BYTES = 6 MiB       # 完整 GraphQL request JSON
MAX_BODY_BAG_BYTES = 5 MiB    # 单篇 canonical BodyBag JSON
```

假设用户确认导入 12 篇，且每批完整 GraphQL request 的未压缩 UTF-8 bytes 都未超过 6 MiB：

```text
Next.js Node
  |
  | read source 01..04 from Files SDK
  | Markdown -> shared Import Content -> canonical BodyBag
  `-------------------------------> stage batch 1 (4 docs)

  | read source 05..08 from Files SDK
  | Markdown -> canonical BodyBag
  `-------------------------------> stage batch 2 (4 docs)

  | read source 09..12 from Files SDK
  | Markdown -> canonical BodyBag
  `-------------------------------> stage batch 3 (4 docs)

  | all importable selected documents staged
  `-------------------------------> apply(jobRef)

Phoenix
  | validate/upsert each BodyBag staging row
  | update bounded Job progress
  ` on apply: lock -> completeness check -> one transaction -> completed
```

分批的目的：

- 避免一个 GraphQL 请求携带数十或数百篇完整 BodyBag。
- 控制 Node 转换并发、请求体大小和 Phoenix 内存峰值。
- 单批网络失败可以安全重试。
- 最终用户可见写入仍然是 all-or-nothing。

batch 不能只按篇数切。Node 每生成一个 BodyBag 都计算未压缩 UTF-8 bytes，并按写死的两个边界切批：

```text
batch.count <= 4
fullGraphQLRequestBytes <= 6 MiB
```

加入下一篇会超过任一固定阈值时先发送当前批次，下一篇进入新批次。单篇未超过 5 MiB 但无法放进当前批次时单独进入下一批；单篇在共享 publisher 中超过固定 2 MiB Plate input、生成后超过 5 MiB BodyBag，或触发其他单篇结构限制时，返回稳定的 `content_too_large`，显式跳过该 Page，其他 Page 继续。结果必须列出 skipped sourceRef；如果没有任何可导入 Page，则不调用 apply。用户需要拆分或精简原文后手动导入，不能通过放宽请求或自动分片硬撑。

Node 的 size 只用于切批；Phoenix 在 `BodyBag.cast` 后 canonical encode 并保存权威 `body_size_bytes`。GraphQL input 不增加可信 `bodySizeBytes` 字段。HTTP gzip、PostgreSQL TOAST 和 Blob at-rest compression 都不能用于容量判断。

分批不是直接创建最终文档。普通转换失败仍阻止 apply；只有稳定的 `content_too_large` 按已决定规则把该 Page 从有效选择集和 TargetTree 中显式排除。已经 staged 的 BodyBag 在最终事务前对用户不可见。

这里不能在 Docs Bulk Import 下实现第二套 Markdown/BodyBag publisher。编辑器单篇 Import Content、
批量 Docs 和后续单篇来源同步必须复用同一个 server-side Import Content function；批量流程只负责
选择多个 source item、控制并发和分批 staging。

## 7. Phoenix / Elixir 重构

### 7.1 保留的职责

Phoenix 继续负责：

- 用户、community 和 `doc.import` 权限。
- 服务间 trust 边界。
- ContentImport Job 和 idempotency。
- target revision 校验与写入锁。
- item metadata、选择和冲突决策。
- BodyBag contract/canonical hash 校验。
- staging completeness。
- Docs branch/tree/draft、`ImportSourceMapping` 和 Job completion 的单事务提交。
- Job 查询、进度、错误和审计摘要。

目标文件职责：

- `jobs.ex`：Job 创建、状态机、idempotency、进度与失败摘要。
- `staging.ex`：BodyBag schema/hash/字节校验、幂等写入、completeness 和清理。
- `threads/doc/validator.ex`：只读生成 TargetTree/conflicts/targetRevision。
- `threads/doc/writer.ex`：在 revision lock 和同一事务内完成 Docs、ImportSourceMapping 与 Job completion。
- `ImportSourceMapping` 只保存上次成功同步基线；本次冲突的 `resolution` 保存在 JobItem，不进入 Mapping。

后续 conflict resolver UI 扩展 JobItem 的 typed resolution 即可，不会因此迁移 ImportSourceMapping。若未来出现“永久记住此来源的处理策略”这一独立产品能力，应建立可审计的 sync policy，而不是复用一次 Job 的 resolution 字段。

### 7.2 删除的职责

目标方案删除：

- `GroupherServer.CMS.ContentImport.PayloadStore`。
- `GroupherServer.CMS.ContentImport.PayloadStore.Local`。
- `CONTENT_IMPORT_PAYLOAD_DIR`。
- Snapshot/Preparation/Plan/BodyBag 的文件 codec checkpoint 链路。
- Phoenix 对 Preview source Markdown 或 archive 的读取。
- Job/Snapshot 表中的 `payload_ref`、`preparation_ref`、`plan_ref` 及只为这些 locator 服务的 hash/version 字段。

`Checkpoints` 如果不再有非文件型 ContentImport 的具体消费者，也随同删除；不为假想的未来平台保留一套当前产品不使用的 dual storage lifecycle。未来平台应先判断来源与转换发生在 Node 还是 Phoenix，再复用本文的明确边界。

### 7.3 Job 元数据

Job 是导入的控制面，不保存完整正文。目标字段应收敛为类似：

```text
ContentImportJob
|-- id / hash_id
|-- community_id
|-- actor_id
|-- thread = doc
|-- status
|-- idempotency_key
|-- source_info summary
|   |-- repo
|   |-- branch
|   |-- commit
|   `-- framework
|-- target_revision
|-- scope_ref / preview_branch
|-- counts
|-- progress
|-- bad_smells summary
|-- error_code / error_message
|-- inserted_at / updated_at / completed_at / cancelled_at
```

状态建议继续保持清晰的控制流：

```text
pending -> staging -> ready -> applying -> completed
              |                    |
              `-> failed <---------`
```

Docs Validator 只在 Review 阶段生成用户实际看过的 ImportIntent。创建 Job 时验证当前 target revision 仍与 Review 一致，不静默重新规划；最终 apply 在写入锁内再次验证 revision。任一验证失败都要求重新 Review，不能写入与用户确认内容不同的新规划。因此正式 Job 不需要仅为重复规划保留 `planning` 状态。

```text
Review
  Docs Validator -> ImportIntent + targetRevision=R1
        |
        v
startDocImport
  current revision == R1 ? create Job : require re-review
        |
        v
BodyBag staging
        |
        v
atomic apply under target lock
  current revision == R1 ? apply reviewed intent : rollback + require re-review
```

### 7.4 Import intent

用户确认时，Node 发送的是有界结构化意图，不发送全量 Markdown：

```text
DocImportIntent
|-- preview_ref
|-- idempotency_key
|-- source_info
|-- target_revision
|-- target_tree / navigation intent
`-- items[]
    |-- external_ref
    |-- source_path
    |-- source_hash
    |-- title
    |-- action
    `-- thread_ref (when applicable)
```

Phoenix 必须重新检查 target revision。权限边界分两次：创建 Preview 前的 `checkPassport` 只用于提前反馈；用户确认并创建正式 Job 的 mutation 必须再次执行 `doc.import` Passport middleware。Job 创建成功后的 `stage/apply` 是受信任服务对一个已授权 Job 的后台延续，不再增加第三套用户权限判断。`previewRef` 只用于关联此次确认，不允许 Phoenix 依赖它去读取 Files SDK；对象存储仍由 Node 独占。

## 8. PostgreSQL BodyBag staging

### 8.1 为什么 staging 仍然必要

如果同时要求：

- BodyBag 按小批次发送；
- 页面刷新或网络失败后可以重试；
- 最终写入全部原子完成；

那么最终 apply 前必然要有一个持久 staging 位置。删除文件型 PayloadStore 不等于删除 staging。

### 8.2 建议表结构

建议新增专用表，而不是把大 BodyBag 塞进 `Job.Item.preview`：

```text
content_import_job_bodies
|-- id
|-- job_id                  FK -> content_import_jobs, on delete cascade
|-- external_ref
|-- body_hash
|-- body                    jsonb
|-- body_size_bytes
|-- inserted_at
`-- updated_at

UNIQUE (job_id, external_ref)
```

`Job.Item` 继续只保存有界、可查询的 item 状态：

```text
external_ref
action / resolution / selected
thread_ref
source_hash
body_hash
content_status = pending | ready | failed | skipped
skip_code / safe skip summary
safe preview summary
```

### 8.3 stage batch 语义

每批 stage 必须：

1. 锁定同一 Job 下对应的 Job.Item。
2. 校验 Job 仍处于允许 staging 的状态。
3. 校验 `externalRef` 属于本次 Job 且已选择。
4. 输入只能是 BodyBag 或 allowlisted `content_too_large` skip；普通转换错误不能作为 skip 提交。
5. 对每个 BodyBag 执行 schema/canonical hash 校验。
6. `BodyBag.cast` 后 canonical encode，以 Phoenix 计算的 bytes 校验单篇 5 MiB 上限并保存可信的 `body_size_bytes`；客户端 size 不是可信输入。
7. 同一 `(job_id, external_ref)`、相同 `body_hash` 重试视为成功。
8. 同一 key、不同 hash 视为冲突，不允许静默覆盖。
9. upsert staging body，并更新 item `content_status/body_hash`。
10. `content_too_large` item 标记为 skipped 且不创建 staging row；只在所有有效选中 item ready 后将 Job 推进到 `ready`。

批次结果只返回 bounded progress，不回传已保存的正文。

### 8.4 atomic apply

```text
BEGIN
  lock Job
  assert status == ready
  lock target Docs revision/tree boundary
  load effective selected Job.Items (exclude explicit content_too_large skips)
  load the matching filtered TargetTree
  load matching staging BodyBags
  assert complete + hashes match
  rebuild/apply typed Doc Plan
  write branch/tree/drafts
  update ImportSourceMappings
  mark Job completed
  delete staging rows (or mark for immediate GC)
COMMIT
```

任意一步失败则回滚最终 Docs 写入。staging rows 保留供显式重试或诊断，直到 Job 取消/过期清理；不能因一次 apply 事务失败就立刻删除。

### 8.5 staging 生命周期

| Job 结果            | BodyBag staging                                               |
| ------------------- | ------------------------------------------------------------- |
| `completed`         | 在成功 apply 的同一事务中删除；Job 保留 hash、counts、summary |
| `cancelled`         | 删除                                                          |
| `failed` 且可重试   | 保留到 retry TTL                                              |
| `failed` 且不可重试 | 记录诊断后删除或短期保留                                      |
| orphan Job          | 定时任务按 TTL 清理                                           |

## 9. API 边界

### 9.1 Browser -> Next.js

继续使用三条产品 API：

```text
POST   /api/docs/import/previews
GET    /api/docs/import/previews/{previewRef}
POST   /api/docs/import/previews/{previewRef}/apply
DELETE /api/docs/import/previews/{previewRef}
```

它们负责 Preview owner、community、TTL 和 Workflow 状态，不暴露 Files SDK。

### 9.2 Next.js -> Phoenix

目标服务接口：

```text
previewDocImportTarget
  input: source info + source tree
  output: target tree + conflicts + target revision

startDocImport
  input: import intent + selected refs + idempotency key
  output: jobRef

stageDocContentImportBodies
  input: jobRef + bounded item batch
         item = { externalRef, bodyBag }
              | { externalRef, skipped: { code: content_too_large } }
  output: bounded progress

applyDocContentImport
  input: jobRef
  output: completed Job summary + first imported doc ref

contentImportJob
  input: jobRef
  output: status/progress/error/result summary
```

Node/Phoenix 之间不传：

- Files SDK client 或 provider credential。
- Blob pathname。
- 临时绝对路径。
- 原始 archive。
- Snapshot/Preparation/Plan opaque ref。

`skipped` 只接受受信任 Node 报告的 allowlisted `content_too_large`，用于 publisher 在生成 BodyBag 前命中 2 MiB Plate input 上限的情况；不能把任意转换错误伪装成 skip。Phoenix 仍校验该 `externalRef` 属于当前 Job，并把状态持久化到 JobItem，不为 skipped item 创建 staging row。

## 10. 清理与保留策略

### 10.1 Preview 对象

默认 TTL：60 分钟。

```text
analyze cancelled
  -> cancel Workflow run
  -> delete preview prefix

Phoenix Job completed
  -> delete preview prefix

apply failed
  -> retain until retry/diagnostic TTL

preview accessed after expiry
  -> lazy delete + return preview_expired

scheduled sweeper
  -> proactively delete expired prefixes

provider lifecycle
  -> backstop for leaked/orphan objects
```

Files SDK 提供 list/delete，不提供 Groupher Preview TTL 语义。主动 sweeper 和 provider lifecycle 都需要显式配置。

### 10.2 删除顺序

成功路径必须先确认 Phoenix Job `completed`，再删除 Preview prefix。`completed` 表示 BodyBag 已全部进入 PostgreSQL staging，Phoenix 已完成 Docs Tree/Draft/ImportSourceMapping 的最终事务，并非仅表示“已经同步到 Elixir”。不能在最后一批 BodyBag stage 完成时提前删除，因为 apply 尚未发生。

暂时性数据库错误导致 apply 回滚时，Phoenix 使用现有 PostgreSQL staging 自行重试；Node 不重新转换或重发正文。target revision conflict 等确定性冲突不自动重试，而是要求重新 Review。真正 `completed` 后不再需要完整 staging，因此在 apply 事务内立即删除。

## 11. Node 模块边界

首期 Node server-only 模块继续留在 `frontend/dashboard`，不在本轮抽 workspace package。若 `main` 或其他 Next.js host 后续确实需要发起同一导入流程，再提取 server-only 业务模块，由具体 host 提供 auth/env/route composition。

目录按 Platform、Thread 和基础设施分开，但只创建 GitHub + Docs 的真实实现：

```text
frontend/dashboard/src/
|-- lib/content-import/
|   |-- core/
|   |   |-- contracts/
|   |   |   |-- threadDataset.ts
|   |   |   |-- artifactRef.ts
|   |   |   `-- badSmell.ts
|   |   `-- preview-store/
|   |       |-- previewStore.ts
|   |       |-- filesPreviewStore.ts
|   |       `-- localPreviewStore.ts
|   |-- platforms/github/
|   |   |-- client.ts
|   |   `-- repo/
|   |       |-- source.ts
|   |       `-- workspace/
|   |-- threads/docs/
|   |   |-- contracts/
|   |   |-- analyzer/
|   |   |-- buildDataset.ts
|   |   `-- selection.ts
|   `-- transport/phoenix/
|       `-- docsImport.ts
`-- workflows/content-import/docs/
    |-- analyzeGitHubRepo.ts
    `-- applyDocsDataset.ts
```

后续如果抽 workspace package，必须是明确的 server-only package，不能让 Files SDK provider adapter、Blob credential 或 `node:fs` 被 Core/browser bundle 引入。

`PreviewStore` 继续作为业务入口；Analyze/Review/Publisher 不直接调用 `files.upload()`，避免 provider key 和生命周期规则散落。`transport/phoenix/docsImport.ts` 首期同时包含 trusted request 和 Docs import operations，不为单一消费者提前拆 `client.ts`。

正文转换继续复用现有 Import Content/document-importer/artiment-publisher，不在 `threads/docs` 下新增 `publishBodyBags.ts`。Notion、Google、Linear、Changelog、Post、comments、reactions、actors 等尚未实现的能力也不创建空目录。

## 12. 配置

建议由单一 composition root 解析环境：

```text
DOCS_IMPORT_PREVIEW_STORE=local|vercel-blob|s3
DOCS_IMPORT_PREVIEW_TTL_SECONDS=3600

# local/test
DOCS_IMPORT_PREVIEW_DIR=...

# Vercel Blob
VERCEL_OIDC_TOKEN=...
BLOB_STORE_ID=...
# 或兼容 BLOB_READ_WRITE_TOKEN

# S3/R2（启用对应 adapter 时）
DOCS_IMPORT_BUCKET=...
DOCS_IMPORT_REGION=...
DOCS_IMPORT_ENDPOINT=...
```

应用代码只接收已经构造好的 `Files`/`PreviewStore`。环境变量解析不能散落到 analyzer、workflow 或 publisher。

生产环境不允许自动回退到 local filesystem；配置缺失必须启动失败或让导入入口返回稳定的 unavailable 错误。CI/test 可以显式使用 Files SDK fs adapter 或内存 fake。

## 13. 可观测性

至少记录：

- `previewRef`、`jobRef`、Workflow run ref、attempt ref。
- community 公开 ref、repo、commit、framework。
- archive compressed/expanded/retained bytes。
- retained file/source count。
- Files SDK action、provider、耗时、retry 次数、错误码、读写字节。
- analyze、target preview、publish、stage、apply 各阶段耗时。
- batch index/size、staged/total count。
- Preview prefix 和 BodyBag staging 的清理结果。

不能记录正文、credential、完整 provider error cause、服务端绝对路径或未脱敏的上游响应。

## 14. 迁移步骤

### Phase 0：冻结 contract 与容量边界

1. 统一 `PreviewRecord + analysis-run + fixed attemptRef + attempt-local ready` 布局。
2. 固定 `ready.json` create-or-assert-same 语义和 runtime decoder。
3. 固定 `source-md-v1:<sha256>` 与 `doc-sync-v1:<sha256>` hash 版本格式。
4. 把容量 contract 写死为共享 publisher 已有的 `ARTIMENT_MAX_INPUT_BYTES = 2 MiB`（序列化 Plate value），以及 Bulk transport 的 `MAX_BATCH_COUNT = 4`、`MAX_BATCH_BYTES = 6 MiB`（完整 GraphQL request JSON）和 `MAX_BODY_BAG_BYTES = 5 MiB`（单篇 canonical BodyBag JSON），并固定 `content_too_large` 等稳定错误码；首版不提供环境变量、租户配置或运行时探测。

### Phase 1：Files SDK 接入 PreviewStore

1. 把 Groupher 导入链路的 `Repository/repository` 标识符、文件名和 request/source-info 字段一次性切换为 `Repo/repo`，不保留兼容 accessor。
2. 增加 `files-sdk` 和实际 adapter peer dependency。
3. 建立 `createImportFiles()` composition root。
4. 在现有 `PreviewStore` contract 后实现 `FilesPreviewStore`。
5. local/test 使用 fs adapter，生产使用 private Vercel Blob adapter。
6. 用 contract tests 验证 create/read/update/list/delete、owner 隔离、immutable artifact 和 prefix cleanup。
7. 切换后删除手写 `LocalPreviewStore`/`BlobPreviewStore` 中可被统一实现替代的 provider 细节。

### Phase 2：稳定 attempt 与 cleanup lifecycle

1. 引入逻辑运行级固定 `attemptRef`、attempt-scoped key 和 attempt-local ready marker。
2. 将 Workflow 固定拆为 `analyzeSource` 和 `validateTarget` 两个 Step；前者下载、解压、分析并写 Dataset/manifest，后者读取已持久化的 SourceTree、调用 Phoenix Validator、写 review 并最后 `markReady`。
3. 两个 Step 及其基础重试复用同一 `attemptRef`，不能读取无 ready receipt 的半成品；target validation 失败只重试第二个 Step。
4. 成功、取消和 lazy expiry 统一走一个 idempotent cleanup command。
5. 接入主动 TTL sweeper；S3/R2 lifecycle 或 Vercel 运维清理作为兜底。
6. 记录 storage hooks/metrics，但 hooks 失败不能改变业务结果。

### Phase 3：PostgreSQL BodyBag staging

1. 新增 `content_import_job_bodies` migration/schema。
2. Node 按固定 `2 MiB Plate input / 4 篇 / 6 MiB request / 5 MiB per BodyBag` 执行转换和切批；这里只读取实际未压缩 UTF-8 bytes 与代码常量比较，运行时不改变这些上限。
3. `stageDocContentImportBodies` 在 `BodyBag.cast` 后重新 canonical encode，校验 Phoenix 权威的单篇 bytes，再 upsert DB staging；GraphQL input 不接收可信 `bodySizeBytes`。
4. 完成固定批次边界、单篇超限显式跳过、相同 hash 幂等、不同 hash 冲突、批次进度和 completeness 测试。
5. `applyDocContentImport` 从 staging table 读取有效选中项及过滤后的 TargetTree，并保持现有 atomic apply。
6. 增加 completed/cancelled/failed/orphan staging cleanup。

### Phase 4：删除 Phoenix PayloadStore

1. `startDocImport` 改为接收 bounded ImportIntent，不再持久化 Snapshot/Preparation/Plan payload。
2. Job/Job.Item 只保存控制状态、metadata、hash 和 bounded preview。
3. 删除 `PayloadStore`、`PayloadStore.Local` 和不再使用的 `Checkpoints`。
4. 删除 `CONTENT_IMPORT_PAYLOAD_DIR` 配置和相关测试。
5. 直接删除旧 Snapshot/Preparation/Plan/Job/JobItem/JobAsset/PayloadStore/Preview Session 数据、旧 payload 文件，以及 `payload_ref/preparation_ref/plan_ref` 等只服务 locator 的字段；现有 Docs 正文不删除。
6. 删除无调用方的 codecs 和恢复逻辑，不保留双写或兼容分支。
7. 不做历史数据迁移、backfill、dual read/write、旧 decoder、fallback 或兼容 accessor；旧来源关联需要时由用户重新导入生成。
8. 更新 `bulk-import.md`、`content-import-refactor-plan.md` 中旧的双存储描述。

### Phase 5：端到端验收

1. 固定公开 GitHub fixture 跑通 Browser -> Next.js -> Blob -> Phoenix -> DB。
2. 验证刷新和跨 Node 实例恢复。
3. 注入每个阶段失败，确认临时目录、Preview objects 和 DB staging 生命周期正确。
4. 验证普通 BodyBag 转换失败会阻止 apply；单篇超过 2 MiB Plate input 或 5 MiB BodyBag 时只把该 Page 标记为 `content_too_large` 并从有效 TargetTree 排除，其他 Page 继续；全部 Page 都被跳过时不调用 apply。
5. 验证 apply 事务失败时 Docs/Tree/ImportSourceMapping/Job completion 全部回滚，staging 可重试。
6. 做 500、1000、5000 文件容量测试，确认 archive limit、Blob 成本、Node duration、GraphQL batch 和 PostgreSQL staging 容量。

## 15. 测试矩阵

| 范围                | 必测场景                                                                                                                                                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FilesPreviewStore   | local/provider contract、private read、prefix isolation、missing object、partial attempt、cleanup idempotency                                                                              |
| Temporary workspace | success/failure/cancel 都删除；上传完成前不删除；无绝对路径泄漏                                                                                                                            |
| Workflow            | 同一 idempotency key 不重复启动；`analyzeSource` 与 `validateTarget` 独立持久化/重试；target validation 失败不重跑下载分析；两个 Step 复用固定 attemptRef；无 ready receipt 的半成品不可见 |
| Preview API         | owner/community 隔离、TTL、刷新恢复、失效 DTO、安全字段白名单                                                                                                                              |
| Publisher           | 固定 2 MiB Plate input/4 篇/6 MiB request/5 MiB BodyBag、临界 bytes 切批、单篇超限跳过、普通转换失败停止、重复 batch、sourceRef 不存在、BodyBag canonical hash                             |
| DB staging          | Phoenix canonical bytes 权威校验、same-hash idempotency、different-hash conflict、并发 stage、Job 状态约束、TTL cleanup                                                                    |
| Atomic apply        | 过滤 skipped item 后的 completeness/TargetTree 一致性、零可导入项不 apply、target revision conflict、rollback、ImportSourceMapping/Job completion 同事务                                   |
| E2E                 | 固定真实公开仓库、七类 analyzer golden parity、刷新、取消、失败重试、完成清理                                                                                                              |

## 16. 对现有文档的影响

跨来源架构已独立收敛到 [`content-import-architecture.md`](./content-import-architecture.md)。本文只覆盖 Files SDK 和 staging 细节；其他文档发生边界或命名冲突时，以总架构文档为准。

需要保持同步的文档：

- [`bulk-import.md`](./bulk-import.md)
  - Phoenix 不再负责 Snapshot/Preparation/Plan PayloadStore。
  - BodyBag staging 改为 PostgreSQL staging。
  - Private Blob 由 Files SDK adapter 提供，不硬编码为 `@vercel/blob`。
  - 增加主动 sweeper 尚未接线的事实。
- [`content-import-refactor-plan.md`](./content-import-refactor-plan.md)
  - 删除“完整 Snapshot/Preparation/Plan 统一由 PayloadStore 恢复”的目标。
  - 收缩通用 Job/Persistence 模型。
  - file-based Docs import 以 Node Preview artifact + DB staging 为唯一生产路径。

本文覆盖以下已讨论并确认的范围：

```text
Docs GitHub import storage boundary
Phoenix PayloadStore removal
PostgreSQL BodyBag staging
Files SDK PreviewStore integration
```

## 17. 已决事项

1. Files SDK 可以引入，第一用途是文档导入 PreviewStore，不扩展到公共 upload。
2. 当前 GitHub URL 导入不需要 `signedUploadUrl()`。
3. 解析发生在 Next.js Node runtime；首期模块继续留在 Dashboard，后续出现真实复用方时再抽 server-only package。
4. Workflow 固定拆为 `analyzeSource` 和 `validateTarget` 两个 Step；临时目录只活在前一个 Step，Dataset/manifest 成功上传后立即删除，后一个 Step 从 Files SDK 读取 SourceTree 并生成 target review。
5. source Markdown 和 Preview artifacts 保存到 private object storage，导入成功/取消/过期后删除。
6. Phoenix 只负责正式 Job、BodyBag staging、权限和最终原子写入，不读取 Blob。
7. BodyBag 采用 PostgreSQL 分行 staging。
8. Snapshot、Preparation、Plan 不再由 Phoenix PayloadStore 保存。
9. 目标实现删除 Phoenix `PayloadStore`，不保留兼容双路径。
10. 我们不维护 Workflow Session；Vercel 维护 WorkflowRun，我们只在 private Blob 保存不可变 `PreviewRecord` 和 write-once `analysis-run.json` 关联。
11. 不保留原 `session.json` 的可变 Session 语义；`preview-record.json` 保存不可变授权记录和固定 `attemptRef`，Analyze 状态来自 WorkflowRun，Import 状态来自 Phoenix Job。
12. Workflow 业务代码显式调用 `PreviewStore.putDataset/putManifest/putReview/markReady`，其底层通过 Files SDK 写对象；attempt-local ready receipt 必须最后写。
13. Job `completed` 表示 Phoenix 最终事务已经提交；BodyBag staging 在同一事务中立即删除，apply 回滚时保留供 Phoenix 重试。
14. Docs Validator 在 Review 阶段生成 ImportIntent；创建 Job 和最终 apply 只验证 target revision，不静默重新规划。
15. 目标流程的英文命名统一使用 `Repo` 缩写，例如 `repoUrl`、`sourceRepo`、`resolveGithubRepo` 和 `analyzeGithubRepoStep`。
16. Preview 的持久工作集采用 versioned `DocsDataset`；分析问题类型叫 `TBadSmell`。
17. 正文转换复用现有 Import Content，不在 Bulk Import 下维护第二套 Markdown/BodyBag publisher。
18. 最终持久来源映射叫 `ImportSourceMapping`，Groupher 同步基线字段叫 `groupher_hash`。
19. `source_hash/groupher_hash` 使用带版本前缀的稳定格式；冲突 `resolution` 属于 JobItem，不进入 ImportSourceMapping。
20. 正文转换与 BodyBag staging 使用写死的容量 contract：序列化 Plate value 最多 2 MiB、每批最多 4 篇、完整 GraphQL request JSON 最多 6 MiB、单篇 canonical BodyBag JSON 最多 5 MiB；大小均为未压缩 UTF-8 序列化 bytes，不按字符数、gzip、TOAST 或 Blob 压缩后大小计算。
21. Node 只用实际 bytes 对照固定常量切批；不做运行时容量探测、动态上限或自动调参。
22. 单篇超过 2 MiB Plate input 或 5 MiB BodyBag 时显式标记 `content_too_large`、从有效 TargetTree 排除并继续其他 Page；如果没有任何可导入 Page，则不调用 apply。普通转换失败仍阻止整批 apply。
23. Phoenix 在 `BodyBag.cast` 后 canonical encode 并生成权威 `body_size_bytes`；GraphQL input 不信任客户端 size。
24. 本次不考虑历史导入数据：旧表记录、payload 文件和 locator 字段可直接删除，不做迁移、backfill 或任何兼容逻辑；已有 Docs 正文不受影响。

## 18. 固定常量与运维配置

1. Preview TTL 默认 60 分钟。failed Job 不提供复杂断点恢复；staging 只短期保留用于基础诊断后清理，用户通过 reset/re-import 重新开始。
2. `ARTIMENT_MAX_INPUT_BYTES = 2 MiB`、`MAX_BATCH_COUNT = 4`、`MAX_BATCH_BYTES = 6 MiB`、`MAX_BODY_BAG_BYTES = 5 MiB` 是首版代码常量，不暴露环境变量或租户配置。以后确需调整时通过代码、测试和正常发布一起修改。
3. 全局未完成 Job 数量、Preview TTL 和 sweeper 周期属于运维配置；它们不改变单篇和单请求的固定容量 contract。

## 19. 参考

- [Files SDK Overview](https://files-sdk.dev/overview)
- [Files SDK Usage](https://files-sdk.dev/usage)
- [Files SDK Capabilities](https://files-sdk.dev/capabilities)
- [Files SDK Escape hatch](https://files-sdk.dev/escape-hatch)
- [Files SDK Vercel Blob adapter](https://files-sdk.dev/adapters/vercel-blob)
- [Files SDK signedUploadUrl](https://files-sdk.dev/api/signed-upload-url)
- [Files SDK filesystem adapter](https://files-sdk.dev/adapters/fs)
- [`content-import-architecture.md`](./content-import-architecture.md)
- [`bulk-import.md`](./bulk-import.md)
- [`content-import-refactor-plan.md`](./content-import-refactor-plan.md)
- [`article-publish-import-refactor.md`](./article-publish-import-refactor.md)
