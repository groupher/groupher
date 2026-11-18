defmodule GroupherServer.CMS.Communities.Admins.Requests.Commands.Create do
  @moduledoc """
  Creates an Admin invitation or application under a Receipt transaction.

  Gate admission and the Community-first lock plan protect membership and
  pending-request uniqueness; Activity and Outbox intent commit with the request.

      GraphQL command -> Receipt -> Gate -> locked request -> Activity / Outbox
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
    Receipt payload schema for replaying an Admin request creation.

        created request -> confirmation data -> Receipt replay
    """
    use GroupherServer.CMS.Command.ConfirmationDefinition,
      operation: :community_admin_request_create,
      data_keys: ["request_id", "command_id"],
      field_types: %{"request_id" => :string, "command_id" => :string}
  end

  @pipeline operation: :community_admin_request_create,
            confirmation: Confirmation,
            target: :community,
            params: [:subject_user_id, :request_type, :permissions]
  receipt_pipeline run(community, subject_user_id, request_type, permissions, actor, command_id) do
    gate(fn candidate ->
      action = if request_type == :invite, do: :admin_invite, else: :admin_apply
      CMS.Gate.check_in_transaction(actor, action, candidate)
    end)

    change(fn canonical, execution ->
      create_locked(
        canonical,
        subject_user_id,
        request_type,
        permissions,
        actor,
        execution.operation_ref
      )
    end)

    confirm(fn request ->
      {:ok, %Confirmation{data: %{"request_id" => request.id, "command_id" => command_id}}}
    end)

    present(fn %Confirmation{data: %{"request_id" => request_id}} ->
      case Repo.get(CommunityAdminRequest, request_id) do
        %CommunityAdminRequest{} = request -> {:ok, request}
        nil -> {:error, CMS.ErrorCat.command_result_unavailable()}
      end
    end)
  end

  @doc """
  Creates or returns the current pending request, preserving the original proposal.

  ## Examples

      Create.execute(community, subject, :invite, permissions, lord, command_id)
  """
  def execute(
        %Community{} = community,
        %User{id: subject_id},
        type,
        permissions,
        %User{} = actor,
        command_id
      )
      when is_integer(subject_id) and type in [:invite, :apply] and is_map(permissions) do
    if type == :apply and actor.id != subject_id do
      {:error, :invalid_request_subject}
    else
      run(community, subject_id, type, permissions, actor, command_id)
    end
  end

  def execute(_, _, _, _, _, _), do: {:error, :invalid_admin_request}

  defp create_locked(community, subject_id, type, permissions, actor, operation_ref) do
    pending =
      Repo.one(
        from(r in CommunityAdminRequest,
          where:
            r.community_id == ^community.id and r.subject_user_id == ^subject_id and
              r.status == :pending
        )
      )

    lord_ids =
      Repo.all(
        from(a in CommunityAdmin,
          where: a.community_id == ^community.id and a.is_lord == true,
          order_by: a.user_id,
          select: a.user_id
        )
      )

    prior_creator = if pending, do: [pending.created_by_id], else: []
    ids = Enum.uniq([actor.id, subject_id | lord_ids] ++ prior_creator)
    request_ids = if pending, do: [pending.id], else: []

    with {:ok, locked} <- Locks.lock(community.id, ids, request_ids),
         {:ok, :pass} <- validate_admins(locked.admins),
         {:ok, :pass} <- reauthorize(locked.community, actor, type),
         {:ok, proposal} <- Rules.proposal(permissions),
         {:ok, current} <- expire_if_due(locked, List.first(locked.requests), operation_ref),
         {:ok, request} <-
           create_or_existing(locked, current, subject_id, type, proposal, actor, operation_ref) do
      {:ok, request}
    end
  end

  defp validate_admins(admins) do
    Enum.reduce_while(admins, {:ok, :pass}, fn admin, _ ->
      case CMS.Passport.Catalog.validate_permissions(:community, admin.permissions) do
        {:ok, _} -> {:cont, {:ok, :pass}}
        {:error, _} = error -> {:halt, error}
      end
    end)
  end

  defp reauthorize(community, actor, :invite) do
    with {:ok, scope} <- CMS.Passport.load_community_scope(actor, community),
         {:ok, true} <- CMS.Passport.allowed?(actor, scope, "admin.invite") do
      {:ok, :pass}
    else
      _ -> {:error, :permission_denied}
    end
  end

  defp reauthorize(_community, _actor, :apply), do: {:ok, :pass}

  defp expire_if_due(_locked, nil, _operation), do: {:ok, nil}

  defp expire_if_due(locked, request, operation) do
    now = DateTime.utc_now(:second)

    case Rules.expired?(request, now) do
      {:ok, false} ->
        {:ok, request}

      {:ok, true} ->
        with {:ok, _expired} <- Expiration.expire(locked, request, operation, 0, now) do
          {:ok, nil}
        end

      {:error, _} = error ->
        error
    end
  end

  defp create_or_existing(
         _locked,
         %CommunityAdminRequest{} = request,
         _subject,
         _type,
         _proposal,
         _actor,
         _operation
       ),
       do: {:ok, request}

  defp create_or_existing(locked, nil, subject, type, proposal, actor, operation) do
    members = locked.admins
    member = Enum.find(members, &(&1.user_id == subject))
    lords = for admin <- members, admin.is_lord, do: admin.user_id

    cond do
      type == :invite and member != nil ->
        {:error, :already_community_admin}

      type == :apply and lords == [] ->
        {:error, :community_lord_unavailable}

      true ->
        attrs = %{
          community_id: locked.community.id,
          subject_user_id: subject,
          created_by_id: actor.id,
          type: type,
          proposed_permissions: proposal,
          expires_at: DateTime.add(DateTime.utc_now(:second), 604_800)
        }

        recipients = if type == :invite, do: [subject], else: lords

        with {:ok, request} <-
               %CommunityAdminRequest{} |> CommunityAdminRequest.changeset(attrs) |> Repo.insert(),
             {:ok, _} <-
               Effects.activity(
                 locked.community,
                 :admin_request_created,
                 actor,
                 operation,
                 1,
                 event_metadata(request, member)
               ),
             {:ok, _} <-
               Effects.request_notice(
                 locked.community,
                 request,
                 :created,
                 actor,
                 recipients,
                 operation
               ) do
          {:ok, request}
        end
    end
  end

  defp event_metadata(request, member) do
    permissions = if member, do: member.permissions, else: %{}

    %{
      subject_user_id: request.subject_user_id,
      request_id: request.id,
      member_id: if(member, do: member.id, else: nil),
      request_type: request.type,
      proposed_permissions: request.proposed_permissions,
      before_permissions: permissions,
      after_permissions: permissions
    }
  end
end
