# CMS Assets：现状审计与独立重构完成记录

> 本文把 Asset 从 CMS Phase 5 总文档中单独拆出，记录真实功能、入口、identity、事务 owner、目录职责和已完成的重构边界。
>
> 当前结论：用户资产行 mutation 已进入 `CMS.Command` + Gate + Confirmation/Receipt；Upload、provider cleanup/reconciliation、ReplacementPlan 也已完成独立的 durable workflow 收口。provider-delete intent 与 worker delivery 已统一经过 `Assets.Effects`，`Assets.Deletion` 只保留 provider adapter；本文不把这些 workflow 伪装成用户 Command，也不把 DocTree/ContentImport 混入 Asset 重构。

## 1. 先给结论

Assets 现在分成三条清晰边界：

1. **用户资产行写入已经符合当前 CMS 写入合同。**
   `registerCommunityAsset` 进入 `Commands.Register`，delete/archive/restore 的 concrete Command 也已经存在；Gate、Receipt、Confirmation 和 `Assets.Persist` 的 canonical row write 已经分开。
2. **跨请求流程已经成为 durable workflow。**
   Upload 以 `upload_ref`/`idempotency_key` 持久化 intent、completion、failure 和 canonical result；Provider、generated cleanup 和 ReplacementPlan 都有稳定 run/step ref、claim/lease、retry/recovery 状态。
3. **物理职责已经收口。**
   Article refs 位于 `Assets.Refs`，资产行 mutation 只由 concrete Command + `Assets.Persist` 拥有；Upload、Provider、Replacement、Maintenance 已按目录分组。

因此，当前实现按下面的规则收口：

```text
用户改变 community_assets 的业务动作
  -> concrete Command
  -> CMS.Gate
  -> CMS.Command transaction / Receipt
  -> Assets.Persist

浏览器上传、service callback、provider cleanup、ReplacementPlan
  -> named Asset workflow / maintenance workflow
  -> typed workflow identity
  -> durable state + retry/recovery

资产库读取、使用情况、统计
  -> Assets.Query
  -> 统一的 Gate query admission（必要时）
  -> read result
```

这里的 `Command` 是一个用户业务动作的执行和结果恢复边界；`Workflow` 是一个可能跨请求、跨服务、跨 worker 的过程。Workflow 可以调用 Command，也可以调用 Persist primitive，但不能为其中的每个内部步骤伪造一个用户 `command_id`。

## 2. 对外功能和真实入口

### 2.1 Asset library 查询

当前 GraphQL 查询由 `GroupherServerWeb.Resolvers.CMS.Assets` 转到 `CMS.Assets.Query`：

| 对外能力               | 入口                                           | 当前 owner                   | 说明                                                          |
| ---------------------- | ---------------------------------------------- | ---------------------------- | ------------------------------------------------------------- |
| 分页资产列表           | `pagedCommunityAssets`                         | `Assets.Query.page/2`        | 只看 active `community_assets`                                |
| 统计和配额             | `communityAssetStats`                          | `Assets.Query.stats/2`       | storage bytes、thread/type 统计来自资产行                     |
| storage 使用量         | `communityAssetUsage`                          | `Assets.Query.usage/1`       | 同一资产只计算一次                                            |
| 一个资产的文章引用     | `communityAssetRefs`                           | `Assets.Query.refs/3`        | 从 `article_asset_refs` 反查 Article                          |
| 使用情况抽屉           | 内部 `CMS.Assets.usages/3` / `usage_summary/3` | `Assets.Query`               | 按 draft/live/historical/trashed 分类；敏感读取会做 Gate 检查 |
| public origin metadata | `communityAssetOriginInfo`                     | `Assets.Query.origin_info/1` | 只给 Assets Hub 的 service scope 使用，不是 dashboard 读模型  |

这些是 **Query**，不需要 `CMS.Command`、Receipt 或业务 `commandId`。但需要权限和 scope：GraphQL 查询目前由 `Authorize`、`Passport`、`FrontDesk` 等 transport middleware admission；`Query.usages/3` 还会在领域内调用 Gate。后续应把 query admission 的责任固定为统一的 `CMS.Gate` 规则，而不是让每个 query 自己发明一套 policy。

