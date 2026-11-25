# Community / Dsb / DsbShell 状态边界重构

> 状态：R0–R6 已完成实现，R7 收尾中。Tags 已切到独立 `TagsEditorProvider`；CoverEditor 已按实例创建 store；保存/Demo/Locale 与 Docs 单 owner 已收口。Article History/Diff H3 前置门已通过真实登录页面验证：版本列表可见，Created 与 Published 的比较能呈现字段差异。Community “参与讨论”按钮的 GEditor 接收器仍是单独的入口问题，不属于 Diff 链路。R7 还需完成跨应用构建/浏览器验收和 PR 检查。本文不要求兼容历史浏览器草稿或重复缓存。
>
> 范围：前端状态所有权、Provider 挂载、命名与消费者改接。本文不改变 Dashboard、Wallpaper 或 Docs 的服务端持久化及发布协议。
>
> 与历史合同的关系：本文取代 [Dsb Edit Store 重组方案](./store-reorganization.md)中“不保留通用 DsbStore”的目标结论，以及 [Wallpaper 前端保存编排简化方案](../feature/wallpaper/frontend-save-orchestration-refactor.md)中“Dashboard content-shadow 使用独立 Valtio 草稿”的前端状态安排。两份文档记录的 Query、mutation、Wallpaper 发布协议和既有验收仍是历史证据；相关代码尚未按本文改接。

## 1. 问题与目标

一个社区的公开页面由 Community 身份和一组 Dashboard 配置共同驱动。GraphQL `Community` 已在同一个 `community` 响应中返回 `dashboard`，包括 `contentShadow`。此前前端将它拆成 Community store、`Q.dsb.slug`、名为 `DsbConfigProvider` 的 Context，以及 Dash 编辑器工作副本；`parseDashboard` 还把编辑器专用的 `original` 塞进面向公共页面的类型。本轮已改为 `DsbProvider/useDsb`、`TDsbRaw`/`TDsb` 分层和 `DsbShell` 会话 store。

另一方面，`DsbShellStore`、`DsbEditorUiProvider`、`DsbShellUiProvider` 和单字段 `ContentShadowProvider` 分别占有部分编辑或 UI 状态。普通社区不应依赖编辑器的基线、touched、回滚、保存协调或编辑器运行时代码。复杂子页面也不应仅因组件多就各建一份 Dashboard 配置草稿。

目标是按**数据所有者和生命周期**收敛，而不是按页面数量或保存 mutation 数量划分 store。

## 2. 目标所有权

| 状态                                        | 唯一写入/确认来源                                                                    | 前端共享边界                                                                                                 | 不应包含                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| Community 身份与元数据                      | 社区服务端响应及对应 Query                                                           | 现有 Community store                                                                                         | Dash 编辑会话                                           |
| 已确认的公开 Dsb 配置，包括 `contentShadow` | `Q.dsb.slug(community)`；它由 `Community.community.dashboard` 投影                   | `DsbProvider` / `useDsb`，供 Community、Dash 和 Landing/StaticShell 读取                                     | `original`、`touchedFields`、回滚、保存请求、编辑器选择 |
| 已确认的 Press/RSS 配置                     | `Q.press.slug(community)`；由 `CMS.Press` GraphQL 投影                               | `Q.press` / `useRSS`，Dashboard RSS 页是唯一编辑入口                                                         | Dsb 的 `rssFeedType/rssFeedCount`、`communityKeys`      |
| 尚未保存的 Dsb 配置字段                     | `DsbShellStore` 的当前字段                                                           | `DsbShellProvider` / `useDsbShell`，Dash 会话使用；Demo 只把保存适配器切到本地（会话内只读页不展示编辑入口） | 公开配置的第二份权威副本、GraphQL/Query 请求状态        |
| Dsb 编辑基线与修改检测                      | `DsbShellStore.original`、`touchedFields`；从同一份已确认配置初始化并协调            | 同上；现有 `useHelper().isChanged/anyChanged` 等语义保留                                                     | Community 普通页面                                      |
| 已确认的 Article 标签组                     | `Q.article.tagGroups(community, thread)`                                             | Tags 页面按当前 thread 订阅 Query                                                                            | DsbShell 中的第二份可变 `tagGroups`                     |
| Tags 编辑会话                               | TagsEditorStore 的选择、单个表单草稿和顺序 ID 草稿                                   | Tags 页面 `TagsEditorProvider`，覆盖列表、选择器、Tag 表单、抽屉和排序栏                                     | DsbShell baseline/touched、Query pending/error 的副本   |
| Wallpaper 设置工作副本                      | Wallpaper 编辑器 store 的 `light/dark` 与 `original`                                 | Wallpaper 编辑器路由内；Landing/CoverScene 的 `WallpaperStoreProvider` 只提供静态投影，不创建编辑会话        | Dashboard `contentShadow`                               |
| Docs 正文与 WorkingCopy 编辑会话            | `DocsEditorStore` 的当前草稿、已保存基线、身份与加载/保存状态；服务端 Query/命令确认 | Docs 编辑器实例；`docDraftInfo`、dirty、保存状态与 `publishView` 按读取时输入派生；命令闭包在编辑器 Context  | DsbShell 的配置字段工作副本、React/Valtio 双写副本      |
| Docs 目录与发布队列                         | SideTree 控制器与 Docs Query/服务端                                                  | Docs 编辑器范围；仅将当前树与队列状态作为派生输入                                                            | Docs 正文草稿 store、DsbShell 配置字段工作副本          |
| 临时选择、弹窗、当前标签页、菜单折叠        | 持有该交互的组件或最小共同祖先                                                       | React state / 窄 Context；确有复杂跨区域协作时才建编辑器 store                                               | 公共 Dsb 配置和无关编辑器状态                           |

