defmodule GroupherServer.CMS.Model.ArticlePublic do
  @moduledoc """
  Current ordinary-Article Snapshot selection plus its rebuildable read projection.

      ArticleSnapshot -> pointer + projection -> public readers
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS

  alias CMS.Model.{Article, ArticleSnapshot}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @foreign_key_type Ecto.UUID
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id snapshot_id published_at published_by_id title plain_text
                      thumbnail)a
  @optional_fields ~w(slug digest)a

  @type t :: %__MODULE__{}

  schema "article_publics" do
    belongs_to(:article, Article, primary_key: true)
    belongs_to(:snapshot, ArticleSnapshot)
    belongs_to(:published_by, User, type: :id)
    field(:published_at, :utc_datetime)
    field(:title, :string)
    field(:digest, :string)
    field(:slug, :string)
    field(:plain_text, :string)
    field(:thumbnail, :map)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the atomically replaceable Snapshot-backed public projection for an Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = public, attrs) do
    public
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> then(fn changeset ->
      put_change(changeset, :digest, get_field(changeset, :digest) || "")
    end)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:snapshot_id)
    |> foreign_key_constraint(:published_by_id)
  end
end
