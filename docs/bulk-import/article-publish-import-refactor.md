# Article Publish / Import 重构方案

> 状态：Phase 1 代码与格式转换测试已完成，待完整依赖/线上部署 smoke；Phase 2、Phase 3、Phase 4 已完成；Phase 5 为满足拆分条件后的独立演进项
>
> 范围：单文档导入、Article 正文发布链路、Elixir 内容转换清理
>
> Source of truth：本文负责共享 Import Content、Rich Editor codec、artiment-publisher 和 BodyBag。批量/多来源编排以 [`content-import-architecture.md`](./content-import-architecture.md) 为准；GitHub Docs 产品流程以 [`bulk-import.md`](./bulk-import.md) 为准；Files SDK/staging 以 [`import-file-sdk.md`](./import-file-sdk.md) 为准；实施清单以 [`content-import-refactor-plan.md`](./content-import-refactor-plan.md) 为准；联调错误和恢复边界见 [`import-error-handling.md`](./import-error-handling.md)。
>
> 更新：2026-07-22（补充 Content Import 复用边界）

## 实施状态总览

| Phase                                 | 状态     | 结论                                                                                                                               |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Phase 1：`document-converter`         | 部分完成 | 实现、本地格式转换与 HTTP contract 测试已完成；Vercel 实际部署和线上 smoke 未执行                                                  |
| Phase 2：DSB `artiment-publisher`     | 已完成   | Node codec、BodyBag、sanitize、Docs Draft Route Handler、单文档 import 与 Editor 初始化已落地                                      |
| Phase 3：GraphQL/Article 单向切换     | 已完成   | 后端 Article mutation、Draft、Snapshot、Publish、Restore、Preview 全部使用 BodyBag；DSB HTTP transport 当前仅接入 `updateDocDraft` |
| Phase 4：Elixir parser/converter 清理 | 已完成   | 旧 converter、`ContentPipeline`、`MarkdownNormalizer`、Earmark 已删除；Comment/Mention 边界已拆分                                  |
| Phase 5：独立拆分 publisher           | 后续演进 | 当前不阻塞本轮完成；满足拆分条件后再迁出 DSB                                                                                       |

当前结论：Article/共享 Import Content 重构已经完成；唯一未闭环的是 Phase 1 的外部部署验证。2026-07-16 完成本计划时，Docs/Changelog 批量正文导入仍为 `deferred`；目前 GitHub Docs 已复用共享 Node codec/publisher，并完成 Files SDK Preview、PostgreSQL BodyBag staging 与原子 apply 的本地切换，Changelog 仍未接线。批量编排的当前状态以 [`bulk-import.md`](./bulk-import.md) 为准。

边界澄清：`document-converter` 的部署状态只影响 PDF、DOCX、PPTX、XLSX、HTML 等“外部文件 → Markdown”来源。GitHub Repo 中已经是 Markdown/MDX 的 Docs 直接进入共享 Import Content codec/publisher，不调用 `document-converter`；因此 Phase 1 的 Vercel 部署与 smoke 不是 GitHub Docs Bulk Import 的 release blocker。

## 一、结论

这次重构建立两个可独立演进的服务边界，并把 Elixir 从 Markdown/Plate 格式转换链路中移出：

1. `document-converter`
   - 输入 PDF、DOCX、PPTX、XLSX、HTML 等单个外部文档。
   - 使用 Microsoft MarkItDown 转换为 Markdown。
   - Markdown 返回前端，由前端初始化或更新 Plate Editor。
   - 现在就作为独立 Python 子项目开发、测试和部署。
2. `artiment-publisher`
   - 输入 Plate JSON。
   - 在 Node.js 中使用与 Plate Editor 一致的插件和 serializer，生成 JSON、Markdown、HTML、TOC、纯文本等正文派生数据。
   - HTML 在 Node 端完成最终 sanitize。
   - 调用 Elixir GraphQL，由 Elixir 完成权限、业务规则、事务和持久化。
   - 第一阶段作为 Dashboard（DSB）内的 Node Route Handler 实现，边界稳定后再拆成独立项目。

最终正文链路：

```text
外部文档
   |
   v
document-converter (Python / MarkItDown)
   |
   | Markdown
   v
DSB Node import adapter
   |
   | @groupher/rich-editor MarkdownKit: Markdown -> Plate JSON
   v
DSB Browser / Plate Editor
   |
   | Plate JSON
   v
artiment-publisher (DSB Node.js)
   |
   | TArtimentBodyBag
   v
Elixir GraphQL
   |
   v
Article Draft / ArticleDocument / Snapshot / Publish
```

核心边界是：

- `document-converter` 只解决“外部文档 → Markdown”。
- DSB 负责编辑状态和“Markdown → Plate JSON”；第一版由 DSB Node import adapter 调用与浏览器 Editor 同包发布的 MarkdownKit codec，浏览器只接收 Plate value。
- `artiment-publisher` 负责“Plate JSON → 可持久化的正文格式集合”。
- Elixir 不再模拟 Plate，也不再负责 Markdown parser/serializer。

### 1.1 2026-07-15 实施基线

开始实现时确认到的仓库状态：

