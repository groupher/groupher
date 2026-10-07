# Infrastructure

> 状态：current

本目录记录所有应用共享的开发与运行基础，不描述某个产品功能的实现。

- [`local-development.md`](./local-development.md)：本地开发入口。
- [`dev-environment-fix.md`](./dev-environment-fix.md)：合并 `dev` / `mock` 本地环境并统一数据库配置。
- [`portless.md`](./portless.md)：本地域名和 HTTPS 寻址。
- [`service-endpoints.md`](./service-endpoints.md)：服务地址配置约定。
- [`contracts/health.md`](./contracts/health.md)：唯一的 Health v1 人类可读合同。
- [`contracts/`](./contracts)：跨语言、跨应用的机器可读协议。
- [`diagnostics/`](./diagnostics)：错误分类、状态检查和 Sentinel。
- [`tooling/`](./tooling)：工程工具说明。
