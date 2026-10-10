# CMS Assets：现状审计与独立重构计划

> 本文把 Asset 从 CMS Phase 5 总文档中单独拆出，记录当前真实功能、入口、identity、事务 owner、目录职责和下一阶段重构边界。
>
> 当前结论：`RegisterAsset`、`DeleteAsset`、`ArchiveAsset`、`RestoreAsset` 的用户资产行 mutation 已进入 `CMS.Command` + Gate + Confirmation/Receipt；Upload、provider cleanup/reconciliation、ReplacementPlan 仍是独立的 Asset workflow，按后续阶段处理。本文不把这些 workflow 伪装成用户 Command，也不把 DocTree/ContentImport 混入 Asset 重构。

## 1. 先给结论

Assets 现在不是“完全不符合规范”，而是处于两层状态：

1. **用户资产行写入已经符合当前 CMS 写入合同。**
   `registerCommunityAsset` 进入 `Commands.RegisterAsset`，delete/archive/restore 的 concrete Command 也已经存在；Gate、Receipt、Confirmation 和 `Assets.Persist` 的 canonical row write 已经分开。
2. **整个 `CMS.Assets` bounded context 还没有完成物理和职责收口。**
   `Writer` 仍同时包含资产行 helper 和 Article `article_asset_refs` projection；Upload completion 仍是无持久化 callback 状态的 workflow；provider cleanup 有 Outbox workflow 和同步 provider adapter 两条路径；ReplacementPlan 仍是进程内逐项 apply，缺少 worker claim/lease/recovery。

因此，下一阶段不是把所有 Assets 都塞进 `CMS.Command`，而是按下面的规则收口：

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

| 对外能力                 | 当前入口                                                                                | 协议                    | 结果恢复                                                 |
| ------------------------ | --------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------- |
| `registerCommunityAsset` | GraphQL -> resolver -> `CMS.Assets.register_to_community/4` -> `Commands.RegisterAsset` | `CMS.Command` + Receipt | `RegisterAssetConfirmation` 记录 asset id + command id   |
| `deleteCommunityAsset`   | GraphQL -> resolver -> `CMS.Assets.delete/4` -> `Commands.DeleteAsset`                  | `CMS.Command` + Receipt | `DeleteAssetConfirmation` 重新加载已删除的 canonical row |
| archive                  | 当前 facade/Command 入口和测试使用，尚未看到对应 GraphQL mutation                       | `CMS.Command` + Receipt | `ArchiveAssetConfirmation`                               |
| restore                  | 当前 facade/Command 入口和测试使用，尚未看到对应 GraphQL mutation                       | `CMS.Command` + Receipt | `RestoreAssetConfirmation`                               |

Register 的 active row upsert 由 storage identity 或 URL hash 的数据库唯一约束收敛；delete 还会检查 usage completeness、锁定资产并拒绝仍被引用的资产。Archive/restore 是可逆状态变更，但当前仍统一使用 Receipt，避免 facade 或测试直接绕过 Command。

这些用户入口的 `commandId` 必须由客户端/上层用户 mutation 提供。Facade 的旧 convenience arity 已 fail-closed；Assets 不应在 resolver、facade、Writer 或 Persist 内生成默认 command UUID。

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
       -> quota lock + validated metadata + Persist.register
```

`createCommunityAssetUploadIntent` 没有用户 `commandId`：它签发短期 capability，不提交 `community_assets` 事实；响应丢失时允许重新签发。`completeCommunityAssetUpload` 是 Assets Hub 的 service callback，也不是用户 Command 的第二次执行。

当前实现依靠 `public_ref`、storage identity 和 URL/hash upsert 让重复 completion 尽量收敛，但 GraphQL 输入中的 `idempotency_key` 没有被 `Assets.Upload.complete/1` 持久化或校验，也没有以 `uploadRef` 为主键的 durable completion record。因此它现在是“数据库唯一性驱动的重复收敛”，还不是完整的 upload workflow recovery 合同。

### 2.4 Article asset refs

Assets 还承载文章内容中的使用 projection，但这不是 `community_assets` 用户 mutation：

```text
Article command / editor save
  -> CMS.Assets.link_refs / copy_refs / cleanup_refs
  -> Assets.Writer
  -> article_asset_refs + Article draft/revision scope
