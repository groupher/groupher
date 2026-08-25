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
    test "god can move a post into Trash", ~m(community post)a do
      variables = %{article: article_path(community, post, :post)}

      passport_rules = %{"god" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      trashed = rule_conn |> gq_mutation(S.Article.m(:trash_article), variables)

      assert trashed["article"]["innerId"] == to_string(post.inner_id)
      assert {:error, _} = CMS.Articles.read(community, :post, post.inner_id)
    end

    test "god can permanently delete a trashed post", ~m(community post)a do
      passport_rules = %{"god" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: article_path(community, post, :post)}
      trashed = rule_conn |> gq_mutation(S.Article.m(:trash_article), variables)

      deleted =
        rule_conn
        |> gq_mutation(S.Article.m(:permanently_delete_trashed_article), %{
          id: trashed["id"],
          community: community.slug,
          thread: "POST"
        })

      assert deleted["done"]
      refute Repo.get(CMS.Model.Post, post.id)
    end
  end
end
