defmodule GroupherServer.Test.Mutation.ArticleTags.PostSetTag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    article_tag_attrs = mock_attrs(:article_tag)
    article_tag_attrs2 = mock_attrs(:article_tag)

    {:ok,
     ~m(user_conn guest_conn owner_conn community post article_tag_attrs article_tag_attrs2 user)a}
  end

  describe "[mutation post tag]" do
    @tag :wip
    test "auth user can set a valid tag to post", ~m(community post article_tag_attrs user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :post, article_tag_attrs, user)

      passport_rules = %{community.title => %{"post.article_tag.set" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        articleTagId: article_tag.id,
        community: community.slug
      }

      rule_conn |> mutation_result(Schema.m(:set_article_tag), variables, "setArticleTag")
      {:ok, found} = ORM.find(Post, post.id, preload: :article_tags)

      assoc_tags = found.article_tags |> Enum.map(& &1.id)
      assert article_tag.id in assoc_tags
    end

    @tag :wip
    test "can unset tag to a post",
         ~m(community post article_tag_attrs article_tag_attrs2 user)a do
      {:ok, article_tag} = CMS.create_article_tag(community, :post, article_tag_attrs, user)
      {:ok, article_tag2} = CMS.create_article_tag(community, :post, article_tag_attrs2, user)

      {:ok, _} = CMS.set_article_tag(post, article_tag.id)
      {:ok, _} = CMS.set_article_tag(post, article_tag2.id)

      passport_rules = %{community.title => %{"post.article_tag.unset" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        articleTagId: article_tag.id,
        community: community.slug
      }

      rule_conn |> mutation_result(Schema.m(:unset_article_tag), variables, "unsetArticleTag")

      {:ok, post} = ORM.find(Post, post.id, preload: :article_tags)
      assoc_tags = post.article_tags |> Enum.map(& &1.id)

      assert article_tag.id not in assoc_tags
      assert article_tag2.id in assoc_tags
    end
  end
end
