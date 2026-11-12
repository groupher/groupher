# Content Publisher

> 状态：已实施（2026-10-16）；Comment 发布仍受“目标环境必须无待保留历史评论”的发布门禁约束。

本文定义 Groupher 跨 Dash、Community、Content Import、API 与 Agent 的统一富文本写入边界。
它同时记录已落地合同、明确非目标和 direct-cutover 顺序。实现已按 Batch 0–5 收口；本文中的
“目标”描述保留为架构约束，而不再表示待开发状态。

实现入口：

- `packages/content-publisher`：Plate/Markdown normalization 与唯一 BodyBag 生成权威；
- `packages/contracts/src/content-publish.ts`：action、type、scope、command 与 runtime parser；
- `frontend/dash/src/routes/api/content/publish.ts` 与
  `frontend/community/src/routes/api/content/publish.ts`：产品 host 的同源认证 route；
- `frontend/core/lib/server/content-publisher.ts`：共享的固定 generated operation adapter、service capability、
  delegated user proof 与无正文审计日志；
- `backend/api/lib/groupher_server_web/middleware/body_bag_trust.ex`：mutation-specific scope；
- `backend/api/lib/groupher_server/cms/model/comment_body.ex`：Comment canonical versioned body；
- `backend/api/priv/repo/migrations/20261016130000_cut_over_comment_bodies.exs`：空数据发布门禁和 direct cutover。

相关当前合同：

- [`cms-command.md`](./cms-command.md)：用户写命令、Receipt 与 Confirmation；
- [`cms-command-confirmation.md`](./cms-command-confirmation.md)：Confirmation codec 与恢复协议；
- [`request-actor.md`](./request-actor.md)：请求 actor 分类；
- [`cms-multi-entry-boundary.md`](./cms-multi-entry-boundary.md)：GraphQL、CLI、MCP 与 Plugin 的领域入口边界。

## 1. 背景与已解决故障

实施前，Dash Docs 编辑器曾向尚未建立的同源 `POST /api/content/publish` route 提交 Plate 内容，
请求因此落入页面路由并返回 HTML `500`。该故障已经由当前 Dash API route、固定 adapter 与
结构化错误合同解决；这里保留它作为架构动因，而不是当前运行状态：

```text
raw rich content
  -> server normalization and validation
  -> canonical BodyBag
  -> delegated user + service capability
  -> Phoenix domain command
  -> atomic body and payload persistence
```

Groupher 已有大部分基础能力：

- `@groupher/content-publisher` 已能从 Plate 生成完整 BodyBag；
- `@groupher/rich-editor/node` 已提供 Markdown deserialization 与 diagnostics；
- Auth 已有 client-credentials、audience 和 scope registry；
- Phoenix 已有 service actor、delegated actor、`BodyBagTrust`、Gate 与 `CMS.Command`；
- Docs `update_doc_draft` 已经由 `CMS.DocTree.Commands.UpdateDraft` 接入 Receipt 和 Confirmation；
- Frontend Core 已有 GraphQL codegen 与 command id 基础设施。

目标不是重新建设这些能力，而是将它们收口为一个通用、可审计、不可由浏览器伪造 BodyBag
的 Content Publisher 边界。

## 2. 架构决策

1. Content Publisher 是共享 Node package，由现有可信 Node host 的 API route 调用。
2. 浏览器或 Agent 一次提交原始 content source、业务 payload、target、`commandId` 和领域并发字段：
   Article 使用 WorkingCopy `revision`，Docs 与 Comment 保留各自的 `expectedVersion`。
3. Publisher 在 Node 内生成 BodyBag，并直接调用一个明确的 Phoenix mutation；BodyBag 和
   service credential 不返回调用端。
4. Plate 是默认 source format；Markdown 是显式 source format，并复用现有 rich-editor
   deserializer。
5. Docs、Article 和 Comment 使用同一 BodyBag wire contract 和同一 Publisher 生成权威。
6. `action` 决定 content type、校验规则、service scope 和 Phoenix mutation；调用端不能另行指定
   type、scope 或 mutation。
7. BodyBag 不保存重复的 content type；Phoenix 已从 mutation 和领域 target 得知类型。
8. 用户业务权限与服务能力相互独立：Gate 决定用户能否写目标资源，service scope 证明 BodyBag
   来自受信 Publisher 路径。
9. Auth registry 是 service client、audience 和 scope grant 的唯一权威；Phoenix 不维护第二份
   subject allowlist。
10. GraphQL 查询统一返回 `body: ArtimentBody`；`document` 不再作为正文 projection 名称。
11. Comment 采用 BodyBag direct cutover，不兼容、不回填历史 Comment 正文，也不保留旧字段、双读、
    双写或转换 fallback。
