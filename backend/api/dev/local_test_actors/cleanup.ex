defmodule GroupherServer.LocalTestActors.Cleanup do
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
  alias Accounts.Model.{OauthProvider, User}

  alias CMS.Model.{
    ArticleCoAuthor,
    ArticleCoAuthorRequest,
    Author,
    Community,
    CommunityAdmin,
    CommunityAdminRequest,
    CommunityLifecycle,
    GlobalPassport
  }

  def report(run) do
    data = snapshot(run)
    {:ok, summarize(data)}
  end

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
    data = snapshot(run)
    plan = summarize(data)

    if plan.blockers != [] do
      {:ok, Map.put(plan, :status, "blocked")}
    else
      {:ok, _} = Repo.transact_result(fn -> LocalTestActors.close_run(run) end)

      errors =
        []
        |> steps(data.admin_requests, "cancel_admin_request", fn request ->
          actor =
            Map.get(data.users, request.created_by_id) ||
              Map.fetch!(data.users, request.subject_user_id)

          CMS.Communities.Admins.cancel(request.id, request.revision, actor, Ecto.UUID.generate())
        end)
        |> steps(data.article_requests, "cancel_article_request", fn request ->
          actor =
            Map.get(data.users, request.created_by_id) ||
              Map.fetch!(data.users, request.subject_user_id)

          CMS.Articles.CoAuthors.cancel_request(
            request.id,
            request.revision,
            actor,
            Ecto.UUID.generate()
          )
        end)
        |> steps(data.coauthors, "leave_article", fn {member, user_id} ->
          CMS.Articles.CoAuthors.leave_member(
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

          if owned? and
               (is_nil(lifecycle) or
                  lifecycle.state not in [:archived, :pending_destroy, :destroy]) do
            {:error, :owned_community_archive_pending}
          else
            remove_admin(member, Map.fetch!(data.users, member.user_id))
          end
        end)
        |> steps(Map.values(data.users), "remove_global_grants", &remove_global/1)

      {:ok, remaining} = report(run)

      complete? =
        errors == [] and remaining.admins == 0 and remaining.coauthors == 0 and
          remaining.global_grants == 0 and remaining.pending_requests == 0 and
          remaining.communities_to_archive == []

      {:ok,
       Map.merge(remaining, %{
         status: if(complete?, do: "cleaned", else: "partial"),
         errors: Enum.reverse(errors)
       })}
    end
  end

  defp snapshot(run) do
    bindings = LocalTestActors.bindings(run)
    ids = Enum.map(bindings, & &1.user_id)
    users = Repo.all(from(u in User, where: u.id in ^ids)) |> Map.new(&{&1.id, &1})

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

    %{
      users: users,
      bindings: bindings,
      communities: Enum.uniq_by(communities, fn {c, _} -> c.id end),
      blockers: Enum.uniq(blockers),
      admins: Repo.all(from(a in CommunityAdmin, where: a.user_id in ^ids)),
      globals: global_rows,
      legacy_grants:
        Repo.aggregate(from(p in CMS.Model.Passport, where: p.user_id in ^ids), :count),
      admin_requests:
        Repo.all(
          from(r in CommunityAdminRequest,
            where: r.status == :pending and (r.subject_user_id in ^ids or r.created_by_id in ^ids)
          )
        ),
      article_requests:
        Repo.all(
          from(r in ArticleCoAuthorRequest,
            where: r.status == :pending and (r.subject_user_id in ^ids or r.created_by_id in ^ids)
          )
        ),
      coauthors:
        Repo.all(
          from(m in ArticleCoAuthor,
            join: a in Author,
            on: a.id == m.author_id,
            where: a.user_id in ^ids,
            select: {m, a.user_id}
          )
        )
    }
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
          LocalTestActors.present(Map.fetch!(data.users, binding.user_id), binding)
        end),
      communities_to_archive: communities,
      admins: length(data.admins),
      coauthors: length(data.coauthors),
      global_grants: length(data.globals) + data.legacy_grants,
      pending_requests: length(data.admin_requests) + length(data.article_requests),
      article_fixtures_retained: LocalTestActors.Articles.retained(data.bindings),
      retained: ["accounts", "content", "audit_history", "closed_community_records"]
    }
  end

  defp archive(community, users) do
    case Repo.get_by(CommunityLifecycle, community_id: community.id) do
      %CommunityLifecycle{state: state} when state in [:archived, :pending_destroy, :destroy] ->
        {:ok, :already_archived}

      _ ->
        CMS.Communities.request_destroy(community, Map.fetch!(users, community.user_id),
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
               where: a.id == ^member.id and a.user_id == ^user.id,
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

  defp remove_global(user) do
    Repo.transact_result(fn ->
      Repo.one!(from(u in User, where: u.id == ^user.id, lock: "FOR UPDATE"))

      Repo.delete_all(
        from(g in GlobalPassport, where: g.user_id == ^user.id and g.is_root == false)
      )

      Repo.delete_all(from(p in CMS.Model.Passport, where: p.user_id == ^user.id))
      {:ok, :removed}
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
