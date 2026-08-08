defmodule GroupherServer.CMS.Model.ArticleDocument do
  @moduledoc """
  mainly for full-text search
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.Model.ArticleDocumentAssetRef
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @timestamps_opts [type: :utc_datetime]

  @max_body_length GroupherServer.CMS.Artiment.Config.max_length()
  @min_body_length GroupherServer.CMS.Artiment.Config.min_length()

  @required_fields ~w(thread title article_id json)a
  @optional_fields ~w(markdown markdown_toc thumbnail html plain_text digest body_hash schema_version)a

  @type t :: %ArticleDocument{}
  schema "article_documents" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:title, :string)
    field(:article_id, :id)
    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :map)
    field(:thumbnail, :map)
    field(:html, :string)
    field(:plain_text, :string)
    field(:digest, :string)
    field(:body_hash, :string)
    field(:schema_version, :integer, default: 1)

    has_many(:asset_refs, ArticleDocumentAssetRef)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%ArticleDocument{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields, empty_values: [])
    |> validate_required(@required_fields)
    |> validate_plain_text_length()
    |> unique_constraint([:thread, :article_id], name: :article_documents_thread_article_id_index)
  end

  @doc false
  def update_changeset(%ArticleDocument{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields, empty_values: [])
    |> validate_plain_text_length()
    |> unique_constraint([:thread, :article_id], name: :article_documents_thread_article_id_index)
  end

  defp validate_plain_text_length(changeset) do
    if get_field(changeset, :thread) == :doc do
      validate_length(changeset, :plain_text, max: @max_body_length)
    else
      changeset
      |> validate_length(:plain_text, min: @min_body_length, max: @max_body_length)
      |> validate_change(:plain_text, fn :plain_text, value ->
        if String.trim(value) == "", do: [plain_text: "can't be blank"], else: []
      end)
    end
  end
end
