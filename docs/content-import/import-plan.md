# Content Import：不可变 ImportPlan

> 状态：目标方案。
>
> 范围：公开 GitHub Repo → Groupher Docs 的 Analyze、Review、Apply 协议。本文不把批量导入
> 扩展到 Post/Changelog，也不改变 Node/Phoenix ownership、Files SDK、BodyBag staging 或 Docs
> 原子 Writer 边界。
>
> 前置：现有 `PreviewRecord`、versioned `DocsDataset`、SourceTree、Target Preview、ImportJob、
> JobItem、BodyBag staging、`ImportSourceMapping` 和 Process projection 均视为已经实现。
>
> Source of truth：总体 ownership 仍以 [`content-import-architecture.md`](./content-import-architecture.md)
> 为准；产品步骤以 [`bulk-import.md`](./bulk-import.md) 为准；临时对象与 staging 以
> [`import-file-sdk.md`](./import-file-sdk.md) 为准。本文新增的是 Review 与 Apply 之间的不可变执行契约。

## 1. 问题

当前 Preview 已保存 source revision、Dataset、tree、counts、target validation 和过程投影，但概念上
仍容易被理解成“给 UI 展示的分析结果”。Apply 接收选择后，还需要隐式重建将要执行的操作。

风险：

```text
Analyze commit abc123
  -> Preview 看到 42 pages
  -> 用户 Review
  -> Apply 时来源/映射/目标已变化
  -> 实际执行不再等于用户确认的内容
```

即使当前 immutable Dataset 和 `targetRevision` 已经挡住一部分漂移，也缺少一个明确对象回答：

> 用户确认的究竟是哪组操作、针对哪个 source/target 基线、每项发生冲突时采用什么决策？

## 2. 决策

把 Preview 的最终产物提升为不可变 `ImportPlan`：

```text
Platform Source
  -> immutable Source Snapshot
  -> SourceAnalysis / ThreadDataset
  -> Target Validation
  -> ImportPlan
  -> user Review decisions
  -> sealed ApplyIntent
  -> BodyBag staging
  -> Phoenix revalidation
  -> atomic Docs apply
  -> ImportSourceMapping
```

`ImportPlan` 不是新的 Workflow engine，不记录实时进度，也不替代 Dataset、ImportJob 或 staging。
它只是“可 Review、可验证、可执行”的不可变计划。

## 3. 具体例子

导入 `acme/docs` 的 commit `abc123`：

```json
{
  "schemaVersion": 1,
  "planRef": "plan_01",
  "previewRef": "preview_01",
  "datasetRef": "dataset_01",
  "source": {
    "platform": "github",
    "scopeRef": "acme/docs",
    "revision": "abc123",
    "analyzer": "vitepress",
    "analyzerVersion": "3"
  },
  "target": {
    "communityRef": "community_01",
    "thread": "doc",
    "branch": "main",
    "targetRevision": "tree_rev_18"
  },
  "operations": [
    {
      "operationRef": "op_1",
      "kind": "upsert_document",
      "externalRef": "docs/start.md",
      "sourceHash": "sha256:aaa",
      "targetRef": "doc_101",
      "route": "/guide/start",
      "mappingMode": "update_mapped",
      "bodyRef": "artifact://dataset_01/bodies/start"
    },
    {
      "operationRef": "op_2",
      "kind": "create_document",
      "externalRef": "docs/config.md",
      "sourceHash": "sha256:bbb",
      "route": "/guide/config",
      "bodyRef": "artifact://dataset_01/bodies/config"
    },
    {
      "operationRef": "op_3",
      "kind": "replace_tree",
      "treeRef": "artifact://dataset_01/tree"
    }
  ],
  "conflicts": [
    {
      "conflictRef": "conflict_1",
      "operationRef": "op_2",
      "code": "TARGET_ROUTE_EXISTS",
      "allowedDecisions": ["skip", "rename", "abort"]
    }
  ],
  "summary": {
    "create": 1,
    "update": 1,
    "skip": 0,
    "conflicts": 1
  }
}
```

用户 Review 后提交的不是一组松散 checkbox，而是对 Plan 的决策：

```json
{
  "planRef": "plan_01",
  "planDigest": "sha256:plan",
  "decisions": [
    {
      "conflictRef": "conflict_1",
      "decision": "rename",
      "value": "/guide/config-from-source"
    }
  ],
  "acknowledgements": ["overwrite_mapped_documents"]
}
```

