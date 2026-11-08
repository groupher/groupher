# Post Templates：重要程度与环境

> 状态：planned。产品方案已确认，尚未实施。本文定义拟议的数据与交互合同，不表示已有表、字段或 API。
>
> 本次仅整理文档，不修改业务代码、数据库 migration 或后台路由。

## 1. 范围与入口

后台入口固定为 **Dash → CMS → Post → Templates**，包含重要程度模板和环境模板。

- `priority` 固定四档；未填写为 `NULL`，不占档位。
- `priorityReasons` 是重要程度原因，支持模板、自定义文字或 emoji、AI 建议。
- `envs` 是结构化环境答案，模板与答案都采用 JSONB。
- 环境支持多棵树、平级分支、共享字段和多级联动，不限定业务层级深度，但禁止成环。
- 普通用户操作胶囊式选择器，不直接操作配置图。
- 不考虑旧帖兼容、历史数据迁移、模板历史版本或模板升级流程。

相关边界：

- [Article Draft / Revision](../article/revision-draft-target.md)：内容草稿与发布版本。
- [Article 与 Community](../article/article-community.md)：跨社区共享内容。
- [Tickets](../tickets/README.md)：Ticket 的工作优先级独立于 Post 用户表达。

## 2. 产品语义

### 2.1 Priority 与 reasons

| priority | 暂定展示文案 | 含义                           |
| -------- | ------------ | ------------------------------ |
| `NULL`   | 未填写       | 用户没有表达程度，不等于最低档 |
| `1`      | 轻微         | 较小影响                       |
| `2`      | 明显         | 已有明确影响                   |
| `3`      | 严重         | 影响较大                       |
| `4`      | 阻碍         | 无法继续完成目标               |

四档及其值固定；展示文案可按 Cat 调整，不改变底层值。Post priority 不自动决定 Ticket priority。

- Feature / Bug / Question 显示，普通讨论不显示；实现时映射到项目实际 Cat 枚举，本文的大写分类名是示意。
- 不预选，允许不填写。选择 reasons 时必须有明确的 priority。
- 左侧为单选档位，右侧为该档位的多选原因；末尾 `+` 添加自定义原因，不增加单独说明表单。
- reasons 没有固定业务词表，允许文字与 emoji 组合；仍需普通的长度、数量与请求体大小限制。
- AI 根据 Cat 和正文提供建议，不自动选中，不自动改变已选档位或用户内容。
- 自定义原因和被选中的 AI 建议只保存到 Post，不自动加入共享模板。

### 2.2 Envs 与 Post Tag 的区分

Post Tag 表达 Mobile、UI/UX、登录等主题；envs 表达产品版本、平台、系统、浏览器等可校验的运行条件或适用范围。

| Cat                 | envs 规则                                            |
| ------------------- | ---------------------------------------------------- |
| Bug                 | 至少一组环境；每组已展开的字段必填，可明确选“不清楚” |
| Feature             | 选填，表示适用范围，可以选择全平台或添加多组环境     |
| Question / 普通讨论 | 第一版隐藏                                           |

“全平台”“不清楚”“未填写”是不同语义。全平台只用于 Feature；不清楚可以满足必填，但不会触发更深层字段。

## 3. 最终表结构

只新增两张模板表，不新增 `post_envs`、`post_env_values` 或它们的 Draft / Revision 关系表。

### 3.1 `cms.post_priority_templates`

| 字段                         | 类型 / 约束              | 用途                           |
| ---------------------------- | ------------------------ | ------------------------------ |
| `id`                         | 项目现有主键类型         | 模板身份                       |
| `community_id`               | FK，非空，唯一           | 每社区一份重要程度模板         |
| `definition`                 | JSONB，非空，顶层 object | 四档 reasons 与开关            |
| `lock_version`               | integer，非空，默认 1    | 乐观锁，防止管理员覆盖彼此修改 |
| `inserted_at` / `updated_at` | 项目统一 UTC 时间        | 创建、修改时间                 |

### 3.2 `cms.post_env_templates`

