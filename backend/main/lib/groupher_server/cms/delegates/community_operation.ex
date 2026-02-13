defmodule GroupherServer.CMS.Delegate.CommunityOperation do
  @moduledoc """
  community operations, like: set/unset category/thread/moderator...
  """
  import ShortMaps

  alias Helper.{Certification, ORM, Transaction}
  alias Helper.Types, as: T
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
  @spec set_category(Community.t(), Category.t()) :: T.domain_res(term())
  def set_category(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.create(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end

  @doc """
  unset a category to community
  """
  @spec unset_category(Community.t(), Category.t()) :: T.domain_res(term())
  def unset_category(%Community{id: community_id}, %Category{id: category_id}) do
    with {:ok, community_category} <-
           CommunityCategory |> ORM.findby_delete!(~m(community_id category_id)a) do
      Community |> ORM.find(community_category.community_id)
    end
  end

  @doc """
  set to thread to a community
  """
  @spec set_thread(Community.t(), Thread.t()) :: T.domain_res(term())
  def set_thread(%Community{} = community, %Thread{} = thread) do
    attrs = %{community_id: community.id, thread_id: thread.id}

    with {:ok, community_thread} <- ORM.create(CommunityThread, attrs) do
      Community |> ORM.find(community_thread.community_id)
    end
  end

  @doc """
  unset to thread to a community
  """
  @spec unset_thread(Community.t(), Thread.t()) :: T.domain_res(term())
  def unset_thread(%Community{} = community, %Thread{} = thread) do
    with {:ok, community_thread} <-
           ORM.findby_delete!(CommunityThread, %{community_id: community.id, thread_id: thread.id}) do
      Community |> ORM.find(community_thread.community_id)
    end
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
    moderator |> ORM.update(%{passport_item_count: Certification.root_passport_item_count()})
  end

  defp update_passport_item_count(
         %CommunityModerator{} = moderator,
         %Community{} = community,
         %User{} = user,
         rules
       ) do
    case Map.has_key?(rules, community.slug) do
      true ->
        {:ok, passport_rules} = PassportCRUD.get_passport(user)
        passport_item_count = get_in(passport_rules, [community.slug]) |> Map.keys() |> length
        moderator |> ORM.update(%{passport_item_count: passport_item_count})

      false ->
        moderator |> ORM.update(%{passport_item_count: 0})
    end
  end

  @doc """
  set a community moderator
  """
  @spec add_moderator(Community.t(), term(), User.t(), User.t()) :: T.domain_res(term())
  def add_moderator(%Community{} = community, role, %User{} = target_user, %User{} = cur_user) do
    community = Repo.preload(community, :moderators)

    case user_is_root?(community, cur_user) do
      {:ok, true} ->
        Transaction.locking(community, fn community ->
          Multi.new()
          |> Multi.insert(
            :insert_moderator,
            CommunityModerator.changeset(%CommunityModerator{}, %{
              user_id: target_user.id,
              community_id: community.id,
              role: role
            })
          )
          |> Multi.run(:update_community_count, fn _, _ ->
            CommunityCRUD.update_community_count_field(
              community,
              target_user,
              :moderators_count,
              :inc
            )
          end)
          |> Multi.run(:stamp_passport, fn _, %{insert_moderator: community_moderator} ->
            rules = Certification.passport_rules(cms: role)

            update_passport_item_count(community_moderator, community, target_user, rules)
            PassportCRUD.stamp_passport(rules, target_user)
          end)
          |> Repo.transaction()
          |> result()
        end)

      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can add moderator"}}
    end
  end

  @doc """
  update community moderator
  """
  @spec update_moderator_passport(String.t() | Community.t(), term(), User.t(), User.t()) ::
          T.domain_res(term())
  def update_moderator_passport(
        community_slug,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      )
      when is_binary(community_slug) do
    with {:ok, community} <- ORM.find_by(Community, %{slug: community_slug}, preload: :moderators) do
      update_moderator_passport(community, rules, target_user, cur_user)
    end
  end

  def update_moderator_passport(
        %Community{} = community,
        rules,
        %User{} = target_user,
        %User{} = cur_user
      ) do
    with {:ok, true} <- user_is_root?(community, cur_user),
         {:ok, :match} <- match_passport_community(community.slug, rules),
         {:ok, _} <- PassportCRUD.stamp_passport(rules, target_user) do
      update_passport_item_count(community, target_user, rules)

      CMS.read_community(community.slug, inc_views: false)
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
  @spec remove_moderator(String.t() | Community.t(), User.t(), User.t()) :: T.domain_res(term())
  def remove_moderator(community_slug, %User{} = target_user, %User{} = cur_user) do
    with {:ok, community} <- ORM.find_community(community_slug),
         {:ok, true} <- user_is_root?(community, cur_user) do
      Multi.new()
      |> Multi.run(:stamp_passport, fn _, _ ->
        PassportCRUD.erase_passport([community_slug], target_user)
      end)
      |> Multi.run(:delete_moderator, fn _, _ ->
        ORM.findby_delete!(CommunityModerator, %{
          user_id: target_user.id,
          community_id: community.id
        })
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        with {:ok, community} <- ORM.find(Community, community.id) do
          CommunityCRUD.update_community_count_field(
            community,
            target_user,
            :moderators_count,
            :dec
          )
        end
      end)
      |> Repo.transaction()
      |> result()
    else
      {:error, :community_root_only} ->
        {:error, {:community_root_only, "only community root can remove moderator"}}
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
      moderators
      |> Enum.filter(&(&1.role == "root"))
      |> Enum.any?(&(to_string(&1.user_id) == to_string(cur_user.id)))

    if is_root, do: {:ok, true}, else: {:error, :community_root_only}
  end

  defp match_passport_community(community_slug, rules) do
    community_keys = Map.keys(rules)

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

  @doc """
  subscribe a community. (ONLY community, post etc use watch )
  """
  @spec subscribe_community(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe_community(%Community{} = community, %User{} = user) do
    with {:ok, record} <-
           ORM.create(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      Multi.new()
      |> Multi.run(:subscribed_community, fn _, _ ->
        ORM.find(Community, record.community_id)
      end)
      |> Multi.run(:update_community_count, fn _, %{subscribed_community: community} ->
        CommunityCRUD.update_community_count_field(community, user, :subscribers_count, :inc)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user)
      end)
      |> Repo.transaction()
      |> result()
    end
  end

  @doc """
  unsubscribe a community
  """
  @spec unsubscribe_community(Community.t(), User.t()) :: T.domain_res(term())
  def unsubscribe_community(%Community{id: community_id}, %User{} = user) do
    with {:ok, community} <- ORM.find(Community, community_id),
         true <- community.slug !== "home" do
      Multi.new()
      |> Multi.run(:unsubscribed_community, fn _, _ ->
        ORM.findby_delete!(CommunitySubscriber, %{community_id: community.id, user_id: user.id})
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        CommunityCRUD.update_community_count_field(community, user, :subscribers_count, :dec)
      end)
      |> Multi.run(:update_user_subscribe_state, fn _, _ ->
        Accounts.update_subscribe_state(user)
      end)
      |> Repo.transaction()
      |> result()
    else
      false ->
        {:error, {:custom, "can not unsubscribe home community"}}

      error ->
        error
    end
  end

  @spec subscribe_community_ifnot(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe_community_ifnot(%Community{} = community, %User{} = user) do
    with {:error, _} <-
           ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      subscribe_community(community, user)
    end
  end

  @doc """
  if user is new subscribe home community by default
  """
  # 这里只处理第一次订阅 home 社区
  @spec subscribe_default_community_ifnot(User.t()) :: T.domain_res(term())
  def subscribe_default_community_ifnot(%User{} = user) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      case ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
        {:error, _} -> subscribe_community(community, user)
        {:ok, _} -> {:ok, :pass}
      end
    end
  end

  defp result({:ok, %{subscribed_community: result}}) do
    {:ok, result}
  end

  defp result({:ok, %{update_community_count: result}}) do
    {:ok, result}
  end

  defp result({:error, :stamp_passport, %Ecto.Changeset{} = result, _steps}),
    do: {:error, {:changeset, result}}

  defp result({:error, :stamp_passport, _result, _steps}),
    do: {:error, {:custom, "stamp passport error"}}

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
