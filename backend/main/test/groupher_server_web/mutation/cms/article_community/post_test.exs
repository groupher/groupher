defmodule GroupherServer.Test.Mutation.ArticleCommunity.Post do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    {:ok,
     ~m(user_conn guest_conn owner_conn community community2 community3 blackhole post user)a}
  end

  describe "[mirror/unmirror/move post to/from community]" do
    test "auth user can mirror a post to other community", ~m(community post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community2} = mock_community()

      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)
      {:ok, found} = ORM.find(Post, post.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a post to a community",
         ~m(user_conn guest_conn community community2 post)a do
      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:passport))

      assert guest_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:account_login))

      assert rule_conn
             |> mutation_error?(Schema.m(:mirror_article), variables, ecode(:passport))
    end

    test "auth user can mirror multi post to other communities",
         ~m(community community2 community3 post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      {:ok, found} = ORM.find(Post, post.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror post to a community", ~m(post community)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community2} = db_insert(:community)
      {:ok, community3} = db_insert(:community)

      variables = %{
        id: post.inner_id,
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables2 = %{
        id: post.inner_id,
        community: community.slug,
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables2)

      {:ok, found} = ORM.find(Post, post.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id in assoc_communities
      assert community3.id in assoc_communities

      passport_rules = %{"post.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:unmirror_article), variables)
      {:ok, found} = ORM.find(Post, post.id, preload: :communities)
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can mirror post home", ~m(community post user)a do
      {:ok, home_community} = mock_community(user, %{slug: "home"})

      variables = %{id: post.inner_id, community: community.slug, thread: "POST"}

      passport_rules = %{"homemirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mirror_to_home), variables)

      {:ok, post} = ORM.find(Post, post.id, preload: [:communities, :article_tags])

      assert exist_in?(home_community, post.communities)
    end

    test "auth user can move post to blackhole", ~m(community blackhole post)a do
      variables = %{id: post.inner_id, thread: "POST", community: community.slug}

      passport_rules = %{"blackeye" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:move_to_blackhole), variables)

      {:ok, post} =
        ORM.find(Post, post.id, preload: [:original_community, :communities, :article_tags])

      assert post.original_community.id == blackhole.id
    end

    test "auth user can move post to other community", ~m(community community2 post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)
      {:ok, found} = ORM.find(Post, post.id, preload: [:original_community, :communities])
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"post.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_original_community_id = found.original_community.id

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, user} = db_insert(:user)
      {:ok, article_tag} = CMS.create_article_tag(community2, :post, article_tag_attrs, user)

      variables = %{
        id: post.inner_id,
        thread: "POST",
        community: community.slug,
        targetCommunity: community2.slug,
        articleTags: [article_tag.id]
      }

      rule_conn |> gq_mutation(Schema.m(:move_article), variables)

      {:ok, found} =
        ORM.find(Post, post.id, preload: [:original_community, :communities, :article_tags])

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assoc_article_tags = found.article_tags |> Enum.map(& &1.id)

      assert pre_original_community_id not in assoc_communities
      assert community2.id in assoc_communities
      assert community2.id == found.original_community_id

      assert article_tag.id in assoc_article_tags

      assert found.original_community.id == community2.id
    end
  end
end
