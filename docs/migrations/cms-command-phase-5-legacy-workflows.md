# CMS Command Phase 5：Legacy Mutation 分类与迁移

> 状态：in progress（typed identity、Tag/Asset concrete Command 已实施；§11 命令集已 verified，Phase 5 其余 family 仍未收口）
>
> 范围：Tag / TagGroup、Assets，以及尚未逐项确认写入合同的 CMS mutation。
>
> 前置文档：
> [CMS Command、Gate、Lifecycle 与 Persistence 边界](./cms-command-gate-lifecycle-persist-boundary.md)、
> [CMS Command](../architecture/cms-command.md)、
> [CMS Domain Outbox](../architecture/cms-outbox.md)。

## 1. 结论

现有 `CMS.Command` 内核、首批 concrete Command、Gate facade 和客户端 `commandId` owner 已经完成，
但这不等于所有 CMS mutation 都完成迁移。当前真正未收口的是旧 `Writer`、`Facade` 或 workflow
仍同时持有以下职责：

- 解释完整业务动作；
- 执行 Gate admission；
- 开启数据库事务；
- 写 Audit、Activity 或 Outbox；
- 生成被命名为 `command_id` 的内部 UUID；
- 决定重试、幂等和 response 丢失后的恢复语义。

Phase 5 不把所有写入机械塞进 `CMS.Command`。它先为每个 mutation 建立 concrete use case，再按
ambiguous commit、结果恢复和已有领域 workflow 判断执行协议：

```text
GraphQL / service callback / maintenance scheduler
  -> public CMS facade
  -> concrete Command or named domain workflow
       -> Gate / service admission
       -> Lifecycle or version authority（仅在真实需要时）
       -> one transaction owner
       -> Persist primitives
       -> Audit / Activity / Outbox intent
  -> canonical result
```

目标不是得到“所有路径都调用 `CMS.Command.execute/2`”，而是得到“每个业务动作只有一个明确 owner，
每种 identity 只表达一种语义”。

## 2. 完成边界

本文完成后才能声明 Phase 5 收口。完成条件不是模块改名，而是每个纳入范围的 mutation 都回答并实现：

```text
concrete use case
actor / initiator
Gate action or service admission
Lifecycle / version authority
transaction owner
one-shot | CMS.Command Receipt | domain workflow protocol
Confirmation / result builder
Audit / Activity / Outbox effects
retry and unknown-outcome behavior
```

以下状态必须明确区分：

- `classified`：上述合同已经冻结，但代码尚未迁移；
- `migrated`：入口、事务、identity 和 effect 已按合同迁移；
- `verified`：静态门禁、行为测试、GraphQL codegen 和调用方测试通过。

只有 `verified` 才算完成。本文不把计划能力描述成已上线能力。

当前已落地的代码切片（不等于 Phase 5 完成）：

- `CMS.Outbox` 支持 `identity: {:command, id} | {:workflow, ref}`，并以 `effect_key` 区分同一
  command 的多 scope effect；数据库迁移已把旧 `command_id` 兼容到 typed identity 存储；
- Article Move、Article moderation、DocTree publish、Doc publish 的 producer 不再为每个 scope 或
  binding 生成第二个 command UUID；maintenance/provider reconciliation 使用 workflow identity；
- Comment create/reply、Upvote/Emotion/Collect 的生产入口缺少 command identity 时 fail closed；Collect
  的 Metric 与 Outbox 复用入口 identity；
- Asset register/delete/archive/restore 已有 concrete Command 和单一 transaction owner；ReplacementPlan
  使用稳定的 workflow step ref，不再为 locator 生成 `command_id`；provider cleanup/reconciliation
  使用显式 `{:workflow, ref}` identity；
- Tag/TagGroup GraphQL mutation 已接收必填 `command_id`，taxonomy Outbox 使用同一 command identity 和
  stable effect key；CRUD 已进入 `Commands.*`、Gate、Receipt confirmation，set/unset/reindex 使用
  Gate-admitted one-shot；旧 `Tags` 仍保留给 seed、查询和兼容 service caller 的事务 fallback，尚未完成
  `TagPersist` 物理拆分；
- facade/resolver 的默认 command UUID 已清退；静态脚本同时检查 facade/resolver 与 production CMS
  source 中的派生 `command_id`。

上述切片的 focused compile/gate、Tag/Asset 行为测试、GraphQL codegen 和 frontend type-check 已通过。
Phase 5.6 清退 facade convenience arity 后，旧测试夹具曾以 168/191 通过，剩余 23 个失败全部为
`cms.command_id_required`；本批已将这些夹具改为显式 command identity，并把 §11 四个 aggregate
suites 跑到 191/191。
这只证明本节列出的验证边界已收口，不代表 §6 的其余 mutation family 已迁移或 verified。

## 3. 分类规则

### 3.1 Concrete Command 与 `CMS.Command` 不是同义词

每个用户可见的完整业务动作都应有 `Commands.<Action>.execute`，但 concrete Command 可以选择三种执行协议：

| 协议                  | 适用条件                                                                     | transaction owner | identity                                                        |
| --------------------- | ---------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------- |
| one-shot              | set-style、重复执行收敛到同一最终状态，首次响应无需恢复                      | concrete Command  | 可无 Receipt；若写 Outbox，仍接收同一客户端 `commandId`         |
| `CMS.Command` Receipt | create/delete、revision-producing、返回首次结果、response 丢失后不能安全重跑 | `CMS.Command`     | 客户端 `commandId`                                              |
| domain workflow       | upload、batch、plan、maintenance 等拥有独立资源状态机                        | workflow owner    | upload/batch/plan/workflow identity，不伪装成客户端 `commandId` |

