defmodule GroupherServer.Test.CMS.Communities.Count.CommunityTag do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    community_tag_attrs = mock_attrs(:community_tag)

    {:ok, ~m(user community community_tag_attrs)a}
  end

  describe "[cms community community_tag]" do
    test "communityTagsCount should work", ~m(community community_tag_attrs user)a do
      {:ok, tag} = CMS.Communities.create_tag(community, :post, community_tag_attrs, user)
      {:ok, tag2} = CMS.Communities.create_tag(community, :changelog, community_tag_attrs, user)
      {:ok, tag3} = CMS.Communities.create_tag(community, :blog, community_tag_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.community_tags_count == 3

      {:ok, _} = CMS.Communities.delete_tag(tag.id)
      {:ok, _} = CMS.Communities.delete_tag(tag2.id)
      {:ok, _} = CMS.Communities.delete_tag(tag3.id)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.community_tags_count == 0
    end
  end
end
