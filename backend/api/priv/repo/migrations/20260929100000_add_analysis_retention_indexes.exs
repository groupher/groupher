defmodule GroupherServer.Repo.Migrations.AddAnalysisRetentionIndexes do
  use Ecto.Migration

  def change do
    create(
      index(:analysis_metric_events, [:occurred_at, :id],
        prefix: "cms",
        name: :analysis_metric_events_retention_index,
        where: "aggregated_at IS NOT NULL"
      )
    )

    create(
      index(:article_hourly_metrics, [:bucket_started_at, :id],
        prefix: "cms",
        name: :article_hourly_metrics_retention_index
      )
    )
  end
end
