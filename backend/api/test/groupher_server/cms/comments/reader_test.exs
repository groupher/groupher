defmodule GroupherServer.Test.CMS.Comments.Reader do
  @moduledoc false

  use GroupherServer.TestMate

  alias GroupherServer.CMS

  test "reconcile rejects non-canonical numeric inner ids" do
    {_community, post, _attrs, _user} = mock_article(:post)

    assert {:error, %ErrorCat.Error{reason: :not_exist}} =
             CMS.Comments.reconcile_comments(:post, post, ["001"], nil)
  end
end
