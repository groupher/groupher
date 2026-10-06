defmodule GroupherServer.CMS.Model.DocBranchVersion do
  @moduledoc """
  Immutable published-version coordinate for one Doc inside one branch.

      Doc publish -> ArticleRevision -> DocBranchVersion -> DocPublic / Release
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleRevision, Author, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id branch_id revision_id version_number published_by_id published_at)a
  @optional_fields ~w(message)a
  @type t :: %__MODULE__{}

  schema "doc_branch_versions" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)
    belongs_to(:revision, ArticleRevision, type: Ecto.UUID)
    belongs_to(:published_by, Author)
    field(:version_number, :integer)
    field(:published_at, :utc_datetime)
    field(:message, :string)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc "Builds one append-only branch publication pointing at an immutable Revision."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = version, attrs) do
    version
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:version_number, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:revision_id)
    |> unique_constraint([:article_id, :branch_id, :version_number])
  end
end