Receipt 只解决有限窗口内的用户命令重放与结果恢复。它不是权限系统、任务队列或通用 workflow engine。

### 3.2 Receipt 判断清单

满足任意一项时，默认使用 Receipt；若选择其他协议，必须在对应 mutation 行中记录理由：

1. 首次提交成功但 response 丢失后，再执行会创建第二个实体或第二份事实；
2. 再执行会因为目标已经删除、version 已推进或状态已变化而返回与首次不同的结果；
3. 调用方需要恢复首次创建的稳定引用、revision、artifact 或删除确认；
4. 同一次用户意图必须与 Outbox effect 使用同一个客户端 identity 去重；
5. 操作对外部系统产生不可逆或昂贵 effect，且没有更合适的领域 workflow identity。

以下情况通常 one-shot：

- 完整目标集合覆盖；
- 明确的 set/unset、archive/restore；
- 重复执行得到相同最终状态，并允许返回最新 canonical projection；
- 不要求恢复首次时刻快照。

“当前实现看起来没有报错”不是幂等证明。必须由数据库约束、锁、expected version 或完整集合覆盖证明。

### 3.3 Gate 与 transport middleware

GraphQL `Passport` middleware 只负责 transport 层快速拒绝，不能替代领域 admission。目标调用链为：

```text
Passport middleware
  -> resolver
  -> CMS facade
  -> Commands.<Action>.execute
       -> CMS.Gate.with_check / with_community_check / with_branch_check
       -> canonical resource lock
       -> Persist
```

Gate action 使用 policy registry 中已有的领域 action；不得把 GraphQL 字符串直接当成新的领域合同。
service callback 使用 scoped service credential/capability admission，不伪造用户 Gate。

### 3.4 事务所有权

Receipt-backed：

```text
Commands.X.execute
  -> CMS.Command.execute
       -> Receipt claim
       -> Gate + lock + Persist + Audit/Outbox
       -> Confirmation finalize
       -> COMMIT
  -> result builder
```

one-shot：

```text
Commands.X.execute
  -> Repo.transaction
       -> Gate + lock + Persist + Audit/Outbox
       -> COMMIT
  -> canonical result
```

domain workflow：

```text
Workflow owner
  -> claim workflow resource / step
  -> Repo.transaction
       -> state transition + Persist + Outbox
  -> worker or service continuation
```

`Writer`/`Persist` 不得自行开启事务、调用 Gate、生成 command identity 或发送 Outbox。

### 3.5 Outbox identity

当前 `CMS.Outbox.send/1` 强制 `command_id`，导致 maintenance workflow 只能生成随机 UUID 填入该字段。
这会把 event/job identity 冒充成客户端业务命令 identity，必须在迁移业务调用点前修正。

目标调用合同区分两类来源：

```elixir
identity: {:command, command_id}
identity: {:workflow, workflow_ref}
```

- 用户 mutation 产生的 effect 使用同一个客户端 `commandId`，不得在 Command、Persist 或 Outbox producer 内生成；
- maintenance/batch/upload workflow 使用其持久化的 workflow ref；
- Outbox 自己生成的 event id 只标识 Event，不回填为 command identity；
- 数据库存储和唯一索引必须能区分 command 与 workflow 两个 namespace；
- 在新的 typed identity 落地前，不新增 `command_id: Ecto.UUID.generate()` 白名单。

物理字段迁移可采用 typed source 列或等价约束，但必须先完成 reader/writer 和唯一索引设计，再删除
旧的必填 `command_id` 假设。不得只把字段改名后继续混用。

#### 同一 command 的 multi-scope effects

一个 command 可以产生多个 Outbox effect，但不能为第二个 scope 生成第二个 `commandId`。当前
`Articles.Commands.Move` 会分别失效 source/destination binding；两个 Event 若继续使用相同的
`event/resource_type/resource_id`，现有
`command_id + event + resource_type + resource_id` 唯一键无法区分它们，这正是 destination effect
生成第二个 UUID 的根因。

目标必须在保持同一 command identity 的同时显式表达 effect identity，可选择：

- 一个 Event 携带完整 source/destination scopes；或
- 两个 Event 使用稳定的 `effect_key` / scope key；或
- 以各自 `ArticleBinding` 作为 Event resource identity。

最终选择需由 worker 消费合同与唯一索引共同冻结。无论选择哪种结构，禁止通过派生随机
`command_id` 绕过唯一约束。Article moderation 对多个 binding 发送 visibility effect 时适用同一规则。

## 4. Tag / TagGroup 迁移边界

当前用户入口大致为：

```text
GraphQL
  -> CMS.Communities
  -> CMS.Communities.Commands.<Action>
       -> CMS.Command Receipt or one-shot Gate
       -> CMS.Communities.Tags (legacy primitives)
       -> CMS.Outbox.send
```

迁移前的问题与当前处理结果如下：

- GraphQL mutation 已统一接收必填 `commandId`；
- resolver/facade 已进入 `Commands.CreateTag`、`Commands.DeleteTag` 等具体 use case；
- taxonomy Outbox 不再生成伪 command UUID，而是接收同一 command identity，旧 service caller 使用稳定
  community/thread workflow ref；
- create/update/delete/group CRUD 已由 `CMS.Command` Receipt 与 Confirmation 恢复；set/unset/reindex
  是 one-shot，但仍传递入口 command identity 给 taxonomy effect；
