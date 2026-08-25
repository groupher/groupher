# Content Import Process 与 Process Log

> 状态：v1 已实现。Preview 采用 Node 派生投影，Job 采用 Phoenix 持久事实投影，Browser 统一轮询快照。
>
> 范围：定义 Content Import 在 Preview 与 Job 两个执行阶段中，如何生成、保存、投影和轮询用户可见的过程信息，以及前端 `ImportProcessLog` 的通用边界。
>
> 关联文档：[`content_import_architecture.md`](./content_import_architecture.md) 负责跨来源总体架构；[`bulk_import.md`](./bulk_import.md) 负责 GitHub Docs 产品流程；[`import_file_sdk.md`](./import_file_sdk.md) 负责 PreviewStore、Files SDK 与 PostgreSQL staging；[`import_error_handling.md`](./import_error_handling.md) 记录错误透传、Back/reset 与联调复盘。
>
> 本文不改变 `Platform -> Source -> ThreadDataset -> Thread -> ImportSourceMapping` 总体边界，也不把 Preview 与 ImportJob 合并成一个新的 Workflow Session。

## 1. 结论

统一能力采用以下命名：

```text
领域模型 / 投影模块   ContentImport.Process
前端公共类型          TImportProcess
API / GraphQL 字段    process
前端展示组件          ImportProcessLog
最近批次              recentBatch
未来精细阶段报告器    ProcessReporter
```

`Process` 不是独立后台任务，也不是新的持久化业务实体。它是一个有界的用户可见执行过程投影。v1 不为 Preview 新增 Process Store：Preview 从 Workflow 状态和 artifacts 推导，Job 从数据库中的 Job 与 JobItem 投影。

浏览器仍然通过轮询读取当前快照：

```text
Preview：Workflow / artifacts ── project ──▶ Process
Job：    Executor ── update Job facts ── project ──▶ Process
Browser：──────────────────── poll Process API ────▶
```

完整关系如下：

```text
                        Content Import
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
       Preview Process                    Job Process
       用户确认之前                       用户确认之后
             │                                 │
       Node / Workflow                    Phoenix / DB
             │                                 │
      previewRef 轮询                      jobRef 轮询
             │                                 │
             └────────────────┬────────────────┘
                              │
                              ▼
                       TImportProcess
                     统一的前端过程快照
                              │
                              ▼
                      ImportProcessLog
```

## 2. Process 与 Log 的命名边界

### 2.1 `Process`

`ContentImport.Process` 表示当前可展示的执行过程，包含：

- 当前执行状态。
- 当前阶段。
- 已完成数量和总量。
- 最近完成的有界批次。
- 最后更新时间。

它不包含：

- 完整后台日志。
- Markdown、BodyBag 或来源正文。
- Workflow retry 事实的完整副本。
- 用于 apply、幂等或恢复的权威 checkpoint。
- credential、临时路径、Blob key 或数据库 id。

### 2.2 `ProcessLog`

`ImportProcessLog` 只指前端展示组件。它看起来类似一段过程日志，但不会无限追加，也不承担审计用途。

```text
当前阶段
+ 真实数量
+ 最近一批结果
+ 最后更新时间
```

后端公共契约不命名为 `Log`，避免让调用方误以为它是 append-only audit log 或需要永久保存的事件流。

## 3. 产品步骤与 Process 阶段

产品仍然只有三个用户步骤：

```text
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ ① 选择来源   │ ───▶ │ ② 检查内容   │ ───▶ │ ③ 确认导入   │
└──────────────┘      └──────────────┘      └──────────────┘
```

`Process` 解释某个产品步骤内部正在发生什么：

```text
① 选择来源
│
├─ analyzing
└─ building_preview

② 检查内容
│
└─ 等待用户决策，不轮询后台执行过程

③ 确认导入
│
├─ preparing
├─ applying
└─ completed
```

`analyzing`、`preparing` 等内部阶段不能提升为新的产品 Stepper 步骤。

`preparing` 是面向用户的聚合阶段，包含来源内容转换、BodyBag 构建和 PostgreSQL staging。内部 Job status `staging` 不再单独暴露为一个 Process stage。

## 4. 公共契约

