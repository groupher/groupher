defmodule GroupherServer.TestWeb.Schema.ArticleCoAuthorContractTest do
  use GroupherServer.TestMate, async: true

  alias GroupherServerWeb.Schema

  test "request decision exposes the resulting current member identity and revision" do
    request = Absinthe.Schema.lookup_type(Schema, :article_co_author_request)
    mutations = Schema.__absinthe_type__(:mutation).fields

    assert Map.has_key?(request.fields, :current_member)
    assert Map.has_key?(mutations, :decide_article_co_author_request)

    member = Absinthe.Schema.lookup_type(Schema, :article_co_author)
    assert Map.has_key?(member.fields, :member_id)
    assert Map.has_key?(member.fields, :revision)
    assert Map.has_key?(member.fields, :user)
  end
end
