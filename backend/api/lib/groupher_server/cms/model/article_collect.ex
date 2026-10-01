defmodule GroupherServer.CMS.Model.ArticleCollect do
  @moduledoc """
  Ecto schema for article collect/bookmark rows.

  Each row binds a user to one concrete artiment thread item. Account collect
  folders may embed references to these rows for grouped collection views.

  Business position:

      CMS context
        -> ArticleCollect schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias CMS.Artiment.Threads
  alias CMS.Model.{Article, DocBranch}
  alias Accounts.Model.{CollectFolder, User}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @required_fields ~w(user_id article_id thread)a
  @optional_fields ~w(branch_id)a

  @type t :: %ArticleCollect{}
  schema "article_collects" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    belongs_to(:user, User, foreign_key: :user_id)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)
    embeds_many(:collect_folders, CollectFolder, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%ArticleCollect{} = article_collect, attrs) do
    article_collect
    |> cast(
      attrs,
      @required_fields ++ @optional_fields
    )
    |> validate_required(@required_fields)
    |> cast_embed(:collect_folders, with: &CollectFolder.changeset/2)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:user_id, :article_id, :branch_id],
      name: :article_collects_user_stable_article_index
    )
  end
end
