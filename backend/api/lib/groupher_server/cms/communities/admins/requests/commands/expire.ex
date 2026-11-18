defmodule GroupherServer.CMS.Communities.Admins.Requests.Commands.Expire do
  @moduledoc """
  Expires one request through the shared Community-first lock order.

  A stable workflow identity makes concurrent jobs and retries idempotent.

      ExpireDue scan -> Expire.execute -> locked state / Activity / Outbox
  """
  import Ecto.Query

  alias GroupherServer.{Activity, CMS, Repo}
  alias CMS.Communities.Admins.Requests.{Expiration, Locks, Rules}
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}

  @doc """
  Rechecks one due candidate without retaining the scan's request lock.

  ## Examples

      GroupherServer.CMS.Communities.Admins.Requests.Commands.Expire.execute(request_id, now)
  """
  def execute(request_id, %DateTime{} = now) when is_binary(request_id) do
    Repo.transact(fn ->
      case Repo.get(CommunityAdminRequest, request_id) do
        nil -> {:ok, :unchanged}
        request -> expire_request(request, now)
      end
    end)
  end

  def execute(_, _), do: {:error, :invalid_request_expiration}

  defp expire_request(candidate, now) do
    with %Community{} = community <-
           Repo.one(
             from(c in Community, where: c.id == ^candidate.community_id, lock: "FOR UPDATE")
           ),
         lords <-
           Repo.all(
             from(a in CommunityAdmin,
               where: a.community_id == ^community.id and a.is_lord == true,
               order_by: a.user_id,
               select: a.user_id
             )
           ),
         users = [candidate.subject_user_id, candidate.created_by_id | lords],
         {:ok, locked} <- Locks.lock(community.id, users, [candidate.id]),
         [request] <- locked.requests,
         {:ok, expired?} <- Rules.expired?(request, now) do
      if expired? do
        operation =
          Activity.EventRef.derive(
            {:community_admin_request_expiry, request.id, request.revision}
          )

        Expiration.expire(locked, request, operation, 0, now)
      else
        {:ok, :unchanged}
      end
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
      _ -> {:error, :invalid_request_expiration}
    end
  end
end
