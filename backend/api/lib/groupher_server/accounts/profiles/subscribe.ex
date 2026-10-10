defmodule GroupherServer.Accounts.Profiles.Subscribe do
  @moduledoc """
  Synchronizes a user's subscribed-community counters and id cache.

  Subscription writes update join rows elsewhere. This helper rebuilds the
  denormalized profile fields used by viewer state and community navigation.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Subscribe
        -> Repo
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{Accounts, CMS, FrontDesk, Repo}
  alias Accounts.Model.User
  alias Accounts.Profiles.ErrorCat
  alias CMS.Model.CommunitySubscriber
  alias Helper.ORM

  def update_subscribe_state(%User{} = user) do
    canonical_user =
      User
      |> where([candidate], candidate.id == ^user.id)
      |> lock("FOR UPDATE")
      |> Repo.one()

    case canonical_user do
      %User{} = locked_user ->
        query =
          from(s in CommunitySubscriber,
            where: s.user_id == ^locked_user.id,
            join: c in assoc(s, :community),
            select: c.id
          )

        subscribed_communities_ids = Repo.all(query)
        subscribed_communities_count = length(subscribed_communities_ids)

        with {:ok, updated_user} <-
               ORM.update(locked_user, %{
                 subscribed_communities_count: subscribed_communities_count
               }),
             {:ok, updated_user} <-
               ORM.update_meta(updated_user, %{
                 subscribed_communities_ids: subscribed_communities_ids
               }) do
          revalidate_user({:ok, updated_user}, updated_user.login)
        end

      nil ->
        {:error, ErrorCat.not_exist("User")}
    end
  end

  defp revalidate_user({:ok, _result} = response, login) when is_binary(login) do
    FrontDesk.revalidate().user(login)
    response
  end

  defp revalidate_user(response, _login), do: response
end
