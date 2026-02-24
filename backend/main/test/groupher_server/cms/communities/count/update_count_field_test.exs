defmodule GroupherServer.Test.CMS.Communities.Count.UpdateCountField do
  @moduledoc false
  use GroupherServer.TestTools

  alias CMS.Model.Community

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)

    {:ok, ~m(user community)a}
  end

  describe "[update_count_field]" do
    test "update community_tags_count field", ~m(community user)a do
      community_tag_attrs = mock_attrs(:community_tag)

      {:ok, _tag} = CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      {:ok, updated_community} =
        CMS.Communities.update_count_field(community, :community_tags_count)

      assert updated_community.community_tags_count == 1

      {:ok, _tag2} = CMS.Communities.create_tag(community, :post, community_tag_attrs, user)

      {:ok, updated_community} =
        CMS.Communities.update_count_field(community, :community_tags_count)

      assert updated_community.community_tags_count == 2
    end

    test "update article count field for thread", ~m(community user)a do
      post_attrs = mock_attrs(:post, %{community_id: community.id})
      {:ok, _post} = CMS.Articles.create(community, :post, post_attrs, user)

      {:ok, updated_community} = CMS.Communities.update_count_field(community, :post)
      {:ok, updated_community} = ORM.find(Community, updated_community.id)

      assert updated_community.articles_count >= 1
    end

    test "update count field for list of communities", ~m(user)a do
      {:ok, community1} = mock_community(user)
      {:ok, community2} = mock_community(user)

      {:ok, :pass} = CMS.Communities.update_count_field([community1, community2], :post)
    end
  end
end