### 2.1 DsbShellStore 的 config / shell UI 划分

`DsbShellStore` 是 **Dash 编辑会话 store**，内部用逻辑 slice 区分两类状态；这里的 slice 不是
Valtio 特性，只是同一个 store 内的类型/命名分组：

- `config` slice：Dsb 可编辑字段、`original`、`touchedFields`、保存/回滚/reconcile。包括
  `contentShadow`、`pagiMode`、`pagiMobileMode`、baseInfo、layout、SEO、FAQ 等；Tag 布局
  `tagLayout` / `inlineTagLayout` 仍是 Dsb 配置，Article 标签组与排序不属于 DsbShell。
- `shellUi` slice：跨 Dash 子页面共享的 Shell UI，例如 `submenuCollapsed`、必要的菜单折叠状态。

约束：

- `shellUi` 不进入 `config` 字段集合，不进入 `original/touchedFields`，不参与 Dsb save/reconcile。
- `contentShadow` 是 `config` 字段，进入 `TDsbFieldMap` / `FIELDS`；不保留 `ContentShadowStore`。
- Docs 正文、WorkingCopy、SideTree、发布队列属于 `DocsEditorStore` / Docs 编辑会话；SideTree 的
  active、expanded、tabs 等状态由 Docs 编辑器拥有，不进入 `DsbShellStore`。
- Alias、FAQ、Admin 的瞬时选择暂存在 `DsbShellStore`，不进入 persisted `config`、`original` 或
  `touchedFields`。Tags 的选中项、表单草稿和排序草稿归 `TagsEditorStore`。
- Wallpaper `light/dark` 进入 Wallpaper 编辑器 store；Press 配置使用 `Q.press.slug` + 页面本地
  draft；两者都不进入 `DsbShellStore`。

Demo 与普通 Dash 使用同一 `DsbShellStore` / `DsbShellProvider` 划分；差异只在保存适配器：
普通社区写服务端，Demo 写本地持久化。当前 `DsbShell` 已对 Demo 挂载 DsbShellProvider，Dsb save
runner 已支持 Demo 本地字段保存；其他 domain 若在 Demo 暴露编辑，仍由各自 owner 提供本地适配器。

`DsbProvider` 是**已确认 Query 数据的共享读取投影**，不是另一个可独立修改的服务端事实。可以用 Valtio 实现字段级订阅，但其写入口只接受对应社区 Query 的已确认更新；业务组件不能直接对其执行配置 mutation。若普通 Context 已满足读点，保留 Context 实现也符合合同，名称与公开数据形状仍须统一。实现阶段以消费者订阅需求决定这一内部机制，不能引入双写权威。

```text
Community.community
  ├─ Community 字段 ──> Q.community / Community store ──> useCommunity
  └─ dashboard 字段 ──> Q.dsb.slug ──> DsbProvider ──> useDsb
                                          │
                                          └─ 进入可编辑 Dash 会话
                                               └─ DsbShellProvider
                                                    current / original / touched
                                                    └─ useDsbShell、useHelper、SavingBar

Wallpaper route ──> Wallpaper editor store（Wallpaper 设置草稿；已确认版本由 Query 持有）
                  └─ 页面中编辑的 Dsb 字段 ──> DsbShellStore

Docs route ───────> Docs / Article editor session（正文、目录、队列）
                  └─ 若编辑 Dsb 配置 ──> DsbShellStore

Tags route ───────> Q.article.tagGroups(community, thread) ──> 已确认标签数据
                  └─ TagsEditorProvider ──> 选择、表单草稿、顺序草稿
```

## 3. 命名与数据形状

1. 公共入口统一叫 `DsbProvider` / `useDsb`；旧 `DsbConfigProvider` / `useDsbConfig` 已移除，不保留长期别名。新入口只暴露公开 Dsb 配置。
2. 编辑入口统一叫 `DsbShellProvider` / `useDsbShell`；旧的 `DsbEditProvider` / `useDsbEdit` 已移除。`useDsbShellStore` 可作为保存回调读取当前值的内部 raw-store 入口；普通子编辑器默认使用窄 hook。
3. 明确区分 `TDsb`（已确认的公共配置）、`TDsbRaw`（GraphQL/wire dashboard 类型）；`TCommunity.dashboard` 不得继续把 raw 与 parsed dashboard 混为一型。`parseDashboard` 只产出不带 `original` 的公共配置；DsbShell 进入时从确认配置构造当前字段与 `original`。
4. `contentShadow`、`pagiMode`、`pagiMobileMode` 都是 Dsb 可编辑字段，必须进入 `TDsbFieldMap` / `FIELDS` 和字段跟踪、保存协调；`pagiRevision` 是确认数据的并发控制元数据，不是可编辑字段。`contentShadow` 不另建 session slice。专用 mutation 成功后先写入 `Q.dsb.slug` 确认值，再按 `submitted/current/confirmed` 规则 reconcile DsbShell；未保存输入和请求在途的新输入不得被旧确认覆盖。
5. 不保留 `useDsbConfig`、`useDsbEdit` 等长期别名或双读路径。GraphQL wire 中的 `dashboard`、`updateDashboardXxx` 名称不因前端 API 改名而改变。
6. `DsbEditorUiProvider` 已移除；临时状态平铺在 `DsbShellStore` 顶层，不与 `DsbShellProvider` 的 public config 混用。

