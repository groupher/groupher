defmodule GroupherServer.CMS.ArtimentMentions.Model.GraphRevision do
  @moduledoc """
  Stores one monotonic public graph revision per Community.

      graph-visible mutation -> GraphRevision -> revision query
  """

  use Ecto.Schema

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key {:community_id, :id, autogenerate: false}

  schema "reference_map_revisions" do
    field(:revision, :integer, default: 0)
    timestamps(type: :utc_datetime)
  end
end
