defmodule GroupherServer.CMS.Model.DocBranchState do
  @moduledoc """
  Owns mutable runtime facts for one Doc Article branch.

      stable Doc Article + DocBranch
        -> DocBranchState
        -> moderation, activity, edited, and comment state

  Keeping these facts branch-scoped prevents preview moderation or editing from
  changing the main branch's public behavior.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @moderation_states [:legal, :audit_failed, :illegal]
  @required_fields ~w(article_id branch_id moderation_state)a
  @optional_fields ~w(illegal_reason illegal_words active_at is_sunk last_active_at is_edited
                      comments_locked next_floor next_comment_inner_id)a

  @type t :: %__MODULE__{}

  schema "doc_branch_states" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)
    field(:moderation_state, Ecto.Enum, values: @moderation_states, default: :legal)
    field(:illegal_reason, :string)
    field(:illegal_words, {:array, :string}, default: [])
    field(:active_at, :utc_datetime)
    field(:is_sunk, :boolean, default: false)
    field(:last_active_at, :utc_datetime)
    field(:is_edited, :boolean, default: false)
    field(:comments_locked, :boolean, default: false)
    field(:next_floor, :integer, default: 1)
    field(:next_comment_inner_id, :integer, default: 1)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds branch-scoped moderation, activity, edited, and comment state."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = state, attrs) do
    state
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:next_floor, greater_than: 0)
    |> validate_number(:next_comment_inner_id, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:article_id, :branch_id])
  end
end
