defmodule GroupherServer.Test.Mutation.ArticleCommunity.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  describe "[Doc Community boundary]" do
    test "Doc rejects ordinary Article move and mirror commands" do
      {community, doc, _, user} = mock_article(:doc)
      {:ok, destination} = mock_community(user)
      article = Repo.get!(CMS.Model.Article, doc.id)

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.Communities.move(article, destination)

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.Communities.mirror(article, destination)

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.Communities.unmirror(article, destination)

      assert article.community_id == community.id
    end
  end
end
