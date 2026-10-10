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
        -> membership / count / root passport
  """

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.Accounts.Model.User
  alias CMS.{Communities, Passport}
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.Passport.Registry
  alias Helper.{ORM, PermissionConfig, T}

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
             community_id: community.id
           }),
         {:ok, _community} <-
           Communities.Count.update(community, target_user, :moderators_count, :inc),
         {:ok, rules} <- PermissionConfig.default_root_passport(community.slug),
         {:ok, _} <- Passport.stamp_passport(rules, target_user),
         {:ok, moderator} <- update_passport_item_count(moderator, community, rules) do
      {:ok, moderator}
    end
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         %Community{} = community,
         rules
       ) do
    count =
      case get_in(rules, [community.slug]) do
        %{"root" => true} ->
          Registry.root_passport_item_count()

        %{"cms" => cms_rules} when is_map(cms_rules) ->
          Enum.count(cms_rules, fn {_rule, enabled} -> enabled == true end)

        %{cms: cms_rules} when is_map(cms_rules) ->
          Enum.count(cms_rules, fn {_rule, enabled} -> enabled == true end)

        _ ->
          0
      end

    ORM.update(moderator, %{passport_item_count: count})
  end
end
