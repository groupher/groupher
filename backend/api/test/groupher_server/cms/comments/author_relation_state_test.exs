defmodule GroupherServer.Test.CMS.Comments.AuthorRelationStateTest do
  use GroupherServer.TestMate

  alias GroupherServer.CMS.Comments.AuthorRelationState

  test "infers the parent Article author relation in one query" do
    {community, post, _attrs, article_author} = mock_article(:post, preload: [author: :user])

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), article_author)

    assert {:ok, _} = CMS.Interactions.upvote(comment, article_author)

    {upvoted_ids, queries} = capture_queries(fn -> AuthorRelationState.upvoted_ids([comment]) end)

    assert MapSet.member?(upvoted_ids, comment.id)

    relation_queries =
      Enum.filter(queries, fn query ->
        select_query?(query) and String.contains?(query, "comment_reaction_infos") and
          String.contains?(query, "authors") and String.contains?(query, "comments")
      end)

    assert length(relation_queries) == 1
  end

  defp capture_queries(fun) do
    ref = make_ref()
    handler_id = {__MODULE__, ref}
    owner = self()
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, metadata, {pid, query_ref, owner_pid} ->
          if self() == owner_pid, do: send(pid, {query_ref, metadata.query})
        end,
        {self(), ref, owner}
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
