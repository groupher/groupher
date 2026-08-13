defmodule GroupherServer.CMS.Model.Blog do
  @moduledoc """
  Ecto schema for blog artiments.

  Blog shares the article workflow shape with other artiment threads while
  keeping its own table, constraints, meta embed, and community joins.

  Business position:

      CMS context
        -> Blog schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS

  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix

  require CMS.Const

  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(branch_id article_hash_id title digest)a
  @article_cast_fields general_article_cast_fields() ++ article_version_cast_fields()
  @optional_fields ~w(updated_at inserted_at active_at archived_at inner_id)a ++
                     @article_cast_fields

  @schema_prefix DBPrefix.cms()

  @type t :: %Blog{}
  schema "blogs" do
    article_version_fields()
    # association: community_tags
    article_tags_field(:blog)
    article_communities_field(:blog)
    general_article_fields(:blog)
  end

  @doc "Returns the Blog fields copied by Draft, Publish, Snapshot, and Restore."
  @spec version_fields() :: [atom()]
  def version_fields do
    ~w(title digest link_addr cover_url cover_url_dark)a
  end

  @doc "Builds a Blog changeset for creation."
  def changeset(%Blog{} = blog, attrs) do
    blog
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset
  end

  @doc "Builds a Blog changeset for mutable field updates."
  def update_changeset(%Blog{} = blog, attrs) do
    blog
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> geneal_changeset
  end

  defp geneal_changeset(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
    |> validate_article_version_scope(:blog)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint(:article_hash_id, name: :blogs_branch_article_hash_stage_index)
  end
end
