defmodule GroupherServer.CMS.Model.ArticleRevision do
  @moduledoc """
  Stored version checkpoint for article-like content.

  This schema is intentionally scoped to Groupher articles: posts, docs,
  changelogs, and blogs. Comments are not part of this model because comment
  diff/history is expected to stay frontend-only until the product needs a
  server-side audit trail for comments.

  A row stores a full document snapshot rather than a patch. The service layer
  can then restore a snapshot without replaying editor operations, while the
  editor package can still use two snapshots to compute a visual diff.
  """

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads

  alias CMS.Model.{
    ArticleDraft,
    Author,
    Community
  }

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @revision_types [:draft, :published]
  @required_fields ~w(community_id thread type title document_json content_hash revision_number)a
  @optional_fields ~w(article_id article_draft_id author_id slug subtitle digest schema_version)a

  @type revision_type :: :draft | :published
  @type t :: %ArticleRevision{}

  schema "article_revisions" do
    belongs_to(:community, Community)
    belongs_to(:article_draft, ArticleDraft)
    belongs_to(:author, Author)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:type, Ecto.Enum, values: @revision_types)
    field(:article_id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:subtitle, :string)
    field(:digest, :string)
    field(:document_json, :string)
    field(:content_hash, :string)
    field(:revision_number, :integer)
    field(:schema_version, :integer, default: 1)

    timestamps(type: :utc_datetime)
  end

  def types, do: @revision_types

  def changeset(%ArticleRevision{} = revision, attrs) do
    revision
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:type, @revision_types)
    |> validate_length(:title, min: 1, max: 100)
    |> validate_target()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_draft_id)
    |> foreign_key_constraint(:author_id)
    |> check_constraint(:article_id, name: :article_revisions_target_check)
    |> check_constraint(:type, name: :article_revisions_type_check)
    |> check_constraint(:thread, name: :article_revisions_thread_check)
  end

  def update_changeset(%ArticleRevision{} = revision, attrs), do: changeset(revision, attrs)

  defp validate_target(changeset) do
    case {get_field(changeset, :type), get_field(changeset, :article_id),
          get_field(changeset, :article_draft_id)} do
      {:draft, nil, article_draft_id} when not is_nil(article_draft_id) ->
        changeset

      {:published, article_id, nil} when not is_nil(article_id) ->
        changeset

      {:draft, _, _} ->
        add_error(changeset, :article_draft_id, "draft revisions require article_draft_id only")

      {:published, _, _} ->
        add_error(changeset, :article_id, "published revisions require article_id only")

      _ ->
        add_error(changeset, :type, "invalid revision target")
    end
  end
end
