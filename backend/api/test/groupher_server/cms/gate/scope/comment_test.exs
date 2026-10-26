defmodule GroupherServer.Test.CMS.Gate.Scope.CommentTest do
  @moduledoc false
  use GroupherServer.TestMate, async: false

  alias Ecto.Adapters.SQL
  alias GroupherServer.CMS
  alias CMS.Gate.Context.Scope.Comment, as: CommentContext
  alias CMS.Model.Comment

  test "public Comment scope filters active platform and community restrictions" do
    query = CMS.Gate.scope(Comment, nil, :list, CommentContext.for_thread(:post))
    {sql, _params} = to_sql(query)

    assert sql =~ "comment_review_blocks"
    assert sql =~ "community_id"
    assert sql =~ "resolved_at"
    refute sql =~ ~s("pending" !=)
  end

  test "authors can read their own restricted Comments through the public scope" do
    {:ok, actor} = db_insert(:user)
    query = CMS.Gate.scope(Comment, actor, :read, CommentContext.for_thread(:post))
    {sql, _params} = to_sql(query)

    assert sql =~ "comment_review_blocks"
    assert sql =~ "author_id"
  end

  defp to_sql(query), do: SQL.to_sql(:all, Repo, query)
end
