defmodule GroupherServer.LocalTestActors.Communities do
  @moduledoc """
  Resolves local fixture communities and their real admin memberships.

      test actor -> community membership -> current permission facts
  """
  alias GroupherServer.CMS

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
    with {:ok, memberships} <- CMS.list_own_community_admin_memberships(user) do
      {:ok,
       Enum.map(memberships, fn member ->
         %{
           community: member.community,
           communityRef: member.community_ref,
           isLord: member.is_lord,
           permissions: member.permissions,
           revision: member.revision
         }
       end)}
    end
  end
end