- `services/document-converter` 已有 FastAPI/Vercel 骨架，但 `/convert` 仍是空响应。
- `@groupher/rich-editor@0.0.19` 已导出带 types 的 Node-safe `./node` entrypoint，包含校验、
  canonicalization、Markdown/HTML serializer、TOC 和 plain text extractor。
- 根 workspace 仍同时存在旧 Plate 49 和 Plate 53；`artiment-publisher` 不直接导入根 Plate，
  只通过 `@groupher/rich-editor/node` 使用与浏览器 Editor 同包发布的 Plate 53 codec。
- 当前工作区还有独立的 Docs cover/pinned-docs 未提交改动，覆盖了 `articles/publish.ex`、
  `article_document.ex` 和 `content_import/markdown_normalizer.ex`；Article cutover 实施时必须保留这些改动。

因此实施顺序进一步收紧为：

1. 先完成并本地验证 `document-converter`，不依赖 Article/Editor 链路。
2. 使用 `@groupher/rich-editor/node` 建立 Node-safe codec 边界，DSB publisher 不直接组装 Plate plugins。
3. Node codec 与 consumer golden fixtures 通过后，建立 DSB Route Handler。
4. Route Handler 与 BodyBag contract 稳定后再做 GraphQL/Elixir 单向 cutover，避免提前引入不可用的 `bodyBag` 写入链路。

---

## 二、范围与非目标

### 2.1 本轮范围

1. 完善独立的 `services/document-converter` 子项目。
2. 在本地用真实文档验证 MarkItDown 转换质量。
3. 把 `document-converter` 独立部署到 Vercel Python Runtime。
4. 在 DSB 内建立 `artiment-publisher` 的 Node-only 实现和 Route Handler。
5. 定义 `TArtimentBodyBag` 以及对应的 Elixir GraphQL input contract。
6. 将 Article create/update/draft 保存链路从 raw Plate `body` 切换为 `bodyBag`。
7. 删除 Article 链路中已经被 Node publisher 取代的 Elixir converter/parser。
8. 清理无生产调用者的旧 Editor.js/Markdown converter 和 Earmark 依赖。

### 2.2 暂不处理

- Docs 批量导入。
- 仓库、ZIP、文档站点批量生成多篇 Markdown。
- 在浏览器中批量创建 Plate Editor 并逐篇转换。
- 第一阶段把 `artiment-publisher` 部署成独立服务。
- 高保真排版还原。
- 扫描 PDF、复杂表格等场景的 Azure Content Understanding 集成。
- Comment 正文链路的立即迁移。

### 2.3 非目标

- `document-converter` 不解析 Plate JSON。
- `document-converter` 不调用 Groupher GraphQL，不知道 Community、Thread、Article 或 Draft。
- `artiment-publisher` 不直接访问 Groupher 数据库。
- Elixir 不再次生成 Markdown/HTML 来和 Node 结果做双写或 fallback。

该正文链同时是 Content Import 的唯一单 item 转换能力。编辑器单篇 Import Content、GitHub Docs Bulk Import 和后续单篇来源同步共享 `Markdown/MDX → Plate JSON → TArtimentBodyBag`；它们只在 Dataset、Review、Job 数量和最终事务范围上不同，不能分别实现 converter/publisher。

- 不长期同时支持旧 `body` 和新 `bodyBag` 两条 Article 正文写入链路。
- 不为了部署使用 Vercel Services、Service Binding 或其他 Vercel 专属服务通信能力。

---

## 三、启动时实现盘点（历史基线）

### 3.1 启动时 Article 正文保存链路

启动时 Elixir 以 Plate JSON 字符串作为 `body`，再通过 `Helper.ContentPipeline` 派生持久化内容：

```text
GraphQL body: String
   |
   v
Articles.Draft.create/update
   |
   v
Helper.ContentPipeline.parse
   |-- Jason.decode Plate JSON
   |-- Helper.Converter.Content.Plate
   |-- Markdown
   |-- Markdown TOC
   |-- HTML
   |-- XML
   |-- RSS HTML
   |-- plain_text / digest
   |-- content_hash
   `-- mentions
   |
   v
Helper.ArticlePayload
   |
   v
Articles.Document
   |
   v
article_documents
```

相关模块：

- `backend/main/lib/helper/content_pipeline.ex`
- `backend/main/lib/helper/article_payload.ex`
- `backend/main/lib/helper/converter/content.ex`
- `backend/main/lib/helper/converter/content/plate.ex`
- `backend/main/lib/groupher_server/cms/articles/draft.ex`
- `backend/main/lib/groupher_server/cms/articles/document.ex`
- `backend/main/lib/groupher_server/cms/model/article_document.ex`

问题不是 Elixir 无法遍历 JSON，而是这里手写了一套 Plate serializer。它必然落后于浏览器端真实的 Plate 插件、节点结构和序列化规则。

### 3.2 启动时 Markdown import 链路

`CMS.ContentImport.MarkdownNormalizer` 当时使用 Earmark：

```text
Markdown / MDX
   |
   v
Earmark.Parser.as_ast
   |
   v
手写 Markdown AST -> Plate AST
   |
   v
