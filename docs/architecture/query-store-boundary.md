# Query / Store 边界收口与简化计划

> 状态：2026-08-29 本地实现与自动验收已完成。真实 Cloudflare purge、跨 PoP 行为和生产告警
> 仍属于发布门，不把本地测试结果冒充线上证据。
>
> 本文不是另一轮框架重写提案。它负责处理 Query / Valtio / editor draft / CDN 之间仍然存在的
> owner 重叠、兼容 facade、同步缺口和文档提前宣告完成的问题。实施时以本文的边界 invariant、
> Phase B0–B5 和验收门为准。
>
> 主执行顺序见 [`workflow_query_store_reorg.md`](../dash/query-store-workflow.md)；Dsb working copy
> 合同见 [`dashboard_store_reorg.md`](../dash/store-reorganization.md)；公共缓存与 purge 见
> [`tanstack_rewrite/query_sync_cache.md`](../migrations/tanstack/query-sync-cache.md)。
> 当前 viewer 跨刷新 read-your-writes 的窄 receipt/revision 提案见
> [`tanstack_rewrite/optimistic_read_your_writes.md`](../migrations/tanstack/optimistic-read-your-writes.md)；
> Article/Comment 的窄 receipt/revision 链路已在当前客户端落地，但不改变本文“一份 confirmed server
> state 只有一个客户端 owner”的约束；View durable projection 与生产 purge 仍按各自文档边界推进。
> 当前 Article 写后同步见
> [`article-stats-and-viewer-state-sync.md`](./article-stats-and-viewer-state-sync.md)：viewer confirmed writer 除 hydration 后的
> batch response 外，还包括 typed mutation response 与 command replay/reconcile response；它们写入同一 canonical Query owner，
> 不建立第二份 store。
> 其前置的内存 operation identity、inverse patch 与 confirmed transition 见
> [`tanstack_rewrite/optimistic_operation.md`](../migrations/tanstack/optimistic-operation.md)。
>
> 长期架构覆盖说明：本文 §3.4、BND-04/BND-05 与 Phase B4 记录的是当时已落地的 proxy `CacheEffect`
> 桥接。它已被 [`public-cache-invalidation.md`](./public-cache-invalidation.md) 的 Phoenix transactional
> outbox + Oban + Cloudflare 目标架构替代；本次直接切换并删除 proxy mapping，不保留兼容 fallback。

验收环境说明：本轮 source 在并行 `frontend/core/render/BgRenderer/vgpu-poc` 文件出现前已通过全仓
文档检查，最终 source、类型、测试、合同和 production build 也已复验。当前 dirty worktree 的全仓
文档检查只剩该实验目录两个新导出缺少 JSDoc；全仓格式检查只剩其生成目录
`frontend/core/.tmp/vgpu-poc`。两者不属于本轮边界重构，也未被本轮修改；合并前应由对应改动补齐或
清理后再重跑全仓门禁，不能把这一工作区状态误记成本轮 source 回归。

## 1. 为什么必须单独收口

当前主链已经能完成 SSR、viewer hydration、Dashboard 编辑和保存，但“请求已经迁入 TanStack
Query”不等于“server state 已经只有一个 owner”。如果同一份 confirmed data 同时存在于 route
shell、Query cache 和可变 Valtio store，短期看只是重复；一旦发生后台 refetch、并发保存、预览清理、
多标签页修改或 CDN purge 失败，它就会直接变成顺序相关的功能 bug。

本轮把以下问题视为正确性问题，而不是可选的代码洁癖：

- confirmed state 有多个可独立变化的副本；
- Query 更新后 editor working copy 没有统一 reconcile；
- preview、draft、confirmed projection 的名称和生命周期不明确；
- compatibility facade 隐藏了真实 owner，并扩大响应式订阅范围；
- 业务 mutation 的成功状态与 CDN purge pending/error 耦合；
- 文档和勾选项领先于实际实现，后续修改者会基于错误前提继续叠加代码。

