# Community / Dsb / DsbEditor 状态边界重构

> 状态：目标合同。2026-11-14 已完成 GraphQL query naming、Press query 域、canonical `.slug`、mutation key factory 和 Dsb RSS 字段移除；其余状态边界和 A–G 批次尚未完成。代码路径和差异以本文第 4 节的当前实现盘点为准。
>
> 范围：前端状态所有权、Provider 挂载、命名与消费者改接。本文不改变 Dashboard、Wallpaper 或 Docs 的服务端持久化及发布协议。
>
> 与历史合同的关系：本文取代 [Dsb Edit Store 重组方案](./store-reorganization.md)中“不保留通用 DsbStore”的目标结论，以及 [Wallpaper 前端保存编排简化方案](../feature/wallpaper/frontend-save-orchestration-refactor.md)中“Dashboard content-shadow 使用独立 Valtio 草稿”的前端状态安排。两份文档记录的 Query、mutation、Wallpaper 发布协议和既有验收仍是历史证据；相关代码尚未按本文改接。

## 1. 问题与目标

一个社区的公开页面由 Community 身份和一组 Dashboard 配置共同驱动。GraphQL `Community` 已在同一个 `community` 响应中返回 `dashboard`，包括 `contentShadow`。目前前端将它拆成 Community store、`Q.dsb.slug`、名为 `DsbConfigProvider` 的 Context，以及 Dash 编辑器工作副本。`parseDashboard` 还把编辑器专用的 `original` 塞进面向公共页面的 `TParseDashboard`。

另一方面，`DsbEditStore`、`DsbEditorUiProvider`、`DsbShellUiProvider` 和单字段 `ContentShadowProvider` 分别占有部分编辑或 UI 状态。普通社区不应依赖编辑器的基线、touched、回滚、保存协调或编辑器运行时代码。复杂子页面也不应仅因组件多就各建一份 Dashboard 配置草稿。

目标是按**数据所有者和生命周期**收敛，而不是按页面数量或保存 mutation 数量划分 store。

## 2. 目标所有权

| 状态                                        | 唯一写入/确认来源                                                          | 前端共享边界                                                                                          | 不应包含                                                |
| ------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Community 身份与元数据                      | 社区服务端响应及对应 Query                                                 | 现有 Community store                                                                                  | Dash 编辑会话                                           |
| 已确认的公开 Dsb 配置，包括 `contentShadow` | `Q.dsb.slug(community)`；它由 `Community.community.dashboard` 投影         | `DsbProvider` / `useDsb`，供 Community、Dash 和 Landing/StaticShell 读取                              | `original`、`touchedFields`、回滚、保存请求、编辑器选择 |
| 已确认的 Press/RSS 配置                     | `Q.press.slug(community)`；由 `CMS.Press` GraphQL 投影                     | `Q.press` / `useRSS`，Dashboard RSS 页是唯一编辑入口                                                  | Dsb 的 `rssFeedType/rssFeedCount`、`communityKeys`      |
| 尚未保存的 Dsb 配置字段                     | `DsbEditorStore` 的当前字段                                                | `DsbEditorProvider` / `useDsbEditor`，仅非 Demo Dash 会话使用（会话内只读页不展示编辑入口）           | 公开配置的第二份权威副本、GraphQL/Query 请求状态        |
| Dsb 编辑基线与修改检测                      | `DsbEditorStore.original`、`touchedFields`；从同一份已确认配置初始化并协调 | 同上；现有 `useHelper().isChanged/anyChanged` 等语义保留                                              | Community 普通页面                                      |
| Wallpaper 设置工作副本                      | Wallpaper 编辑器 store 的 `light/dark` 与 `original`                       | Wallpaper 编辑器路由内；Landing/CoverScene 的 `WallpaperStoreProvider` 只提供静态投影，不创建编辑会话 | Dashboard `contentShadow`                               |
| Docs 正文、工作副本、目录及队列             | Article / Docs 业务命令与读取；浏览器内的 Docs 编辑会话                    | Docs 编辑器范围                                                                                       | DsbEditor 的配置字段工作副本                            |
| 临时选择、弹窗、当前标签页、菜单折叠        | 持有该交互的组件或最小共同祖先                                             | React state / 窄 Context；确有复杂跨区域协作时才建编辑器 store                                        | 公共 Dsb 配置和无关编辑器状态                           |

`DsbProvider` 是**已确认 Query 数据的共享读取投影**，不是另一个可独立修改的服务端事实。可以用 Valtio 实现字段级订阅，但其写入口只接受对应社区 Query 的已确认更新；业务组件不能直接对其执行配置 mutation。若普通 Context 已满足读点，保留 Context 实现也符合合同，名称与公开数据形状仍须统一。实现阶段以消费者订阅需求决定这一内部机制，不能引入双写权威。

