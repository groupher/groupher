# Community

`frontend/community` 是 Groupher 公共社区的 TanStack Start host。

```text
浏览器请求
  -> Community TanStack route tree
  -> request-local QueryClient / SSR integration
  -> Community boundary + RouteScopeProvider
  -> frontend/core 公共 reader UI
```

当前 vertical slice 覆盖：

- `/:community/about`
- `/:community/post`
- `/:community/post/:id`
- post masked preview
- `/:community/changelog` and canonical/preview routes
- `/:community/kanban` and Kanban → Post preview
- `/:community/doc` and canonical doc routes
- root health、not-found 和保留路径处理

本地开发：

```bash
yarn dev:community
```

默认地址是 `http://127.0.0.1:3007`。生成 route tree、类型检查、格式检查和生产构建
均由该 workspace 自己负责；`routeTree.gen.ts` 是生成产物，不手工编辑。
