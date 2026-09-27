# Article View Cloudflare 防滥用待办

> 文档角色：Backlog；不定义当前 Active runtime contract
>
> 日期：2026-09-26
>
> 当前计数协议：[Article View 计数写链路](./article-view-counting.md) ·
> 当前公共入口：[Cloudflare 公共入口架构](../../deploy/cloudflare.md)

本文记录 Article View tracking 在 Cloudflare 边缘层仍需完成的限流、Bot 信号、origin 收口与观测工作。
这些事项不阻塞当前同步计数协议，也不应被实现成 ViewTracker 内部的第二套计数规则。

## 1. 当前边界

当前浏览器通过同源 `POST /api/graphql` 调用 `trackArticleView`：

```text
browser
  -> groupher.com/api/graphql
  -> edge-router
       JSON + CSRF proof validation
  -> https://api.groupher.com/graphiql
  -> Phoenix ViewTracker
```

当前尚未完成：

- `/api/graphql` 或 `trackArticleView` 专项的边缘限流；
- 可传入 Phoenix 的可信 verified crawler/bot evidence；
- `api.groupher.com` 或其他 Fly 入口不能绕过 Cloudflare 的 origin 限制；
- rate-limited、direct-origin bypass 和真实突发流量的生产验收；
- 限流命中率、误伤率、origin 请求下降量与告警。

CSRF proof 只保护浏览器跨站请求边界，不证明请求来自人类，也不是防止脚本直接调用 mutation 的限流机制。
ViewTracker 的 viewer/article 去重只约束一个已识别 identity，不能阻止攻击者清 Cookie、创建新匿名会话或直接制造大量
不同 identity。

## 2. 先决调查

- [ ] 确认生产 Cloudflare 套餐，以及 Rate Limiting Rules 可使用的表达式字段、计数 characteristics 和请求体能力。
- [ ] 从 Workers Logs、Phoenix telemetry 和数据库写入量建立至少一轮正常流量基线：每分钟 tracking 请求、唯一 IP、
      唯一 anonymous Session、`counted`、`duplicate_in_window`、`excluded_by_policy`。
- [ ] 记录正常用户可能产生的突发：页面刷新、多个 tab、移动网络切换、SSR/hydration 重试和客户端一次 retry。
- [ ] 枚举全部可达 origin：`api.groupher.com`、Fly 默认域名、preview/版本 URL 以及运维探针。
- [ ] 决定限流失败策略。边缘限流只承担防滥用，不能成为精确 views 计数或账务来源。

在完成基线前不写死生产阈值。阈值应由真实分布和可接受误伤率决定，而不是复用 ViewTracker 的 10 分钟业务去重窗口。

## 3. 入口限流方案

### 3.1 第一层：GraphQL 入口兜底

- [ ] 在 Cloudflare Rate Limiting Rules 中为平台根域的 `/api/graphql` 建立宽松的 IP/NAT 级兜底规则。
- [ ] 只把它作为异常洪峰保护；当前 `/api/graphql` 承载所有 GraphQL 操作，阈值不能按普通 view 频率设置。
- [ ] API 请求超过阈值时返回可观测的 `429`，不要依赖需要浏览器交互的 challenge 页面。
- [ ] 明确 verified bots、内部探针和服务调用是否需要例外，并验证例外不会放开普通匿名流量。

### 3.2 第二层：View tracking 精确限流

需要在以下两种边界中做出选择：

```text
Option A: edge-router 检查 GraphQL operation
  优点：不增加公开 endpoint
  风险：只检查 operationName 可被改名绕过；完整解析 GraphQL 会增加边缘复杂度

Option B: 独立 POST /api/views/track
  优点：路由、限流、日志和返回码边界清楚
  代价：需要调整前端与 Phoenix 的公开接口
```

