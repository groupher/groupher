defmodule GroupherServer.CMS.Model.ArticleBodySnapshot do
  @moduledoc """
  Immutable, content-addressed body referenced by published Revisions.

      ArticleBodyDraft -> publish -> ArticleBodySnapshot <- ArticleRevision
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(json body_hash schema_version)a
  @optional_fields ~w(markdown markdown_toc html xml rss plain_text thumbnail)a

  @type t :: %__MODULE__{}

  schema "article_body_snapshots" do
    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :map)
    field(:html, :string)
    field(:xml, :string)
    field(:rss, :string)
    field(:plain_text, :string)
    field(:thumbnail, :map)
    field(:body_hash, :string)
    field(:schema_version, :integer, default: 1)
    timestamps(type: :utc_datetime, updated_at: false)
  end

  @doc "Builds an immutable body snapshot and enforces its content-address identity."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = snapshot, attrs) do
    snapshot
    |> cast(attrs, @required_fields ++ @optional_fields, empty_values: [])
    |> validate_required(@required_fields)
    |> validate_number(:schema_version, greater_than: 0)
    |> unique_constraint([:body_hash, :schema_version])
  end
end