12. Comment 当前不实现 server draft，但正文存储必须允许未来通过新增表接入 draft，而无需重构
    当前 canonical body。

## 3. 总体流程

```text
Browser / Agent
      |
      | typed command: action + target + payload + commandId + domain concurrency field
      v
Trusted Node host route
      |
      +-- authenticate caller
      +-- parse and validate command shape
      +-- derive content type from action
      v
@groupher/content-publisher
      |
      +-- Plate ----------------------+
      +-- Markdown -> deserialize ----+-> canonical Plate
      +-- apply type-specific validation
      +-- serialize / sanitize / hash
      `-- build canonical BodyBag
      |
      v
Explicit action adapter
      |
      +-- acquire Publisher service capability
      +-- forward delegated user proof separately
      +-- call one code-generated Phoenix mutation
      v
Phoenix CMS command boundary
      |
      +-- verify service token and required scope
      +-- bind delegated user actor
      +-- Gate authorization on canonical resource
      +-- BodyBag.cast for the mutation-owned thread
      +-- CMS.Command receipt / revision or expectedVersion
      `-- atomically persist body and business payload
```

禁止的回路：

```text
Browser <-X- generated BodyBag
Browser <-X- service credential
Browser --X-> arbitrary GraphQL document
Browser --X-> caller-selected type, scope or audience
```

## 4. Package 与职责

旧 `@groupher/artiment-publisher` 已直接改名并演进为 `@groupher/content-publisher`，不能通过 package
alias、re-export 或兼容 wrapper 并行保留旧入口。共享包保持 transport-neutral：不读取 HTTP request、
session 或环境变量，也不调用 Phoenix。

改名是全仓 cutover，不只影响 Dash。Batch 0 必须同步迁移 Content Import 的 package dependency、Docs
publisher、Phoenix Docs transport、Markdown importer、测试、README、workspace 配置和 lockfile 中的旧
package 引用；完成后仓库中不得再出现 `@groupher/artiment-publisher` import。

当前保持扁平结构，等真实复杂度出现后再拆目录：

```text
packages/content-publisher/
  index.ts
  types.ts
  constants.ts
  normalize.ts
  validate.ts
  body-bag.ts
  error.ts
```

职责：

- `normalize.ts`：Plate 或 Markdown 到 canonical Plate；
- `validate.ts`：公共结构限制以及 doc/article/comment 的明确规则；
- `body-bag.ts`：生成 JSON、Markdown、HTML、TOC、plain text、digest、hash 和 schema version；
- `types.ts`：Publisher 输入、BodyBag 和结构化错误；
- `constants.ts`：format、action、type 与其他稳定协议常量。

当前不建立 adapter、rule 或 handler registry，不引入 class、factory、plugin discovery 或依赖注入。

## 5. 常量与类型

协议字符串必须集中 const 化：

```ts
export const CONTENT_SOURCE_FORMAT = {
  PLATE: 'plate',
  MARKDOWN: 'markdown',
} as const

export const CONTENT_PUBLISH_ACTION = {
  UPDATE_DOC_DRAFT: 'docDraft.update',
  CREATE_ARTICLE: 'article.create',
  SAVE_WORKING_COPY: 'article.working_copy.save',
  CREATE_AND_PUBLISH_ARTICLE: 'article.create_and_publish',
  CREATE_COMMENT: 'comment.create',
  UPDATE_COMMENT: 'comment.update',
} as const

export const CONTENT_TYPE = {
  DOC: 'doc',
  ARTICLE: 'article',
  COMMENT: 'comment',
} as const
```

类型从常量推导，不能手写另一组字符串 union。Source 使用显式 discriminant：

```ts
type TContentSource =
  | {
      format: typeof CONTENT_SOURCE_FORMAT.PLATE
      value: TRichEditorValue
    }
  | {
      format: typeof CONTENT_SOURCE_FORMAT.MARKDOWN
      markdown: string
    }
```

Markdown 分支复用 `@groupher/rich-editor/node` 的 `deserializeMarkdown` 及已有 path/position
diagnostics。两种格式使用 exhaustive switch；当前不需要 adapter registry。

## 6. Action、type 与 command

调用端只提交 action。Content type 由服务端从 action 推导：

```ts
const CONTENT_TYPE_BY_ACTION = {
  [CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT]: CONTENT_TYPE.DOC,
  [CONTENT_PUBLISH_ACTION.CREATE_ARTICLE]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE]: CONTENT_TYPE.ARTICLE,
  [CONTENT_PUBLISH_ACTION.CREATE_COMMENT]: CONTENT_TYPE.COMMENT,
  [CONTENT_PUBLISH_ACTION.UPDATE_COMMENT]: CONTENT_TYPE.COMMENT,
} as const satisfies Record<TContentPublishAction, TContentType>
```

