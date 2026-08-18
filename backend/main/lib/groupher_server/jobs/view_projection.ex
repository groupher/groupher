defmodule GroupherServer.Jobs.ViewProjection do
  @moduledoc """
  Oban worker that projects one durable article view event batch.

  Business position:

      Oban -> ViewProjection -> CMS.Interactions.ViewEvents -> article views + bitmap
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:view_projection),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:view_projection),
    unique: GroupherServer.Jobs.Config.unique(:view_projection)

  alias GroupherServer.CMS.Interactions.ViewEvents

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id}}) do
    case ViewEvents.project(event_id) do
      :ok ->
        :ok

      {:error, reason} ->
        ViewEvents.record_failure(event_id, reason)
        {:error, reason}
    end
  end
end
