defmodule GroupherServer.Test.CMS.Articles.Commands.DeleteWorkingCopyPipeline do
  use GroupherServer.TestMate, async: false

  alias GroupherServer.CMS

  test "deletes the selected WorkingCopy without a revision precondition" do
    {community, public, _attrs, user} = GroupherServer.Test.ArticleContentFixture.article(:post)
    article = Repo.get!(CMS.Model.Article, public.id)
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

  test "Receipt replay returns the result to the Article owner" do
    {community, public, _attrs, owner} =
      GroupherServer.Test.ArticleContentFixture.article(:post)

    article = Repo.get!(CMS.Model.Article, public.id)
    working_copy = Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id)
    command_id = Ecto.UUID.generate()

    assert {:ok, %CMS.Model.Article{}} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               working_copy.id,
               owner,
               command_id
             )

    assert {:ok, %CMS.Model.Article{}} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               working_copy.id,
               owner,
               command_id
             )

    refute Repo.get(CMS.Model.ArticleWorkingCopy, working_copy.id)
  end

  test "an external RESTRICT reference returns work_in_use and rolls child deletion back" do
    {community, public, _attrs, user} = GroupherServer.Test.ArticleContentFixture.article(:post)
    article = Repo.get!(CMS.Model.Article, public.id)
    working_copy = Repo.get_by!(CMS.Model.ArticleWorkingCopy, article_id: article.id)
    extension = Repo.get_by!(CMS.Model.ArticleWorkingCopyPost, working_copy_id: working_copy.id)

    Repo.query!(
      "CREATE TABLE cms.article_working_copy_restrict_test (working_copy_id uuid NOT NULL REFERENCES cms.article_working_copies(id) ON DELETE RESTRICT)"
    )

    Repo.query!(
      "INSERT INTO cms.article_working_copy_restrict_test (working_copy_id) VALUES ($1)",
      [Ecto.UUID.dump!(working_copy.id)]
    )

    assert {:error, error} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               working_copy.id,
               user,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(error) == 4563
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, working_copy.id)

    assert Repo.get_by!(CMS.Model.ArticleWorkingCopyPost,
             working_copy_id: extension.working_copy_id
           )

    assert %{rows: [[1]]} =
             Repo.query!("SELECT count(*) FROM cms.article_working_copy_restrict_test")

    Repo.query!("DELETE FROM cms.article_working_copy_restrict_test")

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

  test "the last unpublished WorkingCopy cannot be deleted" do
    {:ok, user} = db_insert(:user)
    {:ok, community} = GroupherServer.Test.ArticleContentFixture.community(user)

    assert {:ok, %{article: article, working_copy: working_copy}} =
             CMS.Articles.create_article(
               community,
               :post,
               %{title: "Unpublished"},
               user,
               command_id: Ecto.UUID.generate()
             )

    assert {:error, error} =
             CMS.Articles.delete_working_copy(
               article,
               community,
               working_copy.id,
               user,
               Ecto.UUID.generate()
             )

    assert CMS.ErrorCat.code(error) == 4562
    assert Repo.get!(CMS.Model.ArticleWorkingCopy, working_copy.id)
    refute Repo.get(CMS.Model.ArticlePublic, article.id)
  end
end
