defmodule GroupherServer.CMS.Model.ArticleCommunity do
  @moduledoc """
  Stores one Article's visibility relationship with one Community.

      stable Article
        -> ArticleCommunity(home | mirror)
        -> community visibility, tags, and pin ownership

  Exactly one relationship per Article is the home relationship. Mirror rows
  expose the same Article in another Community without creating another public
  Article identity or URL.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @roles [:home, :mirror]
  @required_fields ~w(article_id community_id role)a
  @optional_fields ~w(visible)a

  @type t :: %__MODULE__{}

  schema "article_communities" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    field(:role, Ecto.Enum, values: @roles)
    field(:visible, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds the home or mirror Community relationship for a stable Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = relation, attrs) do
    relation
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:article_id, :community_id])
    |> unique_constraint(:article_id, name: :article_communities_home_index)
  end
end
