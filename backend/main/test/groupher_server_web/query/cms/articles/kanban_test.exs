defmodule GroupherServer.Test.Query.Articles.Kanban do
  @moduledoc false

  use GroupherServer.TestTools

  @article_cat Constant.CMS.article_cat()
  @article_state Constant.CMS.article_state()

  setup do
    {community, post, post_attrs, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)

    {:ok, ~m(user_conn guest_conn post user community post_attrs)a}
  end

  @query """
  query($community: String!, $id: ID!) {
    post(community: $community, id: $id) {
      id
      title
      cat
      state
    }
  }
  """

  test "basic graphql query on kanban post with logined user",
       ~m(user_conn community user post_attrs)a do
    kanban_attrs =
      post_attrs |> Map.merge(%{cat: @article_cat.feature, state: @article_state.todo})

    {:ok, post} = CMS.create_article(community, :post, kanban_attrs, user)

    variables = %{community: post.original_community_slug, id: post.inner_id}
    result = user_conn |> gq_query(@query, variables)

    assert result["id"] == to_string(post.id)
    assert result["cat"] == "FEATURE"
    assert result["state"] == "TODO"
  end
end