- GraphQL Passport 仍只是 transport 快速拒绝，所有新用户 mutation 在 concrete Command 内再次走 Gate；
- `Communities.Tags` 仍包含 legacy domain primitives 与兼容 transaction fallback。只有在下一切片提取
  `TagPersist` 后，才能把物理 persistence owner 从业务 facade 完全移除。

### 4.1 目标模块

```text
CMS.Communities
  -> CMS.Communities.Commands
       |-- CreateTag
       |-- UpdateTag
       |-- DeleteTag
       |-- CreateTagGroup
       |-- UpdateTagGroup
       |-- DeleteTagGroup
       |-- SetTag
       |-- UnsetTag
       |-- ReindexTagsInGroup
       |-- ReindexTagsAcrossGroups
       `-- ReindexTagGroups
  -> CMS.Communities.Tags (legacy primitives)
```

下一切片可将最后一项提取为 `CMS.Communities.TagPersist`；本轮先冻结 concrete use case、Gate、
transaction owner 和 identity，不把尚未存在的模块写成已交付能力。

`TagPersist` 只保留已在事务内调用的 query、lock、insert/update/delete、association 和 batch update。
read-only 的 group/tag 查询留在 Reader/FrontDesk，不为了目录对称塞进 Persist。

GraphQL 与 concrete Command 的明确映射为：

```text
reindex_tags_in_group        -> ReindexTagsInGroup
reindex_community_tags       -> ReindexTagsAcrossGroups
reindex_community_tag_groups -> ReindexTagGroups
```

Command 名称表达领域动作，不机械重复已经存在于 `CMS.Communities.Commands` namespace 中的
`Community`，但也不保留无法区分 in-group/across-groups 的泛化名称。

### 4.2 Mutation 合同矩阵

| GraphQL / use case                           | Gate action         | version/lock authority                    | 协议     | Confirmation / result               | effect                                     |
| -------------------------------------------- | ------------------- | ----------------------------------------- | -------- | ----------------------------------- | ------------------------------------------ |
| `createCommunityTag` / `CreateTag`           | community `:update` | canonical community lock + taxonomy scope | Receipt  | `tag_id`，经 FrontDesk 返回 Tag     | taxonomy Outbox，同一 `commandId`          |
| `updateCommunityTag` / `UpdateTag`           | community `:update` | canonical tag + community lock            | Receipt  | 最新 canonical Tag                  | taxonomy Outbox，同一 `commandId`          |
| `deleteCommunityTag` / `DeleteTag`           | community `:update` | canonical tag + community lock            | Receipt  | stable deleted-tag id result        | taxonomy Outbox，同一 `commandId`          |
| `createCommunityTagGroup` / `CreateTagGroup` | community `:update` | canonical community lock + taxonomy scope | Receipt  | `group_id`，经 FrontDesk 返回 Group | taxonomy Outbox，同一 `commandId`          |
| `updateCommunityTagGroup` / `UpdateTagGroup` | community `:update` | canonical group + community lock          | Receipt  | 最新 canonical Group                | taxonomy Outbox，同一 `commandId`          |
| `deleteCommunityTagGroup` / `DeleteTagGroup` | community `:update` | group + member tags + community lock      | Receipt  | stable deleted-group id result      | taxonomy Outbox，同一 `commandId`          |
| `setCommunityTag` / `SetTag`                 | Article `:edit`     | ArticleBinding + tag assignment lock      | one-shot | canonical Article projection        | stats/taxonomy effect 复用入口 `commandId` |
| `unsetCommunityTag` / `UnsetTag`             | Article `:edit`     | ArticleBinding + tag assignment lock      | one-shot | canonical Article projection        | 同上                                       |
| 三类 reindex Command                         | community `:update` | `(community, thread)` taxonomy scope      | one-shot | `{:ok, :pass}` / GraphQL `done`     | taxonomy Outbox，同一 `commandId`          |

这里的 one-shot 不表示“绕过 concrete Command”，只表示不创建 Command Receipt。当前 CRUD 统一使用
Receipt，避免删除或更新 response 丢失后的结果歧义；set/unset/reindex 虽然不持久化 Receipt，仍必须
接收并传递 GraphQL `commandId`，因为 taxonomy/stats effect 属于同一次用户意图。

### 4.3 Create 与 Update

`CreateTag`、`UpdateTag`、`DeleteTag` 及三个 TagGroup CRUD Command 当前均 Receipt-backed：

- target 使用 community/taxonomy scope，不能伪造尚不存在的 tag id；
- intent params 包含 community、thread 和规范化后的业务字段；正文/扩展字段按 IntentCodec policy 保存 digest；
- create/update/delete、count 更新、taxonomy Outbox 和 Receipt finalize 在同一事务；
- Confirmation 只保存稳定实体 id 与 command identity；
- 首次执行和恢复都经 FrontDesk 构建同一 GraphQL 结果。

更新即使业务上接近 patch，也采用 Receipt，原因是 taxonomy effect 与 response recovery 需要保存一次
明确 intent。重复命令由 Receipt/IntentCodec 拒绝不同 intent，不能静默生成第二个 id。

### 4.4 Delete Confirmation

Tag/Group 删除后通常无法通过 FrontDesk 重读，所以 Command 在首次执行前锁定 canonical resource，
Confirmation 只保存稳定 id 和 command identity；重放时由 result builder 返回同一 terminal projection。
当前 codec 合同为：

```text
DeleteTagConfirmation v1
  tag_id
  command_id

DeleteTagGroupConfirmation v1
  group_id
  command_id