共享 command contract 放在 `packages/contracts`；URL 常量放在 `packages/route-contract`。两者不能
混为一个包的职责。

```ts
type TContentPublishCommand =
  | TUpdateDocDraftCommand
  | TCreateArticleCommand
  | TSaveWorkingCopyCommand
  | TCreateAndPublishArticleCommand
  | TCreateCommentCommand
  | TUpdateCommentCommand
```

每个 command 固定自己的 `target` 和 `payload`。`payload` 不是任意 map，也不叫 metadata，避免与
Community/Article 现有 `meta` 混淆。

```ts
type TUpdateDocDraftCommand = {
  action: typeof CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT
  target: { community: string; documentId: string }
  payload: {
    content: TContentSource
    title: string
    subtitle: string
    slug: string
  }
  commandId: string
  expectedVersion: number
}

type TArticleContentFields = {
  copyRight?: string
  linkAddr?: string
  subtitle?: string
  templateKey?: string
  coverUrl?: string
  coverUrlDark?: string
}

type TSaveWorkingCopyCommand = {
  action: typeof CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY
  target: { community: string; articleId: string; workingCopyId: string }
  payload: {
    content: TContentSource
    title?: string
    digest?: string
    slug?: string
    tagIds?: string[]
  } & TArticleContentFields
  commandId: string
  revision: number
}

type TCreateAndPublishArticleCommand = {
  action: typeof CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE
  target: { community: string; thread: string }
  payload: {
    content: TContentSource
    title: string
    digest?: string
    slug?: string
    tagIds: string[]
  } & TArticleContentFields
  commandId: string
}
```

内部使用 exhaustive switch 调用明确函数，不建立动态 command bus：

```ts
switch (command.action) {
  case CONTENT_PUBLISH_ACTION.UPDATE_DOC_DRAFT:
    return updateDocDraft(command)
  case CONTENT_PUBLISH_ACTION.CREATE_ARTICLE:
    return createArticle(command)
  case CONTENT_PUBLISH_ACTION.SAVE_WORKING_COPY:
    return saveWorkingCopy(command)
  case CONTENT_PUBLISH_ACTION.CREATE_AND_PUBLISH_ARTICLE:
    return createAndPublishArticle(command)
  case CONTENT_PUBLISH_ACTION.CREATE_COMMENT:
    return createComment(command)
  case CONTENT_PUBLISH_ACTION.UPDATE_COMMENT:
    return updateComment(command)
}
```

## 7. Runtime parsing

TypeScript 类型不能替代 HTTP runtime validation。第一版为每个 action 使用小型显式 parser，返回
稳定的 path-based issues：

```ts
type TParseResult<T> =
  | { ok: true; value: T }
  | {
      ok: false
      issues: Array<{ path: string; code: string; message: string }>
    }
```

解析顺序：

```text
unknown JSON
  -> object
  -> action
  -> action-specific target/payload
  -> source format
  -> commandId / action-specific revision or expectedVersion
  -> typed command
```

Parser 只校验 command shape；Plate 的节点、深度、尺寸与媒体规则继续由 Publisher validator 负责。
当前不引入 Zod、Valibot 或通用 schema registry。重复达到需要统一 schema DSL 的程度后再独立决策。

## 8. BodyBag 与读取模型

Publisher 对 Docs、Article 和 Comment 生成同一 `TArtimentBodyBag`。BodyBag 是可信写入 envelope；
GraphQL 查询返回独立的读取 projection：

```ts
type TArtimentBodyBag = TArtimentBodyFields
type TArtimentBody = TArtimentBodyFields
```

它们当前可共享基础字段，但保持独立导出，允许未来读写 contract 分别演进。BodyBag 不增加
`type`、`sourceFormat` 或调用者可写的 publisher metadata。

Phoenix 只保留一套严格的 `ArtimentBodyBagInput`：一旦提供 BodyBag，所有 canonical 字段都必须存在。
允许 metadata-only update 的 mutation 可以将外层 `bodyBag` argument 设为 optional，但不得另建字段
nullable 的 BodyBag input 变体。

GraphQL 命名冻结为：

```graphql
input ArtimentBodyBagInput {
  json: String!
  markdown: String!
  html: String!
  toc: [ArtimentTocItemInput!]!
  plainText: String!
  digest: String!
  bodyHash: String!
  schemaVersion: Int!
  thumbnail: Json!
}

type ArtimentBody {
  json: String!
  markdown: String!
  html: String!
  toc: [ArtimentTocItem!]!
  plainText: String!
  digest: String!
  bodyHash: String
  schemaVersion: Int!
}
```

