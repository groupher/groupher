# Health Contract

> 当前状态：v1 已落地，CI 已接入
>
> 协议名称：`health`
>
> 机器可读位置：`contracts/services/health/`

## 定位

Health contract 定义所有可独立启动或部署的 HTTP 子应用如何暴露基础健康状态。

它用于 Dev Hub、部署平台、测试启动器、CI conformance check 和未来监控系统判断
服务是否可达、是否能接收核心流量，以及返回格式是否符合公共协议。

它不是业务 smoke test，也不是完整指标系统。业务页面、GraphQL Playground、
Dashboard 路由、OAuth 流程或文档转换接口都不应该承担基础存活检查职责。

## Endpoint

所有可独立启动或部署的 HTTP 子应用都应该提供：

```text
GET /health
```

当前覆盖目标：

- `gateway`
- `edge-router`
- `auth`
- `landing`
- `main`
- `dashboard`
- `dash`
- `inspire-me`
- `phoenix`
- `press`
- `assets-hub`
- `content-import`
- `document-converter`

`edge-router` 是当前承接 `groupher.com` 生产流量的 Cloudflare Public Edge Router。
`gateway` 保留给可在 Vercel 或本地 Node runtime 运行的 Hono Gateway；两者不是同一个
producer，也不能共享 service id。

纯库、构建脚本、离线 worker 和没有 HTTP server 的模块不需要提供 `/health`。如果
后续 worker 变成常驻服务，应通过它自己的控制面或 supervisor 暴露等价健康状态。

## Response

基础响应示例：

```json
{
  "schemaVersion": "health.v1",
  "status": "ok",
  "service": "main",
  "version": "dev",
  "environment": "development",
  "timestamp": "2026-07-26T00:00:00Z",
  "uptimeMs": 12345,
  "checks": []
}
```

字段含义：

- `schemaVersion`：协议版本，v1 固定为 `health.v1`。
- `status`：整体状态，取值为 `ok | limited | down`。
- `service`：稳定服务 ID，和 Dev Hub service id 保持一致。
- `version`：构建版本、commit sha 或本地 `dev`。
- `environment`：运行环境，例如 `development | mock | preview | production`。
- `timestamp`：服务生成响应时的 UTC 时间。
- `uptimeMs`：当前进程运行时长。
- `checks`：可选的细分检查结果，v1 可以为空。

## Status

状态枚举：

- `ok`：核心能力正常。
- `limited`：核心能力可用，但部分非核心依赖、能力或性能受限。
- `down`：不可接收核心流量。

HTTP 状态码：

- `200`：服务可接收核心流量，包括 `ok` 和还能提供核心能力的 `limited`。
- `503`：服务不可接收核心流量。

`limited` 是否返回 `200` 取决于服务是否还能处理核心流量。能处理核心流量时返回
`200`，只在 body 中标记受限；不能处理核心流量时返回 `503`。

## Checks

后续需要暴露更多检查时，使用稳定结构：

```json
{
  "schemaVersion": "health.v1",
  "status": "limited",
  "service": "phoenix",
  "version": "a1b2c3d",
  "environment": "production",
  "timestamp": "2026-07-26T00:00:00Z",
  "uptimeMs": 12345,
  "checks": [
    {
      "name": "database",
      "status": "ok",
      "latencyMs": 12
    },
    {
      "name": "search",
      "status": "limited",
      "message": "provider timeout"
    }
  ]
}
```

`checks` 只放短、快、可解释的依赖状态。不要在健康检查里执行真实 OAuth 登录、
完整 GraphQL 查询、文档转换、远程批量同步或高成本数据库扫描。

`health.v1` 使用严格 schema：top-level response 和 `checks` item 都只允许 schema
中定义的字段。新增字段时必须同步更新 schema、fixtures、validators 和各服务测试；
如果字段语义不兼容，应新增 `health.v2`。

## 分层演进

业界常见模型会区分 startup、liveness 和 readiness：

- `startup`：服务是否完成启动，避免慢启动应用被过早判死。
- `liveness`：进程和 HTTP handler 是否还活着，用于判断是否应该重启。
- `readiness`：服务是否可以接收流量，用于判断是否进入负载均衡。

Groupher 可以从一个统一 `GET /health` 起步，后续再扩展：

```text
GET /health
GET /health/live
GET /health/ready
GET /health/startup
```

`/health` 可以作为兼容入口，返回 live 或 ready 的聚合状态；部署平台和 Dev Hub 在有
明确需求时再选择更细分的路径。

## Schema 和 Fixtures

机器可读 contract 放在根目录：

```text
contracts/
  services/
    health/
      README.md
      schemas/
        v1.schema.json
      fixtures/
        ok.json
        limited.json
        down.json
      scripts/
        assert-health.mjs
```

目录已经表达了协议名称，所以 schema 文件名不再重复 `health` 前缀，使用
`schemas/v1.schema.json`。

fixtures 是标准样例，应同时服务于文档、schema 自测和各子应用 conformance test。

