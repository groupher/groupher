# ContentImport 重构与落地计划

> 状态：2026-07-22 目标重构已完成本地直接切换。本文后半部分保留旧 Snapshot/Plan/PayloadStore 实施记录，仅作为迁移证据，不再是目标架构；生产 Private Blob、固定公开仓库 Browser E2E 与全局分析 admission 仍待部署验收。
>
> 范围：按最终 Node/Phoenix 边界整理目录并完成公开 GitHub Repo → Docs 的首个垂直切片。
>
> Source of truth：跨来源架构、公共命名、目录目标和 Node/Phoenix 职责以 [`content_import_architecture.md`](./content_import_architecture.md) 为准；Files SDK/staging 以 [`import_file_sdk.md`](./import_file_sdk.md) 为准；产品流程以 [`bulk_import.md`](./bulk_import.md) 为准；共享 Import Content/BodyBag 以 [`article_publish_import_refactor.md`](./article_publish_import_refactor.md) 为准；本轮联调与错误恢复见 [`import_error_handling.md`](./import_error_handling.md)。
>
> 更新：2026-07-22

## 零、2026-07-22 目标重构

### 0.1 最终边界

```text
Next.js Node
  GitHub Repo Source
    -> temporary workspace
    -> Docs Analyzer
    -> DocsDataset / PreviewStore / Files SDK
    -> shared Import Content
    -> bounded BodyBag batches

Phoenix
  ImportJob
    -> PostgreSQL staging
    -> Docs Validator
    -> Docs Writer transaction
    -> Docs Draft/Tree + ImportSourceMapping
```

本轮只实现 GitHub + Docs，不实现 Changelog/Post、Notion/Google/Linear、comments/reactions、导入 user、公共资源上传或通用 plugin registry。

### 0.2 Node 目标目录

```text
frontend/dashboard/src/
|-- lib/content-import/
|   |-- core/contracts/
|   |-- core/preview-store/
|   |-- platforms/github/repo/
|   |-- threads/docs/
|   `-- transport/phoenix/docsImport.ts
`-- workflows/content-import/docs/
    |-- analyzeGitHubRepo.ts
    `-- applyDocsDataset.ts
```

- `core/contracts` 首期只落地 `ThreadDataset` header、`DocsDataset`、`ArtifactRef` 和 `TBadSmell`。
- `platforms/github/repo` 只负责 GitHub client、archive 和 source workspace，不理解 Groupher Docs 写入。
- `threads/docs` 负责 framework、tree、selection 和 Dataset，不生成第二套 BodyBag。
- BodyBag 生成直接复用现有 Import Content/document-importer/artiment-publisher。
- `transport/phoenix/docsImport.ts` 首期同时封装 trusted request 和 create/stage/apply/get operations，不提前拆只有一个消费者的通用 client。
- 不创建尚未实现的 Platform、Thread、comments、reactions 或 actors 空目录。

### 0.3 Phoenix 目标目录

```text
backend/main/lib/groupher_server/cms/content_import/
|-- jobs.ex
|-- staging.ex
|-- import_source_mapping.ex
|-- persistence/
|   |-- connection.ex
|   |-- job.ex
|   |-- job/item.ex
|   `-- import_source_mapping.ex
`-- threads/doc/
    |-- validator.ex
    `-- writer.ex
```

目标保留：

- Connection、ImportJob、JobItem/BodyBag staging。
- Docs target revision/intent 验证。
- Docs Draft/Tree、ImportSourceMapping 和 Job completion 的同事务写入。
- 基础 idempotency、状态、进度和错误摘要。

目标文件职责：

- `jobs.ex`：创建 Job、状态迁移、进度和完成/失败摘要；不保存或解析来源正文。
- `staging.ex`：按 `(job_id, external_ref)` 幂等接收 BodyBag，在 `BodyBag.cast` 后 canonical encode，执行单项 5 MiB、batch count 和 Job 状态校验并保存权威 `body_size_bytes`；不信任客户端 size，也不增加动态单 Job 容量策略。
- `threads/doc/validator.ex`：Review 阶段根据 SourceTree 与当前目标状态生成 TargetTree/conflicts/targetRevision；创建 Job 和 apply 只验证用户已确认的 intent/revision，不重新分析来源 framework，也不静默重新规划。
- `threads/doc/writer.ex`：在一个事务内写 Docs Draft/Tree、ImportSourceMapping，并完成 Job。
- `import_source_mapping.ex`：维护来源项与 Groupher 文档之间的同步基线；冲突的本次处理选择属于 JobItem，不写入长期 Mapping。

目标删除：

- Phoenix PlatformAdapter、GitHub client 和 archive workspace。
- Snapshot、Preparation、Plan、Checkpoints 和 PayloadStore。
- Elixir Docs framework/config/Markdown analyzer。
- 当前未被首期使用的 Changelog、AssetStager、claim/lease/retry 框架。
- 为复杂恢复准备的多 checkpoint/cursor 状态；失败采用 bounded retry 后 failed + user reset/re-import。

### 0.4 ImportSourceMapping

旧 `Mapping` 目标命名统一改为 `ImportSourceMapping`：

```text
connection_id
thread
external_ref
thread_ref
source_revision
source_version
source_hash
groupher_hash
source_updated_at
last_checked_at
last_imported_at
```

`source_hash` 是上次成功导入的标准化来源 hash；首版格式固定为 `source-md-v1:<sha256>`。`groupher_hash` 是 Phoenix 成功 apply 后根据实际落库字段计算的 Groupher 同步基线；首版格式固定为 `doc-sync-v1:<sha256>`。版本前缀是 hash contract 的一部分，canonicalization 变化时必须 bump，不能静默沿用旧 hash。

`groupher_hash` 的输入是明确、稳定的同步投影，例如正文 `body_hash` 加上由导入链管理的 title/slug 等字段；不能包含数据库 id、`inserted_at`、`updated_at` 或其他每次写入都会变化的字段。后续单篇来源检查比较：

```text
sourceChanged   = currentSourceHash   != mapping.source_hash
groupherChanged = currentGroupherHash != mapping.groupher_hash
```

双方都变更时必须 Review，不能按时间戳直接覆盖。GitHub Repo commit 只固定批量快照；单文件更新使用 blob SHA、规范化 source hash，并把 path latest commit time 作为展示信息。

### 0.5 实施任务（已完成）

1. 冻结 `ThreadDataset/DocsDataset/TBadSmell/ImportSourceMapping`、Preview 对象布局、固定 `attemptRef`、ready binding、versioned hash，以及写死的 `2 MiB Plate input / 4 篇 / 6 MiB request / 5 MiB BodyBag` 容量 contract。
2. 在现有 `PreviewStore` 后接入 Files SDK：写 immutable attempt-scoped Dataset、write-once `analysis-run.json` 和 attempt-local `ready.json`；不维护 Workflow Session，也不依赖根目录 winner pointer 的 CAS。
3. 将 Workflow 固定拆为 `analyzeSource` 与 `validateTarget` 两个 Step；target validation/review write 失败只重试后者。若 `analyzeSource` 在最大 archive 下仍超出 Function 边界，再以筛选后的 `SourceWorkspaceRef` 进一步拆分。
4. 将 Phoenix BodyBag staging 切到 PostgreSQL。Node 只按固定常量和未压缩 UTF-8 bytes 转换/切批；Phoenix canonical encode 后生成权威 `body_size_bytes`。单篇超过 2 MiB Plate input 或 5 MiB BodyBag 时显式跳过并过滤 TargetTree，普通转换错误仍阻止 apply。
5. 把现有 `docs-import`、`bulk-import` 和 workflows 收敛到目标 Node 目录，不改产品 API；让 Bulk Publisher 直接复用已有 Import Content server function，不重写七类 analyzer，也不新增平行 Markdown/BodyBag 转换入口。
6. 将 Phoenix create/stage/apply 收缩到 ImportJob、PostgreSQL staging、Doc Validator/Writer 和 ImportSourceMapping。
7. 验证公开 GitHub Repo → Review → staged BodyBags → atomic Docs Draft/Tree → ImportSourceMapping 的完整链路，以及大 archive 和固定 BodyBag/request 容量边界。
8. 在新链路覆盖重试、回滚和恢复路径后，直接删除 Phoenix Snapshot/Preparation/Plan/PayloadStore、来源解析、Changelog/AssetStager 首期死路径及相关数据、文件、测试和配置；不做历史迁移、backfill、dual read/write、旧 decoder、fallback 或兼容 accessor。
9. 验证 temp cleanup、Preview TTL、same-hash batch idempotency、target revision conflict、事务 rollback 和 completed cleanup。

### 0.5.1 旧模块删除清单

这次按直接 cutover 处理旧实现。旧数据没有保留价值，现有 Docs 正文继续保留；旧导入记录、payload 文件和来源关联可以删除，未来需要时由用户重新导入生成。

