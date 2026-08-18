defmodule GroupherServer.Test.CMS.Gate.Scope.ArticleTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  require CMS.Const

  alias CMS.Model.{ArticleDocument, Blog, Changelog, Doc, Post}
  alias CMS.Gate.Context.Scope.Article, as: ArticleScope
  alias CMS.Gate.Context.Scope.Doc, as: DocScope
  alias CMS.Gate.Context.Scope.Document, as: DocumentScope

  test "Article scope compiles complete public visibility for every thread" do
    for {thread, schema} <- article_schemas() do
      context =
        case thread do
          :doc -> DocScope.public_main()
          _ -> ArticleScope.public(thread)
        end

      query =
        schema
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
             CMS.Gate.scope(Post, nil, :read, ArticleScope.public(:blog))
  end

  test "Doc scope requires an explicit branch and makes public main policy visible" do
    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(Doc, nil, :read, %{thread: :doc})

    query = CMS.Gate.scope(Doc, nil, :read, DocScope.public_branch(42))
    assert %Ecto.Query{} = query

    {sql, params} = to_sql(query)
    assert sql =~ ~s(JOIN "cms"."doc_branches")
    assert sql =~ "branch_id"
    assert 42 in params
    assert "main" in params

    management_query =
      CMS.Gate.scope(Doc, :operations, :read, DocScope.draft(42, :operations))

    assert %Ecto.Query{} = management_query
  end

  test "Article Draft scope has an explicit management action" do
    query =
      CMS.Gate.scope(Post, :operations, :read_draft, ArticleScope.draft(:post, :operations))

    assert %Ecto.Query{} = query
    {sql, params} = to_sql(query)
    assert sql =~ "stage"
    assert "draft" in params
    assert ["draft_only", "published", "archived"] in params

    assert {:error, :scope_policy_actor_mismatch} =
             CMS.Gate.scope(Post, nil, :read_draft, ArticleScope.draft(:post, :operations))

    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(
               Post,
               :operations,
               :read_draft,
               ArticleScope.public(:post, policy_mode: :operations)
             )
  end

  test "Document draft scope requires an explicit management policy" do
    operations_query =
      CMS.Gate.scope(ArticleDocument, :operations, :read, DocumentScope.draft(42, :operations))

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
             CMS.Gate.scope(ArticleDocument, nil, :read, DocumentScope.draft(42, :operations))

    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(ArticleDocument, :operations, :read, %DocumentScope{
               thread: :doc,
               stage: :draft,
               policy_mode: :public
             })

    assert {:error, :scope_context_missing} =
             CMS.Gate.scope(ArticleDocument, :operations, :read, %DocumentScope{
               thread: :doc,
               stage: :draft,
               branch_policy: :main,
               policy_mode: :operations
             })
  end

  test "actor-aware Article scope keeps moderation visibility inside SQL" do
    {:ok, actor} = db_insert(:user)
    query = CMS.Gate.scope(Post, actor, :read, ArticleScope.public(:post))
    {sql, _params} = to_sql(query)

    assert sql =~ ~s(FROM "cms"."authors")
    assert sql =~ "user_id"
  end

  defp to_sql(query), do: Ecto.Adapters.SQL.to_sql(:all, Repo, query)

  defp article_schemas,
    do: [post: Post, blog: Blog, changelog: Changelog, doc: Doc]
end
