# Dsb Edit Store 重组方案

> 状态：Dsb Query/EditStore/save 主线和 2026-08-29 边界收口均已完成。confirmed owner、后台
> reconcile、compatibility facade、窄订阅和 server-owned CacheEffect 已按
> [`query_store_boundary_hardening.md`](../architecture/query-store-boundary.md) 落地。真实 Cloudflare
> purge/跨 PoP 验证仍是发布门。
>
> 目标：TanStack Query 持有已确认的 Dsb 服务端配置；只有可编辑 Dash 会话创建
> `DsbEditStore`，并保持现有 SavingBar 的修改检测、保存、取消、失败重试和字段组语义。
>
> 执行顺序与跨文档任务见
> [`workflow_query_store_reorg.md`](./query-store-workflow.md)。公共 SSR、viewer state 和 CDN
> 边界见 [`tanstack_rewrite/query_sync_cache.md`](../migrations/tanstack/query-sync-cache.md)。

## 1. 当前问题

当前 `frontend/core/stores/dsb` 把几类不同生命周期的数据放在同一个 Valtio store：

- 后端已确认、可供 Community 和 Dash 读取的 Dsb 配置；
- 正在编辑、尚未保存的字段；
- `original`、touched、saving 等编辑会话状态；
- `editingLink`、`editingTag` 等具体编辑器的临时状态；
- demo localStorage、snapshot 和同步逻辑；
- GraphQL mutation、序列化、toast、CDN revalidation 等副作用。

这使只读页面也依赖 Dashboard 编辑 runtime，且保存中的服务端确认态、用户继续输入的当前值和
Query cache 很难安全同步。重组不保留一个通用 `DsbStore` 作为服务端数据容器。

## 2. 核心结论

数据所有权固定为：

| 数据                        | 唯一 owner                   | 说明                                        |
| --------------------------- | ---------------------------- | ------------------------------------------- |
| 后端已确认的 Dsb 配置       | `Q.dsb.config`               | Community、只读 Demo、正常 Dash 的读取来源  |
| 当前编辑字段                | `DsbEditStore`               | 仅可编辑 Dash 会话存在                      |
| 最近一次确认基线            | `DsbEditStore.original`      | 用于 touched、rollback 和并发保存 reconcile |
| 请求 pending/error          | TanStack mutation            | 不复制到 Valtio                             |
| 编辑器临时状态              | 对应编辑器局部 store/context | 不进入 DsbEditStore                         |
| 导航、modal、折叠等 UI 状态 | Valtio/UI context            | 短期不移除 Valtio                           |

因此目标结构不是 `DsbStore + DsbEditStore`，而是：

```text
TanStack Query: Q.dsb.config
  -> 只读页面直接渲染
  -> 可编辑 Dash 初始化 DsbEditStore

DsbEditStore
  -> 当前编辑字段 + original + touched
  -> SavingBar / editors
```

`useDsb()` 如果继续保留，只应是 `Q.dsb.config` 的薄读取 hook；不能再创建或返回 Valtio
`DsbStore`。内部命名统一使用 `dsb`、`TDsbXxx`；GraphQL 等外部协议中的 `dashboard`
名称保持不变。

内部 mutation/schema 常量沿用 `updateDashboardXxx`，与 GraphQL operation field 保持一致；
例如 `updateDashboardBaseInfo`、`updateDashboardLayout`、`updateDashboardEnable`、
`updateDashboardDocFaq` 和 `updateDashboardWallpaper`。本轮不额外引入 `updateDsbXxx` 别名，
避免本地标识符与 wire contract 之间产生无收益的映射。

当前实现已将 editable fields 与 `DsbEditorUi` context 物理拆开；`debug()`、`commit()`、`live$`、
`editField(s)`、`replaceOriginal` 等兼容 facade 均已删除。tag、alias、DocFAQ、moderator/rule
通过各自窄 hook 订阅 editor-session context，`initFilled` 已移除；link/media 的临时状态留在对应
editor hook，不进入 `DsbEditStore`。

## 3. 只读数据与宿主组合

### Community

