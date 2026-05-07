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