`Json` 输入标量在线路上使用 JSON 字符串；Content Publisher 将可信生成的 thumbnail JSON 编码后交给 GraphQL，服务端解析为对象再校验和持久化。

资源使用 `body`：

```graphql
type Article {
  body: ArtimentBody!
  thumbnail: JSON
  assetRefs: [ArticleAssetRef!]!
}

type DocDraft {
  body: ArtimentBody!
  thumbnail: JSON
  assetRefs: [ArticleAssetRef!]!
  version: Int!
}

type Comment {
  body: ArtimentBody!
  bodyVersion: Int!
}
```

`ArtimentBody` 只包含 canonical 正文 projection。旧 `article_document.thumbnail` 是由正文生成的展示
派生数据，当前已上移为 Article、DocDraft 等资源的 sibling `thumbnail` field；Article 从所选 Snapshot
读取，Docs 从其当前文档版本读取。旧 `article_document.asset_refs` 是资源版本拥有的资产关系，不是正文内容，当前已
上移为资源层 `assetRefs` field。Article 引用归属 `ArticleWorkingCopy` 或 `ArticleSnapshot`；Docs 引用继续按其
当前文档版本归属。两者都不能为了兼容旧
`article_document` 而进入 `ArtimentBody`。

Publisher 输入 `BodyBag` 仍携带可信转换器生成的 `bodyHash` 供输入校验；Article WorkingCopy / Snapshot 不持久化或
输出该字段。文章正文 Diff 直接比较保存的 Plate JSON；Docs 与 Comment 仍按各自当前模型保留 hash/version 字段。

边界固定为：

```text
body       = canonical rich-content projection
thumbnail  = derived presentation projection
assetRefs  = version/resource-owned asset relation
```

本次采用 direct cutover，不长期同时暴露 `document` 与 `body`。

cutover 按资源批次完成，而不是在同一个 GraphQL type 上临时双暴露：

- Batch 1 同步迁移 DocDraft 的 query fragment、generated types、restore/update result 和编辑器消费路径；
  `doc_branch_version_content.documentJson` 属于 revision/diff/restore 路径，同批迁移为 `body.json`，不
  保留 `documentJson` alias；
- Batch 3 迁移 Article 以及公开 Doc read projection；
- 每个资源完成所属批次后立即删除它的 `document` field，不提供 alias 或 fallback。

## 9. 用户权限与服务能力

一次正文写入必须同时满足：

```text
valid service capability
AND delegated user authorization
AND domain validation
AND domain revision or expectedVersion / command receipt constraints
```

### 9.1 Service identity

Auth 的 service client registry 是唯一 grant 权威。Publisher host 使用独立 credential，从 Auth 获取
面向 Publisher API resource 的短期 token。Phoenix verifier继续验证签名、issuer、audience、token
类型、有效期和 service subject 基本格式。

候选 capability scopes：

```text
content:doc:write
content:article:write
content:comment:write
```

scope 表达能力而不是调用方名称。以上字面值必须在 Batch 0 按现有 Auth registry 的 scope taxonomy
冻结；如果 registry 的既有命名规范要求不同字面值，以 registry 为准，并由 contracts 常量统一导出，
不能让 Node 与 Phoenix 各自手写。Dash 与 Content Import 可以使用不同 client credential 获得同一
Doc capability。Phoenix 不再按 subject 维护第二份 service registry。

### 9.2 BodyBagTrust

`BodyBagTrust` 应由 mutation 显式声明 required scope：

```elixir
middleware(M.BodyBagTrust, scope: "content:doc:write")
```

它只证明请求携带了 mutation 所需的受信 service capability；不校验 Publisher subject 注册表，不
验证具体 Node 算法，也不负责 BodyBag 结构。BodyBag 的字段、尺寸和领域结构由 resolver/command
边界的 `BodyBag.cast(thread: ...)` 校验。Mutation 和 cast context 共同决定领域类型，不读取 BodyBag
中的重复 type。

### 9.3 Delegated user

继续复用现有 `X-Groupher-User-Authorization`、Phoenix `delegated_actor` 和 `DelegatedScope` 机制。
Publisher 不能从普通 payload 接受任意 user id，也不能因拥有 service token 绕过 Gate。

## 10. Phoenix 领域写入

Node adapter 只能调用 code-generated、固定的 Phoenix mutation。调用端不能提交 GraphQL document、
mutation name、scope 或 audience。

