defmodule GroupherServer.Test.Mutation.CMS.Manager do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)
    # {:ok, category} = db_insert(:category)
    # {:ok, thread} = db_insert(:thread)
    {:ok, tag} = db_insert(:article_tag, %{community: community})

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community post user tag)a}
  end

  describe "root mutation" do
    @query """
    mutation($id: ID!){
      markDeletePost(id: $id) {
        id
        markDelete
      }
    }
    """
    test "root can markDelete a post", ~m(post)a do
      variables = %{id: post.id}

      passport_rules = %{"root" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(@query, variables)

      assert updated["id"] == to_string(post.id)
      assert updated["markDelete"] == true
    end

    @query """
    mutation($id: ID!){
      deletePost(id: $id) {
        id
      }
    }
    """
    test "root can delete a post", ~m(post)a do
      passport_rules = %{"root" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      deleted = rule_conn |> gq_mutation(@query, %{id: post.id})

      assert deleted["id"] == to_string(post.id)
      assert {:error, _} = ORM.find(Post, deleted["id"])
    end
  end
end
