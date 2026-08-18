defmodule GroupherServer.CMS.Model.TrashAction do
  @moduledoc """
  Current grouping for one user-visible Trash operation.

  The row exists only while at least one Article or Docs Tree child remains in
  Trash. Historical facts live in `AuditLog`, not here.

  Business position:

      CMS context
        -> TrashAction schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{
    Community,
    TrashedArticle,
    TrashedDocArticle,
    TrashedDocTreeNode
  }
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(community_id root_type root_ref deleted_at scheduled_permanent_deletion_at)a
  @optional_fields ~w(actor_id)a

  @type t :: %__MODULE__{}

  schema "trash_actions" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:community, Community)
    belongs_to(:actor, User)
    field(:root_type, :string)
    field(:root_ref, :string)
    field(:deleted_at, :utc_datetime)
    field(:scheduled_permanent_deletion_at, :utc_datetime)

    has_many(:trashed_articles, TrashedArticle)
    has_many(:trashed_doc_articles, TrashedDocArticle)
    has_many(:trashed_doc_tree_nodes, TrashedDocTreeNode)

    timestamps(type: :utc_datetime)
  end

  def changeset(action, attrs) do
    action
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_length(:root_type, min: 1, max: 80)
    |> validate_length(:root_ref, min: 1, max: 200)
    |> unique_constraint(:hash_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:actor_id)
  end
end
