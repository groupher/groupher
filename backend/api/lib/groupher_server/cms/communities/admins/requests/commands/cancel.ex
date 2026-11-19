defmodule GroupherServer.CMS.Communities.Admins.Requests.Commands.Cancel do
  @moduledoc """
  Cancels a pending Admin request by an involved participant or Community manager.

  The request revision, membership facts, state transition, Activity and Notice
  intent are serialized in one Receipt transaction.

      GraphQL command -> Receipt -> Community-first locks -> cancelled / Activity / Outbox
  """

  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.Admins.{Effects, Requests}
  alias Requests.{Expiration, Locks, Rules}
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}

  defmodule Confirmation do
    @moduledoc """
    Receipt payload schema for replaying an Admin request cancellation.

        cancelled request -> confirmation data -> Receipt replay
    """

    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :community_admin_request_cancel,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :community_admin_request_cancel,
            confirmation: Confirmation,
            target: :community,
            params: [:request_id, :revision]
  receipt_pipeline run(community, request_id, revision, actor, command_id) do
    gate(fn canonical -> authorize_cancel_request(canonical, request_id, actor) end)

    change(fn canonical, operation_ref ->
      cancel_locked(canonical, request_id, revision, actor, operation_ref)
    end)

    confirm(fn request ->
      {:ok, %Confirmation{data: %{"request_id" => request.id, "command_id" => command_id}}}
    end)

    present(fn %Confirmation{data: %{"request_id" => id}} ->
      case Repo.get(CommunityAdminRequest, id) do
        %CommunityAdminRequest{} = request -> {:ok, request}
        nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc """
  Cancels the request at its expected revision when the actor is a participant or manager.

  ## Examples

      Cancel.execute(community, request_id, revision, actor, command_id)
  """
  def execute(
        %Community{} = community,
        request_id,
        revision,
        %User{} = actor,
        command_id
      )
      when is_binary(request_id) and is_integer(revision) and revision > 0 do
    run(community, request_id, revision, actor, command_id)
  end

  def execute(_, _, _, _, _), do: {:error, :invalid_admin_request}

  defp cancel_locked(community, request_id, revision, actor, operation_ref) do
    with %CommunityAdminRequest{} = candidate <-
           Repo.get_by(CommunityAdminRequest, id: request_id, community_id: community.id),
         lords <-
           Repo.all(
             from(a in CommunityAdmin,
               where: a.community_id == ^community.id and a.is_lord == true,
               order_by: a.user_id,
               select: a.user_id
             )
           ),
         users = Enum.uniq([actor.id, candidate.subject_user_id, candidate.created_by_id | lords]),
         {:ok, locked} <- Locks.lock(community.id, users, [candidate.id]),
         [request] <- locked.requests,
         {:ok, result} <- cancel_or_expire(locked, request, revision, actor, operation_ref) do
      {:ok, result}
    else
      nil -> {:error, :request_not_found}
      {:error, _} = error -> error
      _ -> {:error, :invalid_admin_request}
    end
  end

  defp cancel_or_expire(locked, request, revision, actor, operation_ref) do
    now = DateTime.utc_now(:second)

    case Rules.pending(request, revision, now) do
      {:ok, :pass} -> commit_cancel(locked, request, actor, operation_ref, now)
      {:error, :request_expired} -> Expiration.expire(locked, request, operation_ref, 0, now)
      {:error, _} = error -> error
    end
  end

  defp commit_cancel(locked, request, actor, operation_ref, now) do
    with {:ok, cancelled} <-
           request
           |> CommunityAdminRequest.changeset(%{
             status: :cancelled,
             cancelled_by_id: actor.id,
             cancelled_at: now,
             revision: request.revision + 1
           })
           |> Repo.update(),
         member = Enum.find(locked.admins, &(&1.user_id == request.subject_user_id)),
         permissions = if(member, do: member.permissions, else: %{}),
         metadata = %{
           subject_user_id: request.subject_user_id,
           request_id: request.id,
           member_id: if(member, do: member.id, else: nil),
           request_type: request.type,
           proposed_permissions: request.proposed_permissions,
           before_permissions: permissions,
           after_permissions: permissions
         },
         {:ok, _} <-
           Effects.activity(
             locked.community,
             :admin_request_cancelled,
             actor,
             operation_ref,
             0,
             metadata
           ),
         recipients = cancel_recipients(locked, request, actor),
         {:ok, _} <-
           Effects.request_notice(
             locked.community,
             cancelled,
             :cancelled,
             actor,
             recipients,
             operation_ref
           ) do
      {:ok, cancelled}
    end
  end

  defp authorize_cancel_request(community, request_id, actor) do
    case Repo.get_by(CommunityAdminRequest, id: request_id, community_id: community.id) do
      %CommunityAdminRequest{subject_user_id: id} when id == actor.id ->
        {:ok, community}

      %CommunityAdminRequest{created_by_id: id} when id == actor.id ->
        {:ok, community}

      %CommunityAdminRequest{} ->
        CMS.Gate.check_in_transaction(actor, :admin_request_decide, community)

      nil ->
        {:error, :request_not_found}
    end
  end

  defp cancel_recipients(locked, %CommunityAdminRequest{type: :apply} = request, actor) do
    locked.admins
    |> Enum.filter(& &1.is_lord)
    |> Enum.map(& &1.user_id)
    |> Enum.reject(&(&1 == actor.id))
    |> Kernel.++([request.created_by_id])
    |> Enum.uniq()
    |> Enum.reject(&(&1 == actor.id))
  end

  defp cancel_recipients(locked, %CommunityAdminRequest{type: :invite} = request, actor) do
    locked.admins
    |> Enum.filter(& &1.is_lord)
    |> Enum.map(& &1.user_id)
    |> Kernel.++([request.created_by_id, request.subject_user_id])
    |> Enum.uniq()
    |> Enum.reject(&(&1 == actor.id))
  end
end
