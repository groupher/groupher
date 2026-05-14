defmodule GroupherServer.CMS.Communities.Moderator do
  @moduledoc """
  Moderator helpers for communities.
  """

  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities.Passport
  alias CMS.Model.{Community, CommunityModerator}
  alias CMS.{Communities, FrontDesk}
  alias Helper.{Multi, ORM, PermissionConfig, PermissionRegistry, T, Transaction}

  @doc """
  set a community moderator
  """
  @spec add(Community.t(), term(), User.t(), User.t()) :: T.domain_res(term())
  def add(%Community{} = community, role, %User{} = target_user, %User{} = cur_user) do
    community = Repo.preload(community, :moderators)

    case user_is_root?(community, cur_user) do
      {:ok, true} ->
        Transaction.lock_row(community, fn community ->
          Multi.new()
          |> insert_and_stamp_moderator(community, role, target_user)
          |> Repo.transaction()
          |> result()
        end)

      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can add moderator"}}
    end
  end

  @doc """
  set multiple community moderators
  """
  @spec add_many(Community.t(), term(), list(User.t()), User.t()) :: T.domain_res(term())
  def add_many(%Community{} = community, role, target_users, %User{} = cur_user)
      when is_list(target_users) do
    community = Repo.preload(community, :moderators)

    case user_is_root?(community, cur_user) do
      {:ok, true} ->
        Transaction.lock_row(community, fn community ->
          community = Repo.preload(community, :moderators)
          existing_user_ids = Enum.map(community.moderators, & &1.user_id)

          new_users =
            target_users
            |> Enum.uniq_by(& &1.id)
            |> Enum.reject(&(&1.id in existing_user_ids))

          new_users
          |> Enum.reduce(Multi.new(), fn target_user, multi ->
            insert_and_stamp_moderator(multi, community, role, target_user)
          end)
          |> Repo.transaction()
          |> case do
            {:ok, _} -> Communities.Read.read(community.slug, inc_views: false)
            error -> result(error)
          end
        end)

      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can add moderator"}}
    end
  end

  @doc """
  update community moderator
  """
  @spec update_passport(String.t() | Community.t(), term(), User.t(), User.t()) ::
          T.domain_res(term())
  def update_passport(
        community_slug,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      )
      when is_binary(community_slug) do
    case FrontDesk.community(community_slug) do
      {:ok, community} ->
        update_passport(community, rules, target_user, cur_user)

      {:error, reason} ->
        {:error, reason}
    end
  end

  def update_passport(
        %Community{} = community,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      ) do
    with {:ok, true} <- user_is_root?(community, cur_user),
         {:ok, :match} <- match_passport_community(community.slug, rules),
         {:ok, _} <- Passport.erase_passport([community.slug], target_user),
         {:ok, _} <- Passport.stamp_passport(rules, target_user) do
      update_passport_item_count(community, target_user, rules)

      Communities.Read.read(community.slug, inc_views: false)
    else
      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can update moderator"}}

      {:error, :passport_community_not_match} ->
        {:error, {:passport_community_not_match, "can only update passport in #{community.slug}"}}

      {:error, :one_community_only} ->
        {:error, {:one_community_only, "can only passport once community a time"}}

      _ ->
        {:error, {:custom, "update passport error"}}
    end
  end

  @doc """
  unset a community moderator
  """
  @spec remove(String.t() | Community.t(), User.t(), User.t()) :: T.domain_res(term())
  def remove(%Community{slug: community_slug}, %User{} = target_user, %User{} = cur_user) do
    remove(community_slug, target_user, cur_user)
  end

  def remove(community_slug, %User{} = target_user, %User{} = cur_user)
      when is_binary(community_slug) do
    with {:ok, community} <- FrontDesk.community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user) do
      Multi.new()
      |> Multi.run(:stamp_passport, fn _, _ ->
        Passport.erase_passport([community_slug], target_user)
      end)
      |> Multi.run(:delete_moderator, fn _, _ ->
        ORM.findby_delete!(CommunityModerator, %{
          user_id: target_user.id,
          community_id: community.id
        })
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        with {:ok, community} <- ORM.find(Community, community.id) do
          Communities.Count.update(
            community,
            target_user,
            :moderators_count,
            :dec
          )
        end
      end)
      |> Repo.transaction()
      |> case do
        {:ok, _} ->
          Communities.Read.read(community_slug, inc_views: false)

        error ->
          result(error)
      end
    else
      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can remove moderator"}}

      {:error, reason} ->
        {:error, reason}
    end
  end

  # Helpers

  defp insert_and_stamp_moderator(
         multi,
         %Community{} = community,
         role,
         %User{} = target_user
       ) do
    insert_name = {:insert_moderator, target_user.id}

    multi
    |> Multi.insert(
      insert_name,
      CommunityModerator.changeset(%CommunityModerator{}, %{
        user_id: target_user.id,
        community_id: community.id,
        role: role
      })
    )
    |> Multi.run({:update_community_count, target_user.id}, fn _, _ ->
      with {:ok, community} <- ORM.find(Community, community.id) do
        Communities.Count.update(community, target_user, :moderators_count, :inc)
      end
    end)
    |> Multi.run({:stamp_passport, target_user.id}, fn _, changes ->
      community_moderator = Map.fetch!(changes, insert_name)

      with {:ok, rules} <- PermissionConfig.default_passport_for_role(role, community.slug),
           {:ok, _} <- Passport.stamp_passport(rules, target_user) do
        update_passport_item_count(community_moderator, community, target_user, rules)
      end
    end)
  end

  defp update_passport_item_count(%Community{} = community, %User{} = user, rules) do
    with {:ok, community_moderator} <-
           ORM.find_by(CommunityModerator, %{community_id: community.id, user_id: user.id}) do
      update_passport_item_count(community_moderator, community, user, rules)
    end
  end

  defp update_passport_item_count(
         %CommunityModerator{role: "root"} = moderator,
         _community,
         _user,
         _rules
       ) do
    moderator |> ORM.update(%{passport_item_count: PermissionRegistry.root_passport_item_count()})
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         %Community{} = community,
         %User{} = _user,
         rules
       ) do
    case get_in(rules, [community.slug, "cms"]) do
      %{} ->
        community_rules = get_in(rules, [community.slug, "cms"]) || %{}

        passport_item_count =
          community_rules
          |> Enum.count(fn {_rule, enabled} -> enabled == true end)

        moderator |> ORM.update(%{passport_item_count: passport_item_count})

      _ ->
        moderator |> ORM.update(%{passport_item_count: 0})
    end
  end

  # this is for first init when create community
  defp user_is_root?(%Community{moderators: []}, %User{} = _cur_user), do: {:ok, true}

  defp user_is_root?(
         %Community{moderators: %Ecto.Association.NotLoaded{}} = community,
         %User{} = cur_user
       ) do
    community
    |> Repo.preload(:moderators)
    |> user_is_root?(cur_user)
  end

  defp user_is_root?(%Community{moderators: moderators}, %User{} = cur_user) do
    is_root =
      global_god?(cur_user) ||
        moderators
        |> Enum.filter(&(&1.role == "root"))
        |> Enum.any?(&(to_string(&1.user_id) == to_string(cur_user.id)))

    if is_root, do: {:ok, true}, else: {:error, :community_root_only}
  end

  defp global_god?(cur_user) do
    case Map.get(cur_user, :cur_passport) do
      passport when is_map(passport) ->
        passport
        |> PermissionRegistry.normalize_rules()
        |> get_in(["global", "god"]) == true

      _ ->
        false
    end
  end

  defp match_passport_community(community_slug, rules) do
    community_keys = rules |> Map.drop(["global"]) |> Map.keys()

    case length(community_keys) == 1 do
      true ->
        passport_community = community_keys |> List.first()

        if passport_community == community_slug,
          do: {:ok, :match},
          else: {:error, :passport_community_not_match}

      _ ->
        {:error, :one_community_only}
    end
  end

  defp result({:ok, %{subscribed_community: result}}) do
    {:ok, result}
  end

  defp result({:ok, %{update_community_count: result}}) do
    {:ok, result}
  end

  defp result({:ok, changes}) when is_map(changes) do
    changes
    |> Enum.find_value(fn
      {{:update_community_count, _user_id}, result} -> result
      _ -> nil
    end)
    |> case do
      nil -> {:ok, changes}
      result -> {:ok, result}
    end
  end

  defp result({:error, :stamp_passport, %Ecto.Changeset{} = result, _steps}),
    do: {:error, {:changeset, result}}

  defp result({:error, :stamp_passport, _result, _steps}),
    do: {:error, {:custom, "stamp passport error"}}

  defp result({:error, {:stamp_passport, _user_id}, %Ecto.Changeset{} = result, _steps}),
    do: {:error, {:changeset, result}}

  defp result({:error, {:stamp_passport, _user_id}, _result, _steps}),
    do: {:error, {:custom, "stamp passport error"}}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
