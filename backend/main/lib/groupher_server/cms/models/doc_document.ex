defmodule GroupherServer.CMS.Model.DocDocument do
  @moduledoc """
  mainly for full-text search
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS

  alias CMS.Model.Doc
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @timestamps_opts [type: :utc_datetime]

  @max_body_length get_config(:article, :max_length)
  @min_body_length get_config(:article, :min_length)

  @required_fields ~w(json doc_id)a
  @optional_fields ~w(markdown markdown_toc html rss plain_text digest content_hash schema_version)a

  @type t :: %DocDocument{}
  schema "doc_documents" do
    belongs_to(:doc, Doc, foreign_key: :doc_id)

    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :map)
    field(:html, :string)
    field(:rss, :string)
    field(:plain_text, :string)
    field(:digest, :string)
    field(:content_hash, :string)
    field(:schema_version, :integer, default: 1)
  end

  @doc false
  def changeset(%DocDocument{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> validate_length(:json, min: @min_body_length, max: @max_body_length)
  end

  @doc false
  def update_changeset(%DocDocument{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_length(:json, min: @min_body_length, max: @max_body_length)
  end
end
