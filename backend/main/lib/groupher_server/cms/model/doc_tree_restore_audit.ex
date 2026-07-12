defmodule GroupherServer.CMS.Model.DocTreeRestoreAudit do
  @moduledoc """
  Audit record for restoring staged docs tree delete items.

  Restore is intentionally not a publish release because it does not create a
  new public snapshot. This row records who discarded the pending delete and
  which staged events / draft nodes were restored.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.{Community, ArticleBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id branch_id restored_event_ids restored_node_ids restored_at payload)a
  @optional_fields ~w(actor_id)a

  @type t :: %DocTreeRestoreAudit{}

  schema "doc_tree_restore_audits" do
    belongs_to(:community, Community)
    belongs_to(:branch, ArticleBranch)
    belongs_to(:actor, User)

    field(:restored_event_ids, {:array, :integer}, default: [])
    field(:restored_node_ids, {:array, :string}, default: [])
    field(:restored_at, :utc_datetime)
    field(:payload, :map, default: %{})

    timestamps(type: :utc_datetime)
  end

  @doc "Builds an immutable Docs Tree restore audit changeset."
  def changeset(%DocTreeRestoreAudit{} = audit, attrs) do
    audit
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:restored_event_ids, min: 1)
    |> validate_length(:restored_node_ids, min: 1)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:actor_id)
  end
end