| 字段                         | 类型 / 约束              | 用途                     |
| ---------------------------- | ------------------------ | ------------------------ |
| `id`                         | 项目现有主键类型         | 模板身份                 |
| `community_id`               | FK，非空，唯一           | 每社区一份环境模板       |
| `definition`                 | JSONB，非空，顶层 object | 根、字段、规则与编辑布局 |
| `lock_version`               | integer，非空，默认 1    | 乐观锁                   |
| `inserted_at` / `updated_at` | 项目统一 UTC 时间        | 创建、修改时间           |

`lock_version` 不是模板版本历史。管理员保存前先校验整张图，成功后原子更新并生效；冲突时提示重新加载，不静默覆盖。

Ecto 时间字段使用 `:utc_datetime`；migration 常规时间列使用 `:timestamptz`，时间戳沿用项目的 `timestamps()` 默认配置。

### 3.3 现有 Post typed Draft / Revision 扩展

两处均增加下列内容字段，具体物理扩展表沿用现有 Article 结构，不另建一套 Post 存储：

| DB 字段            | 接口字段          | 类型 / 默认值                       |
| ------------------ | ----------------- | ----------------------------------- |
| `priority`         | `priority`        | integer，可空；CHECK 为 NULL 或 1–4 |
| `priority_reasons` | `priorityReasons` | JSONB array，非空，默认 `[]`        |
| `envs`             | `envs`            | JSONB object，非空，默认空环境对象  |

空环境对象：

```json
{ "templateId": null, "groups": [], "labels": {} }
```

这些是内容字段，跟随 Draft → Revision 发布，不放进即时分类状态 `PostState`。不预建另一份 Public JSON：公开查询通过当前 `ArticlePublic.revision_id` 读取对应 Post Revision 扩展。

## 4. Priority template JSON

```json
{
  "cats": ["FEATURE", "BUG", "QUESTION"],
  "levels": {
    "1": {
      "reasons": [
        { "id": "more_convenient", "text": "更方便", "cats": ["FEATURE"] },
        { "id": "occasional", "text": "偶尔遇到", "cats": ["BUG"] }
      ]
    },
    "2": {
      "reasons": [
        { "id": "daily", "text": "每天遇到", "cats": ["BUG"] },
        { "id": "extra_steps", "text": "需要绕路处理" }
      ]
    },
    "3": {
      "reasons": [{ "id": "frequent_interruptions", "text": "频繁中断工作" }]
    },
    "4": {
      "reasons": [
        { "id": "blocked", "text": "无法继续" },
        { "id": "no_workaround", "text": "没有替代办法", "cats": ["BUG"] }
      ]
    }
  },
  "allowCustom": true,
  "aiSuggestions": true
}
```

- `levels` 必须且只能有 `1`、`2`、`3`、`4`；每档 reasons 数组允许为空。
- 数组顺序决定展示顺序；不写 reason 的 `cats` 表示适用模板中的全部分类。
- reason ID 在同一模板内唯一。更改文字不改变 ID；不能把 ID 改作另一种含义。

Post 保存的是选择结果与文字快照：

```json
[
  { "optionId": "daily", "text": "每天遇到" },
  { "optionId": null, "text": "😵 每次都要重新登录" }
]
```

模板原因有 `optionId`，自定义或 AI 新建议没有；文本快照使展示不必依赖模板当前文案。切换 priority 后重新展示对应原因选项，不静默将旧档原因归到新档。

## 5. Env template JSON

采用 `roots + fields + rules`，不重复维护另一份具有业务含义的 edges。后台图的连线由 rules 生成，拖线编辑也写回 rules。

```text
产品                         平台
 └─ 产品版本                  ├─ Web
                             │   ├─ 操作系统 → 系统版本
                             │   └─ 浏览器
                             └─ 桌面客户端
                                 └─ 操作系统 → 系统版本
                                    （引用同一个字段）
```

产品版本是产品的下级，与平台树独立；操作系统与浏览器是 Web 下的平级分支。

以下字段和选项使用可读 ID 举例，实际 ID 由后台生成，保持稳定，不用显示文案充当身份。

