defmodule GroupherServer.CMS.Passport.LegacyConversion do
  @moduledoc """
  Applies an exception-free legacy Passport plan in one owned transaction.

      stopped legacy writers -> lock canonical Communities -> User and facts
        -> recompute report -> apply exact verified grants -> commit

  This is a one-time migration capability, not an authorization entry point.
  The trusted cutover operator must stop both legacy and new authorization writers
  and audit the report before conversion. A database gate and one-time user
  record prevent conversion after closure or a completed user conversion.
  Any unresolved exception aborts the conversion; no legacy thread grant is widened.
  """
  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.Model.{Community, CommunityAdmin, GlobalPassport, Passport}
  alias CMS.Passport.{Catalog, LegacyPlan}

  @doc "Converts one user atomically after legacy authorization writes are stopped."
  def apply(user_id) when is_integer(user_id) do
    Repo.transact(fn -> apply_locked(user_id) end)
  end

  def apply(_), do: {:error, :invalid_user}

  defp apply_locked(user_id) do
    with {:ok, :pass} <- lock_open_window(),
         {:ok, :pass} <- ensure_not_converted(user_id),
         {:ok, initial} <- LegacyPlan.report(user_id),
         {:ok, :pass} <- ensure_no_exceptions(initial),
         {:ok, :pass} <- lock_communities(initial),
         %User{} <- Repo.one(from(user in User, where: user.id == ^user_id, lock: "FOR UPDATE")),
         _ <-
           Repo.one(
             from(passport in Passport, where: passport.user_id == ^user_id, lock: "FOR UPDATE")
           ),
         {:ok, current} <- LegacyPlan.report(user_id),
         true <- scope_ids(initial) == scope_ids(current),
         {:ok, :pass} <- ensure_no_exceptions(current),
         global <-
           Repo.one(
             from(passport in GlobalPassport,
               where: passport.user_id == ^user_id,
               lock: "FOR UPDATE"
             )
           ),
         {:ok, :pass} <- lock_members(current),
         {:ok, :pass} <- apply_global(user_id, current, global),
         {:ok, :pass} <- apply_communities(user_id, current),
         {:ok, _} <-
           Repo.query(
             "INSERT INTO cms.passport_conversion_runs (user_id, completed_at) VALUES ($1, now())",
             [user_id]
           ) do
      {:ok, :pass}
    else
      false -> {:error, :legacy_scope_changed}
      nil -> {:error, :user_not_found}
      {:error, _reason} = error -> error
    end
  end

  @doc "Permanently closes the migration window in the caller's trusted cutover workflow."
  def close_window do
    Repo.transact(fn ->
      case lock_open_window() do
        {:ok, :pass} ->
          case Repo.query(
                 "UPDATE cms.passport_conversion_control SET state = 'closed' WHERE id = 1"
               ) do
            {:ok, _} -> {:ok, :pass}
            {:error, reason} -> {:error, reason}
          end

        {:error, :legacy_conversion_closed} ->
          {:ok, :pass}

        {:error, _reason} = error ->
          error
      end
    end)
  end

  defp lock_open_window do
    case Repo.query("SELECT state FROM cms.passport_conversion_control WHERE id = 1 FOR UPDATE") do
      {:ok, %{rows: [["open"]]}} -> {:ok, :pass}
      {:ok, %{rows: [["closed"]]}} -> {:error, :legacy_conversion_closed}
      {:ok, _} -> {:error, :legacy_conversion_control_missing}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_not_converted(user_id) do
    case Repo.query("SELECT 1 FROM cms.passport_conversion_runs WHERE user_id = $1", [user_id]) do
      {:ok, %{rows: []}} -> {:ok, :pass}
      {:ok, %{rows: [_ | _]}} -> {:error, :legacy_already_converted}
      {:error, reason} -> {:error, reason}
    end
  end

  defp ensure_no_exceptions(%{exceptions: []}), do: {:ok, :pass}

  defp ensure_no_exceptions(%{exceptions: exceptions}),
    do: {:error, {:legacy_conversion_unresolved, exceptions}}

  defp scope_ids(plan) do
    plan.communities |> Map.values() |> Enum.map(& &1.community_id) |> Enum.sort()
  end

  defp lock_communities(plan) do
    ids = scope_ids(plan)

    found =
      Repo.all(
        from(community in Community,
          where: community.id in ^ids,
          order_by: community.id,
          lock: "FOR UPDATE",
          select: community.id
        )
      )

    if found == ids, do: {:ok, :pass}, else: {:error, :legacy_scope_changed}
  end

  defp lock_members(plan) do
    ids = plan.communities |> Map.values() |> Enum.map(& &1.member_id) |> Enum.sort()

    found =
      Repo.all(
        from(member in CommunityAdmin,
          where: member.id in ^ids,
          order_by: member.id,
          lock: "FOR UPDATE",
          select: member.id
        )
      )

    if found == ids, do: {:ok, :pass}, else: {:error, :legacy_scope_changed}
  end

  defp apply_global(user_id, plan, current) do
    if is_nil(current) and not plan.is_root and map_size(plan.global) == 0 do
      {:ok, :pass}
    else
      current = current || %GlobalPassport{user_id: user_id}

      with {:ok, permissions} <-
             Catalog.validate_permissions(
               :global,
               Map.merge(current.permissions || %{}, plan.global)
             ) do
        root = current.is_root or plan.is_root

        if not is_nil(current.id) and root == current.is_root and
             permissions == current.permissions do
          {:ok, :pass}
        else
          attrs = %{
            user_id: user_id,
            is_root: root,
            permissions: permissions,
            revision: if(current.id, do: current.revision + 1, else: 1)
          }

          case current |> GlobalPassport.changeset(attrs) |> Repo.insert_or_update() do
            {:ok, _} -> {:ok, :pass}
            {:error, _reason} = error -> error
          end
        end
      end
    end
  end

  defp apply_communities(user_id, plan) do
    plan.communities
    |> Map.values()
    |> Enum.sort_by(& &1.community_id)
    |> Enum.reduce_while({:ok, :pass}, fn entry, _ ->
      case Repo.get_by(CommunityAdmin,
             id: entry.member_id,
             user_id: user_id,
             community_id: entry.community_id
           ) do
        nil ->
          {:halt, {:error, :legacy_scope_changed}}

        member ->
          with {:ok, permissions} <-
                 Catalog.validate_permissions(
                   :community,
                   Map.merge(member.permissions, entry.permissions)
                 ),
               {:ok, :pass} <-
                 update_community(member, permissions, member.is_lord or entry.is_lord) do
            {:cont, {:ok, :pass}}
          else
            {:error, _reason} = error -> {:halt, error}
          end
      end
    end)
  end

  defp update_community(member, permissions, lord) do
    if permissions == member.permissions and lord == member.is_lord do
      {:ok, :pass}
    else
      attrs = %{permissions: permissions, is_lord: lord, revision: member.revision + 1}

      case member |> CommunityAdmin.changeset(attrs) |> Repo.update() do
        {:ok, _} -> {:ok, :pass}
        {:error, _reason} = error -> error
      end
    end
  end
end
