# Content Import 总体架构

> 状态：公开 GitHub Repo → Groupher Docs 首期架构已完成本地切换；生产 Private Blob、固定公开仓库 Browser E2E 与全局分析 admission 仍待部署验收。
>
> 范围：多来源内容导入的长期边界、命名、Node/Phoenix 职责、`ThreadDataset`、持久化映射和后续同步扩展点。首期不实现 Changelog/Post、comments/reactions、导入用户或公共资源上传。
>
> Source of truth：涉及 Content Import 的跨来源架构、Node/Phoenix 边界和公共命名时，以本文为准。
>
> 关联文档：[`import_file_sdk.md`](./import_file_sdk.md) 描述首期 PreviewStore/Files SDK/PostgreSQL staging；[`bulk_import.md`](./bulk_import.md) 描述 GitHub Docs 产品流程；[`content_import_refactor_plan.md`](./content_import_refactor_plan.md) 记录实施与旧链路直接删除；[`article_publish_import_refactor.md`](./article_publish_import_refactor.md) 定义共享 Import Content、BodyBag 和 Article 写入边界；[`import_error_handling.md`](./import_error_handling.md) 记录联调错误、清理和重复来源覆盖边界。
>
> 冲突优先级：跨来源架构与术语以本文为准；Files SDK 和临时对象生命周期以 `import_file_sdk.md` 为准；产品步骤与 UI 以 `bulk_import.md` 为准；单篇格式转换与 BodyBag 以 `article_publish_import_refactor.md` 为准。
>
> 更新：2026-07-22

## 1. 结论

Content Import 采用“来源适配 → 标准化 Dataset → Review → PostgreSQL staging → Thread Writer”的稳定边界：

- Next.js Node 负责外部平台访问、下载、分页、临时文件、framework 分析、安全 Markdown/MDX、`ThreadDataset` 和 BodyBag 生成。
- Phoenix 不重新访问或解析外部来源，只负责权限、ImportJob、PostgreSQL staging、目标校验、最终 Thread 写入和 `ImportSourceMapping`。
- Files SDK 只位于 Node `PreviewStore` 后面，用于跨请求、Workflow Step 和实例保存不可变 Preview/Dataset；不替代 parser 的原生临时目录。
- 正文转换统一复用现有 Import Content：Markdown/MDX → Rich Editor AST → BodyBag。批量 Docs 和后续单篇同步不能各写一套 converter/publisher。
- 首期只实现 `GitHub Repo → DocsDataset → doc`，但目录和 contract 给其他 Platform、Source 和 Thread 留出位置。
- comments/replies/reactions 和外部 actor 只在 Dataset contract 中保留可选引用，不实现导入用户、ExternalIdentity 或 OAuth claim。
- 重试保持基础且有界；复杂失败标记为 failed，让用户 reset/re-import，不设计通用断点恢复引擎。

## 2. 统一术语

### 2.1 Platform、Source、ThreadDataset、Thread

```text
Platform -> Source -> ThreadDataset -> Thread -> ImportSourceMapping
```

| 名称                | 含义                                                  | 示例                                                                |
| ------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| Platform            | 外部内容平台或输入类别                                | GitHub、Notion、Google、Linear、Discourse、Flarum、CSV              |
| Source              | Platform 内具体可读取的内容面                         | GitHub Repo files、GitHub Releases、Linear Issues、Discourse Topics |
| ThreadDataset       | Node 完成标准化后、等待 Review/Apply 的版本化导入协议 | `DocsDataset`、`ChangelogDataset`、`PostDataset`                    |
| Thread              | Groupher 最终内容类型                                 | `doc`、`changelog`、`post`                                          |
| ImportSourceMapping | 外部 item 与 Groupher Thread 的持久关联及同步基线     | Repo 文件路径 ↔ Groupher Doc ref                                    |

`ThreadDataset` 是 Private Blob 中的 manifest + immutable shards，不是 Phoenix 数据库实体，也不是 Workflow Session。

不再使用以下目标命名：

- `Content Family`
- `Target`
- `work-items`
- `ImportDataset`
- `ThreadImportPackage`

### 2.2 Groupher 没有 Discussion Thread

`discussion` 只可以作为来源语义，不能成为 Groupher `threadKind`：

