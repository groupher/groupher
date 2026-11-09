defmodule GroupherServer.Test.Query.Articles.Kanban do
  @moduledoc false

  use GroupherServer.TestMate
  alias GroupherServer.CMS

  @article_cat CMS.Artiment.Const.cat_map()

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  test "Post detail exposes its category without a legacy processing status",
       ~m(user_conn community user post_attrs)a do
    post_attrs = Map.put(post_attrs, :cat, @article_cat.idea)

    {:ok, post} = CMS.Articles.create(community, :post, post_attrs, user)

    variables = %{
      article: %{
        inner_id: article_inner_id(post, community),
        community: community.slug,
        thread: "POST"
      }
    }

    result = user_conn |> gq_query(S.Article.q(:article, :post, "cat"), variables)

    assert result["innerId"] == to_string(article_inner_id(post, community))
    assert result["cat"] == "IDEA"
    refute Map.has_key?(result, "status")
  end
end