## 4. 当前实现偏差与改接入口

| 当前实现                                                                                                                                 | 已核实的作用                                                                                                                          | 目标处理                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/core/schemas/pages/community.ts`                                                                                               | `Community` 同时选取 Community 与 `dashboard.contentShadow` 等配置                                                                    | 保持服务端响应语义；公共前端读点统一通过 Community / Dsb 各自入口                                                                                        |
| `frontend/core/query/dsb.ts`、`frontend/core/lib/ssr/parse.ts`、`frontend/core/spec/dashboard.d.ts`、`frontend/core/spec/community.d.ts` | `Q.dsb.slug` 是已确认配置 Query；`parseDashboard` 只产出 `TDsb`，公共类型不含 `original`，`TCommunityInfo.dashboard` 使用 parsed 类型 | 保留 Query owner，明确 wire / `TDsbRaw` / `TDsb` 类型；`original` 只在编辑会话构造                                                                       |
| `frontend/core/stores/dsb/`、`frontend/core/stores/CommunityShellProvider.tsx`                                                           | 已改为 `DsbProvider/useDsb`；公共 Dsb 类型不含 `original`                                                                             | 改成 `DsbProvider/useDsb` 的公开契约；普通页面不依赖编辑模块                                                                                             |
| `frontend/core/stores/dsbShell/`、`frontend/core/unit/DsbThread/logic/useHelper/`、`frontend/core/query/mutation/useDsbFieldSave.ts`     | 工作副本、字段修改检测、回滚、保存和确认协调；命名已统一为 `DsbShell`                                                                 | 保持 `DsbShell` 命名与边界；保留现有字段组和请求在途继续编辑的协调语义                                                                                   |
| `frontend/dash/src/components/DsbShell.tsx`                                                                                              | 当前给整个 Dash Shell 挂 `DsbShellProvider`；Wallpaper 编辑查询的 `contentShadow` 归一写入 `Q.dsb.slug`                               | 保留每社区一个 Dash 会话级 DsbShell；Demo 只把保存适配器切到本地，Wallpaper 编辑查询的确认值须归一写入 `Q.dsb.slug` 并协调编辑器，不能维护第二个确认来源 |
| `frontend/core/stores/contentShadow/`、`frontend/core/unit/DsbThread/Appearance/Wallpaper/useLogic.ts`                                   | 已删除 ContentShadowStore；Wallpaper 页面使用 DsbShell 的 `contentShadow` 字段                                                        | 删除独立 store；公开值从 Dsb 读，未保存编辑值由 DsbShell 持有。Dashboard mutation 与 Wallpaper publish 仍是两个事务 lane                                 |
| `frontend/core/stores/dsbEditorUi/`                                                                                                      | 已删除；Alias、FAQ、Admin 三类剩余临时状态已平铺到 `DsbShellStore`；Tag 选择与草稿将迁出                                              | 不恢复全局 UI Context；Tags 改由 route-scoped `TagsEditorProvider` 持有                                                                                  |
| `SavingBar/`、`useDsbFieldSave.ts`、`useHelper/`                                                                                         | SavingBar 仍调用 `useHelper`；`useDsbFieldSave` 已读取 `DsbShellStore` 的 transient editor 字段，不再读取全局 UI Context              | 保留纯 UI SavingBar 与 Dsb 字段连接层分离；旧全局 Context 已移除                                                                                         |
| `Browsing/Settings.tsx`                                                                                                                  | 分页模式已改接 DsbShell 字段，并使用 `pagiRevision` 元数据                                                                            | 分页字段草稿进入 DsbShell；mutation 确认值更新 Query/DsbProvider 并 reconcile，`pagiRevision` 只作服务端元数据                                           |
| `StaticShellProvider.tsx`、Landing salon/CoverScene                                                                                      | StaticShell 已使用 `TDsb` / `DsbProvider` 公共读取                                                                                    | 迁到 `TDsb` / `DsbProvider` 公共读取；纳入 Landing 类型和构建验收                                                                                        |
| `frontend/core/stores/dsbShellUi/`                                                                                                       | 整个 Shell 共用 `submenuCollapsed` 一个布尔值                                                                                         | 保留 `useDsbShellUi` 读取入口，实现改接 `DsbShellStore.ui`，不再维护独立 Valtio store                                                                    |
| `frontend/core/unit/DsbThread/Appearance/Theme/hooks/useThemePresetDraft.ts`                                                             | ThemePreset 配置编辑已直接使用 `DsbShell` 的 touched/edit                                                                             | 改名后继续以 DsbShell 为 ThemePreset 配置草稿的唯一 owner；预览与 CSS 投影保持各自职责                                                                   |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/store/`                                                                                    | Docs 会话包含正文、保存状态、发布派生状态及命令接线                                                                                   | 保持 Docs 编辑器范围；审查派生 view、控制器接线和正文草稿的内部边界，不并入 DsbShell                                                                     |

Press/RSS 配置已从 `communityKeys` / Dsb 双写迁到 `Q.press.slug`；Dashboard RSS 页只消费 Press
Query，Dsb 不再拥有 `rssFeedType/rssFeedCount`。

