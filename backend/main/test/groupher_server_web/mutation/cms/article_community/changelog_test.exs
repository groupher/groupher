defmodule GroupherServer.Test.Mutation.ArticleCommunity.Changelog do
  @moduledoc false

  use GroupherServer.TestMate

  setup do
    {community, changelog, _, user} = mock_article(:changelog)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, changelog)

    {:ok,
     ~m(user_conn guest_conn owner_conn community community2 community3 blackhole changelog user)a}
  end

  describe "[mirror/unmirror/move changelog to/from community]" do
    test "auth user can mirror a changelog to other community",
         ~m(community community2 changelog)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug}

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)
      {:ok, found} = ORM.find(Changelog, changelog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a changelog to a community",
         ~m(user_conn guest_conn community community2 changelog)a do
      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug}

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:account_login))

      assert rule_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:passport))
    end

    test "auth user can mirror multi changelog to other communities",
         ~m(community community2 community3 changelog)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug}

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community3.slug}

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      {:ok, found} = ORM.find(Changelog, changelog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror changelog to a community",
         ~m(community community2 community3 changelog)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug}

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables2 = %{
        article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"},
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables2)

      {:ok, found} = ORM.find(Changelog, changelog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities

      passport_rules = %{"changelog.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:unmirror_article), variables)
      {:ok, found} = ORM.find(Changelog, changelog.id, preload: :communities)
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can mirror changelog home", ~m(user community changelog)a do
      {:ok, home_community} = mock_community(user, %{slug: "home"})

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}}

      passport_rules = %{"homemirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mirror_to_home), variables)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id, preload: [:communities, :community_tags])

      assert exist_in?(home_community, changelog.communities)
    end

    test "auth user can move changelog to blackhole", ~m(community blackhole changelog)a do
      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}}

      passport_rules = %{"blackeye" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:move_to_blackhole), variables)

      {:ok, changelog} =
        ORM.find(Changelog, changelog.id, preload: [:community, :communities, :community_tags])

      assert changelog.community.id == blackhole.id
    end

    test "auth user can move changelog to other community",
         ~m(community community2 changelog)a do
      passport_rules = %{"changelog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug}

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      {:ok, found} =
        ORM.find(Changelog, changelog.id, preload: [:community, :communities])

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"changelog.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_community_id = found.community.id

      article_tag_attrs = mock_attrs(:community_tag)
      {:ok, user} = db_insert(:user)

      {:ok, article_tag} =
        CMS.Communities.create_tag(community2, :changelog, article_tag_attrs, user)

      variables = %{article: %{inner_id: changelog.inner_id, community: community.slug, thread: "CHANGELOG"}, targetCommunity: community2.slug, communityTags: [article_tag.id]}

      rule_conn |> gq_mutation(Schema.m(:move_article), variables)

      {:ok, found} =
        ORM.find(Changelog, changelog.id, preload: [:community, :communities, :community_tags])

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assoc_article_tags = found.community_tags |> Enum.map(& &1.id)

      assert pre_community_id not in assoc_communities
      assert community2.id in assoc_communities
      assert community2.id == found.community_id

      assert article_tag.id in assoc_article_tags

      assert found.community.id == community2.id
    end
  end
end