```text
Community.community
  ├─ Community 字段 ──> Q.community / Community store ──> useCommunity
  └─ dashboard 字段 ──> Q.dsb.slug ──> DsbProvider ──> useDsb
                                          │
                                          └─ 进入可编辑 Dash 会话
                                               └─ DsbEditorProvider
                                                    current / original / touched
                                                    └─ useDsbEditor、useHelper、SavingBar

Wallpaper route ──> Wallpaper editor store（Wallpaper 设置草稿；已确认版本由 Query 持有）
                  └─ 页面中编辑的 Dsb 字段 ──> DsbEditorStore

Docs route ───────> Docs / Article editor session（正文、目录、队列）
                  └─ 若编辑 Dsb 配置 ──> DsbEditorStore
```

## 3. 命名与数据形状

1. 公共入口统一叫 `DsbProvider` / `useDsb`；现有 `DsbConfigProvider` / `useDsbConfig` 是当前 Context 包装，不能因文件短而误认为无数据。新入口只暴露公开 Dsb 配置。
2. 编辑入口统一叫 `DsbEditorProvider` / `useDsbEditor`，对应现有 `DsbEditProvider` / `useDsbEdit`。`useDsbEditorStore` 可作为保存回调读取当前值的内部 raw-store 入口；普通子编辑器默认使用窄 hook。
3. 明确区分 `TDsbConfig`（已确认的公共配置）、GraphQL/wire dashboard 类型和 `TDsbEditorInit`（编辑器初始化输入）；`TCommunity.dashboard` 不得继续把 raw 与 parsed dashboard 混为一型。`parseDashboard` 只产出不带 `original` 的公共配置；DsbEditor 进入时从确认配置构造当前字段与 `original`。
4. `contentShadow`、`pagiMode`、`pagiMobileMode` 都是 Dsb 可编辑字段，必须进入 `TDsbFieldMap` / `FIELDS` 和字段跟踪、保存协调；`pagiRevision` 是确认数据的并发控制元数据，不是可编辑字段。`contentShadow` 不另建 session slice。专用 mutation 成功后先写入 `Q.dsb.slug` 确认值，再按 `submitted/current/confirmed` 规则 reconcile DsbEditor；未保存输入和请求在途的新输入不得被旧确认覆盖。
5. 不保留 `useDsbConfig`、`useDsbEdit` 等长期别名或双读路径。GraphQL wire 中的 `dashboard`、`updateDashboardXxx` 名称不因前端 API 改名而改变。
6. `DsbEditorUiProvider` 不等于目标 `DsbEditorProvider`。先逐项迁出其中的临时状态，再删除这个笼统容器，避免同名能力重叠。

## 4. 当前实现偏差与改接入口