业务字段和 BodyBag 在一次领域命令中原子保存：

```text
Node: canonical BodyBag + validated target/payload
  -> Phoenix mutation
  -> Gate on canonical resource
  -> BodyBag.cast
  -> Article WorkingCopy revision or Docs/Comment expectedVersion
  -> CMS.Command
  -> body + title/tags/category/etc transaction
```

仅修改 title/tag 等且不包含正文的 field-only command 可以继续走普通业务 mutation。

### 10.1 Docs replay 现状

`update_doc_draft` 已经通过以下链路接入 Receipt：

```text
CMS.DocTree.Commands.UpdateDraft
  -> Support.run_doc_command
  -> CMS.Command.execute
  -> NodeDraftConfirmation
  -> CMS.Docs.DraftResult
```

底层 `CMS.Docs.Commands.UpdateDraft` 不直接读取 `command_id`，因为 command boundary 位于上层
DocTree command。实现不需要重建 replay 基础设施；本项目需要补充 route-to-Phoenix 的重放和恢复
集成测试。

## 11. Comment direct cutover

现有 Comment mutation 的 `body: String!` 和 Phoenix `Comments.BodyCodec` 不再是目标合同。Create、
reply、update 改为接收 `bodyBag: ArtimentBodyBagInput!`，update 同时接收 `expectedVersion`。

```text
Content Publisher
  -> BodyBag
  -> create/update/reply Comment mutation
  -> BodyBagTrust(scope: content:comment:write)
  -> BodyBag.cast(thread: :comment)
  -> Comment Command transaction
```

Comment 正文从主表拆到当前 canonical body：

```text
Comment 1 ---- 1 CommentBody
```

```text
cms.comment_bodies
  id
  comment_id (unique FK)
  json
  markdown
  markdown_toc
  html
  plain_text
  digest
  body_hash
  schema_version
  version
  inserted_at
  updated_at
```

这是有意与当前 Article 正文模型对齐：Article 使用字段化的 `ArticleWorkingCopy` 和
`ArticleSnapshot`，Comment 使用字段化的 `CommentBody`；目标不是为 Comment 单独引入 opaque
`body_bag` map。Wire `toc` 在持久化层映射为 `markdown_toc`，读取 projection 输出 `markdownToc`，
三者分别遵守已有 wire、数据库和 GraphQL 命名约定。

后端模型命名 `CommentBody`，GraphQL projection 命名 `body: ArtimentBody`。完成切换后删除
`Comments.BodyCodec` 以及 `comments.body/body_html`。

旧 Comment 的 Plate JSON 技术上可以经 Publisher 重新生成 BodyBag，但本方案明确选择不做。
不兼容、不 backfill、不提供双读取、双写、旧字段 fallback 或运行时转换。该选择成立的发布前提是：
目标环境没有必须保留的 Comment，或产品已批准清空/重建 Comment 数据。若任一目标环境存在必须
保留的数据，发布必须阻断并重新做产品决策，不能在实现中临时加入兼容层绕过。

### 11.1 Future Comment draft

当前不实现 Comment server draft，也不预建空表、状态机或 publish lifecycle。`CommentBody` 从第一天
起独立存储并带 `version`，未来只需新增：

```text
CommentBodyDraft
  comment_id
  author_id
  complete BodyBag fields
  version
  base_body_version
```

未来 publish draft 将草稿 BodyBag 写入现有 `CommentBody` 并递增 version；公开 Comment 查询路径与
canonical body 存储不需要迁移。Snapshot 只在出现真实审计或历史版本需求后另行增加。

## 12. GraphQL codegen

Node 到 Phoenix 的 mutation 以 Phoenix schema 为契约源。Publisher PR 创建前必须完成 codegen、
generated freshness check 和 type-check，不能长期维护手写 response 泛型。

Batch 0 必须交付一个 Node 可直接 import 的 generated operations 入口，至少包含
`update_doc_draft`，并用真实 server build/import test 证明它不会携带浏览器专用 runtime、fragment
masking 或其他不适用于 Node host 的依赖。优先复用现有 Frontend Core schema/codegen pipeline；若
现有 client-preset output 无法满足 server bundle，再从同一 schema 和 operation source 生成
host-neutral output。不得复制 schema、手写并行 response 类型或新建第二套生成协议。CI 必须验证
generated output 与 schema/operations 保持最新。

## 13. HTTP route

统一 route 由 `packages/route-contract` 定义：

```text
POST /api/content/publish
```

Dash 使用当前 TanStack 形式：

```ts
createFileRoute('/api/content/publish')({
  server: {
    handlers: {
      POST: ({ request }) => handleContentPublishRequest(request),
    },
  },
})
```

