# Wallpaper 前端保存编排简化方案

> 文档角色：Implemented contract；记录本轮已落地的边界、读点迁移和保存编排，不再把目标状态当作待实施项
>
> 日期：2026-09-07
>
> Active contract：[保存链路与数据边界](./save-pipeline-contract.md) ·
> [当前 theme 单独保存重构](./current-theme-save-refactor.md) ·
> [响应式静态产物、历史与共享导出机制](./responsive-revisions.md)

## 1. 结论

当前 Wallpaper 发布协议不是过度设计。四个响应式 Profile、WebGPU 导出、Assets Hub capability、
两阶段 prepare/publish、`baseVersion`、幂等、Receipt、lease 和孤儿资产 reconciliation 都有独立的
正确性职责，不应为了缩短前端代码而删除。

需要简化的是浏览器实现的职责集中：`useLogic.ts` 同时承担编辑器 UI、draft、产物计划、WebGPU 导出、
GraphQL、Assets Hub、上传、补偿清理、并发版本和 Query 刷新。协议复杂度因此泄漏进 React hook，且核心
保存编排没有覆盖完整失败窗口的直接测试。

目标是保持 Wallpaper 协议内部的请求顺序不变，并把跨域 Save 的顺序明确冻结为
Dashboard content-shadow → Wallpaper publish，将前端拆为四层：

```text
React editor hook / request coordinator
  -> buildWallpaperPublishPlan（纯函数，不生成幂等 key）
  -> exportWallpaperImages（WebGPU 边界）
  -> executeWallpaperPublish（网络编排）
  -> TanStack Query cache 同步写回 / 失效
```

## 2. 当前状态与目标状态

以下边界是当前实现的验收基线；ThemePreset 仍明确排除在本方案之外：

| 范围           | 当前状态                                                                                                                  | 目标状态                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Community      | 普通页不挂载 `WallpaperStoreProvider`，只消费发布态静态数据与 Dashboard shadow                                            | editor route 才挂载 authoring store                                         |
| Dash           | `DsbShell` 仅在 Appearance/Wallpaper 路由挂载 `WallpaperStoreProvider`                                                    | 其他路由只消费 Query 发布态数据                                             |
| Landing        | 使用常量 `LANDING_INIT_DATA`，共享 Wallpaper hook 在无 editor store 时走静态 fallback                                     | 不加载 WebGPU editor runtime                                                |
| PageCommunity  | GraphQL 已删除 `dashboard.wallpaperSettings`，保留发布态 Wallpaper 与独立 `dashboard.contentShadow`                       | editor settings/history 仅由 route-only query 读取                          |
| 静态 Wallpaper | `wallpaperKeys.config` 的结果经 `StaticWallpaperProvider` 投影为 React Context；保存 hook 直接订阅同一 Query 读取 version | Context 只作为渲染投影；confirmed version 唯一从 Wallpaper Query 订阅和更新 |
| ThemePreset    | confirmed preset/tokens/options 仍镜像在 Valtio，普通页面会读取                                                           | 不属于本方案；后续如收口 Query ownership，必须单独盘点 CSS 注入和普通页读点 |

本轮已完成普通页面 Provider 卸载；读点迁移包括：

- GlobalLayout 的 Dashboard `contentShadow` 内容表面效果（它不是 Wallpaper store 读点）；
- Landing salon 的 Wallpaper 派生样式与自有内容表面配置；
- `useFullWallpaper`、`useTopGlow` 等共享外观路径的静态 fallback；
- editor-only Provider 初始化与 route query 的 baseline reconcile。

`usePageBg` 只读取 ThemePreset store，不是 Wallpaper 读点，不纳入本方案。`useTopGlow` 的 Landing 分支现从
静态 Wallpaper source 读取 `source === AMBER_MAUVE`，仍保留对应 glow 视觉规则。

