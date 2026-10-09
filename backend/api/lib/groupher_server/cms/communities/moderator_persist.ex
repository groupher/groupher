defmodule GroupherServer.CMS.Communities.ModeratorPersist do
  @moduledoc """
  Transaction-free persistence primitives for authenticated moderator commands.

  `CMS.Command`/`CMS.Gate` owns the receipt and aggregate transaction. This
  module only performs the membership, passport and count writes inside that
  transaction. Community setup keeps using `Moderator.add_root/2` as its
  explicitly named workflow path.

      Moderator Command / setup workflow
        -> Gate or workflow transaction
        -> ModeratorPersist
        -> membership / passport / count rows
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities.{Count, ErrorCat, Passport}
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.Passport.Registry
  alias Helper.{ORM, PermissionConfig}

  @doc "Adds one moderator without opening a transaction."
  def add(%Community{} = community, %User{} = target_user, %User{} = actor) do
    with {:ok, true} <- root_allowed?(community, actor),
         {:ok, moderator} <- insert_moderator(community, target_user, :moderator),
         {:ok, _community} <- update_count(community, target_user, :inc) do
      {:ok, moderator}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Adds many moderators, preserving per-target partial success."
  def add_many(%Community{} = community, targets, %User{} = actor) when is_list(targets) do
    with {:ok, true} <- root_allowed?(community, actor) do
      results =
        targets
        |> Enum.uniq_by(& &1.id)
        |> Enum.map(fn target ->
          case add_one(community, target) do
            {:ok, _moderator} ->
              %{"user_id" => target.id, "ok" => true, "error" => nil}

            {:error, reason} ->
              %{"user_id" => target.id, "ok" => false, "error" => inspect(reason)}
          end
        end)

      {:ok, results}
    else
      {:error, reason} -> {:error, reason}
    end
  end

  @doc "Removes one moderator without opening a transaction."
  def remove(%Community{} = community, %User{} = target_user, %User{} = actor) do
    with {:ok, true} <- root_allowed?(community, actor),
         {:ok, _} <- Passport.erase_passport([community.slug], target_user),
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
        %User{} = target_user,
        %User{} = actor
      ) do
    with {:ok, true} <- root_allowed?(community, actor),
         {:ok, :match} <- match_passport_community(community.slug, rules),
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
         {:ok, _community} <- update_count(community, target_user, :inc) do
      {:ok, moderator}
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

  defp update_count(%Community{id: community_id}, %User{} = user, direction) do
    with {:ok, current} <- ORM.find(Community, community_id) do
      Count.update(current, user, :moderators_count, direction)
    end
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

  defp root_allowed?(%Community{slug: slug} = community, %User{} = actor) do
    moderators =
      case community.moderators do
        %Ecto.Association.NotLoaded{} -> Repo.preload(community, :moderators).moderators
        value -> value
      end

    cond do
      moderators == [] -> {:ok, true}
      global_god?(actor) or community_root?(actor, slug) -> {:ok, true}
      true -> {:error, ErrorCat.community_root_only("only community root can manage moderators")}
    end
  end

  defp global_god?(%User{} = user), do: passport_rule(user, ["global", "god"]) == true
  defp community_root?(%User{} = user, slug), do: passport_rule(user, [slug, "root"]) == true

  defp passport_rule(%User{} = user, path) do
    case Passport.get_passport(user) do
      {:ok, passport} -> get_in(Registry.normalize_rules(passport), path)
      _ -> nil
    end
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
