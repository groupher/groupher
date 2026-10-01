defmodule GroupherServer.Test.CMS.QueryBuilderTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServer.CMS
  alias CMS.{Model.Article, QueryBuilder}

  test "ignores absent single-tag filters" do
    for filter <- [
          %{article_tag: nil},
          %{article_tag: ""},
          %{community_tag: nil},
          %{community_tag: ""}
        ] do
      query = Article |> QueryBuilder.filter_pack(filter) |> Ecto.Queryable.to_query()

      assert query.joins == []
      assert query.wheres == []
    end
  end

  test "keeps non-empty single-tag filters" do
    for filter <- [%{article_tag: "release"}, %{community_tag: "release"}] do
      query = Article |> QueryBuilder.filter_pack(filter) |> Ecto.Queryable.to_query()

      assert length(query.joins) == 3
      assert length(query.wheres) == 1
    end
  end
end