Route 必须：

- 只接受 `POST application/json`；
- 在读取前后限制 body 大小；
- 认证调用者并返回结构化 `401`；
- 调用 action-specific runtime parser；
- 使用 action allowlist 和 exhaustive switch；
- 返回 `Cache-Control: no-store` 与 `X-Content-Type-Options: nosniff`；
- 将 validation、forbidden、version conflict 和 upstream failure 映射为稳定错误；
- 不将 HTML upstream body、正文或 credential 写入响应或日志。

## 14. Autosave、冲突与限流

Docs autosave 已有 debounce 与 single-flight，不增加第二套 queue framework。错误语义：

```text
transport result unknown
  -> reuse the same commandId for bounded recovery

version conflict
  -> do not retry with the stale Article revision or Docs expectedVersion
  -> reload canonical body and concurrency field
  -> preserve local dirty body for explicit reconcile

validation / forbidden
  -> do not retry

rate limited
  -> schedule one wake-up at Retry-After
  -> accept both delay-seconds and HTTP-date header forms
  -> coalesce edits made during the cooldown into the latest draft
  -> clear the wake-up on success, document switch, or unmount
```

Phoenix 的稳定错误合同为：Doc draft 冲突使用 ErrorCat code `4539`，Comment body 冲突使用 `4540`，
Article WorkingCopy 冲突使用 `4561`，映射为 HTTP `409` / `revision_conflict`；Docs 和 Comment 的各自版本冲突仍映射为
`version_conflict`。
Article 外部字段使用 `revision`，不使用 `expectedVersion`。服务 scope 拒绝使用字符串 code
`SERVICE_SCOPE_FORBIDDEN`，映射为 HTTP `403` / `forbidden`。其他业务域数字 code 不得借作冲突或
权限判断，避免将 community/profile 错误误分类。两个数字 code 由
`packages/contracts/content-publish.contract.json` 唯一拥有，并生成 TypeScript 与 Elixir 合同；
Phoenix ErrorCat 和 Node adapter 都必须消费生成值，contracts freshness check 阻止漂移。

GraphQL 返回多个错误时，host adapter 不依赖数组顺序，采用稳定优先级：service authorization
`403`、rate limit `429`、version conflict `409`、其他业务错误 `422`。Publisher 自身的预期
validation 错误保留原始 status、code 和 diagnostics；只有未知运行时或依赖故障映射为
`publisher_unavailable`。

Batch 1 的客户端改动入口是
`frontend/core/unit/DsbThread/CMS/Docs/Editor/Article/hooks/useDraftAutoSave.ts`。当前实现按 Publisher 的
结构化错误区分 transport unknown、version conflict、validation、
forbidden 和 rate limit，并落实上述 reload/reconcile/retry 语义，不能继续将冲突退化为通用提示。

现有 publish throttle 不等同于 draft autosave policy。是否增加 per-user/per-target route throttle 由威胁
模型和流量数据决定；它不是恢复 route 的前置抽象，但 route 必须保留稳定 `429` 错误合同。

## 15. 测试

### Contracts 与 parser

- 每个 action 的成功与失败 fixture；
- action/payload 不能串用；
- unknown action/format fail closed；
- command id、Article revision / Docs or Comment expectedVersion、target 和 payload 边界；
- action 到 type/scope 的完整映射。

### Publisher

- Plate 与 Markdown golden fixtures；
- Markdown diagnostics 透传；
- canonical JSON、HTML、Markdown、TOC、digest 和 hash 的确定性；
- doc/article/comment 的节点、深度、尺寸与媒体规则；
- BodyBag 不含调用端注入的派生字段。

### Host route 与 adapter

- 未认证请求返回 JSON `401` 且不调用 Publisher；
- Content-Type、invalid JSON、oversized body；
- explicit action 到 code-generated mutation；
- user proof 与 service credential 分离；
- BodyBag 不返回调用端；
- Article `revision` 或 Docs/Comment `expectedVersion` 与业务 payload 原样传递；
- HTML/invalid upstream response 返回稳定错误。
- Publisher validation 的 status/code/diagnostics 不被改写为 `502`；
- 多 GraphQL errors 按 `403 -> 429 -> 409 -> 422` 稳定归类；
- GraphQL error envelope 和 bare HTTP `429` 都保留 `Retry-After`；
- content-publish ErrorCat 生成合同通过 freshness check。

### Phoenix

- 正确 service capability 和用户权限同时存在时成功；
- service capability 正确但用户无权时拒绝；
- 用户有权但 scope 缺失/错误时拒绝；
- scope 不能跨 doc/article/comment 使用；
- Docs 相同 command id 恢复相同 Confirmation；
- 相同 command id、不同 intent 冲突；
- Comment BodyBag cast、version conflict 与事务回滚；
- Comment body 和业务 effects 不会部分提交。