Community 直接读取 `Q.dsb.config`。不创建 Dsb Valtio store，也不加载 SavingBar、编辑 actions
和字段 mutation 模块。

### Landing

Landing 使用自己的静态配置。它不是后端 Dsb 配置的编辑或缓存宿主，不应为了共享组件而创建
Dsb store。

### 只读 Demo

只读 Demo 从 `Q.dsb.config` 读取 demo 社区已发布配置，但不创建 `DsbEditStore`，也不允许
localStorage snapshot、拖拽、编辑和任何配置 mutation。

### 可编辑 Dash

可编辑 Dash 读取同一份 `Q.dsb.config`，在进入编辑 route 时创建一次 `DsbEditStore`：

```text
Q.dsb.config.data
  -> createDsbEditStore(data)
      current fields = data
      original = data
      touched = empty
```

Query 后台刷新不能直接覆盖正在编辑的字段；需要通过第 6 节的 `reconcile` 规则合并。

### Consumer 迁移

`useDsb` 调用者不能整体迁到同一个新 hook，实施时按实际字段归属直接切换：

| 入口                                        | 目标                                                                            |
| ------------------------------------------- | ------------------------------------------------------------------------------- |
| `frontend/dash/src/components/DsbShell.tsx` | 删除通用 `DsbStoreProvider`；可编辑 route 从 `Q.dsb.config` 创建 `DsbEditStore` |
| CommunityDigest 和展示类 hooks              | 直接读取 `Q.dsb.config`                                                         |
| Dsb editors / SavingBar                     | 读取 `DsbEditStore`                                                             |
| `SubMenuContentLayout`                      | `submenuCollapsed` 移入 Dash shell UI state                                     |
| `createCmsSectionLayout`                    | breadcrumb/submenu UI 读取 Dash shell UI state                                  |

Phase 0 必须生成完整 `useDsb` caller 与字段清单；上表是必须点名验收的入口，不代表调用者全集。
consumer 切换后直接删除旧 hook/provider，不保留双读或 fallback。

## 4. DsbEditStore：为 Dsb 编辑而设计

不再保留通用 `createDraftFieldActions`。它目前只有 Dsb 一个领域消费者，抽象出的泛型、字段桥接
和间接调用没有复用收益。重组后将 dirty、rollback 和 reconcile 逻辑直接写在 DsbEditStore 中，
以 Dsb 字段组和 SavingBar 产品语义为边界。

建议合同：

```ts
type TDsbEditStore = TDsbEditableFields & {
  original: TDsbEditableFields
  touchedFields: Partial<Record<TDsbFieldKey, true>>

  edit: <K extends TDsbFieldKey>(field: K, value: TDsbEditableFields[K]) => void
  editMany: (patch: Partial<TDsbEditableFields>) => void
  rollback: (fields: readonly TDsbFieldKey[]) => void
  reconcile: (input: TDsbReconcileInput) => void
  isTouched: (field: TDsbFieldKey) => boolean
  anyTouched: (fields: readonly TDsbFieldKey[]) => boolean
}
```

这里没有 `.draft`：当前编辑字段直接位于 store 顶层，以减少现有组件迁移量。`original` 是唯一的
基线对象。`touchedFields` 由每次 `edit`/`editMany` 后比较当前值和 `original` 得出；字段组仍可
复用现有的领域比较 helper，但 helper 不再伪装成通用 store 基础设施。

Store 不持有：

- Query cache 或已发布配置的第二份只读副本；
- `saving`、`savingField`、`loading`、request error；
- GraphQL request、toast、CDN purge；
- `editingLink`、`editingTag` 等编辑器步骤状态。

## 5. SavingBar 合同

SavingBar 的产品行为保持不变，但状态来源更明确：

```text
当前值        DsbEditStore[field]
已确认基线    DsbEditStore.original[field]
是否修改      DsbEditStore.anyTouched(fields)
请求状态      useDsbSaveRunner(...).isPending / error
```

取消操作调用 `rollback(fields)`；它将这一字段组从 `original` 复制回当前字段，并清除 touched。
保存操作必须先创建不可变 submitted snapshot，再调用 TanStack mutation。多字段保存继续以现有
字段组作为一个提交和 reconcile 单位。