```

它是有限、稳定的 terminal result，不是完整 Ecto struct 快照。当前 GraphQL 仍返回领域对象，因此
result builder 对已删除行返回带 id 的 terminal stub；后续若产品合同允许改为 `done`/payload，应优先
缩小 GraphQL 结果。

### 4.5 Set / Unset 与 stats

`SetTag`/`UnsetTag` 天然是集合成员关系的 set-style 动作，但只有同时满足以下条件才能保持 one-shot：

- association 有唯一约束或锁，重复 add 不插入第二行；
- repeated unset 对缺失关系返回成功；
- TagStats delta 只根据事务内 old/new 集合计算；
- ArticleBinding、association 和 stats 更新处于同一事务；
- Gate 在锁内基于 canonical Article/Community context 执行。

若现有 stats 实现无法证明重复重试不会重复加减，必须先改为“从 old/new 集合求差”或 authoritative
recompute，不能用 Receipt 掩盖错误的 projection 算法。

当前 public `ArticlePathInput` 没有 branch identity，Doc 的 set/unset 仍会在 Gate admission 返回
`cms.gate.doc_branch_required`；这不是 commandId fallback，而是 branch-scoped Article/DocTree 合同
尚未收口，继续列入 §6 的 DocTree/Article family 验收队列。

### 4.6 Reindex

三类 reindex 接收完整目标集合，保持 one-shot。Command 负责：

1. 规范化 id/index；
2. 锁定 `(community_id, thread)` taxonomy scope；
3. 验证输入集合完整、无重复且目标仍属于该 scope；
4. 批量更新并检查 affected rows；
5. 在同一事务写 taxonomy-changed Outbox event；
6. 返回 `{:ok, :pass}`。

不同 payload 的并发 reindex 由 scope lock 串行化，后提交者形成最终完整顺序；它不需要恢复首次排序快照。

## 5. Assets 迁移边界

当前路径分成用户 mutation、service callback 和 maintenance workflow。迁移前的混合点与当前处理结果为：

- register/delete/archive/restore 已通过 concrete Command 进入领域 Gate；用户入口必须传入同一
  `commandId`，不能由 facade 或 Writer 补 UUID；
- `Assets.Writer.delete/3` 只执行已在外层锁/事务内的资产事实和 Outbox intent，不再自行开启事务；
- upload completion 仍由 `Assets.Upload` workflow 负责，不能当作第二次用户 Command；
- `ProviderReconciliation` 要求持久化/调用方提供 `workflow_ref`，`Deletion` 的 retention cleanup 使用
  显式或确定性的 workflow ref；
- `ReplacementPlan` locator 使用稳定 `step_ref`，apply 时传入 `{:workflow, ref}`，不创建第二套用户
  `command_id`；
- upload capability、service completion、用户 mutation 和 maintenance workflow 的 identity 已分层，
  但 Upload/Replacement 的完整 crash/resume 验收仍属于后续 workflow 批次。

### 5.1 目标模块

```text
CMS.Assets
  -> CMS.Assets.Commands
       |-- RegisterAsset
       |-- DeleteAsset
       |-- ArchiveAsset
       |-- RestoreAsset
       `-- CreateReplacementPlan
  -> CMS.Assets.UploadWorkflow
  -> CMS.Assets.ReplacementWorkflow
  -> CMS.Assets.ProviderReconciliation
  -> CMS.Assets.Persist
```

Article Draft 内替换 asset use 的写入继续由 `Assets.Commands.ReplaceUse`/Article Draft authority 持有；
Assets facade 不成为 Article 内容 Writer。

### 5.2 Mutation / workflow 合同矩阵

| 入口                                       | admission                                                        | 协议                     | transaction owner     | identity / result                                                            |
| ------------------------------------------ | ---------------------------------------------------------------- | ------------------------ | --------------------- | ---------------------------------------------------------------------------- |
| `registerCommunityAsset` / `RegisterAsset` | user Gate `community :update`（transport 为 `community.update`） | one-shot upsert          | concrete Command      | storage identity/public ref；返回 canonical Asset                            |
| `createCommunityAssetUploadIntent`         | user Gate `asset.upload`                                         | upload workflow          | `UploadWorkflow`      | 新 `uploadRef`；允许重新签发，不创建 Receipt                                 |
| `completeCommunityAssetUpload`             | scoped service credential + capability facts                     | upload workflow one-shot | `UploadWorkflow`      | `uploadRef`/public ref/storage identity；重复 callback 返回同一 Asset        |
| `deleteCommunityAsset` / `DeleteAsset`     | user Gate `community :update`（transport 为 `asset.upload`）     | Receipt                  | `CMS.Command`         | asset id + deleted confirmation；provider-delete Outbox 使用同一 `commandId` |
| `ArchiveAsset`                             | user Gate `community :update`                                    | one-shot set-style       | concrete Command      | canonical archived Asset                                                     |
| `RestoreAsset`                             | user Gate `community :update`                                    | one-shot set-style       | concrete Command      | canonical active Asset                                                       |
| provider cleanup reconciliation            | maintenance admission                                            | maintenance workflow     | reconciliation owner  | persisted workflow/run ref，不使用 `command_id` 随机 UUID                    |
| `CreateReplacementPlan`                    | user Gate                                                        | Receipt                  | `CMS.Command`         | plan id，经 workflow reader 返回 Plan                                        |
| apply replacement plan                     | user starts, workflow revalidates each item                      | domain workflow          | `ReplacementWorkflow` | plan ref + stable step ref；支持 partial completion/resume                   |

