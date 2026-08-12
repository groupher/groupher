defmodule GroupherServer.CMS.Model.CommunityApplicationLogoUpload do
  @moduledoc "Temporary application-owned logo upload before a Community exists."

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.Accounts.Model.User
  alias GroupherServer.CMS.Model.{CommunityApplication, CommunityAsset}
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @timestamps_opts [type: :utc_datetime]
  @statuses ~w(pending finalized promoted expired)a
  @required_fields ~w(public_ref user_id filename mime_type size_bytes status expires_at)a
  @optional_fields ~w(
    application_id storage storage_key url content_hash community_asset_id finalized_at promoted_at
  )a

  @type t :: %__MODULE__{}

  schema "community_application_logo_uploads" do
    field(:public_ref, :string)
    belongs_to(:user, User)
    belongs_to(:application, CommunityApplication)
    belongs_to(:community_asset, CommunityAsset)
    field(:storage, :string)
    field(:storage_key, :string)
    field(:url, :string)
    field(:content_hash, :string)
    field(:filename, :string)
    field(:mime_type, :string)
    field(:size_bytes, :integer)
    field(:status, Ecto.Enum, values: @statuses, default: :pending)
    field(:expires_at, :utc_datetime)
    field(:finalized_at, :utc_datetime)
    field(:promoted_at, :utc_datetime)
    timestamps(type: :utc_datetime)
  end

  @spec changeset(t(), map()) :: Ecto.Changeset.t()
  def changeset(%__MODULE__{} = upload, attrs) do
    upload
    |> cast(attrs, @required_fields ++ @optional_fields)
    |> validate_required(@required_fields)
    |> validate_inclusion(:status, @statuses)
    |> validate_number(:size_bytes, greater_than: 0, less_than_or_equal_to: 10 * 1024 * 1024)
    |> validate_length(:filename, min: 1, max: 255)
    |> validate_length(:mime_type, min: 1, max: 120)
    |> foreign_key_constraint(:user_id)
    |> foreign_key_constraint(:application_id)
    |> foreign_key_constraint(:community_asset_id)
    |> unique_constraint(:public_ref)
  end
end
