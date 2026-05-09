defmodule GroupherServer.Test.Mutation.Articles.PostCatStatus do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user, user)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(user_conn guest_conn owner_conn community post)a}
  end

  describe "[post cat & status]" do
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
        cat: "IDEA"
      }

      created = user_conn |> gq_mutation(@set_cat_query, variables)

      assert "IDEA" == created["cat"]
    end

    test "set cat rejects non-enum value", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        cat: "NOT_EXIST"
      }

      assert user_conn |> mutation_error?(@set_cat_query, variables)
    end

    @set_status_query """
    mutation(
      $article: ArticleRefInput!
      $status: ArticleStatusEnum!
    ) {
      setPostStatus(
        article: $article
        status: $status
      ) {
        innerId
        status
      }
    }
    """
    test "can set status for a existing post", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        status: "DONE"
      }

      created = user_conn |> gq_mutation(@set_status_query, variables)

      assert "DONE" == created["status"]
    end

    test "set status rejects non-enum value", ~m(user_conn community post)a do
      variables = %{
        article: %{inner_id: post.inner_id, community: community.slug, thread: "POST"},
        status: "NOT_EXIST"
      }

      assert user_conn |> mutation_error?(@set_status_query, variables)
    end
  end
end
