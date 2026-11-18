# Wallpaper Seed Fixture

> 状态：本地实现完成，线上验收待完成
>
> 目标：让 Community seed 在本地和线上都能生成真正可访问的 Wallpaper 图片，而不是只写入 Dashboard wallpaper 配置。

## 1. 问题边界

正式创建 Community 会写入默认的 Dashboard wallpaper 配置，例如 `gradient/amber_mauve`。这只是编辑器设置，不是公共页面使用的图片。

未初始化主题的公共页面现可直接读取随应用分发的内置默认图片；编辑器读取相同外观的 Backend 默认
settings。这个默认展示无需先运行 seed。显式 NONE 仍不显示图片。

Seed 的职责是创建真实的社区资产和发布历史，以验证下面这条正式发布链路：

```text
community_wallpapers
  -> wallpaper_snapshots
  -> wallpaper_snapshot_images
  -> assetPublicRef
  -> Assets Hub /a/<assetPublicRef>/original
```

因此 LiteHome seed 需要同时完成两件事：

1. 保留正式 Community create 产生的默认 wallpaper 配置。
2. 生成并发布 light/dark 两套静态图片快照。

只写 `CommunityDashboard`、只写 `WallpaperSnapshotImage`，或者只把文件复制到 R2，都不能形成完整的公共 Wallpaper。

## 2. 通用性

Wallpaper fixture 不应绑定 `home`。`home` 只是第一个调用方。

建议将职责拆成三层：

```text
Wallpaper fixture        固定图片、尺寸、checksum 和 settings
CMS.Wallpaper seed       为一个 Community 确认资产并发布快照
LiteHome seed            创建 Home，并组合 wallpaper、tags、posts、changelogs
```

目标接口形态：

```elixir
CMS.Seeds.Wallpaper.seed(community,
  manifest_path: "packages/contracts/fixtures/wallpaper/default-v1/manifest.json"
)
```

不同 Community 可以使用同一套图片 fixture，但资产引用必须属于当前 Community，不能直接共享另一个 Community 的 `assetPublicRef`。

## 3. Fixture 文件

建议将固定图片和输入 manifest 放在共享 contract fixture 下：

```text
packages/contracts/fixtures/wallpaper/default-v1/
├── manifest.json
├── light-wide.webp
├── light-desktop.webp
├── light-tablet.webp
├── light-phone.webp
├── dark-wide.webp
├── dark-desktop.webp
├── dark-tablet.webp
└── dark-phone.webp
```

图片是仓库中的固定输入，至少需要满足当前 Wallpaper profile contract：

| Theme      | Profile | Size        |
| ---------- | ------- | ----------- |
| light/dark | wide    | 1920 × 1080 |
| light/dark | desktop | 1440 × 900  |
| light/dark | tablet  | 1024 × 1366 |
| light/dark | phone   | 390 × 844   |

`manifest.json` 保存 fixture version、图片路径、profile、尺寸、mime type 和 checksum；Dashboard 的默认 settings 仍由正式 Community create 流程产生。

`assetPublicRef` 不应伪造为 `asset_seed_home_light_wide_v1` 这种业务字符串。它必须对应当前环境中真实存在且可读取的 `CommunityAsset`。如果由正式 upload intent 生成，应使用其返回的合法 `asset_...` 引用；如果采用固定 seed 引用，也必须遵守 Assets Hub 的资产引用格式，并为当前 Community 建立对应资产记录。

建议区分两个 manifest：

```text
fixture manifest       仓库固定输入，不包含环境资产身份
resolved manifest      seed 运行时补齐 assetPublicRef、storageKey 和 public URL
```

## 4. 资产预置与环境边界

不能只把 WebP 文件复制到某个本地目录或 R2。Assets Hub 的公共读取链路还会通过 Phoenix 查询 `communityAssetOriginInfo`，因此必须同时保证：

```text
当前环境 Assets Hub/R2 中存在对象
  + 当前环境 Phoenix 中存在 active CommunityAsset
  + assetPublicRef、storageKey、checksum 和尺寸一致
```

