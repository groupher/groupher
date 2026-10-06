defmodule GroupherServer.CMS.Model.ArticleUpvote do
  @moduledoc """
  Ecto schema for article upvote rows.

  The schema enforces one upvote per user/source item and lets article counters
  and user achievement reputation be updated from a durable relation.

  Business position:

      CMS context
        -> ArticleUpvote schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset
  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Artiment.Threads
  alias CMS.Model.{Article, DocBranch}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(user_id article_id thread)a
  @optional_fields ~w(branch_id)a

  @type t :: %ArticleUpvote{}
  schema "article_upvotes" do
    # for user-center to filter
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    belongs_to(:user, User, foreign_key: :user_id)
    belongs_to(:article, Article, type: Ecto.UUID)
    belongs_to(:branch, DocBranch)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%ArticleUpvote{} = article_upvote, attrs) do
    article_upvote
    |> cast(
      attrs,
      @required_fields ++ @optional_fields
    )
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:article_id)
    |> foreign_key_constraint(:branch_id)
    |> unique_constraint([:user_id, :article_id, :branch_id],
      name: :article_upvotes_user_stable_article_index
    )
  end
end
