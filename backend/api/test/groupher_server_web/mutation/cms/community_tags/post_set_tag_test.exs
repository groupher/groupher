defmodule GroupherServer.Test.Mutation.CommunityTags.PostSetTag do
  @moduledoc false

  use GroupherServer.TestMate

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
      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          community_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      passport_rules = %{
        community.title => %{"community.update" => true, "post.community_tag.set" => true}
      }

      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        communityTagId: community_tag.id
      }

      rule_conn |> gq_mutation(S.Article.m(:set_community_tag), variables)
      {:ok, tags} = binding_tags(post, community)
      assoc_tags = Enum.map(tags, & &1.id)
      assert community_tag.id in assoc_tags
    end

    test "can unset tag to a post",
         ~m(community post community_tag_attrs community_tag_attrs2 user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :post,
          community_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, community_tag2} =
        CMS.Communities.create_tag(
          community,
          :post,
          community_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} = CMS.Communities.set_tag(post, community_tag.id)
      {:ok, _} = CMS.Communities.set_tag(post, community_tag2.id)

      passport_rules = %{
        community.title => %{"community.update" => true, "post.community_tag.unset" => true}
      }

      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        communityTagId: community_tag.id
      }

      rule_conn |> gq_mutation(S.Article.m(:unset_community_tag), variables)

      {:ok, tags} = binding_tags(post, community)
      assoc_tags = Enum.map(tags, & &1.id)

      assert community_tag.id not in assoc_tags
      assert community_tag2.id in assoc_tags
    end
  end
end
