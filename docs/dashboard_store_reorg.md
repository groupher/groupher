# Dashboard Store 重组方案

> 状态：方案整理，尚未实施
>
> 目标：将页面展示数据与 Dashboard 编辑会话分离，同时保持现有 SavingBar 的修改检测、
> 保存、取消和回滚语义不变。

## 1. 背景

当前 `frontend/core/stores/dsb` 同时服务三类场景：

- Community 使用后端返回的最终 Dashboard 数据渲染社区；
- Landing 使用静态默认数据渲染共享布局；
- Dash 既要渲染当前值，又要处理编辑、保存、回滚、临时 UI 状态和后台交互。

为了支持 Dash，当前 `DsbStore` 除了产品展示字段，还包含：

- `original`、`touchedFields`；
- `saving`、`savingField`、`loading`；
- `editField`、`editFields`、`rollbackFields`、`acceptFields`；
- `editingTag`、`editingAlias`、`editingLink` 等编辑器状态；
- demo localStorage、snapshot 和自动同步逻辑；
- 部分 Dashboard 管理页面的临时选择状态。

结果是 Community 和 Landing 也会创建一套它们不需要的编辑运行时，通用 Dsb Provider
还需要理解 demo、dirty、SavingBar 和编辑器行为。

## 2. 核心结论

重组后只有两个全局 Store：

```text
DsbStore
  页面当前实际显示的数据
  Community、Landing、只读 Demo、正常 Dash 均使用

DsbEditStore
  当前值相对 original 的修改、保存和回滚状态
  只有具备编辑权限的 Dash 会话使用
```

对外 hooks 固定为：

```text
useDsb()      -> DsbStore
useDsbEdit()  -> DsbEditStore
```

不引入第二份“当前编辑数据”对象。页面上的当前值始终只存在于 `DsbStore`；
`DsbEditStore.original` 保存最近一次已确认的后台值。

## 3. 必须保持的 SavingBar 合同

当前 SavingBar 的核心模型应原样保留：

```text
当前值      DsbStore[field]
已保存基线  DsbEditStore.original[field]
修改状态    touchedFields[field]
保存状态    saving + savingField
```

状态变化如下：

```text
初始化
  DsbStore.title = "Groupher"
  original.title = "Groupher"
  touched.title = false

用户输入
  DsbStore.title = "New Title"
  original.title = "Groupher"
  touched.title = true

保存成功
  DsbStore.title = "New Title"
  original.title = "New Title"
  touched.title = false

取消修改
  DsbStore.title = original.title
  touched.title = false
```

必须遵守以下约束：

- 不在 `DsbEditStore` 中再保存一份完整的当前值；
- `editField` 直接修改 `DsbStore`，并刷新对应 touched 状态；
- `rollbackFields` 将 `original` 复制回 `DsbStore`；
- `acceptFields` 只在后台保存成功后更新 `original` 并清除 touched；
- `savingField` 继续决定具体 SavingBar 的 loading 状态；
- 多字段保存继续支持一组字段共同 accept 或 rollback；
- 迁移期间不改变 SavingBar 的 props、出现条件和交互节奏。

## 4. DsbStore

`DsbStore` 只表达“页面现在应该显示什么”。

```ts
type TDsbStore = TDsbFieldMap & {
  metric: TMetric
}
```

它保留当前真正参与社区和 Dashboard 渲染的字段，例如：

- 基础信息、品牌和社交信息；
- Theme、颜色和页面布局；
- Header、Footer、Widget；
- Post、Kanban、Changelog、Docs、Tag 展示配置；
- SEO、Analytics、RSS、Alias 和 Enable 配置。

共享 hooks，例如 `useMetric`、`useLayout`、`useFooterLinks` 和 `useHeaderLinks`，继续通过
`useDsb()` 读取当前值，不感知编辑权限、SavingBar 或后台 mutation。

不同宿主只负责提供不同初始数据：

```text
Community    后端已发布 Dashboard 数据 -> DsbStore
Landing      静态默认数据              -> DsbStore
只读 Demo    Demo 社区已发布数据        -> DsbStore
正常 Dash    后端已保存数据              -> DsbStore
```

`metric` 是宿主运行信息，不属于后台持久化 Dashboard 字段。第一阶段可以继续放在 DsbStore，
但不能进入 `original`、dirty 比较或保存 payload；后续可独立迁移宿主上下文。

## 5. DsbEditStore

`DsbEditStore` 只存在于可编辑 Dash 会话，建议合同为：

