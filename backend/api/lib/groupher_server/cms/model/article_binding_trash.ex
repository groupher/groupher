defmodule GroupherServer.CMS.Model.ArticleBindingTrash do
  @moduledoc """
  A Community's hidden presentation of one existing Article Binding.

      Community hide -> binding trash row -> local Scope exclusion

  The Article, Binding and global Lifecycle remain independently owned.
  """
  use Ecto.Schema
  use Flop.Schema
  @flop_options [filterable: [], sortable: [:id, :inserted_at], pagination_types: [:page, :first]]
  import Ecto.Changeset

  alias GroupherServer.CMS.Model.{Article, ArticleBinding, Community}
  alias GroupherServer.Accounts.Model.User

  @primary_key {:id, Ecto.UUID, autogenerate: true}
  @schema_prefix "cms"
  schema "article_binding_trash" do
    belongs_to(:community, Community)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:binding, ArticleBinding)
    belongs_to(:actor, User)
    field(:revision, :integer, default: 1)
    field(:hidden_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  def changeset(row, attrs) do
    row
    |> cast(attrs, [:community_id, :article_id, :binding_id, :actor_id, :revision, :hidden_at])
    |> validate_required([
      :community_id,
      :article_id,
      :binding_id,
      :actor_id,
      :revision,
      :hidden_at
    ])
    |> validate_number(:revision, greater_than: 0)
    |> unique_constraint([:community_id, :article_id])
    |> unique_constraint(:binding_id)
    |> foreign_key_constraint(:binding_id, name: :article_binding_trash_binding_scope_fkey)
    |> foreign_key_constraint(:actor_id)
    |> check_constraint(:revision, name: :article_binding_trash_revision_check)
  end
end