| 旧模块/路径                                       | 当前作用                                    | 目标替代                                                            | 删除门槛                                                         |
| ------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Checkpoints` / `PayloadStore`                    | 当前 Bulk start/get/apply 的 payload bridge | Files SDK `PreviewStore` + PostgreSQL BodyBag staging               | 新链路 E2E、重试和回滚通过后，连同历史 payload 数据/文件直接删除 |
| `Orchestrator`                                    | 旧 Job lifecycle、plan/apply 编排           | 收敛到 `jobs.ex` + thread `writer.ex`                               | 先迁移仍有效的状态机/事务测试，再删除模块；不保留 wrapper        |
| `ThreadAdapter` / `Threads.Doc` 旧 plan/apply     | Phoenix 重复规划和旧 typed payload apply    | `threads/doc/validator.ex` + `threads/doc/writer.ex`                | Validator/Writer parity 和 atomic apply 测试通过后删除           |
| `PlatformAdapter`、GitHub Repo/ZIP `start_github` | Phoenix 来源拉取/解析入口                   | Dashboard Node Source Adapter + Workflow                            | 审计生产调用方为零后直接删除；不提供 fallback                    |
| `AssetStager`、claim/lease/retry                  | 旧资源下载基础设施，Bulk v1 不使用          | 首版无替代；未来资源导入单独设计                                    | 确认无生产调用方后直接删除                                       |
| Changelog/Releases 旧导入路径                     | 未接入生产的 deferred 验证路径              | 未来 Changelog slice 复用 `ThreadDataset`/ImportJob/Writer contract | 当前模块和测试直接删除，未来按新架构实现，不保留半成品           |

数据库层同样不做兼容：旧 Snapshot/Preparation/Plan/Job/JobItem/JobAsset/PayloadStore/Preview Session rows 直接清理，只服务它们的 table/column/locator 随代码一起 drop；不写数据搬运 migration。

### 0.5.2 2026-07-22 本地实施结果

目标切换已按“不兼容旧导入数据”的约束直接落地：

1. Dashboard 目录已收敛到 `lib/content-import/{core,platforms,threads,transport}` 与 `workflows/content-import/docs`；七类 framework fixture 归 Node analyzer 测试所有，不再依赖 Elixir analyzer 代码。
2. `PreviewStore` 已切到 Files SDK，使用不可变 `preview-record.json`、write-once `analysis-run.json`、固定 `attemptRef`、attempt-scoped Dataset/Review 与最后写入的 `ready.json`。local/test 使用 fs adapter，生产使用 private Vercel Blob adapter，生产缺失配置时不回退本地磁盘。
3. Workflow 已固定为 `analyzeSource` 与 `validateTarget` 两个 durable Step；来源正文从 PreviewStore 有界并行读取，目标验证失败不会重新下载和分析仓库。
4. 共享 Import Content publisher 已落实 `2 MiB Plate input / 4 篇 / 6 MiB request / 5 MiB canonical BodyBag` 固定边界；只有稳定的 `content_too_large` 可以跳过，普通转换错误使 Job 失败。
5. Phoenix 已收缩为 `Jobs`、`Staging`、`Doc.Validator`、`Doc.Writer` 与 `ImportSourceMapping`。BodyBag 分行写入 `content_import_job_bodies`，同 hash batch 和 completed apply 可幂等重放；target revision 冲突在事务内回滚且不消费 staging。
6. 旧 Snapshot/Preparation/Plan/Checkpoints/PayloadStore、Phoenix 来源解析、Changelog/AssetStager 和旧 schema/test 路径已直接删除；新 migration drop 旧表并创建新的 Job/Item/Body/ImportSourceMapping 表，不 backfill、不 dual read/write，`down` 明确不可逆。
7. 本地验证已覆盖 Files SDK immutable write、七类 analyzer fixtures、publisher/stage 容量、skip allowlist、Job intent binding、atomic apply、Mapping、completed replay 和 revision conflict。

仍未完成：生产 Vercel Private Blob 配置与私有访问 smoke、固定公开仓库 Browser → Node → Phoenix → DB E2E、全局活动分析 admission、主动 sweeper 调度以及部署环境耗时/字节/清理指标。它们属于 release/deployment gate，不恢复旧链路。

### 0.6 历史实现说明

下面“完成状态”以及原一至十章记录的是旧通用 ContentImport 方案及已存在代码。它可以帮助定位待删除/迁移文件，但其中以下结论已经失效：

- Phoenix 保存 Snapshot/Preparation/Plan/PayloadStore。
- Phoenix PlatformAdapter/ThreadAdapter 是长期公共 contract。
- GitHub Releases → Changelog 是首期复用验证任务。
- AssetStager、claim/lease/retry 属于首期保留基础设施。
- `Mapping/last_imported_local_hash` 是目标命名。
- Groupher 维护 Preview Session。

发生冲突时必须以前文 0.x 和 `content_import_architecture.md` 为准，不能根据旧 checklist 恢复被删除的双路径。

## 历史实施快照

### 完成状态

| 范围                                                  | 状态                               | Bulk Import v1 使用情况                                                                              | 说明                                                                                                                         |
| ----------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Namespace、typed contracts、Snapshot/Preparation/Plan | 已完成                             | 复用共享 contract                                                                                    | 旧 `CMS.DocImport` 已完成无兼容层 cutover                                                                                    |
| Persistence、Job、Mapping、Diff、checkpoint           | 已完成基础实现                     | 使用 Job/Mapping/atomic apply；新来源 create，同一来源再次全量导入复用 Mapping 并 source-wins update | 逐篇 `source_updated/local_updated/conflict/source_deleted` 属于后续增量 re-sync，不是 Bulk v1 release gate                  |
| AssetStager、Job.Asset lifecycle                      | 已完成基础实现                     | 不使用                                                                                               | Bulk v1 不复制图片或附件；未来资源导入再激活 downloader/claim/lease/retry                                                    |
| Docs 正文转换与 apply                                 | 当前 GitHub 路径已接通             | 使用                                                                                                 | Dashboard Node Publisher 生成 BodyBag 后 bounded BodyBag staging + atomic apply；目标 PreviewRecord/DocsDataset 边界仍待迁移 |
| Changelog 正文转换与 apply                            | Deferred                           | 不使用                                                                                               | GitHub Releases 的 Snapshot/Plan 仍保留，等待 Node publisher 接线                                                            |
| GraphQL 与 Dashboard 导入流程                         | 当前路径已接通，目标存储边界待迁移 | 已拆分 Preview/Job 边界                                                                              | Review 使用 `previewRef`，确认后才创建 `jobRef`；待改为 immutable PreviewRecord/attempt layout                               |
| Docs framework analyzer                               | 已切换目标生产入口                 | 七类 adapter 已有基础 fixture golden parity                                                          | GitHub Bulk Import 只进入 Node/TS analyzer；待补复杂变体、固定公开仓库与端到端基线，不重写 adapter                           |

上表记录的是切换前的历史状态，不能用来判断当前目标架构是否完成。当前本地实施结果以前文 0.5.2 为准；复杂 analyzer 变体、固定公开仓库与部署环境端到端验证仍未完成。

本文后续完成项记录 Phoenix ContentImport 基线和历史落地状态。涉及 file-based Docs 来源分析的未来归属时，以上述边界更新和 `bulk_import.md` 为准，不能从旧 checklist 推导出继续维护 Elixir/Node 双 analyzer。

### 当前实施快照

#### Persistence

- 已完成 ContentImport typed contract、canonical hash、Snapshot manifest、旧 `CMS.DocImport` 无兼容层 cutover。
- 已完成领域 `Diff`、`Persistence.*` Ecto schema、基础 migration、Job/Job.Item/Job.Asset 状态约束和有界 staging batch runner。Bulk v1 只使用首次导入所需的 `new` Diff 结果，不把 re-sync 高级状态作为产品验收项。
- 已完成 `PayloadStore` contract、Snapshot/Preparation/Plan versioned codec，以及 `start Job → attach Preparation → attach Plan` 的可恢复 checkpoint 链路；数据库只保存 locator 与 bounded summary。
- 已完成 Repo Job transition、`FOR UPDATE SKIP LOCKED` asset claim/lease、过期 lease 重领、cancel/retry，以及 thread write、Mapping、source-deleted resolution、Job completion 的单事务提交。
- 已完成服务端 canonical idempotency key、逐项选择/resolution 和 plan 前 Job 幂等复用；显式 `run_nonce` 可创建新的人工重跑。

#### Orchestrator 与 Thread Adapter

- 已完成 Snapshot-bound `Threads.Doc.Preparation`，调用方不再分别传入可能错配的 Snapshot 与 SourceTree。
- 已保留 `Threads.Doc.apply_in_transaction/3` 的 Preview Branch、Draft/Tree 原子写入、dry-run、逐项决策与显式 asset resolver 基础设施；当前 GitHub Bulk Import 在 Node Publisher 完成 BodyBag staging 后进入该路径。
- 已完成 Doc/Changelog 的 thread-specific `PlanPayload/ItemPayload` 与安全 `PreviewPayload/ItemPreview` 投影；aggregate/item schema 都按 thread 校验，私有 normalized body 不进入 Preview。
- GitHub Releases → Changelog 已完成 Snapshot/Plan/Mapping/Diff 等共享基础设施验证；release 正文转换与 Draft apply 同样 deferred。

#### Platform 与来源分析

- 已完成 Workspace、ZIP、GitHub Repo adapter，以及 ZIP Snapshot → Docs Plan integration。
- 已删除 Elixir Markdown/MDX → Plate 的 `MarkdownNormalizer`/`ContentNormalizer` 和 Earmark；基础 Plan item 初始正文状态为 `deferred`。当前 GitHub Bulk Import 在用户确认后由 Dashboard Node Publisher 补齐 BodyBag，Changelog 仍保持 deferred。

#### Dashboard / Node 与切换前剩余迁移

- Dashboard 已有 archive downloader、Vercel Workflow、七类 Node framework analyzer 和 BodyBag Publisher；本轮只整理目录与存储边界，不重写已存在的 analyzer。
- 切换前 `PreviewStore` 使用原生 Local/Vercel Blob 能力并保存可变运行记录；该路径已由 Files SDK 与 immutable `PreviewRecord + analysis-run + attempt-local ready` 布局替代。
- 切换前 Bulk v1 只做按数量有界的 BodyBag staging；当前已落实每批最多 4 篇、完整 GraphQL request JSON 最多 6 MiB、单篇 canonical BodyBag JSON 最多 5 MiB，并由 Phoenix 生成权威 `body_size_bytes`，不经过 `AssetStager`。
- ContentImport、BodyBag、Comment/Mention 和 Docs template 的 Phase 4 focused suite 当前为 `136 tests, 0 failures`；测试环境已正常加载基础 migration。
- 这一节的 Files SDK/immutable Preview、PostgreSQL BodyBag staging 与 Phoenix 简化缺口已经完成；仍未完成的是全局活动分析 admission、生产 Private Blob 和真实公开仓库浏览器联调。

---

## 历史方案：一、结论（已被第零章取代）

导入能力最终统一在 `GroupherServer.CMS.ContentImport` 下，不再为每个 thread 建一套平行的 `DocImport`、`ChangelogImport`、`PostImport`。

下面的图只保留旧通用 ContentImport/Phoenix 基线，适用于理解待删除代码；它不是 GitHub Bulk Import 的目标时序。目标 GitHub 流程在用户 Review 前只有 Workflow + immutable PreviewRecord/DocsDataset，确认后才进入 Phoenix Job。

外部平台差异和 Groupher thread 差异分两层处理；进入正式导入后，中间生命周期由持久化 Job 管理：

```text
GitHub / Notion / Sanity / ZIP
              |
              v
      PlatformAdapter
              |
              v
       Snapshot + Entry[]
              |
              v
     Job(:planning) + checkpoint
              |
              v
 [Docs: Preparation]
              |
              v
       ThreadAdapter.plan
              |
              v
 Plan + Job.Item[](content=deferred)
              |
              v
      [等待 converter + Node publisher]
