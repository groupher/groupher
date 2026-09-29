defmodule GroupherServer.Test.Analysis.MaintenanceTest do
  @moduledoc false

  use GroupherServer.TestMate, async: false

  alias GroupherServer.Analysis
  alias Analysis.{Config, Maintenance}
  alias Analysis.Model.{ArticleHourlyMetric, MetricEvent}

  setup do
    previous = Application.get_env(:groupher_server, Config, [])

    Application.put_env(:groupher_server, Config,
      Keyword.merge(previous,
        metric_event_retention_days: 1,
        hourly_metric_retention_months: 1,
        retention_batch_size: 1,
        retention_max_batches: 1,
        retention_snooze_seconds: 1
      )
    )

    on_exit(fn -> Application.put_env(:groupher_server, Config, previous) end)
    :ok
  end

  test "deletes within a row budget and reports remaining work" do
    {_community, article, _attrs, _user} = mock_article(:post)
    now = DateTime.utc_now(:second)
    old = DateTime.add(now, -100, :day)

    Enum.each(1..2, fn offset ->
      Repo.insert!(%MetricEvent{
        operation_id: Ecto.UUID.generate(),
        article_type: :post,
        article_id: article.id,
        metric: :upvote_added,
        value: 1,
        actor_type: :all,
        is_authenticated: false,
        policy_version: 1,
        occurred_at: DateTime.add(old, offset, :second),
        aggregated_at: now
      })

      Repo.insert!(%ArticleHourlyMetric{
        article_type: :post,
        article_id: article.id,
        bucket_started_at: DateTime.add(old, offset, :hour),
        metric: :upvote_added,
        actor_type: :all,
        is_authenticated: false,
        policy_version: 1,
        value: 1
      })
    end)

    Repo.insert!(%MetricEvent{
      operation_id: Ecto.UUID.generate(),
      article_type: :post,
      article_id: article.id,
      metric: :upvote_added,
      value: 1,
      actor_type: :all,
      is_authenticated: false,
      policy_version: 1,
      occurred_at: old,
      aggregated_at: nil
    })

    assert %{metric_events: 1, hourly_metrics: 1, more?: true} = Maintenance.delete_expired()
    assert %{metric_events: 1, hourly_metrics: 1, more?: false} = Maintenance.delete_expired()
    assert Repo.aggregate(MetricEvent, :count) == 1
    assert Repo.aggregate(ArticleHourlyMetric, :count) == 0
  end
end