`StaticWallpaperProvider` 继续作为静态渲染的窄投影，但不成为 version 的第二个 owner。
Query / Store 边界、普通页面 Provider 卸载和静态消费读点已在本轮一起收口；ThemePreset 仍不在本方案内。

## 3. 不变项

本方案不改变以下 invariant：

- Wallpaper publish 一次只处理当前 `light | dark` theme；一次 Appearance Save 可以由 coordinator
  编排 Wallpaper publish 与 Dashboard `contentShadow` mutation 两个独立请求；
- `NONE` 不导出图片，直接发布当前 theme 的空 Snapshot 指针；
- 其他类型一律导出 `wide/desktop/tablet/phone` 四张最终图片；
- Browser 仍按 `prepareWallpaperUpload -> Assets Hub Batch -> upload -> publishWallpaper` 执行；
- Phoenix publish 仍在事务内校验 `baseVersion`，写 Snapshot、Images、当前 theme 指针、version 和 Receipt；
- Assets Hub 仍负责 capability、manifest、对象校验、lease 和 reconciliation；
- 相同提交重试仍复用 idempotency key；
- 请求在飞行期间产生的新本地编辑不能被旧请求的成功响应覆盖；
- Wallpaper lane 的 `TWallpaperLogic`、loading 语义、toast 和面向用户的错误文案默认保持不变；Appearance
  coordinator 只额外定义双 mutation 的整体/部分成功状态，不改写 Wallpaper 原始错误。

`contentShadow` 从 Wallpaper wire 拆出后，不能继续把“当前 theme 的全部 dirty patch”作为一个
Wallpaper publish 请求的隐含输入。Appearance Save 的提交边界固定为：Wallpaper draft 只进入
Wallpaper publish；Dashboard content-shadow draft 只进入 Dashboard 普通字段 mutation；两者可以由同一个 UI
Save 触发，但各自拥有独立的 Query 更新和 baseline 确认。

不建议第一步把 Assets Hub Batch 创建改成 Phoenix 代办。那会把浏览器复杂度转移为 Phoenix 到 Assets Hub
的同步可用性耦合，且改变现有 capability 边界；只有独立证明当前协议不可维护时才重新评估。

## 4. 当前职责集中点

当前 `frontend/core/unit/DsbThread/Appearance/Wallpaper/useLogic.ts` 同时包含：

1. tab、rollback 和 editor action；
2. 当前 theme draft 与 preview flush；
3. savable patch/touched 派生、settings encode 和 Profile 映射；
4. WebGPU capability 判断与四图导出；
5. GraphQL prepare；
6. Assets Hub Batch 创建；
7. upload intent 匹配与并行上传；
8. GraphQL publish；
9. 失败后的 cancel；
10. 本地 `wallpaperStateVersion`；
11. fingerprint 和 idempotency key 生命周期；
12. Query invalidation、冲突 refetch 和 toast。

Wallpaper store 实际保存的是 `light/dark` draft、`original` 基线，以及
`commit/acceptSubmitted/reconcileConfirmed` 行为。Preview 由 `useWallpaperPreview` 的 event/debounce 路径管理，
touched 由 `getWallpaperThemeSavablePatch` 派生；本方案不假设 store 内存在 preview 或 touched 字段。

## 5. 目标职责

### 5.1 `buildWallpaperPublishPlan`

纯函数，只把当前已 flush 的 editor state 转换为不可变发布计划：

```ts
type TWallpaperPublishPlan =
  | {
      type: 'none'
      community: string
      theme: 'light' | 'dark'
      baseVersion: number
      settings: WallpaperSettingsInput
    }
  | {
      type: 'generated'
      community: string
      theme: 'light' | 'dark'
      baseVersion: number
      settings: WallpaperSettingsInput
      renderSpec: TBgRenderSpec
      targets: readonly TWallpaperExportTarget[]
    }
```

职责：