## 2. 不可破坏的边界 invariant

### 2.1 一份 confirmed server state 只有一个客户端 owner

TanStack Query 是 confirmed server state 的唯一客户端 owner。SSR loader 可以一次取得 bootstrap
payload，但 hydration 后必须按领域写入 canonical Query key；route shell、Context 和 Valtio 不得继续
持有一份可独立更新的 confirmed cache。

允许存在的其他形态必须明确标注为以下一种，不能再叫“当前配置”或“server state”：

- **projection**：从 Query data 同步派生、可随时重建、不能独立提交；
- **working copy**：用户未提交的编辑值；
- **preview**：只影响当前页面视觉，保存、取消和卸载时有明确清理规则；
- **UI state**：modal、active item、collapsed 等不来自后端的状态。

### 2.2 所有 confirmed transition 都走同一 reconcile 规则

无论 confirmed data 来自初始 SSR、mutation response、focus refetch、跨标签页通知还是显式
invalidate，进入可编辑 Dash 后都必须经过同一 `reconcileConfirmed(nextConfirmed)` 语义：

| 字段状态                   | `original`     | `current`      | touched  |
| -------------------------- | -------------- | -------------- | -------- |
| 用户未编辑                 | 更新为服务端值 | 更新为服务端值 | false    |
| 用户已编辑且 current 不同  | 更新为服务端值 | 保留用户输入   | 重新计算 |
| 用户输入恰好等于新服务端值 | 更新为服务端值 | 保留等价值     | false    |

Provider 不能只消费一次 `initialData` 后与 Query 脱节，也不能在 refetch 时重建整个 editor store。

### 2.3 业务确认与缓存传播是两个状态机

Phoenix mutation 成功后，当前客户端先用 typed confirmed response 更新 Query 并 reconcile editor；
CDN cache effect 随后由 server proxy 执行。purge 失败不得把已经成功的业务保存显示成失败，也不得
要求 UI hook 为了等待 Cloudflare 而保持 mutation pending。

### 2.4 compatibility 必须有退出合同

兼容别名、旧 hook 和 facade 只有同时满足以下条件才能暂时保留：

- 有完整 caller 清单；
- 写明 canonical replacement；
- 不创建第二份 owner；
- 不扩大订阅范围；
- 有删除 Phase 和验收门。

没有 caller 的兼容层直接删除；只有一个领域消费者的泛型抽象优先内联回领域实现。

### 2.5 unknown viewer state 不能降级成 false

公共 Query 不拥有 viewer 字段。viewer batch 未返回、identity 不匹配或请求失败时保持
`undefined`；组件只能通过 public + viewer selector 组合，不得把 viewer response 镜像进公共 cache
或 Valtio。

## 3. 当前数据流与目标数据流

### 3.0 Owner / reader / writer 冻结表

| 领域         | confirmed owner                                    | projection / working copy                                                  | confirmed writer                                               | 主要 reader                                      |
| ------------ | -------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| community    | `Q.community.config(slug)`                         | `CommunityStore` 是只读、可重建 projection；viewport 已拆为独立 UI context | SSR seed、refetch、baseInfo mutation patch                     | Community/Dash boundary 与展示 hooks             |
| dashboard    | `Q.dsb.config(slug)`                               | `DsbEditStore.current/original/touched` 是编辑 working copy                | SSR seed、领域 save response、refetch                          | Community 展示、Dash editors、SavingBar          |
| wallpaper    | `Q.wallpaper.config(slug)`                         | wallpaper store 是 draft/preview projection                                | SSR seed、wallpaper mutation response、refetch                 | Community renderer、Dash wallpaper editor        |
| theme preset | `Q.dsb.config(slug).themePreset`                   | `ThemePresetStore` 只负责 CSS projection/preview                           | theme mutation response、Dsb refetch                           | pre-paint、Theme editor、CSS variable projection |
| viewer       | `Q.viewer.*(accountRef, refs)`                     | render-time selector；unknown 保持 `undefined`                             | viewer batch、typed mutation、replay/reconcile response        | article/comment/account UI                       |
| baseInfo     | `Q.community.config` + `Q.dsb.config` 各自领域字段 | 无独立 baseInfo cache/store                                                | baseInfo typed mutation response 同时 patch 两个 canonical key | Community brand/SEO、Dash baseInfo editor        |

