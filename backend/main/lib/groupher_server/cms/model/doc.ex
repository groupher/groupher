defmodule GroupherServer.CMS.Model.Doc do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset
  import GroupherServer.CMS.Helper.Macros

  alias GroupherServer.CMS

  alias CMS.Model.Embeds
  alias Helper.Constant.DBPrefix
  alias Helper.HTML

  @schema_prefix DBPrefix.cms()

  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(title digest)a
  @article_cast_fields general_article_cast_fields()
  @optional_fields ~w(updated_at inserted_at active_at archived_at inner_id)a ++
                     @article_cast_fields

  @type t :: %Doc{}
  schema "docs" do
    # association: community_tags
    article_tags_field(:doc)
    article_communities_field(:doc)
    general_article_fields(:doc)
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
    |> cast_embed(:emotions, with: &Embeds.ArticleEmotion.changeset/2)
    |> validate_length(:link_addr, min: 5, max: 400)
    |> HTML.safe_string(:body)
  end
end
