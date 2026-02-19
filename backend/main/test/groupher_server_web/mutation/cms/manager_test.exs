defmodule GroupherServer.Test.Mutation.CMS.Manager do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)
    # {:ok, category} = db_insert(:category)
    # {:ok, thread} = db_insert(:thread)
    {:ok, tag} = db_insert(:community_tag, %{community: community})

    user_conn = simu_conn(:user)
    guest_conn = simu_conn(:guest)

    {:ok, ~m(user_conn guest_conn community post user tag)a}
  end

  describe "root mutation" do
    test "root can markDelete a post", ~m(community post)a do
      variables = %{community: community.slug, id: post.inner_id}

      passport_rules = %{"root" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
      assert updated["markDelete"] == true
    end

    test "root can delete a post", ~m(community post)a do
      passport_rules = %{"root" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{community: community.slug, id: post.inner_id}
      deleted = rule_conn |> gq_mutation(Schema.m(:delete_article, :post), variables)

      assert deleted["innerId"] == to_string(post.inner_id)
      assert {:error, _} = ORM.find_article(community, :post, deleted["innerId"])
    end
  end
end
