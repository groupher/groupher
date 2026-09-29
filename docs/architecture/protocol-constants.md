# 前端裸写协议字符串审计记录

## 背景

前端代码曾存在重复裸写的 auth event、浏览器自定义事件、API 路径、错误码和 TanStack Query
key。并非所有字符串都应该提取成 `const`：局部实现值、浏览器/HTTP 标准值、GraphQL 字段和
UI 文案通常应保持原样；跨文件、跨 package、跨前后端共享的值则需要明确协议归属和唯一来源。

本次工作的目标不是机械消灭字符串，而是处理可能导致协议漂移、缓存失效或跨端不兼容的重复
定义。

## 审计范围

已检查：

- 前端：`frontend/core`、`frontend/community`、`frontend/dash`、`frontend/landing`、
  `frontend/apply`、`frontend/widget`、`frontend/inspire-me`、`frontend/mock-server`；
- 共享层：`packages/contracts`、`packages/route-contract`；
- 服务端：`backend/auth`、`backend/api`、`backend/content-import`、`backend/press`；
- 网关：`infra/dev-gateway`、`infra/edge-router`。

测试文件、构建产物和生成的 `routeTree.gen.ts` 不作为生产代码问题统计。测试如果模拟或消费
跨端协议，应引用协议常量；如果断言协议稳定值本身，可以保留字面值。文件路由声明、环境变量
示例和生成产物中的值也不属于调用方重复定义。

## 完成状态

> 实施状态（2026-08-30）：P0、P1、P2 已按本文边界完成。

| 领域                                   | 状态     | 当前唯一来源                                              |
| -------------------------------------- | -------- | --------------------------------------------------------- |
| Auth channel / event                   | ✓ 已收口 | `frontend/core/lib/auth/constant.ts`                      |
| Auth 错误码 / JWT claims               | ✓ 已收口 | `packages/contracts/auth.contract.json`                   |
| Auth recovery action                   | ✓ 已收口 | `frontend/core/lib/auth/constant.ts`                      |
| Auth / 公共 API path                   | ✓ 已收口 | `packages/route-contract/src/index.ts`                    |
| Query key                              | ✓ 已收口 | 各 query domain 的 key factory；matcher 由 key owner 导出 |
| Query invalidation target / executor   | ✓ 已收口 | `frontend/core/query/invalidation`                        |
| Widget error event                     | ✓ 已收口 | `packages/contracts/src/widget.ts`                        |
| Community slug header                  | ✓ 已收口 | `packages/contracts/src/headers.ts`                       |
| 平台 host                              | ✓ 已收口 | `packages/route-contract/src/index.ts`                    |
| GraphQL 本地 fallback                  | ✓ 已收口 | `packages/contracts/src/endpoint.ts`                      |
| Docs Import path family                | ✓ 已收口 | `packages/route-contract/src/index.ts`                    |
| Public cache tag grammar               | ✓ 已收口 | `packages/contracts/public-cache.contract.json`           |
| ViewTracker human visibility threshold | ✓ 已收口 | `packages/contracts/view-counting.contract.json`          |
| 测试协议字符串                         | ✓ 已审计 | 消费测试引用 contract；稳定值断言保留字面值               |
| Constant / spec 文件职责               | ✓ 已整理 | 公开类型位于各目录 `spec.d.ts`                            |

## 落地记录

### 1. Auth 协议值｜✓ 已收口

修复前发现：

- 错误码：`TOKEN_MISSING`、`TOKEN_EXPIRED`、`TOKEN_INVALID`、`INVALID_CSRF`、
  `SESSION_EXPIRED`、`SESSION_REVOKED` 等；
- 恢复动作：`refresh`、`login`、`permission`、`none`；
- auth endpoint：`/logout`、`/token/refresh`、`/sessions`、`/accounts` 及其子路径；
- JWT claim：`groupher:phoenix`、`phoenix:browser-api`、`browser_access`；
- channel、BroadcastChannel event 和 DOM event。

当前归属：

- `AUTH_CHANNEL`、`AUTH_EVENT`、`AUTH_DOM_EVENT`、`AUTH_RECOVERY` 位于
  `frontend/core/lib/auth/constant.ts`；