```ts
type TImportProcessState = 'queued' | 'running' | 'completed' | 'failed'

type TImportProcessStage = 'analyzing' | 'building_preview' | 'preparing' | 'applying'

type TImportProcessUnit = 'document' | 'release' | 'discussion' | 'post' | 'comment'

type TImportProcessItem = {
  ref: string
  label: string
  state: 'completed' | 'failed' | 'skipped'
}

type TImportProcess = {
  state: TImportProcessState
  stage: TImportProcessStage
  progress?: {
    completed: number
    total?: number
    unit: TImportProcessUnit
  }
  recentBatch: TImportProcessItem[]
  updatedAt: string
}
```

约束：

- `recentBatch` 最多返回 5 项。
- `completed` 和 `total` 必须来自真实执行数据，不能按前端计时推测。
- 总量尚不可知时省略 `total`，不显示假百分比。
- 不提供 `currentRef`，不追求精确到“此刻正在转换哪一项”。
- `recentBatch` 表示已经完成处理的最近批次，不能标记为“正在处理”。
- Preview v1 不生成批次进度，固定返回空的 `recentBatch`，并省略 `progress`。
- 后端返回稳定枚举和安全数据，最终文案由前端 i18n 生成。
- `updatedAt` 是服务端提供的稳定时间标记，不是连接状态、heartbeat 或失败判据。Job 使用 `job.updated_at`；Preview v1 的 artifact 尚未携带时间，因此使用 `analysisRun.createdAt`，不存在 run 时回退到 `PreviewRecord.createdAt`。

v1 的阶段映射是有意粗粒度的：

```text
Preview：analyzing -> building_preview
Job：    preparing -> applying
```

`fetching` 暂不进入公共枚举。当前 `analyzeSourceStep` 没有暴露下载与分析之间的可靠边界；只有在未来引入真实阶段报告后，才重新评估是否增加该阶段。

## 5. 总体 Push / Pull 模型

```text
       Preview Workflow                    Job Executor
              │                                │
              │ 产生状态与 artifacts            │ 更新 Job / JobItem
              ▼                                ▼
    Workflow + PreviewStore          ImportJob + Job.progress
              │                                │
              └────────── Read + Project ──────┘
                               │
                               ▼
                    ContentImport.Process
                           Projector
                               │
                               │ API Snapshot
                               ▼
                       ImportProcessLog
                         Browser Poll
```

因此浏览器侧统一是 Pull；执行侧是否写入 Process 事实取决于阶段：

```text
Preview Executor ── 产生权威状态/artifacts ──▶ Projector
Job Executor     ── push/update Job facts ───▶ Projector
Browser          ─────── poll Process API ───▶ Projector
```

第一版继续使用轮询，不引入 SSE、WebSocket 或 GraphQL Subscription。阶段和批次级信息不要求毫秒级延迟，约 1～2 秒的可见延迟可以接受。

## 6. Preview Process

### 6.1 执行边界

用户确认之前只有 Node Workflow、PreviewRecord、ThreadDataset 和 Review，不创建 Phoenix ImportJob：

```text
Browser
   │
   │ POST 创建 Preview
   ▼
Node Route
   │
   │ start
   ▼
Workflow
   │
   ├── 获取来源
   ├── 分析来源
   ├── 生成 ThreadDataset
   └── 构建 Target Preview
```

### 6.2 数据如何生成

Preview v1 不新增 `PreviewProcessStore`，也不要求 Workflow 主动写 Process Snapshot。Preview API 只组合已经存在的权威事实：

```text
Workflow Run status
+ ThreadDataset / Preview artifacts existence
───────────────────────────────────────────────
TImportProcess
```

当前 `analyzeSourceStep` 内部包含下载、解压、框架识别和来源分析，但这些动作没有独立、可靠的外部状态。因此 v1 不伪造 `fetching -> analyzing` 的细分进度，也不提供 Preview `recentBatch`。

### 6.3 Preview 阶段投影

```text
Workflow / artifact 事实                     Process 投影
────────────────────────────────────────────────────────────
Workflow queued                              queued / analyzing
Workflow running，Dataset artifact 不存在    running / analyzing
Dataset artifact 已存在，ready 不存在         running / building_preview
ready artifact 已存在                        completed / building_preview
Workflow failed，Dataset artifact 不存在      failed / analyzing
Workflow failed，Dataset artifact 已存在      failed / building_preview
```

