defmodule GroupherServer.Analysis.Contribution.Workflow do
  @moduledoc """
  Owns contribution mutation transactions for users and communities.

      Contribution command
          -> transaction
          -> Persist facts / projection
          -> commit
          -> Effects cache and revalidation
  """

  alias GroupherServer.{Accounts, Analysis, CMS, Repo}
  alias Accounts.Model.User
  alias CMS.Model.Community
  alias Analysis.Contribution.{Effects, Persist, Query}
  alias Helper.ORM

  @doc """
  Records today's user contribution and refreshes the embedded digest.

  ## Examples

      Analysis.Contribution.Workflow.make_contribution(user)
  """
  @spec make_contribution(User.t()) :: {:ok, struct()} | {:error, term()}
  def make_contribution(%User{id: id}) do
    with {:ok, user} <- ORM.find(User, id),
         {:ok, %{contribute: contribute, user: user}} <- transact_user(user) do
      Effects.revalidate_user(user)
      {:ok, contribute}
    end
  end

  @spec make_contribution(Community.t()) :: {:ok, term()} | {:error, term()}
  def make_contribution(%Community{} = community) do
    case Repo.transaction(fn ->
           with {:ok, contribute} <- Persist.record_community(community),
                digest <- Query.community_records(community) |> Query.digest_from_records(),
                {:ok, result} <-
                  CMS.communities_update_operations(
                    community,
                    %{contributes_digest: digest},
                    Ecto.UUID.generate()
                  ) do
             %{contribute: contribute, community: result}
           else
             {:error, reason} -> Repo.rollback(reason)
           end
         end) do
      {:ok, %{contribute: contribute}} ->
        Effects.cache_community_later(community)
        {:ok, contribute}

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp transact_user(user) do
    case Repo.transaction(fn ->
           with {:ok, contribute} <- Persist.record_user(user),
                digest <- Query.list_contributions_digest(user),
                {:ok, user} <-
                  Accounts.profiles_refresh_contributions(user.id, unwrap(digest)) do
             %{contribute: contribute, user: user}
           else
             {:error, reason} -> Repo.rollback(reason)
           end
         end) do
      {:ok, result} -> {:ok, result}
      {:error, reason} -> {:error, reason}
    end
  end

  defp unwrap({:ok, value}), do: value
  defp unwrap({:error, reason}), do: Repo.rollback(reason)
end