| 当前实现                                                                                                                                 | 已核实的作用                                                                                                                                       | 目标处理                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/core/schemas/pages/community.ts`                                                                                               | `Community` 同时选取 Community 与 `dashboard.contentShadow` 等配置                                                                                 | 保持服务端响应语义；公共前端读点统一通过 Community / Dsb 各自入口                                                                   |
| `frontend/core/query/dsb.ts`、`frontend/core/lib/ssr/parse.ts`、`frontend/core/spec/dashboard.d.ts`、`frontend/core/spec/community.d.ts` | `Q.dsb.slug` 是已确认配置 Query；`parseDashboard` 把 `original` 加进公共类型，`TCommunityInfo.dashboard` 使用 parsed 类型                          | 保留 Query owner，明确 wire / `TDsbConfig` / `TDsbEditorInit` 类型；`original` 只在编辑会话构造                                     |
| `frontend/core/stores/dsbConfig/`、`frontend/core/stores/CommunityShellProvider.tsx`                                                     | 普通社区通过 Context 读取解析后的 Dash 配置                                                                                                        | 改成 `DsbProvider/useDsb` 的公开契约；普通页面不依赖编辑模块                                                                        |
| `frontend/core/stores/dsbEdit/`、`frontend/core/unit/DsbThread/logic/useHelper/`、`frontend/core/query/mutation/useDsbFieldSave.ts`      | 工作副本、字段修改检测、回滚、保存和确认协调                                                                                                       | 统一为 `DsbEditor` 命名与边界；保留现有字段组和请求在途继续编辑的协调语义                                                           |
| `frontend/dash/src/components/DsbShell.tsx`                                                                                              | 当前给非 Demo 的整个 Dash Shell 挂 `DsbEditProvider`；Wallpaper 路由另挂 `ContentShadowProvider`，并从 `Q.wallpaperEditor.slug` 取 `contentShadow` | 保留每社区一个非 Demo Dash 会话级 DsbEditor；Wallpaper 编辑查询的确认值须归一写入 `Q.dsb.slug` 并协调编辑器，不能维护第二个确认来源 |
| `frontend/core/stores/contentShadow/`、`frontend/core/unit/DsbThread/Appearance/Wallpaper/useLogic.ts`                                   | 单字段 Valtio 草稿；Wallpaper UI Save 中使用独立 Dashboard mutation                                                                                | 删除独立 store；公开值从 Dsb 读，未保存编辑值由 DsbEditor 持有。Dashboard mutation 与 Wallpaper publish 仍是两个事务 lane           |
| `frontend/core/stores/dsbEditorUi/`                                                                                                      | 集中存标签、别名、FAQ 保存位置、当前管理员五项临时状态                                                                                             | 按每个编辑器的共同使用范围归位；局部 state 优先，跨区域时用窄 Context；不复制 Dsb 配置字段                                          |
| `SavingBar/`、`useDsbFieldSave.ts`、`useHelper/`                                                                                         | SavingBar 无条件调用 `useHelper`；共享保存 hook/helper 无条件读取 Tag/Alias/FAQ UI Context                                                         | 拆分纯 UI SavingBar 与 Dsb 字段连接层；先拆成按字段读取的 UI/domain hook，再移除旧全局 Context                                      |
| `Browsing/Settings.tsx`                                                                                                                  | 分页模式用局部草稿和专用 mutation，并将 `original` 写回 Dsb Query                                                                                  | 分页字段草稿进入 DsbEditor；mutation 确认值更新 Query/DsbProvider 并 reconcile，`pagiRevision` 只作服务端元数据                     |
| `StaticShellProvider.tsx`、Landing salon/CoverScene                                                                                      | StaticShell 构造含 `original` 的 dashboard；Landing salon 读取旧 `useDsbConfig`                                                                    | 迁到 `TDsbConfig` / `DsbProvider` 公共读取；纳入 Landing 类型和构建验收                                                             |
| `frontend/core/stores/dsbShellUi/`                                                                                                       | 整个 Shell 共用 `submenuCollapsed` 一个布尔值                                                                                                      | 保留 Shell 范围共享，审查是否用 React state + Context 即可，无需为此单独建 Valtio store                                             |
| `frontend/core/unit/DsbThread/Appearance/Theme/hooks/useThemePresetDraft.ts`                                                             | ThemePreset 配置编辑已直接使用 `DsbEdit` 的 touched/edit                                                                                           | 改名后继续以 DsbEditor 为 ThemePreset 配置草稿的唯一 owner；预览与 CSS 投影保持各自职责                                             |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/store/`                                                                                    | Docs 会话包含正文、保存状态、发布派生状态及命令接线                                                                                                | 保持 Docs 编辑器范围；审查派生 view、控制器接线和正文草稿的内部边界，不并入 DsbEditor                                               |

Press/RSS 配置已从 `communityKeys` / Dsb 双写迁到 `Q.press.slug`；Dashboard RSS 页只消费 Press
Query，Dsb 不再拥有 `rssFeedType/rssFeedCount`。

`ContentShadow` 归属变化仅针对**前端状态**。原 Wallpaper 合同规定的 Dashboard 普通字段 mutation、Wallpaper 独立版本与发布协议、两个 lane 的顺序及部分成功处理，仍须按实际后端合同执行。

## 5. 逐个 Editor store / Provider 处置清单

本节按当前生产入口与源码中的 `proxy(...)` 创建点盘点。名称包含 Editor 不等于它持有编辑工作副本；没有独立 Valtio store 的编辑器也列出，避免迁移时凭组件名称再造 Provider。

