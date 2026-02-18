defmodule GroupherServer.Test.Mutation.CommunityTags.PostSetTag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    community_tag_attrs = mock_attrs(:community_tag)
    community_tag_attrs2 = mock_attrs(:community_tag)

    {:ok,
     ~m(user_conn guest_conn owner_conn community post community_tag_attrs community_tag_attrs2 user)a}
  end

  describe "[mutation post tag]" do
    test "auth user can set a valid tag to post", ~m(community post community_tag_attrs user)a do
      {:ok, community_tag} = CMS.create_community_tag(community, :post, community_tag_attrs, user)

      passport_rules = %{community.title => %{"post.community_tag.set" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        communityTagId: community_tag.id,
        community: community.slug
      }

      rule_conn |> gq_mutation(Schema.m(:set_community_tag), variables)
      {:ok, found} = ORM.find(Post, post.id, preload: :article_tags)

      assoc_tags = found.article_tags |> Enum.map(& &1.id)
      assert community_tag.id in assoc_tags
    end

    test "can unset tag to a post",
         ~m(community post community_tag_attrs community_tag_attrs2 user)a do
      {:ok, community_tag} = CMS.create_community_tag(community, :post, community_tag_attrs, user)
      {:ok, community_tag2} = CMS.create_community_tag(community, :post, community_tag_attrs2, user)

      {:ok, _} = CMS.set_community_tag(post, community_tag.id)
      {:ok, _} = CMS.set_community_tag(post, community_tag2.id)

      passport_rules = %{community.title => %{"post.community_tag.unset" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        communityTagId: community_tag.id,
        community: community.slug
      }

      rule_conn |> gq_mutation(Schema.m(:unset_community_tag), variables)

      {:ok, post} = ORM.find(Post, post.id, preload: :article_tags)
      assoc_tags = post.article_tags |> Enum.map(& &1.id)

      assert community_tag.id not in assoc_tags
      assert community_tag2.id in assoc_tags
    end
  end
end
