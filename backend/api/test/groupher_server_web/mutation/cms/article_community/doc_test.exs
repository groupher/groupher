defmodule GroupherServer.Test.Mutation.ArticleBinding.Doc do
  @moduledoc false

  use GroupherServer.TestMate

  describe "[Doc Community boundary]" do
    test "Doc rejects ordinary Article move and mirror commands" do
      {community, doc, _, user} = mock_article(:doc)
      {:ok, destination} = mock_community(user)

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.move(
                 community,
                 destination,
                 doc.id,
                 [],
                 user,
                 Ecto.UUID.generate()
               )

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.mirror(
                 destination,
                 doc.id,
                 [],
                 user,
                 community,
                 Ecto.UUID.generate()
               )

      assert {:error, :unsupported_for_doc} =
               CMS.Articles.unmirror(destination, doc.id, user, Ecto.UUID.generate())

      assert community.id == community.id
    end
  end
end
