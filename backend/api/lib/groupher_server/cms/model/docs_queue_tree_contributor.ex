defmodule GroupherServer.CMS.Model.DocsQueueTreeContributor do
  @moduledoc """
  The current author of one net directory field change.

      Queue node + field -> responsible actor -> approval contributor union
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()

  schema "docs_queue_tree_contributors" do
    field(:queue_id, Ecto.UUID, primary_key: true)
    field(:node_id, :string, primary_key: true)
    field(:field_name, :string, primary_key: true)
    field(:user_id, :integer)
  end

  @doc "Builds an attribution selected by the directory net-change reconciliation."
  def changeset(contributor, attrs) do
    contributor
    |> cast(attrs, [:queue_id, :node_id, :field_name, :user_id])
    |> validate_required([:queue_id, :node_id, :field_name, :user_id])
    |> check_constraint(:field_name, name: :docs_queue_tree_contributor_field_check)
    |> foreign_key_constraint(:queue_id, name: :docs_queue_tree_contributor_member_fkey)
    |> foreign_key_constraint(:user_id)
  end
end
