defmodule GroupherServer.LocalTestActors.Communities do
  @moduledoc """
  Resolves local fixture communities and their real admin memberships.

      test actor -> community membership -> current permission facts
  """
  import Ecto.Query
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityAdmin}

  def require_admin(user, slug) when is_binary(slug) do
    with {:ok, community} <-
           CMS.fetch_community(slug, user, inc_views: false, policy_mode: :admin),
         {:ok, %{member_id: member_id} = member} <-
           CMS.get_current_community_admin_membership(community.ref, user) do
      {:ok, community,
       %{
         memberId: member_id,
         revision: member.revision,
         isLord: member.is_lord,
         permissions: Map.new(member.permissions, &{&1, true})
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
end