Preview 内部可以继续使用 `queued -> running -> ready` 的状态机。公共 Process 将 `ready` 投影为 `state: completed`，不把 Preview 专属的 `ready` 提升为通用 Process state。

Preview v1 的 artifact 和 Workflow status 读取结果尚未携带变更时间，因此 `updatedAt` 使用 `analysisRun.createdAt`，不存在 run 时回退到 `PreviewRecord.createdAt`。它是稳定的服务端时间标记，不承担 heartbeat 或失败判定；未来 artifact 增加时间字段后，再在 Projector 内选择最新值。

### 6.4 浏览器如何读取

```text
Browser           Preview API          Workflow       PreviewStore
   │                   │                  │                 │
   │ POST preview      │                  │                 │
   ├──────────────────▶│ start workflow   │                 │
   │                   ├─────────────────▶│                 │
   │◀──── previewRef ──┤                  │                 │
   │                   │                  │                 │
   │ GET preview       │                  │                 │
   ├──────────────────▶│ read run status  │                 │
   │                   ├─────────────────▶│                 │
   │                   │ inspect artifacts│                 │
   │                   ├────────────────────────────────────▶│
   │                   │ project process  │                 │
   │◀── Process DTO ───┤                  │                 │
   │                   │                  │                 │
   │ GET preview       │                  │                 │
   ├──────────────────▶│ repeat projection│                 │
   │◀── Process DTO ───┤                  │                 │
```

优先级固定为：

```text
ready receipt / terminal failure
          >
authoritative Workflow state
          >
artifact-derived intermediate stage
```

## 7. Job Process

### 7.1 执行边界

用户确认后才创建 Phoenix ImportJob：

```text
ready ThreadDataset
        │
        ▼
create ImportJob + JobItems
        │
        ▼
prepare bounded item batch
        │
        ▼
PostgreSQL staging
        │
        ▼
Thread Writer
        │
        ▼
completed / failed
```

### 7.2 数据如何生成

执行端不向单独的 Process 服务发送完整日志。它在处理业务事实时同步更新 Job：

```text
Node Publisher
      │
      │ 完成一个有界批次
      ▼
stageContentImportBodies
      │
      ├── 更新 JobItem 状态
      ├── 更新 completed / total
      ├── 从本批 JobItem 写入 bounded recentBatch
      └── 更新 Job.progress
```

以上动作发生在现有 staging mutation 的同一个 Phoenix 数据库事务中。`recentBatch` 来自本次已经成功提交的 batch，而不是额外查询“最近更新”的任意 JobItem：

```text
stage request 中的 external refs
             │
             ▼
本批已锁定并更新的 JobItem
             │
             ├── external_ref -> ref
             └── metadata.sourcePath -> label（Docs）
             │
             ▼
Job.progress.recentBatch（最多 5 项）
```

`label` 是公共展示字段，但取值由具体 Thread 决定。对 Docs，用户最容易识别的是稳定的来源文件路径，因此直接使用 `metadata.sourcePath`，不把文档标题写入 `recentBatch`。未来其他 importer 可以使用自己的可识别标签：

```text
Docs        metadata.sourcePath
Changelog   Release tag / title
Post        Discussion / Topic title
```

staging 每批本来就会刷新一次 Job progress，因此增加 `recentBatch` 不应产生额外 mutation、事务或 Blob 往返，也不需要在 Node Publisher 中为它增加单独的节流逻辑。浏览器 1～2 秒轮询会自然合并期间完成的多批结果，只展示最新批次即可。

刷新 progress 时需要保留非 bodies 字段，不能用新的计数 map 意外覆盖 `recentBatch` 或其他 Process 信息。

`ContentImport.Process` 读取并投影：

```text
ImportJob.status
+ ImportJob.progress
+ 最近完成的 JobItem batch
──────────────────────────────
TImportProcess
```

`Job.progress` 可以继续是内部 map，但 GraphQL/UI 不应继续直接读取 `progress.bodies`、`progress.pages` 等 thread-specific key。公共 API 应返回类型化 `process`。

