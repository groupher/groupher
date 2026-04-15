defmodule GroupherServer.CMS.Model.CommunityTag do
  @moduledoc false
  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Helper.Threads
  alias CMS.Model.{Author, Community}
  alias CMS.Model.Metrics.Dashboard
  alias Helper.Constant.DBPrefix
  alias Helper.Validator.Slug

  @required_fields ~w(thread title color author_id community_id slug)a
  @updatable_fields ~w(thread title desc color community_id group extra icon slug index layout)a

  @schema_prefix DBPrefix.cms()

  @type t :: %CommunityTag{}
  schema "community_tags" do
    field(:title, :string)
    field(:desc, :string)
    field(:slug, :string)
    field(:color, Ecto.Enum, values: Dashboard.rainbow_colors())
    field(:thread, Ecto.Enum, values: Threads.enums())
    field(:group, :string)
    field(:extra, {:array, :string})
    field(:icon, :string)
    field(:index, :integer)
    field(:layout, :string)

    belongs_to(:community, Community)
    belongs_to(:author, Author)

    timestamps(type: :utc_datetime)
  end

  def changeset(%CommunityTag{} = tag, attrs) do
    tag
    |> cast(attrs, @required_fields ++ @updatable_fields)
    |> validate_required(@required_fields)
    |> Slug.validate_changeset(:slug)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:community_id)
  end

  def update_changeset(%CommunityTag{} = tag, attrs) do
    tag
    |> cast(attrs, @updatable_fields)
    |> Slug.validate_changeset(:slug)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:community_id)
  end
end
