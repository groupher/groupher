defmodule GroupherServer.CMS.Communities.Subscriptions.Setup do
  @moduledoc """
  Internal setup/maintenance subscription workflow.

  New-user defaults and event maintenance are not user commands and therefore
  intentionally do not accept or manufacture a business `command_id`.

      Setup workflow -> transaction owner -> Persist -> counts/profile projection
  """

  import Ecto.Query

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Communities.Subscriptions.Persist
  alias CMS.Model.Community
  alias Helper.{ORM, T}

  @doc "Creates the Community subscription and updates its subscriber projection."
  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user) do
    result =
      Repo.transact(fn ->
        with %Community{} = locked_community <- lock_community(community.id),
             {:ok, _} <- Persist.subscribe(locked_community, user),
             {:ok, canonical} <- ORM.find(Community, locked_community.id),
             {:ok, canonical} <-
               Communities.Count.update(canonical, user, :subscribers_count, :inc),
             {:ok, _user} <- Accounts.profiles_update_subscribe_state(user) do
          {:ok, canonical}
        end
      end)

    revalidate_user(result, user)
  end

  @doc "Removes the Community subscription and updates its subscriber projection."
  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user) do
    if community.slug != "home" do
      result =
        Repo.transact(fn ->
          with %Community{} = locked_community <- lock_community(community.id),
               {:ok, _} <- Persist.unsubscribe(locked_community, user),
               {:ok, canonical} <- ORM.find(Community, locked_community.id),
               {:ok, canonical} <-
                 Communities.Count.update(canonical, user, :subscribers_count, :dec),
               {:ok, _user} <- Accounts.profiles_update_subscribe_state(user) do
            {:ok, canonical}
          end
        end)

      revalidate_user(result, user)
    else
      {:error, CommunityErrorCat.custom("can not unsubscribe home community")}
    end
  end

  defp lock_community(community_id) do
    Community
    |> where([community], community.id == ^community_id)
    |> lock("FOR UPDATE")
    |> Repo.one()
  end

  defp revalidate_user({:ok, _value} = result, %User{login: login}) when is_binary(login) do
    GroupherServer.FrontDesk.revalidate_user(login)
    result
  end

  defp revalidate_user(result, _user), do: result

  @doc "Subscribes the user only when no subscription currently exists."
  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    if Persist.subscribed?(community, user), do: {:ok, :pass}, else: subscribe(community, user)
  end

  @doc "Ensures the user is subscribed to the default Community."
  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      if Persist.subscribed?(community, user) do
        {:ok, :pass}
      else
        subscribe(community, user)
      end
    end
  end
end
