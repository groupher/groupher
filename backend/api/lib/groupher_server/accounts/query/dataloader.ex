defmodule GroupherServer.Accounts.Query.Dataloader do
  @moduledoc """
  Builds the Accounts Dataloader source and Context-owned association queries.

      caller -> GroupherServer.Accounts.Query.Dataloader -> result
  """

  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias Helper.QueryBuilder
  alias CMS.Model.CommunitySubscriber

  @doc "Returns the Accounts Ecto Dataloader source."
  @spec dataloader_source() :: Dataloader.Ecto.t()
  def dataloader_source, do: Dataloader.Ecto.new(Repo, query: &query/2)

  @doc """
  For the community subscription association with a filter, filters subscription rows
  and selects their joined communities. Returns other queryables unchanged.
  """
  def query({"communities_subscribers", CommunitySubscriber}, %{filter: filter}) do
    CommunitySubscriber
    |> QueryBuilder.filter_pack(filter)
    |> join(:inner, [u], c in assoc(u, :community))
    |> select([u, c], c)
  end

  def query(queryable, _args), do: queryable
end
