defmodule GroupherServer.Test.Mutation.ArticleCommunity.Doc do
  use GroupherServer.TestTools

  alias Helper.ORM
  alias GroupherServer.CMS
  alias CMS.Model.Doc

  setup do
    {:ok, doc} = db_insert(:doc)
    {:ok, community} = db_insert(:community)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, doc)

    {:ok, ~m(user_conn guest_conn owner_conn community doc)a}
  end

  describe "[mirror/unmirror/move doc to/from community]" do
    @mirror_article_query """
    mutation($id: ID!, $thread: Thread, $communityId: ID!) {
      mirrorArticle(id: $id, thread: $thread, communityId: $communityId) {
        id
      }
    }
    """

    test "auth user can mirror a doc to other community", ~m(doc)a do
      passport_rules = %{"doc.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community} = db_insert(:community)
      variables = %{id: doc.id, thread: "DOC", communityId: community.id}
      rule_conn |> mutation_result(@mirror_article_query, variables, "mirrorArticle")
      {:ok, found} = ORM.find(Doc, doc.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
    end

    test "unauth user cannot mirror a doc to a community",
         ~m(user_conn guest_conn doc)a do
      {:ok, community} = db_insert(:community)
      variables = %{id: doc.id, thread: "DOC", communityId: community.id}
      rule_conn = simu_conn(:user, cms: %{"what.ever" => true})

      assert user_conn
             |> mutation_get_error?(@mirror_article_query, variables, ecode(:passport))

      assert guest_conn
             |> mutation_get_error?(@mirror_article_query, variables, ecode(:account_login))

      assert rule_conn
             |> mutation_get_error?(@mirror_article_query, variables, ecode(:passport))
    end

    test "auth user can mirror multi doc to other communities", ~m(doc)a do
      passport_rules = %{"doc.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community} = db_insert(:community)
      {:ok, community2} = db_insert(:community)

      variables = %{id: doc.id, thread: "DOC", communityId: community.id}
      rule_conn |> mutation_result(@mirror_article_query, variables, "mirrorArticle")

      variables = %{id: doc.id, thread: "DOC", communityId: community2.id}
      rule_conn |> mutation_result(@mirror_article_query, variables, "mirrorArticle")

      {:ok, found} = ORM.find(Doc, doc.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities
    end

    @unmirror_article_query """
    mutation($id: ID!, $thread: Thread, $communityId: ID!) {
      unmirrorArticle(id: $id, thread: $thread, communityId: $communityId) {
        id
      }
    }
    """

    test "auth user can unmirror doc to a community", ~m(doc)a do
      passport_rules = %{"doc.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community} = db_insert(:community)
      {:ok, community2} = db_insert(:community)

      variables = %{id: doc.id, thread: "DOC", communityId: community.id}
      rule_conn |> mutation_result(@mirror_article_query, variables, "mirrorArticle")

      variables2 = %{id: doc.id, thread: "DOC", communityId: community2.id}
      rule_conn |> mutation_result(@mirror_article_query, variables2, "mirrorArticle")

      {:ok, found} = ORM.find(Doc, doc.id, preload: :communities)

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities
      assert community2.id in assoc_communities

      passport_rules = %{"doc.community.unmirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> mutation_result(@unmirror_article_query, variables, "unmirrorArticle")
      {:ok, found} = ORM.find(Doc, doc.id, preload: :communities)
      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id not in assoc_communities
      assert community2.id in assoc_communities
    end

    @mirror_to_home """
    mutation($id: ID!, $thread: Thread, $articleTags: [ID]) {
      mirrorToHome(id: $id, thread: $thread, articleTags: $articleTags) {
        id
      }
    }
    """

    test "auth user can mirror doc home", ~m(doc)a do
      {:ok, home_community} = db_insert(:community, %{slug: "home"})

      variables = %{id: doc.id, thread: "DOC"}

      passport_rules = %{"homemirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> mutation_result(@mirror_to_home, variables, "mirrorToHome")

      {:ok, doc} = ORM.find(Doc, doc.id, preload: [:communities, :article_tags])

      assert exist_in?(home_community, doc.communities)
    end

    @move_to_blackhole """
    mutation($id: ID!, $thread: Thread, $articleTags: [ID]) {
      moveToBlackhole(id: $id, thread: $thread, articleTags: $articleTags) {
        id
      }
    }
    """

    test "auth user can move doc to blackhole", ~m(doc)a do
      {:ok, blackhole_community} = db_insert(:community, %{slug: "blackhole"})

      variables = %{id: doc.id, thread: "DOC"}

      passport_rules = %{"blackeye" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      rule_conn |> mutation_result(@move_to_blackhole, variables, "moveToBlackhole")

      {:ok, doc} =
        ORM.find(Doc, doc.id, preload: [:original_community, :communities, :article_tags])

      assert doc.original_community.id == blackhole_community.id
    end

    @move_article_query """
    mutation($id: ID!, $thread: Thread, $communityId: ID!, $articleTags: [ID]) {
      moveArticle(id: $id, thread: $thread, communityId: $communityId, articleTags: $articleTags) {
        id
      }
    }
    """

    test "auth user can move doc to other community", ~m(doc)a do
      passport_rules = %{"doc.community.mirror" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      {:ok, community} = db_insert(:community)
      {:ok, community2} = db_insert(:community)

      variables = %{id: doc.id, thread: "DOC", communityId: community.id}
      rule_conn |> mutation_result(@mirror_article_query, variables, "mirrorArticle")

      {:ok, found} = ORM.find(Doc, doc.id, preload: [:original_community, :communities])

      assoc_communities = found.communities |> Enum.map(& &1.id)
      assert community.id in assoc_communities

      passport_rules = %{"doc.community.move" => true}
      rule_conn = simu_conn(:user, cms: passport_rules)

      pre_original_community_id = found.original_community.id

      article_tag_attrs = mock_attrs(:article_tag)
      {:ok, user} = db_insert(:user)
      {:ok, article_tag} = CMS.create_article_tag(community2, :doc, article_tag_attrs, user)

      variables = %{
        id: doc.id,
        thread: "DOC",
        communityId: community2.id,
        articleTags: [article_tag.id]
      }

      rule_conn |> mutation_result(@move_article_query, variables, "moveArticle")

      {:ok, found} =
        ORM.find(Doc, doc.id, preload: [:original_community, :communities, :article_tags])

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
