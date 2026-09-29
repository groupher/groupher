# Assets 静态资源读取链路：空白背景与解耦方案

> 文档角色：Incident archive；本文中的 `staticRevision`、`staticAssetPublicRef` 只描述历史 v1
> 故障现场，不是当前 Wallpaper API。当前数据边界以 `docs/feature/wallpaper/` 下的 Active contract 为准。

## 状态

- 当前问题：已确认根因
- 方案 A：首版已落地，包含本地/生产配置隔离、Dev Hub readiness 和 contract probe
- 后续系统性方案：仍可评估 origin manifest 或 Asset Catalog 解耦
- 影响范围：所有依赖 `assets.groupher.localhost/a/:assetPublicRef/original` 的本地页面，包含 Dashboard 壁纸刷新后的静态背景
- 生产结论：当前证据只指向本地手动启动的 read worker，未发现生产环境受到同一配置缺失影响

## 背景

Wallpaper 编辑页在浏览器中使用 GPU renderer 预览编辑态，但保存成功后，普通页面和刷新后的编辑页都应该读取已经发布的静态图片：

```text
Wallpaper editor
  -> export light/dark bitmap
  -> Assets Hub upload/finalize
  -> Phoenix 保存 staticAssetPublicRef + staticRevision
  -> 前端生成不可变 public asset URL
  -> Assets read worker 从 R2 返回图片
```

这样做的边界是：编辑态可以依赖 GPU，运行态只依赖静态图片，不需要加载 Wallpaper renderer 或 WebGPU。

## 当前遇到的问题

现象是“修改参数并保存后，刷新壁纸变成空白”。这不是保存按钮没有提交，也不是 `staticRevision` 没有写入。

### 已确认的证据

Phoenix 的 community wallpaper 查询已经返回：

- `staticRevision`
- light 的 `staticAssetPublicRef`
- dark 的 `staticAssetPublicRef`

因此数据库写入和前端 `parseWallpaper` 的静态引用解析都已走通。

刷新时生成的图片 URL 也正确，例如：

```text
https://assets.groupher.localhost/a/<assetPublicRef>/original
```

但该 URL 返回：

```text
HTTP 502
asset_origin_lookup_failed
Service identity client configuration is incomplete.
```

Assets read worker 的实际链路是：

```text
GET /a/:assetPublicRef/original
  -> fetchAssetOriginInfo(publicRef)
  -> Phoenix GraphQL communityAssetOriginInfo(publicRef)
  -> 获取 service token
  -> 得到 storageKey
  -> R2.get(storageKey)
```

关键实现位置：

- `backend/assets-hub/src/worker.ts`：public read 和 `asset_origin_lookup_failed`
- `backend/assets-hub/src/phoenix.ts`：调用 Phoenix origin lookup 前获取 service token
- `packages/service/auth/index.ts`：缺少 service identity 配置时抛出 `Service identity client configuration is incomplete.`

### 本地配置分裂

本地上传 API 和 `cf` read worker 都使用 `backend/assets-hub/.env`；`.dev.vars` 不再作为
read worker 的第二套配置入口。

旧的 `.dev.vars` 没有完整提供 read worker 所需的 service-auth 配置。更重要的是，旧配置在
`.dev.vars` 缺少变量时会继续使用 `wrangler.jsonc` 中的 `vars` 默认值；修复前这些默认值是生产拓扑：

```text
SERVICE_AUTH_TOKEN_ENDPOINT=https://auth.groupher.com/oauth2/token
SERVICE_AUTH_ISSUER=https://auth.groupher.com
```

因此只补 `SERVICE_AUTH_CLIENT_ID` 和 `SERVICE_AUTH_CLIENT_SECRET` 仍然不够：本地 worker 可能从生产 Auth 获取 token，并用 `auth.groupher.com` 作为 issuer，重新触发 Phoenix 本地验证器期望 `https://auth.groupher.localhost` 的 issuer 漂移。

本地 `.env` 必须同时提供 endpoint、issuer 和 secrets：

```text
SERVICE_AUTH_CLIENT_ID=<local secret>
SERVICE_AUTH_CLIENT_SECRET=<local secret>
SERVICE_AUTH_TOKEN_ENDPOINT=http://127.0.0.1:3004/oauth2/token
SERVICE_AUTH_ISSUER=https://auth.groupher.localhost
SERVICE_AUTH_JWKS_URL=http://127.0.0.1:3004/.well-known/jwks.json
```

Auth 侧的 `assets-hub-development` client 还必须注册
`allowedAudiences: ["phoenix:assets-api"]`，并同时允许
`assets:upload:complete` 与 `assets:origin:read`；只有 endpoint 和 client secret
存在，不能证明 read worker 具备 origin lookup 所需的 scope。

因此当前会出现：

```text
上传 API 有 service-auth 配置，可以完成保存
  -> read worker 没有 service-auth 配置
  -> 访问静态图片时无法查询 origin
  -> 图片 URL 返回 502 JSON
  -> background-image 加载失败，页面看起来为空白
```

