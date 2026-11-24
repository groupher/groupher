defmodule GroupherServer.CMS.Search.Community do
  @moduledoc """
  Bounded Community suggestions for title/slug/alias pickers.
  These suggestions have a fixed limit and no pagination metadata.

      Search -> public Community scope -> at most fifteen suggestions
  """

  import Ecto.Query

  alias GroupherServer.{CMS, Repo}
  alias GroupherServer.{Accounts}
  alias Accounts.Model.User
  alias CMS.Gate.Context.Scope.Community, as: CommunityContext
  alias CMS.Model.Community

  @search_items_count 15

  @doc "Searches public communities by title, slug, or alias, returning at most fifteen results."
  def search(title), do: run(title, nil, nil)

  @doc "Searches public communities with a viewer for subscription state or a category filter."
  def search(title, %User{} = viewer), do: run(title, nil, viewer)

  def search(title, category) when is_binary(category), do: run(title, category, nil)

  @doc "Searches a category for public communities and includes viewer subscription state."
  def search(title, category, %User{} = viewer), do: run(title, category, viewer)

  defp run(title, category, viewer) do
    query =
      Community
      |> CMS.Gate.scope(viewer, :list, CommunityContext.public())
      |> where(
        [community],
        ilike(community.title, ^"%#{title}%") or ilike(community.slug, ^"%#{title}%") or
          ilike(community.aka, ^"%#{title}%")
      )
      |> category_scope(category)
      |> distinct(true)
      |> order_by([community], desc: community.id)
      |> limit(@search_items_count)

    entries = Repo.all(query)

    entries =
      case viewer do
        %User{meta: meta} when not is_nil(meta) ->
          Enum.map(
            entries,
            &%{&1 | viewer_has_subscribed: &1.id in meta.subscribed_communities_ids}
          )

        _ ->
          entries
      end

    {:ok, entries}
  end

  defp category_scope(query, nil), do: query

  defp category_scope(query, category) do
    query
    |> join(:inner, [community], category in assoc(community, :categories),
      as: :suggestion_category
    )
    |> where([suggestion_category: category_row], category_row.slug == ^category)
  end
end
