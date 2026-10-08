defmodule GroupherServer.Test.CMS.Interactions.ReadStateQueryTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Model.{Article, Community}
  alias GroupherServerWeb.Resolvers.CMS.{Comments, Interactions, ViewTracker}

  test "viewer batch resolvers return empty lists without an authenticated session" do
    info = %{context: %{cur_user: nil}}

    assert {:ok, []} =
             ViewTracker.article_viewer_states(
               nil,
               %{paths: [%{community: "home", thread: "POST", inner_id: "1"}]},
               info
             )

    assert {:ok, []} =
             Comments.comment_viewer_states(
               nil,
               %{
                 article: %{community: "home", thread: "POST", inner_id: "1"},
                 comment_inner_ids: ["1"]
               },
               info
             )
  end

  test "authenticated Article batch resolvers preserve ref order" do
    {community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _user} = mock_article(:post, community, user)
    info = %{context: %{cur_user: user}}

    paths =
      Enum.map([second, first], fn article ->
        %{
          community: community.slug,
          thread: :post,
          inner_id: to_string(article_inner_id(article, community))
        }
      end)

    assert {:ok, viewer_states} = ViewTracker.article_viewer_states(nil, %{paths: paths}, info)
    assert Enum.map(viewer_states, & &1.inner_id) == [second.inner_id, first.inner_id]

    assert {:ok, interaction_states} =
             Interactions.article_interaction_states(nil, %{paths: paths}, info)

    assert Enum.map(interaction_states, & &1.inner_id) == [second.inner_id, first.inner_id]
  end

  test "Article private-state resolvers keep a bounded query shape for a larger batch" do
    {community, first, _attrs, user} = mock_article(:post)
    {_community, second, _attrs, _user} = mock_article(:post, community, user)
    info = %{context: %{cur_user: user}}

    path = fn article ->
      %{
        community: community.slug,
        thread: :post,
        inner_id: to_string(article_inner_id(article, community))
      }
    end

    {_one, one_queries} =
      capture_queries(fn ->
        Interactions.article_interaction_states(nil, %{paths: [path.(first)]}, info)
      end)

    {_many, many_queries} =
      capture_queries(fn ->
        Interactions.article_interaction_states(
          nil,
          %{paths: [path.(first), path.(second)]},
          info
        )
      end)

    assert length(Enum.filter(many_queries, &select_query?/1)) ==
             length(Enum.filter(one_queries, &select_query?/1))
  end

  test "Comment viewer-state resolver reuses one batch reader" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, first} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        user
      )

    {:ok, second} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        user
      )

    article = %{
      community: community.slug,
      thread: :post,
      inner_id: article_inner_id(post, community)
    }

    info = %{context: %{cur_user: user}}

    {_one, one_queries} =
      capture_queries(fn ->
        Comments.comment_viewer_states(
          nil,
          %{article: article, comment_inner_ids: [to_string(first.inner_id)]},
          info
        )
      end)

    {_many, many_queries} =
      capture_queries(fn ->
        Comments.comment_viewer_states(
          nil,
          %{
            article: article,
            comment_inner_ids: [to_string(first.inner_id), to_string(second.inner_id)]
          },
          info
        )
      end)

    assert length(Enum.filter(many_queries, &select_query?/1)) ==
             length(Enum.filter(one_queries, &select_query?/1))
  end

  test "comment reconciliation returns one Article aggregate and preserves missing refs" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        user
      )

    assert {:ok,
            %{
              article: %{
                inner_id: article_inner_id,
                comments_count: comments_count,
                comments_revision: comments_revision
              },
              entries: [
                %{comment_inner_id: comment_inner_id, comment: reconciled},
                %{comment_inner_id: "999999", comment: nil}
              ]
            }} =
             Comments.comment_reconcile_states(
               nil,
               %{
                 article: %{
                   community: community.slug,
                   thread: :post,
                   inner_id: article_inner_id(post, community)
                 },
                 comment_inner_ids: [to_string(comment.inner_id), "999999"]
               },
               %{context: %{cur_user: user}}
             )

    assert article_inner_id == article_inner_id(post, community)
    assert comments_count == 1
    assert comments_revision >= 1
    assert to_string(comment_inner_id) == to_string(comment.inner_id)
    assert reconciled.inner_id == comment.inner_id
    assert reconciled.viewer_has_upvoted == false
    assert reconciled.article.inner_id == article_inner_id(post, community)
  end

  test "comment reconciliation rejects batches larger than the shared limit" do
    refs = Enum.map(1..101, &to_string/1)

    assert {:error, "viewer batch cannot contain more than 100 paths"} =
             Comments.comment_reconcile_states(
               nil,
               %{
                 article: %{community: "home", thread: "POST", inner_id: "1"},
                 comment_inner_ids: refs
               },
               %{context: %{cur_user: nil}}
             )
  end

  test "returns Article read state with complete emotion vocabulary" do
    {community, post, _attrs, user} = mock_article(:post)

    post =
      Article
      |> Repo.get!(post.id)
      |> Repo.preload(author: :user)
      |> Map.from_struct()
      |> Map.put(:community, community)

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
    {community, post, _attrs, user} = mock_article(:post)

    post =
      Article
      |> Repo.get!(post.id)
      |> Repo.preload(author: :user)
      |> Map.from_struct()
      |> Map.put(:community, community)

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
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        user
      )

    states = CMS.Interactions.viewer_states([post, comment], user)

    assert %{collects_count: 0} = states[{:post, post.id}]
    assert %{upvotes_count: 0} = states[{:comment, comment.id}]
    refute Map.has_key?(states[{:comment, comment.id}], :collects_count)
    refute Map.has_key?(states[{:comment, comment.id}], :viewer_has_viewed)
  end

  test "counts returns lightweight fixed counts keyed by artiment type and physical id" do
    {community, post, _attrs, user} = mock_article(:post)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(post, community),
        mock_comment(),
        user
      )

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

    assert {:error, %ErrorCat.Error{reason: :unsupported_artiment}} =
             CMS.Interactions.viewer_state(community, nil)

    assert {:error, %ErrorCat.Error{reason: :unsupported_artiment}} =
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

  defp select_query?(query) do
    query |> String.trim_leading() |> String.starts_with?("SELECT")
  end
end