```json
{
  "cats": {
    "BUG": { "visible": true, "required": true },
    "FEATURE": { "visible": true, "required": false }
  },
  "roots": [
    { "field": "product", "label": "产品" },
    { "field": "platform", "label": "使用平台" }
  ],
  "fields": {
    "product": {
      "label": "产品",
      "multiple": false,
      "allowUnknown": true,
      "options": [{ "id": "groupher", "label": "Groupher" }]
    },
    "productVersion": {
      "label": "产品版本",
      "multiple": false,
      "allowUnknown": true,
      "defaultFrom": "productContext.version",
      "options": [
        { "id": "v24", "label": "2.4" },
        { "id": "v25", "label": "2.5" }
      ]
    },
    "platform": {
      "label": "平台",
      "multiple": false,
      "allowUnknown": true,
      "options": [
        { "id": "web", "label": "Web" },
        { "id": "desktop", "label": "桌面客户端" },
        { "id": "all", "label": "全平台", "kind": "any", "cats": ["FEATURE"] }
      ]
    },
    "os": {
      "label": "操作系统",
      "multiple": false,
      "allowUnknown": true,
      "defaultFrom": "device.os",
      "options": [
        { "id": "ios", "label": "iOS" },
        { "id": "macos", "label": "macOS" },
        { "id": "windows", "label": "Windows" }
      ]
    },
    "osVersion": {
      "label": "系统版本",
      "multiple": false,
      "allowUnknown": true,
      "defaultFrom": "device.osVersion",
      "options": [
        { "id": "ios18", "label": "18" },
        { "id": "ios19", "label": "19" },
        { "id": "macos15", "label": "15" },
        { "id": "win11", "label": "11" }
      ]
    },
    "browser": {
      "label": "浏览器",
      "multiple": false,
      "allowUnknown": true,
      "defaultFrom": "device.browser",
      "options": [
        { "id": "safari", "label": "Safari" },
        { "id": "chrome", "label": "Chrome" },
        { "id": "firefox", "label": "Firefox" }
      ]
    }
  },
  "rules": [
    {
      "when": [{ "field": "product", "in": ["groupher"] }],
      "show": [{ "field": "productVersion", "options": ["v24", "v25"] }]
    },
    {
      "when": [{ "field": "platform", "in": ["web"] }],
      "show": [{ "field": "os" }, { "field": "browser" }]
    },
    {
      "when": [{ "field": "platform", "in": ["desktop"] }],
      "show": [{ "field": "os", "options": ["macos", "windows"] }]
    },
    {
      "when": [{ "field": "os", "in": ["ios"] }],
      "show": [{ "field": "osVersion", "options": ["ios18", "ios19"] }]
    },
    {
      "when": [{ "field": "os", "in": ["macos"] }],
      "show": [{ "field": "osVersion", "options": ["macos15"] }]
    },
    {
      "when": [{ "field": "os", "in": ["windows"] }],
      "show": [{ "field": "osVersion", "options": ["win11"] }]
    }
  ],
  "editor": { "positions": {} }
}
```

### 5.1 层级与执行规则

| 结构                     | 含义                                                      |
| ------------------------ | --------------------------------------------------------- |
| 多个 roots               | 多棵独立树、多个用户入口，同时存在                        |
| 一条 show 中多个字段     | 同时展开的平级分支                                        |
| 多条规则指向同一字段     | 共享字段，只显示和保存一份答案                            |
| show.options             | 当前路径允许的选项子集                                    |
| 不写 show.options        | 允许该字段全部符合 Cat 的选项                             |
| 一条 when 中多个条件     | AND，全部满足                                             |
| 一个 in 中多个选项       | OR，至少命中一个                                          |
| 多条命中规则指向同一字段 | 入口为 OR，可选项取并集；任一路径不限制则允许全部适用选项 |

字段默认只在被触发时显示；roots 始终可见。第一版 root 字段不再作为规则目标，避免“根默认全选项”和入边限制冲突。

每次计算从 roots 开始，按依赖拓扑顺序执行。只有当前有效字段的有效答案才能触发下游，隐藏字段的残留值不能触发规则。规则依赖图中，每个 when 字段指向每个 show 字段，整个图必须无环。

依赖深度没有固定业务上限。新增层级只需新增字段和规则；仍应限制总字段数、规则数及 JSON 大小，避免异常配置。

例：仅 Web + iOS 时显示某字段，可以在同一 when 中写两个条件；无需复制操作系统字段。

```json
{
  "when": [
    { "field": "platform", "in": ["web"] },
    { "field": "os", "in": ["ios"] }
  ],
  "show": [{ "field": "someField" }]
}
```

