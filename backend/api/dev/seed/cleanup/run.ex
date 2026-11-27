defmodule GroupherServer.Seed.Cleanup.Run do
  @moduledoc """
  Cleans run-owned active fixtures without deleting accounts, content or audit history.

      read-only ownership report -> explicit apply -> close sessions -> domain cleanup
        -> archive only owned communities -> remove synthetic grants -> verify remaining state

  A session advisory lock serializes cleanup while each domain Command owns its own
  transaction. No cross-domain transaction reverses the canonical lock order. Partial
  failures remain explicit and may be retried; shared communities are never archived.
  """
  import Ecto.Query
  alias GroupherServer.{Accounts, CMS, LocalTestActors, Repo}
  alias Helper.ORM.AdvisoryLock
  alias Accounts.Model.{OauthProvider, User}

  alias CMS.Model.{
    Community,
    CommunityAdmin,
    CommunityLifecycle,
    GlobalPassport
  }

  def report(run) do
    if Repo.in_transaction?() do
      {:ok, summarize(snapshot(run))}
    else
      Repo.transaction(fn ->
        # The test sandbox already owns an outer transaction, whose isolation
        # cannot be changed after the fixture setup has issued queries.
        unless Repo.config()[:pool] == Ecto.Adapters.SQL.Sandbox do
          Repo.query!("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY", [])
        end

        summarize(snapshot(run))
      end)
    end
  end

  @doc "Rejects unconfirmed retention until the downstream can prove request termination."
  def retain_unconfirmed(run, operation_ref, reason)
      when is_binary(operation_ref) and is_binary(reason) do
    with {:ok, _} <- Ecto.UUID.cast(operation_ref),
         true <- String.trim(reason) != "" and byte_size(reason) <= 1000,
         {:ok, report} <- report(run),
         true <-
           Enum.any?(report.article_fixtures_retained, fn entry ->
             entry["operationRef"] == operation_ref and entry["status"] == "pending"
           end) do
      {:error, :local_test_terminal_evidence_unavailable}
    else
      _ -> {:error, :invalid_local_test_unconfirmed_operation}
    end
  end

  def retain_unconfirmed(_, _, _), do: {:error, :invalid_local_test_unconfirmed_operation}

  def apply(run) do
    Repo.checkout(fn ->
      %{rows: [[locked?]]} =
        Repo.query!("SELECT pg_try_advisory_lock(hashtextextended($1, 0))", [
          "local-test-clean:#{run}"
        ])

      if locked? do
        try do
          clean(run)
        after
          Repo.query!("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [
            "local-test-clean:#{run}"
          ])
        end
      else
        {:error, :local_test_cleanup_busy}
      end
    end)
  end

  defp clean(run) do
    result =
      Repo.transact_result(fn ->
        with {:ok, :acquired} <- AdvisoryLock.acquire!("local-test-actors:#{run}") do
          data = snapshot(run)
          plan = summarize(data)

          cond do
            data.bindings == [] ->
              {:error, :local_test_run_not_found}

            plan.blockers != [] ->
              {:ok, {:blocked, plan}}

            true ->
              with {:ok, _} <- LocalTestActors.close_run(run) do
                {:ok, {:ready, data}}
              end
          end
        end
      end)

    case result do
      {:ok, {:blocked, plan}} ->
        {:ok, Map.put(plan, :status, "blocked")}

      {:ok, {:ready, data}} ->
        errors =
          []
          |> steps(data.admin_requests, "cancel_admin_request", fn request ->
            actor =
              Map.get(data.users, request.created_by_id) ||
                Map.fetch!(data.users, request.subject_user_id)

            CMS.cancel_community_admin_request(
              request.id,
              request.revision,
              actor,
              Ecto.UUID.generate()
            )
          end)
          |> steps(data.article_requests, "cancel_article_request", fn request ->
            actor =
              Map.get(data.users, request.created_by_id) ||
                Map.fetch!(data.users, request.subject_user_id)

            CMS.cancel_article_co_author_request(
              request.id,
              request.revision,
              actor,
              Ecto.UUID.generate()
            )
          end)
          |> steps(data.coauthors, "leave_article", fn {member, user_id} ->
            CMS.leave_article_co_author_role(
              member.article_id,
              member.revision,
              Map.fetch!(data.users, user_id),
              Ecto.UUID.generate()
            )
          end)
          |> steps(data.communities, "archive_community", fn {community, _binding} ->
            archive(community, data.users)
          end)
          |> steps(data.admins, "remove_admin", fn member ->
            owned? = Enum.any?(data.communities, fn {c, _} -> c.id == member.community_id end)
            lifecycle = Repo.get_by(CommunityLifecycle, community_id: member.community_id)

            if retained_lord?(member, data) do
              {:ok, :retained}
            else
              if owned? and
                   (is_nil(lifecycle) or
                      lifecycle.state not in [:archived, :pending_destroy, :destroy]) do
                {:error, :owned_community_archive_pending}
              else
                user = Map.fetch!(data.users, member.user_id)

                if member.is_lord do
                  remove_admin(member, user)
                else
                  CMS.remove_community_admin(
                    member.community_ref,
                    member.member_id,
                    member.revision,
                    user,
                    Ecto.UUID.generate()
                  )
                end
              end
            end
          end)
          |> steps(data.bindings, "restore_global_grant", &restore_global/1)

        {:ok, remaining} = report(run)

        complete? =
          errors == [] and remaining.admins_to_remove == 0 and remaining.coauthors == 0 and
            remaining.global_grants_to_restore == 0 and remaining.pending_requests == 0 and
            remaining.communities_to_archive == [] and remaining.blockers == []

        {complete?, errors} =
          if complete? do
            case LocalTestActors.mark_cleanup_complete(run, remaining) do
              {:ok, :pass} ->
                {true, errors}

              {:error, reason} ->
                safe_reason =
                  if is_atom(reason), do: Atom.to_string(reason), else: "domain_operation_failed"

                {false, [%{step: "record_cleanup", reason: safe_reason} | errors]}
            end
          else
            {false, errors}
          end

        {:ok,
         Map.merge(remaining, %{
           status: if(complete?, do: "cleaned", else: "partial"),
           errors: Enum.reverse(errors)
         })}

      {:error, _} = error ->
        error
    end
  end

  defp snapshot(run) do
    bindings = GroupherServer.Seed.Run.bindings(run)
    ids = Enum.map(bindings, & &1.user_id)

    users =
      ids
      |> Enum.uniq()
      |> Enum.reduce(%{}, fn id, acc ->
        case Accounts.front_desk_fresh_user(id) do
          {:ok, user} -> Map.put(acc, id, user)
          {:error, _} -> acc
        end
      end)

    {communities, ownership_errors} =
      Enum.reduce(bindings, {[], []}, fn binding, {communities, errors} ->
        Enum.reduce(binding.raw["communities"] || [], {communities, errors}, fn id,
                                                                                {owned, issues} ->
          case Repo.get(Community, id) do
            nil ->
              {owned, issues}

            %Community{user_id: owner} = community when owner == binding.user_id ->
              {[{community, binding} | owned], issues}

            _ ->
              {owned, ["community_ownership_changed" | issues]}
          end
        end)
      end)

    oauth = Repo.all(from(o in OauthProvider, where: o.user_id in ^ids))

    unexpected_identity? =
      Enum.any?(oauth, fn o ->
        not Enum.any?(
          bindings,
          &(&1.id == o.id and &1.raw["tool"] == "local-test-actor-v1" and &1.raw["alias"] != nil)
        )
      end)

    foreign_members? =
      Enum.any?(communities, fn {community, _} ->
        Repo.exists?(
          from(a in CommunityAdmin,
            where: a.community_id == ^community.id and a.user_id not in ^ids
          )
        ) or
          Repo.exists?(
            from(s in CMS.Model.CommunitySubscriber,
              where: s.community_id == ^community.id and s.user_id not in ^ids
            )
          )
      end)

    global_rows = Repo.all(from(g in GlobalPassport, where: g.user_id in ^ids))
    blockers = ownership_errors

    blockers =
      if unexpected_identity?, do: ["unexpected_oauth_identity" | blockers], else: blockers

    blockers =
      if foreign_members?, do: ["owned_community_has_foreign_members" | blockers], else: blockers

    blockers =
      if Enum.any?(global_rows, & &1.is_root),
        do: ["unexpected_system_root" | blockers],
        else: blockers

    legacy_grants =
      Repo.aggregate(from(p in CMS.Model.Passport, where: p.user_id in ^ids), :count)

    blockers =
      if Enum.any?(global_rows, &(not known_global?(&1, bindings))),
        do: ["global_grant_provenance_unknown" | blockers],
        else: blockers

    admins = own_admin_memberships(users)
    data = %{bindings: bindings, communities: communities}

    blockers =
      if Enum.any?(admins, &unverified_lord?(&1, data)),
        do: ["lord_membership_provenance_unknown" | blockers],
        else: blockers

    blockers =
      if Enum.any?(
           GroupherServer.Seed.Article.Create.retained(bindings),
           &GroupherServer.Seed.Article.Create.unresolved?/1
         ),
         do: ["article_fixture_pending" | blockers],
         else: blockers

    %{
      users: users,
      bindings: bindings,
      communities: Enum.uniq_by(communities, fn {c, _} -> c.id end),
      blockers: Enum.uniq(blockers),
      admins: admins,
      globals: global_rows,
      legacy_grants: legacy_grants,
      admin_requests: own_pending_admin_requests(users),
      article_requests: own_pending_co_author_requests(users),
      coauthors: own_co_author_memberships(users)
    }
  end

  defp own_pending_admin_requests(users) do
    users
    |> Map.values()
    |> Enum.flat_map(fn user ->
      {:ok, requests} = CMS.list_own_pending_community_admin_requests(user)
      requests
    end)
    |> Enum.uniq_by(& &1.id)
  end

  defp own_admin_memberships(users) do
    users
    |> Map.values()
    |> Enum.flat_map(fn user ->
      {:ok, memberships} = CMS.list_own_community_admin_memberships(user)
      memberships
    end)
  end

  defp own_co_author_memberships(users) do
    users
    |> Map.values()
    |> Enum.flat_map(fn user ->
      {:ok, memberships} = CMS.list_own_article_co_author_memberships(user)
      Enum.map(memberships, &{&1, user.id})
    end)
  end

  defp own_pending_co_author_requests(users) do
    users
    |> Map.values()
    |> Enum.flat_map(fn user ->
      {:ok, requests} = CMS.list_own_pending_article_co_author_requests(user)
      requests
    end)
    |> Enum.uniq_by(& &1.id)
  end

  defp summarize(data) do
    communities =
      Enum.flat_map(data.communities, fn {community, _} ->
        case Repo.get_by(CommunityLifecycle, community_id: community.id) do
          %CommunityLifecycle{state: state}
          when state in [:archived, :pending_destroy, :destroy] ->
            []

          _ ->
            [%{slug: community.slug, communityRef: community.ref}]
        end
      end)

    %{
      status: "report",
      blockers: data.blockers,
      accounts_retained:
        Enum.map(data.bindings, fn binding ->
          GroupherServer.Seed.Run.present(Map.fetch!(data.users, binding.user_id), binding)
        end),
      communities_to_archive: communities,
      communities_retained:
        Enum.map(data.communities, fn {community, _} ->
          lifecycle = Repo.get_by(CommunityLifecycle, community_id: community.id)

          %{
            slug: community.slug,
            communityRef: community.ref,
            lifecycle: if(lifecycle, do: lifecycle.state, else: nil)
          }
        end),
      admins: length(data.admins),
      admins_to_remove: Enum.count(data.admins, &(not retained_lord?(&1, data))),
      retained_lords:
        Enum.filter(data.admins, &retained_lord?(&1, data)) |> Enum.map(& &1.member_id),
      coauthors: length(data.coauthors),
      global_grants: length(data.globals) + data.legacy_grants,
      global_grants_to_restore: Enum.count(data.bindings, &global_active?/1),
      pending_requests: length(data.admin_requests) + length(data.article_requests),
      article_fixtures_retained: GroupherServer.Seed.Article.Create.retained(data.bindings),
      retained: ["accounts", "content", "audit_history", "closed_community_records"]
    }
  end

  defp global_active?(binding) do
    match?(%{"status" => "active"}, binding.raw["global_grant"])
  end

  defp known_global?(row, bindings) do
    Enum.any?(bindings, fn binding ->
      entry = binding.raw["global_grant"]

      binding.user_id == row.user_id and is_map(entry) and
        ((entry["status"] == "active" and entry["after"] == global_snapshot(row)) or
           (entry["status"] == "restored" and entry["restored"] == global_snapshot(row)))
    end)
  end

  defp global_snapshot(nil), do: nil

  defp global_snapshot(row) do
    %{
      "id" => row.id,
      "permissions" => row.permissions,
      "revision" => row.revision,
      "is_root" => row.is_root
    }
  end

  defp restore_global(binding) do
    Repo.transact_result(fn ->
      Repo.one!(from(u in User, where: u.id == ^binding.user_id, lock: "FOR UPDATE"))

      current_binding =
        Repo.one!(from(b in OauthProvider, where: b.id == ^binding.id, lock: "FOR UPDATE"))

      entry = current_binding.raw["global_grant"]

      current =
        Repo.one(
          from(g in GlobalPassport, where: g.user_id == ^binding.user_id, lock: "FOR UPDATE")
        )

      cond do
        is_nil(entry) or entry["status"] == "restored" ->
          {:ok, :unchanged}

        entry["status"] != "active" or entry["after"] != global_snapshot(current) ->
          {:error, :local_test_global_grant_changed}

        true ->
          with {:ok, restored} <- restore_global_row(current, entry["before"]),
               updated <-
                 Map.merge(entry, %{
                   "status" => "restored",
                   "restored" => global_snapshot(restored)
                 }),
               {:ok, _} <-
                 current_binding
                 |> Ecto.Changeset.change(
                   raw: Map.put(current_binding.raw, "global_grant", updated)
                 )
                 |> Repo.update() do
            {:ok, :restored}
          end
      end
    end)
  end

  defp restore_global_row(nil, nil), do: {:ok, nil}

  defp restore_global_row(current, nil) do
    with {:ok, _} <- Repo.delete(current), do: {:ok, nil}
  end

  defp restore_global_row(current, before) do
    current
    |> GlobalPassport.changeset(%{
      permissions: before["permissions"],
      revision: current.revision + 1
    })
    |> Repo.update()
  end

  defp retained_lord?(%{is_lord: false}, _data), do: false

  defp retained_lord?(member, data) do
    Enum.any?(data.bindings, fn binding ->
      owned = binding.raw["community_lords"] || %{}
      grants = binding.raw["lord_grants"] || %{}
      grant = grants[Integer.to_string(member.member_id)]

      binding.user_id == member.user_id and
        (owned[Integer.to_string(member.community_id)] == member.member_id or
           (is_map(grant) and grant["created"] == false and
              grant["community_id"] == member.community_id and grant["user_id"] == member.user_id))
    end)
  end

  defp unverified_lord?(%{is_lord: false}, _data), do: false

  defp unverified_lord?(member, data) do
    not retained_lord?(member, data) and
      not Enum.any?(data.bindings, fn binding ->
        grant = (binding.raw["lord_grants"] || %{})[Integer.to_string(member.member_id)]

        binding.user_id == member.user_id and is_map(grant) and grant["created"] == true and
          grant["community_id"] == member.community_id and grant["user_id"] == member.user_id
      end)
  end

  defp archive(community, users) do
    case Repo.get_by(CommunityLifecycle, community_id: community.id) do
      %CommunityLifecycle{state: state} when state in [:archived, :pending_destroy, :destroy] ->
        {:ok, :already_archived}

      _ ->
        CMS.request_community_destruction(community, Map.fetch!(users, community.user_id),
          command_id: Ecto.UUID.generate()
        )
    end
  end

  # Counterpart of local lord initialization. Only provenance-checked synthetic users reach here.
  defp remove_admin(member, user) do
    Repo.transact_result(fn ->
      community =
        Repo.one!(from(c in Community, where: c.id == ^member.community_id, lock: "FOR UPDATE"))

      Repo.one!(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE"))

      case Repo.one(
             from(a in CommunityAdmin,
               where: a.id == ^member.member_id and a.user_id == ^user.id,
               lock: "FOR UPDATE"
             )
           ) do
        nil ->
          {:ok, :already_removed}

        current ->
          with {:ok, _} <- Repo.delete(current),
               {:ok, _} <- CMS.Communities.Count.update(community, user, :admins_count, :dec),
               {:ok, _} <-
                 CMS.Communities.Admins.Effects.activity(
                   community,
                   :admin_removed,
                   :system,
                   Ecto.UUID.generate(),
                   0,
                   %{
                     subject_user_id: user.id,
                     member_id: current.id,
                     before_permissions: current.permissions,
                     after_permissions: %{}
                   }
                 ) do
            {:ok, :removed}
          end
      end
    end)
  end

  defp steps(errors, rows, step, callback) do
    Enum.reduce(rows, errors, fn row, errors ->
      case callback.(row) do
        {:ok, _} ->
          errors

        {:error, reason} ->
          [
            %{
              step: step,
              reason:
                if(is_atom(reason), do: Atom.to_string(reason), else: "domain_operation_failed")
            }
            | errors
          ]
      end
    end)
  end
end
