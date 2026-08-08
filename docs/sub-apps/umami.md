# Umami

> 运行形态：自托管 vendor application
>
> UI：配置和社区视图位于 Dashboard
>
> 当前状态：规划中

## 定位

Umami 提供社区访问统计。Groupher 自托管一个受版本控制的 Umami 实例，作为内置
Web Analysis 的底层采集和查询引擎。

Umami 是 vendor deployment，不需要为了符合 Groupher Context 结构而 fork 或重写
其内部领域模型。Groupher 只维护必要的查询边界、权限和展示适配。

当前 v1 计划以 `docs/web-analysis/v1.md` 为准：先使用一个 `groupher.com` 全站
Umami website，通过社区 path scope 过滤 Dashboard 查询。每社区一个 Umami website
不是 v1 默认方案，只有 path 过滤无法满足隔离、性能、删除/导出或分享需求时再评估。

## 提供的能力

- Page view、访客、来源、设备、地区和自定义事件统计。
- 一个 `groupher.com` 全站 website identity，按 community path scope 查询。
- Main/社区站点的统计脚本和事件上报。
- Dashboard 中按社区查看统计摘要。
- 通过 Umami API 获取时间范围内的聚合数据。

社区管理员不直接进入 Umami 管理后台；配置入口和常用图表保留在 Groupher
Dashboard。

## 数据所有权

Phoenix 负责：

- 全局 Umami website ID 的服务端配置。
- community 到公开 path scope 的解析。
- 管理员查看权限。
- 套餐、保留策略或高级分析功能的产品配置。
- Dashboard 可见的配置状态。

Umami 负责：

- 原始 analytics event。
- visitor/session 聚合。
- analytics schema、查询和 retention 执行。

Groupher 不复制完整 Umami 原始事件到 Phoenix 数据库。确实需要产品使用的聚合值
可以定期投影，但必须有明确用途和时间粒度。

## 基本流程

```mermaid
sequenceDiagram
  participant V as Community Visitor
  participant M as Groupher Main
  participant U as Umami
  participant D as Dashboard
  participant P as Phoenix

  V->>M: 访问社区页面
  M->>U: 上报 page view / custom event
  D->>P: 请求当前 community 的统计
  P->>P: 校验社区管理员权限并解析 path scope
  P->>U: 使用服务端 credential 和 path filter 查询聚合
  U-->>P: 时间范围内统计
  P-->>D: 有界 Dashboard DTO
```

如果查询适配逻辑明显增加，可以在 vendor deployment 前增加一个受信任的薄
adapter；不要把 Umami admin credential 发送到浏览器。

## 与其他子应用的边界

- `Integrations` 是 Dashboard 中配置 Analytics 的入口，不是服务。
- `Integrations / Third-party / Analytics` 面向用户自带的外部分析服务，不承载
  Groupher 内置 Web Analysis 的持久模型。
- Analytics event 不通过 `posthouse`；`posthouse` 处理消息和投递协议。
- 周报中需要统计摘要时，`ai` 或 `Press` 读取经过权限校验的聚合 DTO，
  不能直接访问 Umami 数据库。
- 风控行为统计若需要 Umami 信号，应先形成有界投影，再交给 `risk-center`。

## 部署与运维

- 固定并审查 Umami 版本，升级前验证数据库 migration。
- 对 Umami 数据库做独立备份和恢复演练。
- 使用 Groupher 控制的 analytics 域名，避免页面绑定部署平台地址。
- admin credential 只存在服务端 secret store。
- 为 API、采集 endpoint 和数据库分别监控可用性及延迟。

## 隐私约束

- 默认不向 Umami 发送正文、邮箱、用户名或其他直接 PII。
- 自定义事件属性使用稳定的业务类别，不包含用户输入原文。
- v1 不提供社区级统计开关；脚本加载和采集细节由平台隐私策略、地区要求、
  consent 策略和 staff/internal exclusion 策略决定。
- 明确保留周期、删除流程和社区停用后的数据处理方式。