```

- `PlatformAdapter` 负责连接外部平台、鉴权、分页、限流、获取内容和生成稳定的来源身份。
- `ThreadAdapter` 负责把通用来源内容规划到 `doc`、`changelog`、`post` 等 Groupher thread，并在 orchestrator 已开启的事务中执行 thread write。
- `Preparation` 是 Docs 私有的 Snapshot-bound parser checkpoint，不属于 PlatformAdapter 公共 contract；Changelog 等 API 型 thread 可以跳过。
- `Persistence.Job` 管理可恢复状态与 locator，完整 Snapshot/Preparation/Plan payload 不直接写入 Job JSON。
- 现有 VitePress、Rspress、Nextra 等 Elixir 代码解析的是 docs framework，不是外部平台；它们当前位于 `ContentImport.Threads.Doc.Frameworks` 并被现有路径使用，迁移后由 Node/TS Source Analyzer 取代。
- 所有导入先进入 Draft 或 Preview Branch；`ContentImport` 不直接发布 public 内容。
- 首次导入与后续同步共享同一套 `Snapshot`、`Mapping` 和 `Diff`，避免未来为了“检查平台更新”重做数据模型。
- 基础 Plan 的 `deferred` item 不能直接 apply；当前 GitHub Bulk Import 已通过确认后的 Node Publisher staging 补齐 BodyBag，目标方案继续保留“全部 BodyBag ready 后才 atomic apply”的边界。

---

## 历史方案：二、范围与非目标

### 本轮范围

1. 合并现有 `CMS.DocImport`，保留已经完成的 framework 语义、导航规划、fixture 和 golden 作为 Node 迁移基线，不在生产长期维护双实现。
2. 建立通用 `PlatformAdapter`、`ThreadAdapter`、`Entry`、`Snapshot`、`Job`、`Mapping`、`Diff` 边界。
3. 打通一个完整的 Docs 导入链路。
4. 打通 GitHub Releases → Changelog Draft，验证同一套基础设施可服务不同 thread。
5. 为外部来源更新检查、重新同步和冲突提示保留完整身份与版本信息。

### 非目标

- 不在导入流程中自动发布内容。
- 不做 Groupher → 外部平台的双向写回。
- 不把 `SearchArticles` 纳入本次重构；搜索只消费导入并发布后的 public 内容。
- 不在第一阶段同时接完 Notion、Sanity、GitHub Discussions 等所有平台。
- 不把平台 SDK 或平台特有字段泄漏到 `Threads.Doc`、`Threads.Changelog` 等目标实现。

---

## 历史方案：三、当前实现盘点

### 3.1 启动前已实现、现已合并保留

#### Framework detection 与 facade

- `GroupherServer.CMS.ContentImport.Threads.Doc.detect/1`
- `GroupherServer.CMS.ContentImport.Threads.Doc.parse_tree/1`
- 旧 `CMS.DocImport` 已删除，无 compatibility facade。
- local directory extraction 保留为 Doc 内部能力；ZIP/GitHub Repository 先生成 Snapshot，再通过只读 Workspace 复用同一解析器。

#### 已支持的 docs framework

- Docusaurus
- Fumadocs
- MkDocs
- Nextra
- Rspress
- Starlight
- VitePress

#### 已实现的中间结构与规划

- `SourceTree`
  - 保存 provider-neutral 的 `scope / section / page / link`。
  - 保留任意层级，不提前强行映射成 Groupher tab/group。
  - 不包含 Groupher `node_id` 或 `doc_id`。
- `NavigationPlanner`
  - `scope` → tab。
  - scope 直属 page/link → 自动生成用户可见的 `Untitled` group。
  - 当前内部稳定 `sourceId` 仍保留 `:overview` 后缀以避免破坏既有 identity/mapping；它不是用户可见 Group 标题，后续如需改名必须走 schema/version migration。
  - section → group。
  - 深层 section → 保留 `sourceId` 后展平为同级 group。
- `Threads.Doc.Plan` + typed `ContentImport.Plan`
  - 明确目标为 `thread=doc` 的 Preview Branch。
  - 为每个 source page 生成稳定于当前 plan 的随机 Article identity。
  - 将同一 identity 写入 document 与 tree node 的 `docId`。
  - 从传入 Mapping 复用已存在的 target ref；新内容只在 plan 阶段预分配 Article identity。
  - 正文当前生成显式 `deferred` 状态和稳定 diagnostic，不携带私有 normalized body。
  - 资源发现与最终 asset manifest 等待新的 converter/publisher 方案；当前生成 Plan 不创建待 staging asset。
  - 当前不会写 Draft、public、Snapshot 或 PublishRelease。

#### 已实现的辅助能力

- `Diagnostic`：稳定的 error/warning 结构。
- `DocumentFile`：Markdown/MDX 文件、frontmatter、标题、route 处理。
- `StaticConfig`：静态读取 TS/JS 配置，不执行用户代码。
- `SourceSidebar`：将不同 sidebar 表达转换为 `SourceTree`。
- `RspressAutoNavigation`：解析 `_nav.json`、`_meta.json`、i18n label 和自动导航。

#### 已实现的测试资产

- 7 个 framework 的 fixture。
- VitePress、Rspress、Nextra 的 golden `expected/tree.json`。
- framework detection 测试。
- dynamic config 拒绝测试，确保不执行来源项目代码。
- 缺失 page/folder diagnostic 测试。
- `DocumentFile` 测试。
- `NavigationPlanner` 测试。
- `ImportPlan` Preview Branch 与 identity 绑定测试。

### 3.2 本轮已新增

- 通用 `ContentImport` facade、`PlatformAdapter`/`ThreadAdapter` contract 与 typed domain structs。
- Entry canonical hash、Snapshot manifest hash 和 revision 层级语义。
- ZIP/GitHub Repository fetch、只读 Workspace 和安全/体积限制。
- `Persistence.Connection/Job/Job.Item/Job.Asset/Snapshot/Mapping` schema 与 migration。
- `Diff` 的 `new/in_sync/source_updated/local_updated/conflict/source_deleted` 派生逻辑；Bulk v1 正常只消费 `new`，其余状态为后续 re-sync 基础设施。
- 单 Job 有界 AssetStager batch runner；Bulk v1 不下载图片/附件，因此不进入这条 lifecycle。
- Repo `Orchestrator` 的 Job command、asset claim/lease/retry/cancel 与原子 `apply_job` 闭环。
- Snapshot/Preparation/Plan codecs、`PayloadStore` contract、`Checkpoints` 和 canonical `IdempotencyKey`。
- Docs Preview Branch 的原子 apply、稳定 Article identity、资源替换与失败回滚基础设施；生成 Plan 因正文 `deferred` 不进入 apply。
- GitHub Releases → Changelog 的 plan、Snapshot/Mapping/Diff 与重复同步基础设施；正文转换和 Draft apply deferred。

### 3.3 仍未实现

- 私有平台 credential locator → execution credential 的真实 resolver。
- AssetStager 的安全 downloader、staging storage、全局/单 host admission，以及真实 worker recovery loop。
- Job 与 staging payload 的保留/清理策略。
- `Orchestrator.apply_job/7` 已串起 Preview/Draft 写入、Mapping、source-deleted resolution 和 Job completion；仍缺真实 asset publisher/外部对象补偿。
- GraphQL query/mutation。
- Dashboard 通用导入界面。
- Docs import 页面目前仍是占位内容。
- Docs 编辑器中的 import button 目前没有接入动作。
- Changelog CMS 尚无平台导入入口。
- document-converter/Node publisher 尚未接入批量 ContentImport，因此没有可 apply 的 Docs/Changelog 正文计划。

### 3.4 当前调用范围

启动时 `CMS.DocImport` 只在自身模块与测试中出现，因此已直接完成 namespace cutover。当前 ContentImport 的 persistence/orchestrator 已由定向 DataCase 覆盖，但仍没有生产 GraphQL/API 调用者和真实常驻 worker。

---

## 历史方案：四、旧目标模块结构

```text
GroupherServer.CMS.ContentImport
|-- Entry
|-- Snapshot
|   `-- Codec
|-- Mapping
|-- Diff
|-- Status
|-- Canonical
|-- IdempotencyKey
|-- PayloadStore
|-- Checkpoints
|-- Plan
|   |-- Item
|   |-- Asset
|   |-- Payload
|   `-- Codec
|-- Preview
|   `-- Item
|-- ApplyResult
|-- Diagnostic
|-- Orchestrator
|-- PlatformAdapter
|-- ThreadAdapter
|-- AssetStager
|   `-- Runner
|-- Workspace
|-- Persistence
|   |-- Connection
|   |-- Snapshot
|   |-- Job
|   |   |-- Item
|   |   `-- Asset
|   `-- Mapping
|-- Platforms
|   |-- GitHub
|   |   |-- Client
|   |   |-- Repository
|   |   |-- Releases
|   |   `-- Discussions          # 后续
|   |-- Notion
|   |   `-- Database             # 后续
|   |-- Sanity
|   |   `-- Dataset              # 后续
|   `-- Archive
|       `-- Zip
`-- Threads
    |-- Doc
    |   |-- Preparation
    |   |   `-- Codec
    |   |-- PlanPayload
    |   |-- ItemPayload
    |   |-- PreviewPayload
    |   |-- ItemPreview
    |   |-- Framework
    |   |-- Frameworks
    |   |   |-- Docusaurus
    |   |   |-- Fumadocs
    |   |   |-- MkDocs
    |   |   |-- Nextra
    |   |   |-- Rspress
    |   |   |-- Starlight
    |   |   `-- VitePress
    |   |-- SourceTree
    |   |-- NavigationPlanner
    |   |-- Plan
    |   |-- LinkResolver
    |   |-- DocumentFile
    |   |-- StaticConfig
    |   |-- SourceSidebar
    |   `-- RspressAutoNavigation
    |-- Changelog
    |   |-- PlanPayload
    |   |-- ItemPayload
    |   |-- PreviewPayload
    |   `-- ItemPreview
    `-- Post                     # 后续
```

这里有意保留两层同名概念：

- 根层 `Entry`、`Snapshot`、`Mapping`、`Plan` 是不依赖 Ecto/Repo 的领域 contract，供 PlatformAdapter、ThreadAdapter 和测试直接使用。
- `Persistence.Connection/Snapshot/Job/Job.Item/Job.Asset/Mapping` 是数据库行；它们只保存 bounded metadata、状态、逐项决策和 locator，不接管领域对象的构造与 hash 语义。
- 大正文/二进制不进入 `Persistence.Snapshot` 或 `Persistence.Job` 的无界 JSON；数据库保存 Entry manifest、Plan summary 与 opaque ref，完整 Snapshot/Preparation/Plan 由 `PayloadStore` 恢复。

### 命名约束

- 外部来源统一叫 `Platform`，不再叫 `SourceAdapter`。
- Groupher 落地目标统一叫 `Thread`，不再叫 `Target`。
- Docs framework 实现统一放在 `Frameworks`，避免和 `PlatformAdapter` 混淆。
- 已经位于 `ContentImport.Threads.Doc` 下的模块不重复 `DocImport` 前缀：
  - `DocImport.ImportPlan` → `ContentImport.Threads.Doc.Plan`
  - `DocImport.Adapter` → `ContentImport.Threads.Doc.Framework`
  - `DocImport.Adapters.Vitepress` → `ContentImport.Threads.Doc.Frameworks.VitePress`
- 前端新增类型统一使用 `type T...`，不使用 `interface`。
- framework module 使用官方品牌大小写，文件名按 Elixir snake_case 对应：
  - `Fumadocs` → `fumadocs.ex`
  - `MkDocs` → `mk_docs.ex`
  - `VitePress` → `vite_press.ex`
  - `Rspress` → `rspress.ex`
- 持久化 platform/framework 值使用稳定的小写字符串，如 `mkdocs`、`vitepress`，不直接使用 module name。

### 测试与 fixture 目录

测试目录必须镜像新的 `lib/groupher_server/cms/content_import` 模块结构，不保留扁平的 `doc_import/adapters_test.exs`：

```text
backend/main/test/groupher_server/cms
|-- content_import_test.exs
`-- content_import
    |-- diagnostic_test.exs
    |-- diff_test.exs
    |-- entry_test.exs
    |-- markdown_normalizer_test.exs
    |-- orchestrator_test.exs
    |-- checkpoints_test.exs
    |-- idempotency_key_test.exs
    |-- plan_test.exs
    |-- plan
    |   |-- asset_test.exs
    |   |-- payload_test.exs
    |   `-- codec_test.exs
    |-- preview_test.exs
    |-- preview
    |   `-- item_test.exs
    |-- apply_result_test.exs
    |-- snapshot_test.exs
    |-- snapshot
    |   `-- codec_test.exs
    |-- platform_adapter_test.exs
    |-- thread_adapter_test.exs
    |-- asset_stager
    |   `-- runner_test.exs
    |-- workspace_test.exs
    |-- persistence_test.exs
    |-- persistence
    |   |-- connection_test.exs
    |   |-- snapshot_test.exs
    |   |-- job_test.exs
    |   |-- job
    |   |   |-- asset_test.exs
    |   |   `-- item_test.exs
    |   `-- mapping_test.exs
    |-- platforms
    |   |-- archive
    |   |   `-- zip_test.exs
    |   `-- github
    |       |-- repository_test.exs
    |       `-- releases_test.exs
    `-- threads
        |-- doc_test.exs
        |-- doc
        |   |-- plan_payload_test.exs
        |   |-- item_payload_test.exs
        |   |-- preview_payload_test.exs
        |   |-- item_preview_test.exs
        |   |-- framework_test.exs
        |   |-- frameworks
        |   |   |-- docusaurus_test.exs
        |   |   |-- fumadocs_test.exs
        |   |   |-- mk_docs_test.exs
        |   |   |-- nextra_test.exs
        |   |   |-- rspress_test.exs
        |   |   |-- starlight_test.exs
        |   |   `-- vite_press_test.exs
        |   |-- document_file_test.exs
        |   |-- link_resolver_test.exs
        |   |-- navigation_planner_test.exs
        |   |-- preparation_test.exs
        |   |-- preparation
        |   |   `-- codec_test.exs
        |   `-- plan_test.exs
        |-- changelog_test.exs
        `-- changelog
            |-- plan_payload_test.exs
            |-- item_payload_test.exs
            |-- preview_payload_test.exs
            `-- item_preview_test.exs
```

fixture 同样按职责分层：

```text
backend/main/test/fixtures/content_import
|-- platforms
|   |-- archive
|   `-- github
`-- threads
    |-- doc
    |   `-- frameworks
    |       |-- docusaurus
    |       |-- fumadocs
    |       |-- mkdocs
    |       |-- nextra
    |       |-- rspress
    |       |-- starlight
    |       `-- vitepress
    `-- changelog
        `-- github_releases
```

- framework test 按 module 拆分，避免继续扩大单一 `adapters_test.exs`。
- 共用 golden assertion 放在 test helper/case module，不复制断言逻辑。
- 现有 fixture 和 golden 只移动，不复制两份；platform-to-thread integration test 直接复用对应 thread fixture。
- 新增 module 时，测试文件必须落在与 module 相同的相对目录。
- fixture 目录使用稳定 framework id（`mkdocs`、`vitepress`）；只有 Elixir module/test 文件按 `mk_docs.ex` / `mk_docs_test.exs`、`vite_press.ex` / `vite_press_test.exs` 命名。
- 前端不新建统一的全局 test root：route/component/hook 测试留在 `frontend/dashboard/src` 或 `frontend/core` 的对应实现旁；若该模块族当前使用 `tests/` 子目录，则继续沿用该局部约定。