```

`article_asset_refs` 描述“资产被哪里使用”，而 `community_assets` 描述“资产本身、存储和计费”。两者不能合并成一个 writer owner。当前 `Writer` 的局部 transaction 是为了锁 Article body draft、替换 refs 和维护 completeness scope；它不应重新取得 Register/Delete/Archive/Restore 用户 mutation 的事务所有权。

但是，`Writer` 仍保留 `register/3`、`delete/3`、`archive/2`、`restore/2` 等旧资产行 helper，且私有函数 `Writer.resolve_asset/3` 在 Article ref 输入携带内联 asset 时仍可能调用 `Writer.register/3`。这不是新的 GraphQL Asset mutation，但说明物理代码边界还没有完全完成：Article ref projection 仍可以隐式触发资产行 upsert。

### 2.5 Application Logo、Wallpaper 和维护能力

这些入口不是普通用户资产 mutation：

| 能力                       | 当前模块                                                           | 语义                                                                          |
| -------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Application Logo promote   | `Assets.ApplicationUploads`                                        | 将已 finalized 的申请 Logo 转成普通 community asset，使用 Persist primitive   |
| generated-image intent     | `Assets.Upload.create_generated_intent/3`                          | capability 绑定 Wallpaper Batch/candidate/variant                             |
| generated asset cleanup    | `Assets.Deletion.delete_generated_assets/3`、`Wallpaper.Retention` | maintenance workflow，使用 workflow ref 和 provider-delete Outbox             |
| provider reconciliation    | `Assets.ProviderReconciliation`                                    | 扫描已删除数据库 authority，补发缺失 cleanup intent                           |
| provider orphan scan       | `Assets.ProviderReconciliation.scan_provider_orphans`              | 只识别候选，不直接删除 provider object                                        |
| completeness backfill      | `Assets.Backfill` / `Assets.Completeness`                          | 建立 version-owned ref 的安全 fence                                           |
| GC candidate scan          | `Assets.GC`                                                        | 只产生候选，检查 ref、upload、import、replacement、legal hold                 |
| Assets Hub generated batch | `Assets.GeneratedBatch`                                            | service-authenticated Batch claim/cleanup adapter，不是 Phoenix Asset Command |

当前 `Assets.Deletion.delete_generated_assets/3` 是 maintenance 批处理，不是全量原子事务：每个 asset 单独执行
自己的 soft-delete 与 provider-delete Outbox transaction；某个 asset 失败后会继续处理后续 asset，最终保留并返回
第一个错误，之前已经成功提交的 asset 不会回滚。这是当前实现的 partial-success 行为，不能被误读成用户资产行
Delete Command 的 Receipt 合同。下一阶段应由 maintenance workflow 明确确认这一语义，并补充 success/error/success
批次的 focused test、重试和观测字段。

## 3. 当前目录和模块职责

当前真实目录如下（不是目标目录的想象名称）：

```text
cms/assets.ex                         # CMS.Assets public facade
cms/assets/
├── commands/
│   ├── register_asset.ex              # user asset-row Command
│   ├── delete_asset.ex
│   ├── archive_asset.ex
│   ├── restore_asset.ex
│   ├── replace_use.ex                 # Article Draft asset-use Command/workflow adapter
│   └── *_confirmation.ex              # Receipt Confirmation codecs
├── persist.ex                         # CommunityAsset row primitives
├── query.ex                           # asset library/read-side queries
├── writer.ex                           # mixed asset-row + ArticleAssetRef projection
├── upload.ex                           # capability intent + service completion
├── capability.ex                       # HMAC capability contract
├── endpoints.ex                        # role-specific Assets Hub endpoints
├── provider_reconciliation.ex          # maintenance reconciliation
├── deletion.ex                         # provider deletion adapter + generated cleanup
├── replacement_plan.ex                 # plan creation and synchronous apply loop
├── application_uploads.ex              # Application Logo promotion
├── backfill.ex / completeness.ex       # usage ownership fence/backfill
├── gc.ex                               # conservative GC candidate scan
├── generated_batch.ex                  # Assets Hub generated Batch adapter
└── generated_batch/
    └── publish_capability.ex