`ContentShadow` 归属变化仅针对**前端状态**。原 Wallpaper 合同规定的 Dashboard 普通字段 mutation、Wallpaper 独立版本与发布协议、两个 lane 的顺序及部分成功处理，仍须按实际后端合同执行。

## 5. 逐个 Editor store / Provider 处置清单

本节按当前生产入口与源码中的 `proxy(...)` 创建点盘点。名称包含 Editor 不等于它持有编辑工作副本；没有独立 Valtio store 的编辑器也列出，避免迁移时凭组件名称再造 Provider。

| 当前对象与入口                                 | 当前状态和使用范围                                                                                                                                                    | 目标动作                                                                                                                              | 删除或保留的判定                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `stores/dsb`                                   | 已由 `DsbProvider/useDsb` 提供公开 `TDsb`；Community、Dash 和 Landing/StaticShell 共用                                                                                | **已改名并缩型**，不再暴露 `original` 或编辑动作                                                                                      | 旧 `stores/dsbConfig` / `useDsbConfig` 零生产调用                                                              |
| `stores/dsbShell`                              | Valtio，当前字段、`original`、`touchedFields`、`ui` 和编辑动作；整个 Dash Shell 挂载                                                                                  | **已改名为** `DsbShellStore/Provider/useDsbShell`；每社区一个 Dash 会话，跨子页面共享，Demo 使用本地保存适配器，普通 Community 不挂载 | `useDsbShell`、`useDsbShellStore` 生产调用；保存、回滚和后台刷新行为不退化                                     |
| `stores/dsbEditorUi`                           | 已删除；Alias、FAQ、Admin 暂存在 `DsbShellStore` 顶层，Tags 状态将迁出                                                                                                | **保持删除**；Tags 见 §5.1，Shell 瞬时字段见 §5.2                                                                                     | 旧 Provider/hooks 零生产调用；editor-only 字段不进入 config/save                                               |
| `stores/contentShadow`                         | 已删除；`contentShadow` 已进入 `TDsbFieldMap` / `FIELDS` / DsbShellStore                                                                                              | **删除**；公开值进 Dsb，未保存编辑值进 DsbShell                                                                                       | Wallpaper 预览、取消、保存和双 lane 部分成功仍正确；旧 store 零调用                                            |
| `stores/dsbShellUi`                            | 已移除 Valtio provider/context；`useDsbShellUi` 从 `DsbShellStore.ui` 读取                                                                                            | **合并到 `DsbShellStore.ui`**，`useDsbShellUi` 读取该 namespace                                                                       | 跨路由、菜单切换和 Docs 布局仍同步；旧 Valtio store 零调用                                                     |
| `stores/wallpaper` + `Wallpaper/LogicProvider` | 路由范围 Valtio 工作副本 `light/dark/original`；逻辑 Context 提供交互与保存；发布 version 在 Query                                                                    | **保留独立编辑器 store**；不要把 Wallpaper 设置并入 DsbShell；仅把 `contentShadow` 的前端读写移回 Dsb 边界                            | 编辑设置、预览、四图发布、失败重试、冲突和恢复均使用原业务 owner                                               |
| `stores/ThemePreset` + Theme 页面 hooks        | 公开主题 token/CSS 投影在独立 store；ThemePreset 编辑字段已通过 `useThemePresetDraft` 写 `DsbShell`                                                                   | **保留公开投影**；编辑入口改接 DsbShell，不新建 `ThemeEditorStore`                                                                    | 公开 CSS、主题切换、编辑预览、取消与保存后 Query 更新一致                                                      |
| `Docs/Editor/store`                            | Valtio 持有当前/已保存草稿、WorkingCopy 与 Snapshot 身份、元数据及加载/保存状态；Article hook 仅派生读值和调用 store action                                           | **R6 已收口**；`docDraftInfo`、dirty、保存指示和 `publishView` 由草稿、SideTree 与 queue runtime 派生；回调放在 Docs 命令 Context     | 无 `useDraftStoreSync` 或 `composeDraftEditorStorePatch`；保存中输入、冲突和重挂状态有测试覆盖                 |
| `unit/CoverEditor/useLogic.ts`                 | 独立 Valtio 画布草稿，但 `const store = proxy(...)` 位于模块顶层；Docs Cover 使用它                                                                                   | **保留独立画布状态，改为每个 CoverEditor 实例创建**；迁移细节见 §5.4                                                                  | 两个实例互不影响；关闭再打开不沿用前一实例的图片或背景                                                         |
| `unit/ArticleEditor/useLogic.ts`               | 旧组件及模块级 Valtio store 已删除；仍使用的 3 个 Content Publisher operation 已迁入 `lib/graphql/content-publisher.ts`；其余旧 query/mutation/fragments 无生产消费者 | **R7 schema owner 已收口**；`codegen.ts` 直接读取 Content Publisher schema，不触碰 Broadcast 编辑器                                   | 旧组件/store/schema/fragments 生产 import 为零；Content Publisher operation 仍由 generated server adapter 使用 |
| `unit/TagSettingEditor`、`DsbThread/Tags`      | Query 持有标签组确认值，TagsEditorStore 持有选择、表单草稿和排序 ID 草稿；DsbShell 只持有 Tag layout                                                                  | **R1 已收口**；Tags 页面独立挂载 TagsEditorProvider，Demo 写入走 community/thread 隔离的本地 adapter                                  | Query 刷新、线程切换、保存回调和排序草稿不跨 session 泄漏                                                      |
| `unit/PassportEditor`、`DsbThread/LinkEditor`  | 读取 `DsbShellStore` 的 Admin/Alias transient editor 字段；不再依赖 `DsbEditorUiProvider`                                                                             | **继续由 DsbShell 会话持有**；不为单一区域新建 Provider                                                                               | 不恢复全局 Provider；社区切换后旧选择释放                                                                      |

