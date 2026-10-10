defmodule GroupherServer.Test.Mutation.ArticleBinding.Blog do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Passport.ErrorCat, as: PassportErrorCat

  setup do
    {community, blog, _, user} = mock_article(:blog)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, blog)

    {:ok, ~m(user_conn guest_conn owner_conn community community2 community3 blog user)a}
  end

  describe "[mirror/unmirror/move blog to/from community]" do
    test "auth user can mirror a blog to other community",
         ~m(community community2 blog user)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)
      found = %{communities: binding_communities(blog)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a blog to a community",
         ~m(user_conn guest_conn community community2 blog user)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
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

    test "auth user can mirror multi blog to other communities",
         ~m(community community2 community3 blog user)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      found = %{communities: binding_communities(blog)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror blog to a community",
         ~m(community community2 community3 blog user)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables2 = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables2)

      found = %{communities: binding_communities(blog)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities

      passport_rules = %{"blog.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(S.Article.m(:unmirror_article), variables)
      found = %{communities: binding_communities(blog)}
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can move blog to other community", ~m(community community2 blog user)a do
      passport_rules = %{"blog.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      found = Repo.get!(CMS.Model.Article, blog.id)
      assoc_communities = binding_communities(found) |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"blog.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_community_id = community.id

      article_tag_attrs = mock_attrs(:community_tag)

      {:ok, article_tag} =
        CMS.Communities.create_tag(
          community2,
          :blog,
          article_tag_attrs,
          user,
          Ecto.UUID.generate()
        )

      variables = %{
        article: %{
          inner_id: article_inner_id(blog, community),
          community: community.slug,
          thread: "BLOG"
        },
        targetCommunity: community2.slug,
        communityTags: [article_tag.id]
      }

      rule_conn |> gq_mutation(S.Article.m(:move_article), variables)

      found = Repo.get!(CMS.Model.Article, blog.id)
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