本地和线上使用同一套 fixture 输入，但上传目标由环境配置决定：

```text
本地:
  Assets Hub: assets.groupher.localhost
  R2/object store: development target

线上:
  Assets Hub: assets.groupher.com
  R2/object store: production target
```

seed 不能把本地生成的 `assetPublicRef` 直接复制到线上。每个环境都应该通过当前环境的 canonical asset upload/bootstrap 流程创建或确认资产，然后生成 resolved manifest。

资产预置应当幂等：当前 active snapshot 的四个 profile、CommunityAsset 内容哈希和 fixture version 一致时直接跳过；不存在、内容不一致或只有半成品时，重新走完整上传/发布流程。失败批次由 cancel/reconciliation 收敛，不能把跨 Community 的 `assetPublicRef` 当作复用键。

`cms.community_assets_public_ref_index` 对非空 `public_ref` 做全局唯一约束，且 `CommunityAsset` 属于具体 Community。因此可以复用同一套 fixture 字节和 checksum，但不能跨 Community 共享 `assetPublicRef` 或 `CommunityAsset` 行；每个 Community 都必须建立自己的八条资产记录。

## 5. Seed 发布流程

目标流程：

```text
创建 Community
  -> 创建正式 Dashboard 默认配置
  -> 读取 fixture 并校验尺寸/checksum
  -> 在当前环境 Assets Hub 确认八个 CommunityAsset
  -> 生成 resolved manifest
  -> 发布 light Wallpaper snapshot
  -> 发布 dark Wallpaper snapshot
  -> 更新 active light/dark snapshot pointer
  -> 继续 seed tags/posts/changelogs
```

LiteHome 先在数据库事务内完成 Community 与内容数据，再在事务外运行 Wallpaper seed。每个上传 intent
必须先提交，Assets Hub finalize 经另一条 Phoenix 连接回调时才能读取它。外部发布失败会保留已提交的
Community/内容，重跑通过既有幂等检查收敛；不承诺跨数据库与 Assets Hub 的整批原子回滚。
Batch create/cancel 使用 `ASSETS_HUB_BATCH_ENDPOINT`，presign/finalize 使用 `ASSETS_PUBLIC_ENDPOINT`。

Wallpaper seed helper 应复用现有 domain changeset、profile 校验、snapshot 和 active pointer 逻辑，不直接对 `community_wallpapers`、`wallpaper_snapshots` 或 `wallpaper_snapshot_images` 写 raw SQL。

对非 `none` 的 Wallpaper settings，`run_publish` 强制要求 `batch_ref`；发布 capability 还必须来自 Assets Hub 对完整 Generated Batch 的签名 claim。Seed 不能伪造 `batch_ref`、`assetPublicRef`、manifest 或 capability，也不能只写 R2 后直接插入 snapshot。

无浏览器的服务端路径需要编排现有上传协议：

```text
读取并校验 fixture
  -> 创建 Generated Batch
  -> 为八个 profile 创建真实 generated upload intent
  -> 使用 signed PUT 上传 WebP 到当前环境 R2
  -> finalize upload，得到当前 Community 的 CommunityAsset
  -> 将八个合法 manifest entry 注册到 Generated Batch
  -> claim publish capability
  -> 以真实 batch_ref/capability 调用 canonical Wallpaper publish workflow
```

这里的 `run_publish` 只能作为最后的领域发布步骤，并且输入必须来自真实 upload intent、batch registration 和 Assets Hub claim；LiteHome 不应绕过这些边界直接调用带 fake 数据的发布事务。该服务端编排是本方案相对于浏览器保存流程的主要新增工作量。

正常浏览器保存继续使用现有的 Generated Batch 流程；seed fixture 是无浏览器的服务端路径。两条路径最终必须产生相同的公共数据形状：

```text
active snapshot
  -> four valid WebP profile images per theme
  -> real CommunityAsset references
  -> Assets Hub public URL
```

## 6. 幂等与版本

fixture 需要有明确版本，例如 `default-v1`。seed 重跑时：