---

## 历史方案：五、旧核心 contract

下面只表达边界；字段在实现 migration/API 前仍可调整。

### 5.1 Entry

`Entry` 是平台内容的统一输入，不包含 Groupher Article/Doc 的数据库身份。

```elixir
@type external_ref :: String.t()

@type entry :: %{
        required(:external_ref) => external_ref(),
        required(:kind) => :file | :record | :link | :asset,
        optional(:path) => String.t(),
        optional(:title) => String.t(),
        optional(:body) => binary() | map() | list(),
        optional(:body_format) => atom(),
        optional(:metadata) => map(),
        optional(:source_url) => String.t(),
        optional(:source_updated_at) => DateTime.t(),
        optional(:revision) => String.t(),
        required(:content_hash) => String.t(),
        required(:hash_version) => pos_integer(),
        required(:normalization_version) => pos_integer()
      }
```

约束：

- `external_ref` 在同一个 Connection 内稳定且唯一。
- `content_hash` 只由规范化后的来源内容生成。
- `Entry` 不包含 `article_id`、数据库 row id 或目标 thread 的 draft/public 状态。
- GitHub repository/ZIP 中的配置文件也可以是 `kind=:file` 的 Entry。
- GitHub Release、Notion page 等 API 记录使用 `kind=:record`。
- `kind=:asset` 只表示平台能够独立枚举的来源文件或附件，例如 repository 中的图片、Notion attachment；正文里的任意 URL 不自动升级为 Entry。
- `Entry.revision` 是可选的、平台原生的单条内容版本。只有平台能够低成本提供稳定条目版本时才填写，否则留空。
- GitHub repository 的 Entry revision 优先使用 Tree/Blob API 已提供的 blob SHA；不为取得“文件最后 commit”逐文件请求 API。
- Entry revision 只用于快速判断和来源追踪，diff 正确性仍以 `content_hash` 为准。

`content_hash` 使用带版本的确定性算法。首版规则固定为：

- `hash_version = 1` 使用 SHA-256，输出小写 hex。
- `normalization_version = 1` 将文本换行统一为 LF，并统一为恰好一个结尾换行；不对行首、行尾或代码块做全局 trim。
- `body`/`metadata` 等结构化数据递归按 key 排序后编码；list 保持来源顺序。
- frontmatter 先解析成结构化数据，再按同一 canonical encoding 编码，不依赖原始 key 顺序。
- hash 输入包括会影响导入结果的 `kind/path/title/body/body_format` 与有效 metadata。
- `fetched_at`、临时签名 URL、token、request id 等易变或敏感字段不得进入 hash。
- `revision` 是平台的单条内容版本标识，不等价于内容 hash，也不进入内容规范化规则。
- 任何会改变 hash 结果的规范化规则都必须递增 `normalization_version`，不能静默修改。

### 5.2 Snapshot

一次平台拉取产生一个不可变 Snapshot：

```elixir
@type snapshot :: %{
        required(:platform) => atom(),
        required(:source_ref) => String.t(),
        optional(:revision) => String.t(),
        optional(:checkpoint) => map(),
        required(:entries) => [entry()],
        required(:fetched_at) => DateTime.t(),
        required(:manifest_hash) => String.t(),
        required(:manifest_hash_version) => pos_integer(),
        required(:entry_hash_version) => pos_integer(),
        required(:normalization_version) => pos_integer(),
        optional(:adapter_version) => String.t(),
        optional(:diagnostics) => [map()]
      }
```

- `Snapshot.revision` 始终表示本次拉取对应的全局来源版本，不与某个 Entry revision 混用或相互推导。
- GitHub repository 的 Snapshot revision 优先使用 ref 对应的 HEAD commit SHA。
- GitHub Releases 可以使用 latest `updated_at` + release identity/checkpoint。
- ZIP 使用上传文件 hash。
- Snapshot 需要能重新 materialize 成只读 Workspace，供现有 docs framework parser 使用。
- `manifest_hash` 表示整个 Snapshot 的内容清单，不再叫含义模糊的 `content_hash`。
- `manifest_hash_version = 1` 使用 SHA-256；它与 Entry 的 `entry_hash_version` 分开演进。
- 首版 manifest 将 Entry 按 `external_ref` 排序，取每项的 `[external_ref, content_hash, hash_version, normalization_version]`，连同 `platform/source_ref/manifest_hash_version/adapter_version` 做 canonical encoding 后计算 SHA-256。
- `fetched_at`、checkpoint 中的游标等运行时状态不进入 `manifest_hash`；Snapshot `revision` 仍单独保存。
- 首版不需要实现 Merkle tree。`manifest_hash` 用于快速幂等判断和 cache key；具体 diff 仍按 Entry 与 Mapping 逐项计算。
- Entry revision 与 Snapshot revision 可以不同或为空；测试和 diff 不能假设二者相等。

### 5.3 PlatformAdapter

```elixir
@callback validate_connection(connection(), keyword()) :: :ok | {:error, diagnostic()}
@callback fetch(connection(), keyword()) :: {:ok, snapshot()} | {:error, diagnostic()}
```

职责：

- 平台鉴权与 secret 获取。
- API 分页、rate limit、retry。
- 远程 revision/checkpoint。
- 将平台原始数据规范化成 Entry。
- 不决定内容最终进入哪个 Groupher thread。

### 5.3.1 Docs Preparation 与 durable checkpoints

Docs framework detection 和 `SourceTree` 解析属于 Doc thread，不进入通用 Snapshot，也不要求顶层调用方自行拼接：

```text
persist Snapshot payload + row
        ↓
start Job(:planning)
        ↓
Threads.Doc.prepare(Snapshot)
        ↓
persist Preparation payload + attach locator
        ↓
Threads.Doc.plan(Snapshot, Preparation)
        ↓
persist Plan payload + attach locator/summary/Job.Item/Job.Asset
```

- `Preparation` 保存 `snapshot_manifest_hash/framework/source_tree/diagnostics/preparation_hash/version`，只服务 Docs。
- `Threads.Doc.plan/3` 必须接收与 Snapshot manifest 匹配的 Preparation；不再允许调用方通过 options 单独传入 `source_tree`。
- `Persistence.attach_preparation` 和 `attach_plan` 都会校验 Job 对应的 Snapshot；Doc Job 未挂载 Preparation 时不能挂载 Plan。
- Snapshot、Preparation、Plan 使用各自的 versioned JSON codec；恢复时重新校验 manifest/hash，不能只信任数据库 locator。
- `PayloadStore` 只定义 durable opaque ref 的 put/get/delete contract；当前测试有内存实现，生产 object storage 与 TTL/GC 仍属于 Task 9。
- Job 在 Plan 之前创建。幂等 key 由 `connection + snapshot manifest + thread + scope + effective options` 在服务端 canonical 生成；人工强制重跑使用显式 `run_nonce`。
- Changelog 等不需要 framework parse 的 thread 跳过 Preparation，但仍使用相同的 Snapshot/Plan checkpoint 和 Job 生命周期。

### 5.4 Plan 与 ApplyResult

`plan/3` 与 `apply_in_transaction/3` 不返回无约束的 map。通用 identity/action/asset 使用稳定 struct，thread 专属部分使用显式 union：

```elixir
@type plan_payload ::
        Threads.Doc.PlanPayload.t()
        | Threads.Changelog.PlanPayload.t()

@type item_payload ::
        Threads.Doc.ItemPayload.t()
        | Threads.Changelog.ItemPayload.t()

@type plan_item :: %{
        required(:external_ref) => String.t(),
        required(:target_ref) => String.t(),
        required(:action) => :create | :update | :skip | :conflict,
        optional(:source_revision) => String.t(),
        required(:source_hash) => String.t(),
        required(:payload) => item_payload()
      }

@type plan_asset :: %{
        required(:asset_key) => String.t(),
        required(:source) => {:entry, Entry.external_ref()} | {:remote_url, String.t()},
        optional(:source_path) => String.t(),
        optional(:mime_type) => String.t(),
        optional(:content_hash) => String.t(),
        optional(:staging_ref) => String.t(),
        optional(:references) => [map()],
        required(:status) => :pending | :staging | :ready | :failed
      }

@type plan :: %{
        required(:thread) => atom(),
        required(:items) => [plan_item()],
        required(:assets) => [plan_asset()],
        required(:payload) => plan_payload(),
        optional(:diagnostics) => [diagnostic()]
      }

@type apply_item :: %{
        required(:external_ref) => String.t(),
        required(:target_ref) => String.t(),
        required(:status) => :created | :updated | :skipped
      }

@type applied_asset :: %{
        required(:asset_key) => String.t(),
        required(:target_ref) => String.t(),
        required(:status) => :created | :reused | :skipped
      }

@type apply_result :: %{
        required(:items) => [apply_item()],
        required(:assets) => [applied_asset()],
        optional(:diagnostics) => [diagnostic()]
}
```

`Plan.Payload` 是 thread → payload module 的唯一 registry，负责构造校验和 codec dispatch。`Plan.payload` 与每个 `Plan.Item.payload` 必须属于同一 thread；新增 Post 时必须同时提供 `Post.PlanPayload` 与 `Post.ItemPayload`，不能把 schema 退回动态 map。

`Plan.payload` 保存 thread 级聚合结果，例如 Docs 的 target branch 与整棵 navigation tree；这类数据不能复制到每个 `Plan.Item.payload`。`Plan.Item.payload` 保存单条内容的私有规范化结果，允许包含 apply 所需 body，但不能原样暴露给 GraphQL。`Plan.Asset.references` 保存使用该资源的 Entry/path/原始 URL 上下文，供 staging 失败时定位到具体页面。

Plan 到 UI 之间增加独立的安全投影：

```elixir
@type preview_payload ::
        Threads.Doc.PreviewPayload.t()
        | Threads.Changelog.PreviewPayload.t()

@type item_preview ::
        Threads.Doc.ItemPreview.t()
        | Threads.Changelog.ItemPreview.t()

@type preview :: %Preview{
        thread: :doc | :changelog,
        schema_version: pos_integer(),
        payload: preview_payload(),
        items: [%Preview.Item{payload: item_preview()}],
        diagnostics: [diagnostic()]
      }
```

aggregate payload 与 item payload 都按 `thread` 成对校验。Preview 只保留 renderer 需要的安全字段，不包含 normalized body、`staging_ref`、credential locator 或私有资源定位。`Persistence.Job.Item.preview` 继续保存 bounded list summary；完整 thread preview 由私有 Plan 恢复后通过 `ThreadAdapter.project_preview/1` 生成，两者职责不能混用。

`target_ref` 的来源必须在 Task 1 固定：

- 已存在的内容：orchestrator 加载持久化 Mapping，`plan/3` 从 Mapping 取得原 `target_ref`。
- 新内容：`plan/3` 预分配稳定的 public ref；当前 Doc Plan 的 `articleHashId` 可作为现有能力迁移，而不是等数据库 insert 后才生成。
- Mapping 不负责生成 `target_ref`；`apply_in_transaction/3` 返回成功的 `ApplyResult` 后，由 `Orchestrator.apply_job/7` 在同一事务中持久化或更新 Mapping。
- Task 2 与 Task 5 只有在 Task 1 冻结上述 typed contract 后才能并行；Task 2 可以先使用内存 Mapping fixture，不依赖数据库 migration 完成。

资源边界：

