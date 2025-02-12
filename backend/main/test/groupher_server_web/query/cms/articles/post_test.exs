defmodule GroupherServer.Test.Query.Articles.Post do
  use GroupherServer.TestTools

  alias GroupherServer.CMS

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, post} = db_insert(:post)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    post_attrs = mock_attrs(:post, %{community_id: community.id})

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  @query """
  query($community: String!, $id: ID!) {
    post(community: $community, id: $id) {
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

  test "basic graphql query on post with logined user",
       ~m(user_conn community user post_attrs)a do
    {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

    variables = %{community: post.original_community_slug, id: post.inner_id}
    results = user_conn |> query_result(@query, variables, "post")

    assert results["id"] == to_string(post.id)
    assert results["originalCommunitySlug"] == post.original_community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }

    assert length(Map.keys(results)) == 7
  end

  test "basic graphql query on post with stranger(unloged user)",
       ~m(guest_conn community post_attrs user)a do
    {:ok, post} = CMS.create_article(community, :post, post_attrs, user)

    variables = %{community: post.original_community_slug, id: post.inner_id}
    results = guest_conn |> query_result(@query, variables, "post")

    assert results["id"] == to_string(post.id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user post_attrs)a do
    {:ok, post} = CMS.create_article(community, :post, post_attrs, user)
    variables = %{community: post.original_community_slug, id: post.inner_id}
    results = user_conn |> query_result(@query, variables, "post")

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> query_result(@query, variables, "post")
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.set_article_illegal(:post, post.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> query_result(@query, variables, "post")

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end
end
