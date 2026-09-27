# RequestActor 公共请求主体分类

> 状态：公共分类、account/anonymous/service/delegation request context 接线与 View conditional scope 已落地；可信 crawler
> evidence、Edge/origin 收口和生产分类观测仍是剩余项。
>
> 本文定义 `GroupherServer.RequestActor` 平台能力。它只判断“当前请求主体属于哪一类”，不包含 ViewTracker、
> Analysis、权限、限流、内容选择或其他业务规则。

## 1. 结论

请求主体分类必须是平台级公共能力，不能继续归 `CMS.ViewTracker.Classifier`：

```text
trusted request inputs
        │
        v
GroupherServer.RequestActor.classify/1
        │
        v
%RequestActor.Classification{}
        │
        ├─ CMS.ViewTracker       阅读 identity、去重和 counted policy
        ├─ Analysis             actor dimension
        ├─ RateLimit            bucket policy
        ├─ ContentPresentation  representation policy
        └─ future consumers     只消费同一分类结果
```

公共 API 使用完整业务名称，不暴露 `RequestEvidence`、signal bag 或 verifier 等内部抽象：

```elixir
RequestActor.classify(
  account_session: account_session,
  anonymous_session: anonymous_session,
  service_credential: service_credential,
  delegation: delegation,
  crawler: crawler
)
```

返回：

```elixir
{:ok,
 %RequestActor.Classification{
   type: :human,
   is_authenticated: true,
   confidence: :verified,
   classified_by: :account_session
 }}
```

调用方不能直接传入 `actor_type: :agent`、`confidence: :verified` 或 `classified_by` 来指定结论。

这里的 `verified` 表示“分类所依赖的 credential/session/provider signal 已验证”，不是“已经证明请求背后一定是自然人”。
账号 session 也可能被自动化工具使用；RequestActor 是统一分类边界，不是 CAPTCHA、风控或反滥用系统。高风险操作仍由
Gate、RateLimit、Turnstile/挑战和领域 policy 独立决定。

## 2. 模块边界

```text
GroupherServer.RequestActor
├─ Classification       唯一公共输出结构
├─ Const                actor type、confidence、classified_by 封闭词表
├─ Evidence             内部封闭 union 与冲突选择
└─ Classifier           内部分类映射和 fallback
```

可信输入由平台 request authentication 边界产生：

```text
AuthSession.verify
AnonymousSession.verify
ServiceAuth.verify
Delegation.verify
CrawlerVerifier.verify
  -> verified business objects
  -> RequestActor.classify/1
```

ViewTracker、Analysis 等领域消费者只依赖：

```text
RequestActor.classify/1
RequestActor.Classification
RequestActor.Const
```

verifier 可以演进，但只能由统一 request entry 调用，不能成为 ViewTracker、Analysis 或 resolver 各自调用的第二套分类入口。

`Evidence` 也不是公共 API。调用方使用上面的完整业务参数；RequestActor 内部才将已验证输入收敛为恰好一个：

```text
AccountSession | AnonymousSession | ServiceCredential | Delegation | Crawler | Unknown
```

因此“typed evidence”与“公共 API 不暴露 Evidence”并不冲突：前者约束 RequestActor 内部不能靠 optional 字段优先级猜测，后者
约束 resolver 和领域模块不能伪造可信分类。

### 2.1 RequestActor 拥有

- `human | agent | crawler | unknown` 的分类词表；
- `verified | probable | unknown` 的 confidence 词表；
- `account_session | signed_anonymous_session | agent_credential | delegation_credential | verified_crawler |
self_reported | fallback` 的来源词表；
- 已验证输入的互斥选择、分类优先级与 fallback；
- request context 中唯一的 `RequestActor.Classification`；
- 无可信信号时 fail-closed 为 `unknown`。

### 2.2 RequestActor 不拥有

```text
viewer_tracking_key
read_purpose
是否 counted
滑动窗口和去重
ViewEvent / MetricEvent
权限和 Gate
RateLimit 阈值
内容 representation
CDN cache policy
```

这些由消费分类结果的领域自己决定。RequestActor 不能因为某个调用方是 agent 就授予权限、计入 views 或返回不同内容。

## 3. 分类规则

优先级固定为：

```text
valid delegation + required audience/scope
  -> agent

valid service credential + required audience/scope
  -> agent

authenticated account session
  -> human

verified crawler
  -> crawler

valid signed anonymous session
  -> human

only User-Agent / unverified self report
  -> unknown

no trustworthy input
  -> unknown
```