`loadCommunity` 可以只发起一次 GraphQL bootstrap；`projectCommunityConfig`、dashboard 和 wallpaper
随后分别 seed canonical key。浏览器端三个领域同时 refetch 时由 `fetchCommunitySnapshot` 只合并
当次 in-flight request，不保存第四份长期 confirmed cache。

### 3.1 公共读取

当前主要风险是 `loadCommunity` 的 shell 同时包含 community、dashboard、wallpaper，之后 dashboard
又 seed 到 `Q.dsb.config`，同一 payload 继续被 Provider 复制到多个 Valtio store。

目标：

```text
public SSR loader
  -> no-user-spec GraphQL payload
  -> 按领域 seed canonical Query keys
       community
       dsb.config
       wallpaper / theme projection source
  -> dehydrate public Query cache
  -> 浏览器 hydration
  -> Q.viewer 按 visible canonical refs 请求私有状态
  -> render-time selector 组合 public + viewer
```

bootstrap 可以共享一次网络请求，但不能共享一个长期拥有多个领域数据的 cache object。

### 3.2 Dsb 编辑与后台刷新

目标：

```text
Q.dsb.config confirmed data
  -> create DsbEditStore once on editable route
  -> current/original/touched

Q.dsb.config 后续变化
  -> reconcileConfirmed(nextConfirmed)
  -> untouched 跟随服务端
  -> touched 保留本地 current
```

`initFilled` 这类一次性 hydration guard 不属于 editor UI state。额外的
`communityBaseInfo` 查询如果读取的字段已存在于 `Q.dsb.config`，应删除并改由 canonical Query
提供；确有独立 freshness 要求时，也必须把结果写回 confirmed owner 后再统一 reconcile。

### 3.3 保存

目标：

```text
domain save module
  -> typed submitted input
  -> Phoenix mutation
  -> typed confirmed patch
  -> Q.dsb.config setQueryData / precise invalidate
  -> DsbEditStore.reconcile(submitted, confirmed)
  -> mutation success UI
  -> server-side CacheEffect
```

公共 runner 只负责 mutation lifecycle、Query 更新、reconcile、toast 和错误呈现。tag slug、DocFAQ
reset、media report、reindex 等领域规则留在对应 save module，不进入按字段名分发的通用 hook。

### 3.4 CDN 失效

以下内容是历史实现记录，不是新的长期扩展点：

目标 cache effect 合同：

```ts
type TCacheEffect = {
  tags: string[]
  mode: 'none' | 'immediate' | 'coalesced'
}
```

- 内容、发布状态、权限、SEO、主题和导航配置：`immediate`；
- 点赞、emotion、浏览等高频 interaction：默认 `none`，依 TTL/SWR；
- 评论/reaction 如果确实需要更快传播：只有实现真实去重队列后才标记 `coalesced`。

Community 与 Dash 的 GraphQL server proxy 应共用 operation-to-effect contract。浏览器只负责当前
Query 的 optimistic/confirmed 更新，不直接编排 Dash → Community → Cloudflare 调用链。

目标架构中，领域 command 在 Phoenix transaction 内写入 typed `PublicCache.Invalidation`；Oban worker
直接调用 Cloudflare。上述 `TCacheEffect`、operation-name mapping 和 proxy `waitUntil` 在切换时整体删除。

## 4. 复核问题登记

