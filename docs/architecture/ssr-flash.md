# TanStack Start SSR 首屏样式闪烁

## 结论

Dash 刷新时的主要闪烁不是业务页面先渲染了一套错误 class，也不是主题脚本执行太晚，而是共享 Tailwind 入口使用了过宽的 `@source`：

```css
@source '../..';
```

该路径覆盖整个 `frontend/`。Tailwind 在生成 Dash 的 SSR stylesheet 时，不仅扫描 class，还把其他子应用和实验页面的 CSS 模块带进了服务端首屏样式。浏览器水合后，Vite 用客户端真实的 `global.css` 替换 SSR `<link>`，错误 CSS 随之消失，于是字体、页面边距、容器尺寸和背景在一帧内整体跳变。

同时还存在两个会放大或伪装首屏问题的独立缺陷：

1. `system` 主题在 pre-paint 脚本中已经解析为实际明暗主题，但水合 Store 仍可能使用服务端 fallback，导致 DOM 与 Store 首帧不一致。
2. TanStack Query SSR streaming 的传递依赖版本不一致，旧版 `router-ssr-query-core` 会在流结束时尝试 hydrate `undefined`，产生 `Error reading query stream`。它不是布局闪烁的直接原因，但会制造额外水合噪声。

## 可见症状与证据

问题发生在“SSR stylesheet 被客户端 stylesheet 接管”的边界，而不是页面稳定后的最终状态。因此只看刷新完成后的截图无法定位。

修复前，对刷新过程逐帧采样可观察到：

- 字体从 `Inter` 切换为系统字体；
- 主容器从约 `x=16, width=1168, top=48` 跳到 `x=0, width=1200, top=0`；
- 页面背景和内容区域同步变化；
- SSR stylesheet 中可找到 `inspire-me/src/styles/global.css` 和 `core/render/BgRenderer/vgpu-poc/style.css` 的来源标记。

修复后，SSR `<link>` 仍会被 Vite 的客户端 `<style>` 接管，这是 TanStack Start 开发模式的正常行为；但接管前后字体、主题、背景和容器几何值保持一致，180 帧刷新采样未再出现布局跳变。

## 修复

### 1. 限制 Tailwind source 为代码文件

共享入口只扫描真正承载 Tailwind class 的 `ts/tsx`，不再递归吞入任意 CSS：

```css
@source '../**/*.{ts,tsx}';
@source '../../apply/src/**/*.{ts,tsx}';
@source '../../community/src/**/*.{ts,tsx}';
@source '../../dash/src/**/*.{ts,tsx}';
@source '../../inspire-me/src/**/*.{ts,tsx}';
@source '../../landing/src/**/*.{ts,tsx}';
@source '../../widget/src/**/*.{ts,tsx}';
```

这里仍然扫描各子应用的 class，以保留共享构建所需的 utility；关键约束是 source 必须是代码文件，不能是包含应用局部 CSS 的宽泛目录。

### 2. 以 pre-paint DOM 主题初始化水合 Store

主题真值顺序为：

1. Dash/Community 的公共 SSR 与 Landing 静态 SSR 都输出稳定的浅色 `system` seed，避免共享缓存按用户主题分叉；
2. `<head>` 中的同步脚本在首次绘制前根据 cookie、localStorage 或系统偏好解析实际主题，更新 DOM dataset；
3. 客户端创建 Theme Store 时读取已经解析过的 DOM dataset；
4. dataset 无效或服务端执行时才回退到 SSR seed。

Dash、Community 与 Landing 都必须遵守这条链路。否则系统为暗色、服务端 fallback 为浅色时，水合 Store 会短暂把正确 DOM 覆盖回浅色。

### 3. 在 workspace 根部收敛 TanStack 运行时版本

`pnpm-workspace.yaml` 使用 `overrides` 固定：

```yaml
overrides:
  '@tanstack/query-core': 5.102.8
  '@tanstack/react-query': 5.102.8
  '@tanstack/router-ssr-query-core': 1.169.2
```

Dash 和 Community 的直接 `query-core` 依赖同步到 `5.102.8`。`overrides` 负责约束传递依赖，避免每个 workspace 根据各自 range 得到不同的 Query runtime。若后续要统一所有子应用清单中的声明文本，可再引入 pnpm `catalog:`；但 catalog 不能替代 overrides 对传递依赖的强制收敛。

