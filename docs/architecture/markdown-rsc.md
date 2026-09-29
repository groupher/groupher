# Markdown Editor / Viewer 边界与 Bundle 优化

> 状态：方案记录（2026-08-23），根据 `markdown-to-jsx@9.10.2` POC 于
> 2026-08-26 更新。

## 结论

本轮目标是减少阅读端 bundle，不是引入 React Server Components（RSC）。

TagNote、FAQ 等阅读场景必须由服务端转换并通过 SSR 直出完整 HTML，不得 lazy load
Markdown Viewer，也不得在 hydration 后才补正文。编辑器只在用户需要 Markdown 预览时
按需加载 parser。

```text
MarkdownEditor
└── Client: 按需加载 markdown-to-jsx/react

TagNote / FAQ
└── TanStack Start server: compileMarkdown(source)
    └── SSR: MarkdownViewer 直出完整 HTML
        └── Browser: 不包含 Markdown parser
```

当前应用页面层是 TanStack Start，没有 Next.js 运行时或 Next.js server 边界。本文只使用
TanStack Router、TanStack Start loader/server function 和 SSR 术语。

## 范围

本文只处理 canonical source 确实是 Markdown string 的轻量字段，例如：

- `CommunityTag.desc`，阅读入口为 TagNote；
- FAQ item detail；
- 其他明确使用当前 `frontend/core/render/Markdown` 的短文本字段。

Article、Docs 等正文不在本文范围内。它们使用 Groupher Rich Editor / Plate，Markdown 和
HTML 由 rich-editor codec、publisher 和既有 BodyBag 链路处理：

```text
Article / Docs
└── Rich Editor / Plate
    └── publisher / BodyBag
        ├── JSON
        ├── Markdown
        ├── HTML
        ├── body_hash
        └── schema_version
```

不得把本文的 `compileMarkdown()` 接入 Article/Docs 发布链路，也不得建立第二套正文
renderer。

## POC 结果

POC 使用 `markdown-to-jsx@9.10.2`、React 19 和 Vite 8 production build。

| 浏览器端实现                                          |       gzip | 结论                    |
| ----------------------------------------------------- | ---------: | ----------------------- |
| `markdown-to-jsx/react` 完整 parser 与 React renderer | 约 27.6 KB | 只用于 Editor 按需预览  |
| 预生成 AST + `astToJSX`                               | 约 32.5 KB | 不是轻量 Viewer，不采用 |
| 预编译纯 JSX 示例                                     |   约 276 B | 固定内容可用            |
| 接收 HTML 的通用 `MarkdownViewer`                     |   约 206 B | 阅读端采用              |

`markdown-to-jsx/html` 在 Node 环境可以输出完整 HTML。POC 验证了其默认行为：

- `<script>` 被输出为不可执行文本；
- `javascript:` 链接的 `href` 被移除；
- 默认 sanitizer 和 GFM tag filtering 生效。

默认行为不能替代 Groupher 自己的安全 contract，正式实现仍需固定标签、URL、图片、外链
和 raw HTML 策略。

## Editor

MarkdownEditor 继续在客户端实时预览。打开编辑器时不必加载 parser；切换到 Preview 或
其他确实需要预览的状态时，再动态加载 `markdown-to-jsx/react`。

```text
打开 MarkdownEditor
└── 不加载 parser

启用 Preview
└── 加载 markdown-to-jsx/react
```

Editor 的 source 类型应从当前宽泛的 `ReactNode` 收紧为 `string`：

```ts
type TProps = {
  source: string
}
```

实施时应删除当前 `frontend/core/render/Markdown/index.tsx` 中：

- `children: ReactNode`；
- 为绕过 `markdown-to-jsx` string contract 添加的 `@ts-ignore`。

## Viewer 与 SSR 直出

`MarkdownViewer` 不解析 Markdown，只同步展示 `compileMarkdown()` 生成的可信 HTML：

```tsx
type TProps = {
  content: TCompiledMarkdown
}

export default function MarkdownViewer({ content }: TProps) {
  return <div className='markdown-content' dangerouslySetInnerHTML={{ __html: content.html }} />
}
```

TagNote、FAQ 等场景不得保留现有 `React.lazy`、`Suspense fallback={null}` 或
`useDidMount()` 后才显示 Markdown 的路径。正文应在 route loader/server function 阶段准备
完成，并包含在首个 SSR HTML 响应中：

```text
Request
  -> TanStack Start route loader / server function
  -> Phoenix GraphQL 读取 Markdown source
  -> compileMarkdown(source)
  -> route data 中的可信 HTML
  -> MarkdownViewer
  -> SSR HTML response
```

客户端导航也只能向 TanStack Start server 请求已经转换的 HTML，不得退化为浏览器调用
parser。

## `compileMarkdown()`

`compileMarkdown()` 是一个共享的服务端纯函数，不是独立服务、RPC 或新的 GraphQL 层：

