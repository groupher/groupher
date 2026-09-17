defmodule GroupherServer.Jobs.ViewProjection do
  @moduledoc """
  Oban worker that projects one durable article view event batch.

  Business position:

      Oban -> ViewProjection -> CMS.ViewTracker -> ViewSummary + viewer state
  """

  use Oban.Worker,
    queue: GroupherServer.Jobs.Config.queue(:view_projection),
    max_attempts: GroupherServer.Jobs.Config.max_attempts(:view_projection),
    unique: GroupherServer.Jobs.Config.unique(:view_projection)

  alias GroupherServer.CMS.ViewTracker

  @impl Oban.Worker
  def perform(%Oban.Job{args: %{"event_id" => event_id} = args} = job) do
    perform_projection(event_id, Map.get(args, "projection_generation", 1), job)
  end

  defp perform_projection(event_id, generation, job) do
    case ViewTracker.project(event_id, generation) do
      :ok ->
        :ok

      {:error, reason} ->
        if job.attempt >= job.max_attempts do
          ViewTracker.dead_letter(event_id, generation, reason)
          :ok
        else
          ViewTracker.record_failure(event_id, reason, generation)
          {:error, reason}
        end
    end
  rescue
    exception ->
      failure = {exception, __STACKTRACE__}

      if job.attempt >= job.max_attempts do
        ViewTracker.dead_letter(event_id, generation, failure)
        :ok
      else
        ViewTracker.record_failure(event_id, failure, generation)
        {:error, exception}
      end
  catch
    kind, reason ->
      failure = {kind, reason}

      if job.attempt >= job.max_attempts do
        ViewTracker.dead_letter(event_id, generation, failure)
        :ok
      else
        ViewTracker.record_failure(event_id, failure, generation)
        {:error, reason}
      end
  end
end
