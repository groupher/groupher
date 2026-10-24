defmodule GroupherServer.CMS.Communities.Query do
  @moduledoc """
  Collection queries for communities.

  Business position:

      Client / reviewer
        -> CMS.Communities
        -> Query
        -> Repo / Oban
  """

  import Ecto.Query
  import Helper.Utils, only: [done: 1]

  alias GroupherServer.{Accounts, CMS, Repo}

  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.QueryBuilder
  alias CMS.Communities.Query.Contract
  alias Accounts.Model.User
  alias CMS.Model.{Community, Category}
  alias Helper.ORM
  alias Helper.ORM.Pagi.{Order}
  alias GroupherServer.{Pagi}
  alias Pagi.Params

  @doc """
  Returns the canonical public Community query for composable collection scopes.

  ## Examples

      Query.public_query()
      #=> #Ecto.Query<from c in Community, ...>
  """
  @spec public_query() :: Ecto.Query.t() | {:error, term()}
  def public_query do
    CMS.Gate.scope(Community, nil, :list, CommunityContext.public())
  end

  @doc """
  Returns the navigation category configuration in stable index order.

  ## Examples

      Query.categories()
      #=> {:ok, [%Category{}]}
  """
  @spec categories() :: {:ok, [Category.t()]} | {:error, term()}
  def categories do
    Category
    |> order_by([category], asc: category.index, asc: category.id)
    |> Repo.all()
    |> done()
  end

  @doc """
  Pages public communities; filters and Pagi position have separate owners.

  Supported filters are validated by `Communities.Query.Contract`; sorting is
  independently restricted to the contract's registered values.

  ## Examples

      Query.page(%{category: "engineering", sort: :most_views}, %Pagi{}, viewer)
      #=> {:ok, %{entries: [%Community{}], page_info: %{...}}}
  """
  @spec page(map(), Params.t() | nil, User.t() | nil) :: tuple()
  def page(filter, pagi, viewer \\ nil) do
    filter = Map.reject(filter, fn {_key, value} -> is_nil(value) end)
    sort = Map.get(filter, :sort, :desc_inserted)

    with {:ok, :pass} <- Contract.validate_filter(filter),
         true <- sort in Contract.sort_values() do
      query =
        public_query()
        |> QueryBuilder.filter_pack(Map.delete(filter, :sort))

      with {:ok, page} <-
             ORM.pagi(query, pagi,
               for: Community,
               order: order_by_views(sort),
               surface: "communities.list",
               query_fingerprint:
                 :erlang.term_to_binary(Map.put(filter, :sort, sort)) |> Base.encode64()
             ) do
        entries =
          Enum.map(page.entries, fn community ->
            case viewer do
              %User{meta: meta} when not is_nil(meta) ->
                %{
                  community
                  | viewer_has_subscribed: community.id in meta.subscribed_communities_ids
                }

              _ ->
                community
            end
          end)

        {:ok, %{page | entries: entries}}
      end
    else
      {:error, _reason} = error -> error
      false -> {:error, Pagi.unsupported_sort()}
    end
  end

  defp order_by_views(:most_views) do
    %Order{
      fields: [:views, :inserted_at, :id],
      directions: [:desc_nulls_last, :desc, :desc],
      cursor_fields: [:views, :inserted_at, :id]
    }
  end

  defp order_by_views(:least_views) do
    %Order{
      fields: [:views, :inserted_at, :id],
      directions: [:asc_nulls_first, :desc, :desc],
      cursor_fields: [:views, :inserted_at, :id]
    }
  end

  defp order_by_views(:asc_inserted) do
    %Order{
      fields: [:inserted_at, :id],
      directions: [:asc, :asc],
      cursor_fields: [:inserted_at, :id]
    }
  end

  defp order_by_views(_sort) do
    %Order{
      fields: [:inserted_at, :id],
      directions: [:desc, :desc],
      cursor_fields: [:inserted_at, :id]
    }
  end
end