`Article`、`ArticleList`、`Comments`、`Community`、`Theme`、`Locale` 等既有应用或领域 store，以及 Apply 应用的表单 store，不属于本轮 Dash Editor 清理。是否保留它们不由本合同重新裁决。

### 5.1 TagsEditor 的独立会话 owner

当前 Tags 页面通过 `useTags` 从 `DsbShellStore` 读取 `tagGroups`、`activeTagThread` 和 `activeTagGroup`；`Q.article.tagGroups(community, thread)` 又是这些服务端数据的真实来源。查询刷新会把结果当作 DsbShell 保存确认值写回，Tag drawer 还在 `TagSettingEditor` 的 React state 里另存一份表单草稿。这样 Query、Dash 通用配置工作副本和 Tags 表单共同承担了不相同的所有权。

改为 `frontend/core/unit/DsbThread/Tags/store/` 下的 `TagsEditorStore` / `TagsEditorProvider` / `useTagsEditor`。Provider 覆盖 `Tags` 页面中的 `ThreadSelector`、`TagList`、组与标签行、排序栏和 `TagSettingEditor` drawer；不逐个 drawer 建 store，也不把 Provider 提升到整个 Dash。

1. `Q.article.tagGroups(community, thread)` 是唯一已确认标签组数据 owner。Tags 组件直接订阅该 Query；请求 pending/error 留在 Query 与 mutation，不复制进 editor store。
2. `TagsEditorStore` 仅持有编辑会话状态：当前 thread/group、inline Tag 身份与草稿、drawer Tag 身份与表单草稿，以及按 thread 隔离的 group/tag 顺序 ID 草稿和基线。它不持有第二份可变 `tagGroups` 确认镜像。
3. Query refetch 只更新确认数据；没有未提交排序时更新对应 thread 的顺序基线，有排序草稿时按实体 ID 合并新数据，不让旧 thread 的迟到响应覆盖当前 thread。保存快照包含固定 community/thread/实体 ID/编辑会话代次；旧响应只确认原请求 scope，不清除新选项或新草稿。
4. 保存与取消排序使用 Tags domain command，不再经 `DsbShellStore.original/touchedFields`、`FIELD.TAG_INDEX` 或通用 Dsb save runner。排序保存成功后按 `submitted/current/confirmed` 规则确认基线；失败保留当前草稿以便重试。
5. 从 `TDsbFieldMap`、`FIELDS`、DsbShell baseline/reconcile/demo 通用保存中移除 `tagGroups`、`activeTagGroup` 和 `activeTagThread`；删除旧 `useTagsEditor` Shell hook、Tag field save builder/常量和 `useIndexTouched` 旧实现。`tagLayout`、`inlineTagLayout` 仍由 DsbShell 保存。

### 5.2 DsbShell 剩余三类 transient editor 字段

`DsbEditorUiProvider` 已删除。Alias、FAQ、Admin 的跨组件选择状态仍在 `DsbShellStore` 顶层，因为对应编辑流程读取同一 Dash 配置草稿或保存区域；它们不进入 `DsbShellStore.ui`、persisted config 或字段 save/reconcile。

| 字段             | 当前跨区读写                                                               | 目标 owner 和改接                                                          |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `editingAlias`   | `DsbThread/logic/useAlias`、Alias Item、`useHelper/useEdit`                | `DsbShellStore.editingAlias`；确认/取消只更新 DsbShell 的 `nameAlias` 字段 |
| `docFaqSaveZone` | `Docs/FaqEditor/useFaqEditor`、`dsbEdit/docFaq/actions`、`useDsbFieldSave` | `DsbShellStore.docFaqSaveZone`；响应回调只清理同一次会话                   |
| `activeAdmin`    | Admin 列表、`PassportEditor/useLogic`                                      | `DsbShellStore.activeAdmin`；社区切换时随 store 释放                       |

`useAliasEditor` / `useFaqEditorState` / `useAdminEditor` 继续提供窄读取与动作；Tags 状态不再经过这些 Shell hooks。

### 5.3 Docs 编辑器的单一草稿 owner

前置门已关闭：复核了 Diff 任务的真实登录页面验收，历史列表、版本选择和字段 Diff 均可用；门只依赖 Diff 前端收口，不要求等待所有 Co-authors 批次。Community “参与讨论”按钮没有接收 GEditor 打开事件，是单独的发布入口缺陷，不改变该门的结论。

R6 已将当前 Doc 草稿、已保存基线、WorkingCopy/Snapshot 身份、来源、元数据和加载/保存状态统一放进 `DocsEditorStore`。`useDraftEditorState` 现在是对该 store 的窄读取/动作适配，不持有 React 草稿；`useDraftStoreSync`、`composeDraftEditorStorePatch` 与 `bodyValue/baselineValue` 镜像已删除。

