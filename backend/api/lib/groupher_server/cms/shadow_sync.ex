defmodule GroupherServer.CMS.ShadowSync do
  @moduledoc """
  Refreshes one page of user snapshots without changing participation membership.

      article/comment page + nested replies
        -> flatten display paths -> one Snapshot batch -> restore original tree

  Counts, member order, owner revisions and persisted JSON remain unchanged.
  """

  alias GroupherServer.CMS
  alias CMS.{Model.Embeds, Snapshot}

  @member_fields [
    :comments_participants,
    :reply_participants,
    [:article_stats, :comments_participants]
  ]

  @doc "Refreshes explicit user snapshot paths using the existing Snapshot boundary."
  @spec users_in([map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  def users_in(items, fields, opts \\ []), do: Snapshot.users_in(items, fields, opts)

  @doc "Refreshes the user display fields on one Article."
  @spec refresh_article(map(), keyword()) :: map()
  def refresh_article(article, opts \\ []) do
    [article] |> refresh_articles(opts) |> List.first()
  end

  @doc "Refreshes Article participants and reactions in a single page-wide user batch."
  @spec refresh_articles([map()] | nil, keyword()) :: [map()] | nil
  def refresh_articles(articles, opts \\ []) do
    refresh_tree(articles, [:latest_upvoted_users, :latest_collected_users], opts)
  end

  @doc "Refreshes Comment participants and reactions, including all reply previews."
  @spec refresh_comments([map()] | nil, keyword()) :: [map()] | nil
  def refresh_comments(comments, opts \\ []) do
    refresh_tree(comments, [:latest_upvoted_users], opts)
  end

  @doc "Refreshes only emotion user fields throughout a page and its reply previews."
  @spec emotion_users_in([map()] | nil, keyword()) :: [map()] | nil
  def emotion_users_in(items, opts \\ []) do
    refresh_tree(items, [], opts, false)
  end

  defp refresh_tree(items, fixed_fields, opts, members? \\ true)
  defp refresh_tree(nil, _fixed_fields, _opts, _members?), do: nil
  defp refresh_tree([], _fixed_fields, _opts, _members?), do: []

  defp refresh_tree(items, fixed_fields, opts, members?) do
    nodes = flatten(items)
    members = if members?, do: @member_fields, else: []

    fields =
      Enum.uniq(members ++ Enum.map(fixed_fields, &[:meta, &1]) ++ emotion_fields(nodes))

    refreshed =
      nodes
      |> Snapshot.users_in(fields, opts)
      |> Enum.map(&normalize_fields(&1, fields))

    {tree, []} = restore(items, refreshed)
    tree
  end

  defp flatten(items) do
    Enum.flat_map(items, fn item ->
      [item | flatten(reply_items(item))]
    end)
  end

  defp restore([], remaining), do: {[], remaining}

  defp restore([original | rest], [refreshed | remaining]) do
    {replies, remaining} = restore(reply_items(original), remaining)

    refreshed =
      if is_list(Map.get(original, :replies)) do
        Map.put(refreshed, :replies, replies)
      else
        refreshed
      end

    {rest, remaining} = restore(rest, remaining)
    {[refreshed | rest], remaining}
  end

  defp reply_items(item) do
    case Map.get(item, :replies) do
      replies when is_list(replies) -> replies
      _ -> []
    end
  end

  defp emotion_fields(nodes) do
    Enum.flat_map(nodes, fn node ->
      case Map.get(node, :emotions) do
        emotions when is_map(emotions) ->
          emotions
          |> Map.keys()
          |> Enum.filter(&latest_users_key?/1)
          |> Enum.map(&[:emotions, &1])

        _ ->
          []
      end
    end)
  end

  defp normalize_fields(item, fields) do
    Enum.reduce(fields, item, fn field, item ->
      path = Enum.map(List.wrap(field), &Access.key/1)

      case get_in(item, path) do
        users when is_list(users) -> put_in(item, path, Enum.map(users, &Embeds.User.normalize/1))
        _ -> item
      end
    end)
  end

  defp latest_users_key?(key) when is_atom(key) or is_binary(key) do
    key |> to_string() |> String.starts_with?("latest_")
  end

  defp latest_users_key?(_), do: false
end
