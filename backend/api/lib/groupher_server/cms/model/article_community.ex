defmodule GroupherServer.CMS.Model.ArticleCommunity do
  @moduledoc """
  Stores one Article's visibility relationship with one Community.

      stable Article
        -> ArticleCommunity(article, community)
        -> community visibility, tags, and pin ownership

  Every row is a peer placement. Product commands may call an insertion a
  mirror, but the relationship itself does not have a home/mirror role.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id community_id)a
  @optional_fields ~w(visible)a

  @type t :: %__MODULE__{}

  schema "article_communities" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    field(:visible, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds one peer Community placement for a stable Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = relation, attrs) do
    relation
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:article_id, :community_id])
  end
end
