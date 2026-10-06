defmodule GroupherServer.CMS.Interactions.ReactionUsers do
  @moduledoc """
  Loads paged users attached to an Article-owned Interaction fact.

  Business position:

      CMS.Interactions users facade
        -> Interaction-owned reaction query
        -> QueryBuilder / Repo
  """

  import Ecto.Query, warn: false
  import GroupherServer.CMS.Artiment.Matcher
  import ShortMaps

  alias GroupherServer.CMS

  alias CMS.FrontDesk.Relation
  alias CMS.QueryBuilder
  alias Helper.ORM

  @doc "Loads one page of users for the supplied Article reaction query."
  def load(queryable, article, filter) do
    {:ok, thread} = Relation.thread_of(article)
    %{page: page, size: size} = filter

    with {:ok, info} <- match(thread) do
      queryable
      |> where([user], field(user, ^info.foreign_key) == ^article.id)
      |> QueryBuilder.load_inner_users(filter)
      |> ORM.paginator(~m(page size)a)
      |> then(&{:ok, &1})
    end
  end
end