- auth 错误码和 JWT claims 来自 `packages/contracts/auth.contract.json`；
- `AUTH_ROUTE` 位于 `packages/route-contract/src/index.ts`；
- Cookie / CSRF 手写协议位于 `packages/contracts/src/auth.ts`，其中 token Cookie 的原生 Node
  专属入口位于 `packages/contracts/src/auth-cookie.ts`。

`AUTH_CHANNEL_EVENT` 之类的合并命名没有采用：channel 和 event 是不同概念，分别使用
`AUTH_CHANNEL` 与 `AUTH_EVENT` 更准确。

### 2. Query key｜✓ 已收口

下表是修复前审计快照，用于保留问题证据；其中位置和次数不是当前源码检索结果。

| 值                     | 修复前位置                                                                        | 修复前次数 | 当前归属                                     |
| ---------------------- | --------------------------------------------------------------------------------- | ---------: | -------------------------------------------- |
| `comment-state`        | `frontend/core/query/key.ts`；Comment private-state query/cache                   |          6 | `viewerQueryKeys.commentStatePrefix`         |
| `article-state`        | `frontend/core/query/key.ts`；Article private-state query/cache                   |          2 | `viewerQueryKeys.articleStatePrefix`         |
| `config` / `event`     | `frontend/core/query/activity.ts:46`、`:64`                                       |       各 1 | `activityKeys.config` / `activityKeys.event` |
| `dsb` / `save`         | `frontend/core/query/mutation/useDsbSaveRunner.ts:33`、`:80`                      |          2 | `dsbMutationKeys.save`                       |
| `visitor-location-map` | `frontend/core/unit/AboutThread/VisitorLocationMap/index.tsx:23`                  |          1 | `visitorKeys.locationMap`                    |
| `graphql`              | `frontend/core/query/graphql.ts:20`；`frontend/community/src/query/queries.ts:75` |          2 | `graphqlKeys.document`                       |

最终采用各领域 key factory，没有建立全局 `QUERY_KEYS` 字符串表。调用方不再重建相同层级的
cache key，从而保证 invalidate、remove 和 refetch 使用相同 identity。

### 3. Widget 自定义事件｜✓ 已收口

修复前 `frontend/widget/src/loader/index.ts` 与
`frontend/core/unit/DsbThread/Widgets/PreviewLoader.tsx` 都裸写
`groupher-widget:error`。

现在由 `packages/contracts/src/widget.ts` 导出 `WIDGET_EVENT.ERROR`、event name literal type
`TWidgetEventName`、detail type `TWidgetErrorDetail` 和 `TWidgetErrorEvent`。派发与监听两侧使用
同一常量和 detail 类型；`CustomEvent<T>` 的泛型表示 detail，而不是 event name。

### 4. 公共 API 路径｜✓ 已收口

修复前重复或分散的路径包括 `/api/graphql`、`/api/artiment/import`、
`/api/artiment/publish`、`/api/docs/import/*`、`/api/utils/slugify` 和 `/api/auth/*`。

当前由 `packages/route-contract/src/index.ts` 按边界导出：

- `API_ROUTE`：公共 API 路径；
- `AUTH_ROUTE`：Auth 服务路径族及参数化 helper；
- `DOCS_IMPORT_ROUTE`：Docs Import 路径族及参数化 helper。

TanStack 文件路由声明仍保留字面路径，因为它们是路由框架的源定义；生成的 route tree 只由
生成器更新。

### 5. 其他跨边界标识｜✓ 已收口

- `GROUPHER_COMMUNITY_SLUG_HEADER` 位于 `packages/contracts/src/headers.ts`，Community、Dev
  Gateway 和 Edge Router 统一引用；
- `PRODUCTION_PLATFORM_HOSTS`、`PLATFORM_ROOT_HOSTS`、`PLATFORM_HOSTS` 与
  `isPlatformHost` 位于 `packages/route-contract/src/index.ts`；
- `LOCAL_PHOENIX_GRAPHQL_ENDPOINT` 位于 `packages/contracts/src/endpoint.ts`；
- Docs Import preview/apply 路径由 `DOCS_IMPORT_ROUTE` 统一构造。

