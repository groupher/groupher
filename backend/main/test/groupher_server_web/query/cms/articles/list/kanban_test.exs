defmodule GroupherServer.Test.Query.Articles.Kanban do
  @moduledoc false

  use GroupherServer.TestMate

  @article_cat Constant.CMS.article_cat()
  @article_status Constant.CMS.article_status()

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  test "basic graphql query on kanban post with login user",
       ~m(user_conn community user post_attrs)a do
    kanban_attrs =
      post_attrs |> Map.merge(%{cat: @article_cat.idea, status: @article_status.todo})

    {:ok, post} = CMS.Articles.create(community, :post, kanban_attrs, user)

    variables = %{article: %{inner_id: post.inner_id, community: post.community_slug}}
    result = user_conn |> gq_query(Schema.q(:article, :post, "cat status"), variables)

    assert result["innerId"] == to_string(post.inner_id)
    assert result["cat"] == "IDEA"
    assert result["status"] == "TODO"
  end
end