### 2.2 用户资产行 mutation

| 对外能力                 | 当前入口                                                                           | 协议                    | 结果恢复                                                 |
| ------------------------ | ---------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| `registerCommunityAsset` | GraphQL -> resolver -> `CMS.Assets.register_to_community/4` -> `Commands.Register` | `CMS.Command` + Receipt | `RegisterAssetConfirmation` 记录 asset id + command id   |
| `deleteCommunityAsset`   | GraphQL -> resolver -> `CMS.Assets.delete/4` -> `Commands.Delete`                  | `CMS.Command` + Receipt | `DeleteAssetConfirmation` 重新加载已删除的 canonical row |
| archive                  | 当前 facade/Command 入口和测试使用，尚未看到对应 GraphQL mutation                  | `CMS.Command` + Receipt | `ArchiveAssetConfirmation`                               |
| restore                  | 当前 facade/Command 入口和测试使用，尚未看到对应 GraphQL mutation                  | `CMS.Command` + Receipt | `RestoreAssetConfirmation`                               |

Register 的 active row upsert 由 storage identity 或 URL hash 的数据库唯一约束收敛；delete 还会检查 usage completeness、锁定资产并拒绝仍被引用的资产。Archive/restore 是可逆状态变更，但当前仍统一使用 Receipt，避免 facade 或测试直接绕过 Command。

这些用户入口的 `commandId` 必须由客户端/上层用户 mutation 提供。Facade 的旧 convenience arity 已 fail-closed；Assets 不会在 resolver、facade、Refs 或 Persist 内生成默认 command UUID。

### 2.3 浏览器上传和 service completion

上传不是一次同步的“注册资产”调用，而是多阶段协议：

```text
Dashboard/editor
  -> createCommunityAssetUploadIntent
       -> Passport asset.upload
       -> Assets.Upload.create_intent
       -> uploadRef + assetPublicRef + signed capability
  -> Assets Hub presign / object PUT
  -> completeCommunityAssetUpload
       -> ServiceScope phoenix:assets-api / assets:upload:complete
  -> Assets.Upload.complete
       -> upload_ref lock + capability-bound facts + quota lock
       -> Persist.register + completion result snapshot
```

`createCommunityAssetUploadIntent` 没有用户 `commandId`：它签发短期 capability，并在 `cms.asset_uploads` 写入 intent；响应丢失时可按新 `upload_ref` 重新签发。`completeCommunityAssetUpload` 是 Assets Hub 的 service callback，也不是用户 Command 的第二次执行。

`upload_ref` 是 workflow 主键，Assets Hub 同时把它作为 `idempotency_key` 回传；服务端以唯一约束、行锁和 completion snapshot 收敛重复 callback。completion 只接受 intent 绑定的 community、public ref、storage key、URL、size、MIME、asset type、thread 和 uploader facts；已完成的 callback 重放同一个 canonical asset。

### 2.4 Article asset refs

Assets 还承载文章内容中的使用 projection，但这不是 `community_assets` 用户 mutation：

```text
Article save / Snapshot freeze
  -> Assets.Refs
  -> article_asset_refs + WorkingCopy / Snapshot owner
```

`article_asset_refs` 描述“资产被哪里使用”，而 `community_assets` 描述“资产本身、存储和计费”。两者不能合并成一个 writer owner。普通 Article 的引用随 WorkingCopy 保存同事务更新，冻结 Snapshot 时复制；旧 `link_refs` / `copy_refs` 仅供待切换的 Docs Draft 使用，不再接受普通 Article 写入。

Article ref 输入携带内联 asset 时，`Refs` 只在同一个 Article transaction 中显式调用 `Assets.Persist.register`；旧 Writer facade 已删除，资产行 helper 不再存在。

### 2.5 Application Logo、Wallpaper 和维护能力

这些入口不是普通用户资产 mutation：

