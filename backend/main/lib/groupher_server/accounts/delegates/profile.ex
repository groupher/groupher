defmodule GroupherServer.Accounts.Delegate.Profile do
  @moduledoc """
  accounts profile
  """
  import Ecto.Query, warn: false
  import Helper.Utils, only: [done: 1, keys_to_atoms: 1, get_config: 2]
  import ShortMaps
  import Helper.ErrorCode

  alias GroupherServer.{Accounts, CMS, Email, Repo, Statistics}

  alias Accounts.Model.{Achievement, OauthProvider, User, Social, Embeds}
  alias CMS.Model.{Community, CommunitySubscriber}

  alias GroupherServer.Accounts.Delegate.Fans

  alias Helper.{Guardian, ORM, QueryBuilder, IP2City}
  alias Ecto.Multi

  @default_user_meta Embeds.UserMeta.default_meta()
  @default_subscribed_communities get_config(:general, :default_subscribed_communities)

  def read_user(%User{} = user) do
    with {:ok, user} <- ORM.inc(user, :views),
         {:ok, user} <- assign_meta_ifneed(user) do
      case user.contributes do
        nil -> assign_default_contributes(user)
        _ -> {:ok, user}
      end
    end
  end

  def read_user(%User{} = user, %User{meta: nil}), do: read_user(user)

  def read_user(%User{} = user, %User{} = cur_user) do
    with {:ok, user} <- read_user(user) do
      # Ta 关注了你
      viewer_been_followed = user.id in cur_user.meta.follower_user_ids
      # 正在关注
      viewer_has_followed = user.id in cur_user.meta.following_user_ids

      user =
        Map.merge(user, %{
          viewer_been_followed: viewer_been_followed,
          viewer_has_followed: viewer_has_followed
        })

      {:ok, user}
    end
  end

  defp assign_meta_ifneed(%User{meta: nil} = user) do
    {:ok, Map.merge(user, %{meta: @default_user_meta})}
  end

  defp assign_meta_ifneed(user) do
    {:ok, user}
  end

  def paged_users(filter, %User{} = user) do
    ORM.find_all(User, filter) |> Fans.mark_viewer_follow_status(user) |> done
  end

  def paged_users(filter) do
    ORM.find_all(User, filter)
  end

  @doc """
  update user's profile
  """
  def update_profile(%User{} = user, attrs \\ %{}) do
    changeset = user |> Ecto.Changeset.change(attrs)

    changeset
    |> update_social_ifneed(user, attrs)
    |> User.update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  update user's subscribed communities count
  """
  def update_subscribe_state(%User{} = user) do
    query =
      from(s in CommunitySubscriber,
        where: s.user_id == ^user.id,
        join: c in assoc(s, :community),
        select: c.id
      )

    subscribed_communities_ids = query |> Repo.all()
    subscribed_communities_count = subscribed_communities_ids |> length

    {:ok, user} = ORM.update(user, %{subscribed_communities_count: subscribed_communities_count})
    ORM.update_meta(user, %{subscribed_communities_ids: subscribed_communities_ids})
  end

  @doc """
  update geo info for user, include geo_city & remote ip
  """
  def update_geo(%User{geo_city: geo_city} = user, remote_ip) when is_nil(geo_city) do
    case IP2City.locate_city(remote_ip) do
      {:ok, city} ->
        update_profile(user, %{geo_city: city, remote_ip: remote_ip})

      {:error, _} ->
        update_profile(user, %{remote_ip: remote_ip})
        {:ok, :pass}
    end
  end

  def update_geo(%User{} = user, remote_ip), do: update_profile(user, %{remote_ip: remote_ip})
  def update_geo(_user, _remote_ip), do: {:ok, :pass}

  def link_oauth(login, provider) do
    provider = provider |> keys_to_atoms

    with {:ok, user} <- ORM.find_by(User, login: login),
         create_profile(user, provider),
         update_profile_social(user, provider) do
      gen_token(user)
    end
  end

  def unlink_oauth(login, provider) do
    provider = provider |> keys_to_atoms

    with {:ok, user} <- ORM.find_by(User, login: login),
         {:ok, oauth_provider} <- find_oauth_provider(provider) do
      {:ok, provider_count} =
        from(o in OauthProvider, where: o.user_id == ^user.id)
        |> ORM.count()

      case provider_count do
        1 ->
          {:error, [message: "can not delete last oauth provider", code: ecode(:oauth_unlink)]}

        _ ->
          oauth_provider |> ORM.delete()
      end
    end
  end

  @doc """
  user_info be like
  """
  def signin_oauth(provider) do
    provider = provider |> keys_to_atoms

    case find_oauth_provider(provider) do
      {:ok, oauth_provider} ->
        {:ok, user} = ORM.find(User, oauth_provider.user_id)
        gen_token(user)

      {:error, _} ->
        register_oauth_user(provider)
    end
  end

  defp find_oauth_provider(provider) do
    OauthProvider
    |> ORM.find_by(
      provider: provider.provider,
      provider_id: provider.provider_id
    )
  end

  @doc """
  get default subscribed communities for unlogin user
  """
  def default_subscribed_communities(%{page: _, size: _} = filter) do
    filter = Map.merge(filter, %{size: @default_subscribed_communities, category: "pl"})

    with {:ok, home_community} <- ORM.find_by(Community, slug: "home"),
         {:ok, paged_communities} <- ORM.find_all(Community, filter) do
      %{
        entries: paged_communities.entries ++ [home_community],
        page_number: paged_communities.page_number,
        page_size: paged_communities.page_size,
        total_count: paged_communities.total_count + 1,
        total_pages: paged_communities.total_pages
      }
      |> done()
    else
      _error ->
        %{
          entries: [],
          page_number: 1,
          page_size: @default_subscribed_communities,
          total_count: 0,
          total_pages: 1
        }
        |> done()
    end
  end

  @doc """
  get users subscribed communities
  """
  def subscribed_communities(%User{id: id} = user, %{page: page, size: size} = filter) do
    filter = filter |> Map.delete(:first)
    # TODO: merge customed index
    CommunitySubscriber
    |> where([c], c.user_id == ^id)
    |> join(:inner, [c], cc in assoc(c, :community))
    |> select([c, cc], cc)
    |> QueryBuilder.filter_pack(filter)
    |> ORM.paginator(~m(page size)a)
    |> sort_communities(user)
    |> done()
  end

  # sort by users sort customization
  defp sort_communities(paged_communities, user) do
    with {:ok, customization} <- Accounts.get_customization(user) do
      case Enum.empty?(customization.sidebar_communities_index) do
        true ->
          paged_communities

        false ->
          entries =
            Enum.map(paged_communities.entries, fn c ->
              index = Map.get(customization.sidebar_communities_index, c.slug, 100_000)
              %{c | index: index}
            end)

          %{paged_communities | entries: entries}
      end
    end
  end

  defp register_oauth_user(oauth_profile) do
    Multi.new()
    |> Multi.run(:create_user, fn _, _ ->
      create_user(oauth_profile)
    end)
    |> Multi.run(:create_profile, fn _, %{create_user: user} ->
      create_profile(user, oauth_profile)
    end)
    |> Multi.run(:update_profile_social, fn _, %{create_user: user} ->
      update_profile_social(user, oauth_profile)
    end)
    |> Multi.run(:init_achievement, fn _, %{create_user: user} ->
      Achievement |> ORM.upsert_by([user_id: user.id], %{user_id: user.id})
    end)
    |> Repo.transaction()
    |> register_oauth_result
  end

  defp gen_token(%User{} = user) do
    with {:ok, token, _info} <- Guardian.jwt_encode(user) do
      {:ok, %{token: token, user: user}}
    end
  end

  defp create_user(profile) do
    attrs = %{
      login: profile.login,
      nickname: profile.nickname,
      avatar: profile.avatar,
      bio: profile |> Map.get(:bio, ""),
      email: profile |> Map.get(:email, ""),
      company: profile |> Map.get(:company, "")
    }

    User |> ORM.create(attrs)
  end

  def update_profile_social(user, %{provider: "github"} = profile) do
    update_social_ifneed(user, %{
      social: %{
        github: "https://github.com/#{profile.login}"
      }
    })
  end

  def update_profile_social(_, _), do: {:ok, :pass}

  defp create_profile(user, oauth_profile) do
    # OauthProvider |> ORM.create(Map.merge(oauth_profile, %{"user_id" => user.id}))
    OauthProvider |> ORM.create(Map.merge(oauth_profile, %{user_id: user.id}))
  end

  defp update_social_ifneed(%User{} = user, %{social: attrs}) do
    attrs = Map.merge(%{user_id: user.id}, attrs)
    Social |> ORM.upsert_by([user_id: user.id], attrs)
  end

  defp update_social_ifneed(changeset, %User{} = user, %{social: attrs}) do
    case ORM.find_by(Social, user_id: user.id) do
      {:ok, _} ->
        ORM.update_by(Social, [user_id: user.id], attrs)
        Ecto.Changeset.put_change(changeset, :social, nil)

      {:error, _} ->
        ORM.create(Social, attrs)
        changeset
    end
  end

  defp update_social_ifneed(changeset, _user, _attrs), do: changeset

  defp assign_default_contributes(%User{} = user) do
    {:ok, contributes} = Statistics.list_contributes_digest(%User{id: user.id})
    ORM.update_embed(user, :contributes, contributes)
  end

  defp register_oauth_result({:ok, %{create_user: create_user}}) do
    {:ok, user} = ORM.find(User, create_user.id, preload: :oauth_providers)

    with {:ok, result} <- gen_token(user) do
      Email.welcome(user)
      Email.notify_admin(user, :new_register)

      {:ok, result}
    end
  end

  defp register_oauth_result({:error, :create_user, %Ecto.Changeset{} = result, _steps}),
    do: {:error, result}

  defp register_oauth_result({:error, :create_user, _result, _steps}),
    do: {:error, "Accounts create_user internal error"}

  defp register_oauth_result({:error, :create_profile, _result, _steps}),
    do: {:error, "Accounts create_profile internal error"}

  defp register_oauth_result({:error, :update_profile_social, _result, _steps}),
    do: {:error, "Accounts update_profile_social error"}
end
