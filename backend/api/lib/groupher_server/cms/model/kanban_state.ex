defmodule GroupherServer.CMS.Model.KanbanState do
  @moduledoc """
  Community-local Kanban membership and workflow state for one ArticleCommunity relation.

      ArticleCommunity -> KanbanState? -> status / rank

  The row's existence means that the ArticleCommunity relation is in the Community's Kanban.
  `status` is required while the row exists; removing the row removes Kanban
  membership without changing the stable Article or its other ArticleCommunity relations.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Artiment.Const
  alias CMS.Model.ArticleCommunity
  alias Helper.Constant.DBPrefix

  @primary_key false
  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  schema "kanban_states" do
    belongs_to(:article_community, ArticleCommunity, primary_key: true)
    field(:status, Ecto.Enum, values: Const.status_values())
    field(:rank, :integer)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds a Community-local Kanban state for an ArticleCommunity relation."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = state, attrs) do
    state
    |> cast(attrs, [:article_community_id, :status, :rank])
    |> validate_required([:article_community_id, :status])
    |> foreign_key_constraint(:article_community_id)
  end
end