### 7.3 Job 时序

```text
Browser          Node Publisher         Phoenix Job          Process Projector
   │                   │                    │                       │
   │ POST apply        │                    │                       │
   ├──────────────────▶│ create job         │                       │
   │                   ├───────────────────▶│                       │
   │◀──── jobRef ──────┤                    │                       │
   │                   │                    │                       │
   │                   │ prepare batch      │                       │
   │                   │ items 1～4          │                       │
   │                   ├──── stage batch ──▶│                       │
   │                   │                    │ update progress       │
   │                   │                    │ 4 / 42                │
   │                   │                    │ recentBatch           │
   │                   │                    │                       │
   │ poll job          │                    │                       │
   ├───────────────────────────────────────▶│                       │
   │                   │                    ├──── project ─────────▶│
   │◀────────────────── TImportProcess ─────────────────────────────┤
   │                   │                    │                       │
   │                   │ prepare batch      │                       │
   │                   │ items 5～8          │                       │
   │                   ├──── stage batch ──▶│ update 8 / 42         │
```

## 8. Apply 阶段

Docs 最后的 Writer 使用整批原子事务。事务内部尚未提交的逐项写入不能表现为已完成进度：

```text
preparing  42 / 42
     │
     ▼
applying
“正在写入 Docs Draft”
     │
     │ 一个原子事务
     ▼
completed / failed
```

禁止展示：

```text
正在写入第 31 / 42 篇
```

因为事务失败时 31 篇会全部回滚，这种信息会误导用户。

v1 不为了让 `applying` 对轮询可见而拆分 Writer 事务。当前 Writer 在同一个事务中完成：

```text
lock Job
   │
   ├── ready -> applying
   ├── 写入内容、目录与 Mapping
   └── applying -> completed
          │
          ▼
       transaction commit
```

事务提交前，其他请求通常观察不到中间的 `applying`。如果执行进程在事务中崩溃，数据库会回滚，Job 留在 `ready`，不会产生一个已经提交但无人处理的 stale `applying`。

Process Projector 使用以下映射补足用户视角：

```text
Job status = staging                         -> running / preparing
Job status = ready 且 bodies.pending = 0     -> running / applying
Job status = applying                        -> running / applying
Job status = completed                       -> completed / applying
Job status = failed 且 bodies.pending > 0     -> failed / preparing
Job status = failed 且 bodies.pending = 0     -> failed / applying
```

因此，Job 已经准备完全部材料、等待或正在进入原子写入时，UI 可以稳定显示“正在写入目标”，同时不破坏现有事务边界。

`ready + pending = 0` 会让 UI 比 Writer 事务真正开始早几百毫秒进入 `applying`；这是有意的用户视角窗口，含义是“材料已经就绪，正在进入最终写入”，不是“数据库事务已经开始”。

如果 Writer 因 `targetRevision` conflict 等原因回滚，Job 的 bodies 计数仍然是 `pending = 0`，随后失败处理将其推进为 `failed / applying`。阶段不会回退到 `preparing`：

```text
running / applying -> completed / applying
                   -> failed / applying
```

`ImportProcessLog` 不需要用延迟或动画掩盖合法失败，只需保证同一个 `previewRef` / `jobRef` 的旧轮询响应不能覆盖新响应，避免网络乱序造成视觉上的阶段倒退。

v1 不增加 `applying + updated_at` 超时巡检。单纯按时间把 `applying` 改成 failed 可能误伤合法的慢事务；未来如果某个 Writer 必须把 `applying` 持久化为独立 admission，应同时设计 claim/lease、heartbeat、幂等重试与恢复，而不是只拆事务和增加超时失败。

通用层不能承诺所有 Thread 都采用整 Job 原子写入：

- Docs coherent tree 可以 Job-wide atomic apply。
- Changelog/Post 未来可以采用 item/batch transaction。
- comments/reactions 使用独立 enrichment Job。

因此通用 Process 只使用 `applying`，具体原子性说明由各产品页面负责。

## 9. 跨产品复用

```text
                          ImportProcessLog
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
    Docs Import            Changelog Import           Post Import
        │                        │                        │
unit=document              unit=release          unit=discussion
        │                        │                        │
最近文档路径                最近 Release / tag       最近 Discussion 标题
        │                        │                        │
Doc Preview                Changelog Preview          Post Preview
独立实现                    独立实现                   独立实现
```

