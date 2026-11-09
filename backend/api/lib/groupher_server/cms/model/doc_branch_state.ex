defmodule GroupherServer.CMS.Model.DocBranchState do
  @moduledoc """
  Owns mutable runtime facts for one Doc Article branch.

      stable Doc Article + DocBranch
        -> DocBranchState
        -> body activity and edited state

  Keeping these facts branch-scoped prevents preview moderation or editing from
  changing the main branch's public behavior.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.{Article, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id branch_id)a
  @optional_fields ~w(active_at is_sunk last_active_at is_edited)a

  @type t :: %__MODULE__{}

  schema "doc_branch_states" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)
    field(:active_at, :utc_datetime)
    field(:is_sunk, :boolean, default: false)
    field(:last_active_at, :utc_datetime)
    field(:is_edited, :boolean, default: false)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds branch-scoped body activity and edited state."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = state, attrs) do
    state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:article_id, :branch_id])
  end
end
