defmodule GroupherServer.CMS.Model.Changelog do
  @moduledoc """
  Ecto schema for changelog artiments.

  Changelogs use the shared article publishing and reaction machinery while
  representing release/update content in a dedicated table.

  Business position:

      CMS context
        -> Changelog schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS
  alias GroupherServer.CMS.Model.Embeds

  alias Helper.Constant.DBPrefix
  alias Helper.HTML

  require CMS.Const

  @schema_prefix DBPrefix.cms()

  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(article_hash_id title digest)a
  @article_cast_fields general_article_cast_fields() ++ article_version_cast_fields()
  @optional_fields ~w(updated_at inserted_at active_at inner_id)a ++
                     @article_cast_fields

  @type t :: %Changelog{}
  schema "changelogs" do
    article_version_fields()
    # association: community_tags
    article_tags_field(:changelog)
    article_communities_field(:changelog)
    general_article_fields(:changelog)
  end

  @doc "Returns the Changelog fields copied by Draft and Publish."
  @spec version_fields() :: [atom()]
  def version_fields do
    ~w(title digest link_addr cover_url cover_url_dark)a
  end

  @doc "Builds a Changelog changeset for creation."
  def changeset(%Changelog{} = changelog, attrs) do
    changelog
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> cast_embed(:meta, required: false, with: &Embeds.ArticleMeta.changeset/2)
    |> geneal_changeset
  end

  @doc "Builds a Changelog changeset for mutable field updates."
  def update_changeset(%Changelog{} = changelog, attrs) do
    changelog
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> geneal_changeset
  end

  defp geneal_changeset(changeset) do
    changeset
    |> validate_length(:title, min: 3, max: 100)
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
    |> HTML.safe_string(:body)
    |> validate_article_version_scope(:changelog)
    |> unique_constraint(:article_hash_id, name: :changelogs_community_article_hash_stage_index)
  end
end
