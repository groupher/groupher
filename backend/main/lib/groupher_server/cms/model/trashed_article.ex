defmodule GroupherServer.CMS.Model.TrashedArticle do
  @moduledoc """
  Current Trash membership for one logical Article.

  `article_hash_id` identifies every draft/public physical row belonging to the
  same Article; this table deliberately has no polymorphic database foreign key.

  Business position:

      CMS context
        -> TrashedArticle schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{Community, TrashAction}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @threads [:post, :blog, :changelog, :doc]
  @required_fields ~w(trash_action_id community_id thread article_hash_id deleted_at)a
  @optional_fields ~w(deleted_by_id)a

  @type t :: %__MODULE__{}

  schema "trashed_articles" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    field(:thread, Ecto.Enum, values: @threads)
    field(:article_hash_id, Ecto.UUID)
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)
    field(:article, :map, virtual: true)
    field(:mentioned_by_count, :integer, virtual: true, default: 0)

    timestamps(type: :utc_datetime)
  end

  def changeset(trashed_article, attrs) do
    trashed_article
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:hash_id)
    |> unique_constraint([:community_id, :thread, :article_hash_id],
      name: :trashed_articles_logical_article_index
    )
    |> foreign_key_constraint(:trash_action_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:deleted_by_id)
  end
end