| 能力                       | 当前模块                                                           | 语义                                                                          |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Application Logo promote   | `Assets.ApplicationUploads`                                        | 将已 finalized 的申请 Logo 转成普通 community asset，使用 Persist primitive   |
| generated-image intent     | `Assets.Upload.create_generated_intent/3`                          | capability 绑定 Wallpaper Batch/candidate/variant                             |
| generated asset cleanup    | `Assets.Deletion.delete_generated_assets/3`、`Wallpaper.Retention` | workflow run/step + provider-delete Outbox，保留 partial-success              |
| provider reconciliation    | `Assets.ProviderReconciliation`                                    | durable run/step 扫描 authority，补发缺失 cleanup intent                      |
| provider orphan scan       | `Assets.ProviderReconciliation.scan_provider_orphans`              | 只识别候选，不直接删除 provider object                                        |
| completeness backfill      | `Assets.Backfill` / `Assets.Completeness`                          | 建立 version-owned ref 的安全 fence                                           |
| GC candidate scan          | `Assets.GC`                                                        | 只产生候选，检查 ref、upload、import、replacement、legal hold                 |
| Assets Hub generated batch | `Assets.GeneratedBatch`                                            | service-authenticated Batch claim/cleanup adapter，不是 Phoenix Asset Command |

`Assets.Deletion.delete_generated_assets/3` 是 maintenance 批处理而不是全量原子事务：每个 asset 单独执行自己的
soft-delete 与 provider-delete Outbox transaction；某个 asset 失败后继续处理后续 asset，最终保留并返回第一个错误，
之前已经成功提交的 asset 不回滚。`asset_workflow_runs/steps` 记录 owner、attempt、lease、terminal result；这不是
用户资产行 Delete Command 的 Receipt 合同。success/error/success partial batch 已由 focused test 覆盖。

## 3. 当前目录和模块职责

当前真实目录如下（不是目标目录的想象名称）：

```text
cms/assets.ex                         # CMS.Assets public facade
cms/assets/
├── commands/
│   ├── register.ex                   # user asset-row Command
│   ├── delete.ex
│   ├── archive.ex
│   ├── restore.ex
│   ├── replace_use.ex                 # Article Draft asset-use Command/workflow adapter
│   └── *_confirmation.ex              # 当前 legacy placement；目标直接迁移到 commands/confirmation/
├── persist.ex                         # CommunityAsset row primitives
├── query.ex                           # asset library/read-side queries
├── refs.ex                             # ArticleAssetRef projection
├── workflow.ex                         # durable non-user workflow run/step protocol
├── upload/                             # capability intent + service completion
│   └── workflow.ex
├── capability.ex                       # HMAC capability contract
├── endpoints.ex                        # role-specific Assets Hub endpoints
├── provider/                           # provider deletion/reconciliation adapters
│   ├── deletion.ex
│   └── reconciliation.ex
├── replacement/                        # plan/apply run and locator recovery
│   └── plan.ex
└── maintenance/                        # non-user maintenance workflows
    ├── application_uploads.ex
    ├── backfill.ex / completeness.ex
    ├── gc.ex
    ├── generated_batch.ex
    └── generated_batch/
        └── publish_capability.ex

cms/model/
├── asset_upload.ex                     # upload intent/completion state
├── asset_workflow_run.ex               # durable workflow run
└── asset_workflow_step.ex              # durable workflow step/lease
```

### 3.1 已符合规范的部分

- `commands/` 已把四个用户 asset-row action 和 Confirmation 放在一个清晰边界内。
- `Persist` 没有自己开启用户事务，也不负责 Gate admission；它提供 lock/write/upsert primitive，由 Command 或 workflow 做 owner。
- `Query` 是 read-side module，不持有 Receipt，也不把查询伪装成 Command。
- `Capability`、`Endpoints`、`GeneratedBatch` 已经把外部 Assets Hub 协议拆成独立模块，避免把 provider HTTP 细节写进 GraphQL resolver。
- `ProviderReconciliation` 已经使用 `{:workflow, workflow_ref}`，没有把 maintenance UUID 冒充业务 `command_id`。
- `ReplacementPlan` 已经使用稳定 locator/step ref 和 `apply_run_ref`，没有为每个 locator 再生成用户 command UUID。

### 3.2 本轮已完成的职责收口

