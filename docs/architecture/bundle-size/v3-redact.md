# Frontend Bundle Size V3：React 与 Redact 同源码对比

> 记录日期：2026-10-29。基准提交：`0398079194`。五个 TanStack Start 应用分别使用
> 切换前的 React Vite 配置和当前 Redact Vite 配置构建；应用源码、依赖和锁文件均保持
> 同一提交的内容。此表衡量运行时替换对当前代码的影响，不是将两个历史提交的产物相减。

## Client assets

统计 production build 的
`frontend/<app>/.cloudflare/output/v0/workers/default/assets/assets` 中全部 JS/CSS 文件。
每个文件独立压缩后求和，不含图片、字体、HTML、server bundle 或 revision worker。
负数表示 Redact 产物更小。

| 应用       | React 文件数 | Redact 文件数 |  React gzip | Redact gzip | gzip 差值 | gzip 变化 | React Brotli | Redact Brotli | Brotli 变化 |
| ---------- | -----------: | ------------: | ----------: | ----------: | --------: | --------: | -----------: | ------------: | ----------: |
| Landing    |           42 |            46 |   538,905 B |   492,359 B | -46,546 B |     -8.6% |    455,711 B |     417,019 B |       -8.5% |
| Dash       |          338 |           346 | 1,857,080 B | 1,805,649 B | -51,431 B |     -2.8% |  1,534,841 B |   1,491,523 B |       -2.8% |
| Community  |           97 |           109 | 1,040,236 B |   994,822 B | -45,414 B |     -4.4% |    852,689 B |     816,030 B |       -4.3% |
| Apply      |           20 |            20 |   250,994 B |   204,121 B | -46,873 B |    -18.7% |    206,804 B |     167,490 B |      -19.0% |
| Inspire-me |            5 |             6 |   118,152 B |    72,535 B | -45,617 B |    -38.6% |    102,556 B |      65,219 B |      -36.4% |

| 应用       |   React raw |  Redact raw |   raw 差值 |
| ---------- | ----------: | ----------: | ---------: |
| Landing    | 2,398,787 B | 2,211,633 B | -187,154 B |
| Dash       | 6,724,673 B | 6,466,116 B | -258,557 B |
| Community  | 3,922,977 B | 3,723,829 B | -199,148 B |
| Apply      | 1,478,572 B | 1,311,295 B | -167,277 B |
| Inspire-me |   376,060 B |   211,289 B | -164,771 B |

五个应用的 gzip 绝对差值接近，约 45–51 KB；百分比差异主要来自各应用总产物大小
不同。这里统计了所有路由 chunk，因此不能将表中的数值称为首屏下载量，也不能直接
推断页面加载速度。旧版 [`v2.md`](./v2.md) 是 2026-08-27 的历史快照，不能作为本表的
React 对照组。

## 复现方法

1. 在 `0398079194` 安装锁文件依赖。对每个应用，先以该提交的源码和依赖、
   `origin/dev:frontend/<app>/app.config.ts` 的 React 配置执行
   `pnpm build:prod:<app>`；再恢复该提交的 Redact 配置，执行相同命令。
   构建结果依次记录，避免后一次构建覆盖前一次产物。五个应用的两个构建均成功。
2. 遍历上述 `assets/assets` 目录，仅纳入 `.js` 和 `.css` 文件。raw 为文件字节数之和；
   gzip 为 Node `zlib.gzipSync(file, { level: 9, mtime: 0 })` 的逐文件结果之和；
   Brotli 为 Node `zlib.brotliCompressSync(file)` 默认参数的逐文件结果之和。
3. 差值按 `Redact - React` 计算；变化率按 `差值 / React` 计算，显示到一位小数。

此测量不包含 CDN 压缩设置、浏览器缓存、路由预加载或真实网络 waterfall。
