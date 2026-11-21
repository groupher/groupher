defmodule GroupherServer.Test.CMS.CommunityRefChangesetTest do
  use ExUnit.Case, async: true

  alias GroupherServer.CMS.Model.Community

  test "stable refs cannot be assigned or changed through Community changesets" do
    community = %Community{ref: "cm_existing"}

    update_changeset = Community.update_changeset(community, %{"ref" => "cm_replaced"})
    refute update_changeset.valid?
    assert Keyword.has_key?(update_changeset.errors, :ref)

    create_changeset = Community.changeset(community, %{ref: "cm_replaced"})
    refute create_changeset.valid?
    assert Keyword.has_key?(create_changeset.errors, :ref)

    assert %{valid?: true, changes: %{slug: "stable"}} =
             Community.update_changeset(community, %{slug: "stable"})
  end
end