如果同一请求同时携带冲突的可信身份，例如 agent credential 与不匹配的 delegation，必须返回分类错误，不能静默选择
对调用方更有利的类型。

| 输入                            | type      | authenticated | confidence | classified_by            |
| ------------------------------- | --------- | ------------- | ---------- | ------------------------ |
| 有效账号 session                | `human`   | true          | verified   | account_session          |
| 有效匿名签名 session            | `human`   | false         | probable   | signed_anonymous_session |
| 有效 service credential，无用户 | `agent`   | false         | verified   | agent_credential         |
| 有效 delegation，代表用户       | `agent`   | true          | verified   | delegation_credential    |
| verified crawler                | `crawler` | false         | verified   | verified_crawler         |
| 只有 User-Agent 自报            | `unknown` | false         | probable   | self_reported            |
| 无可信信号                      | `unknown` | false         | unknown    | fallback                 |

## 4. 可信输入边界

### 4.1 Human

- authenticated human 只来自已经验证的 Groupher account session；
- anonymous human 只来自 Phoenix 签发并验证的 first-party signed session；
- 不能使用 IP、IP + User-Agent、canvas、字体或设备属性生成稳定身份；
- Cookie 无效、缺失或验证失败时降级为 `unknown`，不能自动当成可信 human。

### 4.2 Agent

- service credential 必须是 Groupher 签发、可撤销、带 audience/scope/expiry 的凭据；
- delegation 必须明确 delegator、delegate、audience、scope、expiry 和唯一 id；
- `is_authenticated` 表示是否绑定已验证 Groupher 用户，不表示 agent 本身是否提供了有效 credential；
- agent name、SDK header、User-Agent 或请求 body 中的 `actorType` 都不能证明 agent 身份；
- credential id、delegation id 和原始 token 不进入 `Classification` 公共输出或日志。

### 4.3 Crawler

- crawler 只有在反向 DNS 后正向确认，或命中受维护的官方 IP/平台验证结果时才是 `verified`；
- Gateway/Edge 传递 crawler 结果时，必须先删除外部伪造的内部 header，再添加带 timestamp、nonce、audience 和 body/request
  binding 的签名元数据；
- Phoenix 必须验证签名和有效期，不能仅信任 `X-*` header；
- 只有 User-Agent 命中 bot 名称时输出 `unknown + self_reported`。

反向/正向 DNS 或 provider IP 验证不能在每个 resolver 内同步重复执行。`CrawlerVerifier` 使用有界 timeout 和按 provider/IP
缓存的验证结果；timeout、DNS failure 或 cache miss 超出预算时返回 `unknown`，不能阻塞整个 GraphQL 请求，也不能降级为
“User-Agent 命中即 crawler”。

## 5. 请求生命周期

每个 HTTP/GraphQL 请求只分类一次：

```text
request
  -> verify account/anonymous/service/delegation/crawler inputs
  -> RequestActor.classify/1（内部 Evidence.select + Classifier）
  -> put RequestActor.Classification into request context
  -> resolvers and domains consume the same immutable classification
```

GraphQL resolver、ViewTracker producer 和 Analysis consumer 不能再次解析 User-Agent、Cookie 或 token。非 HTTP producer
使用同一个 `RequestActor.classify/1`，但必须提供相同的业务输入，不能自己构造 `Evidence` 或 `Classification` 冒充已验证结果。

验证失败与无凭证不是同一状态。无可信输入可以得到 `unknown/unknown/fallback`；无效 service/delegation/crawler credential
必须返回错误，不能静默降级成匿名或 unknown。

当 service credential 有效但 delegation credential 无效时，请求入口保留 service actor 仅供错误归因，同时写入
`delegation_auth_failure`，不得生成 service-only `request_actor`。所有 service-aware middleware 必须在任何 actor/scope 成功分支之前
拒绝该失败，避免同一请求以另一种身份继续执行。

## 6. ViewTracker 消费方式

```text
RequestActor.Classification
        │
        v
CMS.ViewTracker.Identity
  ├─ account/session/credential handle -> viewer_tracking_key
  └─ Classification -> event actor dimensions
        │
        v
CMS.ViewTracker.Policy
  └─ read_purpose -> counted / excluded
```

`viewer_tracking_key` 仍由 ViewTracker 使用独立 pepper 派生，不加入 `RequestActor.Classification`。RequestActor 回答“是谁的
类别”，ViewTracker 回答“这次阅读如何标识、是否去重、是否计数”。

## 7. 内容输出与缓存安全

分类结果不能隐式改变同一公共 CDN key 的 body：

