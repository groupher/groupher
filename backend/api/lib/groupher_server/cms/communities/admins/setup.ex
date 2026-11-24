defmodule GroupherServer.CMS.Communities.Admins.Setup do
  @moduledoc """
  Initializes the owner Admin membership inside Community creation transactions.

      Community creation -> Admins.Setup -> CommunityAdmin / Admin count
  """

  alias GroupherServer.{CMS, Repo}
  alias CMS.Communities
  alias CMS.Model.{Community, CommunityAdmin}
  alias Helper.{ORM, T}

  @doc "Adds the Community owner as its initial lord Admin."
  @spec add_lord(Community.t(), GroupherServer.Accounts.Model.User.t()) :: T.domain_res(term())
  def add_lord(%Community{} = community, %GroupherServer.Accounts.Model.User{} = owner) do
    if Repo.in_transaction?() do
      with {:ok, admin} <-
             ORM.create(CommunityAdmin, %{
               user_id: owner.id,
               community_id: community.id,
               is_lord: true,
               permissions: %{}
             }),
           {:ok, _community} <- Communities.Count.update(community, owner, :admins_count, :inc) do
        {:ok, admin}
      end
    else
      {:error, :community_admin_transaction_required}
    end
  end
end
