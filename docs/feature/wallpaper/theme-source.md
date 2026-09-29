# Theme source of truth and SSR/first-paint contract

> 实施状态：首屏主题脚本已统一到 Core；Landing、Dash、Community 都直接输出 SSR seed；Theme Store 是唯一的 DOM 桥接点；主题偏好只写入 `themeMode` cookie。旧的 localStorage、`resolvedTheme` cookie 和 first-paint 变量快照链已移除。

## 1. 背景

当前主题链路同时存在 SSR、pre-paint script、Theme Store、`useTheme()`、ThemeMonitor，以及少量组件自己的主题分支。壁纸问题暴露出一个共性：同一个“当前主题”在不同阶段被重复解析，导致 SSR 输出、首屏脚本、hydration 和运行时状态短暂不一致。

本文件只讨论主题事实的来源和传播，不讨论具体视觉设计。壁纸的 `light`/`dark` 静态资源契约见 `docs/feature/wallpaper/static-wallpaper.md`。

## 2. 约束原则

唯一的产品原则是：

> SSR 同时返回 light/dark 两套配置；client 只根据 first-paint 解析出的主题作为首次渲染依据。

这句话包含三个边界：

1. SSR 返回的是完整的双分支数据，而不是替用户猜测最终的 light 或 dark。
2. pre-paint script 在浏览器首屏前解析用户偏好，写入根节点的 `data-theme`。
3. `ThemeStoreProvider` 把该结果桥接到 Theme Store；业务组件只使用 `useTheme()`，不再直接读取 cookie、localStorage 或 `matchMedia`。

`themeMode` 和 `theme` 不是同一个事实：

- `themeMode` 是用户偏好：`light`、`dark` 或 `system`。
- `theme` 是当前解析结果：`light` 或 `dark`。

两者需要分别建模，但首次解析只能有一个入口。

## 3. 当前链路

```text
SSR loader
  ├─ theme seed（Dash/Community 当前为 light/system fallback）
  └─ wallpaper query（包含 light/dark 两个已发布 Wallpaper 分支）
        ↓
SSR HTML
  └─ Landing/Dash/Community：输出 html[data-theme] / html[data-theme-mode] SSR seed
        ↓
head 中的 pre-paint script
  └─ 所有纳入范围的宿主：读取 themeMode cookie + matchMedia
        ↓
浏览器首屏前写入 html[data-theme]
        ↓
ThemeStoreProvider
  └─ 读取 data-theme，初始化 Theme Store
        ↓
useTheme() 消费
  ├─ 静态 CSS 选择 light/dark 资源
  ├─ 编辑器和 GPU renderer 的运行时参数
  └─ 用户主动切换主题
        ↓
ThemeMonitor
  └─ 响应 Theme Store 的 themeMode，仅在 system 模式监听 matchMedia
```

## 4. 现存问题

### 4.1 首次解析器已统一

当前由 Core 提供一份 pre-paint 实现：

- [`frontend/core/lib/ssr/script.ts`](../../../frontend/core/lib/ssr/script.ts)：所有纳入范围的宿主都使用 `themeMode` cookie。
- cookie Domain 由 [`frontend/core/lib/theme/cookie.ts`](../../../frontend/core/lib/theme/cookie.ts) 统一解析：优先使用 `VITE_THEME_COOKIE_DOMAIN`，否则使用 Groupher 默认域名规则。

inline script 只接收序列化后的 cookie 配置，不再维护 hostname 白名单数据；但为了在首屏前执行，仍会内联复制 host/domain 匹配逻辑。修改子域匹配语义时，必须同步检查 [`frontend/core/lib/theme/cookie.ts`](../../../frontend/core/lib/theme/cookie.ts)。

### 4.2 route 和 Provider 的桥接已收敛

route 只提供 SSR fallback seed；`ThemeStoreProvider` 在浏览器端读取 `document.documentElement.dataset` 并初始化 Theme Store。

`resolvePrePaintThemeSeed()` 没有生产调用点，已删除；不会再保留 route 层的重复解析分支。

### 4.3 ThemeMonitor 只负责运行时 system 监听

[`frontend/core/shell/GlobalLayout/ThemeMonitor.tsx`](../../../frontend/core/shell/GlobalLayout/ThemeMonitor.tsx) 响应 Theme Store 的 `themeMode`：进入 `system` 时挂载 `matchMedia` listener，离开 `system` 时卸载 listener。

