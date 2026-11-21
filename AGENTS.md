# Repository Guidelines

## Working in This Repository

- Follow the user's authorization and preserve unrelated work in the current worktree. For frontend changes, discuss the approach first unless the user authorizes implementation.
- Use the relevant repository skill in `.agents/skills/` for domain-specific workflows; for example, `fe` for frontend work and `gate-lifecycle` for CMS admission and lifecycle changes.
- Follow [docs/rules/naming.md](docs/rules/naming.md) for cross-project naming, including GraphQL operation and frontend Query names.
- Select checks based on the changed behavior and its consumers. Start with [the validation matrix](docs/infra/tooling/validation.md); report checks that failed, were blocked, or were not run.
- Local Git hooks are focused checks, not a substitute for relevant tests or CI. Inspect the staged diff before committing, especially after hooks that modify files.

## Backend Test Failure Triage

- When a broad backend suite reports failures, first rerun each failure as a focused test against a fresh, isolated test database. Separate a production regression from stale rows, test ordering, and shared-database contamination before changing production code.
- Tests that inspect a whole-database report or aggregate must assert only on rows owned by their fixtures. Do not require global reports to be empty when other tests can leave valid rows behind.
- Do not choose the "latest" event by timestamp alone when multiple events can share a timestamp. Select by a stable identity or assert against the exact event created by the operation under test.
- For a timeout, use the stack trace and query path to find the slow operation, then reproduce it with a focused test on a fresh database. Fix the measured hot path; raise the timeout only when the longer runtime is intentional and supported by evidence.
- During failure-driven work, rerun focused tests for each fix. Run the expensive full backend suite once after the final code and test changes on a clean database; repeat it only when subsequent changes or new evidence require it. Tell the user why a repeat is needed and report elapsed time and the exact result.

## Local Application Runtime

- When starting, stopping, restarting, diagnosing, or browser-checking local applications, follow [the Dev Hub skill](.agents/skills/dev-hub/SKILL.md) and use `pnpm devhub` or the public Make entrypoints. Do not launch Vite, Phoenix, Workers, or another application server directly, choose an alternate port, or background an unmanaged process. `.managed` commands are for Dev Hub; documented test runners may own isolated listeners for their tests.

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
