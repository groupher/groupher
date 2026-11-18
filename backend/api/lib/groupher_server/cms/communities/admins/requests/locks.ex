defmodule GroupherServer.CMS.Communities.Admins.Requests.Locks do
  @moduledoc """
  Locks the facts needed by one Community Admin request command.

  Community precedes all involved Users, then current Admins, then requests.
  The command must still authorize the actor and validate the returned rows.

      request command -> Community -> Users -> Admins -> request rows
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin, CommunityAdminRequest}

  @doc """
  Locks the exact Community, Users and any existing Admin / request rows.

  ## Examples

      Locks.lock(community.id, [actor.id, subject.id], [request.id])
  """
  def lock(community_id, user_ids, request_ids)
      when is_integer(community_id) and is_list(user_ids) and is_list(request_ids) do
    ids = Enum.sort(Enum.uniq(user_ids))

    with true <- Repo.in_transaction?(),
         true <- Enum.all?(ids, &(is_integer(&1) and &1 > 0)),
         {:ok, requests} <- canonical_requests(request_ids),
         %Community{} = community <-
           Repo.one(from(c in Community, where: c.id == ^community_id, lock: "FOR UPDATE")),
         users <-
           Repo.all(from(u in User, where: u.id in ^ids, order_by: u.id, lock: "FOR UPDATE")),
         true <- Enum.map(users, & &1.id) == ids,
         admins <-
           Repo.all(
             from(a in CommunityAdmin,
               where: a.community_id == ^community_id and a.user_id in ^ids,
               order_by: [asc: a.community_id, asc: a.user_id],
               lock: "FOR UPDATE"
             )
           ),
         rows <-
           Repo.all(
             from(r in CommunityAdminRequest,
               where: r.community_id == ^community_id and r.id in ^requests,
               order_by: r.id,
               lock: "FOR UPDATE"
             )
           ),
         true <- Enum.map(rows, & &1.id) == requests,
         true <- Enum.all?(rows, &(&1.subject_user_id in ids)) do
      {:ok, %{community: community, users: users, admins: admins, requests: rows}}
    else
      false -> {:error, :invalid_or_missing_lock_target}
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def lock(_, _, _), do: {:error, :invalid_or_missing_lock_target}

  @doc "Locks a member and every pending request involving that member under the Community-first order."
  def lock_member_requests(community_id, actor_id, member_id)
      when is_integer(community_id) and is_integer(actor_id) and is_integer(member_id) do
    with true <- Repo.in_transaction?(),
         %Community{} = community <-
           Repo.one(from(c in Community, where: c.id == ^community_id, lock: "FOR UPDATE")),
         pending <-
           Repo.all(
             from(r in CommunityAdminRequest,
               where:
                 r.community_id == ^community_id and r.status == :pending and
                   (r.subject_user_id == ^member_id or r.created_by_id == ^member_id),
               order_by: r.id
             )
           ),
         lord_ids <-
           Repo.all(
             from(a in CommunityAdmin,
               where: a.community_id == ^community_id and a.is_lord,
               select: a.user_id
             )
           ),
         user_ids <-
           Enum.sort(
             Enum.uniq(
               [actor_id, member_id | lord_ids] ++
                 Enum.flat_map(pending, &[&1.subject_user_id, &1.created_by_id])
             )
           ),
         users <-
           Repo.all(from(u in User, where: u.id in ^user_ids, order_by: u.id, lock: "FOR UPDATE")),
         true <- Enum.map(users, & &1.id) == user_ids,
         admins <-
           Repo.all(
             from(a in CommunityAdmin,
               where: a.community_id == ^community_id and a.user_id in ^user_ids,
               order_by: [asc: a.community_id, asc: a.user_id],
               lock: "FOR UPDATE"
             )
           ),
         request_ids <- Enum.map(pending, & &1.id) |> Enum.sort(),
         requests <-
           Repo.all(
             from(r in CommunityAdminRequest,
               where: r.community_id == ^community_id and r.id in ^request_ids,
               order_by: r.id,
               lock: "FOR UPDATE"
             )
           ),
         true <- Enum.map(requests, & &1.id) == request_ids do
      {:ok, %{community: community, users: users, admins: admins, requests: requests}}
    else
      false -> {:error, :invalid_or_missing_lock_target}
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def lock_member_requests(_, _, _), do: {:error, :invalid_or_missing_lock_target}

  defp canonical_requests(ids) do
    Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, acc} ->
      case Ecto.UUID.cast(id) do
        {:ok, canonical} -> {:cont, {:ok, [canonical | acc]}}
        :error -> {:halt, {:error, :invalid_or_missing_lock_target}}
      end
    end)
    |> case do
      {:ok, cast} -> {:ok, cast |> Enum.uniq() |> Enum.sort()}
      error -> error
    end
  end
end
