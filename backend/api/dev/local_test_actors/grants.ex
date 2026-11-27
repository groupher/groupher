defmodule GroupherServer.LocalTestActors.Grants do
  @moduledoc """
  Configures real scope-specific grants for registered synthetic accounts.

      local fixture -> explicit lord setup OR normal invite/accept/update Commands

  Ordinary grants use the generated Passport Catalog and retain domain events,
  requests, CAS revisions and notices. Only lord initialization is a trusted fixture.
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo, LocalTestActors}
  alias CMS.Model.{Community, CommunityAdmin}
  alias CMS.Communities.Admins

  def configure(run, %{"alias" => name, "community" => slug, "role" => "lord"}) do
    with {:ok, user, binding} <- GroupherServer.Seed.Run.actor(run, name),
         %Community{} = community <- Repo.get_by(Community, slug: slug),
         {:ok, {member, created?}} <- lord(community, user),
         {:ok, _} <- lord_activity(community, user, member, created?),
         {:ok, _} <- record_lord(binding, community, member, created?) do
      {:ok,
       %{
         community: slug,
         login: user.login,
         isLord: member.is_lord,
         permissions: member.permissions
       }}
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end

  def configure(
        run,
        %{"alias" => name, "community" => slug, "by" => by, "permissions" => permissions} = input
      ) do
    with {:ok, subject, _} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, manager, _} <- GroupherServer.Seed.Run.actor(run, by),
         {:ok, community} <-
           CMS.fetch_community(slug, manager, inc_views: false, policy_mode: :admin),
         {:ok, normalized} <- CMS.passport_validate_permissions(:community, permissions),
         {:ok, current_memberships} <- CMS.list_own_community_admin_memberships(subject) do
      case Enum.find(current_memberships, &(&1.community_ref == community.ref)) do
        nil ->
          with {:ok, request} <-
                 CMS.create_community_admin_request(
                   community.ref,
                   subject.login,
                   :invite,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ),
               true <- request.proposed_permissions == normalized do
            if input["pending"] == true do
              {:ok, %{requestId: request.id, status: "pending"}}
            else
              with {:ok, _} <-
                     CMS.decide_community_admin_request(
                       request.id,
                       request.revision,
                       :accept,
                       nil,
                       subject,
                       Ecto.UUID.generate()
                     ),
                   {:ok, memberships} <- LocalTestActors.Communities.memberships(subject) do
                {:ok, %{community: slug, memberships: memberships}}
              end
            end
          else
            false -> {:error, :local_test_pending_permissions_mismatch}
            {:error, _} = error -> error
          end

        member when is_map(member) ->
          with {:ok, _} <-
                 CMS.update_community_admin_permissions(
                   community.ref,
                   member.member_id,
                   member.revision,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ),
               {:ok, memberships} <- LocalTestActors.Communities.memberships(subject) do
            {:ok, %{community: slug, memberships: memberships}}
          end
      end
    else
      {:error, _} = error -> error
    end
  end

  def configure(
        run,
        %{"alias" => name, "article" => article_id, "by" => by, "permissions" => permissions} =
          input
      ) do
    with {:ok, subject, _} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, manager, _} <- GroupherServer.Seed.Run.actor(run, by),
         {:ok, article_id} <- Ecto.UUID.cast(article_id),
         {:ok, normalized} <- CMS.passport_validate_permissions(:article, permissions),
         {:ok, memberships} <- CMS.list_own_article_co_author_memberships(subject) do
      member = Enum.find(memberships, &(&1.article_id == article_id))

      case member do
        nil ->
          with {:ok, request} <-
                 CMS.create_article_co_author_request(
                   article_id,
                   subject.login,
                   :invite,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ),
               true <- request.proposed_permissions == normalized do
            if input["pending"] == true do
              {:ok, %{requestId: request.id, status: "pending"}}
            else
              with {:ok, _} <-
                     CMS.decide_article_co_author_request(
                       request.id,
                       request.revision,
                       :accept,
                       normalized,
                       subject,
                       Ecto.UUID.generate()
                     ) do
                CMS.get_current_article_co_author_permissions(article_id, subject)
              end
            end
          else
            false -> {:error, :local_test_pending_permissions_mismatch}
            {:error, _} = error -> error
          end

        member when is_map(member) ->
          with {:ok, _} <-
                 CMS.update_article_co_author_permissions(
                   article_id,
                   member.member_id,
                   member.revision,
                   normalized,
                   manager,
                   Ecto.UUID.generate()
                 ) do
            CMS.get_current_article_co_author_permissions(article_id, subject)
          end
      end
    else
      :error -> {:error, :invalid_article_id}
      {:error, _} = error -> error
    end
  end

  def configure(run, %{"alias" => name, "scope" => "global", "permissions" => permissions}) do
    with {:ok, user, binding} <- GroupherServer.Seed.Run.actor(run, name),
         {:ok, normalized} <- CMS.passport_validate_permissions(:global, permissions),
         _ <-
           Repo.one!(
             from(u in GroupherServer.Accounts.Model.User,
               where: u.id == ^user.id,
               lock: "FOR UPDATE"
             )
           ),
         current <- Repo.get_by(CMS.Model.GlobalPassport, user_id: user.id),
         false <- match?(%CMS.Model.GlobalPassport{is_root: true}, current),
         {:ok, updated} <-
           CMS.Passport.grant_in_transaction(
             user,
             %CMS.Passport.Scope.GlobalGrant{subject_id: user.id, current: current},
             normalized,
             nil
           ),
         {:ok, _} <- record_global(binding, current, updated) do
      CMS.Passport.global_facts(user.id)
    else
      true -> {:error, :local_test_refuses_root_grant}
      {:error, _} = error -> error
    end
  end

  def configure(_, _), do: {:error, :explicit_scope_and_permissions_required}

  defp record_global(binding, current, updated) do
    previous = binding.raw["global_grant"]

    if previous && previous["after"] != global_snapshot(current) do
      {:error, :local_test_global_grant_changed}
    else
      entry = %{
        "before" => if(previous, do: previous["before"], else: global_snapshot(current)),
        "after" => global_snapshot(updated),
        "status" => "active"
      }

      binding
      |> Ecto.Changeset.change(raw: Map.put(binding.raw, "global_grant", entry))
      |> Repo.update()
    end
  end

  defp global_snapshot(nil), do: nil

  defp global_snapshot(passport) do
    %{
      "id" => passport.id,
      "permissions" => passport.permissions,
      "revision" => passport.revision,
      "is_root" => passport.is_root
    }
  end

  defp record_lord(binding, community, member, created?) do
    entries = binding.raw["lord_grants"] || %{}
    key = Integer.to_string(member.id)

    entry = %{
      "community_id" => community.id,
      "user_id" => member.user_id,
      "created" => created?
    }

    raw = Map.put(binding.raw, "lord_grants", Map.put_new(entries, key, entry))
    binding |> Ecto.Changeset.change(raw: raw) |> Repo.update()
  end

  defp lord(community, user) do
    case Repo.get_by(CommunityAdmin, user_id: user.id, community_id: community.id) do
      nil ->
        with {:ok, member} <-
               %CommunityAdmin{}
               |> CommunityAdmin.changeset(%{
                 user_id: user.id,
                 community_id: community.id,
                 is_lord: true,
                 permissions: %{}
               })
               |> Repo.insert(),
             {:ok, _} <- CMS.Communities.Count.update(community, user, :admins_count, :inc) do
          {:ok, {member, true}}
        end

      %CommunityAdmin{is_lord: true} = member ->
        {:ok, {member, false}}

      %CommunityAdmin{} ->
        {:error, :local_test_refuses_implicit_lord_promotion}
    end
  end

  defp lord_activity(_community, _user, _member, false), do: {:ok, :pass}

  defp lord_activity(community, user, member, true) do
    Admins.Effects.activity(community, :admin_joined, :system, Ecto.UUID.generate(), 0, %{
      subject_user_id: user.id,
      member_id: member.id,
      before_permissions: %{},
      after_permissions: %{}
    })
  end
end
