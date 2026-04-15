defmodule GroupherServer.CMS.Helper.Loader do
  @moduledoc """
  dataloader for cms context
  """
  import Ecto.Query, warn: false

  alias GroupherServer.{CMS, Repo}
  alias CMS.Model.Author

  def data, do: Dataloader.Ecto.new(Repo, query: &query/2)

  def query(Author, _args) do
    from(a in Author, join: u in assoc(a, :user), select: u)
  end

  # default loader
  def query(queryable, _args) do
    queryable
  end
end
