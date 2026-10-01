defmodule GroupherServer.CMS.Model.ArticlePublic do
  @moduledoc """
  Current ordinary-Article public selection plus its rebuildable read projection.

      ArticleRevision -> pointer + projection -> public readers
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleRevision, Author}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id revision_id published_at published_by_id publication_version
                      title digest body_hash)a
  @optional_fields ~w(slug excerpt thumbnail active_at visible)a

  @type t :: %__MODULE__{}

  schema "article_publics" do
    belongs_to(:article, Article, primary_key: true)
    belongs_to(:revision, ArticleRevision)
    belongs_to(:published_by, Author, type: :id)
    field(:published_at, :utc_datetime)
    field(:publication_version, :integer, default: 1)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:body_hash, :string)
    field(:excerpt, :string)
    field(:thumbnail, :map)
    field(:active_at, :utc_datetime)
    field(:visible, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the atomically replaceable current-public projection for an Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = public, attrs) do
    public
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_number(:publication_version, greater_than: 0)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:revision_id)
    |> foreign_key_constraint(:published_by_id)
  end
end