- 同一 Community、同一 fixture version、checksum 未变化：复用已有资产和快照。
- fixture version 变化：创建新 snapshot，并按正常 wallpaper version/retention 规则激活。
- asset object 存在但 Phoenix asset catalog 缺失：视为不完整，不能只复用 R2 object。
- snapshot 存在但 profile manifest 不完整：不能把它当作已发布 Wallpaper。
- R2 object、Assets Hub batch 和 Phoenix catalog 之间出现短暂不一致时，seed 必须能够安全重试；不能把跨系统步骤当作一个瞬时原子事务。
- Assets Hub 的 Generated Batch reconciliation 负责处理 publish claim 后 Phoenix 未完成的批次；`ProviderReconciliation` 当前负责 provider orphan 检测和删除意图补偿。若要把 R2-only object 自动恢复为 `CommunityAsset`，必须另行实现明确的 repair/adopt 流程。

`reset_lite_home` 删除 Community 时，应由现有 Community/asset 生命周期处理关联数据；fixture seed 不应单独删除共享对象或绕过资产清理协议。

## 7. 验收标准

### 本地

- 执行 `make be.seed.home` 后，`/home/post` 的 light/dark Wallpaper 都有静态图片。
- 每个 theme 的四个 profile URL（共八个）均使用 `https://assets.groupher.localhost`。
- 每个 URL 返回 `200 image/webp`。
- Dashboard Wallpaper 设置读取到合法的 `assetPublicRef`，不会出现伪造 fixture ref。
- 重复执行 seed 不产生重复 CommunityAsset 或无界增长的 Wallpaper snapshot。

### 线上

- seed 进程使用线上 `ASSETS_PUBLIC_ENDPOINT`、Batch endpoint、Delete endpoint 和 service credentials。
- 图片对象进入线上 Assets Hub/R2，而不是 seed 进程临时目录。
- 线上公共 URL 使用 `https://assets.groupher.com`。
- seed 在没有浏览器和前端进程的情况下可以完成。
- 发布不承诺 R2、Assets Hub 和 Phoenix 之间的跨系统瞬时原子性；失败后可以通过稳定 fixture identity、checksum、幂等查找和 reconciliation 安全重试并最终收敛。
- 线上验收前，应校验八个 CommunityAsset、完整 Generated Batch manifest、active snapshots 和每个 theme 的四个 profile URL；中断窗口依靠稳定 fixture 校验、幂等重跑、Generated Batch reconciliation 和现有资产清理流程收敛，不把跨系统步骤承诺为瞬时原子操作。

## 8. 与 Tags seed 的关系

Tags 是独立问题，不需要和 Wallpaper fixture 绑定。当前 LiteHome 还会配置 Dashboard 的 enable/base_info，创建或修复 post/changelog 的 tag groups 和 tags，为文章建立 tag binding，并为 posts 写入 kanban 状态；Wallpaper fixture 不应改变这些既有 seed 行为。

Tags 修复已经独立完成，不需要修改 Wallpaper contract，也不需要先完成本方案。Wallpaper seed 只需要在自己的阶段确认 Community、Dashboard 默认配置和公共图片发布产物。

## 9. 参考实现位置

- Community 默认 Dashboard：`backend/api/lib/groupher_server/cms/communities/commands/create.ex`
- Dashboard wallpaper 默认配置：`backend/api/lib/groupher_server/cms/dashboard/fields.ex`
- 公共 Wallpaper 查询：`backend/api/lib/groupher_server/cms/wallpaper/query.ex`
- Wallpaper 发布事务：`backend/api/lib/groupher_server/cms/wallpaper/workflow.ex`
- Provider reconciliation：`backend/api/lib/groupher_server/cms/assets/provider_reconciliation.ex`
- Assets Hub 公共读取：`backend/assets-hub/src/worker.ts`
- Generated Batch reconciliation：`backend/assets-hub/src/generated-batch-do.ts`
- Generated image contract：`packages/contracts/src/wallpaper.ts`
- LiteHome seed：`backend/api/lib/groupher_server/cms/seeds/lite_home.ex`
