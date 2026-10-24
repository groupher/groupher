defmodule GroupherServer.Test.Analysis.ArticleInsightsTest do
  use GroupherServer.TestMate

  alias GroupherServer.Analysis
  alias GroupherServer.CMS
  alias CMS.Model.CommunityModerator
  alias Analysis.{Aggregator, ArticleInsights, MetricEvent, Model}
  alias MetricEvent, as: MetricEventAPI
  alias Model.{ArticleHourlyMetric, MetricEvent}

  test "aggregates each metric event once and preserves actor dimensions" do
    {_community, article, _attrs, _user} = mock_article(:post)
    binding = Repo.get_by!(GroupherServer.CMS.Model.ArticleBinding, article_id: article.id)
    bucket = DateTime.from_unix!(div(DateTime.to_unix(DateTime.utc_now(:second)), 3600) * 3600)
    operation_id = Ecto.UUID.generate()

    assert {:ok, :pass} =
             MetricEventAPI.append_article_action(article, operation_id, :upvote_added,
               occurred_at: bucket
             )

    assert {:ok, :pass} =
             MetricEventAPI.append_article_action(article, operation_id, :upvote_added,
               occurred_at: bucket
             )

    assert {:ok, 1} = Aggregator.run()
    assert {:ok, 0} = Aggregator.run()

    assert %ArticleHourlyMetric{
             article_id: article_id,
             binding_id: binding_id,
             metric: :upvote_added,
             actor_type: :all,
             is_authenticated: false,
             value: 1
           } = Repo.get_by(ArticleHourlyMetric, article_id: article.id)

    assert article_id == article.id
    assert binding_id == binding.id
    assert Repo.aggregate(MetricEvent, :count) == 1

    assert %{pending: 0, failed: 0, oldest_pending_at: nil, oldest_pending_age_seconds: 0} =
             GroupherServer.Analysis.Maintenance.metrics()
  end

  test "rejects a binding and Community pair that identify different scopes" do
    {community, article, _attrs, _user} = mock_article(:post)
    {:ok, other_community} = db_insert(:community)
    binding = Repo.get_by!(GroupherServer.CMS.Model.ArticleBinding, article_id: article.id)

    assert {:error, :invalid_article_metric} =
             MetricEventAPI.append_article_action(
               article,
               Ecto.UUID.generate(),
               :upvote_added,
               binding_id: binding.id,
               community_id: other_community.id
             )

    assert binding.community_id == community.id
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
               %{
                 community: community.slug,
                 thread: :post,
                 inner_id: article_inner_id(article, community)
               },
               user,
               from: from,
               to: to,
               metrics: [:article_view],
               actor_types: [:human]
             )

    assert [%{metrics: %{article_view: %{value: 1}}}] = path_result.items
  end

  test "loaded Article authorization and path resolution share the Insights Gate scope" do
    {community, article, _attrs, author} = mock_article(:post)
    {:ok, unrelated} = db_insert(:user)
    inner_id = article_inner_id(article, community)
    path = %{community: community.slug, thread: :post, inner_id: inner_id}

    assert {:ok, :pass} =
             CMS.Insights.authorize(article, author, :post, community: community.slug)

    assert {:ok, %{id: article_id}} = CMS.Insights.resolve(path, author, [])
    assert article_id == article.id

    assert {:error, %ErrorCat.Error{namespace: {:cms, :gate}, reason: :permission_denied}} =
             CMS.Insights.authorize(article, unrelated, :post, community: community.slug)

    assert {:error, %ErrorCat.Error{namespace: {:cms, :gate}, reason: :permission_denied}} =
             CMS.Insights.authorize(article, author, :post, community: "not-this-community")

    community_owner = Repo.get!(GroupherServer.Accounts.Model.User, community.user_id)
    assert {:ok, :pass} = CMS.Insights.authorize(article, community_owner, :post, [])

    {:ok, moderator} = db_insert(:user)

    Repo.insert!(
      CommunityModerator.changeset(%CommunityModerator{}, %{
        community_id: community.id,
        user_id: moderator.id
      })
    )

    moderator = %{
      moderator
      | cur_passport: %{
          "global" => %{},
          community.slug => %{"cms" => %{"article.insights.read" => true}}
        }
    }

    grants = Analysis.ArticleInsights.passport_granted_community_slugs(moderator)

    assert {:ok, :pass} =
             CMS.Insights.authorize(article, moderator, :post,
               community: community.slug,
               passport_granted_community_slugs: grants
             )
  end

  test "Doc Insights reject a non-main branch and missing lifecycle through Gate scope" do
    {community, doc, _attrs, author} = mock_article(:doc)

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :gate},
              reason: :scope_context_missing
            }} = CMS.Insights.authorize(doc, author, :doc, branch_id: 999)

    lifecycle = Repo.get_by!(GroupherServer.CMS.Model.DocLifecycle, article_id: doc.id)
    Repo.delete!(lifecycle)

    assert {:error,
            %ErrorCat.Error{
              namespace: {:cms, :gate},
              reason: :permission_denied
            }} = CMS.Insights.authorize(doc, author, :doc, community: community.slug)
  end

  test "view dimensions do not filter non-view metrics and ranges are bounded" do
    {_community, article, _attrs, user} = mock_article(:post)
    now = DateTime.utc_now(:second)
    bucket = DateTime.from_unix!(div(DateTime.to_unix(now), 3600) * 3600)

    assert {:ok, :pass} =
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
