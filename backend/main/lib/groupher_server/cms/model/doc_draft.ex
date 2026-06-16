defmodule GroupherServer.CMS.Model.DocDraft do
  @moduledoc """
  Dashboard working copy for a docs article.

  `docs` remains the published table. `doc_drafts` is the always-present docs
  workspace copy that dashboard editing mutates before publish.

      doc_drafts.published_doc_id -- optional link to cms.docs after publish
      doc_drafts.id              -- referenced by doc_tree_node_drafts.doc_draft_id
      doc_document_drafts        -- stores the editor JSON/rendered payload
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.{Author, Community, Doc, DocDocumentDraft}
  alias Helper.Constant.DBPrefix
  alias Helper.HTML
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(community_id title slug digest)a
  @optional_fields ~w(published_doc_id author_id template_key)a

  @type t :: %DocDraft{}
  schema "doc_drafts" do
    belongs_to(:community, Community)
    belongs_to(:published_doc, Doc)
    belongs_to(:author, Author)
    has_one(:document, DocDocumentDraft)

    field(:title, :string)
    field(:slug, :string)
    field(:digest, :string)
    field(:template_key, :string)

    timestamps(type: :utc_datetime)
  end

  def changeset(%DocDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> normalize_slug()
    |> validate_required(@required_fields)
    |> validate_length(:title, min: 3, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:digest, min: 1, max: 400)
    |> Slug.validate_changeset(:slug)
    |> HTML.safe_string(:title)
    |> HTML.safe_string(:digest)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:published_doc_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:slug, name: :doc_drafts_community_id_slug_index)
    |> unique_constraint(:template_key, name: :doc_drafts_community_id_template_key_index)
  end

  def update_changeset(%DocDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> normalize_slug()
    |> validate_length(:title, min: 3, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:digest, min: 1, max: 400)
    |> Slug.validate_changeset(:slug)
    |> HTML.safe_string(:title)
    |> HTML.safe_string(:digest)
    |> foreign_key_constraint(:published_doc_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:slug, name: :doc_drafts_community_id_slug_index)
    |> unique_constraint(:template_key, name: :doc_drafts_community_id_template_key_index)
  end

  defp normalize_slug(changeset) do
    case get_change(changeset, :slug) do
      slug when is_binary(slug) -> put_change(changeset, :slug, Slug.normalize(slug))
      _ -> changeset
    end
  end
end
