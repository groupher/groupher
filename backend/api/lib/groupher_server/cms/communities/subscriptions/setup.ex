defmodule GroupherServer.CMS.Communities.Subscriptions.Setup do
  @moduledoc """
  Internal setup/maintenance subscription workflow.

  New-user defaults and event maintenance are not user commands and therefore
  intentionally do not accept or manufacture a business `command_id`.

      Setup workflow -> transaction owner -> Persist -> counts/profile projection
  """

  alias GroupherServer.{Accounts, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Communities
  alias CMS.Communities.ErrorCat, as: CommunityErrorCat
  alias CMS.Communities.Subscriptions.Persist
  alias CMS.Model.Community
  alias Helper.{ORM, T}

  @spec subscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def subscribe(%Community{} = community, %User{} = user) do
    Repo.transact(fn ->
      with {:ok, _} <- Persist.subscribe(community, user),
           {:ok, canonical} <- ORM.find(Community, community.id),
           {:ok, canonical} <- Communities.Count.update(canonical, user, :subscribers_count, :inc),
           {:ok, _user} <- Accounts.Profiles.update_subscribe_state(user) do
        {:ok, canonical}
      end
    end)
  end

  @spec unsubscribe(Community.t(), User.t()) :: T.domain_res(Community.t())
  def unsubscribe(%Community{} = community, %User{} = user) do
    with true <- community.slug != "home" do
      Repo.transact(fn ->
        with {:ok, _} <- Persist.unsubscribe(community, user),
             {:ok, canonical} <- ORM.find(Community, community.id),
             {:ok, canonical} <-
               Communities.Count.update(canonical, user, :subscribers_count, :dec),
             {:ok, _user} <- Accounts.Profiles.update_subscribe_state(user) do
          {:ok, canonical}
        end
      end)
    else
      false -> {:error, CommunityErrorCat.custom("can not unsubscribe home community")}
    end
  end

  @spec subscribe_ifnot(Community.t(), User.t()) :: T.domain_res(term())
  def subscribe_ifnot(%Community{} = community, %User{} = user) do
    if Persist.subscribed?(community, user), do: {:ok, :pass}, else: subscribe(community, user)
  end

  @spec subscribe_default_ifnot(User.t()) :: T.domain_res(atom() | Community.t())
  def subscribe_default_ifnot(%User{} = user) do
    with {:ok, community} <- ORM.find_by(Community, slug: "home") do
      if Persist.subscribed?(community, user),
        do: {:ok, :pass},
        else: subscribe(community, user)
    end
  end
end
