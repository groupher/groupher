defmodule GroupherServer.CMS.CommunityApplications.Jobs.CreateCommunity do
  @moduledoc """
  Creates a Community from one approved Application.

  Business position:

      Apply UI / reviewer
        -> GraphQL resolver
        -> CMS.CommunityApplications
        -> CreateCommunity
        -> Repo / Oban
  """

  use Oban.Worker,
    queue: :community_application,
    max_attempts: 5,
    unique: [period: 86_400, keys: [:application_ref]]

  alias GroupherServer.CMS

  @doc """
  Creates a Community from the approved Application, marking the Application
  as creation-failed once all retries are exhausted.
  """
  @impl Oban.Worker
  def perform(%Oban.Job{
        args: %{"application_ref" => application_ref, "operation_ref" => operation_ref},
        attempt: attempt,
        max_attempts: max_attempts
      }) do
    case CMS.Communities.create_from_application(application_ref, operation_ref) do
      {:ok, _application} ->
        :ok

      {:error, reason} when attempt >= max_attempts ->
        case CMS.CommunityApplications.mark_creation_failed(
               application_ref,
               operation_ref,
               reason
             ) do
          {:ok, _application} -> :ok
          {:error, mark_reason} -> {:error, mark_reason}
        end

      {:error, reason} ->
        {:error, reason}
    end
  end
end