ThemeMonitor 应只处理一个运行时职责：

- 在 `system` 模式下监听系统主题变化并同步到运行时。

用户主动切换直接通过 `useTheme()` 完成，不经过 ThemeMonitor 重放。

它不应重新决定首次主题。

### 4.4 SSR 的 theme seed 是单值，不等于双分支 SSR

Dash 和 Community 的 `PUBLIC_THEME_SEED` 目前是 `light/system`。这可以作为 SSR fallback，但不能被理解为 SSR 已经知道用户最终主题。

壁纸 GraphQL 数据包含 `light` 和 `dark` 两套静态资源；首屏图片和静态壁纸通过双分支 markup + CSS 选择，不在 SSR 阶段用 React 主题值选择单一资源。

### 4.5 Landing 图片分支已改为 CSS 选择

以下组件使用双分支资源和 `data-theme` CSS 选择：

- [`frontend/landing/src/widgets/Landing/CoverImage/DesktopDevice.tsx`](../../../frontend/landing/src/widgets/Landing/CoverImage/DesktopDevice.tsx)
- [`frontend/landing/src/widgets/Landing/DashboardIntros/LayoutTab/WallpaperCard.tsx`](../../../frontend/landing/src/widgets/Landing/DashboardIntros/LayoutTab/WallpaperCard.tsx)
- [`frontend/landing/src/widgets/Landing/CoverImage/ImageSlider.tsx`](../../../frontend/landing/src/widgets/Landing/CoverImage/ImageSlider.tsx)

这些路径不再依赖 SSR 阶段的 React 主题布尔值选择首屏图片。

### 4.6 Pattern active 状态已避免 SSR 误判

Pattern active 状态在 mount 前不输出选中结果，避免 SSR 使用 fallback theme 产生错误 active 边框；mount 后再根据运行时状态显示 active。

### 4.7 首次绘制变量快照已删除

（修复前）`injectThemeFirstPaintVars` / `THEME_FIRST_PAINT_VARS_SCRIPT` 没有任何宿主 root 调用；ThemeMonitor 对应的 `scheduleRemoveThemeFirstPaintVars` 清理的是不存在的 style 元素，属于 Next 时代遗留的空转逻辑。TanStack 根当前依靠 pre-paint 的 `data-theme` 和 CSS 选择，不依赖这套变量快照。

相关清理职责、helper、脚本导出、测试和生成脚本均已删除。

## 5. localStorage 与 cookie 的取舍

### 5.1 推荐：cookie 作为 `themeMode` 的持久化来源

对于 Groupher 的多个宿主，cookie 更适合承担用户的主题偏好：

- pre-paint script 可以读取。
- SSR 请求也能读取，便于生成一致的 fallback metadata。
- 配置统一 `Domain` 后，同一站点的 Dash、Community、Landing 可以共享偏好。
- 不依赖浏览器存储 API，首屏脚本的兼容性更好。

建议只持久化用户选择的 `themeMode`。当前解析出的 `theme` 应由 pre-paint 结果和运行时 store 表示，不需要再把 resolved theme 当作第二个长期事实保存。

统一 cookie 的写入格式为：

```text
themeMode=light|dark|system;
Path=/;
Domain=<环境对应的根域名>;
Max-Age=<长期有效>;
SameSite=Lax
```

本地开发使用 `.groupher.localhost`，生产使用对应的正式根域名。`Domain` 是部署协议的一部分，不能依赖浏览器默认的 host-only 行为。
cookie 名称继续使用现有的 `themeMode`，不为了加前缀而改名，因此不产生旧 cookie 名迁移问题。

Domain 的配置优先级如下：

1. `VITE_THEME_COOKIE_DOMAIN`：部署环境显式配置的根域名。
2. Core 内置默认规则：`.groupher.localhost` 和 `.groupher.com`。
3. 无匹配时使用 host-only cookie；仅开发构建（且非 test 模式）输出 warning，提示当前 host 未配置共享域名。

pre-paint inline script 只接收序列化后的配置，不维护环境 hostname 白名单数据；host/domain 匹配逻辑因执行时机限制仍在内联脚本中复制，并需与 `frontend/core/lib/theme/cookie.ts` 保持同步。

### 5.1.1 与认证 cookie 隔离

主题 cookie 与 session、access token、refresh token 等认证 cookie 是两套完全不同的协议，必须显式隔离：

