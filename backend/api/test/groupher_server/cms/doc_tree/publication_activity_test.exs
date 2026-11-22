defmodule GroupherServer.Test.CMS.DocTree.PublicationActivityTest do
  use GroupherServer.TestMate, async: false

  import Ecto.Query
  alias GroupherServer.{CMS, Repo, Activity}
  alias Activity.Model.DocLog
  alias CMS.Model.ArticlePublic

  test "each Docs publication records the selected Snapshot and stable Article identity" do
    {community, doc, _attrs, user} = mock_article(:doc)
    first = Repo.get!(ArticlePublic, doc.id)
    actor = %{user | cur_passport: %{"global" => %{"god" => true}}}
    command_id = Ecto.UUID.generate()

    assert {:ok, _} =
             CMS.Seeds.Docs.update(
               community,
               doc.id,
               %{title: "A later published title"},
               actor,
               command_id
             )

    second = Repo.get!(ArticlePublic, doc.id)
    refute first.snapshot_id == second.snapshot_id

    logs =
      Repo.all(from(log in DocLog, where: log.article_id == ^doc.id and log.action == :published))

    assert length(logs) == 2

    assert MapSet.new(logs, & &1.metadata["snapshot_id"]) ==
             MapSet.new([first.snapshot_id, second.snapshot_id])

    assert Enum.all?(logs, &is_binary(&1.operation_ref))
    refute Enum.any?(logs, &(&1.operation_ref == command_id))
    refute Enum.any?(logs, &Map.has_key?(&1.metadata, "revision_id"))
  end
end
