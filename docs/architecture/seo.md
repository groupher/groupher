# 搜索索引与规范 URL

> 状态：架构约定
>
> 更新：2026-09-05

Groupher 按产品、安全和运行时边界划分域名。搜索引擎优化不要求把所有应用放进
`groupher.com` 的路径下；需要统一的是公开内容的发现入口和规范 URL。

## 域名职责

| 入口                       | 职责                      | 索引策略                                 |
| -------------------------- | ------------------------- | ---------------------------------------- |
| `groupher.com`             | 官网与平台托管的公开社区  | 允许索引                                 |
| 社区自定义域名             | 对应社区的公开内容        | 允许索引，并服从唯一 canonical 合同      |
| `community.groupher.com`   | Community Worker 部署源站 | 除 `/health` 外不提供公开页面            |
| `dash.groupher.com`        | 已认证的社区管理后台      | 全站 `noindex, nofollow`，不提供 sitemap |
| `auth.groupher.com`        | 登录、OAuth 与 Session    | 不作为搜索内容入口                       |
| `apply.groupher.com`       | 社区申请流程              | 按公开入口和私有状态页分别治理           |
| `inspire-me.groupher.com`  | 内部反馈研究工具          | 全站 `noindex, nofollow`                 |
| API、Assets 与执行服务域名 | 机器接口和静态资源        | 不作为搜索内容入口                       |

`robots.txt` 不得用 `Disallow` 代替 `noindex`。需要退出索引的 HTML 应保持可抓取，
并同时返回 `<meta name="robots" content="noindex, nofollow">` 和
`X-Robots-Tag: noindex, nofollow`。

## Sitemap 结构

最终发现入口应为：

```text
groupher.com/sitemap.xml
  |-- 官网公开页面：/、/pricing、/book-demo
  |-- 平台托管且允许索引的社区
  `-- 各社区公开内容 sitemap

groupher.com/<community>/sitemap.xml
custom-domain.example/sitemap.xml
```

当社区数量或 URL 数量超过单个 sitemap 的维护边界时，根入口改为动态 sitemap index，
引用官网 sitemap 和各社区 sitemap。管理后台、认证、申请状态、内部工具、API 和部署源站
不得进入 sitemap。

静态 `lastmod` 只在能够根据真实内容更新时间持续更新时输出；不得保留手写的历史时间。

## 社区 canonical 合同

每个公开社区在同一时刻只能有一个权威 origin：

1. 未配置自定义域名时，`https://groupher.com/<community>/*` 是 canonical。
2. 配置并启用自定义域名后，自定义域名成为 canonical。
3. 平台路径应跳转到已启用的自定义域名；若迁移阶段暂时不能跳转，所有页面、sitemap、
   RSS、Open Graph URL 和公开 Markdown 输出仍必须统一指向自定义域名。
4. `community.groupher.com` 只是部署源站，不参与 canonical 选择。
5. 社区关闭 SEO 时，页面继续输出 `noindex`，且不得进入任何 sitemap。

## 实施边界

- Landing 拥有官网 sitemap 入口。
- Community/Press 根据公开 Scope 生成社区 sitemap 和公开内容 URL。
- Phoenix 保存社区 SEO 开关、自定义域名状态和权威业务数据。
- Edge Router 保持浏览器可见 host，部署源站不得泄漏为公开 URL。
- 新增公开页面或新产品域名时，必须同时确定 canonical、robots、sitemap 和公开分享 URL。
