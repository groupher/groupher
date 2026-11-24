# Dev Hub 集中本地配置

状态：本地实现与验收记录。配置由 Hub 按服务管理，子项目消费启动环境；不再通过修改 `services.ts` 临时指定数据库或编译缓存。保存不会自动重启服务，也不执行数据库迁移。

## 配置归属

| 内容                                   | 位置                                                                       | 维护方式                                       |
| -------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| 服务默认配置、可编辑键及外部凭据白名单 | `local/dev-hub/src/server/services.ts`                                     | 随代码审阅；端口、路由和内部身份不能在面板覆盖 |
| 每个服务的本地覆盖值                   | `local/dev-hub/.data/local-environment/services/<serviceId>/local-dev.env` | Hub 配置面板编辑；按服务隔离                   |
| 内部身份和签名密钥                     | `local/dev-hub/.data/local-environment/state.json`                         | 沿用既有生成、导入和持久复用机制               |
| 工具所需的运行文件                     | `local/dev-hub/.data/local-environment/workers/<serviceId>/`               | Hub 从解析结果生成；不是可维护的配置源         |

覆盖值只允许服务声明的 `editableEnvKeys` 和 `externalEnvKeys`。Phoenix 可配置 DB 参数、Mix 路径及其外部集成凭据；Press 可配置 DB 参数；Dash 可配置默认社区；Auth、Assets Hub 的外部集成凭据按各自白名单编辑。新增可调参数时，先在服务定义中声明真实消费键。

内部 `SERVICE_AUTH_*`、JWT 密钥、Hub 控制参数和服务端口属于 Hub 管理值，写入或重置均拒绝。白名单配置与外部凭据也会从父进程环境中去除，避免不同服务继承同名值。普通值按“服务默认值 → 本地覆盖值”解析；未声明的应用默认值仍由应用代码提供。

## 面板与生效时机

每个服务的配置抽屉默认打开 `local-dev.env` 页面，显示该服务声明的启动配置及来源：

- `Default`：可编辑项尚无本地覆盖，显示服务声明的默认值。
- `local-dev.env`：使用该服务的集中本地覆盖值。
- `Hub managed`：Hub 计算或分配的配置，只读。

敏感字段始终脱敏。已有密钥显示“已配置”，输入新值可替换；空白的未修改密码框不会清空密钥。Reset 删除本地覆盖，回到默认值或未配置状态。保存会立即持久化，重启 Hub 后仍保留；只有对应服务下次启动时才读取新值，面板不是运行中进程环境的实时快照。重启使用已有 Hub 服务操作单独发起。

项目原 `.env*` 文件仍可作为脱敏参考查看，但不再标为受管模式的有效环境来源。受管模式下，Vite 的 `envDir: false` 同时关闭应用 `.env*` 与 Cloudflare `.dev.vars*` 发现；Node 服务跳过 dotenv。Import 使用固定版本 Wrangler 的程序化配置支持，显式传入 Hub 生成的环境文件，从而跳过项目 dotenv；生产部署仍使用 `cf deploy`。

Elixir 的 `config.exs` / `dev.exs` / `runtime.exs` 仍是原生配置入口，通过 `System.get_env` 消费 Hub 注入值。

## 存储与迁移

集中配置目录使用 0700，文件使用 0600，通过既有 Hub 锁串行合并补丁并原子写入。读取与保存配置不初始化、轮换内部身份。HTTP 接口复用 Hub 的回环 Host / Origin 限制，拒绝未知服务、未授权键、非法值及过大请求，响应不返回敏感值。

原来的应用 dotenv 外部凭据不会再由 Hub 在日常启动时读取，也不自动删除。升级前，在面板录入需要保留的白名单值并确认配置已保存；不要把整份旧 `.env` 复制到集中文件。已有内部身份迁移仍使用原来的显式 check/apply 流程，不与普通配置保存混在一起。

## 验收

- 配置存储、HTTP 接口和启动环境组合测试：`src/server/service-environment.test.ts`。
- 隔离浏览器命令：`pnpm --filter @groupher/local-dev-hub run test:environment-ui`。使用真实编辑组件、HTTP 路由及临时配置目录，检查保存、刷新持久化、重置、密钥保留/脱敏和非法端口拒绝；不启动或修改正在使用的 Hub。
- 浏览器结果与截图输出到 `.playwright/dev-hub-environment-acceptance/`。

以上隔离验收不代表已运行的 Hub 加载了新代码。启用时仍需在所属工作树正常重启 Hub，并按需要单独重启相关服务。