`docDraftInfo`、正文统计、dirty、保存指示、错误指示和 `publishView` 在 `useDocsEditor` 中按当前 store、SideTree 与 queue runtime 派生。队列仍由 Docs Query/服务端持有，SideTree 结构仍由 SideTree 控制器拥有。`addGroup`、`reloadSideTree`、`saveDocDraft` 注册与当前控制器接线已移到 Docs 编辑器范围的命令 Context；保存 handler 注册使用实例 token，卸载时只清理自己的闭包。

`DocsEditorStoreProvider` 包住整个 `EditorContent` 子树；命令 Provider 在 SideTree 控制器创建后包住 Article、SideTree 和 ActionSnackbar。store 测试覆盖单一草稿 owner、保存中继续输入、冲突后保留本地编辑并采纳服务端 revision、切文档 reset 和卸载重挂；现有队列、发布冲突与 SideTree 测试一并验证。R7 仍需完成跨应用构建与浏览器验收。

### 5.4 编辑器实例生命周期与旧组件清理

- `CoverEditor` 由 Docs Cover 和旧通用 ArticleCover 引用。改为 `createCoverEditorStore(initial)` + 实例级 `CoverEditorProvider`。Provider 必须包住调用 `useLogic` 的主体及所有画布、调色、预览、导出、键盘组件；可把现有主体拆到单独的 Content 文件，不能在 Provider 外提前调用 `useLogic`。`ImageDraftProvider`、object URL、导出和取消/重置都跟该实例生命周期；一个实例卸载不能 reset 另一个实例。覆盖“两实例并行”和“卸载再开背景/尺寸/图片全新”用例后移除模块顶层 proxy。
- 通俗地说，这不是“一个编辑器用了全局状态”这么抽象的问题：目前所有 Cover 画布实际上共享同一份图片/背景/尺寸数据；关闭其中一个画布会清掉共享图片，而再次打开时背景和尺寸仍可能沿用旧值。Provider 改为每个实例创建 store 后，画布 A 的编辑和卸载只影响 A，画布 B 与之后新开的画布各自有干净状态。
- `unit/ArticleEditor` 的组件生产 import 为零；旧组件和模块级 store 已删除。仍被 `lib/server/content-publisher.ts` 使用的 `CreateArticle`、`CreateAndPublishArticle`、`SaveWorkingCopy` 文档已迁入 `lib/graphql/content-publisher.ts`，并由根 `codegen.ts` 生成 Node-safe server operations。其余旧 ArticleEditor query/mutation/fragments 没有生产消费者，已删除。`frontend/dash/src/routes/$community/broadcast/article.tsx` 使用的是 `DsbThread/Broadcast/Editor/Article`，必须继续保留。
- 这一批只处理上述两个确认的模块级单例；其他编辑器若发现相同模式，先补进本表和消费者清单，再决定归属。

## 6. 子编辑器准入规则

- 基本资料、Header/Footer、SEO、标签、FAQ、ThemePreset、布局等 Dashboard 配置子页面，默认共享 `DsbShellStore` 的字段工作副本和现有 `useHelper()` 的 `isChanged(field)`、`anyChanged(fields)`、`edit`、`rollbackEdit`、`onSave` 语义。不能为相同字段再建一套 `original/touched`。
- 子页面的弹窗、当前选中项、输入焦点和标签页属于局部交互状态。只有多个相隔较远的子区域确实协作，且组件状态/窄 Context 不够清楚时，才在**该编辑器范围**建立独立 store；不能挂到整个 Dash Shell 作为杂项容器。
- Wallpaper 的 `light/dark` 设置、基线、版本和发布链路有独立业务生命周期，保留 Wallpaper 编辑 route-scoped store；Landing/CoverScene 中的 `WallpaperStoreProvider` 仅提供静态投影，不属于编辑会话。`useLogicValue`、预览事件/延迟提交和发布 executor 是交互与编排层，不把它们误写为 Wallpaper Valtio store 字段。
- ThemePreset 的已确认主题配置及 CSS 投影可继续服务公开页面；其可编辑配置字段由 DsbShell 持有。若某个预览产生暂态覆盖，须明确预览结束、取消和 Query 刷新后的恢复路径。
- Docs **文档编辑器**的正文、WorkingCopy、目录和发布队列属于 Article/Docs，不能以“位于 Dash 内”为由交给 DsbShell。Docs **设置编辑器**中的 FAQ、Cover 布局等 Dsb 配置字段才由 DsbShell 持有。Docs 编辑器 Provider 必须包住读取其 store 的组件；登录与权限仍由路由和服务端负责，不由 store Provider 再判断一遍。
- 其他复杂编辑器（如 Cover 画布）若保留独立 store，实例必须跟随编辑器挂载创建与销毁；模块级单例不能把前一次编辑的状态泄漏到下一次。

## 7. 保存、刷新与生命周期

