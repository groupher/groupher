defmodule GroupherServer.CMS.Communities.Admins.Commands.Remove do
  @moduledoc """
  Removes a Community Admin or lets an ordinary Admin leave, cancelling pending requests atomically.

      Community -> Users -> Admins -> requests -> membership / Activity / Notice intent
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}
  alias CMS.Communities.Admins.{Effects, Requests.Locks}

  defmodule Confirmation do
    @moduledoc """
    Receipt confirmation for an Admin membership removal.

        removed membership -> Confirmation -> idempotent replay
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :community_admin_remove,
      data_keys: ["removed"],
      field_types: %{"removed" => :boolean}
  end

  @pipeline operation: :community_admin_remove,
            confirmation: Confirmation,
            target: :community,
            params: [:member_id, :revision]
  receipt_pipeline run(community, member_id, revision, actor, command_id) do
    gate(fn canonical -> authorize(canonical, actor, member_id) end)

    change(fn canonical, operation_ref ->
      remove_locked(canonical, member_id, revision, actor, operation_ref)
    end)

    confirm(fn _ -> {:ok, %Confirmation{data: %{"removed" => true}}} end)
    present(fn %Confirmation{data: %{"removed" => removed}} -> {:ok, removed} end)
  end

  @doc "Removes a selected non-lord Admin or the actor's own ordinary membership."
  def execute(%Community{} = community, member_id, revision, %User{} = actor, command_id)
      when is_integer(member_id) and is_integer(revision) and revision > 0,
      do: run(community, member_id, revision, actor, command_id)

  def execute(_, _, _, _, _), do: {:error, :invalid_admin_removal}

  defp authorize(community, actor, member_id) do
    case Repo.get(CommunityAdmin, member_id) do
      %CommunityAdmin{community_id: id, user_id: user_id, is_lord: false}
      when id == community.id and user_id == actor.id ->
        {:ok, community}

      %CommunityAdmin{community_id: id, is_lord: false} when id == community.id ->
        CMS.Gate.check_in_transaction(actor, :admin_remove, community)

      %CommunityAdmin{is_lord: true} ->
        {:error, :lord_membership_immutable}

      _ ->
        {:error, :admin_not_found}
    end
  end

  defp remove_locked(community, member_id, revision, actor, operation) do
    with %CommunityAdmin{} = candidate <-
           Repo.get_by(CommunityAdmin, id: member_id, community_id: community.id),
         {:ok, locked} <- Locks.lock_member_requests(community.id, actor.id, candidate.user_id),
         %CommunityAdmin{is_lord: false} = member <-
           Enum.find(locked.admins, &(&1.id == member_id)),
         true <- member.revision == revision,
         {:ok, :pass} <- authorize_locked(locked.community, member, actor),
         {:ok, _} <- Repo.delete(member),
         {:ok, _community} <-
           CMS.Communities.Count.update(
             locked.community,
             Enum.find(locked.users, &(&1.id == member.user_id)),
             :moderators_count,
             :dec
           ),
         {:ok, _} <-
           Effects.activity(locked.community, :admin_removed, actor, operation, 0, %{
             subject_user_id: member.user_id,
             member_id: member.id,
             before_permissions: member.permissions,
             after_permissions: %{}
           }),
         {:ok, :pass} <- cancel_requests(locked, actor, operation) do
      {:ok, :removed}
    else
      nil -> {:error, :admin_not_found}
      false -> {:error, :permission_revision_conflict}
      {:error, _} = error -> error
      _ -> {:error, :invalid_admin_removal}
    end
  end

  defp authorize_locked(_community, %CommunityAdmin{user_id: id}, %User{id: id}), do: {:ok, :pass}

  defp authorize_locked(community, _member, actor) do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         true <- scope.global.is_root or scope.community.is_lord do
      {:ok, :pass}
    else
      _ -> {:error, :permission_denied}
    end
  end

  defp cancel_requests(locked, actor, operation) do
    requests = Enum.filter(locked.requests, &(&1.status == :pending))

    requests
    |> Enum.with_index(1)
    |> Enum.reduce_while({:ok, :pass}, fn {request, operation_index}, _acc ->
      now = DateTime.utc_now(:second)

      attrs = %{
        status: :cancelled,
        cancelled_by_id: actor.id,
        cancelled_at: now,
        revision: request.revision + 1
      }

      with {:ok, cancelled} <- request |> CommunityAdminRequest.changeset(attrs) |> Repo.update(),
           {:ok, _} <-
             Effects.activity(
               locked.community,
               :admin_request_cancelled,
               actor,
               operation,
               operation_index,
               %{
                 subject_user_id: request.subject_user_id,
                 request_id: request.id,
                 member_id: nil,
                 request_type: request.type,
                 proposed_permissions: request.proposed_permissions,
                 before_permissions: %{},
                 after_permissions: %{}
               }
             ),
           recipients <- request_recipients(locked, request, actor),
           {:ok, _} <-
             Effects.request_notice(
               locked.community,
               cancelled,
               :cancelled,
               actor,
               recipients,
               operation
             ) do
        {:cont, {:ok, :pass}}
      else
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp request_recipients(locked, request, actor) do
    locked.admins
    |> Enum.filter(& &1.is_lord)
    |> Enum.map(& &1.user_id)
    |> Kernel.++([request.subject_user_id, request.created_by_id])
    |> Enum.uniq()
    |> Enum.reject(&(&1 == actor.id))
  end
end