archive/restore 当前主要是 facade API 和测试入口；在暴露新的 GraphQL mutation 前也必须先经过上述 Command，
不能因为暂时没有 transport 就继续保留 Writer 业务入口。`Writer` 仍可为 Article ref projection
持有自己的局部 transaction；这不等于它重新取得 Asset user mutation 的事务所有权。

### 5.3 Register 与 upload workflow

`RegisterAsset` 可以保持 one-shot，前提是现有 active row 唯一约束继续作为幂等 authority：

- 有 storage identity 时按 `(community_id, storage, storage_key)` upsert；
- 否则按 active URL hash upsert；
- `public_ref` 的唯一性冲突必须返回现有 canonical Asset 或明确 conflict，不能创建第二行；
- Gate、quota/completeness check 与 upsert 在 concrete Command 定义的事务/锁边界内完成。

upload intent 不是已经提交的 Asset。response 丢失时允许重新签发新 capability，旧 capability 按 TTL 过期，
因此不使用 Command Receipt。`uploadRef` 是资源协议 identity，不能改名为 `commandId`。

upload completion 是 assets-hub 的 scoped service callback，不是用户 mutation 的第二次执行：

- callback 必须携带/解析同一个 `uploadRef` 与 capability-bound facts；
- community、public ref、storage key、hash、size 等不可由未验证 transport 任意覆盖；
- 重复 completion 通过 public/storage identity 返回同一 canonical Asset；
- quota lock、validation 和 upsert 处于一个 workflow transaction；
- service callback 不使用用户 Gate，也不创建用户 Command Receipt。

### 5.4 Delete / archive / restore

`DeleteAsset` 使用 Receipt，因为首次事务同时提交 soft delete 与 provider-delete Outbox，response
丢失后 active lookup 已无法再次得到相同结果。流程为：

```text
DeleteAsset.execute(actor, community, asset_id, command_id)
  -> CMS.Command.execute
       -> Gate
       -> lock active asset + ref/completeness scope
       -> reject referenced asset
       -> Persist.soft_delete
       -> Outbox provider-delete(identity: {:command, command_id})
       -> DeleteAssetConfirmation
  -> deleted result builder
```

archive/restore 是可收敛的 set-style 状态切换，保持 one-shot。两者仍需在事务内重新加载、锁定 Asset、
执行 Gate 并返回 canonical result；`Writer.archive/restore` 不再作为 public business API。

### 5.5 Provider reconciliation

`ProviderReconciliation` 是 maintenance workflow，不迁入 user-only `CMS.Command`。目标行为：

- 扫描数据库 authority 与 provider objects；
- 以持久化 reconciliation run/step ref 记录一次维护尝试；
- 缺失 cleanup intent 时写 Outbox `identity: {:workflow, workflow_ref}`；
- Outbox event id 由 Outbox 自己生成；
- 同一 asset 的 pending/executing/completed cleanup intent 继续阻止重复入队；
- workflow telemetry/audit 明确标注 maintenance initiator，不伪造 user actor。

### 5.6 ReplacementPlan identity

当前 plan locator 在 plan 创建时生成随机 `command_id`，随后把它传给 `ReplaceUse`。这会形成一套
既不是客户端 command、也不是明确 workflow step 的 identity。

目标改为：

```text
ReplacementPlan
  plan_ref
  apply_run_ref
  items[]
    item_ref
    locators[]
      locator_ref / step_ref
      observed revision and position
      status/result
```

- plan 创建不再为 locator 生成 `command_id`；
- apply 启动时持久化唯一 `apply_run_ref`；
- 每个 locator 使用稳定 step ref，重试复用，不在执行循环内重新生成；
- `ReplaceUse` 需要区分 user-command initiator 与 workflow-step initiator；在该 typed initiator 合同完成前，
  不把 step ref 填入用户 `command_id`；
- 每项继续 revalidate live revision 与 expected draft version；
- partial completion 写回 item/step 状态，workflow 可从未完成 step 继续；
- plan 完成状态由 step authority 聚合，不以最后一次进程内循环结果为唯一事实。

## 6. 其余 Phase 5 对象

以下是必须逐项完成合同确认的审计队列，不表示每项当前都有 bug，也不预先要求 Receipt：

| family                               | concrete use case                               | 初始协议判断                  | 重点确认                                                                                |
| ------------------------------------ | ----------------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------- |
| Article sink/lock/category/status    | 拆除 generic action dispatch                    | one-shot                      | action-specific Gate、ArticleBinding lock，勿误入 Lifecycle                             |
| Article binding move/mirror          | 现有 `Move` / `Mirror` / `Unmirror`             | Receipt                       | source/destination multi-scope Outbox 已复用同一 `commandId`，仍需 worker/recovery 验收 |
| Article moderation/visibility        | `Moderate` / visibility workflow                | 按 initiator 分类             | 多 binding effect 已改为 typed/stable identity，仍需确认 workflow 与 Receipt 边界       |
| Article/Comment report               | `Report` / `UndoReport`                         | Report Receipt；Undo one-shot | duplicate report、Audit/Activity、首次结果                                              |
| Comment create/reply legacy fallback | 现有 `CreateComment` / `ReplyComment`           | Receipt                       | Writer 的 `nil` identity 已 fail closed；仍需完成 concrete Receipt/result 合同          |
| Comment solution                     | `AcceptSolution` / `RevokeSolution`             | one-shot                      | canonical comment/article lock、唯一 solution                                           |
| Comment pin                          | `Pin` / `Unpin`                                 | one-shot                      | set-style、thread policy、stats/cache effect                                            |
| Interaction reactions                | `Upvote` / `Emotion` / `Collect` 及 undo        | Receipt 或显式 one-shot       | Upvote/Emotion 已删除 nil fallback；Collect 已统一 Metric/Outbox identity，协议仍需冻结 |
| Moderator                            | `Add` / `AddMany` / `Remove` / `UpdatePassport` | bulk/delete 优先 Receipt      | membership uniqueness、partial failure、Activity                                        |
| Activity export                      | `ExportCommunityActivity`                       | Receipt 或 export workflow    | artifact/job identity、权限快照、结果恢复                                               |
| Press config                         | `UpdateConfig`                                  | one-shot                      | set-style config、cache invalidation                                                    |
| DocTree legacy                       | 按真实动作建立 Command                          | 逐项判断                      | tree revision、branch lock、owner codec，禁止万能 payload                               |