- 判断 `none/generated`；
- 固定当前 theme；
- encode settings；
- 冻结完整 `renderSpec`，避免导出等待期间被新 draft 修改；
- 生成固定四 Profile targets；
- 形成稳定 fingerprint 所需的不可变输入。

它不生成、复用或更新 idempotency key，也不执行 React、WebGPU、GraphQL、fetch、上传或 toast。

### 5.2 Idempotency coordinator

幂等 key 是请求协调职责，不属于 plan builder：

Wallpaper 拥有幂等 lane；Dashboard content-shadow 是普通字段更新，不参与幂等协调：

1. Wallpaper lane 根据 `{wallpaperBaseVersion, theme, wallpaperSubmitted}` 形成 fingerprint；
2. pending fingerprint 相同则复用旧 key，不同则创建新 key；
3. Wallpaper executor 只接收已经确定的 `{plan, idempotencyKey}`，Dashboard executor 只接收普通字段 patch。

同 fingerprint 重试必须把对应 lane 的旧 key 原样传给 executor；builder 本身不根据重试上下文做决策。

### 5.3 `exportWallpaperImages`

只接受 `generated` plan，调用现有 Wallpaper Export 能力并返回四张带 checksum/尺寸/mime 的图片。

职责：

- 在真正需要生成图片时检查 WebGPU capability；
- 复用一次初始化的 GPU runtime 完成四 Profile 导出；
- 校验导出结果与 plan targets 一一对应。

它不知道 Community、GraphQL mutation、Assets Hub endpoint、QueryClient 或 UI。

### 5.4 `executeWallpaperPublish`

只负责现有网络协议：

```text
NONE
  -> publishWallpaper

generated
  -> exportWallpaperImages
  -> prepareWallpaperUpload
  -> create Assets Hub Batch
  -> upload all images
  -> publishWallpaper
```

GraphQL client、Batch client、uploader 和 exporter 作为依赖注入，测试不需要真实 WebGPU、R2 或网络。

失败和补偿必须按“已经创建了什么”以及“publish 结果是否确定”划分：

| 失败窗口                                            | 已有 Batch                                 | publish 结果 | 补偿语义                                                                                        |
| --------------------------------------------------- | ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------- |
| WebGPU capability / export 失败或只导出部分 targets | 否                                         | 未调用       | 不 cancel，不调用 GraphQL                                                                       |
| prepare 请求失败                                    | 否                                         | 未调用       | 不 cancel                                                                                       |
| prepare 返回空 batch                                | 否                                         | 未调用       | 不 cancel；使用独立的 prepare 空响应错误名                                                      |
| Assets Hub Batch 创建失败                           | Phoenix 已 prepare，Hub 创建结果可能不确定 | 未调用       | 尝试 cancel，保留原始错误为主错误                                                               |
| upload intent 缺失或任一上传失败                    | 是                                         | 未调用       | 尝试 cancel                                                                                     |
| publish 明确返回失败                                | 是                                         | 明确失败     | 尝试 cancel；Hub 的 claim/lease/reconciliation 仍是最终安全边界                                 |
| publish 请求因 transport 异常 rejected              | 是                                         | 未知         | 当前实现会尝试 cancel；先用契约测试锁定，若要改为不 cancel，必须作为协议决策单独评审            |
| GraphQL 请求 resolved 但 publish payload 为空       | 是                                         | 未知         | 当前空响应错误发生在 executor 返回后，不 cancel；保留同一 key 重试/查证，不能假定可安全删除资产 |
| publish 明确成功后的本地 cache/toast 处理失败       | 是且已 claim                               | 明确成功     | 禁止 cancel                                                                                     |

提取时拆分当前混用的错误名：Assets Hub Batch POST 失败继续使用创建失败语义；prepare 空响应使用独立错误名，
例如 `WALLPAPER_PREPARE_EMPTY_RESPONSE`。Cleanup 错误不能覆盖原始发布错误。

当前 `cancelAssetsHubBatch` 只吞掉 rejected fetch，没有检查非 2xx；拆分时应补齐响应检查和可观测性。

