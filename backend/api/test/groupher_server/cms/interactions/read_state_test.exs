defmodule GroupherServer.Test.CMS.Interactions.ReadStateTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, ErrorCat, Repo}
  alias ErrorCat.Error

  alias Accounts.Model.Achievement

  alias CMS.Model.{
    ArticleCollect,
    Article,
    ArticleLifecycle,
    ArticleUpvote,
    ArticleUserEmotion,
    CommunityLifecycle,
    PostReactionInfo
  }

  test "article_state maps one already-read private state without IO" do
    article = %{community: "home", thread: :post, inner_id: 42}

    assert CMS.Interactions.ReadState.article_state(article, %{
             interaction_revision: nil,
             viewer_has_upvoted: nil,
             viewer_has_collected: true,
             viewer_emotion: :beer
           }) == %{
             community: "home",
             thread: :post,
             inner_id: 42,
             interaction_revision: 0,
             viewer_has_upvoted: false,
             viewer_has_collected: true,
             viewer_emotion: :beer
           }
  end

  test "upvote count is materialized in the projection and decremented on undo" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    assert 1 == upvotes_count(post.id)

    assert {:ok, _} = CMS.Interactions.undo_upvote(post, user, Ecto.UUID.generate())
    assert 0 == upvotes_count(post.id)
  end

  test "article interactions reject archived targets and keep existing facts unchanged" do
    {community, post, _attrs, user} = mock_article(:post, preload: [author: :user])
    {:ok, other_user} = db_insert(:user)

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.emotion(post, :beer, user, Ecto.UUID.generate())
    assert {:ok, _} = CMS.Interactions.collect(post, user, Ecto.UUID.generate())

    Repo.get_by!(ArticleLifecycle,
      community_id: community.id,
      thread: :post,
      article_id: post.id
    )
    |> ArticleLifecycle.changeset(%{state: :archived})
    |> Repo.update!()

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.undo_upvote(post, user, Ecto.UUID.generate())

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.undo_emotion(post, :beer, user, Ecto.UUID.generate())

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.undo_collect(post, user, Ecto.UUID.generate())

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.upvote(post, other_user, Ecto.UUID.generate())

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.emotion(post, :beer, other_user, Ecto.UUID.generate())

    assert {:error, %{primary: %{reason: :article_archived}}} =
             CMS.Interactions.collect(post, other_user, Ecto.UUID.generate())

    assert Repo.exists?(
             from(row in ArticleUpvote,
               where: row.article_id == ^post.id and row.user_id == ^user.id
             )
           )

    assert Repo.exists?(
             from(row in ArticleCollect,
               where: row.article_id == ^post.id and row.user_id == ^user.id
             )
           )

    assert Repo.exists?(
             from(row in ArticleUserEmotion,
               where: row.article_id == ^post.id and row.user_id == ^user.id
             )
           )

    refute Repo.exists?(
             from(row in ArticleUpvote,
               where: row.article_id == ^post.id and row.user_id == ^other_user.id
             )
           )

    refute Repo.exists?(
             from(row in ArticleCollect,
               where: row.article_id == ^post.id and row.user_id == ^other_user.id
             )
           )

    refute Repo.exists?(
             from(row in ArticleUserEmotion,
               where: row.article_id == ^post.id and row.user_id == ^other_user.id
             )
           )

    assert 1 == upvotes_count(post.id)
  end

  test "article interaction commands reject every non-writable Community state" do
    for state <- [:read_only, :suspended, :archived, :pending_destroy, :destroy] do
      {community, post, _attrs, user} = mock_article(:post)

      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: state})
      |> Repo.update!()

      assert {:error, %{primary: %{reason: :ancestor_community_not_writable}}} =
               CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

      refute Repo.exists?(from(row in ArticleUpvote, where: row.article_id == ^post.id))
    end
  end

  test "duplicate upvote is idempotent and leaves projection, achievement and fact unchanged" do
    {_community, post, _attrs, user} = mock_article(:post, preload: [author: :user])

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    baseline = Repo.get_by!(Achievement, user_id: post.author.id)

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    assert 1 == upvotes_count(post.id)

    assert 1 ==
             Repo.aggregate(from(row in ArticleUpvote, where: row.article_id == ^post.id), :count)

    unchanged = Repo.get_by!(Achievement, user_id: post.author.id)
    assert baseline.articles_upvotes_count == unchanged.articles_upvotes_count
    assert baseline.reputation == unchanged.reputation
  end

  test "projection update failure rolls the fact and achievement back" do
    {_community, post, _attrs, user} = mock_article(:post, preload: [author: :user])
    suffix = System.unique_integer([:positive])
    function_name = "test_block_projection_#{suffix}"
    trigger_name = "test_block_projection_trigger_#{suffix}"

    Repo.query!("""
    CREATE FUNCTION cms.#{function_name}() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$
    """)

    Repo.query!("""
    CREATE TRIGGER #{trigger_name}
    BEFORE UPDATE ON cms.post_reaction_infos
    FOR EACH ROW EXECUTE FUNCTION cms.#{function_name}()
    """)

    try do
      assert {:error,
              %Error{
                namespace: {:cms, :interaction},
                reason: :projection_not_updated,
                code: 4912
              }} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    after
      Repo.query!("DROP TRIGGER #{trigger_name} ON cms.post_reaction_infos")
      Repo.query!("DROP FUNCTION cms.#{function_name}()")
    end

    refute Repo.exists?(from(row in ArticleUpvote, where: row.article_id == ^post.id))
    assert is_nil(upvotes_count(post.id))
  end

  test "viewer_state returns projection counts rather than main-record counts" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())
    hydrated = CMS.Interactions.viewer_state(post, user)

    assert hydrated.upvotes_count == 1
    assert hydrated.viewer_has_upvoted
  end

  test "concurrent upvotes keep the projection count in step with fact rows" do
    {_community, post, _attrs, user} = mock_article(:post)
    {:ok, second_user} = db_insert(:user)

    results =
      [user, second_user]
      |> Enum.map(fn voter ->
        Task.async(fn -> CMS.Interactions.upvote(post, voter, Ecto.UUID.generate()) end)
      end)
      |> Enum.map(&Task.await(&1, 5_000))

    assert Enum.all?(results, &match?({:ok, _}, &1))
    assert 2 == upvotes_count(post.id)
  end

  test "concurrent undo only removes projection state for the transaction that deletes the fact" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, _} = CMS.Interactions.upvote(post, user, Ecto.UUID.generate())

    results =
      1..2
      |> Enum.map(fn _ ->
        Task.async(fn -> CMS.Interactions.undo_upvote(post, user, Ecto.UUID.generate()) end)
      end)
      |> Enum.map(&Task.await(&1, 5_000))

    assert Enum.all?(results, &match?({:ok, _}, &1))
    assert 0 == upvotes_count(post.id)

    assert 0 ==
             Repo.aggregate(from(row in ArticleUpvote, where: row.article_id == ^post.id), :count)
  end

  test "read batches projection state and keeps viewer membership isolated" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)

    assert {:ok, _} = CMS.Interactions.upvote(first, user, Ecto.UUID.generate())

    by_id = CMS.Interactions.viewer_states([first, second], user)

    assert by_id[{:post, first.id}].upvotes_count == 1
    assert by_id[{:post, first.id}].viewer_has_upvoted
    assert by_id[{:post, second.id}].upvotes_count == 0
    refute by_id[{:post, second.id}].viewer_has_upvoted

    {:ok, other_user} = db_insert(:user)
    other_view = CMS.Interactions.viewer_state(first, other_user)
    refute other_view.viewer_has_upvoted
  end

  test "interaction ordering puts null projection rows after zero and positive counts" do
    {_community, positive, _attrs, user} = mock_article(:post)
    {_community, zero, _attrs, _other_user} = mock_article(:post)
    {_community, absent, _attrs, _third_user} = mock_article(:post)

    zero_article = Repo.get!(Article, zero.article_id)

    assert {:ok, :pass} = CMS.ArticleStats.apply_interaction_counts(zero_article)
    Repo.delete_all(from(stats in CMS.Model.ArticleStats, where: stats.article_id == ^absent.id))

    assert {:ok, _} = CMS.Interactions.upvote(positive, user, Ecto.UUID.generate())
    assert {:ok, _} = Repo.insert(%PostReactionInfo{article_id: zero.id})

    {:ok, ordered_query} =
      from(post in Article,
        where: post.thread == :post and post.id in ^[positive.id, zero.id, absent.id]
      )
      |> CMS.Interactions.scope(thread: :post, order: :upvotes)

    ids = ordered_query |> select([post], post.id) |> Repo.all()

    assert ids == [positive.id, zero.id, absent.id]
  end

  test "synchronous view state affects only the counted viewer" do
    {_community, post, _attrs, user} = mock_article(:post)

    assert {:ok, %{tracked: true}} =
             track_article_view(post, user, read_purpose: :public_read)

    viewer = CMS.ViewTracker.viewer_state(post, user)
    assert viewer.viewer_has_viewed

    {:ok, other_user} = db_insert(:user)
    other_view = CMS.ViewTracker.viewer_state(post, other_user)
    refute other_view.viewer_has_viewed
  end

  test "article read keeps a fixed projection query budget for a page" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)

    {_hydrated, queries} =
      capture_queries(fn -> CMS.Interactions.viewer_states([first, second], user) end)

    select_count =
      Enum.count(queries, fn query ->
        query |> String.trim_leading() |> String.starts_with?("SELECT")
      end)

    assert select_count <= 3
  end

  defp upvotes_count(article_id) do
    from(info in PostReactionInfo,
      where: info.article_id == ^article_id,
      select: info.upvotes_count
    )
    |> Repo.one()
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref} ->
          send(pid, {query_ref, metadata.query})
        end,
        {self(), ref}
      )

    try do
      result = fun.()
      {result, drain_queries(ref, [])}
    after
      :telemetry.detach(handler_id)
    end
  end

  defp drain_queries(ref, queries) do
    receive do
      {^ref, query} -> drain_queries(ref, [query | queries])
    after
      0 -> Enum.reverse(queries)
    end
  end
end