| 当前对象与入口                                                         | 当前状态和使用范围                                                                                                                               | 目标动作                                                                                                                       | 删除或保留的判定                                                                |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `stores/dsbConfig`                                                     | 不是 Valtio store；`DsbConfigProvider` 将 `TParseDashboard` 整包放入 Context，Community、Dash 和 Landing/StaticShell 都使用                      | **改名并缩型**为 `DsbProvider/useDsb`，只提供公开配置；从公共类型移除 `original`                                               | 所有 `useDsbConfig` 调用迁完，旧目录、hook、类型引用零生产调用                  |
| `stores/dsbEdit`                                                       | Valtio，当前字段、`original`、`touchedFields` 和编辑动作；非 Demo 的整个 Dash Shell 挂载                                                         | **保留并改名**为 `DsbEditorStore/Provider/useDsbEditor`；每社区一个非 Demo Dash 会话，跨子页面共享，Demo/普通 Community 不挂载 | `useDsbEdit`、`useDsbEditStore` 调用迁完；保存、回滚和后台刷新行为不退化        |
| `stores/dsbEditorUi`                                                   | Valtio，五项互不相关的编辑器临时状态，挂在整个 Dash Shell                                                                                        | **逐字段迁出并删除**；目标见 §5.1                                                                                              | 五项都有新 owner，`useTag/Alias/Faq/ModeratorEditorUi` 和 Provider 零生产调用   |
| `stores/contentShadow`                                                 | Valtio，只保存一个 Dashboard 布尔字段及其基线；只在 Wallpaper 路由挂载                                                                           | **删除**；公开值进 Dsb，未保存编辑值进 DsbEditor                                                                               | Wallpaper 预览、取消、保存和双 lane 部分成功仍正确；旧 store 零调用             |
| `stores/dsbShellUi`                                                    | Valtio，只保存 `submenuCollapsed`，菜单、面包屑和内容布局共用                                                                                    | **换为 Shell 范围 React state + Context**，继续共享折叠值                                                                      | 跨路由、菜单切换和 Docs 布局仍同步；旧 Valtio store 零调用                      |
| `stores/wallpaper` + `Wallpaper/LogicProvider`                         | 路由范围 Valtio 工作副本 `light/dark/original`；逻辑 Context 提供交互与保存；发布 version 在 Query                                               | **保留独立编辑器 store**；不要把 Wallpaper 设置并入 DsbEditor；仅把 `contentShadow` 的前端读写移回 Dsb 边界                    | 编辑设置、预览、四图发布、失败重试、冲突和恢复均使用原业务 owner                |
| `stores/ThemePreset` + Theme 页面 hooks                                | 公开主题 token/CSS 投影在独立 store；ThemePreset 编辑字段已通过 `useThemePresetDraft` 写 `DsbEdit`                                               | **保留公开投影**；编辑入口改接 DsbEditor，不新建 `ThemeEditorStore`                                                            | 公开 CSS、主题切换、编辑预览、取消与保存后 Query 更新一致                       |
| `Docs/Editor/store`                                                    | Valtio 跨正文、SideTree 和 ActionSnackbar；正文草稿实际由 `useDraftEditorState` 的 React state 持有，`useDraftStoreSync` 再复制摘要/正文到 store | **保留编辑器范围，但收敛成唯一 Docs 草稿 owner**；迁移细节见 §5.2                                                              | 不再存在 React 草稿与 Valtio 草稿双写；Snackbar、目录、保存和发布仍订阅正确状态 |
| `unit/CoverEditor/useLogic.ts`                                         | 独立 Valtio 画布草稿，但 `const store = proxy(...)` 位于模块顶层；Docs Cover 使用它                                                              | **保留独立画布状态，改为每个 CoverEditor 实例创建**；迁移细节见 §5.3                                                           | 两个实例互不影响；关闭再打开不沿用前一实例的图片或背景                          |
| `unit/ArticleEditor/useLogic.ts`                                       | 模块级 Valtio 单例，发布动作仍为占位；当前前端生产 import 未发现该组件，Broadcast 路由使用另一套 `DsbThread/Broadcast/Editor/Article`            | **删除旧通用 ArticleEditor 及专属 store**，不触碰 Broadcast 编辑器；迁移细节见 §5.3                                            | 生产 import 图和 build 确认为零；专属 GraphQL schema/test 依赖同步清理          |
| `unit/TagSettingEditor`、`unit/PassportEditor`、`DsbThread/LinkEditor` | 组件或 hook 内持有局部编辑状态，本身未创建 Valtio store                                                                                          | **维持局部状态**；只改接目前依赖 `DsbEditorUi` 的入口                                                                          | 不因本轮重命名额外创建这些编辑器的 Valtio Provider                              |

`Article`、`ArticleList`、`Comments`、`Community`、`Theme`、`Locale` 等既有应用或领域 store，以及 Apply 应用的表单 store，不属于本轮 Dash Editor 清理。是否保留它们不由本合同重新裁决。

### 5.1 `DsbEditorUi` 五个字段逐项归位

| 字段              | 当前跨区读写                                                               | 目标 owner 和改接                                                                                |
| ----------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `editingTag`      | `DsbThread/logic/useTags`、`useHelper/useEdit`、`useDsbFieldSave`          | Tags 页面范围的选中/编辑会话；Tag 领域保存接收提交时冻结的 tag 值，不从 Shell 全局 UI store 回读 |
| `settingTag`      | Tags 页面触发，`TagSettingEditor/useLogic` 用作初始选中项                  | Tags 页面或抽屉范围的选中项；抽屉关闭后清空，不跨社区或路由保留                                  |
| `editingAlias`    | `DsbThread/logic/useAlias`、Alias Item、`useHelper/useEdit`                | Alias 页面范围的编辑项；确认/取消时只更新 DsbEditor 的 `nameAlias` 字段和该页局部选择            |
| `docFaqSaveZone`  | `Docs/FaqEditor/useFaqEditor`、`dsbEdit/docFaq/actions`、`useDsbFieldSave` | FAQ 编辑器范围的当前保存位置；保存请求显式携带本次位置，响应回调只清理同一次会话                 |
| `activeModerator` | Admin 列表、`PassportEditor/useLogic`                                      | Admin 页面范围的当前管理员选择；PassportEditor 关闭或社区切换时释放                              |

