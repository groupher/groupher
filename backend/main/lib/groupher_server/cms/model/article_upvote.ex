defmodule GroupherServer.CMS.Model.ArticleUpvote do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema

  import Ecto.Changeset
  import Helper.Utils, only: [get_config: 2]
  import GroupherServer.CMS.Helper.Macros

  import GroupherServer.CMS.Helper.Constraints,
    only: [
      articles_exactly_one_ref_constraint: 2,
      articles_foreign_key_constraint: 1,
      articles_thread_matches_ref_constraint: 2,
      articles_upvote_unique_key_constraint: 1
    ]

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @threads get_config(:article, :threads)

  @required_fields ~w(user_id)a
  @optional_fields ~w(thread)a
  @article_fields @threads |> Enum.map(&:"#{&1}_id")

  @type t :: %ArticleUpvote{}
  schema "article_upvotes" do
    # for user-center to filter
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    belongs_to(:user, User, foreign_key: :user_id)

    article_belongs_to_fields()
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%ArticleUpvote{} = article_upvote, attrs) do
    article_upvote
    |> cast(attrs, @optional_fields ++ @required_fields ++ @article_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:user_id)
    |> articles_upvote_unique_key_constraint
    |> articles_foreign_key_constraint
    |> articles_exactly_one_ref_constraint(:article_upvotes)
    |> articles_thread_matches_ref_constraint(:article_upvotes)
  end
end
