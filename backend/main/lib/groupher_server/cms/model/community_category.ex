defmodule GroupherServer.CMS.Model.CommunityCategory do
  @moduledoc """
  Join schema linking communities to discovery categories.

  The relation supports category-filtered community listing without embedding
  category state into the community row.

  Business position:

      CMS context
        -> CommunityCategory schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Category, Community}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @type t :: %CommunityCategory{}

  schema "communities_join_categories" do
    belongs_to(:community, Community, foreign_key: :community_id)
    belongs_to(:category, Category, foreign_key: :category_id)

    timestamps(type: :utc_datetime)
  end

  @required_fields ~w(community_id category_id)a

  @doc false
  def changeset(%CommunityCategory{} = community_category, attrs) do
    community_category
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:category_id)
    |> unique_constraint(
      :community_id,
      name: :communities_categories_community_id_category_id_index
    )
  end
end
