defmodule GroupherServer.Test.Query.Articles.Blog do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, blog, blog_attrs, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn blog user community blog_attrs)a}
  end

  test "basic graphql query on blog with login user",
       ~m(user_conn community user blog_attrs)a do
    {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

    variables = %{article: %{inner_id: blog.inner_id, community: blog.community_slug}}
    results = user_conn |> gq_query(Schema.q(:article, :blog), variables)

    assert results["innerId"] == to_string(blog.inner_id)
    assert results["communitySlug"] == blog.community_slug

    assert is_valid_kv?(results, "title", :string)

    assert results["meta"] == %{
             "isEdited" => false,
             "illegalReason" => [],
             "illegalWords" => [],
             "isLegal" => true
           }
  end

  test "basic graphql query on blog with stranger(un-login user)",
       ~m(guest_conn community blog_attrs user)a do
    {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

    variables = %{article: %{inner_id: blog.inner_id, community: blog.community_slug}}
    results = guest_conn |> gq_query(Schema.q(:article, :blog), variables)

    assert results["innerId"] == to_string(blog.inner_id)
    assert is_valid_kv?(results, "title", :string)
  end

  test "pending state should in meta", ~m(guest_conn user_conn community user blog_attrs)a do
    {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)
    variables = %{article: %{inner_id: blog.inner_id, community: blog.community_slug}}
    results = user_conn |> gq_query(Schema.q(:article, :blog), variables)

    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    results = guest_conn |> gq_query(Schema.q(:article, :blog), variables)
    assert results |> get_in(["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == []
    assert results |> get_in(["meta", "illegalWords"]) == []

    {:ok, _} =
      CMS.Articles.set_illegal(:blog, blog.id, %{
        is_legal: false,
        illegal_reason: ["some-reason"],
        illegal_words: ["some-word"]
      })

    results = user_conn |> gq_query(Schema.q(:article, :blog), variables)

    assert not get_in(results, ["meta", "isLegal"])
    assert results |> get_in(["meta", "illegalReason"]) == ["some-reason"]
    assert results |> get_in(["meta", "illegalWords"]) == ["some-word"]
  end

  test "returns cancan error when blog thread is disabled",
       ~m(guest_conn community blog_attrs user)a do
    {:ok, blog} = CMS.Articles.create(community, :blog, blog_attrs, user)

    {:ok, _} =
      CMS.Dashboard.update(community, :enable, %{
        blog: false
      })

    variables = %{article: %{inner_id: blog.inner_id, community: blog.community_slug}}

    assert guest_conn
           |> query_error?(Schema.q(:article, :blog), variables, ecode(:thread_not_visible))
  end
end