1. `Q.dsb.slug` 是服务端已确认 Dsb 数据的前端 owner；`DsbProvider` 跟随 Query 确认值更新。社区切换时按 community key 隔离，不能展示上一社区的配置。
2. 进入编辑会话时，从当前确认值创建 `DsbShellStore` 的当前字段和 `original`。后台刷新只更新未被编辑的字段；已编辑字段保持用户输入并重新计算 touched。本文不要求增加 `.current` 包装层。
3. 保存时冻结提交字段快照；服务端确认后更新 Query / Dsb 公共投影，再按 `submitted/current/confirmed` 协调编辑基线。请求在途时用户继续输入的值不能被旧响应覆盖。失败不得清掉仍未保存的草稿。
4. 同一 UI Save 若包含 `contentShadow` 与 Wallpaper 设置，分别计算两个 patch；按既有顺序先执行 Dashboard 普通字段 mutation，再执行 Wallpaper publish。每个 lane 独立确认自己的基线；一个成功、一个失败时不能假装整体回滚。
5. 普通 Community 与 Landing/StaticShell 仅挂公开读取边界。Dash Demo 与 Dash 编辑页使用同一 DsbShell 会话，Demo 只把保存适配器切到本地。复杂编辑器 store 随对应编辑器路由或实例挂载；例外是 DsbShell：每社区一个 Dash 会话级实例，跨子页面保留草稿，切换社区或离开 Dash 时销毁。

## 8. 实施批次与验收

### 8.1 Route 挂载矩阵

| 入口                                              | 目标 Provider                                                                                    | 禁止带入的编辑状态                                           |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| Community 普通页面                                | Community、Dsb；Theme/Locale 等原有公共边界                                                      | DsbShell、DocsEditor、Wallpaper 编辑草稿、`original/touched` |
| Dash Demo                                         | Dsb + DsbShell（本地保存适配器）；所需的公共主题/壁纸静态投影                                    | 远端 Dashboard mutation、Shell transient editor session      |
| Dash 非 Demo 只读/非配置 route                    | Dsb + 当前 Dash 会话级 DsbShell                                                                  | 不新增工作副本，不展示编辑入口                               |
| Dash 基本资料、导航、布局、Alias、FAQ、Theme 设置 | Dsb + DsbShell；各页面必要的窄局部 Context                                                       | 对同一 Dsb 字段再建一份编辑基线                              |
| Wallpaper 编辑页                                  | Dsb + DsbShell（只负责 `contentShadow` 等 Dsb 字段）+ Wallpaper 编辑器                           | `ContentShadowStore`；Wallpaper 设置进入 DsbShell            |
| Docs 文档编辑页                                   | Dash 会话共享 DsbShell + DocsEditor；CoverEditorProvider 按画布实例挂载，文档正文不写入 DsbShell | 把 WorkingCopy、正文、目录和队列塞进 DsbShell                |
| Tags 管理页                                       | Dsb + DsbShell（仅 Tag 布局）+ TagsEditorProvider + Article tagGroups Query                      | DsbShell 标签组副本、跨社区/线程的 Tags editor 草稿          |
| Docs FAQ/Cover 等配置页                           | Dsb + DsbShell                                                                                   | Docs 文档工作副本状态                                        |
| Broadcast Article 页                              | Dsb + Dash 会话级 DsbShell（Broadcast 设置）+ 真实 Broadcast 编辑器                              | 已无生产组件调用的旧 `unit/ArticleEditor` 单例               |

挂载表是目标，不表示当前路由已符合。实施者须逐个核对 `frontend/dash/src/routes/$community/` 的 route、`DsbShell` 和 Community boundary；不能仅根据 URL 名称判定某页是否有配置编辑。当前 `DsbShellProvider` 位于每社区 Dash Shell；保留这个会话范围，跨子页面切换时草稿不丢失，切换社区或离开 Dash 时销毁。不得逐页创建多份 `original/touched`。

### 8.2 按依赖执行

| 批次                                 | 必须完成的改动和主要文件                                                                                                                                       | 批次退出条件                                                                                                              |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **R0：刷新读写清单（完成）**         | 以当前 `origin/dev` 复核 route/consumer、共享文件和最新 Diff H3；更新本节与 §5/§8.1                                                                            | 唯一 owner 已登记；Diff gate 有真实页面验收证据；共享文件顺序明确                                                         |
| **R1：TagsEditor 独立化（完成）**    | 建立 TagsEditor factory/provider/hook；Query 直读 `Q.article.tagGroups`；选择、Tag 表单和 per-thread 顺序草稿迁出 DsbShell；删除 Tag 字段及 generic save 路径  | 聚焦测试覆盖线程/社区隔离、乱序响应、表单与排序；Tag layout 仍由 DsbShell 保存                                            |
| **R2：保存回调会话保护（完成）**     | 冻结 mutation 的 community/domain/entity/session 与 submitted 快照；修正保存响应读取当前 selection 的风险                                                      | 旧响应只确认原请求 scope；新选择/草稿不会被清除；失败保留输入                                                             |
| **R3：CoverEditor 实例化（完成）**   | `createCoverEditorStore(initial)` + CoverEditorProvider；迁移 `useLogic`、ImageDraftProvider、导出、预览、object URL 清理                                      | 两实例隔离；卸载再开为新状态                                                                                              |
| **R4：保存状态与 Demo 收口（完成）** | 收拢 domain mutation pending/error；Demo 的 Dsb、Theme、Wallpaper/contentShadow、Browsing 和 Tags 写入走社区隔离本地 adapter                                   | Demo 不发真实写请求或覆盖真实 Query；聚焦回归通过                                                                         |
| **R5：Shell/Locale 边界（完成）**    | 把 Wallpaper route、editor Query 初始合并和 `contentShadow` 投影移入 editor boundary；修正 Locale 同 Provider 更新与 SSR 初始化                                | Shell 仅组装 Providers；Wallpaper 与 Locale 聚焦回归通过                                                                  |
| **R6：Docs 单 owner（完成）**        | Diff H3 gate 关闭后，将正文会话收敛进 DocsEditorStore；派生 `publishView` 并把闭包命令移入 Context                                                             | 无 React/Valtio 双写；保存中继续输入、冲突、切文档、队列与重挂测试通过                                                    |
| **R7：清理与完整验收（进行中）**     | Content Publisher schema owner 已迁入 `lib/graphql`；删除确认无生产消费者的旧 hooks/constants/adapters；完成跨应用 build、静态扫描、Dev Hub 浏览器验收和 PR CI | 旧 ArticleEditor 组件/store/schema 无生产 import；Broadcast 保持真实编辑器；验证门通过，PR 没有未处理的新 review comments |

