defmodule GroupherServer.CMS.Model.TrashedArticle do
  @moduledoc """
  Current Trash membership for one logical Article.

  `article_id` references the stable aggregate root. Draft/Public/Revision rows
  remain owned by that root while it is in Trash.

  Business position:

      CMS context
        -> TrashedArticle schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Article, Community, TrashAction}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @threads CMS.Artiment.Config.threads() -- [:doc]
  @required_fields ~w(
    trash_action_id community_id thread article_id restore_state deleted_at
  )a
  @optional_fields ~w(deleted_by_id)a

  @type t :: %__MODULE__{}

  schema "trashed_articles" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    field(:thread, Ecto.Enum, values: @threads)
    belongs_to(:article, Article, type: Ecto.UUID)
    field(:restore_state, Ecto.Enum, values: [:draft_only, :published, :archived])
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)
    field(:mentioned_by_count, :integer, virtual: true, default: 0)
    field(:command_id, Ecto.UUID, virtual: true)

    timestamps(type: :utc_datetime)
  end

  def changeset(trashed_article, attrs) do
    trashed_article
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:hash_id)
    |> unique_constraint(:article_id,
      name: :trashed_articles_stable_article_index
    )
    |> foreign_key_constraint(:trash_action_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:deleted_by_id)
  end
end
