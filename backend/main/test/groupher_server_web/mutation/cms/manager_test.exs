defmodule GroupherServer.Test.Mutation.CMS.Manager do
  @moduledoc false

  use GroupherServer.TestMate

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
    test "god can markDelete a post", ~m(community post)a do
      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}

      passport_rules = %{"god" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      updated = rule_conn |> gq_mutation(Schema.m(:mark_delete_article, :post), variables)

      assert updated["innerId"] == to_string(post.inner_id)
      assert updated["markDelete"] == true
    end

    test "god can delete a post", ~m(community post)a do
      passport_rules = %{"god" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: post.inner_id, community: community.slug}}
      deleted = rule_conn |> gq_mutation(Schema.m(:delete_article, :post), variables)

      assert deleted["innerId"] == to_string(post.inner_id)
      assert {:error, _} = CMS.FrontDesk.article(community, :post, deleted["innerId"])
    end
  end
end