### 5.2 特殊值与切换

- `allowUnknown: true` 为当前字段附加保留值 `$unknown`，不要求管理员重复创建。
- `$unknown` 与普通值互斥，不出现在 when 条件中，也不触发下游。
- `kind: "any"` 是明确的不限范围选项，不能仅凭名称“全部”推断；与其他值互斥，不触发下游。示例只在 Feature 平台选项使用。
- 不写 option.cats 表示适用模板可见的所有分类。
- 改变父字段时重新计算；清除失效字段和已不允许的选项，仍由其他路径激活的共享字段可以保留。
- 草稿可暂时缺少必填值，但不能持久化未知 ID 或不合法组合；发布时执行完整必填校验。

## 6. 用户端与默认值

用户主要看到两个胶囊：

```text
[Groupher · 2.4 ▾]  [Web · iOS 18 · Safari ▾]
```

产品胶囊中选择产品与版本；平台胶囊中选择平台，并逐步展开系统、浏览器及更细选择。平级分支在同一弹层内分别选择。配置图深度不等于必须嵌套同样深的菜单，深层字段可以在弹层内展开。

- `defaultFrom` 是白名单来源标识，不是可执行代码或任意路径求值器。
- 产品接入信息、设备系统和浏览器可匹配现有选项后预填；识别不到的版本不强行猜测。
- 当前提交设备不一定是故障设备，预填值需清晰可见、可改。
- 内容或 AI 推断只建议现有选项；不发明字段、版本或目录选项。
- 不覆盖用户已经修改的值；无需为每个默认值额外增加确认表单。
- 多组环境通过“添加其他环境”创建，不能把两个设备的数据混成一组。

## 7. Post envs JSON

```json
{
  "templateId": "env_template_123",
  "groups": [
    {
      "id": "group_1",
      "values": {
        "product": ["groupher"],
        "productVersion": ["v24"],
        "platform": ["web"],
        "os": ["ios"],
        "osVersion": ["ios18"],
        "browser": ["safari"]
      }
    },
    {
      "id": "group_2",
      "values": {
        "product": ["groupher"],
        "productVersion": ["v24"],
        "platform": ["web"],
        "os": ["windows"],
        "osVersion": ["win11"],
        "browser": ["chrome"]
      }
    }
  ],
  "labels": {
    "product": { "label": "产品", "options": { "groupher": "Groupher" } },
    "productVersion": { "label": "产品版本", "options": { "v24": "2.4" } },
    "platform": { "label": "平台", "options": { "web": "Web" } },
    "os": { "label": "操作系统", "options": { "ios": "iOS", "windows": "Windows" } },
    "osVersion": { "label": "系统版本", "options": { "ios18": "18", "win11": "11" } },
    "browser": { "label": "浏览器", "options": { "safari": "Safari", "chrome": "Chrome" } }
  }
}
```

- `templateId` 标识选项所属模板，不代表模板历史版本。
- `groups` 每项是一套实际环境；group ID 在同一 Post 内唯一。
- `values` 保存稳定字段与选项 ID，值统一为数组，单选也一样。
- `labels` 只保存本次使用的字段、选项文字，由服务端生成；不信任客户端提交的文案，不参与筛选。
- 不复制整张配置图；没有模板历史版本绑定或旧帖迁移机制。
- Post 镜像到其他社区仍保留原 templateId 与答案；不得用目标社区同名选项重新解释 ID。筛选 ID 必须带模板身份。

## 8. 联动筛选与查询

### 8.1 控件联动

后台筛选复用 fields / rules 的依赖和选项范围，但不复用填写必填规则或自动默认值。

- 选择 Web，可进一步选择系统和浏览器；选择 iOS，版本列表只出现 iOS 版本。
- 支持直接搜索具体选项，不强制先选根。路径唯一时可以补齐父条件；存在多条候选路径时让用户选择，不能静默猜测。
- 同字段多个候选是 OR，不同字段是 AND。
- 不指定系统版本即包含所有版本；无需枚举每个版本。
- 不清楚仅在明确筛选时匹配，不能作为普通选项通配符。
- Feature 的不限范围选项通过“包含全平台”开关显式加入匹配；未填写不等于全平台。