```

### 3.1 已符合规范的部分

- `commands/` 已把四个用户 asset-row action 和 Confirmation 放在一个清晰边界内。
- `Persist` 没有自己开启用户事务，也不负责 Gate admission；它提供 lock/write/upsert primitive，由 Command 或 workflow 做 owner。
- `Query` 是 read-side module，不持有 Receipt，也不把查询伪装成 Command。
- `Capability`、`Endpoints`、`GeneratedBatch` 已经把外部 Assets Hub 协议拆成独立模块，避免把 provider HTTP 细节写进 GraphQL resolver。
- `ProviderReconciliation` 已经使用 `{:workflow, workflow_ref}`，没有把 maintenance UUID 冒充业务 `command_id`。
- `ReplacementPlan` 已经使用稳定 locator/step ref 和 `apply_run_ref`，没有为每个 locator 再生成用户 command UUID。

### 3.2 不符合“职责集中”规范的部分

1. **`writer.ex` 过宽。** 它同时包含 community asset upsert、soft delete、archive/restore、Article ref sync、copy、purge、lock、asset resolution、Outbox 旧路径。它现在是最明显的历史混合点。
2. **workflow 模块都平铺在 `assets/` 根目录。** `upload.ex`、`provider_reconciliation.ex`、`deletion.ex`、`replacement_plan.ex`、`backfill.ex` 的业务语义不同，但物理结构没有把 Upload、Provider、Replacement、Maintenance 分组；新同事很难从目录看出谁是用户 Command、谁是 service callback、谁是 maintenance。
3. **`Persist` 的文档和代码有一处不一致。** moduledoc 仍写“emits the provider-delete outbox intent”，但当前 `Assets.Persist.delete/3` 实际只做锁、completeness/ref 检查和 row update；Delete Command/maintenance deletion 才负责写 Outbox。`identity` 参数在 Persist.delete 中也只是 `_identity`，没有被使用。下一轮代码重构时应让文档、签名和 owner 三者一致。
4. **Upload completion 的 identity 没有完整落库。** `idempotency_key` 出现在 GraphQL input，却没有成为 workflow state 的唯一键；当前重复行为主要依靠 asset row 的 upsert constraint。
5. **Provider cleanup 仍有两种路径。** `ProviderReconciliation`/`Deletion.delete_generated_assets` 写 typed Outbox；`Deletion.delete_application_upload_object/1` 仍经过同步的 `enqueue/1` provider HTTP adapter。这两者的失败、重试和可观测性不同，后续应明确哪些必须由 Outbox worker 执行。
6. **ReplacementPlan 仍不是 durable worker workflow。** apply 使用进程内 `Enum.map_reduce`，虽然有 plan/item/locator status，但还没有独立的 claim/lease、worker restart、并发 apply 互斥和 response-loss result builder。

## 4. 与现有 CMS 目录规范的对照

仓库中已经存在两种成熟模式：

```text
Communities.Tags / Communities.Moderators
  -> Commands / Query / Persist / Setup(or Maintenance)

Articles
  -> Commands / Draft / Publish / Revision / Bindings / Tags
