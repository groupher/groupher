# Community 讨论列表首屏 SSR 修复

状态为工作区已实施，待远端 CI。记录日期为 2026-11-25，维护范围归 Community 路由与 Core 分页。长期行为见[分页架构合同](../architecture/pagination.md)。

## 回归与修复

默认打开 `/home/post` 时，父路由已取得 Dash 配置。文章 loader 因无法读取浏览器宽度跳过查询，Provider 又因布局未就绪返回空占位。修复前原始 HTML 冒烟实测 1 通过、2 失败；只有显式第一页通过。新增 SSR lint 当时在文章、主评论和看板各报告一处违规。

当前父路由把请求设备提示传给 loader 和 React Provider。文章、更新日志、主评论和看板复用同一选择。讨论列表 HTTP 冒烟验证 SSR 输出的帖子链接、模式和缓存头，主评论另有查询层测试。文章公开参数 `pagiApi` 已移除。有效 after 在 PAGE 模式下仍使用 cursor 读取，提供返回分页列表的入口。无效位置回到首批并保留筛选，浏览器接管后清除失效位置。

所有经过社区父路由的文档响应禁用共享缓存，当前边缘 HTML 缓存命中受到影响。后续若开放共享缓存，须先在实际边缘环境完成同一 URL 的移动、桌面交替请求验证。调整窗口大小不会触发位置恢复。

## 本地测试准备

浏览器用例需要 Playwright Chromium，首次运行先执行 `pnpm exec playwright install chromium`。使用本机 Chrome 时可设置 `PLAYWRIGHT_USE_SYSTEM_CHROME=1`。CI 安装 Chromium 后运行同一套测试。

2026-11-26 的浏览器网络检查显示，从恢复后的帖子列表修改排序时，会发起一次 `loadCommunityRequestContext` server function 请求。当前实现保留该请求，后续可评估请求级设备选择的缓存方式并测量导航延迟。2026-11-26 本机开发服务双 worker 抽样中，失效链接首个 goto 约 3.8 秒，URL 收敛约 8.5 秒；分享链接的返回入口就绪约 8.3 秒，点击到列表可见约 0.8 秒。导航期间观察到开发模块请求被中止及一次 ECONNRESET，该样本不足以归因全部慢请求，生产构建和真实后端延迟未测量。

## 验收记录

| 命令                                                                                                                                                                                                                                                                                                   | 本地结果与覆盖                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CI=true pnpm test:ssr:community`                                                                                                                                                                                                                                                                      | 本机使用系统 Chrome 实测 14 项通过。HTTP 用例检查不同设备提示、旧位置、原始 HTML 链接和 no-store。浏览器用例检查恢复后的 URL、排序、刷新、返回分页、页码切换保留 hash 及窄屏。默认页直接返回 200。 |
| `pnpm --filter @groupher/frontend-community run lint`                                                                                                                                                                                                                                                  | 通过。SSR 入口禁止直接读取浏览器宽度、使用 window.matchMedia 和导入已知浏览器分页 helper。                                                                                                         |
| `pnpm --filter @groupher/frontend-community run type-check`                                                                                                                                                                                                                                            | 通过。                                                                                                                                                                                             |
| `pnpm exec vitest --config frontend/core/vitest.config.mts run frontend/community/src/components/ArticlePageBoundary.test.tsx frontend/community/src/query/articleSurface.test.ts frontend/core/hooks/useArticlesFilter/index.test.tsx frontend/core/unit/ChangelogThread/Surface.pagination.test.tsx` | 当前命令输出 23 项，覆盖恢复边界、列表查询、筛选和更新日志分页。                                                                                                                                   |

另以本地 Dev Hub 真实社区地址 `https://community.groupher.localhost/home/post` 验证了两次 HTTP 请求。设备提示 `?0` 和 `?1` 分别返回 PAGE 与 INFINITE_SCROLL，两份原始 HTML 都包含帖子详情链接，响应头均为 `private, no-store`。Community 源码测试 46 项通过，生产构建通过。

CI 的 Build community job 先构建生产包，再运行独立的 Vite 开发服务和 GraphQL mock 做 HTTP 和浏览器冒烟。用例失败使该 job 失败。生产 Worker 部署、CDN、真实 Phoenix 数据以及更新日志、主评论和看板的整页 HTML 未在这组冒烟中验证。
