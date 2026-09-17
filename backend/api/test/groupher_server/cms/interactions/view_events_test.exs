defmodule GroupherServer.Test.CMS.ViewTrackerTest do
  use GroupherServer.TestMate

  alias GroupherServer.{CMS, Repo}
  alias CMS.ViewTracker
  alias CMS.ViewTracker.AnonymousSession
  alias CMS.ViewTracker.Model.{DedupeState, ViewEvent, ViewSummary}
  alias GroupherServerWeb.Schema

  import Plug.Conn, only: [fetch_cookies: 1]

  test "GraphQL tracks a visible Article through the independent mutation" do
    {community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    mutation = """
    mutation Track($article: ArticlePathInput!, $eventId: ID!) {
      trackArticleView(article: $article, eventId: $eventId) { accepted eventId }
    }
    """

    assert {:ok, %{data: %{"trackArticleView" => %{"accepted" => true, "eventId" => ^event_id}}}} =
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

    assert %ViewEvent{event_id: ^event_id, counted: true} = Repo.get!(ViewEvent, event_id)
  end

  test "GraphQL reads public Article view summaries in one batch" do
    {community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    query = """
    query Summaries($community: String!, $thread: Thread!, $innerIds: [ID!]!) {
      articleViewSummaries(community: $community, thread: $thread, innerIds: $innerIds) {
        community thread innerId views revision
      }
    }
    """

    assert {:ok, %{data: %{"articleViewSummaries" => [summary]}}} =
             Absinthe.run(query, Schema,
               variables: %{
                 "community" => community.slug,
                 "thread" => "POST",
                 "innerIds" => [Integer.to_string(post.inner_id)]
               }
             )

    assert summary == %{
             "community" => community.slug,
             "thread" => "POST",
             "innerId" => Integer.to_string(post.inner_id),
             "views" => 1,
             "revision" => 1
           }
  end

  test "view event ids are unique and threads are constrained" do
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} = Repo.insert_all(ViewEvent, [view_event_attrs(event_id, now)])
    assert %ViewEvent{thread: :post} = Repo.get!(ViewEvent, event_id)

    assert {0, _} =
             Repo.insert_all(
               ViewEvent,
               [view_event_attrs(event_id, now)],
               on_conflict: :nothing,
               conflict_target: [:event_id]
             )

    refute ViewEvent.changeset(%ViewEvent{}, %{
             event_id: event_id,
             article_id: 1,
             thread: :other
           }).valid?
  end

  test "retention deletes only terminal events" do
    old = DateTime.add(DateTime.utc_now(:second), -31, :day)
    projected_id = Ecto.UUID.generate()
    pending_id = Ecto.UUID.generate()

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(projected_id, old,
                 projected_at: old,
                 projection_state: :applied
               ),
               view_event_attrs(pending_id, old)
             ])

    assert 1 = ViewTracker.delete_expired()
    assert is_nil(Repo.get(ViewEvent, projected_id))
    assert %ViewEvent{} = Repo.get(ViewEvent, pending_id)
  end

  test "retention removes stale dedupe state but keeps state inside its retention window" do
    now = DateTime.utc_now(:second)
    stale_at = DateTime.add(now, -31, :day)

    assert {2, _} =
             Repo.insert_all(DedupeState, [
               dedupe_state_attrs(:post, 1, stale_at, "stale-viewer"),
               dedupe_state_attrs(:post, 2, now, "active-viewer")
             ])

    assert 1 = ViewTracker.delete_expired()
    assert is_nil(Repo.get_by(DedupeState, thread: :post, article_id: 1))
    assert %DedupeState{} = Repo.get_by(DedupeState, thread: :post, article_id: 2)
  end

  test "deadline reconciliation dead-letters pending events without an active job" do
    {_community, post, _attrs, _user} = mock_article(:post)
    expired_at = DateTime.add(DateTime.utc_now(:second), -1, :second)
    event_id = Ecto.UUID.generate()

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(event_id, expired_at,
                 article_id: post.id,
                 projection_retry_deadline_at: expired_at
               )
             ])

    assert 1 = ViewTracker.reconcile_dead_letters()

    assert %ViewEvent{
             projection_state: :dead_letter,
             projection_generation: 1,
             failure_reason: "projection deadline expired without an active Oban job"
           } = Repo.get!(ViewEvent, event_id)

    assert 0 = ViewTracker.reconcile_dead_letters()
  end

  test "view metrics count pending and failed events" do
    now = DateTime.utc_now(:second)

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(Ecto.UUID.generate(), now),
               view_event_attrs(Ecto.UUID.generate(), now, failed_at: now)
             ])

    assert %{
             pending: 2,
             failed: 1,
             retained: 2,
             consistency_sample: sample,
             dedupe_states_expired: 0,
             oldest_dedupe_at: nil,
             oldest_dedupe_age_seconds: 0
           } =
             ViewTracker.metrics()

    assert sample == %{
             sampled: 0,
             missing_viewer_state: 0,
             summary_sampled: 0,
             sampled_orphan_summaries: 0,
             summary_consistency_sampled: 0,
             summary_drifted: 0
           }
  end

  test "consistency sampling reports orphan summaries and lower-bound drift" do
    {_community, post, _attrs, _user} = mock_article(:post)
    now = DateTime.utc_now(:second)

    Repo.insert!(%ViewSummary{thread: :post, article_id: post.id, views: 0, revision: 0})
    Repo.insert!(%ViewSummary{thread: :post, article_id: -1, views: 1, revision: 1})

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(Ecto.UUID.generate(), now,
                 article_id: post.id,
                 projection_state: :applied,
                 projected_at: now
               ),
               view_event_attrs(Ecto.UUID.generate(), now,
                 article_id: post.id,
                 projection_state: :applied,
                 projected_at: now
               )
             ])

    assert %{consistency_sample: sample} = ViewTracker.metrics()
    assert sample.summary_sampled == 2
    assert sample.sampled_orphan_summaries == 1
    assert sample.summary_consistency_sampled == 1
    assert sample.summary_drifted == 1
  end

  test "a counted view is projected once into the counter and viewer state" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert :ok = ViewTracker.project(event_id)
    assert :ok = ViewTracker.project(event_id)

    assert Repo.get_by!(ViewSummary, thread: :post, article_id: post.id).views == 1
    assert Repo.get_by!(ViewSummary, thread: :post, article_id: post.id).revision == 1
    assert ViewTracker.viewer_state(post, user).viewer_has_viewed

    assert %{viewer_has_viewed: true} =
             ViewTracker.viewer_states([post], user)[{:post, post.id}]
  end

  test "a projection from an old generation is a successful no-op" do
    {_community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(event_id, now,
                 article_id: post.id,
                 projection_generation: 2
               )
             ])

    assert :ok = ViewTracker.project(event_id, 1)

    assert %ViewEvent{projection_state: :pending, projection_generation: 2} =
             Repo.get!(ViewEvent, event_id)

    assert is_nil(Repo.get_by(ViewSummary, thread: :post, article_id: post.id))
  end

  test "one projection batch increments Summary revision once" do
    {_community, post, _attrs, _user} = mock_article(:post)
    now = DateTime.utc_now(:second)
    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()

    assert {2, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(first_id, now, article_id: post.id),
               view_event_attrs(second_id, now, article_id: post.id)
             ])

    assert :ok = ViewTracker.project(first_id)

    assert %ViewSummary{views: 2, revision: 1} =
             Repo.get_by!(ViewSummary, thread: :post, article_id: post.id)

    assert Enum.all?([first_id, second_id], fn event_id ->
             Repo.get!(ViewEvent, event_id).projection_state == :applied
           end)
  end

  test "missing read purpose fails closed without creating an event" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :missing_read_purpose}} =
             ViewTracker.track(post, user, event_id)

    assert is_nil(Repo.get(ViewEvent, event_id))
  end

  test "anonymous delegated agents keep their delegation classification" do
    {_community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, nil, event_id,
               actor_type: :agent,
               delegation_id: "delegation-test",
               anonymous_id: "browser-session",
               read_purpose: :public_read
             )

    assert %ViewEvent{
             actor_type: :agent,
             is_authenticated: false,
             classified_by: :delegation_credential
           } =
             Repo.get!(ViewEvent, event_id)
  end

  test "the same event id is idempotent and never refreshes dedupe state" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    state = Repo.one!(DedupeState)
    marker = DateTime.add(DateTime.utc_now(:second), -10_000, :second)

    assert {1, _} =
             Repo.update_all(
               from(state_row in DedupeState,
                 where:
                   state_row.thread == ^state.thread and
                     state_row.article_id == ^state.article_id and
                     state_row.viewer_tracking_key == ^state.viewer_tracking_key
               ),
               set: [last_counted_at: marker]
             )

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id, read_purpose: :public_read)

    assert Repo.get_by!(DedupeState,
             thread: state.thread,
             article_id: state.article_id,
             viewer_tracking_key: state.viewer_tracking_key
           ).last_counted_at == marker

    assert Repo.aggregate(ViewEvent, :count) == 1
  end

  test "reusing an event id for another Article returns an identity mismatch" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(first, user, event_id, read_purpose: :public_read)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :view_event_identity_mismatch}} =
             ViewTracker.track(second, user, event_id, read_purpose: :public_read)

    assert Repo.aggregate(ViewEvent, :count) == 1
  end

  test "anonymous Session Cookie identity participates in the sliding window" do
    {_community, post, _attrs, _user} = mock_article(:post)

    {conn, anonymous_id} =
      build_conn()
      |> fetch_cookies()
      |> AnonymousSession.ensure()

    cookie = conn.resp_cookies["groupher-viewer"].value
    assert is_binary(cookie)

    second_conn =
      build_conn()
      |> Plug.Test.put_req_cookie("groupher-viewer", cookie)
      |> fetch_cookies()

    {_second_conn, ^anonymous_id} = AnonymousSession.ensure(second_conn)

    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()

    assert {:ok, ^first_id} =
             ViewTracker.track(post, nil, first_id,
               anonymous_id: anonymous_id,
               read_purpose: :public_read
             )

    assert {:ok, ^second_id} =
             ViewTracker.track(post, nil, second_id,
               anonymous_id: anonymous_id,
               read_purpose: :public_read
             )

    assert Repo.get!(ViewEvent, first_id).counted

    assert %{counted: false, decision_reason: :duplicate_in_window} =
             Repo.get!(ViewEvent, second_id)
  end

  test "unknown anonymous requests do not create cross-request dedupe state" do
    {_community, post, _attrs, _user} = mock_article(:post)
    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()

    assert {:ok, ^first_id} =
             ViewTracker.track(post, nil, first_id, read_purpose: :public_read)

    assert {:ok, ^second_id} =
             ViewTracker.track(post, nil, second_id, read_purpose: :public_read)

    assert Repo.get!(ViewEvent, first_id).counted
    assert Repo.get!(ViewEvent, second_id).counted
    assert Repo.aggregate(DedupeState, :count) == 0
  end

  test "the business window deduplicates a viewer without creating pending work" do
    {_community, post, _attrs, user} = mock_article(:post)
    first_id = Ecto.UUID.generate()
    second_id = Ecto.UUID.generate()

    assert {:ok, ^first_id} =
             ViewTracker.track(post, user, first_id, read_purpose: :public_read)

    assert {:ok, ^second_id} =
             ViewTracker.track(post, user, second_id, read_purpose: :public_read)

    assert %{counted: true, projected_at: projected_at} = Repo.get!(ViewEvent, first_id)
    assert not is_nil(projected_at)

    assert %{counted: false, decision_reason: :duplicate_in_window} =
             Repo.get!(ViewEvent, second_id)

    assert Repo.aggregate(ViewEvent, :count) == 2
    assert Repo.get_by!(ViewSummary, thread: :post, article_id: post.id).views == 1
  end

  test "authenticated agent views are counted but do not create human viewer state" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id,
               actor_type: :agent,
               agent_credential_id: "agent-test",
               read_purpose: :public_read
             )

    assert Repo.get!(ViewEvent, event_id).actor_type == :agent

    refute ViewTracker.viewer_state(post, user, actor_type: :agent).viewer_has_viewed

    refute ViewTracker.viewer_state(post, user).viewer_has_viewed
  end

  test "policy-excluded views are terminal without projection work" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} =
             ViewTracker.track(post, user, event_id, read_purpose: :author_preview)

    assert %ViewEvent{
             counted: false,
             decision_reason: :excluded_by_policy,
             projected_at: projected_at
           } = Repo.get!(ViewEvent, event_id)

    assert not is_nil(projected_at)
    assert is_nil(Repo.get_by(ViewSummary, thread: :post, article_id: post.id))
  end

  test "dead-letter events are excluded from later target batches" do
    {_community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(event_id, now,
                 article_id: post.id,
                 projection_state: :dead_letter,
                 failure_reason: "test failure"
               )
             ])

    assert :ok = ViewTracker.project(event_id)
    assert is_nil(Repo.get_by(ViewSummary, thread: :post, article_id: post.id))
    assert Repo.get!(ViewEvent, event_id).projection_state == :dead_letter
  end

  test "resolve_as_dropped is compare-and-set from dead-letter only" do
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(event_id, now, projection_state: :dead_letter)
             ])

    assert :ok = ViewTracker.resolve_as_dropped(event_id)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :projection_not_dead_letter}} =
             ViewTracker.resolve_as_dropped(event_id)

    assert Repo.get!(ViewEvent, event_id).projection_state == :dropped
  end

  test "replay advances generation and projects only once" do
    {_community, post, _attrs, _user} = mock_article(:post)
    event_id = Ecto.UUID.generate()
    now = DateTime.utc_now(:second)

    assert {1, _} =
             Repo.insert_all(ViewEvent, [
               view_event_attrs(event_id, now,
                 article_id: post.id,
                 projection_state: :dead_letter,
                 failure_reason: "test failure"
               )
             ])

    assert :ok = ViewTracker.replay(event_id)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :projection_not_dead_letter}} =
             ViewTracker.replay(event_id)

    assert %{views: 1} = ViewTracker.summaries(:post, [post])[{:post, post.id}]

    assert %ViewEvent{projection_state: :applied, projection_generation: 2} =
             Repo.get!(ViewEvent, event_id)
  end

  test "an invalid event id returns a declared interaction error" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :invalid_event_id}} =
             ViewTracker.track(post, user, "not-a-uuid")
  end

  defp view_event_attrs(event_id, now, overrides \\ []) do
    Map.merge(
      %{
        event_id: event_id,
        article_id: 1,
        thread: :post,
        actor_type: :human,
        is_authenticated: true,
        actor_confidence: :verified,
        classified_by: :account_session,
        occurred_at: now,
        policy_version: 1,
        counted: true,
        decision_reason: :counted,
        read_purpose: :public_read,
        projection_state: :pending,
        inserted_at: now,
        updated_at: now
      },
      Map.new(overrides)
    )
  end

  defp dedupe_state_attrs(thread, article_id, last_counted_at, viewer_tracking_key) do
    %{
      thread: thread,
      article_id: article_id,
      viewer_tracking_key: viewer_tracking_key,
      last_counted_at: last_counted_at,
      inserted_at: last_counted_at
    }
  end
end
