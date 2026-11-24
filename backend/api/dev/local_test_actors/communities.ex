defmodule GroupherServer.LocalTestActors.Communities do
  @moduledoc """
  Creates run-owned communities through the normal Community Command.

      test owner -> Community creation / Lifecycle / lord -> owned community ref
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo, LocalTestActors}
  alias CMS.Model.{Community, CommunityAdmin}

  def create(run, %{"owner" => name, "slug" => slug} = input) when is_binary(slug) do
    with {:ok, user, binding} <- LocalTestActors.actor(run, name) do
      case Repo.get_by(Community, slug: slug) do
        nil ->
          with {:ok, community} <-
                 CMS.Communities.Commands.Create.execute(
                   %{
                     slug: slug,
                     title: input["title"] || "Local #{slug}",
                     desc: "Local test community for #{run}",
                     logo: "https://static.groupher.com/icons/cmd/alien_user3.svg"
                   },
                   user,
                   Ecto.UUID.generate()
                 ),
               {:ok, _} <-
                 binding
                 |> Ecto.Changeset.change(
                   raw: Map.update!(binding.raw, "communities", &[community.id | &1])
                 )
                 |> Repo.update() do
            present(community, user)
          end

        %Community{} = community ->
          if community.user_id == user.id and community.id in binding.raw["communities"] do
            present(community, user)
          else
            {:error, :local_test_community_collision}
          end
      end
    end
  end

  def create(_, _), do: {:error, :invalid_local_test_community}

  def require_admin(user, slug) when is_binary(slug) do
    with %Community{} = community <- Repo.get_by(Community, slug: slug),
         %CommunityAdmin{} = member <-
           Repo.get_by(CommunityAdmin, community_id: community.id, user_id: user.id),
         {:ok, facts} <- CMS.Passport.community_facts(user.id, community.id),
         {:ok, _} <- CMS.Gate.access_check(user, :read, community) do
      {:ok, community,
       %{
         memberId: member.id,
         revision: facts.revision,
         isLord: facts.is_lord,
         permissions: facts.permissions
       }}
    else
      _ -> {:error, :local_test_community_admin_required}
    end
  end

  def require_admin(_, _), do: {:error, :local_test_community_admin_required}

  def memberships(user) do
    Repo.all(
      from(a in CommunityAdmin,
        join: c in Community,
        on: c.id == a.community_id,
        where: a.user_id == ^user.id,
        select: %{
          community: c.slug,
          communityRef: c.ref,
          isLord: a.is_lord,
          permissions: a.permissions,
          revision: a.revision
        }
      )
    )
  end

  defp present(community, user) do
    with {:ok, _, facts} <- require_admin(user, community.slug) do
      {:ok, %{slug: community.slug, communityRef: community.ref, owner: user.login, admin: facts}}
    end
  end
end