## 子应用审计

| 应用       | 样式入口                                             | SSR Query streaming | 审计结论                                                                                                                                                                  |
| ---------- | ---------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dash       | 共享 `core/tailwind/global.css`                      | 有                  | 已实际复现 CSS 串入和 stylesheet 接管闪烁；已修复。pre-paint DOM 与 Theme Store 也已对齐。                                                                                |
| Community  | 共享 `core/tailwind/global.css`                      | 有                  | 原宽泛 source 下具有相同 CSS 串入风险，共享修复已覆盖；另发现 Theme Store 未使用 pre-paint DOM 真值，已补齐并加测试。Query streaming 由根 overrides 同步修复。            |
| Apply      | 共享 `core/tailwind/global.css`，另有应用 domain CSS | 无                  | 原宽泛 source 下具有相同 CSS 串入风险，共享修复已覆盖；没有 Query streaming EOF 问题，也没有 system 主题接管链路。                                                        |
| Landing    | 共享 `core/tailwind/global.css`，另有应用 domain CSS | 无                  | 原宽泛 source 下具有相同 CSS 串入风险，共享修复已覆盖；另发现 Theme Store 未使用 pre-paint DOM 真值，已补齐并由共享 first-paint 测试覆盖。没有 Query streaming EOF 问题。 |
| Inspire Me | 独立 `src/styles/global.css`                         | 无                  | 不消费共享 global CSS，不是该串入问题的受害者；它的局部 global CSS 曾被共享宽泛 source 错误带入 Dash 等应用。自身 source 已限定为 `ts/tsx`。                              |
| Widget     | 独立 runtime CSS                                     | 无                  | 只参与共享 utility class 扫描，不在这些 TanStack Start 宿主的 SSR stylesheet 接管链路中，没有同类首屏问题。                                                               |

因此，共享 source 缺陷的影响范围不是只有 Dash：Community、Apply、Landing 都属于潜在受影响方。一次修复共享入口比在各应用里覆盖错误样式更可靠。

## 验证方式

必须同时覆盖静态边界和真实刷新过程：

1. 检查生成的 SSR stylesheet，不应出现其他应用局部 CSS 的路径标记。
2. 在真实浏览器中逐帧记录 `document.fonts`、`data-theme`、背景色和关键容器的 `getBoundingClientRect()`。
3. 明确记录 SSR `<link>` 被客户端 `<style>` 替换的时刻，比较替换前后 computed style，而不是只看最终截图。
4. 运行 Dash、Community、Apply、Landing、Inspire Me 的类型检查/构建，以及 first-paint 回归测试。
5. 用 `pnpm why` 确认 `query-core`、`react-query`、`router-ssr-query-core` 各只有一个实际版本。

本次修复的实际结果：

- Dash、Community、Apply、Landing、Inspire Me 类型检查通过；
- 五个 TanStack 子应用生产构建通过；
- Dash、Community 与共享 Core 的 first-paint 回归测试通过；
- Community、Apply、Landing、Inspire Me 的构建产物未发现 Inspire Me global CSS 或 VGPU POC CSS 串入标记；
- pnpm 解析树中 `query-core@5.102.8`、`react-query@5.102.8`、`router-ssr-query-core@1.169.2` 均只有一个版本。

## 防回归规则

- Tailwind `@source` 只指向代码扩展名；禁止用应用根目录或 `frontend/` 级目录作为 source。
- 应用局部的 `global.css`、domain CSS 和实验 CSS 必须由对应应用显式 import，不能依赖共享扫描发现。
- SSR pre-paint 脚本改过 DOM 后，客户端 Store 必须从同一 DOM seed 初始化。
- React Query hydration 相关包按单例运行时管理；升级 Router、Query 或 SSR adapter 时一起检查解析树。
- 修改后必须确认真正重启的是当前进程。孤儿 Vite 进程继续占用端口时，浏览器看到的仍是旧代码，会让有效修复看起来“完全没变化”。
- SSR 闪烁回归以帧级 computed style 和布局几何为准，不以稳定后的单张截图为准。
