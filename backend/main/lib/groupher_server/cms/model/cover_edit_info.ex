defmodule GroupherServer.CMS.Model.CoverEditInfo do
  @moduledoc false

  alias __MODULE__

  use Ecto.Schema
  use Accessible

  import Ecto.Changeset

  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]

  @required_fields ~w(canvas_width canvas_height ratio)a
  @optional_fields ~w(version)a

  @type t :: %CoverEditInfo{}

  schema "cover_edit_infos" do
    field(:canvas_width, :integer)
    field(:canvas_height, :integer)
    field(:ratio, :float)
    field(:version, :integer, default: 1)

    embeds_one(:light, __MODULE__.CoverConfig, on_replace: :update)
    embeds_one(:dark, __MODULE__.CoverConfig, on_replace: :update)

    timestamps(type: :utc_datetime)
  end

  def changeset(%CoverEditInfo{} = info, attrs) do
    info
    |> cast(attrs, @optional_fields ++ @required_fields)
    |> validate_required(@required_fields)
    |> validate_number(:canvas_width, greater_than: 0)
    |> validate_number(:canvas_height, greater_than: 0)
    |> validate_number(:ratio, greater_than: 0)
    |> validate_number(:version, greater_than: 0)
    |> cast_embed(:light, required: true, with: &__MODULE__.CoverConfig.changeset/2)
    |> cast_embed(:dark, required: true, with: &__MODULE__.CoverConfig.changeset/2)
  end

  def update_changeset(%CoverEditInfo{} = info, attrs), do: changeset(info, attrs)

  defmodule CoverConfig do
    @moduledoc false

    use Ecto.Schema
    use Accessible

    import Ecto.Changeset

    @required_fields ~w(background_id images)a
    @optional_fields ~w(original_background_id)a

    @primary_key false
    embedded_schema do
      field(:background_id, :id)
      field(:original_background_id, :id)
      field(:images, {:array, :map}, default: [])
    end

    def changeset(config, attrs) do
      config
      |> cast(attrs, @optional_fields ++ @required_fields)
      |> validate_required(@required_fields)
      |> validate_length(:images, max: 2)
    end
  end
end