ContentPipeline.parse
```

它当时被 Docs 和 Changelog ContentImport 复用。Phase 4 已删除该实现；批量导入正文在接入外部 converter 和 Node Plate codec 前保持 `deferred`。

### 3.3 当时不能直接整体删除 `ContentPipeline`

启动时 `ContentPipeline` 还有非 Article 调用者：

- `CMS.Comments.Write` 用它生成 Comment 的 `body_html` 和 solution digest。
- `CMS.ArtimentMentions` 使用 `ContentPipeline.decode/1` 解码 Plate JSON。
- Docs/Changelog ContentImport 的 `MarkdownNormalizer` 依赖它生成 hash/plain text。

因此 Phase 4 先拆清职责，再完成删除：

1. **删除 Elixir Markdown parser 和 Article serializer。**
2. **删除整个 `ContentPipeline` 模块。**

最终 Comment 改用临时最小 `CMS.Comments.BodyCodec`，Mention 改用 `CMS.Artiment.PlateJSON`，整个 `ContentPipeline` 已删除。

### 3.4 已确认的旧实现

- `Helper.Converter.MdToEditor` 是 Earmark → Editor.js 的旧 converter，当前只有测试调用。
- `helper/converter/editor_to_md.ex` 是空文件。
- `Helper.Converter.Article` 和 `Helper.Converter.EditorToHTML` 是旧 Editor.js 链路；删除前需做最后一次调用审计，但不应继续作为 Plate 方案的一部分。
- `:earmark` 当前主要服务 `MdToEditor` 和 `ContentImport.MarkdownNormalizer`。
- `ArticleDocument.xml` / `rss` 当前没有明确正文消费方；是否删除字段需要在 migration 前做一次 API/Feed 消费审计，不默认把它们纳入新 contract。

---

## 四、目标项目边界

### 4.1 `document-converter`

物理位置：

```text
services/document-converter/
├── app.py
├── contracts.py
├── conversion.py
├── settings.py
├── pyproject.toml
├── vercel.json
├── README.md
├── tests/
└── fixtures/
```

部署形态：独立 Vercel Python 项目，Root Directory 指向 `services/document-converter`。

职责：

- 接收单个文档文件。
- 验证文件名、MIME、扩展名、大小和允许的来源。
- 使用 MarkItDown 将文档转换为 Markdown。
- 返回 Markdown、来源 metadata 和 diagnostics。
- 不保存 Groupher Article。
- 不初始化 Plate Editor。
- 不调用 Elixir。
- 不接收远程 URL，也不抓取任意网页；HTML 第一版和其他格式一样，只接受用户上传的本地文件。

第一阶段接口：

```http
POST /convert
Content-Type: multipart/form-data
```

建议响应：

```ts
type TDocumentConversionResult = {
  markdown: string
  source: {
    filename: string
    mimeType: string
    sizeBytes: number
  }
  diagnostics: Array<{
    level: 'warning' | 'error'
    code: string
    message: string
  }>
}
```

第一阶段只安装需要的 MarkItDown extras，避免使用 `[all]`：

```toml
"markitdown[pdf,docx,pptx,xlsx]"
```

本地与部署环境统一使用 Python 3.12。系统 Python 版本不能代替目标 runtime 验证。

### 4.2 `artiment-publisher`

第一阶段物理位置：DSB 内部。

```text
frontend/dashboard/src/
├── app/api/artiment/publish/route.ts
└── lib/artiment-publisher/
    ├── index.ts
    ├── editor.ts
    ├── serialize.ts
    ├── sanitize.ts
    ├── hash.ts
    ├── validate.ts
    ├── graphql.ts
    └── types.ts
```

`route.ts` 只负责 HTTP、认证上下文、错误映射和调用核心模块。Plate 初始化、serializer、sanitize 和 GraphQL client 不应全部写进 Route Handler。

Route Handler 必须运行在 Node runtime，不能使用 Edge runtime，因为 Plate server serializer、
React server render、`node:crypto` 和 HTML sanitizer 不应建立在 Edge 兼容假设上。

当前 Dashboard 使用 Next.js 16 `cacheComponents`，显式导出 `runtime = 'nodejs'` 会导致构建失败；
App Route 保持默认 Node runtime，并通过 Node-only imports 固化这个边界，不增加 `runtime` route config。

核心实现必须避免依赖 Next.js request/response 类型，保证后续可以移动到：

```text
services/artiment-publisher/
```

后续独立部署时，只替换 HTTP adapter 和配置加载，不重写 serializer。

---

## 五、`TArtimentBodyBag`

`TArtimentBodyBag` 是 `artiment-publisher` 交给 Elixir 的正文格式集合。它不是数据库模型，也不包含 Article title、Community、Thread、作者或发布状态。

### 5.1 Hash 讨论背景

原方案把 BodyBag 中的正文 hash 和 Snapshot 中的版本 hash 都称为 `contentHash`，并一度描述为由 Node publisher 统一生成。这会混淆两个不同问题：

- publisher 只理解 Plate 正文，不知道 title、subtitle、slug 和其他 Article versioned fields；
- Snapshot 在正文保存之后由 Elixir 创建，后续 Snapshot 对比也不经过 publisher。

因此目标模型明确拆成两层：

- `bodyHash`：正文 hash，由 Node `artiment-publisher` 生成。
- `versionHash`：完整 Article 版本 hash，由 Elixir 生成。

两者的关系：

```text
Plate JSON
   |
   v