```text
github/discussions       -> PostDataset -> post
discourse/topics         -> PostDataset -> post
flarum/discussions       -> PostDataset -> post
github/issues            -> PostDataset + GTD metadata -> post
linear/issues            -> PostDataset + GTD metadata -> post
```

Groupher 的目标 Thread 只使用已有产品概念：`doc | changelog | post`。

### 2.3 Repo 命名

Groupher 自己维护的英文代码、contract、JSON 字段和文件名统一使用 `Repo`：

```text
repository       -> repo
repositoryUrl    -> repoUrl
GitHubRepository -> GitHubRepo
```

外部 SDK 的正式字段名不强行改写。

### 2.4 BadSmell

来源分析、转换和 Review 中可定位的问题统一叫 `BadSmell`，前端类型叫 `TBadSmell`：

```ts
type TBadSmell = {
  level: 'warning' | 'error'
  code: string
  message: string
  sourceRef?: string
  path?: string
}
```

字段和文件名使用：

```text
badSmell.ts
badSmells: TBadSmell[]
badSmellsRef: ArtifactRef
```

ImportJob 整体失败仍使用 `errorCode/errorMessage`；`TBadSmell` 表达具体来源 item 的分析问题，不能和 Job error 混用。

## 3. Node / Phoenix 总架构

整体架构图只表达两个服务端运行边界，不把 Dashboard UI 画进来：

```text
┌──────────────────────────────── Next.js Node ────────────────────────────────┐
│                                                                              │
│  Docs Import Workflow                                                        │
│          │                                                                   │
│          v                                                                   │
│  GitHub Gateway -> GitHub Repo Source -> Native Temp Workspace               │
│                                             │                                │
│                                             v                                │
│                                   Docs Analyzer / Normalizer                 │
│                                             │                                │
│                                             v                                │
│                                        DocsDataset                           │
│                                             │                                │
│                                             v                                │
│                              PreviewStore -> Files SDK -> Private Blob       │
│                                             │                                │
│                                             v                                │
│                    shared Import Content -> BodyBag[] -> Phoenix Client       │
│                                                                              │
└──────────────────────────────────────────────┬───────────────────────────────┘
                                               │ trusted bounded batches
                                               v
┌──────────────────────────────── Phoenix / Elixir ────────────────────────────┐
│                                                                              │
│  ContentImport API -> ImportJob -> PostgreSQL JobItem/BodyBag staging        │
│                                             │                                │
│                                             v                                │
│                                       Docs Validator                         │
│                                             │                                │
│                                             v                                │
│                              Docs Writer, one DB transaction                 │
│                                  │                    │                      │
│                                  v                    v                      │
│                         Docs Draft + Tree       ImportSourceMapping           │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Node 负责

- Platform credential、API client、限流和有界重试。
- Source capability probe、分页和内容读取。
- GitHub archive 下载、安全解压和临时工作区。
- Docs framework detection、配置静态分析、导航和 canonical SourceTree。
- 把外部正文清洗为安全 Markdown/MDX；禁止执行来源 JS、import、表达式或构建命令。
- 构建 versioned `ThreadDataset` 并显式写入 PreviewStore。
- 通过现有 Import Content 生成 BodyBag。
- 把 selected items 以有界批次发送给 Phoenix。

### 3.2 Phoenix 负责

- 用户、community、`doc.import` 权限和服务间 trust。
- 创建和查询 ImportJob，保存有界进度与错误摘要。
- PostgreSQL staging 和 batch 幂等。
- 验证 Review 时确认的目标 revision、树结构和写入约束。
- 在事务中写入 Docs Draft/Tree、更新 `ImportSourceMapping` 并完成 Job。
- 根据最终实际落库结果计算 `groupher_hash`。

Phoenix 不再负责：

- GitHub、Notion、Linear 等平台 API。
- archive 下载、解压或 workspace。
- Docs framework detection 和 Markdown/MDX 解析。
- Snapshot/Preparation/Plan 文件 checkpoint。
- `PayloadStore` 或对 Private Blob 的读取。
- 为来源正文生成 BodyBag。

## 4. ThreadDataset

### 4.1 Contract

首期只实现 `DocsDataset`，公共 header 为未来来源和 Thread 保留稳定位置：

```ts
type TThreadDatasetHeader = {
  schemaVersion: 1
  datasetRef: string
  thread: 'doc'
  source: {
    platform: 'github'
    kind: 'repo'
    scopeRef: string
    revision: string
  }
  capabilities: {
    actors: boolean
    comments: boolean
    replies: boolean
    reactions: boolean
    assets: boolean
  }
}