### 5.5 React hook 与 Appearance Save coordinator

Wallpaper hook 只保留 Wallpaper 领域的交互职责：

- flush Wallpaper preview/draft；
- 从 Wallpaper editor store 读取背景 working copy；
- 直接订阅 `wallpaperKeys.config(community)` 的当前发布 version；
- 为 Wallpaper fingerprint 复用 pending idempotency key；
- 调用 Wallpaper publish mutation；
- 成功后只确认 Wallpaper submitted patch；
- 用 `setQueryData` 同步写回 `wallpaperKeys.config` 的新 version，再 invalidate/refetch；
- invalidate `wallpaperEditorKeys.config`，由 editor Query 刷新 confirmed Wallpaper settings/history。

外层 `AppearanceSaveCoordinator` 负责一次 UI Save 的跨域编排：

- 分别从 Wallpaper draft 和 Dashboard content-shadow draft 计算两个 savable patch；
- 两个 patch 都为空时不发请求；只有一个 patch 脏时只调用对应 mutation；
- 两个 patch 都脏时按固定顺序提交：先 Dashboard content-shadow mutation，再 Wallpaper publish，避免
  在 Dashboard 普通字段写入失败后启动 WebGPU/Assets Hub 流程；
- 不做跨 aggregate rollback。一个 mutation 成功后立即确认该 aggregate 的 submitted baseline，另一个
  mutation 失败时只保留失败 aggregate 的 dirty draft；
- 两者都成功才显示整体成功 toast；部分成功必须显示原始失败错误并保持下一次 Save 只重试失败 lane；
- loading 只有在两个 mutation 都 settled 后结束，失败 lane 的重试 key 与 baseline 独立保留。

Dashboard content-shadow mutation 只接收一个普通 boolean 字段，并返回更新后的 Dashboard
`contentShadow`。它不调用 Assets Hub，不参与 Wallpaper batch cancel，也不复用 Wallpaper `version`。普通
`PageCommunity` 只选择 `contentShadow` 这个渲染所需窄字段；字段值由 Dashboard Query 返回并进入静态渲染投影。

`wallpaperStateVersion` 不再复制到局部 `useState`。`getQueryData` 只能读瞬时 cache，不能替代订阅；hook 应通过
同一个 Query key 的 `useQuery`/既有 route Query 结果读取 version，不会因此产生第二份请求缓存。

Wallpaper lane 的 `5702`（version conflict）和 `5708`（idempotency conflict）仍是其 canonical Query
refetch 入口，使用 `wallpaperKeys.config(community)`。Dashboard content-shadow 是普通字段更新，不新增
另一套错误码；Dashboard 成功或普通失败只更新对应 `dsbKeys.config(community)`，不覆盖本地 draft。

## 6. Valtio / Query / Context 目标边界

目标边界如下：

- Wallpaper editor Valtio store：`light/dark` Wallpaper working draft、`original` 基线和 draft
  reconcile/accept 行为；`contentShadow` 不再属于该 store、codec 或 Wallpaper savable patch；
- Dashboard content-shadow draft：单个 boolean working draft、独立 original 基线和独立
  reconcile/accept 行为；它是 UI draft，不是 Query 的可变镜像；
- TanStack Query：已发布 Wallpaper、Wallpaper version、editor route 的 confirmed settings/history；
- TanStack Query：已发布 Dashboard `contentShadow` 普通字段；
- StaticWallpaper React Context：从 Query 或 SSR 数据投影出的静态渲染输入，不承担版本所有权；
- Preview：event bus、animation frame/debounce 和最终 commit，不进入 store 字段；
- touched：从 working draft 与 `original` 的 diff 派生，不进入 store 字段。

普通页面当前已不挂载 Wallpaper editor store，也不查询 `wallpaperSettings/renderConfig`；这条 Phase 5
边界已由 Provider、PageCommunity payload 和共享读点迁移共同成立。