### E2E

- Dash publish route ownership：未认证请求返回 JSON 而不是页面 HTML；
- `/home/doc/editor` autosave 成功、重放安全和版本冲突可见；
- `/home/doc/editor` 在 `429` 冷却期合并编辑并于到期后保存最新 draft；
- Article `createArticle` / `saveWorkingCopy` / `forkSnapshot` / `publishArticle` /
  `createAndPublishArticle` / `deleteWorkingCopy` 的最小成功链路；
- Comment create/update/reply 最小成功链路；
- Agent Markdown 与 Web Plate 生成相同 canonical BodyBag。

## 16. 实施顺序

### Batch 0：合同和生成基础

- const 化 format/action/type；
- 在 `packages/contracts` 定义 typed commands；
- 在 `packages/route-contract` 定义 route；
- action-specific runtime parsers；
- 冻结符合 Auth registry taxonomy 的 capability scope 常量；
- 将 `@groupher/artiment-publisher` 直接改名为 `@groupher/content-publisher`，迁移 Content Import、
  tests、workspace 和 lockfile 的全部引用，不保留 alias/re-export；
- 交付 Node 可用的 generated operations 入口，至少包含 `update_doc_draft`；
- server build/import compatibility test、generated freshness CI 和 type-check。

### Batch 1：Docs 端到端恢复

- 在 Batch 0 已改名的共享 package 中完成最小 Publisher 实现；
- Dash route、handler 和固定 `updateDocDraft` adapter；
- Publisher service resource/client/scope；
- Phoenix mutation-specific `BodyBagTrust`；
- DocDraft query/result/restore/update 从 `document` direct cutover 到 `body`，同步更新 generated types 和
  编辑器消费路径，不保留双字段；
- `doc_branch_version_content.documentJson` 及 Revision Drawer/diff/restore 消费路径同批迁移到
  `body.json`，不保留 alias；
- 在 `useDraftAutoSave.ts` 实现 structured error 与 version conflict reload/reconcile handling；
- route、adapter、Receipt recovery 和 `/home/doc/editor` E2E。
- Doc Draft mock 使用按测试重置的 success/conflict/rate-limit 场景和 command receipt，测试不得依赖
  全局调用顺序；

### Batch 2：Markdown source

- 复用 `deserializeMarkdown`；
- 增加显式 Markdown source branch；
- golden fixtures 和 diagnostics tests；
- 不引入 adapter registry。

### Article WorkingCopy / Snapshot

- `createArticle` 创建 Article 和默认 WorkingCopy；
- `saveWorkingCopy` 使用当前 `revision` 保存正文、title/tag 等内容，正文与 metadata、tag、CoverEdit、Asset refs 原子提交；
- Article Asset 只保存 WorkingCopy / Snapshot 对既有 Asset ID 的 owner 引用；patch 省略附件字段时保留现有引用，`assetRefs: []` 明确清空，清理 `coverEdit` 只移除该画布产生的引用；
- `createAndPublishArticle` 由单一 command 创建并首发；
- `forkSnapshot` 返回独立的 `workingCopy`，同一 command 重试返回原副本；
- `publishArticle` 从指定 WorkingCopy 或已有 Snapshot 选择公开内容；
- `deleteWorkingCopy` 不接收 `revision`；
- 过期 revision 冲突返回 Article WorkingCopy revision ErrorCat；
- Article capability scope；
- Article 与公开 Doc read projection 从 `document` 到 `body` direct cutover，不保留双字段。

对外 GraphQL mutation 字段只有基座合同中的六个名字。Editor 的 GraphQL 操作文档位于
`frontend/core/unit/ArticleEditor/schema.ts`；operation label 与字段动作一致（例如
`SaveWorkingCopy` 文档调用 GraphQL 字段 `saveWorkingCopy`）。
Content Publisher HTTP action 是另一层传输合同，不作为 GraphQL mutation 名或 CMS facade 名：

| GraphQL mutation          | 行为                                                                      | 结果                                       |
| ------------------------- | ------------------------------------------------------------------------- | ------------------------------------------ |
| `createArticle`           | 创建 Article 和默认 WorkingCopy                                           | `ArticleWorkingCopy`                       |
| `saveWorkingCopy`         | 用客户端当前 `revision` 保存指定 WorkingCopy；成功返回推进后的 `revision` | `ArticleWorkingCopy`                       |
| `forkSnapshot`            | 从 Snapshot 创建独立 WorkingCopy                                          | `ArticleWorkingCopyResult { workingCopy }` |
| `publishArticle`          | 发布指定 WorkingCopy revision，或选择已有 Snapshot                        | `ArticlePublicSnapshot`                    |
| `createAndPublishArticle` | 在一个命令和事务中创建并首发                                              | `ArticlePublicSnapshot`                    |
| `deleteWorkingCopy`       | 删除可放弃的 WorkingCopy                                                  | `DoneState`；不接收 `revision`             |