服务端校验完整后生成 sealed ApplyIntent。后续 Apply 只能消费这个确定结果，不能在写入过程中重新解释
用户选择。

## 4. ImportPlan 与现有对象的关系

```text
PreviewRecord
  谁请求、属于哪个 community、TTL、Workflow ref

ThreadDataset
  来源被标准化后的内容、树、body artifacts、diagnostics

ImportPlan
  针对一个 target baseline，准备执行哪些 operation

ApplyIntent
  用户对 Plan 的选择、冲突决策和风险确认

ImportJob / JobItem
  Apply 的权威执行状态和 staging 状态

ImportSourceMapping
  Apply 成功后的长期来源关联与同步基线
```

不能合并：

- Plan 不承载 process/progress。
- Job 不重新承担来源分析。
- Dataset 不包含用户对目标冲突的决策。
- Mapping 不是某次执行日志。

## 5. Plan 不变量

### 5.1 不可变

Plan 创建后不更新 operations。用户更换选择、来源重新分析或 target baseline 改变时，创建新 Plan。

### 5.2 可寻址且可校验

Plan 至少绑定：

```text
previewRef
datasetRef + dataset digest
source revision
analyzer/version
community/thread/branch
targetRevision
operations digest
expiresAt
```

Apply 同时提交 `planRef + planDigest`，防止客户端确认 A 却执行 B。

### 5.3 Operation identity 稳定

`operationRef` 在 Plan 内稳定，重试不能重新编号。它不是 Domain resource identity，也不是 JobItem
数据库主键。

### 5.4 typed operation

首期只允许 Docs 已知操作：

```text
create_document
update_mapped_document
restore_mapped_document
create_tab
create_group
replace_tree
upsert_mapping
```

不能把操作退化成自由形式 `{table, action, attrs}`。

### 5.5 Plan 不能承诺部分 Apply

Docs Writer 仍执行整棵树原子事务。JobItem/operation 的完成状态用于 preparation/staging 和诊断；
最终 Docs apply 成功则全部可见，失败则全部回滚。

## 6. Analyze 与 Plan 构建

Node 继续拥有：

```text
source access
framework analysis
immutable source snapshot
ThreadDataset
BodyBag generation
```

Phoenix 继续拥有：

```text
Gate admission
targetRevision
existing Mapping
Trash restore eligibility
route/tree conflicts
domain write constraints
```

因此 Plan 是双方事实的组合，但由 Node orchestration 保存为 Preview artifact：

```text
Node Dataset facts
       +
Phoenix Target Preview facts
       |
       v
canonical ImportPlan artifact
```

Phoenix Target Preview 必须返回足够稳定的 operation inputs，不让 Node 猜测数据库内部规则。

## 7. Review

Review 页面从 Plan 渲染，而不是重新推导：

```text
来源：acme/docs @ abc123
目标：Docs main Draft @ tree_rev_18

将创建      12
将更新      30
将恢复       2
将跳过       0
冲突         1
```

Review 决策分三类：

```text
selection
  选择允许导入的 source items；首版全量时固定为 all

conflict decision
  skip / rename / abort 等服务端声明的有限选项

risk acknowledgement
  overwrite mapped docs、restore trash action 等明确风险确认
```

前端不能提交服务端未在 Plan 中允许的 decision。

## 8. Apply

### 8.1 Admission

```text
POST apply(planRef, planDigest, decisions, commandId)
  -> load immutable Plan
  -> verify owner/community/TTL
  -> verify digest and decisions
  -> Gate doc.import
  -> revalidate source Dataset artifacts
  -> revalidate targetRevision and mapped targets
  -> create ImportJob + JobItems
  -> return jobRef
```

Apply admission 成功后，Back/reset 不能把已创建的 Job 当作临时 Preview 删除。

### 8.2 Prepare 与 staging

Publisher 逐批处理 Plan operations：

```text
operationRef
  -> read immutable body artifact
  -> shared Import Content conversion
  -> BodyBag
  -> stage against matching JobItem
```

相同 `jobRef + operationRef + body digest` 重放是幂等的；digest 不同是 identity conflict。

### 8.3 Final apply

```text
lock Job + target Draft/Tree
  -> verify every required JobItem ready
  -> revalidate targetRevision
  -> execute sealed operation set
  -> update mappings and groupher_hash
  -> mark completed
  -> commit once
```

不允许 final Writer 新增 Plan 外的 source item，或静默把 conflict decision 改成另一种行为。