### Dashboard `contentShadow` 归属（已确认）

`contentShadow` 是 Dashboard 下独立的内容表面呈现配置，不是 Wallpaper 配置，也不是
`wallpaperPresentation`（该名称不是现有代码概念）。它由 GlobalLayout、Community 内容容器和 Landing
内容容器消费；Wallpaper renderer 只接收背景本身的 render spec，不接收 `contentShadow`。

独立存储不改变 Content surface 的视觉门：当前 theme 的有效 shadow 仍为
`hasWallpaper[theme] && dashboard.contentShadow`。Wallpaper 为 `NONE`/`null` 时只
关闭本次渲染效果，不清除 Dashboard shadow 配置；Wallpaper 恢复后，已保存的 shadow 配置可以重新生效。

归档 wire 曾把它按 `light/dark` 放在 `wallpaperSettings.*.renderConfig` 中。这是历史形态，不是
当前归属。当前实现提供独立的 `dashboard.contentShadow` boolean 字段，两个 theme 共用一个开关。

这不是可以让普通页先切、editor 后切的 1→2→3 分阶段顺序，而是一个一次性 contract cutover：

1. Dashboard 独立字段、持久化、mutation、SSR/PageCommunity 输出同时准备；本次不迁移历史数据；
2. editor route 的 working draft 与普通页同时切到 `dashboard.contentShadow`；
3. Wallpaper codec、settings schema、Snapshot canonical JSON 和 digest 同一批移除
   `renderConfig.contentShadow`；本次 cutover 早于首次部署，settings/request digest 继续使用 v1。

在全部切换完成前，普通页面不能开始信任独立字段。本次按首次部署前 hard cut 执行，不支持普通页、editor、
schema 分阶段上线，也不接收旧 `renderConfig.contentShadow` 或增加 Wallpaper publish→Dashboard 的双写桥接；
若部署环境无法保证同时上线，应另行安排一次性发布窗口。

这是本方案明确批准的 GraphQL/backend schema 例外。它是内容呈现契约，不应命名为 Wallpaper
presentation，也不应由 `StaticWallpaperProvider` 或 Wallpaper Query 成为 owner。

### `contentShadow` 持久化与 Snapshot 关系（Phase 0 必须冻结）

当前实现已经完成 hard cut：`CMS.Wallpaper.Settings`、`RequestDigest`、Snapshot 和 Receipt 只处理背景四键，
`contentShadow` 由 `CommunityDashboard.content_shadow` 普通 boolean 字段持久化；restore 只切换 Wallpaper active
Snapshot 指针。

Phase 0 必须冻结以下持久化与生命周期契约，才能执行上述 hard cut：

1. **canonical owner 与 SSR 来源**：Dashboard 独立字段是唯一真相源；普通 Query/SSR 直接读取
   `dashboard.contentShadow`，不保留 Snapshot 投影、历史回填或 fallback。
2. **持久化归属与 mutation**：`contentShadow` 落在 `CommunityDashboard` 的普通 `content_shadow` boolean 字段
   中；由现有 Dashboard section writer 经 `update_dashboard_content_shadow`
   mutation 写入。它与
   `CommunityWallpaper` 是不同 aggregate，Wallpaper publish
   不再写该字段。
3. **事务边界**：Dashboard content mutation 与 Wallpaper publish 各自拥有事务、错误和重试语义；同一个
   Appearance Save 若同时提交两者，也只能由 UI 编排两个独立 mutation，不能假设跨 aggregate 原子性。若未来
   需要“整套外观”原子恢复，必须新建显式 bundle mutation。
4. **restore 生命周期**：恢复 Wallpaper Snapshot 不回退 `dashboard.contentShadow`。如果产品要求恢复整套
   外观，必须由显式的跨域 restore 输入同时更新 Dashboard 字段；不能让只切 active pointer 的 mutation 隐式改变它。