artiment-publisher
   |
   `-- bodyHash
          |
          v
Elixir: bodyHash + title + digest + slug + subtitle + versioned relations
          |
          `-- versionHash
```

`bodyHash` 随 BodyBag 保存。`versionHash` 不属于 BodyBag，只在 Elixir 创建 Snapshot 或比较当前 Draft 与 Snapshot 时生成。

Snapshot 对比不调用 publisher：

- Snapshot 与 Snapshot：比较已经持久化的 `versionHash`。
- 当前 Draft 与 Snapshot：Elixir 使用 Draft 已保存的 `bodyHash` 和当前 versioned fields 计算 `versionHash` 后比较。
- 只修改 title、slug、subtitle 等 metadata 时不经过 publisher，但会生成不同的 `versionHash`。

目标字段语义：

```text
ArticleDocument / Article (Draft/Public): body_hash
ArticleSnapshot:                          version_hash
```

当前同名 `content_hash` 字段在切换时直接按上述语义重命名；本次不兼容旧 hash，也不做 backfill。

### 5.2 BodyBag contract

第一版 contract：

```ts
type TArtimentTocItem = {
  id: string
  title: string
  level: number
}

type TArtimentBodyBag = {
  json: string
  markdown: string
  html: string
  toc: TArtimentTocItem[]
  plainText: string
  digest: string
  bodyHash: string
  schemaVersion: number
}
```

字段约定：

- `json`：稳定 key 顺序的 Plate JSON 字符串，是正文真相源；保留 `id/_id` 供编辑器节点身份和 diff 使用。
- `markdown`：由 Plate Markdown serializer 生成。
- `html`：由 Plate static serializer 生成，并完成最终 sanitize。
- `toc`：从真实 heading nodes 生成，不从 Markdown 二次解析。
- `plainText`：用于审核、搜索和摘要 fallback。
- `digest`：取 `plainText` 的前 150 个 grapheme clusters，避免截断 emoji/surrogate pair。
- `bodyHash`：对 `JSON.stringify(canonicalizeValue(value))` 计算 SHA-256，输出 64 位小写 hex；
  `canonicalizeValue` 排序 object keys 并移除 `id/_id`，因此临时节点身份不改变正文 hash。
  Node 是它的唯一生成者，Elixir 只校验格式并持久化。
- `schemaVersion`：BodyBag/Plate schema 版本，不使用 npm package version 代替。

`schemaVersion` 当前版本为 `2`。publisher 只生成当前 v2；Elixir 接受 v1/v2，以兼容仍保存在数据库中的 v1 `ArticleDocument`，未知版本直接拒绝。新 publisher 不再生成 v1；Plate/BodyBag 出现下一次破坏性结构变化时再 bump，并同步更新版本兼容与迁移策略。

以下字段不放进第一版 BodyBag：

- `xml`：当前没有明确消费方。
- `rss`：如果 RSS 需要全文，优先在 RSS 输出边界消费 sanitized HTML，而不是再持久化一份重复 HTML。
- `mentions`：Mention 是 Groupher 领域关系；Node 可以提取候选值，但最终身份解析、权限和关系同步仍属于 Elixir。
- `assets`：继续使用独立的 Article asset input/association，不塞进正文格式集合。

---

## 六、Plate server codec 约束

### 6.1 浏览器与 Node 必须使用同一规则

`artiment-publisher` 不能重新手写 Plate JSON 遍历器。它必须使用与编辑器一致的：

- Plate 版本。
- 插件集合。
- node type。
- mark 配置。
- Markdown serializer 配置。
- HTML static renderer。

目标边界由 `@groupher/rich-editor` 暴露 Node-safe `./node` entrypoint；如果未来该入口无法继续避免浏览器/React client 依赖，再抽出纯 Node/browser 共享的 codec package。

当前仓库同时存在不同 Plate package major/minor 组合，实施前必须先统一版本，不能让 DSB publisher 和实际 Editor 使用不同 schema。

当前 `0.0.19` 已提供下列 Node package contract：

```text
@groupher/rich-editor/node
├── RICH_EDITOR_SCHEMA_VERSION
├── createNodeEditor
├── validateValue
├── serializeMarkdown
├── serializeHtmlUnsafe
├── extractToc
├── extractPlainText
└── canonicalizeValue
```

该 entrypoint 不得导入 DOM API、client hooks、floating UI、toolbar、emoji picker 或编辑器样式；
DSB 通过 package subpath 直接导入具体能力，避免加载浏览器 barrel。

`0.0.19` 的 browser EditorKit 已包含 `MarkdownKit`，但 package root 没有单独导出
`deserializeMarkdown()`，RichEditor component 也没有暴露内部 editor instance。第一版导入因此不把
`./node` entrypoint 打进浏览器 bundle，而是在受认证的 `POST /api/artiment/import` 中调用：

```ts
createNodeEditor().api.markdown.deserialize(markdown)
```

该 Route Handler 只把上传文件转发到部署时配置的 `DOCUMENT_CONVERTER_URL`，不接受用户传入 converter URL
或网页 URL；因此这里没有开放式 server-side fetch/SSRF 入口。返回的 Plate value 经过与 publisher 相同的
大小、节点数、深度和 schema 校验后再交给浏览器 Editor。

### 6.2 HTML sanitize 顺序

安全顺序必须是：

```text
Plate JSON validation
   |
   v
