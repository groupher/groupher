defmodule GroupherServer.CMS.Outbox.Workflow.ArtimentReview do
  @moduledoc """
  Runs CMS review request Effects and keeps transient failures retryable.

  Business position:

      CMS transaction writes review Effect
        -> Outbox lease and retry
          -> CMS.Review.Requests.process/1
  """

  alias GroupherServer.{CMS, ErrorCat, Repo}
  alias CMS.Outbox

  @doc "Executes one request Effect through the shared Outbox lease and retry protocol."
  @spec perform(Oban.Job.t()) :: Oban.Worker.result()
  def perform(%Oban.Job{args: %{"event_id" => event_id}} = job) do
    final_attempt? = job.attempt >= job.max_attempts

    case Outbox.execute(event_id, fn event -> deliver(event, final_attempt?) end,
           on_error: if(final_attempt?, do: :fail, else: :classify)
         ) do
      {:ok, _value} ->
        {:ok, :pass}

      {:busy, seconds} ->
        {:snooze, seconds}

      {:error, %ErrorCat.Error{namespace: {:cms}, reason: :outbox_delivery_exhausted}} ->
        {:ok, :pass}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp deliver(event, final_attempt?) do
    case CMS.Review.Requests.process(event.resource_id) do
      {:ok, result} ->
        {:ok, result}

      {:error, reason} = error ->
        if final_attempt? or terminal_error?(reason) do
          _ = mark_failed(event.resource_id, reason)
        end

        error
    end
  end

  defp terminal_error?(%ErrorCat.Error{retryable: false}), do: true
  defp terminal_error?(_reason), do: false

  defp mark_failed(request_id, reason) do
    Repo.transaction(fn ->
      CMS.Review.Requests.fail_in_transaction(request_id, %{
        "code" => failure_code(reason),
        "message" => "The automated review could not be completed."
      })
    end)
  end

  defp failure_code(%ErrorCat.Error{code: code}) when is_integer(code) do
    Integer.to_string(code)
  end

  defp failure_code(reason) when is_atom(reason), do: Atom.to_string(reason)
  defp failure_code(_reason), do: "review_failed"
end
