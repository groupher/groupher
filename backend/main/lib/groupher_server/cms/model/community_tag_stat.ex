defmodule GroupherServer.CMS.Model.CommunityTagStat do
  @moduledoc false

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS
  alias CMS.Helper.Threads
  alias CMS.Model.{Community, CommunityTag}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @required_fields ~w(community_tag_id community_id thread)a
  @optional_fields ~w(contents_count today_contents_count today_stat_date rank last_posted_at)a

  @type t :: %__MODULE__{}
  schema "community_tag_stats" do
    field(:thread, Ecto.Enum, values: Threads.article_values_list())
    field(:contents_count, :integer, default: 0)
    field(:today_contents_count, :integer, default: 0)
    field(:today_stat_date, :date)
    field(:rank, :integer)
    field(:last_posted_at, :utc_datetime)

    belongs_to(:community_tag, CommunityTag)
    belongs_to(:community, Community)

    timestamps(type: :utc_datetime)
  end

  def changeset(%__MODULE__{} = stat, attrs) do
    stat
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> foreign_key_constraint(:community_tag_id)
    |> foreign_key_constraint(:community_id)
    |> unique_constraint(:community_tag_id)
  end
end