```ts
type TDsbEditStore = {
  original: TDsbFieldMap
  touchedFields: TDsbTouchedFields

  saving: boolean
  savingField: TDsbFieldKey | null
  loading: boolean
  saveError: Error | null

  editField: <K extends TDsbStoreFieldKey>(field: K, value: TDsbFieldMap[K]) => void
  editFields: (patch: Partial<TDsbFieldMap>) => void
  rollbackFields: (fields: readonly TDsbStoreFieldKey[]) => void
  acceptFields: (fields: readonly TDsbStoreFieldKey[]) => void
  replaceOriginal: (patch: Partial<TDsbFieldMap>) => void
  isTouched: (field: TDsbStoreFieldKey) => boolean
  anyTouched: (fields: readonly TDsbStoreFieldKey[]) => boolean
}
```

Provider 关系为：

```tsx
<DsbStoreProvider initData={dashboard}>
  <DsbEditStoreProvider original={dashboard}>{children}</DsbEditStoreProvider>
</DsbStoreProvider>
```

`DsbEditStoreProvider` 通过 `useDsb()` 取得当前 DsbStore，并由 edit、rollback 和 accept
actions 操作它。这样当前值只有一个来源，不存在两个 Store 之间持续同步整份配置的问题。

## 6. 字段归属

当前 `TStore` 不能整体搬入 `DsbEditStore`，需要按职责分类。

### DsbStore

- `TDsbFieldMap` 中真正参与最终页面渲染和发布的数据；
- 暂时保留 `metric`，但排除在持久化和 dirty 逻辑之外。

### DsbEditStore

- `original`；
- `touchedFields`；
- `saving`、`savingField`、`loading`、保存错误；
- edit、rollback、accept 和 touched actions。

### 下沉到具体编辑器

| 当前状态                                          | 目标归属              |
| ------------------------------------------------- | --------------------- |
| `editingLink`、`editingLinkMode`、`editingGroup*` | LinkEditor            |
| `editingTag`、`settingTag`                        | TagEditor             |
| `editingAlias`                                    | AliasEditor           |
| `docFaqSaveZone`                                  | DocFaqEditor          |
| `queryingMediaReportIndex`                        | MediaReport Editor    |
| `activeModerator`、规则编辑状态                   | Admin Editor          |
| `submenuCollapsed`                                | Dash navigation/shell |

`activeTagGroup`、`activeTagThread`、`moderators` 等当前位于 `TDsbFieldMap` 的字段，需要在实施前
逐项确认是发布数据、管理数据还是页面临时选择状态。不能仅因为它们当前在 `TDsbFieldMap`
就继续进入最终 DsbStore 合同。

## 7. 保存与后台交互

当前 `DsbThread/logic/useMutation.ts` 同时负责：

- 读取 Store；
- 判断保存字段；
- 序列化不同字段；
- 选择 GraphQL mutation；
- 发起请求；
- 更新 saving 状态；
- 保存成功后更新 original；
- 处理部分特殊编辑状态。

重组时将它拆成状态和请求两个职责，不引入新的通用 service 框架。

### DsbEditStore 管状态

```text
startSaving(field)
acceptFields(fields)
saveFailed(error)
rollbackFields(fields)
```

### Dash 保存函数管后台请求

```ts
saveDsbField(field, value)
```

该函数内部继续处理现有字段到 GraphQL mutation 的映射和序列化，例如：

```text
kanbanBoards
  -> serializeKanbanBoards
  -> 对应 GraphQL mutation

footerLinks
  -> serialize links
  -> 对应 GraphQL mutation
```

完整保存流程：

```text
SavingBar confirm
  -> DsbEditStore.startSaving(field)
  -> saveDsbField(field, DsbStore[field])
  -> 成功：DsbEditStore.acceptFields(fields)
  -> 失败：DsbEditStore.saveFailed(error)
```

这里的目标只是让后台协议不再和 Store 内部状态更新混在同一个超大 hook 中。

## 8. 只读 Demo

产品定义是：匿名用户从 Landing 进入 Demo 社区的 Dashboard 页面，但只能查看，不能改动。

目标结构：

```text
Landing
  -> Demo Dashboard URL
      -> 加载 Demo 社区已发布 Dashboard 数据
          -> DsbStore
              -> 只读 Dashboard UI
```

只读 Demo：

- 创建 `DsbStore`；
- 不创建 `DsbEditStore`；
- 不读取或写入 localStorage Dashboard config；
- 不保存 demo snapshot；
- 不订阅 Store 持久化匿名改动；
- 不允许触发后台 mutation；
- 编辑、保存、删除、拖拽等操作不渲染或 disabled。

