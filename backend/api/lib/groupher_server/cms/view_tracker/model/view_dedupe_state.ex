defmodule GroupherServer.CMS.ViewTracker.Model.ViewDedupeState do
  @moduledoc """
  Sliding-window state for one Article and stable viewer identity.

      policy-allowed view
        -> conditional UPSERT
        -> ViewDedupeState
        -> counted or duplicate

  `last_counted_at` owns business deduplication. `expires_at` only schedules
  cleanup after the actor window and its safety margin have elapsed.
  """

  use Ecto.Schema

  alias GroupherServer.CMS
  alias CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "article_view_dedupe_states" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, Ecto.UUID)
    field(:viewer_tracking_key, :binary)
    field(:last_counted_at, :utc_datetime)
    field(:expires_at, :utc_datetime)

    timestamps(type: :utc_datetime)
  end
end
