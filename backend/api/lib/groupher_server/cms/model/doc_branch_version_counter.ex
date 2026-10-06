defmodule GroupherServer.CMS.Model.DocBranchVersionCounter do
  @moduledoc """
  Lockable per-Doc, per-branch counter for monotonic published version numbers.

      publish transaction -> counter lock -> DocBranchVersion insert
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, DocBranch}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "doc_branch_version_counters" do
    belongs_to(:article, Article, type: Ecto.UUID, primary_key: true)
    belongs_to(:branch, DocBranch, primary_key: true)
    field(:next_version_number, :integer, default: 1)
  end

  @doc "Builds the counter row advanced under the Doc publication lock."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = counter, attrs) do
    counter
    |> cast(attrs, [:article_id, :branch_id, :next_version_number])
    |> validate_required([:article_id, :branch_id, :next_version_number])
    |> validate_number(:next_version_number, greater_than: 0)
  end
end
