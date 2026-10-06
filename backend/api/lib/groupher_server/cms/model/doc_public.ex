defmodule GroupherServer.CMS.Model.DocPublic do
  @moduledoc """
  Branch-scoped Doc public selection and read projection.

      DocBranchVersion -> DocPublic -> Dashboard or main-branch public reader
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, Author, DocBranch, DocBranchVersion}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id branch_id branch_version_id published_at published_by_id
                      title digest body_hash publication_version)a
  @optional_fields ~w(slug subtitle excerpt thumbnail active_at is_edited visible)a
  @type t :: %__MODULE__{}

  schema "doc_publics" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)
    belongs_to(:branch_version, DocBranchVersion)
    belongs_to(:published_by, Author)
    field(:published_at, :utc_datetime)
    field(:publication_version, :integer, default: 1)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:body_hash, :string)
    field(:excerpt, :string)
    field(:thumbnail, :map)
    field(:active_at, :utc_datetime)
    field(:is_edited, :boolean, default: false)
    field(:visible, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a branch public projection anchored by exactly one BranchVersion."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = public, attrs) do
    public
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:publication_version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:branch_version_id)
    |> unique_constraint([:article_id, :branch_id])
  end
end
