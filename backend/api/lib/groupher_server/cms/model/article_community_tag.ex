defmodule GroupherServer.CMS.Model.ArticleCommunityTag do
  @moduledoc """
  Assigns one Community-local tag to an Article Community relationship.

      ArticleCommunity(home | mirror) + CommunityTag
        -> community-specific Article presentation

  These tags are operational Community metadata and never become immutable
  Revision content tags.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{ArticleCommunity, CommunityTag}
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_community_id tag_id)a

  @type t :: %__MODULE__{}

  schema "article_community_tags" do
    belongs_to(:article_community, ArticleCommunity, primary_key: true)
    belongs_to(:tag, CommunityTag, primary_key: true)
  end

  @doc "Builds one Community-local tag assignment for an Article relationship."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = relation_tag, attrs) do
    relation_tag
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_community_id)
    |> foreign_key_constraint(:tag_id)
    |> unique_constraint([:article_community_id, :tag_id])
  end
end