5. **digest/Receipt**：本次 cutover 早于首次部署，四键 shape 直接以 settings v1 上线，不产生版本升级或
   历史数据。若未来在已部署五键 v1 上重复执行，必须另开版本升级与数据生命周期变更；运行时不保留旧 key。
6. **历史边界与配额**：不做 v1→v2 Snapshot materialization，也不为历史 Snapshot 创建镜像。最近 5 次
   history 只统计 post-cutover 新模型 Snapshot；`deleteAfter` 宽限期和 5 个名额只作用于这些新 Snapshot，
   不存在迁移镜像占用配额的问题。restore 只接受 post-cutover Snapshot ID，旧 ID 直接视为不支持；运行时
   不增加旧字段兼容解码或旧 Receipt replay。
7. **Dashboard Query 更新**：Dashboard content-shadow 是普通字段更新，canonical Query key 固定为
   `dsbKeys.config(community)`。成功先 `setQueryData` 写回 `contentShadow`，再 exact invalidate；普通字段
   错误不引入 Wallpaper 的 `5702/5708` 并发语义，也不得刷新或覆盖 `wallpaperKeys.config` / Wallpaper draft。

Phase 0 的验收记录必须同时写明：存储位置、boolean shape、mutation 名称、事务归属、真相源、restore 是否联动、
SSR 回填终止条件、版本升级、post-cutover history 边界/配额，以及 Dashboard shadow 的错误码和 Query key 映射。

## 7. 测试矩阵

### 7.1 Phase 0 现状契约测试

提取前先锁定当前可观察行为：

- `TWallpaperLogic` 接口、loading 生命周期、toast 和面向用户的错误文案；
- untouched 不发请求；
- 当前 theme 单独提交；
- 保存飞行期间的新编辑不会被旧成功响应覆盖；
- fingerprint 相同复用旧 idempotency key；
- `5702/5708` 按 lane refetch 对应 canonical Query，且不覆盖本地 draft；
- Dashboard content-shadow 普通字段失败不覆盖本地 shadow draft；
- NONE 与 generated 的当前请求顺序；
- export、prepare、create、upload、publish、cancel 各失败窗口的当前基线。

错误名拆分属于文档明确批准的行为调整，应在提取该层时单独更新测试，不能被机械地当成意外回归。

### 7.2 发布计划纯函数

- 当前 theme 为 light/dark；
- untouched 时上层不创建计划；
- `NONE` 无 targets、无 WebGPU；
- picture/gradient/upload 都生成且只生成四个固定 Profile；
- renderSpec 在计划创建后不受 store 后续修改影响；
- Wallpaper fingerprint 对相同提交稳定，对 Wallpaper version/settings/theme 变化敏感；Dashboard
  content-shadow 只提交普通字段 patch，不参与 Wallpaper fingerprint/idempotency 协调；
- builder 不生成 idempotency key；相同 fingerprint 重试时 coordinator 把旧 key 传给 executor。

### 7.3 导出与网络编排

- NONE 只调用 publish；
- generated 严格按 export、prepare、create、upload、publish 顺序执行；
- export 失败和 targets 不完整时没有 GraphQL/cancel；
- prepare 请求失败、prepare 空响应时没有 cancel；
- 四个 upload intent 必须完整且 Profile 唯一；
- 四图并行上传全部成功后才 publish；
- create、任一 upload、publish 明确失败时的 cancel 行为；
- cancel rejected、cancel 非 2xx；
- publish transport rejected 保持当前 cancel 基线，除非另行批准协议调整；
- publish payload 空响应按 outcome unknown 处理，不 cancel 并保留重试 key；
- publish 明确成功后不 cancel。

### 7.4 React 集成

- 未 touched 不触发 mutation；
- 只 dirty Wallpaper 或只 dirty contentShadow 时只调用对应 mutation；
- 两者都 dirty 时按 Dashboard mutation → Wallpaper publish 顺序执行；
- Dashboard 成功/Wallpaper 失败与 Wallpaper 成功/Dashboard 失败都分别确认成功 aggregate 的 baseline，
  不做跨 aggregate rollback；
