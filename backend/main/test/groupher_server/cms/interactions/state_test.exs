defmodule GroupherServer.Test.CMS.Interactions.StateTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query

  alias GroupherServer.CMS.Interactions.State
  alias GroupherServer.CMS.Model.{Post, PostReactionInfo}
  alias GroupherServer.CMS.Interactions.ViewEvents
  alias GroupherServer.Repo

  test "upvote count is materialized in the projection and decremented on undo" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)

    assert {:ok, _} = CMS.Articles.upvote(post, user)
    assert 1 == upvotes_count(post.id)

    assert {:ok, _} = CMS.Articles.undo_upvote(post, user)
    assert 0 == upvotes_count(post.id)
  end

  test "State.read returns projection counts rather than main-record counts" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)

    assert {:ok, _} = CMS.Articles.upvote(post, user)
    [hydrated] = State.read(:post, [post], user, [])

    assert hydrated.upvotes_count == 1
    assert hydrated.viewer_has_upvoted
  end

  test "concurrent upvotes keep the projection count in step with fact rows" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)
    {:ok, second_user} = db_insert(:user)

    results =
      [user, second_user]
      |> Enum.map(fn voter -> Task.async(fn -> CMS.Articles.upvote(post, voter) end) end)
      |> Enum.map(&Task.await(&1, 5_000))

    assert Enum.all?(results, &match?({:ok, _}, &1))
    assert 2 == upvotes_count(post.id)
  end

  test "read batches projection state and keeps viewer membership isolated" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)

    assert {:ok, _} = CMS.Articles.upvote(first, user)

    hydrated = State.read(:post, [first, second], user, [])
    by_id = Map.new(hydrated, &{&1.id, &1})

    assert by_id[first.id].upvotes_count == 1
    assert by_id[first.id].viewer_has_upvoted
    assert by_id[second.id].upvotes_count == 0
    refute by_id[second.id].viewer_has_upvoted

    {:ok, other_user} = db_insert(:user)
    [other_view] = State.read(:post, [first], other_user, [])
    refute other_view.viewer_has_upvoted
  end

  test "interaction ordering puts null projection rows after zero and positive counts" do
    {_community, positive, _attrs, user} = mock_article(:post)
    {_community, zero, _attrs, _other_user} = mock_article(:post)
    {_community, absent, _attrs, _third_user} = mock_article(:post)

    assert {:ok, _} = CMS.Articles.upvote(positive, user)
    assert {:ok, _} = Repo.insert(%PostReactionInfo{post_id: zero.id})

    ids =
      from(post in Post, where: post.id in ^[positive.id, zero.id, absent.id])
      |> State.order_articles(:post, :upvotes)
      |> select([post], post.id)
      |> Repo.all()

    assert ids == [positive.id, zero.id, absent.id]
  end

  test "pending view events affect only the event viewer until projection runs" do
    {_community, post, _attrs, user} = mock_article(:post)
    event_id = Ecto.UUID.generate()

    assert {:ok, ^event_id} = ViewEvents.record(post, user, event_id)
    [viewer] = State.read(:post, [post], user, [])
    assert viewer.viewer_has_viewed

    {:ok, other_user} = db_insert(:user)
    [other_view] = State.read(:post, [post], other_user, [])
    refute other_view.viewer_has_viewed
  end

  test "article read keeps a fixed projection query budget for a page" do
    {_community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _other_user} = mock_article(:post)

    {_hydrated, queries} =
      capture_queries(fn -> State.read(:post, [first, second], user, []) end)

    select_count =
      Enum.count(queries, fn query ->
        query |> String.trim_leading() |> String.starts_with?("SELECT")
      end)

    assert select_count <= 3
  end

  defp upvotes_count(post_id) do
    from(info in PostReactionInfo,
      where: info.post_id == ^post_id,
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