- 使用明确的主题名称 `themeMode`；不得与 auth cookie 使用同名。
- 主题 cookie 必须可被 pre-paint script 读取，因此不能设置 `HttpOnly`。
- `HttpOnly`、认证用途、权限校验和主题偏好不能共用同一个 cookie。
- `Domain`、`Path`、`SameSite` 等属性分别按两套协议配置；不能为了共享主题而扩大认证 cookie 的作用域。
- 服务端如读取主题 cookie，只能将其用于主题 metadata 或 SSR fallback，不能参与登录、授权或身份判断。
- 主题 cookie 不保存 token、session id 或任何认证信息。

如果认证 cookie 使用 `__Host-` 前缀，它必须保持 host-only，不能设置 `Domain`；这不影响主题 cookie 使用独立的、按环境配置的 Domain。主题 cookie 是否设置 `Secure` 应随部署协议启用：HTTPS 环境必须启用，HTTP 本地开发按实际协议配置。

### 5.2 localStorage 不属于主题持久化协议

localStorage 不参与主题偏好的读取或写入。它按 origin 隔离，无法满足多个 Groupher 宿主统一主题偏好的要求，也不需要为历史数据提供兼容迁移。

这意味着 Landing 等过去只把偏好写入 localStorage 的老用户，升级后不会保留该偏好；首次访问将回退到 `system`，再由 `matchMedia` 得到当前主题。这是接受的产品决策，由新的 `themeMode` cookie 重新建立偏好，不作为数据迁移或兼容 bug 处理。

因此不保留以下路径：

- pre-paint 从 localStorage 读取主题。
- `changeMode()` 向 localStorage 写入主题。
- ThemeMonitor 在 cookie 缺失时回退到 localStorage。

Landing、Dash、Community 等纳入范围的宿主都只使用统一的 `themeMode` cookie。

Apply 和 Inspire-me 当前明确不纳入本协议：它们暂时不共享 `themeMode` cookie，也不补齐本协议的 SSR seed、pre-paint 和 ThemeStoreProvider。后续纳入时必须单独补齐这些边界。Widget 暂不纳入本协议，不依赖 Groupher 根域 cookie。

### 5.3 不要把三种状态混成一个值

```text
themeMode cookie       = 用户偏好（light/dark/system）
html[data-theme-mode]  = 首屏脚本公开的偏好
html[data-theme]       = 首屏脚本解析后的当前主题
Theme Store.theme      = client 运行时对当前主题的镜像
```

`toggle()` 的语义是按当前 resolved `theme` 在显式 `light` / `dark` 之间切换。若用户当前处于 `system` 模式，第一次调用会进入对应的显式模式并持久化 `themeMode`；它不会保留 `system` 模式。

前三者是协议层和 DOM 层的表示，最后一个是 client 运行时状态。它们可以有多个表示，但只能有一个首次解析逻辑和一个运行时写入路径。

## 6. Overlay 配置边界

产品确实存在专门的 overlay 配置。overlay 是组件或产品功能自己的配置，不应被重新定义成第二套全局 theme，也不应为了区分它而复制一套 token/color 配置。

正确的边界是：

```text
全局主题
  html[data-theme] → Theme Store → useTheme() → 全局 token/CSS

Overlay 配置
  产品 overlay state → 现有组件 token/variant → 局部渲染
```

因此：

- overlay 可以有自己的颜色、透明度、混合模式等产品字段。
- overlay 的字段应在 overlay 配置中维护，不复制 light/dark 全局 token。
- 局部 `data-theme` 只有在现有第三方或组件协议明确要求时才保留，并且必须限制在组件边界内。
- Landing demo、ActionSnackbar、Tooltip 等局部主题不能写入或覆盖根节点 `html[data-theme]`。

这不是建议新增 `data-overlay-theme` 和另一套主题系统；重点是把 overlay 作为既有产品配置消费，而不是把它冒充成全局主题事实。

## 7. 消费者分类

### 7.1 应保留 `useTheme()` 的 client 行为

以下属于运行时行为，使用 `useTheme()` 是合理的：

- GPU renderer 的参数和生命周期。
- Cobe/Canvas 等必须在浏览器 effect 中创建的对象。
- emoji picker、select、tooltip 等第三方组件的运行时主题参数。
- 用户主动切换主题的交互。

前提是它们不会在 SSR 阶段用 JS 选择关键首屏图片或背景。

### 7.2 应优先改为双资源 + CSS 选择