| ID     | 严重度 | 当前问题                                                                                                                                                    | 风险                                                  | 收口判定                                                        |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------- |
| BND-01 | 已收口 | bootstrap 按 community/Dsb/wallpaper 分别 seed canonical Query key；shell 不再长期拥有 dashboard payload                                                    | refetch 或局部 patch 后数据分叉                       | hydration 后仅 canonical Query 是 confirmed owner               |
| BND-02 | 已收口 | Provider 持续把 Query confirmed transition 送入 `reconcileConfirmed`                                                                                        | focus refetch、跨 Tab 或其他管理员修改无法进入 editor | touched/untouched 并发测试通过                                  |
| BND-03 | 已收口 | ThemePreset confirmed 由 Query 持有，Valtio 只做同步 CSS projection/preview；共享 theme hook 为 lazy boundary 提供 SSR-stable snapshot                      | 清除 preview 后回退、dark hydration mismatch          | Provider rerender 测试与真实页面 preview/cancel/reload 复验通过 |
| BND-04 | 已收口 | `frontend/core/query/invalidation` 只接受 typed target；upvote/emotion 不创建 PublicCache invalidation                                                      | purge 风暴、成本和延迟放大                            | 高频 interaction 不进入 HTML purge 集合                         |
| BND-05 | 已收口 | Phoenix domain write -> PublicCache outbox -> Oban -> Cloudflare；Community/Dash GraphQL 只转发                                                             | 业务成功与传播失败混为一个 pending/error              | purge 失败只记录/重试，不回滚业务                               |
| BND-06 | 已收口 | `setPublicCacheHeaders` 累积当前 response context 中父子 loader 的 tag                                                                                      | tag 被覆盖时 purge 不完整                             | response-context 聚合测试断言完整 tag 集合                      |
| BND-07 | 已收口 | Dsb edit 使用 raw store 与窄领域 UI hooks                                                                                                                   | 无关字段变更触发大范围 rerender                       | 不展开完整 store snapshot                                       |
| BND-08 | 已收口 | `live$`、`commit`、`editField(s)`、`replaceOriginal` 等 facade caller 与实现均删除                                                                          | owner 被隐藏，旧写法继续扩散                          | 静态门禁禁止回流                                                |
| BND-09 | 已收口 | `useDsbSaveRunner` 只负责 transport lifecycle、Query update、reconcile 与反馈；response normalizer 在领域 module                                            | 通用 runner 膨胀且类型被擦除                          | 各领域返回 typed confirmed patch                                |
| BND-10 | 已收口 | tag、alias、FAQ、moderator 使用窄 session hooks；link/media 留在局部 hook，`initFilled` 删除                                                                | 生命周期和订阅域过宽                                  | UI state 不进入 confirmed/edit owner                            |
| BND-11 | 已收口 | dead strip/extract helper、无 caller viewer query 和生成合同已删除                                                                                          | 双重合同误导维护者                                    | canonical viewer batch 是唯一生产路径                           |
| BND-12 | 已收口 | article reaction consumer 改用直接 `useArticleUpvoteMutation`                                                                                               | 两套 mutation 入口和并发模型并存                      | 全局 event bridge 已删除                                        |
| BND-13 | 已收口 | 保留 `~/query` barrel：它仍同时导出 keys/factories 与 `QueryProvider`，Community/Dash route loader 也仍从该入口导入 query factories；本轮未创建 split entry | barrel 可能扩大 server/build 边界                     | production build 与 contract gate 已验证当前 build 边界可接受   |

## 5. 简化原则

以下抽象保留：

- canonical Query keys 和 typed query options；
- public/viewer 分离与 viewer batch；
- `CACHE_TAG` vocabulary；
- Dsb submitted/confirmed/current reconcile；
- 为连续点击保留的 toggle optimistic 合并逻辑。

内存期 optimistic mutation 的后续收口允许复用 `useOptimisticAction/useOptimisticToggle`，统一
identity、phase、queueKey、effect plan 与 confirmed handoff；领域 patch/reconcile 继续由
Article/Comment operation definition 以 typed callbacks 提供。它不得扩展为全局 callback registry
或任意 mutation DSL。设计见
[`optimistic_operation.md`](../migrations/tanstack/optimistic-operation.md)。
这是对早期“先竖切、后抽取”的有意调整；O3 Comment reaction 与 O4 create/delete 必须分别原样复用
既定 Toggle/Action 公开合同，否则先重新评审通用层边界。

