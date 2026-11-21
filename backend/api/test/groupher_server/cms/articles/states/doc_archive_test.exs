defmodule GroupherServer.Test.CMS.DocArchive do
  use GroupherServer.TestMate, async: false
  alias GroupherServer.CMS
  alias CMS.Model.{ArticlePublic, ArticleLifecycle}

  test "archive retains Public and Snapshot and rejects further editing" do
    {community, doc, _, user} = mock_article(:doc)
    public = Repo.get!(ArticlePublic, doc.id)
    public |> Ecto.Changeset.change(inserted_at: @last_year) |> Repo.update!()
    assert {:ok, count} = CMS.Articles.Maintenance.archive(:doc)
    assert count >= 1
    assert Repo.get_by!(ArticleLifecycle, article_id: doc.id).state == :archived
    assert Repo.get!(ArticlePublic, doc.id).snapshot_id == public.snapshot_id

    assert {:ok, _} =
             CMS.FrontDesk.article(%{
               community: community.slug,
               thread: :doc,
               inner_id: doc.inner_id
             })

    actor = %{user | cur_passport: %{"global" => %{"god" => true}}}

    assert {:error, _} =
             CMS.DocTree.Commands.BeginEdit.execute(
               community,
               doc.id,
               public.snapshot_id,
               actor,
               Ecto.UUID.generate()
             )
  end
end
