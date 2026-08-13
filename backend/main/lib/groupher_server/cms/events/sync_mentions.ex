defmodule GroupherServer.CMS.Events.SyncMentions do
  @moduledoc """
  Event handler that refreshes mention facts after content changes.

      CMS event bus
          |
          v
      %Event{type: :sync_mentions, payload: %{artiment: ...}}
          |
          v
      CMS.ArtimentMentions.sync/1

  The event payload carries the article or comment that changed. The handler is
  intentionally thin so parsing, persistence, and notification decisions remain
  owned by the mention domain modules.

  Business position:

      Domain write
        -> CMS.Events
        -> SyncMentions
        -> bounded side effect
  """

  alias GroupherServer.CMS
  alias CMS.Events.Event

  @behaviour GroupherServer.CMS.Events.Handler

  @impl true
  def handle(%Event{type: :sync_mentions, payload: %{artiment: artiment}}) do
    CMS.ArtimentMentions.sync(artiment)
  end
end
