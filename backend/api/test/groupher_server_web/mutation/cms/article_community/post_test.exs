defmodule GroupherServer.Test.Mutation.ArticleBinding.Post do
  @moduledoc false

  use GroupherServer.TestMate

  alias Accounts.Profiles.ErrorCat, as: ProfileErrorCat
  alias CMS.Passport.ErrorCat, as: PassportErrorCat

  setup do
    {community, post, _, user} = mock_article(:post)

    {:ok, community2} = mock_community(user)
    {:ok, community3} = mock_community(user)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, post)

    {:ok, ~m(user_conn guest_conn owner_conn community community2 community3 post user)a}
  end

  describe "[mirror/unmirror/move post to/from community]" do
    test "auth user can mirror a post to other community", ~m(community post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community2} = mock_community()

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)
      found = %{communities: binding_communities(post)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a post to a community",
         ~m(user_conn guest_conn community community2 post)a do
      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
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

    test "auth user can mirror multi post to other communities",
         ~m(community community2 community3 post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      found = %{communities: binding_communities(post)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    test "auth user can unmirror post to a community", ~m(post community)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, user} = db_insert(:user)
      community2_attrs = mock_attrs(:community)
      community3_attrs = mock_attrs(:community)
      {:ok, community2} = CMS.Communities.create(community2_attrs, user, Ecto.UUID.generate())
      {:ok, community3} = CMS.Communities.create(community3_attrs, user, Ecto.UUID.generate())

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)

      variables2 = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community3.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables2)

      found = %{communities: binding_communities(post)}

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id in assoc_communities
      assert community3.id in assoc_communities

      passport_rules = %{"post.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> gq_mutation(S.Article.m(:unmirror_article), variables)
      found = %{communities: binding_communities(post)}
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community2.id not in assoc_communities
      assert community3.id in assoc_communities
    end

    test "auth user can move post to other community", ~m(community community2 post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community2.slug
      }

      rule_conn |> gq_mutation(S.Article.m(:mirror_article), variables)
      found = Repo.get!(CMS.Model.Article, post.id)
      assoc_communities = binding_communities(found) |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"post.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_community_id = community.id

      article_tag_attrs = mock_attrs(:community_tag)
      {:ok, user} = db_insert(:user)
      {:ok, article_tag} = CMS.Communities.create_tag(community2, :post, article_tag_attrs, user)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "POST"
        },
        targetCommunity: community2.slug,
        communityTags: [article_tag.id]
      }

      rule_conn |> gq_mutation(S.Article.m(:move_article), variables)

      found = Repo.get!(CMS.Model.Article, post.id)

      assoc_communities = binding_communities(found) |> Enum.map(& &1.id)
      {:ok, tags} = binding_tags(found, community2)
      assoc_article_tags = Enum.map(tags, & &1.id)

      assert pre_community_id not in assoc_communities
      assert community2.id in assoc_communities
      assert pre_community_id == community.id

      assert article_tag.id in assoc_article_tags

      assert pre_community_id == community.id
    end

    test "mirror article with invalid thread is rejected without crash",
         ~m(community community2 post)a do
      passport_rules = %{"post.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{
        article: %{
          inner_id: article_inner_id(post, community),
          community: community.slug,
          thread: "NOT_EXIST_THREAD"
        },
        targetCommunity: community2.slug
      }

      assert rule_conn
             |> mutation_error?(S.Article.m(:mirror_article), variables)
    end
  end
end
