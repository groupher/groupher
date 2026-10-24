defmodule GroupherServer.Test.CMS.Gate.Scope.ArticleTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias Ecto.Adapters.SQL
  alias GroupherServer.CMS
  alias CMS.Gate.Context.Scope.Article, as: ArticleContext
  alias CMS.Gate.Context.Scope.Doc, as: DocContext
  alias CMS.Model.{Article, ArticleBinding, ArticlePublic, Comment}

  test "ordinary content models keep review visibility in Lifecycle and Gate facts" do
    refute :pending in Article.__schema__(:fields)
    refute :moderation_state in Article.__schema__(:fields)
    refute :visible in ArticleBinding.__schema__(:fields)
    refute :visible in ArticlePublic.__schema__(:fields)
    refute :pending in Comment.__schema__(:fields)
  end

  test "Article scope compiles complete public visibility for every thread" do
    for thread <- [:post, :blog, :changelog, :doc] do
      context =
        case thread do
          :doc -> DocContext.public_main()
          _ -> ArticleContext.public(thread)
        end

      query =
        Article
        |> select([article], %{id: article.id})
        |> CMS.Gate.scope(nil, :list, context)

      assert %Ecto.Query{} = query

      {sql, params} = to_sql(query)

      assert sql =~ ~s(JOIN "cms"."communities")
      assert sql =~ ~s(LEFT OUTER JOIN "cms"."community_lifecycles")

      if thread == :doc do
        assert sql =~ ~s(JOIN "cms"."doc_lifecycles")
        assert sql =~ ~s(JOIN "cms"."doc_branches")
      else
        assert sql =~ ~s(JOIN "cms"."article_lifecycles")
      end

      refute sql =~ ~s(FROM "cms"."trashed_articles")
      assert sql =~ if(thread == :doc, do: "doc_publics", else: "article_publics")
      refute sql =~ "archived_at"
      refute sql =~ "is_archived"
      assert sql =~ "review_blocks"
      refute sql =~ ~s("cms"."article_bindings"."visible")

      if thread != :doc do
        refute sql =~ ~s("cms"."article_publics"."visible")
      end

      refute sql =~ "moderation_state"
      assert ["active", "read_only"] in params
      assert ["published", "archived"] in params
    end
  end

  test "Article scope validates an explicit thread against the root schema" do
    assert {:error, %ErrorCat.Error{reason: :scope_root_mismatch}} =
             CMS.Gate.scope(Article, nil, :read, %{
               ArticleContext.public(:blog)
               | thread: :unknown
             })
  end

  test "Doc scope requires an explicit branch and makes public main policy visible" do
    assert {:error, %ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(Article, nil, :read, %{thread: :doc})

    query = CMS.Gate.scope(Article, nil, :read, DocContext.public_branch(42))
    assert %Ecto.Query{} = query

    {sql, params} = to_sql(query)
    assert sql =~ ~s(JOIN "cms"."doc_branches")
    assert sql =~ "branch_id"
    assert 42 in params
    assert "main" in params

    management_query =
      CMS.Gate.scope(Article, :operations, :read, DocContext.draft(42, :operations))

    assert %Ecto.Query{} = management_query
  end

  test "Article Draft scope has an explicit management action" do
    query =
      CMS.Gate.scope(Article, :operations, :read_draft, ArticleContext.draft(:post, :operations))

    assert %Ecto.Query{} = query
    {sql, params} = to_sql(query)
    assert sql =~ "article_drafts"
    assert ["draft_only", "published", "archived"] in params

    assert {:error, %ErrorCat.Error{reason: :scope_policy_actor_mismatch}} =
             CMS.Gate.scope(Article, nil, :read_draft, ArticleContext.draft(:post, :operations))

    assert {:error, %ErrorCat.Error{reason: :scope_context_missing}} =
             CMS.Gate.scope(
               Article,
               :operations,
               :read_draft,
               ArticleContext.public(:post, policy_mode: :operations)
             )
  end

  test "actor-aware Article scope exposes active restrictions only to the author" do
    {:ok, actor} = db_insert(:user)
    query = CMS.Gate.scope(Article, actor, :read, ArticleContext.public(:post))
    {sql, _params} = to_sql(query)

    assert sql =~ ~s(FROM "cms"."authors")
    assert sql =~ "user_id"
    assert sql =~ "article_review_blocks"
    assert sql =~ "community_id"
  end

  test "Doc public scope filters against Doc restrictions rather than Article restrictions" do
    query = CMS.Gate.scope(Article, nil, :read, DocContext.public_main())
    assert %Ecto.Query{} = query

    {sql, _params} = to_sql(query)
    assert sql =~ "doc_review_blocks"
    refute sql =~ "article_review_blocks"
  end

  test "Article Insights scope combines author, owner, and scoped moderator access" do
    {:ok, actor} = db_insert(:user)

    query =
      CMS.Gate.scope(
        Article,
        actor,
        :read_insights,
        ArticleContext.insights(:post, passport_granted_community_slugs: ["community-a"])
      )

    assert %Ecto.Query{} = query
    {sql, params} = to_sql(query)

    assert sql =~ ~s(FROM "cms"."authors")
    assert sql =~ ~s("cms"."communities_moderators")
    assert sql =~ "slug"
    assert ["community-a"] in params

    assert [
             "setting_up",
             "setup_failed",
             "active",
             "read_only",
             "suspended",
             "archived",
             "pending_destroy"
           ] in params

    assert {:error, %ErrorCat.Error{reason: :scope_policy_actor_mismatch}} =
             CMS.Gate.scope(Article, nil, :read_insights, ArticleContext.insights(:post))
  end

  test "Doc Article Insights scope is pinned to the main branch" do
    {:ok, actor} = db_insert(:user)
    query = CMS.Gate.scope(Article, actor, :read_insights, DocContext.insights())

    assert %Ecto.Query{} = query
    {sql, params} = to_sql(query)
    assert sql =~ ~s(JOIN "cms"."doc_branches")
    assert "main" in params
  end

  defp to_sql(query), do: SQL.to_sql(:all, Repo, query)
end
