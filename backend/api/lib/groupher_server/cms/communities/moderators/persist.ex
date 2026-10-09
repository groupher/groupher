defmodule GroupherServer.CMS.Communities.Moderators.Persist do
  @moduledoc """
  Transaction-free persistence primitives for authenticated moderator commands.

  `CMS.Command`/`CMS.Gate` owns admission, the receipt and the aggregate
  transaction. This module only performs membership, passport and count writes
  inside that transaction. Community setup keeps using
  `Moderators.Setup.add_root/2` as its explicitly named workflow path.

      Moderators.Command / setup workflow
        -> Gate or workflow transaction
        -> Moderators.Persist
        -> membership / passport / count rows
  """

  alias GroupherServer.{Accounts, CMS}
  alias Accounts.Model.User
  alias CMS.Communities.{Count, ErrorCat, Passport}
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.Passport.Registry
  alias Helper.{ORM, PermissionConfig}

  @doc "Adds one moderator without opening a transaction or checking admission."
  def add(%Community{} = community, %User{} = target_user) do
    with {:ok, moderator} <- insert_moderator(community, target_user, :moderator),
         {:ok, _community} <- update_count(community, target_user, :inc) do
      {:ok, moderator}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Adds many moderators, preserving per-target partial success."
  def add_many(%Community{} = community, targets) when is_list(targets) do
    {results, _community} =
      targets
      |> Enum.uniq_by(& &1.id)
      |> Enum.map_reduce(community, fn target, current_community ->
        case add_one(current_community, target) do
          {:ok, _moderator, updated_community} ->
            {%{"user_id" => target.id, "ok" => true, "error" => nil}, updated_community}

          {:error, reason} ->
            {%{"user_id" => target.id, "ok" => false, "error" => inspect(reason)},
             current_community}
        end
      end)

    {:ok, results}
  end

  @doc "Removes one moderator without opening a transaction or checking admission."
  def remove(%Community{} = community, %User{} = target_user) do
    with {:ok, _} <- Passport.erase_passport([community.slug], target_user),
         {:ok, deleted} <-
           ORM.findby_delete!(CommunityModerator, %{
             user_id: target_user.id,
             community_id: community.id
           }),
         {:ok, _community} <- update_count(community, target_user, :dec) do
      {:ok, deleted}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Updates a moderator passport without opening a transaction."
  def update_passport(
        %Community{} = community,
        rules,
        %User{} = target_user
      ) do
    with {:ok, :match} <- match_passport_community(community.slug, rules),
         {:ok, _} <- Passport.erase_passport([community.slug], target_user),
         {:ok, _} <- Passport.stamp_passport(rules, target_user),
         {:ok, _} <- update_passport_item_count(community, target_user, rules) do
      {:ok, :pass}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp add_one(community, target_user) do
    with {:ok, moderator} <- insert_moderator(community, target_user, :moderator),
         {:ok, updated_community} <- update_count(community, target_user, :inc) do
      {:ok, moderator, updated_community}
    end
  end

  defp insert_moderator(%Community{} = community, %User{} = target_user, type) do
    with {:ok, moderator} <-
           ORM.create(CommunityModerator, %{
             user_id: target_user.id,
             community_id: community.id
           }),
         {:ok, rules} <- default_passport(type, community.slug),
         {:ok, _} <- Passport.stamp_passport(rules, target_user),
         {:ok, moderator} <- update_passport_item_count(moderator, community, rules) do
      {:ok, moderator}
    end
  end

  defp update_count(%Community{} = community, %User{} = user, direction) do
    Count.update(community, user, :moderators_count, direction)
  end

  defp default_passport(:moderator, community_slug),
    do: PermissionConfig.default_moderator_passport(community_slug)

  defp update_passport_item_count(%Community{} = community, %User{} = user, rules) do
    with {:ok, moderator} <-
           ORM.find_by(CommunityModerator, %{community_id: community.id, user_id: user.id}) do
      update_passport_item_count(moderator, community, rules)
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
          Enum.count(cms_rules, &match?({_k, true}, &1))

        %{cms: cms_rules} when is_map(cms_rules) ->
          Enum.count(cms_rules, &match?({_k, true}, &1))

        _ ->
          0
      end

    ORM.update(moderator, %{passport_item_count: count})
  end

  defp match_passport_community(community_slug, rules) do
    community_keys = rules |> Map.drop(["global", :global]) |> Map.keys()

    if length(community_keys) == 1 and
         Enum.any?(community_keys, &(to_string(&1) == community_slug)) do
      {:ok, :match}
    else
      case length(community_keys) do
        1 ->
          {:error,
           ErrorCat.passport_community_not_match("passport must target #{community_slug}")}

        _ ->
          {:error, ErrorCat.one_community_only("passport must target one community")}
      end
    end
  end
end
