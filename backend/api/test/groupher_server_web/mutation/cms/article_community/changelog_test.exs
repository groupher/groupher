defmodule GroupherServer.Test.Mutation.ArticleBinding.Changelog do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Passport.ErrorCat, as: PassportErrorCat

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    {:ok, ~m(user_conn guest_conn owner_conn community community2 community3 changelog user)a}
  end

  describe "[mirror/unmirror/move changelog to/from community]" do
    test "auth user can mirror a changelog to other community",
         ~m(community community2 changelog user)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)
      assoc_communities = binding_communities(changelog) |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a changelog to a community",
         ~m(user_conn guest_conn community community2 changelog user)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(
               S.Article.m(:mirror_article),
               variables,
               ErrorCat.code(PassportErrorCat.passport())
             )

      assert guest_conn
             |> mutation_error?(
               S.Article.m(:mirror_article),
               variables,
               ErrorCat.code(ProfileErrorCat.account_login())
             )

      assert rule_conn
             |> mutation_error?(
               S.Article.m(:mirror_article),
               variables,
               ErrorCat.code(PassportErrorCat.passport())
             )
    end

    test "auth user can mirror multi changelog to other communities",
         ~m(community community2 community3 changelog user)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      assoc_communities = binding_communities(changelog) |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror changelog to a community",
         ~m(community community2 community3 changelog user)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables2 = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables2)

      assoc_communities = binding_communities(changelog) |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities

      passport_rules = %{"changelog.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(S.Article.m(:unmirror_article), variables)
      assoc_communities = binding_communities(changelog) |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can move changelog to other community",
         ~m(community community2 changelog user)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      found = Repo.get!(CMS.Model.Article, changelog.id)
      assoc_communities = binding_communities(found) |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"changelog.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_community_id = community.id

      article_tag_attrs = mock_attrs(:community_tag)
      {:ok, user} = db_insert(:user)

      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community2,
          :changelog,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      variables = %{
        article: %{
          inner_id: article_inner_id(changelog, community),
          community: community.slug,
          thread: "CHANGELOG"
        },
        targetCommunity: community2.slug,
        communityTags: [article_tag.id]
      }

      rule_conn |> gq_mutation(S.Article.m(:move_article), variables)

      found = Repo.get!(CMS.Model.Article, changelog.id)
      assoc_communities = binding_communities(found) |> Enum.map(& &1.id)
      {:ok, tags} = binding_tags(found, community2)
      assoc_article_tags = Enum.map(tags, & &1.id)

      assert pre_community_id not in assoc_communities
      assert community2.id in assoc_communities
      assert community2.id in assoc_communities

      assert article_tag.id in assoc_article_tags

      assert community2.id in assoc_communities
    end
  end
end