- StaticWallpaper 的全局静态背景。
- Landing 的 wallpaper demo 图片。
- 首屏可见的 light/dark 图片。
- Pattern 预览的颜色和 active 视觉。
- 任何 `backgroundImage: isDark ? ... : ...` 或 `src={isDark ? ... : ...}` 的首屏路径。

### 7.3 需要标记为局部 overlay/demo 的路径

局部 demo 或 overlay 可以继续拥有自己的视觉配置，但必须明确它们不是全局主题来源，也不能参与首次主题解析。

## 8. 目标架构

```text
用户偏好
  └─ themeMode cookie（唯一持久化来源）

SSR
  ├─ 返回 light/dark wallpaper 配置
  ├─ 返回 SSR fallback seed
  ├─ 所有纳入范围的宿主都输出 html[data-theme] / html[data-theme-mode] seed
  └─ 输出主题无关或 CSS 双分支 markup

pre-paint script
  └─ 读取 themeMode + matchMedia，写入 html[data-theme]

ThemeStoreProvider
  └─ 只读取 html[data-theme] 一次，初始化 Theme Store

业务组件
  └─ 只使用 useTheme()，不读取 firstPaint/storage/matchMedia

首屏视觉
  └─ CSS 根据 html[data-theme] 选择 light/dark

运行时
  ├─ ThemeMonitor 只监听 system 变化
  └─ useTheme() 处理用户主动切换和 GPU 行为
```

## 9. 实施顺序

以下步骤已按顺序完成；Apply、Inspire-me 和 Widget 的范围保持非目标约束。

1. 已定义统一的 `themeMode` 持久化协议：cookie 是唯一持久化来源，并按环境设置统一 `Domain`；不读取或迁移历史 localStorage 数据；删除 `RESOLVED_THEME_COOKIE` 常量及其所有写入。
2. 已把 Core、Dash、Community 的 pre-paint 解析和 runtime seed 收敛到同一套宿主脚本协议。
3. 已让 ThemeStoreProvider 成为唯一的 pre-paint → store 桥接点，移除 route 的重复解析。
4. 已收窄 ThemeMonitor：不负责首次解析，只保留可动态挂载/卸载的 system 监听；同时删除 first-paint 变量快照的清理职责及遗留实现。
5. 已清理 Landing wallpaper 图片的 React/inline 主题分支，改为双资源 + CSS 选择。
6. 已处理 Pattern active 状态，SSR 不输出依赖错误主题分支的 active 结果。
7. 已审计 `useTheme()` 消费点，保留 GPU、Canvas、第三方控件和用户交互所需的 client 行为。
8. 已补契约测试：SSR seed、pre-paint 结果、Provider 初始 store、system 切换、cookie 写入/读取、`resolvedTheme` 禁写和无 localStorage 路径。

## 10. 验收标准

- SSR wallpaper payload 始终同时包含 light/dark 分支；不能只返回当前主题的一份。
- 所有纳入范围的宿主 SSR 都输出 seed 属性；Landing 不再依赖脚本运行后才补写根节点属性。
- 首屏主题只由 pre-paint script 解析一次，Provider 直接采用该结果。
- 首次 hydration 不会因为 ThemeMonitor 再次读取 storage 而改写主题。
- 首屏关键图片、静态壁纸和 pattern 视觉不依赖 React 的 light/dark inline 分支。
- `themeMode` 与当前 `theme` 在命名和持久化上保持明确区分。
- overlay 配置继续使用产品已有的 overlay 字段和 token/variant，不复制一套全局主题 token。
- Landing、Dash、Community 不再各自维护一份不同语义的主题初始化协议。
- runtime seed 由统一脚本注入，不再同时维护 `prePaintInitTime` 和多份 `prePaintRuntimeSeedScript`。
- 用户主动切换主题仍然能更新 DOM、Theme Store、CSS 和 GPU renderer。
- ThemeMonitor 从显式主题切换到 `system` 后会重新挂载监听，离开 `system` 后会卸载监听。
- Cookie Domain 优先使用 `VITE_THEME_COOKIE_DOMAIN`，未知 host 不会静默伪装成共享域名。

## 11. 非目标

- 不要求服务端猜测用户最终是 light 还是 dark。
- 不把所有 `useTheme()` 替换成 CSS；GPU、Canvas、第三方控件和交互行为仍需要运行时主题。
- 不把 overlay 配置改造成第二套全局主题系统。
- 不通过单个组件 fallback 掩盖主题事实源重复的问题。
