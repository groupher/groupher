defmodule GroupherServer.Test.CMS.Gate.ScopeTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  require CMS.Const

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

  test "Community scope compiles the public lifecycle boundary" do
    query = CMS.Gate.scope(Community, nil, :read, %{})
    assert %Ecto.Query{} = query

    {sql, params} = to_sql(query)

    assert sql =~ ~s(LEFT OUTER JOIN "cms"."community_lifecycles")
    assert ["active", "read_only"] in params
  end

  test "Community scope requires explicit owner management mode for restricted states" do
    {:ok, owner} = db_insert(:user)

    owner_query =
      CMS.Gate.scope(Community, owner, :read, %{policy_mode: :owner_management})

    assert %Ecto.Query{} = owner_query

    {owner_sql, owner_params} = to_sql(owner_query)
    assert owner_sql =~ "user_id"

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy"
           ] in owner_params

    assert {:error, :scope_policy_actor_mismatch} =
             CMS.Gate.scope(Community, nil, :read, %{policy_mode: :owner_management})

    assert {:error, :scope_policy_actor_mismatch} =
             CMS.Gate.scope(Community, owner, :read, %{policy_mode: :operations})
  end

  test "Community scope compiles moderator and operations modes explicitly" do
    {:ok, moderator} = db_insert(:user)

    moderator_query =
      CMS.Gate.scope(Community, moderator, :list, %{policy_mode: :moderator_management})

    assert %Ecto.Query{} = moderator_query
    {moderator_sql, _moderator_params} = to_sql(moderator_query)
    assert moderator_sql =~ "communities_moderators"
    assert moderator_sql =~ "exists("

    operations_query =
      CMS.Gate.scope(Community, :operations, :read, %{policy_mode: :operations})

    assert %Ecto.Query{} = operations_query
    {_operations_sql, operations_params} = to_sql(operations_query)

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy",
             "destroy"
           ] in operations_params
  end

  test "Community owner public read never bypasses Lifecycle terminal states" do
    {:ok, owner} = db_insert(:user)
    {:ok, community} = mock_community(owner)

    for state <- CMS.Const.lifecycle_state_values() do
      Repo.get_by!(CommunityLifecycle, community_id: community.id)
      |> CommunityLifecycle.changeset(%{state: state})
      |> Repo.update!()

      public_query =
        CMS.Gate.scope(Community, owner, :read, %{})
        |> where([candidate], candidate.id == ^community.id)

      management_query =
        CMS.Gate.scope(Community, owner, :read, %{policy_mode: :owner_management})
        |> where([candidate], candidate.id == ^community.id)

      assert Repo.exists?(public_query) == state in [:active, :read_only]
      assert Repo.exists?(management_query) == (state != :destroy)
    end
  end

  test "scope rejects unsupported roots, actions, and reserved bindings" do
    assert {:error, :scope_root_mismatch} =
             CMS.Gate.scope(CommunityLifecycle, nil, :read, %{})

    assert {:error, :unknown_action} = CMS.Gate.scope(Community, nil, :publish, %{})

    query =
      from(community in Community,
        left_join: lifecycle in CommunityLifecycle,
        as: :gate_lifecycle,
        on: lifecycle.community_id == community.id
      )

    assert {:error, :scope_binding_conflict} = CMS.Gate.scope(query, nil, :read, %{})
  end

  test "Community scope rejects named and anonymous lifecycle joins" do
    direct_join =
      from(community in Community,
        left_join: lifecycle in CommunityLifecycle,
        on: lifecycle.community_id == community.id
      )

    association_join =
      from(community in Community,
        left_join: lifecycle in assoc(community, :lifecycle)
      )

    assert {:error, :scope_binding_conflict} =
             CMS.Gate.scope(direct_join, nil, :read, %{})

    assert {:error, :scope_binding_conflict} =
             CMS.Gate.scope(association_join, nil, :read, %{})
  end

  test "Article scope compiles complete public visibility for every thread" do
    for {thread, schema} <- article_schemas() do
      query =
        schema
        |> select([article], %{id: article.id})
        |> CMS.Gate.scope(nil, :list, %{thread: thread})

      assert %Ecto.Query{} = query

      {sql, params} = to_sql(query)

      assert sql =~ ~s(JOIN "cms"."communities")
      assert sql =~ ~s(LEFT OUTER JOIN "cms"."community_lifecycles")
      assert sql =~ ~s(JOIN "cms"."article_lifecycles")
      refute sql =~ ~s(FROM "cms"."trashed_articles")
      assert sql =~ "stage"
      refute sql =~ "archived_at"
      refute sql =~ "is_archived"
      assert sql =~ "pending"
      assert ["active", "read_only"] in params
      assert ["published", "archived"] in params
    end
  end

  test "Article scope validates an explicit thread against the root schema" do
    assert {:error, :scope_root_mismatch} =
             CMS.Gate.scope(Post, nil, :read, %{thread: :blog})
  end

  test "Document draft scope requires an explicit management policy" do
    operations_query =
      CMS.Gate.scope(ArticleDocument, :operations, :read, %{
        thread: :doc,
        stage: :draft,
        policy_mode: :operations
      })

    assert %Ecto.Query{} = operations_query
    {sql, params} = to_sql(operations_query)

    assert sql =~ ~s(JOIN "cms"."docs")
    assert sql =~ "stage"
    assert "draft" in params
    assert ["draft_only", "published", "archived"] in params

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy",
             "destroy"
           ] in params

    assert {:error, :scope_policy_actor_mismatch} =
             CMS.Gate.scope(ArticleDocument, nil, :read, %{
               thread: :doc,
               stage: :draft,
               policy_mode: :operations
             })

    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(ArticleDocument, :operations, :read, %{
               thread: :doc,
               stage: :draft,
               policy_mode: :public
             })
  end

  test "actor-aware Article scope keeps moderation visibility inside SQL" do
    {:ok, actor} = db_insert(:user)
    query = CMS.Gate.scope(Post, actor, :read, %{thread: :post})
    {sql, _params} = to_sql(query)

    assert sql =~ ~s(FROM "cms"."authors")
    assert sql =~ "user_id"
  end

  test "Comment scope uses stable community_id and accepts an optional thread coordinate" do
    contextless =
      Comment
      |> select([comment], %{id: comment.id})
      |> CMS.Gate.scope(nil, :list, %{})

    threaded =
      Comment
      |> select([comment], %{id: comment.id})
      |> CMS.Gate.scope(nil, :list, %{thread: :post})

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
    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(Comment, nil, :read, %{thread: :unknown})

    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(ArticleDocument, nil, :read, %{})
  end

  test "ArticleDocument scope compiles every parent table" do
    for {thread, _schema} <- article_schemas() do
      query = CMS.Gate.scope(ArticleDocument, nil, :read, %{thread: thread})
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

    assert {:error, :scope_binding_conflict} =
             CMS.Gate.scope(article_query, nil, :read, %{thread: :post})

    assert {:error, :scope_binding_conflict} =
             CMS.Gate.scope(comment_query, nil, :read, %{})
  end

  test "scope composes after select, distinct, and group_by" do
    query =
      Comment
      |> join(:inner, [comment], author in assoc(comment, :author))
      |> distinct([_comment, author], author.id)
      |> group_by([comment, author], [comment.id, author.id])
      |> select([_comment, author], author)
      |> CMS.Gate.scope(nil, :list, %{thread: :post})

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

    assert %Ecto.Query{} = CMS.Gate.scope(Post, nil, :read, %{})
    assert %Ecto.Query{} = CMS.Gate.scope(Comment, nil, :list, %{})
    assert %Ecto.Query{} = CMS.Gate.scope(ArticleDocument, nil, :read, %{thread: :post})

    refute_receive :scope_query
  end

  test "high-frequency Article and Comment scopes produce valid EXPLAIN plans" do
    queries = [
      Post
      |> CMS.Gate.scope(nil, :list, %{thread: :post})
      |> where([article], article.community_id == ^0)
      |> order_by([article], desc: article.active_at)
      |> limit(20),
      Comment
      |> CMS.Gate.scope(nil, :list, %{})
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
      |> CMS.Gate.scope(nil, :read, %{thread: :post})
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