1. **Article refs 已从资产行 mutation 中拆出。** `Assets.Refs` 只负责 `article_asset_refs` projection；内联 asset 解析在 Article transaction 中显式调用 `Assets.Persist.register`，不再通过 `Writer` 隐式拥有资产行写入。
2. **workflow 已按业务子域分组。** Upload、Provider、Replacement、Maintenance 分别拥有物理目录；共享的 run/step claim/lease/recovery 协议集中在 `Assets.Workflow`。
3. **Persist 的 owner、签名和文档一致。** `Persist.delete/2` 只锁定并软删除 canonical row；provider-delete Outbox 由用户 Command 或 maintenance workflow 明确写入。
4. **Upload completion 已有 durable identity。** `asset_uploads` 以 `upload_ref` 和 `idempotency_key` 唯一收敛 intent、completion snapshot 和 callback facts；重复 callback 返回同一 canonical asset。
5. **Provider cleanup 已统一为 Outbox worker effect。** Application upload、generated cleanup、provider reconciliation 都写 typed Outbox；同步 adapter 仅保留在 worker/明确 adapter 边界内。
6. **ReplacementPlan 已具备 durable apply recovery。** apply run 和 locator step 都有稳定 ref、claim/lease、attempt、result、conflict/failed 状态，worker 重启后只重试未完成 step。

### 3.3 Context Module Rules follow-up

当前 Assets 的核心 workflow 已完成，provider-delete intent 与 worker delivery 已切换到新的 effect owner：

```text
Assets.Commands.Delete
Assets.ProviderReconciliation
Assets.Maintenance
  -> Assets.Effects.enqueue_provider_delete
  -> CMS.Outbox

Jobs.CMSOutboxAsset
  -> CMS.deliver_outbox(:asset, job)
  -> CMS.Outbox.Workflow.Asset
  -> Assets.Effects.deliver_provider_delete
  -> Assets.Provider.Deletion
```

`Assets.Effects` 负责 effect intent 和 delivery boundary；`Assets.Deletion`（物理目录为
`assets/provider/deletion.ex`）只负责外部 provider adapter 及其 workflow caller 的持久化编排。
Command、Provider/Reconciliation 和 worker 不再直接构造 provider-delete Outbox payload。

## 4. 与现有 CMS 目录规范的对照

仓库中已经存在两种成熟模式：

```text
Communities.Tags / Communities.Moderators
  -> Commands / Query / Persist / Setup(or Maintenance)

Articles
  -> Commands / Draft / Publish / Revision / Bindings / Tags
```

这两种模式表达的是“先按业务子域分组，再在子域内按 Command、Query、Persist、Setup 分层”。Assets 的用户资产行和非用户 workflow 现在都按业务子域物理分组。

本轮已采用下面的结构；目录只表达 ownership，不改变用户 Command 与非用户 workflow 的 identity 边界：

```text
CMS.Assets
├── Commands/                         # 只放用户 asset-row Command + Confirmation
│   ├── Register
│   ├── Delete
│   ├── Archive
│   └── Restore
├── Query/                            # 资产库、统计、usage/read admission
├── Persist/                          # community_assets row primitive
├── effects.ex                         # Assets.Effects：provider-delete intent + post-commit delivery
├── Refs/                             # ArticleAssetRef projection
│   ├── Query
│   ├── Persist
│   └── Sync / Cleanup
├── Upload/                           # intent、completion、capability、upload state
├── Provider/                         # cleanup、reconciliation、orphan/GC adapter
├── Replacement/                      # plan、apply run、locator/step recovery
├── Maintenance/                     # backfill、Application Logo promotion 等非用户流程
└── Facade                             # CMS.Assets 只做 public dispatch
```

具体取舍：

- `Query`、`Persist` 是否由单文件变成目录，不是规范硬要求；当一个子域只有一个稳定 module 时，`query.ex`/`persist.ex` 符合现有仓库的单文件惯例。
- `Setup` 不应为了形式而添加。Assets 当前没有像 Moderator/Subscription 那样的 community 初始化 membership；Application Logo promote、backfill、retention 更适合 `Maintenance`/named workflow。
- `ReplaceUse` 属于 Article Draft authority，虽然当前物理文件仍在 `Assets.Commands` 下，但它被明确作为 cross-context asset-use command/workflow adapter，不被当作普通 `community_assets` row command。
- `Provider` 不等于 `CMS.Command`。Provider cleanup 是外部副作用；effect intent 由 `Assets.Effects` 记录，delivery 由 `Assets.Effects` 在 post-commit/worker 阶段委托 `Provider` adapter，使用 workflow identity，而不是为 provider 请求生成新的 user command。

