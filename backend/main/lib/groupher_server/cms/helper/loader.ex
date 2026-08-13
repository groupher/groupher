defmodule GroupherServer.CMS.Helper.Loader do
  @moduledoc """
  Builds the CMS Dataloader source used by Absinthe association fields.

  The custom Author clause projects the related User directly; other CMS
  schemas retain Dataloader's default Ecto association query.

  Business position:

      GraphQL resolver / job
        -> CMS facade
        -> Loader
        -> Repo / external boundary
  """
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Author

  @doc "Returns the CMS Ecto Dataloader source."
  def data, do: Dataloader.Ecto.new(Repo, query: &query/2)

  @doc "Builds the query used for a CMS Dataloader batch."
  def query(Author, _args) do
    from(a in Author, join: u in assoc(a, :user), select: u)
  end

  # default loader
  def query(queryable, _args) do
    queryable
  end
end