`revision` 只指 `ArticleWorkingCopy.revision` 并发序号。`saveWorkingCopy` 必须提交它；后端成功保存后推进，过期值映射为 Article WorkingCopy revision conflict。它不表示旧 `ArticleRevision` 实体。`forkSnapshot` 的 mutation 响应必须选择 `workingCopy` 字段；Receipt 重放也重建同一个副本。

Article 存储在 R2 / R3 改为独占 ArticleBody 和独立 ArticlePublicBody；可信 BodyBag 生成、HTTP action 和 GraphQL 字段不因此分叉。公开选择在同一事务复制完整正文并更新 Public，读取不重新生成格式。当前实现和隔离验收见 [R3 记录](../migrations/article-public-body-r3.md)，不代表目标环境已切换。

### Batch 4：Comment

- `CommentBody` schema/table 与 full BodyBag persistence；
- create/update/reply BodyBag mutations；
- expected body version；
- Comment capability scope；
- 删除 `Comments.BodyCodec` 和旧 body columns；
- GraphQL `body: ArtimentBody`；
- 经产品确认后清理旧数据；不增加兼容、backfill、双读、双写或 fallback。若存在必须保留的数据，
  阻断发布并重新决策，而不是加入临时兼容层。

### Batch 5：Agent/API actor

- 复用 delegated actor 和现有 authorization header；
- Markdown-friendly command input；
- 独立 service client grants；
- actor/service/action/target/command id 审计；
- 配额与撤销策略。

每个 PR 都必须完成本批次对应 codegen、type-check、contract、backend 和集成测试；不能将 codegen
作为 PR 合并后的补做事项。

### 16.1 Agent/API actor 运维策略

- service client grant 只由 Auth 的 `SERVICE_AUTH_CLIENTS_JSON` 管理；撤销时删除 client 或对应
  `content:*:write` scope，不在 Phoenix 增加 subject 清单；
- client-credentials token 保持短时有效（当前上限 600 秒），撤销后的最坏暴露窗口不超过现存 token
  TTL；
- Auth token endpoint 的既有限流是 service credential 兑换配额权威，Publisher 不复制第二套计数器；
- Phoenix 业务 mutation 继续使用现有 publish throttle；Node route 将上游 `429` 和 `Retry-After`
  原样映射为稳定的 `rate_limited` 错误，调用端不得无界重试；
- 审计日志只记录 actor 类型、service client、action、target 和 command id，不记录正文、用户 token
  或 service credential。

## 17. 明确非目标

- 不建立动态 command bus；
- 不建立 adapter、rule 或 handler registry；
- 不把 content type 写入 BodyBag；
- 不在 Phoenix 建第二份 subject registry；
- 不让浏览器接触 BodyBag 或 service credential；
- 不在 Phoenix 重写 Node serializer；
- 不建立 Comment 历史兼容、backfill 或双读取；
- 不通过 alias、re-export、双字段、双写或 fallback 保留任何旧 Publisher/Body contract；
- 不在当前阶段实现 Comment server draft/snapshot；
- 不预建通用 Draft framework；
- 不引入新的 runtime validation 框架；
- 不将 GraphQL codegen 推迟到 PR 之后。

## 18. 验收标准

- Web、Content Import 与 Agent 使用同一 Publisher 生成权威；
- Plate 与 Markdown 归一化为同一 canonical BodyBag；
- Docs、Article、Comment 写入均使用 BodyBag；
- 调用端一次提交 source 与 payload，且不能选择 type、scope 或 mutation；
- Gate 与 service capability 各自保持单一职责；
- BodyBagTrust 使用 mutation-specific capability scope；
- Docs 继续使用现有 CMS.Command Receipt/Confirmation；
- Comment 使用独立、versioned `CommentBody` 并保留未来增加 Draft 的低成本路径；
- GraphQL 查询统一使用 `body: ArtimentBody`；
- 旧 Publisher package、`document` 正文字段和旧 Comment body 路径均无兼容层；
- Node-to-Phoenix operations 在 PR 前完成 codegen 和 freshness validation；
- 聚焦 unit、contract、Phoenix、type-check 和 E2E 测试通过。
