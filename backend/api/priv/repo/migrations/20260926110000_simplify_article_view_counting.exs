defmodule GroupherServer.Repo.Migrations.SimplifyArticleViewCounting do
  use Ecto.Migration

  def up do
    drop(table(:article_view_count_receipts, prefix: "cms"))
    drop(table(:article_view_watermarks, prefix: "cms"))

    create table(:article_view_dedupe_states, primary_key: false, prefix: "cms") do
      add(:thread, :string, null: false)
      add(:article_id, :bigint, null: false)
      add(:viewer_tracking_key, :binary, null: false)
      add(:last_counted_at, :timestamptz, null: false)
      add(:expires_at, :timestamptz, null: false)

      timestamps()
    end

    create(
      unique_index(
        :article_view_dedupe_states,
        [:thread, :article_id, :viewer_tracking_key],
        prefix: "cms",
        name: :article_view_dedupe_states_article_viewer_index
      )
    )

    create(
      index(:article_view_dedupe_states, [:expires_at, :thread, :article_id],
        prefix: "cms",
        name: :article_view_dedupe_states_expiry_index
      )
    )
  end

  def down do
    raise "SimplifyArticleViewCounting is an irreversible protocol cutover"
  end
end