type TDocsDataset = TThreadDatasetHeader & {
  analysisRef: ArtifactRef
  treeRef: ArtifactRef
  bodiesRef: ArtifactRef
  badSmellsRef: ArtifactRef
  actorsRef?: ArtifactRef
  commentsRef?: ArtifactRef
  reactionsRef?: ArtifactRef
  assetsRef?: ArtifactRef
}
```

Markdown/MDX 只负责 body protocol。以下信息必须继续是 typed metadata：

- source identity、revision 和 version。
- Thread 类型。
- title、slug、route、GTD state 等产品字段。
- parent、order、tree hierarchy。
- actor、comment、reply、reaction 关系。
- BadSmell 和 unsupported content。

### 4.2 Markdown/MDX 文档标题边界

MD/MDX 来源必须区分元数据标题、Doc 可见标题、SourceTree 导航标题和目标 AST 中已消费的前导 H1。分析结果通过 `titleSource` 向 Publisher 提供来源证明；原始 Markdown/MDX 始终保持不变。

完整的字段定义、解析优先级、Publisher 行为矩阵和测试要求见独立规范 [`markdown_title_normalization.md`](./markdown_title_normalization.md)。该规范使用 `SourceAnalysis.schemaVersion = 2`，由所有 Docs framework 共用。

### 4.3 来源到 Thread 的映射

| Platform / Source        | Dataset                      | Groupher Thread      |
| ------------------------ | ---------------------------- | -------------------- |
| GitHub Repo files        | `DocsDataset`                | `doc`                |
| Notion Pages             | `DocsDataset`                | `doc`                |
| Google Docs              | `DocsDataset`                | `doc`                |
| GitHub Releases          | `ChangelogDataset`           | `changelog`          |
| GitHub Issues            | `PostDataset` + GTD metadata | `post`               |
| Linear Issues            | `PostDataset` + GTD metadata | `post`               |
| Notion Data Source tasks | `PostDataset` + GTD metadata | `post`               |
| GitHub Discussions       | `PostDataset`                | `post`               |
| Discourse Topics         | `PostDataset`                | `post`               |
| Flarum Discussions       | `PostDataset`                | `post`               |
| CSV rows                 | 用户选择对应 Dataset         | `doc/changelog/post` |

这种边界把扩展复杂度从“每个来源直接操作每种数据库模型”收敛为两端独立扩展：Source 负责生成 Dataset，Thread Writer 负责消费 Dataset。

## 5. Analyze、Preview 和 Files SDK

### 5.1 两个 Workflow Step 与原生临时目录

Analyze 固定拆成两个 Step。只有来源分析 Step 使用原生临时目录：

```text
Step A: analyzeSource
  download -> mkdtemp -> safe extract -> analyze
           -> putDataset + putManifest -> finally cleanup

Step B: validateTarget
  read SourceTree/manifest -> Phoenix Docs Validator
                           -> putReview -> markReady