## 5. 本轮 Asset 重构结果

### 5.1 合同已冻结，功能语义保持不变

每条入口均以 initiator、admission、lifecycle/version authority、transaction owner、identity、result/receipt、Outbox effect、retry/unknown outcome 为边界。用户 asset-row action 继续走 Command；非用户过程使用独立 workflow identity，不从 Writer 或 resolver 直接写业务行。

### 5.2 Article refs 已拆出，Writer 混合职责已删除

`Writer` 已删除，`Assets.Refs` 不拥有 community asset row mutation。

- `article_asset_refs` 的 sync/copy/purge/lock 已归到 `Assets.Refs`。
- 内联 asset 解析已改为同一 Article transaction 中显式调用 `Assets.Persist.register`。
- `Writer.register/delete/archive/restore` 已删除；没有保留兼容业务入口。
- Article update、ReplaceUse、Article delete 的 ref transaction owner 均仍由 Article/Refs projection 边界负责。

### 5.3 Upload workflow 已收口

Upload 不转成用户 `CMS.Command`，已成为可恢复的 named workflow：

- `upload_ref`、`idempotency_key`、intent facts、completion snapshot、failure/expired 状态已持久化到 `cms.asset_uploads`。
- `idempotency_key` 是唯一业务键，并参与 completion result recovery。
- completion 只接受 capability 绑定的 community、public ref、storage key、URL、size、MIME、asset type、thread、uploader facts；重复 callback 返回同一 canonical asset。
- quota lock、completion state 和 asset row update 的事务 owner 已明确；provider 不在请求内同步调用。
- focused tests 已覆盖 response-loss/replay、重复 callback、错误 storage identity；过期 capability 由 capability/intent validation 拒绝。

### 5.4 Provider/Maintenance workflow 已收口

- `ProviderReconciliation` 持久化 run/step ref、claim/lease 和最后结果；重复扫描复用稳定 workflow identity。
- provider-delete 通过 `Assets.Effects` 记录 typed Outbox intent，再由 worker delivery；`Deletion.enqueue/1` 仅作为明确的 provider adapter 边界，不是业务请求路径。
- generated asset retention、Application Logo cleanup、GC candidate scan 分别标记 initiator 和 workflow owner。
- Outbox effect key 继续使用 asset scope（如 `asset:<id>`）；event id 由 Outbox 生成，不能由 workflow 代替。
- pending/running/completed/failed、lease expiry、重复 maintenance run、response loss，以及 partial-success 语义均由 run/step 状态和 focused test 覆盖；已处理的 step failure 会立即把 run 标成 failed 并释放 lease，真正的 worker crash 才保留 lease 等待恢复。

### 5.5 ReplacementPlan workflow 已完成

ReplacementPlan 不是文档导入。它的功能是：从 Asset usage facts 生成计划，然后将一个 asset 在文章内容中的引用替换成另一个 asset；真正的文档导入仍由 `CMS.ContentImport -> CMS.DocTree.Import` 负责。

本轮已完成：

- plan 创建、apply run、每个 article item、每个 locator step 都有稳定 ref；
- worker claim/lease 防止两个 apply worker 同时修改同一 locator；
- step 状态区分 pending/claimed/succeeded/skipped/failed/conflict，并记录 version conflict；
- worker 崩溃后只重试未完成 step，已成功 step 返回同一 result；
- plan 创建时判定为 `historical_only` 或 `permission_denied` 的 item 不调用 `ReplaceUse`，而是写入 durable `skipped` item/step result；
- 按 `article_ids` 子集 apply 时，未选中的 step 保持 pending，run 释放租约并保持 pending，后续 apply 可继续剩余 item；
- item apply result 使用兼容 atom/string key 的更新，JSONB 重载后不会因重复 `result` key 丢失状态；
- `ReplaceUse` 继续区分用户 `commandId` 与 `{:workflow, workflow_ref}`，不把 step ref 填成用户 command；
- 计划整体结果明确支持 partial completion，不用一次进程循环的返回值冒充 durable Receipt。

