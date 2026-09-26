defmodule GroupherServer.CMS.ViewTracker.Model.ViewWatermark do
  @moduledoc """
  Sliding-window state for one Article and stable viewer identity.

      eligible view
        -> conditional UPSERT
        -> ViewWatermark
        -> counted or duplicate-in-window decision
  """

  use Ecto.Schema

  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "article_view_watermarks" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:viewer_tracking_key, :binary)
    field(:last_counted_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end
end