```

Files SDK 技术上可以读写 Node 文件，但 parser 不应直接依赖 Files SDK。parser 只依赖 temporary workspace；需要跨请求、Step 或实例保留的结果才进入 PreviewStore。

成功写入 Dataset manifest 后，Step A 的临时目录立即删除。Step B 只读取持久化的 SourceTree/manifest；Phoenix target validation 或 `putReview` 暂时失败时只重试 Step B，不重新下载、解压和分析仓库。后续 Review/Apply 不能依赖临时路径、文件句柄或进程内状态。

必须分别记录 download/extract/analyze/persist-dataset/target-validation/mark-ready 耗时，以及 compressed/expanded/retained/upload bytes、memory peak 和 Blob 操作数。只有最大允许 archive 证明 Step A 无法稳定落在当前 Function `maxDuration`/memory 内时，才把 Step A 继续拆为“下载/解压/过滤”和“分析”。此时物化边界是筛选后的 immutable `SourceWorkspaceRef`：candidate manifest + candidate files，不上传完整原始 archive 再让下一 Step 重复下载和解压。

### 5.2 不维护 Workflow Session

不创建可变 `workflow session` 或 `session.json`：

- Vercel Workflow 自己保存 WorkflowRun、Step 状态、attempt 和重试事实。
- Groupher 保存不可变 `PreviewRecord`，只包含 owner、community、requested source、TTL 和预先固定的 `attemptRef`。
- `analysis-run.json` 是一次性关联记录，只保存 WorkflowRun ref；它不是可变状态容器。
- `attemptRef` 表示一次逻辑分析运行，`analyzeSource`、`validateTarget` 及各自的基础重试都使用同一 `attemptRef`。用户 reset/re-import 才创建新的 `previewRef/attemptRef`。
- Workflow 的稳定 Step identity 可用于构造幂等写入；技术重试不能创建一个需要和其他 retry 竞争的“获胜 attempt”。
- `ready.json` 位于当前 attempt 内，是完整 Preview 的最终完成凭证，不是根目录下选择获胜 attempt 的可变指针。
- 用户确认后 Phoenix ImportJob 保存 `previewRef/datasetRef` 关联；不回写一个不断变化的 Blob session。

Workflow 状态更新不会自动生成 Preview artifact。业务 Step 必须显式执行：

```text
previewStore.putDataset(...)
previewStore.putManifest(...)
previewStore.putReview(...)
previewStore.markReady(...)
```

任一写入失败都不能产生 ready marker。

### 5.3 对象布局

```text
content-import/previews/
|-- _preview-records/v1/{previewRef}.json  # canonical PreviewRecord catalog
`-- {previewRef}/
    |-- analysis-run.json
    `-- attempts/
        `-- {attemptRef}/
            |-- dataset/
            |   |-- manifest.json
            |   |-- analysis.json
            |   |-- tree.json
            |   |-- bodies/
            |   |-- bad-smells.json
            |   `-- optional-streams/     # future；首期不创建空目录
            |-- review/
            |   `-- target-preview.json
            `-- ready.json
```

`target-preview.json` 是 Phoenix 根据 SourceTree 和当前 Groupher 状态生成的 Review 结果，不属于只表达来源事实的 `DocsDataset`，因此放在 `review/`。`ready.json` 必须最后写，并至少绑定 `attemptRef`、`datasetManifestHash`、`targetPreviewHash` 和 `targetRevision`。`markReady` 的幂等语义固定为：对象不存在则创建；已存在且这些稳定字段完全相同则视为成功；已存在但内容不同则报告 invariant error。

`_preview-records/v1/{previewRef}.json` 同时是 PreviewRecord 的唯一事实源和 TTL sweeper 的独立枚举目录。旧 `{previewRef}/preview-record.json` 只作为迁移输入保留；回填失败可重试，按 ref 读取旧记录也会补写 canonical catalog record。

Files SDK 的统一 `upload()` 不承诺所有 provider 都有 conditional-create/CAS。首期通过固定 `attemptRef`、单个活动 Workflow run、content-addressed immutable shards 和 attempt-local ready receipt 避免业务依赖根指针 CAS；若某个 PreviewStore provider 仍需要严格 create-if-absent，只能在 PreviewStore 内通过 provider `raw`/原生条件写实现，不能泄漏到 Analyzer 或 Workflow 业务代码。

`PreviewStore` 是 Groupher 领域接口；Files SDK 是 Local、Vercel Private Blob、S3/R2 等 provider 的基础设施适配层。业务代码不能直接拼 provider object key。

## 6. 共享 Import Content

编辑器单篇导入、批量 Docs 和后续单篇来源同步共享唯一正文导入链：

```text
Source content
  -> safe Markdown/MDX
  -> shared Import Content
  -> Rich Editor AST
  -> artiment-publisher
  -> BodyBag
```

产品编排不同，但转换实现相同：

```text
Bulk Docs
  Repo -> DocsDataset -> selected sources[]
       -> map(shared Import Content)
       -> stage BodyBag batches
       -> atomic Docs tree apply

Single imported Doc sync
  ImportSourceMapping -> one source item
       -> shared Import Content
       -> stage one BodyBag
       -> update one Doc