## 跨语言同步

不同语言服务不需要共享同一份运行时代码，但必须共享同一份协议和验证结果：

```text
schema / fixtures / docs
  -> shared conformance script
  -> each service implements
  -> each service tests response against schema
  -> CI blocks incompatible response
  -> Dev Hub reports runtime mismatch
```

推荐做法：

- TS/Next/Hono：测试中读取 `contracts/services/health/schemas/v1.schema.json`。
- Python/FastAPI：用 Pydantic 实现响应模型，测试中再用 JSON Schema 校验。
- Elixir/Phoenix：运行时返回普通 JSON，测试中用 JSON Schema validator 校验。
- Dev Hub：运行时做宽松校验，协议不匹配时展示 mismatch，而不是直接崩溃。
- CI：做严格 conformance check，阻止不兼容改动进入主分支。

运行时不需要每次 `/health` 请求都读取 schema。health endpoint 应保持低成本、
无鉴权、无副作用；一致性主要靠测试和 CI 保证。

## Validate 时机

`/health` 是服务运行时被调用的 endpoint；validate 或 conformance check 是开发、
CI 和 Dev Hub 用来确认返回值是否符合 contract 的检查。

推荐运行时机：

- 开发时：改某个服务的 `/health` 后，跑本服务测试；必要时启动服务并用
  `assert-health.mjs --url ... --service ...` 检查真实响应。
- CI：先跑 `yarn contract:health` 做 schema 和 fixtures 自测，再跑各服务单元测试；需要端到端保证时，启动
  关键服务并用 `assert-health.mjs` 检查真实 URL。
- Dev Hub 运行时：定期请求每个服务的 `/health`，做宽松 validate；不符合时展示
  protocol mismatch，而不是让 Dev Hub 崩溃。
- 部署平台：高频请求 `/health`，通常只看 `200` 或 `503`，不做复杂 schema 校验。
- 生产观测：采集 health 状态；长期趋势、延迟和资源指标进入 metrics 或
  OpenTelemetry，不从 `/health` 解析趋势数据。

本地检查 contract 自身：

```bash
node contracts/services/health/scripts/assert-health.mjs
```

检查一个运行中的服务：

```bash
node contracts/services/health/scripts/assert-health.mjs \
  --url http://127.0.0.1:3000/health \
  --service main
```

服务自身不应该在每次处理 `/health` 请求时读取 schema 再校验自己。这样会让健康
检查变重，也会引入额外文件依赖。服务运行时只负责返回稳定 JSON；验证责任放在
测试、CI 和 Dev Hub 消费端。

## 当前实现

当前实现已经开始对齐 `health.v1`：

- 根目录已有 `contracts/services/health/schemas/v1.schema.json`。
- `gateway`、`landing`、`main`、`dashboard` 和 `inspire-me` 暴露 `GET /health`。
- `auth`、`phoenix` 和 `document-converter` 暴露 `GET /health` 并返回统一 JSON。
- Dev Hub 服务清单使用各服务的 `/health` 作为基础可达性 URL。
- E2E mock GraphQL server 仍有自己的 `GET /health`，用于 Playwright 等待 mock server。
  它不是 Dev Hub managed service，也不参与 `health.v1`；这个 endpoint 只保证 HTTP
  `200` readiness。

后续可以继续把更严格的 schema conformance test 接入各语言测试和 CI。

## 演进计划

v1 只做协议统一：

- 所有独立 HTTP 子应用提供 `GET /health`。
- 响应统一为 JSON schema。
- `service` 使用 Dev Hub 的稳定 service id。
- Dev Hub 服务清单统一指向 `/health`。
- 部署平台继续使用低成本 health endpoint。

v2 再扩展 readiness：

- Phoenix 增加数据库、必要配置和关键依赖检查。
- `document-converter` 增加 runtime 配置、临时目录和 converter 初始化检查。
- `auth` 增加必要 env、cookie domain 和内部 Phoenix endpoint 配置检查。
- Next 子应用只检查 server boot、构建版本和必要 public env。

v3 接入指标系统：

- 引入单独 metrics endpoint 或 OpenTelemetry exporter。
- Dev Hub 展示 health、runtime metrics 和服务关系。
- 生产环境由正式观测系统采集，而不是从 `/health` 解析趋势指标。

## 兼容规则

`health.v1` 使用严格 schema。字段变化必须先更新 schema、fixtures 和 validators，
再让各服务对齐。

`health.v1` 内允许：

- 新增 optional check，但必须同步更新 schema、fixtures 和 validators。
- 放宽非核心字段展示方式，但不能影响 required 字段和状态语义。

`health.v1` 内不允许：

- 删除 required 字段。
- 在不更新 schema 的情况下新增 response 字段。
- 改变 `status` 枚举语义。
- 改变 HTTP 状态码语义。
- 让健康检查依赖重业务流程。

需要破坏兼容时，新增 `health.v2`，并让消费者在迁移期同时兼容 v1 和 v2。