- Snapshot Entry 的原始 body 保持不可变，继续保存来源中的相对路径或远程 URL；plan 不得把 Groupher URL 回写进 Snapshot。
- `Plan.Asset` 是 thread normalization 产生的资源工作项。相对路径/平台附件优先引用已有 asset Entry；正文中的任意远程 URL 可以生成 plan-local asset，不反向修改 Snapshot。
- `Plan.Asset.source={:entry, ref}` 中的 ref 只能是 `Entry.external_ref`；blob SHA 放在 Entry revision，来源路径放在 `source_path`，三者不能互换。
- normalized body 使用稳定 `asset_key` 占位引用。`ThreadAdapter.plan/3` 只发现资源依赖并生成 `status=:pending` 的 asset，不执行远程下载，也不写 staging/permanent storage。
- orchestrator 在挂载 Plan 时，将每个 pending Plan.Asset materialize 为可独立更新的 Job.Asset 并进入 staging 生命周期；独立 `AssetStager` 分批执行下载、校验 MIME/大小、计算 hash、去重和 staging 写入，再把 Job.Asset 状态投影回 plan preview/apply input。
- `AssetStager` 必须使用有界队列与 backpressure；并发上限至少按全局、单 Job、单 host 三层配置，同时限制 timeout、redirect、单文件/总字节数并支持 cancel、retry/backoff。
- `Plan.Asset.source` 只保存可持久化的来源定位；短期签名 URL、authorization header 和私有下载 token 只存在于执行上下文，不进入 Plan、Job、diagnostic 或 GraphQL。
- `staging_ref` 是不对外暴露的内部 opaque ref，至少保留到 apply/retry 结束；不能依赖仅在 planning worker 生命周期内存在的本地临时文件。
- 所有必须处理的 asset 进入 `ready/failed` 终态后 Job 才能进入 `ready`；失败项按用户确认的 partial-failure 策略处理。
- `ThreadAdapter.apply_in_transaction/3` 拒绝仍包含 `pending/staging` asset 的 Plan。
- apply 阶段上传或复用资源，得到 `target_ref` 后再生成最终正文；`ApplyResult.assets` 返回实际资源写入结果。
- 来源 asset Entry 可在 apply 成功后建立 Mapping；plan-local remote asset 默认按 content hash 去重，不强制伪造成来源 Entry。

### 5.5 ThreadAdapter

```elixir
@type thread_context :: %{
        required(:community_ref) => String.t(),
        required(:thread) => atom(),
        optional(:scope_ref) => String.t()
      }

@type plan_context :: %{
        required(:mappings) => [mapping()],
        optional(:preparation) => term(),
        optional(:local_hashes) => %{optional(String.t()) => String.t()},
        optional(:options) => keyword()
      }

@callback validate(snapshot(), thread_context(), keyword()) ::
            :ok | {:error, [diagnostic()]}

@callback plan(snapshot(), thread_context(), plan_context()) ::
            {:ok, plan()} | {:error, [diagnostic()]}

@callback project_preview(plan()) ::
            {:ok, preview()} | {:error, [diagnostic()]}

@callback apply_in_transaction(plan(), actor(), keyword()) ::
            {:ok, apply_result()} | {:error, [diagnostic()]}
```

职责：

- 判断某类 Entry 是否适合当前 thread。
- 将来源内容转换成 thread 的 draft/preview plan。
- 将私有 Plan 投影成 thread-typed、安全且有界的 Preview DTO；renderer 不读取私有 Plan payload。
- 在 `Orchestrator.apply_job/7` 已开启的事务中写入 thread 对应的 Draft/Preview 数据。
- 在 Plan 中给每个条目确定 `target_ref`，并在 ApplyResult 中确认实际写入结果。
- 不负责外部平台鉴权、分页、API rate limit、Mapping 持久化或 Job completion。

`apply_in_transaction/3` 的事务所有权是强约束：

- callback 由 `Orchestrator` 在持有活动 `GroupherServer.Repo` transaction 的同一进程内同步调用；脱离事务调用必须返回错误。
- thread implementation 不得再次调用 `Repo.transaction/2`、`Repo.transact/2` 或 `Repo.rollback/1`，错误必须返回给 orchestrator，由外层决定 rollback。
- callback 内的数据库写入必须使用同一个 Repo。网络请求、object storage 写入和第二个独立 Repo 不属于该原子事务；必须在 callback 前完成，或通过 outbox/saga 与幂等补偿处理。
- 不提供 public standalone `apply/3` wrapper，避免绕过 Mapping、source-deleted resolution 与 Job completion 的同一事务闭环。

### 5.6 Mapping 与 Diff

Mapping 至少要保存：

```elixir
@type mapping :: %{
        required(:connection_ref) => String.t(),
        required(:external_ref) => String.t(),
        required(:thread) => atom(),
        required(:target_ref) => String.t(),
        optional(:last_imported_revision) => String.t(),
        required(:last_imported_source_hash) => String.t(),
        required(:last_imported_local_hash) => String.t(),
        required(:last_imported_at) => DateTime.t()
      }
```

重新 fetch 后，根据 Snapshot、Mapping 和当前本地内容生成：

```text
new
in_sync
source_updated
local_updated
conflict
source_deleted
```

旧 `sourceMappings` 已升级为通用 `Mapping` contract，并落到 `Persistence.Mapping`；plan 只消费领域 Mapping，不依赖 Ecto schema 或偶然的内存 map 结构。

`last_imported_local_hash` 的生成与比较规则必须由 thread-specific local hash contract 固定，不能由调用方临时选择；如果后续抽成 provider，也只能是该 contract 的实现：

- Docs v1 使用成功持久化的 `BodyBag.body_hash`，即 canonical Plate AST 的语义正文 hash；它不是来源 Markdown hash、Snapshot hash 或 Plan hash。
- `Orchestrator` 只在 thread apply 成功后取得实际写入结果对应的 local hash，并在同一个事务中更新 Mapping；apply 回滚时不得提前更新该字段。
- 后续 Diff 必须从当前 Draft/Document 的 BodyBag 使用同一 canonicalization 与 hash version 读取或重算 local hash，再与 Mapping 比较。
- hash 必须带稳定版本语义。建议保存为 `body-v1:<hex>`，或增加独立 `local_hash_version`；canonical schema 升级时应迁移/重算旧值或把它视为 unknown，不能把算法变化误判为用户修改。
- Docs v1 的 local hash 只表达正文变化；title、slug、route 和树位置由 Target Planner 与 targetRevision 检测。未来若同步本地 metadata，新增 versioned composite projection hash，不能静默改变现有字段含义。

---

## 历史方案：六、旧模块迁移映射

| 当前模块                          | 目标模块                                           | 处理方式                                                           |
| --------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `CMS.DocImport`                   | `CMS.ContentImport.Threads.Doc`                    | 保留 detect/extract 语义，改为 Thread 实现内部入口                 |
| `DocImport.Adapter`               | `ContentImport.Threads.Doc.Framework`              | rename，明确是 docs framework contract                             |
| `DocImport.Adapters.*`            | `ContentImport.Threads.Doc.Frameworks.*`           | 原实现整体迁移，不重写                                             |
| `DocImport.Diagnostic`            | `ContentImport.Diagnostic`                         | 提升为通用能力                                                     |
| `DocImport.SourceTree`            | `ContentImport.Threads.Doc.SourceTree`             | 原实现迁移                                                         |
| `DocImport.NavigationPlanner`     | `ContentImport.Threads.Doc.NavigationPlanner`      | 原实现迁移                                                         |
| `DocImport.ImportPlan`            | `ContentImport.Threads.Doc.Plan`                   | 原实现迁移后实现 `ThreadAdapter.plan/3`                            |
| `DocImport.DocumentFile`          | `ContentImport.Threads.Doc.DocumentFile`           | 保持 docs framework 专用                                           |
| `DocImport.StaticConfig`          | `ContentImport.Threads.Doc.StaticConfig`           | 保持 docs framework 专用                                           |
| `DocImport.SourceSidebar`         | `ContentImport.Threads.Doc.SourceSidebar`          | 保持 docs framework 专用                                           |
| `DocImport.RspressAutoNavigation` | `ContentImport.Threads.Doc.RspressAutoNavigation`  | 原实现迁移                                                         |
| `test/.../doc_import/*`           | `test/.../content_import/threads/doc/*`            | 测试按 module 相对路径移动，framework 各自拆分测试文件，断言不降级 |
| `fixtures/doc_import/*`           | `fixtures/content_import/threads/doc/frameworks/*` | fixture/golden 整体移动；不可复制两份                              |

迁移完成后删除旧 namespace，不保留 forwarding module。

---

## 历史方案：七、旧任务拆分

### Task 0：冻结当前 baseline（已完成能力）

状态：已完成，baseline 与 cutover 后 focused suite 均已记录。

- [x] 7 个 docs framework parser。
- [x] framework detection。
- [x] provider-neutral `SourceTree`。
- [x] `NavigationPlanner`。
- [x] Preview Branch `ImportPlan`。
- [x] stable diagnostics。
- [x] fixture、golden 与 focused tests。
- [x] 完成 namespace cutover 前后的 focused suite 对照；当前 ContentImport suite 为 `99 tests, 0 failures`。

验收：现有测试作为重构的行为基线，后续 namespace cutover 不允许减少覆盖。

### Task 1：建立 ContentImport namespace 与 contract

依赖：Task 0。

状态：已完成。

- [x] 新建 `CMS.ContentImport` facade。
- [x] 定义 `PlatformAdapter` behaviour。
- [x] 定义 `ThreadAdapter` behaviour。
- [x] 定义 `AssetStager` 执行 contract，明确只有 orchestrator/staging worker 可以把 asset 从 `pending` 推进到 `staging/ready/failed`。
- [x] 定义 `Entry`、`Snapshot`、`Diagnostic` 的类型与构造函数。
- [x] 定义 `Plan`、`Plan.Item`、`Plan.Asset`、`ApplyResult` 与 `Mapping` 输入类型，禁止 behaviour 返回无约束 map；Task 1 的 Mapping contract 不依赖 Repo/Ecto。
- [x] 冻结 `target_ref` 规则：已有条目读取 Mapping，新条目由 plan 预分配，apply 成功后才持久化 Mapping。
- [x] 实现 Entry SHA-256 canonicalization，并固定 `hash_version`、`normalization_version`。
- [x] 实现 Snapshot `manifest_hash`，明确它是排序后的 Entry manifest hash，不是单条内容 hash；`manifest_hash_version` 与 Entry `hash_version` 独立演进。
- [x] 定义 Platform、Thread、Plan Asset 和 Job status 的内部枚举。
- [x] 明确 secret 不进入 Snapshot、Job payload 或 diagnostic。
- [x] 添加 behaviour 与 hash contract tests，至少覆盖换行、结尾换行、代码块空白、map key 顺序、Entry 顺序和易变 metadata。
- [x] 增加 revision contract tests：Entry revision 可为空、GitHub blob SHA 与 Snapshot HEAD SHA 不相等时仍能正确 plan/diff、hash 相同但 revision 改变时不产生内容误报。
- [x] 增加 `Plan.Asset`/`ApplyResult.assets` contract tests：验证 `{:entry, ref}` 只按 Entry `external_ref` 关联，不接受 path/blob SHA 代替，并验证 Snapshot body 不被 plan 修改。
- [x] 使用 fake downloader 证明 `ThreadAdapter.plan/3` 不触发下载；含资源的初始 Plan 只产生 `status=:pending`。

验收：可以用 test adapter 构造 Snapshot，并由 test thread adapter 生成 typed Plan；相同语义输入稳定得到相同 Entry hash 与 manifest hash；不需要数据库。

### Task 2：把现有 DocImport 完整合并到 Threads.Doc

依赖：Task 1。

状态：已完成。

- [x] `Adapter` rename 为 `Framework`。
- [x] `Adapters.*` 按官方 module 名移到 `Threads.Doc.Frameworks.*`，包括 `MkDocs`/`mk_docs.ex` 与 `VitePress`/`vite_press.ex`。
- [x] `SourceTree`、`NavigationPlanner`、helpers 原样迁移。
- [x] `ImportPlan` rename 为 `Threads.Doc.Plan`。
- [x] `Threads.Doc` 实现 `ThreadAdapter.validate/3` 与 `plan/3`；从传入 Mapping 复用已有 `target_ref`，为新条目预分配稳定 ref。
- [x] 保留当前 `parse_tree(local_root)` 能力作为 Doc 内部 framework extraction API。
- [x] 测试按新 module 目录镜像移动；原单一 adapter 测试按 framework 拆成 `*_test.exs`，共用断言提取到 test helper/case。
- [x] fixture/golden 移到 `fixtures/content_import/threads/doc/frameworks/*`，只保留一份来源数据。
- [x] 删除旧 `CMS.DocImport` namespace，不添加 compatibility facade。

验收：现有 fixture、golden、dynamic-config safety、navigation 和 plan 测试在新镜像目录全部通过；输出 JSON 除明确的 schemaVersion 变化外保持一致；内存 Mapping contract 能覆盖 create/update 两类 `target_ref`。

