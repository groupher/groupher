defmodule GroupherServer.CMS.Model.CommunityTagGroup do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Artiment.Threads
  alias CMS.Model.{Community, CommunityTag}
  alias Helper.Constant.DBPrefix

  @required_fields ~w(thread title community_id)a
  @updatable_fields ~w(title index)a

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityTagGroup{}
  schema "community_tag_groups" do
    field(:title, :string)
    field(:thread, Ecto.Enum, values: Threads.enums())
    field(:index, :integer, default: 0)

    belongs_to(:community, Community)
    has_many(:tags, CommunityTag, foreign_key: :group_id)

    timestamps(type: :utc_datetime)
  end

  def changeset(%CommunityTagGroup{} = group, attrs) do
    group
    |> cast(attrs, @required_fields ++ @updatable_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint(:title, name: :community_tag_groups_community_id_thread_title_index)
  end

  def update_changeset(%CommunityTagGroup{} = group, attrs) do
    group
    |> cast(attrs, @updatable_fields)
    |> validate_required([:title])
    |> unique_constraint(:title, name: :community_tag_groups_community_id_thread_title_index)
  end
end