### 5.6 物理目录迁移顺序与结果

实际按以下顺序完成，避免调用方在 owner 迁移前失去边界：

```text
1. 先补合同和 focused tests
2. 先从 Writer 提取 Refs projection，保持 Assets facade API 不变
3. Upload 建立 durable completion state
4. Provider cleanup 全部切到 typed workflow + Outbox worker
5. ReplacementPlan 建立 run/step claim/lease/recovery
6. 最后按 Refs / Upload / Provider / Replacement / Maintenance 移动物理目录
7. 删除 Writer 的资产行 public helper，并更新静态 boundary gate
```

目录移动没有先于 owner 和调用方迁移；没有添加兼容 facade。旧入口已删除或变为明确的无事务 persistence primitive，不能继续承担业务动作。

## 6. 验收清单

### 已完成的用户资产行边界

- [x] Register/Delete/Archive/Restore 有 concrete Command。
- [x] GraphQL 用户 mutation 使用非空 `commandId` 的路径已收口（当前 GraphQL 暴露的是 register/delete；archive/restore 是 facade/Command 能力）。
- [x] Gate admission、canonical asset row lock/write、Confirmation/Receipt result builder 已分层。
- [x] Register active upsert 使用 storage/url identity；Delete provider Outbox 复用用户 command identity。
- [x] facade convenience arity 不再隐式生成 command UUID。

### 本轮 workflow 验收

- [x] Upload completion durable state、`uploadRef`/`idempotency_key` 语义和 duplicate callback recovery。
- [x] Provider cleanup/reconciliation 的统一 Outbox owner、workflow run/step、claim/lease/retry。
- [x] ReplacementPlan 的 worker recovery、partial completion、version conflict 和 result recovery。
- [x] Writer 不再通过 `resolve_asset` 隐式拥有 Asset row register/delete/archive/restore。
- [x] `Assets.Effects` 统一 provider-delete intent/delivery，移除 Command、Provider/Reconciliation 和 worker 的直接 Outbox 入口。
- [ ] 物理目录按 `Commands / Query / Persist / Effects / Refs / Upload / Provider / Replacement / Maintenance` 收口。

### 不属于本文范围

- DocTree/ContentImport workflow；
- Article Activity 查询或导出产品；
- Auth/session、view/read markers 等明确不进入 CMS.Command 的 query/read 例外；
- 与 Asset 无关的 CMS family。

## 7. 当前证据和验证

主要代码入口：

- `backend/api/lib/groupher_server/cms/assets.ex`
- `backend/api/lib/groupher_server/cms/assets/commands/`
- `backend/api/lib/groupher_server/cms/assets/persist.ex`
- `backend/api/lib/groupher_server/cms/assets/query.ex`
- `backend/api/lib/groupher_server/cms/assets/refs.ex`
- `backend/api/lib/groupher_server/cms/assets/upload/workflow.ex`
- `backend/api/lib/groupher_server/cms/assets/provider/`
- `backend/api/lib/groupher_server/cms/assets/replacement/plan.ex`
- `backend/api/lib/groupher_server/cms/assets/maintenance/`
- `backend/api/lib/groupher_server/cms/assets/workflow.ex`
- `backend/api/lib/groupher_server/cms/model/asset_upload.ex`
- `backend/api/lib/groupher_server/cms/model/asset_workflow_run.ex`
- `backend/api/lib/groupher_server/cms/model/asset_workflow_step.ex`
- `backend/api/priv/repo/migrations/20261010100000_create_asset_workflow_state.exs`
- `backend/api/lib/groupher_server_web/resolvers/cms/assets.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/community.ex`

本轮已完成 Asset executable code、migration、focused tests 和文档更新。验证结果：

- `mix compile --warnings-as-errors`
- `mix test test/groupher_server/cms/assets_test.exs`
- `pnpm --dir backend/assets-hub type-check`
- `pnpm --dir backend/assets-hub test:unit`
- `pnpm graphql:codegen`
- `pnpm docs:check`