如果列表与抽屉是兄弟节点或跨 Portal，使用该页面最小共同祖先的窄 Context；不通过多层 props 传递整个编辑器状态对象，也不把这些临时字段塞进公共 Dsb 或 DsbEditor 的配置字段中。逐字段改接并验证后，最后移除 Shell 上的 `DsbEditorUiProvider`。

### 5.2 Docs 编辑器的单一草稿 owner

当前 `useDraftEditorState` 持有 `workingCopyId`、`publicSnapshotId`、`draft`、`savedDraft`、`draftSource`、`meta`、加载/保存状态；`useDraftStoreSync` 再将 `bodyValue`、`baselineValue`、`docDraftInfo`、`saveStatus` 投影到 `DocsEditorStore`。`ActionSnackbar`、目录和发布控件确实在编辑器外层读取后者，所以不能因为部分读取位于 `Editor/` 目录之外就误判 store 无消费者。

目标改接顺序：

1. 将当前 Doc 草稿、已保存基线、WorkingCopy 身份与 revision、加载/保存状态放进**同一个编辑器实例的 `DocsEditorStore`**。`useDraftEditorState` 改为它的窄选择器/动作 hook；先保留现有冲突协调语义，再删除 `useDraftStoreSync` 和 `composeDraftEditorStorePatch` 一类双写适配。
2. `docDraftInfo`、正文统计、dirty、`publishView` 由这个草稿、SideTree 与队列读取结果**派生**。不再单独写 `bodyValue/baselineValue/docDraftInfo/publishView` 镜像；队列持久状态仍由 Docs Query/服务端拥有，SideTree 结构仍由 SideTree 控制器拥有。
3. `attachSideTree`、`attachSaveDocDraft`、`reloadSideTree` 等命令回调从 Valtio 数据字段移到编辑器范围的逻辑 Context/命令 hook，和 Wallpaper 的 `LogicProvider` 分工一致。命令必须在编辑器卸载时失效，不允许复用上次会话的闭包。
4. `DocsEditorStoreProvider` 包住 `EditorContent`、`Article`、`SideTree` 和 `ActionSnackbar`；创建 store 和逻辑控制器的层次需保证任何 `useDocsEditor` 调用发生在 Provider 子树。登录/权限只在路由和服务端判断，不在 Provider 增设一套分支。
5. 替换原 store 单元测试中只验证 `publishView` 缓存引用的用例，改验：切换 Doc、保存中继续输入、冲突、队列变化、发布后重新加载、卸载重挂时跨区组件看到同一会话状态。

### 5.3 模块级单例的清理

- `CoverEditor` 由 Docs Cover 和旧通用 ArticleCover 引用。改为 `createCoverEditorStore(initial)` 按组件实例创建，Provider 只包画布及其子组件；导出、预览和重置动作继续属于该实例。先覆盖“两个并行实例”和“卸载后重开”用例，再去掉模块顶层 `store`。
- `unit/ArticleEditor` 的组件生产 import 目前为零；`frontend/core/schemas/feature.schema.test.ts` 仍引用它的 schema。先用完整 import 图和应用 build 复核，再删除该旧组件、模块级 store、只服务于它的 schema/test，并从 schema 汇总测试移除对应条目。`frontend/dash/src/routes/$community/broadcast/article.tsx` 使用的是 `DsbThread/Broadcast/Editor/Article`，必须继续保留。
- 这一批只处理上述两个确认的模块级单例；其他编辑器若发现相同模式，先补进本表和消费者清单，再决定归属。

## 6. 子编辑器准入规则

