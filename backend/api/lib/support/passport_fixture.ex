defmodule GroupherServer.Test.PassportFixture do
  @moduledoc """
  Writes canonical scoped permission rows for local tests and trusted fixtures.

  Test intent -> Catalog validation -> CommunityAdmin / GlobalPassport facts.
  This helper accepts canonical action maps, never legacy Passport JSON.
  """
  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.{Community, CommunityAdmin}

  def grant_community(%{id: user_id}, slug, permissions)
      when is_binary(slug) and is_map(permissions) do
    with %Community{} = community <- Repo.get_by(Community, slug: slug),
         member <-
           Repo.get_by(CommunityAdmin, community_id: community.id, user_id: user_id) ||
             %CommunityAdmin{community_id: community.id, user_id: user_id},
         {:ok, normalized} <-
           CMS.Passport.Catalog.validate_permissions(
             :community,
             Map.merge(member.permissions || %{}, permissions)
           ) do
      member
      |> CommunityAdmin.changeset(%{
        permissions: normalized,
        revision: (member.revision || 0) + 1
      })
      |> Repo.insert_or_update()
    else
      nil -> {:error, :community_not_found}
      {:error, _} = error -> error
    end
  end
end
