defmodule GroupherServer.Test.CMS.ViewTrackerTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  import Plug.Conn, only: [fetch_cookies: 1]

  alias GroupherServer.{Analysis, CMS, Repo, RequestActor}
  alias Analysis.Model.MetricEvent
  alias CMS.Model.ArticleStats
  alias CMS.ViewTracker
  alias CMS.ViewTracker.AnonymousSession
  alias CMS.ViewTracker.Model.{ViewDedupeState, ViewerState}
  alias GroupherServerWeb.Schema

  test "GraphQL commits a view and returns the complete public/private state" do
    {community, post, _attrs, _user} = mock_article(:post)
    anonymous_session = %AnonymousSession{id: "browser-session-1"}
    {:ok, classification} = RequestActor.classify(anonymous_session: anonymous_session)

    mutation = """
    mutation Track($article: ArticlePathInput!) {
      trackArticleView(article: $article) {
        tracked
        articleStats { community thread innerId views viewsRevision snapshotAt }
        viewerState { community thread innerId viewerHasViewed }
      }
    }
    """

    assert {:ok, %{data: %{"trackArticleView" => result}}} =
             Absinthe.run(mutation, Schema,
               variables: %{
                 "article" => %{
                   "community" => community.slug,
                   "thread" => "POST",
                   "innerId" => Integer.to_string(post.inner_id)
                 }
               },
               context: %{
                 anonymous_session: anonymous_session,
                 request_actor: classification
               }
             )

    assert result["tracked"]
    assert result["articleStats"]["views"] == 1
    assert result["articleStats"]["viewsRevision"] == 1
    refute result["viewerState"]["viewerHasViewed"]
    assert Repo.aggregate(ViewDedupeState, :count) == 1
  end

  test "ViewerArticleState exposes only ViewTracker-owned private state" do
    query = """
    query Viewer($paths: [ArticlePathInput!]!) {
      articleViewerStates(paths: $paths) {
        viewerHasViewed
        viewerHasUpvoted
      }
    }
    """

    assert {:ok, %{errors: [error]}} =
             Absinthe.run(query, Schema, variables: %{"paths" => []})

    assert error.message =~ "Cannot query field \"viewerHasUpvoted\""
  end

  test "counted result is committed synchronously with stats, viewer state, and analytics" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, result} = track_article_view(post, user, read_purpose: :public_read)

    assert result.tracked
    assert result.article_stats.views == 1
    assert result.article_stats.views_revision == 1
    assert result.viewer_state.viewer_has_viewed
    assert Repo.get_by!(ViewerState, thread: :post, article_id: post.id, user_id: user.id)
    assert Repo.get_by!(MetricEvent, metric: :article_view)
  end

  test "an immediate retry is accepted without increasing views twice" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{tracked: true, article_stats: %{views: 1}}} =
             track_article_view(post, user, read_purpose: :public_read)

    assert {:ok, %{tracked: true, article_stats: %{views: 1}}} =
             track_article_view(post, user, read_purpose: :public_read)

    assert Repo.aggregate(ViewDedupeState, :count) == 1
    assert Repo.aggregate(MetricEvent, :count) == 1
  end

  test "concurrent requests for one actor and Article increase views at most once" do
    {_community, post, _attrs, user} = mock_article(:post)

    results =
      1..4
      |> Enum.map(fn _index ->
        Task.async(fn -> track_article_view(post, user, read_purpose: :public_read) end)
      end)
      |> Task.await_many(5_000)

    assert Enum.all?(results, &match?({:ok, %{tracked: true}}, &1))
    assert {:ok, %{views: 1, views_revision: 1}} = CMS.ArticleStats.fetch(:post, post.id)
    assert Repo.aggregate(ViewDedupeState, :count) == 1
    assert Repo.aggregate(MetricEvent, :count) == 1
  end

  test "a request counts again after its actor window has elapsed" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{article_stats: %{views: 1}}} =
             track_article_view(post, user, read_purpose: :public_read)

    make_dedupe_state_stale(post.id)

    assert {:ok, %{tracked: true, article_stats: %{views: 2, views_revision: 2}}} =
             track_article_view(post, user, read_purpose: :public_read)
  end

  test "human and agent use their own dedupe windows" do
    old_config = Application.get_env(:groupher_server, CMS.ViewTracker.Config)

    Application.put_env(:groupher_server, CMS.ViewTracker.Config,
      human_dedupe_window_seconds: 10,
      agent_dedupe_window_seconds: 20,
      cleanup_safety_margin_seconds: 60,
      cleanup_batch_size: 10,
      cleanup_row_budget: 100,
      cleanup_time_budget_ms: 5_000
    )

    on_exit(fn -> Application.put_env(:groupher_server, CMS.ViewTracker.Config, old_config) end)

    {_community, human_post, _attrs, user} = mock_article(:post)
    {_community, agent_post, _attrs, _user} = mock_article(:post)
    credential = service_credential()

    assert {:ok, %{article_stats: %{views: 1}}} =
             track_article_view(human_post, user, read_purpose: :public_read)

    assert {:ok, %{article_stats: %{views: 1}}} =
             track_article_view(agent_post, nil,
               service_credential: credential,
               read_purpose: :public_read
             )

    stale = DateTime.add(DateTime.utc_now(:second), -15, :second)
    Repo.update_all(ViewDedupeState, set: [last_counted_at: stale])

    assert {:ok, %{article_stats: %{views: 2}}} =
             track_article_view(human_post, user, read_purpose: :public_read)

    assert {:ok, %{article_stats: %{views: 1}}} =
             track_article_view(agent_post, nil,
               service_credential: credential,
               read_purpose: :public_read
             )
  end

  test "unknown and policy-excluded reads return tracked false without dedupe state" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{tracked: false}} =
             track_article_view(post, nil, read_purpose: :public_read)

    assert {:ok, %{tracked: false}} =
             track_article_view(post, user, read_purpose: :author_preview)

    assert Repo.aggregate(ViewDedupeState, :count) == 0
    assert Repo.aggregate(MetricEvent, :count) == 0
  end

  test "verified agent reads count without creating human ViewerState" do
    {_community, post, _attrs, _user} = mock_article(:post)

    assert {:ok, %{tracked: true, viewer_state: %{viewer_has_viewed: false}}} =
             track_article_view(post, nil,
               service_credential: service_credential("verified-agent"),
               read_purpose: :public_read
             )

    assert Repo.aggregate(ViewerState, :count) == 0
  end

  test "signed anonymous session participates in the sliding window" do
    {_community, post, _attrs, _user} = mock_article(:post)

    {conn, anonymous_session} = build_conn() |> fetch_cookies() |> AnonymousSession.ensure()
    cookie = conn.resp_cookies["groupher-viewer"].value

    second_conn =
      build_conn()
      |> Plug.Test.put_req_cookie("groupher-viewer", cookie)
      |> fetch_cookies()

    assert {_conn, ^anonymous_session} = AnonymousSession.ensure(second_conn)

    assert {:ok, %{tracked: true, article_stats: %{views: 1}}} =
             track_article_view(post, nil,
               anonymous_session: anonymous_session,
               read_purpose: :public_read
             )

    assert {:ok, %{tracked: true, article_stats: %{views: 1}}} =
             track_article_view(post, nil,
               anonymous_session: anonymous_session,
               read_purpose: :public_read
             )
  end

  test "cleanup drains more than one batch in a single run" do
    {_community, post, _attrs, _user} = mock_article(:post)
    old_config = Application.get_env(:groupher_server, CMS.ViewTracker.Config)

    Application.put_env(:groupher_server, CMS.ViewTracker.Config,
      human_dedupe_window_seconds: 10,
      agent_dedupe_window_seconds: 10,
      cleanup_safety_margin_seconds: 10,
      cleanup_batch_size: 1,
      cleanup_row_budget: 10,
      cleanup_time_budget_ms: 5_000
    )

    on_exit(fn -> Application.put_env(:groupher_server, CMS.ViewTracker.Config, old_config) end)

    stale = DateTime.add(DateTime.utc_now(:second), -60, :second)

    Repo.insert_all(ViewDedupeState, [
      dedupe_attrs(post.article_id, stale, "one"),
      dedupe_attrs(post.article_id, stale, "two"),
      dedupe_attrs(post.article_id, stale, "three")
    ])

    assert %{
             deleted_rows: 3,
             batch_count: 3,
             budget_exhausted: false,
             remaining_expired_rows: 0
           } = ViewTracker.cleanup_expired()
  end

  test "cleanup stops safely at its row budget and resumes on the next run" do
    {_community, post, _attrs, _user} = mock_article(:post)
    old_config = Application.get_env(:groupher_server, CMS.ViewTracker.Config)

    Application.put_env(:groupher_server, CMS.ViewTracker.Config,
      human_dedupe_window_seconds: 10,
      agent_dedupe_window_seconds: 10,
      cleanup_safety_margin_seconds: 10,
      cleanup_batch_size: 1,
      cleanup_row_budget: 2,
      cleanup_time_budget_ms: 5_000
    )

    on_exit(fn -> Application.put_env(:groupher_server, CMS.ViewTracker.Config, old_config) end)

    stale = DateTime.add(DateTime.utc_now(:second), -60, :second)

    Repo.insert_all(ViewDedupeState, [
      dedupe_attrs(post.article_id, stale, "one"),
      dedupe_attrs(post.article_id, stale, "two"),
      dedupe_attrs(post.article_id, stale, "three")
    ])

    assert %{deleted_rows: 2, budget_exhausted: true, remaining_expired_rows: 1} =
             ViewTracker.cleanup_expired()

    assert %{deleted_rows: 1, budget_exhausted: false, remaining_expired_rows: 0} =
             ViewTracker.cleanup_expired()
  end

  test "deletion cleanup removes every physical Article view row" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _result} = track_article_view(post, user, read_purpose: :public_read)

    assert :ok = ViewTracker.delete_article_state(:post, post.id)
    assert Repo.aggregate(ViewDedupeState, :count) == 0
    assert Repo.aggregate(ViewerState, :count) == 0
    assert is_nil(Repo.get_by(ArticleStats, thread: :post, article_id: post.id))
  end

  test "completed view followed by permanent deletion leaves no orphan" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{tracked: true}} =
             track_article_view(post, user, read_purpose: :public_read)

    assert {:ok, :ok} = delete_physical_article(post)
    assert_article_view_state_deleted(post.id)
  end

  test "tracking after committed permanent deletion cannot recreate projection rows" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, :ok} = delete_physical_article(post)

    assert {:error, _reason} =
             track_article_view(post, user, read_purpose: :public_read)

    assert_article_view_state_deleted(post.id)
  end

  test "tracking keeps the lock/dedupe/stats order and writes snapshot_at with DB clock" do
    {_community, post, _attrs, user} = mock_article(:post)

    {result, queries} =
      capture_repo_queries(fn ->
        track_article_view(post, user, read_purpose: :public_read)
      end)

    assert {:ok, %{tracked: true}} = result

    assert_query_order(queries, [
      &key_share_query?/1,
      &dedupe_state_upsert_query?/1,
      &article_stats_upsert_query?/1,
      &article_stats_select_query?/1
    ])

    assert Enum.any?(queries, fn query ->
             article_stats_upsert_query?(query) and String.contains?(query, "clock_timestamp()")
           end)

    stats_reads = Enum.filter(queries, &article_stats_select_query?/1)
    assert length(stats_reads) == 1
    assert hd(stats_reads) =~ ~s["cms"."article_emotion_counts"]
  end

  test "ArticleStats derives comment counts from the stable Article aggregate" do
    {_community, post, _attrs, _user} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, post.article_id)

    assert :ok = CMS.ArticleStats.apply_comment_counts(article)

    assert {:ok, %{comments_count: 0, comments_revision: 0}} =
             CMS.ArticleStats.fetch(:post, post.id)
  end

  test "ArticleStats rebuilds advance the repaired owner revision" do
    {_community, post, _attrs, _user} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, post.article_id)

    from(stats in ArticleStats,
      where: stats.thread == :post and stats.article_id == ^post.id
    )
    |> Repo.update_all(
      set: [comments_count: 9, upvotes_count: 9, comments_revision: 0, interaction_revision: 0]
    )

    assert :ok = CMS.ArticleStats.rebuild_comment_fields(article)
    assert :ok = CMS.ArticleStats.rebuild_interaction_fields(article)

    assert {:ok,
            %{
              comments_count: 0,
              comments_revision: 1,
              upvotes_count: 0,
              interaction_revision: 1
            }} = CMS.ArticleStats.fetch(:post, post.id)
  end

  test "ArticleStats snapshot default and every owner update use database clock" do
    {_community, post, _attrs, user} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, post.article_id)

    %{rows: [[default_expression]]} =
      Repo.query!("""
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'cms'
        AND table_name = 'article_stats'
        AND column_name = 'snapshot_at'
      """)

    assert String.contains?(default_expression, "clock_timestamp()")

    {_result, comment_queries} =
      capture_repo_queries(fn -> CMS.ArticleStats.apply_comment_counts(article) end)

    {_result, interaction_queries} =
      capture_repo_queries(fn -> CMS.ArticleStats.apply_interaction_counts(article) end)

    {_result, view_queries} =
      capture_repo_queries(fn ->
        track_article_view(post, user, read_purpose: :public_read)
      end)

    for queries <- [comment_queries, interaction_queries, view_queries] do
      assert Enum.any?(queries, fn query ->
               article_stats_upsert_query?(query) and String.contains?(query, "clock_timestamp()")
             end)
    end
  end

  test "missing and invalid policy input fail before writes" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, classification} = RequestActor.classify(account_session: user)

    assert {:error, %ErrorCat.Error{reason: :missing_read_purpose}} =
             ViewTracker.track(post, user, classification)

    assert {:error, %ErrorCat.Error{reason: :invalid_read_purpose}} =
             ViewTracker.track(post, user, classification, read_purpose: :made_up)

    assert Repo.aggregate(ViewDedupeState, :count) == 0
  end

  defp dedupe_attrs(article_id, at, viewer) do
    %{
      thread: :post,
      article_id: article_id,
      viewer_tracking_key: :crypto.hash(:sha256, viewer),
      last_counted_at: at,
      expires_at: at,
      inserted_at: at,
      updated_at: at
    }
  end

  defp make_dedupe_state_stale(article_id) do
    stale = DateTime.add(DateTime.utc_now(:second), -601, :second)

    Repo.update_all(
      from(state in ViewDedupeState,
        where: state.thread == :post and state.article_id == ^article_id
      ),
      set: [last_counted_at: stale, updated_at: stale]
    )
  end

  defp delete_physical_article(post) do
    Repo.transaction(fn ->
      article = Repo.get!(CMS.Model.Article, post.article_id)
      {:ok, _deleted} = Repo.delete(article)
      :ok = ViewTracker.delete_article_state(:post, post.article_id)
    end)
  end

  defp assert_article_view_state_deleted(article_id) do
    assert Repo.aggregate(
             from(state in ViewDedupeState, where: state.article_id == ^article_id),
             :count
           ) == 0

    assert Repo.aggregate(
             from(state in ViewerState, where: state.article_id == ^article_id),
             :count
           ) == 0

    assert is_nil(Repo.get_by(ArticleStats, thread: :post, article_id: article_id))
  end

  defp capture_repo_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])
    caller = self()

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, _config ->
          send(caller, {:repo_query, ref, metadata.query})
        end,
        nil
      )

    try do
      result = fun.()
      {result, drain_repo_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_repo_queries(ref, queries) do
    receive do
      {:repo_query, ^ref, query} -> drain_repo_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end

  defp assert_query_order(queries, matchers) do
    Enum.reduce(matchers, queries, fn matcher, remaining ->
      index = Enum.find_index(remaining, matcher)
      assert is_integer(index), "expected query was not emitted: #{inspect(remaining)}"
      Enum.drop(remaining, index + 1)
    end)
  end

  defp dedupe_state_upsert_query?(query),
    do: String.contains?(query, ~s[INSERT INTO "cms"."article_view_dedupe_states"])

  defp article_stats_upsert_query?(query),
    do: String.contains?(query, ~s[INSERT INTO "cms"."article_stats"])

  defp article_stats_select_query?(query),
    do:
      String.starts_with?(query, "SELECT") and
        String.contains?(query, ~s[FROM "cms"."article_stats"])

  defp key_share_query?(query), do: String.contains?(query, "FOR KEY SHARE")
end