R1/R3 已先行完成；R1/R2 的共享保存入口已串行收口。R4 已接在 R1/R2 后，R5 的 Wallpaper boundary 已接在 R4 后，Locale 同批完成。R6 在 Diff H3 前端 gate 通过后完成，无需等待所有 Co-authors 批次。R7 现在统一做清理和完整验收。无需兼容或迁移历史前端草稿/缓存。

### 8.3 可执行验证门

1. **静态清理**：在 `frontend/` 生产源码中检索旧 `useDsbConfig`、`DsbConfigProvider`、`useDsbEdit`、`DsbEditProvider`、`DsbEditorUiProvider`、`ContentShadowProvider`、`useContentShadowStore`、`hasContentShadowPatch`、`useDraftStoreSync`、`composeDraftEditorStorePatch` 和旧 ArticleEditor/CoverEditor 单例入口；确认 `tagGroups/activeTagGroup/activeTagThread`、`FIELD.TAG*`、`TAG_STORE_FIELDS` 不再属于 DsbShell 的 spec/default/save 路径。旧 DsbShell `useTagsEditor` 导入为零，新入口只能从 `DsbThread/Tags/store` 导入。`useDsbShellUi` 是合法入口；禁止的是 `dsbShellUi` 独立 Valtio store。测试与说明历史的文档可保留必要旧词。对旧 `unit/ArticleEditor` 还要确认无 runtime import，Broadcast 路由仍指向自己的编辑器。
2. **类型与构建**：从仓库根目录先执行 `pnpm run graphql:codegen` 并复核生成文件，再执行 `pnpm --filter @groupher/frontend-core run type-check`、`pnpm --filter @groupher/frontend-dash run type-check`、`pnpm --filter @groupher/frontend-community run type-check`、`pnpm --filter @groupher/frontend-landing run type-check`；执行 Community build 或现有 bundle contract/baseline 检查，确认 Core 共享代码没有把编辑器运行时带入 Community bundle。路由生成的文件改动需单独审查。
3. **聚焦回归**：在原有 DsbShell、SavingBar、ThemePreset、Wallpaper 与 Docs 测试外，新增 Tags store/provider 测试（thread/community 隔离、刷新与排序草稿、旧请求、表单失败/成功选择保护）和 Cover 双实例/卸载重开测试；Docs 单 owner 测试只能在 R6 Diff gate 关闭后新增或改写。测试应验证新 owner 和真实消费者，不能只断言包装函数存在。
4. **浏览器路径**：使用 `/home/xx` 社区数据验证 Community 公开配置与主题显示、Dash 编辑字段保存/取消/刷新、Tags 线程切换与排序保存/取消、Wallpaper 预览与双 lane 部分失败、Cover 两实例与关闭再开、Demo 本地保存及社区切换；R6 关闭 Diff gate 后再验证 Docs 打开/切换/保存/发布。检查控制台无 Provider 缺失错误；截图如需保存，仅放 `.playwright/`。
5. **文档与结果**：运行 `pnpm run docs:check` 和 `git diff --check`；记录每条命令与浏览器路径的实际结果。未运行的检查明确标记，不用单元测试代替真实浏览器结论。

从仓库根目录开始盘点和聚焦回归时，可直接使用以下现有路径；文件改名后在相同批次调整命令中的路径：

```sh
rg -nP 'useDsbEdit(?!or)|DsbEditProvider|DsbEditorUiProvider|ContentShadowProvider|useContentShadowStore|hasContentShadowPatch|useDraftStoreSync|useDsbConfig|DsbConfigProvider' frontend --glob '*.{ts,tsx}'
rg -n 'useTagEditorUi|useAliasEditorUi|useFaqEditorUi|useModeratorEditorUi' frontend --glob '*.{ts,tsx}'
rg -n 'useDocsEditor|useDsbSaveRunner|composeDraftEditorStorePatch|unit/ArticleEditor|unit/CoverEditor|const store = proxy' frontend --glob '*.{ts,tsx}'
rg -n 'proxy' frontend/core/stores/dsbShellUi
pnpm exec vitest --config frontend/core/vitest.config.mts run \
  frontend/core/stores/dsbShell/tests/index.test.ts \
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

最终的零调用扫描要排除测试和迁移文档中的历史引用，并按 §5 的**目标动作**逐项判断；例如 `useDsbShellUi` 仍是合法读取入口，`unit/CoverEditor` 仍是合法组件引用，禁止的是模块级共享 `proxy`。不要把上述盘点命令的所有命中机械地当作失败。

按 R0→R7 的依赖次序改接，不保留长期兼容 Provider、双写或静默 fallback；不迁移历史用户数据。若 R7 静态扫描发现新的生产消费者，先补充 §5 和挂载矩阵，再决定清理边界。R6 已在 Diff H3 前端 gate 通过后完成。
