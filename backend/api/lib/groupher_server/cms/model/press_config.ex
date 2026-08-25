defmodule GroupherServer.CMS.Model.PressConfig do
  @moduledoc """
  Community-scoped public output settings owned by CMS.Press.

  Business position:

      CMS context
        -> PressConfig schema/changeset
        -> GroupherServer.Repo
        -> PostgreSQL
  """

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias GroupherServer.CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @threads ~w(post blog changelog doc)
  @fields ~w(markdown_enabled feed_enabled feed_type feed_count feed_threads llms_enabled sitemap_enabled revision)a

  @type t :: %__MODULE__{}

  schema "press_configs" do
    belongs_to(:community, Community)
    field(:markdown_enabled, :boolean, default: true)
    field(:feed_enabled, :boolean, default: false)
    field(:feed_type, Ecto.Enum, values: [:digest, :full], default: :digest)
    field(:feed_count, :integer, default: 20)
    field(:feed_threads, {:array, :string}, default: [])
    field(:llms_enabled, :boolean, default: true)
    field(:sitemap_enabled, :boolean, default: true)
    field(:revision, :integer, default: 1)

    timestamps(type: :utc_datetime)
  end

  def changeset(config, attrs) do
    config
    |> cast(attrs, [:community_id | @fields])
    |> validate_required([:community_id | @fields])
    |> validate_number(:feed_count, greater_than_or_equal_to: 5, less_than_or_equal_to: 50)
    |> validate_subset(:feed_threads, @threads)
    |> validate_feed_threads()
    |> unique_constraint(:community_id)
    |> foreign_key_constraint(:community_id)
  end

  defp validate_feed_threads(changeset) do
    if get_field(changeset, :feed_enabled) && get_field(changeset, :feed_threads) == [] do
      add_error(changeset, :feed_threads, "must select at least one thread when Feed is enabled")
    else
      changeset
    end
  end
end
