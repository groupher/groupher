defmodule GroupherServer.Test.CMS.Communities.Count.ArticleTag do
  @moduledoc false
  use GroupherServer.TestTools

  setup do
    {:ok, user} = db_insert(:user)
    {:ok, community} = mock_community(user)
    article_tag_attrs = mock_attrs(:article_tag)
    
    {:ok, ~m(user community article_tag_attrs)a}
  end

  describe "[cms community article_tag]" do
    test "articleTagsCount should work", ~m(community article_tag_attrs user)a do
      {:ok, tag} = CMS.create_article_tag(community, :post, article_tag_attrs, user)
      {:ok, tag2} = CMS.create_article_tag(community, :changelog, article_tag_attrs, user)
      {:ok, tag3} = CMS.create_article_tag(community, :blog, article_tag_attrs, user)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.article_tags_count == 3

      {:ok, _} = CMS.delete_article_tag(tag.id)
      {:ok, _} = CMS.delete_article_tag(tag2.id)
      {:ok, _} = CMS.delete_article_tag(tag3.id)

      {:ok, community} = ORM.find(Community, community.id)
      assert community.article_tags_count == 0
    end
  end
end
