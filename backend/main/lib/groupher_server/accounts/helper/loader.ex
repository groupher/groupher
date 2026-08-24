defmodule GroupherServer.Accounts.Helper.Loader do
  @moduledoc """
  Builds the Accounts Dataloader source used by Absinthe association fields.

  Custom query clauses keep GraphQL-specific filtering and joins at the loader
  boundary rather than leaking them into Accounts domain reads.

  Business position:

      Client / Auth
        -> GraphQL or internal API
        -> Accounts facade
        -> Loader
        -> Repo
  """
  import Ecto.Query, warn: false

  alias GroupherServer.Repo
  alias Helper.QueryBuilder

  alias GroupherServer.CMS.Model.CommunitySubscriber

  @doc "Returns the Accounts Ecto Dataloader source."
  def data, do: Dataloader.Ecto.new(Repo, query: &query/2)

  @doc "Applies field arguments to an Accounts Dataloader query."
  def query({"communities_subscribers", CommunitySubscriber}, %{filter: filter}) do
    CommunitySubscriber
    |> QueryBuilder.filter_pack(filter)
    |> join(:inner, [u], c in assoc(u, :community))
    |> select([u, c], c)
  end

  def query(queryable, _args), do: queryable
end
