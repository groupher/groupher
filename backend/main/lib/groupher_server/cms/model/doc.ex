defmodule GroupherServer.CMS.Model.Doc do
  @moduledoc """
  Docs content anchor. One row per Doc draft or public head. Rows representing
  the same logical Article share `article_hash_id`; Tree code maps that identity
  to its product-level `doc_id` at the Docs boundary.

  Business position:

      CMS context
        -> Doc schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
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

  @required_fields ~w(branch_id article_hash_id title digest)a
  @article_cast_fields general_article_cast_fields() ++ article_version_cast_fields()
  @optional_fields ~w(subtitle updated_at inserted_at active_at archived_at inner_id
                      slug json author_id)a ++
                     @article_cast_fields
  @max_subtitle_length 240

  @type t :: %Doc{}
  schema "docs" do
    article_version_fields()
    field(:slug, :string)
    field(:json, :string)

    # association: community_tags
    article_tags_field(:doc)
    article_communities_field(:doc)
    general_article_fields(:doc)
    field(:subtitle, :string)
  end

  @doc "Returns the Doc fields copied by Draft, Publish, Snapshot, and Restore."
  @spec version_fields() :: [atom()]
  def version_fields do
    ~w(title subtitle slug digest link_addr json cover_url cover_url_dark)a
  end

  @doc "Builds a Doc changeset for creation."
  def changeset(%Doc{} = doc, attrs) do
    doc
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset
  end

  @doc "Builds a Doc changeset for mutable field updates."
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
    |> validate_article_version_scope(:doc)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint(:article_hash_id, name: :docs_branch_article_hash_stage_index)
  end
end
