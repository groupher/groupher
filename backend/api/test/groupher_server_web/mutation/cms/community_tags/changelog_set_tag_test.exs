defmodule GroupherServer.Test.Mutation.CommunityTags.ChangelogSetTag do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    community_tag_attrs = mock_attrs(:community_tag)
    community_tag_attrs2 = mock_attrs(:community_tag)

    {:ok,
     ~m(user_conn guest_conn owner_conn community changelog community_tag_attrs community_tag_attrs2 user)a}
  end

  describe "[mutation changelog tag]" do
    test "auth user can set a valid tag to changelog",
         ~m(community changelog community_tag_attrs user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      passport_rules = %{
        community.title => %{
          "community.update" => true,
          "changelog.community_tag.set" => true
        }
      }

      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        communityTagId: community_tag.id
      }

      rule_conn |> gq_mutation(S.Article.m(:set_community_tag), variables)
      {:ok, tags} = binding_tags(changelog, community)
      assoc_tags = Enum.map(tags, & &1.id)
      assert community_tag.id in assoc_tags
    end

    test "can unset tag to a changelog",
         ~m(community changelog community_tag_attrs community_tag_attrs2 user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      {:ok, community_tag2} =
        CMS.Communities.create_tag(
          community,
          :changelog,
          community_tag_attrs2,
          user,
          Ecto.UUID.generate()
        )

      {:ok, _} = CMS.Communities.set_tag(changelog, community_tag.id, user, Ecto.UUID.generate())
      {:ok, _} = CMS.Communities.set_tag(changelog, community_tag2.id, user, Ecto.UUID.generate())

      passport_rules = %{
        community.title => %{
          "community.update" => true,
          "changelog.community_tag.unset" => true
        }
      }

      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        communityTagId: community_tag.id
      }

      rule_conn |> gq_mutation(S.Article.m(:unset_community_tag), variables)

      {:ok, tags} = binding_tags(changelog, community)
      assoc_tags = Enum.map(tags, & &1.id)

      assert community_tag.id not in assoc_tags
      assert community_tag2.id in assoc_tags
    end
  end
end
