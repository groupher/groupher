# Health Endpoint

> 运行形态：所有可独立启动或部署的 HTTP 子应用
>
> UI：无独立 UI
>
> 当前状态：v1 contract 已开始落地

## 定位

`/health` 是子应用对外暴露的最小健康协议。它用于 Dev Hub、部署平台、测试启动器
和未来监控系统判断一个服务是否可达、是否已经准备好接收流量，以及基础运行状态。

它不是业务 smoke test，也不是完整观测系统。业务页面、GraphQL Playground、
Dashboard 路由或转换接口都不应该承担基础存活检查职责。

## 覆盖范围

所有可独立启动或部署的 HTTP 服务都应该提供统一的 `GET /health`：

- `gateway`
- `auth`
- `landing`
- `main`
- `dashboard`
- `inspire-me`
- `phoenix`
- `document-converter`

纯库、构建脚本、离线 worker 和没有 HTTP server 的模块不需要提供 `/health`。如果
后续 worker 变成常驻服务，应通过它自己的控制面或 supervisor 暴露等价健康状态。

## 基础响应

v1 响应保持低成本、无鉴权、无副作用：

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
- `service`：稳定服务 ID，和 Dev Hub 的 service id 保持一致。
- `version`：构建版本、commit sha 或本地 `dev`。
- `environment`：`development | mock | preview | production` 等运行环境。
- `timestamp`：服务生成响应时的 UTC 时间。
- `uptimeMs`：当前进程运行时长。
- `checks`：可选的细分检查结果，v1 可以为空。

HTTP 状态码：

- `200`：服务可接收基础流量。
- `503`：服务不可接收流量，或必要依赖不可用。

`limited` 是否返回 `200` 取决于服务是否还能处理核心流量。能处理核心流量时返回
`200`，只在 body 中标记降级；不能处理核心流量时返回 `503`。

## 检查分层

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

## checks 结构

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

`checks` 只放短、快、可解释的依赖状态。不要在健康检查里执行重业务流程，例如真实
OAuth 登录、完整 GraphQL 查询、文档转换、远程批量同步或高成本数据库扫描。

## 指标边界

`/health` 适合回答“这个服务现在是否能被使用”。它不适合承载长期指标、趋势图和
高基数标签。

长期指标应进入单独的 metrics 通道，例如 OpenTelemetry 或 Prometheus 风格的
`/metrics`，包含：

- HTTP 请求数量、延迟和错误率。
- 进程 CPU、RSS、heap 和 event loop 状态。
- 队列长度、任务失败数和 provider 超时数。
- 业务相关但低基数的聚合指标。

Dev Hub 可以先消费 `/health` 的基础状态，再继续使用本地 runtime 采集 CPU、内存、
浏览器 heap 和 busy 状态。生产观测不要依赖 Dev Hub 的本地采样格式。

## Validate 时机

服务运行时只负责返回稳定的 health JSON，不在每次请求里读取 schema 自检。

validate 或 conformance check 应在这些位置运行：

- 开发时：改某个服务的 `/health` 后，跑本服务测试；必要时用
  `contracts/services/health/scripts/assert-health.mjs` 检查本地 URL。
- CI：跑 schema/fixtures 自测和各服务测试；需要端到端保证时再启动服务检查真实
  `/health`。
- Dev Hub：定期请求 `/health`，宽松校验格式，不符合时显示 protocol mismatch。
- 部署平台：只做轻量可达性判断，主要看 `200` 或 `503`。

## 当前实现

当前实现已经开始对齐 `health.v1`：

- 根目录已有机器可读 contract：`contracts/services/health/schemas/v1.schema.json`。
- `gateway`、`landing`、`main`、`dashboard` 和 `inspire-me` 暴露 `GET /health`。
- `auth`、`phoenix` 和 `document-converter` 暴露 `GET /health` 并返回统一 JSON。
- Dev Hub 服务清单使用各服务的 `/health` 作为基础可达性 URL。
- E2E mock GraphQL server 仍有自己的 `GET /health`，用于 Playwright 等待 mock server。

后续可以继续把更严格的 schema conformance test 接入各语言测试和 CI。

## 建议演进

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

## 外部参考

- Kubernetes Probes：`startup`、`liveness`、`readiness` 三类探针。
- MicroProfile Health：`/health/live`、`/health/ready`、`/health/started` 的标准化
  健康模型。
- Cloud Load Balancer Health Check：健康检查用于决定后端是否接收新流量。
- OpenTelemetry HTTP Metrics：HTTP 指标应进入观测系统，而不是塞进健康响应。