```

实现时直接调用现有 server function，不能让 Node 通过 HTTP 调用自己的 `/api/artiment/import`，也不能在 `threads/docs` 下新增第二个 `publishBodyBags`/Markdown converter。

## 7. Import 和 PostgreSQL staging

用户确认后才创建 Phoenix ImportJob：

```text
ready DocsDataset
  -> selected external refs
  -> create ImportJob + JobItems
  -> convert selected items with shared Import Content
  -> stage fixed-limit BodyBag batches
  -> all importable selected items ready
  -> validate target revision under lock
  -> atomic Docs apply
  -> update ImportSourceMapping
  -> completed
```

staging 是数据库中的临时导入事实，不是 Elixir PayloadStore：

- JobItem 保存 externalRef、selection、typed metadata、sourceHash 和 content status。
- BodyBag 使用专用 PostgreSQL jsonb staging row，避免塞进无界 preview 字段。
- staging row 保存 Phoenix 在 `BodyBag.cast` 后对 canonical JSON 重新编码得到的权威 `body_size_bytes`。Node 自己计算未压缩 UTF-8 request bytes 只用于切批，不能把客户端声明的 size 当作数据库可信值。
- 首期容量常量写死为共享 publisher 已有的 `ARTIMENT_MAX_INPUT_BYTES = 2 MiB`（序列化 Plate value），以及 Bulk transport 的 `MAX_BATCH_COUNT = 4`、`MAX_BATCH_BYTES = 6 MiB`、`MAX_BODY_BAG_BYTES = 5 MiB`。不做运行时 provider 探测、容量协商、按环境自适应或自动放宽。
- `MAX_BATCH_BYTES` 计算完整 GraphQL request JSON 的未压缩 UTF-8 bytes；HTTP gzip、PostgreSQL TOAST 和 Blob at-rest compression 都不能用于放宽限制。
- 加入下一篇会超过 4 篇或 6 MiB 时，先提交当前批次；单篇未超过 5 MiB 但放不进当前批次时独立进入下一批。
- 单篇在转换时超过 2 MiB Plate input、生成后超过 5 MiB BodyBag，或触发其他单篇结构限制时，JobItem 记录稳定的 `content_too_large` 并显式跳过该 Page，其他可导入 Page 继续。两个字节上限约束不同阶段，不能只保留较大的 BodyBag 上限。apply 必须从 Review TargetTree 过滤掉被跳过的 Page，再校验树与有效 items 一致；结果返回 skipped count/sourceRef，不能静默遗漏。如果没有任何可导入 Page，则不执行 apply。
- trusted Node staging contract 允许提交 `{externalRef, bodyBag}` 或 allowlisted `{externalRef, skipped: content_too_large}`；普通转换错误不能伪装成 skip，skipped item 不创建 BodyBag staging row。
- 同一 `(job_id, external_ref)`、相同 body hash 重试视为成功；不同 hash 视为冲突。
- Docs 首期在全部可导入 item ready 后，对过滤后的 TargetTree 执行一次树级原子 apply。过滤时删除 skipped Page，并自底向上移除不再包含任何有效 Page 的空 Group/Tab，再重新校验 counts、route 唯一性和 item/tree 一致性。
- completed 后 staging 可在同一事务删除；failed 数据只短期保留用于基础诊断，复杂失败要求 reset/re-import。

通用层不承诺所有未来 Thread 都全 Job 原子：

- Docs coherent tree：Job-wide atomic apply。
- Changelog/Post root items：未来可采用 item/batch transaction。
- comments/reactions：独立 enrichment Job，不回滚已完成 root import。

## 8. ImportSourceMapping 与同步基线

### 8.1 作用

`ImportSourceMapping` 同时解决：

1. 外部 item 对应哪个 Groupher Thread。
2. 重复导入时更新已有内容，而不是创建重复内容。
3. 后续打开单篇文档时检查来源更新。
4. 为 future comments/reactions 找到已经导入的 root Thread。

GitHub Docs 示例：

```text
github.com/acme/product-docs
  externalRef = docs/getting-started.md
                     |
                     v
  threadRef   = doc_8fz21
