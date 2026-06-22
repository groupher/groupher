defmodule GroupherServer.CMS.Model.ArticleDraft do
  @moduledoc """
  Universal working copy for article content.

  The draft layer is shared by posts, changelogs, blogs, and docs. Published
  content still lives in each thread's article/document tables; this table only
  stores the staged working copy that autosave, version history, and publish use.

      editor autosave
            |
            v
      article_drafts  --checkpoint-->  article_revisions(type=draft)
            |
            | publish
            v
      cms_posts / cms_docs / ...
            |
            v
      article_revisions(type=published)

  For docs, the docs tree owns page structure and path slugs. A page node points
  to this draft through `article_draft_id`; restoring an article revision does
  not rewrite the tree node slug.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias CMS.Model.{Author, Community}
  alias Helper.Constant.DBPrefix
  alias Helper.HTML
  alias Helper.Validator.Slug

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @max_body_length get_config(:article, :max_length)
  @min_body_length get_config(:article, :min_length)

  @required_fields ~w(community_id thread title slug digest json)a
  @optional_fields ~w(
    article_id author_id template_key markdown markdown_toc html xml rss
    plain_text content_hash schema_version
  )a

  @type t :: %ArticleDraft{}
  schema "article_drafts" do
    belongs_to(:community, Community)
    belongs_to(:author, Author)

    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:title, :string)
    field(:slug, :string)
    field(:digest, :string)
    field(:template_key, :string)

    field(:json, :string)
    field(:markdown, :string)
    field(:markdown_toc, :map)
    field(:html, :string)
    field(:xml, :string)
    field(:rss, :string)
    field(:plain_text, :string)
    field(:content_hash, :string)
    field(:schema_version, :integer, default: 1)

    timestamps(type: :utc_datetime)
  end

  def changeset(%ArticleDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_common()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:template_key, name: :article_drafts_community_id_template_key_index)
  end

  def update_changeset(%ArticleDraft{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_common()
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:template_key, name: :article_drafts_community_id_template_key_index)
  end

  defp validate_common(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:digest, min: 1, max: 400)
    |> validate_length(:plain_text, min: @min_body_length, max: @max_body_length)
    |> Slug.validate_changeset(:slug)
    |> HTML.safe_string(:title)
    |> HTML.safe_string(:digest)
  end
end
