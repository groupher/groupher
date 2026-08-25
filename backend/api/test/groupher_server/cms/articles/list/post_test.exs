defmodule GroupherServer.Test.CMS.Articles.PostList do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, _, post_attrs, user} = mock_article(:post)

    {:ok, ~m(community post_attrs user)a}
  end

  describe "[cms post list]" do
    test "can get paged posts", ~m(community post_attrs user)a do
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, paged_posts} = CMS.Articles.page(:post, %{page: 1, size: 20})

      assert paged_posts |> is_valid_pagination?(:raw)
      assert length(paged_posts.entries) >= 2
      assert Enum.all?(paged_posts.entries, &(&1.meta.thread == :post))
    end

    test "assembles Interaction state exactly once for anonymous and logged-in pages",
         ~m(community post_attrs user)a do
      {:ok, _} = CMS.Articles.create(community, :post, post_attrs, user)
      filter = %{page: 1, size: 20, community: community.slug}

      {{:ok, _anonymous_page}, anonymous_queries} =
        capture_queries(fn -> CMS.Articles.page(:post, filter) end)

      {{:ok, _viewer_page}, viewer_queries} =
        capture_queries(fn -> CMS.Articles.page(:post, filter, user) end)

      assert query_count(anonymous_queries, "post_reaction_infos") == 1
      assert query_count(anonymous_queries, "post_emotion_infos") == 1
      assert query_count(viewer_queries, "post_reaction_infos") == 1
      assert query_count(viewer_queries, "post_emotion_infos") == 1
    end
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

  defp query_count(queries, table), do: Enum.count(queries, &String.contains?(&1, table))
end