## 6. 保存成功后的 reconcile

不能用“请求成功后把服务端 response 整体覆盖当前 store”的简单策略。用户可能在请求 pending
期间继续输入：

```text
original A
  -> 用户提交 B
  -> 请求 pending 时继续编辑为 C
  -> 服务端确认 B
```

正确结果应是：`original = B`、当前值仍为 `C`、字段继续 touched。对每个提交字段执行：

```text
confirmed = mutation response 中的服务端确认值
submitted = mutate 时冻结的值
current   = response 到达时 DsbEditStore 中的值

original[field] = confirmed

if current 与 submitted 相同:
  current[field] = confirmed
else:
  保留 current[field]

重新比较 current 与 original，更新 touched
```

这也是 Query 与编辑 store 同步的唯一入口：保存成功先用服务端 response 更新
`Q.dsb.config`（`queryClient.setQueryData`，或在 response 不完整时 `invalidateQueries`），再用同一
份 confirmed 数据执行 `DsbEditStore.reconcile`。Query 刷新也走显式 reconcile，不能偷偷重建
编辑 store。

## 7. 保存层改为 TanStack mutation

旧的巨大 `frontend/core/unit/DsbThread/logic/useMutation.ts` 已删除。当前保存层拆成
`frontend/core/query/mutation/useDsbSaveRunner.ts` 的 TanStack lifecycle runner、
`useDsbFieldSave.ts` 的领域意图编排，以及以下无 React 副作用的领域请求函数：

```text
useDsbSaveRunner
  TanStack mutation 生命周期、submitted snapshot、Query 更新、reconcile、toast

useDsbFieldSave
  将字段保存意图路由到对应领域 builder，不解释通用 GraphQL response

query/mutation/dsb/baseInfo.ts
query/mutation/dsb/layout.ts
query/mutation/dsb/links.ts
query/mutation/dsb/integrations.ts
query/mutation/dsb/tags.ts
  各自负责字段组到 GraphQL input 的映射和 response 归一化
```

这些是普通函数和窄类型，如 `TDsbSaveInput`、`TDsbSaveResult`；不引入 command bus、class、registry
或 `TDashboardCommand` 之类的通用框架。每个领域 builder 同时提供窄的 confirmed reader，限定在
自己的 mutation/payload 作用域内；runner 不再递归扫描 response，避免跨 response 作用域按
同名字段误取。

底层 GraphQL transport 使用 `graphql-request` 加项目薄适配器 `browserGraphQLRequest`。适配器
只统一 endpoint、credentials、CSRF、auth refresh/replay、错误形状和 `AbortSignal`；TanStack
Query 负责请求生命周期和 cache。详细约束见
[`urql_to_tanstack_query.md`](../architecture/urql-to-tanstack-query.md)。

必须保留的领域逻辑包括：

- BaseInfo 的 BASIC/OTHER 字段组和 SEO 字段组；
- Enable 配置的差异 key；
- Header/Footer link 归一化；
- Kanban 序列化；
- Tag update 与 reindex 的不同语义；
- Doc FAQ save zone；
- ThemePreset 的 custom/readonly 规则；
- 多字段原子保存、取消和失败重试。

业务保存成功但 CDN purge 失败时，不回滚已确认配置。purge 失败需要可观测且可重试；缓存边界
详见 [`tanstack_rewrite/query_sync_cache.md`](../migrations/tanstack/query-sync-cache.md)。

## 8. 编辑器局部状态

以下是已落地的 owner 映射。它们不是 Dsb 配置，也不进入 `DsbEditStore`；需要跨组件协作的编辑
会话状态集中在窄的 `DsbEditorUi` context，单一 editor 的草稿和查询索引留在对应 hook。

