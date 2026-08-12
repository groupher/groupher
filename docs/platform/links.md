# Platform 链接

## 目的

Dashboard UI 由两个应用共享：

- `frontend/dashboard` 使用 Next.js App Router 和 `next/link`。
- `frontend/dash` 使用 TanStack Router 和 `@tanstack/react-router` 的 `Link`。

共享 Core 组件不得直接导入任一 Router，而应使用 `PlatformProvider` 暴露的
Platform 链接合同。

## 链接合同

Core uses `frontend/core/platform/Link.tsx`:

```tsx
<PlatformLink route={dsbRoutes.section({ community, section: 'appearance' })} preserveSearch>
  Appearance
</PlatformLink>
```

该合同接受以下任一种形式：

- `route`：内部的类型化 Dashboard 路由目标；
- `href`：普通 URL，包括外部 URL。

Core 组件不判断导航由 Next 还是 TanStack Router 处理，这由当前 Platform adapter
负责。

## Platform 实现

### Next Dashboard

`frontend/dashboard/src/platform/Link.tsx` 使用 `dashboard` 根片段解析路由，并渲染：

```tsx
<NextLink href={resolvedHref}>...</NextLink>
```

### TanStack Dash

`frontend/dash/src/platform/Link.tsx` 使用 `dash` 根片段解析路由，并渲染：

```tsx
<TanStackLink to={resolvedHref}>...</TanStackLink>
```

TanStack adapter 负责 `preload`、`replace` 和已注册路由类型等 TanStack 专属逻辑。
这些细节不得泄漏到 Core 组件中。

## 语义边界

导航使用链接：

```tsx
<PlatformLink route={target}>Settings</PlatformLink>
```

动作使用按钮：

```tsx
<button type='button' onClick={onCollapse}>
  Collapse
</button>
```

导航项不得实现为调用 `navi.to()` 的按钮。使用真正的链接可以保留键盘导航、复制链接、
在新标签页打开、修改键点击、浏览器回退和辅助技术语义。

`navi.to()` 仍适合重定向、提交后的跳转以及前进/后退等命令式导航。

## Search 参数

Dashboard 路由构造器返回与平台无关的 `TRouteTarget`。请求 `preserveSearch` 时，adapter
使用平台根片段和当前 search 状态解析它：

```text
Core route target
  -> Next adapter: /community/dashboard/...
  -> Dash adapter: /community/dash/...
```

这样可以保持两棵路由树平行，同时不让 Core 知道当前由哪个应用渲染。

## 添加新平台

添加新的 Host 或 Router 时：

1. 实现 `TPlatformLinkProps` 合同。
2. 使用该平台的根片段和 search 规则解析 `route`。
3. 渲染 Router 原生的链接组件。
4. 在该平台的 `PlatformProvider` 中注册实现。
5. Core 组件继续使用 `PlatformLink`，不要增加 Router 专属导入。

实现应继续为内部和外部导航渲染语义化锚点。只有改变 UI 状态的控件才应渲染为按钮。
