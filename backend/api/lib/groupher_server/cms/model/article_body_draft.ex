defmodule GroupherServer.CMS.Model.ArticleBodyDraft do
  @moduledoc """
  Mutable canonical rich-text workspace owned by one current Draft.

      editor autosave -> ArticleBodyDraft -> publish materialization
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

  schema "article_body_drafts" do
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
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the mutable body changeset produced by the canonical content pipeline."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = body, attrs) do
    body
    |> cast(attrs, @required_fields ++ @optional_fields, empty_values: [])
    |> validate_required(@required_fields)
    |> validate_number(:schema_version, greater_than: 0)
  end
end
