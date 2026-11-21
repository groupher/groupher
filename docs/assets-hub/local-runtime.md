# Assets Hub 本地运行时边界

> 状态：Node local provider 与 Cloudflare read Worker 分别由 Dev Hub 托管；两者使用固定端口和统一私有配置。
>
> 目标：Node 本地 provider 不依赖线上 Cloudflare 资源或凭据；Cloudflare Worker 是显式集成变体，另行授权和启动。

通用原则以[外部依赖服务的本地运行时架构](../architecture/external-services-local-runtime.md)
为准；本文只记录 Assets Hub 的具体 provider、endpoint、启动拓扑和验收要求。

## 背景

Assets Hub 有两个独立的 Dev Hub 服务：

```text
assets-hub -> Node/Hono -> filesystem/local batch state :8002
assets-read-worker -> Cloudflare Worker -> remote R2 / local Phoenix lookup :8787
```

read worker 的 Cloudflare 配置使用 remote R2，并通过 Cloudflare 的开发运行时加载
Durable Objects、Queue 和 R2 binding。因此即使目标只是本地 seed 或本地页面预览，也可能
要求：

- `CLOUDFLARE_API_TOKEN`；
- `SERVICE_AUTH_CLIENT_ID`；
- `SERVICE_AUTH_CLIENT_SECRET`；
- 可用的 Cloudflare remote resources。

这不符合日常本地开发的预期。Cloudflare 集成测试和生产部署可以保留这些依赖，但不应成为
本地 Assets Hub 的默认前置条件。

## Assets Hub 具体决策

本节将通用架构原则落到 Assets Hub，不重新定义其他服务的本地运行规则。

Assets Hub 分为两个明确的运行模式：

```text
assets-hub:local       默认，本地闭环，不连接 Cloudflare
assets-hub:cloudflare  可选，验证 Worker、R2、DO 和 Queue 集成
```

seed、Community 页面和 Dashboard 日常开发使用 `assets-hub:local`。只有明确进行
Cloudflare runtime 验证或部署前检查时，才使用 `assets-hub:cloudflare`。

## 默认本地模式

本地模式由一个 Node/Hono Assets Hub provider 提供与生产相同的业务能力、校验边界和
幂等语义。对象传输 endpoint 可以本地化，但不能改变 Phoenix capability、service-auth、
finalize、generated batch claim 和 publish 的业务 contract：

```text
Phoenix CMS.Assets
  -> local Assets Hub :8002
       -> batch registry
       -> local object store
       -> upload/finalize
       -> generated batch claim
       -> public asset read
```

本地 provider 至少需要支持以下入口：

- `POST /generated-batches`；
- `POST /generated-batches/:batchRef/assets`；
- `POST /generated-batches/:batchRef/claim`；
- `POST /generated-batches/:batchRef/cancel`；
- `POST /generated-batches/:batchRef/cleanup`，供 Phoenix reconciliation 清理 batch；
- `POST /uploads`；
- `POST /internal/assets/delete`，接收 provider object deletion intent；
- `POST /uploads/:uploadRef/finalize`；
- `GET /a/:assetPublicRef/original`；
- `GET /health` 和 `GET /health/ready`。

`POST /uploads` 必须返回短时、限定 capability 的本地 PUT URL。客户端随后把对象字节
PUT 到该 URL，再调用 `POST /uploads/:uploadRef/finalize`；`PUT /uploads/:uploadRef` 不是
现有生产 contract，也不应被当作公开 Assets Hub API。URL 可以是本地 filesystem provider
的临时上传路由，但 finalize 前后的 checksum、size、MIME、object key、社区范围和
Phoenix completion 语义必须与生产一致。

`POST /internal/assets/delete` 保留生产的 service-auth 和幂等边界，但本地 provider 不模拟
持久化 Queue：校验通过后同步删除 `.local/assets-hub/` 中的对象，再返回兼容响应
`{enqueued: true}`。删除失败时请求直接失败，Phoenix 后续通过 `ProviderReconciliation`
重新投递。

本地 provider 只承诺 `original` variant。当前 Worker 对 `thumbnail` 和 `card` 返回 404，
本地实现也不应在文档或验收中承诺这两个 variant。

### 本地存储

- 对象字节写入仓库忽略的本地目录，例如 `.local/assets-hub/`；
- batch 状态使用 `.local/assets-hub/batches/*.json` 持久化，upload intent 使用
  `.local/assets-hub/uploads/*.json` 持久化；
- `assetPublicRef`、object key、variant 和 canonical URL 继续使用生产 contract；
- batch cleanup 和 object deletion 必须按 `batchRef`、`assetPublicRef`、storage key 幂等；
- `active_theme_matches?` 不能只检查 Phoenix 数据库状态，还必须确认所有 fixture object
  在 `.local/assets-hub/` 中存在且 checksum 一致；
- 如果清除 `.local/assets-hub/` 被定义为 reset 操作，则必须同时清除对应 seed 数据，不能
  让数据库保留“已发布”状态而 public URL 全部 404；
- 本地服务重启后，已完成的 fixture seed 应可以通过 manifest、数据库状态和对象存在性
  检查重新收敛。

本地模式不使用 remote R2、remote Durable Objects 或 Cloudflare Queue。它也不改变 Phoenix
对 CommunityAsset、capability、publish snapshot 和 reconciliation 的业务所有权。

## 鉴权边界

本地模式不应要求用户手工配置线上 service credentials。

