# RequestActor 公共请求主体分类

> 状态：本次改造的目标架构，待实施。
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
  user: current_user,
  anonymous_session: anonymous_session,
  agent_credential: agent_credential,
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
├─ Classifier           内部优先级和 fallback
├─ AgentVerifier        内部 agent credential 验证
├─ DelegationVerifier   内部 delegation 验证
└─ CrawlerVerifier      内部 crawler 验证
```

外部模块只依赖：

```text
RequestActor.classify/1
RequestActor.Classification
RequestActor.Const
```

内部 verifier 可以演进，但不能成为 ViewTracker、Analysis 或 resolver 的第二套公共入口。

### 2.1 RequestActor 拥有

- `human | agent | crawler | unknown` 的分类词表；
- `verified | probable | unknown` 的 confidence 词表；
- `account_session | signed_anonymous_session | agent_credential | delegation_credential | verified_crawler |
self_reported | fallback` 的来源词表；
- 可信凭据验证与分类优先级；
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
valid delegation
  -> agent

valid agent credential
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
| 有效 agent credential，无用户   | `agent`   | false         | verified   | agent_credential         |
| 有效 agent credential，绑定用户 | `agent`   | true          | verified   | agent_credential         |
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

- agent credential 必须是 Groupher 签发、可撤销、带 audience/scope/expiry 的凭据；
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
  -> authenticate account/session
  -> verify agent/delegation/crawler inputs
  -> RequestActor.classify/1
  -> put RequestActor.Classification into request context
  -> resolvers and domains consume the same immutable classification
```

GraphQL resolver、ViewTracker producer 和 Analysis consumer 不能再次解析 User-Agent、Cookie 或 token。非 HTTP producer
使用同一个 `RequestActor.classify/1`，但必须提供相同的可信输入类型，不能自己构造 `Classification` 冒充已验证结果。

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

可调参数集中在 `RequestActor.Config`，不散落在 ViewTracker 或 consumer：

```text
agent credential issuer / audience / allowed algorithms
delegation audience / max lifetime
internal proxy signature keys / clock skew / nonce TTL
crawler provider records / verification timeout / cache TTL
classification telemetry sink
```

production 缺少必要 issuer、audience、签名 key 或 provider source 时启动失败；不能使用 development fallback secret。
密钥轮换允许同时验证明确的 current/previous key id，但输出仍只有一个 classification，不形成双分类路径。

每个 request 只做一次分类。账号 session 与 agent/delegation credential 验证沿用 request authentication 已完成的结果；crawler
网络验证通过 bounded cache 隔离。telemetry 至少记录 type、confidence、classified_by、duration 和 failure category，不记录
Cookie、token、delegation id、IP 或 tracking key。高基数诊断信息只进入受控 trace，不进入 metric label。

## 9. 直接切换

本次改造不保留分类兼容层：

1. 建立 `GroupherServer.RequestActor`、`Classification`、`Const` 和 verifier；
2. 请求入口统一完成一次分类并写入 context；
3. ViewTracker、Analysis 及其他消费者改为接收 `RequestActor.Classification`；
4. `viewer_tracking_key` 与 counted policy 留在 ViewTracker；
5. 将所有 schema/consumer 的词表引用同步重指到 `RequestActor.Const`：包括
   `backend/api/lib/groupher_server/cms/view_tracker/model/view_event.ex` 的 `Ecto.Enum values`、
   `backend/api/lib/groupher_server/analysis/article_insights.ex` 与
   `backend/api/lib/groupher_server/analysis/const.ex` 的 alias/consumer；数据库列仍是普通 string 且没有 check
   constraint，本项只切换应用层引用，因此无需数据库迁移；随后删除
   `GroupherServer.Actor.Const`、`CMS.ViewTracker.Classifier` 及所有直接传 `actor_type` 的生产调用；
6. 不保留 delegate、alias、双分类或 fallback 到旧模块。

## 10. 验收

- account、anonymous session、agent credential、delegation、crawler 和 unknown 各有成功与失败测试；
- 调用方传 `actor_type/confidence/classified_by` 不能影响分类结果；
- 伪造内部 crawler/agent header 被拒绝；
- 冲突的可信身份 fail closed；
- User-Agent-only agent/crawler 永远不是 verified；
- crawler provider timeout/DNS failure 在预算内返回 unknown，缓存命中不重复网络验证；
- 同一个 request 只分类一次，后续模块消费同一 immutable result；
- ViewEvent `Ecto.Enum`、ArticleInsights、Analysis.Const 和其他 schema/consumer 全部引用
  `RequestActor.Const`，repository 不再存在指向旧 `Actor.Const` 的 alias 或 values callback；
- ViewTracker 不再包含公共分类策略，RequestActor 不包含 tracking/counting 业务；
- Gate 授权不依赖 RequestActor 类型；
- public CDN body 不因 RequestActor 分类而变化；
- repository 不再存在 `GroupherServer.Actor.Const` 或 `CMS.ViewTracker.Classifier` 生产调用。