这解释了为什么“保存似乎完成了，但刷新后没有壁纸”。

### 当前本地启动拓扑

修复前 `dev:local` 会启动 Assets upload API 和独立的 read worker；Dev Hub 虽然启动了组合命令，但没有把 read worker 的 readiness 作为 Assets 服务就绪条件。现在 Assets Hub 的 Dev Hub 服务定义显式依赖 Auth/Phoenix，并将 read worker 的 `/health/ready` 作为 endpoint readiness。

## 直接修复：本地运行时配置

这是首版已落地的本地修复，不需要把 secret 提交到仓库：

1. `dev:read-worker` 通过 `cf dev --mode development` 启动，Cloudflare Vite 插件读取本地 `.env` / `.dev.vars` service-auth 配置。
2. 使用现有本地 secret 来源提供 `SERVICE_AUTH_CLIENT_ID` 和 `SERVICE_AUTH_CLIENT_SECRET`，不要把 secret 提交到仓库。
3. 在 `.env` 中同时显式覆盖 `SERVICE_AUTH_TOKEN_ENDPOINT`、`SERVICE_AUTH_ISSUER` 和 `SERVICE_AUTH_JWKS_URL`，不能依赖配置文件的默认值；确认 issuer、audience、scope 与 Phoenix 的验证配置一致。
4. 重启 `cf` read worker；这些变量在 worker 启动时读取，运行中补变量不会自动生效。
5. 直接请求 light/dark 两个 `/a/.../original` URL，必须返回 `200` 和 `image/*`，再排查浏览器缓存或页面层问题。

同时，`cloudflare.config.ts` 以 `mode` 映射本地和生产 bindings；部署脚本显式使用 `--mode production`，避免本地默认值被部署。

## 系统性方案

### 方案 A：保留 Phoenix origin lookup，建立正式运行契约（推荐）

保持现有读取链路，但把 service-auth 配置、启动检查和健康检查做完整。

#### 设计

```text
Assets read worker
  -> service token
  -> Phoenix communityAssetOriginInfo
  -> R2 object
```

#### 需要落地的内容

1. 将以下变量定义为 read worker 的正式运行契约：

   ```text
   SERVICE_AUTH_CLIENT_ID
   SERVICE_AUTH_CLIENT_SECRET
   SERVICE_AUTH_TOKEN_ENDPOINT
   SERVICE_AUTH_ISSUER
   SERVICE_AUTH_JWKS_URL
   PHOENIX_GRAPHQL_ENDPOINT
   ```

2. 将生产 endpoint 放在 `cloudflare.config.ts` 的 production mode；本地 `.env` 必须显式覆盖本地 Auth 的 token endpoint、issuer 和 JWKS URL。
3. 将 read worker 纳入 Dev Hub 服务编排。Dev Hub 启动 read worker 时注入统一的 `LOCAL_SERVICE_AUTH_ISSUER`、loopback token/JWKS endpoint、Phoenix endpoint 和本地 secrets；端口转发不再是唯一的集成关系。
4. 本地、测试、预览和生产使用统一的配置注入约定，避免 upload API 与 read worker 各自维护一套不完整配置。
5. 本地 `dev-local.ts` 启动器和 Worker 的 readiness 检查都校验必需变量；缺失时在启动/readiness 阶段失败，而不是等到用户访问图片时才返回 502。
6. 将健康检查拆成两层：

   - liveness：进程和 Worker 仍在运行
   - readiness：执行 Assets service-auth contract probe

7. readiness contract probe 使用保留的虚构 `assetPublicRef`：

   ```text
   获取 service token
     -> 调用 Phoenix communityAssetOriginInfo
     -> 期望 resolver 返回 GraphQL `null`（资源不存在语义）
   ```

   期望 `null` 说明 token 已通过 Phoenix Verifier、ServiceScope 并进入 resolver；issuer、JWKS、audience、scope 任一不匹配都必须使 readiness 失败。不能只做变量存在性检查，也不能只验证 token endpoint 能返回 token。

8. 为 `/a/:assetPublicRef/original` 增加集成测试，覆盖：

   - active asset 返回图片
   - 不存在或已删除 asset 返回 404
   - Phoenix 暂时不可用返回 retryable 错误
   - service-auth 配置缺失时 readiness 失败

#### 优点与代价

- 优点：改动最小，保留 Phoenix 对 asset 状态、权限和删除语义的权威控制。
- 代价：静态资源读取仍依赖 Phoenix 可用性和 service-auth 配置；需要可靠的启动、编排和部署检查。

### 方案 B：Assets Worker 维护 origin manifest

上传 finalize 成功后，由 Assets Hub 写入一份以 `assetPublicRef` 为 key 的 origin manifest；读取时不再访问 Phoenix。

```text
assetPublicRef
  -> storage
  -> storageKey
  -> mimeType
  -> filename
  -> status
```

读取链路变为：

```text
GET /a/:assetPublicRef/original
  -> manifest KV / D1 / R2
  -> R2.get(storageKey)
```

#### 必须同时解决的一致性问题

