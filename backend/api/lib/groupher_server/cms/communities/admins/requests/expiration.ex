defmodule GroupherServer.CMS.Communities.Admins.Requests.Expiration do
  @moduledoc """
  Expires a locked pending Admin request and records its durable effects.

  The caller owns the transaction, lock plan and operation identity.

      Expire command -> Rules -> request state + Activity + Outbox intent
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities.Admins.Effects
  alias CMS.Communities.Admins.Requests.Rules
  alias CMS.Model.CommunityAdminRequest

  @doc "Writes an expired state and notifies the current authorized participants."
  def expire(
        locked,
        %CommunityAdminRequest{status: :pending} = request,
        operation,
        index,
        %DateTime{} = now
      ) do
    member = Enum.find(locked.admins, &(&1.user_id == request.subject_user_id))
    lords = for admin <- locked.admins, admin.is_lord, do: admin.user_id

    with true <- Repo.in_transaction?(),
         true <-
           Enum.any?(locked.requests, &(&1.id == request.id and &1.revision == request.revision)),
         {:ok, true} <- Rules.expired?(request, now),
         true <-
           Enum.all?(
             locked.admins,
             &match?(
               {:ok, _},
               CMS.Passport.Catalog.validate_permissions(:community, &1.permissions)
             )
           ),
         {:ok, creator_is_root} <- CMS.Passport.system_root?(request.created_by_id),
         recipients =
           Enum.uniq(
             [request.subject_user_id | lords] ++
               if(creator_is_root, do: [request.created_by_id], else: [])
           ),
         {:ok, expired} <-
           request
           |> CommunityAdminRequest.changeset(%{status: :expired, revision: request.revision + 1})
           |> Repo.update(),
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
             :admin_request_expired,
             :system,
             operation,
             index,
             metadata
           ),
         {:ok, _} <-
           Effects.request_notice(
             locked.community,
             expired,
             :expired,
             :system,
             recipients,
             operation
           ) do
      {:ok, expired}
    else
      false -> {:error, :invalid_request_expiration}
      {:ok, false} -> {:error, :request_not_expired}
      {:error, _} = error -> error
    end
  end

  def expire(_, _, _, _, _), do: {:error, :invalid_request_expiration}
end