```ts
import { compiler } from 'markdown-to-jsx/html'

export type TCompiledMarkdown = {
  html: string
  rendererVersion: string
}

export const compileMarkdown = (source: string): TCompiledMarkdown => ({
  html: compiler(source, {
    ...MARKDOWN_PARSER_OPTIONS,
    ...HTML_MARKDOWN_OPTIONS,
    // Groupher 统一的链接、图片和 HTML 安全配置
  }),
  rendererVersion: MARKDOWN_RENDERER_VERSION,
})
```

### 共享 compiler contract

Editor 与服务端必须共享 parser 行为，不能分别维护两份默认配置。共享模块只包含
`/react` 与 `/html` 都支持的 client-safe parser options：

```ts
export const MARKDOWN_PARSER_OPTIONS = {
  disableAutoLink: false,
  disableParsingRawHTML: true,
  enforceAtxHeadings: true,
  tagfilter: true,
  sanitizer: markdownSanitizer,
} as const
```

两个入口分别添加 renderer-specific options：

```text
MARKDOWN_PARSER_OPTIONS
├── Editor: markdown-to-jsx/react + React overrides/renderRule
└── Server: markdown-to-jsx/html + HTML overrides/string renderRule
```

`rel`、`target` 等链接输出属性不属于 parser options。可以共享纯数据形式的 link props，
再分别放入 React overrides 与 HTML overrides。React component override 和 HTML string
`renderRule` 不能互相复用。

```ts
export const MARKDOWN_LINK_PROPS = {
  rel: 'nofollow noopener noreferrer',
} as const

export const REACT_MARKDOWN_OPTIONS = {
  overrides: {
    a: { props: MARKDOWN_LINK_PROPS },
  },
  renderRule: renderReactMarkdownRule,
}

export const HTML_MARKDOWN_OPTIONS = {
  overrides: {
    a: { props: MARKDOWN_LINK_PROPS },
  },
  renderRule: renderHtmlMarkdownRule,
}
```

两个 `renderRule` 分别返回 ReactNode 与 HTML string，但必须实现同一个 heading、安全和输出
语义 contract。

同一 Markdown source 的 Editor preview 与服务端输出必须通过规范化 DOM parity test，比较：

- tag tree 与文本；
- link `href`、`rel` 和 `target`；
- image attributes；
- `code` / `pre` 结构；
- raw HTML 和危险 URL 的过滤结果。

不要求两边序列化后的 HTML string 逐字相同。

它只在两个 Node 执行环境中使用：

- TanStack Start server：为 TagNote、FAQ 等动态字段生成 SSR HTML；
- Landing build：为固定营销内容生成静态 HTML。

Phoenix GraphQL 保存 Markdown source，并提供 source revision 或 `updatedAt`。Phoenix 不调用
Node renderer，也不持久化这些短字段的派生 HTML。Article 已有的 HTML 持久化链路保持不变。

### 缓存归属

第一版不建立独立的 compiled Markdown data cache。`compileMarkdown()` 在对应的 TanStack
Start server function 中执行，结果随现有 route data/page response 一起使用 HTTP/CDN cache
和 `CACHE_TAG` 失效：

- FAQ 随 `loadCommunity()` 结果缓存，使用 `CACHE_TAG.communityCache(community)`；
- TagNote 应由带 `CACHE_TAG.tagsCache(community, thread)` 的 server function 读取和转换；
- Dashboard 更新 FAQ 或 tag 后，必须验证对应 community/tags cache tag 被失效。

当前 `publicCacheHeader()` 设置的是 `cache-control` 和 `cache-tag` 响应头；`CACHE_TAG` 是 CDN
response invalidation contract，不是可独立 `get/set` compiled HTML 的数据缓存。
`setPrivateCacheHeader()` 只为登录态响应设置 `private, no-store`，也不是数据缓存。

不得依赖浏览器端缓存或本地转换结果承担 Markdown 转换；浏览器始终只消费服务端返回的
compiled HTML。只有 profiling 证明服务端重复转换成为热点后，才考虑带 source revision 和
renderer version 的独立 derived-data cache。

## 版本

实施时应将根 `package.json` 的依赖从范围版本锁为 POC 验证过的精确版本：

```json
"markdown-to-jsx": "9.10.2"
```

renderer version 同时包含 package 行为和 Groupher 安全 contract：

```ts
export const MARKDOWN_RENDERER_VERSION = 'markdown-to-jsx@9.10.2:groupher-markdown-html@1'
```

它参与 HTTP response 的生成版本；未来如增加独立 derived-data cache，也必须进入 cache
key。package、sanitizer、tagfilter、heading、图片或链接规则发生变化时，必须更新 renderer
version。普通已保存内容不启用 `optimizeForStreaming`。

### Heading policy

TagNote、FAQ 属于同页可重复出现的 Markdown 短字段。第一版不为其中的 heading 提供锚点，
避免多个 FAQ item 生成重复 `id`，也避免把短字段 slug 暴露成长期公共链接。

