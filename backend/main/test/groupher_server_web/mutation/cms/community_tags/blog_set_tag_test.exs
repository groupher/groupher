defmodule GroupherServer.Test.Mutation.CommunityTags.BlogSetTag do
  @moduledoc false

  use GroupherServer.TestTools
  alias GroupherServer.CMS

  setup do
    {community, blog, _, user} = mock_article(:blog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, blog)

    community_tag_attrs = mock_attrs(:community_tag)
    community_tag_attrs2 = mock_attrs(:community_tag)

    {:ok,
     ~m(user_conn guest_conn owner_conn community blog community_tag_attrs community_tag_attrs2 user)a}
  end

  describe "[mutation blog tag]" do
    test "auth user can set a valid tag to blog", ~m(community blog community_tag_attrs user)a do
      {:ok, community_tag} = GroupherServer.CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)

      passport_rules = %{community.title => %{"blog.community_tag.set" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        communityTagId: community_tag.id,
        community: community.slug
      }

      rule_conn |> gq_mutation(Schema.m(:set_community_tag), variables)
      {:ok, found} = ORM.find(Blog, blog.id, preload: :community_tags)

      assoc_tags = found.community_tags |> Enum.map(& &1.id)
      assert community_tag.id in assoc_tags
    end

    test "can unset tag to a blog",
         ~m(community blog community_tag_attrs community_tag_attrs2 user)a do
      {:ok, community_tag} = CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)
      {:ok, community_tag2} = CMS.Communities.create_tag(community, :blog, community_tag_attrs2, user)

      {:ok, _} = CMS.Communities.set_tag(blog, community_tag.id)
      {:ok, _} = CMS.Communities.set_tag(blog, community_tag2.id)

      passport_rules = %{community.title => %{"blog.community_tag.unset" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        communityTagId: community_tag.id,
        community: community.slug
      }

      rule_conn |> gq_mutation(Schema.m(:unset_community_tag), variables)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: :community_tags)
      assoc_tags = blog.community_tags |> Enum.map(& &1.id)

      assert community_tag.id not in assoc_tags
      assert community_tag2.id in assoc_tags
    end
  end
end