### Task 3A：实现 Workspace 与首批 file-based PlatformAdapter

依赖：Task 1；可与 Task 2 并行。

状态：除真实 credential resolver 外已完成。

首批平台：

- [x] `Platforms.Archive.Zip`。
- [x] `Platforms.GitHub.Repository`。

通用能力：

- [x] 将 file Entry materialize 到任务级临时 Workspace。
- [x] Workspace 只读、任务结束可回收，不进入 Git。
- [x] ZIP 防 path traversal、symlink escape 和 zip bomb。
- [x] 限制文件数量、单文件大小、总解压大小和允许的文件类型。
- [x] GitHub repository 支持 owner/repo/ref/path。
- [ ] 私有仓库从安全 connection 读取 token/GitHub App credential。
- [x] Snapshot 记录 HEAD commit SHA；每个 GitHub file/asset Entry 使用 Tree/Blob API 已返回的 blob SHA 作为可选 revision，不逐文件查询最后 commit。
- [x] 区分内容文件与可独立枚举的 asset Entry，记录 source URL、path、MIME、file hash 等必要 metadata。
- [x] GitHub tree/API 截断时生成 diagnostic，不静默导入残缺数据；下载后重新按实际 body 校验单文件/总字节数，不信任 Tree API 的 size 声明。

验收：给定 ZIP 或 GitHub repository fixture，能稳定产生 Entry/Snapshot，并完成 Snapshot ↔ 只读 Workspace round-trip；platform 测试位于镜像目录，不依赖 Docs framework。

### Task 3B：接通 Platform Snapshot → Threads.Doc

依赖：Task 2、Task 3A。

状态：ZIP 与 GitHub Repository 的 Snapshot → Workspace → Preparation → Docs Plan 闭环均已完成。

- [x] 将 file Entry materialize 为只读 Workspace 后交给 `Threads.Doc`。
- [x] `Threads.Doc.prepare/1` 从 Workspace 检测 framework、调用 parser，并生成绑定 `snapshot.manifest_hash` 的 Preparation。
- [x] `Threads.Doc.plan/3` 只消费匹配当前 Snapshot 的 Preparation，不再由调用方独立传入 `source_tree`。
- [x] 将已有 Mapping 传入 `Threads.Doc.plan/3`（Repo Job orchestration 仍属于 Task 5）。
- [x] Platform diagnostic 与 thread diagnostic 在 plan 中统一呈现，但保留责任域。
- [x] 增加 ZIP → Snapshot → SourceTree/Plan integration test。
- [x] 增加 GitHub repository → Snapshot → SourceTree/Plan integration test。
- [x] 已完成的 Platform → Doc integration test 落在 `test/.../content_import/threads/doc_test.exs`；framework 内部测试留在 `threads/doc/*`，并复用 thread fixture，不复制 platform fixture。

验收：同一内容通过本地 fixture、ZIP 或 GitHub repository 输入时，得到等价的 Preparation/Plan 与稳定 `target_ref`；A Snapshot 不能与 B Preparation/Plan 错配。

### Task 4：补齐 Docs 正文与资源转换

依赖：Task 2、Task 3B。

状态：正文转换已按 Article Publish/Import 重构决策暂停。旧 Elixir normalizer 已删除；导航和 identity 规划继续工作，但正文明确为 `deferred`。

- [x] 保持 Snapshot Entry body 原样、Preparation 与 Snapshot manifest 绑定、导航/identity 规划稳定。
- [x] Docs Plan 为每个正文 item 写入 `status=deferred` 和稳定 diagnostic，不输出伪 BodyBag。
- [x] Changelog Plan 使用同一 deferred 语义。
- [x] generated Plan 不创建依赖旧 normalized body 的 asset work item。
- [x] 删除 `CMS.ContentImport.MarkdownNormalizer`、`Threads.Doc.ContentNormalizer`、Earmark 与对应测试。
- [ ] 将来源 Markdown/MDX 直接接入 Node [`artiment-publisher`](../../frontend/core/lib/artimentPublisher.ts)，生成完整 BodyBag。PDF/Office 等非 Markdown 文件才先经过 `document-converter`；GitHub Docs 不依赖它。Publisher 是 Node 发布边界：校验并 canonicalize Plate AST，生成 JSON、Markdown、安全 HTML、TOC、纯文本、digest、`body_hash` 和 schema version；它不是独立网络服务。
- [ ] 基于 publisher 输出重新定义图片/附件发现、asset key、最终 URL 替换和 golden fixtures。
- [ ] Editor 增加 table/code-block 等 persisted plugins 后，再扩展对应 Markdown 支持矩阵。

当前验收：Plan 仍可用于导航、Diff、Preview metadata 和恢复检查点；任何 `deferred` 正文都会阻止 apply/dry-run，不修改 Draft、Preview Branch 或 Mapping。

### Task 5：持久化 Connection、Job、Snapshot、Mapping 与 Diff，并实现 Asset staging

依赖：Task 1。

状态：schema/migration、durable checkpoint contract、Repo 幂等操作、Job item/asset command、Diff 与单 Job bounded runner 已完成；真实 PayloadStore/downloader/storage、安全网络层、worker loop 与保留清理尚未完成。本 Task 是通用 ContentImport 基础设施，不等于 GitHub Bulk v1 产品范围：Bulk v1 不激活 AssetStager，Diff 除 `new` 外的 re-sync 状态也不属于其 release gate。

- [x] credential 边界确定为专用 `Persistence.Connection` metadata + `credential_locator`；credential 本体仍复用/接入外部 secret storage，不建明文 token 字段。
- [x] 为 `Persistence.Connection/Job/Job.Item/Job.Asset/Snapshot/Mapping` 增加 Ecto schema 与数据库 migration；Diff 由领域 Snapshot + Mapping + 当前本地 hash 派生，不单独建表，Job 只保存 payload locator 与 plan/diff summary。
- [x] Connection 保存 public ref、community scope、platform、source ref、非敏感配置与 credential locator；changeset 拒绝 config 中嵌套 token/secret/authorization/private key。
- [x] 增加 Job 状态机：`pending/loading/planning/staging/ready/applying/completed/failed/cancelled`。
- [x] schema 保存 Job progress、diagnostics 与操作者。
- [x] `Persistence.start_job/2` 在 Plan 前创建/复用 planning Job；服务端根据 Snapshot、thread、scope、effective options 生成 canonical idempotency key，调用方不能伪造 key/status。
- [x] `Persistence.attach_preparation/3` 只允许 Doc Job 挂载与其 Snapshot 匹配的 Preparation；相同 hash 幂等复用，不同 checkpoint 拒绝覆盖。
- [x] `Persistence.attach_plan/5` 校验 Job/Snapshot/thread/Preparation，将每个 Plan item 与 pending asset 分别 materialize 为 Job.Item/Job.Asset；同一 Plan hash 幂等复用，不同 Plan 拒绝覆盖。
- [x] 无 assets 的 Job 在挂载 Plan 后直接从 `planning` 进入 `ready`；有 assets 的 Job 等待 bounded staging。
- [x] Repo `Orchestrator` 在领取资源工作后把 Job 从 `planning/ready` 推进到 `staging`，并持久化资源计数与终态进度；详细 diagnostic append 仍由真实 worker 接线。
- [x] Job.Asset 保存 `asset_key/source/status/content_hash/staging_ref/attempts/last_error` 等可恢复状态；大二进制、credential、签名 URL 不进入数据库。
- [x] 实现 `AssetStager.Runner` 单 Job 有界 batch/concurrency、timeout 和 retry；不会为全部资源一次性启动无界 task。
- [x] 在 runner 外实现数据库 `FOR UPDATE SKIP LOCKED` claim/lease、过期 lease 重领和 bounded batch，避免多 worker 同时领取同一 Job.Asset。
- [ ] 增加全局与单 host admission/backpressure。
- [ ] 下载限制为允许的协议，阻止 loopback/private-network SSRF，限制 redirect、timeout、单文件和 Job 总字节数，并支持 cancel、retry/backoff。
- [ ] worker 使用 Connection execution context 获取私有资源 credential；失败只更新对应 Job.Asset 和 diagnostic，不把 secret 写入持久化状态。
- [x] 只有所有 Job.Asset 到达 `ready/failed/cancelled` 终态后 Job 才进入 `ready`；失败资源可显式从 `ready` 重领回 `staging`。
- [x] Snapshot 保存 `revision/manifest_hash/manifest_hash_version/entry_hash_version/normalization_version/adapter_version/checkpoint/fetched_at`；大正文/二进制不进入行内 JSON，使用 bounded manifest + `payload_ref`。
- [x] 定义 `PayloadStore` 及 Snapshot/Preparation/Plan versioned codec；`Checkpoints` 完成 payload 写入、locator 挂载、恢复和 hash 校验。生产 store 与 GC 尚待接线。
- [x] Job.Item 保存 bounded preview、action、selected 与逐项 resolution；conflict 支持 source/local/manual/skip，source-deleted 支持 keep/unlink/archive。
- [x] 提供带唯一冲突目标的 Mapping upsert；`Orchestrator.apply_job/7` 将 thread write、Mapping、source-deleted resolution 和 Job completion 放在同一个数据库事务中。
- [x] 实现基于 source/local hash 的派生 Diff；revision 只作追踪与快速判断，不改变 hash 相同的 diff 结论。
- [x] Job 创建与 Snapshot 命中幂等；已实现 retry/cancel Repo command。
- [x] 相同 Snapshot/thread/scope/effective options 在 Plan 前复用同一 Job；显式 `run_nonce` 创建新的人工重跑。
- [ ] 将命令接入真实常驻 worker，完成进程重启后的自动恢复执行。
- [ ] 定义 Snapshot/Job 的清理与保留策略。
- [ ] 定义 staging asset 的存储、TTL、Job 完成/取消后的回收任务，以及 retry 期间的续期策略。

migration 与 schema 约束：

- [x] schema 的时间字段使用 `:utc_datetime`；migration 的普通 datetime column 使用 `:timestamptz`，`timestamps()` 直接使用 Repo 默认配置，不显式传 type。
- [x] Connection 使用 `(community_id, platform, source_ref, connection_key)` 唯一约束，允许同一来源存在稳定命名的多套配置。
- [x] Mapping 增加 `(connection_id, thread, external_ref)` 唯一约束，并对 `(thread, target_ref)` 建查询索引。
- [x] Snapshot 索引 `(connection_id, inserted_at)`，并用 `(connection_id, manifest_hash)` 唯一索引支持幂等命中。
- [x] Job 索引 `(community_id, status, inserted_at)`、`connection_id`，并为 public `hash_id` 建唯一约束。
- [x] Job.Asset 增加 `(job_id, asset_key)` 唯一约束，并索引 `(job_id, status)` 与 `(status, lease_expires_at)`；领取使用 `FOR UPDATE SKIP LOCKED`。
- [x] Job.Item 增加 `(job_id, external_ref)` 唯一约束，并索引 `(job_id, action)` 与 `(job_id, resolution)`。
- [x] status/thread/platform 同时有 changeset validation 与数据库 check constraint。
- [x] migration 使用可逆 `change/0`，不依赖数据库 local timezone。

测试：

- [x] schema/changeset tests 位于 `test/.../content_import/persistence/*_test.exs`；Job.Asset/Job.Item 测试分别位于 `persistence/job/asset_test.exs` 与 `persistence/job/item_test.exs`，与 `Persistence.*` module 路径一一对应。
- [x] 纯 persistence projection tests 位于 `test/.../content_import/persistence_test.exs`，没有回到 `doc_import` 目录。
- [x] 覆盖无效状态、UTC 字段、credential 不泄露、重复 Job/item/asset 幂等、Preparation/Plan 覆盖拒绝、run nonce、Mapping upsert 与 Snapshot manifest 幂等命中。
- [x] Snapshot/Preparation/Plan codec 测试位于各自 module 的镜像目录；`checkpoints_test.exs` 覆盖 opaque ref round-trip、locator/hash mismatch 和 Plan asset state 投影。
- [ ] 补数据库唯一约束错误与查询计划级测试。
- [ ] 覆盖 Job 恢复后 `staging_ref` 仍可读取、retry 期间不被提前清理、completed/cancelled/expired Job 的 staging asset 最终回收。
- [x] AssetStager tests 在 `asset_stager/runner_test.exs` 覆盖单 Job 并发上限、batch、timeout/retry；`orchestrator_test.exs` 覆盖数据库单次领取、过期重领、partial failure、cancel 和失败资源重试。
- [ ] 补真实 worker process restart 测试。
- [x] 用 DataCase 验证 apply 完成前或本地 hash 缺失时 Mapping 不写入；测试位于镜像的 `orchestrator_test.exs`。

