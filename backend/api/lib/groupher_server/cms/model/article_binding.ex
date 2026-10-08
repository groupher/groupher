defmodule GroupherServer.CMS.Model.ArticleBinding do
  @moduledoc """
  Stores one Article's binding to one Community.

      stable Article
        -> ArticleBinding(article, community)
        -> community visibility, tags, and pin ownership

  Every row is a peer ArticleBinding. Product commands may call an insertion a
  mirror, but the binding itself does not have a home/mirror role.
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, Community, KanbanState}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(article_id community_id)a
  @optional_fields ~w(inner_id visible)a

  @type t :: %__MODULE__{}

  schema "article_bindings" do
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:community, Community)
    has_one(:kanban_state, KanbanState, foreign_key: :article_binding_id)
    field(:inner_id, :integer)
    field(:visible, :boolean, default: true)
    timestamps(type: :utc_datetime)
  end

  @doc "Builds one peer ArticleBinding for a stable Article."
  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = binding, attrs) do
    binding
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint([:article_id, :community_id])
    |> unique_constraint(:inner_id, name: :article_bindings_community_inner_id_index)
  end
end