```text
public browser HTML
  -> human / crawler / unknown 使用同一公开 representation 和 CDN key

agent structured output
  -> 明确 API、GraphQL operation 或 Accept contract
  -> 独立 cache namespace 或 no-store

personalized output
  -> private, no-store
```

如果未来确实需要 crawler-specific SEO HTML，必须使用独立 route 或可信的低基数 cache variant；禁止根据可伪造的
User-Agent 在同一 URL、同一 cache key 下返回不同 body。

RequestActor 分类不能替代 Gate。即使是 verified agent/crawler，也只能读取其授权和 public scope 允许的内容。

## 8. 配置、性能与观测

当前 service credential 的 issuer/audience/algorithm 继续由现有 ServiceAuth verifier 配置拥有；未来 crawler/Edge 参数应收口在
RequestActor 平台边界，不散落到 ViewTracker 或 consumer：

```text
agent credential issuer / audience / allowed algorithms
delegation audience / max lifetime
internal proxy signature keys / clock skew / nonce TTL
crawler provider records / verification timeout / cache TTL
classification telemetry sink
```

production 缺少必要 issuer、audience、签名 key 或 provider source 时启动失败；不能使用 development fallback secret。
密钥轮换允许同时验证明确的 current/previous key id，但输出仍只有一个 classification，不形成双分类路径。

每个 request 只做一次分类。账号 session 与 service/delegation credential 验证沿用 request authentication 已完成的结果；crawler
网络验证通过 bounded cache 隔离。telemetry 至少记录 type、confidence、classified_by、duration 和 failure category，不记录
Cookie、token、delegation id、IP 或 tracking key。高基数诊断信息只进入受控 trace，不进入 metric label。

## 9. 直接切换

本次改造不保留分类兼容层：

1. [x] 建立 `GroupherServer.RequestActor`、`Classification`、内部 `Evidence` 与 `Classifier`；
2. [x] 请求入口对 account、signed anonymous session、service 和 delegation 统一完成一次分类并写入 context；
3. [x] ViewTracker 改为接收 request-scoped `RequestActor.Classification`；
4. [x] `viewer_tracking_key` 与 counted policy 留在 ViewTracker；
5. [x] `trackArticleView` 保持对 browser/anonymous 开放，但 service/delegation 一旦出现就必须通过 conditional scope check；现有
       `ServiceScope` 的“service 必须存在”语义不能直接挂上。目标专用合同为 `aud=phoenix:view-api`、`scope=view:track`，并同步加入
       resource-server audience 配置；验证失败不得降级匿名；
6. [x] resolver 不再把 `token_id || subject` 压成 `agent_credential_id`/`delegation_id`，ViewTracker 只接收 request context 中唯一的
       `Classification` 与所需稳定 identity handle；
7. [x] schema/Analysis consumer 统一引用 `RequestActor.Const`，删除旧 Actor/ViewTracker classifier；
8. [x] 不保留 delegate、alias、双分类或 fallback 到旧模块；
9. [ ] 由独立 Cloudflare 待办接入 signed crawler evidence，并补生产分类 telemetry。

## 10. 验收

- account、anonymous session、agent credential、delegation 和 unknown 各有成功与失败测试；service/delegation 使用请求入口已验证
  的完整对象，crawler 仍只有内部类型测试，不代表生产 provider verifier 已接线；
- public `classify/1` 不接受 caller 构造的 `Evidence`；内部 typed Evidence 只能由 RequestActor 创建；
- 调用方传 `actor_type/confidence/classified_by` 不能影响分类结果；
- service/delegation 缺少 `view:track`、audience 错误或验证失败时拒绝 `trackArticleView`；普通 browser/anonymous 不因没有 service
  credential 被拒绝；
- 伪造内部 crawler/agent header 被忽略或拒绝；
- 冲突的可信身份 fail closed；
- User-Agent-only agent/crawler 永远不是 verified；
- [Cloudflare 待办] crawler provider timeout/DNS failure 在预算内返回 unknown，缓存命中不重复网络验证；
- 同一个 request 只分类一次，后续模块消费同一 immutable result；
- ViewEvent `Ecto.Enum`、ArticleInsights、Analysis.Const 和其他 schema/consumer 全部引用
  `RequestActor.Const`，repository 不再存在指向旧 `Actor.Const` 的 alias 或 values callback；
- ViewTracker 不再包含公共分类策略，RequestActor 不包含 tracking/counting 业务；
- Gate 授权不依赖 RequestActor 类型；
- public CDN body 不因 RequestActor 分类而变化；
- repository 不再存在 `GroupherServer.Actor.Const` 或 `CMS.ViewTracker.Classifier` 生产调用。
