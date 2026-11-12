defmodule GroupherServer.Test.CMS.DocMeta do
  use GroupherServer.TestMate, async: false

  test "published edits and comment locks belong to the stable Article" do
    {community, doc, _, user} = mock_article(:doc)
    article = Repo.get!(CMS.Model.Article, doc.id)
    refute article.is_edited
    refute article.comments_locked
    actor = %{user | cur_passport: %{"global" => %{"god" => true}}}

    assert {:ok, _} =
             CMS.Seeds.Docs.update(
               community,
               doc.id,
               %{title: "New title"},
               actor,
               Ecto.UUID.generate()
             )

    assert Repo.get!(CMS.Model.Article, doc.id).is_edited
    assert {:ok, _} = CMS.Articles.lock_comments(doc.id, user, community: community)
    assert Repo.get!(CMS.Model.Article, doc.id).comments_locked
    assert {:ok, _} = CMS.Articles.undo_lock_comments(doc.id, user, community: community)
    refute Repo.get!(CMS.Model.Article, doc.id).comments_locked
  end
end
