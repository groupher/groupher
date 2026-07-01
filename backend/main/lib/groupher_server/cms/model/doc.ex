defmodule GroupherServer.CMS.Model.Doc do
  @moduledoc """
  Docs content anchor. One row per doc (draft or public). draft and published
  rows that represent the same doc share the same doc_id UUID.
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS

  require CMS.Const

  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix
  alias Helper.HTML

  @schema_prefix DBPrefix.cms()

  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(title digest)a
  @article_cast_fields general_article_cast_fields()
  @optional_fields ~w(subtitle updated_at inserted_at active_at archived_at inner_id
                      doc_id slug stage template_key content_hash json schema_version author_id)a ++
                     @article_cast_fields
  @max_subtitle_length 240

  @type t :: %Doc{}
  schema "docs" do
    field(:doc_id, Ecto.UUID)
    field(:slug, :string)
    field(:stage, Ecto.Enum, values: CMS.Const.stage_values(), default: CMS.Const.stage(:public))
    field(:template_key, :string)
    field(:content_hash, :string)
    field(:json, :string)
    field(:schema_version, :integer, default: 1)

    # association: community_tags
    article_tags_field(:doc)
    article_communities_field(:doc)
    general_article_fields(:doc)
    field(:subtitle, :string)
  end

  @doc false
  def changeset(%Doc{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset
  end

  @doc false
  def update_changeset(%Doc{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> geneal_changeset
  end

  defp geneal_changeset(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> validate_length(:subtitle, max: @max_subtitle_length)
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
    |> HTML.safe_string(:subtitle)
    |> HTML.safe_string(:body)
    |> unique_constraint(:doc_id, name: :docs_community_stage_doc_id_index)
  end
end
