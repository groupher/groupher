defmodule GroupherServer.Test.CMS.GraphQLAuditQueryCountsTest do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS
  alias CMS.Events
  alias CMS.SearchArtiments.Indexer
  alias CMS.Model.Article
  alias Helper.TestFakes.SearchArtiments, as: SearchPlatform

  defp measure(fun) do
    owner = self()
    ref = make_ref()
    handler = {__MODULE__, ref}
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])

    :ok =
      :telemetry.attach(
        handler,
        event,
        fn _, _, metadata, _ -> send(owner, {ref, metadata.query}) end,
        nil
      )

    try do
      result = fun.()

      queries =
        Stream.repeatedly(fn ->
          receive do
            {^ref, query} -> query
          after
            20 -> nil
          end
        end)
        |> Enum.take_while(& &1)

      {result, queries}
    after
      :telemetry.detach(handler)
    end
  end

  test "measures reindex query count for three public articles" do
    SearchPlatform.reset()
    {community, first, _, author} = mock_article(:post)
    {_, second, _, _} = mock_article(:post, community, author)
    {_, third, _, _} = mock_article(:post, community, author)
    {result, queries} = measure(fn -> Indexer.reindex_articles() end)
    assert {:ok, :pass} = result
    IO.puts("INDEX_REINDEX_3_POSTS_SQL=#{length(queries)}")
    assert length(queries) <= 67

    for article <- [first, second, third] do
      ref = CMS.SearchArtiments.Artiment.article_key(:post, article.id, community.slug)
      assert [{^ref, indexed}] = :ets.lookup(:search_artiments_test_platform, ref)
      assert indexed.article_id == article.id
      assert indexed.upvotes_count == 0
      assert indexed.comments_count == 0
    end
  end

  test "measures shared comment notification with preferred binding missing" do
    {community, article, _, author} = mock_article(:post)
    {:ok, viewer} = db_insert(:user)

    {:ok, comment} =
      CMS.Comments.create_comment(
        community,
        :post,
        article_inner_id(article, community),
        mock_comment(),
        author,
        Ecto.UUID.generate()
      )

    {result, queries} =
      measure(fn ->
        Events.emit(:notify_comment, %{
          comment: %{comment | request_community_slug: "missing"},
          from_user: viewer
        })
      end)

    assert {:ok, _} = result
    IO.puts("NOTIFY_ONE_BINDING_SQL=#{length(queries)}")
  end

  test "measures notification fallback across two hidden community bindings" do
    {community, view, _, author} = mock_article(:post)
    article = Repo.get!(Article, view.id)
    {:ok, second} = mock_community(author)
    {:ok, third} = mock_community(author)
    {:ok, commenter} = db_insert(:user)

    for destination <- [second, third] do
      assert {:ok, {:ok, _}} =
               Repo.transaction(fn ->
                 CMS.Articles.BindingPersist.mirror(article, destination)
               end)
    end

    {:ok, comment} =
      CMS.Comments.create_comment(
        third,
        :post,
        Repo.get_by!(CMS.Model.ArticleBinding, article_id: article.id, community_id: third.id).inner_id,
        mock_comment(),
        commenter,
        Ecto.UUID.generate()
      )

    for hidden <- [community, second] do
      assert {:ok, _} =
               Repo.transaction(fn ->
                 {:ok, locked} = CMS.Articles.Lifecycle.lock(article)

                 case CMS.Articles.Lifecycle.apply_review_block(locked, %{
                        scope_key: "community:#{hidden.id}",
                        type: :manual_hold,
                        source_ref: Ecto.UUID.generate(),
                        source: :human,
                        applied_at: DateTime.utc_now(:second)
                      }) do
                   {:ok, block} -> block
                   {:error, reason} -> Repo.rollback(reason)
                 end
               end)
    end

    {result, queries} =
      measure(fn ->
        Events.emit(:notify_comment, %{
          comment: %{comment | request_community_slug: community.slug},
          from_user: commenter
        })
      end)

    assert {:ok, _} = result
    IO.puts("NOTIFY_TWO_HIDDEN_BINDINGS_SQL=#{length(queries)}")
    assert length(queries) <= 30

    assert {:ok, messages} =
             GroupherServer.Messaging.paged_messages(
               :notification,
               author,
               %{},
               %GroupherServer.Pagi.Params.Offset{page: 1, size: 20}
             )

    assert Enum.any?(messages.entries, &(&1.comment_id == comment.id))
  end
end