```

建议字段语义：

```text
ImportSourceMapping
|-- connection_id
|-- thread
|-- external_ref
|-- thread_ref
|-- source_revision
|-- source_version
|-- source_hash
|-- groupher_hash
|-- source_updated_at
|-- last_checked_at
`-- last_imported_at
```

- `source_revision`：上次成功导入的来源快照，例如 Repo HEAD commit。
- `source_version`：上次成功导入的单 item 版本，例如 GitHub file blob SHA。
- `source_hash`：上次成功导入的标准化 Markdown/MDX hash，必须携带 normalization 版本，例如 `source-md-v1:<sha256>`。
- `groupher_hash`：上次成功 apply 后，根据实际落库的受同步管理字段计算的 hash，必须携带 projection 版本，例如 `doc-sync-v1:<sha256>`。
- `source_updated_at`：来源提供的更新时间，主要用于展示和辅助判断。
- `last_checked_at`：最近一次来源更新检查时间。

`source_revision/source_version/source_hash/source_updated_at` 表示上次成功 apply 的来源基线。普通“检查更新”只能更新 `last_checked_at` 或独立的短期 cache，不能提前覆盖这组基线；只有同步事务成功后才一起更新来源基线和 `groupher_hash`。

`groupher_hash` 必须由 Phoenix 在成功写入后计算，不能由 Node 预测。hash projection 至少覆盖正文 `body_hash` 和所有允许被单篇同步覆盖的字段；不能包含时间戳、数据库 ID 或其他非同步管理字段。projection/normalization 规则变化时升级前缀版本并显式重建基线，不能把算法变化误判成来源或用户编辑。

### 8.2 更新判断不是比较两个 updatedAt

本节描述未来单篇增量同步的三方 diff。当前完整 Repo 再次批量导入采用更粗的 source-wins：同一 Connection/Mapping 命中后复用原 Doc ref，在用户确认覆盖警告后更新受来源管理字段；未映射目标碰撞仍阻断。详细交互和本轮联调结论见 [`bulk_import.md`](./bulk_import.md) 与 [`import_error_handling.md`](./import_error_handling.md)。

同步采用三方基线：

```text
A = 上次成功导入的来源内容
B = 当前来源内容
C = 当前 Groupher 内容
```

```text
sourceChanged   = currentSourceHash   != mapping.source_hash
groupherChanged = currentGroupherHash != mapping.groupher_hash
```

| sourceChanged  | groupherChanged | 状态                 | 操作                           |
| -------------- | --------------- | -------------------- | ------------------------------ |
| false          | false           | 已同步               | 不显示同步按钮                 |
| true           | false           | 来源有更新           | 可直接同步                     |
| false          | true            | 只有 Groupher 被编辑 | 不需要同步                     |
| true           | true            | 双方都有修改         | 必须 Review diff，不能直接覆盖 |
| source missing | 任意            | 来源被删除或移动     | 提示重新批量 Review            |

`updatedAt` 不能单独作为覆盖依据：不同平台时钟与字段语义不同，本地自动写入也可能改变时间但不改变受同步管理内容。

### 8.3 GitHub Repo 文件

GitHub 首期使用：

- Repo commit SHA：固定整次批量分析快照，不用于判断每篇文件都发生了变化。
- File blob SHA：低成本判断具体文件内容是否变化。
- 规范化 Markdown hash：判断变化是否真正影响导入结果。
- path-filtered latest commit time：可作为 `sourceUpdatedAt` 展示，不作为唯一同步依据。

