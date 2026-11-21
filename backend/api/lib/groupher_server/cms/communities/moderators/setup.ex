defmodule GroupherServer.CMS.Communities.Moderators.Setup do
  @moduledoc """
  Owns only the community-initialization moderator workflow.

  Authenticated moderator mutations live in `Moderators.Commands.*` and use
  `Moderators.Persist` under the CMS Command/Gate transaction owner. This module
  intentionally has no public add/remove/update mutation API; `add_root/2` is
  reserved for creating a community before its first root moderator exists.

      Community create workflow
        -> caller-owned community transaction
        -> Moderators.Setup.add_root/2
        -> canonical root membership / moderator count
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Model.{Community, CommunityModerator}
  alias Helper.{ORM, T}

  @doc "Adds the first root moderator while a community is being created."
  @spec add_root(Community.t(), User.t()) :: T.domain_res(term())
  def add_root(%Community{} = community, %User{} = target_user) do
    if Repo.in_transaction?() do
      insert_and_stamp_root(community, target_user)
    else
      {:error, :community_moderator_transaction_required}
    end
  end

  defp insert_and_stamp_root(%Community{} = community, %User{} = target_user) do
    with {:ok, moderator} <-
           ORM.create(CommunityModerator, %{
             user_id: target_user.id,
             community_id: community.id,
             is_lord: true,
             permissions: %{}
           }),
         {:ok, _community} <-
           Communities.Count.update(community, target_user, :moderators_count, :inc) do
      {:ok, %{moderator | is_root: moderator.is_lord}}
    end
  end
end
