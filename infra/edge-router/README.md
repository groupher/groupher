# Groupher Edge Router

`infra/edge-router` 是 Groupher 的生产边缘入口，运行在 Cloudflare Workers 上，负责把
公共域名请求路由到 Landing、Community、Auth、Phoenix 和 Press 等服务。它只负责入口路由、
请求头和基础协议处理，不拥有用户、社区或内容领域数据。

## 路由边界

```text
groupher.com/*, www.groupher.com/*
  -> Edge Router Worker
       -> Landing / Community / Auth Worker Service Binding
       -> Phoenix API / Press HTTPS origin
```

Dash、Apply、Assets Hub 和 Inspire Me 使用各自的 Worker 或服务入口；Edge Router 只在
明确的公开路径和绑定范围内转发，不复制各应用的业务路由。

## 本地开发与校验

```sh
pnpm --filter @groupher/edge-router run dev
pnpm --filter @groupher/edge-router run test
pnpm --filter @groupher/edge-router run type-check
pnpm --filter @groupher/edge-router run format:check
pnpm --filter @groupher/edge-router run deploy:dry-run
```

生产部署前应先确认下游 Worker 的 Service Bindings 可用，再部署 Edge Router；正式生产
部署使用手动 workflow，PR 和 `dev` 分支主要执行验证。部署后至少检查 `/health`、首页、
Community 页面和 Auth provider 入口。

## 相关文档

- [`docs/deploy/README.md`](../../docs/deploy/README.md)
- [`docs/gateway/README.md`](../../docs/gateway/README.md)
- [`docs/infra/contracts/health.md`](../../docs/infra/contracts/health.md)