每个 family 在实施前必须追加一张与 §4.2/§5.2 同等粒度的矩阵，并标记 `classified`。不能仅以
“已有 Command 模块”判定完成；仍需确认 GraphQL 参数、Gate、事务、Confirmation 和 effects。

明确排除：

- Auth/session 由 Accounts/Auth 自有协议管理；
- view/read markers 由 Interaction/Accounts 投影协议管理；
- 两者不迁入 `CMS.Command`，也不计入 Phase 5 遗漏；
- reaction mutations 会写 reaction fact、Metric 与 Outbox，不属于 view/read marker 例外。

## 7. GraphQL 与客户端迁移

### 7.1 Schema

- Receipt-backed mutation 增加必填 `commandId: ID!`；
- one-shot 但写用户 Outbox 的 mutation也接收 `commandId: ID!`，用于同一意图的 effect identity；
- 纯 set-style 且无可靠 effect 的 mutation不为了形式统一强加 Receipt；
- service callback 保留 scoped input/capability identity，不增加用户 `commandId`；
- response 不暴露 `commandReplayed`、Receipt payload 或 workflow 内部 step identity。

### 7.2 Resolver

resolver 只做 transport adaptation：

```text
args + authenticated actor
  -> CMS facade concrete action
  -> domain result / transport error
```

resolver 不构造 `%CMS.Command{}`、不选择 one-shot/Receipt、不生成 UUID、不直接调用 Writer/Persist。

### 7.3 Client executor

需要 `commandId` 的用户 mutation 继续由统一 mutation executor 创建和保存 handle：

- unknown outcome 重试复用同一个 id；
- settled 后清理 handle；
- upload `uploadRef`、replacement `planRef` 与 `commandId` 分开保存；
- 不能用新的 local UUID 覆盖服务端返回的 workflow/resource identity。

## 8. 分阶段实施

### Phase 5.0：Outbox typed identity

1. 冻结 `{:command, id} | {:workflow, ref}` producer API；
2. 冻结同一 command 多 Event 的 stable effect/scope identity；
3. 设计 schema、唯一索引与 migration；
4. reader/worker 先兼容新旧事件，再迁移 producers；
5. 修复 Article Move 和 moderation 的 multi-scope producer，不再用第二个 UUID 绕过唯一键；
6. 增加静态门禁，禁止 production producer 直接生成 `command_id`；
7. 更新 CMS Outbox 架构文档。

验收：ProviderReconciliation 可以写 maintenance event；Article Move/moderation 可在同一入口 identity 下
表达多个 scope effect；数据库中不再出现伪业务 command identity。

### Phase 5.1：Tag/TagGroup persistence split（当前剩余）

1. 从 `Communities.Tags` 提取 `TagPersist` primitives，保留本轮已冻结的 Commands API；
2. Persist 删除 compatibility transaction、Gate、Outbox 和 identity 处理；
3. 为 assignment、taxonomy scope、group/member 建立所需 lock helper；
4. 保持 read API 与 GraphQL 输出不变。

验收：所有 GraphQL/user Tag 写入只能由 concrete Command/workflow 调用 Persist；legacy seed/service
caller 要么显式声明 workflow admission，要么迁移到同一 Commands API。

### Phase 5.2：Tag/TagGroup Commands 与 Receipt（本轮已实施，待扩大验收）

1. 十一项 concrete Command 已实现并按 GraphQL 语义命名；
2. tag/group CRUD 接入 `CMS.Command` 与 Confirmation；
3. set/unset/reindex 保持 one-shot，并贯穿 `commandId` 到 taxonomy Outbox；
4. set/unset 走 Article Gate，reindex 走 Community Gate；继续补并发/stats 行为测试；
5. GraphQL schema、resolver、codegen 和客户端 executor 调用已更新。

验收：create/update/delete/group response 丢失可恢复；one-shot 重试收敛；无内部 command UUID。

### Phase 5.3：Asset user mutations

1. 将 `Assets.Writer` 的 asset-row primitives 提取为 `Assets.Persist`；
2. 保持 Register/Delete/Archive/Restore concrete Command 合同；
3. Delete Receipt 与同 identity Outbox 已完成，继续补 provider worker recovery；
4. Register 证明 storage/url/public-ref 三种 upsert 幂等；
5. archive/restore 增加 canonical lock 和 Gate 行为测试。

验收：`CMS.Assets` 不再直接委托 Writer 业务入口，`Assets.Writer.delete/3` 不再拥有事务；ref
projection 的局部 transaction 必须与 user Asset mutation 分开标注。

### Phase 5.4：Upload 与 maintenance workflow

