defmodule GroupherServer.Repo.Migrations.CreateArticleInsights do
  use Ecto.Migration

  def up do
    create table(:analysis_metric_events, prefix: "cms") do
      add(:operation_id, :uuid, null: false)
      add(:community_id, references(:communities, prefix: "cms", on_delete: :nilify_all))
      add(:article_id, :bigint, null: false)
      add(:metric, :string, null: false)
      add(:value, :integer, null: false, default: 1)
      add(:actor_type, :string, null: false, default: "all")
      add(:is_authenticated, :boolean, null: false, default: false)
      add(:policy_version, :integer, null: false, default: 0)
      add(:occurred_at, :timestamptz, null: false)
      add(:aggregated_at, :timestamptz)
      add(:attempts, :integer, null: false, default: 0)
      add(:last_error, :text)

      timestamps()
    end

    create(
      unique_index(:analysis_metric_events, [:operation_id, :metric],
        prefix: "cms",
        name: :analysis_metric_events_operation_metric_index
      )
    )

    create(
      index(:analysis_metric_events, [:aggregated_at, :inserted_at],
        prefix: "cms",
        name: :analysis_metric_events_pending_index,
        where: "aggregated_at IS NULL"
      )
    )

    create table(:article_hourly_metrics, prefix: "cms") do
      add(:community_id, references(:communities, prefix: "cms", on_delete: :nilify_all))
      add(:article_id, :bigint, null: false)
      add(:bucket_started_at, :timestamptz, null: false)
      add(:metric, :string, null: false)
      add(:actor_type, :string, null: false, default: "all")
      add(:policy_version, :integer, null: false, default: 0)
      add(:is_authenticated, :boolean, null: false, default: false)
      add(:value, :bigint, null: false, default: 0)

      timestamps()
    end

    create(
      unique_index(
        :article_hourly_metrics,
        [
          :article_id,
          :bucket_started_at,
          :metric,
          :actor_type,
          :is_authenticated,
          :policy_version
        ],
        prefix: "cms",
        name: :article_hourly_metrics_dimension_index
      )
    )

    create(index(:article_hourly_metrics, [:article_id, :bucket_started_at], prefix: "cms"))
  end

  def down do
    drop(table(:article_hourly_metrics, prefix: "cms"))
    drop(table(:analysis_metric_events, prefix: "cms"))
  end
end