是否可编辑属于 Dash 的访问模式，而不是 Dashboard 配置：

```ts
type TDsbAccessMode = 'edit' | 'readonly'
```

访问模式由 Dash route/shell 根据用户身份和 Demo 社区规则决定，不进入 `DsbStore`。

当前 `useDsbDemoMode`、localStorage config/snapshot 和通用 Provider 的 demo subscribe 逻辑与
上述产品定义冲突，实施时应删除，而不是迁移到 `DsbEditStore`。

## 9. Provider 组合

### Community

```tsx
<DsbStoreProvider initData={publishedDashboard}>{children}</DsbStoreProvider>
```

### Landing

```tsx
<DsbStoreProvider initData={landingDefaults}>{children}</DsbStoreProvider>
```

### 只读 Demo Dashboard

```tsx
<DsbAccessProvider mode='readonly'>
  <DsbStoreProvider initData={demoCommunityDashboard}>{children}</DsbStoreProvider>
</DsbAccessProvider>
```

### 正常 Dash

```tsx
<DsbAccessProvider mode='edit'>
  <DsbStoreProvider initData={publishedDashboard}>
    <DsbEditStoreProvider original={publishedDashboard}>{children}</DsbEditStoreProvider>
  </DsbStoreProvider>
</DsbAccessProvider>
```

## 10. 实施顺序

### Phase 1：冻结合同

1. 建立现有 `TStore` 字段归属清单；
2. 固定 `DsbStore 当前值 + DsbEditStore.original` 的 SavingBar 合同；
3. 为单字段、多字段、保存成功、保存失败和取消修改补齐状态测试；
4. 明确只读 Demo 的 route、权限来源和禁止操作清单。

### Phase 2：抽出 DsbEditStore

1. 将 `original`、touched、saving 和 edit actions 移入 `stores/dsbEdit`；
2. `DsbEditStoreProvider` 使用现有 `DsbStore` 作为当前值来源；
3. 将 SavingBar、`useTouch` 和 `useEdit` 切换到 `useDsbEdit()`；
4. 保持所有 SavingBar 交互和字段映射不变。

### Phase 3：清理 DsbStore

1. 从 DsbStore 删除 edit/session 字段；
2. Community 和 Landing 只挂载 DsbStore；
3. 将临时 UI 状态下沉到 Link、Tag、Alias、FAQ 和 Admin 编辑器；
4. 审计 `TDsbFieldMap` 中不属于最终发布数据的字段。

### Phase 4：收敛保存链路

1. 从 `useMutation.ts` 提取字段序列化和 GraphQL 调用；
2. 保存成功统一调用 `acceptFields`；
3. 保存失败统一清理 saving 并保留当前值和 touched；
4. 删除依赖 Promise 时序读取 `savingField` 的隐式逻辑。

### Phase 5：落实只读 Demo

1. Demo Dashboard 只加载已发布配置；
2. 删除 localStorage demo config、snapshot 和 subscribe；
3. 不挂载 DsbEditStore；
4. 对编辑入口和后台 mutation 增加权限回归测试。

## 11. 验收标准

- Community、Landing 只创建 DsbStore；
- 匿名只读 Demo 只创建 DsbStore，不能产生任何配置写请求；
- 正常 Dash 同时创建 DsbStore 和 DsbEditStore；
- 页面当前值只存在于 DsbStore，不存在第二份完整当前值；
- `original` 只存在于 DsbEditStore；
- SavingBar 的显示、loading、保存、取消和回滚行为与改造前一致；
- 保存成功后 original 更新且 touched 清除；
- 保存失败后当前值保留、original 不变、SavingBar 仍可重试；
- 多字段保存和回滚保持原子字段组语义；
- Community/Landing 不依赖 touched、saving、editing 或 mutation API；
- 编辑器临时 UI 状态不进入 DsbStore；
- 通用 Dsb Provider 不再读取 demo query 或 localStorage；
- `useMutation.ts` 不再同时承担 Store 状态机和全部后台协议映射。

## 12. 非目标

- 不改变 GraphQL/HTTP 中现有 `dashboard` 字段名称；
- 不修改 `TParseDashboard` 等外部数据契约命名；
- 不重写 SavingBar UI；
- 不改变现有字段级保存产品行为；
- 不将 Community、Landing 合并进 Dash runtime；
- 不允许只读 Demo 写入本地或后台 Dashboard 配置。