1. 收口 UploadWorkflow 的 capability、completion 与 transaction；
2. completion 以 upload/public/storage identity 幂等；
3. ProviderReconciliation 使用 workflow identity；
4. provider cleanup worker 测试重复入队与完成事件。

验收：用户、service、maintenance 三类 initiator 在代码和数据中可区分。

### Phase 5.5：ReplacementPlan

1. CreateReplacementPlan 接入 Receipt；
2. 持久化 apply run 与 step identity；
3. 删除 locator 随机 `command_id`；
4. ReplaceUse 支持明确的 workflow-step initiator；
5. 覆盖 crash/resume、partial completion 与 version conflict。

### Phase 5.6：其余 family

1. [ongoing] 按 §6 逐 family 执行 `classified -> migrated -> verified`；
2. [implemented, pending family verification] 移除 Comment create/reply、Upvote/Emotion 的 `nil` command identity fallback；
3. [implemented, pending protocol freeze] 为 Collect 冻结 Receipt/one-shot 合同，并让 Metric/Outbox 复用入口 identity；
4. [done in this batch] 清退 `CMS.Communities`、`CMS.Dashboard` 在 facade 内生成 UUID 的 convenience arity；
5. [done in this batch] seed、maintenance、operations caller 显式提供 workflow/operation identity，不能回退为伪客户端 command；
6. [ongoing] 一次只迁移一个 owner，避免把不同 Gate、Lifecycle 与 result codec 混在同一提交。

Convenience arity 清退的夹具影响（已在本批修复）如下；这些是测试调用方迁移债务，不是恢复隐式
identity 的理由：

| 套件                                                 | 原失败数 | 缺失 identity 的旧调用                         | 修复方式                            |
| ---------------------------------------------------- | -------: | ---------------------------------------------- | ----------------------------------- |
| `communities/enable_test.exs`                        |        9 | `Communities.create/2`、`Dashboard.update/3`   | 显式 `command_id`，operations actor |
| `communities/writer/crud_test.exs`                   |        6 | `Communities.create/2`                         | 显式 `command_id`                   |
| `communities/moderator/moderator_test.exs`           |        3 | `Communities.create/2`                         | 显式 `command_id`                   |
| `communities/meta/meta_test.exs`                     |        2 | `Communities.create/2`、`update/3`             | 显式 `command_id`                   |
| `communities/tags/{blog,changelog,doc}_tag_test.exs` |        3 | 跨 community fixture 的 `Communities.create/2` | 显式 `command_id`                   |
| **合计**                                             |   **23** | 全部为 `cms.command_id_required`               | **已迁移**                          |

## 9. 静态门禁

当前 `scripts/check-command-identity.mjs` 已实现的检查范围包括：

- 扫描全部 `*Persist`，禁止 Gate、Command、Outbox、transaction/rollback 和 UUID generation；
- 扫描 resolver 与 CMS 根 facade 是否直接调用 Persist；
- 扫描 resolver、facade 与 production CMS source 是否派生 `command_id`；
- 前端另行限制 `createCommandId()` owner。

脚本仍不试图通过正则判定所有 `nil` workflow 分支、Outbox producer 的语义或 Gate action；这些必须由
对应 concrete Command/workflow 测试和人工 review 验收。

Phase 5 在现有扫描上增加：

- 新的 concrete Command 不得把 transaction owner 隐藏在 Writer/Persist；`Communities.Tags` 的兼容
  `Repo.transact` 只能在没有外层 command transaction 的 legacy service path 使用；
- Writer/Persist 不得调用 `CMS.Gate`、`CMS.Command`、Audit、Activity、Outbox；
- 用户 mutation 的 resolver/facade 不得生成 UUID 或直接调用 Writer/Persist；read/projection、seed 和
  明确标注的 legacy service workflow 例外必须单独列入 migration manifest；
- `command_id: Ecto.UUID.generate()`、`command_id || Ecto.UUID.generate()` 以及 nil-command fallback
  在 production CMS 用户命令路径中为零；
- Outbox producer 必须显式选择 command/workflow identity；
- multi-scope effect 必须复用入口 identity，并用 effect/scope identity 区分多个 Event；
- GraphQL Receipt mutation 的 `commandId` 可追踪到 `CMS.Command.execute`；
- 同一个 public action 只有一个 `Commands.<Action>.execute`；
- maintenance workflow 不调用 user-only Command API；
- workflow `step_ref` 不命名为 `command_id`。

Outbox Event id、lease/lock ref、Article/DocTree node id、anonymous-view id 等真实资源或基础设施 identity
不是业务 `commandId`，静态门禁应使用窄 allowlist，而不是禁止所有 `Ecto.UUID.generate()`。

静态扫描只证明依赖方向，不替代行为测试。

## 10. 行为测试

### 10.1 Tag / TagGroup

- create tag/group 首次成功与同 `commandId` 重试返回同一实体；
- 相同 `commandId` 配不同 community/thread/payload 返回 identity conflict；
- delete tag/group response 丢失后从 Confirmation 恢复同一 terminal result；
- Gate denial 不写 tag/group/count/assignment/Outbox/Receipt；
- update/reindex 相同 payload 重试收敛且 taxonomy effect 不重复；
- set/unset 重复执行不重复更改 stats；
- 并发 reindex 不产生部分集合或重复 index；
- Persist/Outbox 失败使领域事实与 Receipt 一起回滚。

### 10.2 Assets

