defmodule GroupherServer.Test.CMS.Articles.Commands.DeleteWorkingCopyPipeline do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  test "deletes the selected WorkingCopy without a revision precondition" do
    {community, public, _attrs, user} = mock_article(:post)
    article = Repo.get!(CMS.Model.Article, public.article_id)
    working_copy = Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id)

    assert {:ok, %CMS.Model.Article{}} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               working_copy.id,
               user,
               Ecto.UUID.generate()
             )

    refute Repo.get(CMS.Model.ArticleWorkingCopy, working_copy.id)
  end
end
