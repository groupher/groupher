defmodule GroupherServer.CMS.Model.ArticleDraft do
  @moduledoc """
  Mutable ordinary-Article workspace with optimistic concurrency metadata.

      stable Article -> ArticleDraft -> publish -> immutable Revision
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleBodyDraft, ArticleRevision, Author}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id body_draft_id version title digest content_hash updated_by_id)a
  @optional_fields ~w(base_revision_id slug)a

  @type t :: %__MODULE__{}

  schema "article_drafts" do
    belongs_to(:article, Article, primary_key: true)
    belongs_to(:base_revision, ArticleRevision)
    belongs_to(:body_draft, ArticleBodyDraft)
    belongs_to(:updated_by, Author, type: :id)
    field(:version, :integer, default: 1)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:content_hash, :string)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds an ordinary Draft changeset guarded by its monotonic version."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:base_revision_id)
    |> foreign_key_constraint(:body_draft_id)
    |> foreign_key_constraint(:updated_by_id)
  end
end
