defmodule GroupherServer.CMS.Model.DocsReleaseTreeSnapshot do
  @moduledoc """
  Immutable complete public tree selected by a Docs Release.

      validated target tree -> versioned tree JSON -> Release snapshot
  """

  use Ecto.Schema
  import Ecto.Changeset
  alias Helper.Constant.DBPrefix
  @schema_prefix DBPrefix.cms()

  schema "doc_tree_snapshots" do
    field(:community_id, :integer)
    field(:tree_json, :map)
    field(:created_at, :utc_datetime)
  end

  @doc "Builds one complete V1 tree snapshot in its publication transaction."
  def changeset(snapshot, attrs) do
    snapshot
    |> cast(attrs, [:community_id, :tree_json, :created_at])
    |> validate_required([:community_id, :tree_json, :created_at])
  end
end
