defmodule GroupherServer.CMS.Model.TrashedDocArticle do
  @moduledoc """
  Branch-local Trash membership for one Doc identity.

  Doc article -> TrashAction membership -> restore target or permanent deletion
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.{Article, Community, DocBranch, TrashAction}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @required_fields ~w(trash_action_id community_id branch_id article_id restore_state deleted_at)a
  @optional_fields ~w(deleted_by_id)a
  @type t :: %__MODULE__{}

  schema "trashed_doc_articles" do
    field(:hash_id, Ecto.UUID, autogenerate: true)
    belongs_to(:trash_action, TrashAction)
    belongs_to(:community, Community)
    belongs_to(:branch, DocBranch)
    belongs_to(:stable_article, Article, foreign_key: :article_id, type: Ecto.UUID)
    field(:restore_state, Ecto.Enum, values: [:draft_only, :published, :archived])
    belongs_to(:deleted_by, User)
    field(:deleted_at, :utc_datetime)
    field(:article, :map, virtual: true)
    field(:mentioned_by_count, :integer, virtual: true, default: 0)
    timestamps(type: :utc_datetime)
  end

  def changeset(%__MODULE__{} = item, attrs) do
    item
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> unique_constraint(:hash_id)
    |> unique_constraint([:article_id, :branch_id],
      name: :trashed_doc_articles_article_branch_index
    )
    |> foreign_key_constraint(:trash_action_id)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:branch_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:deleted_by_id)
  end
end