```

这两种模式表达的是“先按业务子域分组，再在子域内按 Command、Query、Persist、Setup 分层”。Assets 的用户资产行部分已经采用第一种模式，但 Upload、Provider、Replacement 和 Article refs 还没有按业务子域物理分组。

建议采用下面的目标结构；这是目录/ownership 目标，不是本轮直接移动代码：

```text
CMS.Assets
├── Commands/                         # 只放用户 asset-row Command + Confirmation
│   ├── RegisterAsset
│   ├── DeleteAsset
│   ├── ArchiveAsset
│   └── RestoreAsset
├── Query/                            # 资产库、统计、usage/read admission
├── Persist/                          # community_assets row primitive
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

- `Query`、`Persist` 是否由单文件变成目录，不是规范硬要求；当一个子域只有一个稳定 module 时，`query.ex`/`persist.ex` 与现有仓库完全兼容。
- `Setup` 不应为了形式而添加。Assets 当前没有像 Moderator/Subscription 那样的 community 初始化 membership；Application Logo promote、backfill、retention 更适合 `Maintenance`/named workflow。
- `ReplaceUse` 属于 Article Draft authority，虽然当前物理文件在 `Assets.Commands` 下，但它不应被当作普通 `community_assets` row command；后续可保留 cross-context command 名称，或移动到 Article Draft 的 asset-use 子域，需以调用方迁移为前提。
- `Provider` 不等于 `CMS.Command`。Provider cleanup 是外部副作用；它应由 Outbox/maintenance workflow 驱动，使用 workflow identity，而不是为 provider 请求生成新的 user command。

## 5. 下一阶段 Asset 重构任务

### 5.1 先冻结合同，不改功能语义

为每条入口补齐一张合同表：initiator、admission、lifecycle/version authority、transaction owner、identity、result/receipt、Outbox effect、retry/unknown outcome。重点不是再命名模块，而是避免同一 asset action 既能走 Command 又能从 Writer 直接写。

### 5.2 拆出 Article refs，消除 Writer 混合职责

目标：`Writer` 不再拥有 community asset row mutation。

- 将 `article_asset_refs` 的 sync/copy/purge/lock 归到 `Assets.Refs`（或 Article 现有 Draft/Bindings 子域）。
- 将 `resolve_asset` 中“内联 asset 自动 register”的语义改成显式编排：要么上层先调用 RegisterAsset，要么由同一个 Article command transaction 调用 `Assets.Persist.register` primitive，但不能再隐藏在通用 Writer 中。
- 删除/禁止 `Writer.register/delete/archive/restore` 作为 public business API；只保留迁移完成后仍被证明需要的 projection primitive。
- 对 Article update、ReplaceUse、Article delete 分别验证 ref transaction owner，不把它们误归为 Asset library command。

### 5.3 收口 Upload workflow

Upload 不转成用户 `CMS.Command`，但要成为可恢复的 named workflow：

- 以 `upload_ref` 为 workflow 主键，持久化 intent/completion/failure/expired 状态和 capability-bound facts。
- `idempotency_key` 要么成为明确的唯一业务键并参与 completion result recovery，要么从 GraphQL input 删除，不能保持“声明了但不使用”。
- completion 只接受 capability 绑定的 community、public ref、storage key、checksum、size 等事实；重复 callback 返回同一 canonical asset/result。
- quota lock、completion state 和 asset row update 的事务 owner 必须明确；provider 不得在请求内被同步调用。
- 覆盖 response 丢失、重复 callback、过期 capability、错误 community/storage identity、并发 completion。

### 5.4 收口 Provider/Maintenance workflow

- `ProviderReconciliation` 持久化 run/step ref、claim/lease 和最后结果；重复扫描不能制造新的业务 identity。
- provider-delete 统一通过 Outbox worker；`Deletion.enqueue/1` 的同步 HTTP 路径只能作为明确的非业务 adapter，不能和 durable cleanup 混用。
- generated asset retention、Application Logo cleanup、GC candidate scan 分别标记 initiator 和 workflow owner。
- Outbox effect key 继续使用 asset scope（如 `asset:<id>`）；event id 由 Outbox 生成，不能由 workflow 代替。
- 验收 pending/executing/completed/failed、worker crash、lease expiry、重复 maintenance run、response loss，以及批处理
  中单个 asset 失败后继续执行并保留首个错误的 partial-success 合同。