若实施跨刷新 read-your-writes，允许保存有 TTL、按 accountRef 隔离的 confirmed write receipt。
它只是在 public projection revision 追上前参与 render overlay 和按需 reconcile，不是第二份长期
confirmed cache，也不得演化为 Valtio mirror 或通用 transaction engine。具体合同见
[`optimistic_read_your_writes.md`](../migrations/tanstack/optimistic-read-your-writes.md)。

以下方向禁止引入：

- TanStack DB，除非出现大量跨 shape join、索引和事务需求，并重新通过 ADR；
- command bus、mutation registry、通用 transaction engine；
- 只有 Dsb 一个消费者的 generic editable-store framework；
- 为兼容旧 caller 再增加一层 hook、别名或 fallback 双读；
- 把 Query data 复制进 Valtio，再通过 effect 维持“双向同步”。

对 compatibility 的处理原则是缩短而不是包装：先建立 caller 清单，逐个切到 canonical API，随后
删除旧入口。对大量调用方的 CommunityStore 采用渐进迁移，但每个切片必须减少 owner 或缩小字段
范围，不能新增镜像。

## 6. 执行阶段

### Phase B0：冻结真实 owner 和复现证据

- [x] 为 community、dashboard、themePreset、wallpaper、viewer、baseInfo 建立 owner/reader/writer 表；
- [x] 标出 shell bootstrap、Query cache、Valtio projection、editor working copy 的每次复制；
- [x] 使用现有 Dash 页面直接浏览器复验 ThemePreset preview → cancel/clear → reload；保存后的
      confirmed → CSS projection 由 Provider rerender 测试覆盖。本地浏览器无管理员 session，不为
      制造证据改写真实社区配置；
- [x] 对父子 loader 写入的最终 response context 建立 `Cache-Tag` 聚合测试；
- [x] 记录 compatibility facade 和 dead helper 的生产 caller，迁移归零并加入静态门禁。

完成标准：所有 P1 问题都有可执行复现或被测试证伪，不能只凭文档勾选判断完成。

### Phase B1：先补正确性闭环

- [x] `Q.dsb.config` 后台更新统一调用 `reconcileConfirmed`；
- [x] 修复 ThemePreset confirmed/projection 分叉；
- [x] 保证最终响应聚合完整 `Cache-Tag`；
- [x] 为 refetch 遇到 touched/untouched 字段补充并发 reconcile 测试。

完成标准：后台刷新和 preview 清理不会覆盖用户输入，也不会显示旧 confirmed data。

### Phase B2：收敛 confirmed owner

- [x] shell loader 仍可一次取数，但 hydration 后按领域 seed Query key；
- [x] shell cache 不再长期持有 `dashboard` 的可独立更新副本；
- [x] CommunityStore 的 server fields 是只读 projection，`communityDigestInView` 已迁出；
- [x] 删除重复 baseInfo fetch/copy，保存后 patch canonical owners；
- [x] ThemePreset/Wallpaper 分别写清并实现 confirmed、draft、preview、CSS projection owner。

完成标准：每份服务端数据在 owner 表中只有一个 confirmed writer；删除任一 projection 后都能从
Query 重建。

### Phase B3：退出兼容层并缩小订阅

- [x] `useDsbEdit` 和 `DsbEditorUi` 改为 raw store / 窄领域 hook，不展开完整 snapshot；
- [x] 迁移 `live$`、`commit`、`editField(s)`、`replaceOriginal`、`markFieldsToOriginal` caller；
- [x] 删除没有生产 caller 的 viewer helpers/query；
- [x] 删除 `initFilled`，领域临时状态进入窄 session/local owner；
- [x] article reaction 改为直接领域 mutation hook并删除全局 bridge。

完成标准：compatibility caller 为零；一个 editor 领域变化不会触发其他领域的 store 订阅。

