defmodule GroupherServer.CMS.Model.CommunityModerator do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  alias GroupherServer.{Accounts, CMS}

  alias Accounts.Model.User
  alias CMS.Model.Community

  @schema_prefix DBPrefix.cms()

  @optional_fields ~w(passport_item_count)a
  @required_fields ~w(user_id community_id)a

  @type t :: %CommunityModerator{}

  schema "communities_moderators" do
    field(:passport_item_count, :integer)
    belongs_to(:user, User, foreign_key: :user_id)
    belongs_to(:community, Community, foreign_key: :community_id)

    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(%CommunityModerator{} = community_moderator, attrs) do
    community_moderator
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> foreign_key_constraint(:user_id)
    |> unique_constraint(:user_id, name: :communities_editors_user_id_community_id_index)
  end

  def update_changeset(%CommunityModerator{} = community_moderator, attrs) do
    community_moderator
    |> cast(attrs, @optional_fields)
  end
end