### 8.2 同组匹配

所有 AND 条件必须在同一个 groups 元素内满足。以上答案应命中 iOS 18 + Safari，不应命中 Windows + Safari。

以下 SQL 以 `revision_ext` 代表当前公开版本对应的 Post 扩展表别名，示意 JSONB 查询，不是已实施 SQL：

```sql
WHERE revision_ext.envs @> '{
  "templateId": "env_template_123",
  "groups": [{
    "values": {
      "os": ["ios"],
      "osVersion": ["ios18"],
      "browser": ["safari"]
    }
  }]
}'::jsonb
```

不能将上述条件拆成多个独立的 groups 包含判断，否则会跨组误命中。同字段“iOS 或 Windows”生成两个完整同组谓词的 OR，不能写 `os: ["ios", "windows"]`，后者要求同时包含两者。实现须参数化绑定 JSON，不拼接用户输入到 SQL。

筛选在分页、计数之前执行，保留现有 Community / binding / Gate / Lifecycle 限制，只读取当前公开 Revision，不能扫描草稿或把旧 Revision 当作当前结果。

### 8.3 索引

- 两张模板表各自的 `community_id` 唯一索引。
- 当前 Post Revision 扩展表的 `priority` B-tree 索引，用于固定档位筛选。
- Post Revision 扩展表的 `envs` 建立 `GIN (envs jsonb_path_ops)`，服务包含条件 `@>`。
- Draft 不承担公共筛选，不为其 envs 预建 GIN。
- 第一版不预建 reasons 文本检索索引或环境关系投影。

JSONB 嵌套包含与 GIN 的依据见 [PostgreSQL JSON Types](https://www.postgresql.org/docs/current/datatype-json.html#JSON-INDEXING)。索引能否有效参与具体查询仍需结合实际执行计划验收。

## 9. 保存与发布边界

```text
管理员编辑模板
  → 服务端校验整张定义
  → 按 lock_version 原子保存
  → 后续新填写使用当前定义

用户编辑 Post
  → 匹配默认值 / 手动选择
  → 校验 ID、分类、联动和单多选
  → 保存 typed Draft（允许尚未完成必填）
  → 发布时校验完整性并生成服务端 labels
  → 同一事务写入不可变 typed Revision，推进现有 Public revision 指针
```

已有 Post 的编辑从当前内容版本初始化；不额外引入模板升级或兼容流程。模板在用户填写期间发生变化导致选择失效时，返回明确的字段错误并刷新选项，不静默换成其他选项。

Post 的 cat 仍是现有即时分类事实，不因本功能进入 Revision。发布按锁内当前 Cat 校验；切换 Cat 不自动推断 priority、删除已发布内容或改变 Ticket priority。新分类不适用的控件隐藏，下次内容保存时按当前分类校验和规范化。

模板管理写入需要当前社区相应管理权限；Post 修改和发布继续复用现有作者、Gate、Lifecycle 与命令边界，不因 JSONB 提交绕过授权。

## 10. 实施验收清单

- [ ] priority 固定 1–4，NULL 独立，非法档位拒绝。
- [ ] reasons 支持模板、自定义和 AI 建议，四档行布局无额外说明表单。
- [ ] 后台入口为 CMS → Post → Templates；两类模板独立保存。
- [ ] 环境图支持多根、平级、共享字段及超过三级的依赖。
- [ ] 所有引用有效，禁止循环，稳定 ID 不依赖文案。
- [ ] AND 条件、OR 入口与选项并集合并遵循本文规则。
- [ ] 父选项切换后清理失效答案，保留仍适用的共享字段答案。
- [ ] Bug 发布完整性、“不清楚”、Feature 选填和全平台语义正确。
- [ ] 默认值只匹配现有选项，不覆盖用户修改。
- [ ] 两组环境不会产生 Windows + Safari 之类的跨组误命中。
- [ ] 同字段 OR、跨字段 AND、直接选子项与路径歧义有明确行为。
- [ ] 保存 Draft 不改变公开值；筛选只命中当前公开 Revision。
- [ ] 模板乐观锁冲突、配置失效与越权提交有明确错误。
- [ ] 验证实际查询计划；本清单仅是后续实施验收要求，不表示已完成。
