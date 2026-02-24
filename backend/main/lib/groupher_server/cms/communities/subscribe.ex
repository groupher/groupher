defmodule GroupherServer.CMS.Communities.Subscribe do
  @moduledoc """
  Subscribe helpers for communities.
  """

  alias Ecto.Multi
  alias GroupherServer.{Accounts, CMS, Repo}

  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Model.{Community, CommunitySubscriber}
  alias Helper.ORM
  alias Helper.Types, as: T

  @doc """
  subscribe a community. (ONLY community, post etc use watch )
  """
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe(%Community{} = community, %User{} = user) do
    with {:ok, record} <-
           ORM.create(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      Multi.new()
      |> Multi.run(:subscribed_community, fn _, _ ->
        ORM.find(Community, record.community_id)
      end)
      |> Multi.run(:update_community_count, fn _, %{subscribed_community: community} ->
        Communities.Count.update(community, user, :subscribers_count, :inc)
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
  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(term())
  def unsubscribe(%Community{id: community_id}, %User{} = user) do
    with {:ok, community} <- ORM.find(Community, community_id),
         true <- community.slug !== "home" do
      Multi.new()
      |> Multi.run(:unsubscribed_community, fn _, _ ->
        ORM.findby_delete!(CommunitySubscriber, %{community_id: community.id, user_id: user.id})
      end)
      |> Multi.run(:update_community_count, fn _, _ ->
        Communities.Count.update(community, user, :subscribers_count, :dec)
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

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    with {:error, _} <-
           ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
      subscribe(community, user)
    end
  end

  @doc """
  if user is new subscribe home community by default
  """
  # 这里只处理第一次订阅 home 社区
  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(term())
  def subscribe_default_ifnot(%User{} = user) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      case ORM.find_by(CommunitySubscriber, %{community_id: community.id, user_id: user.id}) do
        {:error, _} -> subscribe(community, user)
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

  defp result({:error, _, result, _steps}) do
    {:error, result}
  end
end
