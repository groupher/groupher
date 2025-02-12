defmodule GroupherServer.Test.Query.Articles.Blog do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, blog} = db_insert(:blog)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    blog_attrs = mock_attrs(:blog, %{community_id: community.id})

    {:ok, ~m(user_conn guest_conn blog user community blog_attrs)a}
  end

  @query """
  query($community: String!, $id: ID!) {
    blog(community: $community, id: $id) {
      id
      title
      innerId
      originalCommunitySlug
      meta {
        isEdited
        isLegal
        illegalReason
        illegalWords
      }
      isArchived
      archivedAt
    }
  }
  """

  test "basic graphql query on blog with logined user",
       ~m(user_conn community user blog_attrs)a do
    {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

    variables = %{community: blog.original_community_slug, id: blog.inner_id}
    results = user_conn |> query_result(@query, variables, "blog")

    assert results["id"] == to_string(blog.id)
    assert results["originalCommunitySlug"] == blog.original_community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }

    assert length(Map.keys(results)) == 7
  end

  test "basic graphql query on blog with stranger(unloged user)",
       ~m(guest_conn community blog_attrs user)a do
    {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)

    variables = %{community: blog.original_community_slug, id: blog.inner_id}
    results = guest_conn |> query_result(@query, variables, "blog")

    assert results["id"] == to_string(blog.id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user blog_attrs)a do
    {:ok, blog} = CMS.create_article(community, :blog, blog_attrs, user)
    variables = %{community: blog.original_community_slug, id: blog.inner_id}
    results = user_conn |> query_result(@query, variables, "blog")

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> query_result(@query, variables, "blog")
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.set_article_illegal(:blog, blog.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> query_result(@query, variables, "blog")

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end
end