- 保存中产生的新编辑不会被成功响应覆盖；
- 成功后先同步更新 Wallpaper Query version，再失效 static/editor Query；
- Dashboard mutation 成功后同步更新 content-shadow Query；
- 下一次连续保存读取新 Wallpaper version；
- Wallpaper `5702/5708` 保留 Wallpaper lane 的本地 draft，并刷新其 Query version；
- Dashboard 普通字段失败只保留本地 shadow draft，并精确刷新 `dsbKeys.config(community)`；
- 错误 toast 使用原始发布错误；
- editor 卸载不把 confirmed server state 留在普通页面 Valtio 中。

现有 Phoenix Wallpaper 和 Assets Hub Batch/Worker 测试继续覆盖事务、manifest、claim、lease、Receipt 和
reconciliation；前端测试不重复模拟这些服务内部实现。

## 8. 实施批次

### Phase 0：现状基线与普通页读点盘点

- [x] 补齐 §7.1 的现状契约测试（codec、store、plan、coordinator、executor 和 Dashboard mutation）；
- [x] 盘点 Community、Dash、Landing 的 Provider 挂载点与全部 Wallpaper store 读点；
- [x] 明确 Landing 静态展示配置来源为 `LANDING_INIT_DATA`，并保留独立的 Dashboard content shadow 归属；
- [x] 冻结并实施 Dashboard `contentShadow` 独立字段的 GraphQL/持久化 shape、mutation 和事务归属；hard cut 已
      删除 `wallpaperSettings.renderConfig.contentShadow`，不保留 editor wire 兼容层；
- [x] 冻结 Dashboard content-shadow draft 不进入 Wallpaper store；普通字段 mutation、baseline accept/reconcile
      和 Appearance Save 的部分成功矩阵已落地；
- [x] 同步冻结并实施共享背景 shape 的影响面：`Dashboard.Fields.macro_schema(:wallpaper_bg)` 与
      `BgConfigValidator` 同时服务 Dashboard Wallpaper 和 `CoverBackground`；Cover 从未拥有产品层的
      `contentShadow`，只是旧 shared macro 让 Cover 形状意外接受了这个键。一次性拆分时已从 shared
      macro/validator 移除该键，Wallpaper 与 Cover 都只保留各自的背景字段；Dashboard 另用普通的
      `content_shadow` boolean 字段承载内容表面配置。Cover 自己的图片级 `shadow`（`TCoverShadow`）与此无关，保持不动；
      该移除不是 Cover 数据迁移。
- [x] 在此阶段完成 Provider/普通页载荷收口：普通页不挂载 Wallpaper editor store，PageCommunity 不再选择
      `wallpaperSettings`。

### Phase 1：纯计划与幂等协调

- [x] 提取 `buildWallpaperPublishPlan`；
- [x] 保持 Wallpaper 协议内部网络顺序和 UI 错误/loading 语义；
- [x] 把 fingerprint/key 复用保留在 request coordinator；
- [x] 补齐 NONE、四 Profile、theme、fingerprint、key 复用和 snapshot freeze 测试。

### Phase 2：导出与网络编排

- [x] 提取 `executeWallpaperPublish` 和窄服务 adapter；保留现有 `exportBatch` 注入边界；
- [x] 注入 exporter/GraphQL/Batch/uploader；
- [x] 补齐全部失败窗口、outcome unknown 和 cancel 状态测试；
- [x] 拆分 prepare 空响应与 Assets Hub Batch 创建失败错误名；
- [x] 不改变 Wallpaper prepare/upload/publish endpoint 与其事务语义；Dashboard `contentShadow` 的独立 schema、
      mutation、持久化迁移和 digest/version 调整属于本方案范围。

### Phase 3：Query ownership