Plate static HTML serialization
   |
   v
final HTML sanitization
   |
   v
TArtimentBodyBag.html
```

sanitize 必须发生在最终 HTML 生成之后。不能只依赖 Plate text escaping，也不能把未 sanitize 的 HTML 发送到 Elixir 后再默认信任。

### 6.3 Unknown node 策略

默认策略：拒绝未知或未注册节点，并返回结构化 diagnostic；不能静默丢失正文。

只有明确标记为可降级的节点才允许转换为 plain text fallback。

---

## 七、GraphQL 与 Elixir 目标边界

### 7.1 GraphQL input

后端增加可复用 input：

```graphql
input ArtimentTocItemInput {
  id: String!
  level: Int!
  title: String!
}

input ArtimentBodyBagInput {
  json: String!
  markdown: String!
  html: String!
  toc: [ArtimentTocItemInput!]!
  plainText: String!
  digest: String!
  bodyHash: String!
  schemaVersion: Int!
}
```

Article create/draft update/update mutation从：

```text
body: String
```

切换为：

```text
bodyBag: ArtimentBodyBagInput
```

约束：

- 创建 Article/Draft 时 `bodyBag` 必填。
- 只更新 title、cover、tags 等 metadata 时 `bodyBag` 可不传。
- 正文更新时必须传完整 BodyBag，不做 partial derived-field update。
- cutover 完成后删除旧 raw `body` 参数，不保留长期 fallback。

### 7.2 服务认证与用户授权

`artiment-publisher` 是派生字段的可信生成者，但用户权限仍由 Elixir 决定。

调用 GraphQL 时需要同时携带：

1. publisher 的内部服务证明，用于确认 BodyBag 来自受控 serializer；
2. 当前用户身份/会话，用于 Elixir 执行 Community、Thread、Article 权限检查和审计。

内部服务证明应采用平台无关的 HTTP header/HMAC/shared secret，不使用 Vercel Service Binding。

### 7.3 Elixir 保留的校验

Elixir 不再重新生成 Markdown/HTML，但仍保留低成本信任边界校验：

- BodyBag 必填字段和类型。
- 每个字段的最大长度。
- `schemaVersion` 是否受支持。
- `json` 能否 decode，根节点是否为 list。
- Plate node 总数、最大深度和总体 body 大小上限。
- `bodyHash` 格式；Elixir 不重新执行 Plate canonicalization。
- Article/Comment 的业务最小长度。
- 用户权限、发布节流、生命周期状态和事务约束。
- asset refs、Mention identity 等领域关系校验。

这些属于输入安全和业务约束，不等于在 Elixir 再实现一次 Plate serializer。

### 7.4 Elixir 持久化

建议增加 `CMS.Artiment.BodyBag` 作为 Elixir 侧 typed contract，替换 Article 写入链路中的 `Helper.ArticlePayload` 生成职责。

```text
GraphQL ArtimentBodyBagInput
   |
   v
CMS.Artiment.BodyBag.cast/validate
   |
   v
Articles.Draft
   |
   v
Articles.Document
   |
   v
