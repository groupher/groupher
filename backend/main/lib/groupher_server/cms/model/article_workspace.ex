defmodule GroupherServer.CMS.Model.ArticleWorkspace do
  @moduledoc """
  Editable workspace row for article content.

  The workspace is the current draft copy only. Publishing copies it into the
  runtime article table (`docs` + `DocDocument` for docs) and records an
  immutable ArticleSnapshot.

      article_id = stable content identity
      stage      = draft

      article_workspaces(stage=draft)
             |
             | publish
             v
      runtime article table + ArticleSnapshot(stage=public)

  Docs are one article thread that consumes this common version layer. Docs
  trash is intentionally not modeled here because restoring a doc also restores
  tree nodes and pins, which is docs-specific product behavior.
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
  @max_subtitle_length 240

  @stages [:draft]
  @required_fields ~w(community_id article_thread stage title slug digest json)a
  @optional_fields ~w(
    article_id author_id template_key subtitle markdown markdown_toc html xml rss
    plain_text content_hash schema_version
  )a

  @type t :: %ArticleWorkspace{}
  schema "article_workspaces" do
    belongs_to(:community, Community)
    belongs_to(:author, Author)

    field(:article_id, :id)
    field(:article_thread, Ecto.Enum, values: Threads.article_enums())
    field(:stage, Ecto.Enum, values: @stages)
    field(:title, :string)
    field(:subtitle, :string)
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

  def stages, do: @stages

  def changeset(%ArticleWorkspace{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_common()
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:template_key, name: :article_workspaces_community_id_template_key_index)
    |> unique_constraint(:stage, name: :article_workspaces_identity_stage_index)
  end

  def update_changeset(%ArticleWorkspace{} = draft, attrs) do
    draft
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_common()
    |> foreign_key_constraint(:author_id)
    |> unique_constraint(:template_key, name: :article_workspaces_community_id_template_key_index)
    |> unique_constraint(:stage, name: :article_workspaces_identity_stage_index)
  end

  defp validate_common(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> validate_length(:subtitle, max: @max_subtitle_length)
    |> validate_length(:slug, min: 1, max: 120)
    |> validate_length(:digest, min: 1, max: 400)
    |> validate_length(:plain_text, min: @min_body_length, max: @max_body_length)
    |> Slug.validate_changeset(:slug)
    |> HTML.safe_string(:title)
    |> HTML.safe_string(:subtitle)
    |> HTML.safe_string(:digest)
  end
end
