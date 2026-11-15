defmodule GroupherServer.CMS.Model.DocsQueueTreeChange do
  @moduledoc """
  One site's net directory change relative to the public release.

      Queue + node identity -> upsert target or delete marker
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "docs_queue_tree_changes" do
    field(:queue_id, Ecto.UUID, primary_key: true)
    field(:node_id, :string, primary_key: true)
    field(:community_id, :integer)
    field(:change_type, Ecto.Enum, values: [:upsert, :delete])
    field(:target, :map)
    field(:source_event_id, :integer)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a change after the caller validates the complete target tree."
  def changeset(change, attrs) do
    change
    |> cast(attrs, [:queue_id, :node_id, :community_id, :change_type, :target, :source_event_id])
    |> validate_required([:queue_id, :node_id, :community_id, :change_type])
    |> check_constraint(:target, name: :docs_queue_tree_change_shape_check)
    |> check_constraint(:source_event_id, name: :docs_queue_tree_changes_unavailable_event_check)
    |> foreign_key_constraint(:queue_id, name: :docs_queue_tree_change_queue_owner_fkey)
    |> foreign_key_constraint(:source_event_id, name: :docs_queue_tree_change_event_owner_fkey)
  end
end
