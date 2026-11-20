defmodule GroupherServerWeb.Schema.CommonArticleAuthorTest do
  use ExUnit.Case, async: true

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Author
  alias GroupherServerWeb.Schema.Helper.Fields

  test "common Article author resolution accepts User and preloaded Author sources" do
    user = %User{id: 101, login: "article-owner"}

    assert {:ok, ^user} = Fields.article_relation(%{author: user}, %{}, nil, :author)

    assert {:ok, ^user} =
             Fields.article_relation(%{author: %Author{user: user}}, %{}, nil, :author)
  end
end