React 与 HTML renderer 应分别通过自己的 override/renderRule 输出相同 heading tag，并移除
自动生成的 heading `id`。如果未来确有锚点需求，必须引入基于稳定资源 ID 的 prefix，并由
Editor 与服务端共同使用；不得直接恢复无 scope 的默认 slug。

## 共享样式

Editor 和 Viewer 必须输出相同的标准 HTML tags，并共同使用唯一的
`.markdown-content` stylesheet。不能让 Editor 继续使用一套 `useSalon()` tag overrides、
Viewer 再维护另一套 CSS。

```css
.markdown-content {
  @apply max-w-none text-sm font-normal leading-6;
}

.markdown-content p {
  @apply mb-4;
}

.markdown-content ul,
.markdown-content ol {
  @apply mb-4 list-outside pl-5;
}
```

规则如下：

- Markdown tag 样式只在共享 stylesheet 定义一次；
- `useSalon()` 只保留调用位置的外层 spacing/layout，或在无剩余职责时移除；
- 动态主题色通过现有 CSS variables/theme tokens 表达；
- descendant rules 使用 `@apply` 或原生 CSS；
- 不依赖 Tailwind content scan 从 CSS 注释、拼接字符串或运行时 class 中猜测 utilities。

当前 Tailwind v4 入口会加载 Core CSS，`tailwind.config.js` 也覆盖 `tailwind/**/*.css`，但实现
仍应通过真实 production build 验证生成样式。

## HTML 安全与扩展边界

`dangerouslySetInnerHTML` 是单点信任边界。`MarkdownViewer` 只能接收带
`rendererVersion` 的 `TCompiledMarkdown`，不能接受裸 `html: string`。GraphQL 不得提供允许
客户端写入的通用 HTML 字段。

默认策略：

- 禁止 iframe/embed；白名单外标签一律拒绝或转义；
- 禁止 `javascript:`、`vbscript:` 等危险 URL；
- 图片默认只允许约定的 `https` 和 Groupher 资产来源；
- 外链统一处理 `rel`，是否使用 `_blank` 由产品规则明确；
- raw HTML 默认关闭或使用明确白名单；
- 测试覆盖 script、事件属性、危险 URL、图片、iframe 和 malformed HTML。

`markdown-to-jsx/html` 的 overrides 只能使用字符串 tag 和可序列化 props，不能复用 Editor
中的 React component override。复杂输出只能通过返回字符串的 `renderRule` 实现。

因此：

- 普通 heading、list、link、image、code 使用 HTML 路径；
- CopyButton、目录状态等放在 Markdown HTML 外层作为独立 client interaction；
- Mermaid 可以服务端生成静态 SVG，或输出占位 HTML 后由独立 client island 激活；
- 如果未来要求 Markdown 内任意组合 React components，再重新比较 HTML、内容模型和 RSC。

## 验收标准

- 本文实现不接入 Article/Docs Rich Editor、publisher 或 BodyBag 链路；
- TagNote、FAQ 等 Viewer 不包含 `React.lazy`、`useDidMount` 或 hydration 后补正文；
- TagNote、FAQ 的完整 Markdown HTML 出现在首个 SSR response 中；
- 客户端 navigation 获取服务端已转换的 HTML，不在浏览器转换 Markdown；
- Viewer 浏览器 bundle 不包含 `markdown-to-jsx` parser 或 `astToJSX`；
- Editor 只在 Preview 实际启用时加载 `markdown-to-jsx/react`；
- Editor 与 Viewer 共同使用唯一的 `.markdown-content` stylesheet；
- 同一 source 的 Editor preview 与服务端输出通过规范化 DOM parity test；
- TagNote、FAQ heading 不生成 DOM `id`；
- `compileMarkdown()` 有安全测试并锁定 renderer version；
- iframe/embed 默认禁止；
- `markdown-to-jsx` 锁为 POC 验证过的精确版本；
- 使用 Community、Landing 和 Dashboard 的真实 production build 验证 chunk 与 CSS 归属；
- `.markdown-content` 在 light/dark 两套 theme tokens 下样式正确，重点验证 link、inline code、
  code block、blockquote 和 list marker；
- 关闭 JavaScript 后，首屏 TagNote、FAQ 和 Landing 固定内容仍可阅读。

## 为什么暂不采用 RSC

`markdown-to-jsx` 和 TanStack Start 都支持 RSC，但当前问题不需要 Flight component tree。
普通 TanStack Start loader/server function 返回 HTML string，已经可以做到：

```text
浏览器 Markdown parser：0 KB
MarkdownViewer：约 206 B gzip
首屏正文：SSR 直出
RSC / Flight：不需要
```

只有未来出现 HTML 路径无法表达的服务端 React component composition，才重新评估 RSC。

## 参考

- [`markdown-to-jsx` 文档](https://github.com/quantizor/markdown-to-jsx)
- [TanStack Start Server Functions](https://tanstack.com/start/latest/docs/framework/react/guide/server-functions)
- [TanStack.com 停用内容 RSC 的复盘](https://tanstack.com/blog/we-stopped-using-rsc-on-tanstack-com)
