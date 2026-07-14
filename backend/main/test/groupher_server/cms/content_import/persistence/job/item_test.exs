defmodule GroupherServer.CMS.ContentImport.Persistence.Job.ItemTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.ContentImport.Persistence.Job.Item

  test "accepts only resolutions valid for the item action" do
    conflict = item(:conflict)
    assert Item.resolution_changeset(conflict, :source_wins).valid?
    refute Item.resolution_changeset(conflict, :archive).valid?

    deleted = item(:source_deleted)
    assert Item.resolution_changeset(deleted, :keep).valid?
    assert Item.resolution_changeset(deleted, :unlink).valid?
    refute Item.resolution_changeset(deleted, :source_wins).valid?
  end

  defp item(action) do
    %Item{
      job_id: 1,
      external_ref: "docs/start.md",
      target_ref: "article:1",
      action: action,
      selected: true
    }
  end
end
