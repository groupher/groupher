# MentionsGraph maintenance Auth 验证

> 状态：2026-11-05 真实 Auth 签发与隔离 Phoenix capability 验证通过；没有执行 B4。

## 目标与已完成配置

- Auth：`https://auth.groupher.com`，Cloudflare Worker `auth`。
- resource：`https://api.groupher.com/cms-maintenance`，精确 audience：`phoenix:cms-maintenance`。
- `cms-mentions-initialize` client 仅允许 `cms:mentions:initialize`。
- `cms-mentions-rebuild` client 仅允许 `cms:mentions:rebuild`。
- 两者通过新 secret binding `SERVICE_AUTH_CLIENTS_JSON_MAINTENANCE` 加入 registry；base、additions、extra 三个原有 registry、签名私钥、其他 binding 保留。
- 现网代码补丁只有 registry 合并一行；没有部署本地工作区中的其他 Auth 改动。三个模块中仅现有 app bundle 内容改变，入口及 LinkIntent 模块原样保留；Durable Object export/storage 声明原样保留。
- 原版本：`88d77672-9ef5-4189-a703-6c9a2929b1bc`。
- 启用版本：`c2aaea5b-5c5b-4db1-9e59-9d7c37d71ca7`（100%）；deployment：`dbbc8ac5-6147-4659-b165-5a13510def42`。

client secret 使用随机 48 bytes 生成，registry 只保存 SHA-256 hash。受控运维机凭据保存在
`~/.config/groupher/mentions-maintenance/auth.groupher.com.json`（目录 0700，文件 0600），
未写入仓库、命令参数、manifest 或日志。该文件为后续取 token 的凭据，不是长期 token。

## 重跑纯鉴权

在仓库根目录运行：

```sh
node backend/auth/scripts/check-mentions-maintenance.mjs
# 同时在目标 Fly 独立进程验证当前 capability 实现：
node backend/auth/scripts/check-mentions-maintenance.mjs --fly
```

另一个运维机可通过 `CMS_MENTIONS_CREDENTIALS_FILE` 指定受控凭据文件；不要在 argv 传 secret/token。
每次执行向 Auth 发出五次请求，受现有 service token rate limit 保护，避免在一分钟内连续重跑。
工具仅取得 token、检查权限并执行 verifier；本机通过 `mix run --no-start`，不启动 Repo、CMS 或任务。
临时 token 文件权限 0600，并在退出时删除；SSH 仅从 stdin 传递短时 token，远端临时脚本退出即删除。

实际结果：

| 检查                                                 | 结果                                    |
| ---------------------------------------------------- | --------------------------------------- |
| initialize 请求两个 scope                            | HTTP 200，仅授予 initialize，TTL 600 秒 |
| rebuild 请求两个 scope                               | HTTP 200，仅授予 rebuild，TTL 600 秒    |
| initializer 只请求 rebuild scope                     | HTTP 400 `invalid_scope`                |
| initializer 请求 Press resource                      | HTTP 400 `invalid_target`               |
| 错误 client credential                               | HTTP 401 `invalid_client`               |
| 本机当前 Phoenix：正确 scope / 交叉 scope / 篡改签名 | 5 checks passed                         |
| 目标 Fly 当前代码隔离进程：同上                      | 5 checks passed                         |

`--fly` 在 `groupher-api` 的独立 BEAM 进程中加载当前 verifier/capability 源码，使用线上 JWKS、
精确 issuer/audience 配置验证。它不修改正在服务的 BEAM 进程、release 或配置。
当前线上服务仍为旧 Phoenix release，未包含 maintenance audience/module；不能将隔离验证记成
正在服务的 release 已升级。B1–B3 出口通过后的发布阶段仍须核验实际新 release 配置。

## 操作边界与回退

此次未执行业务请求、数据库迁移、初始化、重建、停机、删表或新 MentionsGraph API/UI 发布。
B4 和外部候选搜索继续暂缓。

Auth 配置回退使用现有部署命令重新激活原版本（届时 maintenance client 将停止签发）：

```sh
pnpm --filter @groupher/backend-auth exec cf workers deployments create \
  --script-name auth --strategy percentage \
  --versions '[{"version_id":"88d77672-9ef5-4189-a703-6c9a2929b1bc","percentage":100}]'
```

未执行回退。发布机制与 binding 继承参见 [Cloudflare multipart metadata](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/)。
