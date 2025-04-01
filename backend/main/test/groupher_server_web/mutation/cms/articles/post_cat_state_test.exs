defmodule GroupherServer.Test.Mutation.Articles.PostCatState do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(user_conn guest_conn owner_conn community post)a}
  end

  describe "[post cat & state]" do
    @set_cat_query """
    mutation(
      $id: ID!
      $community: String!
      $cat: ArticleCatEnum!
    ) {
      setPostCat(
        id: $id
        community: $community
        cat: $cat
      ) {
        innerId
        cat
      }
    }
    """
    @tag :wip
    test "can set cat for a existing post", ~m(user_conn community post)a do
      variables = %{id: post.inner_id, cat: "FEATURE", community: community.slug}
      created = user_conn |> gq_mutation(@set_cat_query, variables)

      assert "FEATURE" == created["cat"]
    end

    @set_state_query """
    mutation(
      $id: ID!
      $community: String!
      $state: ArticleStateEnum!
    ) {
      setPostState(
        id: $id
                community: $community
        state: $state
      ) {
        innerId
        state
      }
    }
    """
    @tag :wip
    test "can set state for a existing post", ~m(user_conn community post)a do
      variables = %{id: post.inner_id, state: "DONE", community: community.slug}
      created = user_conn |> gq_mutation(@set_state_query, variables)

      assert "DONE" == created["state"]
    end
  end
end
