defmodule GroupherServer.Test.CMS.Interactions.ReadStateQueryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS.Model.Community

  test "returns Article read state with complete emotion vocabulary" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)

    assert {:ok, _} = CMS.Interactions.upvote(post, user)
    assert {:ok, _} = CMS.Interactions.emotion(post, :beer, user)

    assert %{
             upvotes_count: 1,
             viewer_has_upvoted: true,
             emotions: emotions
           } = CMS.Interactions.viewer_state(post, user)

    assert Enum.any?(emotions, &match?(%{emotion: :beer, count: 1}, &1))
    assert Enum.all?(emotions, &is_boolean(&1.viewer_has_reacted))
  end

  test "anonymous state has fixed false viewer flags" do
    {_community, post, _attrs, user} = mock_article(:post)
    post = Repo.preload(post, author: :user)
    assert {:ok, _} = CMS.Interactions.upvote(post, user)

    assert %{upvotes_count: 1, viewer_has_upvoted: false} =
             CMS.Interactions.viewer_state(post, nil)
  end

  test "anonymous state never compiles bitmap membership SQL" do
    {_community, post, _attrs, user} = mock_article(:post)

    {_anonymous_state, anonymous_queries} =
      capture_queries(fn -> CMS.Interactions.viewer_state(post, nil) end)

    {_viewer_state, viewer_queries} =
      capture_queries(fn -> CMS.Interactions.viewer_state(post, user) end)

    anonymous_selects = Enum.filter(anonymous_queries, &select_query?/1)
    viewer_selects = Enum.filter(viewer_queries, &select_query?/1)

    refute Enum.any?(anonymous_selects, &String.contains?(&1, "@>"))
    assert length(anonymous_selects) <= length(viewer_selects)
  end

  test "batch state is keyed by type and Comment omits Article-only fields" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    states = CMS.Interactions.viewer_states([post, comment], user)

    assert %{collects_count: 0} = states[{:post, post.id}]
    assert %{upvotes_count: 0} = states[{:comment, comment.id}]
    refute Map.has_key?(states[{:comment, comment.id}], :collects_count)
    refute Map.has_key?(states[{:comment, comment.id}], :viewer_has_viewed)
  end

  test "counts returns lightweight fixed counts keyed by artiment type and physical id" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), user)

    assert {:ok, _} = CMS.Interactions.upvote(post, user)
    assert {:ok, _} = CMS.Interactions.upvote(comment, user)

    post_key = {:post, post.id}
    comment_key = {:comment, comment.id}

    assert %{
             ^post_key => %{upvotes_count: 1},
             ^comment_key => %{upvotes_count: 1}
           } = CMS.Interactions.counts([post, comment])
  end

  test "unsupported resources fail closed instead of becoming an empty Article state" do
    community = %Community{id: 1}

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :unsupported_artiment}} =
             CMS.Interactions.viewer_state(community, nil)

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :unsupported_artiment}} =
             CMS.Interactions.viewer_states([community], nil)
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

  defp select_query?(query),
    do: query |> String.trim_leading() |> String.starts_with?("SELECT")
end
