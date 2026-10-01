defmodule GroupherServer.CMS.Model.DocDraft do
  @moduledoc """
  Branch-scoped mutable Doc workspace; branch state remains in the Docs domain.

      DocBranch + Article -> DocDraft -> DocBranchVersion
  """

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleBodyDraft, ArticleRevision, Author, DocBranch}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, :id, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id branch_id body_draft_id version title digest content_hash updated_by_id)a
  @optional_fields ~w(base_revision_id source_revision_id slug subtitle link_addr template_key)a
  @type t :: %__MODULE__{}

  schema "doc_drafts" do
    belongs_to(:article, Article)
    belongs_to(:branch, DocBranch, type: :id)
    belongs_to(:base_revision, ArticleRevision)
    belongs_to(:source_revision, ArticleRevision)
    belongs_to(:body_draft, ArticleBodyDraft)
    belongs_to(:updated_by, Author, type: :id)
    field(:version, :integer, default: 1)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:link_addr, :string)
    field(:template_key, :string)
    field(:content_hash, :string)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a branch-scoped Doc Draft with explicit base and restore provenance."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:base_revision_id)
    |> foreign_key_constraint(:source_revision_id)
    |> foreign_key_constraint(:body_draft_id)
    |> unique_constraint([:article_id, :branch_id])
  end
end