- [x] 不再维护局部 version state；由 `wallpaperKeys.config` 直接订阅 confirmed version；
- [x] 由 `wallpaperKeys.config` 独占 confirmed version；
- [x] mutation success 先 `setQueryData` 写回新 version，再刷新 static/editor Query；
- [x] Dashboard `contentShadow` 由 `dsbKeys.config(community)` 独占 confirmed value；mutation success 先写回
      该字段，再刷新普通页/编辑器 Query；Wallpaper 与 Dashboard 不共享 version；
- [x] `5702/5708` 只 refetch `wallpaperKeys.config(community)`；Dashboard 普通字段失败不覆盖本地 shadow draft；
- [x] 验证请求在飞期间的新 draft 保留逻辑。

### Phase 4：普通页面读点迁移

- [x] 根据 Phase 0 清单迁移 Dashboard `contentShadow`、GlobalLayout、Landing salon 和共享 hooks 的读点；
- [x] 仅复用归档文档 [`static_wallpaper.md` §8 末段](./static-wallpaper.md#8-bundle-边界) 与 §9.10 的
      Landing 决策表述：为 Landing Shell 配置自有 light/dark 静态背景，或明确接受移除默认背景并验收
      对应 glow/页面视觉变化；不得执行该文档 §9 的其他 v1 历史步骤；
- [x] 本阶段只处理 Landing Shell 的共享 Wallpaper 消费，不重新打开已完成的营销演示 renderer 图片化；
- [x] 保持 `StaticWallpaperProvider` 仅承载窄静态渲染数据。

### Phase 5：路由与载荷收口

- [x] 普通 `PageCommunity` 删除 `wallpaperSettings`；
- [x] 普通 `PageCommunity` 保留独立的 `dashboard.contentShadow` 窄字段；
- [x] editor route 独占 settings/history 查询；
- [x] editor 与普通页在同一 contract cutover 中切换，不能先切普通页再延后 editor；
- [x] 普通 Community、Dash、Landing 不再挂载 Wallpaper editor store；
- [x] 同步更新相关 contract/checklist，不再把目标状态标记为已完成事实。

## 9. 验收标准

- React hook 不直接调用 Assets Hub endpoint、upload 或 WebGPU exporter；
- 发布计划是无副作用纯函数，且不负责生成/复用 idempotency key；
- 网络编排可在无 React、无 WebGPU、无真实网络环境下完整测试；
- Assets Hub capability 与 Wallpaper publish 事务语义不变；本次四键 settings/request digest 直接使用 v1，
  Dashboard content mutation 独立存在；
- 除明确批准的 Dashboard `contentShadow` 窄字段外，GraphQL schema 不变；该字段属于内容呈现契约，
  不属于 Wallpaper schema；
- Wallpaper `baseVersion` 只有 `wallpaperKeys.config` 一个 confirmed owner；Dashboard `contentShadow` 只有
  `dsbKeys.config(community)` 一个 confirmed owner，二者不共享 version 或 idempotency key；
- 普通页面不查询 settings/history，不挂载 authoring store；
- 保存中继续编辑、两 mutation 部分成功、导出失败、prepare 空响应、部分上传失败、publish 结果未知和
  cancel 失败均有明确测试；
- `5702/5708` 只刷新 Wallpaper Query；Dashboard 普通字段更新固定使用 `dsbKeys.config(community)`，但不
  引入另一套冲突码；
- 生产行为仍是当前 theme 单独保存，非 NONE 固定发布四张响应式图片。

## 10. 非目标

- 不在本方案内迁移 ThemePreset store；
- 不建立新的业务状态机或 adapter 注册框架；
- 不把 WebGPU 移到 Phoenix、Worker 或后台任务；
- 不新增 Static/Editor 两套版本、Snapshot 或 revision 模型；
- 不修改 Assets Hub capability、manifest、Receipt、lease 或 reconciliation 协议；
- 不把 Landing 的常量配置伪装成 Query 数据源。