- finalize 成功后才能把 manifest 标记为 `ACTIVE`
- Phoenix soft-delete 时必须同步标记 manifest 为 `DELETED`
- manifest 写入失败时不能发布静态引用
- 需要处理 Phoenix 与 manifest 不一致的 reconciliation
- 需要定义缓存刷新和删除传播时间

#### 优点与代价

- 优点：读取路径不依赖 Phoenix 在线请求，也不需要每次获取 service token。
- 代价：引入第二份资产状态，需要事件、重试和 reconciliation；实现和运维复杂度最高。

### 方案 C：新增专用 Asset Catalog 接口

Assets Worker 不再调用 Phoenix 通用 GraphQL，而调用一个只负责资产定位的内部接口：

```text
GET /internal/assets/:assetPublicRef/origin
```

响应只包含读取所需字段：

```json
{
  "status": "ACTIVE",
  "storage": "r2",
  "storageKey": "...",
  "mimeType": "image/webp",
  "filename": "wallpaper.webp"
}
```

该接口仍然需要认证，但可以使用专用 scope（例如 `assets:origin:read`）、短 TTL 缓存和更稳定的版本契约，不把 Assets Worker 绑定到 Phoenix 的通用 GraphQL schema。

#### 优点与代价

- 优点：比 manifest 更容易保持 Phoenix 的状态权威，同时比通用 GraphQL 更低耦合。
- 代价：仍然依赖内部服务和 service-auth；需要维护新的接口、权限和版本兼容策略。

## 方案比较

| 方案                 | Phoenix 依赖 | 数据一致性复杂度 | 改动范围 | 适用阶段                 |
| -------------------- | ------------ | ---------------- | -------- | ------------------------ |
| A. 可靠化现有 lookup | 有           | 低               | 小       | 首版已落地，持续补齐测试 |
| B. origin manifest   | 无实时依赖   | 高               | 大       | 读取规模大、需要强解耦时 |
| C. Asset Catalog     | 有内部依赖   | 中               | 中       | 需要收敛 GraphQL 耦合时  |

## 推荐落地顺序

### 第一阶段：恢复并稳定现有链路

- 补齐本地 read worker 的 service-auth 配置（已落地）。
- 让 `.env` 显式提供本地 token endpoint、issuer、JWKS URL 和 secrets；生产 vars 与本地 vars 分环境隔离。
- 将 read worker 纳入 Dev Hub 编排，统一 `.env`、Dev Hub 和部署 secrets 的注入约定（已落地首版）。
- 增加基于虚构 asset ref、期望 resolver `null` 的 contract probe readiness 检查（已落地）。
- 增加静态资源 public-read 集成测试（现有 origin lookup 测试基础上继续补齐）。

### 第二阶段：降低运行风险

- 对成功的 origin lookup 做短 TTL 缓存，降低 Phoenix 请求压力。
- 明确 401/403/404/5xx 在 read worker 的映射和浏览器缓存策略。
- 增加 origin lookup 失败的结构化日志和可观测指标。

### 第三阶段：根据规模选择解耦方向

- 如果主要诉求是收敛接口边界，选择方案 C。
- 如果主要诉求是 Phoenix 不可用时仍能读取静态资产，选择方案 B，并先设计 finalize/delete/reconciliation 协议。

## 生产环境说明

当前问题没有证据表明是生产事故，原因是生产部署具备与 `cloudflare.config.ts` production mode 对应的 required secret bindings，并且生产 Auth、Phoenix 和 Assets Worker 使用同一套生产 service-auth 拓扑。当前 502 发生在本地手动启动的 read worker：它缺少本地 secrets，同时回退到了错误的 endpoint。

这不是放松生产检查的理由。生产仍应保留启动契约、readiness contract probe 和部署前 secret 校验，以防未来出现 issuer、JWKS、scope 或 client secret 分裂。

## 验收标准

1. 修改壁纸并保存后，Phoenix 返回新的 `staticRevision` 和 light/dark `staticAssetPublicRef`。
2. 两个静态 asset URL 均返回 `200 image/*`。
3. 刷新普通路由时不需要加载 GPU renderer，也能显示已发布壁纸。
4. Assets read worker 缺少必需 service-auth 配置时，readiness 明确失败，不再表现为运行中随机 502。
5. 资产不存在、已删除、Phoenix 暂时不可用和认证配置缺失能够被区分诊断。
6. 任何 manifest 或 Catalog 方案都必须保留 `assetPublicRef` 的不可变 URL 语义，以及 ACTIVE/DELETED 生命周期语义。

## 相关文档

- [`docs/auth/fix-history.md`](../auth/fix-history.md)：Service Auth issuer 漂移与错误码链路
- [`docs/assets-hub/v3.md`](./v3.md)：Assets Hub public read、上传和删除基线
- [`docs/assets-hub/v4.md`](./v4.md)：编辑器导出、上传和稳定 asset identity
- [`docs/feature/wallpaper/static-wallpaper.md`](../feature/wallpaper/static-wallpaper.md)：Wallpaper 静态运行态协议
