defmodule GroupherServer.Test.Mutation.CommunityTags.DocSetTag do
  @moduledoc false

  use GroupherServer.TestTools

  setup do
    {community, doc, _, user} = mock_article(:doc)

    guest_conn = simu_conn(:guest)
    user_conn = simu_conn(:user)
    owner_conn = simu_conn(:owner, doc)

    community_tag_attrs = mock_attrs(:community_tag)
    community_tag_attrs2 = mock_attrs(:community_tag)

    {:ok,
     ~m(user_conn guest_conn owner_conn community doc community_tag_attrs community_tag_attrs2 user)a}
  end

  describe "[mutation doc tag]" do
    test "auth user can set a valid tag to doc",
         ~m(community doc community_tag_attrs user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      passport_rules = %{community.title => %{"doc.community_tag.set" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}, communityTagId: community_tag.id}

      rule_conn |> gq_mutation(Schema.m(:set_community_tag), variables)
      {:ok, found} = ORM.find(Doc, doc.id, preload: :community_tags)

      assoc_tags = found.community_tags |> Enum.map(& &1.id)
      assert community_tag.id in assoc_tags
    end

    test "can unset tag to a doc",
         ~m(community doc community_tag_attrs community_tag_attrs2 user)a do
      {:ok, community_tag} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs, user)

      {:ok, community_tag2} =
        CMS.Communities.create_tag(community, :doc, community_tag_attrs2, user)

      {:ok, _} = CMS.Communities.set_tag(doc, community_tag.id)
      {:ok, _} = CMS.Communities.set_tag(doc, community_tag2.id)

      passport_rules = %{community.title => %{"doc.community_tag.unset" => true}}
      rule_conn = simu_conn(:user, cms: passport_rules)

      variables = %{article: %{inner_id: doc.inner_id, community: community.slug, thread: "DOC"}, communityTagId: community_tag.id}

      rule_conn |> gq_mutation(Schema.m(:unset_community_tag), variables)

      {:ok, doc} = ORM.find(Doc, doc.id, preload: :community_tags)
      assoc_tags = doc.community_tags |> Enum.map(& &1.id)

      assert community_tag.id not in assoc_tags
      assert community_tag2.id in assoc_tags
    end
  end
end