来源与目标映射：

| Platform / Source  | Dataset            | Groupher Thread | Process unit |
| ------------------ | ------------------ | --------------- | ------------ |
| GitHub Repo files  | `DocsDataset`      | `doc`           | `document`   |
| GitHub Releases    | `ChangelogDataset` | `changelog`     | `release`    |
| GitHub Discussions | `PostDataset`      | `post`          | `discussion` |
| Discourse Topics   | `PostDataset`      | `post`          | `discussion` |
| GitHub Issues      | `PostDataset`      | `post`          | `post`       |
| Comments stream    | enrichment Dataset | enrichment Job  | `comment`    |

Groupher 没有 `discussion` Thread。`discussion` 只作为来源和 Process unit，最终仍进入 `PostDataset -> post`。

通用化只发生在过程投影、轮询和展示层。Docs、Changelog、Post 的配置、Preview renderer、错误解释和 Writer 必须保持产品独立。

## 10. `ImportProcessLog` 展示

```text
┌─ ImportProcessLog ─────────────────────────────┐
│                                                │
│  ✓ 获取来源                                    │
│  ✓ 分析内容                         183 items  │
│  ● 准备导入                          27 / 42   │
│  ○ 写入目标                                    │
│                                                │
│  最近处理                                      │
│    ✓ docs/guide/configuration.md                │
│    ✓ docs/guide/installation.md                 │
│    - docs/api/large-reference.md   已跳过       │
│                                                │
└────────────────────────────────────────────────┘
```

展示规则：

- 默认展示当前阶段、真实数量和最多 5 条最近批次结果。
- 每个真实阶段可以附带若干 activity details，解释该阶段包含的工作；details 不拥有独立状态或完成标记，不能伪装成后台尚未报告的细粒度进度。
- 动态数字使用 tabular numbers，避免轮询更新时宽度跳动。
- 只有阶段变化需要 `aria-live` 播报；recent batch 更新不能每 1～2 秒打断读屏。
- 只有轮询请求连续失败时才显示“连接中断，正在重试”。`updatedAt` 长时间不变不代表断线或执行失败，尤其不能把长时间运行的 Preview `analyzing` 判为失败。
- 页面不可见时降低轮询频率；重新可见时立即刷新一次。
- 上一次请求完成后再安排下一次轮询，避免请求重叠和旧响应覆盖新状态。

## 11. 模块责任

```text
Process Facts
│
├── Preview
│   └── Workflow status + immutable Preview artifacts
│
└── Job
    └── staging / apply 更新 Job.progress 与 JobItem 状态

Preview Process Projector（Node）
  Workflow status + artifacts -> TImportProcess
  与 Preview API Route 位于同一运行时

Job Process Projector（Phoenix）
  ImportJob + Job.progress -> TImportProcess
  不执行导入，不改变 Job 状态机

Process API
  返回当前快照

ImportProcessLog
  只负责展示
```

v1 实现目录：

```text
backend/api/lib/groupher_server/cms/content_import/
`-- process.ex

frontend/dashboard/src/lib/content-import/core/process/
|-- contract.ts
`-- previewProjector.ts

frontend/core/unit/DashboardThread/CMS/ContentImport/ProcessLog/
|-- index.tsx
|-- decoder.ts
|-- ProcessStep.tsx
|-- RecentBatch.tsx
`-- salon/
```

Node `previewProjector.ts` 只服务 Preview Process，因为 Workflow status、PreviewStore 和 Preview API 都位于 Node runtime。Phoenix `process.ex` 只负责从数据库投影 Job Process。两者实现同一公共契约，但不跨运行时远程调用彼此。

后端在第二个真实 Thread Writer 出现前，不为 Process 恢复通用 plugin registry 或动态 dispatcher。当前只需要从 ImportJob 投影公共 Process contract；Changelog/Post 接入时再抽共享 behaviour。

`ProcessReporter` 不是 v1 前置模块。只有未来需要把 `analyzeSourceStep` 内部的下载、分析或其他长耗时动作暴露为真实阶段时，才引入窄接口的 Reporter；Reporter 仍只能更新显示投影，不能成为 Workflow 正确性或恢复逻辑的依赖。

## 12. 权威状态与一致性

Process 永远不能成为业务正确性的唯一依据：

```text
Preview：Workflow state + immutable artifacts 是权威状态
Job：ImportJob + JobItem + staging rows 是权威状态
Process：面向 UI 的有界投影
```

投影优先级：

```text
terminal business state
        >
