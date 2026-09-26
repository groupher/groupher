defmodule GroupherServer.CMS.ViewTracker.Model.ViewCountReceipt do
  @moduledoc """
  Short-lived transport receipt for one Article view attempt.

      event_id claim
        -> PENDING inside the counting transaction
        -> FINALIZED counted decision before commit
        -> bounded Retention cleanup
  """

  use Ecto.Schema

  alias GroupherServer.CMS.Artiment.Threads
  alias GroupherServer.CMS.ViewTracker.Const
  alias Helper.Constant.DBPrefix

  @schema_prefix DBPrefix.cms()
  @primary_key false

  schema "article_view_count_receipts" do
    field(:event_id, Ecto.UUID, primary_key: true, autogenerate: false)
    field(:thread, Ecto.Enum, values: Threads.article_enums())
    field(:article_id, :id)
    field(:viewer_tracking_key, :binary)
    field(:state, Ecto.Enum, values: Const.receipt_states())
    field(:counted, :boolean)
    field(:decision_reason, Ecto.Enum, values: Const.persisted_decision_reasons())
    field(:expires_at, :utc_datetime)

    timestamps(type: :utc_datetime, updated_at: false)
  end
end
