# Markdown 与 React Server Components

> 状态：方案记录（2026-08-23）。

## 结论

`markdown-to-jsx` 当前版本已经支持 React Server Components（RSC）。编辑器预览和阅读端不需要维护两套 Markdown 解析器或 renderer；两边都应优先从 `markdown-to-jsx/react` 导入同一个 `Markdown` 组件。

```tsx
import Markdown from 'markdown-to-jsx/react'

export function MarkdownContent({ content }: { content: string }) {
  return <Markdown>{content}</Markdown>
}
```

同一组件可以运行在两个边界：

```text
编辑器预览                 TagNode / 公开阅读
Client Component           React Server Component
        \                   /
         markdown-to-jsx/react
```

官方 package 文档说明，`Markdown` 会自动识别 RSC 或客户端环境；RSC 不需要 `use client`，并保持两种环境的输出一致。React 代码应使用 `markdown-to-jsx/react` 入口；默认入口仅用于兼容旧代码。

## Groupher 的使用边界

### 阅读端

TagNode、文章详情、公开文档和 changelog 的 Markdown 正文适合运行在 RSC 中：

- Markdown 解析和代码块处理不需要进入浏览器 bundle；
- 服务端可以直接读取已经授权的公开内容；
- 正文、标题、链接、表格和代码块可以作为服务端内容流式返回；
- 点赞、收藏、复制代码、目录滚动和评论锚点仍然独立作为客户端交互。

```text
TagNode 阅读页
├── RSC: Markdown 正文、标题、代码块、图片、链接
├── Client: 点赞、收藏、复制代码
└── Client: 评论、目录滚动状态、其他浏览器交互
```

### 编辑端

编辑器中的实时预览继续作为 Client Component 使用同一个 `Markdown` 组件。用户每次输入不应为了预览而跨 RSC 边界重新渲染。

```text
编辑器输入 -> Client Markdown preview
文章阅读 -> RSC Markdown content
```

## TanStack Start 接入方式

RSC 只应在启用了 TanStack Start RSC 能力的应用中使用。阅读路由的 loader 可以返回由 `renderServerComponent` 生成的 renderable value，页面再将其嵌入客户端路由组件：

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import Markdown from 'markdown-to-jsx/react'

const getContent = createServerFn()
  .validator((data: { tagId: string }) => data)
  .handler(async ({ data }) => {
    const tag = await readPublicTag(data.tagId)

    return {
      Content: await renderServerComponent(<Markdown>{tag.content}</Markdown>),
    }
  })

export const Route = createFileRoute('/tags/$tagId')({
  loader: ({ params }) => getContent({ data: { tagId: params.tagId } }),
  component: TagPage,
})

function TagPage() {
  const { Content } = Route.useLoaderData()

  return (
    <>
      {Content}
      <TagActions />
      <CommentList />
    </>
  )
}
```

上面的示例只表达边界。实际实现仍必须沿用 CMS 的公开阅读和授权入口，不能因为组件运行在服务端就绕过现有 Gate、Reader 或 GraphQL 合约。

## `overrides` 注意事项

共享 Markdown 配置是允许的，但 override 组件必须符合所在运行时的边界：

- 静态 `code`、`pre`、`img`、标题和链接 override 可以保持 server-compatible；
- 复制按钮、reaction、评论锚点等交互组件应保持 client-only，并作为独立交互岛组合；
- 不要让承载 server-compatible overrides 的配置模块整体带上 `use client`；
- override 传递给 RSC 的 props 必须符合 React Flight 的可序列化要求；
- 仍需统一处理 HTML tag filtering、图片来源、链接策略和内容安全。

第一版不需要把客户端交互直接塞进 Markdown renderer。先让 RSC 输出静态正文，再在正文外层挂载 `CopyButton`、`TocScrollSpy`、reaction 和 comment anchor，边界更清楚。

## 不适用的场景

以下场景继续使用普通 TanStack Router、loader、TanStack Query 和客户端组件：

- 编辑器和实时 Markdown 预览；
- Dashboard CMS 列表和批量操作；
- 无限滚动或强实时的 Feed；
- 拖拽、筛选、图表和本地草稿状态；
- 依赖 `window`、`localStorage`、`BroadcastChannel` 或 viewport 的组件。

RSC 在这里是阅读端的内容渲染优化，不是整个社区应用的数据状态或交互架构。

## 版本与风险

截至本文记录时，`markdown-to-jsx` npm 最新版本为 `9.10.2`，其 React 入口文档已经包含 RSC 用法。TanStack Start 的 RSC 支持仍标记为 experimental，API 可能变化。因此 RSC 依赖应收口在 TagNode / 公开内容渲染边界，不应扩散到 `frontend/core` 的通用 UI 合约或所有平台适配层。

参考：

- [`markdown-to-jsx` npm 文档](https://www.npmjs.com/package/markdown-to-jsx)
- [TanStack Start Server Components](https://tanstack.com/start/latest/docs/framework/react/guide/server-components)
- [TanStack Start 与 Next.js 对比](https://tanstack.com/start/latest/docs/framework/react/comparison)
