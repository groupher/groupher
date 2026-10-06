defmodule GroupherServer.Test.Analysis.ArticleInsightsTest do
  use GroupherServer.TestMate

  alias GroupherServer.Analysis
  alias Analysis.{Aggregator, ArticleInsights, MetricEvent, Model}
  alias MetricEvent, as: MetricEventAPI
  alias Model.{ArticleHourlyMetric, MetricEvent}

  test "aggregates each metric event once and preserves actor dimensions" do
    {_community, article, _attrs, _user} = mock_article(:post)
    bucket = DateTime.from_unix!(div(DateTime.to_unix(DateTime.utc_now(:second)), 3600) * 3600)
    operation_id = Ecto.UUID.generate()

    assert :ok =
             MetricEventAPI.append_article_action(article, operation_id, :upvote_added,
               occurred_at: bucket
             )

    assert :ok =
             MetricEventAPI.append_article_action(article, operation_id, :upvote_added,
               occurred_at: bucket
             )

    assert {:ok, 1} = Aggregator.run()
    assert {:ok, 0} = Aggregator.run()

    assert %ArticleHourlyMetric{
             article_id: article_id,
             metric: :upvote_added,
             actor_type: :all,
             is_authenticated: false,
             value: 1
           } = Repo.get_by(ArticleHourlyMetric, article_id: article.id)

    assert article_id == article.id
    assert Repo.aggregate(MetricEvent, :count) == 1

    assert %{pending: 0, failed: 0, oldest_pending_at: nil, oldest_pending_age_seconds: 0} =
             GroupherServer.Analysis.Maintenance.metrics()
  end

  test "ViewTracker events enter Article Insights with actor filtering" do
    {community, article, _attrs, user} = mock_article(:post)
    now = DateTime.utc_now(:second)
    from = DateTime.from_unix!(div(DateTime.to_unix(now), 3600) * 3600)
    to = DateTime.add(from, 3600, :second)

    assert {:ok, %{tracked: true}} =
             track_article_view(article, user, read_purpose: :public_read)

    assert {:ok, 1} = Aggregator.run()

    assert {:ok, result} =
             ArticleInsights.trend(article, user,
               from: from,
               to: to,
               metrics: [:article_view],
               actor_types: [:human]
             )

    assert [%{metrics: %{article_view: %{value: 1}}}] = result.items
    assert result.policy_versions == [1]
    refute result.has_mixed_policy

    assert {:ok, path_result} =
             ArticleInsights.trend_by_path(
               %{community: community.slug, thread: :post, inner_id: article.inner_id},
               user,
               from: from,
               to: to,
               metrics: [:article_view],
               actor_types: [:human]
             )

    assert [%{metrics: %{article_view: %{value: 1}}}] = path_result.items
  end

  test "view dimensions do not filter non-view metrics and ranges are bounded" do
    {_community, article, _attrs, user} = mock_article(:post)
    now = DateTime.utc_now(:second)
    bucket = DateTime.from_unix!(div(DateTime.to_unix(now), 3600) * 3600)

    assert :ok =
             MetricEventAPI.append_article_action(article, Ecto.UUID.generate(), :upvote_added,
               occurred_at: bucket
             )

    assert {:ok, 1} = Aggregator.run()

    assert {:ok, result} =
             ArticleInsights.trend(article, user,
               from: bucket,
               to: DateTime.add(bucket, 3600, :second),
               metrics: [:upvote_added],
               actor_types: [:agent],
               is_authenticated: true
             )

    assert [%{metrics: %{upvote_added: %{value: 1}}}] = result.items

    assert {:error, :insights_range_too_large} =
             ArticleInsights.trend(article, user,
               from: DateTime.add(bucket, -721, :hour),
               to: bucket,
               metrics: [:article_view]
             )
  end
end
