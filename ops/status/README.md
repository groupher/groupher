# Groupher Status

`ops/status` 是 Groupher 的公共服务状态页与可用性监控配置，基于 Gatus 运行。它独立
监控 Edge Router、Auth、Community、Dash、Press、Assets Hub 以及主要公开页面，不拥有任何
业务数据，也不参与产品请求转发。

## 运行边界

```text
Gatus -> health.v1 endpoint checks
      -> HTTP status / service / response body assertions
      -> Status dashboard
      -> optional Discord alerts
```

生产配置位于 `config.yaml`，本地配置位于 `config.local.yaml`。生产使用 Docker 镜像和
Fly.io 应用 `groupher-status`，SQLite 数据持久化到 Fly volume；Discord webhook 通过
Fly secret 注入。生产配置校验由 `validate-config.sh` 完成，本地启动由 `start-local.sh`
完成。

## 本地与部署

本地需要 Gatus v5.36.0，启动命令为：

```sh
./ops/status/start-local.sh
```

校验生产配置：

```sh
./ops/status/validate-config.sh
```

状态页只反映监控目标的可用性，不替代应用自身的日志、链路追踪、业务验收或发布回滚判断。
监控目标和阈值应与 [`docs/deploy/README.md`](../../docs/deploy/README.md) 中的生产入口保持一致。