- 基本资料、Header/Footer、SEO、标签、FAQ、ThemePreset、布局等 Dashboard 配置子页面，默认共享 `DsbEditorStore` 的字段工作副本和现有 `useHelper()` 的 `isChanged(field)`、`anyChanged(fields)`、`edit`、`rollbackEdit`、`onSave` 语义。不能为相同字段再建一套 `original/touched`。
- 子页面的弹窗、当前选中项、输入焦点和标签页属于局部交互状态。只有多个相隔较远的子区域确实协作，且组件状态/窄 Context 不够清楚时，才在**该编辑器范围**建立独立 store；不能挂到整个 Dash Shell 作为杂项容器。
- Wallpaper 的 `light/dark` 设置、基线、版本和发布链路有独立业务生命周期，保留 Wallpaper 编辑 route-scoped store；Landing/CoverScene 中的 `WallpaperStoreProvider` 仅提供静态投影，不属于编辑会话。`useLogicValue`、预览事件/延迟提交和发布 executor 是交互与编排层，不把它们误写为 Wallpaper Valtio store 字段。
- ThemePreset 的已确认主题配置及 CSS 投影可继续服务公开页面；其可编辑配置字段由 DsbEditor 持有。若某个预览产生暂态覆盖，须明确预览结束、取消和 Query 刷新后的恢复路径。
- Docs **文档编辑器**的正文、WorkingCopy、目录和发布队列属于 Article/Docs，不能以“位于 Dash 内”为由交给 DsbEditor。Docs **设置编辑器**中的 FAQ、Cover 布局等 Dsb 配置字段才由 DsbEditor 持有。Docs 编辑器 Provider 必须包住读取其 store 的组件；登录与权限仍由路由和服务端负责，不由 store Provider 再判断一遍。
- 其他复杂编辑器（如 Cover 画布）若保留独立 store，实例必须跟随编辑器挂载创建与销毁；模块级单例不能把前一次编辑的状态泄漏到下一次。

## 7. 保存、刷新与生命周期

1. `Q.dsb.slug` 是服务端已确认 Dsb 数据的前端 owner；`DsbProvider` 跟随 Query 确认值更新。社区切换时按 community key 隔离，不能展示上一社区的配置。
2. 进入编辑会话时，从当前确认值创建 `DsbEditorStore` 的当前字段和 `original`。后台刷新只更新未被编辑的字段；已编辑字段保持用户输入并重新计算 touched。本文不要求增加 `.current` 包装层。
3. 保存时冻结提交字段快照；服务端确认后更新 Query / Dsb 公共投影，再按 `submitted/current/confirmed` 协调编辑基线。请求在途时用户继续输入的值不能被旧响应覆盖。失败不得清掉仍未保存的草稿。
4. 同一 UI Save 若包含 `contentShadow` 与 Wallpaper 设置，分别计算两个 patch；按既有顺序先执行 Dashboard 普通字段 mutation，再执行 Wallpaper publish。每个 lane 独立确认自己的基线；一个成功、一个失败时不能假装整体回滚。
5. Dash Demo、普通 Community 与 Landing/StaticShell 仅挂公开读取边界。复杂编辑器 store 随对应编辑器路由或实例挂载；例外是 DsbEditor：每社区一个非 Demo Dash 会话级实例，跨子页面保留草稿，切换社区或离开 Dash 时销毁。

## 8. 实施批次与验收

### 8.1 Route 挂载矩阵

| 入口                                                   | 目标 Provider                                                                        | 禁止带入的编辑状态                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| Community 普通页面                                     | Community、Dsb；Theme/Locale 等原有公共边界                                          | DsbEditor、DocsEditor、Wallpaper 编辑草稿、`original/touched` |
| Dash Demo                                              | Dsb；所需的公共主题/壁纸静态投影                                                     | DsbEditor 和五项杂项 UI session                               |
| Dash 非 Demo 只读/非配置 route                         | Dsb + 当前 Dash 会话级 DsbEditor                                                     | 不新增工作副本，不展示编辑入口                                |
| Dash 基本资料、导航、布局、Tag、Alias、FAQ、Theme 设置 | Dsb + DsbEditor；各页面必要的窄局部 Context                                          | 对同一 Dsb 字段再建一份编辑基线                               |
| Wallpaper 编辑页                                       | Dsb + DsbEditor（只负责 `contentShadow` 等 Dsb 字段）+ Wallpaper 编辑器              | `ContentShadowStore`；Wallpaper 设置进入 DsbEditor            |
| Docs 文档编辑页                                        | Dash 会话共享 DsbEditor + DocsEditor；Cover 画布按实例挂载，文档正文不写入 DsbEditor | 把 WorkingCopy、正文、目录和队列塞进 DsbEditor                |
| Docs FAQ/Cover 等配置页                                | Dsb + DsbEditor                                                                      | Docs 文档工作副本状态                                         |
| Broadcast Article 页                                   | Dsb + Dash 会话级 DsbEditor（Broadcast 设置）+ 真实 Broadcast 编辑器                 | 已无生产组件调用的旧 `unit/ArticleEditor` 单例                |

挂载表是目标，不表示当前路由已符合。实施者须逐个核对 `frontend/dash/src/routes/$community/` 的 route、`DsbShell` 和 Community boundary；不能仅根据 URL 名称判定某页是否有配置编辑。当前 `DsbEditProvider` 位于每社区 Dash Shell；迁移后保留这个会话范围，跨子页面切换时草稿不丢失，切换社区或离开 Dash 时销毁。不得逐页创建多份 `original/touched`。

### 8.2 按依赖执行