资源 URL、部署配置、测试样例和业务内容中出现的 `groupher.com` 不等同于“平台主机判断”，因此
没有机械替换。

### 6. Constant 与 spec 混写｜✓ 已整理

协议字符串收口完成后，进一步检查了前端 `constant.ts`、`constants.ts` 和 `constant.tsx` 的文件
职责。判断标准是：常量文件保留运行时值；跨文件消费的公开类型放入同目录 `spec.d.ts`。只服务
本文件常量构造或回调签名的私有辅助类型，不机械拆分。

#### 已有 `spec.d.ts`，已完成迁移

| Constant 文件                                                              | 已迁移类型                                         | 目标               |
| -------------------------------------------------------------------------- | -------------------------------------------------- | ------------------ |
| `frontend/core/ui/MarkdownEditor/constant.tsx`                             | `TFormat`、`TFormatConfig`；内部依赖 `TActionMeta` | 同目录 `spec.d.ts` |
| `frontend/core/unit/DocCovers/constant.ts`                                 | `TDocCoverView`                                    | 同目录 `spec.d.ts` |
| `frontend/core/unit/DsbThread/CMS/Docs/ActionSnackbar/Publish/constant.ts` | `TPublishMode`                                     | 同目录 `spec.d.ts` |

`Publish/constant.ts` 原有的 `TPublishMode` 与 `frontend/core/spec/utils.d.ts` 中的同名类型来源
不同。迁移后 Docs Publish 使用更具体的 `TDocsPublishMode`，全局文章发布类型继续使用
`TPublishMode`。

#### 原先没有 `spec.d.ts`，现已补齐

| Constant 文件                                                                            | 已迁移类型                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `frontend/core/unit/CoverEditor/TuningPanel/DetailPanel/BasicTab/ImageTitle/constant.ts` | `TImageType`                                                |
| `frontend/core/unit/CoverEditor/TuningPanel/DetailPanel/BasicTab/Shadow/constant.ts`     | `TShadowPanelStyle`；内部 option 类型                       |
| `frontend/core/unit/DsbThread/Appearance/Theme/DetailsPanel/Colors/constant.ts`          | `TColorDetail`                                              |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/Title/constant.ts`                 | `TTitleStageView`                                           |
| `frontend/core/unit/DsbThread/CMS/Docs/Editor/constant.ts`                               | `TDocEditorMode`                                            |
| `frontend/core/unit/DsbThread/Domain/Custom/constant.ts`                                 | `TDnsRecord`、`TVerifyingDomainRow`、`TStep`、`TDomainStep` |
| `frontend/core/unit/DsbThread/SideMenu/constant.ts`                                      | `TSubMenuScope`、`TSubMenuItem`                             |
| `frontend/core/unit/SiteFooter/constants.ts`                                             | `TFooterView`                                               |

其中 `Domain/Custom/constant.ts` 原先的职责混合最明显；DNS 数据结构、验证状态和步骤类型现已迁入
`spec.d.ts`。`Editor/constant.ts` 与 `SideMenu/constant.ts` 的跨文件消费类型也已完成迁移。

#### 可以保留的私有辅助类型

以下类型当前只服务于本文件的常量构造或回调签名，不视为公开 spec 混写：

- DnD `constant.ts` / `constants.ts` 中的 `TDragActive`；
- `EditToggle/constant.ts` 中的 `TModeItem`；
- Article Footer `constant.ts` 中的 `TFooterAction`；
- Landing CompareDev `constant.ts` 中的 `TTranslate`。

上述公开类型均已迁入对应 `spec.d.ts`，消费者 import 已同步。Docs Publish 的局部类型命名为
`TDocsPublishMode`，与全局文章发布 `TPublishMode` 明确区分。最终扫描中，constant 文件只剩本节
明确允许的私有辅助类型，没有公开 `export type` 或 `export interface`。

## 跨语言 Auth contract

Auth 错误码和 JWT claim 同时被 TypeScript 与 Elixir 使用。当前生成关系是：

```text
packages/contracts/auth.contract.json
  ├─ 生成 packages/contracts/src/auth.generated.ts
  │    └─ 由手写 packages/contracts/src/auth.ts 统一导出
  └─ 生成 backend/api/lib/groupher_server/auth/contract.ex