通用基础设施验收：migration 可 up/down，schema 与索引/约束测试通过；数千资源不会在 `plan/3` 内同步下载或产生无界 task；Snapshot/Preparation/Plan 与 staging 状态具备跨进程恢复所需的 durable contract，真实 worker 自动续跑仍属于 Task 9；同一来源重复导入不会重复创建目标内容；平台内容变化后能够稳定得到 `source_updated/new/source_deleted`；Mapping 只在原子 apply 成功后更新。

Bulk v1 只继承其中的 Job、Mapping、幂等和 atomic apply contract。Asset downloader/claim/lease/retry、资源 worker recovery，以及 `source_updated/local_updated/conflict/source_deleted` 的产品接线与端到端验收都延后到资源导入或 re-sync 阶段；已存在的领域实现和单元测试保留，不重复拆除。

### Task 6：实现 Threads.Doc apply

依赖：Task 4、Task 5。

状态：事务与编排基础设施已完成，但生成 Plan 的正文为 `deferred`，因此生产 apply 闭环暂停。手工构造的 ready BodyBag 仅用于验证基础设施，不代表批量导入已可用。

- [x] `Threads.Doc.apply_in_transaction/3` 创建或复用目标 Preview Branch，并拒绝脱离外层 Repo transaction 调用。
- [x] 已移除 Thread 层 standalone `apply/3`；生产与测试均通过 orchestrator transaction 或显式测试 transaction 调用 callback，不允许 thread implementation 自行开启/回滚嵌套事务。
- [x] ready BodyBag contract 可通过现有 `Articles.Draft` create/update；树写入集中在 `CMS.DocTree.Import`，没有在 ThreadAdapter 中散落操作 tree schema。
- [x] documents 与 tree 在同一外层 Repo transaction 中落地。
- [x] apply 拒绝 `pending/staging` asset；`failed` asset 必须显式选择 `failed_asset_policy=:skip_items`。
- [x] 基础设施支持显式 `asset_resolver`；未来 publisher 必须在最终资源 URL 确定后生成 BodyBag，不再对已生成正文做字符串占位符替换。
- [ ] 接入真实 CommunityAsset/storage publisher，并为外部对象写入补充失败补偿/清理。
- [x] `ApplyResult.assets` 返回 resolver 确认的资源 public ref；Thread apply 自身不提前写 Mapping。
- [x] Document/Tree 使用 plan 预分配的稳定 Article UUID，不使用数据库 row id 作为跨层身份。
- [x] apply 失败会回滚 Preview branch、之前已写 document 与整棵 tree；已有原子回滚测试。
- [x] ready BodyBag 支持 `dry_run` 且不产生数据库写入；generated deferred content 的 dry-run 与 apply 一样显式拒绝。
- [x] 支持全量、持久化的逐项 selected/resolution，以及兼容 thread 内部的 conflict policy；正文/资源失败只有显式 skip policy 才能跳过。
- [x] `Orchestrator.apply_job/7` 只在 `ApplyResult` 成功且 local hash 完整后，同事务 upsert Mapping、执行 unlink/archive resolution 并完成 Job；任何一步失败都会回滚 thread write 与 checkpoint。
- [x] apply tests 位于镜像目录 `test/.../content_import/threads/doc_test.exs`，覆盖 create/update 幂等、事务回滚、dry-run 和 asset resolver 替换。

当前验收：生成 Plan 无法 apply；恢复该能力后，一次 apply 仍只能产生 Preview/Draft 状态，不能直接写 public、Snapshot 或 PublishRelease。

### Task 7：用 GitHub Releases → Changelog 验证跨 thread 复用

依赖：Task 1、Task 5；不依赖 Docs apply，可作为 API-based platform/thread 的并行验证线。

状态：平台读取、Snapshot、Plan、Mapping、Diff 等共享基础设施已完成；release body 转换与 Changelog Draft apply deferred，webhook 同属后续。

- [x] 实现 `Platforms.GitHub.Releases`。
- [x] release ID 作为稳定 `external_ref`。
- [x] 映射 tag/name/body/published_at/prerelease/source_url/revision/hash。
- [x] 支持 include prerelease、draft、limit 等连接配置。
- [x] 实现 `Threads.Changelog` 的 validate/plan/project_preview/apply_in_transaction。
- [ ] 接入 Node publisher 后写入 Changelog Draft，不直接 publish。
- [x] 重复同步的 Mapping/Diff contract 已覆盖；正文 apply 恢复后再验证端到端幂等更新。
- [x] deleted/edited release 产生明确 diff，不自动删除本地内容。
- [ ] 后续增加 GitHub release webhook；第一阶段保留手动 sync。

当前验收：同一个 ContentImport Job/Mapping/Snapshot/Diff 基础设施可同时服务 Doc 与 Changelog，没有新增 `CMS.ChangelogImport` 平行系统；两类正文 apply 都等待统一 publisher 接入。

### Task 8：GraphQL 与 Dashboard 通用导入流程

依赖：Task 5、Task 6；Changelog 页面可随后接入。

> TODO（后续）：本轮暂不实现前端 Import Flow、Preview renderer 和 Docs/Changelog Dashboard 接入。先保留后端 typed Preview 边界；待 Task 8A 的 GraphQL interface/object、权限与分页 contract 冻结并完成测试后，再启动 Task 8B～8E 的前端设计与实现。

#### Task 8A：GraphQL contract

依赖：Task 5、Task 6。

- [ ] query：可用 platform、connection、job detail、plan preview、diff。
- [ ] job detail 提供 asset staging 汇总与分页状态，支持 UI 展示 pending/staging/ready/failed 数量和进度；不一次返回全部资源。
- [ ] mutation：validate connection、start import、apply plan、cancel、retry、sync。
- [ ] GraphQL 只暴露 public ref/hash，不暴露数据库 id。
- [x] 后端已提供 `ThreadAdapter.project_preview/1`、通用 `Preview/Preview.Item` 与 Doc/Changelog 各自的 Preview payload；不会把私有 Plan body 直接交给 API 层。
- [ ] GraphQL 将上述 Preview 映射为按 thread 判别的 union/object contract，并补 schema/resolver contract tests。
- [ ] plan preview 只暴露安全的 asset metadata/status；不返回 `staging_ref`、签名 URL、authorization 信息或 credential locator。
- [ ] owner/admin 授权覆盖 connection、preview、apply 和 sync。
- [ ] 明确 Job polling/subscription、分页、错误码和 partial failure contract。
- [ ] 为 query/mutation 增加 resolver、authorization 与 schema contract tests。

#### Task 8B：先冻结 Import UI/UX spec

依赖：Task 8A 的 API 状态与错误 contract；可在 resolver 实现期间并行评审。

状态：下面是待共同评审的通用持久化 Import Job spec；transaction ownership 与 thread-typed Preview 两项约束已决定，整体 spec 评审前不启动 Task 8C 组件实现。GitHub Bulk Import 确认前使用带 TTL 的 immutable PreviewRecord，不应把这里的所有内部状态一比一暴露给产品 Stepper。

- [ ] 定义状态：`idle/validating/pending/loading/planning/staging/ready/applying/completed/failed/cancelled`，并明确每个状态允许的操作。
- [ ] 定义刷新页面后的 Job 恢复、轮询停止条件、cancel/retry 和重复提交防护。
- [ ] 区分 connection/platform 错误、Entry 级 diagnostic、thread conversion 错误、asset staging 错误和 apply 错误。
- [ ] 定义 partial failure 交互：失败项筛选、显式跳过、重新拉取、阻止未确认的静默遗漏。
- [ ] 定义通用 layout slot：步骤、staging 进度、diagnostic、diff 列表、选择操作区和 thread-specific preview renderer。
- [x] Preview renderer 输入按 `thread` 使用 discriminated union；renderer 只接收安全 Preview DTO，不接收私有 Plan、Plan summary 或 `map()`，也不通过动态 key 猜测 thread schema。
- [ ] 定义大型来源的分页/虚拟列表、批量选择、搜索过滤和汇总信息，避免把所有 Entry 一次性渲染。
- [ ] 形成状态图、页面 wireframe 与组件责任表，评审后再开始 Task 8C。

##### 与 GitHub Bulk Import 的状态分层

两份文档描述的是不同层级，不能合并成一套枚举：

- 本节的 `validating/pending/loading/planning/staging/ready/applying/...` 是通用 ContentImport 执行状态，用于持久化 Job、恢复、诊断和运维。
- `bulk_import.md` 的 `idle/analyzing_repository/ready_for_review/importing/completed/failed` 是 Dashboard 产品 UI 阶段，用于三步 Stepper 和用户操作。
- GitHub Bulk Import 在用户确认前只有 Vercel Workflow + immutable PreviewRecord/DocsDataset，尚未创建 Phoenix Job；确认后才进入通用 Job 的 publishing/applying 状态。

映射固定如下：

| 通用执行阶段                                                                     | Bulk Import UI 阶段    | 说明                                                                                              |
| -------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| 本地输入校验、Workflow `queued/downloading/extracting/analyzing/target_planning` | `analyzing_repository` | Stepper 仍停在第一步，并显示具体进度                                                              |
| PreviewRecord `ready` / 通用 Job `ready`                                         | `ready_for_review`     | Bulk 首版在这个 UI 阶段尚未创建正式 Job                                                           |
| `publishing_bodies/applying`                                                     | `importing`            | 用户确认后才进入                                                                                  |
| `completed/failed/cancelled`                                                     | 对应终态               | `cancelled` 可表现为返回输入页，不必增加第四个 Step                                               |
| `staging`                                                                        | Bulk v1 不触发         | 通用状态用于资源下载与暂存；Bulk v1 不下载图片等资产。确认后有界发布 BodyBag 不称为 asset staging |

候选状态与操作矩阵：

| 状态                       | 页面主信息                                   | 允许操作                          | 禁止/约束                                       |
| -------------------------- | -------------------------------------------- | --------------------------------- | ----------------------------------------------- |
| `idle`                     | platform/connection/thread 配置              | validate、start                   | 不创建 Job                                      |
| `validating`               | connection 校验中                            | 取消本地请求                      | 禁止重复提交                                    |
| `pending/loading/planning` | 拉取与规划进度                               | cancel                            | 不展示可 apply 的 preview                       |
| `staging`                  | 资源总数与分页状态                           | cancel、查看失败详情              | 不允许 apply                                    |
| `ready`                    | diff、diagnostic、选择结果                   | apply、retry failed asset、cancel | failed content/asset 必须显式 retry 或确认 skip |
| `applying`                 | 已提交的 apply 选择与进度                    | 只读查看                          | 禁止二次 apply/cancel                           |
| `completed`                | create/update/skip 汇总与 Draft/Preview 入口 | 打开结果、启动新 sync             | 原 Job 不复用为新同步                           |
| `failed`                   | error domain/code、可恢复阶段                | retry、cancel                     | retry 复用同一 Job 与已持久化 staging 状态      |
| `cancelled`                | 取消时间与已完成清理状态                     | 启动新 Job                        | cancelled Job 不恢复执行                        |

恢复与轮询候选：

- URL 保存 Job public ref；刷新页面后先读 Job detail，再恢复对应步骤，不依赖页面内存保存 Plan。
- `pending` 到 `applying` 轮询 Job；进入 `completed/failed/cancelled` 后停止。页面不可见时降低频率，恢复可见时立即刷新一次。
- start/apply 使用服务端 idempotency key；按钮 disabled 只改善交互，不能作为防重复提交的唯一保证。
- asset detail 只分页返回安全 metadata、status、attempts 和错误码；不返回 `staging_ref`、credential locator、签名 URL 或 authorization。

