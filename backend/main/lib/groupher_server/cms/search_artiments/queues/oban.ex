defmodule GroupherServer.CMS.SearchArtiments.Queues.Oban do
  @moduledoc """
  Oban-backed persistent queue for Search Artiments indexing jobs.

  Business position:

      Resolver / Oban
        -> CMS.SearchArtiments
        -> Oban
        -> search platform
  """

  @behaviour GroupherServer.CMS.SearchArtiments.QueueAdapter

  require Logger

  alias GroupherServer.Jobs

  @impl true
  def enqueue(job) do
    if Application.get_env(:groupher_server, :env) == :seed_prod do
      {:ok, :pass}
    else
      enqueue_safely(job)
    end
  end

  defp enqueue_safely({action, thread, ref} = job) do
    case Jobs.search_index(action, thread, ref) do
      {:ok, _job} ->
        {:ok, :pass}

      {:error, reason} ->
        report_failure(job, reason)
        {:ok, :pass}
    end
  rescue
    error ->
      report_failure(job, Exception.format(:error, error, __STACKTRACE__))
      {:ok, :pass}
  catch
    kind, reason ->
      report_failure(job, Exception.format(kind, reason, __STACKTRACE__))
      {:ok, :pass}
  end

  defp report_failure({action, thread, ref}, reason) do
    metadata = %{
      queue: :search,
      action: action,
      thread: thread,
      ref: ref,
      reason: inspect(reason)
    }

    Logger.error("Search indexing job enqueue failed", Map.to_list(metadata))

    :telemetry.execute(
      [:groupher, :search_artiments, :queue, :enqueue],
      %{failures: 1},
      Map.put(metadata, :status, :error)
    )
  end
end
