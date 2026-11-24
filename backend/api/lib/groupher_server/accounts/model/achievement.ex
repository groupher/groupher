defmodule GroupherServer.Accounts.Model.Achievement do
  @moduledoc """
  Ecto schema for user achievement and reputation counters.

  Account achievement services update this row when social or content actions
  change the user's reputation or contribution-derived badges.

  Business position:

      Accounts context
        -> Achievement schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.Accounts
  alias Accounts.Model.{SourceContribute, User}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.account()

  @required_fields ~w(user_id)a
  @optional_fields ~w(articles_upvotes_count articles_collects_count contents_watched_count followers_count reputation)a

  @type t :: %Achievement{}
  schema "achievements" do
    belongs_to(:user, User)

    field(:articles_upvotes_count, :integer, default: 0)
    field(:articles_collects_count, :integer, default: 0)
    field(:contents_watched_count, :integer, default: 0)
    field(:followers_count, :integer, default: 0)
    field(:reputation, :integer, default: 0)
    # source_contribute
    embeds_one(:source_contribute, SourceContribute, on_replace: :delete)

    timestamps(type: :utc_datetime)
  end

  @doc """
  Requires a user ID and casts achievement counters and reputation. Database constraint errors
  are attached to `:user_id` for an unknown user or a second achievement row for that user.
  """
  def changeset(%Achievement{} = achievement, attrs) do
    achievement
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id, name: :achievements_user_id_index)
  end

  @doc """
  Casts changes to counters, reputation, or the user ID without requiring the ID again.
  The user foreign key and one-row-per-user constraint still apply.
  """
  def update_changeset(%Achievement{} = achievement, attrs) do
    achievement
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id, name: :achievements_user_id_index)
  end
end
