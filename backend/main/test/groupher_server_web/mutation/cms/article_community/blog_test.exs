defmodule GroupherServer.Test.Mutation.ArticleCommunity.Blog do
  @moduleblog false

  use GroupherServer.TestTools

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    {:ok, blackhole} = mock_community(user, %{slug: "blackhole"})

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, blog)

    {:ok,
     ~m(user_conn guest_conn owner_conn community community2 community3 blackhole blog user)a}
  end

  describe "[mirror/unmirror/move blog to/from community]" do
    test "auth user can mirror a blog to other community",
         ~m(community community2 blog)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)
      {:ok, found} = ORM.find(Blog, blog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a blog to a community",
         ~m(user_conn guest_conn community community2 blog)a do
      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
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

    test "auth user can mirror multi blog to other communities",
         ~m(community community2 community3 blog)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      {:ok, found} = ORM.find(Blog, blog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror blog to a community",
         ~m(community community2 community3 blog)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      variables2 = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables2)

      {:ok, found} = ORM.find(Blog, blog.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities

      passport_rules = %{"blog.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:unmirror_article), variables)
      {:ok, found} = ORM.find(Blog, blog.id, preload: :communities)
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can mirror blog home", ~m(user community blog)a do
      {:ok, home_community} = mock_community(user, %{slug: "home"})

      variables = %{id: blog.inner_id, community: community.slug, thread: "BLOG"}

      passport_rules = %{"homemirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:mirror_to_home), variables)

      {:ok, blog} = ORM.find(Blog, blog.id, preload: [:communities, :article_tags])

      assert exist_in?(home_community, blog.communities)
    end

    test "auth user can move blog to blackhole", ~m(community blackhole blog)a do
      variables = %{id: blog.inner_id, thread: "BLOG", community: community.slug}

      passport_rules = %{"blackeye" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(Schema.m(:move_to_blackhole), variables)

      {:ok, blog} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

      assert blog.original_community.id == blackhole.id
    end

    test "auth user can move blog to other community", ~m(community community2 blog)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(Schema.m(:mirror_article), variables)

      {:ok, found} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities])

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"blog.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_original_community_id = found.original_community.id

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, user} = db_insert(:user)
      {:ok, article_tag} = CMS.create_article_tag(community2, :blog, article_tag_attrs, user)

      variables = %{
        id: blog.inner_id,
        thread: "BLOG",
        community: community.slug,
        targetCommunity: community2.slug,
        articleTags: [article_tag.id]
      }

      rule_conn |> gq_mutation(Schema.m(:move_article), variables)

      {:ok, found} =
        ORM.find(Blog, blog.id, preload: [:original_community, :communities, :article_tags])

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