参考：GitHub [Repository Contents API](https://docs.github.com/en/rest/repos/contents) 返回 file `sha`；[Commits API](https://docs.github.com/en/rest/commits/commits) 支持按 `path` 筛选 commits。

### 8.4 单篇来源同步

单篇同步是同一 Content Import 的 `mode=single`，不是新的正文写入系统：

```text
ImportSourceMapping
  -> Node 读取一个 source item
  -> 构建 single-item DocsDataset
  -> shared Import Content
  -> PostgreSQL staging
  -> same Docs Writer
  -> update Doc + ImportSourceMapping
```

打开已导入文档时可以异步检查来源状态；检查不能阻塞文档打开，并应对 GitHub rate limit 使用短 TTL cache。首期批量导入不实现该按钮，但当前 schema 必须保存同步基线，避免后续迁移历史数据。

单篇同步只更新正文、标题和明确受来源管理的 metadata；导航树、Tab/Group、路径移动、slug 冲突和来源删除仍进入完整批量 Review。

## 9. Node 目录结构

首期 server-only 模块继续留在 Dashboard，后续出现第二个 Next.js host 时再提取 package：

```text
frontend/dashboard/src/
|-- lib/
|   `-- content-import/
|       |-- core/
|       |   |-- contracts/
|       |   |   |-- threadDataset.ts
|       |   |   |-- artifactRef.ts
|       |   |   `-- badSmell.ts
|       |   |-- preview-store/
|       |   |   |-- previewStore.ts
|       |   |   |-- filesPreviewStore.ts
|       |   |   |-- localPreviewStore.ts
|       |   |   `-- index.ts
|       |   `-- errors.ts
|       |-- platforms/
|       |   `-- github/
|       |       |-- client.ts
|       |       `-- repo/
|       |           |-- source.ts
|       |           `-- workspace/
|       |               |-- archiveDownloader.ts
|       |               |-- archiveExtractor.ts
|       |               |-- candidateFilter.ts
|       |               `-- temporaryWorkspace.ts
|       |-- threads/
|       |   `-- docs/
|       |       |-- contracts/
|       |       |   |-- docsDataset.ts
|       |       |   |-- sourceTree.ts
|       |       |   `-- sourceAnalysis.ts
|       |       |-- analyzer/
|       |       |   |-- frameworks/
|       |       |   |-- detectFramework.ts
|       |       |   |-- documentFile.ts
|       |       |   `-- index.ts
|       |       |-- buildDataset.ts
|       |       `-- selection.ts
|       `-- transport/
|           `-- phoenix/
|               `-- docsImport.ts
`-- workflows/
    `-- content-import/
        `-- docs/
            |-- analyzeGitHubRepo.ts
            `-- applyDocsDataset.ts
```

`transport/phoenix/docsImport.ts` 首期同时封装 trusted GraphQL request 和 Docs import operations：

```text
createDocsImportJob
stageDocsImportBodies
applyDocsImport
getDocsImportJob
```

现在不单独创建只有一个消费者的 `client.ts`；第二个 Thread importer 出现后再抽通用 Phoenix client。

不创建 Notion、Google、Linear、Changelog、Post、comments、reactions、actors 等空目录。

## 10. Phoenix 目录结构

```text
backend/api/lib/groupher_server/cms/content_import/
|-- jobs.ex
|-- staging.ex
|-- import_source_mapping.ex
|-- persistence/
|   |-- connection.ex
|   |-- job.ex
|   |-- job/
|   |   `-- item.ex
|   `-- import_source_mapping.ex
`-- threads/
    `-- doc/
        |-- validator.ex
        `-- writer.ex
```

首期 Phoenix 不需要 `PlatformAdapter`、`ThreadAdapter`、通用 plugin registry 或动态 dispatcher。目录边界为未来 `threads/changelog`、`threads/post` 留出位置即可，等真正实现第二个 Writer 时再抽 behaviour。

文件职责固定为：

- `jobs.ex`：Job 创建、状态机、idempotency、进度、失败摘要和完成/取消控制。
- `staging.ex`：BodyBag schema/hash/字节校验、按 JobItem 幂等写入、completeness 判断和 staging 清理。
- `threads/doc/validator.ex`：只读地把 SourceTree 映射为用户 Review 过的 TargetTree/conflicts/targetRevision。
- `threads/doc/writer.ex`：在目标 revision lock 和同一事务内写 Docs Draft/Tree、ImportSourceMapping 与 Job completion。
- `import_source_mapping.ex`：维护上次成功同步基线，不保存某一次冲突的 `resolution`；冲突决策属于 JobItem。

未来 conflict resolver UI 中，`suggestedName` 是 TargetPreview 的临时建议，用户确认后的 `resolvedName` 只进入本次 ImportIntent/Job。apply 后实际名称由 TargetTree/Docs DB 保存。若完整 re-import 需要长期记住 Tab/Group 的来源结构重命名，再增加 connection-scoped structure override；Page 级 `ImportSourceMapping` 和一次 Job 的 resolution 都不能冒充结构映射。

目标重构删除或收缩：

```text
content_import/platforms/**
content_import/platform_adapter.ex
content_import/workspace.ex
content_import/snapshot.ex
content_import/snapshot/**
content_import/persistence/snapshot.ex
content_import/plan.ex
content_import/plan/**
content_import/checkpoints.ex
content_import/payload_store.ex
content_import/payload_store/**
content_import/threads/doc/frameworks/**
content_import/threads/doc/preparation/**
content_import/threads/changelog/**
content_import/asset_stager/**
```

保留的 Phoenix 核心是 Connection、ImportJob、JobItem/staging、Docs Validator/Writer 和 ImportSourceMapping。

本次 cutover 不迁移历史 ContentImport 数据：旧 Snapshot、Preparation、Plan、Job/JobItem/JobAsset、PayloadStore 文件、旧 Preview session 和旧 ImportSourceMapping 可以直接删除。现有 Docs 正文保留，但不 backfill 来源关联；后续按全新导入处理。不实现旧 schema decoder、双读、双写、fallback、兼容 accessor 或过渡数据迁移。

## 11. comments、reactions 与 actor 扩展点

首期不实现 user 导入。架构只要求：

- root、comment、reply 和 reaction 都可以引用稳定 `sourceActorRef`。
- actors/comments/replies/reactions 可以作为独立 paginated Dataset stream。
- Source Adapter 通过 capability probe 声明支持范围。
- comments/reactions 使用独立 enrichment Job，不因第 37 页失败回滚已经完成的 root Thread。
- `ImportSourceMapping` 能把 future comment stream 关联到已导入 root Thread。

未来实现 actor 时，外部身份不能只用 `platform + login` 唯一化；需要稳定的 `platform + platformScope + platformUserId`。login、avatar 和 profile URL 只作为可变展示信息。该 DB/OAuth 设计不属于首期实现。

## 12. 首期实现范围

只实现以下实线链路：

```text
GitHub Repo
  -> GitHub Repo Source
  -> Docs Analyzer
  -> DocsDataset
  -> PreviewStore / Files SDK
  -> Review
  -> shared Import Content
  -> PostgreSQL staging
  -> Docs Writer
  -> Docs Draft + Tree
  -> ImportSourceMapping
```

首期明确不实现：

- Notion、Google Docs、Linear、Discourse、Flarum、CSV adapter。
- `ChangelogDataset`、`PostDataset` 和对应 Writer。
- comments/replies/reactions 导入。
- 导入 user、ExternalIdentity 或 OAuth claim。
- 单篇来源同步 UI。
- 图片/附件复制和公共 upload。
- 私有 GitHub Repo、浏览器直传和 signed upload URL。
- 通用插件系统、复杂 checkpoint/resume、asset claim/lease/retry。

扩展性来自稳定 contract、目录和持久同步基线，不来自提前实现未使用的抽象。

## 13. 重试与失败原则

- GitHub/Files SDK/Workflow 使用有限次数的基础网络重试。
- stage batch 依赖 idempotency，允许相同 hash 的安全重放。
- apply 事务失败时最终 Docs 和 `ImportSourceMapping` 一起回滚。
- Phoenix 可以对明显暂时性的 DB 失败做基础重试；Node 不承担 apply 后的复杂恢复编排。
- 遇到无法安全自动恢复的状态，Job 标记 failed，用户 reset 后重新导入。
- 不为首期增加多个 cursor、resume token、lease、checkpoint 和部分 item 恢复状态。

## 14. Files SDK 能力边界

当前 GitHub URL 导入只需要 Node 服务端 `upload/download/list/delete`。浏览器不直传，因此不需要 `signedUploadUrl()`。

首期生产使用 Vercel Private Blob；未来公共资源上传或 provider 变化可在 PreviewStore 下切换 S3/R2 adapter，但不能假设所有 Files SDK adapter 都具有相同的 signed URL、CAS、metadata 或 overwrite 能力。

业务 contract 不要求跨 provider 的根指针 CAS；严格 conditional-create 只在 PreviewStore 基础设施层按 provider 能力实现。当前 GitHub Docs 导入仍只需要 Node 服务端 private `upload/download/list/delete`。

详细对象布局、TTL、清理顺序和 provider 配置以 [`import_file_sdk.md`](./import_file_sdk.md) 为准。
