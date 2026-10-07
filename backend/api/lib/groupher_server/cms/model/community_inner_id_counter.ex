defmodule GroupherServer.CMS.Model.CommunityInnerIdCounter do
  @moduledoc """
  Owns the next public Article number for one Community.

      lock Community counter -> allocate ArticleCommunity.inner_id -> advance counter
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @primary_key {:community_id, :id, autogenerate: false}
  @schema_prefix DBPrefix.cms()
  @required_fields ~w(community_id next_inner_id)a

  @type t :: %__MODULE__{}

  schema "community_inner_id_counters" do
    belongs_to(:community, Community, define_field: false, foreign_key: :community_id)
    field(:next_inner_id, :integer, default: 1)
  end

  @doc "Builds a Community-wide public Article sequence counter."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = counter, attrs) do
    counter
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> validate_number(:next_inner_id, greater_than: 0)
    |> foreign_key_constraint(:community_id)
  end
end
