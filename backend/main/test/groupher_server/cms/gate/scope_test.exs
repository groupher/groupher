defmodule GroupherServer.Test.CMS.Gate.ScopeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias CMS.Model.{
    ArticleDocument,
    Blog,
    Changelog,
    Comment,
    Community,
    CommunityLifecycle,
    Doc,
    Post
  }

  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Comment, as: CommentScope
  alias CMS.Gate.Context.Scope.Document, as: DocumentScope

  test "Comment all-thread scope is constructed only by all_public" do
    assert_raise FunctionClauseError, fn -> apply(CommentScope, :for_thread, [:all]) end

    assert %CommentScope{thread: :all, policy_mode: :public} = CommentScope.all_public()
  end

  test "Comment scope uses stable community_id and accepts an optional thread coordinate" do
    contextless =
      Comment
      |> select([comment], %{id: comment.id})
      |> CMS.Gate.scope(nil, :list, CommentScope.all_public())

    threaded =
      Comment
      |> select([comment], %{id: comment.id})
      |> CMS.Gate.scope(nil, :list, CommentScope.for_thread(:post))

    for query <- [contextless, threaded] do
      assert %Ecto.Query{} = query
      {sql, params} = to_sql(query)

      assert sql =~ ~s(JOIN "cms"."communities")
      assert sql =~ ~s(JOIN "cms"."comment_lifecycles")
      refute sql =~ ~s(JOIN "cms"."posts")
      refute sql =~ ~s(JOIN "cms"."blogs")
      refute sql =~ "is_deleted"
      refute sql =~ "archived_at"
      refute sql =~ "is_archived"
      assert sql =~ "pending"
      assert ["active", "read_only"] in params
    end

    {threaded_sql, threaded_params} = to_sql(threaded)
    assert threaded_sql =~ "thread"
    assert "post" in threaded_params
  end

  test "Comment rejects an unknown thread and Document requires a thread" do
    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(Comment, nil, :read, %{thread: :unknown})

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(ArticleDocument, nil, :read, %{})
  end

  test "ArticleDocument scope compiles every parent table" do
    for {thread, _schema} <- article_schemas() do
      context =
        case thread do
          :doc -> DocumentScope.public_main()
          _ -> DocumentScope.public(thread)
        end

      query = CMS.Gate.scope(ArticleDocument, nil, :read, context)
      assert %Ecto.Query{} = query

      {sql, params} = to_sql(query)
      assert sql =~ ~s(JOIN "cms"."#{thread_table(thread)}")
      assert sql =~ ~s(JOIN "cms"."communities")
      assert ["active", "read_only"] in params
    end
  end

  test "child scopes reject caller-owned Community and Lifecycle joins" do
    article_query = from(post in Post, join: community in assoc(post, :community))
    comment_query = from(comment in Comment, join: community in assoc(comment, :community))

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_binding_conflict}} =
             CMS.Gate.scope(article_query, nil, :read, ArticleScope.public(:post))

    assert {:error, %GroupherServer.ErrorCat.Error{reason: :scope_binding_conflict}} =
             CMS.Gate.scope(comment_query, nil, :read, CommentScope.all_public())
  end

  test "scope composes after select, distinct, and group_by" do
    query =
      Comment
      |> join(:inner, [comment], author in assoc(comment, :author))
      |> distinct([_comment, author], author.id)
      |> group_by([comment, author], [comment.id, author.id])
      |> select([_comment, author], author)
      |> CMS.Gate.scope(nil, :list, CommentScope.for_thread(:post))

    assert %Ecto.Query{} = query
    {sql, _params} = to_sql(query)
    assert sql =~ "GROUP BY"
    assert sql =~ ~s(JOIN "cms"."communities")
  end

  test "scope construction never executes Repo" do
    handler_id = "gate-scope-query-#{System.unique_integer([:positive])}"
    event = Repo.config() |> Keyword.fetch!(:telemetry_prefix) |> Kernel.++([:query])
    parent = self()

    :ok =
      :telemetry.attach(
        handler_id,
        event,
        fn _event, _measurements, _metadata, _config -> send(parent, :scope_query) end,
        nil
      )

    on_exit(fn -> :telemetry.detach(handler_id) end)

    assert %Ecto.Query{} = CMS.Gate.scope(Post, nil, :read, ArticleScope.public(:post))
    assert %Ecto.Query{} = CMS.Gate.scope(Comment, nil, :list, CommentScope.all_public())

    assert %Ecto.Query{} =
             CMS.Gate.scope(ArticleDocument, nil, :read, DocumentScope.public(:post))

    refute_receive :scope_query
  end

  test "high-frequency Article and Comment scopes produce valid EXPLAIN plans" do
    queries = [
      Post
      |> CMS.Gate.scope(nil, :list, ArticleScope.public(:post))
      |> where([article], article.community_id == ^0)
      |> order_by([article], desc: article.active_at)
      |> limit(20),
      Comment
      |> CMS.Gate.scope(nil, :list, CommentScope.all_public())
      |> where([comment], comment.community_id == ^0)
      |> order_by([comment], desc: comment.inserted_at)
      |> limit(20)
    ]

    for query <- queries do
      {sql, params} = to_sql(query)
      result = Ecto.Adapters.SQL.query!(Repo, "EXPLAIN " <> sql, params)

      assert result.rows != []
      assert Enum.all?(result.rows, fn [line] -> is_binary(line) end)
    end
  end

  test "Article scope hides rows when the ancestor Community is suspended" do
    {community, post, _attrs, _user} = mock_article(:post)

    visible_query =
      Post
      |> CMS.Gate.scope(nil, :read, ArticleScope.public(:post))
      |> where([candidate], candidate.id == ^post.id)

    assert Repo.exists?(visible_query)

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    refute Repo.exists?(visible_query)
  end

  test "own-content lists and counts share the public Community boundary" do
    {community, post, _attrs, author} = mock_article(:post, preload: [author: :user])

    {:ok, comment} =
      CMS.Comments.create_comment(community, :post, post.inner_id, mock_comment(), author)

    assert comment.community_id == community.id

    assert {:ok, %{entries: articles}} =
             CMS.Articles.paged_published(:post, %{page: 1, size: 20}, author)

    assert Enum.any?(articles, &(&1.id == post.id))
    assert {:ok, article_count} = CMS.Articles.count_published(:post, author)
    assert article_count > 0

    assert {:ok, %{entries: comments}} =
             CMS.Comments.paged_published_comments(author, %{page: 1, size: 20})

    assert Enum.any?(comments, &(&1.id == comment.id))

    Repo.get_by!(CommunityLifecycle, community_id: community.id)
    |> CommunityLifecycle.changeset(%{state: :suspended})
    |> Repo.update!()

    assert {:ok, %{entries: hidden_articles}} =
             CMS.Articles.paged_published(:post, %{page: 1, size: 20}, author)

    refute Enum.any?(hidden_articles, &(&1.id == post.id))
    assert {:ok, 0} = CMS.Articles.count_published(:post, author)

    assert {:ok, %{entries: hidden_comments}} =
             CMS.Comments.paged_published_comments(author, %{page: 1, size: 20})

    refute Enum.any?(hidden_comments, &(&1.id == comment.id))
  end

  defp to_sql(query), do: Ecto.Adapters.SQL.to_sql(:all, Repo, query)

  defp article_schemas,
    do: [post: Post, blog: Blog, changelog: Changelog, doc: Doc]

  defp thread_table(:post), do: "posts"
  defp thread_table(:blog), do: "blogs"
  defp thread_table(:changelog), do: "changelogs"
  defp thread_table(:doc), do: "docs"
end