错误与 partial failure 候选：

- `connection`：鉴权、配置和 rate limit；停在配置步骤。
- `platform`：fetch、分页、来源格式和 Snapshot；允许 retry fetch。
- `entry`：单条来源读取/规范化；在 preview 中定位到具体条目。
- `thread`：正文/tree/release 转换；展示 thread-specific diagnostic。
- `asset`：独立展示 source context、attempts 和 retry；不把单资源失败折叠成无上下文的 Job error。
- `apply`：事务或冲突失败；不提前更新 Mapping/checkpoint。
- Job 可以在存在 failed asset/content 时进入 `ready`，但 apply 前必须逐项 retry 或显式选择 `skip_items`；默认不静默遗漏。
- `source_deleted` 默认只提供 keep/unlink/archive 选择，本轮不自动删除本地内容。

组件责任候选：

```text
ImportFlow
|-- ConnectionStep
|-- JobProgress
|   `-- AssetStatusList          # 分页/虚拟列表
|-- DiagnosticPanel
|-- DiffSelection
|-- PreviewSlot                 # thread renderer 注入
`-- ApplyActions

DocPreviewRenderer             # tree/page/framework diagnostic
ChangelogPreviewRenderer       # release/tag/prerelease/draft
```

- `ImportFlow` 只拥有 Job public state、轮询、选择和 command，不 import Docs/Changelog 内容解析器。
- thread 页面传入配置 schema 与 Preview renderer；renderer 不自行提交 start/apply mutation。
- `PreviewSlot` 以 `preview.thread` 完成一次穷尽式分发，之后分别把 `TDocImportPreview`、`TChangelogImportPreview` 交给对应 renderer；renderer 内不得出现 `payload['type']`、`if payload.doc...` 等动态探测。
- 大型来源的 Entry/diff/asset 均服务端分页；汇总与筛选条件独立返回，不要求前端先下载全集。
- 每个组件单文件，salon 由使用组件自行调用；测试跟随 component/hook 相对目录。

前端冻结候选类型：

```ts
type TContentImportPreview =
  | { thread: 'doc'; payload: TDocImportPreview; items: TDocImportPreviewItem[] }
  | {
      thread: 'changelog'
      payload: TChangelogImportPreview
      items: TChangelogImportPreviewItem[]
    }

type TPreviewRendererProps<TPreview extends TContentImportPreview> = {
  preview: TPreview
}
```

后续新增 Post 时必须新增 union member、GraphQL fragment 和 `PostPreviewRenderer`；TypeScript exhaustive check 负责暴露漏接，不在通用 renderer 中增加动态 key 分支。

#### Task 8C：实现通用 Import flow

依赖：Task 8A、Task 8B。

- [ ] 抽出通用 Import flow：选择平台 → 连接 → 配置 → 拉取 → planning → asset staging → preview/diff → apply。
- [ ] 展示 platform 更新状态：in sync、updated upstream、local updated、conflict、deleted upstream。
- [ ] 所有前端类型使用 `type T...`。
- [ ] common flow 只管理 Job/状态/动作，不包含 Doc 或 Changelog 的内容解析与展示条件。
- [ ] component、hook、salon 按现有 frontend 目录职责拆分；一个文件不定义多个组件，下层组件自行调用 `useSalon()`。
- [ ] common flow 的 unit/integration tests 与组件相对目录一致，不建立集中式 `import-flow.test.tsx` 巨型测试。

#### Task 8D：接入 Docs

依赖：Task 6、Task 8C。

- [ ] `/dashboard/doc/import` 从占位页接入通用 flow，thread 固定为 `doc`。
- [ ] Docs 编辑器 import button 接入 route/dialog。
- [ ] 实现 Doc-specific tree/page preview、framework diagnostic 与页面选择。
- [ ] 测试放在与 Doc import route、组件、hook 对应的现有目录，不另建脱离产品目录的 `content-import-ui` 测试树。

#### Task 8E：接入 Changelog

依赖：Task 7、Task 8C。

- [ ] Changelog CMS 增加导入入口，复用同一 flow，thread 固定为 `changelog`。
- [ ] 实现 release-specific preview、prerelease/draft 标识与条目选择。
- [ ] 测试与 Changelog CMS 组件目录镜像，不混入 Docs import tests。

验收：先通过 UI/UX spec 评审，再分别完成 common flow、Docs 和 Changelog 接入；两类产品共享 Job API 与通用状态层，页面只提供 thread-specific 配置与 preview renderer；后端和前端测试均遵守各自当前目录设计。

### Task 9：扩展平台与生产化

依赖：至少完成一个 file-based 和一个 API-based 平台闭环。

- [ ] `Platforms.Notion.Database`。
- [ ] Notion block、property、status、分页和过期图片处理。
- [ ] `Platforms.Sanity.Dataset`。
- [ ] GROQ、Portable Text、asset 与 preview content 处理。
- [ ] GitHub App webhook/polling 更新检查。
- [ ] telemetry：平台耗时、entry 数、失败率、重试率、apply 耗时。
- [ ] platform rate limit/backoff。
- [ ] job concurrency、per-community quota 和滥用保护。
- [ ] 大型来源的分批 fetch/plan/apply。

---

## 历史方案：八、旧实施顺序

```text
Task 0 -> Task 1

Task 1 -> Task 2
       -> Task 3A
       -> Task 5

Task 2 + Task 3A -> Task 3B -> Task 4
Task 4 + Task 5  -> Task 6
Task 1 + Task 5  -> Task 7

Task 5 + Task 6  -> Task 8A -> Task 8B -> Task 8C
Task 6 + Task 8C -> Task 8D
Task 7 + Task 8C -> Task 8E

Task 7 + Task 8D + Task 8E -> Task 9
```

建议提交边界（按最终职责，而非旧文件顺序）：

1. namespace + typed contracts + hash/manifest contract，不改业务行为。
2. current DocImport cutover + 镜像目录 tests，不新增平台。
3. Workspace + ZIP/GitHub repository platform adapters。
4. Platform Snapshot → Doc integration。
5. Docs content conversion。
6. persistence schema + migrations + constraints + Snapshot/Plan codecs。
7. Docs Preparation + Checkpoints + server-owned idempotency。
8. Job.Item/Job.Asset + bounded AssetStager + staging lifecycle。
9. atomic apply + Mapping/source-deleted/Job completion。
10. GitHub Releases + Changelog thread。
11. GraphQL contract。
12. UI/UX spec + common flow + Docs/Changelog 分步接入。

每个提交都应能独立编译并通过 focused tests，避免把纯 rename、schema migration、业务 apply 和前端接入混在一个提交中。

---

## 历史方案：九、旧决策记录

### D1. Snapshot 正文保存位置

状态：架构已决定，生产存储待接线。

- 完整 Snapshot payload 统一通过 `PayloadStore` 保存，不按正文大小切换两套恢复路径。
- 数据库只保存 bounded Entry manifest、hash/version、diagnostic summary 和 opaque `payload_ref`。
- 测试使用内存 store；生产 object storage、TTL 和 orphan payload GC 属于 Task 9。

### D2. Connection 与 credential

状态：待确认。

需要确认是否复用现有 third-party integration credential 体系。无论采用哪种方式，token 都不能进入 Job、Snapshot、diagnostic 或 GraphQL 返回。

### D3. 首期同步语义

状态：已决定。首期 UI 主流程仍叫 Import，但数据模型从第一天保存 Connection、revision、hash、Mapping；“检查更新/手动 Sync”可以后开，不需要再迁移历史导入数据。

### D4. Docs partial failure

状态：已决定。Preview 可以展示部分失败；apply 必须通过持久化的逐项 selected/resolution 或显式 failed-content/asset policy 跳过，不能静默遗漏。

### D5. 来源删除的处理

状态：已决定并进入 Job.Item contract。`source_deleted` 不自动删除 Groupher 内容，由管理员逐项选择 `keep/unlink/archive`。

### D6. 本地与来源同时更新

状态：已决定并进入 Job.Item contract。第一阶段不做内容级自动 merge；`conflict` 逐项持久化 `local_wins/source_wins/manual/skip`，`manual` 进入人工处理，不在后台静默合并。

### D7. Thread transaction 与 Preview 类型边界

状态：已决定并进入 `ThreadAdapter` contract。

- transaction 只由 orchestrator 持有；Thread callback 不提供 standalone apply、不创建嵌套事务、不直接 rollback，也不把跨 Repo/外部系统副作用伪装成同一原子事务。
- 私有 Plan 使用 thread-specific `PlanPayload/ItemPayload`；GraphQL/UI 使用独立的 `PreviewPayload/ItemPreview`。aggregate 与 item 都必须和 `thread` 匹配。
- 前端通过 discriminated union 把 Preview 定型后再注入 renderer，不允许通过动态 key 检测内容类型。

---

## 历史方案：十、旧完成定义

本轮 ContentImport 重构完成需要同时满足：

- 旧 `CMS.DocImport` 已完整合并进 `CMS.ContentImport.Threads.Doc`，无双份实现和 compatibility facade。
- 现有 7 个 framework fixture/golden/test 不丢失；测试与 fixture 已按新 module 目录镜像移动并拆分，不保留巨型 `adapters_test.exs`。
- Entry SHA-256 canonicalization 与 Snapshot `manifest_hash` 有版本化 contract 和确定性测试。
- Entry/Snapshot revision 的层级语义已固定；Entry revision 缺失或不同于 Snapshot revision 时不会破坏 diff。
- Docs framework parse 已收敛为绑定 Snapshot manifest 的 Preparation；调用方不能把 Snapshot 与另一棵 SourceTree/Preparation 错配。
- Plan/ApplyResult 的 `target_ref` 来源明确；旧 `sourceMappings` 已收敛为领域 Mapping 与持久化 Mapping，不再依赖偶然的内存结构。
- Snapshot body 保持来源原貌；当前 Plan 正文为 `deferred` 且 assets 为空。恢复正文转换后，publisher 输入必须使用最终资源 URL，再生成 BodyBag，并具有失败回滚或补偿策略。
- `ThreadAdapter.plan/3` 不执行资源下载；Job.Asset + AssetStager 以有界并发完成可恢复 staging，数千资源不会产生无界 task，apply 会拒绝未决资源。
- Connection、Job、Job.Item、Job.Asset、Snapshot、Mapping 的 schema、migration、索引、唯一约束和 UTC 时间字段全部落地，migration 可 rollback。
- Snapshot/Preparation/Plan 有 versioned codec 与 durable PayloadStore contract；Job 行只保存 locator、bounded summary、progress 和逐项决策。
- ZIP/GitHub repository → Docs Snapshot/Preparation/Plan 可端到端运行；Preview Branch 正文写入 deferred。
- GitHub Releases → Changelog Plan 使用同一套 Job/Mapping/Snapshot/Diff；Changelog Draft 正文写入 deferred。
- 重复导入幂等，来源更新可检测，冲突不会静默覆盖。
- ready BodyBag contract 下，thread write、Mapping、source-deleted resolution 与 Job completion 可在一个数据库事务内提交；generated Plan 在正文 deferred 时不得进入该事务。
- Thread apply 只能在 orchestrator 已开启的同 Repo transaction 中执行；没有 standalone/nested transaction 旁路。
- 所有写入停留在 Draft/Preview，不绕过现有 publish lifecycle。
- GraphQL 不暴露数据库 id。
- 私有 Plan payload 不直接暴露给 GraphQL/UI；Preview aggregate/item 按 thread 使用显式类型，新增 thread 必须补齐对应 payload、projection、renderer 与镜像测试。
- UI/UX 状态与错误模型先于组件实现冻结；Docs 与 Changelog Dashboard 共用通用导入 flow，但测试仍留在各自产品与组件目录。

截至 2026-07-16，namespace、Snapshot/Preparation/Plan、Persistence、Mapping/Diff、Job orchestration 与 Preview projection 基础设施已保留并通过 focused tests；正文 BodyBag 生成、资源发布、生产 apply、GraphQL/前端和真实 worker 尚未完成，因此整份 ContentImport 计划仍是“实施中”，不能标记完成。