article_documents
```

`ArticleDocument` 继续保存正文真相源和必要派生字段。是否删除 `xml/rss` 列应单独 migration，不和 serializer cutover 强绑在同一个提交里。

### 7.5 部署回滚

`schemaVersion` 只负责拒绝不兼容的 BodyBag，不是回滚机制。本次不做双写或数据库回滚；切换失败时同时恢复上一版 DSB 和 Elixir 部署。删除 `xml/rss` 等破坏性 migration 必须放在链路稳定后的独立阶段。

---

## 八、Elixir 清理范围

### 8.1 已直接删除的旧代码

完成 literal caller audit 后已删除：

- 空文件 `helper/converter/editor_to_md.ex`。
- 只有测试使用的 `Helper.Converter.MdToEditor`。
- 对应 `md_to_editor_test.exs`。
- 不再有调用者的旧 Editor.js `Helper.Converter.Article`。
- 不再有调用者的 `Helper.Converter.EditorToHTML` 目录及测试。

### 8.2 Article cutover 后已删除

- `Articles.Draft` 对 `ContentPipeline.parse/1` 的调用。
- `Articles.Document` 的 `body`/`readme` parser overload。
- `Helper.Converter.Content.Plate` 的 Article serializer 职责。
- Article `ContentPipeline` converter tests，替换为 BodyBag validation/persistence tests。

### 8.3 ContentImport 边界

`ContentImport.MarkdownNormalizer` 启动时是 Earmark 和手写 Markdown → Plate 的主要生产实现，Phase 4 已删除：

```text
外部文件 -> document-converter -> Markdown
Markdown -> Node Plate codec -> TArtimentBodyBag
TArtimentBodyBag -> ContentImport apply / GraphQL
```

GitHub Docs Bulk Import 直接复用上述 Node codec/publisher：Node 从 `DocsDataset` 读取 selected Markdown/MDX，对每个 item 调用同一个 Import Content server function，再把 BodyBag 有界分批发送给 Phoenix。不能在 `threads/docs` 或 Bulk workflow 下新增第二套 Markdown/BodyBag converter，也不应通过 HTTP 调用 Dashboard 自己的 `/api/artiment/import`。

Content Import 的 Phoenix Snapshot/Preparation/Plan/PayloadStore 不再是目标基础设施；最新边界见 [`content-import-architecture.md`](./content-import-architecture.md) 和 [`content-import-refactor-plan.md`](./content-import-refactor-plan.md) 第零章。

### 8.4 Comment 与 Mention

Comment 暂不迁移，因此 Article cutover 后采用以下边界：

- `CMS.Comments.Write` 已临时改用缩小后的 `CMS.Comments.BodyCodec`。
- 不应为了 Comment 保留 Article Markdown、TOC、XML、RSS 生成逻辑。
- Mention 已改用最小的 `CMS.Artiment.PlateJSON` JSON decode/shape validator。
- `artiment-publisher` 稳定后可作为 Comment 的第二个 consumer，再删除剩余 Comment converter。

### 8.5 Earmark 依赖删除

本轮从 `mix.exs` 删除 `:earmark`：

- `MdToEditor` 已删除。
- `ContentImport.MarkdownNormalizer` 已删除。
- `rg` 确认 `backend/main/lib` 和 `backend/main/test` 无 Earmark 调用。
- `mix deps.unlock earmark` 后 compile/test 通过。

---

## 九、实施阶段

### Phase 1：独立完善 `document-converter`（部分完成）

1. 在 `pyproject.toml` 增加 MarkItDown 的必要 extras。
2. 实现 multipart 单文件 `/convert`。
3. 使用受控临时文件或 stream，转换结束后清理。
4. 添加 DOCX/PDF/PPTX/XLSX fixtures 和转换测试。
5. 增加文件格式、大小、路径和异常 diagnostic。
6. 本地 Python 3.12 验证。
7. 部署独立 Vercel 项目并做 `/health`、`/convert` smoke test。

当前进度（2026-07-15）：

- 已实现 multipart 单文件上传、MarkItDown `convert_stream()`、结构化 diagnostics。
- 已实现文件名、扩展名、MIME、真实流大小、PDF/OOXML 内容、OOXML 解压上限和 Origin 校验。
- Python 3.12 下的 DOCX/PDF/PPTX/XLSX/HTML converter 与 HTTP contract 测试已通过。
- 完整生产依赖安装、Vercel 部署和线上 smoke test 尚未执行。

### Phase 2：在 DSB 建立 `artiment-publisher`（已完成）

1. 为 `@groupher/rich-editor` 增加 Node-safe server subpath，或抽出共享 codec package。
2. 统一 DSB、browser editor 和 Plate server codec 版本。
3. 用 browser/Node golden fixtures 证明相同 Plate value 得到一致 schema 与派生结果。
4. 验证 Node 环境可创建 server editor。
5. 实现 Plate JSON validation。
6. 实现 Markdown、HTML、TOC、plain text、digest 和 `bodyHash` serializer。
7. 增加最终 HTML sanitizer。
8. 定义并测试 `TArtimentBodyBag`。
9. 建立 Node Route Handler，但暂不切换生产 GraphQL mutation。

当前进度（2026-07-16）：

- Groupher 已升级到 `@groupher/rich-editor@0.0.19`，纯 Node import、server editor、MarkdownKit deserialize、校验和全部导出能力 smoke 通过。
- 已实现 `artiment-publisher` 核心：稳定 Plate JSON、Markdown、sanitized HTML、TOC、plain text、digest、`bodyHash` 和 `schemaVersion`。
- 持久化 JSON 保留节点 `id/_id`；`bodyHash` 单独使用 `canonicalizeValue()`，忽略临时身份字段。
- 已实现 2 MiB、20,000 nodes、64 层深度限制，以及未知/transient node 的结构化拒绝。
- 2 MiB 指序列化 Plate value 的未压缩 UTF-8 bytes，是共享 Import Content/publisher 的固定输入上限。Bulk Docs 复用同一 publisher，因此单篇在这里触发 `payload_too_large` 时由 Bulk 编排映射为可展示的 `content_too_large` 并跳过；Bulk 另有 5 MiB canonical BodyBag 和 6 MiB 完整 GraphQL request JSON 上限，详见 [`import-file-sdk.md`](./import-file-sdk.md)。
- 已建立需要 Groupher session 的 `POST /api/artiment/publish`；Phase 2 初始只返回 BodyBag，Phase 3 已扩展为携带用户 token 与 publisher proof 调用 GraphQL。
- 当前 Route Handler 的 action allowlist 仅包含 `updateDocDraft`，服务于 Docs autosave；Post/Blog/Changelog 后端 mutation 已完成 BodyBag cutover，但尚无对应 DSB publisher transport action。
- 15 项 focused tests、Dashboard lint、type-check 和带 mock GraphQL 的 Turbopack production build 通过。
- 已建立需要 Groupher session 的 `POST /api/artiment/import`：只向环境变量配置的 converter 转发单文件，
  再用同包 MarkdownKit 生成并校验 Plate value。
- Docs `/dashboard/doc/import` 已从占位页切换为上传与可编辑预览；Article Snackbar 也支持选择单文件、
  确认替换当前正文，并进入既有 draft 自动保存链路。
- table/code-block plugins 暂未加入 Editor；转换结果出现这些未知节点时返回结构化 `422`，不静默丢内容，
  后续补插件即可解除限制。

### Phase 3：GraphQL/Article 单向切换（已完成）

1. 增加 Elixir `BodyBag` contract 和 GraphQL input。
2. DSB 保存动作改走 `artiment-publisher` Route Handler。
3. publisher 生成 BodyBag 后调用 Elixir GraphQL。
4. Article Draft create/update 改为直接持久化 BodyBag。
5. Elixir 使用 `bodyHash + versioned fields` 生成并持久化 `versionHash`。
6. 验证 publish、snapshot、restore、preview branch、move-to-draft 链路。
7. 删除 Article mutation 的 raw `body` 参数，不保留双写。

当前进度（2026-07-16）：

- 已增加 `CMS.Artiment.BodyBag` typed contract，校验 schema、字段大小、Plate JSON root、节点数、深度和正文长度；Elixir 不重新生成任何派生格式。
- Post、Blog、Changelog、Doc 的 Article mutation 已从 raw `body` 一次性切换到 `bodyBag`；Comment mutation 保持原样。
- DSB Docs autosave 已改走同源 `POST /api/artiment/publish`：Node 生成 BodyBag 后携带当前用户 Bearer token 与通用的 `X-Groupher-Server-Trust` 调用 Elixir GraphQL。
- Next server → Phoenix 的内部信任已统一为 `GROUPHER_SERVER_TRUST_SECRET` / `X-Groupher-Server-Trust`；OAuth 不再把 trust code 放进 GraphQL variables，BodyBag 与 OAuth 共用服务身份凭证、分别保留自己的授权 middleware。
- Phase 3 的“全量切换”指后端 Article/GraphQL contract；当前 DSB HTTP consumer 只覆盖 Docs Draft。未来启用 Post/Blog/Changelog 正文编辑时，应增加显式服务端 action/adapter，不开放浏览器可指定任意 mutation 的通用 GraphQL 代理。
- metadata-only Article update 不要求 publisher proof；任何携带 BodyBag 的 GraphQL mutation 都要求内部服务证明。
- Article 行和 `ArticleDocument` 的正文 hash 已明确为 `bodyHash`，Snapshot 的完整版本 hash 已明确为 `versionHash`，并由单向 migration 完成列名切换。
- Snapshot 保存完整 BodyBag；publish、restore、Preview fork/promote、从 public 创建 draft、move-to-draft 均直接复制 BodyBag，不再重新 parse 正文。
- Phase 4 已移除 Elixir 内部模板与 ContentImport 的 raw-body parser；Docs 默认内容与模板均改为静态的 Node publisher BodyBag。
- 112 项 Article/Docs lifecycle 与 GraphQL focused tests、22 项 DSB publisher/client focused tests、Dashboard/Core type-check 和 Elixir warnings-as-errors compile 通过。

### Phase 4：Elixir parser/converter 清理（已完成）

1. 删除旧 Editor.js converter。
2. 删除 Article 对 `ContentPipeline.parse` 的依赖。
3. 将 Mention 的 JSON decode 从 converter 中拆出。
4. 暂停 Docs/Changelog 正文 apply，删除 `ContentImport.MarkdownNormalizer`。
5. 删除 Earmark 及无调用测试。
6. 审计并决定 `xml/rss` 字段 migration。

完成情况（2026-07-16）：

- Article create/update、默认 Docs Page、模板初始化与 Duplicate Page 均只接收或复制完整 BodyBag，不再调用 Elixir Plate/Markdown parser。
- 已删除 `Helper.ContentPipeline`、`Helper.ArticlePayload`、旧 Editor.js/Markdown converter、相关测试和 Earmark 依赖。
- Mention 的 Plate JSON decode/shape validation 已拆到 `CMS.Artiment.PlateJSON`；Comment 暂由 `CMS.Comments.BodyCodec` 仅承担 JSON/HTML/digest，未扩大为 Article serializer。
- 当时 Docs/Changelog ContentImport 仍保留 Snapshot、Preparation、Plan、Preview、Mapping、Diff、Job 等恢复与编排基础设施；生成的正文 item 为 `deferred`，apply/dry-run 均拒绝。此项是 2026-07-16 的完成记录，不代表当前 GitHub Docs 状态；GitHub Docs 后续已直接接入共享 Node codec/publisher，且不经过 `document-converter`。
- `article_documents.xml/rss` 暂保留 nullable；BodyBag 写入为 `nil`，删除字段的破坏性 migration 延后到独立消费方审计之后。
- Article/DocTree 扩展回归为 `224 tests, 0 failures`；Article GraphQL、Doc Draft 与 Comment 组合回归为 `498 tests, 0 failures`。
- backend 全量为 `1961 tests, 3 failures, 1 excluded`；3 个失败均来自既有 Search 测试继续调用已不存在的 `CMS.Search.article/2`，与本重构路径无关。

### Phase 5：拆出 `artiment-publisher`（后续演进）

满足以下条件后再拆：

- BodyBag contract 稳定。
- Plate plugin/version 固定。
- Node/browser golden fixtures 稳定。
- GraphQL 服务认证方式稳定。
- HTML sanitize 和 XSS 测试稳定。
- DSB Route Handler 已经是薄 transport adapter。

拆出后 DSB 从本地函数调用改为标准 HTTPS 调用，不改变 BodyBag 或 GraphQL contract。

---

## 十、测试与验收

### 10.1 `document-converter`

- DOCX 标题、段落、列表、链接和表格。
- 文本型 PDF。
- 扫描 PDF 的明确 warning/failure，不假装成功。
- PPTX 标题、正文和 notes 的预期行为。
- XLSX sheet/table 的预期行为。
- 不支持格式。
- 超限文件。
- 损坏文件。
- 临时文件清理。
- 本地 CLI/API 输出一致性。
- Vercel `/health` 和小文件 `/convert` smoke test。

### 10.2 `artiment-publisher`

- 每一种已注册 Plate block/inline node 的 golden fixture。
- Browser 与 Node 使用相同 fixture 时输出一致。
- Markdown heading/list/link/inline-code 等当前已注册节点的序列化。
- Table、code block 等尚未注册的节点按 unknown node 拒绝；启用前先进入 Rich Editor persisted schema 和 golden fixtures。
- HTML script、event handler、dangerous URL、raw HTML 的 XSS fixture。
- TOC id/title/level。
- `bodyHash` 忽略编辑器临时 `id/_id`。
- 相同语义内容生成相同 hash。
- unknown node 返回 diagnostic，不静默丢内容。
- 超深/超大 Plate JSON 被拒绝。

### 10.3 Elixir

- create/update Article 直接保存完整 BodyBag。
- metadata-only update 不覆盖正文。
- `ArticleDocument` 字段与输入 BodyBag 一致。
- metadata-only update 不调用 publisher，但会在 Elixir 生成新的 `versionHash`。
- Snapshot 对比只使用 Elixir 生成或持久化的 `versionHash`，不调用 publisher。
- Draft、Publish、Snapshot、Restore、Preview Branch 不重新 parse 正文。
- Search/Audition 继续读取 `plain_text`。
- Mention 同步仍能读取 canonical JSON。
- 非 publisher 请求不能伪造 BodyBag。
- Article GraphQL schema 不再暴露旧 raw `body` 写入参数。
- Earmark 删除后 `mix compile --warnings-as-errors` 和 focused tests 通过。

---

## 十一、风险与约束

### Plate 版本漂移

当前仓库中的 Plate packages 和已发布 rich-editor 依赖存在版本组合差异。版本和 plugin registry 未统一前，不应把 Node 输出作为 canonical BodyBag。

### HTML 安全

Plate server serializer 输出不能直接视为安全 HTML。最终 sanitize 是 `artiment-publisher` 的强制步骤，Elixir 仍保留字段大小和服务来源校验。

### Serverless 文件限制

第一阶段只支持小型单文档同步转换。大文件不能长期通过 Vercel Function request/response body 传输；后续应使用 S3-compatible presigned upload 和 object ref，但不纳入本轮。

### MarkItDown 质量边界

MarkItDown 重点是提取结构化文本，不是高保真排版还原。复杂表格、扫描 PDF 和图片 OCR 需要独立验收，必要时再引入 OCR/Azure 增强。

### ContentImport 冲突

`docs/bulk-import/content-import-refactor-plan.md` 已同步改为：保留导入基础设施，移除 Elixir `MarkdownNormalizer`，正文生成与 apply 明确 `deferred`。恢复批量导入时直接接入 converter/publisher，不恢复双实现。

---

## 十二、完成标准

本次重构完成时应满足：

1. `document-converter` 可以独立本地测试和独立部署。
2. 单个外部文档可以转换为 Markdown，并在前端初始化 Plate Editor。
3. Article 正文保存全部经过 Node `artiment-publisher`。
4. Node 输出稳定、经过 sanitize 的 `TArtimentBodyBag`。
5. Elixir 只做安全边界、权限、业务生命周期、事务和持久化。
6. Article 链路不再调用 Elixir Plate/Markdown serializer。
7. 旧 Editor.js/Markdown converter 已删除。
8. `ContentImport.MarkdownNormalizer` 和 Earmark 依赖已删除。
9. Article mutation 不再保留 raw `body` fallback。
10. 批量导入仍明确处于 deferred 状态，没有用临时浏览器批处理冒充完成。

当前完成度：第 2～10 项已完成；第 1 项已满足独立本地运行与测试，尚缺 Vercel 实际部署和线上 `/health`、`/convert` smoke。Phase 5 不是本轮完成前置条件。
