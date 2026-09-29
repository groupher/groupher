# 路由链接合同

## 目的

Landing、Community、Dash 和 Apply 都使用 TanStack Router，但共享 Core 仍不直接导入
具体 Router。Core 保存类型化 route target、路径解析和语义化链接；每个 host 只通过窄化的
`RouteScopeProvider` 提供当前位置和命令式导航能力。

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

`PlatformLink` 始终渲染原生 `<a>`。普通点击由当前 route scope 交给 TanStack Router；
外链、新标签页和带修饰键点击继续使用浏览器原生行为。

## Host 实现

### TanStack hosts

Community、Dash、Landing 和 Apply 在各自应用根部安装 `RouteScopeProvider`。scope 负责
`push`、`replace`、`prefetch`、当前 pathname/search 和产品特有的 preview masking；Image、
Link、Script 不再通过 Context 注入。

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

Dashboard 路由构造器返回与运行时无关的 `TRouteTarget`。请求 `preserveSearch` 时，Core
使用当前 search 状态解析它：

```text
Core route target
  -> /community/dash/...
```

旧 `dashboard` 根片段已经删除，不提供兼容解析。

## 添加新平台

添加新的 Host 或 Router 时：

1. 在 host 根部实现 `TRouteNavigation`。
2. 使用 `RouteScopeProvider` 提供 location 和导航动作。
3. 产品特有的 preview/masking 留在 host scope。
4. Core 组件继续使用 `PlatformLink`，不要增加 Router 专属导入。

实现应继续为内部和外部导航渲染语义化锚点。只有改变 UI 状态的控件才应渲染为按钮。