- [ ] 形成 ADR，选择精确限流边界；不要把“匹配客户端声明的 operationName”当作安全边界。
- [ ] 若使用 Workers Rate Limiting binding，按防滥用维度设计 key，并记录其按 Cloudflare location、宽松且最终一致的语义。
- [ ] 至少保留 IP 级约束；anonymous Session 只能作为附加维度，不能单独使用，因为客户端可以清 Cookie。
- [ ] 已登录账户和 service agent 的阈值与匿名浏览器分开评估。
- [ ] 验证合法请求被限流时不会本地乐观增加 views，也不会形成无界重试。

## 4. Bot、Crawler 与 Agent 信号

- [ ] 评估当前套餐可提供的 Verified Bot、Super Bot Fight Mode 或 Bot Management 信号。
- [ ] 不使用 User-Agent 自报作为 verified crawler 证据。
- [ ] edge-router 必须删除客户端传入的同名内部 actor header，再写入自己的可信 evidence。
- [ ] Phoenix 只接受经过认证的 edge evidence；公开 header presence 不能直接构造 `crawler_family`。
- [ ] verified crawler 继续由 ViewTracker policy 排除，不因为 crawler 可以访问公开内容而计入 views。
- [ ] service agent 使用独立的 view tracking scope；Bot 分类不能替代 service credential 验证。
- [ ] 验证搜索引擎抓取、AI crawler、正常浏览器、headless browser 和直接 HTTP mutation 的行为矩阵。

## 5. Origin 收口

边缘规则只有在所有公网流量都必须经过 Cloudflare 时才有效：

```text
Internet
   -> Cloudflare edge-router / WAF
   -> authenticated origin path
   -> Phoenix

Internet --------------------------X-> Phoenix direct origin
```

- [ ] 在 Cloudflare Tunnel 与 Authenticated Origin Pulls 之间评估适合当前 Fly 部署的方案。
- [ ] 若 origin TLS 终止层不能校验 AOP 客户端证书，不把 AOP 写成已完成方案。
- [ ] 若使用 Tunnel，确认 Phoenix health、发布、回滚、WebSocket/长连接和运维访问路径。
- [ ] 关闭或限制 Fly 默认公网域名；不能只隐藏 DNS 记录。
- [ ] 从外网直接访问每个已知 origin URL，确认请求失败；通过 `groupher.com/api/graphql` 的正常请求仍成功。
- [ ] origin 收口完成前，不信任可由直连请求伪造的 `CF-Connecting-IP` 或内部 actor header。

## 6. 观测与分阶段发布

- [ ] Edge 日志记录 `routeClass`、限流规则/namespace、结果、状态码和 Cloudflare Ray ID；不记录原始 Cookie、token 或
      viewer tracking key。
- [ ] 建立 allowed、limited、origin reached、Phoenix counted/duplicate/excluded 的漏斗指标。
- [ ] 对限流命中激增、origin 请求异常和数据库 ViewTracker 写入异常分别告警。
- [ ] 先运行观察模式或足够宽松的阈值，确认正常流量分布后再启用 block。
- [ ] 为规则、Worker binding 和 origin 收口分别准备可独立执行的回滚步骤。
- [ ] 发布后验证真实匿名用户、登录用户、service agent、verified crawler、普通 bot 和 direct-origin 六类链路。

## 7. 完成定义

以下条件全部满足后，本 backlog 才能关闭：

- [ ] `trackArticleView` 有明确且经过流量基线验证的边缘限流边界；
- [ ] 限流不会被修改 GraphQL operation name、清 Cookie 或直连 origin 轻易绕过；
- [ ] crawler evidence 只能来自可信 verifier，伪造公开 header 会 fail closed；
- [ ] 公开 Phoenix origin 不能绕过 Cloudflare；
- [ ] 生产日志和指标能区分正常 duplicate、policy exclude、edge limited 与 origin/backend failure；
- [ ] 自动测试覆盖限流、重试、header 伪造和 direct-origin 失败，生产 smoke 覆盖真实 Cloudflare 配置；
- [ ] 当前计数协议文档更新为已完成状态，并附上规则、阈值依据和回滚入口。

## 8. Cloudflare 官方参考

- [Rate Limiting Rules](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Authenticated Origin Pulls](https://developers.cloudflare.com/ssl/origin-configuration/authenticated-origin-pull/)
