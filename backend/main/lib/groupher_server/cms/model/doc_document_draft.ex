defmodule GroupherServer.CMS.Model.DocDocumentDraft do
  @moduledoc """
  Rendered document payload for a `DocDraft`.

  This mirrors `doc_documents`, but stores unpublished editor content. The `json`
  field is the canonical editor payload; markdown/html/xml/plain_text/digest are
  derived by `Helper.ContentPipeline` for preview/search/publish preparation.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias CMS.Model.DocDraft
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @max_body_length get_config(:article, :max_length)
  @min_body_length get_config(:article, :min_length)

  @required_fields ~w(json doc_draft_id)a
  @optional_fields ~w(markdown markdown_toc html xml rss plain_text digest content_hash schema_version)a

  @type t :: %DocDocumentDraft{}
  schema "doc_document_drafts" do
    belongs_to(:doc_draft, DocDraft)

    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :map)
    field(:html, :string)
    field(:xml, :string)
    field(:rss, :string)
    field(:plain_text, :string)
    field(:digest, :string)
    field(:content_hash, :string)
    field(:schema_version, :integer, default: 1)

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocDocumentDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> validate_length(:plain_text, min: @min_body_length, max: @max_body_length)
    |> foreign_key_constraint(:doc_draft_id)
    |> unique_constraint(:doc_draft_id)
  end

  def update_changeset(%DocDocumentDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_length(:plain_text, min: @min_body_length, max: @max_body_length)
    |> unique_constraint(:doc_draft_id)
  end
end