| 批次                    | 必须完成的改动和主要文件                                                                                                                                                                                                                                                                                                   | 批次退出条件                                                                                                                                                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. 冻结读写清单         | 用 CodeGraph callers/impact 和生产文本搜索列出 `useDsbConfig`、`useDsbEdit`、`DsbEditorUi` 五字段、`ContentShadow`、pagi、`Browsing/Settings`、`StaticShellProvider`/Landing、`SavingBar`、`useEdit`、`useDsbFieldSave`、`useDsbSaveRunner`、`useDocsEditor`、`CoverEditor`、旧 `ArticleEditor` 的入口；按 §8.1 标记 route | 清单覆盖 `ActionSnackbar` 等 Editor 目录外的消费者；每个字段在每个生命周期只有一个目标 owner；旧 ArticleEditor 的生产导入结论可复核                                                                                              |
| B. 公共 Dsb 数据形状    | 改 dashboard/community 类型、`parse.ts`、`query/dsb.ts`、Community/Dash shell、`StaticShellProvider` 与 Landing；落 `DsbProvider/useDsb` 和 wire / `TDsbConfig` / `TDsbEditorInit` 分层，将 `contentShadow`、`pagiMode`、`pagiMobileMode` 纳入字段模型，revision 留在确认元数据                                            | Community、Demo、Landing/StaticShell 都不见 `original/touched`；`contentShadow`/pagi 的 Query refetch、社区切换和 mutation 确认一致；公开 host 不加载编辑器依赖                                                                  |
| C. DsbEditor 改名和范围 | 改 `stores/dsbEdit/`、helper/save runner、`DsbShell`、SavingBar、Theme/FAQ/Tag/Browsing/Broadcast 等消费者；保持每社区一份 DsbEditor 会话，不在 route 内新建；Demo/普通 Community 不创建                                                                                                                                   | `useDsbEdit` 零生产调用；跨 Dash route 草稿保留；字段组 touched、取消、失败重试、后台刷新和请求在途继续输入通过                                                                                                                  |
| D. `contentShadow` 收口 | 将 Wallpaper 页 Dashboard 字段编辑接入 DsbEditor；Wallpaper 编辑查询的确认值归一写入 `Q.dsb.slug` 并 reconcile；编辑预览读 DsbEditor current，非编辑/公开预览读 Dsb 确认值；改 `Wallpaper/useLogic.ts`、`PreviewPanel/salon/{auth_preview,global_preview}.ts` 及所有直接消费者并删除单字段 store                           | `contentShadow` 不再有双确认来源（Wallpaper editor Query 仍保留其 Wallpaper 数据职责）；编辑预览反映未保存值、公开预览反映确认值；Dashboard mutation 与 Wallpaper publish 各自确认基线，部分成功正确；旧 store/helper 零生产调用 |
| E. 临时 UI owner 清理   | 先拆纯 UI SavingBar 与 Dsb 字段连接层；把 `useEdit` / `useDsbFieldSave` 改为按 field 读取 Tag/Alias/FAQ 状态，再迁移 Tags、Alias、FAQ、Admin；改 Shell 折叠为局部共享状态，最后删除 `DsbEditorUi` / `DsbShellUi` Valtio                                                                                                    | Docs Tabs 的无 field SavingBar 可在无 Dsb hook 时工作；共享 hook 不再无条件依赖 Tag/Alias/FAQ Context；五项状态不泄漏，旧 Provider/hook 零生产调用                                                                               |
| F. 独立编辑器清理       | 按 §5.2 合并 Docs 草稿 owner，移除同步副本与命令接线；按 §5.3 将 Cover store 实例化，并删除确认无生产调用的旧 ArticleEditor                                                                                                                                                                                                | Docs 的正文/SideTree/Snackbar 同一会话；两个 Cover 实例隔离；Broadcast Article 保持可用；旧单例和适配器零生产调用                                                                                                                |
| G. 合同和端到端收口     | 更新本文及 Dash、Wallpaper、Docs 相关合同中的当前状态；删除迁移期间的临时别名和过期测试                                                                                                                                                                                                                                    | §8.3 的静态、类型、聚焦测试与浏览器验收完成，记录实际结果和未覆盖项                                                                                                                                                              |

### 8.3 可执行验证门

