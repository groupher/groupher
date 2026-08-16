defmodule GroupherServer.CMS.Model.DocLifecycle do
  @moduledoc """
  Branch-scoped lifecycle authority for one Doc identity.
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Community, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @states [:draft_only, :published, :archived, :deleted, :destroy]
  @required_fields ~w(community_id branch_id article_hash_id state version changed_at)a
  @optional_fields ~w(archived_at deleted_at destroyed_at)a

  @type state :: :draft_only | :published | :archived | :deleted | :destroy
  @type t :: %__MODULE__{}

  schema "doc_lifecycles" do
    belongs_to(:community, Community)
    belongs_to(:branch, DocBranch)
    field(:article_hash_id, Ecto.UUID)
    field(:state, Ecto.Enum, values: @states, default: :draft_only)
    field(:version, :integer, default: 1)
    field(:changed_at, :utc_datetime)
    field(:archived_at, :utc_datetime)
    field(:deleted_at, :utc_datetime)
    field(:destroyed_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(%__MODULE__{} = lifecycle, attrs) do
    lifecycle
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:state, @states)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:community_id, :branch_id, :article_hash_id],
      name: :doc_lifecycles_identity_index
    )
  end
end
