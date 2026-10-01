defmodule GroupherServer.CMS.Model.ArticleRevision do
  @moduledoc """
  Immutable shared content envelope created exactly once by Publish.

      Draft -> ArticleRevision -> ArticlePublic
                    |
                    `-> typed thread revision
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleBodySnapshot}
  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id body_snapshot_id title digest content_hash schema_version cleanup_after)a
  @optional_fields ~w(slug)a

  @type t :: %__MODULE__{}

  schema "article_revisions" do
    belongs_to(:article, Article)
    belongs_to(:body_snapshot, ArticleBodySnapshot)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:content_hash, :string)
    field(:schema_version, :integer, default: 1)
    field(:cleanup_after, :utc_datetime)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc "Builds the append-only Revision envelope selected by a Public head."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = revision, attrs) do
    revision
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:schema_version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:body_snapshot_id)
  end
end