1. **静态清理**：在 `frontend/` 生产源码中检索 `useDsbConfig`、`DsbConfigProvider`、`useDsbEdit`、`DsbEditProvider`、`DsbEditorUiProvider`、`ContentShadowProvider`、`useContentShadowStore`、`hasContentShadowPatch`、`useDraftStoreSync` 和模块顶层 `ArticleEditor/CoverEditor` proxy，目标为零；另执行 `rg -n 'proxy' frontend/core/stores/dsbShellUi`，该目录中的 Valtio `proxy` 目标为零，但 Shell 普通 Context/Provider 名称可保留；扫描也须包含 `useTagEditorUi`、`useAliasEditorUi`、`useFaqEditorUi`、`useModeratorEditorUi` 与 `composeDraftEditorStorePatch`。测试与标明历史的文档可保留必要旧词。对旧 `unit/ArticleEditor` 还要确认无 runtime import，Broadcast 路由仍指向自己的编辑器。
2. **类型与构建**：从仓库根目录先执行 `pnpm run graphql:codegen` 并复核生成文件，再执行 `pnpm --filter @groupher/frontend-core run type-check`、`pnpm --filter @groupher/frontend-dash run type-check`、`pnpm --filter @groupher/frontend-community run type-check`、`pnpm --filter @groupher/frontend-landing run type-check`；执行 Community build 或现有 bundle contract/baseline 检查，确认 Core 共享代码没有把编辑器运行时带入 Community bundle。路由生成的文件改动需单独审查。
3. **聚焦回归**：运行 `frontend/core/stores/dsbEdit/tests/index.test.ts` 改名后的测试，以及 `DsbThread/logic/useHelper/useEdit.test.ts`、`DsbThread/SavingBar/index.test.tsx`、ThemePreset `stores/ThemePreset/tests/index.test.ts`、Wallpaper `saveCoordinator.test.ts` 与 `PreviewPanel/salon/global_preview.test.ts`、Docs `store/index.test.ts`、`Tabs/index.test.tsx`、`Article/hooks/useDraftAutoSave.test.ts`、`Article/hooks/useDraftLoader.test.ts` 和 Cover 导出/预览测试。`auth_preview` 暂无独立测试，须由真实 Wallpaper 编辑预览浏览器路径验收。测试应针对新所有权和真实消费者，不能仅断言新包装函数存在。
4. **浏览器路径**：使用 `/home/xx` 社区数据验证 Community 公开配置与主题显示、Dash 编辑字段保存/取消/刷新、Wallpaper 预览与双 lane 部分失败、Docs 打开/切换/保存/发布、Cover 关闭再开、Demo 只读及社区切换。检查控制台无 Provider 缺失错误；截图如需保存，仅放 `.playwright/`。
5. **文档与结果**：运行 `pnpm run docs:check` 和 `git diff --check`；记录每条命令与浏览器路径的实际结果。未运行的检查明确标记，不用单元测试代替真实浏览器结论。

从仓库根目录开始盘点和聚焦回归时，可直接使用以下现有路径；文件改名后在相同批次调整命令中的路径：

```sh
rg -nP 'useDsbEdit(?!or)|DsbEditProvider|DsbEditorUiProvider|ContentShadowProvider|useContentShadowStore|hasContentShadowPatch|useDraftStoreSync|useDsbConfig|DsbConfigProvider' frontend --glob '*.{ts,tsx}'
rg -n 'useTagEditorUi|useAliasEditorUi|useFaqEditorUi|useModeratorEditorUi' frontend --glob '*.{ts,tsx}'
rg -n 'useDocsEditor|useDsbSaveRunner|composeDraftEditorStorePatch|unit/ArticleEditor|unit/CoverEditor|const store = proxy' frontend --glob '*.{ts,tsx}'
rg -n 'proxy' frontend/core/stores/dsbShellUi
pnpm exec vitest --config frontend/core/vitest.config.mts run \
  frontend/core/stores/dsbEdit/tests/index.test.ts \
  frontend/core/unit/DsbThread/logic/useHelper/useEdit.test.ts \
  frontend/core/unit/DsbThread/SavingBar/index.test.tsx \
  frontend/core/stores/ThemePreset/tests/index.test.ts \
  frontend/core/unit/DsbThread/Appearance/Wallpaper/saveCoordinator.test.ts \
  frontend/core/unit/DsbThread/Appearance/Wallpaper/PreviewPanel/salon/global_preview.test.ts \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/store/index.test.ts \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/Tabs/index.test.tsx \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftAutoSave.test.ts \
  frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftLoader.test.ts \
  frontend/core/unit/CoverEditor/useCoverImagePreview.test.tsx \
  frontend/core/unit/CoverEditor/exportFinalImage.test.ts \
  frontend/core/unit/CoverEditor/helper.test.ts
```

最终的零调用扫描要排除测试和迁移文档中的历史引用，并按 §5 的**目标动作**逐项判断；例如 `DsbShellUiProvider` 名称可保留为普通 Context，`unit/CoverEditor` 仍是合法组件引用，禁止的是模块级共享 `proxy`。不要把上述盘点命令的所有命中机械地当作失败。

按 A→G 的依赖次序改接，不保留长期兼容 Provider、双写或静默 fallback；不迁移历史用户数据。此文档没有宣称 B–G 已完成。若 A 阶段发现新的生产消费者，先补充 §5 和挂载矩阵，再进入依赖它的改动。
