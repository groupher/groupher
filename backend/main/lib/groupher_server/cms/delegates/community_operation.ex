defmodule GroupherServer.CMS.Delegate.CommunityOperation do
  @moduledoc """
  community operations, like: set/unset category/thread/moderator...
  """
  import ShortMaps

  import Helper.Utils, only: [done: 1]
  import Helper.ErrorCode

  alias Helper.{Certification, IP2City, ORM}
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Delegate.PassportCRUD

  alias CMS.Model.{
    Category,
    Community,
    CommunityCategory,
    CommunityModerator,
    CommunitySubscriber,
    CommunityThread,
    Thread
  }

  alias CMS.Delegate.CommunityCRUD
  alias Ecto.Multi

  @doc """
  set a category to community
  """
  def set_category(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.create(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end

  @doc """
  unset a category to community
  """
  def unset_category(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.findby_delete!(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end

  @doc """
  set to thread to a community
  """
  def set_thread(%Community{id: community_id}, %Thread{id: thread_id}) do
    with {:ok, community_thread} <- CommunityThread |> ORM.create(~m(community_id thread_id)a) do
      Community |> ORM.find(community_thread.community_id)
    end
  end

  @doc """
  unset to thread to a community
  """
  def unset_thread(%Community{id: community_id}, %Thread{id: thread_id}) do
    with {:ok, community_thread} <-
           CommunityThread |> ORM.findby_delete!(~m(community_id thread_id)a) do
      Community |> ORM.find(community_thread.community_id)
    end
  end

  defp update_passport_item_count(%Community{id: community_id, slug: slug}, user_id, rules) do
    with {:ok, community_moderator} <- ORM.find_by(CommunityModerator, ~m(community_id user_id)a) do
      update_passport_item_count(community_moderator, slug, user_id, rules)
    end
  end

  defp update_passport_item_count(
         %CommunityModerator{role: "root"} = moderator,
         _community_slug,
         _user_id,
         _rules
       ) do
    moderator |> ORM.update(%{passport_item_count: Certification.root_passport_item_count()})
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         community_slug,
         user_id,
         rules
       ) do
    case Map.has_key?(rules, community_slug) do
      true ->
        {:ok, passport_rules} = PassportCRUD.get_passport(%User{id: user_id})
        passport_item_count = get_in(passport_rules, [community_slug]) |> Map.keys() |> length
        moderator |> ORM.update(%{passport_item_count: passport_item_count})

      false ->
        moderator |> ORM.update(%{passport_item_count: 0})
    end
  end

  @doc """
  set a community moderator
  """
  def add_moderator(community_slug, role, %User{id: user_id}, %User{} = cur_user) do
    with {:ok, community} <- ORM.find_community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user) do
      community_id = community.id

      Multi.new()
      |> Multi.insert(
        :insert_moderator,
        CommunityModerator.changeset(%CommunityModerator{}, ~m(user_id community_id role)a)
      )
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(community, user_id, :moderators_count, :inc)
      end)
      |> Multi.run(:stamp_passport, fn _, %{insert_moderator: community_moderator} ->
        rules = Certification.passport_rules(cms: role)

        update_passport_item_count(community_moderator, community_slug, user_id, rules)
        PassportCRUD.stamp_passport(rules, %User{id: user_id})
      end)
      |> Repo.transaction()
      |> result()
    else
      {:error, false} ->
        {:error,
         [message: "only community root can add moderator", code: ecode(:community_root_only)]}
    end
  end

  @doc """
  update community moderator
  """
  def update_moderator_passport(community_slug, rules, %User{id: user_id}, %User{} = cur_user) do
    with {:ok, community} <- ORM.find_community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user),
         {:ok, :match} <- match_passport_community(community_slug, rules),
         {:ok, _} <- PassportCRUD.stamp_passport(rules, %User{id: user_id}) do
      update_passport_item_count(community, user_id, rules)

      CMS.read_community(community_slug, inc_views: false)
    else
      {:error, false} ->
        {:error,
         [message: "only community root can update moderator", code: ecode(:community_root_only)]}

      {:error, :passport_community_not_match} ->
        {:error,
         [
           message: "can only update passport in #{community_slug}",
           code: ecode(:passport_community_not_match)
         ]}

      {:error, :one_community_only} ->
        {:error,
         [message: "can only passport once community a time", code: ecode(:one_community_only)]}

      _ ->
        {:error, "update passport error"}
    end
  end

  @doc """
  unset a community moderator
  """
  def remove_moderator(community_slug, %User{id: user_id}, %User{} = cur_user) do
    with {:ok, community} <- ORM.find_community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user) do
      community_id = community.id

      Multi.new()
      |> Multi.run(:stamp_passport, fn _, _ ->
        PassportCRUD.erase_passport([community_slug], %User{id: user_id})
      end)
      |> Multi.run(:delete_moderator, fn _, _ ->
        ORM.findby_delete!(CommunityModerator, ~m(user_id community_id)a)
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        with {:ok, community} <- ORM.find(Community, community_id) do
          CommunityCRUD.update_community_count_field(community, user_id, :moderators_count, :dec)
        end
      end)
      |> Repo.transaction()
      |> result()
    else
      {:error, false} ->
        {:error,
         [message: "only community root can remove moderator", code: ecode(:community_root_only)]}
    end
  end

  # this is for first init when create community
  defp user_is_root?(%Community{moderators: []}, %User{} = cur_user), do: {:ok, true}

  defp user_is_root?(%Community{moderators: moderators}, %User{} = cur_user) do
    moderators
    |> Enum.filter(&(&1.role == "root"))
    |> Enum.any?(&(to_string(&1.user_id) == to_string(cur_user.id)))
    |> done
  end

  defp match_passport_community(community_slug, rules) do
    community_keys = Map.keys(rules)

    with true <- length(community_keys) == 1 do
      passport_community = community_keys |> List.first()

      if passport_community == community_slug,
        do: {:ok, :match},
        else: {:error, :passport_community_not_match}
    else
      _ -> {:error, :one_community_only}
    end
  end

  @doc """
  subscribe a community. (ONLY community, post etc use watch )
  """
  def subscribe_community(%Community{id: community_id}, %User{id: user_id}) do
    with {:ok, record} <- ORM.create(CommunitySubscriber, ~m(user_id community_id)a) do
      Multi.new()
      |> Multi.run(:subscribed_community, fn _, _ ->
        ORM.find(Community, record.community_id)
      end)
      |> Multi.run(:update_community_count, fn _, %{subscribed_community: community} ->
        CommunityCRUD.update_community_count_field(community, user_id, :subscribers_count, :inc)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user_id)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  def subscribe_community(%Community{id: community_id}, %User{id: user_id}, remote_ip) do
    with {:ok, record} <- ORM.create(CommunitySubscriber, ~m(user_id community_id)a) do
      Multi.new()
      |> Multi.run(:subscribed_community, fn _, _ ->
        ORM.find(Community, record.community_id)
      end)
      |> Multi.run(:update_community_geo, fn _, _ ->
        update_community_geo(community_id, user_id, remote_ip, :inc)
      end)
      |> Multi.run(:update_community_count, fn _, %{subscribed_community: community} ->
        CommunityCRUD.update_community_count_field(community, user_id, :subscribers_count, :inc)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user_id)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  unsubscribe a community
  """
  def unsubscribe_community(%Community{id: community_id}, %User{id: user_id}) do
    with {:ok, community} <- ORM.find(Community, community_id),
         true <- community.slug !== "home" do
      Multi.new()
      |> Multi.run(:unsubscribed_community, fn _, _ ->
        ORM.findby_delete!(CommunitySubscriber, %{community_id: community.id, user_id: user_id})
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(community, user_id, :subscribers_count, :dec)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user_id)
      end)
      |> Repo.transaction()
      |> result()
    else
      false ->
        {:error, "can not unsubscribe home community"}

      error ->
        error
    end
  end

  def unsubscribe_community(
        %Community{id: community_id},
        %User{id: user_id, geo_city: nil},
        remote_ip
      ) do
    with {:ok, community} <- ORM.find(Community, community_id),
         true <- community.slug !== "home" do
      Multi.new()
      |> Multi.run(:unsubscribed_community, fn _, _ ->
        ORM.findby_delete!(CommunitySubscriber, %{community_id: community.id, user_id: user_id})
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(community, user_id, :subscribers_count, :dec)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user_id)
      end)
      |> Multi.run(:update_community_geo, fn _, _ ->
        update_community_geo(community_id, user_id, remote_ip, :dec)
      end)
      |> Repo.transaction()
      |> result()
    else
      false ->
        {:error, "can't delete home community"}

      error ->
        error
    end
  end

  def unsubscribe_community(
        %Community{id: community_id},
        %User{id: user_id, geo_city: city},
        _remote_ip
      ) do
    with {:ok, community} <- ORM.find(Community, community_id),
         true <- community.slug !== "home" do
      Multi.new()
      |> Multi.run(:unsubscribed_community, fn _, _ ->
        ORM.findby_delete!(CommunitySubscriber, %{community_id: community.id, user_id: user_id})
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(community, user_id, :subscribers_count, :dec)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user_id)
      end)
      |> Multi.run(:update_community_geo_city, fn _, _ ->
        update_community_geo_map(community.id, city, :dec)
      end)
      |> Repo.transaction()
      |> result()
    else
      false -> {:error, "can't delete home community"}
      error -> error
    end
  end

  def subscribe_community_ifnot(%Community{} = community, %User{} = user) do
    with {:error, _} <-
           ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      subscribe_community(community, user)
    end
  end

  @doc """
  if user is new subscribe home community by default
  """
  # 这里只有一种情况，就是第一次没有解析到 remote_ip, 那么就直接订阅社区, 但不更新自己以及社区的地理信息
  def subscribe_default_community_ifnot(%User{} = user) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home"),
         {:error, _} <-
           ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      subscribe_community(community, user)
    end
  end

  # 3种情况
  # 1. 第一次就直接解析到了 remote_ip, 正常订阅加更新地理信息
  # 2. 之前已经订阅过，但是之前的 remote_ip 为空
  # 3. 有 remote_ip 但是 geo_city 信息没有解析到
  def subscribe_default_community_ifnot(%User{geo_city: nil} = user, remote_ip) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      case ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
        {:error, _} ->
          # 之前没有订阅过且第一次就解析到了 remote_ip
          subscribe_community(community, user, remote_ip)

        {:ok, _} ->
          # 之前订阅过，但是之前没有正确解析到 remote_ip 地址, 这次直接更新地理信息
          update_community_geo(community.id, user.id, remote_ip, :inc)
      end
    end
  end

  # 用户的 geo_city 和 remote_ip 都有了，如果没订阅 home 直接就更新 community geo 即可
  def subscribe_default_community_ifnot(%User{geo_city: city} = user, _remote_ip) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      case ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
        {:error, _} -> update_community_geo_map(community.id, city, :inc)
        # 手续齐全且之前也订阅了
        {:ok, _} -> {:ok, :pass}
      end
    end
  end

  defp update_community_geo(community_id, user_id, remote_ip, method) do
    {:ok, user} = ORM.find(User, user_id)

    case get_user_geocity(user.geo_city, remote_ip) do
      {:ok, user_geo_city} ->
        update_community_geo_map(community_id, user_geo_city, method)

      {:error, _} ->
        {:ok, :pass}
    end
  end

  defp get_user_geocity(nil, remote_ip) do
    case IP2City.locate_city(remote_ip) do
      {:ok, city} -> {:ok, city}
      {:error, _} -> {:error, "update_community geo error"}
    end
  end

  defp get_user_geocity(geo_city, _remote_ip), do: {:ok, geo_city}

  defp update_community_geo_map(community_id, city, method) do
    with {:ok, community} <- Community |> ORM.find(community_id) do
      community_geo_data = community.geo_info |> Map.get("data")

      cur_city_info = community_geo_data |> Enum.find(fn g -> g["city"] == city end)
      new_city_info = update_geo_value(cur_city_info, method)

      community_geo_data =
        community_geo_data
        |> Enum.reject(fn g -> g["city"] == city end)
        |> Kernel.++([new_city_info])

      community |> ORM.update(%{geo_info: %{data: community_geo_data}})
    end
  end

  defp update_geo_value(geo_info, :inc) do
    Map.merge(geo_info, %{"value" => geo_info["value"] + 1})
  end

  defp update_geo_value(geo_info, :dec) do
    Map.merge(geo_info, %{"value" => max(geo_info["value"] - 1, 0)})
  end

  defp result({:ok, %{subscribed_community: result}}) do
    {:ok, result}
  end

  defp result({:ok, %{update_community_count: result}}) do
    {:ok, result}
  end

  defp result({:error, :stamp_passport, %Ecto.Changeset{} = result, _steps}),
    do: {:error, result}

  defp result({:error, :stamp_passport, _result, _steps}),
    do: {:error, "stamp passport error"}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
