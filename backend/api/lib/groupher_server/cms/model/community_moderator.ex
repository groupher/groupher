defmodule GroupherServer.CMS.Model.CommunityModerator do
  @moduledoc """
  Ecto schema for community moderator membership.

  Moderator rows grant community-level permissions and back account surfaces that
  list where a user can moderate.

  Business position:

      CMS context
        -> CommunityModerator schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias __MODULE__
  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  @optional_fields ~w(passport_item_count)a
  @required_fields ~w(user_id community_id)a

  @type t :: %CommunityModerator{}

  use Flop.Schema
  @flop_options [filterable: [], sortable: [:inserted_at, :id], pagination_types: [:page, :first]]
  # Community membership is now stored in `communities_admins`. Keep this
  # schema as the compatibility mapping used by the moderator-facing API until
  # those legacy callers are migrated to Passport directly.
  schema "communities_admins" do
    field(:is_root, :boolean, virtual: true, default: false)
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
    |> foreign_key_constraint(:community_id, name: :communities_admins_community_id_fkey)
    |> foreign_key_constraint(:user_id, name: :communities_admins_user_id_fkey)
    |> unique_constraint(:user_id, name: :communities_editors_user_id_community_id_index)
  end

  def update_changeset(%CommunityModerator{} = community_moderator, attrs) do
    community_moderator
    |> cast(attrs, @optional_fields)
  end
end
