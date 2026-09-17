defmodule GroupherServer.Repo.Migrations.AddArticleTypeToAnalysis do
  use Ecto.Migration

  def up do
    alter table(:analysis_metric_events, prefix: "cms") do
      add(:article_type, :string, null: false)
    end

    alter table(:article_hourly_metrics, prefix: "cms") do
      add(:article_type, :string, null: false)
    end

    drop(
      index(
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

    create(
      unique_index(
        :article_hourly_metrics,
        [
          :article_type,
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

    create(
      index(:article_hourly_metrics, [:article_type, :article_id, :bucket_started_at],
        prefix: "cms",
        name: :article_hourly_metrics_article_type_id_bucket_index
      )
    )
  end

  def down do
    drop(
      index(
        :article_hourly_metrics,
        [:article_type, :article_id, :bucket_started_at],
        prefix: "cms",
        name: :article_hourly_metrics_article_type_id_bucket_index
      )
    )

    drop(
      index(
        :article_hourly_metrics,
        [
          :article_type,
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

    alter table(:article_hourly_metrics, prefix: "cms") do
      remove(:article_type)
    end

    alter table(:analysis_metric_events, prefix: "cms") do
      remove(:article_type)
    end
  end
end
