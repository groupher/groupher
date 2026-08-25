defmodule GroupherServer.CMS.ShadowSync do
  @moduledoc """
  Refreshes display-only user snapshots without changing reaction membership.

  This is the reaction-facing boundary for latest-user snapshots. It preserves
  list membership, order and length; only profile fields are patched.

  Business position:

      CMS read projection -> ShadowSync -> cached/account user summaries
  """

  alias GroupherServer.CMS.{Model.Embeds, Snapshot}

  @spec users_in([map()] | nil, [atom() | [atom()]], keyword()) :: [map()] | nil
  @doc "Refreshes requested nested user snapshots while preserving their paths and membership."
  def users_in(items, fields, opts \\ []), do: Snapshot.users_in(items, fields, opts)

  @spec refresh_article(map(), keyword()) :: map()
  @doc "Refreshes all fixed-reaction and emotion latest-user snapshots on one article."
  def refresh_article(article, opts \\ []) do
    article
    |> List.wrap()
    |> refresh_articles(opts)
    |> List.first()
  end

  @spec refresh_articles([map()] | nil, keyword()) :: [map()] | nil
  @doc "Refreshes all fixed-reaction and emotion latest-user snapshots in an article list."
  def refresh_articles(articles, opts \\ [])
  def refresh_articles(nil, _opts), do: nil

  def refresh_articles(articles, opts) do
    articles
    |> Enum.map(&refresh_fixed_users(&1, [:latest_upvoted_users, :latest_collected_users], opts))
    |> emotion_users_in(opts)
  end

  @spec refresh_comments([map()] | nil, keyword()) :: [map()] | nil
  @doc "Refreshes fixed-reaction and emotion latest-user snapshots in comments and replies."
  def refresh_comments(comments, opts \\ [])
  def refresh_comments(nil, _opts), do: nil

  def refresh_comments(comments, opts) do
    comments
    |> Enum.map(&refresh_fixed_users(&1, [:latest_upvoted_users], opts))
    |> emotion_users_in(opts)
  end

  @spec emotion_users_in([map()] | nil, keyword()) :: [map()] | nil
  @doc "Refreshes only dynamic emotion latest-user snapshots, including embedded replies."
  def emotion_users_in(items, opts \\ [])
  def emotion_users_in(nil, _opts), do: nil
  def emotion_users_in([], _opts), do: []

  def emotion_users_in(items, opts) when is_list(items) do
    Enum.map(items, &refresh_item(&1, opts))
  end

  defp refresh_item(%{replies: replies} = item, opts) when is_list(replies) do
    item
    |> refresh_emotions(opts)
    |> Map.put(:replies, emotion_users_in(replies, opts))
  end

  defp refresh_item(item, opts), do: refresh_emotions(item, opts)

  defp refresh_fixed_users(%{meta: meta} = item, fields, opts) when is_map(meta) do
    refreshed_meta =
      Enum.reduce(fields, meta, fn field, acc ->
        case Map.get(acc, field) do
          users when is_list(users) -> Map.put(acc, field, refresh_user_snapshots(users, opts))
          _ -> acc
        end
      end)

    Map.put(item, :meta, refreshed_meta)
  end

  defp refresh_fixed_users(item, _fields, _opts), do: item

  defp refresh_emotions(%{emotions: emotions} = item, opts) when is_map(emotions) do
    emotion_fields = if is_struct(emotions), do: Map.from_struct(emotions), else: emotions

    refreshed =
      Map.new(emotion_fields, fn {key, value} ->
        if latest_users_key?(key) and is_list(value) do
          {key, refresh_user_snapshots(value, opts)}
        else
          {key, value}
        end
      end)

    refreshed = if is_struct(emotions), do: struct(emotions, refreshed), else: refreshed
    Map.put(item, :emotions, refreshed)
  end

  defp refresh_emotions(item, _opts), do: item

  defp latest_users_key?(key) when is_atom(key),
    do: key |> Atom.to_string() |> String.starts_with?("latest_")

  defp latest_users_key?(key) when is_binary(key), do: String.starts_with?(key, "latest_")
  defp latest_users_key?(_key), do: false

  defp refresh_user_snapshots(snapshots, opts) do
    snapshots
    |> Snapshot.users(opts)
    |> Enum.map(&Embeds.User.normalize/1)
  end
end
