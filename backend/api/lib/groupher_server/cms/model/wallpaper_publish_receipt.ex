defmodule GroupherServer.CMS.Model.WallpaperPublishReceipt do
  @moduledoc """
  Short-lived command receipt written with a successful Wallpaper publish.

  Browser publish
    -> Phoenix transaction
    -> WallpaperPublishReceipt
    -> idempotent response replay
  """

  use Ecto.Schema

  import Ecto.Changeset

  alias GroupherServer.CMS

  alias CMS.Model.Community
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()

  schema "wallpaper_publish_receipts" do
    belongs_to(:community, Community)
    field(:command_id, :string)
    field(:request_digest, :string)
    field(:request_digest_version, :integer)
    field(:response_payload, :map)
    field(:expires_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end

  @doc "Validates the durable response snapshot used for command replay."
  def changeset(receipt, attrs) do
    receipt
    |> cast(attrs, [
      :community_id,
      :command_id,
      :request_digest,
      :request_digest_version,
      :response_payload,
      :expires_at
    ])
    |> validate_required([
      :community_id,
      :command_id,
      :request_digest,
      :request_digest_version,
      :response_payload,
      :expires_at
    ])
    |> validate_number(:request_digest_version, greater_than: 0)
    |> unique_constraint([:community_id, :command_id],
      name: :wallpaper_publish_receipts_community_id_command_id_index
    )
  end
end
