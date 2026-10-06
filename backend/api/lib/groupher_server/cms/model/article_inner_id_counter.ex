defmodule GroupherServer.CMS.Model.ArticleInnerIdCounter do
  @moduledoc """
  Owns the next public Article number for one Community and thread.

      first publish or move
        -> lock Community/thread counter
        -> allocate inner_id
        -> advance counter in the same transaction
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @threads CMS.Artiment.Config.threads()
  @required_fields ~w(community_id thread next_inner_id)a

  @type t :: %__MODULE__{}

  schema "article_inner_id_counters" do
    belongs_to(:community, Community, primary_key: true)
    field(:thread, Ecto.Enum, values: @threads, primary_key: true)
    field(:next_inner_id, :integer, default: 1)
  end

  @doc "Builds a Community/thread public Article sequence counter."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = counter, attrs) do
    counter
    |> cast(attrs, @required_fields)
    |> validate_required(@required_fields)
    |> validate_number(:next_inner_id, greater_than: 0)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:community_id, :thread])
  end
end
