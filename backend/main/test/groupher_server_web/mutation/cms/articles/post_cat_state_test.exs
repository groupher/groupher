defmodule GroupherServer.Test.Mutation.Articles.PostCatState do
  @moduledoc false

  use GroupherServer.TestMate

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
      $article: ArticleRefInput!
      $cat: ArticleCatEnum!
    ) {
      setPostCat(
        article: $article
        cat: $cat
      ) {
        innerId
        cat
      }
    }
    """
    test "can set cat for a existing post", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        cat: "FEATURE"
      }

      created = user_conn |> gq_mutation(@set_cat_query, variables)

      assert "FEATURE" == created["cat"]
    end

    test "set cat rejects non-enum value", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        cat: "feature"
      }

      assert user_conn |> mutation_error?(@set_cat_query, variables)
    end

    @set_state_query """
    mutation(
      $article: ArticleRefInput!
      $state: ArticleStateEnum!
    ) {
      setPostState(
        article: $article
        state: $state
      ) {
        innerId
        state
      }
    }
    """
    test "can set state for a existing post", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        state: "DONE"
      }

      created = user_conn |> gq_mutation(@set_state_query, variables)

      assert "DONE" == created["state"]
    end

    test "set state rejects non-enum value", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        state: "done"
      }

      assert user_conn |> mutation_error?(@set_state_query, variables)
    end
  end
end
