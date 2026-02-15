defmodule GroupherServer.Test.Query.Articles.Post do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  test "basic graphql query on post with login user",
       ~m(user_conn community user post_attrs)a do
    {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

    variables = %{community: post.community_slug, id: post.inner_id}
    results = user_conn |> gq_query(Schema.q(:article, :post), variables)

    assert results["innerId"] == to_string(post.inner_id)
    assert results["communitySlug"] == post.community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }
  end

  test "basic graphql query on post with stranger(un-login user)",
       ~m(guest_conn community post_attrs user)a do
    {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

    variables = %{community: post.community_slug, id: post.inner_id}
    results = guest_conn |> gq_query(Schema.q(:article, :post), variables)

    assert results["innerId"] == to_string(post.inner_id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user post_attrs)a do
    {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)
    variables = %{community: post.community_slug, id: post.inner_id}
    results = user_conn |> gq_query(Schema.q(:article, :post), variables)

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> gq_query(Schema.q(:article, :post), variables)
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.Articles.set_illegal(:post, post.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> gq_query(Schema.q(:article, :post), variables)

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end
end
