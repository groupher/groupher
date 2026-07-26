# Contracts

> 当前状态：v1 已落地，CI 已接入
>
> 文档位置：`docs/contract/`
>
> 机器可读协议位置：根目录 `contracts/`

## 定位

Contract 是跨语言、跨子应用共享的接口约定。它描述服务之间必须共同遵守的请求、
响应、状态枚举和演进规则。

Contract 不属于某个具体实现。Dev Hub、Phoenix、Next 子应用、Hono 服务、
FastAPI 服务、CI 和部署平台都只是 contract 的消费者。

## 为什么不放在 Dev Hub

Dev Hub 会消费 health contract，用于展示服务状态、发现协议不匹配和辅助本地调试。
但 Dev Hub 不是 contract owner。

如果把 schema 放在 `local/dev-hub`，Phoenix、FastAPI 和 Next 子应用为了遵守公共
协议，就会反向依赖一个本地桌面工具目录。这个依赖方向不对，也会让部署平台、
Playwright 和 CI 的消费边界变得含糊。

正确关系是：

```text
contracts owns schema

Dev Hub
  -> reads schema
  -> displays status
  -> reports protocol mismatch

sub-apps
  -> implement endpoint
  -> validate response in tests

CI
  -> runs conformance checks
  -> blocks incompatible changes
```

## 目录约定

文档放在：

```text
docs/
  contract/
    README.md
```

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

这里使用 `contracts/`，而不是 `packages/`。`packages/` 容易让人误以为这是 npm
workspace 或 TS package；contract 的权威来源应该是跨语言协议，而不是某个生态的
包。

`health` 目录下的文件不再重复 `health` 前缀。目录本身已经表达了协议名称，所以
使用 `schemas/v1.schema.json` 即可。

## Health Contract

详细协议见 [health.md](health.md)。

所有可独立启动或部署的 HTTP 子应用都应该提供：

```text
GET /health
```

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

状态枚举：

- `ok`：核心能力正常。
- `limited`：核心能力可用，但部分非核心依赖、能力或性能受限。
- `down`：不可接收核心流量。

HTTP 状态码：

- `200`：服务可接收核心流量，包括 `ok` 和还能提供核心能力的 `limited`。
- `503`：服务不可接收核心流量。

`schemaVersion` 必须显式存在。后续如果修改 required 字段或状态语义，应升级到
`health.v2`，而不是在 `health.v1` 内破坏兼容。

## 同步方式

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

## 演进规则

`health.v1` 使用严格 schema。字段变化必须先更新
`contracts/services/health/schemas/v1.schema.json`、fixtures 和 validators，再让各
服务对齐。

`health.v1` 内允许：

- 新增 optional check，但必须同步更新 schema、fixtures 和 validators。
- 放宽非核心字段展示方式，但不能影响 required 字段和状态语义。

`health.v1` 内不允许：

- 删除 required 字段。
- 改变 `status` 枚举语义。
- 改变 HTTP 状态码语义。
- 让健康检查依赖重业务流程。

需要破坏兼容时，新增 `health.v2`，并让消费者在迁移期同时兼容 v1 和 v2。

## 与指标系统的边界

`/health` 只回答“服务现在是否能使用”。它不承载长期趋势和高基数指标。

长期指标应进入独立 metrics 通道，例如 OpenTelemetry 或 Prometheus 风格的
endpoint/exporter。Dev Hub 可以消费 `/health` 展示基础状态，也可以继续采集本地
CPU、RSS、heap 和 busy 状态；生产观测系统不应从 `/health` 解析趋势指标。
