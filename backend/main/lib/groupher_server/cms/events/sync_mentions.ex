defmodule GroupherServer.CMS.Events.SyncMentions do
  @moduledoc false

  alias GroupherServer.CMS
  alias CMS.Events.Event

  @behaviour GroupherServer.CMS.Events.Handler

  @impl true
  def handle(%Event{type: :sync_mentions, payload: %{artiment: artiment}}) do
    CMS.ArtimentMentions.sync(artiment)
  end
end
