defmodule GroupherServer.CMS.Communities.Admins.Requests.Commands.Decide do
  @moduledoc """
  Decides a locked Admin request and atomically applies approved permissions.

  Gate admission, request revision, membership and durable effects share the
  Receipt transaction.

      GraphQL command -> Receipt -> Gate -> locked decision -> member / Activity / Outbox
  """
  use GroupherServer.CommandPipeline, adapter: GroupherServer.CMS.CommandPipelineAdapter
  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.{Admins.Effects, Count}
  alias CMS.Communities.Admins.Requests.{Expiration, Locks, Rules}
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}
  alias CMS.Passport.Scope.CommunityGrant

  defmodule Confirmation do
    @moduledoc """
    Receipt payload schema for replaying an Admin request decision.

        decided request -> confirmation data -> Receipt replay
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :community_admin_request_decide,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :community_admin_request_decide,
            confirmation: Confirmation,
            target: :community,
            params: [:request_id, :revision, :decision, :approved]
  receipt_pipeline run(community, request_id, revision, decision, approved, actor, command_id) do
    gate(fn candidate ->
      CMS.Gate.check_in_transaction(actor, :admin_request_decide, candidate)
    end)

    change(fn canonical, operation_ref ->
      decide_locked(
        canonical,
        request_id,
        revision,
        decision,
        approved,
        actor,
        operation_ref
      )
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
  Accepts or rejects the current request at its expected revision.

  ## Examples

      Decide.execute(community, request_id, revision, :accept, approved, lord, command_id)
  """
  def execute(
        %Community{} = community,
        request_id,
        revision,
        decision,
        approved,
        %User{} = actor,
        command_id
      )
      when is_binary(request_id) and is_integer(revision) and revision > 0 and
             decision in [:accept, :reject] do
    if (decision == :accept and is_map(approved)) or (decision == :reject and is_nil(approved)) do
      run(community, request_id, revision, decision, approved, actor, command_id)
    else
      {:error, :invalid_request_approval}
    end
  end

  def execute(_, _, _, _, _, _, _), do: {:error, :invalid_admin_request}

  defp decide_locked(community, request_id, revision, decision, approved, actor, operation) do
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
         {:ok, :pass} <- authorize_decision(locked.community, request, actor),
         {:ok, result} <-
           decide_or_expire(locked, request, revision, decision, approved, actor, operation) do
      {:ok, result}
    else
      nil -> {:error, :request_not_found}
      {:error, _} = error -> error
      _ -> {:error, :invalid_admin_request}
    end
  end

  defp authorize_decision(
         _community,
         %CommunityAdminRequest{type: :invite, subject_user_id: id},
         %User{id: id}
       ),
       do: {:ok, :pass}

  defp authorize_decision(community, %CommunityAdminRequest{type: :apply}, %User{} = actor) do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, "admin.invite") do
      {:ok, :pass}
    else
      _ -> {:error, :permission_denied}
    end
  end

  defp authorize_decision(_, _, _), do: {:error, :permission_denied}

  defp decide_or_expire(locked, request, revision, decision, approved, actor, operation) do
    now = DateTime.utc_now(:second)

    case Rules.pending(request, revision, now) do
      {:ok, :pass} -> commit_decision(locked, request, decision, approved, actor, operation, now)
      {:error, :request_expired} -> Expiration.expire(locked, request, operation, 0, now)
      {:error, _} = error -> error
    end
  end

  defp commit_decision(locked, request, decision, approved, actor, operation, now) do
    member = Enum.find(locked.admins, &(&1.user_id == request.subject_user_id))
    before = if member, do: member.permissions, else: %{}

    with {:ok, before} <- CMS.Passport.Catalog.validate_permissions(:community, before),
         {:ok, granted} <- approval(request, decision, approved),
         {:ok, updated_member} <-
           apply_approval(locked, member, request.subject_user_id, decision, granted),
         after_permissions = if(updated_member, do: updated_member.permissions, else: before),
         {:ok, decided} <-
           request
           |> CommunityAdminRequest.changeset(%{
             status: :decided,
             decision: decision,
             decided_by_id: actor.id,
             decided_at: now,
             approved_permissions: granted,
             revision: request.revision + 1
           })
           |> Repo.update(),
         {:ok, :pass} <-
           member_activity(
             locked.community,
             member,
             updated_member,
             decided,
             actor,
             operation,
             before,
             after_permissions
           ),
         metadata = %{
           subject_user_id: request.subject_user_id,
           request_id: request.id,
           member_id: if(updated_member, do: updated_member.id, else: nil),
           request_type: request.type,
           decision: decision,
           proposed_permissions: request.proposed_permissions,
           approved_permissions: granted,
           before_permissions: before,
           after_permissions: after_permissions
         },
         {:ok, _} <-
           Effects.activity(
             locked.community,
             :admin_request_decided,
             actor,
             operation,
             1,
             metadata
           ),
         {:ok, recipients} <- result_recipients(locked, request, actor),
         {:ok, _} <-
           Effects.request_notice(
             locked.community,
             decided,
             :decided,
             actor,
             recipients,
             operation
           ) do
      {:ok, decided}
    end
  end

  defp approval(request, :accept, approved), do: Rules.approve(request, approved)
  defp approval(_request, :reject, nil), do: {:ok, nil}

  defp apply_approval(_locked, member, _subject, :reject, nil), do: {:ok, member}

  defp apply_approval(locked, member, subject_id, :accept, granted) do
    subject = Enum.find(locked.users, &(&1.id == subject_id))

    with %User{} <- subject,
         {:ok, member} <- ensure_member(locked.community, member, subject),
         scope = %CommunityGrant{
           subject_id: subject_id,
           community_id: locked.community.id,
           member: member
         },
         {:ok, updated} <-
           CMS.Passport.grant_in_transaction(subject, scope, granted, member.revision) do
      {:ok, updated}
    else
      nil -> {:error, :invalid_request_subject}
      {:error, _} = error -> error
    end
  end

  defp ensure_member(_community, %CommunityAdmin{} = member, _subject), do: {:ok, member}

  defp ensure_member(community, nil, subject) do
    with {:ok, member} <-
           %CommunityAdmin{}
           |> CommunityAdmin.changeset(%{community_id: community.id, user_id: subject.id})
           |> Repo.insert(),
         {:ok, _} <- Count.update(community, subject, :moderators_count, :inc) do
      {:ok, member}
    end
  end

  defp member_activity(_community, _before, nil, _request, _actor, _operation, _old, _new),
    do: {:ok, :pass}

  defp member_activity(
         _community,
         %CommunityAdmin{} = before,
         %CommunityAdmin{} = after_member,
         _request,
         _actor,
         _operation,
         old,
         new
       )
       when before.id == after_member.id and old == new, do: {:ok, :pass}

  defp member_activity(community, before, after_member, request, actor, operation, old, new) do
    action = if is_nil(before), do: :admin_joined, else: :admin_permissions_changed

    metadata = %{
      subject_user_id: request.subject_user_id,
      request_id: request.id,
      member_id: after_member.id,
      before_permissions: old,
      after_permissions: new
    }

    case Effects.activity(community, action, actor, operation, 0, metadata) do
      {:ok, _} -> {:ok, :pass}
      {:error, _} = error -> error
    end
  end

  defp result_recipients(_locked, %CommunityAdminRequest{type: :apply} = request, actor) do
    {:ok, Enum.reject([request.subject_user_id], &(&1 == actor.id))}
  end

  defp result_recipients(locked, %CommunityAdminRequest{type: :invite} = request, actor) do
    lords = for admin <- locked.admins, admin.is_lord, do: admin.user_id

    case CMS.Passport.system_root?(request.created_by_id) do
      {:ok, root?} ->
        creator = if root?, do: [request.created_by_id], else: []
        {:ok, Enum.uniq(lords ++ creator) |> Enum.reject(&(&1 == actor.id))}

      {:error, _} = error ->
        error
    end
  end
end