- register 按 storage identity、URL hash 和 public ref 重试不产生第二行；
- upload intent 可重新签发，旧 capability 按 TTL 失效；
- completion callback 重试返回同一 Asset，伪造 capability facts 被拒绝；
- delete 首次成功与 Receipt 恢复返回同一 terminal result；
- delete 的 Asset 状态与 provider-delete Outbox 原子提交；
- archive/restore 重复执行收敛并执行领域 Gate；
- reconciliation 重跑不重复创建有效 cleanup intent；
- maintenance Outbox 不出现 user command identity；
- replacement apply crash 后从稳定 step 继续，不重复已完成 ReplaceUse；
- partial conflict 不被聚合成全局成功。

### 10.3 Legacy identity 与 multi-scope effects

- Article Move 的 source/destination effects 共享同一 `commandId`，且不会触发 Outbox 唯一键冲突；
- Article moderation 多 binding effects 共享入口 command/workflow identity；
- Comment create/reply 无 command identity 时 fail closed，不再静默进入无 Receipt 分支；
- Upvote/Emotion 的生产入口不接受 nil command identity；
- Collect 的 Metric 与 Outbox 复用同一入口 identity；
- facade convenience arity 不生成 UUID，seed/maintenance caller 显式提供 workflow identity。

### 10.4 通用事务与恢复

- transaction owner 只有一层，不出现 nested transaction 掩盖 rollback；
- first execution 与 recovery 使用同一 result builder；
- Receipt、Audit/Activity 与 Outbox identity 可追踪但语义不混用；
- expired Receipt 不改变领域事实；
- Outbox worker retry 不重新执行领域 mutation。

## 11. 验证命令

每批至少运行对应 focused tests，最终运行：

```text
cd backend/api
mix format --check-formatted <changed Elixir files>
mix compile --warnings-as-errors
mix test test/groupher_server/cms/communities
mix test test/groupher_server/cms/assets_test.exs
mix test test/groupher_server/cms/command_receipt_test.exs
mix test test/groupher_server/cms/outbox_test.exs
mix test test/groupher_server/cms/communities/commands/tag_commands_test.exs

cd ../../
pnpm run graphql:codegen
pnpm --filter @groupher/frontend-core run type-check
pnpm check:command-identity
pnpm docs:check
git diff --check
```

若测试文件在实施期间拆分，验证命令同步更新为真实路径，不保留不存在的目录占位。

§11 命令集的初始基线为 `168/191`，23 个失败全部集中在 convenience arity 清退后的五组 legacy
fixture，而不是只有 Tag CRUD：

| 套件                                                 | 失败数 | 触发点                                                  |
| ---------------------------------------------------- | -----: | ------------------------------------------------------- |
| `communities/enable_test.exs`                        |      9 | setup `Communities.create/2`；测试 `Dashboard.update/3` |
| `communities/writer/crud_test.exs`                   |      6 | 旧 Writer CRUD `Communities.create/2`                   |
| `communities/moderator/moderator_test.exs`           |      3 | 跨 community `Communities.create/2`                     |
| `communities/meta/meta_test.exs`                     |      2 | `Communities.create/2`、`Communities.update/3`          |
| `communities/tags/{blog,changelog,doc}_tag_test.exs` |      3 | 跨 community tag fixture 的 `Communities.create/2`      |
| **合计**                                             | **23** | 全部返回 `cms.command_id_required`                      |

这些失败是 fail-closed 合同的预期迁移债务，不能通过 facade 重新生成 UUID 规避。本批已将测试夹具
和旧 GraphQL Tag CRUD mutation document/variables 改为传入显式 identity，并补上 transport action 与
领域 `community.update` admission；重跑 §11 四个 aggregate suites 后结果为：`communities` 133/133、
Assets 22/22、Receipt 26/26、Outbox 10/10，即 **191/191**。`tag_commands_test.exs` 另有 2 个 focused tests，
也已通过。由此“focused tests 61 passed”应理解为迁移切片的 focused suites，不可替代上述 §11 全量
命令集；当前两者均有可复现的通过结果。

扩展的 GraphQL community-tag mutation 目录目前为 39/41：Tag CRUD、set/unset（post/blog/changelog）
和 reindex 已通过；Doc set/unset 的 2 个用例仍明确失败于 `doc_branch_required`，属于 branch-scoped
合同债务，不应被误报成 command identity 已完成。

## 12. 提交拆分

建议按可独立回滚的合同拆分：

1. `refactor(be): add typed outbox producer identity`；
2. `refactor(be): split tag persistence from workflows`；
3. `feat(be): migrate tag commands and receipts`；
4. `refactor(be): split asset persistence from workflows`；
5. `feat(be): migrate asset user commands`；
6. `refactor(be): separate asset maintenance identity`；
7. `refactor(be): make replacement plan steps resumable`；
8. 其余 mutation 每个 owner 单独批次。

每批显式 stage 路径/hunk，检查 cached `name-only`、`stat`、`diff --check` 和 focused tests；不吸收
工作树中其他迁移或生成噪音。

## 13. 非目标

本文不：

- 把所有 CMS mutation 强行迁入 `CMS.Command`；
- 建立全局 Command Bus 或通用 CRUD framework；
- 用 Receipt 替代数据库唯一约束、锁、expected version 或 workflow state；
- 把 uploadRef、batchRef、planRef、workflowRef 改名为 commandId；
- 让 GraphQL Passport 取代领域 Gate；
- 把普通 tag/asset UI 状态塞进 Lifecycle；
- 让 Persist 负责事务、authorization 或 effects；
- 修改 Auth/session 或 view/read marker 的既有归属；
- 在分类未完成前宣称“全仓库 CMS mutation 已迁移完成”。
