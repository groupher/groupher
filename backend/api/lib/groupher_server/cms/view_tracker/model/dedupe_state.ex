defmodule GroupherServer.CMS.ViewTracker.Model.DedupeState do
  @moduledoc """
  Current sliding-window admission state for one Article visitor.

      ViewTracker.Record -> DedupeState -> cms.article_view_dedupe_states
  """

  use Ecto.Schema

  alias GroupherServer.CMS.Artiment.Threads
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "article_view_dedupe_states" do
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:viewer_tracking_key, :binary)
    field(:last_counted_at, :utc_datetime)

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
