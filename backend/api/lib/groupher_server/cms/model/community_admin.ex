defmodule GroupherServer.CMS.Model.CommunityAdmin do
  @moduledoc """
  Stores a user's current Community membership and scope-specific Passport facts.

      Community Command -> Passport Store -> CommunityAdmin
  """
  use Ecto.Schema
  use Flop.Schema
  import Ecto.Changeset

  @flop_options [filterable: [], sortable: [:inserted_at, :id], pagination_types: [:page, :first]]

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @type t :: %__MODULE__{}

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.Community

  schema "communities_admins" do
    belongs_to(:user, User)
    belongs_to(:community, Community)
    field(:is_lord, :boolean, default: false)
    field(:permissions, :map, default: %{})
    field(:revision, :integer, default: 1)
    field(:joined_at, :utc_datetime, read_after_writes: true)
    timestamps(type: :utc_datetime)
  end

  @doc false
  def changeset(admin, attrs) do
    admin
    |> cast(attrs, [:user_id, :community_id, :is_lord, :permissions, :revision, :joined_at])
    |> validate_required([:user_id, :community_id, :permissions, :revision])
    |> validate_number(:revision, greater_than: 0)
    |> unique_constraint(:user_id, name: :communities_editors_user_id_community_id_index)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:community_id)
    |> check_constraint(:revision, name: :communities_admins_revision_check)
  end
end