## 9. 优势

| 问题                      | 只有 Preview            | 不可变 ImportPlan                |
| ------------------------- | ----------------------- | -------------------------------- |
| Preview 与 Apply 是否一致 | 依赖隐式实现            | digest 和 operation set 可验证   |
| 用户确认了什么            | UI 状态                 | 持久 decisions/acknowledgements  |
| 来源是否漂移              | 靠 commit 字段零散判断  | source revision + dataset digest |
| 目标是否漂移              | targetRevision conflict | targetRevision 是 Plan 前提      |
| 重试是否重复创建          | 依赖外围幂等            | operation identity + JobItem     |
| 失败定位                  | item/stage 信息         | 可对应到明确 operation           |
| dry-run                   | 近似 Preview            | Plan 本身就是 dry-run 结果       |
| 审计                      | 只能看最终 Job          | 可回答计划、确认、执行三者差异   |

最重要的收益是确定性，而不是多保存一份 JSON。

## 10. 与 `CMS.Command` 的关系

`ApplyImportPlan` 是具体 Domain Command；`CMS.Command` 不是每个 ImportPlan 或 transport 的专属模块：

```text
GraphQL apply mutation
  -> ContentImport.ApplyPlan domain command
       -> Gate / Plan validation / Job creation
       -> CMS.Command shared execution boundary
            -> transaction / command receipt / retry recovery
```

长时间的 Node conversion 不放进一个数据库事务。`CMS.Command` 只包裹需要原子确认的 admission、
batch staging 或 final apply；Workflow/Job 负责跨请求进度。

## 11. API 演进

目标 contract：

```text
POST /preview
  -> previewRef

GET /preview/:previewRef
  -> process + planSummary

GET /preview/:previewRef/plan
  -> ImportPlan for Review

POST /preview/:previewRef/apply
  { planRef, planDigest, decisions, acknowledgements, commandId }
  -> jobRef

GET /jobs/:jobRef
  -> authoritative Process projection
```

GraphQL 可以继续承担 Phoenix Job read/write transport；Node 内部 API 不因此复制 Domain writer。

## 12. 分阶段迁移

### Phase 0：命名与 artifact 收口

- 审计现有 Preview/Dataset/Target Preview 中已经具备的 Plan 字段。
- 定义 canonical Plan schema、digest 和 artifact path。
- 保持当前全量导入 UI，不增加部分选择。

### Phase 1：Plan-driven Review

- Analyze 最终生成 Plan artifact。
- Review 只从 Plan 渲染 summary、tree、existing import 和 conflicts。
- apply request 携带 `planRef + digest + acknowledgement`。

### Phase 2：Plan-driven Job

- JobItem 保存 `operationRef` 和 operation digest。
- Publisher 只消费 sealed operation set。
- final Writer 验证 operations 全部 ready 后原子 apply。

### Phase 3：选择与冲突决策

- 在真实产品需要时开放部分选择。
- 增加有限、类型化 conflict decisions。
- 改变选择或 target baseline 时创建新 Plan，不修改旧 Plan。

### Phase 4：审计与 no-op 优化

- 保存 Plan/decision/job 的有界关联摘要。
- source hash 与 groupher hash 均未变化时生成 explicit no-op operations。
- 不把 Plan 扩展成通用 workflow/event log。

## 13. 验收标准

- Review 展示的 operation set 与 Apply 消费的 operation set digest 相同。
- source revision、Dataset 或 targetRevision 漂移时 Apply 明确失败，不静默重新分析。
- decisions 只能引用 Plan 中的 conflict/operation，且只能使用 allowed values。
- 同一 operation 重放不重复创建 Doc、Mapping 或 Job progress。
- final Docs Writer 继续保持整棵树原子提交。
- Process 仍是投影，不成为 Plan 或 Job 的正确性来源。
- Preview cleanup 不删除已 admission 的 ImportJob 或正式 Docs/Mapping。
- Plan 过期、digest mismatch、target conflict 和 permission failure 使用稳定错误码。

## 14. 非目标

- 通用 BPM/workflow engine。
- 可变 Workflow Session。
- 用 Plan 取代 ThreadDataset、BodyBag、JobItem 或 ImportSourceMapping。
- 在 Apply 时重新访问或重新解析外部仓库。
- 为显示逐项写入进度拆分 Docs 原子事务。
- 在第二个真实 Thread importer 出现前抽象通用动态 operation registry。