| 状态                                  | 当前实现                                                 | 目标归属                      |
| ------------------------------------- | -------------------------------------------------------- | ----------------------------- |
| `editingLink`、mode、group            | `useDashboardLinkEditorActions` 局部 state               | LinkEditor/editor action hook |
| `editingTag`、`settingTag`、slug 校验 | `DsbEditorUi` context；持久 tag layout 仍在 DsbEditStore | TagSettingEditor / tag editor |
| `editingAlias`                        | `DsbEditorUi` context                                    | Alias editor                  |
| `docFaqSaveZone`                      | `DsbEditorUi` context                                    | DocFaq editor                 |
| media report index                    | `useMediaReports` 的局部 `useState/useRef`               | MediaReport editor            |
| moderator/rule 编辑步骤               | `DsbEditorUi` context                                    | Admin editor                  |
| `submenuCollapsed`                    | 已移入 Dash shell UI state                               | Dash shell UI state           |

收口结果：editor 不再从 `useDsbEdit` 读取上述临时状态；`commit()` 不再写 UI state；旧
`uiStore`、`debug()` 和链接 state 镜像均已删除。`DsbEditorUi` 只作为 editor-session 边界，
不作为已确认配置或可编辑字段的第二份 owner。

LinkEditor 的确认只把完整 links 写入 `DsbEditStore`，最终仍由 SavingBar 保存。Tag groups 等服务端
资源由 Query 持有，tag CRUD 使用独立 TanStack mutation；不要把它们塞进 DsbEditStore。

## 9. Bundle 边界

Community、Landing 和只读页面直接读 Query 或静态配置后，不再需要导入 `stores/dsb`、SavingBar
以及保存模块。只要共享组件没有静态反向引用 Dash 编辑代码，非 Dash bundle 会因此减少。

短期目标不是移除 Valtio：其他 UI state 和 `DsbEditStore` 仍可继续使用它。目标只是防止只读
server state 和编辑 runtime 被 Valtio 的存在绑定在一起。

## 10. 实施约束与验收

本轮已完成本地验收：

- [x] `Q.dsb.config` 是已确认 Dsb 配置的唯一 cache owner；bootstrap 只负责按领域 seed，Valtio
      只保留 working copy 或可重建 projection；
- [x] Community/只读 Demo 不创建 DsbStore 或 DsbEditStore；
- [x] 只有可编辑 Dash route 创建 DsbEditStore；
- [x] DsbEditStore 顶层当前字段、`original` 和 touched 的 SavingBar 行为与现有产品一致；
- [x] pending 期间继续编辑时，成功 response 不覆盖新输入；
- [x] mutation pending/error 只来自 TanStack mutation；
- [x] 保存成功通过 TanStack Query API 更新或失效 `Q.dsb.config`；
- [x] editor 临时状态按 owner 拆分：链接和媒体查询索引由 editor hook 持有，tag/alias/DocFAQ/
      admin/rule 会话状态由 `DsbEditorUi` 持有，submenu 由 Dash shell 持有；tag 等独立资源留在 Query；
- [x] 保存与 CDN purge 分离；CacheEffect 由 Community/Dash server proxy 解释并异步执行，purge
      失败只进入重试/结构化日志，不伪装为业务保存失败；
- [x] 删除 demo localStorage config/snapshot/subscribe；
- [x] 非 Dash route 的依赖图不再静态包含 Dsb 编辑 runtime；
- [x] 单字段、多字段、rollback、失败重试、领域 response normalization 和并发 reconcile 测试通过；
      response reader 按领域限定 mutation/payload 作用域，不再依赖 orchestration 层的递归字段查找。

仓库全量前端测试为 194 个文件、792 个用例通过；全仓类型检查以及
Community/Dash/Landing production build、GraphQL 契约、theme first-paint 和后端编译均通过。
本轮 source 在并行 `vgpu-poc` 文件出现前通过全仓文档检查；当前 dirty worktree 的剩余文档/格式
问题仅来自该实验目录及其 `.tmp` 产物，合并前仍须由对应改动清理并重跑。Cloudflare production
purge、跨 PoP 失效和线上告警仍需真实部署凭据验证。

## 11. 非目标

- 不改变 GraphQL/HTTP 外部协议中的 `dashboard` 字段名；
- 不重写 SavingBar 的视觉和交互；
- 不改变现有字段组、序列化和权限产品逻辑；
- 不在本轮移除 Valtio；
- 不引入通用 command 或通用 editable-store 框架。