```

文件职责：

- `auth.contract.json`：语言无关的唯一来源；
- `auth.generated.ts`：TypeScript 生成文件，禁止手工修改；
- `auth.ts`：手写公共入口，转出生成内容并维护 Cookie / CSRF 协议；
- `auth-cookie.ts`：手写的 token Cookie 专属入口，供原生 Node 源码直接消费；
- `GroupherServer.Auth.Contract`：Elixir 生成镜像，不是 Auth Context。

`packages/contracts/scripts/generate-auth-contract.mjs` 负责生成两侧产物；
`generate:auth:check` 和 Contracts 测试会检查生成结果是否过期。parity test 继续验证 TS 与 Elixir
结果一致。

## 跨语言 Public Cache tag contract｜目标

公共 HTML 由 Community 输出 response tag，Cloudflare purge tag 由 Phoenix 生成；两端必须使用相同 wire grammar。
本次改造直接复用 `packages/contracts` 的共享 contract 与 golden vectors，不建立第二套 framework：

```text
packages/contracts/public-cache.contract.json
  ├─ packages/contracts/src/public-cache.ts
  │    └─ Community/Core constructors
  ├─ backend/api/lib/groupher_server/public_cache/tags.ex
  │    └─ Phoenix mirror
  └─ packages/contracts/fixtures/public-cache-tags-v1.json
       └─ cross-language golden vectors
```

两端测试共同读取 `packages/contracts/fixtures/public-cache-tags-v1.json` golden vectors，验证相同输入生成完全相同的 tag。

边界必须保持清楚：

- contract 只拥有 tag version、scope 名称、template、输入约束和 canonical constructors；
- `article_published` 等 invalidation type 属于 Phoenix `PublicCache.Const`，不暴露给 TypeScript；
- 领域代码不能裸写 tag template，也不能直接传任意 tag 给 purge adapter；
- JSON、生成文件、stale check 与 golden vectors 在同一个改造中落地，不保留旧 tag helper alias。

完整 outbox、worker 与 Cloudflare 协议见
[`public-cache-invalidation.md`](./public-cache-invalidation.md)。

前端 Query invalidation 的 target 与 key ownership 不属于这个跨语言 wire contract，但其唯一归属登记在
`frontend/core/query/invalidation/`：target 由该目录的 resolver 定义，canonical key/matcher 由
`frontend/core/query/key.ts` 定义，执行只能经过 `executor.ts`。它不直接调用 Cloudflare，也不复用 PublicCache tag。

## 保留字面值的边界

以下内容不作为 missing const 问题：

- `GET`、`POST`、`Content-Type`、`application/json`、`no-store` 等 HTTP/fetch 标准值；
- `resize`、`scroll`、`load`、`keydown`、`visibilitychange` 等浏览器标准事件；
- UI 文案、翻译 key、GraphQL operation/字段/selection、CSS class；
- TanStack 文件路由声明、部署配置和 `.env.example`；
- contract 自身对稳定协议值的断言；
- 只出现一次、没有跨边界语义的局部实现值。

## 验收结果

### P0：建立边界｜✓ 完成

1. 已盘点 auth 错误码及前后端消费者；
2. 已建立语言无关 Auth contract、双端生成和 stale check；
3. 已明确 Auth endpoint 与公共 route contract 的归属。

### P1：修复行为风险｜✓ 完成

1. 已补齐 Query key factory 并移除调用方手写 cache key；
2. 已收口 Widget event name 和 detail 类型；
3. 已收口跨 app API path 和自定义 header。

### P2：降低长期漂移｜✓ 完成

1. 已整理 Docs Import API path helper；
2. 已统一平台 host 和 GraphQL fallback；
3. 已检查测试、Mock Server 和网关协议字符串。

最终生产源码检索只允许命中协议唯一来源、生成文件、框架源定义和上述明确保留项。新增跨边界
字符串时，应先确定领域归属，再增加 contract 和消费者测试；不要为了“没有裸字符串”而扩大
无语义的全局常量表。