authoritative execution state
        >
derived intermediate stage
```

因此：

- Job 已完成时，即使 `recentBatch` 落后，也必须返回 `completed`。
- Preview 已 ready 时必须返回 `completed/building_preview`，不能被较早的 Workflow running 状态覆盖。
- Job failed/cancelled 后不允许旧 progress 覆盖终态。
- Preview Process 的推导失败只能影响观感，不能让业务 Step 失败。
- `updatedAt` 不是 heartbeat；超时失败与执行恢复必须由 Workflow 或 Job 的权威机制判断。

## 13. 非目标

首版不实现：

- 精确逐项实时追踪。
- 完整 append-only event log。
- 审计日志、日志搜索和下载。
- SSE、WebSocket、GraphQL Subscription。
- Preview 独立的 `PreviewProcessStore` 与 `recentBatch`。
- 为 Preview v1 改造 `analyzeSourceStep` 内部逻辑或引入 `ProcessReporter`。
- 为展示 `applying` 拆分 Docs Writer 原子事务。
- 跨 Workflow/Phoenix 的统一可变 Session。
- 将 Preview 与 Job 合并成同一个 public ref。
- 把 `BadSmell`、Job error 或完整 item diagnostics 塞进 Process。
- 在通用 UI 中理解 SourceTree、Release、Discussion 或 Post 的产品结构。

## 14. 已实施路径

1. `TImportProcess`、GraphQL/HTTP 字段和枚举语义已经冻结并接入。
2. staging batch 在现有事务中写入 bounded `recentBatch` 和真实计数。
3. Phoenix Job Process Projector 已实现 status/progress 投影和 `ready + pending = 0 -> applying` 规则，没有拆 Writer 事务。
4. 通用 `ImportProcessLog` 已接入 Docs Preview 与 Job 流程。
5. Node Preview API 已从 Workflow status 和 artifacts 投影粗粒度 Process。
6. Preview 的纯 loading 已替换为 `analyzing -> building_preview` 阶段展示。
7. Changelog/Post 等第二个真实 importer 仍是后续验证点；届时再决定是否抽更多后端 behaviour。

## 15. 验收要求

### Preview

- 创建 Preview 后立即返回 `previewRef`，Browser 不保持长连接。
- 页面刷新后可以恢复 Process。
- 阶段由 API 根据 Workflow 和 artifacts 投影，不由浏览器计时推测。
- `analyzeSourceStep` 运行时显示 `analyzing`，不伪造无法验证的 `fetching`。
- Dataset 已生成而 ready 尚不存在时显示 `building_preview`。
- `ready.json`、Workflow failure 等终态始终覆盖中间阶段。
- Preview 不创建独立 Process Snapshot，也不返回虚假的批次进度。

### Job

- 相同 batch 重放不会让 completed count 重复增长。
- `recentBatch` 有界，不随导入规模增长。
- `recentBatch` 与对应 JobItem/计数在同一次 staging 事务中提交。
- Job terminal state 始终覆盖旧 progress。
- 刷新页面后可以通过 `jobRef` 恢复。
- Apply 阶段不展示未提交的逐项写入进度。
- Writer 保持现有原子事务，不为了显示 `applying` 提前提交状态。
- Writer 失败回滚后投影为 `failed / applying`，不能回退成 `preparing`。
- Docs 原子事务失败后不留下用户可见的部分结果。

### UI

- 不显示假百分比。
- 不显示精确当前文件。
- 支持 document、release、discussion 等不同 unit。
- recent batch 更新不会持续触发读屏播报。
- 动态数字不产生明显布局跳动。
- 轮询请求不重叠，页面隐藏时降频，恢复时立即刷新。
- 同一 ref 的旧轮询响应不能覆盖新状态，Process stage 不因网络乱序倒退。