### Phase B4：缩小保存层并分离 CacheEffect

> 历史完成项；长期替代方案见 [`public-cache-invalidation.md`](./public-cache-invalidation.md)，不继续扩展
> proxy CacheEffect。

- [x] 每个 Dsb save module 返回 typed confirmed patch，不使用字符串路径读取通用 response；
- [x] 公共 `useDsbSaveRunner` 不再包含 tag、DocFAQ、media、CommunityStore 等领域分支；
- [x] Community/Dash server proxy 共用 typed operation-to-cache-effect mapping；
- [x] UI mutation 不等待 CDN purge；
- [x] 删除 `frontend/core/query/cacheInvalidation.ts` 及其 operation-name contract；由
      `frontend/core/query/invalidation` 负责浏览器 typed target，HTML purge 交给 Phoenix PublicCache outbox；
- [x] 高频 interaction 返回 `none`，不逐次 purge。

完成标准：业务成功、Query confirmed、editor reconcile、CDN propagation 四个阶段可独立观察；任何
purge 失败都不改变 mutation 的业务结果。

### Phase B5：文档和门禁收口

- [x] 回写 `workflow_query_store_reorg.md`、`dashboard_store_reorg.md`、
      `urql_to_tanstack_query.md` 和 `query_sync_cache.md` 的实际完成状态；
- [x] 门禁禁止新增 shell confirmed mirror 和 compatibility facade caller；
- [x] `scripts/check-community-contract.mjs` 已同时扫描公共 loader/query source 中未受
      `@include(if: $userHasLogin)` 保护的 `viewerHasXxx` 字段和 `userHasLogin: true`，不再只检查
      `getAuthToken()`；后续只需随 public source 清单变化维护扫描范围；
- [x] 更新测试数和 Community/Dash production build 基线；真实 Cloudflare 证据明确保留为发布门；
- [x] B0–B4 本地验收全部通过，本文本地实施状态改为完成。

## 7. 验收矩阵

| 场景                    | 必须验证的结果                                                         |
| ----------------------- | ---------------------------------------------------------------------- |
| 匿名 SSR                | response/dehydration 不含 account、subscription、viewer fields         |
| 登录 hydration          | viewer unknown → loaded，不闪成 false，不污染公共 Query                |
| nested replies          | entries、replies、replyToComment viewer flags 全部按 canonical id 合并 |
| Dash focus refetch      | untouched 跟随服务端；touched 保留 current 并更新 original             |
| 保存期间继续输入        | confirmed 为提交值，current 保留新输入，仍 touched                     |
| ThemePreset 保存        | preview 清理、route change 和 reload 前后视觉一致                      |
| 多标签页/其他管理员修改 | confirmed 刷新通过同一 reconcile 进入 editor                           |
| 业务成功、purge 失败    | UI 显示保存成功；错误可观测；不回滚 Query/EditStore                    |
| 高频 reaction           | 当前用户立即看到 Query patch；不逐次 Cloudflare purge                  |
| public route Cache-Tag  | 最终 HTTP 响应包含该 route 所需完整 tag 集合                           |
| 非 Dash bundle          | 不静态包含 SavingBar、Dsb editor 和 save runtime                       |
| compatibility           | 旧 facade、旧 helper 和双读 caller 为零                                |

## 8. 完成定义

只有同时满足以下条件，Query / Store 重组才能重新标记为完成：

- owner 表中没有未解释的 confirmed duplicate；
- 所有 Query confirmed transition 都能进入正确的 editor reconcile；
- preview/projection 没有独立持久化或反向覆盖 confirmed state 的能力；
- compatibility 层有明确删除结果，不再只是改名；
- cache effect 与业务 mutation 已解耦，高频事件策略与真实实现一致；
- 文档勾选、测试和生产行为一致，不以单元测试替代真实 HTTP header 或 Cloudflare 发布验证；
- 没有为了收口再引入新的通用框架、双向同步层或第二套 cache。