本地 service identity 是必选项，因为 finalize 会调用 Phoenix 的
`completeCommunityAssetUpload`，generated batch register/claim/cleanup 也会调用 Phoenix
或受保护的 Assets Hub internal endpoint。由 Dev Hub 自动生成或读取本地 identity，用户
不需要手工配置线上凭证。无论采用哪种本地注入实现：

- `SERVICE_AUTH_CLIENT_ID` 和 `SERVICE_AUTH_CLIENT_SECRET` 只能是本地值；
- 不读取生产 Auth endpoint、生产 issuer 或生产 JWKS；
- 不把本地 secret 提交到仓库；
- 缺失配置时在本地服务 readiness 阶段给出明确错误。
- `SERVICE_AUTH_TOKEN_ENDPOINT`、`SERVICE_AUTH_ISSUER` 和 `SERVICE_AUTH_JWKS_URL` 必须指向
  本地 Auth；
- `ASSETS_HUB_CAPABILITY_SECRET` 必须是本地值，用于校验 Phoenix 签发的 upload/batch
  capability 和 publish claim；
- `ASSETS_HUB_BATCH_SIGNING_KEY_ID` 和 `ASSETS_HUB_BATCH_POLICY_VERSION` 必须提供与 Worker
  默认行为等价的本地值，当前分别为 `hmac-v1` 和 `v1`。

## Cloudflare 集成模式

现有 Worker 运行时保留为显式模式，用于验证真实 Cloudflare 依赖：

```text
cf dev
  -> Worker read path
  -> remote R2
  -> Durable Objects
  -> Queue
  -> Phoenix origin lookup
```

该模式可以要求：

- `CLOUDFLARE_API_TOKEN`；
- Cloudflare remote R2/DO/Queue；
- Cloudflare Worker secrets；
- 本地 Auth/Phoenix 的 service identity。

这些配置属于 `assets-hub:cloudflare`，不应被默认的 `make dev`、`make dev.app` 或本地
`make be.seed.home` 隐式要求。

## Phoenix 与 seed 配置

Node upload provider 与 Cloudflare read Worker 是独立 listener：

```text
ASSETS_HUB_BATCH_ENDPOINT=http://127.0.0.1:8002
ASSETS_HUB_DELETE_ENDPOINT=http://127.0.0.1:8002
ASSETS_PUBLIC_ENDPOINT=https://assets.groupher.localhost
NEXT_PUBLIC_ASSETS_HUB_ENDPOINT=https://assets-hub.groupher.localhost
NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT=https://assets.groupher.localhost
```

`ASSETS_PUBLIC_ENDPOINT` 会构造并持久化到 CommunityAsset/wallpaper snapshot 的 canonical
URL，不能使用 loopback HTTP。Node local provider 的 `assets.groupher.localhost` 和
`assets-hub.groupher.localhost` 都指向 `8002`；集成 Worker 使用独立的
`assets-worker.groupher.localhost:8787`：

```text
assets-hub.groupher.localhost -> 8002
assets.groupher.localhost     -> 8002
assets-worker.groupher.localhost -> 8787
```

两个服务分别承接 upload 和 public read；业务入口仍按各自的 capability、service-auth
和 HTTP method 校验。

Wallpaper seed 不改业务流程，仍然必须走：

```text
prepare upload
  -> create generated batch
  -> upload fixture bytes
  -> finalize each upload
  -> claim batch
  -> Phoenix publish snapshot
```

变化只在 Assets Hub 的执行 provider：本地使用 filesystem/local state，Cloudflare 模式
使用 Worker/R2/DO/Queue。因此 seed 仍然验证真实的 upload intent、batch claim 和 publish
约束，不允许直接插入 fake snapshot 或 fake CommunityAsset。

## Dev Hub 调整范围

`assets-hub` Node provider 监听固定端口 `8002`，`assets-read-worker` 监听 `8787`。默认
启动 `assets-hub` 只使用 Node provider、Auth 和 Phoenix，不隐式启动需要远端 Cloudflare
资源的 Worker。开发者明确启动 `assets-read-worker` 时，Hub 才会检查其 Auth/Phoenix 依赖；
Worker `/health/ready` 必须完成真实 Service Auth 与 Phoenix origin lookup。

包级 `dev` 入口、Make public target 和根 pnpm dev alias 都转交 Dev Hub。Hub 内部只调用
`.managed` target。Worker 的本地 bindings 由 Hub child environment 提供给
`cloudflare.config.ts` 的 `bindings.*()`；不从 `.env`、`.dev.vars` 读取受管配置。

## 验收标准

默认本地环境满足以下前提和结果，才可认为改造完成。

前提：

- 本地 Auth、Phoenix 和 local Assets Hub 已启动；
- local provider 使用本地 service identity 和本地 capability secret；
- 不依赖 `CLOUDFLARE_API_TOKEN`、remote R2、remote Durable Objects 或 remote Queue。

结果：

- 没有 `CLOUDFLARE_API_TOKEN` 也能启动 Assets Hub；
- 没有线上 Auth endpoint、issuer 或 JWKS 配置也能启动，但本地 Auth endpoint、issuer 和
  JWKS 必须可用；
- `make be.seed.home` 能从干净数据库完成 wallpaper seed；
- 数据库中存在一个 active wallpaper、两个 published snapshots、八张 fixture 图片和
  八条 CommunityAsset；
- `https://assets.groupher.localhost/a/<assetPublicRef>/original` 返回 `200 image/*`；
- 重复执行 seed 不产生额外 snapshot 或重复 asset；
- Cloudflare 模式仍可以独立验证真实 Worker/R2/DO/Queue 链路。
