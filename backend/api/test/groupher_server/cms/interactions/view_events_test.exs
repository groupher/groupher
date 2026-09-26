defmodule GroupherServer.Test.CMS.ViewTrackerTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  import Plug.Conn, only: [fetch_cookies: 1]

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Analysis.Model.MetricEvent
  alias GroupherServer.CMS.Model.ArticleStats
  alias CMS.ViewTracker
  alias CMS.ViewTracker.AnonymousSession
  alias CMS.ViewTracker.Model.{ViewCountReceipt, ViewerState, ViewWatermark}
  alias GroupherServerWeb.Schema

  test "GraphQL commits views and returns the complete public/private state" do
    {community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    mutation = """
    mutation Track($article: ArticlePathInput!, $eventId: ID!) {
      trackArticleView(article: $article, eventId: $eventId) {
        counted decisionReason eventId
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
                 },
                 "eventId" => event_id
               },
               context: %{anonymous_id: "browser-session-1"}
             )

    assert result["counted"]
    assert result["decisionReason"] == "COUNTED"
    assert result["eventId"] == event_id
    assert result["articleStats"]["views"] == 1
    assert result["articleStats"]["viewsRevision"] == 1
    refute result["viewerState"]["viewerHasViewed"]

    assert %ViewCountReceipt{state: :finalized, counted: true} =
             Repo.get!(ViewCountReceipt, event_id)
  end

  test "counted result is committed synchronously with stats, viewer state, and analytics" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, result} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert %{counted: true, decision_reason: :counted} = result
    assert result.article_stats.views == 1
    assert result.article_stats.views_revision == 1
    assert result.viewer_state.viewer_has_viewed
    assert Repo.get_by!(ViewerState, thread: :post, article_id: post.id, user_id: user.id)
    assert Repo.get_by!(MetricEvent, operation_id: event_id, metric: :article_view)
  end

  test "the same event id returns its original decision without refreshing the watermark" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    watermark = Repo.one!(ViewWatermark)
    marker = DateTime.add(watermark.last_counted_at, -60, :second)

    Repo.update_all(
      from(row in ViewWatermark,
        where:
          row.thread == ^watermark.thread and row.article_id == ^watermark.article_id and
            row.viewer_tracking_key == ^watermark.viewer_tracking_key
      ),
      set: [last_counted_at: marker]
    )

    assert {:ok, %{counted: true, decision_reason: :counted, article_stats: stats}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert stats.views == 1
    assert Repo.one!(ViewWatermark).last_counted_at == marker
    assert Repo.aggregate(ViewCountReceipt, :count) == 1
    assert Repo.aggregate(MetricEvent, :count) == 1
  end

  test "a second event inside the actor window is finalized as a duplicate" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)

    duplicate_id = Ecto.UUID.generate()

    assert {:ok, result} =
             ViewTracker.track(post, user, duplicate_id, read_purpose: :public_read)

    assert %{counted: false, decision_reason: :duplicate_in_window} = result
    assert result.article_stats.views == 1

    assert %ViewCountReceipt{counted: false, decision_reason: :duplicate_in_window} =
             Repo.get!(ViewCountReceipt, duplicate_id)

    assert Repo.aggregate(MetricEvent, :count) == 1
  end

  test "claim after committed Retention deletion creates a fresh decision" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    expire_receipt(event_id)
    assert %{receipts: 1} = ViewTracker.delete_expired()

    assert {:ok, %{counted: false, decision_reason: :duplicate_in_window}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert {:ok, %{views: 1}} = CMS.ArticleStats.fetch(:post, post.id)
  end

  test "claim after rolled-back Retention deletion replays the original decision" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    expire_receipt(event_id)

    assert {:error, :forced_rollback} =
             Repo.transaction(fn ->
               assert %{receipts: 1} = ViewTracker.delete_expired()
               Repo.rollback(:forced_rollback)
             end)

    assert {:ok, %{counted: true, decision_reason: :counted}} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert {:ok, %{views: 1}} = CMS.ArticleStats.fetch(:post, post.id)
  end

  test "watermark claim remains counted after committed Retention deletion" do
    assert_watermark_retention_outcome(:commit)
  end

  test "watermark claim remains counted after rolled-back Retention deletion" do
    assert_watermark_retention_outcome(:rollback)
  end

  test "reusing an event id for another Article fails closed" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, _result} =
             ViewTracker.track(first, user, event_id, read_purpose: :public_read)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :receipt_identity_mismatch}} =
             ViewTracker.track(second, user, event_id, read_purpose: :public_read)
  end

  test "unknown and policy-excluded reads do not write receipts or watermarks" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{counted: false, decision_reason: :excluded_by_policy}} =
             ViewTracker.track(post, nil, Ecto.UUID.generate(), read_purpose: :public_read)

    assert {:ok, %{counted: false, decision_reason: :excluded_by_policy}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :author_preview)

    assert Repo.aggregate(ViewCountReceipt, :count) == 0
    assert Repo.aggregate(ViewWatermark, :count) == 0
    assert Repo.aggregate(MetricEvent, :count) == 0
  end

  test "verified agent reads count without creating human ViewerState" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{counted: true, viewer_state: %{viewer_has_viewed: false}}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(),
               agent_credential_id: "verified-agent",
               read_purpose: :public_read
             )

    assert Repo.aggregate(ViewerState, :count) == 0
  end

  test "anonymous signed Session identity participates in the sliding window" do
    {_community, post, _attrs, _user} = mock_article(:post)

    {conn, anonymous_id} = build_conn() |> fetch_cookies() |> AnonymousSession.ensure()
    cookie = conn.resp_cookies["groupher-viewer"].value

    second_conn =
      build_conn()
      |> Plug.Test.put_req_cookie("groupher-viewer", cookie)
      |> fetch_cookies()

    assert {_conn, ^anonymous_id} = AnonymousSession.ensure(second_conn)

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, nil, Ecto.UUID.generate(),
               anonymous_id: anonymous_id,
               read_purpose: :public_read
             )

    assert {:ok, %{counted: false, decision_reason: :duplicate_in_window}} =
             ViewTracker.track(post, nil, Ecto.UUID.generate(),
               anonymous_id: anonymous_id,
               read_purpose: :public_read
             )
  end

  test "retention removes bounded expired receipts and stale watermarks" do
    old_config = Application.get_env(:groupher_server, CMS.ViewTracker.Config)

    Application.put_env(:groupher_server, CMS.ViewTracker.Config,
      human_dedupe_window_seconds: 10,
      agent_dedupe_window_seconds: 10,
      view_count_receipt_ttl_seconds: 20,
      watermark_retention_seconds: 30,
      retention_batch_size: 1
    )

    on_exit(fn -> Application.put_env(:groupher_server, CMS.ViewTracker.Config, old_config) end)

    now = DateTime.utc_now(:second)
    stale = DateTime.add(now, -60, :second)

    Repo.insert_all(ViewCountReceipt, [
      receipt_attrs(Ecto.UUID.generate(), 1, stale),
      receipt_attrs(Ecto.UUID.generate(), 2, stale)
    ])

    Repo.insert_all(ViewWatermark, [
      watermark_attrs(1, stale, "one"),
      watermark_attrs(2, stale, "two")
    ])

    assert %{receipts: 1, watermarks: 1} = ViewTracker.delete_expired()
    assert Repo.aggregate(ViewCountReceipt, :count) == 1
    assert Repo.aggregate(ViewWatermark, :count) == 1
  end

  test "deletion cleanup removes every physical Article view row" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, _result} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert :ok = ViewTracker.delete_article_state(:post, post.id)
    assert is_nil(Repo.get(ViewCountReceipt, event_id))
    assert Repo.aggregate(ViewWatermark, :count) == 0
    assert Repo.aggregate(ViewerState, :count) == 0
    assert is_nil(Repo.get_by(ArticleStats, thread: :post, article_id: post.id))
  end

  test "completed view followed by permanent deletion leaves no orphan" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)

    assert {:ok, :ok} = delete_physical_article(post)
    assert_article_view_state_deleted(post.id)
  end

  test "tracking after committed permanent deletion cannot recreate projection rows" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, :ok} = delete_physical_article(post)

    assert {:error, _reason} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)

    assert_article_view_state_deleted(post.id)
  end

  test "tracking keeps the documented lock order and writes snapshot_at with DB clock" do
    {_community, post, _attrs, user} = mock_article(:post)

    {result, queries} =
      capture_repo_queries(fn ->
        ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)
      end)

    assert {:ok, %{counted: true}} = result

    assert_query_order(queries, [
      &key_share_query?/1,
      &receipt_claim_query?/1,
      &watermark_claim_query?/1,
      &article_stats_upsert_query?/1,
      &receipt_finalize_query?/1
    ])

    assert Enum.any?(queries, fn query ->
             article_stats_upsert_query?(query) and String.contains?(query, "clock_timestamp()")
           end)

    refute Enum.any?(queries, &article_stats_select_query?/1)
  end

  test "ArticleStats owner writes reject missing counts instead of persisting zero" do
    {_community, post, _attrs, _user} = mock_article(:post)
    partial = %{post | comments_count: nil}

    assert {:error, {:invalid_owner_count, :comments_count}} =
             CMS.ArticleStats.apply_comment_counts(partial)

    assert {:ok, %{comments_count: 0, comments_revision: 0}} =
             CMS.ArticleStats.fetch(:post, post.id)
  end

  test "ArticleStats snapshot default and every owner update use database clock" do
    {_community, post, _attrs, user} = mock_article(:post)

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
      capture_repo_queries(fn -> CMS.ArticleStats.apply_comment_counts(post) end)

    {_result, interaction_queries} =
      capture_repo_queries(fn -> CMS.ArticleStats.apply_interaction_counts(post) end)

    {_result, view_queries} =
      capture_repo_queries(fn ->
        ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)
      end)

    for queries <- [comment_queries, interaction_queries, view_queries] do
      assert Enum.any?(queries, fn query ->
               article_stats_upsert_query?(query) and String.contains?(query, "clock_timestamp()")
             end)
    end
  end

  test "invalid event id and missing policy input fail before writes" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_event_id}} =
             ViewTracker.track(post, user, "not-a-uuid", read_purpose: :public_read)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :missing_read_purpose}} =
             ViewTracker.track(post, user, Ecto.UUID.generate())

    assert Repo.aggregate(ViewCountReceipt, :count) == 0
  end

  defp receipt_attrs(event_id, article_id, at) do
    %{
      event_id: event_id,
      thread: :post,
      article_id: article_id,
      viewer_tracking_key: :crypto.hash(:sha256, Integer.to_string(article_id)),
      state: :finalized,
      counted: true,
      decision_reason: :counted,
      expires_at: at,
      inserted_at: at
    }
  end

  defp watermark_attrs(article_id, at, viewer) do
    %{
      thread: :post,
      article_id: article_id,
      viewer_tracking_key: :crypto.hash(:sha256, viewer),
      last_counted_at: at,
      inserted_at: at,
      updated_at: at
    }
  end

  defp expire_receipt(event_id) do
    Repo.update_all(
      from(receipt in ViewCountReceipt, where: receipt.event_id == ^event_id),
      set: [expires_at: DateTime.add(DateTime.utc_now(:second), -60, :second)]
    )
  end

  defp make_watermark_stale(article_id) do
    stale = DateTime.add(DateTime.utc_now(:second), -31 * 86_400, :second)

    Repo.update_all(
      from(watermark in ViewWatermark,
        where: watermark.thread == :post and watermark.article_id == ^article_id
      ),
      set: [last_counted_at: stale, updated_at: stale]
    )
  end

  defp assert_watermark_retention_outcome(outcome) do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)

    make_watermark_stale(post.id)

    case outcome do
      :commit ->
        assert %{watermarks: 1} = ViewTracker.delete_expired()

      :rollback ->
        assert {:error, :forced_rollback} =
                 Repo.transaction(fn ->
                   assert %{watermarks: 1} = ViewTracker.delete_expired()
                   Repo.rollback(:forced_rollback)
                 end)
    end

    assert {:ok, %{counted: true}} =
             ViewTracker.track(post, user, Ecto.UUID.generate(), read_purpose: :public_read)

    assert {:ok, %{views: 2, views_revision: 2}} = CMS.ArticleStats.fetch(:post, post.id)
    assert Repo.aggregate(ViewWatermark, :count) == 1
  end

  defp delete_physical_article(post) do
    Repo.transaction(fn ->
      {:ok, _deleted} = Repo.delete(post)
      ViewTracker.delete_article_state(:post, post.id)
    end)
  end

  defp assert_article_view_state_deleted(article_id) do
    assert Repo.aggregate(
             from(receipt in ViewCountReceipt, where: receipt.article_id == ^article_id),
             :count
           ) == 0

    assert Repo.aggregate(
             from(watermark in ViewWatermark, where: watermark.article_id == ^article_id),
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
    {_rest, _last_index} =
      Enum.reduce(matchers, {queries, -1}, fn matcher, {remaining, previous_index} ->
        index = Enum.find_index(remaining, matcher)
        assert is_integer(index), "expected query was not emitted: #{inspect(remaining)}"
        absolute_index = previous_index + index + 1
        {Enum.drop(remaining, index + 1), absolute_index}
      end)
  end

  defp receipt_claim_query?(query),
    do: String.contains?(query, ~s[INSERT INTO "cms"."article_view_count_receipts"])

  defp watermark_claim_query?(query),
    do: String.contains?(query, ~s[INSERT INTO "cms"."article_view_watermarks"])

  defp article_stats_upsert_query?(query),
    do: String.contains?(query, ~s[INSERT INTO "cms"."article_stats"])

  defp article_stats_select_query?(query),
    do:
      String.starts_with?(query, "SELECT") and
        String.contains?(query, ~s[FROM "cms"."article_stats"])

  defp receipt_finalize_query?(query),
    do:
      String.contains?(query, ~s[UPDATE "cms"."article_view_count_receipts"]) and
        String.contains?(query, ~s["state"])

  defp key_share_query?(query), do: String.contains?(query, "FOR KEY SHARE")
end