### 5.5 完成 ReplacementPlan workflow

ReplacementPlan 不是文档导入。它的功能是：从 Asset usage facts 生成计划，然后将一个 asset 在文章内容中的引用替换成另一个 asset；真正的文档导入仍由 `CMS.ContentImport -> CMS.DocTree.Import` 负责。

下一阶段需要：

- plan 创建、apply run、每个 article item、每个 locator step 都有稳定 ref；
- worker claim/lease 防止两个 apply worker 同时修改同一 locator；
- step 状态至少区分 pending/claimed/succeeded/failed/conflict，并记录 version conflict；
- worker 崩溃后只重试未完成 step，已成功 step 返回同一 result；
- `ReplaceUse` 继续区分用户 `commandId` 与 `{:workflow, workflow_ref}`，不把 step ref 填成用户 command；
- 计划整体结果明确支持 partial completion，不用一次进程循环的返回值冒充 durable Receipt。

### 5.6 物理目录迁移顺序

建议顺序如下，避免一次移动导致所有调用方同时失去边界：

```text
1. 先补合同和 focused tests
2. 先从 Writer 提取 Refs projection，保持 Assets facade API 不变
3. Upload 建立 durable completion state
4. Provider cleanup 全部切到 typed workflow + Outbox worker
5. ReplacementPlan 建立 run/step claim/lease/recovery
6. 最后按 Refs / Upload / Provider / Replacement / Maintenance 移动物理目录
7. 删除 Writer 的资产行 public helper，并更新静态 boundary gate
```

目录移动不能先于 owner 和调用方迁移；本项目不需要为了目录整齐而添加兼容 facade。迁移完成后，旧入口应直接删除或变为明确的无事务 persistence primitive，不能继续承担业务动作。

## 6. 验收清单

### 已完成的用户资产行边界

- [x] Register/Delete/Archive/Restore 有 concrete Command。
- [x] GraphQL 用户 mutation 使用非空 `commandId` 的路径已收口（当前 GraphQL 暴露的是 register/delete；archive/restore 是 facade/Command 能力）。
- [x] Gate admission、canonical asset row lock/write、Confirmation/Receipt result builder 已分层。
- [x] Register active upsert 使用 storage/url identity；Delete provider Outbox 复用用户 command identity。
- [x] facade convenience arity 不再隐式生成 command UUID。

### 后续 workflow 验收

- [ ] Upload completion durable state、`uploadRef`/`idempotency_key` 语义和 duplicate callback recovery。
- [ ] Provider cleanup/reconciliation 的统一 Outbox owner、workflow run/step、claim/lease/retry。
- [ ] ReplacementPlan 的 worker recovery、partial completion、version conflict 和 result recovery。
- [ ] Writer 不再通过 `resolve_asset` 隐式拥有 Asset row register/delete/archive/restore。
- [ ] 物理目录按 `Commands / Query / Persist / Refs / Upload / Provider / Replacement / Maintenance` 收口。

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
- `backend/api/lib/groupher_server/cms/assets/writer.ex`
- `backend/api/lib/groupher_server/cms/assets/upload.ex`
- `backend/api/lib/groupher_server/cms/assets/provider_reconciliation.ex`
- `backend/api/lib/groupher_server/cms/assets/replacement_plan.ex`
- `backend/api/lib/groupher_server_web/resolvers/cms/assets.ex`
- `backend/api/lib/groupher_server_web/schema/cms/mutations/community.ex`

本轮只新增/更新文档，没有修改 Asset executable code；当前 `Assets.Deletion.delete_generated_assets/3` 的
继续处理并保留首个错误行为来自既有代码提交，不属于本轮文档变更。文档校验基线通过：`pnpm docs:check`
（包含 documentation、CMS facade/query/resolver、business return shape 和 command identity gates）。
