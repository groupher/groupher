defmodule GroupherServer.CMS.Communities.Jobs.Setup do
  @moduledoc """
  Runs idempotent initialization for a newly created Community.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Setup
        -> Repo / Oban
  """

  use Oban.Worker,
    queue: :community_setup,
    max_attempts: 5,
    unique: [period: 86_400, keys: [:application_ref]]

  alias GroupherServer.CMS

  @doc """
  Runs idempotent Community setup, marking the Application as failed once
  all retries are exhausted.
  """
  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{
          "community_ref" => community_ref,
          "application_ref" => application_ref,
          "operation_ref" => operation_ref
        },
        attempt: attempt,
        max_attempts: max_attempts
      }) do
    case CMS.Communities.run_setup(community_ref, operation_ref) do
      {:ok, _application} ->
        :ok

      {:error, reason} when attempt >= max_attempts ->
        case CMS.Communities.mark_setup_failed(application_ref, operation_ref, reason, attempt) do
          {:ok, _application} -> :ok
          {:error, mark_reason} -> {:error, mark_reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end
end
