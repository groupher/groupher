# Repository Guidelines

## Backend Time Fields

- Treat application time as UTC. Use `DateTime.utc_now()` directly or `Helper.Datetime` helpers for current datetimes, dates, shifts, and date-window boundaries.
- In Ecto schemas, declare datetime fields as `:utc_datetime`.

  ```elixir
  schema "articles" do
    field(:published_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end
  ```

- In migrations, declare regular datetime columns as `:timestamptz`.

  ```elixir
  create table(:articles, prefix: "cms") do
    add(:published_at, :timestamptz)

    timestamps()
  end
  ```

- `timestamps()` should be used without an explicit type unless there is a specific reason not to. `GroupherServer.Repo` sets `migration_timestamps: [type: :timestamptz]`, so migration timestamps are created as `timestamptz` by default.
- Date-only fields, such as contribution dates, should remain `:date`; do not convert them to datetime columns.
- Do not introduce local-time semantics or rely on the database/server timezone. Repo connections set the database session timezone to UTC.

## Elixir Block Style

- Use inline `do:` only when the complete expression fits on one physical line.
- Once a `def`, `defp`, `defmacro`, `defmacrop`, `if`, `unless`, `case`, or `with` expression wraps, use the full `do ... end` form.
- Do not split an inline expression after a comma and continue it with `do:` or `else:` on another line.

## Business Return Shapes

- 业务层函数统一返回 `{:ok, value}` 或 `{:error, reason}`，不要用裸 `:ok` / `:error` 表示业务结果。
- 只有协议、回调或框架明确要求其他返回形状时，才保留例外；内部 helper 也应尽量沿用 tagged tuple，便于调用方组合和处理错误。
- 单个查询后的二分支优先使用 `case`；`with` 留给两个或更多有依赖关系的 tagged-tuple 步骤。
